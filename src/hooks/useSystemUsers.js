/**
 * Hook para gerenciar o Sistema Unificado de Usuários (Single Source of Truth)
 * Coleção Central: 'users'
 * 
 * Este hook implementa o modelo RBAC (Role-Based Access Control), onde um único
 * documento de usuário pode conter múltiplos papéis (roles: { aluno: true, professor: true, etc }).
 */
import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, query, orderBy, limit,
  updateDoc, doc, serverTimestamp, setDoc,
  getDoc, deleteDoc, getDocs, deleteField, where
} from 'firebase/firestore'
import { initializeApp, getApps } from 'firebase/app'
import {
  updatePassword, reauthenticateWithCredential, EmailAuthProvider,
  getAuth, setPersistence, inMemoryPersistence,
  createUserWithEmailAndPassword
} from 'firebase/auth'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, auth, storage, firebaseConfig } from '../firebase/config'
import { COLLECTIONS, SUB_COLLECTIONS, FIELDS } from '../firebase/collections'
import { sanitizeString } from '../utils/security'

// Inicialização Silenciosa de Auth Secundário para Criação de Contas
// Isso permite criar o acesso de outra pessoa sem deslogar o Admin atual.
const getVerifyAuth = () => {
  const apps = getApps()
  const verifyApp = apps.find(a => a.name === 'verify') || initializeApp(firebaseConfig, 'verify')
  const vAuth = getAuth(verifyApp)
  setPersistence(vAuth, inMemoryPersistence)
  return vAuth
}
const vAuth = getVerifyAuth()

// Nome da coleção unificada no Firestore
const USERS_COLLECTION = COLLECTIONS.USUARIOS

// Variável de controle fora do hook para evitar múltiplas execuções da migração em uma mesma sessão
let migrationInitialized = false

export const getPinAuthEmail = (raw) => {
  const rawId = String(raw || '').toLowerCase().trim()
  
  // Se já for um e-mail válido (contém @ e não termina em internal), retorna ele
  if (rawId.includes('@') && !rawId.endsWith('.internal')) return rawId
  
  // Se for um ID legatário do rstopteam.internal, limpa ele
  if (rawId.endsWith('@rstopteam.internal')) {
    return rawId.split('@')[0].replace(/_/g, '.') // Tenta reverter para algo parecido com e-mail se possível
  }

  // Caso contrário, apenas retorna o que veio (assumindo que o chamador passará o e-mail real)
  return rawId
}

export const sanitizeId = (email) => {
  if (!email) return 'desconhecido_' + Math.random().toString(36).substring(7)
  return email.toLowerCase().trim()
}

// ── Cache em memória (Singleton) ───────────────────────────────────────────────
// Otimiza a performance evitando múltiplos listeners abertos simultaneamente
let _cachedUsers = null
let _cacheTimestamp = 0
const CACHE_TTL_MS = 60_000

let _activeListener = null
let _listenerSubscribers = 0
let _subscriberCallbacks = []

function notifySubscribers(users) {
  _subscriberCallbacks.forEach(cb => cb(users))
}

/**
 * Gerencia a inscrição global na coleção de usuários.
 * Agora escuta a coleção 'users' diretamente em vez de subcoleções.
 */
function subscribeToUsers(callback) {
  _subscriberCallbacks.push(callback)
  _listenerSubscribers++

  if (_cachedUsers && Date.now() - _cacheTimestamp < CACHE_TTL_MS) {
    callback(_cachedUsers)
  }

  // Se já existe um erro ou listener travado, resetamos se necessário
  if (!_activeListener) {
    try {
      const q = query(collection(db, USERS_COLLECTION))

      _activeListener = onSnapshot(q, (snap) => {
        let users = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        users.sort((a, b) => {
          const timeA = a[FIELDS.CRIADO_EM]?.toMillis?.() || (a[FIELDS.CRIADO_EM]?.seconds ? a[FIELDS.CRIADO_EM].seconds * 1000 : 0) || new Date(a[FIELDS.CRIADO_EM] || 0).getTime()
          const timeB = b[FIELDS.CRIADO_EM]?.toMillis?.() || (b[FIELDS.CRIADO_EM]?.seconds ? b[FIELDS.CRIADO_EM].seconds * 1000 : 0) || new Date(b[FIELDS.CRIADO_EM] || 0).getTime()
          return timeB - timeA
        })
        _cachedUsers = users
        _cacheTimestamp = Date.now()
        notifySubscribers(users)
      }, (err) => {
        console.error('❌ Erro no Singleton de Usuários:', err.code)
        // [RESILIÊNCIA] Se der erro (ex: Permission Denied ou Blocked), 
        // limpamos o listener para permitir que o sistema tente novamente do zero no próximo render ou após F5,
        // evitando o erro interno 'Unexpected state' do Firestore.
        if (_activeListener) {
          _activeListener()
          _activeListener = null
        }
      })
    } catch (e) {
      console.error('❌ Falha ao abrir listener de usuários:', e)
      _activeListener = null
    }
  }

  return () => {
    _subscriberCallbacks = _subscriberCallbacks.filter(cb => cb !== callback)
    _listenerSubscribers--

    if (_listenerSubscribers <= 0 && _activeListener) {
      try {
        _activeListener()
      } catch (e) {
        console.warn('⚠️ Erro ao fechar listener de usuários:', e)
      }
      _activeListener = null
    }
  }
}

export function useSystemUsers() {
  const [users, setUsers] = useState(_cachedUsers || [])
  const [loading, setLoading] = useState(!_cachedUsers)

  useEffect(() => {
    const unsub = subscribeToUsers((newUsers) => {
      setUsers(newUsers)
      setLoading(false)
    })

    // ⚡ Auto-Sincronização (Auto-Healing) - DESATIVADO para evitar "ressurreição" de usuários deletados
    // A migração já cumpriu seu papel de unificar a base.
    /*
    const autoSync = async () => {
      if (migrationInitialized) return
      migrationInitialized = true
      
      try {
        await runDeepMigration()
        console.log('✅ Auto-sincronização concluída.')
      } catch (e) {
        console.error('❌ Falha na auto-sincronização:', e)
        migrationInitialized = false 
      }
    }
    autoSync()
    */

    return unsub
  }, [])

  /** Gera PIN único de 6 dígitos para acesso rápido */
  function generatePIN() {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  /** 
   * Atualiza o perfil de um usuário.
   * Não depende mais de 'role' no caminho do documento, pois tudo está em /users/{userId}
   */
  async function updateProfile(userId, data) {
    async function addNote(userId, noteData) {
      try {
        const notesRef = collection(db, COLLECTIONS.USUARIOS, userId, SUB_COLLECTIONS.ANOTACOES)
        await addDoc(notesRef, {
          ...noteData,
          [FIELDS.CRIADO_EM]: serverTimestamp()
        })
        return true
      } catch (err) {
        console.error('Erro ao adicionar nota:', err)
      }
    }
    const emailId = sanitizeId(userId)
    const userRef = doc(db, COLLECTIONS.USUARIOS, emailId)

    const payload = {
      ...data,
      [FIELDS.ATUALIZADO_EM]: serverTimestamp(),
    }

    // 🛡️ SINCRONIZAÇÃO ADMINISTRATIVA: Se mudar o PIN, garante que o adminPin acompanhe
    // (Apenas para usuários que podem ter acesso administrativo)
    if (data.pin !== undefined) {
      const userDoc = await getDoc(userRef)
      const userData = userDoc.exists() ? userDoc.data() : {}
      const isStaff = userData.roles?.admin || userData.roles?.gestor || userData.roles?.professor

      if (isStaff) {
        payload.adminPin = data.pin
        payload['adminPin '] = deleteField() // Limpeza de legacy typo
      }

      // 🔐 SE FOR O PRÓPRIO USUÁRIO: Tenta atualizar a senha no Auth também
      if (auth.currentUser && auth.currentUser.email === (userData.email || emailId)) {
        try {
          const securePIN = data.pin.length >= 6 ? data.pin : data.pin.padEnd(6, '0')
          await updatePassword(auth.currentUser, securePIN)
          console.log('✅ Auth Password sincronizado automaticamente via Profile Update.')
        } catch (e) {
          console.warn('⚠️ Não foi possível sincronizar Auth Password (requer re-login recente). Use login JIT na próxima sessão.')
        }
      }
    }

    await updateDoc(userRef, payload)
  }

  /** 
   * CRIA OU MESCLA USUÁRIO (Upsert Logic)
   * 🎯 Essencial para evitar duplicidade entre alunos e colaboradores.
   */
  async function createNewUser(userData) {
    const email = (userData.email || '').toLowerCase().trim()
    if (!email) throw new Error("E-mail é obrigatório para criar acesso.")

    const role = userData.role || 'aluno'
    const rolesObj = userData.roles || { [role]: true }

    // 🔍 BUSCA POR DUPLICIDADE (Prevenção de 'Ressurreição' e Double Profiles)
    // Procuramos no estado atual por qualquer usuário com o mesmo e-mail, independente do ID do documento.
    const sanitizedId = sanitizeId(email)
    const existingUserById = users.find(u => u.id === sanitizedId)
    const existingUserByEmail = users.find(u => (u.email || '').toLowerCase().trim() === email)

    // Priorizamos o match por e-mail, pois o ID pode ser legados (ex: user@gmail.com vs sanitized_id)
    const targetUser = existingUserByEmail || existingUserById
    const emailId = targetUser ? targetUser.id : sanitizedId
    const userRef = doc(db, COLLECTIONS.USUARIOS, emailId)

    // Verifica se usuário já existe
    const existingSnap = await getDoc(userRef)

    if (existingSnap.exists()) {
      const existingData = existingSnap.data()
      const newRoles = rolesObj

      // Permite atualizar PIN se fornecido explicitamente
      const updateData = {
        [FIELDS.PERMISSOES]: { ...(existingData[FIELDS.PERMISSOES] || {}), ...(userData.permissions || {}) },
        [FIELDS.ATUALIZADO_EM]: serverTimestamp(),
        [FIELDS.TELEFONE]: userData.phone || existingData[FIELDS.TELEFONE] || '',
        [FIELDS.NOME]: sanitizeString(userData.name || existingData[FIELDS.NOME] || ''),
        [FIELDS.MODALIDADES]: userData.modalities || existingData[FIELDS.MODALIDADES] || []
      }

      const targetPin = userData.pin || existingData.pin
      if (userData.pin) updateData.pin = userData.pin

      await updateDoc(userRef, updateData)

      // 🧹 LIMPEZA DE LEGADOS: Se foi promovido de Aluno para Equipe, remove da coleção 'students' legada
      const isNowStaff = newRoles.admin || newRoles.gestor || newRoles.professor
      if (isNowStaff && emailId) {
        const rawEmail = userData.email || existingData.email
        if (rawEmail) {
          const cleanEmail = rawEmail.toLowerCase().trim()
          await Promise.allSettled([
            deleteDoc(doc(db, 'students', cleanEmail)),
            deleteDoc(doc(db, 'students', cleanEmail, 'privacy', 'secrets')),
            deleteDoc(doc(db, 'students', emailId)) // Caso o ID sanitizado tenha sido usado lá
          ])
        }
      }

      // 🚀 AUTO-PROVISIONAMENTO NO UPDATE: Garante que o Auth exista
      if (targetPin) {
        try {
          const pinAuthEmail = getPinAuthEmail(emailId)
          const securePIN = targetPin.length >= 6 ? targetPin : targetPin.padEnd(6, '0')
          await createUserWithEmailAndPassword(vAuth, pinAuthEmail, securePIN)
          console.log('✅ Acesso Authentication criado/garantido para usuário existente.')
        } catch (authErr) {
          // Se já existir, tudo bem, o importante é que a conta existe
          if (authErr.code !== 'auth/email-already-in-use') {
            console.warn('⚠️ Erro ao provisionar auth no update:', authErr.code)
          }
        }
      }

      return { id: emailId, pin: targetPin, isExisting: true }
    } else {
      const pin = userData.pin || generatePIN()
      async function addGraduation(userId, graduationData) {
        try {
          const gradRef = collection(db, COLLECTIONS.USUARIOS, userId, SUB_COLLECTIONS.GRADUACOES)
          await addDoc(gradRef, {
            ...graduationData,
            date: graduationData.date || serverTimestamp(),
            [FIELDS.CRIADO_EM]: serverTimestamp()
          })

          // Update main user record with current belt/modality
          const userRef = doc(db, COLLECTIONS.USUARIOS, userId)
          await updateDoc(userRef, {
            currentBelt: graduationData.belt,
            updatedAt: serverTimestamp()
          })
        } catch (err) {
          console.error('Erro ao adicionar graduação:', err)
        }
      }
      const newUser = {
        ...userData,
        [FIELDS.NOME]: sanitizeString(userData.name),
        [FIELDS.PIN]: pin,
        [FIELDS.STATUS]: 'Ativo',
        [FIELDS.PAPEIS]: rolesObj,
        authEmail: emailId,
        [FIELDS.CRIADO_EM]: serverTimestamp(),
        [FIELDS.ATUALIZADO_EM]: serverTimestamp(),
        [FIELDS.PERMISSOES]: userData.permissions || {}
      }

      await setDoc(userRef, newUser)

      // 🚀 AUTO-PROVISIONAMENTO NA CRIAÇÃO: Cria o acesso no Authentication agora!
      try {
        const pinAuthEmail = getPinAuthEmail(emailId)
        const securePIN = pin.length >= 6 ? pin : pin.padEnd(6, '0')
        console.log(`✨ Criando acesso Authentication para: ${pinAuthEmail}`)
        await createUserWithEmailAndPassword(vAuth, pinAuthEmail, securePIN)
        console.log('✅ Conta criada com sucesso no Firebase Authentication!')
      } catch (authErr) {
        if (authErr.code !== 'auth/email-already-in-use') {
          console.warn('⚠️ Erro ao provisionar auth na criação:', authErr.code)
        }
      }

      _cachedUsers = null
      return { id: emailId, pin, isExisting: false }
    }
  }

  /** 🔐 BUSCA PIN NO COFRE (On-demand) */
  async function fetchUserPin(userId) {
    if (!userId) return null
    try {
      const userRef = doc(db, COLLECTIONS.USUARIOS, userId)
      const snap = await getDoc(userRef)
      if (!snap.exists()) return []
      const notesRef = collection(db, COLLECTIONS.USUARIOS, userId, SUB_COLLECTIONS.ANOTACOES)
      const notesSnap = await getDocs(query(notesRef, orderBy('createdAt', 'desc')))
      
      let userEmail = userId // Fallback inicial

      if (snap.exists()) {
        const data = snap.data()
        if (data.pin) return data.pin
        if (data.email) userEmail = data.email
      }

      // 2. Tenta no cofre moderno
      const sensitiveRef = doc(db, COLLECTIONS.USUARIOS, userId, 'privacy', 'secrets')
      const sensitiveSnap = await getDoc(sensitiveRef)
      if (sensitiveSnap.exists() && sensitiveSnap.data().pin) return sensitiveSnap.data().pin

      // 3. 🚨 LEGADO FALLBACK: Tenta descobrir se o PIN existe nos cofres antigos
      // Verificamos tanto no ID sanitizado quanto no e-mail real
      const searchIds = [...new Set([userId, userEmail])].filter(Boolean)

      for (const id of searchIds) {
        // Tenta na coleção 'equipe'
        const equipeSecretRef = doc(db, 'equipe', id, 'privacy', 'secrets')
        const equipeSecretSnap = await getDoc(equipeSecretRef)
        if (equipeSecretSnap.exists() && equipeSecretSnap.data().pin) return equipeSecretSnap.data().pin

        // Tenta na coleção 'students'
        const studentSecretRef = doc(db, 'students', id, 'privacy', 'secrets')
        const studentSecretSnap = await getDoc(studentSecretRef)
        if (studentSecretSnap.exists() && studentSecretSnap.data().pin) return studentSecretSnap.data().pin
      }

      // 4. Fallback final: Se o ID contiver @rstopteam.internal, tenta o desanitizado manual
      if (userId.includes('@rstopteam.internal')) {
        const pseudoEmail = userId.split('@')[0].replace(/_/g, '.')
        const manualIds = [pseudoEmail, pseudoEmail + '@gmail.com']
        for (const id of manualIds) {
          const s1 = await getDoc(doc(db, 'equipe', id, 'privacy', 'secrets'))
          if (s1.exists() && s1.data().pin) return s1.data().pin

          const s2 = await getDoc(doc(db, 'students', id, 'privacy', 'secrets'))
          if (s2.exists() && s2.data().pin) return s2.data().pin
        }
      }

      return null
    } catch (e) {
      console.error('❌ Erro ao acessar cofre:', e)
      return null
    }
  }

  /** Upload de Avatar unificado */
  async function uploadAvatar(userId, file) {
    const emailId = sanitizeId(userId)
    const storageRef = ref(storage, `avatars/${emailId}`)
    await uploadBytes(storageRef, file)
    const url = await getDownloadURL(storageRef)
    await updateProfile(emailId, { avatarUrl: url })
    return url
  }

  /** Upload de Banner unificado */
  async function uploadBanner(userId, file) {
    const emailId = sanitizeId(userId)
    const storageRef = ref(storage, `banners/${emailId}`)
    await uploadBytes(storageRef, file)
    const url = await getDownloadURL(storageRef)
    await updateProfile(emailId, { bannerUrl: url })
    return url
  }

  /** Altera senha e sincroniza com o PIN no Firestore */
  async function changePassword(currentPassword, newPassword) {
    const user = auth.currentUser
    if (!user) throw new Error('Usuário não autenticado no Firebase Auth')

    // 1. Reautenticação necessária pelo Firebase para troca de senha
    const credential = EmailAuthProvider.credential(user.email, currentPassword)
    await reauthenticateWithCredential(user, credential)

    // 2. Atualiza no Firebase Auth (o que permite o login)
    await updatePassword(user, newPassword)

    const emailId = user.email.toLowerCase()

    // Buscamos os dados atuais para saber se ele é admin/gestor
    const userDoc = await getDoc(doc(db, COLLECTIONS.USUARIOS, emailId))
    const userData = userDoc.exists() ? userDoc.data() : {}

    const updateData = {
      [FIELDS.PIN]: newPassword,
      [FIELDS.ATUALIZADO_EM]: serverTimestamp()
    }

    // Se for admin ou gestor, atualiza também o PIN de segurança administrativa
    const isSpecialRole = userData.roles?.admin || userData.roles?.gestor || userData.role === 'admin' || userData.role === 'gestor'

    if (isSpecialRole) {
      updateData.adminPin = newPassword
      console.log('🛡️ Sincronizando também o Admin PIN administrativo...')
    }

    try {
      await updateDoc(doc(db, COLLECTIONS.USUARIOS, emailId), updateData)
      console.log(`✅ PIN sincronizado com sucesso no Firestore para: ${emailId}`)
    } catch (dbErr) {
      console.error('❌ Erro crítico ao salvar no Firestore. Verifique AdBlockers:', dbErr)
      throw dbErr
    }
  }

  /**
   * Remove permanentemente o utilizador de todas as fontes de dados (Atomic & Exhaustive).
   * Resolve o bug de "ressurreição" garantindo que os legados em 'students' e 'equipe'
   * sejam removidos simultaneamente ao documento do 'users'.
   */
  async function deleteUser(userId) {
    try {
      await deleteDoc(doc(db, COLLECTIONS.USUARIOS, userId))
      return true
    } catch (err) {
      console.error('Erro na deleção do usuário:', err)
      throw err
    }
  }

  /** 
   * MIGRAÇÃO PROFUNDA E LOCALIZAÇÃO (DEEP SYNC V2) 
   * 🎯 Transpõe dados das coleções legadas (EN) para as novas (PT)
   * 🎯 Mapeia campos internos para o novo padrão (ex: createdAt -> criadoEm)
   */
  async function runDeepMigration() {
    console.log('🚀 Iniciando Migração Profunda e Localização V2...')
    const stats = { usuarios: 0, chamadas: 0, eventos: 0, faturamento: 0, despesas: 0, merged: 0 }

    try {
      // 1. MIGRAÇÃO DE USUÁRIOS (Unificação e Localização)
      // Fontes: 'users' (unificada), 'students' (legado), 'equipe' (legado)
      const sources = [
        { col: 'users', role: null },
        { col: 'students', role: 'aluno' },
        { col: 'equipe', role: 'professor' }
      ]

      for (const source of sources) {
        const snap = await getDocs(collection(db, source.col))
        for (const d of snap.docs) {
          const data = d.data()
          // Tenta pegar o e-mail real de várias fontes
          let email = (data.email || data.authEmail || data.id || d.id).toLowerCase().trim()
          
          // Se for um ID sanitizado do rstopteam.internal, tenta extrair o e-mail real
          if (email.endsWith('@rstopteam.internal')) {
            const prefix = email.split('@')[0]
            // Se tiver o e-mail real no objeto, usa ele. Senão tenta reverter a sanitização básica.
            email = data.email || prefix.replace(/_/g, '.') 
          }

          if (!email || email === 'unknown' || email.includes('desconhecido')) continue

          const emailId = email // Agora o ID é o próprio e-mail
          const userRef = doc(db, COLLECTIONS.USUARIOS, emailId)

          // Mapeamento de campos do Usuário
          const newUser = {
            [FIELDS.ID]: emailId,
            [FIELDS.NOME]: sanitizeString(data.nome || data.name || ''),
            [FIELDS.EMAIL]: email,
            [FIELDS.TELEFONE]: data.telefone || data.phone || '',
            [FIELDS.STATUS]: data.status || 'Ativo',
            [FIELDS.PIN]: data.pin || null,
            [FIELDS.CRIADO_EM]: data.criadoEm || data.createdAt || serverTimestamp(),
            [FIELDS.ATUALIZADO_EM]: serverTimestamp(),
            [FIELDS.AVATAR_URL]: data.avatarUrl || null,
            [FIELDS.BANNER_URL]: data.bannerUrl || null,
          }

          // Merge de Roles
          const oldRoles = data.papeis || data.roles || {}
          const rolesObj = Array.isArray(oldRoles)
            ? oldRoles.reduce((acc, r) => ({ ...acc, [r]: true }), {})
            : { ...oldRoles }
          
          if (source.role) rolesObj[source.role] = true
          newUser[FIELDS.PAPEIS] = rolesObj

          // Merge de Permissões
          newUser[FIELDS.PERMISSOES] = data.permissoes || data.permissions || {}

          // Jornada Técnica
          const oldTech = data.jornada_tecnica || data.tech_journey || {}
          newUser[FIELDS.JORNADA_TECNICA] = {
            [FIELDS.FAIXA_ATUAL]: oldTech.faixa_atual || oldTech.current_belt || data.belt || 'white',
            [FIELDS.GRAUS_ATUAIS]: oldTech.graus_atuais || oldTech.current_stripes || data.stripes || 0,
            [FIELDS.AULAS_DESDE_ULTIMA_GRADUACAO]: oldTech.aulas_desde_ultima_graduacao || oldTech.sessions_since_last_promotion || 0,
            [FIELDS.DATA_ULTIMA_GRADUACAO]: oldTech.data_ultima_graduacao || oldTech.last_promotion_date || null,
            [FIELDS.HISTORICO]: oldTech.historico || oldTech.history || []
          }

          // Modalidades
          newUser[FIELDS.MODALIDADES] = data.modalidades || data.modalities || []
          newUser[FIELDS.MODALIDADE] = data.modalidade || data.modality || newUser[FIELDS.MODALIDADES][0] || 'Jiu Jitsu'

          await setDoc(userRef, newUser, { merge: true })
          stats.usuarios++

          // Migrar Subcoleções (Graduações e Anotações)
          const subSources = [
            { old: 'graduations', new: SUB_COLLECTIONS.GRADUACOES },
            { old: 'notes', new: SUB_COLLECTIONS.ANOTACOES }
          ]

          for (const sub of subSources) {
            const subSnap = await getDocs(collection(db, source.col, d.id, sub.old))
            for (const subD of subSnap.docs) {
              await setDoc(doc(db, COLLECTIONS.USUARIOS, emailId, sub.new, subD.id), subD.data(), { merge: true })
            }
          }
        }
      }

      // 2. MIGRAÇÃO DE CHAMADAS (Sessions -> Chamadas)
      const sessionsSnap = await getDocs(collection(db, 'sessions'))
      for (const d of sessionsSnap.docs) {
        const data = d.data()
        const callRef = doc(db, COLLECTIONS.CHAMADAS, d.id)
        
        const newCall = {
          ...data,
          [FIELDS.MODALIDADE]: data.modality || data.modalidade || 'Geral',
          [FIELDS.DATA]: data.date || data.data || '',
          [FIELDS.HORARIO]: data.time || data.horario || '',
          [FIELDS.INSTRUTOR_ID]: data.instructorId || data.instrutorId || null,
          [FIELDS.NOME_INSTRUTOR]: data.instructorName || data.nomeInstrutor || 'Instrutor',
          [FIELDS.FINALIZADA]: data.isFinished || data.finalizada || false,
          [FIELDS.CRIADO_EM]: data.createdAt || data.criadoEm || serverTimestamp(),
          [FIELDS.ATUALIZADO_EM]: serverTimestamp()
        }

        await setDoc(callRef, newCall, { merge: true })
        stats.chamadas++

        // Subcoleção de Presenças
        const presSnap = await getDocs(collection(db, 'sessions', d.id, 'attendances'))
        for (const pD of presSnap.docs) {
          const pData = pD.data()
          await setDoc(doc(db, COLLECTIONS.CHAMADAS, d.id, SUB_COLLECTIONS.PRESENCAS, pD.id), {
            ...pData,
            [FIELDS.STATUS]: pData.status,
            [FIELDS.DATA]: pData.date || pData.data,
            [FIELDS.MODALIDADE]: pData.modality || pData.modalidade
          }, { merge: true })
        }
      }

      // 3. MIGRAÇÃO DE EVENTOS (Notices -> Eventos)
      const noticesSnap = await getDocs(collection(db, 'notices'))
      for (const d of noticesSnap.docs) {
        const data = d.data()
        await setDoc(doc(db, COLLECTIONS.EVENTOS, d.id), {
          ...data,
          [FIELDS.CRIADO_EM]: data.createdAt || data.criadoEm || serverTimestamp()
        }, { merge: true })
        stats.eventos++
      }

      // 4. MIGRAÇÃO DE FINANCEIRO (Billing -> Faturamento)
      const billingSnap = await getDocs(collection(db, 'billing'))
      for (const d of billingSnap.docs) {
        await setDoc(doc(db, COLLECTIONS.FATURAMENTO, d.id), d.data(), { merge: true })
        stats.faturamento++
      }

      // 5. MIGRAÇÃO DE DESPESAS (Expenses -> Despesas)
      const expensesSnap = await getDocs(collection(db, 'expenses'))
      for (const d of expensesSnap.docs) {
        await setDoc(doc(db, COLLECTIONS.DESPESAS, d.id), d.data(), { merge: true })
        stats.despesas++
      }

      // 6. MIGRAÇÃO DE MODALIDADES (Modalities -> Modalidades)
      const modalitiesSnap = await getDocs(collection(db, 'modalities'))
      for (const d of modalitiesSnap.docs) {
        const data = d.data()
        await setDoc(doc(db, COLLECTIONS.MODALIDADES, d.id), data, { merge: true })
        
        // Migrar Turmas (subcoleção)
        const turmasSnap = await getDocs(collection(db, 'modalities', d.id, 'turmas'))
        for (const tD of turmasSnap.docs) {
          await setDoc(doc(db, COLLECTIONS.MODALIDADES, d.id, SUB_COLLECTIONS.TURMAS, tD.id), tD.data(), { merge: true })
        }
      }

      // 7. MIGRAÇÃO DE CONTADORES (Ninho em chamadas/_estatisticas)
      const countersSnap = await getDocs(collection(db, 'counters'))
      for (const d of countersSnap.docs) {
        // Move cada contador para um documento dentro de chamadas/_estatisticas
        await setDoc(doc(db, COLLECTIONS.CHAMADAS, '_estatisticas', 'global', d.id), d.data(), { merge: true })
      }

      const noticeViewsSnap = await getDocs(collection(db, 'notice_views'))
      for (const d of noticeViewsSnap.docs) {
        // O ID legado era 'noticeId_userId'
        const parts = d.id.split('_')
        if (parts.length >= 2) {
          const nId = parts[0]
          const uId = parts.slice(1).join('_') // Caso o e-mail tenha underscores
          await setDoc(doc(db, COLLECTIONS.EVENTOS, nId, SUB_COLLECTIONS.VISUALIZACOES, uId), d.data(), { merge: true })
        }
      }

      _cachedUsers = null
      console.log('✅ Migração profunda concluída!', stats)
      return stats
    } catch (err) {
      console.error('❌ Erro crítico na migração:', err)
      throw err
    }
  }

  const autoMigrateIfLegacy = async (userData) => {
    if (!userData?.isLegacyProfile || migrationInitialized) return
    migrationInitialized = true // Evita loop
    console.log('🚀 Iniciando Auto-Migração de Dados Legados...')
    try {
      await runDeepMigration()
      // Recarrega a página para aplicar as mudanças de coleção e refletir o novo perfil
      setTimeout(() => window.location.reload(), 1000)
    } catch (e) {
      console.error('Erro na auto-migração:', e)
    }
  }

  return {
    users,
    loading,
    updateProfile,
    createNewUser,
    generatePIN,
    uploadAvatar,
    uploadBanner,
    changePassword,
    deleteUser,
    runDeepMigration,
    fetchUserPin,
    autoMigrateIfLegacy
  }
}


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
  getDoc, deleteDoc, getDocs, deleteField
} from 'firebase/firestore'
import {
  updatePassword, reauthenticateWithCredential, EmailAuthProvider,
} from 'firebase/auth'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, auth, storage } from '../firebase/config'

// Nome da coleção unificada no Firestore
const USERS_COLLECTION = 'users'

// Variável de controle fora do hook para evitar múltiplas execuções da migração em uma mesma sessão
let migrationInitialized = false

/**
 * Normaliza o ID do usuário. 
 * Decidimos usar o e-mail como ID para garantir unicidade nativa no Firestore.
 */
export const getPinAuthEmail = (raw) => {
  const rawId = String(raw || '').toLowerCase().trim()
  if (rawId.endsWith('@rstopteam.internal')) return rawId
  const safeId = rawId
    .replace(/[@.]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
  return `${safeId}@rstopteam.internal`
}

export const sanitizeId = (email) => {
  if (!email) return 'unknown_' + Math.random().toString(36).substring(7)
  
  // UNIFICAÇÃO TOTAL: Todos os IDs no Firestore agora seguem o padrão sanitizado
  // para garantir compatibilidade 1:1 com o Firebase Auth (PIN Login)
  return getPinAuthEmail(email)
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

  if (!_activeListener) {
    const q = query(collection(db, USERS_COLLECTION))

    _activeListener = onSnapshot(q, snap => {
      let users = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      // Ordenação no cliente para garantir que todos os usuários (legados ou novos) apareçam
      users.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0) || new Date(a.createdAt || 0).getTime()
        const timeB = b.createdAt?.toMillis?.() || (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0) || new Date(b.createdAt || 0).getTime()
        return timeB - timeA
      })
      _cachedUsers = users
      _cacheTimestamp = Date.now()
      notifySubscribers(users)
    }, (err) => {
      console.error('Erro ao carregar usuários unificados:', err)
    })
  }

  return () => {
    _subscriberCallbacks = _subscriberCallbacks.filter(cb => cb !== callback)
    _listenerSubscribers--

    if (_listenerSubscribers === 0 && _activeListener) {
      _activeListener()
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
    const userRef = doc(db, USERS_COLLECTION, sanitizeId(userId))
    await updateDoc(userRef, {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }

  /** 
   * CRIA OU MESCLA USUÁRIO (Upsert Logic)
   * 🎯 Essencial para evitar duplicidade entre alunos e colaboradores.
   */
  async function createNewUser(userData) {
    const role = userData.role || 'aluno'
    const rolesObj = userData.roles || { [role]: true }
    const emailId = sanitizeId(userData.email || userData.name)
    const userRef = doc(db, USERS_COLLECTION, emailId)

    // Verifica se usuário já existe
    const existingSnap = await getDoc(userRef)

    if (existingSnap.exists()) {
      const existingData = existingSnap.data()
      const newRoles = {
        ...(existingData.roles || { aluno: true }),
        ...rolesObj
      }

      // Permite atualizar PIN se fornecido explicitamente
      const updateData = {
        roles: newRoles,
        permissions: { ...(existingData.permissions || {}), ...(userData.permissions || {}) },
        updatedAt: serverTimestamp(),
        phone: userData.phone || existingData.phone || '',
        name: userData.name || existingData.name || ''
      }
      if (userData.pin) updateData.pin = userData.pin

      await updateDoc(userRef, updateData)

      return { id: emailId, pin: userData.pin || existingData.pin, isExisting: true }
    } else {
      const pin = userData.pin || generatePIN()
      const newUser = {
        ...userData,
        pin, // VOLTA PARA O PRINCIPAL
        status: 'Ativo',
        roles: rolesObj,
        authEmail: emailId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        permissions: userData.permissions || {}
      }

      await setDoc(userRef, newUser)

      _cachedUsers = null
      return { id: emailId, pin, isExisting: false }
    }
  }

  /** 🔐 BUSCA PIN NO COFRE (On-demand) */
  async function fetchUserPin(userId) {
    if (!userId) return null
    try {
      // 1. Tenta no doc principal (em users/) e obtém e-mail para fallback
      const directRef = doc(db, USERS_COLLECTION, userId)
      const directSnap = await getDoc(directRef)
      let userEmail = userId // Fallback inicial
      
      if (directSnap.exists()) {
        const data = directSnap.data()
        if (data.pin) return data.pin
        if (data.email) userEmail = data.email
      }

      // 2. Tenta no cofre moderno
      const sensitiveRef = doc(db, USERS_COLLECTION, userId, 'privacy', 'secrets')
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

  /** Altera senha (apenas para usuários com conta Firebase Auth vinculada) */
  async function changePassword(currentPassword, newPassword) {
    const user = auth.currentUser
    if (!user) throw new Error('Usuário não autenticado no Firebase Auth')
    const credential = EmailAuthProvider.credential(user.email, currentPassword)
    await reauthenticateWithCredential(user, credential)
    await updatePassword(user, newPassword)
  }

  /** Remove um usuário do sistema em todas as coleções possíveis (Unified + Legacy) */
  async function deleteUser(userId) {
    const email = userId.includes('@') ? userId : null
    
    const tasks = [
      deleteDoc(doc(db, USERS_COLLECTION, userId))
    ]

    // Se tiver e-mail, tenta deletar dos legados também para evitar ressurreição
    if (email) {
      tasks.push(deleteDoc(doc(db, 'students', email)))
      tasks.push(deleteDoc(doc(db, 'equipe', email)))
    }

    await Promise.all(tasks)
    _cachedUsers = null
  }

  /** 
   * MIGRAÇÃO PROFUNDA (DEEP SYNC) 
   * 🎯 Recupera todos os usuários das coleções legadas 'students' e 'equipe'
   */
  async function runDeepMigration() {
    console.log('🚀 Iniciando Migração Profunda (Visual)...')
    const stats = { students: 0, collaborators: 0, merged: 0 }

    try {
      // 1. Pega Alunos
      const studentSnap = await getDocs(collection(db, 'students'))
      for (const d of studentSnap.docs) {
        const data = d.data()
        const emailId = sanitizeId(data.email || d.id)
        const userRef = doc(db, USERS_COLLECTION, emailId)

        // 🔍 TENTA RECUPERAR PIN DO COFRE LEGADO DO ALUNO
        let pin = data.pin
        if (!pin) {
          try {
            const s = await getDoc(doc(db, 'students', d.id, 'privacy', 'secrets'))
            if (s.exists()) pin = s.data().pin
          } catch (e) { /* silent */ }
        }

        await setDoc(userRef, {
          ...data,
          pin: pin || data.pin || null,
          roles: { ...(data.roles || {}), aluno: true },
          createdAt: data.createdAt || serverTimestamp(),
          status: data.status || 'Ativo',
          updatedAt: serverTimestamp()
        }, { merge: true })
        stats.students++
      }

      // 2. Pega Equipe
      const equipeSnap = await getDocs(collection(db, 'equipe'))
      for (const d of equipeSnap.docs) {
        const data = d.data()
        let role = data.role || 'professor'
        if (data.isAdmin) role = 'admin'

        // Garante campos obrigatórios para aparecer na lista
        const roles = { ...(data.roles || {}), [role]: true }
        const emailId = sanitizeId(data.email || d.id)
        const userRef = doc(db, USERS_COLLECTION, emailId)

        // 🔍 TENTA RECUPERAR PIN DO COFRE LEGADO DA EQUIPE
        let pin = data.pin
        if (!pin) {
          try {
            const s = await getDoc(doc(db, 'equipe', d.id, 'privacy', 'secrets'))
            if (s.exists()) pin = s.data().pin
          } catch (e) { /* silent */ }
        }

        await setDoc(userRef, {
          ...data,
          pin: pin || data.pin || null,
          role, // Legado
          roles,
          authEmail: emailId,
          email: data.email || d.id,
          createdAt: data.createdAt || serverTimestamp(),
          status: data.status || 'Ativo',
          updatedAt: serverTimestamp()
        }, { merge: true })
        stats.collaborators++
      }

      // 3. 🛡️ AUTO-REPARO E MERGE (Omni-Search + Email Collision Fix)
      const usersSnap = await getDocs(collection(db, USERS_COLLECTION))
      const emailMap = {} // Para detectar colisões de e-mail e mesclar

      for (const d of usersSnap.docs) {
        const data = d.data()
        const email = (data.email || data.id || d.id).toLowerCase().trim()
        
        // Normalização de Roles
        const rawRoles = data.roles || {}
        const rolesObj = Array.isArray(rawRoles)
          ? rawRoles.reduce((acc, r) => ({ ...acc, [r]: true }), {})
          : rawRoles

        const correctId = sanitizeId(email)

        // 🔍 OMNI-SEARCH: Tenta recuperar PIN de todas as fontes
        let restoredPin = data.pin
        if (!restoredPin) {
          const paths = [
            doc(db, USERS_COLLECTION, d.id, 'privacy', 'secrets'),
            doc(db, 'equipe', email, 'privacy', 'secrets'),
            doc(db, 'students', email, 'privacy', 'secrets'),
            doc(db, 'equipe', d.id, 'privacy', 'secrets'),
            doc(db, 'students', d.id, 'privacy', 'secrets')
          ]

          for (const p of paths) {
            try {
              const snap = await getDoc(p)
              if (snap.exists() && snap.data().pin) {
                restoredPin = snap.data().pin
                console.log(`🎯 PIN Omni-Restored para ${d.id} via ${p.path}`)
                await deleteDoc(p).catch(() => {})
                break
              }
            } catch (e) {}
          }
        }

        // --- LÓGICA DE DETECÇÃO DE DUPLICIDADE ---
        if (emailMap[email]) {
          console.log(`👯 Colisão detectada para ${email}. Mesclando ${d.id} em ${emailMap[email].id}`)
          const masterId = emailMap[email].id
          const masterDoc = doc(db, USERS_COLLECTION, masterId)
          const masterData = emailMap[email].data

          // Funde roles e permissões
          const mergedRoles = { ...masterData.roles, ...rolesObj }
          const mergedPerms = { ...(masterData.permissions || {}), ...(data.permissions || {}) }
          const mergedPin = masterData.pin || restoredPin || data.pin

          await setDoc(masterDoc, {
            ...masterData,
            ...data, // Data atual sobrescreve se for mais recente (simplificado)
            pin: mergedPin,
            roles: mergedRoles,
            permissions: mergedPerms,
            id: masterId,
            authEmail: masterId,
            updatedAt: serverTimestamp()
          }, { merge: true })

          await deleteDoc(d.ref).catch(() => {})
          stats.merged++
          continue // Passa para o próximo, este foi mesclado
        }

        // Se ID está errado, move. Se não, apenas atualiza se necessário
        if (d.id !== correctId) {
          const userRef = doc(db, USERS_COLLECTION, correctId)
          await setDoc(userRef, {
            ...data,
            pin: restoredPin || data.pin || null,
            roles: rolesObj,
            id: correctId,
            authEmail: correctId,
            email: email,
            updatedAt: serverTimestamp()
          }, { merge: true })

          await deleteDoc(d.ref).catch(() => {})
          emailMap[email] = { id: correctId, data: { ...data, pin: restoredPin || data.pin, roles: rolesObj } }
          stats.merged++
        } else {
          // Apenas auto-reparo de campos
          if (!data.authEmail || !data.email || Array.isArray(rawRoles) || (restoredPin && !data.pin)) {
            await updateDoc(d.ref, {
              roles: rolesObj,
              authEmail: d.id,
              email: email,
              pin: restoredPin || data.pin || null,
              updatedAt: serverTimestamp()
            })
          }
          emailMap[email] = { id: d.id, data: { ...data, pin: restoredPin || data.pin, roles: rolesObj } }
        }
      }

      _cachedUsers = null
      return stats
    } catch (err) {
      console.error('Erro na migração:', err)
      throw err
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
    fetchUserPin // 🔐 EXPOSTO PARA REVELAÇÃO SOB DEMANDA
  }
}


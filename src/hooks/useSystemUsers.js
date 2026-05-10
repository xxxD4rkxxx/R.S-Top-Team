/**
 * Hook para gerenciar o Sistema Unificado de Usuários (Single Source of Truth)
 * Coleção Central: 'users'
 * 
 * Este hook implementa o modelo RBAC (Role-Based Access Control), onde um único
 * documento de usuário pode conter múltiplos papéis (roles: { aluno: true, professor: true, etc }).
 */
import { useState, useEffect, useCallback } from 'react'
import {
  collection, onSnapshot, query, orderBy, limit,
  updateDoc, doc, serverTimestamp, setDoc,
  getDoc, deleteDoc, getDocs, deleteField, where, addDoc,
  increment, arrayUnion, arrayRemove
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
const getVerifyAuth = () => {
  const apps = getApps()
  const verifyApp = apps.find(a => a.name === 'verify') || initializeApp(firebaseConfig, 'verify')
  const vAuth = getAuth(verifyApp)
  setPersistence(vAuth, inMemoryPersistence)
  return vAuth
}
const vAuth = getVerifyAuth()

/** Converte e-mail comum para o formato administrativo interno */
const toInternalEmail = (email) => {
  if (!email || email.includes('@rstopteam.internal')) return email;
  return email.toLowerCase()
    .trim()
    .replace('@', '_')
    .replace(/\./g, '_') + '@rstopteam.internal';
};

// Nome da coleção unificada no Firestore
const USERS_COLLECTION = COLLECTIONS.USUARIOS

export const getPinAuthEmail = (raw) => {
  const rawId = String(raw || '').toLowerCase().trim()
  if (rawId.includes('@') && !rawId.endsWith('.internal')) return rawId
  if (rawId.endsWith('@rstopteam.internal')) {
    return rawId.split('@')[0].replace(/_/g, '.')
  }
  return rawId
}

export const sanitizeId = (email) => {
  if (!email) return 'desconhecido_' + Math.random().toString(36).substring(7)
  return email.toLowerCase().trim()
}

// ── Cache em memória (Singleton) ───────────────────────────────────────────────
let _cachedUsers = null
let _cacheTimestamp = 0
const CACHE_TTL_MS = 60_000

let _activeListener = null
let _listenerSubscribers = 0
let _subscriberCallbacks = []

function notifySubscribers(users) {
  _subscriberCallbacks.forEach(cb => cb(users))
}

function subscribeToUsers(callback) {
  _subscriberCallbacks.push(callback)
  _listenerSubscribers++

  if (_cachedUsers && Date.now() - _cacheTimestamp < CACHE_TTL_MS) {
    callback(_cachedUsers)
  }

  if (!_activeListener) {
    try {
      const q = query(collection(db, USERS_COLLECTION))
      _activeListener = onSnapshot(q, (snap) => {
        let users = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        users.sort((a, b) => {
          const timeA = a[FIELDS.CRIADO_EM]?.toMillis?.() || 0
          const timeB = b[FIELDS.CRIADO_EM]?.toMillis?.() || 0
          return timeB - timeA
        })
        _cachedUsers = users
        _cacheTimestamp = Date.now()
        notifySubscribers(users)
      }, (err) => {
        console.error('❌ Erro no Singleton de Usuários:', err.code)
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
    return unsub
  }, [])

  function generatePIN() {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  const updateProfile = useCallback(async (userId, data) => {
    const emailId = sanitizeId(userId)
    const userRef = doc(db, USERS_COLLECTION, emailId)
    const payload = { ...data, [FIELDS.ATUALIZADO_EM]: serverTimestamp() }
    
    if (data.pin !== undefined) {
      const userDoc = await getDoc(userRef)
      const userData = userDoc.exists() ? userDoc.data() : {}
      const isStaff = userData.roles?.admin || userData.roles?.gestor || userData.roles?.professor
      if (isStaff) payload.adminPin = data.pin
    }

    // 🏆 Sincronização de Turmas no Update Perfil
    if (data.turmas) {
      try {
        const userDoc = await getDoc(userRef)
        if (userDoc.exists()) {
          const oldData = userDoc.data()
          const oldTurmas = oldData.turmas || []
          const newTurmas = data.turmas || []
          const studentEmail = oldData.email || emailId

          const toAdd = newTurmas.filter(t => !oldTurmas.includes(t))
          const toRemove = oldTurmas.filter(t => !newTurmas.includes(t))

          const syncPromises = []

          toAdd.forEach(uniqueId => {
            const [mIdRaw, tIdRaw] = uniqueId.includes(':') ? uniqueId.split(':') : [null, uniqueId];
            if (mIdRaw && tIdRaw) {
              const mId = mIdRaw.toLowerCase();
              const tId = tIdRaw.toLowerCase();
              const tRef = doc(db, COLLECTIONS.MODALIDADES, mId, SUB_COLLECTIONS.TURMAS, tId);
              syncPromises.push(updateDoc(tRef, {
                totalAlunos: increment(1),
                alunos: arrayUnion(studentEmail)
              }))
            }
          })

          toRemove.forEach(uniqueId => {
            const [mIdRaw, tIdRaw] = uniqueId.includes(':') ? uniqueId.split(':') : [null, uniqueId];
            if (mIdRaw && tIdRaw) {
              const mId = mIdRaw.toLowerCase();
              const tId = tIdRaw.toLowerCase();
              const tRef = doc(db, COLLECTIONS.MODALIDADES, mId, SUB_COLLECTIONS.TURMAS, tId);
              syncPromises.push(updateDoc(tRef, {
                totalAlunos: increment(-1),
                alunos: arrayRemove(studentEmail)
              }))
            }
          })

          if (syncPromises.length > 0) await Promise.all(syncPromises)
        }
      } catch (err) {
        console.error('❌ Erro ao sincronizar turmas no updateProfile:', err)
      }
    }

    await updateDoc(userRef, payload)
  }, [])

  const createNewUser = useCallback(async (userData) => {
    const email = (userData.email || '').toLowerCase().trim()
    if (!email) throw new Error("E-mail é obrigatório.")

    const emailId = sanitizeId(email)
    const userRef = doc(db, USERS_COLLECTION, emailId)
    const existingSnap = await getDoc(userRef)

    // Normalização de papéis (Roles)
    // Se vier como array (do estado do form), converte para Map
    const rolesMap = Array.isArray(userData.roles)
      ? userData.roles.reduce((acc, r) => ({ ...acc, [r]: true }), {})
      : (userData.roles || { aluno: true })

    // Mapeamento de campos usando as constantes FIELDS para SSoT
    const basePayload = {
      // Preservar campos extras como modalidades, permissões, etc.
      ...userData,
      [FIELDS.NOME]: sanitizeString(userData.name || userData.nome),
      [FIELDS.EMAIL]: email,
      [FIELDS.TELEFONE]: userData.phone || userData.telefone || '',
      [FIELDS.DDD]: userData.ddd || '',
      [FIELDS.TELEFONE_LIMPO]: userData.telefone_limpo || '',
      [FIELDS.TELEFONE_COMPLETO]: userData.telefone_completo || '',
      [FIELDS.PAPEIS]: rolesMap,
      [FIELDS.STATUS]: userData.status || 'Ativo',
      [FIELDS.ATUALIZADO_EM]: serverTimestamp(),
      // 🛡️ Sincronização de Permissões (Compatibilidade com Regras e Schema)
      // 🛡️ Sincronização de Permissões (Compatibilidade com Regras e Schema)
      [FIELDS.PERMISSOES]: userData.permissions || {},
      'permissões': userData.permissions || {},
      startDate: userData.startDate || null
    }

    // Se uma startDate for fornecida, converte para Timestamp, senão deixa vazio/null
    // O criado_em ainda será o serverTimestamp, mas se houver startDate, forçamos.
    if (userData.startDate) {
      basePayload[FIELDS.CRIADO_EM] = new Date(userData.startDate + 'T12:00:00Z')
    }
    // Apenas incluímos campos cujos nomes no Firestore (via FIELDS) são diferentes do nome no formulário.
    const redundantFields = ['name', 'phone', 'roles']

    if (existingSnap.exists()) {
      const existingData = existingSnap.data()

      // Para updateDoc, usamos deleteField() para limpar campos legados se existirem
      redundantFields.forEach(f => {
        basePayload[f] = deleteField()
      })
      
      // Proteção e Geração de PIN:
      // Agora suportamos dois PINs: 'pin' (aluno/normal) e 'adminPin' (administrativo)
      const rolesMap = Array.isArray(userData.roles) 
        ? userData.roles.reduce((acc, r) => ({ ...acc, [r]: true }), {})
        : (userData.roles || {})
        
      const isAdmin = rolesMap.admin === true
      
      let finalPin = userData.pin || existingData.pin
      let finalAdminPin = userData.adminPin || existingData.adminPin || existingData.admPin
      let pinWasGenerated = false;

      // 1. Garante PIN Normal (Para todos ou pelo menos Staff)
      if (!finalPin) {
        finalPin = generatePIN()
        basePayload[FIELDS.PIN] = finalPin
        pinWasGenerated = true
      } else {
        basePayload[FIELDS.PIN] = finalPin
      }

      // 2. Garante PIN Administrativo (Apenas para Admin)
      if (isAdmin && !finalAdminPin) {
        finalAdminPin = generatePIN()
        basePayload['adminPin'] = finalAdminPin
        pinWasGenerated = true
      } else if (finalAdminPin) {
        basePayload['adminPin'] = finalAdminPin
      }

      // 🏆 Sincronização de Turmas no Update (Existing User)
      if (userData.turmas) {
        try {
          const oldTurmas = existingData.turmas || []
          const newTurmas = userData.turmas || []
          const studentEmail = existingData.email || emailId

          const toAdd = newTurmas.filter(t => !oldTurmas.includes(t))
          const toRemove = oldTurmas.filter(t => !newTurmas.includes(t))

          const syncPromises = []
          toAdd.forEach(uId => {
            const [mIdRaw, tIdRaw] = uId.includes(':') ? uId.split(':') : [null, uId];
            if (mIdRaw && tIdRaw) {
              const mId = mIdRaw.toLowerCase();
              const tId = tIdRaw.toLowerCase();
              syncPromises.push(updateDoc(doc(db, COLLECTIONS.MODALIDADES, mId, SUB_COLLECTIONS.TURMAS, tId), {
                totalAlunos: increment(1),
                alunos: arrayUnion(studentEmail)
              }))
            }
          })
          toRemove.forEach(uId => {
            const [mIdRaw, tIdRaw] = uId.includes(':') ? uId.split(':') : [null, uId];
            if (mIdRaw && tIdRaw) {
              const mId = mIdRaw.toLowerCase();
              const tId = tIdRaw.toLowerCase();
              syncPromises.push(updateDoc(doc(db, COLLECTIONS.MODALIDADES, mId, SUB_COLLECTIONS.TURMAS, tId), {
                totalAlunos: increment(-1),
                alunos: arrayRemove(studentEmail)
              }))
            }
          })
          if (syncPromises.length > 0) await Promise.all(syncPromises)
        } catch (e) { }
      }

      await updateDoc(userRef, basePayload)

      // Se geramos um PIN novo para um usuário existente, precisamos criar o Auth Secundário dele
      // 5. Garante Auth de PIN (Aluno)
      if (pinWasGenerated) {
        try {
          const pinAuthEmail = getPinAuthEmail(emailId)
          const securePIN = finalPin.length >= 6 ? finalPin : finalPin.padEnd(6, '0')
          await createUserWithEmailAndPassword(vAuth, pinAuthEmail, securePIN)
        } catch (e) {
          console.warn('Erro ao criar Auth Secundário para Staff promovido:', e.message)
        }
      }

      // 6. 👑 Garante Auth de ADMIN (@rstopteam.internal)
      if (isAdmin && finalAdminPin) {
        try {
          const vAuth = getVerifyAuth()
          const adminAuthEmail = toInternalEmail(emailId)
          const secureAdminPIN = finalAdminPin.length >= 6 ? finalAdminPin : finalAdminPin.padEnd(6, '0')
          await createUserWithEmailAndPassword(vAuth, adminAuthEmail, secureAdminPIN)
          console.log(`[useSystemUsers] Shadow Account criada para: ${adminAuthEmail}`)
        } catch (e) {
          if (e.code === 'auth/email-already-in-use') {
             // Se já existe, opcionalmente poderíamos atualizar o password aqui, 
             // mas para segurança vamos apenas avisar. O password será atualizado via loginAdmin se necessário.
             console.log('[useSystemUsers] Shadow Account já existe.')
          } else {
            console.warn('Erro ao criar Shadow Account Admin:', e.message)
          }
        }
      }

      return { 
        id: emailId, 
        pin: finalPin, 
        adminPin: finalAdminPin, 
        isExisting: true, 
        pinWasGenerated 
      }
    } else {
      const pin = userData.pin || generatePIN()
      const isAdmin = rolesMap.admin === true
      const adminPin = isAdmin ? (userData.adminPin || generatePIN()) : null

      const newUser = {
        ...basePayload,
        [FIELDS.PIN]: pin,
        adminPin: adminPin,
        [FIELDS.CRIADO_EM]: userData.startDate ? new Date(userData.startDate + 'T12:00:00Z') : serverTimestamp()
      }
      
      // Para setDoc (criação), NÃO podemos usar deleteField().
      // Usamos o operador delete do JS para remover as propriedades do objeto.
      redundantFields.forEach(f => {
        delete newUser[f]
      })

      // Limpeza de campos undefined para evitar erro 400 do Firestore
      Object.keys(newUser).forEach(key => {
        if (newUser[key] === undefined) delete newUser[key]
      })

      await setDoc(userRef, newUser)
      
      // 🏆 Sincronização de Turmas na Criação
      if (newUser.turmas && newUser.turmas.length > 0) {
        try {
          const studentEmail = newUser.email || emailId
          const promises = newUser.turmas.map(async (uId) => {
            const [mIdRaw, tIdRaw] = uId.includes(':') ? uId.split(':') : [null, uId];
            if (mIdRaw && tIdRaw) {
              const mId = mIdRaw.toLowerCase();
              const tId = tIdRaw.toLowerCase();
              await updateDoc(doc(db, COLLECTIONS.MODALIDADES, mId, SUB_COLLECTIONS.TURMAS, tId), {
                totalAlunos: increment(1),
                alunos: arrayUnion(studentEmail)
              })
            }
          })
          await Promise.all(promises)
        } catch (e) { }
      }
      
      try {
        const pinAuthEmail = getPinAuthEmail(emailId)
        const securePIN = pin.length >= 6 ? pin : pin.padEnd(6, '0')
        await createUserWithEmailAndPassword(vAuth, pinAuthEmail, securePIN)
      } catch (e) {
        console.warn('Erro ao criar Auth Secundário (PIN):', e.message)
      }

      // 👑 Garante Auth de ADMIN (@rstopteam.internal)
      if (isAdmin && adminPin) {
        try {
          const vAuth = getVerifyAuth()
          const adminAuthEmail = toInternalEmail(emailId)
          const secureAdminPIN = adminPin.length >= 6 ? adminPin : adminPin.padEnd(6, '0')
          await createUserWithEmailAndPassword(vAuth, adminAuthEmail, secureAdminPIN)
        } catch (e) {
          console.warn('Erro ao criar Shadow Account Admin (Novo):', e.message)
        }
      }

      return { id: emailId, pin, adminPin, isExisting: false }
    }
  }, [])

  const fetchUserPin = useCallback(async (userId) => {
    if (!userId) return null
    try {
      const userRef = doc(db, COLLECTIONS.USUARIOS, userId)
      const snap = await getDoc(userRef)
      if (snap.exists() && snap.data().pin) return snap.data().pin
      return null
    } catch (e) {
      return null
    }
  }, [])

  const uploadAvatar = useCallback(async (userId, file) => {
    const emailId = sanitizeId(userId)
    const storageRef = ref(storage, `avatars/${emailId}`)
    await uploadBytes(storageRef, file)
    const url = await getDownloadURL(storageRef)
    await updateProfile(emailId, { avatarUrl: url })
    return url
  }, [updateProfile])

  const uploadBanner = useCallback(async (userId, file) => {
    const emailId = sanitizeId(userId)
    const storageRef = ref(storage, `banners/${emailId}`)
    await uploadBytes(storageRef, file)
    const url = await getDownloadURL(storageRef)
    await updateProfile(emailId, { bannerUrl: url })
    return url
  }, [updateProfile])

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    const user = auth.currentUser
    if (!user) throw new Error('Não autenticado')
    const credential = EmailAuthProvider.credential(user.email, currentPassword)
    await reauthenticateWithCredential(user, credential)
    await updatePassword(user, newPassword)
    await updateProfile(user.email, { pin: newPassword })
  }, [updateProfile])

  const deleteUser = useCallback(async (userId) => {
    try {
      const userRef = doc(db, USERS_COLLECTION, userId)
      const snap = await getDoc(userRef)
      if (snap.exists()) {
        const userData = snap.data()
        const studentEmail = userData.email || userId

        // 1. Limpeza de Turmas (Decremento de contador e remoção da lista)
        if (userData.turmas && userData.turmas.length > 0) {
          const promises = userData.turmas.map(async (uId) => {
            const [mIdRaw, tIdRaw] = uId.includes(':') ? uId.split(':') : [null, uId]
            if (mIdRaw && tIdRaw) {
              const mId = mIdRaw.toLowerCase()
              const tId = tIdRaw.toLowerCase()
              try {
                await updateDoc(doc(db, COLLECTIONS.MODALIDADES, mId, SUB_COLLECTIONS.TURMAS, tId), {
                  totalAlunos: increment(-1),
                  alunos: arrayRemove(studentEmail)
                })
              } catch (e) { console.warn(`Falha ao limpar turma ${uId}:`, e.message) }
            }
          })
          await Promise.all(promises)
        }

        // 2. Limpeza de Subcoleções (Anotações e Graduações) - Dados internos do usuário
        try {
          const notesSnap = await getDocs(collection(userRef, SUB_COLLECTIONS.ANOTACOES))
          await Promise.all(notesSnap.docs.map(d => deleteDoc(d.ref)))
          const gradsSnap = await getDocs(collection(userRef, SUB_COLLECTIONS.GRADUACOES))
          await Promise.all(gradsSnap.docs.map(d => deleteDoc(d.ref)))
        } catch (e) { console.warn('Falha ao limpar subcoleções:', e.message) }
      }

      // Finalmente, deleta o documento principal
      await deleteDoc(userRef)
      console.log(`✅ Usuário ${userId} removido. Turmas e dados internos limpos. Financeiro preservado.`)
    } catch (e) {
      console.error('❌ Erro crítico ao deletar usuário:', e)
      throw e
    }
  }, [])

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
    fetchUserPin
  }
}

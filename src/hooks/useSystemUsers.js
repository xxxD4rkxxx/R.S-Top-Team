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
  getDoc, deleteDoc, getDocs, deleteField, where, addDoc
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
    await updateDoc(userRef, payload)
  }, [])

  const createNewUser = useCallback(async (userData) => {
    const email = (userData.email || '').toLowerCase().trim()
    if (!email) throw new Error("E-mail é obrigatório.")

    const emailId = sanitizeId(email)
    const userRef = doc(db, USERS_COLLECTION, emailId)
    const existingSnap = await getDoc(userRef)

    if (existingSnap.exists()) {
      await updateDoc(userRef, {
        ...userData,
        [FIELDS.ATUALIZADO_EM]: serverTimestamp()
      })
      return { id: emailId, isExisting: true }
    } else {
      const pin = userData.pin || generatePIN()
      const newUser = {
        ...userData,
        [FIELDS.NOME]: sanitizeString(userData.name),
        [FIELDS.PIN]: pin,
        [FIELDS.STATUS]: 'Ativo',
        [FIELDS.PAPEIS]: userData.roles || { aluno: true },
        [FIELDS.CRIADO_EM]: serverTimestamp(),
        [FIELDS.ATUALIZADO_EM]: serverTimestamp()
      }
      await setDoc(userRef, newUser)
      
      try {
        const pinAuthEmail = getPinAuthEmail(emailId)
        const securePIN = pin.length >= 6 ? pin : pin.padEnd(6, '0')
        await createUserWithEmailAndPassword(vAuth, pinAuthEmail, securePIN)
      } catch (e) {}

      return { id: emailId, pin, isExisting: false }
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
    await deleteDoc(doc(db, USERS_COLLECTION, userId))
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

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
  getDoc, deleteDoc, getDocs
} from 'firebase/firestore'
import {
  updatePassword, reauthenticateWithCredential, EmailAuthProvider,
} from 'firebase/auth'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, auth, storage } from '../firebase/config'

// Nome da coleção unificada no Firestore
const USERS_COLLECTION = 'users'

/**
 * Normaliza o ID do usuário. 
 * Decidimos usar o e-mail como ID para garantir unicidade nativa no Firestore.
 */
export const sanitizeId = (email) => {
  if (!email) return 'unknown_' + Math.random().toString(36).substring(7)
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
    const emailId = sanitizeId(userData.email || userData.name) // Prioriza e-mail como ID
    const userRef = doc(db, USERS_COLLECTION, emailId)
    
    // Verifica se usuário já existe para não sobrescrever PIN ou dados vitais
    const existingSnap = await getDoc(userRef)
    
    if (existingSnap.exists()) {
      const existingData = existingSnap.data()
      
      // Lógica de Mesclagem de Papéis (Roles)
      const newRoles = {
        ...(existingData.roles || { aluno: true }),
        [userData.role]: true // Adiciona o novo papel (ex: professor: true)
      }

      // Atualiza apenas os novos papéis e permissões mescladas
      await updateDoc(userRef, {
        roles: newRoles,
        permissions: { ...(existingData.permissions || {}), ...(userData.permissions || {}) },
        updatedAt: serverTimestamp(),
        // Se o usuário era um aluno sem e-mail/telefone, atualizamos com o que veio agora
        phone: userData.phone || existingData.phone || '',
        name: userData.name || existingData.name || ''
      })

      return { id: emailId, pin: existingData.pin, isExisting: true }
    } else {
      // Criação de usuário totalmente novo
      const pin = userData.pin || generatePIN()
      const newUser = {
        ...userData,
        pin,
        status: 'Ativo',
        roles: { [userData.role || 'aluno']: true },
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        permissions: userData.permissions || {}
      }

      await setDoc(userRef, newUser)
      _cachedUsers = null // Invalida cache
      return { id: emailId, pin, isExisting: false }
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

  /** Remove um usuário do sistema */
  async function deleteUser(userId) {
    await deleteDoc(doc(db, USERS_COLLECTION, sanitizeId(userId)))
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
        
        // Garante campos obrigatórios para aparecer na lista (createdAt e status)
        await setDoc(userRef, {
          ...data,
          roles: { ...(data.roles || {}), aluno: true },
          createdAt: data.createdAt || serverTimestamp(), // Pega existente ou gera novo
          status: data.status || 'Ativo',
          updatedAt: serverTimestamp()
        }, { merge: true })
        stats.students++
      }

      // 2. Pega Equipe
      const equipeSnap = await getDocs(collection(db, 'equipe'))
      for (const d of equipeSnap.docs) {
        const data = d.data()
        const emailId = sanitizeId(data.email || d.id)
        const userRef = doc(db, USERS_COLLECTION, emailId)
        
        let role = data.role || 'professor'
        if (data.isAdmin) role = 'admin'

        // Garante campos obrigatórios para aparecer na lista
        await setDoc(userRef, {
          ...data,
          role, // Legado
          roles: { ...(data.roles || {}), [role]: true },
          createdAt: data.createdAt || serverTimestamp(), // Vital para o 'orderBy'
          status: data.status || 'Ativo',
          updatedAt: serverTimestamp()
        }, { merge: true })
        stats.collaborators++
      }

      _cachedUsers = null // Invalida cache
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
    runDeepMigration // Exposto para a UI
  }
}


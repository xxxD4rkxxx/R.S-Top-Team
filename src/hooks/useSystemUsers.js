/**
 * Hook para gerenciar usuários do sistema (admin, gestor, professor, aluno)
 * Coleção: equipe/{role}/membros
 *
 * OTIMIZAÇÕES DE PERFORMANCE:
 * - Cache em memória: evita refetch desnecessário ao re-montar o componente
 * - limit(100) no collectionGroup: evita baixar dados em excesso
 * - Listener único compartilhado via módulo singleton
 */
import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, query, orderBy, limit,
  addDoc, updateDoc, doc, serverTimestamp, setDoc,
  collectionGroup, where, getDocs, deleteDoc
} from 'firebase/firestore'
import {
  updatePassword, reauthenticateWithCredential, EmailAuthProvider,
} from 'firebase/auth'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, auth, storage } from '../firebase/config'

const EQUIPE_BASE = 'equipe'

export const sanitizeId = (name) => {
  if (!name) return 'unknown_' + Math.random().toString(36).substring(7)
  return name.replace(/\//g, '-').trim()
}

// ── Cache em memória (singleton) ───────────────────────────────────────────────
// Evita múltiplas instâncias do listener e refetch dos mesmos dados
let _cachedUsers = null
let _cacheTimestamp = 0
const CACHE_TTL_MS = 60_000 // 1 minuto de TTL para o cache

let _activeListener = null
let _listenerSubscribers = 0
let _subscriberCallbacks = []

function notifySubscribers(users) {
  _subscriberCallbacks.forEach(cb => cb(users))
}

function subscribeToMembers(callback) {
  _subscriberCallbacks.push(callback)
  _listenerSubscribers++

  // Reutiliza dados em cache se ainda válidos
  if (_cachedUsers && Date.now() - _cacheTimestamp < CACHE_TTL_MS) {
    callback(_cachedUsers)
  }

  // Cria listener apenas se ainda não existe
  if (!_activeListener) {
    // limit(100): evita baixar coleção inteira em academias grandes
    const q = query(
      collectionGroup(db, 'membros'),
      orderBy('createdAt', 'desc'),
      limit(100)
    )
    _activeListener = onSnapshot(q, snap => {
      const users = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      _cachedUsers = users
      _cacheTimestamp = Date.now()
      notifySubscribers(users)
    }, (err) => {
      console.error('Erro ao carregar membros da equipe:', err)
    })
  }

  // Retorna função de cleanup
  return () => {
    _subscriberCallbacks = _subscriberCallbacks.filter(cb => cb !== callback)
    _listenerSubscribers--

    // Remove listener quando não há mais componentes escutando
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
    const unsub = subscribeToMembers((newUsers) => {
      setUsers(newUsers)
      setLoading(false)
    })
    return unsub
  }, [])

  /** Gera PIN único de 6 dígitos */
  function generatePIN() {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  /** Atualiza campos do perfil */
  async function updateProfile(userId, data, role) {
    if (!role) {
      console.error('Role obrigatório para atualizar no novo estrutura')
      return
    }
    const docPath = `${EQUIPE_BASE}/${role}/membros/${userId}`
    await updateDoc(doc(db, docPath), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }

  /** Cria novo usuário no sistema (Firestore apenas — sem Auth) */
  async function createNewUser(userData) {
    const pin = generatePIN()
    const newUser = {
      ...userData,
      pin,
      status: 'Ativo',
      createdAt: serverTimestamp(),
      permissions: userData.permissions || {
        viewFinance: userData.role === 'gestor',
        manageFinance: false,
        manageUsers: false
      }
    }

    const nameId  = sanitizeId(userData.name)
    const role    = userData.role || 'aluno'
    const docPath = `${EQUIPE_BASE}/${role}/membros/${nameId}`

    await setDoc(doc(db, docPath), newUser)
    // Invalida cache para forçar refresh
    _cachedUsers = null
    return { id: nameId, pin }
  }

  /** Upload de avatar */
  async function uploadAvatar(userId, file, role) {
    if (!role) return
    const storageRef = ref(storage, `avatars/${userId}`)
    await uploadBytes(storageRef, file)
    const url = await getDownloadURL(storageRef)
    await updateProfile(userId, { avatarUrl: url }, role)
    return url
  }

  /** Upload de banner */
  async function uploadBanner(userId, file, role) {
    if (!role) return
    const storageRef = ref(storage, `banners/${userId}`)
    await uploadBytes(storageRef, file)
    const url = await getDownloadURL(storageRef)
    await updateProfile(userId, { bannerUrl: url }, role)
    return url
  }

  /** Altera senha via Firebase Auth */
  async function changePassword(currentPassword, newPassword) {
    const user = auth.currentUser
    if (!user) throw new Error('Usuário não autenticado')
    const credential = EmailAuthProvider.credential(user.email, currentPassword)
    await reauthenticateWithCredential(user, credential)
    await updatePassword(user, newPassword)
  }

  /** Remove membro */
  async function deleteUser(userId, role) {
    if (!role) return
    await deleteDoc(doc(db, `${EQUIPE_BASE}/${role}/membros/${userId}`))
    _cachedUsers = null
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
    deleteUser
  }
}

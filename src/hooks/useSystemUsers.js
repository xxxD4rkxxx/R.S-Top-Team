/**
 * Hook para gerenciar usuários do sistema (admin, gestor, professor, aluno)
 * Coleção: users
 * Campos: name, email, role, pin, status, permissions, createdAt
 */
import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, query, orderBy,
  addDoc, updateDoc, doc, serverTimestamp, getDoc, setDoc, where, getDocs, collectionGroup, deleteDoc
} from 'firebase/firestore'
import {
  updatePassword, reauthenticateWithCredential, EmailAuthProvider,
  createUserWithEmailAndPassword
} from 'firebase/auth'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { db, auth, storage } from '../firebase/config'

const COLLECTION = 'users' // Legacy
const EQUIPE_BASE = 'equipe'

export const sanitizeId = (name) => {
  if (!name) return 'unknown_' + Math.random().toString(36).substring(7)
  return name.replace(/\//g, '-').trim()
}

export function useSystemUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // We now use collectionGroup to get all members across roles
    const q = query(collectionGroup(db, 'membros'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, snap => {
      setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoading(false)
    }, (err) => {
      console.error('Error loading members:', err)
      setLoading(false)
    })
    return unsub
  }, [])

  /** Gera um PIN único de 6 dígitos */
  function generatePIN() {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }

  /** Atualiza campos do perfil */
  async function updateProfile(userId, data, role) {
    if (!role) {
      console.error('Role is required for updating in the new structure')
      return
    }
    const docPath = `${EQUIPE_BASE}/${role}/membros/${userId}`
    await updateDoc(doc(db, docPath), {
      ...data,
      updatedAt: serverTimestamp(),
    })
  }

  /** Adiciona novo usuário do sistema (Cria no Auth e no Firestore) */
  async function createNewUser(userData) {
    const pin = generatePIN()
    // Nota: Em um sistema real, você usaria Firebase Admin SDK em uma Cloud Function
    // para criar usuários sem deslogar o admin atual. 
    // Como estamos no frontend, simularemos a criação no Firestore.
    // O usuário precisará do Email e desse PIN para o primeiro login.
    
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

    const nameId = sanitizeId(userData.name)
    const role = userData.role || 'aluno'
    const docPath = `${EQUIPE_BASE}/${role}/membros/${nameId}`
    
    await setDoc(doc(db, docPath), newUser)
    return { id: nameId, pin }
  }



  /** Upload de Avatar */
  async function uploadAvatar(userId, file, role) {
    if (!role) return
    const storageRef = ref(storage, `avatars/${userId}`)
    await uploadBytes(storageRef, file)
    const url = await getDownloadURL(storageRef)
    await updateProfile(userId, { avatarUrl: url }, role)
    return url
  }

  /** Upload de Banner */
  async function uploadBanner(userId, file, role) {
    if (!role) return
    const storageRef = ref(storage, `banners/${userId}`)
    await uploadBytes(storageRef, file)
    const url = await getDownloadURL(storageRef)
    await updateProfile(userId, { bannerUrl: url }, role)
    return url
  }

  /** Altera senha (Auth) */
  async function changePassword(currentPassword, newPassword) {
    const user = auth.currentUser
    if (!user) throw new Error('Usuário não autenticado')
    
    const credential = EmailAuthProvider.credential(user.email, currentPassword)
    await reauthenticateWithCredential(user, credential)
    await updatePassword(user, newPassword)
  }

  /** Remove usuário */
  async function deleteUser(userId, role) {
    if (!role) return
    await deleteDoc(doc(db, `${EQUIPE_BASE}/${role}/membros/${userId}`))
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

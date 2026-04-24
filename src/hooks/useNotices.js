import { useState, useEffect } from 'react'
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  increment,
  collectionGroup
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { COLLECTIONS, SUB_COLLECTIONS } from '../firebase/collections'
import { sanitizeHTML } from '../utils/security'

/**
 * Hook para gerenciar os Avisos e Eventos (coleção "notices")
 */
export function useNotices(userId = null) {
  const [notices, setNotices] = useState([])
  const [userViews, setUserViews] = useState(new Set())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Escuta em tempo real os avisos, ordenando pelos mais recentes
    const q = query(
      collection(db, COLLECTIONS.EVENTOS)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(docSnap => {
        const d = docSnap.data()
        return {
          id: docSnap.id,
          ...d,
          // Parsing seguro de datas do Firestore para Objetos JS Date
          createdAt: d.createdAt?.toDate ? d.createdAt.toDate() : new Date(),
          updatedAt: d.updatedAt?.toDate ? d.updatedAt.toDate() : null,
        }
      })

      // Ordenação no cliente para evitar erros de índice ausente ou campos nulos
      data.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))

      setNotices(data)
      setLoading(false)
    }, (error) => {
      console.error('Erro ao buscar avisos:', error)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // Escuta as visualizações do usuário logado para o "ponto azul"
  useEffect(() => {
    if (!userId) {
      setUserViews(new Set())
      return
    }

    const q = query(
      collectionGroup(db, SUB_COLLECTIONS.VISUALIZACOES),
      where('userId', '==', userId)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ids = new Set(snapshot.docs.map(d => d.data().noticeId))
      setUserViews(ids)
    })

    return () => unsubscribe()
  }, [userId])

  // ── Adicionar ──────────────────────────────────────────────────
  async function addNotice(noticeData) {
    const payload = {
      ...noticeData,
      description: sanitizeHTML(noticeData.description), // 🛡️ Proteção XSS
      views: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    const docRef = await addDoc(collection(db, COLLECTIONS.EVENTOS), payload)
    return docRef.id
  }

  // ── Atualizar ──────────────────────────────────────────────────
  async function updateNotice(id, updates) {
    const docRef = doc(db, COLLECTIONS.EVENTOS, id)
    
    const cleanUpdates = { ...updates }
    if (cleanUpdates.description) {
      cleanUpdates.description = sanitizeHTML(cleanUpdates.description) // 🛡️ Proteção XSS
    }

    await updateDoc(docRef, {
      ...cleanUpdates,
      updatedAt: serverTimestamp(),
    })
  }

  // ── Deletar ────────────────────────────────────────────────────
  async function deleteNotice(id) {
    const docRef = doc(db, COLLECTIONS.EVENTOS, id)
    await deleteDoc(docRef)
  }

  // ── Incrementar Visualização (Única por usuário) ─────────────
  async function markAsViewed(noticeId, userId) {
    if (!noticeId || !userId) return

    const viewRef = doc(db, COLLECTIONS.EVENTOS, noticeId, SUB_COLLECTIONS.VISUALIZACOES, userId)
    const viewSnap = await getDoc(viewRef)

    // Só incrementa se o usuário ainda não viu este aviso
    if (!viewSnap.exists()) {
      await setDoc(viewRef, {
        noticeId,
        userId,
        viewedAt: serverTimestamp()
      })

      const noticeRef = doc(db, COLLECTIONS.EVENTOS, noticeId)
      await updateDoc(noticeRef, {
        views: increment(1)
      })
    }
  }

  // ── Buscar Histórico de Visualizações do Usuário ─────────────
  async function getUserViews(userId) {
    if (!userId) return []
    // Como queremos algo simples, podemos opcionalmente retornar um set de IDs
    // Mas para o "ponto azul" (não lido), talvez seja melhor fazer essa lógica no componente
    // buscando a coleção de views do usuário.
  }

  return {
    notices,
    loading,
    addNotice,
    updateNotice,
    deleteNotice,
    markAsViewed,
    userViews
  }
}

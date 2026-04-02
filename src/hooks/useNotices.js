import { useState, useEffect } from 'react'
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  increment
} from 'firebase/firestore'
import { db } from '../firebase/config'

/**
 * Hook para gerenciar os Avisos e Eventos (coleção "notices")
 */
export function useNotices() {
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Escuta em tempo real os avisos, ordenando pelos mais recentes
    const q = query(
      collection(db, 'notices'),
      orderBy('createdAt', 'desc')
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
      setNotices(data)
      setLoading(false)
    }, (error) => {
      console.error('Erro ao buscar avisos:', error)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [])

  // ── Adicionar ──────────────────────────────────────────────────
  async function addNotice(noticeData) {
    const payload = {
      ...noticeData,
      views: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    const docRef = await addDoc(collection(db, 'notices'), payload)
    return docRef.id
  }

  // ── Atualizar ──────────────────────────────────────────────────
  async function updateNotice(id, updates) {
    const docRef = doc(db, 'notices', id)
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    })
  }

  // ── Deletar ────────────────────────────────────────────────────
  async function deleteNotice(id) {
    const docRef = doc(db, 'notices', id)
    await deleteDoc(docRef)
  }

  // ── Incrementar Visualização (Opcional - só para estatística) ──
  async function incrementViews(id) {
    const docRef = doc(db, 'notices', id)
    await updateDoc(docRef, {
      views: increment(1)
    })
  }

  return {
    notices,
    loading,
    addNotice,
    updateNotice,
    deleteNotice,
    incrementViews
  }
}

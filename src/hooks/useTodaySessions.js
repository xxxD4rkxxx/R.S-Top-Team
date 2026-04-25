import { useState, useEffect } from 'react'
import { db } from '../firebase/config'
import {
  collection, query, where, onSnapshot
} from 'firebase/firestore'
import { COLLECTIONS } from '../firebase/collections'

/**
 * Escuta em tempo real (onSnapshot) as sessões de HOJE.
 * OTIMIZADO: Não busca subcoleções automaticamente para evitar o erro de Assertion Failed
 * e melhorar a performance do Dashboard.
 */
let sessionsCache = []

export function useTodaySessions(instructorId = null) {
  const [sessions, setSessions] = useState(sessionsCache)
  const [loading, setLoading]   = useState(sessionsCache.length === 0)

  useEffect(() => {
    const todayStr = new Date().toLocaleDateString('en-CA')
    const sessRef = collection(db, COLLECTIONS.CHAMADAS)
    
    let q = query(sessRef, where('date', '==', todayStr))
    if (instructorId) {
      q = query(sessRef, where('date', '==', todayStr), where('instructorId', '==', instructorId))
    }

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(docSnap => {
        const d = docSnap.data()
        return {
          id: docSnap.id,
          classTitle: d.classTitle || d.title || 'Aula',
          modality: d.modality || '',
          time: d.time || '',
          date: d.date || todayStr,
          presentes: d.presencasCount || 0,
          ausentes: d.faltasCount || 0,
          total: d.totalCount || 0,
          finalizada: d.finalizada || false,
          // Não buscamos 'attendances' aqui para performance. 
          // O drawer de detalhes deve buscar se necessário.
        }
      })

      // Ordena pelo horário
      data.sort((a, b) => a.time.localeCompare(b.time))
      
      sessionsCache = data
      setSessions(data)
      setLoading(false)
    }, (err) => {
      console.error('useTodaySessions error:', err)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [instructorId])

  return { sessions, loading }
}

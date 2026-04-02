import { useState, useEffect } from 'react'
import { db } from '../firebase/config'
import {
  collection, query, where, onSnapshot, getDocs
} from 'firebase/firestore'

/**
 * Escuta em tempo real (onSnapshot) as sessões de HOJE na coleção `sessions`.
 * Para cada sessão, busca os totais de presença da sub-coleção `attendances`.
 *
 * Retorna:
 *  sessions: [{ id, classTitle, modality, time, date, presentes, ausentes, total, attendances[] }]
 *  loading: boolean
 */
export function useTodaySessions() {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    // today in YYYY-MM-DD (local)
    const todayStr = new Date().toLocaleDateString('en-CA')

    const sessRef = collection(db, 'sessions')
    const q = query(sessRef, where('date', '==', todayStr))

    // onSnapshot → atualiza em tempo real
    const unsubscribe = onSnapshot(q, async (snap) => {
      try {
        // Para cada sessão, busca as presenças (getDocs, não precisa de listener em sub-col)
        const enriched = await Promise.all(
          snap.docs.map(async (docSnap) => {
            const data = docSnap.data()

            const attSnap = await getDocs(
              collection(db, 'sessions', docSnap.id, 'attendances')
            )

            let presentes = 0
            let ausentes  = 0
            const attendances = []

            attSnap.forEach(a => {
              const ad = a.data()
              attendances.push({ id: a.id, ...ad })
              if (ad.status === 'present')       presentes++
              else if (ad.status === 'absent')   ausentes++
            })

            return {
              id:         docSnap.id,
              classTitle: data.classTitle || data.title || 'Aula',
              modality:   data.modality   || '',
              time:       data.time       || '',
              date:       data.date       || todayStr,
              presentes,
              ausentes,
              total:      attSnap.size,
              attendances,
            }
          })
        )

        // Ordena pelo horário (campo time: "08:00", "14:00" …)
        enriched.sort((a, b) => a.time.localeCompare(b.time))
        setSessions(enriched)
      } catch (err) {
        console.error('useTodaySessions error:', err)
      } finally {
        setLoading(false)
      }
    }, (err) => {
      console.error('useTodaySessions onSnapshot error:', err)
      setLoading(false)
    })

    return () => unsubscribe()
  }, []) // run once; todayStr only changes at midnight

  return { sessions, loading }
}

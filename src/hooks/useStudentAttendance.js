import { useState, useEffect, useMemo } from 'react'
import { collectionGroup, query, where, getDocs, orderBy, limit } from 'firebase/firestore'
import { db } from '../firebase/config'
import { SUB_COLLECTIONS } from '../firebase/collections'

/**
 * Hook de Inteligência de Atividade do Aluno
 * Calcula métricas de frequência, sequências (streaks) e histórico detalhado.
 */
export function useStudentAttendance(studentId) {
  const [attendances, setAttendances] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!studentId) return

    async function fetchAttendance() {
      setLoading(true)
      try {
        const q = query(
          collectionGroup(db, SUB_COLLECTIONS.PRESENCAS),
          where('studentId', '==', studentId),
          orderBy('date', 'desc'),
          limit(100)
        )
        const snap = await getDocs(q)
        const docs = snap.docs.map(d => {
          const data = d.data()
          
          // Normalização da data: Suporta Firestore Timestamp ou String ISO
          let parsedDate
          if (data.date && typeof data.date.toDate === 'function') {
            parsedDate = data.date.toDate()
          } else if (typeof data.date === 'string') {
            parsedDate = new Date(data.date + 'T12:00:00')
          } else {
            parsedDate = new Date()
          }

          return {
            id: d.id,
            ...data,
            parsedDate
          }
        })
        setAttendances(docs)
      } catch (err) {
        console.error('Erro ao buscar presenças do aluno:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchAttendance()
  }, [studentId])

  const stats = useMemo(() => {
    if (loading || attendances.length === 0) {
      return {
        total: 0,
        monthly: 0,
        weekly: 0,
        streak: 0,
        recent: []
      }
    }

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    
    // Início da semana: Segunda-feira (Padrão Brasil)
    const weekStart = new Date(now)
    const day = weekStart.getDay()
    const diffToMonday = (day + 6) % 7
    weekStart.setDate(now.getDate() - diffToMonday)
    weekStart.setHours(0, 0, 0, 0)

    let monthly = 0
    let weekly = 0
    let total = 0

    const presentDocs = attendances.filter(a => a.status === 'present')
    total = presentDocs.length

    presentDocs.forEach(a => {
      if (a.parsedDate >= monthStart) monthly++
      if (a.parsedDate >= weekStart) weekly++
    })

    // Cálculo da Sequência (Streak)
    const uniqueDates = [...new Set(presentDocs.map(a => a.parsedDate.toDateString()))]
      .sort((a, b) => new Date(b) - new Date(a))
    
    let streak = 0
    if (uniqueDates.length > 0) {
      streak = 1
      for (let i = 0; i < uniqueDates.length - 1; i++) {
        const d1 = new Date(uniqueDates[i])
        const d2 = new Date(uniqueDates[i+1])
        const diffDays = (d1 - d2) / (1000 * 60 * 60 * 24)
        
        if (diffDays <= 4) { 
          streak++
        } else {
          break
        }
      }
    }

    return {
      total,
      monthly,
      weekly,
      streak,
      recent: presentDocs.slice(0, 10)
    }
  }, [attendances, loading])

  return { ...stats, loading }
}

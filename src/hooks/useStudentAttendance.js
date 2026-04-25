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
        const docs = snap.docs.map(d => ({
          id: d.id,
          ...d.data(),
          // Se date for string (YYYY-MM-DD), converter para objeto Date se necessário para cálculos
          parsedDate: new Date(d.data().date + 'T12:00:00') 
        }))
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
    const weekStart = new Date(now)
    weekStart.setDate(now.getDate() - now.getDay()) // Início da semana (Domingo)

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
    // Ordenar por data decrescente (já está pelo query, mas garantimos)
    let streak = 0
    let lastDate = null
    
    // Simplificado score de treino consecutivo (mesma semana ou dias próximos)
    // Para artes marciais, streak geralmente é medido por frequência rítmica
    // Vamos considerar streak como treinos em dias diferentes sem hiatos > 4 dias
    const uniqueDates = [...new Set(presentDocs.map(a => a.date))].sort().reverse()
    
    if (uniqueDates.length > 0) {
      streak = 1
      for (let i = 0; i < uniqueDates.length - 1; i++) {
        const d1 = new Date(uniqueDates[i] + 'T12:00:00')
        const d2 = new Date(uniqueDates[i+1] + 'T12:00:00')
        const diffDays = (d1 - d2) / (1000 * 60 * 60 * 24)
        
        if (diffDays <= 4) { // Se treinou no máximo 4 dias depois do último
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
      recent: attendances.slice(0, 10)
    }
  }, [attendances, loading])

  return { ...stats, loading }
}

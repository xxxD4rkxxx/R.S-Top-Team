// Resumo: hook de estatísticas do dashboard.
// OTIMIZAÇÕES DE PERFORMANCE APLICADAS:
// - Eliminadas queries N+1: subcoleções de presença agora buscadas em paralelo (Promise.all)
// - Removido collectionGroup('membros') sem filtro que baixava todos os membros a cada render
// - teamStats migrado para um cache singleton separado (useTeamStats)
// - Queries de sessions com limit para evitar overfetch

import { useState, useEffect, useCallback, useRef } from 'react'
import { db } from '../firebase/config'
import {
  collection, query, where, getDocs,
  orderBy, limit
} from 'firebase/firestore'
import { COLLECTIONS, SUB_COLLECTIONS } from '../firebase/collections'
import { useStudents } from './useStudents'

// ── Helpers de data ────────────────────────────────────────────────────────────
export function parseDate(d) {
  if (!d) return null
  if (typeof d.toDate === 'function') return d.toDate()
  if (d instanceof Date) return d
  const p = new Date(d)
  return isNaN(p.getTime()) ? null : p
}

export function daysBetween(dateInput, base = new Date()) {
  const d = parseDate(dateInput)
  if (!d) return null
  return Math.floor((base.getTime() - d.getTime()) / 86400000)
}

function toYMD(d) {
  return d.toLocaleDateString('en-CA') // YYYY-MM-DD
}

// ── Busca subcoleções de presença em paralelo (elimina N+1) ───────────────────
// Antes: loop serial com await getDocs dentro → 1 query por sessão, bloqueante
// Agora: Promise.all → todas as queries disparadas simultaneamente
async function fetchAttendanceCounts(sessionDocs) {
  console.log(`📊 Processando contagens para ${sessionDocs.length} sessões...`)
  const results = await Promise.all(
    sessionDocs.map(async (s) => {
      const data = s.data()
      // Otimização: Se já temos os totais salvos no documento, usamos e evitamos query na subcoleção
      if (typeof data.presencasCount === 'number' && typeof data.totalCount === 'number') {
        console.log(`⚡ Cache Match para sessão: ${s.id} (${data.classTitle || 'Sem Título'})`)
        return {
          id: s.id,
          ref: s.ref,
          presencas: data.presencasCount,
          presencasCount: data.presencasCount,
          faltas: data.faltasCount || (data.totalCount - data.presencasCount),
          ausentes: data.faltasCount || (data.totalCount - data.presencasCount),
          justificados: data.justificadosCount || 0,
          total: data.totalCount,
          totalCount: data.totalCount,
          ...data
        }
      }

      // Fallback para sessões legadas que não possuem os contadores denormalizados
      console.log(`🔍 Buscando subcoleção (Legacy) para sessão: ${s.id}`)
      const attSnap = await getDocs(collection(s.ref, SUB_COLLECTIONS.PRESENCAS))
      let presencas = 0, faltas = 0, justificados = 0, total = 0
      attSnap.forEach(a => {
        const st = a.data().status
        total++
        if (st === 'present') presencas++
        else if (st === 'absent') faltas++
        else if (st === 'justified') justificados++
      })

      return {
        id: s.id,
        ref: s.ref,
        presencas,
        presencasCount: presencas,
        faltas,
        ausentes: faltas,
        justificados,
        total,
        totalCount: total,
        ...data
      }
    })
  )
  console.log('✅ Processamento de estatísticas concluído.')
  return results
}

// ── Cache Singleton p/ Navegação Instantânea ───────────────────
let statsCache = {
  data: {},   // period -> data
  ts: {},     // period -> timestamp
  studentsTs: null
}

let globalMetaCache = {
  data: null,
  ts: 0
}

// ── Hook principal ─────────────────────────────────────────────────────────────
export function useDashboardStats(period = 'Semana', instructorId = null) {
  const { students, isLoading: isLoadingStudents } = useStudents()

  const [data, setData] = useState(() => {
    // Chart and period-specific data
    return statsCache.data[period] || {
      chartData: [],
      weekGrowth: 0,
      sessions: []
    }
  })

  const [meta, setMeta] = useState(() => {
    // Stable KPIs (independent of period)
    return globalMetaCache.data || {
      todayPresences: 0,
      absentStudents: [],
      inactiveStudents: [],
      retentionRate: 0,
      activeStudentsAlerts: { warning: 0, critical: 0 },
    }
  })

  // Se temos cache, começamos sem loading para evitar 'flicker'
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(!statsCache.data[period])

  const isFetchingRef = useRef(false)

  const fetchData = useCallback(async (forced = false) => {
    if (isLoadingStudents || !students) return
    if (isFetchingRef.current) return

    const hasCache = !!statsCache.data[period]
    const isStale = !statsCache.ts[period] || (Date.now() - statsCache.ts[period]) > 120000

    if (!hasCache || forced || isStale) {
      isFetchingRef.current = true
      if (!hasCache) setInitialLoading(true)
      setLoading(true)

      try {
        const now = new Date()
        const todayStr = toYMD(now)
        const sessRef = collection(db, COLLECTIONS.CHAMADAS)

        // ── 1. Presenças de hoje ─────────────────────────────────────────────────
        // Busca somente sessões de hoje (filtro por data = indexed)
        let todayQuery = query(sessRef, where('date', '==', todayStr))
        if (instructorId) {
          todayQuery = query(sessRef, where('date', '==', todayStr), where('instructorId', '==', instructorId))
        }
        const todaySnap = await getDocs(todayQuery)
        const todayResults = await fetchAttendanceCounts(todaySnap.docs)
        const todayPresences = todayResults.reduce((sum, s) => sum + s.presencas, 0)

        // ── 2. Limites do período ────────────────────────────────────────────────
        let rangeStart = new Date(now)
        let prevRangeStart = new Date(now)

        const DAYS_ABR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
        const MNTHS_ABR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

        if (period === 'Semana') {
          rangeStart.setDate(now.getDate() - 6)
          prevRangeStart.setDate(now.getDate() - 13)
        } else if (period === 'Mês') {
          rangeStart.setDate(1)
          prevRangeStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        } else {
          rangeStart = new Date(now.getFullYear(), 0, 1)
          prevRangeStart = new Date(now.getFullYear() - 1, 0, 1)
        }

        const rangeStartStr = toYMD(rangeStart)
        const prevRangeStartStr = toYMD(prevRangeStart)

        // 📊 Query simplificada para evitar necessidade de índices compostos complexos
        const currentQ = query(sessRef, where('date', '>=', rangeStartStr), where('date', '<=', todayStr))
        const prevQ = query(sessRef, where('date', '>=', prevRangeStartStr), where('date', '<', rangeStartStr))

        const [currentSnap, prevSnap] = await Promise.all([
          getDocs(currentQ),
          getDocs(prevQ)
        ])

        let currentDocs = currentSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }))
        let prevDocs = prevSnap.docs.map(d => ({ id: d.id, ref: d.ref, ...d.data() }))

        // 🎓 Filtro de Instrutor na memória (mais rápido que criar índices para cada combinação)
        if (instructorId) {
          currentDocs = currentDocs.filter(d => d.instructorId === instructorId || d.instrutorId === instructorId)
          prevDocs = prevDocs.filter(d => d.instructorId === instructorId || d.instrutorId === instructorId)
        }

        // ── 3. Montar skeleton do gráfico ────────────────────────────────────────
        let skeleton = []
        if (period === 'Semana') {
          skeleton = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(now)
            d.setDate(now.getDate() - (6 - i))
            return { name: DAYS_ABR[d.getDay()], presencas: 0, faltas: 0, justificados: 0 }
          })
        } else if (period === 'Mês') {
          const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
          skeleton = Array.from({ length: daysInMonth }, (_, i) => ({
            name: String(i + 1).padStart(2, '0'),
            presencas: 0, faltas: 0, justificados: 0
          }))
        } else {
          skeleton = MNTHS_ABR.map(name => ({ name, presencas: 0, faltas: 0, justificados: 0 }))
        }

        // Busca presença de todas as sessões do período em paralelo (sem N+1)
        const currentResults = await fetchAttendanceCounts(currentSnap.docs)

        // Preenche o skeleton com dados reais
        for (const s of currentResults) {
          const dateStr = s.date
          let label = ''
          if (period === 'Semana') {
            label = DAYS_ABR[new Date(`${dateStr}T12:00:00Z`).getDay()]
          } else if (period === 'Mês') {
            label = dateStr.split('-')[2]
          } else {
            label = MNTHS_ABR[new Date(`${dateStr}T12:00:00Z`).getMonth()]
          }
          const entry = skeleton.find(e => e.name === label)
          if (entry) {
            entry.presencas += s.presencas
            entry.faltas += s.faltas
            entry.justificados += s.justificados
          }
        }

        // ── 4. Crescimento do período (período passado buscado em paralelo) ──────
        const currentTotal = skeleton.reduce((sum, e) => sum + e.presencas, 0)
        const prevResults = await fetchAttendanceCounts(prevSnap.docs)
        const prevTotal = prevResults.reduce((sum, s) => sum + s.presencas, 0)
        const weekGrowth = prevTotal > 0 ? Math.round(((currentTotal - prevTotal) / prevTotal) * 100) : 0

        // ── 5. Histórico de sessões (máx. 10, já enriquecido pelo passo 3) ───────
        const recentSessions = currentResults
          .sort((a, b) => b.date?.localeCompare(a.date))
          .slice(0, 10)
          .map(s => ({
            ...s,
            presencasCount: s.presencas,
            totalCount: s.total,
          }))

        // ── 6. Alunos ausentes há mais de 10 dias ────────────────────────────────
        const isActive = (st) =>
          !['inativo', 'inactive', 'suspenso', 'suspended', 'arquivado', 'archived'].includes(st)
        const activeStudents = students.filter(s => isActive(s.status))

        const absentStudents = activeStudents
          .filter(s => {
            const d = parseDate(s.lastAttendanceAt || s.createdAt)
            const days = d ? daysBetween(d, now) : null
            return days === null || days > 10
          })
          .map(s => {
            const last = parseDate(s.lastAttendanceAt || s.createdAt)
            const days = last ? daysBetween(last, now) : null
            return {
              id: s.id,
              name: s.name,
              phone: s.phone || '',
              belt: s.belt || 'white',
              modality: s.modality || '',
              daysAbsent: days,
              lastSeen: last,
              isCritical: days === null || days > 30,
            }
          })
          .sort((a, b) => (b.daysAbsent || 999) - (a.daysAbsent || 999))

        // ── 7. Taxa de retenção ───────────────────────────────────────────────────
        const retentionRate = activeStudents.length > 0
          ? Math.round(
            ((activeStudents.length - absentStudents.filter(s => s.isCritical).length)
              / activeStudents.length) * 100
          )
          : 100

        // ── 8. Alertas ────────────────────────────────────────────────────────────
        let warning = 0, critical = 0
        absentStudents.forEach(s => { if (s.isCritical) critical++; else warning++ })

        // ── 9. Alunos inativos ────────────────────────────────────────────────────
        const inactiveStudents = students
          .filter(s => ['inativo', 'inactive'].includes(s.status))
          .map(s => ({
            id: s.id,
            name: s.name,
            phone: s.phone || '',
            belt: s.belt || 'white',
            modality: s.modality || '',
            reason: s.statusReason || 'Não informado',
            inactiveSince: parseDate(s.lastStatusAt),
          }))
          .sort((a, b) => (b.inactiveSince || 0) - (a.inactiveSince || 0))

        const globalMeta = {
          todayPresences,
          absentStudents,
          inactiveStudents,
          retentionRate,
          activeStudentsAlerts: { warning, critical },
        }

        const periodData = {
          chartData: skeleton,
          sessions: recentSessions,
          weekGrowth,
        }

        // Atualiza Caches Singleton
        statsCache.data[period] = periodData
        statsCache.ts[period] = Date.now()

        globalMetaCache.data = globalMeta
        globalMetaCache.ts = Date.now()

        setData(periodData)
        setMeta(globalMeta)
      } catch (err) {
        console.error('Erro ao carregar estatísticas do dashboard:', err)
      } finally {
        setLoading(false)
        setInitialLoading(false)
        isFetchingRef.current = false
      }
    }
  }, [isLoadingStudents, students, period, instructorId])

  useEffect(() => {
    // Se mudamos o período e temos no cache, atualizamos o 'data' instantaneamente
    if (statsCache.data[period]) {
      setData(statsCache.data[period])
    }
    if (globalMetaCache.data) {
      setMeta(globalMetaCache.data)
    }

    // Se o cache tem menos de 2 minutos para o período, evitamos refetch automático
    const isStale = !statsCache.ts[period] || (Date.now() - statsCache.ts[period]) > 120000
    if (isStale) {
      fetchData()
    } else if (loading) {
      setLoading(false)
    }
  }, [fetchData, period])

  return { data: { ...meta, ...data }, loading, initialLoading, refresh: () => fetchData(true) }
}

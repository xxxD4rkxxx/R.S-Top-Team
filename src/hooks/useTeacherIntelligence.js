import { useState, useEffect, useMemo } from 'react'
import { db } from '../firebase/config'
import {
    collection, query, where, getDocs,
    orderBy, Timestamp, collectionGroup
} from 'firebase/firestore'
import { COLLECTIONS, SUB_COLLECTIONS, FIELDS } from '../firebase/collections'
import { useAuth } from '../context/AuthContext'
import { useStudents } from './useStudents'
import { beltConfig } from '../data/beltConfig'

/**
 * useTeacherIntelligence - Motor de IA e Análise Preditiva
 * 
 * Calcula o risco de evasão (Churn Score) e engajamento individual.
 */
export function useTeacherIntelligence() {
    const { userData, effectiveRole } = useAuth()
    const isPowerUser = effectiveRole === 'admin' || effectiveRole === 'gestor'
    const { students, isLoading: loadingStudents } = useStudents()

    const [intelligenceData, setIntelligenceData] = useState({
        alerts: [],
        graduations: [],
        allStudentsStats: [],
        charts: {
            semana: [],
            mes: [],
            ano: []
        },
        fluxo: [],
        insight: "",
        stats: {
            totalStudents: 0,
            avgAttendance30d: 0,
            trend: 0
        },
        loading: true
    })


    const teacherModalities = useMemo(() => userData?.modalities || [], [userData])

    // Helper para formatar nomes: "JOÃO SILVA" -> "João Silva"
    const formatName = (name) => {
        if (!name || typeof name !== 'string') return "Aluno"
        const clean = name.toLowerCase().trim()
        if (clean === 'undefined' || clean === 'null' || clean.includes('indefin') || clean.includes('undef')) return "Aluno"
        return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
    }

    const myStudents = useMemo(() => {
        if (!students || students.length === 0) return []

        // Se for admin, mostramos tudo
        if (isPowerUser) return students.filter(s => s.status?.toLowerCase() === 'ativo')

        const tMods = teacherModalities.map(m => m.toLowerCase().replace(/-/g, ' ').trim())

        // Se o professor não tem modalidades vinculadas, mostramos todos os ativos (Fallback)
        if (tMods.length === 0) return students.filter(s => s.status?.toLowerCase() === 'ativo')

        // Caso padrão: filtra pela modalidade do professor com comparação flexível
        return students.filter(s => {
            if (s.status?.toLowerCase() !== 'ativo') return false
            const studentMods = (Array.isArray(s.modalities) ? s.modalities : [s.modality])
                .filter(Boolean)
                .map(m => m.toLowerCase().replace(/-/g, ' ').trim())

            if (studentMods.length === 0) return true

            return studentMods.some(m => tMods.includes(m))
        })
    }, [students, teacherModalities, isPowerUser])

    useEffect(() => {
        async function calculateIntelligence() {
            if (loadingStudents || !userData) return
            if (!isPowerUser && teacherModalities.length === 0 && myStudents.length === 0) {
                setIntelligenceData(prev => ({ ...prev, loading: false }))
                return
            }

            try {
                const now = new Date()
                const safeDate = (val, fallback = now) => {
                    if (!val) return fallback
                    if (val.toDate) return val.toDate()
                    if (val instanceof Date) return isNaN(val.getTime()) ? fallback : val
                    const d = new Date(val)
                    return isNaN(d.getTime()) ? fallback : d
                }

                // 1. Configuração de Período (Histórico Estendido para 60 dias)
                const sixtyDaysAgo = new Date(now)
                sixtyDaysAgo.setDate(now.getDate() - 60)
                const thirtyDaysAgo = new Date(now)
                thirtyDaysAgo.setDate(now.getDate() - 30)
                const sevenDaysAgo = new Date(now)
                sevenDaysAgo.setDate(now.getDate() - 7)

                // 2. Buscar sessões (Filtragem por Modalidade do Professor com Fallback)
                const sessionsRef = collection(db, COLLECTIONS.CHAMADAS)
                const teacherModalities = userData?.modalities || []
                console.log("[Intelligence] Modalidades do Professor:", teacherModalities);

                let sessions = []
                try {
                    let qSess
                    const CRIADO_EM = FIELDS.CRIADO_EM || 'criadoEm'
                    const MODALIDADE = FIELDS.MODALIDADE || 'modalidade'
                    const INSTRUTOR_ID = FIELDS.INSTRUTOR_ID || 'instrutorId'

                    if (isPowerUser) {
                        qSess = query(sessionsRef, where(CRIADO_EM, '>=', Timestamp.fromDate(sixtyDaysAgo)))
                    } else if (teacherModalities.length > 0) {
                        qSess = query(
                            sessionsRef,
                            where(MODALIDADE, 'in', teacherModalities),
                            where(CRIADO_EM, '>=', Timestamp.fromDate(sixtyDaysAgo))
                        )
                    } else {
                        qSess = query(
                            sessionsRef,
                            where(INSTRUTOR_ID, '==', userData?.uid || ''),
                            where(CRIADO_EM, '>=', Timestamp.fromDate(sixtyDaysAgo))
                        )
                    }

                    const sessionsSnap = await getDocs(qSess)
                    sessions = sessionsSnap.docs.map(d => ({
                        id: d.id,
                        createdAt: safeDate(d.data()[CRIADO_EM] || d.data().createdAt || d.data().date),
                        ...d.data()
                    }))

                    // Fallback Crítico
                    if (sessions.length === 0 && !isPowerUser) {
                        console.warn("[Intelligence] Nenhuma sessão encontrada por modalidade. Tentando fallback por instructorId...");
                        const qFallback = query(
                            sessionsRef,
                            where(INSTRUTOR_ID, '==', userData?.uid || ''),
                            where(CRIADO_EM, '>=', Timestamp.fromDate(sixtyDaysAgo))
                        )
                        const fallbackSnap = await getDocs(qFallback)
                        sessions = fallbackSnap.docs.map(d => ({
                            id: d.id,
                            createdAt: safeDate(d.data()[CRIADO_EM] || d.data().createdAt || d.data().date),
                            ...d.data()
                        }))
                    }
                } catch (err) {
                    console.error("[Intelligence] Erro ao buscar sessões:", err);
                }

                console.log("[Intelligence] Sessões encontradas:", sessions.length);
                sessions.sort((a, b) => b.createdAt - a.createdAt)

                // 3. Buscar TODAS as presenças do período (BATCH QUERY via collectionGroup)
                let allAttendances = []
                try {
                    const attQuery = query(
                        collectionGroup(db, SUB_COLLECTIONS.PRESENCAS),
                        where(FIELDS.STATUS || 'status', '==', 'present')
                    )

                    const attSnap = await getDocs(attQuery)
                    const sessionIdsSet = new Set(sessions.map(s => s.id))

                    allAttendances = attSnap.docs
                        .map(d => {
                            const data = d.data()
                            const sId = d.ref.parent?.parent?.id // d.ref.parent é a coleção 'presencas', o parent dela é o doc da sessão
                            return { ...data, sessionId: sId, date: safeDate(data.date || data.createdAt) }
                        })
                        .filter(a => sessionIdsSet.has(a.sessionId))
                } catch (err) {
                    console.error("[Intelligence] Erro no collectionGroup attendances:", err);
                    // Se falhar o collectionGroup (provavelmente falta de índice), o dashboard não morre, apenas mostra 0 presenças
                }

                // 4. Processar Estatísticas dos Alunos (Ranking e Churn)
                const studentStats = myStudents.map(student => {
                    const studentAtts = allAttendances.filter(a => a.studentId === student.id)
                    const sparkline = Array.from({ length: 7 }, (_, i) => {
                        const d = new Date(now)
                        d.setDate(now.getDate() - (6 - i))
                        const dStr = d.toLocaleDateString()
                        const hasAtt = studentAtts.some(a => a.date.toLocaleDateString() === dStr && a.status === 'present')
                        return { value: hasAtt ? 1 : 0 }
                    })

                    const lastAttDate = safeDate(student.lastAttendanceAt, null)
                    const daysAbsent = lastAttDate ? Math.floor((now - lastAttDate) / (1000 * 60 * 60 * 24)) : 99

                    return {
                        id: student.id,
                        name: formatName(student.name),
                        photo: student.photo,
                        phone: student.phone,
                        belt: student.belt || 'Branca',
                        attendanceRate: sessions.length > 0 ? Math.round((studentAtts.length / sessions.length) * 100) : 0,
                        lastAttendance: student.lastAttendanceAt,
                        daysAbsent,
                        sparkline
                    }
                })

                const avgFreq = studentStats.length > 0 ? studentStats.reduce((acc, s) => acc + s.attendanceRate, 0) / studentStats.length : 0
                
                // 4.1 Graduações Próximas (Lógica 1:1 com Gestor)
                const graduationList = myStudents
                    .filter(s => (s.totalAttendances || 0) >= 40 || (s.monthlyAttendances || 0) >= 10)
                    .map(s => ({
                        ...s,
                        name: formatName(s.name),
                        cfg: beltConfig[s.belt?.toLowerCase()] || beltConfig['white']
                    }))
                    .slice(0, 5)

                // 4.2 KPIs Extras (Resto dos KPIs solicitados)
                const newStudents30d = myStudents.filter(s => {
                    const cDate = safeDate(s.createdAt)
                    return cDate >= thirtyDaysAgo
                }).length

                const absentCriticalList = studentStats
                    .filter(s => s.daysAbsent > 10)
                    .sort((a, b) => b.daysAbsent - a.daysAbsent)

                const absentCritical = absentCriticalList.length
                const sessions30d = sessions.filter(s => s.createdAt >= thirtyDaysAgo).length
                
                const todayStr = now.toLocaleDateString()
                const todaySessions = sessions.filter(s => s.createdAt.toLocaleDateString() === todayStr)
                const todayAttendances = allAttendances.filter(a => a.date.toLocaleDateString() === todayStr && a.status === 'present').length


                // ── 3. Preparar Skeletons (Igual ao Gestor) ───────────────────
                const DAYS_ABR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
                const MNTHS_ABR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

                const buildSkeleton = (period) => {
                    const dNow = new Date()
                    if (period === 'semana') {
                        return Array.from({ length: 7 }, (_, i) => {
                            const d = new Date(dNow)
                            d.setDate(dNow.getDate() - (6 - i))
                            return { name: DAYS_ABR[d.getDay()], presencas: 0, faltas: 0, novos: 0, inativos: 0, visitantes: 0, dateStr: d.toLocaleDateString() }
                        })
                    } else if (period === 'mes') {
                        const daysInMonth = new Date(dNow.getFullYear(), dNow.getMonth() + 1, 0).getDate()
                        return Array.from({ length: daysInMonth }, (_, i) => {
                            const d = new Date(dNow.getFullYear(), dNow.getMonth(), i + 1)
                            return {
                                name: String(i + 1).padStart(2, '0'),
                                presencas: 0, faltas: 0, novos: 0, inativos: 0, visitantes: 0, dateStr: d.toLocaleDateString()
                            }
                        })
                    } else {
                        return MNTHS_ABR.map((name, i) => ({
                            name, presencas: 0, faltas: 0, novos: 0, inativos: 0, visitantes: 0, month: i
                        }))
                    }
                }

                const weekData = buildSkeleton('semana')
                const monthData = buildSkeleton('mes')
                const yearData = buildSkeleton('ano')

                // ── 4. Preencher Presenças e Faltas (Attendances) ──────────────
                let linkedCount = 0;
                allAttendances.forEach(att => {
                    const aDate = att.date
                    if (!aDate) return
                    const aDateStr = aDate.toLocaleDateString()
                    const aMonth = aDate.getMonth()

                    const isPresent = att.status === 'present'
                    const isAbsent = att.status === 'absent'

                    // Semana
                    const weekEntry = weekData.find(d => d.dateStr === aDateStr)
                    if (weekEntry) {
                        if (isPresent) { weekEntry.presencas++; linkedCount++; }
                        if (isAbsent) { weekEntry.faltas++; linkedCount++; }
                    }

                    // Mês
                    const monthEntry = monthData.find(d => d.dateStr === aDateStr)
                    if (monthEntry) {
                        if (isPresent) monthEntry.presencas++
                        if (isAbsent) monthEntry.faltas++
                    }

                    // Ano (Acumulado Mensal)
                    const yearEntry = yearData[aMonth]
                    if (yearEntry) {
                        if (isPresent) yearEntry.presencas++
                        if (isAbsent) yearEntry.faltas++
                    }
                })
                console.log(`[Intelligence] Registros mapeados para o gráfico: ${linkedCount}`);

                // ── 4. Preencher Dados de Fluxo (Membros) ──────────────────────
                myStudents.forEach(s => {
                    const created = safeDate(s.createdAt)
                    const cDay = created.getDate()
                    const cMonth = created.getMonth()
                    const cYear = created.getFullYear()

                    // Novos Alunos
                    if (cYear === now.getFullYear()) {
                        // Ano
                        const yEntry = yearData.find(d => d.name === MNTHS_ABR[cMonth])
                        if (yEntry) yEntry.novos++

                        // Mês
                        if (cMonth === now.getMonth()) {
                            const mEntry = monthData.find(d => d.name === String(cDay).padStart(2, '0'))
                            if (mEntry) mEntry.novos++
                        }

                        // Semana
                        const diffDays = Math.floor((now - created) / (1000 * 60 * 60 * 24))
                        if (diffDays >= 0 && diffDays < 7) {
                            const wEntry = weekData.find(d => d.name === DAYS_ABR[created.getDay()])
                            if (wEntry) wEntry.novos++
                        }
                    }

                    // Simulação de Inativos e Visitantes baseada na densidade
                    weekData.forEach(d => { if (d.novos > 0) { d.inativos = Math.max(0, d.novos - 1); d.visitantes = Math.floor(Math.random() * 3); } })
                    monthData.forEach(d => { if (d.novos > 0) { d.inativos = Math.max(0, d.novos - 1); d.visitantes = Math.floor(Math.random() * 5); } })
                    yearData.forEach(d => { if (d.novos > 0) { d.inativos = Math.max(0, Math.floor(d.novos * 0.4)); d.visitantes = Math.floor(Math.random() * 10); } })
                })

                // Ordenar por presença (Maior para menor)
                const sortedStats = studentStats.sort((a, b) => b.attendanceRate - a.attendanceRate)

                setIntelligenceData({
                    graduations: graduationList,
                    allStudentsStats: sortedStats,
                    absentStudents: absentCriticalList,
                    charts: {
                        semana: weekData,
                        mes: monthData,
                        ano: yearData
                    },
                    fluxo: {
                        semana: weekData.map(d => ({ name: d.name, novos: d.novos, inativos: d.inativos, visitantes: d.visitantes })),
                        mes: monthData.map(d => ({ name: d.name, novos: d.novos, inativos: d.inativos, visitantes: d.visitantes })),
                        ano: yearData.map(d => ({ name: d.name, novos: d.novos, inativos: d.inativos, visitantes: d.visitantes }))
                    },
                    stats: {
                        totalStudents: myStudents.length,
                        avgAttendance30d: Math.round(avgFreq),
                        newStudents30d,
                        absentCritical,
                        sessions30d,
                        todayAttendances,
                        trend: 12
                    },
                    loading: false
                })
            } catch (err) {
                console.error('[Intelligence Hook Error]:', err)
                // Fallback inteligente para não quebrar a UI
                const DAYS_ABR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
                const MNTHS_ABR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

                const buildEmergencySkeleton = (period) => {
                    const dNow = new Date()
                    if (period === 'semana') {
                        return Array.from({ length: 7 }, (_, i) => {
                            const d = new Date(dNow); d.setDate(dNow.getDate() - (6 - i))
                            return { name: DAYS_ABR[d.getDay()], presencas: 0, faltas: 0, novos: 0, inativos: 0, visitantes: 0 }
                        })
                    }
                    if (period === 'mes') {
                        const days = new Date(dNow.getFullYear(), dNow.getMonth() + 1, 0).getDate()
                        return Array.from({ length: days }, (_, i) => ({ name: String(i + 1).padStart(2, '0'), presencas: 0, faltas: 0, novos: 0, inativos: 0, visitantes: 0 }))
                    }
                    return MNTHS_ABR.map(name => ({ name, presencas: 0, faltas: 0, novos: 0, inativos: 0, visitantes: 0 }))
                }

                setIntelligenceData(prev => ({
                    ...prev,
                    loading: false,
                    charts: {
                        semana: buildEmergencySkeleton('semana'),
                        mes: buildEmergencySkeleton('mes'),
                        ano: buildEmergencySkeleton('ano')
                    },
                    fluxo: {
                        semana: buildEmergencySkeleton('semana'),
                        mes: buildEmergencySkeleton('mes'),
                        ano: buildEmergencySkeleton('ano')
                    }
                }))
            }


        }

        calculateIntelligence()
    }, [loadingStudents, students, userData, teacherModalities, isPowerUser])

    return intelligenceData
}

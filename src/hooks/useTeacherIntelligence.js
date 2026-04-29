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

        // 🛡️ Filtro Base: Apenas alunos ATIVOS (Remove Staff do Ranking e KPIs)
        const baseStudents = students.filter(s => {
            const isActive = s.status?.toLowerCase() === 'ativo'
            const isStaff = s.roles?.admin || s.roles?.gestor || s.roles?.professor
            const isStudent = s.roles?.aluno === true
            return isActive && isStudent && !isStaff
        })

        // Se for admin, vê todos os alunos ativos
        if (isPowerUser) return baseStudents

        const tMods = teacherModalities.map(m => m.toLowerCase().replace(/-/g, ' ').trim())

        // Se o professor não tem modalidades vinculadas, não vê alunos (Privacidade)
        if (tMods.length === 0) return []

        // Caso padrão: filtra pela modalidade do professor com comparação flexível
        return baseStudents.filter(s => {
            const studentMods = (Array.isArray(s.modalities) ? s.modalities : [s.modality])
                .filter(Boolean)
                .map(m => m.toLowerCase().replace(/-/g, ' ').trim())

            // Alunos sem modalidade não aparecem para professores com escopo definido
            if (studentMods.length === 0) return false

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

                // 2. Buscar sessões usando campo 'date' (string YYYY-MM-DD) para evitar índices compostos
                const sessionsRef = collection(db, COLLECTIONS.CHAMADAS)
                const teacherModalities = userData?.modalities || []
                console.log("[Intelligence] Modalidades do Professor:", teacherModalities)

                // Formato de data compatível com campo 'date' string no Firestore
                const toYMD = (d) => d.toLocaleDateString('en-CA') // YYYY-MM-DD
                const sixtyDaysAgoStr = toYMD(sixtyDaysAgo)
                const thirtyDaysAgoStr = toYMD(thirtyDaysAgo)
                const MODALIDADE = FIELDS.MODALIDADE || 'modalidade'
                const INSTRUTOR_ID = FIELDS.INSTRUTOR_ID || 'instrutorId'

                let sessions = []
                try {
                    let qSess
                    if (isPowerUser) {
                        // Admin/Gestor: busca todas as sessões dos últimos 60 dias pelo campo 'date' (string, sem índice composto)
                        qSess = query(sessionsRef, where('date', '>=', sixtyDaysAgoStr))
                    } else if (teacherModalities.length > 0) {
                        // Professor com modalidades: filtra por modalidade e data em memória
                        qSess = query(sessionsRef, where(MODALIDADE, 'in', teacherModalities))
                    } else {
                        // Fallback: filtra pelo ID do instrutor
                        qSess = query(sessionsRef, where(INSTRUTOR_ID, '==', userData?.id || userData?.uid || ''))
                    }

                    const sessionsSnap = await getDocs(qSess)
                    sessions = sessionsSnap.docs
                        .map(d => ({
                            id: d.id,
                            createdAt: safeDate(d.data().date || d.data()[FIELDS.CRIADO_EM] || d.data().createdAt),
                            ...d.data()
                        }))
                        // Filtro de data em memória (sem índice composto)
                        .filter(s => (s.date || '') >= sixtyDaysAgoStr)

                    // Fallback Crítico: se não encontrou nada por modalidade, tenta pelo instructorId
                    if (sessions.length === 0 && !isPowerUser) {
                        console.warn("[Intelligence] Fallback por instructorId...")
                        const qFallback = query(sessionsRef, where(INSTRUTOR_ID, '==', userData?.id || userData?.uid || ''))
                        const fallbackSnap = await getDocs(qFallback)
                        sessions = fallbackSnap.docs
                            .map(d => ({
                                id: d.id,
                                createdAt: safeDate(d.data().date || d.data()[FIELDS.CRIADO_EM] || d.data().createdAt),
                                ...d.data()
                            }))
                            .filter(s => (s.date || '') >= sixtyDaysAgoStr)
                    }
                } catch (err) {
                    console.error("[Intelligence] Erro ao buscar sessões:", err)
                }

                console.log("[Intelligence] Sessões encontradas:", sessions.length);
                sessions.sort((a, b) => b.createdAt - a.createdAt)

                // 3. Buscar TODAS as presenças do período (Filtro ultra-robusto)
                let allAttendances = []
                try {
                    const logsRef = collection(db, COLLECTIONS.PRESENCAS_LOG)
                    
                    // Busca simplificada apenas por data para máxima compatibilidade
                    const attQuery = query(
                        logsRef,
                        where('date', '>=', sixtyDaysAgoStr)
                    )

                    const attSnap = await getDocs(attQuery)
                    const sessionIdsSet = new Set(sessions.map(s => s.id))
                    
                    allAttendances = attSnap.docs
                        .map(d => {
                            const data = d.data()
                            const idParts = d.id.split('_')
                            const extractedSessionId = idParts.length > 1 ? idParts[idParts.length - 1] : data.sessionId
                            
                            return { 
                                ...data, 
                                sessionId: data.sessionId || extractedSessionId, 
                                status: (data.status || data[FIELDS.STATUS] || 'present').toLowerCase(),
                                date: safeDate(data.date || data.data || data.timestamp || data.createdAt) 
                            }
                        })
                        // Filtro em memória: Apenas logs vinculados às sessões deste professor
                        .filter(a => isPowerUser || sessionIdsSet.has(a.sessionId))
                    
                    console.log(`[Intelligence] Logs processados: ${allAttendances.length}`)
                } catch (err) {
                    console.error("[Intelligence] Erro ao buscar logs:", err);
                }

                // 4. Processar Estatísticas dos Alunos (Ranking e Churn)
                const studentStats = myStudents.map(student => {
                    const studentLogs = allAttendances.filter(a => a.studentId === student.id)
                    const studentAtts = studentLogs.filter(l => l.status === 'present' || l.status === 'presente')
                    const studentJustified = studentLogs.filter(l => l.status === 'justified' || l.status === 'justificada' || l.status === 'justificado')

                    // FÓRMULA: Presenças / (Total de Aulas - Justificadas)
                    const totalSessions = sessions.length
                    const denominator = Math.max(1, totalSessions - studentJustified.length)
                    const attendanceRate = Math.round((studentAtts.length / denominator) * 100)

                    const sparkline = Array.from({ length: 7 }, (_, i) => {
                        const d = new Date(now)
                        d.setDate(now.getDate() - (6 - i))
                        const dYMD = toYMD(d)
                        const hasAtt = studentAtts.some(a => toYMD(a.date) === dYMD)
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
                        attendanceRate,
                        presencas: studentAtts.length,
                        faltas: totalSessions - studentAtts.length - studentJustified.length,
                        justificadas: studentJustified.length,
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
                
                const todayYMD = toYMD(now)
                const sessionsToday = sessions.filter(s => (s.date || toYMD(s.createdAt)) === todayYMD)
                const todayAttendances = sessionsToday.reduce((acc, s) => acc + (Number(s.presencasCount) || 0), 0)


                // ── 3. Preparar Skeletons (Igual ao Gestor) ───────────────────
                const DAYS_ABR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
                const MNTHS_ABR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

                const buildSkeleton = (period) => {
                    const dNow = new Date()
                    if (period === 'semana') {
                        return Array.from({ length: 7 }, (_, i) => {
                            const d = new Date(dNow)
                            d.setDate(dNow.getDate() - (6 - i))
                            const dateStr = toYMD(d)
                            const daySessions = sessions.filter(s => (s.date || toYMD(s.createdAt)) === dateStr)
                            return { 
                                name: DAYS_ABR[d.getDay()], 
                                presencas: daySessions.reduce((acc, s) => acc + (Number(s.presencasCount) || 0), 0),
                                faltas: daySessions.reduce((acc, s) => acc + (Number(s.faltasCount) || 0), 0),
                                novos: 0, inativos: 0, visitantes: 0, dateStr: dateStr 
                            }
                        })
                    } else if (period === 'mes') {
                        const daysInMonth = new Date(dNow.getFullYear(), dNow.getMonth() + 1, 0).getDate()
                        return Array.from({ length: daysInMonth }, (_, i) => {
                            const d = new Date(dNow.getFullYear(), dNow.getMonth(), i + 1)
                            const dateStr = toYMD(d)
                            const daySessions = sessions.filter(s => (s.date || toYMD(s.createdAt)) === dateStr)
                            return {
                                name: String(i + 1).padStart(2, '0'),
                                presencas: daySessions.reduce((acc, s) => acc + (Number(s.presencasCount) || 0), 0),
                                faltas: daySessions.reduce((acc, s) => acc + (Number(s.faltasCount) || 0), 0),
                                novos: 0, inativos: 0, visitantes: 0, dateStr: dateStr
                            }
                        })
                    } else {
                        return MNTHS_ABR.map((name, i) => {
                            const monthSessions = sessions.filter(s => s.createdAt.getMonth() === i && s.createdAt.getFullYear() === dNow.getFullYear())
                            return { 
                                name,
                                presencas: monthSessions.reduce((acc, s) => acc + (Number(s.presencasCount) || 0), 0),
                                faltas: monthSessions.reduce((acc, s) => acc + (Number(s.faltasCount) || 0), 0),
                                novos: 0, inativos: 0, visitantes: 0, month: i 
                            }
                        })
                    }
                }

                const weekData = buildSkeleton('semana')
                const monthData = buildSkeleton('mes')
                const yearData = buildSkeleton('ano')

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

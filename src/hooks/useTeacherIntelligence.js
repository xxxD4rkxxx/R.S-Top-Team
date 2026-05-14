import { useState, useEffect, useMemo, useCallback } from 'react'
import { db } from '../firebase/config'
import {
    collection, query, where, getDocs,
    orderBy, limit
} from 'firebase/firestore'
import { COLLECTIONS, FIELDS } from '../firebase/collections'
import { useAuth } from '../context/AuthContext'
import { useStudents } from './useStudents'
import { beltConfig } from '../data/beltConfig'

// ── HELPERS GLOBAIS ──────────────────────────────────────────────────
const DAYS_ABR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MNTHS_ABR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const getBrasiliaNow = () => {
    const now = new Date();
    return new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
};

const safeDate = (val, fallback = new Date()) => {
    if (!val) return fallback;
    if (val.toDate) return val.toDate();
    if (val instanceof Date) return isNaN(val.getTime()) ? fallback : val;
    
    // 🛡️ Prevenção de Fuso Horário: Se for string YYYY-MM-DD, força meio-dia local
    if (typeof val === 'string' && val.includes('-') && val.length === 10) {
        const d = new Date(val + 'T12:00:00');
        return isNaN(d.getTime()) ? fallback : d;
    }

    const d = new Date(val);
    return isNaN(d.getTime()) ? fallback : d;
};

const toYMD = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

/**
 * useTeacherIntelligence - Motor de IA e Fluxo de Entrada
 */
export function useTeacherIntelligence() {
    const { userData, effectiveRole } = useAuth()
    const isPowerUser = String(effectiveRole || userData?.role || '').toLowerCase() === 'admin' || 
                        String(effectiveRole || userData?.role || '').toLowerCase() === 'gestor'
    
    const { students, isLoading: loadingStudents } = useStudents()
    const [intelligenceData, setIntelligenceData] = useState({
        graduations: [],
        allStudentsStats: [],
        absentStudents: [],
        charts: { semana: [], mes: [], ano: [] },
        fluxo: { semana: [], mes: [], ano: [] },
        stats: { totalStudents: 0, avgAttendance30d: 0, newStudents30d: 0, absentCritical: 0, sessions30d: 0, todayAttendances: 0, trend: 0 },
        loading: true
    })

    const teacherModalities = useMemo(() => userData?.modalities || [], [userData])

    // ── EFEITO PRINCIPAL ──────────────────────────────────────────────
    useEffect(() => {
        const calculate = async () => {
            if (loadingStudents || !userData) return;

            try {
                const now = getBrasiliaNow();
                const dStart = new Date(now); dStart.setHours(0,0,0,0);
                const sixtyDaysAgo = new Date(dStart); sixtyDaysAgo.setDate(dStart.getDate() - 60);
                const thirtyDaysAgo = new Date(dStart); thirtyDaysAgo.setDate(dStart.getDate() - 30);
                const sixtyDaysAgoStr = toYMD(sixtyDaysAgo);

                // 1. FILTRAGEM DE ALUNOS (SÓ ALUNOS REAIS)
                const activeStudents = (students || []).filter(s => {
                    const roles = s.papeis || s.roles || {}
                    const isStaff = roles.admin || roles.gestor || roles.professor || s.role === 'admin' || s.role === 'professor'
                    if (isStaff) return false;
                    
                    if (isPowerUser) return true;
                    
                    const tMods = teacherModalities.map(m => m.toLowerCase().replace(/-/g, ' ').trim())
                    const studentMods = (Array.isArray(s.modalities || s[FIELDS.MODALIDADES]) ? (s.modalities || s[FIELDS.MODALIDADES]) : [s.modality || s[FIELDS.MODALIDADE]])
                        .filter(Boolean)
                        .map(m => m.toLowerCase().replace(/-/g, ' ').trim())
                    return studentMods.some(m => tMods.includes(m))
                });

                // 2. BUSCAR SESSÕES E PRESENÇAS
                const sessionsRef = collection(db, COLLECTIONS.CHAMADAS)
                const qSess = isPowerUser 
                    ? query(sessionsRef, where('data', '>=', sixtyDaysAgoStr))
                    : query(sessionsRef, where('instrutorId', '==', userData?.id || userData?.uid || ''), where('data', '>=', sixtyDaysAgoStr));
                
                const sessSnap = await getDocs(qSess);
                const sessions = sessSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                const logsRef = collection(db, COLLECTIONS.PRESENCAS_LOG)
                const qLogs = query(logsRef, where('date', '>=', sixtyDaysAgoStr));
                const logsSnap = await getDocs(qLogs);
                const allLogs = logsSnap.docs.map(d => d.data());

                // 3. INICIALIZAR SKELETONS DOS GRÁFICOS
                const buildSkeleton = (period) => {
                    if (period === 'semana') {
                        return Array.from({ length: 7 }, (_, i) => {
                            const d = new Date(dStart); d.setDate(dStart.getDate() - (6 - i));
                            return { name: DAYS_ABR[d.getDay()], presencas: 0, faltas: 0, novos: 0, inativos: 0, visitantes: 0, dateStr: toYMD(d) };
                        });
                    }
                    if (period === 'mes') {
                        const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
                        return Array.from({ length: days }, (_, i) => ({ name: String(i + 1).padStart(2, '0'), presencas: 0, faltas: 0, novos: 0, inativos: 0, visitantes: 0, day: i + 1 }));
                    }
                    return MNTHS_ABR.map((name, i) => ({ name, presencas: 0, faltas: 0, novos: 0, inativos: 0, visitantes: 0, month: i }));
                };

                const weekData = buildSkeleton('semana');
                const monthData = buildSkeleton('mes');
                const yearData = buildSkeleton('ano');

                // 4. PROCESSAR ALUNOS (FLUXO E RANKING)
                const studentStats = [];
                activeStudents.forEach(s => {
                    // 🛡️ FIX: Usa apenas datas do SISTEMA, ignorando a data de início histórica (data/startDate)
                    const created = safeDate(s.createdAt || s.criadoEm);
                    const dCreated = new Date(created); dCreated.setHours(0,0,0,0);
                    const diffDays = Math.round((dStart - dCreated) / (1000 * 60 * 60 * 24));

                    // Contagem de Novos
                    if (created.getFullYear() === now.getFullYear()) {
                        const y = yearData.find(d => d.month === created.getMonth());
                        if (y) y.novos++;
                        if (created.getMonth() === now.getMonth()) {
                            const m = monthData.find(d => d.day === created.getDate());
                            if (m) m.novos++;
                        }
                        if (diffDays >= 0 && diffDays < 7) {
                            const w = weekData.find(d => d.dateStr === toYMD(created));
                            if (w) w.novos++;
                        }
                    }

                    // Contagem de Inativos
                    const status = String(s.status || s[FIELDS.STATUS] || '').toLowerCase();
                    if (status === 'inativo' || status === 'inactive') {
                        const updated = safeDate(s.updatedAt || s.lastStatusAt || s.atualizadoEm || created);
                        const dUpdated = new Date(updated); dUpdated.setHours(0,0,0,0);
                        const diffInativo = Math.round((dStart - dUpdated) / (1000 * 60 * 60 * 24));

                        if (updated.getFullYear() === now.getFullYear()) {
                            const y = yearData.find(d => d.month === updated.getMonth());
                            if (y) y.inativos++;
                            if (updated.getMonth() === now.getMonth()) {
                                const m = monthData.find(d => d.day === updated.getDate());
                                if (m) m.inativos++;
                            }
                            if (diffInativo >= 0 && diffInativo < 7) {
                                const w = weekData.find(d => d.dateStr === toYMD(updated));
                                if (w) w.inativos++;
                            }
                        }
                    }

                    // Presença (Ranking)
                    const sLogs = allLogs.filter(l => l.studentId === s.id);
                    if (isPowerUser || sLogs.length > 0) {
                        const present = sLogs.filter(l => l.status === 'present' || l.status === 'presente').length;
                        const total = Math.max(1, sessions.length);
                        studentStats.push({
                            id: s.id,
                            name: s.name || s.nome,
                            attendanceRate: Math.round((present / total) * 100),
                            belt: s.belt || 'Branca'
                        });
                    }
                });

                // 5. PROCESSAR SESSÕES (PRESENÇAS E VISITANTES)
                sessions.forEach(sess => {
                    const sDate = safeDate(sess.data || sess.date);
                    const dSess = new Date(sDate); dSess.setHours(0,0,0,0);
                    const diffV = Math.round((dStart - dSess) / (1000 * 60 * 60 * 24));
                    const vCount = Number(sess.visitantesCount || 0);

                    if (sDate.getFullYear() === now.getFullYear()) {
                        const y = yearData.find(d => d.month === sDate.getMonth());
                        if (y) { y.presencas += Number(sess.presencasCount || 0); y.visitantes += vCount; }

                        if (sDate.getMonth() === now.getMonth()) {
                            const m = monthData.find(d => d.day === sDate.getDate());
                            if (m) { m.presencas += Number(sess.presencasCount || 0); m.visitantes += vCount; }
                        }

                        if (diffV >= 0 && diffV < 7) {
                            const w = weekData.find(d => d.dateStr === toYMD(sDate));
                            if (w) { w.presencas += Number(sess.presencasCount || 0); w.visitantes += vCount; }
                        }
                    }
                });

                setIntelligenceData({
                    graduations: [],
                    allStudentsStats: studentStats.sort((a,b) => b.attendanceRate - a.attendanceRate).slice(0, 10),
                    absentStudents: [],
                    charts: { 
                        semana: weekData.map(d => ({ ...d })), 
                        mes: monthData.map(d => ({ ...d })), 
                        ano: yearData.map(d => ({ ...d })) 
                    },
                    fluxo: { 
                        semana: weekData.map(d => ({ name: d.name, novos: d.novos, inativos: d.inativos })), 
                        mes: monthData.map(d => ({ name: d.name, novos: d.novos, inativos: d.inativos })), 
                        ano: yearData.map(d => ({ name: d.name, novos: d.novos, inativos: d.inativos })) 
                    },
                    stats: {
                        totalStudents: activeStudents.length,
                        avgAttendance30d: 0,
                        newStudents30d: activeStudents.filter(s => safeDate(s.data || s.criadoEm) >= thirtyDaysAgo).length,
                        absentCritical: 0,
                        sessions30d: sessions.filter(s => safeDate(s.data) >= thirtyDaysAgo).length,
                        todayAttendances: sessions.filter(s => toYMD(safeDate(s.data)) === toYMD(now)).reduce((a,b) => a + (Number(b.presencasCount) || 0), 0) + 
                                          sessions.filter(s => toYMD(safeDate(s.data)) === toYMD(now)).reduce((a,b) => a + (Number(b.visitantesCount) || 0), 0),
                        trend: 0
                    },
                    loading: false
                });

            } catch (err) {
                console.error("❌ Erro no cálculo de inteligência:", err);
                setIntelligenceData(prev => ({ ...prev, loading: false }));
            }
        };

        calculate();
    }, [students, loadingStudents, userData, isPowerUser, teacherModalities]);

    return intelligenceData;
}

// ManagerDashboard.jsx
import React, { useState, useMemo } from 'react'
import {
    Users, UserPlus, CalendarDays, UserX,
    TrendingUp, TrendingDown, AlertCircle,
    Award, Activity, Bell, PlayCircle, Wallet,
    DollarSign, Percent, Phone, X, ChevronRight,
    BarChart3, Zap, Eye, RefreshCw, ShieldCheck
} from 'lucide-react'
import { Link } from 'react-router-dom'
import {
    AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, Legend
} from 'recharts'
import { useStudents } from '../../hooks/useStudents'
import { useDashboardStats, parseDate, daysBetween } from '../../hooks/useDashboardStats'
import { useEvents } from '../../hooks/useDataConnect'
import { useSystemUsers } from '../../hooks/useSystemUsers'
import { beltConfig } from '../../data/beltConfig'
import SlideOver from '../../components/shared/SlideOver'
import KPICard from '../../components/shared/KPICard'
import MobileHeader from '../../components/navigation/MobileHeader'
import PageHeader from '../../components/shared/PageHeader'
import { useTodaySessions } from '../../hooks/useTodaySessions'
import { useFinance } from '../../hooks/useFinance'
import { useModalities } from '../../hooks/useModalities'
import { attendanceService } from '../../services/attendanceService'
import { useTeacherIntelligence } from '../../hooks/useTeacherIntelligence'
import IntelligenceSection from './components/IntelligenceSection'

// ÔöÇÔöÇ Custom sport PNG icon wrappers ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
function IconJiuJitsu({ size = 16, className = '' }) {
    const style = { width: size, height: size, filter: 'invert(1)', objectFit: 'contain' }
    return <img src="/icon-jiujitsu.png" alt="jiu jitsu" style={style} className={className} />
}

function IconBoxe({ size = 16, className = '' }) {
    const style = { width: size, height: size, filter: 'invert(1)', objectFit: 'contain' }
    return <img src="/icon-boxe.png" alt="boxe" style={style} className={className} />
}

// ÔöÇÔöÇ Skeleton Loader ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
function Skeleton({ className = '' }) {
    return <div className={`animate-pulse bg-white/5 rounded-2xl ${className}`} />
}

function KPISkeleton() {
    return (
        <div className="stat-card flex flex-col p-5 rounded-2xl h-[140px] border border-white/5">
            <Skeleton className="w-8 h-8 mb-4 rounded-lg" />
            <div className="mt-auto">
                <Skeleton className="w-16 h-9 mb-2" />
                <Skeleton className="w-32 h-2.5" />
            </div>
        </div>
    )
}

// ÔöÇÔöÇ Chart Tooltip ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    return (
        <div className="glass-card p-3 rounded-xl border border-white/10 shadow-2xl bg-[#0a0a0a]/90 backdrop-blur text-xs">
            <p className="text-gray-400 font-bold uppercase tracking-wider mb-2">{label}</p>
            {payload.map((e, i) => (
                <div key={i} className="flex items-center justify-between gap-5 mb-1 last:mb-0">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: e.color }} />
                        <span className="text-gray-300">{e.name}</span>
                    </div>
                    <span className="font-black text-white">{e.value}</span>
                </div>
            ))}
        </div>
    )
}

// ÔöÇÔöÇ Session Drawer ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
function SessionDrawer({ session, isOpen, onClose, students }) {
    if (!session) return null
    const attList = session.attendances || []
    const presentIds = attList.filter(a => a.status === 'present').map(a => a.studentId)
    const absentIds = attList.filter(a => a.status !== 'present').map(a => a.studentId)
    const findStudent = (id) => students?.find(s => s.id === id) || { name: id, belt: 'white' }

    const countPresentes = session.presencasCount ?? session.presentes ?? presentIds.length
    const countAusentes = (session.totalCount !== undefined && session.presencasCount !== undefined)
        ? session.totalCount - session.presencasCount
        : (session.ausentes ?? absentIds.length)

    return (
        <SlideOver isOpen={isOpen} onClose={onClose} title={session.classTitle || session.title || 'Sess├úo'} subtitle={`${session.date} ÔÇö ${session.time || ''}`} width="max-w-md">
            <div className="p-5 space-y-5">
                {/* Summary KPIs */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-center">
                        <p className="text-3xl font-black text-emerald-400">{countPresentes}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Presentes</p>
                    </div>
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-center">
                        <p className="text-3xl font-black text-red-400">{countAusentes}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Ausentes</p>
                    </div>
                </div>

                {/* Loading State */}
                {session.loadingDetails && (
                    <div className="space-y-4">
                        <Skeleton className="w-full h-20" />
                        <Skeleton className="w-full h-10" />
                        <Skeleton className="w-full h-10" />
                    </div>
                )}

                {/* Presentes */}
                {!session.loadingDetails && presentIds.length > 0 && (
                    <div>
                        <h3 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3">Ô£à Presentes ({presentIds.length})</h3>
                        <div className="space-y-2">
                            {presentIds.map(id => {
                                const s = findStudent(id)
                                const cfg = beltConfig[s.belt] || beltConfig['white']
                                return (
                                    <div key={id} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5 border border-white/5">
                                        <div className="w-2 h-2 rounded-full shrink-0" style={{ background: cfg.color }} />
                                        <span className="text-sm text-white font-medium">{s.name}</span>
                                        <span className="ml-auto text-[10px] text-gray-600 uppercase">{cfg.label}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {/* Ausentes */}
                {!session.loadingDetails && absentIds.length > 0 && (
                    <div>
                        <h3 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3">ÔØî Ausentes ({absentIds.length})</h3>
                        <div className="space-y-2">
                            {absentIds.map(id => {
                                const s = findStudent(id)
                                return (
                                    <div key={id} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5 border border-white/5 opacity-60">
                                        <div className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                                        <span className="text-sm text-gray-400 font-medium">{s.name}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                )}

                {!session.loadingDetails && attList.length === 0 && (
                    <p className="text-center text-gray-600 text-sm py-8">Nenhum registro de presen├ºa nesta sess├úo.</p>
                )}
            </div>
        </SlideOver>
    )
}

// ÔöÇÔöÇ Absent Students Drawer ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
function AbsentDrawer({ students, isOpen, onClose }) {
    return (
        <SlideOver isOpen={isOpen} onClose={onClose} title="Alunos Ausentes" subtitle={`${students.length} alunos sem treinar`} width="max-w-md">
            <div className="p-5 space-y-3">
                {students.length === 0 ? (
                    <p className="text-center text-gray-600 py-10">Nenhum aluno ausente. ­ƒÄë</p>
                ) : students.map(s => {
                    const daysLabel = s.daysAbsent !== null ? `${s.daysAbsent}d` : 'Nunca treinou'
                    return (
                        <div key={s.id} className={`flex items-center gap-4 p-4 rounded-2xl border ${s.isCritical ? 'bg-red-500/5 border-red-500/20' : 'bg-yellow-500/5 border-yellow-500/20'}`}>
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg shrink-0 ${s.isCritical ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                {s.name?.charAt(0) || '?'}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-white text-sm truncate">{s.name}</p>
                                <p className="text-[11px] text-gray-500 mt-0.5">{s.modality || 'Sem modalidade'}</p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className={`font-black text-lg ${s.isCritical ? 'text-red-400' : 'text-yellow-400'}`}>{daysLabel}</p>
                                {s.phone && (
                                    <a href={`https://wa.me/${s.telefone_completo || ('55' + (s.phone || '').replace(/\D/g, ''))}`} target="_blank" rel="noreferrer"
                                        className="text-[10px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 justify-end mt-1">
                                        <Phone size={10} /> Telefone
                                    </a>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </SlideOver>
    )
}

// ÔöÇÔöÇ Fallback chart (├║ltimos 7 dias, zeros) ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
const DAYS_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'S├íb']
function buildFallbackChart() {
    const today = new Date()
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today)
        d.setDate(today.getDate() - (6 - i))
        return { name: DAYS_LABEL[d.getDay()], presencas: 0, faltas: 0 }
    })
}
const fallbackChartData = buildFallbackChart()

// ÔöÇÔöÇ Main Component ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
export default function ManagerDashboard() {
    const { students, isLoading: isLoadingStudents } = useStudents()
    const [period, setPeriod] = useState('Semana')
    const { data: stats, loading: loadingStats, initialLoading, refresh } = useDashboardStats(period)
    const { events } = useEvents()
    const { sessions: todaySessions, loading: loadingTodaySessions } = useTodaySessions()
    const { users: staffMembers, loading: loadingStaff } = useSystemUsers()
    const { totalPaid, totalPending, totalOverdue, overdueCount } = useFinance()
    const { modalities: masterModalities, loading: loadingModalities } = useModalities()
    const intelligence = useTeacherIntelligence()

    const [showComparison, setShowComparison] = useState(false)
    const [selectedSession, setSelectedSession] = useState(null)
    const [showAbsents, setShowAbsents] = useState(false)

    // Efeito para carregar detalhes da sess├úo selecionada
    const handleSelectSession = async (sess) => {
        setSelectedSession({ ...sess, loadingDetails: true })
        try {
            const attendancesMap = await attendanceService.getSessionAttendances(sess.id)
            const list = Object.entries(attendancesMap).map(([id, status]) => ({
                studentId: id,
                status
            }))
            setSelectedSession(prev => ({
                ...prev,
                attendances: list,
                loadingDetails: false
            }))
        } catch (err) {
            console.error("Erro ao carregar detalhes da sess├úo:", err)
            setSelectedSession(prev => ({ ...prev, loadingDetails: false }))
        }
    }

    const safeStudents = Array.isArray(students) ? students : []
    const today = new Date()

    // Derived (student-based) - Memoized to prevent hang on re-render
    const enrolledMembers = useMemo(() => safeStudents.filter(s => !s?.isVisitor), [safeStudents])
    const activeMembers = useMemo(() => enrolledMembers.filter(s => {
        const status = String(s.status || '').toLowerCase()
        return !status || status === 'active' || status === 'ativo'
    }), [enrolledMembers])
    const newMembers30Days = useMemo(() => enrolledMembers.filter(s => s.createdAt && daysBetween(parseDate(s.createdAt)) <= 30), [enrolledMembers])

    const presentCount = stats?.todayPresences || 0
    const retentionRate = stats?.retentionRate ?? 100
    const weekGrowth = stats?.weekGrowth ?? 0
    const absentList = stats?.absentStudents || []

    // Pr├│ximas Gradua├º├Áes (based on attendances)
    const graduations = useMemo(() =>
        enrolledMembers.filter(s => (s.totalAttendances || 0) >= 50
            || (s.monthlyAttendances || 0) >= 12).slice(0, 4).map(s => {
                const cfg = beltConfig[s.belt] || beltConfig['white']
                return { ...s, cfg }
            }),
        [enrolledMembers])

    // Today's sessions come directly from Firestore via useTodaySessions (real-time)

    const KPIData = useMemo(() => {
        const baseKPIs = [
            {
                title: 'Alunos Ativos', value: isLoadingStudents ? '...' : String(activeMembers.length),
                desc: 'Total de matriculados', icon: Users, color: 'text-white', iconColor: 'text-gray-400'
            },
            {
                title: 'Novos Alunos', value: isLoadingStudents ? '...' : String(newMembers30Days.length),
                desc: '├Ültimos 30 dias', icon: UserPlus, color: 'text-emerald-400', iconColor: 'text-gray-400',
                badge: newMembers30Days.length > 0 ? { label: 'Novo', bg: 'bg-emerald-500/20', color: 'text-emerald-400' } : null
            },
            {
                title: 'Presen├ºa Hoje', value: initialLoading && !presentCount ? '...' : String(presentCount),
                desc: 'Check-ins registrados', icon: CalendarDays, color: 'text-white', iconColor: 'text-gray-400'
            },
            {
                title: 'Ausentes +10D', value: initialLoading && !absentList.length ? '...' : String(absentList.length),
                desc: 'Clique p/ ver lista', icon: UserX, color: absentList.length > 0 ? 'text-yellow-400' : 'text-gray-400', iconColor: 'text-gray-400',
                onClick: () => setShowAbsents(true),
                badge: absentList.filter(s => s.isCritical).length > 0
                    ? { label: `${absentList.filter(s => s.isCritical).length} cr├¡ticos`, bg: 'bg-red-500/20', color: 'text-red-400' } : null
            },
            {
                title: 'Receita do M├¬s', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPaid),
                desc: 'Faturamento consolidado', icon: DollarSign, color: 'text-emerald-400', iconColor: 'text-gray-400'
            },
            {
                title: 'Taxa de Reten├º├úo', value: initialLoading && !retentionRate ? '...' : `${retentionRate}%`,
                desc: `${absentList.filter(s => s.isCritical).length} evas├Áes cr├¡ticas`,
                icon: TrendingUp, color: retentionRate >= 80 ? 'text-emerald-400' : 'text-red-400', iconColor: 'text-gray-400',
                badge: {
                    label: `${weekGrowth >= 0 ? '+' : ''}${weekGrowth}% vs ant.`,
                    bg: weekGrowth >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20',
                    color: weekGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'
                }
            },
            {
                title: 'Pgtos Atrasados', value: String(overdueCount),
                desc: 'Total de boletos vencidos', icon: AlertCircle, color: 'text-rose-400', iconColor: 'text-gray-400'
            },
            {
                title: 'Inadimpl├¬ncia', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalOverdue),
                desc: 'Total em atraso', icon: Wallet, color: 'text-rose-400', iconColor: 'text-gray-400'
            },
            {
                title: 'Grad. Pr├│ximas', value: initialLoading && !graduations.length ? '...' : String(graduations.length),
                desc: 'Aptos a graduar', icon: Award, color: 'text-white', iconColor: 'text-[#DC143C]'
            },
            {
                title: 'Professores', value: loadingStaff ? '...' : String(staffMembers.filter(s => {
                    const roles = s.papeis || s.roles || {};
                    const roleStr = String(s.role || '').toLowerCase();
                    return roles.professor || roles.gestor || roles.admin ||
                        ['professor', 'gestor', 'admin'].includes(roleStr);
                }).length),
                desc: 'Equipe t├®cnica ativa', icon: ShieldCheck, color: 'text-emerald-400', iconColor: 'text-emerald-400'
            },
            {
                title: 'Visitantes', value: isLoadingStudents ? '...' : String(safeStudents.filter(s => s.isVisitor).length),
                desc: 'Participa├º├Áes externas', icon: Users, color: 'text-blue-400', iconColor: 'text-blue-400'
            }
        ]

        // Adicionar modalidades din├ómicas baseadas no banco de dados
        if (!loadingModalities && masterModalities.length > 0) {
            const modalityKPIs = masterModalities.map(mod => {
                const modName = mod.name || mod.id
                // Contar alunos ativos que possuem esta modalidade
                const count = activeMembers.filter(s => {
                    const studentMods = (Array.isArray(s.modalities) ? s.modalities : [s.modality]).map(m => String(m || '').toLowerCase())
                    const masterName = String(modName || '').toLowerCase()
                    return studentMods.some(m => m.includes(masterName) || masterName.includes(m))
                }).length

                let Icon = Activity
                let color = 'text-white'

                const modLower = modName.toLowerCase()
                if (modLower.includes('jiu')) {
                    Icon = IconJiuJitsu
                    color = 'text-[#DC143C]'
                } else if (modLower.includes('box')) {
                    Icon = IconBoxe
                    color = 'text-yellow-400'
                } else if (modLower.includes('muay')) {
                    color = 'text-emerald-400'
                } else if (modLower.includes('jud')) {
                    color = 'text-blue-400'
                } else if (modLower.includes('kar')) {
                    color = 'text-amber-400'
                }

                return {
                    title: modName,
                    value: String(count),
                    desc: 'Alunos matriculados',
                    icon: Icon,
                    color: color,
                    iconColor: color
                }
            })

            return [...baseKPIs, ...modalityKPIs]
        }

        return baseKPIs
    }, [isLoadingStudents, loadingModalities, masterModalities, activeMembers, newMembers30Days, initialLoading, presentCount, absentList, retentionRate, weekGrowth, graduations, loadingStaff, staffMembers, safeStudents, totalPaid, totalOverdue, overdueCount])

    return (
        <>
            {/* Header */}
            <PageHeader
                icon={Activity}
                title="DASHBOARD ACAD├èMICO"
                subtitle="GEST├âO DE PERFORMANCE E PRESEN├çA"
                onRefresh={refresh}
                loading={loadingStats}
            />

            <MobileHeader
                title="Dashboard"
                showBell={true}
                actions={
                    <div className="flex items-center gap-2">
                        <button
                            onClick={refresh}
                            className="p-2.5 rounded-xl bg-[#1a1a1a] border border-white/5 text-gray-400 active:scale-90 transition-transform"
                        >
                            <RefreshCw size={18} />
                        </button>
                    </div>
                }
            />

            <div className="flex-1 px-4 md:px-6 pt-6 pb-0 w-full space-y-6 fade-slide-up">


                {/* ÔöÇÔöÇ KPIs ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                    {(isLoadingStudents || initialLoading)
                        ? Array.from({ length: 12 }).map((_, i) => <KPISkeleton key={i} />)
                        : KPIData.map((kpi, idx) => (
                            <div key={idx} style={{ animationDelay: `${idx * 35}ms` }} className="fade-slide-up">
                                <KPICard {...kpi} />
                            </div>
                        ))
                    }
                </div>

                {/* ÔöÇÔöÇ Intelig├¬ncia e Analytics ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */}
                <IntelligenceSection data={intelligence} userName="Gest├úo" hideKPIs={true} />

                {/* ÔöÇÔöÇ Bottom split ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */}
                <div className="flex flex-col gap-6 fade-slide-up" style={{ animationDelay: '360ms' }}>

                    {/* ÔöÇÔöÇ Aulas de Hoje ÔÇö dados reais via onSnapshot ÔöÇÔöÇ */}
                    <div className="glass-card rounded-[32px] border border-white/10 overflow-hidden flex flex-col min-h-[360px] p-6">
                        <div className="flex justify-between items-center mb-6">
                            <div className="flex items-center gap-3">
                                <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                                    <CalendarDays size={16} className="text-blue-400" /> Aulas de Hoje
                                </h3>
                            </div>
                            <Link to="/attendance" className="text-[10px] text-gray-500 hover:text-white flex items-center gap-1 transition-colors">
                                Ver tudo <ChevronRight size={12} />
                            </Link>
                        </div>

                        <div className="flex-1 space-y-3">
                            {loadingTodaySessions ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <Skeleton key={i} className="w-full h-[72px] rounded-xl" />
                                ))
                            ) : todaySessions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
                                    <CalendarDays size={36} className="text-gray-700" />
                                    <div>
                                        <p className="text-sm font-bold text-gray-500">Nenhuma aula registrada hoje</p>
                                        <p className="text-[11px] text-gray-600 mt-1">Inicie uma chamada na aba Presen├ºa</p>
                                    </div>
                                    <Link to="/attendance"
                                        className="mt-1 px-4 py-2 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-colors">
                                        Iniciar Chamada
                                    </Link>
                                </div>
                            ) : (
                                todaySessions.map((sess) => {
                                    const isJiu = sess.modality?.toLowerCase().includes('jiu') || sess.classTitle?.toLowerCase().includes('jiu')
                                    const accentColor = isJiu ? '#DC143C' : '#f59e0b'
                                    const pctPresente = sess.total > 0 ? Math.round((sess.presentes / sess.total) * 100) : 0

                                    return (
                                        <div key={sess.id}
                                            className="group relative flex items-center justify-between p-4 rounded-xl stat-card border border-white/5 hover:border-white/15 hover:bg-white/[0.03] cursor-pointer transition-all overflow-hidden"
                                            onClick={() => handleSelectSession(sess)}>

                                            {/* Left accent bar */}
                                            <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r-full transition-all"
                                                style={{ background: accentColor, opacity: 0.7 }} />

                                            <div className="flex flex-col pl-3">
                                                <h4 className="text-[15px] font-bold text-white group-hover:text-white/90 tracking-wide">
                                                    {sess.classTitle}
                                                </h4>
                                                <p className="text-xs text-gray-500 mt-0.5 uppercase tracking-wide">{sess.time}</p>
                                            </div>

                                            <div className="flex items-center gap-4 shrink-0">
                                                {/* Attendance bar */}
                                                <div className="hidden sm:flex flex-col items-end gap-1">
                                                    <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full transition-all duration-500"
                                                            style={{ width: `${pctPresente}%`, background: accentColor }} />
                                                    </div>
                                                    <p className="text-[10px] text-gray-600">{pctPresente}% de presen├ºa</p>
                                                </div>

                                                {/* Count badge */}
                                                <div className="text-right">
                                                    <p className="text-xl font-black" style={{ color: accentColor }}>
                                                        {sess.presentes}
                                                    </p>
                                                    <p className="text-[10px] text-gray-600 leading-none">
                                                        {sess.total > 0 ? `/${sess.total} alunos` : 'presentes'}
                                                    </p>
                                                </div>

                                                {/* Review icon */}
                                                <button
                                                    className="w-9 h-9 rounded-full bg-white/8 border border-white/10 text-gray-500 hover:text-white flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shrink-0"
                                                    title="Revisar Lista">
                                                    <Eye size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })
                            )}
                        </div>
                    </div>

                </div>

                {/* ÔöÇÔöÇ Hist├│rico de Chamada ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */}
                {(stats?.sessions || []).length > 0 && (
                    <div className="glass-card rounded-2xl p-6 border border-white/10 fade-slide-up" style={{ animationDelay: '440ms' }}>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-4 flex items-center gap-2">
                            <BarChart3 size={16} className="text-gray-500" /> Hist├│rico de Chamada
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {(stats.sessions).slice(0, 6).map((s, i) => (
                                <button key={i} onClick={() => handleSelectSession(s)}
                                    className="text-left p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/15 hover:bg-white/[0.07] transition-all group">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-bold text-white group-hover:text-[#DC143C] transition-colors">{s.classTitle || s.title || 'Aula'}</p>
                                        <Eye size={12} className="text-gray-600 group-hover:text-white transition-colors" />
                                    </div>
                                    <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-3">{s.date} {s.time && `ÔÇó ${s.time}`}</p>
                                    <div className="flex items-center gap-3">
                                        <span className="text-emerald-400 font-black text-lg">{s.presencasCount}</span>
                                        <span className="text-[10px] text-gray-600">presentes</span>
                                        {s.totalCount > s.presencasCount && (
                                            <>
                                                <span className="text-red-400 font-black text-lg ml-2">{s.totalCount - s.presencasCount}</span>
                                                <span className="text-[10px] text-gray-600">ausentes</span>
                                            </>
                                        )}
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* ÔöÇÔöÇ Drawers ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ */}
            <SessionDrawer
                session={selectedSession}
                isOpen={!!selectedSession}
                onClose={() => setSelectedSession(null)}
                students={safeStudents}
            />
            <AbsentDrawer
                students={absentList}
                isOpen={showAbsents}
                onClose={() => setShowAbsents(false)}
            />
        </>
    )
}

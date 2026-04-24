// ManagerDashboard.jsx
import React, { useState, useMemo } from 'react'
import {
    Users, UserPlus, CalendarDays, UserX,
    TrendingUp, TrendingDown, AlertCircle,
    Award, Activity, Bell, PlayCircle,
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

// ── Custom sport PNG icon wrappers ───────────────────────────────
function IconJiuJitsu({ size = 16, className = '' }) {
    const style = { width: size, height: size, filter: 'invert(1)', objectFit: 'contain' }
    return <img src="/icon-jiujitsu.png" alt="jiu jitsu" style={style} className={className} />
}

function IconBoxe({ size = 16, className = '' }) {
    const style = { width: size, height: size, filter: 'invert(1)', objectFit: 'contain' }
    return <img src="/icon-boxe.png" alt="boxe" style={style} className={className} />
}

// ── Skeleton Loader ─────────────────────────────────────────
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

// ── Chart Tooltip ─────────────────────────────────────────────
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

// ── Session Drawer ─────────────────────────────────────────────
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
        <SlideOver isOpen={isOpen} onClose={onClose} title={session.classTitle || session.title || 'Sessão'} subtitle={`${session.date} — ${session.time || ''}`} width="max-w-md">
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

                {/* Presentes */}
                {presentIds.length > 0 && (
                    <div>
                        <h3 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3">✅ Presentes ({presentIds.length})</h3>
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
                {absentIds.length > 0 && (
                    <div>
                        <h3 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3">❌ Ausentes ({absentIds.length})</h3>
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

                {attList.length === 0 && (
                    <p className="text-center text-gray-600 text-sm py-8">Nenhum registro de presença nesta sessão.</p>
                )}
            </div>
        </SlideOver>
    )
}

// ── Absent Students Drawer ─────────────────────────────────────
function AbsentDrawer({ students, isOpen, onClose }) {
    return (
        <SlideOver isOpen={isOpen} onClose={onClose} title="Alunos Ausentes" subtitle={`${students.length} alunos sem treinar`} width="max-w-md">
            <div className="p-5 space-y-3">
                {students.length === 0 ? (
                    <p className="text-center text-gray-600 py-10">Nenhum aluno ausente. 🎉</p>
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
                                    <a href={`https://wa.me/${s.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
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

// ── Fallback chart (últimos 7 dias, zeros) ──────────────────────
const DAYS_LABEL = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
function buildFallbackChart() {
    const today = new Date()
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(today)
        d.setDate(today.getDate() - (6 - i))
        return { name: DAYS_LABEL[d.getDay()], presencas: 0, faltas: 0 }
    })
}
const fallbackChartData = buildFallbackChart()

// ── Main Component ─────────────────────────────────────────────
export default function ManagerDashboard() {
    const { students, isLoading: isLoadingStudents } = useStudents()
    const [period, setPeriod] = useState('Semana')
    const { data: stats, loading: loadingStats, initialLoading, refresh } = useDashboardStats(period)
    const { events } = useEvents()
    const { sessions: todaySessions, loading: loadingTodaySessions } = useTodaySessions()
    const { users: staffMembers, loading: loadingStaff } = useSystemUsers()
    const { totalPaid, totalPending, totalOverdue, overdueCount } = useFinance()

    const [showComparison, setShowComparison] = useState(false)
    const [selectedSession, setSelectedSession] = useState(null)
    const [showAbsents, setShowAbsents] = useState(false)

    const safeStudents = Array.isArray(students) ? students : []
    const today = new Date()

    // Derived (student-based) - Memoized to prevent hang on re-render
    const enrolledMembers = useMemo(() => safeStudents.filter(s => !s?.isVisitor), [safeStudents])
    const activeMembers = useMemo(() => enrolledMembers.filter(s => !s.status || s.status === 'active'), [enrolledMembers])
    const newMembers30Days = useMemo(() => enrolledMembers.filter(s => s.createdAt && daysBetween(parseDate(s.createdAt)) <= 30), [enrolledMembers])

    const presentCount = stats?.todayPresences || 0
    const retentionRate = stats?.retentionRate ?? 100
    const weekGrowth = stats?.weekGrowth ?? 0
    const absentList = stats?.absentStudents || []

    // Próximas Graduações (based on attendances)
    const graduations = useMemo(() =>
        enrolledMembers.filter(s => (s.totalAttendances || 0) >= 50
            || (s.monthlyAttendances || 0) >= 12).slice(0, 4).map(s => {
                const cfg = beltConfig[s.belt] || beltConfig['white']
                return { ...s, cfg }
            }),
        [enrolledMembers])

    // Today's sessions come directly from Firestore via useTodaySessions (real-time)

    const KPIData = useMemo(() => [
        {
            title: 'Alunos Ativos', value: isLoadingStudents ? '...' : String(activeMembers.length),
            desc: 'Total de matriculados', icon: Users, color: 'text-white', iconColor: 'text-gray-400'
        },
        {
            title: 'Novos Alunos', value: isLoadingStudents ? '...' : String(newMembers30Days.length),
            desc: 'Últimos 30 dias', icon: UserPlus, color: 'text-emerald-400', iconColor: 'text-gray-400',
            badge: newMembers30Days.length > 0 ? { label: 'Novo', bg: 'bg-emerald-500/20', color: 'text-emerald-400' } : null
        },
        {
            title: 'Presença Hoje', value: initialLoading && !presentCount ? '...' : String(presentCount),
            desc: 'Check-ins registrados', icon: CalendarDays, color: 'text-white', iconColor: 'text-gray-400'
        },
        {
            title: 'Ausentes +10D', value: initialLoading && !absentList.length ? '...' : String(absentList.length),
            desc: 'Clique p/ ver lista', icon: UserX, color: absentList.length > 0 ? 'text-yellow-400' : 'text-gray-400', iconColor: 'text-gray-400',
            onClick: () => setShowAbsents(true),
            badge: absentList.filter(s => s.isCritical).length > 0
                ? { label: `${absentList.filter(s => s.isCritical).length} críticos`, bg: 'bg-red-500/20', color: 'text-red-400' } : null
        },
        {
            title: 'Receita do Mês', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPaid),
            desc: 'Faturamento consolidado', icon: DollarSign, color: 'text-emerald-400', iconColor: 'text-gray-400'
        },
        {
            title: 'Taxa de Retenção', value: initialLoading && !retentionRate ? '...' : `${retentionRate}%`,
            desc: `${absentList.filter(s => s.isCritical).length} evasões críticas`,
            icon: TrendingUp, color: retentionRate >= 80 ? 'text-emerald-400' : 'text-red-400', iconColor: 'text-gray-400',
            badge: {
                label: `${weekGrowth >= 0 ? '+' : ''}${weekGrowth}% vs ant.`,
                bg: weekGrowth >= 0 ? 'bg-emerald-500/20' : 'bg-red-500/20',
                color: weekGrowth >= 0 ? 'text-emerald-400' : 'text-red-400'
            }
        },
        {
            title: 'Pgtos Atrasados', value: String(overdueCount),
            desc: 'Boletos vencidos hoje', icon: AlertCircle, color: 'text-rose-400', iconColor: 'text-gray-400'
        },
        {
            title: 'Inadimplência', value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalOverdue),
            desc: 'Total em atraso', icon: Percent, color: 'text-rose-400', iconColor: 'text-gray-400'
        },
        {
            title: 'Grad. Próximas', value: initialLoading && !graduations.length ? '...' : String(graduations.length),
            desc: 'Aptos a graduar', icon: Award, color: 'text-white', iconColor: 'text-[#DC143C]'
        },
        {
            title: 'Professores', value: loadingStaff ? '...' : String(staffMembers.filter(s => s.role === 'professor' || s.role === 'admin').length),
            desc: 'Equipe técnica ativa', icon: ShieldCheck, color: 'text-emerald-400', iconColor: 'text-emerald-400'
        },
        {
            title: 'Visitantes', value: isLoadingStudents ? '...' : String(safeStudents.filter(s => s.isVisitor).length),
            desc: 'Participações externas', icon: Users, color: 'text-blue-400', iconColor: 'text-blue-400'
        },
        {
            title: 'Jiu Jitsu', value: isLoadingStudents ? '...' : String(activeMembers.filter(s => s.modality?.includes('Jiu')).length),
            desc: 'Alunos matriculados', icon: IconJiuJitsu, color: 'text-[#DC143C]', iconColor: 'text-[#DC143C]'
        },
        {
            title: 'Boxe', value: isLoadingStudents ? '...' : String(activeMembers.filter(s => s.modality?.includes('Boxe') || s.modality?.includes('box')).length),
            desc: 'Alunos matriculados', icon: IconBoxe, color: 'text-yellow-400', iconColor: 'text-yellow-400'
        },
    ], [isLoadingStudents, activeMembers, newMembers30Days, initialLoading, presentCount, absentList, retentionRate, weekGrowth, graduations, loadingStaff, staffMembers, safeStudents])

    return (
        <>
            {/* Header */}
            <PageHeader
                icon={Activity}
                title="DASHBOARD ACADÊMICO"
                subtitle="GESTÃO DE PERFORMANCE E PRESENÇA"
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

                {/* ── KPIs ───────────────────────────────────────── */}
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

                {/* ── Main chart ─────────────────────────────────── */}
                <div className="glass-card rounded-2xl p-6 border border-white/10 relative overflow-hidden fade-slide-up" style={{ animationDelay: '280ms' }}>
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                        <div>
                            <h2 className="text-lg font-black text-white uppercase tracking-wide">
                                Tendências de Atividade
                            </h2>
                            <p className="text-xs text-gray-500 mt-1">
                                Frequência real do Firestore
                                {weekGrowth !== 0 && (
                                    <span className={`ml-2 font-bold ${weekGrowth > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                        {weekGrowth > 0 ? <TrendingUp size={11} className="inline mr-0.5" /> : <TrendingDown size={11} className="inline mr-0.5" />}
                                        {weekGrowth > 0 ? '+' : ''}{weekGrowth}% vs período anterior
                                    </span>
                                )}
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Toggle: Presença+Faltas */}
                            <button onClick={() => setShowComparison(p => !p)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${showComparison ? 'bg-[#DC143C]/20 border-[#DC143C]/30 text-[#DC143C]' : 'border-white/10 text-gray-500 hover:text-white'}`}>
                                Pres. vs Faltas
                            </button>

                            {/* Period buttons */}
                            <div className="flex items-center gap-1 bg-black/40 rounded-xl p-1 border border-white/5">
                                {['Semana', 'Mês', 'Ano'].map(v => (
                                    <button key={v} onClick={() => setPeriod(v)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${period === v ? 'bg-[#DC143C] text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="h-[260px] w-full">
                        {(initialLoading && (!stats?.chartData || stats.chartData.length === 0)) ? (
                            <div className="h-full flex items-center justify-center">
                                <Skeleton className="w-full h-full" />
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%" minHeight={200}>
                                <AreaChart data={stats?.chartData?.length > 0 ? stats.chartData : fallbackChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gradPresencas" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#DC143C" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#DC143C" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gradFaltas" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 11, fontWeight: 600 }} dy={8} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 10 }} />
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                                    <RechartsTooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                    {showComparison && (
                                        <Area type="monotone" dataKey="faltas" name="Faltas"
                                            stroke="#f97316" strokeWidth={2} strokeDasharray="5 5"
                                            fillOpacity={1} fill="url(#gradFaltas)"
                                            activeDot={{ r: 5, fill: '#f97316', stroke: '#111', strokeWidth: 2 }} />
                                    )}
                                    <Area type="monotone" dataKey="presencas" name="Presenças"
                                        stroke="#DC143C" strokeWidth={3}
                                        fillOpacity={1} fill="url(#gradPresencas)"
                                        activeDot={{ r: 7, fill: '#DC143C', stroke: '#111', strokeWidth: 2 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* ── Bottom split ───────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 fade-slide-up" style={{ animationDelay: '360ms' }}>

                    {/* ── Aulas de Hoje — dados reais via onSnapshot ── */}
                    <div className="glass-card rounded-2xl border border-white/10 overflow-hidden flex flex-col min-h-[360px]">
                        <div className="p-6 border-b border-white/5 bg-[#0a0a0a]/50 flex justify-between items-center">
                            <div className="flex items-center gap-3">
                                <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                                    <CalendarDays size={16} className="text-blue-400" /> Aulas de Hoje
                                </h3>
                            </div>
                            <Link to="/attendance" className="text-[10px] text-gray-500 hover:text-white flex items-center gap-1 transition-colors">
                                Ver tudo <ChevronRight size={12} />
                            </Link>
                        </div>

                        <div className="flex-1 p-5 space-y-3">
                            {loadingTodaySessions ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <Skeleton key={i} className="w-full h-[72px] rounded-xl" />
                                ))
                            ) : todaySessions.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-40 gap-3 text-center">
                                    <CalendarDays size={36} className="text-gray-700" />
                                    <div>
                                        <p className="text-sm font-bold text-gray-500">Nenhuma aula registrada hoje</p>
                                        <p className="text-[11px] text-gray-600 mt-1">Inicie uma chamada na aba Presença</p>
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
                                            onClick={() => setSelectedSession(sess)}>

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
                                                    <p className="text-[10px] text-gray-600">{pctPresente}% de presença</p>
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

                    <div className="flex flex-col gap-5">
                        {/* Próximas Graduações */}
                        <div className="glass-card rounded-2xl border border-white/10 overflow-hidden flex flex-col flex-1">
                            <div className="p-6 border-b border-white/5 bg-[#0a0a0a]/50 flex justify-between items-center">
                                <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
                                    <Award size={16} className="text-[#DC143C]" /> Próximas Graduações
                                </h3>
                                <span className="text-[10px] font-bold">
                                    <span className="text-[#DC143C]">Aptos:</span> {graduations.length}
                                </span>
                            </div>
                            <div className="flex-1 p-5 space-y-3">
                                {isLoadingStudents ? (
                                    Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="w-full h-16 rounded-xl" />)
                                ) : graduations.length === 0 ? (
                                    <p className="text-sm text-gray-500 text-center py-4">Nenhum aluno apto no momento.</p>
                                ) : (
                                    graduations.map((s, i) => (
                                        <div key={i} className="group flex items-center justify-between p-4 rounded-xl stat-card hover:bg-[#DC143C]/5 border border-white/5 hover:border-[#DC143C]/30 cursor-pointer transition-all relative overflow-hidden">
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#DC143C] opacity-0 group-hover:opacity-100 transition-opacity" />
                                            <div className="flex items-center gap-3 pl-2">
                                                <div className="w-9 h-9 rounded-full border border-white/10 flex items-center justify-center font-bold text-gray-400 group-hover:text-[#DC143C] transition-colors shrink-0">
                                                    {s.name?.charAt(0)}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-bold text-white group-hover:text-[#DC143C] transition-colors">{s.name}</p>
                                                    <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-wide">{s.cfg?.label} • {s.stripes || 0}º Grau</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-[10px] font-black text-[#DC143C] bg-[#DC143C]/10 px-2 py-1 rounded-full">Promo Ready</span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Alertas */}
                        <div className="glass-card rounded-2xl border border-[#DC143C]/20 overflow-hidden bg-gradient-to-b from-[#DC143C]/5 to-transparent">
                            <div className="p-4 border-b border-white/5">
                                <h3 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold flex items-center gap-2">
                                    <AlertCircle size={12} className="text-[#DC143C]" /> Alertas de Retenção
                                </h3>
                            </div>
                            <div className="p-4 space-y-3">
                                {absentList.length === 0 ? (
                                    <p className="text-sm text-gray-500 text-center py-2">Nenhum alerta prioritário.</p>
                                ) : (
                                    absentList.slice(0, 3).map((s, i) => (
                                        <div key={i} className="flex gap-3 items-center">
                                            <AlertCircle size={14} className={s.isCritical ? 'text-[#DC143C] shrink-0' : 'text-yellow-400 shrink-0'} />
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-xs font-bold ${s.isCritical ? 'text-[#DC143C]' : 'text-yellow-400'}`}>
                                                    {s.isCritical ? 'Risco de Evasão' : 'Atenção Necessária'}
                                                </p>
                                                <p className="text-sm text-gray-400 truncate">{s.name} — {s.daysAbsent ?? '?'}d sem treino</p>
                                            </div>
                                            {s.phone && (
                                                <a href={`https://wa.me/${s.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                                                    className="text-emerald-400 hover:text-emerald-300 shrink-0">
                                                    <Phone size={14} />
                                                </a>
                                            )}
                                        </div>
                                    ))
                                )}
                                {absentList.length > 3 && (
                                    <button onClick={() => setShowAbsents(true)} className="text-[11px] text-[#DC143C] hover:underline mt-1">
                                        Ver todos os {absentList.length} ausentes →
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── Histórico de Chamada ─────────────────────────────── */}
                {(stats?.sessions || []).length > 0 && (
                    <div className="glass-card rounded-2xl p-6 border border-white/10 fade-slide-up" style={{ animationDelay: '440ms' }}>
                        <h3 className="text-sm font-bold uppercase tracking-widest text-white mb-4 flex items-center gap-2">
                            <BarChart3 size={16} className="text-gray-500" /> Histórico de Chamada
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {(stats.sessions).slice(0, 6).map((s, i) => (
                                <button key={i} onClick={() => setSelectedSession(s)}
                                    className="text-left p-4 rounded-xl bg-white/5 border border-white/5 hover:border-white/15 hover:bg-white/[0.07] transition-all group">
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-sm font-bold text-white group-hover:text-[#DC143C] transition-colors">{s.classTitle || s.title || 'Aula'}</p>
                                        <Eye size={12} className="text-gray-600 group-hover:text-white transition-colors" />
                                    </div>
                                    <p className="text-[10px] text-gray-600 uppercase tracking-widest mb-3">{s.date} {s.time && `• ${s.time}`}</p>
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

            {/* ── Drawers ─────────────────────────────────────── */}
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

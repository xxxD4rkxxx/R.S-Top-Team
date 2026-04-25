import React, { useState } from 'react'
import {
    Award, Users, TrendingUp, Zap, Star, Eye, AlertCircle, MessageCircle
} from 'lucide-react'
import { motion } from 'framer-motion'
import {
    XAxis, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area,
    YAxis, CartesianGrid, BarChart, Bar, Legend
} from 'recharts'
import KPICard from '../../../components/shared/KPICard'
import { beltConfig } from '../../../data/beltConfig'

/**
 * ChartTooltip - DNA Visual do Gestor (Padronização 1:1)
 */
function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null
    return (
        <div className="glass-card p-3 rounded-xl border border-white/10 shadow-2xl bg-[#0a0a0a]/90 backdrop-blur text-xs">
            <p className="text-gray-400 font-bold tracking-wider mb-2">{label}</p>
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

/**
 * IntelligenceSection v4.0 - PREMIUM TEACHER DASHBOARD
 */
export default function IntelligenceSection({ data }) {
    const [period, setPeriod] = useState('semana')
    const [fluxPeriod, setFluxPeriod] = useState('mes')
    const [showComparison, setShowComparison] = useState(true)
    const { allStudentsStats, charts, fluxo, insight, loading, stats, absentStudents = [], graduations = [] } = data

    const [failedPhotos, setFailedPhotos] = useState(new Set())

    const getInitials = (name) => {
        if (!name || typeof name !== 'string') return 'A'
        const clean = name.toLowerCase().trim()
        if (clean === 'undefined' || clean === 'null' || clean.includes('indefin') || clean.includes('undef')) return 'A'
        const parts = name.trim().split(/\s+/)
        if (parts.length >= 2) return (parts[0][0] + (parts[1][0] || '')).toUpperCase()
        return parts[0][0].toUpperCase()
    }

    const getBeltColor = (belt) => {
        const b = belt?.toLowerCase() || 'white'
        const colors = {
            white: '#ffffff',
            grey: '#94a3b8',
            yellow: '#eab308',
            orange: '#f97316',
            green: '#22c55e',
            blue: '#3b82f6',
            purple: '#a855f7',
            brown: '#92400e',
            black: '#18181b',
            none: '#6B7280'
        }
        
        // Mapeamento flexível para nomes em português ou inglês
        if (b.includes('branca')) return colors.white
        if (b.includes('cinza')) return colors.grey
        if (b.includes('amarela')) return colors.yellow
        if (b.includes('laranja')) return colors.orange
        if (b.includes('verde')) return colors.green
        if (b.includes('azul')) return colors.blue
        if (b.includes('roxa')) return colors.purple
        if (b.includes('marrom')) return colors.brown
        if (b.includes('preta')) return colors.black
        
        return colors[b] || colors.white
    }

    if (loading) {
        return (
            <div className="space-y-6 animate-pulse p-4">
                <div className="h-40 bg-white/5 rounded-2xl" />
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                    <div className="lg:col-span-8 h-[500px] bg-white/5 rounded-2xl" />
                    <div className="lg:col-span-4 h-[500px] bg-white/5 rounded-2xl" />
                </div>
            </div>
        )
    }

    // DNA Visual: Skeletons idênticos ao do Gestor para garantir o "peso" visual correto
    const DAYS_ABR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    const MNTHS_ABR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

    const buildFallback = (p) => {
        const now = new Date()
        if (p === 'semana') {
            return Array.from({ length: 7 }, (_, i) => {
                const d = new Date(now)
                d.setDate(now.getDate() - (6 - i))
                return { name: DAYS_ABR[d.getDay()], presencas: 0, faltas: 0, novos: 0, inativos: 0, visitantes: 0 }
            })
        } else if (p === 'mes') {
            const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
            return Array.from({ length: daysInMonth }, (_, i) => ({
                name: String(i + 1).padStart(2, '0'),
                presencas: 0, faltas: 0, novos: 0, inativos: 0, visitantes: 0
            }))
        } else {
            return MNTHS_ABR.map(name => ({
                name, presencas: 0, faltas: 0, novos: 0, inativos: 0, visitantes: 0
            }))
        }
    }

    const fallbackData = buildFallback(period)
    const fallbackFluxo = buildFallback(fluxPeriod)

    const activeChartData = charts?.[period]?.length > 0 ? charts[period] : fallbackData
    const activeFluxoData = fluxo?.[fluxPeriod]?.length > 0 ? fluxo[fluxPeriod] : fallbackFluxo


    const handleWhatsApp = (student, type = 'resgate') => {
        let text = ''
        if (type === 'resgate') {
            text = `Fala ${(student.nome || student.name).split(' ')[0]}! Tudo certo? Notei que você deu uma sumida do tatame ultimamente (${student.daysAbsent} dias). Tá tudo bem? Qualquer coisa que precisar pra voltar aos treinos conta comigo! Oss! 🥋`
        } else {
            text = `Fala ${(student.nome || student.name).split(' ')[0]}! Passando pra parabenizar pela constância nos treinos. Você está com ${student.attendanceRate}% de presença! Continue firme. Oss! 🥋`
        }
        window.open(`https://wa.me/55${student.phone?.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`, '_blank')
    }

    return (
        <div className="space-y-6 pb-20 fade-slide-up">

            {/* ── KPIs (PADRONIZAÇÃO GESTOR) ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 md:gap-5">
                <KPICard
                    title="Alunos Ativos"
                    value={stats.totalStudents}
                    desc="Total sob sua gestão"
                    icon={Users}
                    iconColor="text-white"
                />
                <KPICard
                    title="Freq. Média"
                    value={`${stats.avgAttendance30d}%`}
                    desc="Presença últimos 30d"
                    icon={TrendingUp}
                    iconColor="text-emerald-400"
                    badge={{ label: stats.trend > 0 ? `+${stats.trend}%` : `${stats.trend}%`, bg: 'bg-emerald-500/10', color: 'text-emerald-500' }}
                />
                <KPICard
                    title="Novos (30d)"
                    value={stats.newStudents30d}
                    desc="Crescimento da turma"
                    icon={Star}
                    iconColor="text-blue-400"
                />
                <KPICard
                    title="Ausentes +10D"
                    value={stats.absentCritical}
                    desc="Risco de evasão"
                    icon={Eye}
                    iconColor="text-rose-400"
                    badge={{ label: 'Alerta', bg: 'bg-rose-500/10', color: 'text-rose-500' }}
                />
                <KPICard
                    title="Aulas (30d)"
                    value={stats.sessions30d}
                    desc="Volume de treino"
                    icon={Award}
                    iconColor="text-amber-400"
                />
                <KPICard
                    title="Presenças Hoje"
                    value={stats.todayAttendances}
                    desc="Check-ins realizados"
                    icon={Zap}
                    iconColor="text-yellow-400"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* ── GRÁFICOS (COLUNA ESQUERDA) ── */}
                <div className="lg:col-span-8 space-y-6">

                    {/* 1. Atividade (DNA Gestor 1:1) */}
                    <div className="glass-card rounded-[32px] p-6 border border-white/10 relative overflow-hidden fade-slide-up">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                            <div>
                                <h2 className="text-lg font-black text-white tracking-wide">
                                    Tendências de Atividade
                                </h2>
                                <p className="text-xs text-gray-500 mt-1 tracking-tighter">
                                    Frequência real baseada no Firestore
                                </p>
                            </div>

                            <div className="flex items-center gap-3">
                                {/* Toggle Comparison */}
                                <button onClick={() => setShowComparison(p => !p)}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black border transition-all ${showComparison ? 'bg-[#DC143C]/20 border-[#DC143C]/30 text-[#DC143C]' : 'border-white/10 text-gray-500 hover:text-white'}`}>
                                    Pres. vs Faltas
                                </button>

                                {/* Period buttons */}
                                <div className="flex items-center gap-1 bg-black/40 rounded-xl p-1 border border-white/5">
                                    {['semana', 'mes', 'ano'].map(v => (
                                        <button key={v} onClick={() => setPeriod(v)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${period === v ? 'bg-[#DC143C] text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}>
                                            {v === 'semana' ? 'Semana' : v === 'mes' ? 'Mês' : 'Ano'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="h-[260px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={activeChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
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
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#6B7280', fontSize: 11, fontWeight: 600 }}
                                        dy={8}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#6B7280', fontSize: 10 }}
                                    />
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                                    <RechartsTooltip
                                        content={<ChartTooltip />}
                                        cursor={{ stroke: 'rgba(255,255,255,0.15)', strokeWidth: 1, strokeDasharray: '4 4' }}
                                    />
                                    {showComparison && (
                                        <Area
                                            type="monotone"
                                            dataKey="faltas"
                                            name="Faltas"
                                            stroke="#f97316"
                                            strokeWidth={2}
                                            strokeDasharray="5 5"
                                            fillOpacity={1}
                                            fill="url(#gradFaltas)"
                                            activeDot={{ r: 5, fill: '#f97316', stroke: '#111', strokeWidth: 2 }}
                                        />
                                    )}
                                    <Area
                                        type="monotone"
                                        dataKey="presencas"
                                        name="Presenças"
                                        stroke="#DC143C"
                                        strokeWidth={3}
                                        fillOpacity={1}
                                        fill="url(#gradPresencas)"
                                        activeDot={{ r: 7, fill: '#DC143C', stroke: '#111', strokeWidth: 2 }}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* 2. Fluxo de Alunos (Movimentação) */}
                    <div className="glass-card rounded-[32px] p-6 border border-white/10 fade-slide-up" style={{ animationDelay: '150ms' }}>
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h2 className="text-lg font-black text-white tracking-wide">Movimentação de Alunos</h2>
                                    <p className="text-xs text-gray-500 mt-1 tracking-tighter">Eficiência e retenção da turma</p>
                                </div>

                                <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
                                    {['semana', 'mes', 'ano'].map(v => (
                                        <button
                                            key={v}
                                            onClick={() => setFluxPeriod(v)}
                                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${fluxPeriod === v ? 'bg-[#DC143C] text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                                        >
                                            {v === 'semana' ? 'Semana' : v === 'mes' ? 'Mês' : 'Ano'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="h-[220px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={activeFluxoData} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gradNovos" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gradInativos" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gradVisitantes" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#6B7280', fontSize: 11, fontWeight: 600 }}
                                        dy={8}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#6B7280', fontSize: 10 }}
                                    />
                                    <RechartsTooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }} />
                                    <Area type="monotone" dataKey="novos" name="Novos" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#gradNovos)" />
                                    <Area type="monotone" dataKey="inativos" name="Inativos" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#gradInativos)" strokeDasharray="5 5" />
                                    <Area type="monotone" dataKey="visitantes" name="Visitantes" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#gradVisitantes)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Ranking de Presença */}
                    <div className="glass-card rounded-[32px] border border-white/10 p-6">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <Award className="text-amber-500" size={20} />
                                <h3 className="text-sm font-black text-white tracking-widest uppercase">Ranking de Presença</h3>
                            </div>
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Top 10 Performance</span>
                        </div>

                        <div className="space-y-4">
                            {allStudentsStats.slice(0, 10).map((student, idx) => {
                                const beltColor = getBeltColor(student.belt)

                                return (
                                    <motion.div
                                        key={student.id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className="flex items-center gap-4 group hover:bg-white/[0.02] p-2 -mx-2 rounded-2xl transition-all"
                                    >
                                        {/* Avatar com Estilo Premium (Paridade 1:1 com aba Alunos) */}
                                        <div className="shrink-0 relative">
                                            {student.photo && !failedPhotos.has(student.id) ? (
                                                <div
                                                    className="w-12 h-12 rounded-full overflow-hidden transition-all duration-500 shadow-lg border border-white/5"
                                                >
                                                    <img 
                                                        src={student.photo} 
                                                        alt={student.nome || student.name} 
                                                        className="w-full h-full rounded-full object-cover"
                                                        onError={() => {
                                                            setFailedPhotos(prev => {
                                                                const next = new Set(prev)
                                                                next.add(student.id)
                                                                return next
                                                            })
                                                        }}
                                                    />
                                                </div>
                                            ) : (
                                                <div
                                                    className={`w-12 h-12 rounded-full flex items-center justify-center text-xs font-black text-white transition-all duration-500 shadow-inner relative overflow-hidden ${beltConfig[student.belt?.toLowerCase()]?.bgClass || 'belt-none'}`}
                                                >
                                                    <div className="absolute inset-0 bg-gradient-to-tr from-black/40 to-transparent opacity-50" />
                                                    <span className="relative z-10 drop-shadow-lg">{getInitials(student.nome || student.name)}</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Nome */}
                                        <div className="w-24 md:w-36 shrink-0">
                                            <h4 className="text-[11px] font-black text-white truncate tracking-tight">{student.nome || student.name}</h4>
                                        </div>

                                        {/* Barra de Progresso Centralizada (Estilo Referência) */}
                                        <div className="flex-1 px-2 md:px-6">
                                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/[0.03]">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${student.attendanceRate}%` }}
                                                    transition={{ duration: 1, delay: idx * 0.1 }}
                                                    className="h-full shadow-[0_0_10px_rgba(255,255,255,0.1)] rounded-full"
                                                    style={{ backgroundColor: beltColor }}
                                                />
                                            </div>
                                        </div>

                                        {/* Porcentagem Lateral */}
                                        <div className="w-12 text-right">
                                            <span className="text-[13px] font-black text-white tracking-tighter">
                                                {student.attendanceRate}%
                                            </span>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* ── ALERTAS E STATUS (COLUNA DIREITA) ── */}
                <div className="lg:col-span-4 space-y-6">


                    {/* Saúde Geral Circular */}
                    <div className="glass-card rounded-[32px] border border-white/10 p-8 flex flex-col items-center">
                        <div className="relative w-40 h-40 mb-6">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="80" cy="80" r="72" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-white/[0.03]" />
                                <circle cx="80" cy="80" r="72" stroke="currentColor" strokeWidth="12" fill="transparent" strokeDasharray={452.4} strokeDashoffset={452.4 * (1 - stats.avgAttendance30d / 100)} className="text-emerald-500" strokeLinecap="round" />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-3xl font-black text-white tracking-tighter">{stats.avgAttendance30d}%</span>
                                <span className="text-[8px] text-gray-500 font-black tracking-widest mt-1">Saúde Geral</span>
                            </div>
                        </div>
                        <div className="text-center">
                            <h3 className="text-sm font-black text-white tracking-tight">Tendências de Atividade</h3>
                            <p className="text-[10px] text-gray-500 font-bold">Frequência da turma por período</p>
                        </div>
                    </div>

                    {/* IA Insight Dinâmico */}
                    <div className="bg-gradient-to-br from-[#DC143C]/10 to-transparent rounded-[32px] border border-white/5 p-6 relative overflow-hidden">
                        <Zap size={32} className="absolute -right-2 -top-2 text-white/5" />
                        <h4 className="text-[10px] font-black text-white tracking-widest mb-3 flex items-center gap-2">
                            <Star size={12} fill="currentColor" /> Insight IA
                        </h4>
                        <p className="text-[11px] text-gray-400 font-medium leading-relaxed italic">
                            "{insight || "Mantenha a constância nos treinos para garantir o máximo desempenho técnico e físico da turma."}"
                        </p>
                    </div>

                    {/* Alertas de Retenção (Ação Rápida) */}
                    <div className="glass-card rounded-[32px] border border-[#DC143C]/20 overflow-hidden bg-gradient-to-b from-[#DC143C]/5 to-transparent p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-[10px] uppercase tracking-widest text-gray-400 font-black flex items-center gap-2">
                                <AlertCircle size={14} className="text-[#DC143C]" /> Alunos em Risco
                            </h3>
                            {absentStudents.length > 0 && (
                                <span className="px-2 py-0.5 rounded-full bg-[#DC143C]/20 text-[#DC143C] text-[9px] font-black">
                                    {absentStudents.length} ALERTAS
                                </span>
                            )}
                        </div>
                        
                        <div className="space-y-4">
                            {absentStudents.length === 0 ? (
                                <div className="text-center py-6">
                                    <p className="text-xs text-gray-500 font-medium">Nenhum aluno em risco crítico. Bom trabalho!</p>
                                </div>
                            ) : (
                                absentStudents.slice(0, 5).map((s, i) => (
                                    <div key={i} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black text-white relative overflow-hidden ${beltConfig[s.belt?.toLowerCase()]?.bgClass || 'belt-none'}`}>
                                                <div className="absolute inset-0 bg-black/40" />
                                                <span className="relative z-10">{getInitials(s.name)}</span>
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black text-white leading-none mb-1">{s.name}</p>
                                                <p className="text-[9px] text-rose-500 font-bold uppercase tracking-tighter">
                                                    {s.daysAbsent} dias ausente
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <button 
                                            onClick={() => handleWhatsApp(s, 'resgate')}
                                            className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center hover:bg-emerald-500 hover:text-white transition-all shadow-lg shadow-emerald-500/10"
                                            title="Enviar WhatsApp"
                                        >
                                            <MessageCircle size={14} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                    {/* Próximas Graduações (Recompensa) */}
                    <div className="glass-card rounded-[32px] border border-white/10 overflow-hidden bg-[#0a0a0a]/40 p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-[10px] uppercase tracking-widest text-gray-400 font-black flex items-center gap-2">
                                <Award size={14} className="text-amber-500" /> Próximas Graduações
                            </h3>
                            <span className="text-[9px] font-black text-amber-500 uppercase">Monitoramento</span>
                        </div>
                        
                        <div className="space-y-4">
                            {graduations.length === 0 ? (
                                <p className="text-[11px] text-gray-600 text-center py-4">Nenhum aluno próximo da graduação.</p>
                            ) : (
                                graduations.map((s, i) => (
                                    <div key={i} className="flex items-center justify-between group">
                                        <div className="flex items-center gap-3">
                                            <div className={`w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-[10px] font-black text-gray-400 group-hover:text-amber-500 transition-colors shrink-0`}>
                                                {s.name?.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-[11px] font-black text-white leading-none mb-1 truncate max-w-[120px]">{s.name}</p>
                                                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">
                                                    {s.cfg?.label || 'Iniciante'} • {s.totalAttendances || 0} aulas
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                            <span className="text-[9px] font-black text-amber-500 uppercase">Apto</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

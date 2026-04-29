import React, { useState } from 'react'
import {
    Award, Users, TrendingUp, TrendingDown, Zap, Star, Eye, AlertCircle, MessageCircle, Info, Calendar, Target, ArrowUpRight, ArrowDownRight, Wallet, UserX
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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
 * IntelligenceSection v5.0 - PREMIUM MANAGEMENT INTELLIGENCE
 */
export default function IntelligenceSection({ data, hideKPIs = false, financialData = null }) {
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
        window.open(`https://wa.me/${student.telefone_completo || ('55' + (student.phone || '').replace(/\D/g, ''))}?text=${encodeURIComponent(text)}`, '_blank')
    }

    // Composição da Saúde da Academia
    const healthComposition = [
        { label: 'Frequência', value: stats.avgAttendance30d, color: 'bg-blue-500' },
        { label: 'Retenção', value: 100 - (absentStudents.length > 0 ? (absentStudents.length / stats.totalStudents * 100) : 0), color: 'bg-emerald-500' },
        { label: 'Financeiro', value: financialData ? (100 - (financialData.overdueCount > 0 ? 15 : 0)) : 85, color: 'bg-amber-500' }
    ]

    const globalScore = Math.round(healthComposition.reduce((acc, h) => acc + h.value, 0) / healthComposition.length)

    return (
        <div className="space-y-8 fade-slide-up">

            {/* ── 🧠 ALERTAS INTELIGENTES (Ação Direta) ── */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Alerta de Retenção */}
                <div className="glass-card p-5 rounded-[24px] border border-rose-500/20 bg-rose-500/5 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/20 flex items-center justify-center text-rose-500 shrink-0">
                        <UserX size={20} />
                    </div>
                    <div>
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-rose-400 mb-1">Risco de Evasão</h4>
                        <p className="text-sm font-bold text-white">{stats.absentCritical} alunos sem vir há 7+ dias</p>
                        <button className="text-[10px] text-rose-500 font-black mt-2 uppercase tracking-tighter hover:underline">Ver e agir agora →</button>
                    </div>
                </div>

                {/* Alerta Financeiro */}
                <div className="glass-card p-5 rounded-[24px] border border-amber-500/20 bg-amber-500/5 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                        <Wallet size={20} />
                    </div>
                    <div>
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-amber-400 mb-1">Pendências Financeiras</h4>
                        <p className="text-sm font-bold text-white">{financialData?.overdueCount || 0} pgtos atrasados detectados</p>
                        <button className="text-[10px] text-amber-500 font-black mt-2 uppercase tracking-tighter hover:underline">Ir para cobrança →</button>
                    </div>
                </div>

                {/* Insight de Atividade */}
                <div className="glass-card p-5 rounded-[24px] border border-blue-500/20 bg-blue-500/5 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/20 flex items-center justify-center text-blue-500 shrink-0">
                        <TrendingDown size={20} />
                    </div>
                    <div>
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-blue-400 mb-1">Desempenho Semanal</h4>
                        <p className="text-sm font-bold text-white">Frequência caiu {Math.abs(stats.trend)}% esta semana</p>
                        <p className="text-[10px] text-gray-500 mt-1">Sugerido: Enviar lembrete geral</p>
                    </div>
                </div>
            </div>

            {/* ── KPIs ORIGINAIS (Opcional) ── */}
            {!hideKPIs && (
                <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
                    <KPICard title="Alunos Ativos" value={stats.totalStudents} desc="Total da academia" icon={Users} iconColor="text-white" />
                    <KPICard title="Freq. Média" value={`${stats.avgAttendance30d}%`} desc="Últimos 30 dias" icon={TrendingUp} iconColor="text-emerald-400" />
                    <KPICard title="Novos Alunos" value={stats.newStudents30d} desc="Este mês" icon={Star} iconColor="text-blue-400" />
                    <KPICard title="Presença Hoje" value={stats.todayAttendances} desc="Check-ins realizados" icon={Zap} iconColor="text-yellow-400" />
                    <KPICard title="Aptos Grad." value={graduations.length} desc="Próximas metas" icon={Award} iconColor="text-amber-400" />
                    <KPICard title="Evasão" value={stats.absentCritical} desc="Risco alto" icon={Eye} iconColor="text-rose-400" />
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* ── COLUNA ESQUERDA: ANALYTICS ── */}
                <div className="lg:col-span-8 space-y-8">

                    {/* Gráfico de Atividade Principal */}
                    <div className="glass-card rounded-[32px] p-8 border border-white/10 relative overflow-hidden">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-lg font-black text-white tracking-tight">Atividade do Tatame</h2>
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                </div>
                                <p className="text-xs text-gray-500 mt-1 tracking-tighter">Comparativo de presenças e engajamento</p>
                            </div>

                            <div className="flex items-center gap-2 bg-black/40 p-1 rounded-[14px] border border-white/5">
                                {['semana', 'mes', 'ano'].map(v => (
                                    <button key={v} onClick={() => setPeriod(v)}
                                        className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${period === v ? 'bg-white text-black shadow-lg shadow-white/10' : 'text-gray-500 hover:text-white'}`}>
                                        {v === 'semana' ? 'Semana' : v === 'mes' ? 'Mês' : 'Ano'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="h-[280px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={activeChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gradPres" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 11 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#4b5563', fontSize: 10 }} />
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                    <RechartsTooltip content={<ChartTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
                                    <Area type="monotone" dataKey="presencas" name="Presenças" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#gradPres)" activeDot={{ r: 6, fill: '#3b82f6' }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Ranking de Presença Melhorado */}
                    <div className="glass-card rounded-[32px] border border-white/10 p-8">
                        <div className="flex items-center justify-between mb-8">
                            <div>
                                <h3 className="text-sm font-black text-white tracking-widest uppercase flex items-center gap-2">
                                    <Award className="text-amber-500" size={18} /> Ranking de Performance
                                </h3>
                                <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-tighter">Engajamento dos últimos 30 dias</p>
                            </div>
                            <span className="text-[10px] font-black text-gray-600 bg-white/5 px-3 py-1 rounded-full uppercase tracking-widest">Top Performance</span>
                        </div>

                        <div className="space-y-5">
                            {allStudentsStats.slice(0, 5).map((student, idx) => {
                                const beltColor = getBeltColor(student.belt)
                                const isImproving = (student.attendanceRate || 0) > 75
                                
                                return (
                                    <div key={student.id} className="flex items-center gap-5 group">
                                        {/* Rank Number */}
                                        <div className="w-5 text-center text-xs font-black text-gray-600">{idx + 1}</div>

                                        {/* Avatar */}
                                        <div className="shrink-0 relative">
                                            {student.photo && !failedPhotos.has(student.id) ? (
                                                <img src={student.photo} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-white/5 group-hover:scale-105 transition-transform" onError={() => setFailedPhotos(prev => new Set([...prev, student.id]))} />
                                            ) : (
                                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xs font-black text-white border-2 border-white/5 ${beltConfig[student.belt?.toLowerCase()]?.bgClass || 'belt-none'}`}>
                                                    {getInitials(student.nome || student.name)}
                                                </div>
                                            )}
                                            {isImproving ? (
                                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-4 border-[#0a0a0a] flex items-center justify-center text-white">
                                                    <TrendingUp size={8} />
                                                </div>
                                            ) : (
                                                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-amber-500 rounded-full border-4 border-[#0a0a0a] flex items-center justify-center text-white">
                                                    <TrendingDown size={8} />
                                                </div>
                                            )}
                                        </div>

                                        {/* Name & Metadata */}
                                        <div className="flex-1 min-w-0">
                                            <h4 className="text-sm font-bold text-white truncate tracking-tight">{student.nome || student.name}</h4>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                                    <Calendar size={10} /> Última: {student.lastAttendance || '---'}
                                                </span>
                                                <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${isImproving ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>
                                                    {isImproving ? 'Constante' : 'Instável'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Progress Bar & Score */}
                                        <div className="hidden md:block w-32 px-4">
                                            <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${student.attendanceRate}%`, backgroundColor: beltColor }} />
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <p className="text-sm font-black text-white">{student.attendanceRate}%</p>
                                            <p className="text-[9px] text-gray-600 font-bold uppercase tracking-tighter">Freq. 30d</p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>

                {/* ── COLUNA DIREITA: SAÚDE E ALERTAS ── */}
                <div className="lg:col-span-4 space-y-8">

                    {/* 🏥 SAÚDE DA ACADEMIA */}
                    <div className="glass-card rounded-[32px] border border-white/10 p-8 flex flex-col items-center relative overflow-hidden">
                        <div className="absolute top-4 right-4 group">
                            <Info size={14} className="text-gray-600 hover:text-white transition-colors cursor-help" />
                            <div className="absolute right-0 top-6 w-48 p-3 rounded-xl bg-black/90 border border-white/10 text-[10px] text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity z-20 backdrop-blur pointer-events-none">
                                <p className="font-bold text-white mb-1">O que é a Saúde?</p>
                                Média ponderada entre Frequência dos alunos, Retenção (baixa evasão) e Saúde Financeira da academia.
                            </div>
                        </div>

                        <div className="relative w-44 h-44 mb-8">
                            <svg className="w-full h-full transform -rotate-90">
                                <circle cx="88" cy="88" r="78" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-white/[0.03]" />
                                <circle 
                                    cx="88" cy="88" r="78" stroke="currentColor" strokeWidth="12" fill="transparent" 
                                    strokeDasharray={490} 
                                    strokeDashoffset={490 * (1 - globalScore / 100)} 
                                    className={globalScore > 80 ? 'text-emerald-500' : globalScore > 60 ? 'text-blue-500' : 'text-rose-500'} 
                                    strokeLinecap="round" 
                                />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-4xl font-black text-white tracking-tighter">{globalScore}%</span>
                                <span className="text-[9px] text-gray-500 font-black tracking-widest uppercase mt-1">Score Global</span>
                            </div>
                        </div>

                        <div className="w-full space-y-4">
                            <h3 className="text-[11px] font-black text-white tracking-widest uppercase mb-4 text-center">Saúde da Academia</h3>
                            {healthComposition.map((item, i) => (
                                <div key={i} className="space-y-1.5">
                                    <div className="flex justify-between text-[10px] font-black uppercase tracking-tighter">
                                        <span className="text-gray-500">{item.label}</span>
                                        <span className="text-white">{Math.round(item.value)}%</span>
                                    </div>
                                    <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div className={`h-full ${item.color} rounded-full transition-all duration-1000`} style={{ width: `${item.value}%` }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Ações Rápidas de Resgate */}
                    <div className="glass-card rounded-[32px] border border-white/10 p-6 bg-gradient-to-br from-white/[0.02] to-transparent">
                        <h3 className="text-[10px] uppercase tracking-widest text-gray-500 font-black mb-6 flex items-center gap-2">
                            <Target size={14} className="text-blue-500" /> Resgate de Alunos
                        </h3>
                        
                        <div className="space-y-5">
                            {absentStudents.length === 0 ? (
                                <div className="text-center py-10 opacity-50">
                                    <p className="text-xs font-medium">Nenhum aluno ausente.</p>
                                </div>
                            ) : absentStudents.slice(0, 4).map((s, i) => (
                                <div key={i} className="flex items-center justify-between group">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-black text-white border border-white/5 ${beltConfig[s.belt?.toLowerCase()]?.bgClass || 'belt-none'}`}>
                                            {getInitials(s.name)}
                                        </div>
                                        <div>
                                            <p className="text-[11px] font-black text-white leading-none mb-1">{s.name}</p>
                                            <p className="text-[10px] text-rose-500 font-bold tracking-tighter flex items-center gap-1">
                                                <AlertCircle size={10} /> {s.daysAbsent}d ausente
                                            </p>
                                        </div>
                                    </div>
                                    
                                    <button 
                                        onClick={() => handleWhatsApp(s, 'resgate')}
                                        className="w-9 h-9 rounded-xl bg-[#25D366]/10 text-[#25D366] flex items-center justify-center hover:bg-[#25D366] hover:text-white transition-all shadow-lg shadow-[#25D366]/10 active:scale-95"
                                    >
                                        <MessageCircle size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button className="w-full mt-8 py-3 rounded-2xl bg-white text-black text-xs font-black uppercase tracking-widest hover:bg-white/90 transition-all shadow-xl shadow-white/5">
                            Ver todos ausentes
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}


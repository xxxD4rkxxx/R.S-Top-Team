/**
 * ReportsPage.jsx
 * Decision Intelligence System v9.0 — Foco total em Seleção de Período
 */

import React, { useMemo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  BarChart3, ArrowUpCircle, ArrowDownCircle,
  Wallet, TrendingUp, PieChart as PieChartIcon,
  AlertCircle, Activity, Target, ChevronDown, RefreshCcw,
  Info, Calendar, ArrowRight, Users
} from 'lucide-react'
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Sector, Tooltip as ReTooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid 
} from 'recharts'

import PageHeader    from '../../components/shared/PageHeader'
import MobileHeader  from '../../components/navigation/MobileHeader'
import KPICard       from '../../components/shared/KPICard'
import { useFinance } from '../../hooks/useFinance'
import { useStudents } from '../../hooks/useStudents'

const R$ = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)
const PIE_COLORS = ['B794F4', 'F687B3', '4FD1C5', 'F6AD55', 'FC8181', '63B3ED', 'A0AEC0']
const getMonthName = (m) => ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][m]

const renderActiveShape = (props) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props
  return (
    <Sector cx={cx} cy={cy} innerRadius={innerRadius} outerRadius={outerRadius + 6} startAngle={startAngle} endAngle={endAngle} fill={fill} stroke="none" style={{ filter: `drop-shadow(0 0 12px ${fill}55)` }} />
  )
}

function Section({ title, icon: Icon, color = 'text-gray-400', children }) {
  return (
    <div className="bg-[#0B0B0D]/80 backdrop-blur-md rounded-[32px] border border-white/5 overflow-hidden shadow-2xl relative flex flex-col min-h-[140px]">
      <div className="px-6 py-5 border-b border-white/5 bg-white/[0.015] flex items-center gap-3 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center shrink-0"><Icon size={16} className={color} /></div>
        <h4 className="text-xs font-black text-white uppercase tracking-[0.2em]">{title}</h4>
      </div>
      <div className="p-6 md:p-8 flex flex-col h-full overflow-hidden">{children}</div>
    </div>
  )
}

function HealthCard({ title, value, status, meta, explanation }) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const iconRef = useRef(null)
  const statusConfig = { 'SAUDÁVEL': 'bg-emerald-500 text-black', 'ALTO': 'bg-emerald-500 text-black', 'ESTÁVEL': 'bg-blue-500 text-white', 'NORMAL': 'bg-blue-500 text-white', 'ATENÇÃO': 'bg-orange-500 text-white', 'AVISO': 'bg-orange-500 text-white', 'BAIXO': 'bg-orange-500 text-white', 'CRÍTICO': 'bg-rose-500 text-white' }
  const handleMouseEnter = () => { if (iconRef.current) { const rect = iconRef.current.getBoundingClientRect(); setCoords({ x: rect.left + rect.width/2, y: rect.top - 12 }); setShowTooltip(true); } }
  return (
    <div className="glass-card flex flex-col p-5 sm:p-6 transition-all hover:scale-[1.02] cursor-default border border-white/5 relative h-full min-w-[200px]">
      <div className="flex items-start justify-between mb-4 w-full"><span className="text-[10px] sm:text-[11px] font-black text-gray-500 uppercase tracking-widest leading-tight max-w-[85%]">{title}</span><div ref={iconRef} onMouseEnter={handleMouseEnter} onMouseLeave={() => setShowTooltip(false)} className="relative cursor-help shrink-0 ml-1"><Info size={14} className="text-gray-600 hover:text-gray-400 transition-colors" /></div></div>
      <div className="mb-4"><p className="text-xl sm:text-2xl font-black text-white tracking-tighter break-all">{value}</p></div>
      <div className="mt-auto space-y-3"><div><span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${statusConfig[status] || 'bg-white/10 text-gray-400'}`}>{status}</span></div><p className="text-[9px] sm:text-[10px] text-gray-600 font-bold leading-relaxed uppercase tracking-widest">{meta}</p></div>
      {showTooltip && createPortal(<div style={{ left: `${coords.x}px`, top: `${coords.y}px`, transform: 'translate(-50%, -100%)' }} className="fixed z-[9999] w-64 p-4 bg-[#0A0A0B] backdrop-blur-2xl border border-white/10 rounded-2xl shadow-2xl animate-in fade-in duration-200"><p className="text-[11px] text-gray-200 font-medium uppercase tracking-wide leading-relaxed">{explanation}</p><div className="absolute top-full left-1/2 -translate-x-1/2 w-3 h-3 bg-[#0A0A0B] border-r border-b border-white/10 rotate-45 -translate-y-[7px]" /></div>, document.body)}
    </div>
  )
}

export default function ReportsPage() {
  const { bills, expenses } = useFinance()
  const { students } = useStudents()
  const [activePieIndex, setActivePieIndex] = useState(-1)

  const now = new Date()
  const [startDate, setStartDate] = useState(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])

  const toDisplay = (v) => v ? v.split('-').reverse().join('/') : ""
  const toInternal = (v) => { const p = v.split('/'); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : null }
  const [startInput, setStartInput] = useState(toDisplay(startDate))
  const [endInput, setEndInput] = useState(toDisplay(endDate))
  useEffect(() => { setStartInput(toDisplay(startDate)) }, [startDate])
  useEffect(() => { setEndInput(toDisplay(endDate)) }, [endDate])
  const handleMask = (val, setter) => {
    const clean = val.replace(/\D/g, '').slice(0, 8)
    let f = clean
    if (clean.length > 2) f = clean.slice(0, 2) + '/' + clean.slice(2)
    if (clean.length > 4) f = f.slice(0, 5) + '/' + f.slice(5)
    if (clean.length === 8) { const internal = toInternal(f); if (internal) setter(internal); }
    return f
  }
  const setPreset = (type) => {
    const today = new Date().toISOString().split('T')[0]
    let start = today
    if (type === 'mes') start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
    if (type === 'ano') start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0]
    if (type === 'tudo') start = '2024-01-01'
    setStartDate(start); setEndDate(today)
  }

  const d = useMemo(() => {
    const isWithin = (dStr) => dStr && dStr >= startDate && dStr <= endDate
    const fBills = bills.filter(b => isWithin(b.dueDate))
    const fExp = expenses.filter(e => isWithin(e.dueDate))
    const recPaga = fBills.filter(b => b.status === 'paid').reduce((s, b) => s + (Number(b.amount) || 0), 0)
    const recTotal = fBills.reduce((s, b) => s + (Number(b.amount) || 0), 0)
    const despPaga = fExp.filter(e => e.status === 'paid').reduce((s, e) => s + (Number(e.amount) || 0), 0)
    const despTotal = fExp.reduce((s, e) => s + (Number(e.amount) || 0), 0)
    const ebitda = recTotal - despTotal
    const margem = recTotal > 0 ? ((recTotal - despTotal) / recTotal) * 100 : 0
    const alunosAtivosCount = students.filter(s => s.status === 'Ativo').length
    const ticket = alunosAtivosCount > 0 ? recPaga / alunosAtivosCount : 0
    const evolution = []
    for (let i = 5; i >= 0; i--) {
        const m = new Date(now.getFullYear(), now.getMonth() - i, 1)
        const s = m.toISOString().split('T')[0].substring(0, 7)
        evolution.push({ name: getMonthName(m.getMonth()), receita: bills.filter(b => b.dueDate?.startsWith(s)).reduce((v, b) => v + (Number(b.amount) || 0), 0), despesa: expenses.filter(e => e.dueDate?.startsWith(s)).reduce((v, e) => v + (Number(e.amount) || 0), 0) })
    }
    const catMap = fExp.reduce((acc, e) => { const c = e.category || 'Outros'; acc[c] = (acc[c] || 0) + (Number(e.amount) || 0); return acc; }, {})
    const ranked = Object.entries(catMap).sort((a,b) => b[1]-a[1]).map(([cat, val]) => ({ cat, val }))
    return { recPaga, recTotal, despPaga, despTotal, ebitda, margem, alunosAtivosCount, ticket, evolution, ranked }
  }, [bills, expenses, students, startDate, endDate])

  const metrics = [
    { title: 'Liquidez Corrente', value: `${(d.despTotal > 0 ? d.recTotal / d.despTotal : 1.5).toFixed(2)}x`, status: (d.recTotal / (d.despTotal || 1)) > 1.2 ? 'SAUDÁVEL' : 'AVISO', meta: 'Alvo: 1.5x', explanation: 'Capacidade de cobrir dívidas.' },
    { title: 'Capital de Giro', value: R$(d.recPaga - d.despPaga), status: (d.recPaga - d.despPaga) > 0 ? 'ESTÁVEL' : 'CRÍTICO', meta: 'Saldo em Mão', explanation: 'Dinheiro disponível pós-pagamentos.' },
    { title: 'EBITDA Operacional', value: R$(d.ebitda), status: d.ebitda >= 0 ? 'ALTO' : 'CRÍTICO', meta: 'Performance', explanation: 'Lucro operacional bruto.' },
    { title: 'Ponto Equilíbrio', value: R$(d.despTotal), status: 'NORMAL', meta: 'Meta Mensal', explanation: 'Total de custos a cobrir.' },
    { title: 'LTV Projetado', value: R$(d.ticket * 6), status: 'ESTÁVEL', meta: 'Ticket x 6m', explanation: 'Projeção de valor por aluno.' },
  ]

  return (
    <div className="flex flex-col flex-1 w-full min-w-0 bg-[#050505] min-h-screen">
      <MobileHeader title="Relatórios" />
      <PageHeader icon={BarChart3} title="INTELIGÊNCIA DE NEGÓCIO" subtitle="PAINEL GERENCIAL DINÂMICO" />

      <div className="px-4 md:px-6 py-6 pb-32 fade-slide-up space-y-6 w-full max-w-[1600px] mx-auto flex-1">
        
        {/* SELETOR DE PERÍODO — FOCO TOTAL */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 bg-[#0B0B0D]/80 backdrop-blur-xl p-8 rounded-[40px] border border-white/5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
            <div className="flex items-center gap-5">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 text-primary shadow-inner"><Calendar size={26} /></div>
                <div><h2 className="text-base font-black text-white uppercase tracking-[0.3em] leading-none mb-2">Selecione o Período</h2><p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">Monitorando de {toDisplay(startDate)} até {toDisplay(endDate)} <Activity size={10} className="text-primary animate-pulse" /></p></div>
            </div>

            <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
                <div className="flex items-center bg-black/60 p-1.5 rounded-2xl border border-white/5 shadow-inner">
                    {[ { id: 'mes', label: 'Mês Atual' }, { id: 'ano', label: 'Ano 2026' }, { id: 'tudo', label: 'Desde 2024' } ].map(p => (
                        <button key={p.id} onClick={() => setPreset(p.id)} className="px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest text-gray-500 hover:text-white hover:bg-white/5 transition-all">{p.label}</button>
                    ))}
                </div>
                <div className="flex items-center gap-3 bg-black/60 p-2 rounded-2xl border border-white/5 flex-1 lg:flex-none">
                    <input type="text" value={startInput} onChange={e => setStartInput(handleMask(e.target.value, setStartDate))} placeholder="DE" className="w-28 bg-white/5 border border-white/5 text-[12px] font-black text-white px-4 py-2.5 rounded-xl transition-all outline-none text-center focus:border-primary/40" />
                    <ArrowRight size={14} className="text-primary opacity-60" />
                    <input type="text" value={endInput} onChange={e => setEndInput(handleMask(e.target.value, setEndDate))} placeholder="ATÉ" className="w-28 bg-white/5 border border-white/5 text-[12px] font-black text-white px-4 py-2.5 rounded-xl transition-all outline-none text-center focus:border-primary/40" />
                </div>
            </div>
        </div>

        {/* KPIs SCOREBOARD */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5">
          <KPICard title="FATURAMENTO" value={R$(d.recTotal)} description="Total cobrado no período" icon={ArrowUpCircle} valueColor="text-emerald-400" />
          <KPICard title="CAIXA REAL" value={R$(d.recPaga)} description="Valor efetivo recebido" icon={Wallet} valueColor="text-blue-400" />
          <KPICard title="MARGEM" value={`${d.margem.toFixed(1)}%`} description="Lucratividade bruta" icon={Target} valueColor="text-primary" />
          <KPICard title="EBITDA" value={R$(d.ebitda)} description="Ganhos operacionais" icon={Activity} valueColor={d.ebitda >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
          <KPICard title="DESPESAS" value={R$(d.despTotal)} description="Custo total planejado" icon={ArrowDownCircle} valueColor="text-rose-400" />
          
          <KPICard title="TICKET MÉDIO" value={R$(d.ticket)} description="Receita / Aluno Ativo" icon={Info} valueColor="text-gray-300" />
          <KPICard title="INADIMPLÊNCIA" value={`${(((d.recTotal - d.recPaga) / (d.recTotal || 1)) * 100).toFixed(1)}%`} description="Valor em aberto" icon={AlertCircle} valueColor="text-orange-400" />
          <KPICard title="ALUNOS ATIVOS" value={d.alunosAtivosCount} description="Base cadastrada" icon={Users} valueColor="text-indigo-400" />
          <KPICard title="LTV 6M" value={R$(d.ticket * 6)} description="Valor projetado por aluno" icon={TrendingUp} valueColor="text-amber-400" />
          <KPICard title="SALDO LÍQUIDO" value={R$(d.recPaga - d.despPaga)} description="Disponível agora" icon={Wallet} valueColor={(d.recPaga - d.despPaga) >= 0 ? 'text-emerald-400' : 'text-rose-400'} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2"><Section title="Tendência de Mercado" icon={Activity} color="text-amber-400"><div className="h-[320px] w-full mt-4"><ResponsiveContainer width="100%" height="100%"><AreaChart data={d.evolution}><defs><linearGradient id="cR" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10B981" stopOpacity={0}/></linearGradient><linearGradient id="cD" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#F43F5E" stopOpacity={0.3}/><stop offset="95%" stopColor="#F43F5E" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#4A5568', fontSize: 10, fontWeight: 900}} dy={10} /><YAxis hide /><ReTooltip contentStyle={{backgroundColor: '#0A0A0B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', fontSize: '10px'}} /><Area type="monotone" dataKey="receita" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#cR)" name="Receita" /><Area type="monotone" dataKey="despesa" stroke="#F43F5E" strokeWidth={3} fillOpacity={1} fill="url(#cD)" name="Despesa" /></AreaChart></ResponsiveContainer></div></Section></div>
            <div className="flex flex-col gap-6">
                <Section title="Vetor de Arrecadação" icon={BarChart3} color="text-blue-400">
                    <div className="space-y-8 pt-4">
                      <div><div className="flex justify-between text-[10px] font-black uppercase mb-3"><span className="text-gray-400 tracking-wider">Eficiência de Cobrança</span><span className="text-emerald-400">{((d.recPaga / (d.recTotal || 1)) * 100).toFixed(0)}%</span></div><div className="h-3 bg-black/40 rounded-full border border-white/5 overflow-hidden"><div className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all duration-1000" style={{ width: `${(d.recPaga / Math.max(d.recTotal, 1)) * 100}%` }} /></div></div>
                      <div><div className="flex justify-between text-[10px] font-black uppercase mb-3"><span className="text-gray-400 tracking-wider">Execução de Despesas</span><span className="text-rose-400">{((d.despPaga / (d.despTotal || 1)) * 100).toFixed(0)}%</span></div><div className="h-3 bg-black/40 rounded-full border border-white/5 overflow-hidden"><div className="h-full bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)] transition-all duration-1000" style={{ width: `${(d.despPaga / Math.max(d.despTotal, 1)) * 100}%` }} /></div></div>
                    </div>
                </Section>
                <div className="glass-card p-6 border border-white/5 rounded-[32px] bg-primary/5 flex flex-col justify-center items-center text-center gap-2">
                    <Activity className="text-primary mb-2" size={32} />
                    <h3 className="text-lg font-black text-white tracking-widest uppercase">Saúde Financeira</h3>
                    <p className="text-[10px] font-bold text-gray-500 uppercase">Sistema operando em modo de decisão</p>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-24">
          <Section title="Mix de Custos" icon={PieChartIcon} color="text-pink-400">
            <div className="flex flex-col md:flex-row h-full gap-8 items-center py-4">
              <div className="w-[200px] h-[200px] shrink-0"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={d.ranked} cx="50%" cy="50%" innerRadius={0} outerRadius={85} dataKey="val" nameKey="cat" stroke="none" activeIndex={activePieIndex} activeShape={renderActiveShape} onMouseEnter={(_, i) => setActivePieIndex(i)} onMouseLeave={() => setActivePieIndex(-1)} labelLine={false} isAnimationActive={false} label={({ percent }) => `${(percent * 100).toFixed(0)}%`}>{d.ranked.map((_, i) => <Cell key={i} fill={`#${PIE_COLORS[i % PIE_COLORS.length]}`} />)}</Pie></PieChart></ResponsiveContainer></div>
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3 w-full">
                {d.ranked.map((item, i) => (
                  <div key={i} className={`flex items-center justify-between transition-all ${activePieIndex === i ? 'opacity-100 scale-105' : 'opacity-50 grayscale'}`} onMouseEnter={() => setActivePieIndex(i)}>
                    <div className="flex items-center gap-3 overflow-hidden"><div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: `#${PIE_COLORS[i % PIE_COLORS.length]}` }} /><span className="text-[10px] font-black text-white uppercase truncate">{item.cat}</span></div>
                    <span className="text-[10px] font-black text-gray-400 shrink-0">{R$(item.val)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Section>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4">
            {metrics.map((m, idx) => <HealthCard key={idx} {...m} />)}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes fadeSlideUp { from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)} }
        .fade-slide-up { animation: fadeSlideUp 0.5s cubic-bezier(0.16,1,0.3,1) forwards; }
      `}</style>
    </div>
  )
}

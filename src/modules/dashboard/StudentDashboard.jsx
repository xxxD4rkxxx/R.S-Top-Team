import React, { useState, useMemo } from 'react'
import { 
  Trophy, Medal, Target, Calendar, Clock, TrendingUp, 
  ChevronRight, Star, Zap, Bell, AlertCircle, History,
  Activity, Sparkles, Check, LayoutDashboard, DollarSign, 
  Wallet, ArrowUpRight, ShieldCheck, CalendarDays
} from 'lucide-react'
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts'
import { useModalities } from '../../hooks/useModalities'
import QuickStartGuide from './components/QuickStartGuide'
import { motion, AnimatePresence } from 'framer-motion'
import { useStudentAttendance } from '../../hooks/useStudentAttendance'
import { useNotices } from '../../hooks/useNotices'
import { useTodaySessions } from '../../hooks/useTodaySessions'
import { beltConfig as defaultBelts } from '../../data/beltConfig'
import { attendanceService } from '../../services/attendanceService'
import PageHeader from '../../components/shared/PageHeader'
import MobileHeader from '../../components/navigation/MobileHeader'
import { calculateModalityValue } from '../../utils/billingUtils'

/**
 * DASHBOARD PREMIUM DO ALUNO (Academy 2)
 * Interface focada em gamificação, progressão e transparência.
 */

// --- Componentes Atômicos de UI ---

const RADIUS_MAIN = 'rounded-[32px]'
const RADIUS_CARD = 'rounded-[20px]'

const StatCard = ({ title, value, detail, icon: Icon, color, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
    className={`relative overflow-hidden glass-card p-5 bg-white/[0.03] border border-white/5 ${RADIUS_CARD} group cursor-default h-full min-h-[140px] flex flex-col`}
  >
    <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-[40px] opacity-10 transition-opacity group-hover:opacity-20 pointer-events-none`} style={{ background: color }} />
    
    <div className="relative z-10 flex flex-col h-full uppercase">
      {/* Top: Icon & Title */}
      <div className="flex items-center gap-3 mb-2">
        <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-primary transition-transform group-hover:scale-110 duration-500 shrink-0">
          <Icon size={18} />
        </div>
        <span className="text-[10px] font-black tracking-[0.15em] text-gray-500 leading-tight break-words overflow-hidden">
          {title}
        </span>
      </div>

      {/* Middle: Centered Value */}
      <div className="flex-1 flex flex-col justify-center py-2">
        <h3 className="text-4xl font-black text-white tracking-tighter leading-none">
          {value}
        </h3>
      </div>

      {/* Bottom: Detail text at the base */}
      <p className="text-[9px] font-bold text-gray-600 tracking-[0.1em] leading-tight opacity-70">
        {detail}
      </p>
    </div>
  </motion.div>
)

const PaymentStatCard = ({ info, delay = 0 }) => {
  const { amount, status, changeType, dueDate } = info;
  
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const statusConfig = {
    pago: { icon: Check, color: '#10b981', label: 'Pago', desc: 'Mensalidade em dia' },
    pendente: { icon: Clock, color: '#f59e0b', label: 'Pendente', desc: dueDate ? `Vence: ${formatDate(dueDate)}` : 'Fatura atual' },
    vencido: { icon: AlertCircle, color: '#f43f5e', label: 'Atrasado', desc: dueDate ? `Venceu: ${formatDate(dueDate)}` : 'Fatura atual' }
  };

  const current = statusConfig[status] || statusConfig.pago;
  const Icon = current.icon;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden glass-card p-5 bg-white/[0.03] border border-white/5 rounded-[32px] group cursor-default h-full min-h-[140px] flex flex-col`}
    >
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full blur-[40px] opacity-10 transition-opacity group-hover:opacity-20 pointer-events-none`} style={{ background: current.color }} />

      <div className="relative z-10 flex flex-col h-full uppercase">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-white/5 border border-white/10 transition-transform group-hover:scale-110 duration-500 shrink-0" style={{ color: current.color }}>
              <Icon size={18} />
            </div>
            <span className="text-[10px] font-black tracking-[0.15em] text-gray-500 leading-tight break-words overflow-hidden">
              {current.label}
            </span>
          </div>
          
          {changeType !== 'none' && (
            <div className="flex items-center gap-0.5 text-[8px] font-black tracking-tighter px-1.5 py-0.5 rounded-full bg-white/5 shadow-lg shadow-black/50">
               <ArrowUpRight size={8} className={changeType === 'increase' ? 'text-rose-400' : 'text-emerald-400 transform rotate-90'} />
               <span className={changeType === 'increase' ? 'text-rose-400' : 'text-emerald-400'}>
                 {changeType === 'increase' ? 'REAJUSTE' : 'REDUÇÃO'}
               </span>
            </div>
          )}
        </div>

        <div className="flex-1 flex flex-col justify-center py-2">
          <h3 className="text-4xl font-black text-white tracking-tighter leading-none">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(amount)}
          </h3>
        </div>

        {status === 'pago' ? (
          <p className="text-[9px] font-bold text-gray-600 tracking-[0.1em] leading-tight opacity-70">
            {current.desc}
          </p>
        ) : (
          <button className="mt-auto w-full py-2 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 text-[9px] font-black tracking-[0.15em] transition-colors cursor-pointer active:scale-95 flex items-center justify-center gap-2">
            <Wallet size={10} /> Pagar Mensalidade
          </button>
        )}
      </div>
    </motion.div>
  );
};


// ChartTooltip customizado (mesmo do IntelligenceSection)
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


export default function StudentDashboard({ user, cobrancas = [] }) {
  const { total: hookTotal, monthly, weekly, streak, recent, loading: loadingAttendance } = useStudentAttendance(user?.id)

  // Sincronizar com dados do documento do usuário (Source of Truth)
  const total = user?.total_visitas || hookTotal || 0
  const { notices, userViews = new Set(), loading: loadingNotices, markAsViewed } = useNotices(user?.id)
  const { sessions, loading: loadingSessions } = useTodaySessions()
  const { modalities, loading: loadingModalities } = useModalities()
  const [syncing, setSyncing] = useState(false)

  const handleSync = async () => {
    if (!window.confirm('Deseja sincronizar o histórico global de presenças? Isso pode levar alguns segundos.')) return
    
    setSyncing(true)
    try {
      const count = await attendanceService.syncAttendanceHistory()
      alert(`✅ Sucesso! ${count} registros de presença foram sincronizados.`)
      window.location.reload()
    } catch (error) {
      console.error('Erro ao sincronizar:', error)
      alert('Erro ao sincronizar histórico. Verifique o console.')
    } finally {
      setSyncing(false)
    }
  }

  // Filtro de cobranças pendentes
  const pendingBills = useMemo(() => 
    cobrancas.filter(b => b.status === 'pending' || b.status === 'overdue'),
  [cobrancas])

  // Dados do gráfico de presença
  const [period, setPeriod] = useState('ano')
  
  const attendanceChartData = useMemo(() => {
    const now = new Date()
    const currentYear = now.getFullYear()
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    
    if (period === 'mes') {
      // Dados por dia do mês atual
      const currentMonth = now.getMonth()
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate()
      const dataMap = {}

      for (let d = 1; d <= daysInMonth; d++) {
        dataMap[d] = { name: d.toString().padStart(2, '0'), presencas: 0, faltas: 0 }
      }

      if (recent && recent.length > 0) {
        recent.forEach(log => {
          let date = null
          if (log.parsedDate) {
            date = log.parsedDate instanceof Date ? log.parsedDate : new Date(log.parsedDate)
          } else if (log.date) {
            date = new Date(log.date + 'T12:00:00')
          } else if (log.data) {
            date = new Date(log.data + 'T12:00:00')
          }
          
          if (date && !isNaN(date.getTime())) {
            if (date.getFullYear() === currentYear && date.getMonth() === currentMonth) {
              const day = date.getDate()
              if (dataMap[day]) {
                if (log.status === 'present' || log.status === 'presente' || !log.status) {
                  dataMap[day].presencas += 1
                } else if (log.status === 'absent' || log.status === 'ausente') {
                  dataMap[day].faltas += 1
                }
              }
            }
          }
        })
      }
      return Object.values(dataMap)
    } else {
      // Dados por mês do ano atual
      const dataMap = {}
      for (let m = 0; m < 12; m++) {
        dataMap[m] = { name: months[m], presencas: 0, faltas: 0 }
      }

      if (recent && recent.length > 0) {
        recent.forEach(log => {
          let date = null
          if (log.parsedDate) {
            date = log.parsedDate instanceof Date ? log.parsedDate : new Date(log.parsedDate)
          } else if (log.date) {
            date = new Date(log.date + 'T12:00:00')
          } else if (log.data) {
            date = new Date(log.data + 'T12:00:00')
          }
          
          if (date && !isNaN(date.getTime())) {
            if (date.getFullYear() === currentYear && dataMap[date.getMonth()]) {
              if (log.status === 'present' || log.status === 'presente' || !log.status) {
                dataMap[date.getMonth()].presencas += 1
              } else if (log.status === 'absent' || log.status === 'ausente') {
                dataMap[date.getMonth()].faltas += 1
              }
            }
          }
        })
      }
      return Object.values(dataMap)
    }
  }, [recent, period])

  // Configuração da Faixa Atual
  const beltInfo = defaultBelts[user?.belt?.toLowerCase()] || defaultBelts.white
  const beltColor = user?.belt?.toLowerCase() || ''
  const isWhiteBelt = beltColor === 'white' || beltColor === 'branca' || beltColor === 'branco'
  
  // Cálculo de Progresso Técnico Real
  const { technicalProgress, monthsInBelt } = useMemo(() => {
    const jornada = user?.jornada_tecnica || {}
    const lastPromoDate = jornada.data_ultima_graduacao?.toDate?.() || 
                         user?.criadoEm?.toDate?.() || 
                         (user?.criadoEm ? new Date(user.criadoEm) : new Date())
    
    const diffTime = Math.abs(new Date() - lastPromoDate)
    const months = Math.max(Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44)), 0)
    
    const minMonthsRequired = beltInfo.minMonths || 6
    const progress = Math.min(Math.round((months / minMonthsRequired) * 100), 100)
    
    return { technicalProgress: progress, monthsInBelt: months }
  }, [user, beltInfo])

  const history = user?.jornada_tecnica?.historico || [
    { belt: 'white', date: user?.criadoEm?.toDate?.() || new Date(), reason: 'Início na Academy' }
  ]

  // Filtro de Avisos Ativos (que não expiraram ou foram finalizados)
  const activeNotices = useMemo(() => {
    return notices.filter(notice => {
      if (notice.isFinalized) return false
      if (notice.expiresAt?.toDate) {
        return notice.expiresAt.toDate() > new Date()
      }
      return true
    }).slice(0, 3) // Mostra os 3 últimos ativos
  }, [notices])

  // Filtro de Grade de Aulas (Apenas modalidades que o aluno pratica)
  const filteredSessions = useMemo(() => {
    const studentModalities = user?.modalities || []
    if (studentModalities.length === 0) return []
    
    return sessions.filter(sess => {
      return studentModalities.includes(sess.modalityId) || 
             studentModalities.some(m => m.toLowerCase() === sess.modality?.toLowerCase())
    })
  }, [sessions, user])

  // Lógica de Conquistas Reais baseadas em dados de assiduidade
  const realAchievements = useMemo(() => {
    if (loadingAttendance) return []
    
    return [
      { id: 'consistency', label: 'Assiduidade', desc: '10 aulas no mês', icon: Activity, active: monthly >= 10 },
      { id: 'resilience', label: 'Resiliência', desc: '7 treinos seguidos', icon: Zap, active: streak >= 7 },
      { id: 'discipline', label: 'Disciplina', desc: 'Meta batida!', icon: Target, active: weekly >= 3 },
      { id: 'veteran', label: 'Veterano', desc: '50 treinos totais', icon: Trophy, active: total >= 50 },
      { id: 'star', label: 'Estrela', desc: 'Frequência 100%', icon: Star, active: monthly >= 20 },
    ]
  }, [total, monthly, weekly, streak, loadingAttendance])

  // Cálculo do Próximo Pagamento Baseado nas Cobranças Reais e Regras
  const nextPaymentInfo = useMemo(() => {
    if (!user) return { amount: 0, lastAmount: 0, changed: false, changeType: 'none', status: 'pago', dueDate: null };

    // 1. Encontrar a cobrança mais urgente (vencida primeiro, depois a mais próxima a vencer)
    const pendingAndOverdue = cobrancas.filter(b => b.status === 'pending' || b.status === 'overdue');
    
    // Ordenar por data de vencimento (as mais antigas/vencidas primeiro)
    pendingAndOverdue.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    const currentBill = pendingAndOverdue[0];
    
    let amount = 0;
    let status = 'pago';
    let dueDate = null;

    if (currentBill) {
      amount = Number(currentBill.amount) || 0;
      status = currentBill.status === 'overdue' ? 'vencido' : 'pendente';
      
      const today = new Date().toISOString().split('T')[0];
      if (currentBill.status === 'pending' && currentBill.dueDate < today) {
        status = 'vencido';
      }
      
      dueDate = currentBill.dueDate;
    } else {
      // 2. Se não tem fatura aberta, o KPI reflete qual será o valor do próximo vencimento.
      // Isso utiliza as modalidades ativas no perfil (respeitando se a modalidade custa R$ 0).
      amount = calculateModalityValue(user, modalities);
      status = 'pago';
    }

    return { 
      amount, 
      lastAmount: amount, 
      changed: false, 
      changeType: 'none', 
      status,
      dueDate
    };
  }, [user, cobrancas, modalities]);

  const handleNoticeClick = (notice) => {
    // Marcar como visto se não for o autor e se ainda não foi lido
    if (user?.id && notice.authorId !== user.id && !userViews.has(notice.id)) {
      markAsViewed(notice.id, user.id);
    }
    // Navegar para a página de eventos/avisos com o ID expandido
    window.location.href = `/events?noticeId=${notice.id}`;
  };

  return (
    <>
      {/* Sistema de Cabeçalhos Padronizados (Desktop & Mobile) */}
      <MobileHeader 
        title={`Olá, ${(user?.nome || user?.name || 'Aluno').split(' ')[0]}`} 
        profileIconClass={beltInfo.bgClass || 'bg-primary/20'}
        profileTextClass={isWhiteBelt ? "text-[#111]" : "text-white"}
      />
      
      <PageHeader 
        icon={() => (
          <div className={`w-full h-full flex items-center justify-center ${beltInfo.bgClass || 'bg-primary/10'}`}>
            {user?.photo ? (
              <img src={user.photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className={`font-black text-sm uppercase ${isWhiteBelt ? 'text-[#111]' : 'text-white'}`}>
                {user?.initials || (user?.nome || user?.name)?.[0]}
              </span>
            )}
          </div>
        )}
        title={`Olá, ${(user?.nome || user?.name || 'Aluno').split(' ')[0]}`}
        subtitle="Sua jornada de evolução técnica e física"
        loading={loadingAttendance}
        showProfile={false}
      />

      <div className="flex-1 px-4 md:px-6 py-6 pb-32 space-y-6 w-full fade-slide-up">
        
        {/* Alerta Financeiro */}
      <AnimatePresence>
        {pendingBills.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginBottom: 0 }}
            animate={{ opacity: 1, height: 'auto', marginBottom: 32 }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className={`overflow-hidden bg-rose-500/10 border border-rose-500/20 ${RADIUS_CARD} relative`}
          >
            <div className="p-5 flex items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-white uppercase tracking-tight">Pendência Financeira</h4>
                  <p className="text-[10px] font-bold text-rose-300">Existem faturas aguardando pagamento. Verifique com a recepção.</p>
                  {(user?.roles?.admin || user?.papeis?.admin) && (
                    <button
                      onClick={handleSync}
                      disabled={syncing}
                      className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all mt-2 ${
                        syncing ? 'bg-white/5 text-gray-500 cursor-not-allowed' : 'bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20'
                      }`}
                    >
                      {syncing ? (
                        <>
                          <div className="w-3 h-3 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <Activity size={14} />
                          Sincronizar Histórico
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
              <button className="px-4 py-2 bg-rose-500 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:brightness-110 active:scale-95 transition-all">
                Ver Faturas
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* COLUNA ESQUERDA */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* Grid de Estatísticas Consolidado */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <PaymentStatCard info={nextPaymentInfo} delay={0.05} />
            <StatCard 
              title="Tempo de Faixa" 
              value={`${monthsInBelt}m`} 
              detail="Meses na graduação" 
              icon={Clock} 
              color="var(--clr-primary)" 
              delay={0.1}
            />
            <StatCard 
              title="No Mês" 
              value={monthly} 
              detail="Treinos realizados" 
              icon={Activity} 
              color="#0ea5e9" 
              delay={0.2}
            />
            <StatCard 
              title="Meta Semanal" 
              value={`${weekly}/3`} 
              detail="Aulas concluídas" 
              icon={Target} 
              color="#10b981" 
              delay={0.3}
            />
            <StatCard 
              title="Sequência" 
              value={`${streak}d`} 
              detail="Aulas consecutivas" 
              icon={Zap} 
              color="#f59e0b" 
              delay={0.4}
            />
            <StatCard 
              title="Treinos" 
              value={total} 
              detail="Total acumulado" 
              icon={History} 
              color="#8b5cf6" 
              delay={0.5}
            />
          </div>



          {/* Tendência de Presença */}
          <section className="glass-card rounded-[32px] p-6 border border-white/10 relative overflow-hidden">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <div>
                  <h2 className="text-lg font-black text-white tracking-wide">Tendência de Presença</h2>
                  <p className="text-xs text-gray-500 mt-1 tracking-tighter">Sua frequência de treino</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex bg-black p-1 rounded-xl border border-white/5">
                    {['mes', 'ano'].map(v => (
                      <button
                        key={v}
                        onClick={() => setPeriod(v)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${period === v ? 'bg-primary text-white shadow-lg' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
                      >
                        {v === 'mes' ? 'Mês' : 'Ano'}
                      </button>
                    ))}
                  </div>
                </div>
             </div>

<div className="h-[260px] w-full">
                {loadingAttendance ? (
                  <div className="h-full bg-white/5 rounded-2xl animate-pulse" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={attendanceChartData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
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
                )}
              </div>
           </section>

        </div>

        {/* COLUNA DIREITA */}
        <div className="lg:col-span-4 space-y-8">
          
          {/* Mural de Avisos */}
          <section className={`glass-card p-8 bg-surface-app/30 border border-white/5 ${RADIUS_MAIN}`}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-white/5 border border-white/10"><Bell size={20} className="text-primary" /></div>
                <h3 className="text-xl font-black text-white uppercase tracking-widest">Mural da Academy</h3>
              </div>
            </div>
            
            <div className="space-y-4">
              {loadingNotices ? (
                <div className="h-24 bg-white/5 rounded-2xl animate-pulse" />
              ) : activeNotices.length > 0 ? (
                activeNotices.map((notice, idx) => {
                  const isRead = userViews.has(notice.id);
                  return (
                    <div 
                      key={idx} 
                      onClick={() => handleNoticeClick(notice)}
                      className={`relative p-5 rounded-2xl bg-white/5 border transition-all group cursor-pointer ${isRead ? 'border-white/5 opacity-70' : 'border-primary/20 bg-primary/5 hover:border-primary/40'}`}
                    >
                      {!isRead && (
                        <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(var(--clr-primary-rgb),0.6)] animate-pulse" />
                      )}
                      <div className="flex justify-between items-start mb-2">
                        <span className="text-[9px] font-black px-2 py-0.5 rounded bg-primary/20 text-primary uppercase tracking-widest">
                          {notice.category || 'Aviso'}
                        </span>
                        <span className="text-[9px] font-bold text-gray-600 uppercase">
                          {new Date(notice.createdAt?.toDate ? notice.createdAt.toDate() : notice.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                        </span>
                      </div>
                      <h4 className="text-sm font-black text-white uppercase tracking-tight mb-1 group-hover:text-primary transition-colors">
                        {notice.title}
                      </h4>
                      <p className="text-[11px] text-gray-500 font-bold uppercase tracking-tighter leading-tight line-clamp-2">
                        {notice.content || notice.description?.replace(/<[^>]*>?/gm, ' ')}
                      </p>
                    </div>
                  )
                })
              ) : (
                <div className="py-10 text-center">
                  <p className="text-[11px] font-black text-gray-600 uppercase tracking-widest">Nenhum aviso importante no momento.</p>
                </div>
              )}
            </div>
          </section>

          {/* Conquistas */}
          <section className={`glass-card p-8 bg-surface-app/30 border border-white/5 ${RADIUS_MAIN}`}>
            <h3 className="text-xl font-black text-white uppercase tracking-tighter mb-8 flex items-center gap-3">
              <Star size={20} className="text-yellow-500 fill-yellow-500/20" />
              Conquistas
            </h3>
            
            <div className="grid grid-cols-1 gap-4">
              {realAchievements.length > 0 ? realAchievements.map((ach, idx) => (
                <div key={idx} className={`p-4 rounded-[22px] border flex items-center gap-4 transition-all duration-300 ${ach.active ? 'bg-white/5 border-white/10 scale-[1.02]' : 'bg-white/[0.02] border-white/[0.03] opacity-50'}`}>
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${ach.active ? 'bg-primary shadow-lg shadow-primary/20 text-white' : 'bg-white/5 text-gray-600'}`}>
                    <ach.icon size={20} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-white uppercase tracking-tight">{ach.label}</p>
                    <p className="text-[9px] font-bold text-gray-500 uppercase tracking-tighter truncate">{ach.desc}</p>
                  </div>
                  {ach.active && <Check size={16} className="text-primary" />}
                </div>
              )) : (
                <div className="py-8 text-center">
                  <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">Carregando Conquistas...</p>
                </div>
              )}
            </div>
          </section>

          {/* Grade de Horários */}
          <section className={`glass-card p-8 bg-surface-app/30 border border-white/5 ${RADIUS_MAIN}`}>
             <div className="flex items-center gap-3 mb-6">
                <Clock size={16} className="text-primary" />
                <h4 className="text-[11px] font-black text-white uppercase tracking-widest">Minha Grade</h4>
             </div>
             <div className="space-y-3">
                {loadingSessions ? (
                   [1, 2].map(i => <div key={i} className="h-12 bg-white/5 rounded-2xl animate-pulse" />)
                ) : filteredSessions.length > 0 ? (
                  filteredSessions.map((slot, i) => (
                    <div key={i} className="flex items-center justify-between p-3.5 rounded-2xl border bg-white/5 border-white/5 hover:border-primary/20 transition-all">
                      <span className="text-[11px] font-black text-white">{slot.time}</span>
                      <span className="text-[10px] font-bold uppercase tracking-tight text-primary">{slot.classTitle}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] font-bold text-gray-600 uppercase text-center py-4">Nenhuma aula da sua modalidade para hoje.</p>
                )}
             </div>
          </section>

        </div>
      </div>
    </div>
    </>
  )
}

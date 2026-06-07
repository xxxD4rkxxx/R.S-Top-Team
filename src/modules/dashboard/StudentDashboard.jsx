import React, { useState, useMemo } from 'react'
import { 
  Trophy, Medal, Target, Calendar, Clock, TrendingUp, 
  ChevronLeft, ChevronRight, Star, Zap, Bell, AlertCircle, History,
  Activity, Sparkles, Check, LayoutDashboard, DollarSign, 
  Wallet, ArrowUpRight, ShieldCheck, CalendarDays
} from 'lucide-react'
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar
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
 * DASHBOARD  DO ALUNO 
 * 
 */

const DAYS_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const NUM_TO_DAY = { 0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab' }
const DAY_TO_NUM = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 }

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

function CustomBarTooltip({ active, payload }) {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#111] border border-white/10 rounded-xl p-3 shadow-2xl">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{payload[0].payload.label}</p>
        <p className="text-sm font-black text-white">{payload[0].value} Treinos</p>
      </div>
    )
  }
  return null
}


export default function StudentDashboard({ user, cobrancas = [] }) {
  const { total: hookTotal, monthly, weekly, streak, recent, loading: loadingAttendance } = useStudentAttendance(user?.id)

  // Sincronizar com dados do documento do usuário (Source of Truth)
  const total = user?.total_visitas || hookTotal || 0
  const { notices, userViews = new Set(), markAsViewed } = useNotices(user?.id)
  const { sessions, loading: loadingSessions } = useTodaySessions()
  const { modalities } = useModalities()
  const [syncing, setSyncing] = useState(false)

  const [weekOffset, setWeekOffset] = useState(0)
  const [selectedDate, setSelectedDate] = useState(() => {
    const d = new Date()
    d.setHours(0,0,0,0)
    return d
  })

  const records = useMemo(() => {
    if (!recent) return [];
    return recent.map(log => {
      let date = null
      if (log.parsedDate) {
        date = log.parsedDate instanceof Date ? log.parsedDate : new Date(log.parsedDate)
      } else if (log.date) {
        date = new Date(log.date + 'T12:00:00')
      } else if (log.data) {
        date = new Date(log.data + 'T12:00:00')
      }
      return {
        ...log,
        date: date || new Date(0),
        modality: log.modalidade || log.modality || 'Jiu Jitsu',
        status: log.status || 'present'
      }
    }).filter(r => r.date && !isNaN(r.date.getTime())).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [recent])

  const presentRecords = useMemo(() => records.filter(r => r.status === 'present' || r.status === 'presente'), [records])

  const monthlyData = useMemo(() => {
    const MONTHS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const counts = {}
    presentRecords.forEach(r => {
      const key = r.date.getMonth()
      counts[key] = (counts[key] || 0) + 1
    })
    return Array.from({ length: 12 }, (_, i) => ({ month: i, label: MONTHS[i], count: counts[i] || 0 }))
  }, [presentRecords])

  const weeklyCalendarDays = useMemo(() => {
    const today = new Date()
    today.setHours(0,0,0,0)
    const currentDay = today.getDay()
    const distToMon = currentDay === 0 ? -6 : 1 - currentDay
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() + distToMon + (weekOffset * 7))

    const days = []
    for(let i=0; i<7; i++) {
      const d = new Date(startOfWeek)
      d.setDate(startOfWeek.getDate() + i)
      days.push(d)
    }
    return days
  }, [weekOffset])

  const { allTurmas = [] } = useModalities()

  const scheduledDays = useMemo(() => {
    const studentModalities = user?.modalities || []
    if (studentModalities.length === 0) return []

    const studentTurmas = allTurmas.filter(t => {
       const mod = modalities.find(m => m.id === t.modalityId)
       return studentModalities.includes(t.modalityId) || 
              (mod && studentModalities.some(m => m.toLowerCase() === mod.name.toLowerCase()))
    })

    const daysSet = new Set()
    const mapDayToNum = { dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6 }
    
    studentTurmas.forEach(t => {
      if (t.diasSemana) {
        t.diasSemana.forEach(d => {
           if (mapDayToNum[d] !== undefined) daysSet.add(mapDayToNum[d])
        })
      }
    })

    return Array.from(daysSet)
  }, [allTurmas, modalities, user])

  const selectedDayClasses = useMemo(() => {
    const dayNum = selectedDate.getDay()
    const mapNumToDay = { 0: 'dom', 1: 'seg', 2: 'ter', 3: 'qua', 4: 'qui', 5: 'sex', 6: 'sab' }
    const dayStr = mapNumToDay[dayNum]

    const studentModalities = user?.modalities || []
    if (studentModalities.length === 0) return []

    return allTurmas.filter(t => {
       const mod = modalities.find(m => m.id === t.modalityId)
       const isStudentEnrolled = studentModalities.includes(t.modalityId) || 
              (mod && studentModalities.some(m => m.toLowerCase() === mod.name.toLowerCase()))
       const isOnThisDay = t.diasSemana?.includes(dayStr)
       return isStudentEnrolled && isOnThisDay
    }).map(t => {
       const mod = modalities.find(m => m.id === t.modalityId)
       return {
         ...t,
         modalityName: mod ? mod.name : (t.name || 'Treino')
       }
    })
  }, [allTurmas, modalities, user, selectedDate])

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

  // Dias da semana que têm anúncios ativos com data e dias marcados (para indicadores no calendário)
  const noticeDays = useMemo(() => {
    const daysSet = new Set()

    activeNotices.forEach(notice => {
      if (!notice.diasSemana || !notice.startDate) return

      const start = new Date(notice.startDate + 'T00:00:00')
      const end = notice.endDate ? new Date(notice.endDate + 'T23:59:59') : new Date(start)

      // Varre os dias da semana atual e vê se o anúncio cobre cada um
      weeklyCalendarDays.forEach(date => {
        const dayStr = NUM_TO_DAY[date.getDay()]
        if (!notice.diasSemana.includes(dayStr)) return
        if (date < start) return
        if (date > end) return
        daysSet.add(date.getDay())
      })
    })

    return daysSet
  }, [weeklyCalendarDays, activeNotices])

  // Anúncios específicos do dia selecionado na agenda
  const selectedDayNotices = useMemo(() => {
    const dayNum = selectedDate.getDay()
    const dayStr = NUM_TO_DAY[dayNum]
    const dateStr = selectedDate.toISOString().split('T')[0]

    return activeNotices.filter(notice => {
      if (!notice.diasSemana || !notice.diasSemana.length) return false
      if (!notice.diasSemana.includes(dayStr)) return false
      if (notice.startDate && dateStr < notice.startDate) return false
      if (notice.endDate && dateStr > notice.endDate) return false
      return true
    })
  }, [selectedDate, activeNotices])

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
          
          {/* Grid de Estatísticas Consolidado (3x2 no PC) */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
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



          {/* Calendário Semanal (MOBILE) */}
          <section className="glass-card rounded-[32px] p-6 border border-white/10 relative overflow-hidden flex lg:hidden flex-col">
             <div className="flex items-center justify-between mb-6">
               <h2 className="text-lg font-black text-white tracking-wide">Agenda Semanal</h2>
               <div className="flex items-center gap-1">
                 <button onClick={() => setWeekOffset(p => p - 1)} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                   <ChevronLeft size={16} className="text-gray-400" />
                 </button>
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest min-w-[80px] text-center">
                   {weeklyCalendarDays[0].toLocaleDateString('pt-BR', { month: 'short' })} {weeklyCalendarDays[0].getFullYear()}
                 </span>
                 <button onClick={() => setWeekOffset(p => p + 1)} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                   <ChevronRight size={16} className="text-gray-400" />
                 </button>
               </div>
             </div>

             <div className="flex items-center gap-2 overflow-x-auto pb-4 custom-scrollbar snap-x sm:justify-between sm:overflow-visible">
                {weeklyCalendarDays.map((date, i) => {
                  const isSelected = date.getTime() === selectedDate.getTime()
                  const dayOfWeek = date.getDay()
                  const hasClass = scheduledDays.includes(dayOfWeek)
                  const hasNotice = noticeDays.has(dayOfWeek)

                  return (
                    <div key={i}
                         onClick={() => setSelectedDate(date)}
                         className={`flex flex-col items-center justify-center py-3 px-2 rounded-2xl cursor-pointer transition-all flex-[0_0_auto] min-w-[64px] sm:flex-1 sm:min-w-0 snap-center
                           ${isSelected
                              ? 'bg-primary border-transparent shadow-[0_0_20px_rgba(var(--clr-primary-rgb),0.3)] scale-[1.05]'
                              : 'bg-white/5 hover:bg-white/10 border border-white/5'
                           }
                         `}
                    >
                      <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-1 ${isSelected ? 'text-black/70' : 'text-gray-500'}`}>
                        {DAYS_FULL[dayOfWeek].substring(0,3)}
                      </span>
                      <span className={`text-sm sm:text-lg font-black ${isSelected ? 'text-black' : 'text-white'}`}>
                        {date.getDate()}
                      </span>
                      {/* Indicadores: bolinha verde de aula + sino amarelo de comunicado */}
                      <div className="mt-1.5 h-4 flex items-center justify-center gap-1 w-full">
                         {hasClass && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-black/40' : 'bg-primary'}`} />}
                         {hasNotice && <Bell size={9} className={isSelected ? 'text-black/60' : 'text-yellow-500/70'} fill="currentColor" fillOpacity={0.3} />}
                      </div>
                    </div>
                  )
                })}
             </div>

             {/* Card do Dia Selecionado */}
             <div className="mt-6 p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col justify-center relative overflow-hidden">
                {scheduledDays.includes(selectedDate.getDay()) ? (
                   <div className="flex items-center justify-between relative z-10">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--clr-primary)]" />
                          <span className="text-xs font-bold text-white uppercase tracking-wider">
                            {selectedDayClasses.length > 1 ? `${selectedDayClasses.length} Treinos Agendados` : 'Treino Agendado'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          {selectedDayClasses.map((cls, idx) => (
                            <p key={idx} className="text-[10px] text-gray-400 font-medium">
                              {cls.modalityName} • {cls.horarioInicio || '?'} - {cls.horarioFim || '?'}
                            </p>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if ('Notification' in window) {
                            Notification.requestPermission().then(perm => {
                              if (perm === 'granted') {
                                new Notification('RS Top Team', {
                                  body: 'Notificações de aula ativadas! (Simulação)',
                                  icon: '/vite.svg'
                                })
                              }
                            })
                          }
                        }}
                        className="px-3 py-1.5 bg-primary/20 text-primary border border-primary/30 rounded-xl text-[10px] font-bold hover:bg-primary/30 transition-colors flex items-center gap-1.5 active:scale-95">
                        <Bell size={12} />
                        Lembrar
                      </button>
                   </div>
                ) : (
                   <div className="text-center relative z-10">
                     <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1">Dia Livre</p>
                     <p className="text-[10px] text-gray-600">Nenhum treino agendado para hoje.</p>
                   </div>
                )}
                {/* Anúncios do dia — avisos de professor com data e dias da semana */}
                {selectedDayNotices.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/5 relative z-10 space-y-2">
                    <span className="text-[9px] font-black text-yellow-500/80 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                      <Bell size={11} /> Comunicados
                    </span>
                    {selectedDayNotices.map((notice, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleNoticeClick(notice)}
                        className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10 hover:bg-yellow-500/10 hover:border-yellow-500/20 transition-all cursor-pointer active:scale-[0.98]"
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <h5 className="text-[11px] font-black text-white uppercase tracking-tight truncate">
                            {notice.title}
                          </h5>
                          {/* Data: início → fim */}
                          <span className="text-[8px] font-bold text-yellow-600/60 uppercase tracking-widest shrink-0">
                            {notice.startDate && `${notice.startDate.split('-').reverse().join('/')}${notice.endDate && notice.endDate !== notice.startDate ? ` → ${notice.endDate.split('-').reverse().join('/')}` : ''}`}
                          </span>
                        </div>
                        {/* Resumo do conteúdo (strip de HTML) */}
                        <p className="text-[9px] text-gray-500 font-medium line-clamp-1">
                          {notice.description?.replace(/<[^>]*>?/gm, ' ') || notice.content || ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {/* Background decoration */}
                <div className="absolute right-0 top-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
             </div>
           </section>

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

          {/* Consistência Mensal */}
          <section className="glass-card rounded-[24px] p-4 md:p-5 border border-white/10 relative overflow-hidden">
            <h2 className="text-base font-black text-white tracking-wide mb-4">Consistência Mensal</h2>
            
            <div className="bg-white/5 rounded-2xl border border-white/10 p-3">
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={monthlyData} barSize={8}>
                  <XAxis dataKey="label" tick={{ fill: '#4b5563', fontSize: 8 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <RechartsTooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                  <Bar dataKey="count" fill="var(--clr-primary)" radius={[4, 4, 0, 0]}
                    label={{ position: 'top', fill: '#6b7280', fontSize: 8, formatter: v => v || '' }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

        </div>

        {/* COLUNA DIREITA */}
        <div className="lg:col-span-4 space-y-8">
          
           {/* Calendário Semanal (DESKTOP) */}
           <section className="glass-card rounded-[32px] p-6 border border-white/10 relative overflow-hidden hidden lg:flex flex-col">
             <div className="flex items-center justify-between mb-6">
               <h2 className="text-lg font-black text-white tracking-wide">Agenda Semanal</h2>
               <div className="flex items-center gap-1">
                 <button onClick={() => setWeekOffset(p => p - 1)} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                   <ChevronLeft size={16} className="text-gray-400" />
                 </button>
                 <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest min-w-[80px] text-center">
                   {weeklyCalendarDays[0].toLocaleDateString('pt-BR', { month: 'short' })} {weeklyCalendarDays[0].getFullYear()}
                 </span>
                 <button onClick={() => setWeekOffset(p => p + 1)} className="p-1.5 bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                   <ChevronRight size={16} className="text-gray-400" />
                 </button>
               </div>
             </div>

             <div className="flex items-center gap-2 overflow-x-auto pb-4 custom-scrollbar snap-x sm:justify-between sm:overflow-visible">
                {weeklyCalendarDays.map((date, i) => {
                  const isSelected = date.getTime() === selectedDate.getTime()
                  const dayOfWeek = date.getDay()
                  const hasClass = scheduledDays.includes(dayOfWeek)
                  const hasNotice = noticeDays.has(dayOfWeek)

                  return (
                    <div key={i}
                         onClick={() => setSelectedDate(date)}
                         className={`flex flex-col items-center justify-center py-3 px-2 rounded-2xl cursor-pointer transition-all flex-[0_0_auto] min-w-[64px] sm:flex-1 sm:min-w-0 snap-center
                           ${isSelected
                              ? 'bg-primary border-transparent shadow-[0_0_20px_rgba(var(--clr-primary-rgb),0.3)] scale-[1.05]'
                              : 'bg-white/5 hover:bg-white/10 border border-white/5'
                           }
                         `}
                    >
                      <span className={`text-[9px] sm:text-[10px] font-bold uppercase tracking-wider mb-1 ${isSelected ? 'text-black/70' : 'text-gray-500'}`}>
                        {DAYS_FULL[dayOfWeek].substring(0,3)}
                      </span>
                      <span className={`text-sm sm:text-lg font-black ${isSelected ? 'text-black' : 'text-white'}`}>
                        {date.getDate()}
                      </span>
                      {/* Indicadores: bolinha verde de aula + sino amarelo de comunicado */}
                      <div className="mt-1.5 h-4 flex items-center justify-center gap-1 w-full">
                         {hasClass && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-black/40' : 'bg-primary'}`} />}
                         {hasNotice && <Bell size={9} className={isSelected ? 'text-black/60' : 'text-yellow-500/70'} fill="currentColor" fillOpacity={0.3} />}
                      </div>
                    </div>
                  )
                })}
             </div>

             {/* Card do Dia Selecionado */}
             <div className="mt-6 p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col justify-center relative overflow-hidden">
                {scheduledDays.includes(selectedDate.getDay()) ? (
                   <div className="flex items-center justify-between relative z-10">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--clr-primary)]" />
                          <span className="text-xs font-bold text-white uppercase tracking-wider">
                            {selectedDayClasses.length > 1 ? `${selectedDayClasses.length} Treinos Agendados` : 'Treino Agendado'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          {selectedDayClasses.map((cls, idx) => (
                            <p key={idx} className="text-[10px] text-gray-400 font-medium">
                              {cls.modalityName} • {cls.horarioInicio || '?'} - {cls.horarioFim || '?'}
                            </p>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          if ('Notification' in window) {
                            Notification.requestPermission().then(perm => {
                              if (perm === 'granted') {
                                new Notification('RS Top Team', {
                                  body: 'Notificações de aula ativadas! (Simulação)',
                                  icon: '/vite.svg'
                                })
                              }
                            })
                          }
                        }}
                        className="px-3 py-1.5 bg-primary/20 text-primary border border-primary/30 rounded-xl text-[10px] font-bold hover:bg-primary/30 transition-colors flex items-center gap-1.5 active:scale-95">
                        <Bell size={12} />
                        Lembrar
                      </button>
                   </div>
                ) : (
                   <div className="text-center relative z-10">
                     <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1">Dia Livre</p>
                     <p className="text-[10px] text-gray-600">Nenhum treino agendado para hoje.</p>
                   </div>
                )}
                {/* Anúncios do dia — avisos de professor com data e dias da semana */}
                {selectedDayNotices.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-white/5 relative z-10 space-y-2">
                    <span className="text-[9px] font-black text-yellow-500/80 uppercase tracking-widest flex items-center gap-1.5 mb-2">
                      <Bell size={11} /> Comunicados
                    </span>
                    {selectedDayNotices.map((notice, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleNoticeClick(notice)}
                        className="p-3 rounded-xl bg-yellow-500/5 border border-yellow-500/10 hover:bg-yellow-500/10 hover:border-yellow-500/20 transition-all cursor-pointer active:scale-[0.98]"
                      >
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <h5 className="text-[11px] font-black text-white uppercase tracking-tight truncate">
                            {notice.title}
                          </h5>
                          {/* Data: início → fim */}
                          <span className="text-[8px] font-bold text-yellow-600/60 uppercase tracking-widest shrink-0">
                            {notice.startDate && `${notice.startDate.split('-').reverse().join('/')}${notice.endDate && notice.endDate !== notice.startDate ? ` → ${notice.endDate.split('-').reverse().join('/')}` : ''}`}
                          </span>
                        </div>
                        {/* Resumo do conteúdo (strip de HTML) */}
                        <p className="text-[9px] text-gray-500 font-medium line-clamp-1">
                          {notice.description?.replace(/<[^>]*>?/gm, ' ') || notice.content || ''}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {/* Background decoration */}
                <div className="absolute right-0 top-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none" />
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

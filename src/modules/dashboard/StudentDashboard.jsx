import React, { useState, useMemo } from 'react'
import { 
  Trophy, Medal, Target, Calendar, Clock, TrendingUp, 
  ChevronRight, Star, Zap, Bell, AlertCircle, History,
  Activity, Sparkles, Check, LayoutDashboard
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStudentAttendance } from '../../hooks/useStudentAttendance'
import { useNotices } from '../../hooks/useNotices'
import { useTodaySessions } from '../../hooks/useTodaySessions'
import { beltConfig as defaultBelts } from '../../data/beltConfig'
import PageHeader from '../../components/shared/PageHeader'
import MobileHeader from '../../components/navigation/MobileHeader'

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


export default function StudentDashboard({ user, cobrancas = [] }) {
  const { total, monthly, weekly, streak, recent, loading: loadingAttendance } = useStudentAttendance(user?.uid)
  const { notices, loading: loadingNotices } = useNotices()
  const { sessions, loading: loadingSessions } = useTodaySessions()

  // Filtro de cobranças pendentes
  const pendingBills = useMemo(() => 
    cobrancas.filter(b => b.status === 'pending' || b.status === 'overdue'),
  [cobrancas])

  // Configuração da Faixa Atual
  const beltInfo = defaultBelts[user?.belt || 'white'] || defaultBelts.white
  
  // Cálculo de Progresso Técnico Real
  const { technicalProgress, monthsInBelt } = useMemo(() => {
    const lastPromoDate = user?.tech_journey?.last_promotion_date?.toDate?.() || 
                         user?.createdAt?.toDate?.() || 
                         (user?.createdAt ? new Date(user.createdAt) : new Date())
    
    const diffTime = Math.abs(new Date() - lastPromoDate)
    const months = Math.max(Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44)), 0)
    
    const minMonthsRequired = beltInfo.minMonths || 6
    const progress = Math.min(Math.round((months / minMonthsRequired) * 100), 100)
    
    return { technicalProgress: progress, monthsInBelt: months }
  }, [user, beltInfo])

  const history = user?.tech_journey?.history || [
    { belt: 'white', date: user?.createdAt?.toDate?.() || new Date(), reason: 'Início na Academy' }
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

  return (
    <>
      {/* Sistema de Cabeçalhos Padronizados (Desktop & Mobile) */}
      <MobileHeader 
        title={`Olá, ${(user?.nome || user?.name || 'Aluno').split(' ')[0]}`} 
        profileIconClass={beltInfo.bgClass || 'bg-primary/20'}
        profileTextClass="text-white"
      />
      
      <PageHeader 
        icon={() => (
          <div className={`w-full h-full flex items-center justify-center ${beltInfo.bgClass || 'bg-primary/10'}`}>
            {user?.photo ? (
              <img src={user.photo} alt="" className="w-full h-full object-cover" />
            ) : (
              <span className={`font-black text-sm uppercase ${user?.belt === 'white' ? 'text-black' : 'text-white'}`}>
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
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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


          {/* Atividades Recentes */}
          <section className={`glass-card p-8 bg-surface-app/30 border border-white/5 ${RADIUS_MAIN}`}>
             <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/5 border border-white/10"><History size={20} className="text-primary" /></div>
                  <h3 className="text-xl font-black text-white uppercase tracking-widest">Atividades Recentes</h3>
                </div>
             </div>

             <div className="space-y-4">
               {loadingAttendance ? (
                 [1, 2, 3].map(i => <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse" />)
               ) : recent.length > 0 ? (
                 recent.slice(0, 5).map((log, idx) => (
                   <div key={idx} className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between group hover:bg-white/10 transition-colors">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <Check size={18} className="text-primary" />
                         </div>
                         <div>
                            <h4 className="text-sm font-black text-white uppercase tracking-tight">{log.modality}</h4>
                            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                               {new Date(log.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
                            </p>
                         </div>
                      </div>
                      <div className="text-right">
                         <div className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 text-[9px] font-black uppercase tracking-widest">
                            Presente
                         </div>
                      </div>
                   </div>
                 ))
               ) : (
                 <p className="text-[11px] text-gray-500 uppercase font-black text-center py-8">Nenhuma atividade recente.</p>
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
                activeNotices.map((notice, idx) => (
                  <div key={idx} className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-primary/20 transition-all group">
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
                      {notice.content}
                    </p>
                  </div>
                ))
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

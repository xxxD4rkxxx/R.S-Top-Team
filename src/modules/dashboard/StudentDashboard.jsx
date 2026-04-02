import React, { useMemo } from 'react'
import { 
  FileText, ShieldCheck, ClipboardCheck, History, 
  Bell, Award, TrendingUp, Smartphone, Clock,
  ChevronRight, Download, CheckCircle2, AlertCircle,
  Calendar, MapPin, User as UserIcon, Activity, Zap
} from 'lucide-react'
import { motion } from 'framer-motion'
import { beltConfig } from '../../data/beltConfig'

// ── Componentes de UI ──────────────────────────────────────────

function SectionTitle({ title, icon: Icon, color = 'text-gray-400' }) {
  return (
    <h3 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] mb-4 opacity-70">
      <Icon size={14} className={color} />
      {title}
    </h3>
  )
}

function StatCard({ label, value, subvalue, icon: Icon, color = 'text-primary' }) {
  return (
    <div className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center gap-4 group hover:border-white/10 transition-all">
      <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center shrink-0`}>
        <Icon size={18} className={color} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">{label}</p>
        <p className="text-xl font-black text-white animate-value-reveal">{value}</p>
        {subvalue && <p className="text-[9px] text-gray-600 font-bold">{subvalue}</p>}
      </div>
    </div>
  )
}

function FeatureCard({ title, desc, icon: Icon, badge, color = 'text-primary' }) {
  return (
    <div className="bg-[#111] border border-white/5 rounded-2xl p-5 hover:border-white/15 transition-all group flex flex-col h-full relative overflow-hidden">
      {/* Subtle background glow */}
      <div className="absolute -top-10 -right-10 w-24 h-24 blur-[60px] opacity-10 rounded-full" style={{ background: 'var(--clr-primary)' }} />
      
      <div className="flex items-start justify-between mb-4">
        <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-white transition-transform group-hover:scale-110">
          <Icon size={20} className={color} />
        </div>
        {badge && (
          <span className="px-2 py-1 rounded-lg text-[9px] font-black bg-emerald-500/10 text-emerald-400 uppercase tracking-tighter">
            {badge}
          </span>
        )}
      </div>
      
      <h4 className="text-sm font-bold text-white mb-2 leading-tight">{title}</h4>
      <p className="text-xs text-gray-500 leading-relaxed flex-1">{desc}</p>
      
      <button className="mt-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors group/btn">
        Ver detalhes 
        <ChevronRight size={14} className="group-hover/btn:translate-x-1 transition-transform" />
      </button>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────────

export default function StudentDashboard({ user, notices = [] }) {
  // Graduação calculation
  const currentBelt = user?.belt || 'white'
  const cfg = beltConfig[currentBelt] || beltConfig['white']
  const totalAttendances = user?.totalAttendances || 0
  const monthlyAttendances = user?.monthlyAttendances || 0
  
  // Avisos formatados
  const displayNotices = notices.slice(0, 3)

  // Fake requirements for demo
  const nextBeltReq = 100 
  const progressPercent = Math.min(Math.round((totalAttendances / nextBeltReq) * 100), 100)
  
  // Encontrar próxima faixa (simplificado)
  const beltOrder = ['white', 'blue', 'purple', 'brown', 'black']
  const currentIdx = beltOrder.indexOf(currentBelt)
  const nextBeltKey = currentIdx !== -1 && currentIdx < beltOrder.length - 1 ? beltOrder[currentIdx + 1] : 'black'
  const nextBeltCfg = beltConfig[nextBeltKey] || beltConfig['white']

  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  }

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="px-4 md:px-8 py-6 space-y-8 max-w-[1400px] mx-auto pb-24"
    >
      
      {/* ── TOP SECTION: PROGRESSO & RESUMO ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* PROGRESSO DE GRADUAÇÃO */}
        <motion.div variants={itemVariants} className="lg:col-span-8 flex flex-col gap-6">
          <div className="bg-[#0a0a0a] border border-white/5 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
            {/* Background design */}
            <div className="absolute top-0 right-0 w-64 h-64 blur-[100px] opacity-10 rounded-full" style={{ background: cfg.color }} />
            
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
              <div className="flex items-center gap-5">
                {/* Visual Belt */}
                <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
                  <div className="absolute inset-0 rounded-full opacity-20 animate-pulse" style={{ background: cfg.color }} />
                  <div className="w-16 h-16 rounded-full border-2 flex items-center justify-center bg-black/40 shadow-inner overflow-hidden" style={{ borderColor: cfg.color + '44' }}>
                    <Award size={32} style={{ color: cfg.color }} />
                  </div>
                  {/* Stripes loop */}
                  <div className="absolute -bottom-1 flex gap-0.5">
                    {Array.from({ length: user?.stripes || 0 }).map((_, i) => (
                      <div key={i} className="w-1.5 h-3 bg-white rounded-sm border border-black shadow" />
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="text-2xl font-black text-white leading-none tracking-tight">Evolução Técnica</h2>
                  <p className="text-gray-500 text-sm mt-1 uppercase font-bold tracking-widest flex items-center gap-2">
                    Faixa {cfg.label} <span className="w-1 h-1 bg-gray-700 rounded-full" /> {user?.stripes || 0}º Grau
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-3xl font-black text-white animate-value-reveal">{progressPercent}%</span>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Até {nextBeltCfg.label}</p>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="mt-8 relative h-4 bg-white/5 rounded-full overflow-hidden border border-white/5 p-0.5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 1.5, ease: [0.34, 1.56, 0.64, 1] }}
                className="h-full rounded-full shadow-lg relative overflow-hidden"
                style={{ background: `linear-gradient(90deg, ${cfg.color}CC, ${cfg.color})` }}
              >
                {/* Shine effect */}
                <motion.div 
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
                  className="absolute inset-0 w-1/2 bg-white/20 skew-x-12"
                />
              </motion.div>
            </div>

            <div className="mt-4 flex justify-between text-[10px] font-black uppercase tracking-widest text-gray-600">
              <span className="flex items-center gap-1.5"><Activity size={12} className="text-emerald-500" /> <span className="animate-value-reveal">{totalAttendances}</span> treinos realizados</span>
              <span className="text-gray-400">Próxima meta: {nextBeltReq} aulas</span>
            </div>
          </div>

          {/* KPI GRID (ALUNO) */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Total Treinos" value={totalAttendances} subvalue="Acumulado total" icon={History} />
            <StatCard label="Média Mensal" value={monthlyAttendances} subvalue={`${Math.min(100, (monthlyAttendances/12)*100).toFixed(0)}% da meta`} icon={TrendingUp} color="text-emerald-400" />
            <StatCard label="Sequência" value={user?.streak || '7'} subvalue="Dias seguidos" icon={Zap} color="text-yellow-400" />
            <StatCard label="Status" value="ATIVO" subvalue="Regularizado" icon={CheckCircle2} color="text-blue-400" />
          </div>
        </motion.div>

        {/* SIDE: HORÁRIOS & AVISOS */}
        <motion.div variants={itemVariants} className="lg:col-span-4 space-y-6">
          {/* AVISOS RECENTES */}
          <div className="bg-[#111] border border-white/5 rounded-3xl p-6 flex flex-col h-full">
            <SectionTitle title="Avisos da Academia" icon={Bell} color="text-yellow-400" />
            <div className="space-y-4 flex-1">
               {displayNotices.length > 0 ? (
                 displayNotices.map((n, idx) => (
                   <div key={idx} className={`p-4 rounded-2xl bg-white/5 border transition-all ${n.priority === 'urgent' ? 'border-primary/30 bg-primary/5 hover:bg-primary/10' : 'border-white/5 hover:bg-white/[0.07]'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`w-2 h-2 rounded-full ${n.priority === 'urgent' ? 'bg-primary animate-pulse' : 'bg-blue-400'}`} />
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${n.priority === 'urgent' ? 'text-primary' : 'text-blue-400'}`}>
                          {n.priority === 'urgent' ? 'Urgente' : (n.category || 'Geral')}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-white leading-tight">{n.title}</p>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{n.content || n.message}</p>
                   </div>
                 ))
               ) : (
                 <div className="p-10 text-center space-y-2 opacity-50">
                    <p className="text-sm font-bold text-gray-500 italic">Sem novos avisos</p>
                    <p className="text-[10px] text-gray-600 uppercase">Tudo em dia na RS Top Team</p>
                 </div>
               )}
            </div>
            <button className="mt-4 text-[10px] font-bold text-gray-500 hover:text-white transition-colors flex items-center gap-1">
              Ver todos os avisos <ChevronRight size={14} />
            </button>
          </div>
        </motion.div>
      </div>

      {/* ── MIDDLE SECTION: FEATURES ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* CONTRATO & SEGURANÇA */}
        <motion.div variants={itemVariants} className="md:col-span-2 bg-[#111] border border-white/5 rounded-3xl p-6 flex flex-col md:flex-row gap-8 items-center">
            <div className="flex-1 space-y-4">
               <div>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest">Status: Ativo & Seguro</span>
                  <h4 className="text-xl font-black text-white mt-2">Contrato Digital Ativo</h4>
                  <p className="text-xs text-gray-500 leading-relaxed mt-2">
                    Seu termo de adesão e contrato de prestação de serviços está assinado eletronicamente com validade jurídica via **Lei 14.063/2020**.
                  </p>
               </div>
               
               <div className="grid grid-cols-2 gap-3 text-[10px] font-bold text-gray-400 uppercase tracking-tight">
                  <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/5 border border-white/5">
                     <span className="text-gray-600">IP de Registro</span>
                     <span className="text-white">187.32.XX.XX</span>
                  </div>
                  <div className="flex flex-col gap-1 p-3 rounded-xl bg-white/5 border border-white/5">
                     <span className="text-gray-600">Navegador</span>
                     <span className="text-white">Chrome/Mobile</span>
                  </div>
               </div>

               <button className="w-full py-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold text-xs transition-all flex items-center justify-center gap-2">
                 <FileText size={16} /> Baixar Cópia do Contrato
               </button>
            </div>

            <div className="w-full md:w-48 aspect-square rounded-3xl bg-white/5 border border-dashed border-white/10 flex flex-col items-center justify-center p-6 text-center group cursor-pointer hover:border-emerald-500/20 transition-all">
                <ShieldCheck size={40} className="text-emerald-500 mb-3 group-hover:scale-110 transition-transform" />
                <p className="text-[10px] font-black text-white uppercase tracking-wider">Assinatura Certificada</p>
                <p className="text-[9px] text-gray-600 mt-1">Selo de Validade RS Top Team</p>
            </div>
        </motion.div>

        {/* DOCUMENTOS QR CODE / QUICK ACTIONS */}
        <motion.div variants={itemVariants} className="bg-primary/5 border border-primary/20 rounded-3xl p-6 flex flex-col justify-between">
           <div>
              <SectionTitle title="Ações Rápidas" icon={Zap} />
              <div className="space-y-2">
                 <button className="w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center gap-3 text-left transition-all group">
                    <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                       <ClipboardCheck size={18} />
                    </div>
                    <div className="flex-1">
                       <p className="text-xs font-bold text-white">Enviar Atestado</p>
                       <p className="text-[9px] text-gray-500">Vencimento em 120 dias</p>
                    </div>
                    <ChevronRight size={14} className="text-gray-700 group-hover:text-white" />
                 </button>
                 
                 <button className="w-full p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 flex items-center gap-3 text-left transition-all group">
                    <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                       <Smartphone size={18} />
                    </div>
                    <div>
                       <p className="text-xs font-bold text-white">Check-in PWA</p>
                       <p className="text-[9px] text-gray-500">Acesso via QR Code</p>
                    </div>
                    <ChevronRight size={14} className="text-gray-700 ml-auto group-hover:text-white" />
                 </button>
              </div>
           </div>
           
           <div className="mt-6 flex items-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/10">
              <AlertCircle size={14} className="text-primary shrink-0" />
              <p className="text-[9px] text-primary font-bold uppercase tracking-tight">Mantenha seus documentos em dia para treinar.</p>
           </div>
        </motion.div>

      </div>

      {/* ── TIMELINE GRADUAÇÃO ── */}
      <motion.div variants={itemVariants} className="bg-[#111] border border-white/5 rounded-3xl p-6">
        <SectionTitle title="Minha Jornada" icon={History} color="text-purple-400" />
        <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-8 relative">
           {/* Connecting Line */}
           <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-white/5 hidden md:block" />
           
           {[
             { label: 'Ingresso', date: user?.createdAt ? (typeof user.createdAt === 'string' || typeof user.createdAt === 'number' ? new Date(user.createdAt).toLocaleDateString('pt-BR') : user.createdAt.toDate().toLocaleDateString('pt-BR')) : 'Jan 2024', status: 'done', bg: 'bg-emerald-500' },
             { label: '1º Grau', date: 'Mar 2024', status: 'done', bg: 'bg-emerald-500' },
             { label: '2º Grau', date: 'Maio 2024', status: 'current', bg: 'bg-primary animate-pulse' },
             { label: '3º Grau', date: 'Previsto: Jul', status: 'future', bg: 'bg-white/10' },
             { label: 'Próxima Faixa', date: 'Previsto: Set', status: 'future', bg: 'bg-white/10' },
           ].map((step, i) => (
             <div key={i} className="flex flex-col items-center gap-3 relative z-10 bg-[#111] px-4">
                <div className={`w-8 h-8 rounded-full ${step.bg} border-4 border-[#111] flex items-center justify-center shadow-lg shadow-black/50`}>
                  {step.status === 'done' && <CheckCircle2 size={12} className="text-white" />}
                </div>
                <div className="text-center">
                   <p className={`text-xs font-black uppercase tracking-tighter ${step.status === 'done' ? 'text-white' : 'text-gray-600'}`}>{step.label}</p>
                   <p className="text-[9px] text-gray-500 font-bold mt-1 uppercase">{step.date}</p>
                </div>
             </div>
           ))}
        </div>
      </motion.div>

      {/* ── BOTTOM SECTION: SEGURANÇA & APP ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* DADOS SEGUROS BANNERS */}
        <motion.div variants={itemVariants} className="bg-emerald-500/5 border border-emerald-500/20 rounded-3xl p-6 flex items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center shrink-0">
            <ShieldCheck size={28} className="text-emerald-500" />
          </div>
          <div>
            <h4 className="text-white font-bold leading-tight">Seus dados estão seguros</h4>
            <p className="text-xs text-gray-500 mt-1">Criptografia de ponta a ponta e pagamentos via Asaas com certificação PCI-DSS.</p>
          </div>
        </motion.div>

        {/* INSTALE NO CELULAR */}
        <motion.div variants={itemVariants} className="bg-primary/5 border border-primary/20 rounded-3xl p-6 flex items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Smartphone size={28} className="text-primary" />
          </div>
          <div className="flex-1">
            <h4 className="text-white font-bold leading-tight">Instale no seu celular</h4>
            <p className="text-xs text-gray-500 mt-1">Adicione à tela inicial para acesso rápido e funcionamento offline.</p>
          </div>
          <button className="bg-primary/10 hover:bg-primary/20 text-primary p-2 rounded-xl transition-colors">
            <Download size={20} />
          </button>
        </motion.div>
      </div>

      {/* ── HORÁRIOS PREVIEW ── */}
      <motion.div variants={itemVariants} className="bg-[#111] border border-white/5 rounded-3xl overflow-hidden">
        <div className="p-6 border-b border-white/5 bg-black/40 flex justify-between items-center">
          <SectionTitle title="Horários das Suas Turmas" icon={Calendar} />
          <span className="text-[10px] font-bold text-gray-500">2 Turmas Ativas</span>
        </div>
        <div className="divide-y divide-white/5">
          <div className="p-5 flex items-center justify-between group cursor-pointer hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center font-bold text-primary">JJ</div>
              <div>
                <p className="text-white font-bold text-sm">Jiu-Jitsu Adulto</p>
                <p className="text-xs text-gray-600 mt-0.5">Seg, Qua, Sex às 19:30 • Prof. Max</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="px-2 py-1 rounded text-[9px] font-black bg-emerald-500/10 text-emerald-400 uppercase tracking-widest">Tem aula hoje</span>
              <ChevronRight size={18} className="text-gray-700" />
            </div>
          </div>
          
          <div className="p-5 flex items-center justify-between group cursor-pointer hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-yellow-400/10 flex items-center justify-center font-bold text-yellow-500">BX</div>
              <div>
                <p className="text-white font-bold text-sm">Boxe Iniciante</p>
                <p className="text-xs text-gray-600 mt-0.5">Ter, Qui às 18:00 • Prof. André</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="px-2 py-1 rounded text-[9px] font-black bg-white/5 text-gray-600 uppercase tracking-widest transition-colors group-hover:text-gray-400">Próxima: Terça</span>
              <ChevronRight size={18} className="text-gray-700" />
            </div>
          </div>
        </div>
      </motion.div>

    </motion.div>
  )
}

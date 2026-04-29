import React, { useState, useMemo, useEffect } from 'react'
import {
  Home, Calendar, Clock, Award, Users,
  PlusCircle, BookOpen, MessageSquare, StickyNote,
  BarChart3, ChevronRight, PlayCircle, Eye,
  Filter, Search, Send, Settings, Smartphone,
  Zap, TrendingUp, Activity, CheckCircle2,
  AlertCircle, History, Info
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useStudents } from '../../hooks/useStudents'
import { useTodaySessions } from '../../hooks/useTodaySessions'
import { useNotices } from '../../hooks/useNotices'
import { useDashboardStats } from '../../hooks/useDashboardStats'
import { useFinance } from '../../hooks/useFinance'
import {
  collection, query, where, getDocs,
  addDoc, serverTimestamp, doc, updateDoc,
  onSnapshot, orderBy, limit
} from 'firebase/firestore'
import { db } from '../../firebase/config'
import PageHeader from '../../components/shared/PageHeader'
import SlideOver from '../../components/shared/SlideOver'
import { beltConfig } from '../../data/beltConfig'
import { motion, AnimatePresence } from 'framer-motion'
import { useTeacherIntelligence } from '../../hooks/useTeacherIntelligence'
import IntelligenceSection from './components/IntelligenceSection'

// ── Shared Components ─────────────────────────────────────────

function Card({ children, className = '', title, subtitle, icon: Icon, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card rounded-[32px] border border-white/5 overflow-hidden flex flex-col bg-[#080808]/40 backdrop-blur-md shadow-2xl ${className}`}
    >
      {(title || subtitle || Icon) && (
        <div className="px-6 pt-6 flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
              {Icon && <Icon size={18} strokeWidth={2} className="text-primary" />}
            </div>
            <div>
              <h3 className="text-xs font-black uppercase tracking-[0.15em] text-white leading-none">{title}</h3>
              {subtitle && <p className="text-[10px] text-gray-500 mt-1.5 uppercase font-bold tracking-widest">{subtitle}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      <div className="flex-1 px-6 pb-6">
        {children}
      </div>
    </motion.div>
  )
}

function StatMini({ label, value, icon: Icon, colorClass = "text-white", desc }) {
  return (
    <motion.div
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      className="kpi-card stat-card flex flex-col p-6 rounded-[32px] relative overflow-hidden group h-[160px] border border-white/5 bg-[#0c0c0c]/50 hover:bg-[#0f0f0f] transition-all cursor-default shadow-xl"
    >
      {/* Glow sutil ao fundo no hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Linha de topo: caixinha de ícone + título */}
      <div className="flex items-center gap-3 mb-auto relative z-10 w-full">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/[0.05] border border-white/[0.08] shrink-0 group-hover:border-primary/20 transition-colors">
          {Icon && <Icon size={16} strokeWidth={2.5} className="text-primary" />}
        </div>
        <span className="text-[10px] uppercase tracking-[0.25em] font-black text-gray-500 group-hover:text-gray-400 transition-colors leading-tight">
          {label}
        </span>
      </div>

      {/* Valor + Descrição */}
      <div className="relative z-10 flex flex-col pt-4">
        <div className={`text-3xl lg:text-4xl font-black mb-1.5 tracking-tighter ${colorClass} animate-value-reveal`}>
          {value}
        </div>
        {desc && (
          <p className="text-[10px] text-gray-600 leading-tight font-bold tracking-wide uppercase">
            {desc}
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ── Main Module ──────────────────────────────────────────────

export default function TeacherDashboard() {
  const { user, userData, effectiveRole } = useAuth()
  const isPowerUser = effectiveRole === 'admin' || effectiveRole === 'gestor'
  const [activeTab, setActiveTab] = useState('dashboard') // dashboard, aulas, historico, notas, turmas
  const { students } = useStudents()
  const { sessions: todaySessions, loading: loadingToday } = useTodaySessions(isPowerUser ? null : user?.uid)
  const { notices, loading: loadingNotices, addNotice } = useNotices()
  const { data: stats, loading: loadingStats } = useDashboardStats('Mês', isPowerUser ? null : user?.uid)
  const { bills } = useFinance()
  const intelligence = useTeacherIntelligence()

  // Mapa: studentId -> status financeiro (sem expor valores)
  // Professor só vê 'ok' | 'pendente' | 'atrasado'
  const statusFinanceiro = useMemo(() => {
    const mapa = {}
    bills.forEach(b => {
      const atual = mapa[b.studentId]
      // Prioridade: atrasado > pendente > ok
      if (b.status === 'overdue') mapa[b.studentId] = 'atrasado'
      else if (b.status === 'pending' && atual !== 'atrasado') mapa[b.studentId] = 'pendente'
      else if (!atual) mapa[b.studentId] = 'ok'
    })
    return mapa
  }, [bills])

  // Local state for features
  const [notes, setNotes] = useState([])
  const [loadingNotes, setLoadingNotes] = useState(true)
  const [showNoteModal, setShowNoteModal] = useState(false)
  const [newNote, setNewNote] = useState({ title: '', content: '', category: 'alunos' })
  const [selectedSession, setSelectedSession] = useState(null)
  const [announcement, setAnnouncement] = useState({ title: '', content: '', difficulty: 'Iniciante' })

  // 1. Fetch Teacher-Specific Notes
  useEffect(() => {
    if (!user?.uid) return
    const q = query(
      collection(db, 'teachers', user.uid, 'notes'),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(q, (snap) => {
      setNotes(snap.docs.map(d => ({ id: d.id, ...d.data() })))
      setLoadingNotes(false)
    })
    return () => unsub()
  }, [user?.uid])

  // 2. Computed Stats for Teacher
  const teacherStats = useMemo(() => {
    return {
      classesTaught: stats?.sessions?.length || 0,
      totalStudents: students?.length || 0,
      avgAttendance: stats?.retentionRate || 0,
      techniques: notices?.filter(n => n.type === 'technique' || n.category === 'técnica').length || 0
    }
  }, [stats, students, notices])

  // 3. Handlers
  const handleAddNote = async (e) => {
    e.preventDefault()
    if (!newNote.title || !newNote.content) return
    try {
      await addDoc(collection(db, 'teachers', user.uid, 'notes'), {
        ...newNote,
        createdAt: serverTimestamp(),
      })
      setNewNote({ title: '', content: '', category: 'alunos' })
      setShowNoteModal(false)
    } catch (err) {
      console.error("Error adding note:", err)
    }
  }

  const handlePostAnnouncement = async (e) => {
    e.preventDefault()
    if (!announcement.title || !announcement.content) return
    try {
      await addNotice({
        ...announcement,
        authorId: user.uid,
        authorName: userData?.name || 'Instrutor',
        type: 'technique',
        category: 'técnica',
        createdAt: new Date().toISOString()
      })
      setAnnouncement({ title: '', content: '', difficulty: 'Iniciante' })
      alert("Comunicado enviado com sucesso!")
    } catch (err) {
      console.error("Error posting announcement:", err)
    }
  }

  // ── Render Helpers ──────────────────────────────────────────

  const renderDashboard = () => (
    <div className="space-y-6 fade-slide-up">
      {/* Resumo Integrado Premium (Inspirado nas imagens de referência) */}
      <IntelligenceSection data={intelligence} userName={userData?.name || 'Professor'} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Agenda */}
        <Card title="Agenda de Hoje" subtitle="Aulas regulares e experimentais" icon={Calendar}>
          <div className="space-y-3">
            {todaySessions.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-gray-500 text-sm">Nenhuma aula agendada para hoje.</p>
              </div>
            ) : (
              todaySessions.map(sess => (
                <div key={sess.id} className="group flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all cursor-pointer"
                  onClick={() => setSelectedSession(sess)}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-black text-xs shadow-lg shadow-primary/5">
                      {sess.time?.split(':')[0]}h
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white group-hover:text-primary transition-colors">{sess.classTitle || sess.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">{sess.modality || 'Regular'}</span>
                        {sess.isExperimental && <span className="text-[9px] font-black bg-primary/10 text-primary px-2 py-0.5 rounded border border-primary/20 uppercase tracking-tighter">Experimental</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-lg font-black text-white leading-none">{sess.presentes || 0}</p>
                      <p className="text-[8px] text-gray-600 uppercase font-black tracking-widest mt-1">Check-ins</p>
                    </div>
                    <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-gray-600 group-hover:text-white transition-all">
                      <ChevronRight size={16} />
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Quick action button */}
            <button
              onClick={() => setActiveTab('aulas')}
              className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest transition-all"
            >
              <PlusCircle size={16} /> Ver Grade Completa
            </button>
          </div>
        </Card>

        {/* Announcements Preview */}
        <Card title="Comunicados de Técnica" subtitle="Avise seus alunos" icon={MessageSquare}>
          <div className="space-y-4">
            <div className="bg-emerald-500/5 border border-emerald-500/10 rounded-xll p-5">
              <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3">Postar nova técnica</h4>
              <form onSubmit={handlePostAnnouncement} className="space-y-3">
                <input
                  type="text"
                  placeholder="Título (ex: Raspagem de Meia Guarda)"
                  className="w-full bg-black border border-white/10 rounded-xll px-4 py-2.5 text-sm focus:border-emerald-500/50 transition-all outline-none"
                  value={announcement.title}
                  onChange={e => setAnnouncement(p => ({ ...p, title: e.target.value }))}
                />
                <textarea
                  placeholder="O que será ensinado?"
                  rows="2"
                  className="w-full bg-black border border-white/10 rounded-xll px-4 py-2.5 text-sm focus:border-emerald-500/50 transition-all outline-none resize-none"
                  value={announcement.content}
                  onChange={e => setAnnouncement(p => ({ ...p, content: e.target.value }))}
                />
                <div className="flex gap-2">
                  <select
                    className="bg-black border border-white/10 rounded-xll px-3 text-xs focus:border-emerald-500/50 transition-all outline-none"
                    value={announcement.difficulty}
                    onChange={e => setAnnouncement(p => ({ ...p, difficulty: e.target.value }))}
                  >
                    <option value="Iniciante">Iniciante</option>
                    <option value="Intermediário">Intermediário</option>
                    <option value="Avançado">Avançado</option>
                  </select>
                  <button type="submit" className="flex-1 bg-primary hover:opacity-90 text-black font-black text-[10px] uppercase tracking-widest py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-primary/20">
                    <Send size={14} /> Enviar p/ Alunos
                  </button>
                </div>
              </form>
            </div>

            <div className="space-y-3">
              <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Últimos comunicados</h4>
              {notices.slice(0, 2).map((n, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xll bg-white/[0.02] border border-white/5">
                  <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                    <Info size={14} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-white">{n.title}</p>
                    <p className="text-[11px] text-gray-500 line-clamp-1">{n.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* PWA Promo Card */}
      <div className="glass-card rounded-xll overflow-hidden border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 to-transparent p-6 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xll bg-emerald-500 text-black flex items-center justify-center shrink-0 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
            <Smartphone size={24} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Acesse de qualquer lugar</h3>
            <p className="text-xs text-gray-400 mt-1 max-w-sm">Instale o app na tela inicial do seu celular para uma experiência mais fluida e acesso offline aos seus planos de aula.</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-tighter bg-emerald-500/10 px-2 py-0.5 rounded">Ocupa menos de 1MB</span>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Configurações &gt; Adicionar à tela inicial</p>
        </div>
      </div>
    </div>
  )

  const renderAulas = () => (
    <div className="space-y-6 fade-slide-up">
      <Card title="Controle de Horários" subtitle="Grade diária sincronizada" icon={Clock}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-xs font-bold text-white uppercase tracking-widest">Aulas do Dia ({todaySessions.length})</p>
            </div>
            <div className="flex gap-2">
              <button className="p-2 rounded-xll bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all"><Filter size={16} /></button>
              <button className="p-2 rounded-xll bg-white/5 border border-white/10 text-gray-400 hover:text-white transition-all"><Search size={16} /></button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {todaySessions.map((sess, idx) => (
              <div key={idx} className="group relative flex flex-col p-5 rounded-xll bg-white/5 border border-white/5 hover:border-white/15 transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xll bg-black border border-white/5 flex flex-col items-center justify-center">
                    <span className="text-xs font-black text-white">{sess.time?.split(':')[0]}</span>
                    <span className="text-[8px] font-bold text-gray-500 uppercase">hrs</span>
                  </div>
                  <div className="flex flex-col items-end">
                    {sess.isExperimental ? (
                      <span className="text-[9px] font-black bg-primary/20 text-primary px-2 py-0.5 rounded-full uppercase border border-primary/20">Experimental</span>
                    ) : (
                      <span className="text-[9px] font-black bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full uppercase border border-emerald-500/20">Regular</span>
                    )}
                    <span className="text-[9px] text-gray-600 mt-1 uppercase font-bold tracking-widest">{sess.date}</span>
                  </div>
                </div>

                <h4 className="text-lg font-bold text-white mb-1">{sess.classTitle || sess.title}</h4>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-6">{sess.modality || 'Sem modalidade'}</p>

                <div className="mt-auto flex items-center justify-between pt-4 border-t border-white/5">
                  <div className="flex flex-col">
                    <span className="text-lg font-black text-white animate-value-reveal">{sess.presentes || 0}</span>
                    <span className="text-[9px] text-gray-600 uppercase font-bold">Presentes</span>
                  </div>
                  <button className="px-4 py-2 rounded-xll bg-white/[0.03] border border-white/10 text-[10px] font-black uppercase text-white hover:bg-white/10 transition-all flex items-center gap-2">
                    <PlayCircle size={14} /> Iniciar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Historical Stats Table Placeholder or similar integrated info */}
      <Card title="Aulas Experimentais Agendadas" subtitle="Não perca potenciais alunos" icon={Activity}>
        <div className="space-y-3">
          {todaySessions.filter(s => s.isExperimental).length === 0 ? (
            <p className="text-center text-gray-600 text-sm py-10">Nenhuma aula experimental para hoje.</p>
          ) : (
            todaySessions.filter(s => s.isExperimental).map((ex, i) => (
              <div key={i} className="flex items-center justify-between p-4 rounded-xll bg-primary/5 border border-primary/10">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-primary/20 text-primary flex items-center justify-center font-black">EX</div>
                  <div>
                    <p className="text-sm font-bold text-white uppercase tracking-wide">Experimental às {ex.time}</p>
                    <p className="text-xs text-gray-500">{ex.note || 'Aluno interessado em conhecer a academia'}</p>
                  </div>
                </div>
                <button className="text-primary hover:underline text-[10px] font-black uppercase">Ver Perfil</button>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )

  const renderNotas = () => (
    <div className="space-y-6 fade-slide-up">
      <Card
        title="Anotações Pessoais"
        subtitle="Privadas para você e gestores"
        icon={StickyNote}
        action={
          <button onClick={() => setShowNoteModal(true)} className="flex items-center gap-2 px-4 py-2 rounded-xll bg-emerald-500 text-black font-black text-[10px] uppercase hover:bg-emerald-600 transition-all shadow-lg shadow-emerald-500/20">
            <PlusCircle size={16} /> Nova Nota
          </button>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loadingNotes ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xll" />)
          ) : notes.length === 0 ? (
            <div className="col-span-full py-20 text-center">
              <StickyNote size={40} className="mx-auto text-gray-700 mb-4 opacity-30" />
              <p className="text-gray-500 text-sm">Organize suas observações aqui.</p>
            </div>
          ) : notes.map(note => (
            <div key={note.id} className="group p-5 rounded-xll bg-white/5 border border-white/5 hover:border-white/15 transition-all relative">
              <div className="flex justify-between items-start mb-3">
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${note.category === 'alunos' ? 'bg-blue-500/20 text-blue-400' :
                  note.category === 'técnica' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-purple-500/20 text-purple-400'
                  }`}>
                  {note.category}
                </span>
                <span className="text-[9px] text-gray-600 font-bold uppercase">{note.createdAt?.toDate ? note.createdAt.toDate().toLocaleDateString() : 'Recent'}</span>
              </div>
              <h4 className="text-sm font-bold text-white mb-2 group-hover:text-emerald-400 transition-colors">{note.title}</h4>
              <p className="text-xs text-gray-500 line-clamp-4 leading-relaxed">{note.content}</p>

              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button className="p-1.5 rounded-lg bg-black/50 text-gray-400 hover:text-white transition-all"><Settings size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Security Info Card */}
      <div className="p-4 rounded-xll bg-orange-500/5 border border-orange-500/10 flex items-start gap-4">
        <AlertCircle size={20} className="text-orange-500 shrink-0 mt-0.5" />
        <div>
          <h4 className="text-xs font-bold text-white uppercase tracking-widest mb-1">Dados Seguros</h4>
          <p className="text-[11px] text-gray-500 leading-relaxed italic">Suas informações e planos de aula são protegidos com criptografia no Firestore. Apenas você e os administradores de alto nível ({user?.email}) têm acesso aos seus dados pessoais e anotações.</p>
        </div>
      </div>
    </div>
  )

  const renderHistorico = () => (
    <div className="space-y-6 fade-slide-up">
      <Card title="Histórico de Aulas" subtitle="Consulte sessões anteriores" icon={History}>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-separate border-spacing-y-3">
            <thead>
              <tr className="text-[10px] text-gray-500 uppercase tracking-widest font-bold">
                <th className="px-4 py-2">Data</th>
                <th className="px-4 py-2">Turma / Modalidade</th>
                <th className="px-4 py-2 text-center">Alunos</th>
                <th className="px-4 py-2 text-center">Status</th>
                <th className="px-4 py-2 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.sessions || []).map((s, i) => (
                <tr key={i} className="group bg-white/5 hover:bg-white/[0.08] transition-all cursor-pointer border border-white/5 rounded-xll">
                  <td className="px-4 py-4 first:rounded-l-2xl">
                    <p className="text-sm font-bold text-white">{s.date}</p>
                    <p className="text-[10px] text-gray-600 mt-0.5">{s.time || '—'}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm font-bold text-white">{s.classTitle || s.title || 'Aula'}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5 uppercase tracking-widest">{s.modality || 'Regular'}</p>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <span className="text-lg font-black text-emerald-400 animate-value-reveal">{s.presencasCount}</span>
                      <span className="text-[9px] text-gray-600 uppercase font-bold">Presentes</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="text-[10px] font-black px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-400 uppercase tracking-tighter border border-emerald-500/20">Finalizada</span>
                  </td>
                  <td className="px-4 py-4 last:rounded-r-2xl text-right">
                    <button className="p-2 rounded-xll bg-white/5 text-gray-500 group-hover:text-white transition-all"><Eye size={18} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(stats?.sessions || []).length === 0 && (
            <div className="py-20 text-center">
              <History size={40} className="mx-auto text-gray-700 mb-4 opacity-30" />
              <p className="text-gray-500 text-sm">Seu histórico aparecerá aqui após as aulas.</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  )

  const renderTurmas = () => (
    <div className="space-y-6 fade-slide-up">
      <Card title="Minhas Turmas Ativas" subtitle="Lista de alunos e horários" icon={Users}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Example turmas using active students filter */}
          {['Jiu Jitsu', 'Boxe'].map((mod, i) => {
            const turmStudents = (students || []).filter(s => s.modality === mod && s.status === 'ativo')
            return (
              <div key={i} className="p-5 rounded-xll bg-white/5 border border-white/5 hover:border-white/10 transition-all flex flex-col">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xll flex items-center justify-center text-xl font-black ${i === 0 ? 'bg-primary text-black shadow-[0_0_20px_rgba(255,0,0,0.3)]' : 'bg-yellow-400 text-black shadow-[0_0_20px_rgba(250,204,21,0.3)]'}`}>
                      {mod.charAt(0)}
                    </div>
                    <div>
                      <h4 className="text-lg font-bold text-white">{mod} Profissional</h4>
                      <p className="text-[10px] text-gray-500 uppercase tracking-widest">Segunda, Quarta e Sexta • 19h</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-white animate-value-reveal">{turmStudents.length}</p>
                    <p className="text-[10px] text-gray-600 uppercase">Matriculados</p>
                  </div>
                </div>

                {/* Mini-lista de alunos com badge de situação financeira */}
                <div className="space-y-1.5 mb-6 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                  {turmStudents.slice(0, 8).map((st, idx) => {
                    const situacao = statusFinanceiro[st.id]
                    return (
                      <div key={idx} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg hover:bg-white/5 transition-colors group">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-white/10 border border-white/5 flex items-center justify-center font-bold text-[10px] text-gray-400 shrink-0">
                            {st.name?.charAt(0)}
                          </div>
                          <span className="text-[11px] text-gray-300 font-medium truncate">{st.name?.split(' ')[0]}</span>
                        </div>
                        {/* Badge: só texto/cor, sem valores */}
                        {situacao === 'atrasado' && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20 uppercase tracking-tight shrink-0">
                            Atrasado
                          </span>
                        )}
                        {situacao === 'pendente' && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-primary/15 text-primary/80 border border-primary/20 uppercase tracking-tight shrink-0">
                            Pendente
                          </span>
                        )}
                        {(situacao === 'ok' || !situacao) && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 uppercase tracking-tight shrink-0">
                            Em dia
                          </span>
                        )}
                      </div>
                    )
                  })}
                  {turmStudents.length > 8 && (
                    <p className="text-[9px] text-gray-600 text-center pt-1 font-bold uppercase tracking-widest">+{turmStudents.length - 8} alunos</p>
                  )}
                </div>

                <div className="mt-auto grid grid-cols-2 gap-2">
                  <button className="py-2.5 rounded-xll bg-white/5 border border-white/10 text-[10px] font-black uppercase text-white hover:bg-white/10 transition-all">Ver Alunos</button>
                  <button className="py-2.5 rounded-xll bg-primary text-black text-[10px] font-black uppercase hover:opacity-90 transition-all">Enviar Aviso</button>
                </div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Search Aluno Quick */}
      <div className="glass-card p-6 rounded-xll border border-white/10">
        <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-4 flex items-center gap-2">
          <Search size={16} /> Busca Rápida de Aluno
        </h3>
        <div className="relative">
          <input
            type="text"
            placeholder="Nome ou CPF do aluno..."
            className="w-full bg-white/5 border border-white/5 hover:border-white/15 rounded-xll px-5 py-4 text-sm transition-all focus:bg-white/10 focus:border-emerald-500/30 outline-none pr-12"
          />
          <button className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <PageHeader
        icon={UserIcon}
        title={`Instrutor ${userData?.name?.split(' ')[0] || 'Professor'}`}
        subtitle="Portal de Ensino e Gestão Técnicas"
      />

      <div className="px-4 md:px-6 py-6 space-y-8 w-full pb-24">
        {/* Tabs Suavizados (Design Premium) */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 bg-white/5 p-1 rounded-2xl border border-white/5 backdrop-blur-sm shadow-xl">
            {[
              { id: 'dashboard', label: 'Visão Geral', icon: Home },
              { id: 'aulas', label: 'Meu Dia', icon: PlayCircle },
              { id: 'turmas', label: 'Turmas', icon: Users },
              { id: 'historico', label: 'Histórico', icon: History }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all
                  ${activeTab === tab.id
                    ? 'bg-primary text-black shadow-lg shadow-primary/20 scale-105'
                    : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
              >
                <tab.icon size={14} strokeWidth={2.5} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => setActiveTab('notas')}
            className={`p-2.5 rounded-xl border transition-all ${activeTab === 'notas' ? 'bg-amber-500/20 border-amber-500/50 text-amber-500' : 'bg-white/5 border-white/5 text-gray-500 hover:bg-white/10'}`}
            title="Anotações"
          >
            <StickyNote size={20} />
          </button>
        </div>

        {/* Dynamic Content */}
        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'aulas' && renderAulas()}
        {activeTab === 'turmas' && renderTurmas()}
        {activeTab === 'historico' && renderHistorico()}
        {activeTab === 'notas' && renderNotas()}
      </div>

      {/* Note Creation Modal */}
      <SlideOver
        isOpen={showNoteModal}
        onClose={() => setShowNoteModal(false)}
        title="Nova Anotação Pessoal"
        subtitle="Escolha a categoria e registre os dados"
        width="max-w-md"
      >
        <form onSubmit={handleAddNote} className="p-6 space-y-5">
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Título</label>
            <input
              required
              type="text"
              className="w-full bg-white/5 border border-white/10 rounded-xll px-4 py-3 text-sm focus:border-emerald-500/50 outline-none transition-all"
              placeholder="Ex: Observação sobre João Silva"
              value={newNote.title}
              onChange={e => setNewNote(p => ({ ...p, title: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Categoria</label>
            <div className="grid grid-cols-3 gap-2">
              {['alunos', 'técnica', 'geral'].map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setNewNote(p => ({ ...p, category: cat }))}
                  className={`py-2 rounded-xll text-[10px] font-black uppercase transition-all border ${newNote.category === cat ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400' : 'bg-white/5 border-white/5 text-gray-500'
                    }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Conteúdo</label>
            <textarea
              required
              rows="6"
              className="w-full bg-white/5 border border-white/10 rounded-xll px-4 py-3 text-sm focus:border-emerald-500/50 outline-none transition-all resize-none"
              placeholder="Digite suas observações detalhadas aqui..."
              value={newNote.content}
              onChange={e => setNewNote(p => ({ ...p, content: e.target.value }))}
            />
          </div>

          <button type="submit" className="w-full py-4 rounded-xll bg-emerald-500 text-black font-black text-xs uppercase hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 mt-4">
            Salvar Anotação
          </button>
        </form>
      </SlideOver>

      {/* Session Details / Drawer integration */}
      <SlideOver
        isOpen={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        title={selectedSession?.classTitle || 'Sessão'}
        subtitle={`${selectedSession?.date} • ${selectedSession?.time}`}
      >
        <div className="p-6 space-y-6">
          <div className="bg-white/5 rounded-xll p-4 border border-white/5">
            <div className="flex justify-between items-center mb-4">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Início da Aula</span>
              <span className="text-xs font-bold text-white uppercase">{selectedSession?.time}</span>
            </div>
            <div className="flex gap-4">
              <div className="flex-1 p-4 rounded-xll bg-black border border-white/5 text-center">
                <p className="text-2xl font-black text-emerald-400 animate-value-reveal">{selectedSession?.presentes || 0}</p>
                <p className="text-[9px] text-gray-600 uppercase font-bold">Presentes</p>
              </div>
              <div className="flex-1 p-4 rounded-xll bg-black border border-white/5 text-center">
                <p className="text-2xl font-black text-white animate-value-reveal">{selectedSession?.total || 0}</p>
                <p className="text-[9px] text-gray-600 uppercase font-bold">Inscritos</p>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest px-1">Controle de Aula</h4>
            <div className="grid grid-cols-1 gap-3">
              <button className="flex items-center gap-4 p-4 rounded-xll bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-left group">
                <div className="w-10 h-10 rounded-xll bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <Activity size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Registrar Desempenho</p>
                  <p className="text-[10px] text-gray-500 uppercase">Avaliar turmas e técnicos</p>
                </div>
                <ChevronRight size={18} className="ml-auto text-gray-700 group-hover:text-white transition-all" />
              </button>

              <button className="flex items-center gap-4 p-4 rounded-xll bg-white/5 border border-white/5 hover:bg-white/10 transition-all text-left group">
                <div className="w-10 h-10 rounded-xll bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                  <Award size={20} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">Graduações Rápidas</p>
                  <p className="text-[10px] text-gray-500 uppercase">Promover alunos nesta aula</p>
                </div>
                <ChevronRight size={18} className="ml-auto text-gray-700 group-hover:text-white transition-all" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button className="py-4 rounded-xll bg-emerald-500 text-black font-black text-xs uppercase hover:bg-emerald-600 transition-all">
              Abrir Lista Completa
            </button>
            <button onClick={() => setSelectedSession(null)} className="py-2 text-xs text-gray-500 hover:text-white transition-all">
              Fechar Detalhes
            </button>
          </div>
        </div>
      </SlideOver>
    </>
  )
}

function UserIcon({ size, className, color }) {
  return <Award size={size} className={className} color={color} />
}


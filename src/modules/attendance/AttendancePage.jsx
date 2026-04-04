// Resumo: Tela de chamada. Configura sessão (modalidade, data, horário, responsável), busca hora do servidor como base, salva sessão no Firestore e lista alunos filtrados por modalidade.
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays, Clock3, Plus, Users, X, History, Cake,
  Stethoscope, Trophy, AlertTriangle, Eye, ClipboardCheck,
  ChevronRight, Search, Check, Info, ArrowLeft, Filter, Calendar, Clock, User, ChevronDown
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { useApp } from '../../context/AppContext'
import { useStudents } from '../../hooks/useStudents'
import { useModalities } from '../../hooks/useModalities'
import { useSystemUsers } from '../../hooks/useSystemUsers'
import { collection, getDocs, query, orderBy, limit, doc, getDoc } from 'firebase/firestore'
import { db } from '../../firebase/config'
import { beltConfig } from '../../data/beltConfig'
import { useAttendanceAlerts } from '../../hooks/useAttendanceAlerts'
import { attendanceService } from '../../services/attendanceService'
import PageHeader from '../../components/shared/PageHeader'
import MobileHeader from '../../components/navigation/MobileHeader'
import AddStudentModal from '../../components/shared/AddStudentModal'

const StudentAttendanceAlert = ({ student }) => {
  const { status, isLoading } = useAttendanceAlerts(student.id, student.createdAt)

  if (isLoading || status === 'active' || status === 'loading' || status === 'error') return null

  const config = {
    warning: {
      icon: <AlertTriangle size={14} className="text-yellow-500" />,
      bg: 'bg-yellow-500/10',
      textColor: 'text-yellow-500'
    },
    critical: {
      icon: <AlertTriangle size={14} className="text-red-500" />,
      bg: 'bg-red-500/10',
      textColor: 'text-red-500'
    }
  }

  const current = config[status]
  if (!current) return null

  return (
    <div className={`flex items-center gap-1 p-1 rounded-full ${current.bg}`}>
      {current.icon}
    </div>
  )
}

function formatInputDate(dateObj) {
  return dateObj.toISOString().slice(0, 10)
}

export default function AttendancePage() {
  const { currentModality, isAdminView, setCurrentModality } = useApp()
  const { students, isLoadingStudents, addStudent } = useStudents()
  const navigate = useNavigate()

  const [showModal, setShowModal] = useState(false)
  const [sessionProfessor, setSessionProfessor] = useState('Prof. Robson')
  const [sessionModality, setSessionModality] = useState(currentModality)
  const [sessionDate, setSessionDate] = useState(formatInputDate(new Date()))
  const [sessionTime, setSessionTime] = useState('20:00')
  const [activeSession, setActiveSession] = useState(null)
  const [isSavingSession, setIsSavingSession] = useState(false)
  const [searchActive, setSearchActive] = useState('')
  const [toastMessage, setToastMessage] = useState('')
  const [isFinishingSession, setIsFinishingSession] = useState(false)
  const [recentSessions, setRecentSessions] = useState([])
  const [sessionAttendance, setSessionAttendance] = useState({})
  const { modalities, loading: loadingModalities } = useModalities()
  const { users: staffMembers } = useSystemUsers()
  const [showMobileConfig, setShowMobileConfig] = useState(false)
  const [unmarkedAlert, setUnmarkedAlert] = useState(false)

  useEffect(() => {
    if (activeSession?.id) fetchAttendanceRecords(activeSession.id)
    else setSessionAttendance({})
  }, [activeSession?.id])

  async function fetchAttendanceRecords(sessionId) {
    try {
      const records = await attendanceService.getSessionAttendances(sessionId)
      setSessionAttendance(records)
    } catch (err) {
      console.error('Erro ao buscar registros de presença', err)
    }
  }

  useEffect(() => {
    fetchRecentSessions()
  }, [])

  useEffect(() => {
    setSessionModality(currentModality)
  }, [currentModality])

  async function fetchRecentSessions() {
    try {
      const q = query(collection(db, 'sessions'), orderBy('createdAt', 'desc'), limit(12))
      const snap = await getDocs(q)
      setRecentSessions(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error('Erro ao buscar histórico de sessões', err)
    }
  }

  const activeList = useMemo(() => {
    if (!activeSession) return []
    let list = students.filter(student => (student.modalities || [student.modality]).includes(activeSession.modality))
    if (searchActive) {
      list = list.filter(s => s.name.toLowerCase().includes(searchActive.toLowerCase()))
    }
    return list.map(student => ({
      ...student,
      status: sessionAttendance[student.id] || null
    }))
  }, [activeSession, students, searchActive, sessionAttendance])

  const stats = useMemo(() => {
    const present = activeList.filter(s => s.status === 'present').length
    const total = activeList.length
    return { present, total, pct: total ? Math.round((present / total) * 100) : 0 }
  }, [activeList])

  async function handleStartSession() {
    if (!sessionModality) {
      setToastMessage('Selecione uma modalidade primeiro')
      return
    }
    setIsSavingSession(true)
    try {
      const payload = {
        modality: sessionModality,
        date: sessionDate,
        time: sessionTime,
        professor: sessionProfessor,
      }
      const newSession = await attendanceService.createSession(payload)
      setActiveSession(newSession)
      fetchRecentSessions()
      setShowMobileConfig(false)
    } catch (err) {
      console.error('Erro ao criar sessão', err)
      setToastMessage('Erro ao iniciar. Verifique conexão.')
    } finally {
      setIsSavingSession(false)
    }
  }

  async function handleFinalizeSession() {
    const unmarked = activeList.filter(s => !s.status)
    if (unmarked.length > 0) {
      setUnmarkedAlert(true)
      setToastMessage(`Faltam ${unmarked.length} marcas na chamada!`)
      setTimeout(() => setUnmarkedAlert(false), 3000)
      return
    }

    setIsFinishingSession(true)
    try {
      await attendanceService.markAttendanceBatch(activeSession, activeList)
      setActiveSession(null)
      fetchRecentSessions()
      setToastMessage("Chamada finalizada com sucesso!")
    } catch (err) {
      console.error('Erro ao finalizar', err)
    } finally {
      setIsFinishingSession(false)
    }
  }

  function handleMark(id, status) {
    setSessionAttendance(prev => ({
      ...prev,
      [id]: prev[id] === status ? null : status
    }))
  }

  return (
    <div className="flex flex-col flex-1 w-full min-h-dvh bg-black overflow-x-hidden">
      <MobileHeader
        title={activeSession ? "Chamada Ativa" : "Canais de Chamada"}
        showBack={activeSession ? true : false}
        onBack={() => activeSession && setActiveSession(null)}
      />

      <PageHeader
        icon={ClipboardCheck}
        title="INICIAR CHAMADA"
        subtitle="NOVA SESSÃO"
        extra={
          isAdminView && (
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-[10px] text-[11px] font-bold uppercase tracking-widest shadow-xl">
              <Plus size={18} /> NOVO ALUNO
            </button>
          )
        }
      />
      <main className="flex-1 p-4 md:p-8 space-y-10 max-w-[1400px] mx-auto w-full pb-32">

        {!activeSession ? (
          <>
            {/* Header Description for Mobile Only or Sub-header */}
            {/* Centered Header Section */}
            <div className="flex flex-col items-center justify-center text-center space-y-8 mb-14 animate-entrance">
              {/* Circular Logo with Premium Glow */}
              <div className="relative">
                {/* Massive Soft Radial Glow */}
                <div className="absolute -inset-16 bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>
                <div className="absolute -inset-4 bg-primary/20 rounded-full blur-2xl animate-pulse"></div>
                
                <div className="relative w-32 h-32 md:w-36 md:h-36 rounded-full border-2 border-white/10 p-2.5 bg-[#080808] shadow-[0_0_50px_rgba(225,29,72,0.2)] flex items-center justify-center overflow-hidden">
                  <img 
                    src="/logo-nav.png" 
                    alt="RS Top Team" 
                    className="w-full h-full object-contain rounded-full transition-transform duration-700 hover:scale-110"
                  />
                  {/* Glass Shine Effect */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/5 to-transparent pointer-events-none"></div>
                </div>
              </div>

              <div className="space-y-3">
                <h2 className="text-5xl md:text-6xl font-black text-white tracking-[0.05em] uppercase font-display leading-[0.9] drop-shadow-2xl">
                  INICIAR CHAMADA
                </h2>
                <div className="flex items-center justify-center gap-4">
                  <div className="h-px w-12 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
                  <p className="text-gray-500 text-[10px] font-black uppercase tracking-[0.4em] opacity-80">Ambiente de Aula · Rs Top Team</p>
                  <div className="h-px w-12 bg-gradient-to-r from-transparent via-primary/50 to-transparent"></div>
                </div>
              </div>
            </div>

            {/* Modality Selection Grid - PC & MOBILE */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {loadingModalities ? (
                [1, 2, 3].map(i => <div key={i} className="h-44 bg-white/5 rounded-[12px] animate-pulse border border-white/5" />)
              ) : (
                modalities.filter(m => m.status === 'ativo').map(mod => (
                  <motion.button
                    key={mod.id}
                    whileTap={{ scale: 0.96 }}
                    whileHover={{ y: -5 }}
                    onClick={() => {
                      setSessionModality(mod.name)
                      setCurrentModality(mod.name)
                      if (window.innerWidth < 768) setShowMobileConfig(true)
                    }}
                    className={`stat-card p-12 rounded-[12px] flex flex-col items-center justify-center gap-3 relative overflow-hidden transition-all duration-500 group ${sessionModality === mod.name ? 'ring-2 ring-primary bg-primary/5 shadow-[0_0_30px_rgba(225,29,72,0.15)]' : ''}`}
                  >
                    <div className={`absolute top-5 right-5 w-7 h-7 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${sessionModality === mod.name ? 'border-primary bg-primary text-white scale-110 shadow-lg shadow-primary/40' : 'border-white/10 text-transparent opacity-0'}`}>
                      <Check size={14} strokeWidth={4} />
                    </div>

                    <div className="text-center group-hover:scale-105 transition-transform duration-700">
                      <p className="text-[9px] text-gray-500 font-black uppercase tracking-[0.25em] mb-2 group-hover:text-primary transition-colors">MODALIDADE</p>
                      <h3 className="text-4xl font-black text-white uppercase font-display tracking-tight leading-none">{mod.name}</h3>
                      <div className="mt-3 flex items-center justify-center">
                        <div className={`h-1 w-8 rounded-full transition-all duration-500 ${sessionModality === mod.name ? 'bg-primary w-12' : 'bg-white/10'}`}></div>
                      </div>
                    </div>

                    <p className="absolute bottom-5 text-[8px] text-gray-700 font-black uppercase tracking-[0.3em] group-hover:text-primary/40 transition-colors">SELECIONAR HORÁRIO</p>
                  </motion.button>
                ))
              )}
            </div>

            {/* Selection Form - Professors & Dates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-8">
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] ml-1">DATA DA AULA</label>
                <div className="relative group">
                  <Calendar size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-primary transition-colors" />
                  <input
                    type="date"
                    value={sessionDate}
                    onChange={e => setSessionDate(e.target.value)}
                    className="w-full bg-[#0d0d0d] border border-white/5 rounded-[12px] py-4 pl-12 pr-4 text-white text-sm focus:border-primary/40 transition-all outline-none font-medium"
                  />
                </div>
              </div>
              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] ml-1">RESPONSÁVEL</label>
                <div className="relative group">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-primary transition-colors" />
                  <select
                    value={sessionProfessor}
                    onChange={e => setSessionProfessor(e.target.value)}
                    className="w-full bg-[#0d0d0d] border border-white/5 rounded-[12px] py-4 pl-12 pr-10 text-white text-sm focus:border-primary/40 transition-all outline-none appearance-none font-medium"
                  >
                    {staffMembers.filter(s => s.role === 'professor' || s.role === 'admin').map(s => (
                      <option key={s.id} value={s.name} className="bg-[#111]">{s.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-600" />
                </div>
              </div>
            </div>

            {/* PC Start Action */}
            <div className="hidden md:flex justify-end gap-6 items-center animate-entrance pt-6">
              <p className="text-[9px] text-gray-600 font-black uppercase tracking-[0.25em]">Sessão: {new Date(sessionDate + 'T00:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
              <button
                onClick={handleStartSession}
                disabled={isSavingSession || !sessionModality}
                className="btn-primary min-w-[160px] py-2.5 flex items-center justify-center gap-2.5 relative overflow-hidden group shadow-xl shadow-primary/25 rounded-xl"
              >
                {isSavingSession ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus size={16} strokeWidth={3} />
                    <span className="text-[11px] font-black uppercase tracking-widest">INICIAR SESSÃO</span>
                  </>
                )}
              </button>
            </div>

            {/* History Section - MATCH IMAGE */}
            <div className="space-y-6 pt-10 border-t border-white/5">
              <div className="flex items-center justify-between">
                <h4 className="text-[11px] font-black uppercase text-white/40 tracking-[0.3em] flex items-center gap-2">
                  <History size={16} className="text-primary" />
                  HISTÓRICO DE AULAS
                </h4>
                <span className="text-[10px] text-gray-700 font-bold uppercase">{recentSessions.length} registros</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {recentSessions.map(s => (
                  <motion.div
                    key={s.id}
                    whileHover={{ y: -5 }}
                    className="p-6 rounded-[10px] bg-[#111]/40 border border-white/5 flex flex-col gap-6 group hover:border-primary/20 transition-all shadow-sm"
                  >
                    <div className="flex justify-between items-start">
                      <div className="p-2.5 rounded-[10px] bg-primary/10 text-primary">
                        <Trophy size={16} />
                      </div>
                      <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">#{s.seqId || '---'}</span>
                    </div>

                    <div className="flex-1">
                      <h5 className="font-bold text-white text-xl uppercase tracking-tight font-display">{s.modality}</h5>
                      <p className="text-[11px] text-gray-500 font-bold uppercase tracking-widest mt-1 opacity-70">{s.professor}</p>

                      <div className="flex items-center gap-4 mt-4 text-[10px] text-gray-400 font-semibold uppercase tracking-widest">
                        <div className="flex items-center gap-2">
                          <Calendar size={12} className="text-primary" />
                          {s.date ? new Date(s.date + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '--'}
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock size={12} className="text-primary" />
                          {s.time || '--:--'}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => navigate(`/attendance/review/${s.id}`)}
                      className="w-full py-3.5 rounded-[10px] bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/10 active:scale-95 transition-all flex items-center justify-center gap-2 group-hover:brightness-110"
                    >
                      <Eye size={14} />
                      Revisar Lista
                    </button>
                  </motion.div>
                ))}
              </div>
            </div>
          </>
        ) : (
          /* ACTIVE SESSION VIEW */
          <div className="space-y-6">
            <div className="p-8 rounded-[10px] bg-white/[0.03] border border-white/5 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[100px] rounded-full -mr-32 -mt-32" />
              <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1">
                  <p className="text-[10px] text-primary font-black uppercase tracking-[0.3em]">CHAMADA EM ANDAMENTO</p>
                  <h2 className="text-4xl font-black text-white uppercase tracking-tighter font-display leading-none">{activeSession.modality}</h2>
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-2">{activeSession.professor} · {activeSession.time}</p>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-5xl font-black text-white leading-none font-display">{stats.present}<span className="text-white/10">/{stats.total}</span></div>
                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mt-2">ALUNOS PRESENTES</p>
                  </div>
                  <div className="w-px h-12 bg-white/10 hidden md:block" />
                  <button
                    onClick={handleFinalizeSession}
                    disabled={isFinishingSession}
                    className="btn-primary py-5 px-10 flex items-center gap-3 active:scale-95 disabled:opacity-50 transition-all shadow-2xl shadow-primary/30"
                  >
                    {isFinishingSession ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Check size={20} strokeWidth={3} />
                        <span className="text-lg">FINALIZAR CHAMADA</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Search Input */}
            <div className="relative group max-w-md">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-primary transition-colors" />
              <input
                value={searchActive}
                onChange={e => setSearchActive(e.target.value)}
                placeholder="Pesquisar por nome do aluno..."
                className="w-full bg-[#111] border border-white/5 rounded-[10px] py-4 pl-12 pr-4 text-white text-sm focus:border-primary/40 transition-colors outline-none"
              />
            </div>

            {/* Student List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {activeList.map(student => (
                <motion.div
                  layout
                  key={student.id}
                  className={`p-5 rounded-[10px] border transition-all flex flex-col gap-5 ${unmarkedAlert && !student.status ? 'border-red-500 bg-red-500/5 glow-red' : 'bg-[#111] border-white/5'}`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-14 h-14 rounded-[10px] shrink-0 flex items-center justify-center font-black text-xl shadow-lg ${beltConfig[student.belt]?.bgClass || 'belt-white'}`} style={{ color: beltConfig[student.belt]?.textColor }}>
                      {student.photo ? <img src={student.photo} className="w-full h-full rounded-[10px] object-cover" /> : student.name?.[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-white text-base truncate uppercase tracking-tight">{student.name}</p>
                        <StudentAttendanceAlert student={student} />
                      </div>
                      <p className="text-[10px] text-gray-600 font-bold uppercase tracking-widest mt-1">
                        {beltConfig[student.belt]?.label} {student.stripes > 0 ? `· ${student.stripes} Graus` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleMark(student.id, 'present')}
                      className={`py-4 rounded-[10px] text-[10px] font-black uppercase transition-all flex flex-col items-center justify-center gap-1.5 ${student.status === 'present' ? 'bg-emerald-500 text-white shadow-lg' : 'bg-white/5 text-emerald-400 group border border-emerald-500/10 hover:bg-emerald-500/10'}`}
                    >
                      <Check size={16} strokeWidth={3.5} />
                      PRESENTE
                    </button>
                    <button
                      onClick={() => handleMark(student.id, 'absent')}
                      className={`py-4 rounded-[10px] text-[10px] font-black uppercase transition-all flex flex-col items-center justify-center gap-1.5 ${student.status === 'absent' ? 'bg-rose-500 text-white shadow-lg' : 'bg-white/5 text-rose-400 border border-rose-500/10 hover:bg-rose-500/10'}`}
                    >
                      <X size={16} strokeWidth={3.5} />
                      FALTA
                    </button>
                    <button
                      onClick={() => handleMark(student.id, 'justified')}
                      className={`py-4 rounded-[10px] text-[10px] font-black uppercase transition-all flex flex-col items-center justify-center gap-1.5 ${student.status === 'justified' ? 'bg-blue-500 text-white shadow-lg' : 'bg-white/5 text-blue-400 border border-blue-500/10 hover:bg-blue-500/10'}`}
                    >
                      <History size={16} strokeWidth={3.5} />
                      JUSTIF.
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Session Config Bottom Sheet (Mobile ONLY) */}
      <AnimatePresence>
        {showMobileConfig && (
          <div className="fixed inset-0 z-[1000] md:hidden">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowMobileConfig(false)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              className="absolute bottom-0 left-0 right-0 bg-[#0d0d0d] rounded-t-[30px] border-t border-white/10 p-8 flex flex-col gap-8 shadow-2xl"
            >
              <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-2 opacity-50" />
              <div>
                <h3 className="text-3xl font-black text-white uppercase tracking-tight font-display">Configurar Sessão</h3>
                <p className="text-[10px] text-primary font-black uppercase tracking-[0.4em] mt-2">{sessionModality}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Data</label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} className="w-full bg-[#161616] border border-white/5 rounded-[12px] py-4 pl-12 pr-4 text-white text-sm outline-none focus:border-primary/50" />
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Horário</label>
                  <div className="relative">
                    <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input type="time" value={sessionTime} onChange={e => setSessionTime(e.target.value)} className="w-full bg-[#161616] border border-white/5 rounded-[12px] py-4 pl-12 pr-4 text-white text-sm outline-none focus:border-primary/50" />
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Professor Responsável</label>
                <div className="relative">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                  <select
                    value={sessionProfessor}
                    onChange={e => setSessionProfessor(e.target.value)}
                    className="w-full bg-[#161616] border border-white/5 rounded-[12px] py-5 pl-12 pr-4 text-white text-sm appearance-none outline-none focus:border-primary/50 font-bold"
                  >
                    {staffMembers.filter(s => s.role === 'professor' || s.role === 'admin').map(s => (
                      <option key={s.id} value={s.name} className="bg-[#111]">{s.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-4 pt-4">
                <button
                  onClick={handleStartSession}
                  disabled={isSavingSession}
                  className="w-full py-5 rounded-[15px] bg-primary text-white font-black uppercase tracking-[0.2em] shadow-2xl shadow-primary/30 active:scale-95 transition-all text-sm btn-primary"
                >
                  {isSavingSession ? 'Iniciando...' : 'ABRIR LISTA'}
                </button>
                <button onClick={() => setShowMobileConfig(false)} className="w-full py-4 text-gray-600 font-black uppercase tracking-widest text-[11px] hover:text-white transition-colors">Cancelar</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Details Modals */}
      {showModal && (
        <AddStudentModal
          initialModality={currentModality}
          onClose={() => setShowModal(false)}
          onAdd={async (newStudent, modFromForm, options) => {
            await addStudent(newStudent, modFromForm || currentModality, options)
            setShowModal(false)
          }}
        />
      )}

      {/* Toast */}
      {toastMessage && createPortal(
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-24 left-4 right-4 z-[99999]"
        >
          <div className="bg-[#1A1A1A] border border-white/10 p-4 rounded-[15px] shadow-2xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <Info size={16} />
            </div>
            <p className="text-xs font-bold text-white flex-1">{toastMessage}</p>
            <button onClick={() => setToastMessage('')} className="p-2 text-gray-500">
              <X size={16} />
            </button>
          </div>
        </motion.div>,
        document.body
      )}
    </div>
  )
}


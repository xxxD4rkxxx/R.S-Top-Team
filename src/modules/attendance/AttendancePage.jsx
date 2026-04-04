// COMPONENTE DE GERENCIAMENTO DE CHAMADAS (ATTENDANCE)
// Este módulo gerencia o início de sessões de aula, marcação de presença e consulta ao histórico.
import React, { useState, useEffect, useMemo } from 'react'
import { 
  ClipboardCheck, Search, Check, X, Plus, Clock, Calendar, 
  User, History, Trophy, Eye, Info, AlertTriangle, Clock3 
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '../../firebase/config'
import { collection, query, getDocs, orderBy, limit } from 'firebase/firestore'
import { useApp } from '../../context/AppContext'
import { useStudents } from '../../hooks/useStudents'
import { beltConfig } from '../../data/beltConfig'
import { useModalities } from '../../hooks/useModalities'
import { useSystemUsers } from '../../hooks/useSystemUsers'
import { useAttendanceAlerts } from '../../hooks/useAttendanceAlerts'
import { attendanceService } from '../../services/attendanceService'
import MobileHeader from '../../components/navigation/MobileHeader'
import PageHeader from '../../components/shared/PageHeader'
import AddStudentModal from '../../components/shared/AddStudentModal'

// Alerta visual de frequência do aluno (Atenção ou Crítico)
const StudentAttendanceAlert = ({ student }) => {
  const { status, isLoading } = useAttendanceAlerts(student.id, student.createdAt)
  if (isLoading || status === 'active' || status === 'loading' || status === 'error') return null
  const config = {
    warning: { icon: <AlertTriangle size={14} className="text-yellow-500" />, bg: 'bg-yellow-500/10' },
    critical: { icon: <AlertTriangle size={14} className="text-red-500" />, bg: 'bg-red-500/10' }
  }
  const current = config[status]
  if (!current) return null
  return (
    <div className={`flex items-center gap-1 p-1 rounded-full ${current.bg}`}>
      {current.icon}
    </div>
  )
}

// Formatação auxiliar de data para inputs
function formatInputDate(dateObj) {
  return dateObj.toISOString().slice(0, 10)
}

export default function AttendancePage() {
  const { currentModality, isAdminView, setCurrentModality } = useApp()
  const { students, addStudent } = useStudents()
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

  // Busca de registros da sessão no Firestore
  async function fetchAttendanceRecords(sessionId) {
    try {
      const records = await attendanceService.getSessionAttendances(sessionId)
      setSessionAttendance(records)
    } catch (err) {
      console.error('Erro ao buscar registros', err)
    }
  }

  useEffect(() => {
    if (activeSession?.id) fetchAttendanceRecords(activeSession.id)
    else setSessionAttendance({})
  }, [activeSession?.id])

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
      console.error('Erro ao buscar histórico', err)
    }
  }

  // Lógica de filtragem de alunos para a chamada
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
      setToastMessage('Selecione uma modalidade')
      return
    }
    setIsSavingSession(true)
    try {
      const payload = { modality: sessionModality, date: sessionDate, time: sessionTime, professor: sessionProfessor }
      const newSession = await attendanceService.createSession(payload)
      setActiveSession(newSession)
      fetchRecentSessions()
      setShowMobileConfig(false)
    } catch (err) {
      setToastMessage('Erro ao iniciar sessão')
    } finally {
      setIsSavingSession(false)
    }
  }

  async function handleFinalizeSession() {
    const unmarked = activeList.filter(s => !s.status)
    if (unmarked.length > 0) {
      setUnmarkedAlert(true)
      setToastMessage(`Faltam ${unmarked.length} marcas!`)
      setTimeout(() => setUnmarkedAlert(false), 3000)
      return
    }
    setIsFinishingSession(true)
    try {
      await attendanceService.markAttendanceBatch(activeSession, activeList)
      setActiveSession(null)
      fetchRecentSessions()
      setToastMessage("Sucesso!")
    } catch (err) {
      console.error(err)
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
    <div className="flex flex-col flex-1 w-full min-h-dvh bg-black">
      <MobileHeader 
        title={activeSession ? "Chamada Ativa" : "Canais de Chamada"} 
        showBack={!!activeSession} 
        onBack={() => setActiveSession(null)}
        actions={<div className="flex items-center gap-2">
          {activeSession ? (
            <button onClick={handleFinalizeSession} className="p-2.5 rounded-xl bg-emerald-500 text-white shadow-lg"><Check size={20} strokeWidth={3} /></button>
          ) : (
            isAdminView && <button onClick={() => setShowModal(true)} className="p-2.5 rounded-xl bg-primary text-black shadow-lg"><Plus size={20} strokeWidth={3} /></button>
          )}
        </div>}
      />

      <PageHeader icon={ClipboardCheck} title="INICIAR CHAMADA" subtitle="NOVA SESSÃO" 
        extra={isAdminView && <button onClick={() => setShowModal(true)} className="btn-primary px-5 py-2.5 rounded-xl uppercase tracking-widest text-[11px] font-black"><Plus size={18} /> NOVO ALUNO</button>} 
      />

      <main className="flex-1 p-4 md:p-8 space-y-10 max-w-[1400px] mx-auto w-full pb-32">
        {!activeSession ? (
          <>
            <div className="flex flex-col items-center justify-center text-center space-y-8 mb-14">
              <div className="relative">
                <div className="absolute -inset-16 bg-primary/10 rounded-full blur-[100px]" />
                <div className="relative w-32 h-32 md:w-36 md:h-36 rounded-full border-2 border-white/10 p-2.5 bg-[#080808]">
                  <img src="/logo-nav.png" alt="Logo" className="w-full h-full object-contain rounded-full" />
                </div>
              </div>
              <div className="space-y-3">
                <h2 className="text-5xl md:text-6xl font-black text-white uppercase tracking-widest">INICIAR CHAMADA</h2>
                <p className="text-gray-500 text-[10px] uppercase tracking-[0.4em]">Rs Top Team Academy</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {loadingModalities ? [1,2,3].map(i => <div key={i} className="h-64 bg-white/5 animate-pulse rounded-[32px]" />) : 
                modalities.filter(m => m.status === 'ativo').map(mod => {
                  const turmas = mod.turmas?.filter(t => t.status === 'ativo') || []
                  return (
                    <div key={mod.id} onClick={() => { setSessionModality(mod.name); setCurrentModality(mod.name); if(turmas.length === 1) setSessionTime(turmas[0].horario || turmas[0].horarioInicio); if(window.innerWidth < 768) setShowMobileConfig(true); }}
                      className={`stat-card p-10 rounded-[32px] border cursor-pointer transition-all ${sessionModality === mod.name ? 'ring-2 ring-primary bg-primary/5 border-primary/20' : 'border-white/5 bg-[#080808]/50'}`}>
                      <p className="text-[9px] font-black text-gray-600 uppercase mb-2">MODALIDADE</p>
                      <h3 className="text-4xl font-black text-white uppercase mb-4">{mod.name}</h3>
                      <div className="flex flex-wrap gap-2">
                        {turmas.map(t => (
                          <button key={t.id} onClick={(e) => { e.stopPropagation(); setSessionModality(mod.name); setSessionTime(t.horario || t.horarioInicio); }}
                            className={`px-4 py-2 rounded-xl text-[11px] font-black border ${sessionTime === (t.horario || t.horarioInicio) && sessionModality === mod.name ? 'bg-primary border-primary text-white' : 'border-white/5 text-gray-500'}`}>
                            {t.horario || t.horarioInicio}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })
              }
            </div>

            <div className="glass-card p-10 rounded-[32px] border border-white/5 space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] ml-2">Data da Aula</label>
                  <div className="relative group">
                    <Calendar size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-primary transition-colors group-hover:text-primary-light" />
                    <input 
                      type="date" 
                      value={sessionDate} 
                      onChange={e => setSessionDate(e.target.value)} 
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 pl-14 pr-5 text-white font-bold focus:border-primary/50 outline-none transition-all" 
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] ml-2">Horário</label>
                  <div className="relative group">
                    <Clock size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-primary transition-colors group-hover:text-primary-light" />
                    <input 
                      type="time" 
                      value={sessionTime} 
                      onChange={e => setSessionTime(e.target.value)} 
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 pl-14 pr-5 text-white font-bold focus:border-primary/50 outline-none transition-all" 
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[10px] font-black uppercase text-gray-500 tracking-[0.2em] ml-2">Responsável</label>
                  <div className="relative group">
                    <User size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-primary transition-colors group-hover:text-primary-light" />
                    <input 
                      list="staff-list" 
                      placeholder="Escolha ou digite o nome"
                      value={sessionProfessor} 
                      onChange={e => setSessionProfessor(e.target.value)} 
                      className="w-full bg-black/40 border border-white/10 rounded-2xl py-5 pl-14 pr-5 text-white font-bold focus:border-primary/50 outline-none transition-all" 
                    />
                    <datalist id="staff-list">
                      {staffMembers.map(s => <option key={s.id} value={s.name} />)}
                    </datalist>
                  </div>
                </div>
              </div>

              <div className="hidden md:flex justify-center pt-2">
                <button 
                  onClick={handleStartSession} 
                  disabled={isSavingSession}
                  className="btn-primary rounded-2xl px-16 py-5 font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isSavingSession ? 'INICIANDO...' : 'ABRIR LISTA DE PRESENÇA'}
                </button>
              </div>
            </div>

            <div className="pt-16 border-t border-white/5 space-y-10">
              <div className="flex items-center justify-between">
                <h4 className="text-xl font-black uppercase text-white tracking-widest flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-white/5 border border-white/10"><History size={20} className="text-primary" /></div>
                  Histórico de Sessões
                </h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                {recentSessions.map(s => (
                  <div key={s.id} className="stat-card p-8 rounded-[32px] border border-white/5 flex flex-col gap-6 bg-[#080808]/50">
                    <div>
                      <h5 className="text-xl font-black text-white uppercase tracking-tight">{s.modality}</h5>
                      <p className="text-[10px] text-gray-500 uppercase font-black tracking-widest mt-2">{s.professor} · {s.time}</p>
                    </div>
                    <button 
                      onClick={() => navigate(`/attendance/review/${s.id}`)} 
                      className="w-full py-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 text-[10px] font-black uppercase tracking-widest text-gray-300 transition-all"
                    >
                      Revisar Chamada
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <div className="p-8 rounded-2xl bg-white/[0.03] border border-white/5 flex justify-between items-center">
              <div>
                <h2 className="text-4xl font-black text-white uppercase leading-none">{activeSession.modality}</h2>
                <p className="text-xs text-gray-500 font-bold uppercase mt-2">{activeSession.professor} · {activeSession.time}</p>
              </div>
              <div className="flex items-center gap-8 text-right">
                <div><div className="text-5xl font-black text-white">{stats.present}/{stats.total}</div><p className="text-[10px] font-black uppercase">PRESENTES</p></div>
                <button onClick={handleFinalizeSession} className="btn-primary py-4 px-10 rounded-xl font-black uppercase">Finalizar</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {activeList.map(s => (
                <div key={s.id} className="p-5 rounded-2xl bg-[#111] border border-white/5 flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black ${beltConfig[s.belt]?.bgClass || 'bg-white'}`}>{s.name[0]}</div>
                    <div><p className="font-bold text-white uppercase">{s.name}</p><p className="text-[10px] text-gray-500 uppercase">{beltConfig[s.belt]?.label}</p></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <button onClick={() => handleMark(s.id, 'present')} className={`py-3 rounded-xl text-[10px] font-black ${s.status === 'present' ? 'bg-emerald-500 text-white' : 'bg-white/5 text-emerald-500'}`}>PRESENTE</button>
                    <button onClick={() => handleMark(s.id, 'absent')} className={`py-3 rounded-xl text-[10px] font-black ${s.status === 'absent' ? 'bg-rose-500 text-white' : 'bg-white/5 text-rose-500'}`}>FALTA</button>
                    <button onClick={() => handleMark(s.id, 'justified')} className={`py-3 rounded-xl text-[10px] font-black ${s.status === 'justified' ? 'bg-blue-500 text-white' : 'bg-white/5 text-blue-500'}`}>JUSTIF.</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      <AnimatePresence>
        {showMobileConfig && (/* Mobile Config Drawer Simplified */
          <div className="fixed inset-0 z-[1000] flex justify-center items-end" onClick={() => setShowMobileConfig(false)}>
             <div className="w-full bg-[#0d0d0d] p-8 rounded-t-3xl border-t border-white/10" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-black text-white uppercase mb-4">Configurar Sessão</h3>
                {/* Inputs simplified for length */}
                <button onClick={handleStartSession} className="w-full py-4 bg-primary text-black rounded-xl font-black uppercase">Abrir Lista</button>
             </div>
          </div>
        )}
      </AnimatePresence>
      {showModal && <AddStudentModal onClose={() => setShowModal(false)} onAdd={addStudent} />}
    </div>
  )
}

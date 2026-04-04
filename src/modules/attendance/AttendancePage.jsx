// COMPONENTE DE GERENCIAMENTO DE CHAMADAS (ATTENDANCE)
// Este módulo gerencia o início de sessões de aula, marcação de presença e consulta ao histórico.
import React, { useState, useEffect, useMemo } from 'react'
import {
  ClipboardCheck, Search, Check, X, Plus, Clock, Calendar,
  User, History, Trophy, Eye, Info, AlertTriangle, Clock3, ChevronDown
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
  const [showProfessorDropdown, setShowProfessorDropdown] = useState(false)
  const [unmarkedAlert, setUnmarkedAlert] = useState(false)
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false)

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
            null
          )}
        </div>}
      />

      <PageHeader icon={ClipboardCheck} title="INICIAR CHAMADA" subtitle="NOVA SESSÃO" />

      <main className="flex-1 p-4 md:p-8 space-y-6 max-w-[1400px] mx-auto w-full pb-32">
        {!activeSession ? (
          <>
            <div className="flex flex-col items-center justify-center text-center space-y-4 mb-4">
              <div className="relative">
                <div className="absolute -inset-16 bg-primary/10 rounded-full blur-[100px]" />
                <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter leading-tight relative">
                  INICIAR SESSÃO DE <span className="text-primary">TREINO</span>
                </h1>
                <p className="text-[10px] font-bold text-gray-500 mt-2 tracking-[0.2em] uppercase">Configure os detalhes da aula abaixo</p>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-4">
              {loadingModalities ? [1, 2, 3].map(i => <div key={i} className="flex-1 min-w-[280px] h-56 bg-white/5 animate-pulse rounded-[32px]" />) :
                modalities.filter(m => m.status === 'ativo').map(mod => {
                  const turmas = mod.turmas?.filter(t => t.status === 'ativo') || []
                  const isJiu = mod.name?.toLowerCase().includes('jiu')
                  
                  return (
                    <div key={mod.id} onClick={() => { setSessionModality(mod.name); setCurrentModality(mod.name); if (turmas.length === 1) setSessionTime(turmas[0].horario || turmas[0].horarioInicio); if (window.innerWidth < 768) setShowMobileConfig(true); }}
                      className={`group relative overflow-hidden flex-grow min-w-[280px] max-w-[600px] stat-card p-6 md:p-8 rounded-[32px] border cursor-pointer transition-all duration-500
                        ${sessionModality === mod.name 
                          ? 'ring-2 ring-primary bg-primary/10 border-primary/30 shadow-[0_0_50px_rgba(var(--primary-rgb),0.1)]' 
                          : 'border-white/5 bg-[#080808]/50 hover:bg-[#0c0c0c] hover:border-white/10 shadow-xl'}`}>
                      
                      {isJiu && (
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/40 to-black/80 z-[1]" />
                          <img 
                            src="/jiujitsu_bg.png" 
                            alt="" 
                            className="w-full h-full object-cover object-[center_20%] opacity-[0.08] grayscale group-hover:scale-105 transition-transform duration-[3000ms] ease-out z-[0]" 
                          />
                        </div>
                      )}

                      <div className="relative z-[10] flex flex-col items-center w-full">
                        <p className="text-[8px] font-black text-gray-500 uppercase mb-1 tracking-[0.3em] text-center">MODALIDADE</p>
                        <h3 className="text-2xl md:text-4xl font-black text-white uppercase mb-4 text-center leading-none tracking-tight">{mod.name}</h3>
                        <div className="flex flex-wrap justify-center gap-2.5 w-full">
                          {turmas.map(t => (
                            <button key={t.id} onClick={(e) => { e.stopPropagation(); setSessionModality(mod.name); setSessionTime(t.horario || t.horarioInicio); }}
                              className={`flex-1 min-w-[120px] px-5 py-2.5 rounded-xl text-[10px] font-black border transition-all duration-300
                                ${sessionTime === (t.horario || t.horarioInicio) && sessionModality === mod.name 
                                  ? 'bg-primary border-primary text-white scale-105 shadow-lg shadow-primary/20' 
                                  : 'border-white/10 text-gray-400 hover:bg-white hover:text-black hover:border-white'}`}>
                              {t.horario || t.horarioInicio}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )
                })
              }
            </div>

            <div className="glass-card p-5 rounded-[28px] border border-white/5 space-y-5 max-w-[1000px] mx-auto w-full">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-[0.2em] ml-2">Data da Aula</label>
                  <div className="relative group">
                    <Calendar size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/70 transition-colors group-hover:text-primary" />
                    <input
                      type="date"
                      value={sessionDate}
                      onChange={e => setSessionDate(e.target.value)}
                      className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-xs text-white font-bold focus:border-primary/40 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-[0.2em] ml-2">Horário</label>
                  <div className="relative group">
                    <Clock size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/70 transition-colors group-hover:text-primary" />
                    <input
                      type="time"
                      value={sessionTime}
                      onChange={e => setSessionTime(e.target.value)}
                      className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-12 pr-4 text-xs text-white font-bold focus:border-primary/40 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase text-gray-500 tracking-[0.2em] ml-2">Responsável</label>
                  <div className="relative group">
                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary/70 transition-colors z-20 pointer-events-none" />
                    <input 
                      type="text"
                      placeholder="Professor ou Visitante"
                      value={sessionProfessor}
                      onChange={(e) => { setSessionProfessor(e.target.value); if(!showProfessorDropdown) setShowProfessorDropdown(true); }}
                      onFocus={() => setShowProfessorDropdown(true)}
                      className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-12 pr-10 text-xs text-white font-bold outline-none focus:border-primary/40 transition-all hover:bg-black/60"
                    />
                    <ChevronDown size={14} className={`absolute right-4 top-1/2 -translate-y-1/2 text-gray-600 transition-transform duration-300 pointer-events-none ${showProfessorDropdown ? "rotate-180" : ""}`} />

                    <AnimatePresence>
                      {showProfessorDropdown && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setShowProfessorDropdown(false)} />
                          <motion.div 
                            initial={{ opacity: 0, y: -5, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -5, scale: 0.98 }}
                            className="absolute left-0 right-0 bottom-full mb-2 z-40 bg-[#0c0c0c] border border-white/10 rounded-xl shadow-2xl overflow-hidden"
                          >
                            <div className="bg-white/5 p-2.5 border-b border-white/5">
                              <p className="text-[8px] font-black uppercase text-gray-500 tracking-widest">Equipe</p>
                            </div>
                            <div className="max-h-[160px] overflow-y-auto py-1 custom-scrollbar">
                              {[...(staffMembers.length > 0 ? staffMembers : [{ id: 'default', name: 'Prof. Robson' }])].map((s) => (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => { setSessionProfessor(s.name); setShowProfessorDropdown(false); }}
                                  className={`w-full text-left px-4 py-2.5 font-bold text-[11px] transition-all hover:bg-white/5 flex items-center justify-between
                                    ${sessionProfessor === s.name ? "text-primary bg-primary/5" : "text-gray-400 hover:text-white"}`}
                                >
                                  {s.name}
                                  {sessionProfessor === s.name && <Check size={12} />}
                                </button>
                              ))}
                              {sessionProfessor && !staffMembers.find(s => s.name === sessionProfessor) && (
                                <div className="px-4 py-2 border-t border-white/5 bg-primary/5">
                                  <p className="text-[8px] font-black text-primary uppercase mb-0.5 tracking-tighter">VISITANTE</p>
                                  <p className="text-white text-[11px] font-bold">{sessionProfessor}</p>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        </>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="hidden md:flex justify-center gap-3 pt-1">
                {isAdminView && (
                  <button
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2.5 bg-white/5 border border-white/5 text-gray-500 rounded-xl px-8 py-3 font-black uppercase text-[10px] tracking-widest hover:bg-white/10 hover:text-white transition-all"
                  >
                    <Plus size={16} />
                    Novo Aluno
                  </button>
                )}
                <button
                  onClick={handleStartSession}
                  disabled={isSavingSession}
                  className="btn-primary rounded-xl px-10 py-3 font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  {isSavingSession ? 'INICIANDO...' : 'ABRIR LISTA DE PRESENÇA'}
                </button>
              </div>
            </div>

            <div className="pt-8 border-t border-white/5 space-y-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-white/5 border border-white/10"><History size={18} className="text-primary" /></div>
                  <h4 className="text-lg font-black uppercase text-white tracking-widest flex items-center gap-2">
                    Histórico
                    {showAllHistory && (
                      <button 
                        onClick={() => setShowAllHistory(false)}
                        className="ml-1 p-1 hover:bg-white/5 rounded-lg transition-all text-primary active:scale-90"
                        title="Recolher Histórico"
                      >
                        <ChevronDown size={14} className="rotate-180" />
                      </button>
                    )}
                  </h4>
                </div>
                {!showAllHistory && recentSessions.length > 4 && (
                  <button 
                    onClick={() => setShowAllHistory(true)}
                    className="md:hidden text-[9px] font-black uppercase text-primary border-b border-primary/30 pb-0.5 tracking-widest transition-all active:scale-95"
                  >
                    Mostrar Tudo
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 font-black">
                {(showAllHistory || window.innerWidth >= 768 ? recentSessions : recentSessions.slice(0, 4)).map(s => (
                  <div key={s.id} className="stat-card p-4 md:p-5 rounded-[20px] md:rounded-[22px] border border-white/5 flex flex-col items-center text-center gap-3 md:gap-3.5 bg-[#080808]/50">
                    <div className="w-full">
                      <h5 className="text-xs md:text-base font-black text-white uppercase tracking-tight leading-tight line-clamp-1">{s.modality}</h5>
                      <p className="text-[8px] md:text-[9px] text-gray-500 uppercase font-black tracking-widest mt-1 line-clamp-1">{s.professor} · {s.time}</p>
                    </div>
                    <button
                      onClick={() => navigate(`/attendance/review/${s.id}`)}
                      className="w-full py-2.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 text-[8px] md:text-[9px] font-black uppercase tracking-widest text-gray-400 transition-all font-black"
                    >
                      Revisar
                    </button>
                  </div>
                ))}
              </div>

              {!showAllHistory && recentSessions.length > 4 && (
                <div className="flex md:hidden pt-2">
                  <button 
                    onClick={() => setShowAllHistory(true)}
                    className="w-full py-4 rounded-xl bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    Mostrar Tudo 
                    <Plus size={14} />
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-white/[0.03] border border-white/5 flex justify-between items-center">
              <div>
                <h2 className="text-3xl font-black text-white uppercase leading-none tracking-tight">{activeSession.modality}</h2>
                <p className="text-[10px] text-gray-500 font-bold uppercase mt-1 tracking-widest">{activeSession.professor} · {activeSession.time}</p>
              </div>
              <div className="flex items-center gap-6 text-right">
                <div><div className="text-4xl font-black text-white tracking-tighter">{stats.present}/{stats.total}</div><p className="text-[9px] font-black uppercase text-gray-500">PRESENTES</p></div>
                <button onClick={handleFinalizeSession} className="btn-primary py-3 px-8 rounded-xl font-black uppercase text-xs tracking-widest transition-all hover:scale-105">Finalizar</button>
              </div>
            </div>
            
            <div className="relative mb-4">
              <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input 
                type="text" 
                placeholder="BUSCAR ALUNO NA LISTA..." 
                value={searchActive}
                onChange={e => setSearchActive(e.target.value)}
                className="w-full bg-[#111] border border-white/5 rounded-2xl py-4 pl-14 pr-6 text-xs text-white font-black uppercase tracking-widest outline-none focus:border-primary/30 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {activeList.map(s => (
                <div key={s.id} className="p-4 rounded-xl bg-[#0d0d0d] border border-white/5 flex flex-col gap-3 group hover:border-white/10 transition-all shadow-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-xs shadow-inner ${beltConfig[s.belt]?.bgClass || 'bg-white'}`}>{s.name[0]}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-white uppercase text-xs truncate tracking-tighter">{s.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-[9px] text-gray-500 uppercase font-black">{beltConfig[s.belt]?.label}</p>
                        <StudentAttendanceAlert student={s} />
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button onClick={() => handleMark(s.id, 'present')} className={`py-2.5 rounded-lg text-[9px] font-black transition-all ${s.status === 'present' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-white/5 text-emerald-500 hover:bg-emerald-500/10'}`}>PRESENTE</button>
                    <button onClick={() => handleMark(s.id, 'absent')} className={`py-2.5 rounded-lg text-[9px] font-black transition-all ${s.status === 'absent' ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20' : 'bg-white/5 text-rose-500 hover:bg-rose-500/10'}`}>FALTA</button>
                    <button onClick={() => handleMark(s.id, 'justified')} className={`py-2.5 rounded-lg text-[9px] font-black transition-all ${s.status === 'justified' ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20' : 'bg-white/5 text-blue-500 hover:bg-blue-500/10'}`}>JUSTIF.</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      <AnimatePresence>
        {showMobileConfig && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            className="fixed inset-0 z-[1000] flex justify-center items-end bg-black/80 backdrop-blur-md" 
            onClick={() => setShowMobileConfig(false)}
          >
            <div className="w-full bg-[#0a0a0a] p-6 rounded-t-[32px] border-t border-white/10" onClick={e => e.stopPropagation()}>
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />
              <h3 className="text-xl font-black text-white uppercase mb-6 tracking-tighter">Configurar Aula</h3>
              
              <div className="space-y-4 mb-8">
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <p className="text-[9px] font-black text-gray-500 uppercase mb-1">DATA E HORA</p>
                  <p className="text-white font-bold">{new Date(sessionDate).toLocaleDateString('pt-BR')} às {sessionTime}</p>
                </div>
                <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                  <p className="text-[9px] font-black text-gray-500 uppercase mb-1">RESPONSÁVEL</p>
                  <p className="text-white font-bold">{sessionProfessor}</p>
                </div>
              </div>

              <button 
                onClick={handleStartSession} 
                className="w-full py-4.5 bg-primary text-black rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-2xl shadow-primary/30 active:scale-95 transition-all"
              >
                Confirmar e Abrir
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {showModal && <AddStudentModal onClose={() => setShowModal(false)} onAdd={addStudent} />}
    </div>
  )
}

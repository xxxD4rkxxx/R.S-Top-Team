// RESUMO: Página de Revisão e Edição de Chamadas.
// Permite visualizar o resumo de presenças de uma sessão específica e realizar ajustes finos.
// Implementa busca rápida de alunos e alteração rápida de status (Presente, Falta, Justificada).
import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  CalendarDays, Users, Clock3, History, CheckCircle2, XCircle,
  AlertCircle, ChevronLeft, Cake, Stethoscope, Trophy, Search, Edit2, Save
} from 'lucide-react'
import { db } from '../../firebase/config'
import {
  getDoc, getDocs, doc, collection, writeBatch, serverTimestamp
} from 'firebase/firestore'
import { COLLECTIONS, SUB_COLLECTIONS, FIELDS } from '../../firebase/collections'
import { useStudents } from '../../hooks/useStudents'
import { beltConfig } from '../../data/beltConfig'

function formatFriendly(dateStr, timeStr) {
  if (!dateStr) return ''
  try {
    const parts = dateStr.split('-')
    const date = new Date(parts[0], parts[1] - 1, parts[2])
    return date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })
  } catch (e) {
    return dateStr
  }
}

export default function ReviewAttendancePage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const { students } = useStudents()

  const [session, setSession] = useState(null)
  const [records, setRecords] = useState({}) // { studentId: status }
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  async function handleSaveEdits() {
    setIsSaving(true)
    try {
      const batch = writeBatch(db)
      const attendancesRef = collection(db, COLLECTIONS.CHAMADAS, sessionId, SUB_COLLECTIONS.PRESENCAS)

      Object.entries(records).forEach(([studentId, status]) => {
        if (status) {
          const docRef = doc(attendancesRef, studentId)
          const student = students.find(s => s.id === studentId) || {}
          batch.set(docRef, {
            studentId: studentId,
            studentName: student[FIELDS.NOME] || student.nome || student.name || 'Desconhecido',
            [FIELDS.STATUS]: status,
            [FIELDS.MODALIDADE]: session[FIELDS.MODALIDADE] || session.modality || '',
            [FIELDS.DATA]: session[FIELDS.DATA] || session.date || '',
            [FIELDS.CRIADO_EM]: serverTimestamp(),
            [FIELDS.INSTRUTOR_ID]: session[FIELDS.INSTRUTOR_ID] || session.instructorId || '',
            [FIELDS.NOME_INSTRUTOR]: session[FIELDS.NOME_INSTRUTOR] || session.instructorName || ''
          }, { merge: true })
        }
      })

      await batch.commit()
      setIsEditing(false)
    } catch (err) {
      console.error(err)
      alert("Erro ao salvar edições!")
    } finally {
      setIsSaving(false)
    }
  }

  useEffect(() => {
    async function fetchData() {
      if (!sessionId) return
      setIsLoading(true)
      try {
        // 1. Fetch Session Metadata (O(1) Direct Lookup)
        const sessionRef = doc(db, COLLECTIONS.CHAMADAS, sessionId)
        const sessionSnap = await getDoc(sessionRef)

        if (!sessionSnap.exists()) {
          setError('A sessão solicitada não foi encontrada ou o ID é inválido.')
          setIsLoading(false)
          return
        }

        const sessionData = { id: sessionSnap.id, ...sessionSnap.data() }
        setSession(sessionData)

        // 2. Fetch Attendance Records for this Session
        const attendancesRef = collection(db, COLLECTIONS.CHAMADAS, sessionId, SUB_COLLECTIONS.PRESENCAS)
        const recordsSnap = await getDocs(attendancesRef)
        const recordsMap = {}
        recordsSnap.docs.forEach(d => {
          const data = d.data()
          recordsMap[data.studentId] = data[FIELDS.STATUS] || data.status
        })
        setRecords(recordsMap)

      } catch (err) {
        console.error('Erro ao buscar dados:', err)
        setError(`Erro: ${err.message || 'Não foi possível carregar esta chamada.'}`)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [sessionId])

  const filteredStudents = useMemo(() => {
    const MODALIDADE = FIELDS.MODALIDADE || 'modalidade'
    const sessMod = session?.[MODALIDADE] || session?.modality
    if (!sessMod || !Array.isArray(students)) return []

    // Filter students belonging to this modality
    let list = students.filter(s => {
      const studentMods = s[FIELDS.MODALIDADES] || s.modalities || [s[MODALIDADE] || s.modality || '']
      return studentMods.includes(sessMod)
    })

    if (search) {
      list = list.filter(s => {
        const name = s[FIELDS.NOME] || s.nome || s.name || ''
        return name.toLowerCase().includes(search.toLowerCase())
      })
    }
    return list
  }, [students, session, search])

  const stats = useMemo(() => {
    const total = filteredStudents.length
    const present = Object.values(records).filter(v => v === 'present').length
    const percent = total > 0 ? Math.round((present / total) * 100) : 0
    return { total, present, percent }
  }, [filteredStudents, records])

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-black">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <p className="text-gray-400 animate-pulse">Carregando registros da chamada...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center bg-black px-6">
        <div className="glass-card max-w-md w-full p-8 rounded-2xl border border-white/5 text-center">
          <AlertCircle size={48} strokeWidth={1.9} style={{ color: 'var(--clr-primary)' }} className="mx-auto mb-4" />
          <h2 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">Ops! Algo deu errado</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate('/chamadas')}
            className="btn-primary w-full py-3 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <ChevronLeft size={18} strokeWidth={1.9} />
            Voltar para Chamadas
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="p-4 md:p-6 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <button
            onClick={() => navigate('/chamadas')}
            className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors mb-2 group"
          >
            <ChevronLeft size={18} strokeWidth={1.9} className="group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm">Voltar</span>
          </button>
          <div className="flex items-center gap-3">
            <span className="bg-primary/20 text-primary text-[10px] font-black px-2 py-0.5 rounded-xl uppercase">
              #{session.seqId || 'SESSÃO'}
            </span>
            <h1 className="text-2xl font-black text-white uppercase tracking-tight">
              Revisão: {session[FIELDS.MODALIDADE] || session.modality}
            </h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {session[FIELDS.DATA] || session.date ? formatFriendly(session[FIELDS.DATA] || session.date, session[FIELDS.HORARIO] || session.time) : 'Data não informada'} às {session[FIELDS.HORARIO] || session.time || '--:--'} · Prof. {session.professor || 'Não informado'}
          </p>
        </div>

        <div className="flex items-center gap-4 px-6 py-4 glass-card rounded-2xl border border-white/5">
          <div className="text-center md:text-left">
            <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-1">Presença Final</p>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-white">{stats.present}/{stats.total}</span>
              <div className="px-2 py-0.5 rounded-xl bg-emerald-500/20 text-emerald-400 text-xs font-black">
                {stats.percent}%
              </div>
            </div>
          </div>

          <div className="ml-4 border-l border-white/10 pl-4 flex flex-col gap-2">
            {!isEditing ? (
              <button onClick={() => setIsEditing(true)} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black w-full md:w-auto">
                <Edit2 size={18} strokeWidth={1.9} /> Editar Chamada
              </button>
            ) : (
              <div className="flex flex-col md:flex-row gap-2">
                <button onClick={() => setIsEditing(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors bg-white/5 rounded-xl border border-white/10" disabled={isSaving}>
                  Cancelar
                </button>
                <button onClick={handleSaveEdits} disabled={isSaving || isLoading} className="btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black disabled:opacity-50">
                  {isSaving ? 'Salvando...' : <><Save size={18} strokeWidth={1.9} /> Salvar Tudo</>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search and Main List */}
      <div className="w-full">
        <div className="relative mb-6">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Filtrar por nome do aluno..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-white focus:outline-none focus:border-primary/50 transition-all shadow-inner"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStudents.map(student => {
            const status = records[student.id]
            const bgClass = beltConfig[student.belt]?.bgClass || 'belt-white'

            return (
              <div
                key={student.id}
                className="glass-card p-4 rounded-2xl border border-white/5 flex items-center justify-between group hover:border-white/10 transition-all"
              >
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {student.photo ? (
                      <img src={student.photo} alt={student.nome || student.name} className="w-10 h-10 rounded-full object-cover border border-white/10" />
                    ) : (
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white ${bgClass}`}>
                        {student.initials || (student.nome || student.name ? (student.nome || student.name)[0] : 'A')}
                      </div>
                    )}
                    {status === 'present' && (
                      <div className="absolute -bottom-1 -right-1 bg-emerald-500 rounded-full p-0.5 border-2 border-black">
                        <CheckCircle2 size={10} className="text-white" />
                      </div>
                    )}
                    {status === 'absent' && (
                      <div className="absolute -bottom-1 -right-1 bg-rose-500 rounded-full p-0.5 border-2 border-black">
                        <XCircle size={10} className="text-white" />
                      </div>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-white truncate max-w-[120px]">{student[FIELDS.NOME] || student.nome || student.name}</p>
                      {student.type === 'visitante' && (
                        <span className="bg-primary/20 text-primary text-[8px] font-black px-1.5 py-0.5 rounded-lg uppercase tracking-tighter">Visitante</span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-500 uppercase">
                      {student.type === 'visitante' ? 'Aguardando Matrícula' : `Faixa ${beltConfig[student.belt]?.label || 'Branca'}`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  {!isEditing ? (
                    <div className="flex items-center px-3 py-1.5 rounded-xl border border-white/5 bg-white/[0.02]">
                      {status === 'present' && <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest">Presente</span>}
                      {status === 'absent' && <span className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Falta</span>}
                      {status === 'justified' && <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Justificada</span>}
                      {!status && <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">Ausente</span>}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 bg-black/40 p-1.5 rounded-xl border border-white/10">
                      <button
                        onClick={() => setRecords(prev => ({ ...prev, [student.id]: 'present' }))}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${status === 'present' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                      >
                        P
                      </button>
                      <button
                        onClick={() => setRecords(prev => ({ ...prev, [student.id]: 'absent' }))}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${status === 'absent' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                      >
                        F
                      </button>
                      <button
                        onClick={() => setRecords(prev => ({ ...prev, [student.id]: 'justified' }))}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all ${status === 'justified' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
                      >
                        J
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      </div>
    </>
  )
}

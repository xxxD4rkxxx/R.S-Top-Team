// RESUMO: Gerenciamento de Alunos.
// Centraliza a listagem, filtros por status/modalidade, busca global e ações rápidas (editar, financeiro, graduação).
// Implementa diálogos de segurança para deleção e alteração de status (inativação/suspensão).
import React, { useMemo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Users, Plus, FileDown, FileUp, Search,
  UserCheck, UserX, UserMinus, Archive, MoreVertical,
  Edit2, Copy, CalendarDays, GraduationCap, CreditCard, Trash2,
  FileText, RefreshCcw, ChevronDown, Award, Target, Smartphone, Eye
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { useStudents } from '../../hooks/useStudents'
import { useSystemUsers } from '../../hooks/useSystemUsers'
import { useStudentJourney } from '../../hooks/useStudentJourney'
import { useApp } from '../../context/AppContext'
import AddStudentModal from '../../components/shared/AddStudentModal'
import GraduationHistoryModal from '../../components/students/GraduationHistoryModal'
import PaymentDrawer from '../../components/students/PaymentDrawer'
import StatusChangeDialog from '../../components/students/StatusChangeDialog'
import AttendanceHistoryDrawer from '../../components/students/AttendanceHistoryDrawer'
import PageHeader from '../../components/shared/PageHeader'
import StudentDetailsModal from '../../components/shared/StudentDetailsModal'
import KPICard from '../../components/shared/KPICard'
import PinVerificationModal from '../../components/shared/PinVerificationModal'
import { beltConfig } from '../../data/beltConfig'
import MobileHeader from '../../components/navigation/MobileHeader'
import { useHideMobileNav } from '../../hooks/useHideMobileNav'

function normalizeStatus(status) {
  if (!status || status === 'ativo' || status === 'active') return 'ativo'
  if (status === 'inativo' || status === 'inactive') return 'inativo'
  if (status === 'suspenso' || status === 'suspended') return 'suspenso'
  if (status === 'arquivado' || status === 'archived') return 'arquivado'
  return 'ativo'
}

// Dialog de confirmação dupla para deletar
function DeleteConfirmDialog({ student, onConfirm, onClose }) {
  const [input, setInput] = useState('')
  const [deleting, setDeleting] = useState(false)
  if (!student) return null
  const match = input.trim().toLowerCase() === (student.name || '').trim().toLowerCase()

  async function handleDelete() {
    if (!match) return
    setDeleting(true)
    try {
      await onConfirm()
    } catch (err) {
      alert(`Erro: ${err.message}`)
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9995] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl overflow-hidden border border-red-500/30 shadow-2xl bg-[#0d0d0d]"
        style={{ animation: 'fadeSlideUp 0.22s ease both' }}>
        <div className="px-6 py-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
              <Trash2 size={20} className="text-red-500" />
            </div>
            <div>
              <h2 className="text-base font-black text-white">Deletar Aluno</h2>
              <p className="text-[11px] text-gray-500">Esta ação é IRREVERSÍVEL.</p>
            </div>
          </div>

          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-xs text-red-300 leading-relaxed">
            Você está prestes a <strong>deletar permanentemente</strong> o aluno <strong>{student.name}</strong>.
            Todos os dados associados a este cadastro serão perdidos.
          </div>

          <div>
            <label className="text-[10px] uppercase tracking-widest text-gray-500 font-black block mb-1.5">
              Para confirmar, digite exatamente: <span className="text-white">{student.name}</span>
            </label>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              className="form-input bg-black/40 text-sm w-full"
              placeholder="Digite o nome do aluno..."
              autoFocus
            />
          </div>

          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10">Cancelar</button>
            <button
              onClick={handleDelete}
              disabled={!match || deleting}
              className="flex-1 py-2.5 rounded-xl text-sm font-black bg-red-600 hover:bg-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-white transition-colors"
            >
              {deleting ? 'Apagando...' : '🗑 Deletar Permanentemente'}
            </button>
          </div>
        </div>
        <style>{`@keyframes fadeSlideUp { from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
      </div>
    </div>
  )
}

function CustomSelect({ label, value, onChange, options, disabled }) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOption = options.find(o => o[0] === value) || options[0]

  return (
    <div className="flex flex-col gap-1.5 relative" ref={ref}>
      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="form-input bg-black/40 input-raise text-sm py-2.5 px-4 text-gray-300 font-medium text-left flex justify-between items-center w-full disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 rounded-2xl transition-all hover:bg-black/60 focus:ring-1 focus:ring-white/20"
      >
        <span className="truncate">{selectedOption ? selectedOption[1] : '...'}</span>
        <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-full min-w-[200px] bg-[#0d0d0d] border border-white/10 rounded-2xl z-[100] overflow-hidden shadow-2xl py-2" style={{ animation: 'fadeSlideUp 0.15s ease-out forwards' }}>
          {options.map(([v, l]) => (
            <button
              key={v}
              onClick={() => { onChange(v); setIsOpen(false) }}
              className={`w-full text-left px-5 py-3 text-sm transition-colors hover:bg-white/5 ${value === v ? 'text-white bg-white/5 font-black' : 'text-gray-400 font-medium'}`}
            >
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function StudentsPage() {
  const { currentModality, isAdminView } = useApp()
  const { user, userData, effectiveRole } = useAuth()
  const { students, isLoadingStudents, addStudent, updateStudentProfile, changeStudentStatus, deleteStudent } = useStudents()
  const { fetchUserPin } = useSystemUsers()
  const [fetchedPins, setFetchedPins] = useState({})

  const isAdmin = effectiveRole === 'admin'
  const isGestor = effectiveRole === 'gestor'
  const canSeeStudents = isAdmin || isGestor || userData?.permissions?.viewStudentPins
  const journeyStats = useStudentJourney()



  const [showModal, setShowModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [editData, setEditData] = useState(null)
  const [duplicateData, setDuplicateData] = useState(null)
  const [showMenu, setShowMenu] = useState(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0, height: 0 })

  // 🔐 Security States
  const [showPinModal, setShowPinModal] = useState(false)
  const [pinModalAction, setPinModalAction] = useState(null) // { type, student }

  // 🛡️ Hide mobile navigation when menu is open
  useHideMobileNav(!!showMenu)


  const [attendanceDrawerStudent, setAttendanceDrawerStudent] = useState(null)
  const [graduationModalStudent, setGraduationModalStudent] = useState(null)
  const [paymentDrawerStudent, setPaymentDrawerStudent] = useState(null)
  const [statusDialogStudent, setStatusDialogStudent] = useState(null)
  const [deleteDialogStudent, setDeleteDialogStudent] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [modalityFilter, setModalityFilter] = useState('todas')
  const [sortBy, setSortBy] = useState('recente')

  const stats = useMemo(() => {
    let active = 0, inactive = 0, suspended = 0, archived = 0
    students.forEach(s => {
      const n = normalizeStatus(s.status)
      if (n === 'ativo') active++
      else if (n === 'inativo') inactive++
      else if (n === 'suspenso') suspended++
      else if (n === 'arquivado') archived++
    })
    return { active, inactive, suspended, archived }
  }, [students])

  const modalities = useMemo(() => {
    const set = new Set(students.map(s => s.modality).filter(Boolean))
    return ['todas', ...Array.from(set)]
  }, [students])

  const filtered = useMemo(() => {
    let list = students

    // 🛡️ SEGURANÇA: Ocultar Administradores de quem não é Admin
    if (!isAdmin) {
      list = list.filter(s => !s.roles?.admin)
    }

    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      list = list.filter(s =>
        (s.name || '').toLowerCase().includes(lower) ||
        (s.email || '').toLowerCase().includes(lower) ||
        (s.phone || '').includes(lower)
      )
    }
    if (statusFilter !== 'todos') list = list.filter(s => normalizeStatus(s.status) === statusFilter)
    if (modalityFilter !== 'todas') {
      list = list.filter(s => 
        s.modality === modalityFilter || 
        (Array.isArray(s.modalities) && s.modalities.includes(modalityFilter))
      )
    }
    if (sortBy === 'az') list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    if (sortBy === 'za') list = [...list].sort((a, b) => (b.name || '').localeCompare(a.name || ''))
    return list
  }, [students, searchTerm, statusFilter, modalityFilter, sortBy, isAdmin])

  async function handleAddStudent(data, modality, options) {
    try {
      if (editData) {
        // MODO EDIÇÃO: Atualiza o perfil sem resetar jornada
        await updateStudentProfile(editData.id, {
          ...data,
          modalities: modality,
          modality: modality[0] || 'Jiu Jitsu'
        })
      } else {
        // MODO CRIAÇÃO: Adiciona novo documento
        await addStudent(data, modality, options)
      }
      setShowModal(false)
      setEditData(null)
      setDuplicateData(null)
    } catch (err) {
      console.error('Erro ao salvar aluno:', err)
      alert('Erro ao salvar. Verifique sua conexão e tente novamente.')
    }
  }

  async function handleStatusChange({ reason, returnDate }) {
    const { student, action } = statusDialogStudent
    const newStatus = action === 'inativar' ? 'inativo' : action === 'arquivar' ? 'arquivado' : 'suspenso'
    await changeStudentStatus(student.id, newStatus, { reason, returnDate })
    setStatusDialogStudent(null)
  }

  async function handleConfirmDelete() {
    if (!deleteDialogStudent || !deleteDialogStudent.id) {
      console.error('❌ Aluno não selecionado para deleção')
      return
    }

    const isSelf =
      deleteDialogStudent.id.toLowerCase() === userData?.id?.toLowerCase() ||
      deleteDialogStudent.email?.toLowerCase() === userData?.email?.toLowerCase()

    if (isSelf) {
      alert("🛑 SEGURANÇA: Você não pode excluir sua própria conta administrativa enquanto estiver logado no sistema.")
      setDeleteDialogStudent(null)
      return
    }

    await deleteStudent(deleteDialogStudent.id)
    setDeleteDialogStudent(null)
  }

  function renderAvatar(student) {
    const bgClass = beltConfig[student.belt]?.bgClass || 'belt-none'
    const initials = student.initials || student.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'A'

    return (
      <div className="flex items-center justify-center p-0.5 group-hover:border-primary/30 transition-colors shrink-0 relative">
        {student.photo ? (
          <img src={student.photo} alt={student.name} className="w-11 h-11 rounded-2xl object-cover ring-1 ring-white/10" />
        ) : (
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xs font-black ring-1 ring-white/10 ${bgClass} text-white shadow-inner relative overflow-hidden`}>
            <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent opacity-40" />
            <span className="relative z-10 drop-shadow-md">{initials}</span>
          </div>
        )}
      </div>
    )
  }

  function renderStatusBadge(student) {
    const norm = normalizeStatus(student.status)
    const cfg = {
      ativo: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      inativo: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      suspenso: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      arquivado: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    }
    const labels = { ativo: 'Ativo', inativo: 'Inativo', suspenso: 'Suspenso', arquivado: 'Arquivado' }
    return (
      <span className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border inline-flex ${cfg[norm]}`}>
        {labels[norm]}
      </span>
    )
  }

  return (
    <>
      <MobileHeader
        title="Alunos"
        actions={
          <div className="flex items-center gap-1.5">
            {isAdminView && (
              <button
                onClick={() => { setDuplicateData(null); setShowModal(true) }}
                className="p-2.5 rounded-xl bg-primary text-black active:scale-90 transition-transform shadow-lg shadow-primary/20"
              >
                <Plus size={20} strokeWidth={3} />
              </button>
            )}
          </div>
        }
      />

      <PageHeader
        icon={Users}
        title="GESTÃO DE ALUNOS"
        subtitle="CONTROLE DE MATRÍCULAS E PRESENÇA"
        extra={
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-wider bg-app-bg text-app-muted hover:bg-white/10 hover:text-app transition-all border border-white/5 active:scale-95">
              <FileDown size={18} strokeWidth={1.9} /> IMPORTAR
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-2xl text-[11px] font-black uppercase tracking-wider bg-app-bg text-app-muted hover:bg-white/10 hover:text-app transition-all border border-white/5 active:scale-95">
              <FileUp size={18} strokeWidth={1.9} /> EXPORTAR
            </button>
            {isAdminView && (
              <button
                onClick={() => { setDuplicateData(null); setShowModal(true) }}
                className="btn-primary flex items-center gap-2 px-5 py-2 rounded-2xl text-[11px] font-black uppercase tracking-wider shadow-xl active:scale-95"
              >
                <Plus size={18} strokeWidth={1.9} /> NOVO ALUNO
              </button>
            )}
          </div>
        }
      />

      <div className="px-4 md:px-6 py-6 pb-12 fade-slide-up space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          <KPICard title="Ativos" value={stats.active} description="Alunos matriculados e frequentando" icon={UserCheck} valueColor="text-emerald-400"
            onClick={() => setStatusFilter(statusFilter === 'ativo' ? 'todos' : 'ativo')} active={statusFilter === 'ativo'} />
          <KPICard title="Inativos" value={stats.inactive} description="Alunos que cancelaram ou pararam" icon={UserX}
            onClick={() => setStatusFilter(statusFilter === 'inativo' ? 'todos' : 'inativo')} active={statusFilter === 'inativo'} />
          <KPICard
            title="Graduados"
            value={journeyStats?.totalGraduated || 0}
            description="Total de alunos com faixa"
            icon={Award}
            valueColor="text-blue-400"
          />
          <KPICard
            title="Aptos a Avaliar"
            value={journeyStats?.dueForAssessment || 0}
            description="Alunos em período de troca"
            icon={Target}
            valueColor="text-rose-500"
          />
        </div>

        {/* Elite Search Bar (Outside) */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative group">
            <Search size={18} strokeWidth={1.9} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-white transition-colors" />
            <input
              className="w-full bg-[#111] border border-white/5 rounded-xl pl-12 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-white/10 transition-all font-medium"
              placeholder="Buscar por nome, email, telefone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {(statusFilter !== 'todos' || modalityFilter !== 'todas' || searchTerm) && (
            <button
              onClick={() => { setStatusFilter('todos'); setModalityFilter('todas'); setSearchTerm('') }}
              className="flex items-center justify-center gap-2 px-6 h-[46px] rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
            >
              <RefreshCcw size={18} strokeWidth={1.9} /> Limpar Filtros
            </button>
          )}
        </div>


        <div className="bg-[#0B0B0D]/80 backdrop-blur-md rounded-[24px] p-6 md:p-8 border border-white/5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-50" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Ordenar por', value: sortBy, onChange: setSortBy, options: [['recente', 'Mais Recente'], ['az', 'A → Z'], ['za', 'Z → A']] },
              { label: 'Status', value: statusFilter, onChange: setStatusFilter, options: [['todos', 'Todos'], ['ativo', 'Ativos'], ['inativo', 'Inativos'], ['suspenso', 'Suspensos'], ['arquivado', 'Arquivados']] },
              { label: ' Pagamento', value: '', onChange: () => { }, disabled: true, options: [['', 'Todos']] },
              { label: 'Modalidade', value: modalityFilter, onChange: setModalityFilter, options: modalities.map(m => [m, m === 'todas' ? 'Todas' : m]) },
            ].map(({ label, value, onChange, options, disabled }) => (
              <CustomSelect key={label} label={label} value={value} onChange={onChange} options={options} disabled={disabled} />
            ))}
          </div>

          <div className="w-full overflow-x-auto rounded-2xl border border-white/5 bg-black/20">
            {isLoadingStudents ? (
              <div className="text-center py-16 text-gray-500">Carregando alunos...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <Users size={48} strokeWidth={1.5} className="mx-auto mb-4 opacity-20" />
                <p className="text-sm font-medium">Nenhum aluno encontrado.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase font-black text-gray-500 tracking-wider bg-white/5">
                    <th className="py-3 px-5">Aluno</th>
                    <th className="py-3 px-5 text-center">Telefone</th>
                    <th className="py-3 px-5 text-center">PIN</th>
                    <th className="py-3 px-5 text-center">Modalidade</th>
                    <th className="py-3 px-5 text-center">Pagamento</th>
                    <th className="py-3 px-5 w-12 text-center text-gray-500">CTO</th>
                    <th className="py-3 px-5 text-center">Status</th>
                    <th className="py-3 px-5 w-12 text-center text-gray-500">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map((student, index) => (

                    <tr key={student.id} className="hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => setSelectedStudent(student)}>
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-4">
                          {renderAvatar(student)}
                          <div className="flex flex-col">
                            <span className="text-sm text-app font-medium block uppercase tracking-tight group-hover:text-primary transition-colors">
                              {student.name}
                            </span>
                            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mt-0.5">
                              {beltConfig[student.belt]?.label || 'Sem faixa'}
                              {student.stripes > 0 ? ` · ${student.stripes} GRAUS` : ''}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-center text-sm text-gray-300">
                        {student.phone ? (
                          <a
                            href={`https://wa.me/${student.phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold hover:bg-emerald-500/20 transition-all font-mono"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Smartphone size={12} />
                            {student.phone}
                          </a>
                        ) : (
                          <span className="text-gray-600">--</span>
                        )}
                      </td>
                      <td className="py-4 px-5 text-center">
                        {canSeeStudents ? (
                          <div className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-sm font-mono text-emerald-400 tracking-[0.2em] min-w-[80px]">
                            {student.pin || fetchedPins[student.id] || '---'}
                          </div>
                        ) : (
                          <div className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-sm font-mono text-gray-700 tracking-widest min-w-[80px]">
                            ••••••
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <div className="flex flex-wrap justify-center gap-1 max-w-[150px] mx-auto">
                          {(student.modalities || [student.modality]).map((m, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] text-gray-400 uppercase font-bold whitespace-nowrap">
                              {m}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-4 px-5 text-center">
                        <span className="px-3 py-1.5 rounded-xl bg-white/5 text-gray-600 text-[10px] font-black uppercase border border-white/5 whitespace-nowrap">
                          Em breve
                        </span>
                      </td>

                      <td className="py-4 px-5 text-center">
                        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 mx-auto">
                          <FileText size={18} strokeWidth={1.9} className="text-gray-500" />
                        </div>
                      </td>
                      <td className="py-4 px-5 text-center">{renderStatusBadge(student)}</td>
                      <td className="py-4 px-5 text-center">
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              const openUp = window.innerHeight - rect.bottom < 400;
                              setMenuPosition({
                                top: openUp ? (rect.top + window.scrollY) - 410 : (rect.top + window.scrollY) + rect.height + 4,
                                left: (rect.left + window.scrollX) - 160 + rect.width,
                                originY: openUp ? 1 : 0
                              });
                              setShowMenu(showMenu === student.id ? null : student.id);
                            }}
                            className={`p-2.5 rounded-xl transition-all active:scale-90 border border-transparent flex items-center justify-center mx-auto ${showMenu === student.id ? 'bg-white/10 text-white border-white/10' : 'hover:bg-white/10 text-white/20 hover:text-white hover:border-white/10'}`}
                          >
                            <MoreVertical size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                  }
                </tbody >
              </table >
            )}
          </div >

          {!isLoadingStudents && (
            <p className="text-[11px] text-gray-600 text-center mt-4">
              Exibindo {filtered.length} de {students.length} aluno{students.length !== 1 ? 's' : ''}
            </p>
          )}
        </div >
      </div >

      {/* Modais e Gavetas */}
      < AttendanceHistoryDrawer
        student={attendanceDrawerStudent}
        isOpen={!!attendanceDrawerStudent}
        onClose={() => setAttendanceDrawerStudent(null)}
      />

      < GraduationHistoryModal
        student={graduationModalStudent}
        isOpen={!!graduationModalStudent}
        onClose={() => setGraduationModalStudent(null)}
      />

      < PaymentDrawer
        student={paymentDrawerStudent}
        isOpen={!!paymentDrawerStudent}
        onClose={() => setPaymentDrawerStudent(null)}
      />

      {
        statusDialogStudent && (
          <StatusChangeDialog
            student={statusDialogStudent.student}
            action={statusDialogStudent.action}
            onConfirm={handleStatusChange}
            onClose={() => setStatusDialogStudent(null)}
          />
        )
      }

      {
        deleteDialogStudent && (
          <DeleteConfirmDialog
            student={deleteDialogStudent}
            onConfirm={handleConfirmDelete}
            onClose={() => setDeleteDialogStudent(null)}
          />
        )
      }

      {
        selectedStudent && (
          <StudentDetailsModal
            student={selectedStudent}
            onClose={() => setSelectedStudent(null)}
            onUpdate={updateStudentProfile}
          />
        )
      }

      {
        showModal && (
          <AddStudentModal
            isOpen={true}
            initialModality={currentModality}
            initialData={editData || duplicateData}
            isDuplicate={!!duplicateData}
            onClose={() => {
              setShowModal(false)
              setEditData(null)
              setDuplicateData(null)
            }}
            onAdd={handleAddStudent}
          />
        )
      }

      {/* 🛡️ Pin Verification for Sensitive Actions */}
      {showPinModal && (
        <PinVerificationModal
          onConfirm={() => {
            const { type, student } = pinModalAction;
            setShowPinModal(false);
            if (type === 'view') {
              setSelectedStudent(student);
            } else if (type === 'edit') {
              setEditData(student);
              setShowModal(true);
            } else if (type === 'delete') {
              setDeleteDialogStudent(student);
            }
          }}
          onClose={() => setShowPinModal(false)}
          title="Confirmar Identidade"
          message={`Você está tentando ${pinModalAction?.type === 'view' ? 'visualizar' : pinModalAction?.type === 'edit' ? 'editar' : 'excluir'} os dados de ${pinModalAction?.student?.name}.`}
        />
      )}

      {/* GLOBAL ACTIONS MENU PORTAL */}
      <AnimatePresence>
        {showMenu && (
          <StudentActionMenu
            student={filtered.find(s => s.id === showMenu)}
            menuPosition={menuPosition}
            onClose={() => setShowMenu(null)}
            onAction={(actionType, student) => {
              if (actionType === 'view') {
                setSelectedStudent(student);
              } else if (actionType === 'attendance') {
                setAttendanceDrawerStudent(student);
              } else if (actionType === 'duplicate') {
                // Passamos os dados do aluno para criar um novo idêntico (sem o ID)
                setDuplicateData(student);
                setShowModal(true);
              } else if (actionType === 'graduations') {
                setGraduationModalStudent(student);
              } else if (actionType === 'cards') {
                setPaymentDrawerStudent(student);
              } else if (actionType === 'inactive' || actionType === 'suspend' || actionType === 'archive') {
                // Status changes don't require PIN in current logic, but we map them to the StatusDialog
                // We translate the action type to the expected dialog format
                const actionMap = { inactive: 'inativar', suspend: 'suspender', archive: 'arquivar' };
                setStatusDialogStudent({ student, action: actionMap[actionType] });
              } else if (actionType === 'edit' || actionType === 'delete') {
                setPinModalAction({ type: actionType, student });
                setShowPinModal(true);
              }
              setShowMenu(null);
            }}
          />
        )}
      </AnimatePresence>
    </>
  )
}

/**
 * StudentActionMenu - Renderiza o menu de ações de um aluno
 */
function StudentActionMenu({ student, menuPosition, onClose, onAction }) {
  if (!student) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      />

      {/* Desktop Menu */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        onClick={e => e.stopPropagation()}
        className="hidden md:block absolute z-[1001] w-64 bg-[#0F0F0F] border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-2"
        style={{
          top: menuPosition.top,
          left: menuPosition.left,
          originX: 1,
          originY: menuPosition.originY
        }}
      >
        <button onClick={(e) => { e.stopPropagation(); onAction('edit', student) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-all group font-medium">
          <div className="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
            <Edit2 size={14} className="text-orange-400" />
          </div>
          Editar
        </button>
        <button onClick={(e) => { e.stopPropagation(); onAction('duplicate', student) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-all group font-medium">
          <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
            <Copy size={14} className="text-purple-400" />
          </div>
          Duplicar
        </button>
        <button onClick={(e) => { e.stopPropagation(); onAction('attendance', student) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-all group font-medium">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
            <CalendarDays size={14} className="text-blue-400" />
          </div>
          Histórico de Presença
        </button>
        <button onClick={(e) => { e.stopPropagation(); onAction('graduations', student) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-all group font-medium">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
            <GraduationCap size={14} className="text-emerald-400" />
          </div>
          Histórico de Graduações
        </button>
        <button onClick={(e) => { e.stopPropagation(); onAction('cards', student) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-all group font-medium">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
            <CreditCard size={14} className="text-indigo-400" />
          </div>
          Cartões / Financeiro
        </button>

        <div className="h-px bg-white/5 my-1" />

        <button onClick={(e) => { e.stopPropagation(); onAction('inactive', student) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-400 hover:bg-gray-500/10 hover:text-gray-300 transition-all group font-medium">
          <div className="w-8 h-8 rounded-lg bg-gray-500/10 flex items-center justify-center group-hover:bg-gray-500/20 transition-colors">
            <UserX size={14} className="text-gray-400" />
          </div>
          Inativar
        </button>
        <button onClick={(e) => { e.stopPropagation(); onAction('suspend', student) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#FFD700] hover:bg-[#FFD700]/10 transition-all group font-medium">
          <div className="w-8 h-8 rounded-lg bg-[#FFD700]/10 flex items-center justify-center group-hover:bg-[#FFD700]/20 transition-colors">
            <UserMinus size={14} className="text-[#FFD700]" />
          </div>
          Suspender
        </button>
        <button onClick={(e) => { e.stopPropagation(); onAction('archive', student) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-blue-500 hover:bg-blue-500/10 transition-all group font-medium">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
            <Archive size={14} className="text-blue-500" />
          </div>
          Arquivar
        </button>
        <button onClick={(e) => { e.stopPropagation(); onAction('delete', student) }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-all group font-medium">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
            <Trash2 size={14} className="text-red-500" />
          </div>
          Deletar
        </button>
      </motion.div>

      {/* Mobile Drawer */}
      <div className="md:hidden">
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-x-0 bottom-0 bg-[#0A0A0A] border-t border-white/10 rounded-t-[32px] p-6 pb-12 z-[1002] shadow-[0_-8px_30px_rgb(0,0,0,0.8)]"
        >
          <div className="w-12 h-1.5 bg-white/15 rounded-full mx-auto mb-6" />

          <div className="flex items-center gap-4 mb-8 text-left">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center font-black text-lg border border-white/10">
              {student.photo ? (
                <img src={student.photo} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                student.name.charAt(0)
              )}
            </div>
            <div className="min-w-0">
              <p className="text-base font-black text-white truncate">{student.name}</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Aluno da Academia</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 text-left">
            <button
              onClick={(e) => { e.stopPropagation(); onAction('edit', student) }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 active:scale-95 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Edit2 size={20} className="text-orange-500" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Editar</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mt-1">Alterar dados do aluno</p>
              </div>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onAction('duplicate', student) }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 active:scale-95 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Copy size={20} className="text-purple-500" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Duplicar</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mt-1">Copiar informações</p>
              </div>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onAction('attendance', student) }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 active:scale-95 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <CalendarDays size={20} className="text-blue-500" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Frequência</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mt-1">Histórico de aulas</p>
              </div>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onAction('graduations', student) }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 active:scale-95 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <GraduationCap size={20} className="text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Graduações</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mt-1">Histórico de faixas</p>
              </div>
            </button>

            <button
              onClick={(e) => { e.stopPropagation(); onAction('cards', student) }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 active:scale-95 text-left"
            >
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center">
                <CreditCard size={20} className="text-indigo-500" />
              </div>
              <div>
                <p className="text-sm font-black text-white">Financeiro</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mt-1">Cartões e pagamentos</p>
              </div>
            </button>

            <div className="grid grid-cols-2 gap-3 mt-1">
              <button
                onClick={(e) => { e.stopPropagation(); onAction('inactive', student) }}
                className="w-full flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 border border-white/5 active:scale-95 text-center transition-colors hover:bg-white/10"
              >
                <div className="w-8 h-8 rounded-lg bg-gray-500/10 flex items-center justify-center">
                  <UserX size={16} className="text-gray-400" />
                </div>
                <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Inativar</p>
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); onAction('suspend', student) }}
                className="w-full flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-[#FFD700]/5 border border-[#FFD700]/10 active:scale-95 text-center transition-colors hover:bg-[#FFD700]/10"
              >
                <div className="w-8 h-8 rounded-lg bg-[#FFD700]/10 flex items-center justify-center">
                  <UserMinus size={16} className="text-[#FFD700]" />
                </div>
                <p className="text-[11px] font-black text-[#FFD700] uppercase tracking-widest">Suspender</p>
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); onAction('archive', student) }}
                className="w-full flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-blue-500/5 border border-blue-500/10 active:scale-95 text-center transition-colors hover:bg-blue-500/10"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Archive size={16} className="text-blue-500" />
                </div>
                <p className="text-[11px] font-black text-blue-500 uppercase tracking-widest">Arquivar</p>
              </button>

              <button
                onClick={(e) => { e.stopPropagation(); onAction('delete', student) }}
                className="w-full flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-red-500/5 border border-red-500/10 active:scale-95 text-center transition-colors hover:bg-red-500/10"
              >
                <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <Trash2 size={16} className="text-red-500" />
                </div>
                <p className="text-[11px] font-black text-red-500 uppercase tracking-widest">Deletar</p>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>,
    document.body
  );
}


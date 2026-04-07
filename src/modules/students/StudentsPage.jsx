// RESUMO: Gerenciamento de Alunos.
// Centraliza a listagem, filtros por status/modalidade, busca global e ações rápidas (editar, financeiro, graduação).
// Implementa diálogos de segurança para deleção e alteração de status (inativação/suspensão).
import React, { useMemo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Users, Plus, FileDown, FileUp, Search,
  UserCheck, UserX, UserMinus, Archive, MoreVertical,
  Edit2, Copy, CalendarDays, GraduationCap, CreditCard, Trash2,
  FileText, RefreshCcw, ChevronDown
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useStudents } from '../../hooks/useStudents'
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
import { beltConfig } from '../../data/beltConfig'
import MobileHeader from '../../components/navigation/MobileHeader'
import { Award, Target } from 'lucide-react'

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

// COMPONENTE PRINCIPAL: StudentsPage
// Gere o estado global da lista de alunos e os modais de ação específica.
export default function StudentsPage() {
  const { currentModality, isAdminView } = useApp()
  const { user, userData } = useAuth()
  const { students, isLoadingStudents, addStudent, updateStudentProfile, changeStudentStatus, deleteStudent } = useStudents()
  const journeyStats = useStudentJourney()

  const [showModal, setShowModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [duplicateData, setDuplicateData] = useState(null)

  // Gavetas e Modais por aluno
  const [attendanceDrawerStudent, setAttendanceDrawerStudent] = useState(null)
  const [graduationModalStudent, setGraduationModalStudent] = useState(null)
  const [paymentDrawerStudent, setPaymentDrawerStudent] = useState(null)
  const [statusDialogStudent, setStatusDialogStudent] = useState(null) // { student, action }
  const [deleteDialogStudent, setDeleteDialogStudent] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [modalityFilter, setModalityFilter] = useState('todas')
  const [sortBy, setSortBy] = useState('recente')
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [menuAnchor, setMenuAnchor] = useState({ top: 0, left: 0 })
  const menuRef = useRef(null)

  // Efeito para fechar o menu popup ao clicar fora ou rolar a página.
  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpenId(null)
    }
    function handleScroll() { if (menuOpenId) setMenuOpenId(null) }
    document.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('scroll', handleScroll, true)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('scroll', handleScroll, true)
    }
  }, [menuOpenId])

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
    if (searchTerm) {
      const lower = searchTerm.toLowerCase()
      list = list.filter(s =>
        (s.name || '').toLowerCase().includes(lower) ||
        (s.email || '').toLowerCase().includes(lower) ||
        (s.phone || '').includes(lower)
      )
    }
    if (statusFilter !== 'todos') list = list.filter(s => normalizeStatus(s.status) === statusFilter)
    if (modalityFilter !== 'todas') list = list.filter(s => s.modality === modalityFilter)
    if (sortBy === 'az') list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    if (sortBy === 'za') list = [...list].sort((a, b) => (b.name || '').localeCompare(a.name || ''))
    return list
  }, [students, searchTerm, statusFilter, modalityFilter, sortBy])

  function handleOpenMenu(e, studentId) {
    e.stopPropagation()
    if (menuOpenId === studentId) { setMenuOpenId(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const menuHeight = 400
    const top = spaceBelow < menuHeight ? rect.top - menuHeight + 20 : rect.bottom - 10
    setMenuAnchor({ top, left: rect.left - 220 })
    setMenuOpenId(studentId)
  }

  async function handleAddStudent(data, modality, options) {
    const chosen = modality || currentModality || 'Jiu-Jitsu'
    try {
      await addStudent(data, chosen, options)
      setShowModal(false)
      setDuplicateData(null)
    } catch (err) {
      alert('Erro ao salvar. Verifique sua conexão.')
    }
  }

  async function handleStatusChange({ reason, returnDate }) {
    const { student, action } = statusDialogStudent
    const newStatus = action === 'inativar' ? 'inativo' : 'suspenso'
    await changeStudentStatus(student.id, newStatus, { reason, returnDate })
    setStatusDialogStudent(null)
  }

  async function handleConfirmDelete() {
    // PROTEÇÃO DE AUTO-EXCLUSÃO: Impede que o usuário logado se delete por acidente.
    const isSelf = 
      deleteDialogStudent.id.toLowerCase() === (user?.email || '').toLowerCase() || 
      deleteDialogStudent.id === user?.uid
    
    if (isSelf) {
      alert("🛑 SEGURANÇA: Você não pode excluir sua própria conta administrativa enquanto estiver logado no sistema.")
      setDeleteDialogStudent(null)
      return
    }

    await deleteStudent(deleteDialogStudent.id)
    setDeleteDialogStudent(null)
  }

  function handleDuplicate(student) {
    setMenuOpenId(null)
    setDuplicateData({
      name: `${student.name} (Cópia)`,
      email: '',
      phone: student.phone || '',
      emergency: student.emergency || '',
      medical: student.medical || '',
      ageCategory: student.ageCategory || 'Adulto',
      gender: student.gender || 'Masculino',
    })
    setShowModal(true)
  }

  function renderAvatar(student) {
    const bgClass = beltConfig[student.belt]?.bgClass || 'belt-none'
    const initials = student.initials || student.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'A'
    
    if (student.photo || student.photoURL) {
      return <img src={student.photo || student.photoURL} alt="" className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10" />
    }
    
    return (
      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-black ring-1 ring-white/5 shadow-2xl ${bgClass} relative overflow-hidden group-hover:ring-white/20 transition-all`}>
        <div className="absolute inset-0 bg-gradient-to-tr from-black/20 to-transparent opacity-40" />
        <span className="relative z-10 drop-shadow-md text-white">
          {initials}
        </span>
      </div>
    )
  }

  function renderStatusBadge(student) {
    const norm = normalizeStatus(student.status)
    const cfg = {
      ativo: 'bg-primary/10 text-primary border-primary/20',
      inativo: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
      suspenso: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
      arquivado: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    }
    const labels = { ativo: 'Ativo', inativo: 'Inativo', suspenso: 'Suspenso', arquivado: 'Arquivado' }
    return (
      <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border inline-flex ${cfg[norm]}`}>
        {labels[norm]}
      </span>
    )
  }

  const menuItems = (student) => {
    const norm = normalizeStatus(student.status)
    return [
      { label: 'Editar', icon: Edit2, action: () => { setSelectedStudent(student); setMenuOpenId(null) } },
      { label: 'Duplicar', icon: Copy, action: () => handleDuplicate(student) },
      { label: 'Histórico de Presença', icon: CalendarDays, action: () => { setAttendanceDrawerStudent(student); setMenuOpenId(null) } },
      { label: 'Histórico de Graduações', icon: GraduationCap, action: () => { setGraduationModalStudent(student); setMenuOpenId(null) } },
      { label: 'Cartões / Financeiro', icon: CreditCard, action: () => { setPaymentDrawerStudent(student); setMenuOpenId(null) } },
      null, // separador
      ...(norm !== 'ativo' ? [{ label: 'Reativar', icon: RefreshCcw, color: 'text-emerald-400', action: () => { changeStudentStatus(student.id, 'ativo'); setMenuOpenId(null) } }] : []),
      ...(norm !== 'inativo' ? [{ label: 'Inativar', icon: UserX, color: 'text-gray-400', action: () => { setStatusDialogStudent({ student, action: 'inativar' }); setMenuOpenId(null) } }] : []),
      ...(norm !== 'suspenso' ? [{ label: 'Suspender', icon: UserMinus, color: 'text-yellow-400', action: () => { setStatusDialogStudent({ student, action: 'suspender' }); setMenuOpenId(null) } }] : []),
      ...(norm !== 'arquivado' ? [{ label: 'Arquivar', icon: Archive, color: 'text-blue-400', action: () => { changeStudentStatus(student.id, 'arquivado'); setMenuOpenId(null) } }] : []),
      null,
      { label: 'Deletar', icon: Trash2, color: 'text-primary', bold: true, action: () => { setDeleteDialogStudent(student); setMenuOpenId(null) } },
    ]
  }

  return (
    <div className="flex flex-col flex-1 w-full min-w-0 bg-[#050505]">
      {/* Header Mobile */}
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

      {/* Header Desktop */}
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

        {/* KPI Cards */}
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
              className="w-full bg-[#111] border border-white/5 rounded-[24px] pl-12 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-white/10 transition-all font-medium"
              placeholder="Buscar por nome, email, telefone..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {(statusFilter !== 'todos' || modalityFilter !== 'todas' || searchTerm) && (
            <button 
              onClick={() => { setStatusFilter('todos'); setModalityFilter('todas'); setSearchTerm('') }}
              className="flex items-center justify-center gap-2 px-6 h-[54px] rounded-[24px] text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap bg-white/5 text-gray-400 hover:bg-white/10 border border-white/5"
            >
              <RefreshCcw size={16} strokeWidth={2.5} /> Limpar
            </button>
          )}
        </div>

        <div className="bg-[#0B0B0D]/80 backdrop-blur-md rounded-[24px] p-6 md:p-8 border border-white/5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-50" />
          {/* Filtros */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Ordenar por', value: sortBy, onChange: setSortBy, options: [['recente', 'Mais Recente'], ['az', 'A → Z'], ['za', 'Z → A']] },
              { label: 'Status do Aluno', value: statusFilter, onChange: setStatusFilter, options: [['todos', 'Todos'], ['ativo', 'Ativos'], ['inativo', 'Inativos'], ['suspenso', 'Suspensos'], ['arquivado', 'Arquivados']] },
              { label: 'Status Pagamento', value: '', onChange: () => { }, disabled: true, options: [['', 'Todos']] },
              { label: 'Modalidade', value: modalityFilter, onChange: setModalityFilter, options: modalities.map(m => [m, m === 'todas' ? 'Todas' : m]) },
            ].map(({ label, value, onChange, options, disabled }) => (
              <CustomSelect key={label} label={label} value={value} onChange={onChange} options={options} disabled={disabled} />
            ))}
          </div>

          {/* Tabela */}
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
                  {filtered.map((student) => (
                    <tr key={student.id} className="hover:bg-white/5 transition-colors group cursor-pointer" onClick={() => setSelectedStudent(student)}>
                    <td className="py-4 px-5">
                        <div className="flex items-center gap-4">
                          {renderAvatar(student)}
                          <div>
                            <span className="text-sm text-app font-black">{student.name}</span>
                            <p className="text-[11px] text-gray-500 mt-0.5 uppercase">
                              {beltConfig[student.belt]?.label || 'Sem faixa'}
                              {student.stripes > 0 ? ` · ${student.stripes}g` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-center text-sm text-gray-300">{student.phone || '--'}</td>
                      <td className="py-4 px-5 text-center">
                        <div className="inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white/5 border border-white/5 text-sm font-mono text-emerald-400/80 tracking-widest min-w-[80px]">
                          {student.pin || '---'}
                        </div>
                      </td>
                      <td className="py-4 px-5 text-center text-sm text-gray-400">{student.modality || '--'}</td>
                      <td className="py-4 px-5 text-center">
                        <span className="px-3 py-1.5 rounded-xl bg-gray-500/10 text-gray-400 text-[10px] font-black uppercase border border-gray-500/20">Em breve</span>
                      </td>
                      <td className="py-4 px-5 text-center">
                        <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 mx-auto">
                          <FileText size={18} strokeWidth={1.9} className="text-gray-500" />
                        </div>
                      </td>
                      <td className="py-4 px-5 text-center">{renderStatusBadge(student)}</td>
                      <td className="py-4 px-5 text-center relative">
                        <button
                          onClick={e => handleOpenMenu(e, student.id)}
                          className="p-2 rounded-xl hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                        >
                          <MoreVertical size={18} strokeWidth={1.9} />
                        </button>

                        {menuOpenId === student.id && createPortal(
                          <div
                            ref={menuRef}
                            onClick={e => e.stopPropagation()}
                            className="fixed bg-[#0F0F0F] border border-white/10 rounded-2xl z-[9999] overflow-hidden text-sm py-2 fade-slide-up"
                            style={{ top: menuAnchor.top, left: menuAnchor.left, width: 240, boxShadow: '0 24px 80px rgba(0,0,0,0.8)' }}
                          >
                            {menuItems(student).map((item, idx) =>
                              item === null ? (
                                <div key={`sep-${idx}`} className="border-b border-white/5 my-1" />
                              ) : (
                                <button
                                  key={item.label}
                                  onClick={item.action}
                                  className={`w-full text-left px-5 py-2.5 hover:bg-white/5 flex items-center gap-3 transition-colors ${item.bold ? 'font-bold' : 'font-medium'} ${item.color || 'text-gray-300'}`}
                                >
                                  <item.icon size={18} strokeWidth={1.9} className="shrink-0" />
                                  {item.label}
                                </button>
                              )
                            )}
                          </div>,
                          document.body
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!isLoadingStudents && (
            <p className="text-[11px] text-gray-600 text-center mt-4">
              Exibindo {filtered.length} de {students.length} aluno{students.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Modais e Gavetas */}
      <AttendanceHistoryDrawer
        student={attendanceDrawerStudent}
        isOpen={!!attendanceDrawerStudent}
        onClose={() => setAttendanceDrawerStudent(null)}
      />

      <GraduationHistoryModal
        student={graduationModalStudent}
        isOpen={!!graduationModalStudent}
        onClose={() => setGraduationModalStudent(null)}
      />

      <PaymentDrawer
        student={paymentDrawerStudent}
        isOpen={!!paymentDrawerStudent}
        onClose={() => setPaymentDrawerStudent(null)}
      />

      {statusDialogStudent && (
        <StatusChangeDialog
          student={statusDialogStudent.student}
          action={statusDialogStudent.action}
          onConfirm={handleStatusChange}
          onClose={() => setStatusDialogStudent(null)}
        />
      )}

      {deleteDialogStudent && (
        <DeleteConfirmDialog
          student={deleteDialogStudent}
          onConfirm={handleConfirmDelete}
          onClose={() => setDeleteDialogStudent(null)}
        />
      )}

      {selectedStudent && (
        <StudentDetailsModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onUpdate={updateStudentProfile}
        />
      )}

      {showModal && (
        <AddStudentModal
          initialModality={currentModality}
          initialData={duplicateData}
          onClose={() => { setShowModal(false); setDuplicateData(null) }}
          onAdd={handleAddStudent}
        />
      )}
    </div>
  )
}


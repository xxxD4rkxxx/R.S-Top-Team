import React, { useMemo, useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Users, Plus, FileDown, FileUp, Search,
  UserCheck, UserX, UserMinus, Archive, MoreVertical,
  Edit2, Copy, CalendarDays, GraduationCap, CreditCard, Trash2,
  FileText, RefreshCcw, ChevronDown, Phone, MapPin, 
  Filter, ArrowUpDown, ChevronRight, X, Zap,
  HelpCircle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStudents } from '../../hooks/useStudents'
import { useApp } from '../../context/AppContext'
import AddStudentModal from '../../components/shared/AddStudentModal'
import GraduationHistoryModal from '../../components/students/GraduationHistoryModal'
import PaymentDrawer from '../../components/students/PaymentDrawer'
import StatusChangeDialog from '../../components/students/StatusChangeDialog'
import AttendanceHistoryDrawer from '../../components/students/AttendanceHistoryDrawer'
import PageHeader from '../../components/shared/PageHeader'
import MobileHeader from '../../components/navigation/MobileHeader'
import StudentDetailsModal from '../../components/shared/StudentDetailsModal'
import { beltConfig } from '../../data/beltConfig'

// --- MOBILE COMPONENTS ---

const StudentCard = ({ student, onClick, onAction }) => {
  const norm = normalizeStatus(student.status)
  const cfg = beltConfig[student.belt] || beltConfig['white']
  
  const statusColors = {
    ativo: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
    inativo: 'border-gray-500/20 bg-gray-500/5 text-gray-400',
    suspenso: 'border-yellow-500/20 bg-yellow-500/5 text-yellow-400',
    arquivado: 'border-blue-500/20 bg-blue-500/5 text-blue-400'
  }

  return (
    <motion.div 
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className="p-4 rounded-[5px] bg-[#121212] border border-white/10 active:scale-[0.97] transition-all flex items-center gap-4 group hover:border-primary/30"
    >
      <div className={`w-12 h-12 rounded-[5px] shrink-0 flex items-center justify-center font-black text-lg shadow-lg border border-white/10 ${cfg.bgClass}`} style={{ color: cfg.textColor }}>
        {student.photo ? (
          <img src={student.photo} alt="" className="w-full h-full rounded-[5px] object-cover" />
        ) : (
          student.initials || student.name?.[0] || 'A'
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h4 className="font-bold text-white text-sm truncate">{student.name}</h4>
          <span className={`px-2 py-0.5 rounded-[5px] text-[9px] font-bold uppercase tracking-wider border ${statusColors[norm]}`}>
            {norm}
          </span>
        </div>
        <p className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider mt-0.5">
          {cfg.label} {student.stripes > 0 ? `· ${student.stripes} Graus` : ''}
        </p>
        <div className="flex items-center gap-3 mt-2">
          <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium bg-black/40 px-2 py-1 rounded-[5px] border border-white/5">
            <Zap size={10} className="text-primary" />
            {student.modality || '--'}
          </div>
          {student.phone && (
            <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium bg-black/40 px-2 py-1 rounded-[5px] border border-white/5">
              <Phone size={10} className="text-emerald-400" />
              {student.phone}
            </div>
          )}
        </div>
      </div>

      <button 
        onClick={(e) => { e.stopPropagation(); onAction(e, student) }}
        className="p-2 rounded-[5px] hover:bg-white/10 text-gray-400 active:scale-90 transition-transform"
      >
        <MoreVertical size={18} />
      </button>
    </motion.div>
  )
}

// --- UTILS ---

function normalizeStatus(status) {
  if (!status || status === 'ativo' || status === 'active') return 'ativo'
  if (status === 'inativo' || status === 'inactive') return 'inativo'
  if (status === 'suspenso' || status === 'suspended') return 'suspenso'
  if (status === 'arquivado' || status === 'archived') return 'arquivado'
  return 'ativo'
}

// --- MAIN COMPONENT ---

export default function StudentsPage() {
  const { currentModality, isAdminView } = useApp()
  const { students, isLoadingStudents, addStudent, updateStudentProfile, changeStudentStatus, deleteStudent } = useStudents()

  const [showModal, setShowModal] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [duplicateData, setDuplicateData] = useState(null)

  const [attendanceDrawerStudent, setAttendanceDrawerStudent] = useState(null)
  const [graduationModalStudent, setGraduationModalStudent] = useState(null)
  const [paymentDrawerStudent, setPaymentDrawerStudent] = useState(null)
  const [statusDialogStudent, setStatusDialogStudent] = useState(null) 
  const [deleteDialogStudent, setDeleteDialogStudent] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [modalityFilter, setModalityFilter] = useState('todas')
  const [sortBy, setSortBy] = useState('recente')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [showMobileSearch, setShowMobileSearch] = useState(false)
  
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [menuAnchor, setMenuAnchor] = useState({ top: 0, left: 0 })
  const menuRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpenId(null)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
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
        (s.phone || '').includes(lower) ||
        (s.pin || '').includes(lower)
      )
    }
    if (statusFilter !== 'todos') list = list.filter(s => normalizeStatus(s.status) === statusFilter)
    if (modalityFilter !== 'todas') list = list.filter(s => s.modality === modalityFilter)
    
    if (sortBy === 'az') list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    if (sortBy === 'za') list = [...list].sort((a, b) => (b.name || '').localeCompare(a.name || ''))
    if (sortBy === 'recente') list = [...list].sort((a,b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
    
    return list
  }, [students, searchTerm, statusFilter, modalityFilter, sortBy])

  function handleOpenMenu(e, student) {
    if (window.innerWidth <= 768) {
      const rect = e.currentTarget.getBoundingClientRect()
      setMenuAnchor({ top: rect.top, left: rect.left - 200 })
      setMenuOpenId(student.id)
    } else {
      const rect = e.currentTarget.getBoundingClientRect()
      setMenuAnchor({ top: rect.bottom + 5, left: rect.left - 200 })
      setMenuOpenId(student.id)
    }
  }

  const handleStatusChange = async ({ reason, returnDate }) => {
    const { student, action } = statusDialogStudent
    const newStatus = action === 'inativar' ? 'inativo' : 'suspenso'
    await changeStudentStatus(student.id, newStatus, { reason, returnDate })
    setStatusDialogStudent(null)
  }

  const handleDuplicate = (student) => {
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

  const menuItems = (student) => {
    const norm = normalizeStatus(student.status)
    return [
      { label: 'Editar', icon: Edit2, action: () => { setSelectedStudent(student); setMenuOpenId(null) } },
      { label: 'Duplicar', icon: Copy, action: () => handleDuplicate(student) },
      { label: 'Frequência', icon: CalendarDays, action: () => { setAttendanceDrawerStudent(student); setMenuOpenId(null) } },
      { label: 'Graduações', icon: GraduationCap, action: () => { setGraduationModalStudent(student); setMenuOpenId(null) } },
      { label: 'Financeiro', icon: CreditCard, action: () => { setPaymentDrawerStudent(student); setMenuOpenId(null) } },
      null, 
      ...(norm !== 'ativo' ? [{ label: 'Reativar', icon: RefreshCcw, color: 'text-emerald-400', action: () => { changeStudentStatus(student.id, 'ativo'); setMenuOpenId(null) } }] : []),
      ...(norm !== 'inativo' ? [{ label: 'Inativar', icon: UserX, color: 'text-gray-400', action: () => { setStatusDialogStudent({ student, action: 'inativar' }); setMenuOpenId(null) } }] : []),
      ...(norm !== 'suspenso' ? [{ label: 'Suspender', icon: UserMinus, color: 'text-yellow-400', action: () => { setStatusDialogStudent({ student, action: 'suspender' }); setMenuOpenId(null) } }] : []),
      ...(norm !== 'arquivado' ? [{ label: 'Arquivar', icon: Archive, color: 'text-blue-400', action: () => { changeStudentStatus(student.id, 'arquivado'); setMenuOpenId(null) } }] : []),
      null,
      { label: 'Deletar', icon: Trash2, color: 'text-primary', bold: true, action: () => { setDeleteDialogStudent(student); setMenuOpenId(null) } },
    ]
  }

  return (
    <div className="flex flex-col flex-1 w-full min-h-dvh bg-[#050505] overflow-x-hidden overflow-y-auto">
      <MobileHeader 
        title="Alunos" 
        showSearch 
        onSearch={() => setShowMobileSearch(!showMobileSearch)} 
      />

      <PageHeader
        icon={Users}
        title="GESTÃO DE ALUNOS"
        subtitle="CONTROLE DE MATRÍCULAS E PRESENÇA"
        extra={
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 h-10 px-4 rounded-[10px] text-[10px] font-black uppercase tracking-widest bg-white/5 text-gray-500 hover:text-white transition-all border border-white/5 active:scale-95">
              <FileDown size={16} /> IMPORTAR
            </button>
            {isAdminView && (
              <button
                onClick={() => { setDuplicateData(null); setShowModal(true) }}
                className="flex items-center gap-2 h-10 px-6 rounded-[10px] text-[10px] font-black uppercase tracking-widest bg-primary text-white hover:brightness-110 shadow-xl shadow-primary/20 transition-all active:scale-95 whitespace-nowrap btn-primary"
              >
                <Plus size={16} /> NOVO ALUNO
              </button>
            )}
          </div>
        }
      />

      <main className="flex-1 px-4 md:px-8 py-2 md:py-8 space-y-6 max-w-[1600px] mx-auto w-full pb-32">
        
        <AnimatePresence>
          {showMobileSearch && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="md:hidden overflow-hidden"
            >
              <div className="relative mb-4">
                <input 
                  autoFocus
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Nome, e-mail, telefone ou PIN..."
                  className="w-full bg-black/40 border border-white/10 rounded-[5px] py-4 pl-12 pr-4 text-white text-sm focus:border-primary/50 transition-colors"
                />
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                {searchTerm && (
                  <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30">
                    <X size={18} />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dashboard KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          {[
            { 
              label: 'ATIVOS', 
              value: stats.active, 
              icon: UserCheck, 
              accent: 'text-emerald-400',
              desc: 'Matriculados',
              filter: 'ativo' 
            },
            { 
              label: 'INATIVOS', 
              value: stats.inactive, 
              icon: UserX, 
              accent: 'text-primary',
              desc: 'Assinaturas inativas',
              filter: 'inativo' 
            },
            { 
              label: 'SUSPENSOS', 
              value: stats.suspended, 
              icon: UserMinus, 
              accent: 'text-yellow-400',
              desc: 'Afastados',
              filter: 'suspenso' 
            },
            { 
              label: 'ARQUIVADOS', 
              value: stats.archived, 
              icon: Archive, 
              accent: 'text-gray-400',
              desc: 'Histórico',
              filter: 'arquivado' 
              }
            ].map((k) => (
            <button
              key={k.label}
              onClick={() => setStatusFilter(statusFilter === k.filter ? 'todos' : k.filter)}
              className={`stat-card kpi-glow p-5 rounded-[10px] transition-all duration-300 flex flex-col justify-between active:scale-95 ${
                statusFilter === k.filter 
                  ? 'ring-2 ring-primary bg-primary/10 text-white' 
                  : 'bg-[#111] border-white/5 text-gray-500'
              }`}
            >
              <div className="flex items-center gap-3 relative z-10 w-full mb-4">
                <div className={`p-2 rounded-[10px] bg-white/5 shrink-0 ${k.accent}`}>
                  <k.icon size={16} strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 truncate">{k.label}</span>
              </div>
              <div className="flex flex-col items-start w-full relative z-10">
                <span className="text-3xl md:text-4xl font-black text-white tracking-tighter leading-none">{k.value}</span>
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/20 mt-2 truncate">{k.desc}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Filters Section */}
        <div className="space-y-4">
          <div className="flex gap-3 items-center">
            <div className="flex-1 relative group">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-primary transition-colors" />
              <input 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-[5px] py-3 pl-11 pr-4 text-gray-200 text-sm focus:border-primary/50 transition-all placeholder:text-gray-600 outline-none"
                placeholder="Buscar por nome, email, telefone ou PIN..."
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  <X size={14} />
                </button>
              )}
            </div>
            <button 
              onClick={() => { setSearchTerm(''); setStatusFilter('todos'); setModalityFilter('todas'); setSortBy('recente') }}
              className="flex items-center gap-2 h-11 px-4 rounded-[5px] border border-white/10 bg-white/[0.03] text-primary hover:bg-primary/[0.08] transition-all group active:scale-95 whitespace-nowrap"
            >
              <RefreshCcw size={14} className="group-hover:rotate-180 transition-transform duration-500 text-primary" />
              <span className="text-xs font-semibold hidden sm:block">Limpar</span>
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Ordenar por', value: sortBy, setter: setSortBy, options: [{id: 'recente', l: 'Mais Recente'}, {id: 'az', l: 'A-Z'}, {id: 'za', l: 'Z-A'}] },
              { label: 'Status', value: statusFilter, setter: setStatusFilter, options: [{id: 'todos', l: 'Todos'}, {id: 'ativo', l: 'Ativos'}, {id: 'inativo', l: 'Inativos'}, {id: 'suspenso', l: 'Suspensos'}, {id: 'arquivado', l: 'Arquivados'}] },
              { label: 'Pagamento', value: 'todos', setter: () => {}, options: [{id: 'todos', l: 'Todos'}], disabled: true },
              { label: 'Modalidade', value: modalityFilter, setter: setModalityFilter, options: modalities.map(m => ({id: m, l: m === 'todas' ? 'Todas' : m})) }
            ].map(f => (
              <div key={f.label} className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">{f.label}</label>
                <div className={`relative ${f.disabled ? 'opacity-40' : ''}`}>
                  <select 
                    value={f.value} 
                    onChange={e => f.setter(e.target.value)}
                    disabled={f.disabled}
                    className="w-full bg-black/40 border border-white/10 rounded-[5px] px-4 py-2.5 text-xs text-white appearance-none cursor-pointer focus:border-primary/50 outline-none font-bold uppercase tracking-widest"
                  >
                    {f.options.map(o => <option key={o.id} value={o.id} className="bg-[#111]">{o.l}</option>)}
                  </select>
                  <ChevronDown size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="md:hidden flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-primary" />
            <span className="text-[10px] font-black uppercase text-white/30 tracking-widest">Filtros</span>
          </div>
          <button 
            onClick={() => setIsFilterOpen(!isFilterOpen)}
            className="flex items-center gap-2 px-4 py-2 rounded-[5px] bg-white/5 border border-white/10 text-[10px] font-black uppercase tracking-widest text-white/60"
          >
            {modalityFilter === 'todas' ? 'Modalidade' : modalityFilter} · {sortBy === 'recente' ? 'Recentes' : 'Ordem'}
            <ChevronDown size={14} />
          </button>
        </div>

        <div className="space-y-4">
          {isLoadingStudents ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-30">
              <RefreshCcw size={40} className="animate-spin text-primary" />
              <p className="text-xs font-black uppercase tracking-[0.2em]">Buscando alunos...</p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 gap-6 rounded-[5px] border border-white/5 bg-[#121212]">
              <div className="w-20 h-20 rounded-[5px] bg-white/[0.03] border border-white/5 flex items-center justify-center">
                <Users size={36} className="text-white/10" strokeWidth={1} />
              </div>
              <div className="text-center space-y-2">
                <p className="text-base font-bold text-white/30">Nenhum aluno encontrado</p>
                <p className="text-[10px] text-white/10 uppercase font-black tracking-widest">{students.length} alunos cadastrados</p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between px-1">
                <span className="text-[10px] text-gray-600 uppercase font-bold tracking-widest">
                  Resultados: <span className="text-white">{filtered.length}</span> / {students.length}
                </span>
              </div>

              <div className="hidden md:block overflow-hidden rounded-[5px] border border-white/10 bg-[#121212]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03]">
                      <th className="px-5 py-4 text-[10px] font-black uppercase text-gray-500 tracking-widest">Aluno</th>
                      <th className="px-5 py-4 text-[10px] font-black uppercase text-gray-500 tracking-widest">Modalidade</th>
                      <th className="px-5 py-4 text-[10px] font-black uppercase text-gray-500 tracking-widest">Status</th>
                      <th className="px-5 py-4 text-[10px] font-black uppercase text-gray-500 tracking-widest">PIN</th>
                      <th className="px-5 py-4 text-[10px] font-black uppercase text-gray-500 tracking-widest w-12 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtered.map(student => {
                      const norm = normalizeStatus(student.status)
                      const statusColors = {
                        ativo: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
                        inativo: 'text-primary bg-primary/10 border-primary/20',
                        suspenso: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
                        arquivado: 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                      }
                      const cfg = beltConfig[student.belt] || beltConfig['white']
                      return (
                        <tr 
                          key={student.id} 
                          onClick={() => setSelectedStudent(student)}
                          className="hover:bg-white/[0.02] transition-all cursor-pointer group"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-4">
                              <div className={`w-9 h-9 rounded-[5px] shrink-0 flex items-center justify-center font-bold text-xs ${cfg.bgClass}`} style={{ color: cfg.textColor }}>
                                {student.photo ? <img src={student.photo} className="w-full h-full rounded-[5px] object-cover" alt="" /> : (student.initials || student.name?.[0])}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-white group-hover:text-primary transition-colors">{student.name}</p>
                                <p className="text-[10px] text-gray-600 uppercase font-black tracking-widest mt-0.5">{cfg.label}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="px-2 py-1 rounded-[5px] bg-white/5 border border-white/10 text-[10px] font-black text-gray-500 uppercase tracking-widest">{student.modality || '--'}</span>
                          </td>
                          <td className="px-5 py-4">
                            <span className={`px-2 py-1 rounded-[5px] text-[10px] font-black uppercase tracking-widest border ${statusColors[norm]}`}>{norm}</span>
                          </td>
                          <td className="px-5 py-4 font-mono text-primary text-sm font-bold">{student.pin || '---'}</td>
                          <td className="px-5 py-4">
                            <div className="flex justify-center">
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleOpenMenu(e, student) }}
                                className="p-2 rounded-[5px] hover:bg-white/10 text-gray-600 hover:text-white transition-all active:scale-90"
                              >
                                <MoreVertical size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden flex flex-col gap-3">
                {filtered.map(student => (
                  <StudentCard 
                    key={student.id} 
                    student={student} 
                    onClick={() => setSelectedStudent(student)}
                    onAction={(e) => handleOpenMenu(e, student)}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      </main>

      {/* Action Menu (Portal) */}
      {menuOpenId && createPortal(
        <div
          ref={menuRef}
          onClick={e => e.stopPropagation()}
          className="fixed bg-[#111] border border-white/10 rounded-[5px] z-[9999] overflow-hidden text-sm py-1.5 shadow-2xl shadow-black/80"
          style={{ top: menuAnchor.top, left: menuAnchor.left, width: 210 }}
        >
          {menuItems(filtered.find(s => s.id === menuOpenId)).map((item, idx) =>
            item === null ? <div key={`sep-${idx}`} className="border-b border-white/5 my-1" /> : (
              <button
                key={item.label}
                onClick={item.action}
                className={`w-full text-left px-4 py-2.5 hover:bg-white/5 flex items-center gap-3 transition-colors ${item.bold ? 'font-black' : 'font-bold'} ${item.color || 'text-gray-400'}`}
              >
                <item.icon size={15} strokeWidth={2.5} />
                <span className="text-[10px] uppercase tracking-widest">{item.label}</span>
              </button>
            )
          )}
        </div>,
        document.body
      )}

      {/* Mobile Filters Bottom Sheet */}
      <AnimatePresence>
        {isFilterOpen && (
          <div className="fixed inset-0 z-[100] md:hidden">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsFilterOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              className="absolute bottom-0 left-0 right-0 bg-[#0d0d0d] rounded-t-[5px] border-t border-white/10 p-6 flex flex-col gap-6"
            >
              <div className="w-12 h-1 bg-white/10 rounded-full mx-auto" />
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-white/30 tracking-widest">Ordenar por</h4>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'recente', label: 'Recentes' },
                    { id: 'az', label: 'A-Z' },
                    { id: 'za', label: 'Z-A' }
                  ].map(o => (
                    <button 
                      key={o.id} 
                      onClick={() => setSortBy(o.id)}
                      className={`px-4 py-3 rounded-[5px] text-[10px] font-black uppercase border transition-all ${sortBy === o.id ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 border-white/10 text-gray-500'}`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase text-white/30 tracking-widest">Modalidade</h4>
                <div className="grid grid-cols-2 gap-2">
                  {modalities.map(m => (
                    <button 
                      key={m} 
                      onClick={() => setModalityFilter(m)}
                      className={`px-4 py-3 rounded-[5px] text-[10px] font-black uppercase border truncate transition-all ${modalityFilter === m ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-white/5 border-white/10 text-gray-500'}`}
                    >
                      {m === 'todas' ? 'Todas' : m}
                    </button>
                  ))}
                </div>
              </div>
              <button 
                onClick={() => setIsFilterOpen(false)}
                className="w-full py-4 bg-primary text-white font-black uppercase tracking-widest rounded-[5px] shadow-xl shadow-primary/20 active:scale-95"
              >
                Aplicar Filtros
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
          onAdd={async (data, mod, opts) => {
            await addStudent(data, mod || currentModality, opts)
            setShowModal(false)
          }}
        />
      )}

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
        <StatusChangeDialog
          student={deleteDialogStudent}
          action="delete"
          onConfirm={async () => {
            await deleteStudent(deleteDialogStudent.id)
            setDeleteDialogStudent(null)
          }}
          onClose={() => setDeleteDialogStudent(null)}
        />
      )}
    </div>
  )
}

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  Users, UserPlus, Search,
  MoreVertical, Shield, User,
  CheckCircle2, XCircle, Clock, UserCheck, 
  ShieldCheck, ShieldAlert, RefreshCcw, ChevronDown,
  Edit2, Trash2, FileText
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useSystemUsers } from '../../hooks/useSystemUsers'
import { useAuth } from '../../context/AuthContext'
import UserCreationModal from '../../components/shared/UserCreationModal'
import MobileHeader from '../../components/navigation/MobileHeader'
import PageHeader from '../../components/shared/PageHeader'
import KPICard from '../../components/shared/KPICard'

// Modal de Segurança para ver PINs
function PinVerificationModal({ onConfirm, onClose }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    onConfirm(pin, () => setError(true))
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-[#0d0d0d] border border-white/10 rounded-[32px] p-8 w-full max-w-sm text-center shadow-2xl"
      >
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6 border border-primary/20">
          <ShieldAlert className="text-primary" size={32} />
        </div>
        <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tight">Segurança</h3>
        <p className="text-[11px] text-gray-500 mb-8 font-medium leading-relaxed">
          Para visualizar os PINs de acesso da equipe, confirme seu próprio PIN de segurança.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <input 
            type="password"
            maxLength={6}
            value={pin}
            onChange={(e) => { setPin(e.target.value); setError(false) }}
            className={`w-full bg-black/40 border ${error ? 'border-primary/50' : 'border-white/10'} rounded-2xl py-4 text-center text-3xl font-mono tracking-[0.5em] text-white focus:outline-none focus:border-primary/30 transition-all`}
            placeholder="••••••"
            autoFocus
          />
          {error && <p className="text-[10px] text-primary font-black uppercase tracking-widest animate-pulse">PIN Incorreto</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="flex-1 py-4 rounded-xl bg-white/5 text-gray-400 font-bold text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all">Cancelar</button>
            <button type="submit" className="flex-1 py-4 rounded-xl bg-primary text-black font-black text-[10px] uppercase tracking-widest hover:shadow-lg hover:shadow-primary/20 transition-all active:scale-95">Verificar</button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// Seletor Customizado Premium
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
        className="form-input bg-black/40 input-raise text-sm py-2.5 px-4 text-gray-300 font-medium text-left flex justify-between items-center w-full disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 rounded-xl transition-all hover:bg-black/60 focus:ring-1 focus:ring-white/20"
      >
        <span className="truncate">{selectedOption ? selectedOption[1] : '...'}</span>
        <ChevronDown size={14} className={`text-gray-500 transition-transform duration-200 shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-full min-w-[200px] bg-[#0d0d0d] border border-white/10 rounded-2xl z-[100] overflow-hidden shadow-2xl py-2" style={{ animation: 'fadeSlideUp 0.15s ease-out forwards' }}>
          {options.map(([v, l]) => (
            <button
              key={v}
              onClick={() => { onChange(v); setIsOpen(false) }}
              className={`w-full text-left px-5 py-3 text-sm transition-colors hover:bg-white/5 ${value === v ? 'text-white bg-white/5 font-bold' : 'text-gray-400 font-medium'}`}
            >
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function CollaboratorsPage() {
  const { users, loading, updateProfile } = useSystemUsers()
  const { userData, loading: authLoading } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showPinModal, setShowPinModal] = useState(false)
  const [isUnlocked, setIsUnlocked] = useState(false)
  const [sortBy, setSortBy] = useState('recente')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [menuAnchor, setMenuAnchor] = useState({ top: 0, left: 0 })
  const menuRef = useRef(null)

  const isLoading = loading || authLoading

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
    const active = users.filter(u => u.status === 'Ativo').length
    const professors = users.filter(u => u.role === 'professor').length
    const gestors = users.filter(u => u.role === 'gestor' || u.role === 'admin').length
    return { total: users.length, active, professors, gestors }
  }, [users])

  const filteredUsers = useMemo(() => {
    let list = users.filter(user => {
      const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           user.email?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesRole = roleFilter === 'all' || user.role === roleFilter
      const matchesStatus = statusFilter === 'todos' || user.status === statusFilter
      return matchesSearch && matchesRole && matchesStatus
    })

    if (sortBy === 'az') list = [...list].sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    if (sortBy === 'za') list = [...list].sort((a, b) => (b.name || '').localeCompare(a.name || ''))
    return list
  }, [users, searchTerm, roleFilter, statusFilter, sortBy])

  const getInitials = (name) => {
    if (!name) return '??'
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return parts[0].substring(0, 2).toUpperCase()
  }

  function handleOpenMenu(e, userId) {
    e.stopPropagation()
    if (menuOpenId === userId) { setMenuOpenId(null); return }
    const rect = e.currentTarget.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const menuHeight = 300
    const top = spaceBelow < menuHeight ? rect.top - menuHeight + 20 : rect.bottom - 10
    setMenuAnchor({ top, left: rect.left - 220 })
    setMenuOpenId(userId)
  }

  const toggleStatus = async (user) => {
    const newStatus = user.status === 'Ativo' ? 'Inativo' : 'Ativo'
    if (confirm(`Deseja alterar o status de ${user.name} para ${newStatus}?`)) {
      await updateProfile(user.id, { status: newStatus }, user.role)
    }
    setMenuOpenId(null)
  }

  const roleStyles = {
    admin: { label: 'Admin', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
    gestor: { label: 'Gestor', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    professor: { label: 'Professor', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    aluno: { label: 'Aluno', color: 'text-gray-400', bg: 'bg-gray-400/10', border: 'border-gray-400/20' }
  }

  const handleVerifyPin = (pin, onFail) => {
    if (pin === userData?.pin) {
      setIsUnlocked(true)
      setShowPinModal(false)
    } else {
      onFail()
    }
  }

  function renderStatusBadge(user) {
    const isActive = user.status === 'Ativo'
    return (
      <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border inline-flex ${isActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/20'}`}>
        {user.status || 'Ativo'}
      </span>
    )
  }

  return (
    <div className="flex flex-col flex-1 w-full min-w-0 bg-[#050505]">
      <MobileHeader
        title="Colaboradores"
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
            className="p-2.5 rounded-[5px] bg-primary text-black active:scale-90 transition-transform shadow-lg shadow-primary/20"
          >
            <UserPlus size={20} strokeWidth={3} />
          </button>
        }
      />

      <PageHeader
        icon={Users}
        title="GESTÃO DE EQUIPE"
        subtitle="CONTROLE DE COLABORADORES E PROFESSORES"
        extra={
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider bg-black/20 text-gray-500 hover:bg-white/10 hover:text-white transition-all border border-white/5 active:scale-95">
              <RefreshCcw size={18} strokeWidth={1.9} /> SINCRONIZAR
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-primary text-white flex items-center gap-2 px-5 py-2 rounded-xl text-[11px] font-black uppercase tracking-wider shadow-xl shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-95"
            >
              <UserPlus size={18} strokeWidth={2} /> NOVO COLABORADOR
            </button>
          </div>
        }
      />

      <main className="flex-1 px-4 md:px-6 py-6 pb-12 fade-slide-up space-y-6 animate-in fade-in duration-500">
        
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          <KPICard title="Total Equipe" value={stats.total} description="Todos os membros da academia" icon={Users} />
          <KPICard title="Ativos" value={stats.active} description="Colaboradores em atividade" icon={UserCheck} valueColor="text-emerald-400"
            onClick={() => setStatusFilter(statusFilter === 'Ativo' ? 'todos' : 'Ativo')} active={statusFilter === 'Ativo'} />
          <KPICard title="Professores" value={stats.professors} description="Instrutores e mestres" icon={Shield}
            onClick={() => setRoleFilter(roleFilter === 'professor' ? 'all' : 'professor')} active={roleFilter === 'professor'} />
          <KPICard title="Gestores" value={stats.gestors} description="Administração e suporte" icon={ShieldCheck}
            onClick={() => setRoleFilter(roleFilter === 'gestor' ? 'all' : 'gestor')} active={roleFilter === 'gestor'} />
        </div>

        {/* Elite Search Bar (Outside) */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative group">
            <Search size={18} strokeWidth={1.9} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-white transition-colors" />
            <input
              className="w-full bg-[#111] border border-white/5 rounded-xl pl-12 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-white/10 transition-all font-medium"
              placeholder="Buscar por nome, email, cargo..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          {(statusFilter !== 'todos' || roleFilter !== 'all' || searchTerm) && (
            <button 
              onClick={() => { setStatusFilter('todos'); setRoleFilter('all'); setSearchTerm('') }}
              className="flex items-center justify-center gap-2 px-6 h-[46px] rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
            >
              <RefreshCcw size={18} strokeWidth={1.9} /> Limpar Filtros
            </button>
          )}
        </div>

        <div className="bg-black/40 backdrop-blur-md rounded-2xl p-5 md:p-6 border border-white/5">
          {/* Filtros */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
             <CustomSelect label="Ordenar por" value={sortBy} onChange={setSortBy} options={[['recente', 'Mais Recente'], ['az', 'A → Z'], ['za', 'Z → A']]} />
             <CustomSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={[['todos', 'Todos'], ['Ativo', 'Ativos'], ['Inativo', 'Inativos']]} />
             <CustomSelect label="Unidade" value="matriz" onChange={() => {}} disabled={true} options={[['matriz', 'Matriz']]} />
             <CustomSelect label="Cargo / Função" value={roleFilter} onChange={setRoleFilter} options={[['all', 'Todos'], ['professor', 'Professores'], ['gestor', 'Gestores']]} />
          </div>

          {/* Tabela (Layout Clonado de Alunos) */}
          <div className="w-full overflow-x-auto rounded-2xl border border-white/5 bg-black/20">
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b border-white/10 text-[10px] uppercase font-black text-gray-500 tracking-wider bg-white/5">
                  <th className="py-3 px-5">Colaborador</th>
                  <th className="py-3 px-5 text-center">E-mail</th>
                  <th className="py-3 px-5 text-center">Unidade</th>
                  <th className="py-3 px-5 text-center">Cargo</th>
                  <th className="py-3 px-5 text-center">Pin de Acesso</th>
                  <th className="py-3 px-5 text-center">Status</th>
                  <th className="py-3 px-5 w-12 text-center text-gray-500">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredUsers.map((member) => (
                  <tr key={member.id} className="hover:bg-white/5 transition-colors group cursor-pointer">
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center p-0.5 group-hover:border-primary/30 transition-colors shrink-0 relative">
                          {member.photoURL ? (
                            <img src={member.photoURL} alt={member.name} className="w-10 h-10 rounded-full object-cover ring-1 ring-white/10" />
                          ) : (
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-xs font-black ring-1 ring-white/10 bg-gradient-to-br from-primary to-black/10 text-white shadow-inner">
                              {getInitials(member.name)}
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm text-app font-medium block uppercase tracking-tight group-hover:text-primary transition-colors">
                            {member.name || 'Sem Nome'}
                          </span>
                          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">{member.role || 'COLABORADOR'}</span>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-5 text-center">
                      <span className="text-sm font-medium text-gray-300 block">{member.email}</span>
                    </td>

                    <td className="py-4 px-5 text-center">
                       <span className="text-sm font-medium text-gray-400 uppercase">MATRIZ</span>
                    </td>

                    <td className="py-4 px-5 text-center">
                       <span className={`px-2.5 py-1 rounded-sm text-[9px] font-black uppercase tracking-[0.2em] inline-block border ${
                        member.role === 'professor' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 
                        member.role === 'gestor' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                        'bg-red-500/10 text-red-500 border-red-500/20'
                      }`}>
                        {member.role || 'COLABORADOR'}
                      </span>
                    </td>

                    <td className="py-4 px-5 text-center">
                      <button 
                        onClick={() => !isUnlocked && setShowPinModal(true)}
                        className={`inline-flex items-center justify-center px-4 py-2 rounded-xl bg-white/5 border border-white/5 transition-all shadow-inner group-hover:border-white/10 w-24 ${!isUnlocked ? 'cursor-pointer hover:bg-white/10 active:scale-95' : 'cursor-default'}`}
                      >
                        <span className={`font-mono text-[11px] tracking-[0.2em] font-black ${isUnlocked ? 'text-emerald-400' : 'text-white/20'}`}>
                          {isUnlocked ? member.pin : '••••••'}
                        </span>
                      </button>
                    </td>

                    <td className="py-4 px-5 text-center">
                       <span className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border inline-flex ${member.status === 'Ativo' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                        {member.status || 'ATIVO'}
                      </span>
                    </td>

                    <td className="py-4 px-5 text-center relative">
                      <button 
                        onClick={e => handleOpenMenu(e, member.id)}
                        className="p-2.5 rounded-xl hover:bg-white/10 text-white/20 hover:text-white transition-all active:scale-90 border border-transparent hover:border-white/10"
                      >
                        <MoreVertical size={18} />
                      </button>

                      {menuOpenId === member.id && createPortal(
                        <div
                          ref={menuRef}
                          onClick={e => e.stopPropagation()}
                          className="fixed bg-[#0F0F0F] border border-white/10 rounded-2xl z-[9999] overflow-hidden text-sm py-2 fade-slide-up"
                          style={{ top: menuAnchor.top, left: menuAnchor.left, width: 220, boxShadow: '0 24px 80px rgba(0,0,0,0.8)' }}
                        >
                          <button className="w-full text-left px-5 py-2.5 hover:bg-white/5 flex items-center gap-3 transition-colors text-gray-300 font-medium">
                            <User size={18} strokeWidth={1.9} /> Editar Perfil
                          </button>
                          <button className="w-full text-left px-5 py-2.5 hover:bg-white/5 flex items-center gap-3 transition-colors text-gray-300 font-medium">
                            <Shield size={18} strokeWidth={1.9} /> Alterar Cargo
                          </button>
                          <div className="border-b border-white/5 my-1" />
                          <button 
                            onClick={() => toggleStatus(member)}
                            className={`w-full text-left px-5 py-2.5 hover:bg-white/5 flex items-center gap-3 transition-colors font-medium ${member.status === 'Ativo' ? 'text-red-400' : 'text-emerald-400'}`}
                          >
                            {member.status === 'Ativo' ? <XCircle size={18} strokeWidth={1.9} /> : <CheckCircle2 size={18} strokeWidth={1.9} />}
                            {member.status === 'Ativo' ? 'Inativar' : 'Reativar'}
                          </button>
                        </div>,
                        document.body
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="mt-4 text-center">
            <span className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.2em]">Exibindo {filteredUsers.length} de {users.length} membros</span>
          </div>
        </div>
      </main>

      <UserCreationModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      {showPinModal && (
        <PinVerificationModal 
          onClose={() => setShowPinModal(false)}
          onConfirm={handleVerifyPin}
        />
      )}
    </div>
  )
}

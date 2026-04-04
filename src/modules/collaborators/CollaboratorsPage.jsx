import React, { useState } from 'react'
import { 
  Users, UserPlus, Search, Filter, 
  MoreVertical, Shield, User,
  CheckCircle2, XCircle, Clock
} from 'lucide-react'
import { useSystemUsers } from '../../hooks/useSystemUsers'
import { useThemeVars } from '../../hooks/useThemeVars'
import { useAuth } from '../../context/AuthContext'
import UserCreationModal from '../../components/shared/UserCreationModal'
import MobileHeader from '../../components/navigation/MobileHeader'
import PageHeader from '../../components/shared/PageHeader'

export default function CollaboratorsPage() {
  const { users, loading, updateProfile } = useSystemUsers()
  const { userData } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [isModalOpen, setIsModalOpen] = useState(false)

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    return matchesSearch && matchesRole
  })

  const toggleStatus = async (user) => {
    const newStatus = user.status === 'Ativo' ? 'Inativo' : 'Ativo'
    if (confirm(`Deseja alterar o status de ${user.name} para ${newStatus}?`)) {
      await updateProfile(user.id, { status: newStatus }, user.role)
    }
  }

  const roleStyles = {
    admin: { label: 'Admin', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
    gestor: { label: 'Gestor', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    professor: { label: 'Professor', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    aluno: { label: 'Aluno', color: 'text-gray-400', bg: 'bg-gray-400/10', border: 'border-gray-400/20' }
  }

  return (
    <div className="flex flex-col flex-1 w-full min-h-dvh bg-black overflow-x-hidden">
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
        title="COLABORADORES"
        subtitle="Gestão de Equipe"
        extra={
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest shadow-xl"
          >
            <UserPlus size={18} /> ADICIONAR MEMBRO
          </button>
        }
      />

      <main className="flex-1 px-4 md:px-8 py-8 space-y-8 max-w-[1400px] mx-auto w-full pb-32 animate-in fade-in duration-500">

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-white transition-colors" size={18} />
          <input 
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-[#111] border border-white/5 rounded-2xl pl-12 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-white/20 transition-all font-medium"
          />
        </div>
        <div className="flex gap-2">
          {['all', 'admin', 'gestor', 'professor', 'aluno'].map(role => (
            <button
              key={role}
              onClick={() => setRoleFilter(role)}
              className={`px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest border transition-all ${
                roleFilter === role 
                ? 'bg-white border-white text-black' 
                : 'bg-transparent border-white/5 text-gray-500 hover:border-white/20 hover:text-white'
              }`}
            >
              {role === 'all' ? 'Todos' : role}
            </button>
          ))}
        </div>
      </div>

      {/* Users List Grouped by Role */}
      <div className="space-y-12">
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-64 bg-[#111] border border-white/5 rounded-[32px] animate-pulse" />
            ))}
          </div>
        ) : (
          ['gestor', 'professor', 'admin'].map(role => {
            const roleUsers = filteredUsers.filter(u => u.role === role)
            if (roleUsers.length === 0) return null
            if (role === 'admin' && userData?.role !== 'admin') return null

            const info = {
              gestor: { title: 'GESTORES', icon: Shield, color: 'text-emerald-500' },
              professor: { title: 'PROFESSORES', icon: User, color: 'text-blue-500' },
              admin: { title: 'ADMINISTRADORES', icon: Shield, color: 'text-primary' }
            }[role]

            return (
              <div key={role} className="space-y-6">
                <div className="flex items-center gap-3 px-2">
                  <div className={`p-2 rounded-lg bg-white/5 ${info.color}`}>
                    <info.icon size={18} />
                  </div>
                  <h2 className="text-xs font-black uppercase tracking-[0.3em] text-gray-400">
                    {info.title} <span className="ml-2 text-[10px] text-gray-600 font-bold">({roleUsers.length})</span>
                  </h2>
                  <div className="flex-1 h-px bg-white/5 ml-4" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {roleUsers.map((user) => (
                    <div 
                      key={user.id}
                      className="group relative bg-[#0d0d0d] border border-white/5 rounded-[32px] overflow-hidden hover:border-white/10 transition-all hover:shadow-2xl hover:-translate-y-1"
                    >
                      <div className={`absolute top-6 left-6 w-2 h-2 rounded-full ${user.status === 'Ativo' ? 'bg-emerald-500' : 'bg-amber-500'} shadow-[0_0_10px_rgba(16,185,129,0.3)]`} />

                      <div className="p-8 pb-4 flex flex-col items-center text-center">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-white/10 to-transparent p-1 mb-4 relative">
                          <div className="w-full h-full rounded-full bg-[#1a1a1a] flex items-center justify-center overflow-hidden border border-white/10">
                            {user.photo || user.photoURL ? (
                              <img src={user.photo || user.photoURL} alt={user.name} className="w-full h-full object-cover" />
                            ) : (
                              <User size={32} className="text-gray-700" />
                            )}
                          </div>
                        </div>

                        <h3 className="text-lg font-bold text-white mb-1 uppercase tracking-tight line-clamp-1">{user.name}</h3>
                        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mb-4">{user.email}</p>

                        <div className={`px-4 py-1.5 rounded-full border ${roleStyles[user.role]?.border} ${roleStyles[user.role]?.bg} ${roleStyles[user.role]?.color} text-[10px] font-bold uppercase tracking-widest mb-3`}>
                          {roleStyles[user.role]?.label || user.role}
                        </div>

                        <div className="flex items-center gap-2 px-3 py-1 bg-white/5 rounded-lg border border-white/10 w-fit mx-auto group-hover:border-emerald-500/30 transition-colors">
                          <span className="text-[8px] text-gray-500 font-black uppercase tracking-widest">PIN</span>
                          <span className="text-xs font-mono text-emerald-400 font-bold tracking-[0.2em]">{user.pin || '---'}</span>
                        </div>
                      </div>

                      <div className="p-6 pt-0 border-t border-white/5 mt-4 bg-[#111]/30">
                        <div className="flex items-center justify-between py-4">
                          <div className="flex gap-1.5">
                            {user.permissions?.viewFinance && (
                              <div title="Ver Financeiro" className="p-2 bg-emerald-500/10 text-emerald-500 rounded-lg"><Shield size={12} /></div>
                            )}
                            {user.permissions?.manageUsers && (
                              <div title="Gerenciar Equipe" className="p-2 bg-primary/10 text-primary rounded-lg"><Shield size={12} /></div>
                            )}
                            {!user.permissions?.viewFinance && !user.permissions?.manageUsers && (
                              <span className="text-[9px] text-gray-700 font-bold uppercase tracking-widest">Acesso Básico</span>
                            )}
                          </div>
                          
                          <div className="flex gap-2">
                            <button 
                              onClick={() => toggleStatus(user)}
                              className={`p-2.5 rounded-xl transition-all border ${
                                user.status === 'Ativo' 
                                ? 'bg-amber-500/5 border-amber-500/10 text-amber-500/50 hover:bg-amber-500 hover:text-white' 
                                : 'bg-emerald-500/5 border-emerald-500/10 text-emerald-500/50 hover:bg-emerald-500 hover:text-white'
                              }`}
                            >
                              {user.status === 'Ativo' ? <XCircle size={16} /> : <CheckCircle2 size={16} />}
                            </button>
                            <button className="p-2.5 bg-white/5 border border-white/10 text-gray-500 hover:text-white rounded-xl transition-all">
                              <MoreVertical size={16} />
                            </button>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 text-[9px] text-gray-600 font-bold uppercase tracking-tighter">
                          <Clock size={10} />
                          {user.createdAt?.seconds ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'Recentemente'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })
        )}

        {!loading && filteredUsers.length === 0 && (
          <div className="py-20 text-center space-y-4 bg-[#0d0d0d] rounded-[32px] border border-dashed border-white/10">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-gray-600">
              <Users size={32} />
            </div>
            <p className="text-gray-500 font-medium uppercase tracking-widest text-xs">Nenhum colaborador encontrado</p>
          </div>
        )}
      </div>
    </main>

    <UserCreationModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
      />
    </div>
  )
}

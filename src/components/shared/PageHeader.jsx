import React from 'react'
import { Bell, RefreshCw, User, Users, Crown } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

/**
 * PageHeader - Componente padronizado para o topo das páginas do sistema (Desktop).
 * @param {React.ReactNode} icon - O ícone lucide-react a ser exibido no box.
 * @param {string} title - Título principal da página.
 * @param {string} subtitle - Subtítulo da página.
 * @param {() => void} onRefresh - Função opcional para o botão de atualizar.
 * @param {boolean} loading - Se a página está carregando (mostra estado no perfil).
 * @param {React.ReactNode} extra - Elementos extras para exibir entre o título e as notificações.
 */
export default function PageHeader({ icon: Icon, title, subtitle, onRefresh, loading, extra }) {
  const { userData } = useAuth()

  const roleLabels = {
    admin: { label: 'ADMINISTRADOR', color: 'text-purple-400' },
    gestor: { label: 'GESTOR', color: 'text-emerald-400' },
    professor: { label: 'PROFESSOR', color: 'text-primary' },
    aluno: { label: 'ALUNO', color: 'text-blue-400' },
    desenvolvedor: { label: 'DESENVOLVEDOR', color: 'text-purple-400' },
  }

  const userRole = userData?.role || 'aluno'
  const role = roleLabels[userRole] || roleLabels.aluno

  return (
    <header className="content-header hidden md:flex items-center justify-between px-8 py-5 z-20 sticky top-0 backdrop-blur-md border-b" style={{ background: 'var(--clr-bg)', opacity: 0.9, borderColor: 'var(--clr-card-border)' }}>
      {/* Left side: Icon + Title */}
      <div className="flex items-center gap-4">
        {/* Icon Box - Premium Squircle Style */}
        <div className="w-11 h-11 rounded-[12px] bg-[#111] border border-white/5 flex items-center justify-center shrink-0 shadow-lg shadow-black/40 relative overflow-hidden group">
          <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
          <Icon size={20} strokeWidth={2.2} style={{ color: 'var(--clr-primary)' }} className="relative z-10" />
        </div>

        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-app tracking-tight leading-none">{title}</h1>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.1em] mt-1">{subtitle}</p>
        </div>

        {onRefresh && (
          <button onClick={onRefresh} className="p-2 ml-2 text-gray-500 hover:text-white transition-all bg-white/5 hover:bg-white/10 rounded-3xl border border-white/5 active:scale-95 group">
            <RefreshCw size={18} strokeWidth={1.9} className={loading ? 'animate-spin text-primary' : 'group-hover:rotate-180 transition-transform duration-500'} />
          </button>
        )}
      </div>

      {/* Center/Extra area */}
      <div className="flex-1 flex justify-center">
        {extra}
      </div>

      {/* Right side: Actions + Profile */}
      <div className="flex items-center gap-6">
        {/* Bell Icon */}
        <button className="relative p-2 text-gray-400 hover:text-white transition-all active:scale-95 overflow-visible">
          <Bell size={18} strokeWidth={1.9} />
          <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full ring-2 ring-[#000]" />
        </button>

        {/* Vertical Separator */}
        <div className="w-px h-8 bg-white/10" />

        {/* Profile Group */}
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => (window.location.href = '/profile')}>
          <div className="flex flex-col items-end overflow-hidden max-w-[150px]">
            <span className="text-sm font-bold text-app leading-none truncate w-full text-right">{userData?.name || 'Anon'}</span>
            <span className={`text-[9px] font-bold uppercase tracking-widest mt-1 ${role.color}`}>
              {role.label}
            </span>
          </div>

          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 transition-transform active:scale-90 shadow-lg shadow-primary/10">
            <span className="text-sm font-black text-white" style={{ background: 'linear-gradient(135deg, var(--clr-primary-dark), var(--clr-primary))', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyCenter: 'center', justifyContent: 'center' }}>
              {(userData?.name || 'A').charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      </div>
    </header>
  )
}

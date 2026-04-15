// COMPONENTE DE NAVEGAÇÃO MOBILE (BOTTOM BAR)
// Fornece uma barra de navegação inferior premium para dispositivos móveis.
// Inclui um botão central flutuante para início rápido de chamada e um menu "Mais".
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import {
  Home,
  Users,
  CheckCircle2,
  Banknote,
  MoreHorizontal,
  X,
  ChevronRight,
  Layers,
  Settings,
  TrendingUp,
  Activity,
  ShieldCheck,
  MessageCircle,
  FileText,
  PieChart,
  GraduationCap,
  ArrowDownRight,
  Clock,
  CalendarRange,
  BellRing
} from 'lucide-react'

// Itens principais da barra inferior (Excluindo o botão central)
const mainNavItems = [
  { to: '/', icon: Home, label: 'Início' },
  { to: '/students', icon: Users, label: 'Alunos' },
  { to: '/events', icon: BellRing, label: 'Avisos' },
]

// Itens do menu "Mais" (Drawer lateral/inferior)
const drawerItems = [
  { to: '/billing', icon: Banknote, label: 'Cobrança', roles: ['admin', 'gestor', 'professor'], subtitle: 'Gestão de mensalidades' },
  { to: '/expenses', icon: ArrowDownRight, label: 'Despesas', roles: ['admin', 'gestor', 'professor'], subtitle: 'Saídas e custos' },
  { to: '/reports', icon: PieChart, label: 'Relatórios', roles: ['admin', 'gestor', 'professor'], subtitle: 'Análise financeira' },
  { to: '/modalities', icon: Layers, label: 'Turmas', roles: ['admin', 'gestor', 'professor'], subtitle: 'Modalidades e horários' },
  { to: '/experimental', icon: Clock, label: 'Visitantes', roles: ['admin', 'gestor', 'professor'], subtitle: 'Aulas experimentais' },
  { to: '/contracts', icon: FileText, label: 'Contratos', roles: ['admin', 'gestor'], subtitle: 'Documentos e termos' },
  { to: '/collaborators', icon: ShieldCheck, label: 'Equipe', roles: ['admin', 'gestor', 'professor'], subtitle: 'Gestão de professores' },
  { to: '/profile', icon: Settings, label: 'Perfil', roles: ['admin', 'gestor', 'professor', 'aluno'], subtitle: 'Minha conta' },
]

// Configuração de animação de mola para suavidade premium
const springConfig = { type: 'spring', damping: 30, stiffness: 400 }

export default function MobileNav() {
  const location = useLocation()
  const navigate = useNavigate()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Fecha o menu "Mais" automaticamente ao mudar de rota
  useEffect(() => {
    setIsDrawerOpen(false)
  }, [location])

  const handleToggleDrawer = (e) => {
    e.preventDefault()
    setIsDrawerOpen(!isDrawerOpen)
  }

  // Verifica se uma aba específica está ativa para aplicar estilos de destaque
  const isTabActive = (path) => {
    if (path === '/' && location.pathname === '/') return true
    if (path !== '/' && location.pathname.startsWith(path)) return true
    return false
  }

  const { isMobileNavHidden, isNavLocked } = useApp()
  const { effectiveRole } = useAuth()

  // Filtra os itens da gaveta baseado no cargo do usuário
  const filteredDrawerItems = drawerItems.filter(item => 
    !item.roles || item.roles.includes(effectiveRole)
  )

  return (
    <>
      {/* Container Principal da Barra Inferior com animação de entrada/saída */}
      <AnimatePresence>
        {!isMobileNavHidden && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed bottom-0 left-0 right-0 z-[120] px-6 pb-6 select-none"
          >
            {/* Estrutura da Barra com Efeito de Vidro — backdrop-blur-xl (24px) em vez
                 de backdrop-blur-3xl (64px): reduz custo de compositing no mobile */}
            <div className="relative h-[68px] bg-white/[0.03] backdrop-blur-xl border border-white/10 rounded-[32px] flex items-center justify-around px-2 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.7)] group">

          {/* Indicador de Aba Ativa (Linha colorida superior) */}
          <div className="absolute inset-0 pointer-events-none flex justify-around px-2">
            {[0, 1, 2, 3, 4].map(idx => {
              if (idx === 2) return <div key={idx} className="w-16" /> // Espaçador central para o botão flutuante

              let isActive = false;
              if (idx === 0) isActive = isTabActive('/');
              if (idx === 1) isActive = isTabActive('/students');
              if (idx === 3) isActive = isTabActive('/events');
              if (idx === 4) isActive = isDrawerOpen;

              return (
                <div key={idx} className="relative flex-1 flex justify-center">
                  {isActive && (
                    <motion.div
                      layoutId="active-line"
                      className="absolute -top-[1.5px] w-8 h-[3px] bg-rose-600 rounded-full"
                      transition={springConfig}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* Itens de Navegação Diretos */}
          <NavItem to="/" icon={Home} label="Início" active={isTabActive('/')} locked={isNavLocked} />
          <NavItem to="/students" icon={Users} label="Alunos" active={isTabActive('/students')} locked={isNavLocked} />

          {/* BOTÃO CENTRAL FLUTUANTE (Atalho Iniciar Chamada) */}
          <div className="relative w-16 h-16 flex items-center justify-center -mt-10">
            {/* Brilho Pulsante sob o botão */}
            <div className={`absolute inset-0 rounded-full blur-2xl transition-all duration-700 ${isTabActive('/attendance') ? 'bg-rose-600/30' : 'bg-white/5'}`} />

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                if (!isNavLocked) navigate('/attendance')
              }}
              className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 border-[6px] border-bg-app ${isTabActive('/attendance') ? 'bg-rose-600 text-white' : 'bg-[#121212] text-gray-500'}`}
              style={{ boxShadow: isTabActive('/attendance') ? '0 10px 20px rgba(225, 29, 72, 0.3)' : 'none' }}
            >
              <CheckCircle2 size={26} strokeWidth={2.5} />
            </motion.button>
            <p className={`absolute -bottom-5 text-[9px] font-black uppercase tracking-[0.15em] transition-colors duration-500 ${isTabActive('/attendance') ? 'text-rose-500' : 'text-gray-500'}`}>
              Chamada
            </p>
          </div>

          <NavItem to="/events" icon={BellRing} label="Avisos" active={isTabActive('/events')} locked={isNavLocked} />

          {/* Botão para abrir o menu complementar "Mais" */}
          <button
            onClick={(e) => {
              if (isNavLocked) return
              handleToggleDrawer(e)
            }}
            className="flex-1 flex flex-col items-center justify-center gap-1.5 h-full transition-all active:scale-95 no-tap-highlight"
          >
            <div className={`transition-all duration-300 ${isDrawerOpen ? 'text-rose-500 scale-110' : 'text-gray-500 opacity-60'}`}>
              {isDrawerOpen ? <X size={22} strokeWidth={2.5} /> : <MoreHorizontal size={22} strokeWidth={2} />}
            </div>
            <p className={`text-[9px] font-black uppercase tracking-widest transition-colors duration-300 ${isDrawerOpen ? 'text-rose-500' : 'text-gray-600'}`}>
              Mais
            </p>
          </button>
        </div>
      </motion.div>
    )}
  </AnimatePresence>

      {/* Drawer (Menu Expansível Inferior) */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            {/* Overlay de fundo (Escurecimento) */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
            />

            {/* Painel do Drawer */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-[#0A0A0A] border-t border-white/10 rounded-t-[32px] z-[80] overflow-hidden flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
            >
              {/* Alça visual de arraste (apenas estética) */}
              <div className="flex justify-center mt-3">
                <div className="w-12 h-1.5 bg-white/10 rounded-full" />
              </div>

              {/* Cabeçalho do Drawer */}
              <div className="p-6 flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-white font-black text-xl uppercase tracking-tighter">Explorar</span>
                  <span className="text-gray-600 text-[10px] font-black uppercase tracking-[0.2em]">RS Top Team Academy</span>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-gray-400"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Lista Dinâmica de Módulos Complementares */}
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 pb-32 no-scrollbar px-6">
                {filteredDrawerItems.map(({ to, icon: Icon, label, subtitle }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={(e) => {
                      if (isNavLocked) {
                        e.preventDefault()
                        return
                      }
                      setIsDrawerOpen(false)
                    }}
                    className={({ isActive }) => `
                      flex items-center gap-5 p-4 rounded-2xl transition-all relative overflow-hidden group
                      ${isActive ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 shadow-lg' : 'bg-white/[0.03] text-gray-400 border border-transparent'}
                    `}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all bg-[#151515] group-active:scale-90 ${location.pathname === to ? 'text-rose-500 shadow-inner shadow-rose-500/20' : 'text-gray-600'}`}>
                      <Icon size={22} strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-black uppercase tracking-widest">{label}</span>
                      <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest opacity-60">{subtitle || 'Acessar módulo'}</span>
                    </div>
                    <ChevronRight size={18} className="absolute right-4 text-gray-700 opacity-0 group-hover:opacity-100 transition-all -translate-x-4 group-hover:translate-x-0" />
                  </NavLink>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

// Sub-componente auxiliar para itens individuais da barra (evita repetição de código)
function NavItem({ to, icon: Icon, label, active, locked }) {
  return (
    <NavLink
      to={to}
      onClick={(e) => {
        if (locked) {
          e.preventDefault()
        }
      }}
      className="flex-1 flex flex-col items-center justify-center gap-1.5 h-full transition-all active:scale-95 no-tap-highlight"
    >
      <div className={`transition-all duration-300 ${active ? 'text-rose-500 scale-110' : 'text-gray-500 opacity-60'}`}>
        <Icon size={22} strokeWidth={active ? 2.5 : 2} />
      </div>
      <p className={`text-[9px] font-black uppercase tracking-widest transition-colors duration-300 ${active ? 'text-rose-500' : 'text-gray-600'}`}>
        {label}
      </p>
    </NavLink>
  )
}

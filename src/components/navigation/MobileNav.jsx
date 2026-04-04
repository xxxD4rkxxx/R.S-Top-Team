// COMPONENTE DE NAVEGAÇÃO MOBILE (BOTTOM BAR)
// Fornece uma barra de navegação inferior premium para dispositivos móveis.
// Inclui um botão central flutuante para início rápido de chamada e um menu "Mais".
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
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
  Award,
  ShieldCheck,
  MessageCircle,
  FileText,
  PieChart
} from 'lucide-react'

// Itens principais da barra inferior (Excluindo o botão central)
const mainNavItems = [
  { to: '/', icon: Home, label: 'Início' },
  { to: '/students', icon: Users, label: 'Alunos' },
  { to: '/finance', icon: Banknote, label: 'Fluxo' },
]

// Itens do menu "Mais" (Drawer lateral/inferior)
const drawerItems = [
  { to: '/events', icon: TrendingUp, label: 'Lutas & Eventos' },
  { to: '/modalities', icon: Layers, label: 'Modalidades' },
  { to: '/contracts', icon: FileText, label: 'Contratos' },
  { to: '/occupancy', icon: PieChart, label: 'Ocupação' },
  { to: '/belts', icon: Award, label: 'Graduações' },
  { to: '/collaborators', icon: ShieldCheck, label: 'Professores & Equipe' },
  { to: '/profile', icon: Settings, label: 'Meu Perfil' },
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

  return (
    <>
      {/* Container Principal da Barra Inferior */}
      <div className="fixed bottom-0 left-0 right-0 z-[100] px-4 pb-4 select-none">
        
        {/* Estrutura da Barra com Efeito de Vidro (Glassmorphism) */}
        <div className="relative h-[72px] bg-[#0A0A0A]/95 backdrop-blur-3xl border border-white/5 rounded-3xl flex items-center justify-around px-2 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">

          {/* Indicador de Aba Ativa (Linha colorida superior) */}
          <div className="absolute inset-0 pointer-events-none flex justify-around px-2">
            {[0, 1, 2, 3, 4].map(idx => {
              if (idx === 2) return <div key={idx} className="w-16" /> // Espaçador central para o botão flutuante

              let isActive = false;
              if (idx === 0) isActive = isTabActive('/');
              if (idx === 1) isActive = isTabActive('/students');
              if (idx === 3) isActive = isTabActive('/finance');
              if (idx === 4) isActive = isDrawerOpen;

              return (
                <div key={idx} className="relative flex-1 flex justify-center">
                  {isActive && (
                    <motion.div
                      layoutId="active-line"
                      className="absolute -top-[1.5px] w-8 h-[3px] bg-primary rounded-full"
                      transition={springConfig}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* Itens de Navegação Diretos */}
          <NavItem to="/" icon={Home} label="Início" active={isTabActive('/')} />
          <NavItem to="/students" icon={Users} label="Alunos" active={isTabActive('/students')} />

          {/* BOTÃO CENTRAL FLUTUANTE (Atalho Iniciar Chamada) */}
          <div className="relative w-16 h-16 flex items-center justify-center -mt-10">
            {/* Brilho Pulsante sob o botão */}
            <div className={`absolute inset-0 rounded-full blur-2xl transition-all duration-500 ${isTabActive('/attendance') ? 'bg-primary/40' : 'bg-white/5'}`} />

            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={() => navigate('/attendance')}
              className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 border-4 border-[#0A0A0A] ${isTabActive('/attendance') ? 'bg-primary text-white' : 'bg-[#151515] text-gray-500'}`}
            >
              <CheckCircle2 size={28} strokeWidth={2.5} />
            </motion.button>
            <p className={`absolute -bottom-6 text-[9px] font-black uppercase tracking-widest transition-colors duration-500 ${isTabActive('/attendance') ? 'text-primary' : 'text-gray-600'}`}>
              Chamada
            </p>
          </div>

          <NavItem to="/finance" icon={Banknote} label="Fluxo" active={isTabActive('/finance')} />

          {/* Botão para abrir o menu complementar "Mais" */}
          <button
            onClick={handleToggleDrawer}
            className="flex-1 flex flex-col items-center justify-center gap-1.5 h-full transition-all active:scale-95 no-tap-highlight"
          >
            <div className={`transition-all duration-300 ${isDrawerOpen ? 'text-primary scale-110' : 'text-gray-500 opacity-60'}`}>
              {isDrawerOpen ? <X size={22} strokeWidth={2.5} /> : <MoreHorizontal size={22} strokeWidth={2} />}
            </div>
            <p className={`text-[9px] font-black uppercase tracking-widest transition-colors duration-300 ${isDrawerOpen ? 'text-primary' : 'text-gray-600'}`}>
              Mais
            </p>
          </button>
        </div>
      </div>

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
              className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-[#0A0A0A] border-t border-white/10 rounded-t-3xl z-[80] overflow-hidden flex flex-col shadow-[0_-20px_50px_rgba(0,0,0,0.5)]"
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
                {drawerItems.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setIsDrawerOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-5 p-4 rounded-2xl transition-all relative overflow-hidden group
                      ${isActive ? 'bg-primary/10 text-primary border border-primary/20 shadow-lg' : 'bg-white/[0.03] text-gray-400 border border-transparent'}
                    `}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all bg-[#151515] group-active:scale-90 ${location.pathname === to ? 'text-primary shadow-inner shadow-primary/20' : 'text-gray-600'}`}>
                      <Icon size={22} strokeWidth={2.5} />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-black uppercase tracking-widest">{label}</span>
                      <span className="text-[10px] text-gray-600 font-bold uppercase tracking-widest opacity-60">Acessar módulo</span>
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
function NavItem({ to, icon: Icon, label, active }) {
  return (
    <NavLink
      to={to}
      className="flex-1 flex flex-col items-center justify-center gap-1.5 h-full transition-all active:scale-95 no-tap-highlight"
    >
      <div className={`transition-all duration-300 ${active ? 'text-primary scale-110' : 'text-gray-500 opacity-60'}`}>
        <Icon size={22} strokeWidth={active ? 2.5 : 2} />
      </div>
      <p className={`text-[9px] font-black uppercase tracking-widest transition-colors duration-300 ${active ? 'text-primary' : 'text-gray-600'}`}>
        {label}
      </p>
    </NavLink>
  )
}

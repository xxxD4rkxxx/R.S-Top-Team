import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { NavLink, useLocation } from 'react-router-dom'
import { Home, Users, CheckCircle2, Calendar, MoreHorizontal, X, ChevronRight, PieChart, Layers, Settings } from 'lucide-react'

const mainNavItems = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/students', icon: Users, label: 'Alunos' },
  { to: '/attendance', icon: CheckCircle2, label: 'Check-in' },
  { to: '/events', icon: Calendar, label: 'Lutas' },
]

const drawerItems = [
  { to: '/finance', icon: PieChart, label: 'Financeiro' },
  { to: '/modalities', icon: Layers, label: 'Modalidades' },
  { to: '/profile', icon: Settings, label: 'Configurações' },
]

const commonTransition = { type: 'spring', damping: 25, stiffness: 300 }

export default function MobileNav() {
  const location = useLocation()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Close drawer when route changes
  useEffect(() => {
    setIsDrawerOpen(false)
  }, [location])

  const handleToggleDrawer = (e) => {
    e.preventDefault()
    setIsDrawerOpen(!isDrawerOpen)
  }

  return (
    <>
      {/* Bottom Floating Bar */}
      <motion.nav
        initial={{ y: 100, x: '-50%' }}
        animate={{ y: 0, x: '-50%' }}
        transition={commonTransition}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 h-16 bg-black/80 backdrop-blur-3xl border border-white/10 rounded-[5px] px-2 flex items-center justify-between gap-1 z-[100] shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
      >
        {mainNavItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to))
          const showPill = isActive && !isDrawerOpen

          return (
            <NavLink
              key={to}
              to={to}
              className={`relative flex items-center justify-center transition-all duration-300 rounded-[5px] h-12 no-tap-highlight ${showPill ? 'flex-grow min-w-[140px] px-3' : 'flex-initial w-12'}`}
            >
              {showPill && (
                <motion.div
                  layoutId="active-pill"
                  className="absolute inset-0 bg-primary"
                  transition={commonTransition}
                  style={{ borderRadius: '5px' }}
                />
              )}

              <div className={`relative z-10 flex items-center justify-center gap-3 transition-colors duration-300 ${showPill ? 'text-white' : 'text-gray-500/80'}`}>
                {showPill ? (
                  <div className="bg-black/40 p-1.5 rounded-[5px] text-white shadow-sm flex items-center justify-center scale-110">
                    <Icon size={14} strokeWidth={3} className="shrink-0" />
                  </div>
                ) : (
                  <Icon size={20} strokeWidth={2} className="shrink-0 opacity-70" />
                )}

                {showPill && (
                  <motion.span
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={commonTransition}
                    className="text-[11px] font-black uppercase tracking-widest whitespace-nowrap overflow-hidden pr-1"
                  >
                    {label}
                  </motion.span>
                )}
              </div>
            </NavLink>
          )
        })}

        {/* More Button */}
        <button
          onClick={handleToggleDrawer}
          className={`relative flex items-center justify-center transition-all duration-300 rounded-[5px] h-12 no-tap-highlight ${isDrawerOpen ? 'flex-grow min-w-[100px] px-2' : 'flex-initial w-12'}`}
        >
          {isDrawerOpen && (
            <motion.div
              layoutId="active-pill"
              className="absolute inset-0 bg-primary"
              transition={commonTransition}
              style={{ borderRadius: '5px' }}
            />
          )}
          <div className={`relative z-10 flex items-center justify-center gap-2 transition-colors duration-300 ${isDrawerOpen ? 'text-white' : 'text-gray-500/80'}`}>
            {isDrawerOpen ? (
              <div className="bg-black/40 p-1.5 rounded-[5px] text-white shadow-sm flex items-center justify-center">
                <X size={16} strokeWidth={3} className="shrink-0" />
              </div>
            ) : (
              <MoreHorizontal size={22} strokeWidth={2} className="shrink-0" />
            )}

            {isDrawerOpen && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={commonTransition}
                className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap pr-2"
              >
                Fechar
              </motion.span>
            )}
          </div>
        </button>
      </motion.nav>

      {/* Drawer Overlay */}
      <AnimatePresence>
        {isDrawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-[#0F0F0F] border-t border-white/10 rounded-t-[5px] z-[80] overflow-hidden flex flex-col"
            >
              <div className="p-4 flex items-center justify-between border-b border-white/5">
                <span className="text-gray-400 font-bold uppercase text-[10px] tracking-[0.2em] ml-2">Explorar Sistema</span>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-2 bg-white/5 rounded-[5px] text-gray-400"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 pb-28 no-scrollbar">
                {drawerItems.map(({ to, icon: Icon, label }) => (
                  <NavLink
                    key={to}
                    to={to}
                    onClick={() => setIsDrawerOpen(false)}
                    className={({ isActive }) => `
                      flex items-center gap-4 p-4 rounded-[5px] transition-all
                      ${isActive ? 'bg-primary/10 text-primary border border-primary/20' : 'bg-white/[0.03] text-gray-300 border border-transparent'}
                    `}
                  >
                    <div className={`p-2 rounded-[5px] scale-110 ${location.pathname === to ? 'bg-primary/20 text-primary' : 'bg-white/5 text-gray-500'}`}>
                      <Icon size={20} />
                    </div>
                    <span className="flex-1 text-sm font-medium">{label}</span>
                    <ChevronRight size={16} className="opacity-30" />
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

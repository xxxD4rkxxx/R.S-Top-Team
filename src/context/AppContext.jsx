// Resumo: contexto global do app (estado de modalidade atual, visão admin/aluno).

import React, { createContext, useContext, useState } from 'react'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [isAdminView, setIsAdminView] = useState(true)
  const [currentModality, setCurrentModality] = useState('Jiu-Jitsu')
  const [isMobileNavHidden, setIsMobileNavHidden] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isNavLocked, setIsNavLocked] = useState(false)

  return (
    <AppContext.Provider value={{
      isAdminView,
      setIsAdminView,
      currentModality,
      setCurrentModality,
      isMobileNavHidden,
      setIsMobileNavHidden,
      collapsed,
      setCollapsed,
      mobileOpen,
      setMobileOpen,
      isNavLocked,
      setIsNavLocked,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}

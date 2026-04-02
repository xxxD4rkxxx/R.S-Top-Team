// Resumo: contexto global do app (estado de modalidade atual, visão admin/aluno).

import React, { createContext, useContext, useState } from 'react'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [isAdminView, setIsAdminView] = useState(true)
  const [currentModality, setCurrentModality] = useState('Jiu-Jitsu')

  return (
    <AppContext.Provider value={{
      isAdminView,
      setIsAdminView,
      currentModality,
      setCurrentModality,
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

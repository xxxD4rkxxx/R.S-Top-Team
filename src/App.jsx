// Resumo: shell principal do app com sidebar, rotas e rodapé global.
import React, { useState } from 'react'
import { Menu, CalendarDays, GraduationCap, Target, Award, Banknote, TrendingDown, Activity } from 'lucide-react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider, useAuth } from './context/AuthContext'
import Sidebar from './components/sidebar/Sidebar'
import MobileNav from './components/navigation/MobileNav'
import SiteFooter from './components/shared/SiteFooter'
import DashboardPage from './modules/dashboard/DashboardPage'
import AttendancePage from './modules/attendance/AttendancePage'
import StudentsPage from './modules/students/StudentsPage'
import CollaboratorsPage from './modules/collaborators/CollaboratorsPage'
import EventsPage from './modules/events/EventsPage'
import ProfilePage from './modules/profile/ProfilePage'
import ReviewAttendancePage from './modules/attendance/ReviewAttendancePage'
import LoginPage from './modules/auth/LoginPage'
import RegisterPage from './modules/auth/RegisterPage'
import FinancePage from './modules/finance/FinancePage'
import ContractsPage from './modules/contracts/ContractsPage'
import WhatsAppHub from './modules/whatsapp/WhatsAppHub'
import ProtectedRoute from './components/auth/ProtectedRoute'
import ModuleUnderDevelopment from './components/shared/ModuleUnderDevelopment'
import ModalitiesPage from './modules/modalities/ModalitiesPage'


import ErrorBoundary from './components/shared/ErrorBoundary'

import FloatingActionMenu from './components/navigation/FloatingActionMenu'

function AppContent() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const location = useLocation()

  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  const isProfilePage = location.pathname.startsWith('/profile')
  const { user, isSetupMode } = useAuth()
  const isAuthPage = ['/login', '/register'].includes(location.pathname)

  // 1. If system has NO admins, force registration
  if (isSetupMode && location.pathname !== '/register') {
    return <Navigate to="/register" replace />
  }

  // 2. If user is ALREADY logged in and tries to access /login or /register, send to Home
  if (user && isAuthPage) {
    return <Navigate to="/" replace />
  }

  // 3. Auth Routes (Public)
  if (isAuthPage) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
    )
  }

  return (
    <ErrorBoundary>
      <div className="flex h-dvh overflow-hidden w-full" style={{ background: 'var(--clr-bg)' }}>
        {/* Renderize a Sidebar apenas no desktop (md:flex) */}
        {!isMobile && (
          <Sidebar
            collapsed={collapsed}
            setCollapsed={setCollapsed}
            mobileOpen={mobileOpen}
            setMobileOpen={setMobileOpen}
          />
        )}

        {/* Content area - Removed pb-32 to eliminate the black bar, shifted to internal spacer */}
        <div className={`main-content flex flex-col flex-1 min-w-0 transition-all ${isMobile ? 'px-4 overflow-y-auto overflow-x-hidden' : ''}`}>
          {/* Mobile UI - Top Safe Area */}
          {isMobile && <div className="h-6 w-full shrink-0" />}

          <div className="flex-1">
            <Routes>
              <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/home" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/attendance" element={<ProtectedRoute allowedRoles={['admin', 'gestor', 'professor']}><AttendancePage /></ProtectedRoute>} />
              <Route path="/students" element={<ProtectedRoute allowedRoles={['admin', 'gestor', 'professor']}><StudentsPage /></ProtectedRoute>} />
              <Route path="/collaborators" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><CollaboratorsPage /></ProtectedRoute>} />
              <Route path="/events" element={<ProtectedRoute><EventsPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/attendance/review/:sessionId" element={<ProtectedRoute allowedRoles={['admin', 'gestor', 'professor']}><ReviewAttendancePage /></ProtectedRoute>} />
              <Route path="/finance" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><FinancePage /></ProtectedRoute>} />
              <Route path="/contracts" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><ContractsPage /></ProtectedRoute>} />
              <Route path="/whatsapp" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><WhatsAppHub /></ProtectedRoute>} />

              {/* Modularização / Em Desenvolvimento */}
              <Route path="/experimental" element={<ProtectedRoute><ModuleUnderDevelopment
                icon={CalendarDays} title="Aulas Experimentais"
                features={['Cadastro de novos interessados', 'Lembretes automáticos', 'Histórico de visitas', 'Conversão para matrícula']}
              /></ProtectedRoute>} />

              <Route path="/modalities" element={<ProtectedRoute><ModalitiesPage /></ProtectedRoute>} />


              <Route path="/occupancy" element={<ProtectedRoute><ModuleUnderDevelopment
                icon={Target}
                title="Controle de Ocupação"
                description="Visualize a ocupação real de todas as turmas baseada em frequência (check-ins únicos no mês). Identifique turmas superlotadas e com baixa ocupação, veja quais alunos realmente treinaram, e receba recomendações semanais automáticas no card 'Ações da Semana'."
                features={[
                  'Ocupação real por check-ins únicos',
                  'Alertas de superlotação e baixa ocupação',
                  'Card \'Ações da Semana\' automático',
                  'Destaque de alunos ativos na turma'
                ]}
              /></ProtectedRoute>} />

              <Route path="/belts" element={<ProtectedRoute><ModuleUnderDevelopment
                icon={Award} title="Faixas e Graduações"
                features={['Controle de graus e faixas', 'Certificados digitais', 'Lembretes de trocar de faixa', 'Histórico de evolução']}
              /></ProtectedRoute>} />

              <Route path="/plans" element={<ProtectedRoute><ModuleUnderDevelopment
                icon={Banknote} title="Planos"
                features={['Planos recorrentes', 'Gestão de benefícios', 'Cobrança automática', 'Planos promocionais']}
              /></ProtectedRoute>} />

              <Route path="/expenses" element={<ProtectedRoute><ModuleUnderDevelopment
                icon={TrendingDown} title="Despesas"
                features={['Lançamento de custos fixos', 'Gestão de fornecedores', 'Fluxo de caixa de saída', 'Anexos de notas fiscais']}
              /></ProtectedRoute>} />

              <Route path="/reports" element={<ProtectedRoute><ModuleUnderDevelopment
                icon={Activity} title="Relatórios Financeiros"
                features={['DRE Mensal', 'Comparativo anual', 'Exportação contábil', 'Gráficos de lucro e perdas']}
              /></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>

          <SiteFooter />

          {/* Spacer to allow scrolling past the floating bottom nav */}
          {isMobile && <div className="h-32 w-full shrink-0" />}
        </div>

        {/* Barra de Navegação Mobile */}
        {isMobile && <MobileNav />}
      </div>
    </ErrorBoundary>
  )
}


export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppProvider>
          <AppContent />
        </AppProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}

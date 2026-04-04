// RESUMO: Shell principal da aplicação RS Top Team.
// Gerencia o roteamento, provedores de contexto (Auth, Theme, App),
// barra lateral, navegação mobile e proteção de rotas por perfis de acesso.
import React, { useState } from 'react'
import { Menu, CalendarDays, GraduationCap, Target, Award, Banknote, TrendingDown, Activity } from 'lucide-react'
import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
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
import ProtectedRoute from './components/auth/ProtectedRoute'
import ModuleUnderDevelopment from './components/shared/ModuleUnderDevelopment'
import ModalitiesPage from './modules/modalities/ModalitiesPage'
import ErrorBoundary from './components/shared/ErrorBoundary'
import FloatingActionMenu from './components/navigation/FloatingActionMenu'

function AppContent() {
  const { collapsed, setCollapsed, mobileOpen, setMobileOpen } = useApp()
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768)
  const location = useLocation()

  // Listener para detectar mudanças no tamanho da janela e ajustar layout mobile
  React.useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const { user, isSetupMode } = useAuth()
  const isAuthPage = ['/login', '/register'].includes(location.pathname)

  // 1. MODO SETUP: Se o sistema não tiver nenhum administrador, força o registro do primeiro.
  if (isSetupMode && location.pathname !== '/register') {
    return <Navigate to="/register" replace />
  }

  // 2. REDIRECIONAMENTO: Se o usuário já estiver logado, admite acesso às telas de login/registro.
  if (user && isAuthPage) {
    return <Navigate to="/" replace />
  }

  // 3. ROTAS PÚBLICAS (AUTENTICAÇÃO)
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
      {/* Layout Principal com Sidebar e Área de Conteúdo */}
      <div className="flex h-dvh overflow-hidden w-full" style={{ background: 'var(--clr-bg)' }}>
        <Sidebar
          collapsed={collapsed}
          setCollapsed={setCollapsed}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />

        {/* Área de Conteúdo Dinâmico */}
        <div className={`main-content flex flex-col flex-1 min-w-0 transition-all ${isMobile ? 'px-4 overflow-y-auto overflow-x-hidden' : ''}`}>
          
          {/* Espaçamento extra para telas mobile (Safe Area) */}
          {isMobile && <div className="h-6 w-full shrink-0" />}

          <div className="flex-1">
            <Routes>
              {/* Rotas Protegidas por Nível de Acesso */}
              <Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/home" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
              <Route path="/attendance" element={<ProtectedRoute allowedRoles={['admin', 'gestor', 'professor']}><AttendancePage /></ProtectedRoute>} />
              <Route path="/students" element={<ProtectedRoute allowedRoles={['admin', 'gestor', 'professor']}><StudentsPage /></ProtectedRoute>} />
              <Route path="/collaborators" element={<ProtectedRoute allowedRoles={['admin', 'gestor', 'professor']}><CollaboratorsPage /></ProtectedRoute>} />
              <Route path="/events" element={<ProtectedRoute><EventsPage /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
              <Route path="/attendance/review/:sessionId" element={<ProtectedRoute allowedRoles={['admin', 'gestor', 'professor']}><ReviewAttendancePage /></ProtectedRoute>} />
              <Route path="/finance" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><FinancePage /></ProtectedRoute>} />
              <Route path="/contracts" element={<ProtectedRoute allowedRoles={['admin', 'gestor']}><ContractsPage /></ProtectedRoute>} />

              {/* Módulos em Desenvolvimento (Placeholders) */}
              <Route path="/experimental" element={<ProtectedRoute><ModuleUnderDevelopment
                icon={CalendarDays} title="Aulas Experimentais"
                features={['Cadastro de novos interessados', 'Lembretes automáticos', 'Histórico de visitas', 'Conversão para matrícula']}
              /></ProtectedRoute>} />

              <Route path="/modalities" element={<ProtectedRoute><ModalitiesPage /></ProtectedRoute>} />

              <Route path="/occupancy" element={<ProtectedRoute><ModuleUnderDevelopment
                icon={Target}
                title="Controle de Ocupação"
                description="Visualize a ocupação real de todas as turmas baseada em frequência."
                features={[
                  'Ocupação real por check-ins únicos',
                  'Alertas de superlotação e baixa ocupação',
                  'Card \'Ações da Semana\' automático',
                  'Destaque de alunos ativos na turma'
                ]}
              /></ProtectedRoute>} />

              <Route path="/belts" element={<ProtectedRoute><ModuleUnderDevelopment
                icon={Award} title="Faixas e Graduações"
                features={['Controle de graus e faixas', 'Certificados digitais', 'Hitorico de evolução']}
              /></ProtectedRoute>} />

              <Route path="/plans" element={<ProtectedRoute><ModuleUnderDevelopment
                icon={Banknote} title="Planos"
                features={['Planos recorrentes', 'Gestão de benefícios', 'Cobrança automática']}
              /></ProtectedRoute>} />

              <Route path="/expenses" element={<ProtectedRoute><ModuleUnderDevelopment
                icon={TrendingDown} title="Despesas"
                features={['Lançamento de custos fixos', 'Gestão de fornecedores', 'Fluxo de caixa']}
              /></ProtectedRoute>} />

              <Route path="/reports" element={<ProtectedRoute><ModuleUnderDevelopment
                icon={Activity} title="Relatórios Financeiros"
                features={['DRE Mensal', 'Comparativo anual', 'Exportação contábil']}
              /></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>

          {!isMobile && <SiteFooter />}

          {/* Espaçador para permitir scroll acima da barra de navegação flutuante no mobile */}
          {isMobile && <div className="h-32 w-full shrink-0" />}
        </div>

        {/* Componente de Navegação Inferior para dispositivos móveis */}
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

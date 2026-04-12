import React from 'react'
import { useAuth } from '../../context/AuthContext'
import ManagerDashboard from './ManagerDashboard'
import TeacherDashboard from './TeacherDashboard'
import StudentDashboard from './StudentDashboard'
import { Activity } from 'lucide-react'

/**
 * DashboardPage - O "Cérebro" de Roteamento Interno
 * 
 * Em vez de uma página estática, este componente atua como um switch inteligente.
 * Ele detecta o 'effectiveRole' do usuário e renderiza o dashboard específico.
 */
export default function DashboardPage() {
  const { userData, effectiveRole, loading } = useAuth()

  // 1. Estado de Carregamento (Previne flashes de "acesso negado")
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 animate-pulse text-gray-500 min-h-screen bg-black">
        <Activity size={48} className="mb-4 opacity-20" />
        <p className="text-[10px] uppercase font-black tracking-[0.2em]">Sincronizando Perfil...</p>
      </div>
    )
  }

  // 2. Roteamento por Papel Operacional
  // Prioridade: Gestão > Ensino > Aluno
  if (effectiveRole === 'admin' || effectiveRole === 'gestor') {
    return <ManagerDashboard />
  }

  if (effectiveRole === 'professor') {
    return <TeacherDashboard />
  }

  if (effectiveRole === 'aluno') {
    // Alunos precisam de seus dados para o cálculo de graduação no dashboard
    return <StudentDashboard user={userData} />
  }

  // Fallback de Segurança: Se algo falhar na resolução de papel
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center min-h-screen bg-black">
      <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-4 border border-red-500/20">
        <Activity size={24} className="text-red-500" />
      </div>
      <h3 className="text-white font-black uppercase tracking-tight">Erro de Identidade</h3>
      <p className="text-xs text-gray-500 mt-1 max-w-xs">Não foi possível determinar seu nível de acesso ({effectiveRole}). Por favor, tente recarregar ou contatar o suporte.</p>
    </div>
  )
}

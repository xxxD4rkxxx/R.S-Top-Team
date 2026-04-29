import React from 'react'
import { useAuth } from '../../context/AuthContext'
import { useFinance } from '../../hooks/useFinance'
import ManagerDashboard from './ManagerDashboard'
import TeacherDashboard from './TeacherDashboard'
import StudentDashboard from './StudentDashboard'
import { Activity, ShieldCheck, RefreshCw } from 'lucide-react'
import { runGlobalMigration } from '../../scripts/migrate_to_pt'
import { toast } from 'react-hot-toast'

/**
 * DashboardPage - O "Cérebro" de Roteamento Interno
 * 
 * Em vez de uma página estática, este componente atua como um switch inteligente.
 * Ele detecta o 'effectiveRole' do usuário e renderiza o dashboard específico.
 */
export default function DashboardPage() {
  const { userData, effectiveRole, loading, user, simulatedRole, setSimulatedRole } = useAuth()
  // Busca cobranças: para alunos, o hook já filtra só as deles (Zero Leaks)
  const { bills, loading: loadingBills } = useFinance()
  const [isMigrating, setIsMigrating] = React.useState(false)
  const [migrationStatus, setMigrationStatus] = React.useState('')

  const handleRunMigration = async () => {
    if (!window.confirm('Deseja iniciar a migração global de dados para PT-BR? Isso criará cópias de todos os documentos nas novas coleções traduzidas.')) return
    
    setIsMigrating(true)
    try {
      const count = await runGlobalMigration((status) => setMigrationStatus(status))
      toast.success(`Migração concluída! ${count} documentos processados.`)
      setMigrationStatus('Concluído com sucesso!')
    } catch (err) {
      console.error(err)
      toast.error('Erro na migração. Veja o console.')
      setMigrationStatus('Erro na migração.')
    } finally {
      setIsMigrating(false)
    }
  }

  // 1. Estado de Carregamento (Previne flashes de "acesso negado")
  const [showRetry, setShowRetry] = React.useState(false)
  React.useEffect(() => {
    const timer = setTimeout(() => setShowRetry(true), 5000)
    return () => clearTimeout(timer)
  }, [])

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-gray-500 min-h-screen bg-black">
        <div className="relative mb-6">
          <Activity size={48} className="text-primary animate-pulse" />
          <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
        </div>
        <p className="text-[10px] uppercase font-black tracking-[0.2em] text-white">Sincronizando Perfil...</p>
        <p className="text-[9px] text-gray-600 mt-2 uppercase tracking-widest">Validando credenciais e carregando dados do Firestore</p>
        
        {showRetry && (
          <button 
            onClick={() => window.location.reload()}
            className="mt-8 px-6 py-2 bg-white/5 border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/10 transition-all"
          >
            O carregamento está demorando? Clique aqui para tentar novamente
          </button>
        )}
      </div>
    )
  }

  // 2. Roteamento por Papel Operacional com Simulação
  // Se o usuário for admin, permitimos que ele alterne para a visão de professor ou aluno
  const currentRole = effectiveRole

  if (currentRole === 'admin' || currentRole === 'gestor') {
    // Se o usuário explicitamente mudou o papel simulado no AuthContext, ele já virá no currentRole
    // mas o DashboardPage pode oferecer um atalho visual.
    return (
      <div className="flex flex-col flex-1 min-h-screen">
        {/* Switcher discreto para Admins visualizarem outros Dashboards */}
        <div className="bg-primary/10 border-b border-primary/20 px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={14} className="text-primary" />
            <span className="text-[10px] font-black uppercase tracking-widest text-primary">Modo Administrador</span>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => setSimulatedRole(null)}
              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${!simulatedRole ? 'bg-primary text-black' : 'bg-white/5 text-gray-500 hover:text-white'}`}
            >
              Visão Gestor
            </button>
            <button 
              onClick={() => setSimulatedRole('professor')}
              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all ${simulatedRole === 'professor' ? 'bg-primary text-black' : 'bg-white/5 text-gray-500 hover:text-white'}`}
            >
              Visão Professor
            </button>
            <button 
              onClick={handleRunMigration}
              disabled={isMigrating}
              className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter transition-all flex items-center gap-2 ${isMigrating ? 'bg-yellow-500/20 text-yellow-500' : 'bg-white/5 text-gray-500 hover:text-white'}`}
            >
              <RefreshCw size={10} className={isMigrating ? 'animate-spin' : ''} />
              {isMigrating ? migrationStatus : 'Migrar para PT-BR'}
            </button>
          </div>
        </div>
        
        {simulatedRole === 'professor' ? <TeacherDashboard /> : <ManagerDashboard />}
      </div>
    )
  }

  if (currentRole === 'professor') {
    return <TeacherDashboard />
  }

  if (currentRole === 'aluno') {
    // Alunos precisam de seus dados para o cálculo de graduação no dashboard
    // Filtramos as cobranças APENAS do aluno logado, sem expor dos outros
    const minhasCobrancas = bills.filter(b => b.studentId === userData?.id)
    const temPendencia = minhasCobrancas.some(b => b.status === 'overdue' || b.status === 'pending')
    const temAtraso = minhasCobrancas.some(b => b.status === 'overdue')
    return <StudentDashboard user={userData} temPendencia={temPendencia} temAtraso={temAtraso} cobrancas={minhasCobrancas} />
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

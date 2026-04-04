import React, { useState, useMemo, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { 
  CreditCard, DollarSign, TrendingUp, TrendingDown, 
  AlertCircle, CheckCircle2, Clock, Filter, 
  Download, Plus, Search, ArrowUpRight, ArrowDownRight,
  Zap, MoreVertical, Trash2
} from 'lucide-react'
import PageHeader from '../../components/shared/PageHeader'
import { useStudents } from '../../hooks/useStudents'
import { useFinance } from '../../hooks/useFinance'
import ModuleUnderDevelopment from '../../components/shared/ModuleUnderDevelopment'
import KPICard from '../../components/shared/KPICard'

import MobileHeader from '../../components/navigation/MobileHeader'

export default function FinancePage() {
  const { students } = useStudents()
  const { 
    bills, loading, updateBillStatus, deleteBill,
    totalOverdue, totalPending, totalPaid
  } = useFinance()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState('overview')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState(location.state?.status || 'all')

  useEffect(() => {
    if (location.state?.status) {
      setStatusFilter(location.state.status)
      setActiveTab('bills')
    }
  }, [location.state])

  const stats = useMemo(() => ({
    totalRevenue: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPaid),
    pendingRevenue: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPending),
    overdueRevenue: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalOverdue),
    activeSubscribers: students.filter(s => s.status === 'active').length,
    growth: 12.5
  }), [totalPaid, totalPending, totalOverdue, students])

  const filteredBills = useMemo(() => {
    return (bills || []).filter(b => {
      const matchSearch = b.studentName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          b.type?.toLowerCase().includes(searchTerm.toLowerCase())
      const matchStatus = statusFilter === 'all' || b.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [bills, searchTerm, statusFilter])

  const getStatusStyle = (status) => {
    switch(status) {
      case 'paid': return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      case 'pending': return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
      case 'overdue': return 'bg-rose-500/10 text-rose-400 border-rose-500/20'
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  const getStatusLabel = (status) => {
    switch(status) {
      case 'paid': return 'Pago'
      case 'pending': return 'Pendente'
      case 'overdue': return 'Vencido'
      default: return status
    }
  }

  return (
    <div className="flex flex-col flex-1 w-full min-w-0">
      <MobileHeader 
        title="Financeiro"
        actions={
          <button className="p-2.5 rounded-[5px] bg-primary text-black active:scale-90 transition-transform shadow-lg shadow-primary/20">
            <Plus size={20} strokeWidth={3} />
          </button>
        }
      />
      <PageHeader 
        icon={CreditCard} 
        title="CENTRAL FINANCEIRA" 
        subtitle="GESTÃO DE RECEITAS, COBRANÇAS E FLUXO DE CAIXA"
        extra={
          <div className="flex gap-3">
             <button className="flex items-center gap-2 px-4 py-2 rounded-xll text-[11px] font-bold uppercase bg-white/5 text-gray-500 hover:text-white border border-white/5 active:scale-95 transition-all">
              <Download size={16} /> Relatórios
            </button>
            <button className="btn-primary flex items-center gap-2 px-5 py-2 rounded-xll text-[11px] font-bold uppercase shadow-xl hover:brightness-110 active:scale-95 transition-all">
              <Plus size={16} /> Nova Cobrança
            </button>
          </div>
        }
      />

      <div className="px-4 md:px-6 py-6 space-y-6 max-w-7xl mx-auto w-full">
        
        {/* KPI Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard 
            title="Receita Realizada" 
            value={stats.totalRevenue} 
            description="Este mês até agora" 
            icon={CheckCircle2} 
            valueColor="text-emerald-400"
          />
          <KPICard 
            title="A Receber" 
            value={stats.pendingRevenue} 
            description="Previsão para o período" 
            icon={Clock} 
            valueColor="text-amber-400"
          />
          <KPICard 
            title="Inadimplência" 
            value={stats.overdueRevenue} 
            description="Cobranças vencidas" 
            icon={AlertCircle} 
            valueColor="text-rose-400"
          />
          <KPICard 
            title="Ticket Médio" 
            value="R$ 158,00" 
            description="Por aluno ativo" 
            icon={TrendingUp} 
            valueColor="text-app"
          />
        </div>

        {/* Navigation Tabs */}
        <div className="flex p-1 bg-black/40 rounded-xll border border-white/5 w-fit">
          {[
            { id: 'overview', label: 'Visão Geral', icon: Zap },
            { id: 'bills', label: 'Cobranças', icon: CreditCard },
            { id: 'expenses', label: 'Despesas', icon: TrendingDown },
            { id: 'cashflow', label: 'Fluxo de Caixa', icon: DollarSign }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all ${
                activeTab === tab.id 
                ? 'bg-app-primary-5 text-app shadow-lg' 
                : 'text-app-muted hover:text-app'
              }`}
            >
              <tab.icon size={14} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="glass-card rounded-xll border border-white/10 overflow-hidden min-h-[400px]">
          {activeTab === 'expenses' ? (
            <ModuleUnderDevelopment 
              icon={TrendingDown} 
              title="Despesas e Custos" 
              features={['Lançamento de custos fixos','Gestão de fornecedores','Fluxo de caixa de saída','Anexos de notas fiscais']} 
            />
          ) : activeTab === 'cashflow' ? (
            <ModuleUnderDevelopment 
              icon={DollarSign} 
              title="Fluxo de Caixa" 
              features={['Balanço mensal','Comparativo de entradas/saídas','Previsão de saldo','Gráficos de fluxo']} 
            />
          ) : (
            <>
              <div className="p-6 border-b border-white/5 flex flex-col md:flex-row gap-4 justify-between items-center bg-white/5">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:min-w-[300px]">
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input 
                        type="text"
                        placeholder="Buscar aluno ou cobrança..."
                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-app focus:ring-1 focus:ring-primary/50 outline-none transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <button className="p-2 rounded-lg bg-app-bg text-app-muted border border-white/5 hover:text-app transition-all">
                      <Filter size={18} />
                    </button>
                </div>
                   <div className="flex gap-2 w-full md:w-auto">
                    <select 
                      className="bg-black/40 border border-white/10 rounded-[5px] px-4 py-2 text-xs font-bold text-app-muted outline-none"
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <option value="all">Todos os Status</option>
                      <option value="paid">Pagos</option>
                      <option value="pending">Pendentes</option>
                      <option value="overdue">Atrasados</option>
                    </select>
                    <select className="bg-black/40 border border-white/10 rounded-[5px] px-4 py-2 text-xs font-bold text-app-muted outline-none">
                      <option>Março / 2024</option>
                      <option>Fevereiro / 2024</option>
                      <option>Janeiro / 2024</option>
                    </select>
                  </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-black/40 border-b border-white/5">
                      <th className="px-6 py-4">Aluno / Descrição</th>
                      <th className="px-6 py-4 text-center">Tipo</th>
                      <th className="px-6 py-4 text-center">Vencimento</th>
                      <th className="px-6 py-4 text-right">Valor</th>
                      <th className="px-6 py-4 text-center">Status</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {loading ? (
                        <tr><td colSpan="6" className="py-20 text-center text-app-muted">Carregando cobranças...</td></tr>
                    ) : filteredBills.length === 0 ? (
                        <tr><td colSpan="6" className="py-20 text-center text-app-muted">Nenhuma cobrança encontrada</td></tr>
                    ) : filteredBills.map(bill => (
                      <tr key={bill.id} className="hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-app group-hover:text-primary transition-colors">{bill.studentName}</span>
                            <span className="text-[10px] text-gray-500 font-medium">Ref: Mensalidade Padrão</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className="text-[10px] font-black text-app-muted uppercase tracking-tighter bg-white/5 px-2 py-1 rounded-[5px]">
                            {bill.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center font-mono text-xs text-gray-400">
                          {bill.dueDate ? new Date(bill.dueDate).toLocaleDateString('pt-BR') : '--'}
                        </td>
                        <td className="px-6 py-4 text-right font-black text-sm text-app">
                          R$ {bill.amount?.toFixed(2) || '0,00'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-2.5 py-1 rounded-[5px] text-[10px] font-black uppercase border ${getStatusStyle(bill.status)}`}>
                            {getStatusLabel(bill.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {bill.status !== 'paid' && (
                              <button 
                                onClick={() => updateBillStatus(bill.id, 'paid')}
                                className="p-2 rounded-[5px] bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 transition-all border border-emerald-500/20" 
                                title="Receber">
                                <DollarSign size={14} />
                              </button>
                            )}
                            <button 
                              onClick={() => deleteBill(bill.id)}
                              className="p-2 rounded-[5px] bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all border border-red-500/10"
                            >
                              <Trash2 size={14} />
                            </button>
                            <button className="p-2 rounded-[5px] bg-app-bg text-app-muted hover:text-app transition-all border border-white/5">
                              <MoreVertical size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="p-4 bg-black/40 border-t border-white/5 flex justify-between items-center">
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Página 1 de 1</span>
                <div className="flex gap-2">
                    <button disabled className="p-2 rounded-[5px] bg-white/5 text-gray-600 disabled:opacity-50 border border-white/5">Anterior</button>
                    <button className="p-2 rounded-[5px] bg-white/10 text-app font-bold text-xs px-4 border border-white/10 hover:bg-white/20">Próxima</button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Quick Actions and Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
           <div className="glass-card p-6 rounded-[5px] border border-red-500/20 bg-red-500/[0.02]">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-[5px] bg-red-500/20 text-red-500">
                  <AlertCircle size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-app uppercase tracking-wider">Planilha de Inadimplência</h4>
                  <p className="text-[10px] text-gray-500">Ações imediatas para cobrança</p>
                </div>
              </div>
              <div className="space-y-3">
                 <div className="flex items-center justify-between p-3 rounded-[5px] bg-black/40 border border-white/5">
                    <div className="flex items-center gap-3">
                       <div className="w-8 h-8 rounded-full bg-rose-500/10 flex items-center justify-center font-bold text-rose-500 text-[10px]">MO</div>
                       <div>
                          <p className="text-xs font-bold text-app">Maria Oliveira</p>
                          <p className="text-[10px] text-red-400 font-bold">Vencido há 10 dias</p>
                       </div>
                    </div>
                     <button className="flex items-center gap-2 px-3 py-1.5 rounded-[5px] bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all">
                       Telefone
                    </button>
                 </div>
                 <button className="w-full mt-2 py-2.5 rounded-[5px] text-[10px] font-black uppercase text-app-muted hover:text-app transition-colors bg-app-bg/50 border border-white/5">Ver todos os inadimplentes</button>
              </div>
           </div>

            <div className="glass-card p-6 rounded-[5px] border border-white/10 bg-white/[0.02]">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-[5px] bg-blue-500/20 text-blue-500">
                  <TrendingUp size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-app uppercase tracking-wider">Metas de Receita</h4>
                  <p className="text-[10px] text-gray-500">Acompanhamento mensal</p>
                </div>
              </div>
              <div className="space-y-4">
                 <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold">
                       <span className="text-gray-400 uppercase tracking-widest">Meta Próxima</span>
                       <span className="text-app">83%</span>
                    </div>
                    <div className="h-2 bg-black/60 rounded-full overflow-hidden border border-white/5">
                       <div className="h-full bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all duration-1000" style={{ width: '83%' }} />
                    </div>
                 </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-[5px] bg-black/40 border border-white/5 border-l-2 border-l-emerald-500">
                       <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">Previsão</p>
                       <p className="text-xs font-black text-app">R$ 14.300</p>
                    </div>
                    <div className="p-3 rounded-[5px] bg-black/40 border border-white/5 border-l-2 border-l-rose-500">
                       <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest mb-1">Déficit</p>
                       <p className="text-xs font-black text-app">R$ 700</p>
                    </div>
                  </div>
              </div>
           </div>
        </div>

      </div>
    </div>
  )
}


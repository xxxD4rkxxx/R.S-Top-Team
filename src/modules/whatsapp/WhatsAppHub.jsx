import React, { useState } from 'react'
import { 
  MessageSquare, Send, Clock, AlertCircle, 
  RefreshCcw, FileText, Gift, UserX, Plus,
  Layout, Search, Filter
} from 'lucide-react'
import PageHeader from '../../components/shared/PageHeader'
import { useWhatsApp } from '../../hooks/useWhatsApp'

export default function WhatsAppHub() {
  const [searchTerm, setSearchTerm] = useState('')
  const [activeTab, setActiveTab] = useState('templates')
  const { history, loading, logMessage } = useWhatsApp()

  const templates = [
    { id: 1, title: 'Cobrança Gentle - Atraso', icon: AlertCircle, color: 'text-amber-500', group: 'Financeiro', content: 'Olá [NOME], vimos que sua mensalidade está pendente. Tudo bem? Como podemos ajudar?' },
    { id: 2, title: 'Boas-vindas - Matrícula', icon: Gift, color: 'text-emerald-500', group: 'Comercial', content: 'Bem-vindo à RS Top Team, [NOME]! Ficamos muito felizes em ter você conosco...' },
    { id: 3, title: 'Inatividade - 15 Dias', icon: UserX, color: 'text-rose-500', group: 'Retenção', content: 'Sentimos sua falta no tatame, [NOME]! Está tudo bem? Esperamos te ver essa semana.' },
    { id: 4, title: 'Aniversário do Dia', icon: Gift, color: 'text-blue-500', group: 'Social', content: 'Parabéns pelo seu dia, [NOME]! Oss! Muita saúde e muitos treinos.' },
  ]

  const handleUseTemplate = async (tmpl) => {
    // Simulated log for "Usar Agora"
    await logMessage({
      name: 'Simulação',
      phone: '(00) 00000-0000',
      type: tmpl.group,
      status: 'sent',
      content: tmpl.content
    })
    alert('Mensagem registrada no histórico (Simulação de envio WhatsApp)')
  }

  return (
    <div className="flex flex-col flex-1 w-full min-w-0">
      <PageHeader 
        icon={MessageSquare} 
        title="CENTRAL WHATSAPP" 
        subtitle="COMUNICAÇÃO DIRETA E AUTOMATIZADA COM ALUNOS"
        extra={
          <button className="btn-primary flex items-center gap-2 px-5 py-2 rounded-[5px] text-[11px] font-bold uppercase shadow-xl hover:scale-105 transition-all">
            <Layout size={16} /> Configurar Campanhas
          </button>
        }
      />

      <div className="px-4 md:px-6 py-6 space-y-6 max-w-7xl mx-auto w-full fade-slide-up pb-12">
        
        {/* Navigation Tabs */}
        <div className="flex p-1 bg-black/40 rounded-md border border-white/5 w-fit">
          {[
            { id: 'templates', label: 'Templates de Mensagem', icon: FileText },
            { id: 'history', label: 'Histórico de Envios', icon: Clock },
            { id: 'automation', label: 'Automações Ativas', icon: RefreshCcw }
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

        {activeTab === 'templates' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {templates.map(tmpl => (
                <div key={tmpl.id} className="stat-card p-5 rounded-[5px] border border-white/10 group hover:border-white/20 transition-all cursor-pointer">
                   <div className="flex items-center justify-between mb-4">
                      <div className={`p-2 rounded-md bg-app-bg ${tmpl.color}`}>
                        <tmpl.icon size={20} />
                      </div>
                      <span className="text-[9px] font-black text-app-muted uppercase tracking-widest bg-app-bg px-2 py-1 rounded">
                        {tmpl.group}
                      </span>
                   </div>
                   <h4 className="text-sm font-bold text-app mb-2 group-hover:text-primary transition-colors">{tmpl.title}</h4>
                   <p className="text-xs text-app-muted line-clamp-3 leading-relaxed mb-4">
                     "{tmpl.content}"
                   </p>
                   <div className="flex justify-between items-center pt-4 border-t border-white/5">
                      <button className="text-[10px] font-black uppercase text-app-muted hover:text-app transition-colors">Editar Template</button>
                      <button 
                        onClick={() => handleUseTemplate(tmpl)}
                        className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-emerald-500/10 text-emerald-500 text-[10px] font-black uppercase tracking-widest hover:bg-emerald-500/20 transition-all">
                        <Send size={12} /> Usar Agora
                      </button>
                   </div>
                </div>
              ))}
              <div className="border-2 border-dashed border-white/5 rounded-[5px] flex flex-col items-center justify-center p-8 hover:border-white/20 transition-all cursor-pointer group bg-white/5">
                  <Plus size={32} className="text-gray-700 group-hover:text-primary mb-2 transition-all" />
                  <p className="text-xs font-bold text-app-muted uppercase tracking-widest group-hover:text-app">Novo Template</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="glass-card rounded-[24px] border border-white/10 overflow-hidden">
             <div className="p-6 border-b border-white/5 flex flex-col md:flex-row gap-4 justify-between bg-white/5">
                <div className="relative flex-1">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                  <input 
                    className="w-full bg-black/40 border border-white/10 rounded-md pl-10 pr-4 py-2 text-sm text-app"
                    placeholder="Filtrar histórico..."
                  />
                </div>
                <button className="flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold bg-app-bg text-app-muted border border-white/5 hover:text-app transition-all">
                   <Filter size={16} /> Filtros
                </button>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black text-gray-500 uppercase tracking-widest bg-black/40 border-b border-white/5">
                      <th className="px-6 py-4">Destinatário</th>
                      <th className="px-6 py-4">Tipo</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {loading ? (
                       <tr><td colSpan="4" className="py-12 text-center text-app-muted font-medium">Carregando...</td></tr>
                    ) : (history || []).length === 0 ? (
                       <tr><td colSpan="4" className="py-12 text-center text-app-muted font-medium">Nenhum registro encontrado</td></tr>
                    ) : (history || []).map(log => (
                       <tr key={log.id} className="hover:bg-white/5 transition-colors">
                         <td className="px-6 py-4 font-bold text-app text-sm">{log.name}</td>
                         <td className="px-6 py-4">
                           <span className="text-[10px] font-black text-app-muted uppercase bg-app-bg px-2 py-1 rounded">{log.type}</span>
                         </td>
                         <td className="px-6 py-4">
                           <span className="text-[10px] font-black text-emerald-500 uppercase">Enviado</span>
                         </td>
                         <td className="px-6 py-4 text-right text-xs text-gray-400 font-mono">
                           {log.timestamp ? new Date(log.timestamp).toLocaleString('pt-BR') : '--'}
                         </td>
                       </tr>
                    ))}
                  </tbody>
                </table>
             </div>
          </div>
        )}

      </div>
    </div>
  )
}

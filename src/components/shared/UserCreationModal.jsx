import React, { useState } from 'react'
import { 
  X, User, Users, Mail, Shield, Check, Copy, 
  AlertCircle, Info, Search, GraduationCap, 
  ChevronDown, Landmark, Settings, Save, RefreshCw
} from 'lucide-react'
// Hooks para integração com Firebase e controle de UI
import { useSystemUsers } from '../../hooks/useSystemUsers'
import { useStudents } from '../../hooks/useStudents'
import { useHideMobileNav } from '../../hooks/useHideMobileNav'

/**
 * UserCreationModal - Modal Unificado de Gestão de Usuários
 * 
 * Este componente permite criar novos colaboradores ou promover alunos.
 * Implementa a lógica de Single Source of Truth (SSoT) e RBAC (Múltiplos Cargos).
 */
export default function UserCreationModal({ isOpen, onClose }) {
  // Oculta a navegação mobile para evitar conflitos visuais com o modal
  useHideMobileNav(isOpen)
  
  const { createNewUser } = useSystemUsers()
  const { students, deleteStudent } = useStudents()
  
  // Estado inicial do formulário
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    roles: ['aluno'], // Array para suportar múltiplos cargos
    permissions: {
      viewStudents: true,
      editStudents: false,
      deleteStudents: false,
      manageClasses: true,
      manageEvents: false,
      viewFinance: false,
      managePayments: false,
      manageExpenses: false,
      manageUsers: false,
      manageSystem: false,
    }
  })

  // Controla quais categorias de permissão estão abertas (Iniciam fechadas)
  const [expandedCategories, setExpandedCategories] = useState({
    operational: false,
    finance: false,
    system: false
  })

  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [createdPin, setCreatedPin] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  // Filtro de busca para promoção de alunos
  const filteredStudents = studentSearch.length > 1 
    ? students.filter(s => 
        s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.email.toLowerCase().includes(studentSearch.toLowerCase())
      ).slice(0, 5)
    : []

  /** Preenche o formulário ao selecionar um aluno existente */
  const handleSelectStudent = (student) => {
    setFormData(prev => ({
      ...prev,
      name: student.name,
      email: student.email || ''
    }))
    setSelectedStudentId(student.id)
    setStudentSearch('')
  }

  /** Alterna o estado de expansão de uma categoria */
  const toggleCategory = (cat) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  /** Alterna uma permissão individual */
  const handleTogglePermission = (key) => {
    setFormData(prev => ({
      ...prev,
      permissions: { ...prev.permissions, [key]: !prev.permissions[key] }
    }))
  }

  // Mapa de permissões padrão por cargo para preenchimento automático
  const defaultRolePermissions = {
    admin: {
      viewStudents: true, editStudents: true, deleteStudents: true,
      manageClasses: true, manageEvents: true,
      viewFinance: true, managePayments: true, manageExpenses: true,
      manageUsers: true, manageSystem: true
    },
    gestor: {
      viewStudents: true, editStudents: true, deleteStudents: false,
      manageClasses: true, manageEvents: true,
      viewFinance: true, managePayments: true, manageExpenses: true,
      manageUsers: false, manageSystem: false
    },
    professor: {
      viewStudents: true, editStudents: false, deleteStudents: false,
      manageClasses: true, manageEvents: true,
      viewFinance: false, managePayments: false, manageExpenses: false,
      manageUsers: false, manageSystem: false
    },
    aluno: {
      viewStudents: false, editStudents: false, deleteStudents: false,
      manageClasses: false, manageEvents: false,
      viewFinance: false, managePayments: false, manageExpenses: false,
      manageUsers: false, manageSystem: false
    }
  }

  /** Mescla permissões de múltiplos cargos selecionados (União de IDs) */
  const mergePermissions = (selectedRoles) => {
    const merged = { ...defaultRolePermissions.aluno }
    selectedRoles.forEach(roleId => {
      const perms = defaultRolePermissions[roleId]
      if (perms) {
        Object.keys(perms).forEach(key => {
          if (perms[key]) merged[key] = true
        })
      }
    })
    return merged
  }

  /** Gerencia a adição/remoção de cargos no array */
  const handleRoleToggle = (roleId) => {
    setFormData(prev => {
      let newRoles = prev.roles.includes(roleId)
        ? prev.roles.filter(r => r !== roleId)
        : [...prev.roles, roleId]
      
      if (newRoles.length === 0) newRoles = ['aluno']
      
      return {
        ...prev,
        roles: newRoles,
        permissions: mergePermissions(newRoles)
      }
    })
  }

  /** Envia os dados para o Firebase */
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      // Determina papel principal para exibição legada
      const primaryRole = formData.roles.includes('admin') ? 'admin' : 
                         formData.roles.includes('gestor') ? 'gestor' : 
                         formData.roles.includes('professor') ? 'professor' : 'aluno';

      const result = await createNewUser({
        ...formData,
        role: primaryRole,
        roles: formData.roles
      })
      
      // Cleanup: Se era um aluno sendo promovido, removemos da coleção antiga
      if (selectedStudentId && (formData.roles.some(r => ['admin', 'gestor', 'professor'].includes(r)))) {
        try { await deleteStudent(selectedStudentId) } catch (e) { console.warn('Erro ao limpar aluno legado:', e) }
      }
      
      setCreatedPin(result.pin)
    } catch (err) {
      setError('Erro ao processar usuário. O e-mail pode já estar em uso.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  // TELA DE SUCESSO (EXIBIÇÃO DO PIN)
  if (createdPin) {
    return (
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
        <div className="w-full max-w-sm bg-[#111] border border-emerald-500/30 rounded-2xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={32} className="text-emerald-500" strokeWidth={3} />
          </div>
          <h2 className="text-xl font-black text-white mb-2 uppercase tracking-tight">Usuário Pronto!</h2>
          <p className="text-xs text-gray-500 mb-8 leading-relaxed">Passe este PIN único para que o colaborador acesse o sistema.</p>
          
          <div className="bg-black/40 border border-white/5 rounded-2xl p-6 mb-8 relative group">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold mb-2">PIN DE ACESSO</p>
            <p className="text-4xl font-mono font-black text-white tracking-[0.2em]">{createdPin}</p>
            <button onClick={() => navigator.clipboard.writeText(createdPin)} className="absolute top-4 right-4 p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors text-gray-400 hover:text-white">
              <Copy size={16} />
            </button>
          </div>

          <button onClick={() => { setCreatedPin(null); onClose(); }} className="w-full py-4 bg-white text-black rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-gray-100 transition-all active:scale-95">
            Fechar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-lg bg-[#0d0d0d] border border-white/5 sm:rounded-[32px] rounded-t-[32px] shadow-2xl relative flex flex-col h-full sm:h-auto max-h-[92vh] overflow-hidden">
        
        {/* CABEÇALHO FIXO */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-[#0d0d0d] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
              <Shield size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Gestão de Colaboradores</h2>
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Unificação Single Source</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-xl transition-colors text-gray-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* CONTEÚDO COM ROLAGEM */}
          <div className="flex-1 overflow-y-auto p-6 space-y-7 custom-scrollbar">
            {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[10px] uppercase font-bold text-center tracking-widest">{error}</div>}

            {/* BUSCA DE ALUNOS */}
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">Promover um Aluno Existente</label>
              <div className="relative group">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-primary transition-colors" />
                <input 
                  type="text"
                  value={studentSearch}
                  onChange={e => setStudentSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-primary/30 transition-all placeholder:text-gray-700"
                  placeholder="Pesquisar por nome ou e-mail..."
                />
                
                {filteredStudents.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-[#141414] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden divide-y divide-white/5">
                    {filteredStudents.map(student => (
                      <button key={student.id} type="button" onClick={() => handleSelectStudent(student)} className="w-full flex items-center gap-3 p-4 hover:bg-white/5 transition-colors text-left group/item">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover/item:bg-primary group-hover/item:text-black transition-all">
                          <GraduationCap size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-black text-white uppercase tracking-tight">{student.name}</p>
                          <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest">{student.email}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">Nome Completo</label>
                <div className="relative">
                  <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input type="text" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-white/20 transition-all font-medium" placeholder="Nome do colaborador" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">E-mail (Único)</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-white/20 transition-all font-medium" placeholder="email@exemplo.com" />
                </div>
              </div>
            </div>

            {/* SELEÇÃO MÚLTIPLA DE CARGOS */}
            <div className="space-y-3">
              <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">Atribuição de Cargos</label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: 'admin', label: 'Admin', desc: 'Total' },
                  { id: 'gestor', label: 'Gestor', desc: 'Gerência' },
                  { id: 'professor', label: 'Prof.', desc: 'Aulas' },
                  { id: 'aluno', label: 'Aluno', desc: 'Básico' },
                ].map(r => (
                  <button key={r.id} type="button" onClick={() => handleRoleToggle(r.id)} className={`p-2.5 md:p-3 rounded-xl border text-center transition-all relative overflow-hidden group ${formData.roles.includes(r.id) ? 'bg-primary border-primary shadow-lg shadow-primary/10' : 'bg-white/[0.02] border-white/5 hover:bg-white hover:border-white'}`}>
                    <p className={`text-[10px] font-black uppercase tracking-widest ${formData.roles.includes(r.id) ? 'text-white' : 'text-gray-400 group-hover:text-black'}`}>{r.label}</p>
                    <p className={`text-[8px] uppercase font-black tracking-tighter mt-0.5 ${formData.roles.includes(r.id) ? 'text-white/70' : 'text-gray-600 group-hover:text-black/60'}`}>{r.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* PERMISSÕES CATEGORIZADAS (ACCORDIONS) */}
            <div className="space-y-2">
              <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">Configurações de Permissão</label>
              <div className="bg-white/[0.01] border border-white/5 rounded-2xl overflow-hidden divide-y divide-white/5">
                
                {/* --- OPERACIONAL --- */}
                <div className="group/cat">
                  <button type="button" onClick={() => toggleCategory('operational')} className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3">
                      <Users size={14} className={expandedCategories.operational ? 'text-blue-400' : 'text-gray-600'} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${expandedCategories.operational ? 'text-white' : 'text-gray-500'}`}>Operacional & Alunos</span>
                    </div>
                    <ChevronDown size={14} className={`text-gray-600 transition-transform duration-300 ${expandedCategories.operational ? 'rotate-180 text-blue-400' : ''}`} />
                  </button>
                  {expandedCategories.operational && (
                    <div className="px-5 pb-6 pt-2 space-y-4 animate-in fade-in slide-in-from-top-1">
                      {[
                        { k: 'viewStudents', l: 'Visualizar Alunos', d: 'Ver lista e perfis.' },
                        { k: 'editStudents', l: 'Cadastrar/Editar', d: 'Criar e alterar dados.' },
                        { k: 'manageClasses', l: 'Gerenciar Chamadas', d: 'Iniciar aulas e treinos.' },
                        { k: 'manageEvents', l: 'Gerenciar Eventos', d: 'Eventos e graduações.' },
                        { k: 'deleteStudents', l: 'Excluir Registros', d: 'Deletar alunos do sistema.', r: true },
                      ].map(p => (
                        <div key={p.k} className="flex items-center justify-between">
                          <div className="flex-1 pr-6">
                            <p className={`text-[11px] font-bold uppercase tracking-tight ${p.r ? 'text-red-400' : 'text-gray-200'}`}>{p.l}</p>
                            <p className="text-[10px] text-gray-500 font-medium leading-tight">{p.d}</p>
                          </div>
                          <button type="button" onClick={() => handleTogglePermission(p.k)} className={`w-9 h-5 rounded-full relative transition-all ${formData.permissions[p.k] ? (p.r ? 'bg-red-500' : 'bg-primary') : 'bg-gray-800'}`}>
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${formData.permissions[p.k] ? 'translate-x-4' : ''}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* --- FINANCEIRO --- */}
                <div className="group/cat">
                  <button type="button" onClick={() => toggleCategory('finance')} className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3">
                      <Landmark size={14} className={expandedCategories.finance ? 'text-emerald-400' : 'text-gray-600'} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${expandedCategories.finance ? 'text-white' : 'text-gray-500'}`}>Financeiro</span>
                    </div>
                    <ChevronDown size={14} className={`text-gray-600 transition-transform duration-300 ${expandedCategories.finance ? 'rotate-180 text-emerald-400' : ''}`} />
                  </button>
                  {expandedCategories.finance && (
                    <div className="px-5 pb-6 pt-2 space-y-4 animate-in fade-in slide-in-from-top-1">
                      {[
                        { k: 'viewFinance', l: 'Ver Relatórios', d: 'Acesso a lucros e KPIs.' },
                        { k: 'managePayments', l: 'Processar Pagamentos', d: 'Lançar mensalidades.' },
                        { k: 'manageExpenses', l: 'Gerenciar Despesas', d: 'Lançar contas a pagar.' },
                      ].map(p => (
                        <div key={p.k} className="flex items-center justify-between">
                          <div className="flex-1 pr-6">
                            <p className="text-[11px] font-bold uppercase tracking-tight text-gray-200">{p.l}</p>
                            <p className="text-[10px] text-gray-500 font-medium leading-tight">{p.d}</p>
                          </div>
                          <button type="button" onClick={() => handleTogglePermission(p.k)} className={`w-9 h-5 rounded-full relative transition-all ${formData.permissions[p.k] ? 'bg-primary' : 'bg-gray-800'}`}>
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${formData.permissions[p.k] ? 'translate-x-4' : ''}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* --- GESTÃO --- */}
                <div className="group/cat">
                  <button type="button" onClick={() => toggleCategory('system')} className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                    <div className="flex items-center gap-3">
                      <Settings size={14} className={expandedCategories.system ? 'text-purple-400' : 'text-gray-600'} />
                      <span className={`text-[10px] font-black uppercase tracking-widest ${expandedCategories.system ? 'text-white' : 'text-gray-500'}`}>Gestão e Sistema</span>
                    </div>
                    <ChevronDown size={14} className={`text-gray-600 transition-transform duration-300 ${expandedCategories.system ? 'rotate-180 text-purple-400' : ''}`} />
                  </button>
                  {expandedCategories.system && (
                    <div className="px-5 pb-6 pt-2 space-y-4 animate-in fade-in slide-in-from-top-1">
                      {[
                        { k: 'manageUsers', l: 'Gerenciar Equipe', d: 'Criar outros colaboradores.' },
                        { k: 'manageSystem', l: 'Configurar Regras', d: 'Modalidades e graduações.' },
                      ].map(p => (
                        <div key={p.k} className="flex items-center justify-between">
                          <div className="flex-1 pr-6">
                            <p className="text-[11px] font-bold uppercase tracking-tight text-gray-200">{p.l}</p>
                            <p className="text-[10px] text-gray-500 font-medium leading-tight">{p.d}</p>
                          </div>
                          <button type="button" onClick={() => handleTogglePermission(p.k)} className={`w-9 h-5 rounded-full relative transition-all ${formData.permissions[p.k] ? 'bg-primary' : 'bg-gray-800'}`}>
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${formData.permissions[p.k] ? 'translate-x-4' : ''}`} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl">
              <Info size={16} className="text-gray-500 shrink-0" />
              <p className="text-[9px] text-gray-500 leading-tight uppercase font-black">O sistema gerará um PIN único de acesso. O e-mail deve ser autêntico para recuperação futura.</p>
            </div>
          </div>

          {/* RODAPÉ FIXO */}
          <div className="p-6 bg-[#0d0d0d] border-t border-white/5 flex gap-3 shrink-0">
            <button type="button" onClick={onClose} className="flex-1 py-4 md:py-3 rounded-xl bg-white/5 text-gray-400 font-black uppercase tracking-widest text-[10px] hover:bg-white hover:text-black transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={loading} className="flex-[2] py-4 md:py-3 rounded-xl bg-primary text-white font-black uppercase tracking-widest text-[10px] hover:bg-white hover:text-black transition-all flex items-center justify-center gap-2 active:scale-[0.98] shadow-lg shadow-primary/10">
              {loading ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Confirmar Cadastro'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}


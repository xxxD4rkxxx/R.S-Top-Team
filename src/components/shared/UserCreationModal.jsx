import React, { useState } from 'react'
import { X, User, Users, Mail, Shield, Check, Copy, AlertCircle, Info, Search, GraduationCap } from 'lucide-react'
import { useSystemUsers } from '../../hooks/useSystemUsers'
import { useStudents } from '../../hooks/useStudents'

export default function UserCreationModal({ isOpen, onClose }) {
  const { createNewUser } = useSystemUsers()
  const { students, deleteStudent } = useStudents()
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'aluno',
    permissions: {
      // Operacional
      viewStudents: true,
      editStudents: false,
      deleteStudents: false,
      manageClasses: true,
      manageEvents: false,
      // Financeiro
      viewFinance: false,
      managePayments: false,
      manageExpenses: false,
      // Comunicação
      manageWhatsApp: false,
      // Sistema
      manageUsers: false,
      manageSystem: false,
    }
  })

  const [studentSearch, setStudentSearch] = useState('')
  const [selectedStudentId, setSelectedStudentId] = useState(null)
  const [createdPin, setCreatedPin] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const filteredStudents = studentSearch.length > 1 
    ? students.filter(s => 
        s.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
        s.email.toLowerCase().includes(studentSearch.toLowerCase())
      ).slice(0, 5)
    : []

  const handleSelectStudent = (student) => {
    setFormData(prev => ({
      ...prev,
      name: student.name,
      email: student.email || ''
    }))
    setSelectedStudentId(student.id)
    setStudentSearch('')
  }

  if (!isOpen) return null

  const handleTogglePermission = (key) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key]
      }
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const result = await createNewUser(formData)
      
      // Se for gestor ou professor e veio de um aluno, remove da lista de alunos
      if (selectedStudentId && (formData.role === 'gestor' || formData.role === 'professor')) {
        await deleteStudent(selectedStudentId)
      }
      
      setCreatedPin(result.pin)
    } catch (err) {
      setError('Erro ao criar usuário. Tente novamente.')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleCopyPin = () => {
    navigator.clipboard.writeText(createdPin)
    // could add a toast here
  }

  const roles = [
    { id: 'admin', label: 'Administrador', desc: 'Acesso total ao sistema' },
    { id: 'gestor', label: 'Gestor', desc: 'Gerencia alunos e financeiro' },
    { id: 'professor', label: 'Professor', desc: 'Realiza chamadas e vê performance' },
    { id: 'aluno', label: 'Aluno', desc: 'Acesso aos próprios dados' },
  ]

  const handleRoleChange = (roleId) => {
    const defaults = {
      admin: {
        viewStudents: true, editStudents: true, deleteStudents: true,
        manageClasses: true, manageEvents: true,
        viewFinance: true, managePayments: true, manageExpenses: true,
        manageWhatsApp: true, manageUsers: true, manageSystem: true
      },
      gestor: {
        viewStudents: true, editStudents: true, deleteStudents: false,
        manageClasses: true, manageEvents: true,
        viewFinance: true, managePayments: true, manageExpenses: true,
        manageWhatsApp: true, manageUsers: false, manageSystem: false
      },
      professor: {
        viewStudents: true, editStudents: false, deleteStudents: false,
        manageClasses: true, manageEvents: true,
        viewFinance: false, managePayments: false, manageExpenses: false,
        manageWhatsApp: false, manageUsers: false, manageSystem: false
      },
      aluno: {
        viewStudents: false, editStudents: false, deleteStudents: false,
        manageClasses: false, manageEvents: false,
        viewFinance: false, managePayments: false, manageExpenses: false,
        manageWhatsApp: false, manageUsers: false, manageSystem: false
      }
    }

    setFormData(prev => ({
      ...prev,
      role: roleId,
      permissions: defaults[roleId] || prev.permissions
    }))
  }

  if (createdPin) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
        <div className="w-full max-w-sm bg-[#111] border border-emerald-500/30 rounded-3xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Check size={32} className="text-emerald-500" strokeWidth={3} />
          </div>
          <h2 className="text-xl font-display font-bold text-white mb-2">Usuário Criado!</h2>
          <p className="text-sm text-gray-500 mb-8">Passe este PIN único para o usuário realizar o primeiro acesso.</p>
          
          <div className="bg-black/40 border border-white/5 rounded-2xl p-6 mb-8 relative group">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-bold mb-2">PIN DE ACESSO</p>
            <p className="text-4xl font-mono font-black text-white tracking-[0.2em]">{createdPin}</p>
            <button 
              onClick={handleCopyPin}
              className="absolute top-4 right-4 p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors text-gray-400 hover:text-white"
            >
              <Copy size={16} />
            </button>
          </div>

          <button 
            onClick={() => { setCreatedPin(null); onClose(); }}
            className="w-full py-4 bg-white text-black rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-gray-200 transition-all"
          >
            Concluído
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300 overflow-y-auto">
      <div className="w-full max-w-lg bg-[#0d0d0d] border border-white/5 rounded-[32px] shadow-2xl relative overflow-hidden flex flex-col my-8">
        {/* Header */}
        <div className="p-5 border-b border-white/5 flex items-center justify-between bg-[#111]/80 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center border border-primary/10">
              <Shield size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Novo Colaborador</h2>
              <p className="text-[9px] text-gray-500 uppercase tracking-widest font-bold">Configuração de Acessos</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center hover:bg-white/5 rounded-xl transition-colors text-gray-500 hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
          {error && <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs text-center">{error}</div>}

          {/* Student Search / Promotion */}
          <div className="space-y-2">
            <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">Promover Aluno Existente (Opcional)</label>
            <div className="relative group">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600 transition-colors group-focus-within:text-white" />
              <input 
                type="text"
                value={studentSearch}
                onChange={e => setStudentSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-white/30 transition-all placeholder:text-gray-700"
                placeholder="Buscar por nome do aluno..."
              />
              
              {filteredStudents.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-white/5">
                  {filteredStudents.map(student => (
                    <button
                      key={student.id}
                      type="button"
                      onClick={() => handleSelectStudent(student)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-white/5 transition-colors text-left"
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <GraduationCap size={14} />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">{student.name}</p>
                        <p className="text-[9px] text-gray-500 uppercase">{student.belt} &bull; {student.modality}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedStudentId && !studentSearch && (
              <div className="flex items-center justify-between px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg animate-in slide-in-from-top-1">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-tight">Aluno Selecionado</span>
                </div>
                <button 
                  type="button"
                  onClick={() => { setSelectedStudentId(null); setFormData({...formData, name: '', email: ''}); }}
                  className="text-[10px] text-gray-500 hover:text-white uppercase font-bold"
                >
                  Remover
                </button>
              </div>
            )}
          </div>

          <div className="h-px bg-white/5 w-full" />

          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">Nome</label>
              <div className="relative">
                <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                <input 
                  type="text" required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-white/30 transition-all font-medium"
                  placeholder="Nome do usuário"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">E-mail</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                <input 
                  type="email" required
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full pl-10 pr-4 py-2.5 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-white/30 transition-all font-medium"
                  placeholder="exemplo@email.com"
                />
              </div>
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-3">
            <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">Cargo (Nível de Acesso)</label>
            <div className="grid grid-cols-2 gap-3">
              {roles.map(role => (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => handleRoleChange(role.id)}
                  className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden group ${
                    formData.role === role.id 
                    ? 'bg-primary/10 border-primary/30' 
                    : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                  }`}
                >
                  {formData.role === role.id && (
                    <div className="absolute top-0 right-0 p-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_10px_rgba(var(--clr-primary-rgb),0.5)]" />
                    </div>
                  )}
                  <p className={`text-[11px] font-black uppercase tracking-widest mb-1 transition-colors ${formData.role === role.id ? 'text-primary' : 'text-gray-400'}`}>
                    {role.label}
                  </p>
                  <p className="text-[10px] text-gray-500 leading-tight uppercase font-bold opacity-60">{role.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Granular Permissions (Discord Style) */}
          <div className="bg-[#111]/50 border border-white/5 rounded-[24px] overflow-hidden">
            <div className="px-6 py-5 border-b border-white/5 bg-white/[0.02] flex items-center justify-between">
              <h3 className="text-[10px] text-gray-500 uppercase tracking-widest font-bold flex items-center gap-2">
                <Shield size={14} className="text-emerald-500" /> Permissões Específicas
              </h3>
              <span className="text-[9px] text-gray-700 font-bold uppercase">Customização Granular</span>
            </div>
            
            <div className="p-6 space-y-10 group/perms">
              {/* === GRUPO: OPERACIONAL === */}
              <div className="space-y-5">
                <div className="flex items-center gap-2 opacity-40">
                  <Users size={12} className="text-blue-400" />
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">Operacional & Alunos</p>
                </div>
                <div className="space-y-5 ml-1">
                  {[
                    { key: 'viewStudents',   label: 'Visualizar Alunos',    desc: 'Permite ver a lista e perfis dos alunos.' },
                    { key: 'editStudents',   label: 'Cadastrar/Editar',     desc: 'Permite criar novos alunos e alterar dados.' },
                    { key: 'deleteStudents', label: 'Excluir Registros',    desc: 'Permite deletar permanentemente alunos.', danger: true },
                    { key: 'manageClasses',  label: 'Gerenciar Chamadas',   desc: 'Permite iniciar treinos e marcar presença.' },
                    { key: 'manageEvents',   label: 'Gerenciar Eventos',    desc: 'Permite criar eventos e graduações.' },
                  ].map(perm => (
                    <div key={perm.key} className="flex items-center justify-between group/item">
                      <div className="flex-1 pr-4">
                        <p className={`text-sm font-bold transition-colors ${perm.danger ? 'text-red-400 group-hover/item:text-red-300' : 'text-gray-200 group-hover/item:text-primary'}`}>
                          {perm.label}
                        </p>
                        <p className="text-[11px] text-gray-500 leading-relaxed font-medium mt-0.5">{perm.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTogglePermission(perm.key)}
                        className={`w-10 h-6 rounded-full transition-all relative shrink-0 ${formData.permissions[perm.key] ? (perm.danger ? 'bg-red-500' : 'bg-primary') : 'bg-gray-800'}`}
                      >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.permissions[perm.key] ? 'translate-x-4' : ''}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-px bg-white/5" />

              {/* === GRUPO: FINANCEIRO === */}
              <div className="space-y-5">
                <div className="flex items-center gap-2 opacity-40">
                  <Mail size={12} className="text-emerald-400" />
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">Painel Financeiro</p>
                </div>
                <div className="space-y-5 ml-1">
                  {[
                    { key: 'viewFinance',    label: 'Ver KPIs & Lucros',     desc: 'Acesso aos gráficos e balanço financeiro.' },
                    { key: 'managePayments', label: 'Gerenciar Pagamentos',  desc: 'Lançar mensalidades e faturas de alunos.' },
                    { key: 'manageExpenses', label: 'Gerenciar Despesas',    desc: 'Lançar saídas e contas a pagar da academia.' },
                  ].map(perm => (
                    <div key={perm.key} className="flex items-center justify-between group/item">
                      <div className="flex-1 pr-4">
                        <p className="text-sm font-bold text-gray-200 group-hover/item:text-primary transition-colors">{perm.label}</p>
                        <p className="text-[11px] text-gray-500 leading-relaxed font-medium mt-0.5">{perm.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTogglePermission(perm.key)}
                        className={`w-10 h-6 rounded-full transition-all relative shrink-0 ${formData.permissions[perm.key] ? 'bg-primary' : 'bg-gray-800'}`}
                      >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.permissions[perm.key] ? 'translate-x-4' : ''}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="h-px bg-white/5" />

              {/* === GRUPO: CRM & SISTEMA === */}
              <div className="space-y-5">
                <div className="flex items-center gap-2 opacity-40">
                  <Shield size={12} className="text-purple-400" />
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest font-black">Comunicação & Sistema</p>
                </div>
                <div className="space-y-5 ml-1">
                  {[
                    { key: 'manageWhatsApp', label: 'Central WhatsApp',     desc: 'Acesso ao hub de mensagens automáticas.' },
                    { key: 'manageUsers',    label: 'Gerenciar Membros',     desc: 'Permite criar e gerenciar outros colaboradores.' },
                    { key: 'manageSystem',   label: 'Configurar Sistema',    desc: 'Alterar regras de graduação e modalidades.' },
                  ].map(perm => (
                    <div key={perm.key} className="flex items-center justify-between group/item">
                      <div className="flex-1 pr-4">
                        <p className="text-sm font-bold text-gray-200 group-hover/item:text-primary transition-colors">{perm.label}</p>
                        <p className="text-[11px] text-gray-500 leading-relaxed font-medium mt-0.5">{perm.desc}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTogglePermission(perm.key)}
                        className={`w-10 h-6 rounded-full transition-all relative shrink-0 ${formData.permissions[perm.key] ? 'bg-primary' : 'bg-gray-800'}`}
                      >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${formData.permissions[perm.key] ? 'translate-x-4' : ''}`} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>

          {/* Footer Info */}
          <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-2xl">
            <Info size={18} className="text-gray-400 shrink-0" />
            <p className="text-[9px] text-gray-400 leading-relaxed uppercase font-bold tracking-tight">
              O sistema gera um PIN aleatório de 6 dígitos que será exibido na próxima tela. Este PIN substitui a senha convencional para este usuário.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-white text-black rounded-xl font-bold uppercase tracking-widest text-xs hover:bg-gray-200 transition-all flex items-center justify-center gap-2"
          >
            {loading ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : 'Criar e Gerar PIN'}
          </button>
        </form>
      </div>
    </div>
  )
}

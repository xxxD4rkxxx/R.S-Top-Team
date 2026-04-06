import React, { useState, useRef, useEffect } from 'react'
import { 
  X, UserPlus, GraduationCap, Users, 
  Mail, Smartphone, Shield, Info, 
  ChevronDown, Check, Save, Landmark,
  Settings, User, MapPin, Activity,
  PhoneCall, HeartPulse
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStudents } from '../../hooks/useStudents'
import { useModalities } from '../../hooks/useModalities'
import { useHideMobileNav } from '../../hooks/useHideMobileNav'

/**
 * Seletor Customizado Premium (Reutilizado do padrão de Colaboradores)
 */
function CustomSelect({ label, value, onChange, options, disabled }) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOption = options.find(o => o[0] === value) || options[0]

  return (
    <div className="flex flex-col gap-1.5 relative w-full" ref={ref}>
      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="form-input bg-black/40 input-raise text-sm py-2.5 px-4 text-gray-300 font-medium text-left flex justify-between items-center w-full disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 rounded-xl transition-all hover:bg-black/60 focus:ring-1 focus:ring-white/20"
      >
        <span className="truncate">{selectedOption ? selectedOption[1] : '...'}</span>
        <ChevronDown size={14} className={`text-gray-500 transition-transform duration-200 shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-full min-w-[200px] bg-[#0d0d0d] border border-white/10 rounded-2xl z-[100] overflow-hidden shadow-2xl py-2" style={{ animation: 'fadeSlideUp 0.15s ease-out forwards' }}>
          {options.map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => { onChange(v); setIsOpen(false) }}
              className={`w-full text-left px-5 py-3 text-sm transition-colors hover:bg-white/5 ${value === v ? 'text-white bg-white/5 font-bold' : 'text-gray-400 font-medium'}`}
            >
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AddStudentModal({ onClose, onAdd, initialModality = 'Jiu-Jitsu', initialData = null }) {
  const { modalities } = useModalities()
  const activeModalities = (modalities || []).filter(m => m.status === 'ativo')
  
  // Oculta a navegação mobile para evitar conflitos visuais (Padrão SSoT)
  const isMobile = window.innerWidth <= 768
  useHideMobileNav(true)

  const [form, setForm] = useState({
    name: initialData?.name || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    emergency: initialData?.emergency || '',
    medical: initialData?.medical || '',
    belt: initialData?.belt || 'none',
    modality: [initialModality],
    type: 'aluno',
    ageCategory: initialData?.ageCategory || 'Adulto',
    gender: initialData?.gender || 'Masculino',
    parentName: initialData?.parentName || '',
    parentPhone: initialData?.parentPhone || '',
  })

  // Controle de seções expansíveis (Acordeão premium)
  const [expandedSections, setExpandedSections] = useState({
    additional: false,
    parents: false,
  })

  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const hasBelt = form.modality.some(m => m.toLowerCase().includes('jiu') || m.toLowerCase().includes('bjj'))

  const toggleSection = (section) => {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }))
  }

  async function handleSubmit(e) {
    if (e) e.preventDefault()
    if (!form.name.trim()) { setErrorMsg('Nome é obrigatório'); return }
    
    setSaving(true)
    setErrorMsg('')
    try {
      const isVisitor = form.type === 'visitante'
      // Passamos os dados para a função de callback fornecida pelo componente pai
      await onAdd(form, form.modality, { isVisitor, belt: form.belt })
    } catch (err) {
      console.error('Erro ao adicionar aluno:', err)
      setErrorMsg('Erro ao cadastrar. Verifique os dados.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-end md:items-center justify-center p-0 md:p-4">
      {/* Background Dimmer */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/90 backdrop-blur-md"
      />

      {/* Modal / Bottom Sheet Container */}
      <motion.div
        initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-xl md:max-w-2xl bg-[#0a0a0a] border-t md:border border-white/10 rounded-t-[32px] md:rounded-[32px] overflow-hidden flex flex-col max-h-[92vh] md:max-h-[85vh] shadow-[0_-20px_40px_rgba(0,0,0,0.5)]"
      >
        {/* DRAG HANDLE (Mobile Only) */}
        <div className="md:hidden w-12 h-1 bg-white/10 rounded-full mx-auto mt-4 mb-2 shrink-0" />

        {/* CABEÇALHO PREMIUM */}
        <div className="flex items-center justify-between p-6 md:p-8 shrink-0">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
              <GraduationCap size={28} strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight leading-none">Novo Aluno</h3>
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                Matrícula SSoT Unificada
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 text-gray-500 hover:text-white transition-all hover:bg-white/10">
            <X size={24} />
          </button>
        </div>

        {/* CORPO DO MODAL (Scrollable) */}
        <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
          <div className="px-6 md:px-8 space-y-8">
            
            {/* --- SEÇÃO: TIPO DE MATRÍCULA --- */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield size={14} className="text-gray-600" />
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Tipo de Ingresso</label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'aluno', label: 'ALUNO', desc: 'MATRÍCULA REGULAR' },
                  { id: 'visitante', label: 'VISITANTE', desc: 'AULA EXPERIMENTAL' }
                ].map(t => (
                  <button
                    key={t.id} type="button"
                    onClick={() => setForm(f => ({ ...f, type: t.id }))}
                    className={`flex flex-col items-center justify-center py-2.5 md:py-3 px-4 rounded-2xl border transition-all border-dashed ${form.type === t.id ? 'bg-primary border-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)]' : 'bg-white/5 border-white/5 hover:bg-white hover:border-white group'}`}
                  >
                    <span className={`text-[11px] font-black tracking-tighter ${form.type === t.id ? 'text-white' : 'text-white group-hover:text-black'}`}>{t.label}</span>
                    <span className={`text-[8px] font-bold mt-1 tracking-widest ${form.type === t.id ? 'text-white/70' : 'text-gray-500 group-hover:text-black/60'}`}>{t.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* --- SEÇÃO: IDENTIDADE --- */}
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <User size={14} className="text-gray-600" />
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Dados Pessoais</label>
              </div>
              
              <div className="space-y-4">
                <div className="relative group">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-white transition-colors" />
                  <input
                    required placeholder="Nome Completo"
                    value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full bg-black/40 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-white/20 transition-all font-medium"
                  />
                </div>

                {form.type === 'aluno' && (
                  <>
                    <div className="relative group">
                      <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-white transition-colors" />
                      <input
                        type="email" placeholder="E-mail (Para acesso e recuperação)"
                        value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        className="w-full bg-black/40 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-white/20 transition-all font-medium"
                      />
                    </div>

                    <div className="relative group">
                      <Smartphone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-white transition-colors" />
                      <input
                        placeholder="Telefone/WhatsApp"
                        value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        className="w-full bg-black/40 border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white focus:outline-none focus:border-white/20 transition-all font-medium"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {form.type === 'aluno' && (
              <>
                {/* --- SEÇÃO: GRADUAÇÃO E MODALIDADES --- */}
                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <Landmark size={14} className="text-gray-600" />
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500">Graduação e Modalidades</label>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {activeModalities.map(m => {
                      const isSelected = form.modality.includes(m.name)
                      return (
                        <button
                          key={m.id} type="button"
                          onClick={() => setForm(f => ({
                            ...f, 
                            modality: isSelected ? f.modality.filter(item => item !== m.name) : [...f.modality, m.name]
                          }))}
                          className={`flex items-center gap-3 px-5 py-2.5 md:py-3 rounded-2xl border transition-all ${isSelected ? 'bg-primary border-primary text-white font-black' : 'bg-white/5 border-white/5 text-gray-500 font-bold hover:bg-white hover:text-black hover:border-white group'}`}
                        >
                          <Activity size={14} className={isSelected ? 'text-white' : 'text-gray-600 group-hover:text-black'} />
                          <span className="text-[10px] uppercase tracking-widest">{m.name}</span>
                        </button>
                      )
                    })}
                  </div>

                  <div className={`grid grid-cols-1 ${hasBelt ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6`}>
                    <CustomSelect 
                      label="Categoria de Idade"
                      value={form.ageCategory}
                      onChange={v => setForm(f => ({ ...f, ageCategory: v }))}
                      options={[['Adulto', 'Adulto'], ['Juvenil', 'Juvenil'], ['Kids', 'Kids']]}
                    />

                    <CustomSelect 
                      label="Sexo"
                      value={form.gender}
                      onChange={v => setForm(f => ({ ...f, gender: v }))}
                      options={[['Masculino', 'Masculino'], ['Feminino', 'Feminino']]}
                    />
                    
                    {hasBelt && (
                      <CustomSelect 
                        label="Faixa Atual"
                        value={form.belt}
                        onChange={v => setForm(f => ({ ...f, belt: v }))}
                        options={[
                          ['none', 'Sem Faixa'], ['white', 'Branca'], ['blue', 'Azul'], 
                          ['purple', 'Roxa'], ['brown', 'Marrom'], ['black', 'Preta']
                        ]}
                      />
                    )}
                  </div>
                </div>

                {/* --- SEÇÕES EXPANSÍVEIS (ACORDEÃO) --- */}
                <div className="border border-white/5 rounded-[24px] overflow-hidden bg-black/20">
                  
                  {/* RESPONSÁVEIS */}
                  {(form.ageCategory === 'Kids' || form.ageCategory === 'Juvenil') && (
                    <div className="border-b border-white/5">
                      <button type="button" onClick={() => toggleSection('parents')} className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                        <div className="flex items-center gap-3">
                          <Users size={14} className={expandedSections.parents ? 'text-primary' : 'text-gray-600'} />
                          <span className={`text-[10px] font-black uppercase tracking-widest ${expandedSections.parents ? 'text-white' : 'text-gray-500'}`}>Dados do Responsável</span>
                        </div>
                        <ChevronDown size={14} className={`text-gray-600 transition-transform duration-300 ${expandedSections.parents ? 'rotate-180 text-primary' : ''}`} />
                      </button>
                      {expandedSections.parents && (
                        <div className="px-5 pb-6 pt-2 space-y-4 animate-in fade-in slide-in-from-top-1">
                          <div className="relative group">
                            <User size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700" />
                            <input
                              placeholder="Nome do Pai/Mãe"
                              value={form.parentName} onChange={e => setForm(f => ({ ...f, parentName: e.target.value }))}
                              className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-[12px] text-white focus:outline-none"
                            />
                          </div>
                          <div className="relative group">
                            <PhoneCall size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700" />
                            <input
                              placeholder="Telefone de Emergência"
                              value={form.parentPhone} onChange={e => setForm(f => ({ ...f, parentPhone: e.target.value }))}
                              className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-[12px] text-white focus:outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* INFORMAÇÕES MÉDICAS */}
                  <div className="">
                    <button type="button" onClick={() => toggleSection('additional')} className="w-full px-5 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-3">
                        <HeartPulse size={14} className={expandedSections.additional ? 'text-red-400' : 'text-gray-600'} />
                        <span className={`text-[10px] font-black uppercase tracking-widest ${expandedSections.additional ? 'text-white' : 'text-gray-500'}`}>Informações Médicas</span>
                      </div>
                      <ChevronDown size={14} className={`text-gray-600 transition-transform duration-300 ${expandedSections.additional ? 'rotate-180 text-red-400' : ''}`} />
                    </button>
                    {expandedSections.additional && (
                      <div className="px-5 pb-6 pt-2 space-y-4 animate-in fade-in slide-in-from-top-1">
                        <div className="space-y-4">
                          <div className="relative">
                            <Smartphone size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-700" />
                            <input
                              placeholder="Contato de Emergência Extra"
                              value={form.emergency} onChange={e => setForm(f => ({ ...f, emergency: e.target.value }))}
                              className="w-full bg-black/40 border border-white/5 rounded-xl py-3 pl-11 pr-4 text-[12px] text-white focus:outline-none"
                            />
                          </div>
                          <textarea
                            placeholder="Observações Médicas ou Alergias..."
                            value={form.medical} onChange={e => setForm(f => ({ ...f, medical: e.target.value }))}
                            className="w-full bg-black/40 border border-white/5 rounded-xl p-4 text-[12px] text-white focus:outline-none min-h-[80px]"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* INFO BANNER */}
                <div className="flex items-center gap-4 p-5 bg-white/5 border border-white/5 rounded-[24px]">
                  <Settings size={18} className="text-gray-600 shrink-0" />
                  <p className="text-[9px] text-gray-500 font-black uppercase leading-relaxed tracking-wider">
                    O PIN de acesso será gerado automaticamente. O e-mail informado será a chave única para login e histórico financeiro.
                  </p>
                </div>
              </>
            )}
            
            {errorMsg && (
              <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 text-[10px] font-black uppercase text-center animate-pulse tracking-widest">
                {errorMsg}
              </div>
            )}

          </div>
        </div>

        {/* RODAPÉ FIXO (STICKY FOOTER) */}
        <div className="p-6 md:p-7 bg-[#0d0d0d] border-t border-white/5 flex gap-4 shrink-0">
          <button type="button" onClick={onClose} className="flex-1 py-3.5 md:py-3 rounded-2xl bg-white/5 text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-all">
            Cancelar
          </button>
          <button
            onClick={handleSubmit} disabled={saving}
            className="flex-[2] py-3.5 md:py-3 rounded-2xl bg-primary text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-white hover:text-black transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
          >
            {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : 'Confirmar Cadastro'}
          </button>
        </div>
      </motion.div>
      
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  )
}

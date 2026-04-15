import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { 
  X, GraduationCap, Users, 
  Mail, Smartphone, Shield, Info, 
  ChevronDown, Check, Save, Landmark,
  Settings, User, MapPin, Activity,
  PhoneCall, HeartPulse
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useStudents } from '../../hooks/useStudents'
import { useModalities } from '../../hooks/useModalities'
import { useHideMobileNav } from '../../hooks/useHideMobileNav'
import { useAuth } from '../../context/AuthContext'

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
    <div className="flex flex-col gap-1.5 relative w-full font-sans" ref={ref}>
      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1 font-sans">{label}</label>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="form-input bg-black/40 input-raise text-sm py-2.5 px-4 text-gray-300 font-medium text-left flex justify-between items-center w-full disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 rounded-xl transition-all hover:bg-black/60 focus:ring-1 focus:ring-white/20 font-sans"
      >
        <span className="truncate font-sans">{selectedOption ? selectedOption[1] : '...'}</span>
        <ChevronDown size={14} className="text-gray-500 transition-transform duration-200 shrink-0 ml-2" />
      </button>

      {isOpen && !disabled && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-full min-w-[200px] bg-[#0d0d0d] border border-white/10 rounded-2xl z-[100] overflow-hidden shadow-2xl py-2 font-sans">
          {options.map(([v, l]) => (
            <button
              key={v}
              type="button"
              onClick={() => { onChange(v); setIsOpen(false) }}
              className={`w-full text-left px-5 py-3 text-sm transition-colors hover:bg-white/5 font-sans ${value === v ? 'text-white bg-white/5 font-bold' : 'text-gray-400 font-medium'}`}
            >
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AddStudentModal({ isOpen, onClose, onAdd, initialModality = 'Jiu-Jitsu', initialData = null }) {
  const { modalities, loading: loadingModalities } = useModalities()
  const activeModalities = (modalities || []).filter(m => m.status === 'ativo')
  const { effectiveRole } = useAuth()
  
  // Oculta a navegação mobile para evitar conflitos visuais (Padrão SSoT)
  useHideMobileNav(isOpen)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    emergency: '',
    medical: '',
    belt: 'none',
    modality: [initialModality],
    type: 'aluno',
    ageCategory: 'Adulto',
    gender: 'Masculino',
    parentName: '',
    parentPhone: '',
    planValue: '',
  })

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Normalização das modalidades para garantir que seja sempre um array (SSoT)
        let normalizedModalities = []
        if (Array.isArray(initialData.modalities)) {
          normalizedModalities = initialData.modalities
        } else if (Array.isArray(initialData.modality)) {
          normalizedModalities = initialData.modality
        } else if (initialData.modality && typeof initialData.modality === 'string') {
          normalizedModalities = [initialData.modality]
        } else {
          normalizedModalities = [initialModality]
        }

        setForm({
          name: initialData.name || '',
          email: initialData.email || '',
          phone: initialData.phone || '',
          emergency: initialData.emergency || '',
          medical: initialData.medical || '',
          belt: initialData.belt || 'none',
          modality: normalizedModalities,
          type: initialData.type || 'aluno',
          ageCategory: initialData.ageCategory || 'Adulto',
          gender: initialData.gender || 'Masculino',
          parentName: initialData.parentName || '',
          parentPhone: initialData.parentPhone || '',
          planValue: initialData.planValue || '',
        })
      } else {
        setForm({
          name: '', email: '', phone: '', emergency: '', medical: '',
          belt: 'none', modality: [initialModality], type: 'aluno',
          ageCategory: 'Adulto', gender: 'Masculino',
          parentName: '', parentPhone: '',
          planValue: '',
        })
      }
      setErrorMsg('')
    }
  }, [isOpen, initialData, initialModality])

  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  async function handleSubmit(e) {
    if (e) e.preventDefault()
    if (!form.name.trim()) { setErrorMsg('Nome é obrigatório'); return }
    
    setSaving(true)
    setErrorMsg('')
    try {
      const isVisitor = form.type === 'visitante'
      await onAdd(form, form.modality, { isVisitor, belt: form.belt })
      onClose()
    } catch (err) {
      console.error('Erro ao processar aluno:', err)
      setErrorMsg('Erro ao salvar. Verifique se o e-mail já existe.')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        onClick={e => e.stopPropagation()}
        className="modal-content modal-content-bottom-sheet relative max-w-2xl w-full flex flex-col h-[92vh] sm:h-auto sm:max-h-[85vh] overflow-hidden"
      >
        {/* Mobile Drag Handle */}
        <div className="sm:hidden flex justify-center pt-4 pb-2 shrink-0">
          <div className="w-12 h-1.5 bg-white/10 rounded-full" />
        </div>

        {/* CABEÇALHO PREMIUM FIXO */}
        <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
              <GraduationCap size={28} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight leading-none">
                {initialData ? 'Editar Perfil' : 'Novo Aluno'}
              </h2>
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                Matrícula & Cadastro SSoT
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 text-gray-500 hover:text-white transition-all hover:bg-white/10">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 md:p-8 pb-24 space-y-7 custom-scrollbar no-scrollbar">
            {errorMsg && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-[10px] uppercase font-black text-center tracking-widest animate-pulse">
                {errorMsg}
              </div>
            )}

            {/* Dados Básicos */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-3">
                Informações Básicas
                <div className="h-px flex-1 bg-white/5" />
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">Nome Completo</label>
                  <div className="relative">
                    <User size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input 
                      type="text" 
                      required 
                      value={form.name} 
                      onChange={e => setForm({ ...form, name: e.target.value })} 
                      className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-white/20 transition-all font-medium font-sans" 
                      placeholder="Ex: João Silva" 
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">Telefone / WhatsApp</label>
                  <div className="relative">
                    <Smartphone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input 
                      type="text" 
                      value={form.phone} 
                      onChange={e => setForm({ ...form, phone: e.target.value })} 
                      className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-white/20 transition-all font-medium font-sans" 
                      placeholder="(00) 00000-0000" 
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">E-mail de Acesso</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input 
                    type="email" 
                    required 
                    value={form.email} 
                    onChange={e => setForm({ ...form, email: e.target.value })} 
                    className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-white/20 transition-all font-medium font-sans" 
                    placeholder="email@exemplo.com" 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <CustomSelect 
                  label="Gênero" 
                  value={form.gender} 
                  onChange={v => setForm({ ...form, gender: v })} 
                  options={[['Masculino', 'Masculino'], ['Feminino', 'Feminino']]} 
                />
                <CustomSelect 
                  label="Categoria de Idade" 
                  value={form.ageCategory} 
                  onChange={v => setForm({ ...form, ageCategory: v })} 
                  options={[['Adulto', 'Adulto'], ['Juvenil', 'Juvenil'], ['Kids', 'Kids']]} 
                />
              </div>
            </div>

            {/* Treino e Graduação */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-3">
                Treino e Graduação
                <div className="h-px flex-1 bg-white/5" />
              </h3>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">Modalidades Inscritas</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {loadingModalities ? (
                      // Skeleton Loading
                      Array(3).fill(0).map((_, i) => (
                        <div key={i} className="h-10 rounded-xl bg-white/5 animate-pulse" />
                      ))
                    ) : (
                      activeModalities.map(m => {
                        const isSelected = form.modality.includes(m.id);
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => {
                              const newMods = isSelected
                                ? form.modality.filter(id => id !== m.id)
                                : [...form.modality, m.id];
                              setForm({ ...form, modality: newMods });
                            }}
                            className={`flex items-center justify-center px-3 py-2.5 rounded-xl border text-[11px] font-bold uppercase tracking-wider transition-all
                              ${isSelected 
                                ? 'bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                                : 'bg-white/[0.02] border-white/10 text-gray-500 hover:border-white/20 hover:bg-white/[0.04]'}`}
                          >
                            {m.name}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {activeModalities.some(m => form.modality.includes(m.id) && m.hasBelt !== false) && (
                    <CustomSelect 
                      label="Faixa Atual" 
                      value={form.belt} 
                      onChange={v => setForm({ ...form, belt: v })} 
                      options={[
                        ['none', 'Sem Faixa'],
                        ['white', 'Branca'],
                        ['blue', 'Azul'],
                        ['purple', 'Roxa'],
                        ['brown', 'Marrom'],
                        ['black', 'Preta'],
                        ['kids-white', 'Branca (Kids)'],
                        ['gray', 'Cinza (Kids)'],
                        ['yellow', 'Amarela (Kids)'],
                        ['orange', 'Laranja (Kids)'],
                        ['green', 'Verde (Kids)'],
                      ]} 
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Responsáveis (Condicional) */}
            {(form.ageCategory === 'Kids' || form.ageCategory === 'Juvenil') && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <h3 className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] flex items-center gap-3">
                  Responsável Legal
                  <div className="h-px flex-1 bg-blue-500/10" />
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">Nome do Responsável</label>
                    <input 
                      type="text" 
                      value={form.parentName} 
                      onChange={e => setForm({ ...form, parentName: e.target.value })} 
                      className="w-full px-4 py-3 bg-blue-500/5 border border-blue-500/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500/30 transition-all font-medium" 
                      placeholder="Nome do pai/mãe" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">WhatsApp Responsável</label>
                    <input 
                      type="text" 
                      value={form.parentPhone} 
                      onChange={e => setForm({ ...form, parentPhone: e.target.value })} 
                      className="w-full px-4 py-3 bg-blue-500/5 border border-blue-500/10 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500/30 transition-all font-medium font-sans" 
                      placeholder="(00) 00000-0000" 
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Saúde e Emergência */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-red-500/70 uppercase tracking-[0.2em] flex items-center gap-3">
                Saúde e Segurança
                <div className="h-px flex-1 bg-red-500/5" />
              </h3>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">Contato de Emergência</label>
                  <div className="relative">
                    <PhoneCall size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input 
                      type="text" 
                      value={form.emergency} 
                      onChange={e => setForm({ ...form, emergency: e.target.value })} 
                      className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-white/20 transition-all font-medium font-sans" 
                      placeholder="Nome e Telefone" 
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">Restrições Médicas/Alergias</label>
                  <div className="relative">
                    <HeartPulse size={14} className="absolute left-3.5 top-4 text-gray-600" />
                    <textarea 
                      value={form.medical} 
                      onChange={e => setForm({ ...form, medical: e.target.value })} 
                      className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-white/20 transition-all font-medium min-h-[100px] outline-none" 
                      placeholder="Ex: Alergia a iodo, problemas no joelho, etc." 
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl">
              <Info size={16} className="text-gray-500 shrink-0" />
              <p className="text-[9px] text-gray-500 leading-tight uppercase font-black">Certifique-se de que os dados de e-mail e telefone estão corretos para a sincronização da matrícula.</p>
            </div>

            {/* Configurações Financeiras (Apenas Gestores/Admin) */}
            {(effectiveRole === 'admin' || effectiveRole === 'gestor') && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-3 font-sans">
                  <Landmark size={14} />
                  Contrato e Financeiro
                  <div className="h-px flex-1 bg-emerald-500/10" />
                </h3>
                
                <div className="space-y-1.5">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1 font-sans">
                    Valor da Mensalidade
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 font-black text-sm font-sans">R$</span>
                    <input 
                      type="number"
                      step="0.01" 
                      value={form.planValue} 
                      onChange={e => setForm({ ...form, planValue: e.target.value })} 
                      className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/30 transition-all font-medium font-sans" 
                      placeholder="Ex: 150.00" 
                    />
                  </div>
                  <p className="text-[9px] text-gray-600 font-black uppercase tracking-widest mt-1 px-1 font-sans">
                    * Este valor será utilizado para gerar as cobranças mensais automáticas.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* RODAPÉ PREMIUM (STICKY) */}
          <div className="p-6 md:p-8 bg-[#0d0d0d] border-t border-white/5 flex gap-4 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 rounded-2xl bg-white/5 text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-[2] py-4 rounded-2xl bg-primary text-white text-[11px] font-black uppercase tracking-[0.2em] shadow-2xl hover:bg-white hover:text-black transition-all active:scale-[0.98] flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <><Save size={16}/> {initialData ? 'Salvar Alterações' : 'Confirmar Cadastro'}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

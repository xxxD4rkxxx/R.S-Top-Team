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

export default function AddStudentModal({ isOpen, onClose, onAdd, initialModality = 'Jiu Jitsu', initialData = null }) {
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
    initialPaymentStatus: 'pending', // 'paid' ou 'pending'
  })

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Normalização das modalidades (SSoT) e correção de "Jiu-Jitsu" órfão
        let normalizedModalities = []
        const raw = Array.isArray(initialData.modalities) ? initialData.modalities :
          Array.isArray(initialData.modality) ? initialData.modality :
            (initialData.modality ? [initialData.modality] : [initialModality])

        // Converte "Jiu-Jitsu" para "Jiu Jitsu" e remove duplicatas
        normalizedModalities = Array.from(new Set(raw.map(m => m === 'Jiu-Jitsu' ? 'Jiu Jitsu' : m)))

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
          initialPaymentStatus: 'pending', // Editando não gera nova cobrança automática
        })
      } else {
        setForm({
          name: '', email: '', phone: '', emergency: '', medical: '',
          belt: 'none', modality: [initialModality], type: 'aluno',
          ageCategory: 'Adulto', gender: 'Masculino',
          parentName: '', parentPhone: '',
          planValue: '',
          initialPaymentStatus: 'pending',
        })
      }
      setErrorMsg('')
    }
  }, [isOpen, initialData, initialModality])

  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // 💰 CÁLCULO DINÂMICO DE MENSALIDADE
  useEffect(() => {
    if (!initialData && modalities && form.modality.length > 0) {
      let total = 0;
      const cat = (form.ageCategory || 'Adulto').toLowerCase();

      form.modality.forEach(modId => {
        const mod = modalities.find(m => m.id === modId || m.name === modId);
        if (mod && mod.pricing && mod.pricing[cat] && mod.pricing[cat].enabled) {
          total += Number(mod.pricing[cat].price) || 0;
        }
      });

      // Converte para o formato de centavos que o input espera (ex: 150 -> "15000")
      if (total > 0) {
        setForm(prev => ({ ...prev, planValue: (total * 100).toString() }));
      }
    }
  }, [form.modality, form.ageCategory, modalities, initialData]);

  async function handleSubmit(e) {
    if (e) e.preventDefault()
    if (!form.name.trim()) { setErrorMsg('Nome é obrigatório'); return }

    setSaving(true)
    setErrorMsg('')
    try {
      const isVisitor = form.type === 'visitante'

      // Normaliza o valor para decimal antes de enviar (SSoT)
      const normalizedForm = {
        ...form,
        planValue: form.planValue ? (Number(form.planValue.replace(/\D/g, '')) / 100).toFixed(2) : ''
      }

      // Se for edição, não enviamos o status de pagamento (não queremos duplicar cobranças)
      if (initialData) {
        delete normalizedForm.initialPaymentStatus;
      }

      await onAdd(normalizedForm, form.modality, { isVisitor, belt: form.belt })
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
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      exit={{ opacity: 0 }} 
      className="modal-backdrop" 
      onClick={onClose}
    >
      <motion.div
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragEnd={(e, info) => {
          if (info.offset.y > 100 || info.velocity.y > 500) {
            onClose();
          }
        }}
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
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
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-300 shadow-lg"
              style={{ 
                backgroundColor: (() => {
                  const selectedBelt = Array.from(modalities || []).flatMap(m => 
                    m.beltSystem?.categories?.flatMap(c => c.belts || []) || []
                  ).find(b => b.name === form.belt);
                  return selectedBelt?.color ? `${selectedBelt.color}15` : 'color-mix(in srgb, var(--clr-primary) 15%, transparent)';
                })(),
                borderColor: (() => {
                  const selectedBelt = Array.from(modalities || []).flatMap(m => 
                    m.beltSystem?.categories?.flatMap(c => c.belts || []) || []
                  ).find(b => b.name === form.belt);
                  return selectedBelt?.color ? `${selectedBelt.color}30` : 'color-mix(in srgb, var(--clr-primary) 30%, transparent)';
                })(),
              }}
            >
              <GraduationCap 
                size={28} 
                strokeWidth={2.5}
                style={{ 
                  color: (() => {
                    const selectedBelt = Array.from(modalities || []).flatMap(m => 
                      m.beltSystem?.categories?.flatMap(c => c.belts || []) || []
                    ).find(b => b.name === form.belt);
                    return selectedBelt?.color ? selectedBelt.color : 'var(--clr-primary)';
                  })()
                }}
              />
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
                      options={(() => {
                        const baseOptions = [['none', 'Sem Faixa']];
                        const dynamicBelts = [];
                        const currentCategoryName = (form.ageCategory || 'Adulto').toLowerCase();

                        // Percorre as modalidades selecionadas no formulário
                        form.modality.forEach(modId => {
                          const mod = modalities?.find(m => m.id === modId || m.name === modId);
                          
                          // Acessa a nova estrutura beltSystem -> categories
                          if (mod?.beltSystem?.categories) {
                            const category = mod.beltSystem.categories.find(c => 
                              c.name.toLowerCase() === currentCategoryName || 
                              c.id.toLowerCase() === currentCategoryName
                            );

                            if (category?.belts) {
                              category.belts.forEach(belt => {
                                if (!dynamicBelts.find(db => db[0] === belt.name)) {
                                  dynamicBelts.push([belt.name, belt.name.toUpperCase()]);
                                }
                              });
                            }
                          }
                        });

                        return dynamicBelts.length > 0 ? [...baseOptions, ...dynamicBelts] : baseOptions;
                      })()}
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1 font-sans">
                      Valor da Mensalidade
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={form.planValue ? (() => {
                          const clean = String(form.planValue).replace(/\D/g, '')
                          const amount = (Number(clean) / 100)
                          return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                        })() : ''}
                        onChange={e => {
                          const clean = e.target.value.replace(/\D/g, '')
                          setForm({ ...form, planValue: clean })
                        }}
                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500/30 transition-all font-medium font-sans"
                        placeholder="R$ 0,00"
                      />
                    </div>
                    <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest mt-1 px-1 font-sans">
                      * Valor sugerido baseado nas modalidades selecionadas.
                    </p>
                  </div>

                  {!initialData && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1 font-sans">
                        Status do Primeiro Pagamento
                      </label>
                      <div className="flex gap-2 p-1 bg-black/40 border border-white/5 rounded-2xl">
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, initialPaymentStatus: 'paid' })}
                          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${form.initialPaymentStatus === 'paid'
                            ? 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20'
                            : 'text-gray-600 hover:text-gray-400'
                            }`}
                        >
                          Pago
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, initialPaymentStatus: 'pending' })}
                          className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${form.initialPaymentStatus === 'pending'
                            ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                            : 'text-gray-600 hover:text-gray-400'
                            }`}
                        >
                          Pendente
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {!initialData && (
                  <div className="flex items-start gap-3 p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                    <Info size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-[9px] text-emerald-500/70 leading-tight uppercase font-black">
                      Ao salvar, uma cobrança será gerada automaticamente na aba de finanças para o mês atual.
                    </p>
                  </div>
                )}
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
                <><Save size={16} /> {initialData ? 'Salvar Alterações' : 'Confirmar Cadastro'}</>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>,
    document.body
  )
}

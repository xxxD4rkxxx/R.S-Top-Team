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
 * Seletor Customizado Premium
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

export default function AddStudentModal({ isOpen, onClose, onAdd, initialModality = 'Jiu Jitsu', initialData = null, initialType = 'aluno' }) {
  const { modalities, loading: loadingModalities } = useModalities()
  const activeModalities = (modalities || []).filter(m => m.status === 'ativo')
  const { effectiveRole } = useAuth()

  useHideMobileNav(isOpen)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    emergency: '',
    medical: '',
    belt: 'none',
    modality: [initialModality],
    type: initialType,
    ageCategory: 'Adulto',
    gender: 'Masculino',
    parentName: '',
    parentPhone: '',
    planValue: '',
    initialPaymentStatus: 'pending',
  })

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        let normalizedModalities = []
        const raw = Array.isArray(initialData.modalities) ? initialData.modalities :
          Array.isArray(initialData.modality) ? initialData.modality :
            (initialData.modality ? [initialData.modality] : [initialModality])

        normalizedModalities = Array.from(new Set(raw.map(m => m === 'Jiu-Jitsu' ? 'Jiu Jitsu' : m)))

        setForm({
          name: initialData.name || '',
          email: initialData.email || '',
          phone: initialData.phone || '',
          emergency: initialData.emergency || '',
          medical: initialData.medical || '',
          belt: initialData.belt || 'none',
          modality: normalizedModalities,
          type: initialData.isPromoting ? 'aluno' : (initialData.roles?.visitante ? 'visitante' : 'aluno'),
          ageCategory: initialData.ageCategory || 'Adulto',
          gender: initialData.gender || 'Masculino',
          parentName: initialData.parentName || '',
          parentPhone: initialData.parentPhone || '',
          planValue: initialData.planValue || '',
          initialPaymentStatus: 'pending',
        })
      } else {
        setForm({
          name: '', email: '', phone: '', emergency: '', medical: '',
          belt: 'none', modality: [initialModality], type: initialType,
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

  useEffect(() => {
    if (!initialData && modalities && form.modality.length > 0 && form.type === 'aluno') {
      let total = 0;
      const cat = (form.ageCategory || 'Adulto').toLowerCase();

      form.modality.forEach(modId => {
        const mod = modalities.find(m => m.id === modId || m.name === modId);
        if (mod && mod.pricing && mod.pricing[cat] && mod.pricing[cat].enabled) {
          total += Number(mod.pricing[cat].price) || 0;
        }
      });

      if (total > 0) {
        setForm(prev => ({ ...prev, planValue: (total * 100).toString() }));
      }
    }
  }, [form.modality, form.ageCategory, modalities, initialData, form.type]);

  // 🥋 Lógica de Faixas Extraída (Evita IIFE no JSX)
  const getBeltOptions = () => {
    const baseOptions = [['none', 'Sem Faixa']];
    const dynamicBelts = [];
    const currentCategoryName = (form.ageCategory || 'Adulto').toLowerCase();

    form.modality.forEach(modId => {
      const mod = modalities?.find(m => m.id === modId || m.name === modId);
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
  };

  async function handleSubmit(e) {
    if (e) e.preventDefault()
    if (!form.name.trim()) { setErrorMsg('Nome é obrigatório'); return }

    setSaving(true)
    setErrorMsg('')
    try {
      const isVisitor = form.type === 'visitante'
      const normalizedForm = {
        ...form,
        planValue: form.planValue ? (Number(form.planValue.replace(/\D/g, '')) / 100).toFixed(2) : ''
      }

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
        layout
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        onClick={e => e.stopPropagation()}
        className="modal-content modal-content-bottom-sheet relative max-w-2xl w-full flex flex-col h-[92vh] sm:h-auto sm:max-h-[85vh] sm:min-h-[500px] overflow-hidden"
      >
        {/* Mobile Drag Handle */}
        <div className="sm:hidden flex justify-center pt-4 pb-2 shrink-0">
          <div className="w-12 h-1.5 bg-white/10 rounded-full" />
        </div>

        {/* CABEÇALHO */}
        <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center border border-white/10 bg-primary/10 shadow-lg">
              {form.type === 'visitante' ? (
                <User size={28} strokeWidth={2.5} className="text-primary" />
              ) : (
                <GraduationCap size={28} strokeWidth={2.5} className="text-primary" />
              )}
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight leading-none">
                {initialData?.isPromoting ? 'Promover para Aluno' : 
                 initialData ? (form.type === 'visitante' ? 'Perfil Visitante' : 'Perfil Aluno') : 
                 (form.type === 'visitante' ? 'Novo Visitante' : 'Novo Aluno')}
              </h2>
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                <span className="w-1 h-1 rounded-full animate-pulse bg-primary" />
                {form.type === 'visitante' ? 'Aula Experimental / Lead' : 'Matrícula & Cadastro SSoT'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 text-gray-500 hover:text-white transition-all hover:bg-white/10">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden bg-black/20">
          <div className="flex-1 overflow-y-auto p-6 md:p-8 pb-24 space-y-7 custom-scrollbar no-scrollbar scroll-smooth">
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

              <div className="pt-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-1 mb-2 block">Tipo de Perfil</label>
                <div className="p-1 bg-black/40 border border-white/5 rounded-2xl flex gap-1">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: 'aluno' })}
                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-2 ${form.type === 'aluno' ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-transparent text-gray-500 border-transparent hover:text-gray-300'}`}
                  >
                    <GraduationCap size={14} /> Aluno
                  </button>
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, type: 'visitante' })}
                    className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border flex items-center justify-center gap-2 ${form.type === 'visitante' ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20' : 'bg-transparent text-gray-500 border-transparent hover:text-gray-300'}`}
                  >
                    <User size={14} /> Visitante
                  </button>
                </div>
              </div>

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
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1 font-sans">Telefone / WhatsApp</label>
                  <div className="relative">
                    <Smartphone size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input
                      type="text"
                      required
                      value={form.phone}
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-white/20 transition-all font-medium font-sans"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                </div>
              </div>

              {form.type === 'aluno' && (
                <>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1 font-sans">E-mail de Acesso</label>
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
                </>
              )}
            </div>

            {/* Treino */}
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-3">
                Treino {form.type === 'aluno' && 'e Graduação'}
                <div className="h-px flex-1 bg-white/5" />
              </h3>

              <div className="space-y-6">
                <div className="space-y-3">
                  <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">Modalidades {form.type === 'aluno' ? 'Inscritas' : 'de Interesse'}</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {loadingModalities ? (
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
                              const newMods = isSelected ? form.modality.filter(id => id !== m.id) : [...form.modality, m.id];
                              setForm({ ...form, modality: newMods });
                            }}
                            className={`flex items-center justify-center px-3 py-2.5 rounded-xl border text-[11px] font-bold uppercase tracking-wider transition-all ${isSelected ? 'bg-primary/20 border-primary text-primary' : 'bg-white/[0.02] border-white/10 text-gray-500'}`}
                          >
                            {m.name}
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>

                {form.type === 'aluno' && activeModalities.some(m => form.modality.includes(m.id) && m.hasBelt !== false) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CustomSelect
                      label="Faixa Atual"
                      value={form.belt}
                      onChange={v => setForm({ ...form, belt: v })}
                      options={getBeltOptions()}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Seções Adicionais para Alunos */}
            {form.type === 'aluno' && (
              <>
                {(form.ageCategory === 'Kids' || form.ageCategory === 'Juvenil') && (
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-3">
                      Responsável Legal
                      <div className="h-px flex-1 bg-primary/10" />
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">Nome do Responsável</label>
                        <input
                          type="text"
                          value={form.parentName}
                          onChange={e => setForm({ ...form, parentName: e.target.value })}
                          className="w-full px-4 py-3 bg-primary/5 border border-primary/10 rounded-xl text-sm text-white focus:outline-none focus:border-primary/30 transition-all font-medium"
                          placeholder="Nome do pai/mãe"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1 font-sans">WhatsApp Responsável</label>
                        <input
                          type="text"
                          value={form.parentPhone}
                          onChange={e => setForm({ ...form, parentPhone: e.target.value })}
                          className="w-full px-4 py-3 bg-primary/5 border border-primary/10 rounded-xl text-sm text-white focus:outline-none focus:border-primary/30 transition-all font-medium font-sans"
                          placeholder="(00) 00000-0000"
                        />
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] flex items-center gap-3">
                    Saúde e Segurança
                    <div className="h-px flex-1 bg-primary/5" />
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
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">Restrições Médicas</label>
                      <div className="relative">
                        <HeartPulse size={14} className="absolute left-3.5 top-4 text-gray-600" />
                        <textarea
                          value={form.medical}
                          onChange={e => setForm({ ...form, medical: e.target.value })}
                          className="w-full pl-10 pr-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-white/20 transition-all font-medium min-h-[100px] outline-none"
                          placeholder="Ex: Alergias, problemas no joelho..."
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            {form.type === 'aluno' && (effectiveRole === 'admin' || effectiveRole === 'gestor') && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-3">
                  <Landmark size={14} />
                  Contrato e Financeiro
                  <div className="h-px flex-1 bg-emerald-500/10" />
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">Valor Mensalidade</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={form.planValue ? (Number(form.planValue) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : ''}
                        onChange={e => setForm({ ...form, planValue: e.target.value.replace(/\D/g, '') })}
                        className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-xl text-sm text-white outline-none focus:border-emerald-500/30 transition-all"
                        placeholder="R$ 0,00"
                      />
                    </div>
                  </div>

                  {!initialData && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">Pagamento Inicial</label>
                      <div className="flex gap-2 p-1 bg-black/40 border border-white/5 rounded-2xl">
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, initialPaymentStatus: 'paid' })}
                          className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${form.initialPaymentStatus === 'paid' ? 'bg-emerald-500 text-black' : 'text-gray-600'}`}
                        >
                          Pago
                        </button>
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, initialPaymentStatus: 'pending' })}
                          className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${form.initialPaymentStatus === 'pending' ? 'bg-primary text-white' : 'text-gray-600'}`}
                        >
                          Pendente
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Banner Visitante */}
            {form.type === 'visitante' && (
              <div className="p-5 bg-primary/5 border border-primary/10 rounded-2xl flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <User size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-[10px] text-primary font-black uppercase tracking-widest mb-1">Status: Visitante Experimental</p>
                  <p className="text-[9px] text-primary/70 leading-tight uppercase font-medium">O registro será salvo como lead experimental sem cobranças automáticas.</p>
                </div>
              </div>
            )}
          </div>

          {/* RODAPÉ */}
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
              className="flex-[2] py-4 rounded-2xl bg-primary text-white text-[10px] font-black uppercase tracking-[0.2em] hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save size={16} />
                  {initialData ? 'Salvar Alterações' : 'Confirmar Cadastro'}
                </>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>,
    document.body
  )
}

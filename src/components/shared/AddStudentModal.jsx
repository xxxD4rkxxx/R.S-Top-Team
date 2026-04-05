// Resumo: Modal para cadastrar novo aluno ou visitante, com seleção de modalidade e faixa (Jiu-Jitsu).
import React, { useState, useRef, useEffect } from 'react'
import { X, UserPlus, Camera, RefreshCw, Trash2, Check, User, Info, Smartphone, AlertCircle, ChevronDown } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { beltConfig } from '../../data/beltConfig'
import { useModalities } from '../../hooks/useModalities'
import { motion, AnimatePresence } from 'framer-motion'

const BELTS = ['none', 'white', 'blue', 'purple', 'brown', 'black']

function CustomSelect({ label, value, onChange, options }) {
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
      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="form-input bg-black/40 input-raise text-sm py-2.5 px-4 text-gray-300 font-medium text-left flex justify-between items-center w-full border border-white/10 rounded-xl transition-all hover:bg-black/60 focus:ring-1 focus:ring-white/20"
      >
        <span className="truncate">{selectedOption ? selectedOption[1] : '...'}</span>
        <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
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
  const { setMobileOpen, setIsMobileNavHidden } = useApp()
  const activeModalities = (modalities || []).filter(m => m.status === 'ativo')

  // Fechar sidebar no mobile quando abrir o modal e esconder navegação inferior
  useEffect(() => {
    setMobileOpen(false)
    setIsMobileNavHidden(true)
    return () => setIsMobileNavHidden(false)
  }, [setMobileOpen, setIsMobileNavHidden])

  const [form, setForm] = useState({
    name: initialData?.name || '',
    email: initialData?.email || '',
    phone: initialData?.phone || '',
    emergency: initialData?.emergency || '',
    medical: initialData?.medical || '',
    belt: initialData?.belt || 'none',
    modality: [initialModality], // Inicia com a modalidade atual em um array
    type: 'aluno',
    ageCategory: initialData?.ageCategory || 'Adulto',
    gender: initialData?.gender || 'Masculino',
    parentName: initialData?.parentName || '',
    parentPhone: initialData?.parentPhone || '',
  })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Camera State
  const [showCamera, setShowCamera] = useState(false)
  const [photoPreview, setPhotoPreview] = useState(initialData?.photo || null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)

  const startCamera = async () => {
    setShowCamera(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      })
      if (videoRef.current) videoRef.current.srcObject = stream
    } catch (err) {
      console.error('Erro ao acessar câmera:', err)
      alert('Não foi possível acessar a câmera.')
      setShowCamera(false)
    }
  }

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks()
      tracks.forEach(track => track.stop())
      videoRef.current.srcObject = null
    }
    setShowCamera(false)
  }

  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current
      const canvas = canvasRef.current
      const context = canvas.getContext('2d')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      context.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg')
      setPhotoPreview(dataUrl)
      setForm(prev => ({ ...prev, photo: dataUrl }))
      stopCamera()
    }
  }

  function validate() {
    const e = {}
    if (!form.name.trim()) e.name = 'Nome é obrigatório'
    if (form.type === 'aluno' && !form.email.trim()) e.email = 'Email é obrigatório'
    if (!form.modality?.length) e.modality = 'Escolha pelo menos uma modalidade'
    if (form.ageCategory === 'Kids' || form.ageCategory === 'Juvenil') {
      if (form.type === 'aluno') {
        if (!form.parentName.trim()) e.parentName = 'Nome do responsável obrigatório'
        if (!form.parentPhone.trim()) e.parentPhone = 'Telefone do responsável obrigatório'
      }
    }
    return e
  }

  async function handleSubmit(evt) {
    evt.preventDefault()
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    const isVisitor = form.type === 'visitante'
    setSaving(true)
    setErrorMsg('')
    try {
      const hasBJJ = form.modality.some(m => m.toLowerCase().includes('jiu') || m.toLowerCase().includes('bjj'))
      const belt = hasBJJ ? form.belt : 'none'
      await onAdd({ ...form, photo: photoPreview }, form.modality, { isVisitor, belt })
    } catch (err) {
      console.error('Erro ao adicionar', err)
      setErrorMsg('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const isVisitor = form.type === 'visitante'

  return (
    <div className="modal-backdrop z-[150]" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-content overflow-hidden flex flex-col">
        {/* Mobile Drag Handle */}
        <div className="md:hidden flex justify-center pt-4 pb-2">
          <div className="w-12 h-1.5 bg-white/10 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
              <UserPlus size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-white uppercase tracking-tight">Novo Aluno</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">Gestão de Matrícula</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-gray-600 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto no-scrollbar p-4 md:p-6 space-y-6 md:space-y-8 pb-32">
          <form id="add-student-form" onSubmit={handleSubmit} className="space-y-8">
            
            {/* Tipo de Matrícula FIRST */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Tipo de Matrícula</label>
              <div className="flex gap-3">
                {['aluno', 'visitante'].map(t => (
                  <button
                    key={t} type="button"
                    onClick={() => setForm(f => ({ ...f, type: t }))}
                    className={`flex-1 py-4 rounded-xl border text-xs font-black uppercase transition-all ${form.type === t ? 'bg-white border-white text-black shadow-xl ring-2 ring-white/10' : 'bg-white/[0.03] border-white/5 text-gray-500'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Photo Section */}
            {!isVisitor && (
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-32 h-32 rounded-2xl bg-white/[0.03] border border-white/10 overflow-hidden flex items-center justify-center group shadow-2xl">
                  {photoPreview ? (
                    <img src={photoPreview} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Camera size={40} className="text-white/10" />
                  )}
                  <button type="button" onClick={startCamera} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[10px] font-black uppercase text-white tracking-widest">
                    {photoPreview ? 'Trocar' : 'Tirar Foto'}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Modalidades (Selecione 1 ou mais)</label>
                <div className="flex gap-2 flex-wrap">
                  {activeModalities.map(m => {
                    const isSelected = (form.modality || []).includes(m.name)
                    return (
                      <button
                        key={m.id} type="button"
                        onClick={() => {
                          setForm(f => {
                            const current = f.modality || []
                            const next = current.includes(m.name)
                              ? current.filter(x => x !== m.name)
                              : [...current, m.name]
                            return { ...f, modality: next }
                          })
                        }}
                        className={`px-4 py-3 rounded-xl border text-[10px] font-black uppercase transition-all flex items-center gap-2 ${isSelected ? 'bg-primary border-primary text-white shadow-xl shadow-primary/20' : 'bg-white/[0.03] border-white/5 text-gray-500'}`}
                      >
                        {isSelected && <Check size={12} strokeWidth={3} />}
                        {m.name}
                      </button>
                    )
                  })}
                </div>
                {errors.modality && <p className="text-red-500 text-[10px] font-bold uppercase mt-1 px-1">{errors.modality}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Nome Completo</label>
                <div className="relative">
                  <input
                    required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Ex: Rafael Mendes"
                    className="w-full bg-white/[0.05] border border-white/10 rounded-xl py-3 md:py-4 pl-12 pr-4 text-white text-sm focus:border-primary/50"
                  />
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                </div>
                {errors.name && <p className="text-red-500 text-[10px] font-bold uppercase tracking-widest mt-1 px-2">{errors.name}</p>}
              </div>

              {!isVisitor && (
                <>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Telefone</label>
                    <div className="relative">
                      <input
                        value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="(11) 99999-9999"
                        className="w-full bg-white/[0.05] border border-white/10 rounded-xl py-3 md:py-4 pl-12 pr-4 text-white text-sm focus:border-primary/50"
                      />
                      <Smartphone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Email</label>
                    <input
                      type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="aluno@email.com"
                      className="w-full bg-white/[0.05] border border-white/10 rounded-xl py-4 px-6 text-white text-sm focus:border-primary/50"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {!isVisitor && (
                  <CustomSelect
                    label="Categoria"
                    value={form.ageCategory}
                    onChange={v => setForm(f => ({ ...f, ageCategory: v }))}
                    options={[
                      ['Adulto', 'Adulto'],
                      ['Juvenil', 'Juvenil'],
                      ['Kids', 'Kids']
                    ]}
                  />
                )}

                <div className="space-y-2 w-full">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Sexo</label>
                  <div className="flex gap-2">
                    {['Masculino', 'Feminino'].map(g => (
                      <button
                        key={g} type="button"
                        onClick={() => setForm(f => ({ ...f, gender: g }))}
                        className={`flex-1 py-4 rounded-xl border text-[10px] font-black uppercase transition-all ${form.gender === g ? 'bg-white border-white text-black' : 'bg-white/[0.03] border-white/5 text-gray-500'}`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Belt Selection for BJJ - Only show for ALUNO and if BJJ is selected */}
              {!isVisitor && form.modality.some(m => m.toLowerCase().includes('jiu') || m.toLowerCase().includes('bjj')) && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 px-1">Graduação Atual</label>
                  <div className="grid grid-cols-3 gap-2">
                    {BELTS.map(b => (
                      <button
                        key={b} type="button"
                        onClick={() => setForm(f => ({ ...f, belt: b }))}
                        className={`py-3 md:py-4 rounded-xl border text-[10px] font-black uppercase transition-all ${form.belt === b ? 'bg-primary border-primary text-white' : 'bg-white/[0.03] border-white/5 text-gray-500'}`}
                      >
                        {beltConfig[b]?.label || b}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Responsibility Info for Kids */}
            {!isVisitor && (form.ageCategory === 'Kids' || form.ageCategory === 'Juvenil') && (
              <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 space-y-4">
                <div className="flex items-center gap-2 text-primary font-black text-[10px] uppercase tracking-widest">
                  <Info size={14} /> Dados do Responsável
                </div>
                <input
                  placeholder="Nome do Pai/Mãe" value={form.parentName} onChange={e => setForm(f => ({ ...f, parentName: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white text-xs"
                />
                <input
                  placeholder="Telefone Responsável" value={form.parentPhone} onChange={e => setForm(f => ({ ...f, parentPhone: e.target.value }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl p-4 text-white text-xs"
                />
              </div>
            )}
          </form>
        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-white/5 bg-[#0d0d0d] flex gap-4">
          <button type="button" onClick={onClose} className="flex-1 py-5 rounded-xl bg-white/[0.03] border border-white/5 text-[10px] font-black uppercase tracking-widest text-gray-500">Cancelar</button>
          <button
            form="add-student-form" type="submit" disabled={saving}
            className="flex-[2] py-5 rounded-xl bg-primary text-white text-[10px] font-black uppercase tracking-widest shadow-2xl shadow-primary/30 active:scale-95 disabled:opacity-50"
          >
            {saving ? 'Registrando...' : 'Finalizar Cadastro'}
          </button>
        </div>

        {/* Camera Modal Portal Overlay */}
        <AnimatePresence>
          {showCamera && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[2000] bg-black flex flex-col items-center justify-center p-6">
              <div className="w-full max-w-sm aspect-[3/4] rounded-2xl overflow-hidden bg-gray-900 border border-white/10 relative">
                <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="hidden" />
                <button type="button" onClick={stopCamera} className="absolute top-6 right-6 w-12 h-12 rounded-2xl bg-black/40 backdrop-blur-md text-white flex items-center justify-center"><X size={24} /></button>
              </div>
              <div className="mt-12 flex flex-col items-center gap-6">
                <button type="button" onClick={takePhoto} className="w-20 h-20 rounded-full bg-white border-[6px] border-white/20 active:scale-90 transition-all shadow-2xl" />
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Toque para capturar</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {errorMsg && (
          <div className="absolute top-4 left-4 right-4 bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-500 text-[10px] font-bold uppercase flex items-center gap-2">
            <AlertCircle size={14} /> {errorMsg}
          </div>
        )}
      </div>
    </div>
  )
}

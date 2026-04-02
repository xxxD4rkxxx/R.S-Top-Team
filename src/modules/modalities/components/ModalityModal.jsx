import React, { useState, useEffect } from 'react'
import { X, Save, Layers, Plus, Edit2, Trash2, Calendar, Clock, Users as UsersIcon, ChevronDown } from 'lucide-react'
import { useSystemUsers } from '../../../hooks/useSystemUsers'

export default function ModalityModal({ 
  isOpen, onClose, onSave, editingModality = null,
  onAddClass, onEditClass, onDeleteClass
}) {
  const { users: staffMembers } = useSystemUsers()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('ativo')

  // Initial Class State
  const [includeClass, setIncludeClass] = useState(false)
  const [className, setClassName] = useState('')
  const [professor, setProfessor] = useState('')
  const [selectedDays, setSelectedDays] = useState([])
  const [startTime, setStartTime] = useState('08:00')
  const [endTime, setEndTime] = useState('09:00')
  const [capacity, setCapacity] = useState(20)
  const [showProfessors, setShowProfessors] = useState(false)

  const days = [
    { id: 'seg', label: 'SEG' },
    { id: 'ter', label: 'TER' },
    { id: 'qua', label: 'QUA' },
    { id: 'qui', label: 'QUI' },
    { id: 'sex', label: 'SEX' },
    { id: 'sab', label: 'SÁB' },
    { id: 'dom', label: 'DOM' },
  ]

  useEffect(() => {
    if (editingModality) {
      setName(editingModality.name || '')
      setDescription(editingModality.description || '')
      setStatus(editingModality.status || 'ativo')
    } else {
      setName('')
      setDescription('')
      setStatus('ativo')
      setIncludeClass(true) // Start with class section open for new modalities
      setClassName('Geral')
      setProfessor('')
      setSelectedDays(['seg', 'ter', 'qua', 'qui', 'sex'])
      setStartTime('08:00')
      setEndTime('09:00')
      setCapacity(20)
    }
  }, [editingModality, isOpen])

  if (!isOpen) return null

  const toggleDay = (dayId) => {
    setSelectedDays(prev => 
      prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    
    const modalityData = { name, description, status }
    
    if (includeClass && !editingModality) {
      modalityData.initialClass = {
        name: className,
        professor,
        diasSemana: selectedDays,
        horarioInicio: startTime,
        horarioFim: endTime,
        capacidade: Number(capacity),
        status: 'ativo'
      }
    }

    onSave(modalityData)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="w-full max-w-4xl bg-[#0d0d0d] border-t md:border border-white/10 rounded-t-[32px] md:rounded-2xl overflow-hidden shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-500 flex flex-col max-h-[92vh] md:max-h-[85vh]">
        {/* Mobile Drag Handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 bg-white/10 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-6 md:p-8 border-b border-white/5 bg-[#111]/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-xl">
              <Layers size={24} />
            </div>
            <div>
              <h2 className="text-xl font-display font-black text-white uppercase tracking-tight">
                {editingModality ? 'Editar Modalidade' : 'Nova Modalidade'}
              </h2>
              <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Configurações Gerais</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors text-gray-500 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex flex-col md:flex-row overflow-hidden flex-1">
          {/* Main Form */}
          <form onSubmit={handleSubmit} className={`p-6 md:p-8 space-y-6 overflow-y-auto no-scrollbar ${editingModality ? 'md:w-1/2 md:border-r border-white/5' : 'w-full'}`}>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 px-1">NOME DA MODALIDADE</label>
                <input 
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Jiu-Jitsu, Muay Thai..."
                  className="w-full bg-[#111] border border-white/5 rounded-lg px-6 py-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all font-medium placeholder:text-gray-700"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 px-1">DESCRIÇÃO (OPCIONAL)</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Breve resumo sobre a modalidade..."
                  rows={3}
                  className="w-full bg-[#111] border border-white/5 rounded-lg px-6 py-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all font-medium placeholder:text-gray-700 resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 px-1">STATUS</label>
                <div className="flex gap-4">
                  {['ativo', 'inativo'].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all ${
                        status === s 
                        ? 'bg-white border-white text-black shadow-[0_0_20px_rgba(255,255,255,0.1)]' 
                        : 'bg-[#111] border-white/5 text-gray-600 hover:border-white/10 hover:text-gray-400'
                      }`}
                    >
                      {s === 'ativo' ? 'Ativo' : 'Inativo'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          
            {!editingModality && (
              <div className="pt-6 border-t border-white/5 space-y-6">
                <div className="flex items-center justify-between group cursor-pointer" onClick={() => setIncludeClass(!includeClass)}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl transition-all ${includeClass ? 'bg-primary/10 text-primary' : 'bg-white/5 text-gray-600'}`}>
                      <Plus size={18} />
                    </div>
                    <div>
                      <h4 className="text-[10px] font-black uppercase tracking-widest text-white">Adicionar Primeiro Horário</h4>
                      <p className="text-[9px] text-gray-600 font-bold uppercase mt-0.5">Configurar turma imediatamente</p>
                    </div>
                  </div>
                  <div className={`w-10 h-6 rounded-full p-1 transition-colors relative ${includeClass ? 'bg-primary' : 'bg-white/10'}`}>
                    <div className={`w-4 h-4 rounded-full bg-white transition-all shadow-md ${includeClass ? 'translate-x-4' : 'translate-x-0'}`} />
                  </div>
                </div>

                {includeClass && (
                  <div className="space-y-6 animate-in slide-in-from-top-4 duration-300">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 px-1 flex items-center gap-2">
                          <UsersIcon size={12} /> NOME DA TURMA
                        </label>
                        <input 
                          type="text"
                          value={className}
                          onChange={(e) => setClassName(e.target.value)}
                          placeholder="Ex: Iniciante, Noite..."
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-6 py-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all font-medium placeholder:text-gray-800"
                        />
                      </div>
                      <div className="space-y-2 relative">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 px-1 flex items-center gap-2">
                          <GraduationCap size={12} /> PROFESSOR
                        </label>
                        <div 
                          onClick={() => setShowProfessors(!showProfessors)}
                          className="w-full bg-black/40 border border-white/5 rounded-lg px-6 py-4 text-sm text-white flex items-center justify-between cursor-pointer hover:border-white/10 transition-all"
                        >
                          <span className={professor ? 'text-white' : 'text-gray-700'}>
                            {professor || 'Selecione...'}
                          </span>
                          <ChevronDown size={14} className={`text-gray-600 transition-transform ${showProfessors ? 'rotate-180' : ''}`} />
                        </div>
                        {showProfessors && (
                          <div className="absolute top-full left-0 w-full mt-2 bg-[#111] border border-white/10 rounded-xl py-2 shadow-2xl z-[60] max-h-48 overflow-y-auto no-scrollbar">
                            {staffMembers.filter(s => s.role === 'professor' || s.role === 'admin').map(staff => (
                              <button
                                key={staff.id}
                                type="button"
                                onClick={() => { setProfessor(staff.name); setShowProfessors(false) }}
                                className="w-full text-left px-4 py-2.5 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:bg-primary/10 hover:text-primary transition-all flex items-center justify-between"
                              >
                                {staff.name}
                                <span className="opacity-30 text-[8px]">{staff.role}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 px-1 flex items-center gap-2">
                        <Calendar size={12} /> DIAS DA SEMANA
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {days.map(day => (
                          <button
                            key={day.id}
                            type="button"
                            onClick={() => toggleDay(day.id)}
                            className={`flex-1 min-w-[60px] py-3.5 rounded-xl text-[9px] font-black uppercase transition-all border ${
                              selectedDays.includes(day.id)
                              ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-105'
                              : 'bg-white/5 border-white/5 text-gray-600 hover:border-white/10'
                            }`}
                          >
                            {day.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 px-1 flex items-center gap-2">
                          <Clock size={12} /> HORÁRIO INÍCIO
                        </label>
                        <input 
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-6 py-4 text-sm text-white focus:outline-none"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 px-1 flex items-center gap-2">
                          <Clock size={12} /> HORÁRIO FIM
                        </label>
                        <input 
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-6 py-4 text-sm text-white focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 px-1 flex items-center gap-2">
                         <UsersIcon size={12} /> CAPACIDADE MÁXIMA
                      </label>
                      <input 
                        type="number"
                        value={capacity}
                        onChange={(e) => setCapacity(e.target.value)}
                        className="w-full bg-black/40 border border-white/5 rounded-xl px-6 py-4 text-sm text-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="pt-8 flex gap-3">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-3 text-sm font-bold text-gray-500 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-white rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 active:scale-95 group"
              >
                <Save size={18} strokeWidth={2.5} className="group-hover:rotate-12 transition-transform" />
                {editingModality ? 'Salvar Alterações' : 'Criar Modalidade'}
              </button>
            </div>
          </form>

          {/* Classes Section (Only if editing) */}
          {editingModality && (
            <div className="md:w-1/2 p-6 md:p-8 bg-black/20 overflow-y-auto no-scrollbar space-y-6 border-t border-white/5 md:border-t-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">Turmas da Modalidade</h3>
                  <p className="text-[9px] text-gray-600 uppercase font-bold mt-1">{editingModality.turmas?.length || 0} Turmas registradas</p>
                </div>
                <button 
                  type="button"
                  onClick={() => onAddClass(editingModality.id)}
                  className="flex items-center gap-2 p-3 bg-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-lg"
                >
                  <Plus size={14} /> Adicionar
                </button>
              </div>

              <div className="space-y-3">
                {!editingModality.turmas || editingModality.turmas.length === 0 ? (
                  <div className="py-12 text-center border border-dashed border-white/5 rounded-xl">
                    <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-gray-700">Nenhuma turma</p>
                  </div>
                ) : (
                  editingModality.turmas.map(turma => (
                    <div key={turma.id} className="p-4 bg-[#111] border border-white/5 rounded-xl flex items-center justify-between group/class hover:border-white/10 transition-all">
                      <div className="flex items-center gap-3">
                        <div className={`w-1.5 h-1.5 rounded-full ${turma.status === 'ativo' ? 'bg-emerald-500' : 'bg-gray-600'}`} />
                        <div>
                          <h5 className="text-sm font-bold text-white uppercase">{turma.name}</h5>
                          <div className="flex items-center gap-2 mt-1">
                            <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">{turma.professor || 'Sem Professor'}</p>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {turma.diasSemana?.map(day => (
                              <span key={day} className="px-2 py-0.5 bg-white/5 text-[8px] font-black uppercase tracking-tighter text-gray-500 rounded-md">{day}</span>
                            ))}
                            <span className="ml-2 px-2 py-0.5 border border-white/5 text-[8px] font-black text-primary uppercase rounded-md">{turma.horarioInicio} - {turma.horarioFim}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          type="button"
                          onClick={() => onEditClass(editingModality.id, turma)}
                          className="p-2 hover:bg-white/5 text-gray-500 hover:text-white rounded-lg transition-all"
                        >
                          <Edit2 size={12} />
                        </button>
                        <button 
                          type="button"
                          onClick={() => onDeleteClass(editingModality.id, turma.id)}
                          className="p-2 hover:bg-red-500/10 text-gray-500 hover:text-red-500 rounded-lg transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

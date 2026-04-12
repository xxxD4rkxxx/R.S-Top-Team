// RESUMO: Modal de inclusão e edição de Turmas (Horários).
// Define o professor responsável, horários de início e fim, dias da semana e capacidade máxima.
// Vinculado a uma modalidade específica.
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Save, GraduationCap, Clock, Users, Calendar, Layers, Hash, CircleDot } from 'lucide-react'
import { useHideMobileNav } from '../../../hooks/useHideMobileNav'
import { useSystemUsers } from '../../../hooks/useSystemUsers'
import { useModalities } from '../../../hooks/useModalities'

const DAYS = [
  { id: 'seg', label: 'Seg' },
  { id: 'ter', label: 'Ter' },
  { id: 'qua', label: 'Qua' },
  { id: 'qui', label: 'Qui' },
  { id: 'sex', label: 'Sex' },
  { id: 'sab', label: 'Sáb' },
  { id: 'dom', label: 'Dom' }
]

export default function ClassModal({ isOpen, onClose, onSave, editingClass = null, modalityId }) {
  useHideMobileNav(isOpen)
  const { users } = useSystemUsers()

  const { modalities } = useModalities()
  const [name, setName] = useState('')
  const [selectedModalityId, setSelectedModalityId] = useState('')
  const [professorId, setProfessorId] = useState('')
  const [diasSemana, setDiasSemana] = useState([])
  const [horarioInicio, setHorarioInicio] = useState('08:00')
  const [horarioFim, setHorarioFim] = useState('09:00')
  const [capacidade, setCapacidade] = useState(20)
  const [status, setStatus] = useState('ativo')

  useEffect(() => {
    if (editingClass) {
      setName(editingClass.name || '')
      setProfessorId(editingClass.professorId || '')
      setDiasSemana(editingClass.diasSemana || [])
      setHorarioInicio(editingClass.horarioInicio || '08:00')
      setHorarioFim(editingClass.horarioFim || '09:00')
      setCapacidade(editingClass.capacidade || 20)
      setStatus(editingClass.status || 'ativo')
    } else {
      setName('')
      setProfessorId('')
      setDiasSemana([])
      setHorarioInicio('08:00')
      setHorarioFim('09:00')
      setCapacidade(20)
      setStatus('ativo')
    }
  }, [editingClass, isOpen])

  if (!isOpen) return null

  const toggleDay = (dayId) => {
    setDiasSemana(prev => 
      prev.includes(dayId) ? prev.filter(d => d !== dayId) : [...prev, dayId]
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (diasSemana.length === 0) {
      alert('Selecione pelo menos um dia da semana')
      return
    }
    const finalModalityId = modalityId || selectedModalityId
    if (!finalModalityId) {
      alert('Selecione uma modalidade')
      return
    }
    onSave({ 
      name, 
      modalityId: finalModalityId,
      professorId, 
      diasSemana, 
      horarioInicio, 
      horarioFim, 
      capacidade: Number(capacidade), 
      status 
    })
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center p-0 md:p-4">
      <div 
        className="absolute inset-0 bg-black/80 backdrop-blur-md animate-in fade-in duration-300"
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-2xl bg-[#0d0d0d] border-t md:border border-white/10 rounded-t-[32px] md:rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom md:zoom-in-95 duration-500 max-h-[92vh] flex flex-col">
        {/* Mobile Drag Handle */}
        <div className="md:hidden flex justify-center pt-4 pb-2">
          <div className="w-12 h-1.5 bg-white/10 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-6 md:p-8 border-b border-white/5 bg-[#111]/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 text-primary rounded-2xl">
              <GraduationCap size={24} />
            </div>
            <div>
              <h2 className="text-xl font-black text-white uppercase tracking-tight">
                {editingClass ? 'Editar Turma' : 'Nova Turma'}
              </h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Configurações de Horário</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-white/5 rounded-xl transition-colors text-gray-500 hover:text-white"
          >
            <X size={24} />
          </button>
        </div>

        {/* Form Body and Footer Wrapper */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
          {/* Scrollable Content */}
          <div className="p-6 md:p-8 space-y-6 md:space-y-8 overflow-y-auto no-scrollbar flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Seleção de Modalidade (apenas se não houver modalityId fixo) */}
              {!modalityId && !editingClass && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 px-1 flex items-center gap-2">
                    <Layers size={12} /> MODALIDADE
                  </label>
                  <select 
                    required
                    value={selectedModalityId}
                    onChange={(e) => setSelectedModalityId(e.target.value)}
                    className="w-full bg-[#111] border border-white/5 rounded-xl px-6 py-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all font-medium appearance-none"
                  >
                    <option value="">Selecione...</option>
                    {modalities.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Nome da Turma */}
              <div className={`space-y-2 ${(!modalityId && !editingClass) ? '' : 'md:col-span-1'}`}>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 px-1 flex items-center gap-2">
                   <Hash size={12} /> NOME DA TURMA
                </label>
                <input 
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Geral, Avançado..."
                  className="w-full bg-[#111] border border-white/5 rounded-xl px-6 py-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all font-medium"
                />
              </div>

              {/* Professor */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 px-1 flex items-center gap-2">
                  <GraduationCap size={12} /> PROFESSOR RESPONSÁVEL
                </label>
                <select 
                  required
                  value={professorId}
                  onChange={(e) => setProfessorId(e.target.value)}
                  className="w-full bg-[#111] border border-white/5 rounded-xl px-6 py-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all font-medium appearance-none"
                >
                  <option value="">Selecione...</option>
                  {(users || []).filter(u => u.role === 'professor' || u.role === 'admin').map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Dias da Semana */}
              <div className="md:col-span-2 space-y-4">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 px-1 flex items-center gap-2">
                  <Calendar size={12} /> DIAS DA SEMANA
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {DAYS.map(day => (
                    <button
                      key={day.id}
                      type="button"
                      onClick={() => toggleDay(day.id)}
                      className={`py-3.5 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${
                        diasSemana.includes(day.id) 
                        ? 'bg-primary border-primary text-black shadow-lg shadow-primary/20 scale-[1.02]' 
                        : 'bg-[#111] border-white/5 text-gray-500 hover:border-white/10 hover:text-gray-300'
                      }`}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Horários */}
              <div className="grid grid-cols-2 gap-4 md:col-span-2">
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 px-1 flex items-center gap-2">
                    <Clock size={12} /> INÍCIO
                  </label>
                  <input 
                    type="time"
                    required
                    value={horarioInicio}
                    onChange={(e) => setHorarioInicio(e.target.value)}
                    className="w-full bg-[#111] border border-white/5 rounded-xl px-6 py-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all font-medium"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 px-1 flex items-center gap-2">
                    <Clock size={12} /> FIM
                  </label>
                  <input 
                    type="time"
                    required
                    value={horarioFim}
                    onChange={(e) => setHorarioFim(e.target.value)}
                    className="w-full bg-[#111] border border-white/5 rounded-xl px-6 py-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all font-medium"
                  />
                </div>
              </div>

              {/* Capacidade e Status */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 px-1 flex items-center gap-2">
                  <Users size={12} /> LIMITE DE ALUNOS
                </label>
                <input 
                  type="number"
                  required
                  min="1"
                  value={capacidade}
                  onChange={(e) => setCapacidade(e.target.value)}
                  className="w-full bg-[#111] border border-white/5 rounded-xl px-6 py-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all font-medium"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 px-1 flex items-center gap-2">
                  <CircleDot size={12} /> STATUS
                </label>
                <select 
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full bg-[#111] border border-white/5 rounded-xl px-6 py-4 text-sm text-white focus:outline-none focus:border-primary/50 transition-all font-medium appearance-none"
                >
                  <option value="ativo">Ativo</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
            </div>
          </div>

          {/* Fixed Action Footer */}
          <div className="p-6 border-t border-white/5 bg-[#0d0d0d] flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 text-sm font-bold text-gray-500 hover:text-white transition-colors bg-white/5 rounded-2xl"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-2 py-4 bg-primary text-black rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20 active:scale-95 group px-6"
            >
              <Save size={18} strokeWidth={2.5} />
              {editingClass ? 'Salvar' : 'Criar'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

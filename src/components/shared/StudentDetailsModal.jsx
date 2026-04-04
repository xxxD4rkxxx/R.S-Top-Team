import React, { useState } from 'react'
import { X, Mail, Phone, AlertCircle, HeartPulse, Calendar, Edit2, Save, Users, Smartphone, AlertTriangle } from 'lucide-react'
import { beltConfig } from '../../data/beltConfig'
import { useAttendanceAlerts } from '../../hooks/useAttendanceAlerts'

const AssiduityCard = ({ student }) => {
  const { status, lastAttendance, monthlyCount, isLoading } = useAttendanceAlerts(student.id, student.createdAt)

  if (isLoading) return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-white/10 pb-2">Status de Assiduidade</h3>
      <div className="animate-pulse bg-white/5 h-24 rounded-xll border border-white/10" />
    </div>
  )

  const statusConfig = {
    active: { label: 'Ativo', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    warning:  { label: 'Em Alerta',         color: 'text-amber-500',  bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    critical: { label: 'Risco de Abandono', color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20' },
    error:    { label: 'Erro',              color: 'text-gray-400',   bg: 'bg-gray-400/10',    border: 'border-gray-400/20' }
  }

  const current = statusConfig[status] || statusConfig.active
  // Meta de 12 aulas por mês (3x por semana)
  const progress = Math.min((monthlyCount / 12) * 100, 100)

  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-white/10 pb-2">Status de Assiduidade</h3>
      <div className={`p-4 rounded-xll border ${current.border} ${current.bg} space-y-4 shadow-lg backdrop-blur-sm transition-all hover:scale-[1.01]`}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${status === 'active' ? 'bg-emerald-500' : status === 'warning' ? 'bg-amber-500' : 'bg-red-600'}`} />
            <span className={`text-sm font-black uppercase tracking-wider ${current.color}`}>{current.label}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <Calendar size={12} />
            <span className="text-[10px] font-medium">Última aula: {lastAttendance ? (typeof lastAttendance.toDate === 'function' ? lastAttendance.toDate().toLocaleDateString('pt-BR') : new Date(lastAttendance).toLocaleDateString('pt-BR')) : 'Nunca'}</span>
          </div>
        </div>

        <div className="space-y-2.5">
          <div className="flex justify-between text-[11px] font-bold">
            <span className="text-gray-400 uppercase tracking-wider">Frequência Mensal</span>
            <span className="text-white bg-white/10 px-2 py-0.5 rounded-md">{monthlyCount} / 12 aulas</span>
          </div>
          <div className="h-2.5 bg-black/40 rounded-full overflow-hidden border border-white/5 relative">
            <div 
              className={`h-full transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(0,0,0,0.5)] ${status === 'active' ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : status === 'warning' ? 'bg-gradient-to-r from-yellow-700 to-yellow-500' : 'bg-gradient-to-r from-rose-900 to-rose-600'}`} 
              style={{ width: `${progress}%` }} 
            />
          </div>
          {status !== 'active' && (
            <div className="flex items-center gap-2 pt-1">
              <AlertTriangle size={12} className={current.color} />
              <p className={`text-[10px] font-medium ${current.color}`}>
                {status === 'warning' ? 'Aluno sem presença há mais de 2 semanas.' : 'Aluno sem presença há mais de 30 dias. Recomenda-se contato.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function StudentDetailsModal({ student, onClose, onUpdate }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorAlert, setErrorAlert] = useState('')
  const [formData, setFormData] = useState(() => ({
    name: student?.name || '',
    email: student?.email || '',
    phone: student?.phone || '',
    emergency: student?.emergency || '',
    medical: student?.medical || '',
    belt: student?.belt || 'white',
    stripes: student?.stripes || 0,
    ageCategory: student?.ageCategory || 'Adulto',
    gender: student?.gender || 'Masculino',
    parentName: student?.parentName || '',
    parentPhone: student?.parentPhone || '',
  }))

  if (!student) return null;

  const {
    modality, modalities = [],
    isVisitor, createdAt, lastAttendanceAt
  } = student;

  const bgClass = beltConfig[formData.belt]?.bgClass || 'belt-white'
  const textColor = beltConfig[formData.belt]?.textColor || '#000'
  const primaryMod = modality || modalities[0] || 'Não informada'
  
  function formatDate(d) {
    if (!d) return 'Não registrada'
    if (typeof d === 'string') return new Date(d).toLocaleDateString('pt-BR')
    if (d.toDate) return d.toDate().toLocaleDateString('pt-BR')
    if (d instanceof Date) return d.toLocaleDateString('pt-BR')
    return 'Data inválida'
  }

  function handleChange(field, value) {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave() {
    if (!onUpdate) return

    if (!formData.name.trim() || !formData.email.trim() || !formData.phone.trim()) {
      setErrorAlert('Atenção: Nome, E-mail e Telefone não podem ficar em branco!')
      setTimeout(() => setErrorAlert(''), 3500)
      return
    }

    setIsSaving(true)
    try {
      await onUpdate(student.id, formData)
      setIsEditing(false)
      // The local student object will be updated via the firestore snapshot!
    } catch(err) {
      console.error(err)
      alert("Falha ao salvar. Verifique a conexão.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content overflow-hidden flex flex-col max-h-[90vh] fade-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Mobile Drag Handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 bg-white/10 rounded-full" />
        </div>
        <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/10" style={{ background: 'rgba(255,255,255,0.03)' }}>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            Detalhes do Aluno
            {isVisitor && <span className="text-[10px] bg-blue-500/20 text-blue-400 px-2 py-1 rounded-md border border-blue-500/30 shadow-lg shadow-blue-500/10 uppercase font-black">VISITANTE</span>}
          </h2>
          <div className="flex items-center gap-2">
            {!isEditing && onUpdate && (
              <button 
                onClick={() => setIsEditing(true)} 
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold text-gray-300 bg-white/5 hover:bg-white/10 transition-colors border border-white/10"
              >
                <Edit2 size={14} /> Editar
              </button>
            )}
            <button onClick={onClose} className="p-2 text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 rounded-lg">
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="p-4 md:p-6 overflow-y-auto space-y-6">
          {errorAlert && (
            <div className="bg-red-500/20 text-red-400 p-3 rounded-xll border border-red-500/30 flex items-center gap-2 text-sm font-bold animate-pulse shadow-lg">
              <AlertTriangle size={16} />
              {errorAlert}
            </div>
          )}

          {/* Header Info */}
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 shrink-0 rounded-full flex items-center justify-center font-bold text-xl shadow-lg ring-2 ring-white/10 ${student.photo ? '' : bgClass}`} style={{ color: student.photo ? 'inherit' : textColor }}>
              {student.photo ? (
                <img src={student.photo} alt={formData.name} className="w-full h-full rounded-full object-cover" />
              ) : (
                student.initials || formData.name.charAt(0) || 'A'
              )}
            </div>
            <div className="min-w-0 flex-1">
              {isEditing ? (
                <input 
                  value={formData.name} 
                  onChange={e => handleChange('name', e.target.value)}
                  className="w-full bg-black/40 border border-white/20 rounded px-2 py-1 text-white font-bold"
                  placeholder="Nome do aluno"
                />
              ) : (
                <p className="text-xl font-bold text-white truncate">{formData.name}</p>
              )}
              
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className="text-xs font-semibold px-2 py-1 rounded-md border border-white/10 text-gray-300" style={{ background: 'rgba(255,255,255,0.05)' }}>
                  {primaryMod}
                </span>
                
                {isEditing ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <select 
                      value={formData.ageCategory} 
                      onChange={e => handleChange('ageCategory', e.target.value)}
                      className="bg-black border border-white/20 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="Adulto">Adulto</option>
                      <option value="Juvenil">Juvenil</option>
                      <option value="Kids">Kids</option>
                    </select>
                    <select 
                      value={formData.gender} 
                      onChange={e => handleChange('gender', e.target.value)}
                      className="bg-black border border-white/20 rounded px-2 py-1 text-xs text-white"
                    >
                      <option value="Masculino">Masc</option>
                      <option value="Feminino">Fem</option>
                    </select>
                    <select 
                      value={formData.belt} 
                      onChange={e => handleChange('belt', e.target.value)}
                      className="bg-black border border-white/20 rounded px-2 py-1 text-xs text-white"
                    >
                      {Object.keys(beltConfig).map(b => (
                        <option key={b} value={b}>{beltConfig[b].label.toUpperCase()}</option>
                      ))}
                    </select>
                    <input 
                      type="number" min="0" max="4"
                      value={formData.stripes} 
                      onChange={e => handleChange('stripes', e.target.value)}
                      className="bg-black border border-white/20 rounded px-2 py-1 text-xs text-white w-16"
                      placeholder="Graus"
                    />
                  </div>
                ) : (
                  <>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-sm bg-white/10 text-gray-300" style={{ letterSpacing: '0.05em' }}>
                      {formData.ageCategory.toUpperCase()}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-sm bg-white/10 text-gray-300" style={{ letterSpacing: '0.05em' }}>
                      {formData.gender === 'Masculino' ? 'MASC' : 'FEM'}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-sm ${bgClass}`} style={{ color: textColor, letterSpacing: '0.05em' }}>
                      {beltConfig[formData.belt]?.label?.toUpperCase() || formData.belt?.toUpperCase() || 'SEM FAIXA'} {formData.stripes ? `· ${formData.stripes} GRAUS` : ''}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-white/10 pb-2">Contato</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col md:flex-row md:items-center gap-3 bg-white/5 p-3 rounded-xll border border-white/5">
                <div className="flex items-center gap-2 shrink-0 md:w-8">
                  <Mail size={16} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0 w-full">
                  <p className="text-[10px] text-gray-500 uppercase">E-mail</p>
                  {isEditing ? (
                    <input 
                      value={formData.email} 
                      onChange={e => handleChange('email', e.target.value)}
                      className="w-full bg-black/40 border border-white/20 rounded px-2 mt-1 text-sm text-white"
                    />
                  ) : (
                    <p className="text-sm text-white truncate mt-0.5">{formData.email || 'Não informado'}</p>
                  )}
                </div>
              </div>
              
              <div className="flex flex-col md:flex-row md:items-center gap-3 bg-white/5 p-3 rounded-xll border border-white/5">
                <div className="flex items-center gap-2 shrink-0 md:w-8">
                  <Phone size={16} className="text-gray-400" />
                </div>
                <div className="flex-1 min-w-0 w-full">
                  <p className="text-[10px] text-gray-500 uppercase">Telefone</p>
                  {isEditing ? (
                    <input 
                      value={formData.phone} 
                      onChange={e => handleChange('phone', e.target.value)}
                      className="w-full bg-black/40 border border-white/20 rounded px-2 mt-1 text-sm text-white"
                    />
                  ) : (
                    <p className="text-sm text-white truncate mt-0.5">{formData.phone || 'Não informado'}</p>
                  )}
                </div>
              </div>

              {(formData.ageCategory === 'Kids' || formData.ageCategory === 'Juvenil') && (
                <>
                  <div className="flex flex-col md:flex-row md:items-center gap-3 bg-white/5 p-3 rounded-xll border border-white/5">
                    <div className="flex items-center gap-2 shrink-0 md:w-8">
                      <Users size={16} className="text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0 w-full">
                      <p className="text-[10px] text-gray-500 uppercase">Nome do Responsável</p>
                      {isEditing ? (
                        <input 
                          value={formData.parentName} 
                          onChange={e => handleChange('parentName', e.target.value)}
                          className="w-full bg-black/40 border border-white/20 rounded px-2 mt-1 text-sm text-white"
                        />
                      ) : (
                        <p className="text-sm text-white truncate mt-0.5">{formData.parentName || 'Não informado'}</p>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col md:flex-row md:items-center gap-3 bg-white/5 p-3 rounded-xll border border-white/5">
                    <div className="flex items-center gap-2 shrink-0 md:w-8">
                      <Smartphone size={16} className="text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0 w-full">
                      <p className="text-[10px] text-gray-500 uppercase">Tel. Responsável</p>
                      {isEditing ? (
                        <input 
                          value={formData.parentPhone} 
                          onChange={e => handleChange('parentPhone', e.target.value)}
                          className="w-full bg-black/40 border border-white/20 rounded px-2 mt-1 text-sm text-white"
                        />
                      ) : (
                        <p className="text-sm text-white truncate mt-0.5">{formData.parentPhone || 'Não informado'}</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Medical & Emergency */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-white/10 pb-2">Emergência e Saúde</h3>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col md:flex-row md:items-start gap-3 bg-white/5 p-3 rounded-xll border border-red-900/30">
                <AlertCircle size={16} style={{ color: 'var(--clr-primary)' }} className="mt-0.5 shrink-0" />
                <div className="flex-1 w-full">
                  <p className="text-[10px] text-gray-500 uppercase">Contato de Emergência</p>
                  {isEditing ? (
                    <input 
                      value={formData.emergency} 
                      onChange={e => handleChange('emergency', e.target.value)}
                      className="w-full bg-black/40 border border-primary/40 rounded px-2 mt-1 text-sm text-white"
                    />
                  ) : (
                    <p className="text-sm text-white mt-0.5">{formData.emergency || 'Não informado'}</p>
                  )}
                </div>
              </div>
              <div className="flex flex-col md:flex-row md:items-start gap-3 bg-white/5 p-3 rounded-xll border border-primary/30">
                <HeartPulse size={16} className="text-primary mt-0.5 shrink-0" />
                <div className="flex-1 w-full">
                  <p className="text-[10px] text-gray-500 uppercase">Restrições Médicas</p>
                  {isEditing ? (
                    <textarea 
                      value={formData.medical} 
                      onChange={e => handleChange('medical', e.target.value)}
                      className="w-full bg-black/40 border border-primary/40 rounded px-2 py-1 mt-1 text-sm text-white min-h-[60px]"
                    />
                  ) : (
                    <p className="text-sm text-white mt-0.5 whitespace-pre-wrap">{formData.medical || 'Nenhuma restrição informada/conhecida.'}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Assiduity Status */}
          {!isEditing && <AssiduityCard student={student} />}

          {/* Activity */}
          {!isEditing && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-white/10 pb-2">Atividade</h3>
              <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xll border border-white/5">
                <Calendar size={16} className="text-gray-400 shrink-0" />
                <div className="flex-1 flex justify-between gap-4">
                  <div className="flex-1">
                    <p className="text-[10px] text-gray-500 uppercase">Cadastrado em</p>
                    <p className="text-sm text-white">{formatDate(createdAt)}</p>
                  </div>
                  <div className="text-right flex-1">
                    <p className="text-[10px] text-gray-500 uppercase">Última Presença</p>
                    <p className="text-sm text-white">{formatDate(lastAttendanceAt)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
        
        <div className="p-4 border-t border-white/10 flex justify-end gap-3 bg-black/20">
          {isEditing ? (
            <>
              <button 
                onClick={() => {
                  setIsEditing(false)
                  setFormData({
                    name: student?.name || '',
                    email: student?.email || '',
                    phone: student?.phone || '',
                    emergency: student?.emergency || '',
                    medical: student?.medical || '',
                    belt: student?.belt || 'white',
                    stripes: student?.stripes || 0,
                    ageCategory: student?.ageCategory || 'Adulto',
                    gender: student?.gender || 'Masculino',
                    parentName: student?.parentName || '',
                    parentPhone: student?.parentPhone || '',
                  })
                }} 
                className="px-5 py-2 rounded-xll text-sm font-bold text-white bg-white/5 hover:bg-white/10 transition-colors"
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button 
                onClick={handleSave} 
                className="btn-primary flex items-center gap-2 px-6 py-2 rounded-xll text-sm font-bold text-white transition-all disabled:opacity-50"
                disabled={isSaving}
              >
                {isSaving ? 'Salvando...' : <><Save size={16}/> Salvar</>}
              </button>
            </>
          ) : (
            <button onClick={onClose} className="px-5 py-2 rounded-xll text-sm font-bold text-white bg-white/10 hover:bg-white/20 transition-colors">
              Fechar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}


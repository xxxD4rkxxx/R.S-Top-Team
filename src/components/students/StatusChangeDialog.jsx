import React, { useState } from 'react'
import { X, AlertTriangle, UserX, UserMinus } from 'lucide-react'

export default function StatusChangeDialog({ student, action, onConfirm, onClose }) {
  const [reason, setReason] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [saving, setSaving] = useState(false)

  if (!action || !student) return null

  const isInactivate = action === 'inativar'
  const isSuspend = action === 'suspender'

  const config = {
    inativar: {
      icon: UserX,
      color: 'text-gray-400',
      bgColor: 'bg-gray-500/10',
      borderColor: 'border-gray-500/20',
      title: 'Inativar Aluno',
      description: `O aluno "${student.name}" será marcado como inativo. Ele não aparecerá nas chamadas, mas seus dados serão mantidos.`,
      btnLabel: 'Confirmar Inativação',
      btnClass: 'bg-gray-600 hover:bg-gray-500 text-white',
    },
    suspender: {
      icon: UserMinus,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
      borderColor: 'border-yellow-500/20',
      title: 'Suspender Aluno',
      description: `O aluno "${student.name}" ficará temporariamente suspenso. Use para lesões, viagens ou licenças.`,
      btnLabel: 'Confirmar Suspensão',
      btnClass: 'bg-yellow-600 hover:bg-yellow-500 text-white',
    },
  }

  const { icon: Icon, color, bgColor, borderColor, title, description, btnLabel, btnClass } = config[action] || config.inativar

  async function handleConfirm() {
    if (!reason.trim()) {
      alert('Por favor, informe o motivo.')
      return
    }
    if (isSuspend && !returnDate) {
      alert('Informe a data estimada de retorno para suspensão.')
      return
    }
    setSaving(true)
    try {
      await onConfirm({ reason, returnDate: returnDate || null })
    } catch (err) {
      alert(`Erro: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[9995] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-md rounded-xll overflow-hidden border border-white/10 shadow-2xl"
        style={{ background: '#0d0d0d', animation: 'fadeSlideUp 0.22s ease both' }}
      >
        {/* Header */}
        <div className={`flex items-center gap-3 px-6 py-4 border-b ${borderColor}`} style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className={`w-9 h-9 rounded-xll flex items-center justify-center border ${bgColor} ${borderColor}`}>
            <Icon size={18} className={color} />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-bold text-white">{title}</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-xll hover:bg-white/10 text-gray-500 hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Aviso */}
          <div className={`flex items-start gap-3 p-3 rounded-xll border ${bgColor} ${borderColor}`}>
            <AlertTriangle size={16} className={`${color} shrink-0 mt-0.5`} />
            <p className="text-xs text-gray-400 leading-relaxed">{description}</p>
          </div>

          {/* Motivo */}
          <div>
            <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold block mb-1.5">
              Motivo <span style={{ color: 'var(--clr-primary)' }}>*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={isInactivate ? 'Ex: Aluno cancelou a matrícula.' : 'Ex: Lesão no joelho, fisioterapia por 3 meses.'}
              rows={3}
              className="form-input bg-black/40 resize-none text-sm w-full"
            />
          </div>

          {/* Data de Retorno (só Suspensão) */}
          {isSuspend && (
            <div>
              <label className="text-[10px] uppercase tracking-widest text-gray-500 font-bold block mb-1.5">
                Data Estimada de Retorno <span style={{ color: 'var(--clr-primary)' }}>*</span>
              </label>
              <input
                type="date"
                value={returnDate}
                onChange={e => setReturnDate(e.target.value)}
                className="form-input bg-black/40 text-sm w-full"
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
          )}

          {/* Ações */}
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 py-2.5 rounded-xll text-sm text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving}
              className={`flex-1 py-2.5 rounded-xll text-sm font-bold transition-colors disabled:opacity-50 ${btnClass}`}
            >
              {saving ? 'Salvando...' : btnLabel}
            </button>
          </div>
        </div>
        <style>{`@keyframes fadeSlideUp { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); }}`}</style>
      </div>
    </div>
  )
}


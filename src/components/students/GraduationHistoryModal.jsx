import React, { useState, useEffect } from 'react'
import { db } from '../../firebase/config'
import { collection, getDocs, addDoc, serverTimestamp, orderBy, query } from 'firebase/firestore'
import { GraduationCap, Plus, X, Trophy } from 'lucide-react'
import { beltConfig } from '../../data/beltConfig'

const BELT_ORDER = ['white', 'blue', 'purple', 'brown', 'black']

function timeDiff(from, to) {
  if (!from || !to) return null
  const diff = Math.abs(to - from)
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days < 30) return `${days} dias`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} mês${months > 1 ? 'es' : ''}`
  const years = Math.floor(months / 12)
  const rem = months % 12
  return `${years} ano${years > 1 ? 's' : ''}${rem > 0 ? ` e ${rem} mês${rem > 1 ? 'es' : ''}` : ''}`
}

export default function GraduationHistoryModal({ student, isOpen, onClose }) {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ belt: 'white', stripes: 0, professor: '', date: new Date().toISOString().split('T')[0], notes: '' })

  async function loadRecords() {
    if (!student?.id) return
    setLoading(true)
    try {
      const ref = collection(db, 'students', student.id, 'graduations')
      const snap = await getDocs(query(ref, orderBy('date', 'asc')))
      setRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) loadRecords()
  }, [isOpen, student?.id])

  async function handleSave() {
    setSaving(true)
    try {
      await addDoc(collection(db, 'students', student.id, 'graduations'), {
        belt: form.belt,
        stripes: Number(form.stripes),
        professor: form.professor,
        date: form.date,
        notes: form.notes,
        createdAt: serverTimestamp()
      })
      setShowForm(false)
      setForm({ belt: 'white', stripes: 0, professor: '', date: new Date().toISOString().split('T')[0], notes: '' })
      loadRecords()
    } catch (err) {
      alert('Erro ao salvar graduação')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[9990] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-xll overflow-hidden border border-white/10"
        style={{ background: '#0d0d0d', animation: 'fadeSlideUp 0.25s ease both' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0" style={{ background: 'rgba(255,255,255,0.02)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xll bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
              <GraduationCap size={18} className="text-yellow-400" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Histórico de Graduações</h2>
              <p className="text-[11px] text-gray-500 uppercase tracking-widest">{student?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowForm(v => !v)}
              className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
            >
              <Plus size={14} /> Nova Graduação
            </button>
            <button onClick={onClose} className="p-2 rounded-xll hover:bg-white/10 text-gray-400 hover:text-white transition-colors">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Formulário inline */}
        {showForm && (
          <div className="px-6 py-4 bg-black/40 border-b border-white/10 space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--clr-primary)' }}>Nova Graduação</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Faixa</label>
                <select value={form.belt} onChange={e => setForm(p => ({...p, belt: e.target.value}))} className="form-input bg-black/60 text-sm py-2">
                  {BELT_ORDER.map(b => <option key={b} value={b}>{beltConfig[b]?.label || b}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Graus</label>
                <select value={form.stripes} onChange={e => setForm(p => ({...p, stripes: e.target.value}))} className="form-input bg-black/60 text-sm py-2">
                  {[0,1,2,3,4].map(n => <option key={n} value={n}>{n} grau{n !== 1 ? 's' : ''}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Professor</label>
                <input value={form.professor} onChange={e => setForm(p => ({...p, professor: e.target.value}))} className="form-input bg-black/60 text-sm py-2" placeholder="Nome do Mestre" />
              </div>
              <div>
                <label className="form-label">Data</label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({...p, date: e.target.value}))} className="form-input bg-black/60 text-sm py-2" />
              </div>
            </div>
            <div>
              <label className="form-label">Observações</label>
              <input value={form.notes} onChange={e => setForm(p => ({...p, notes: e.target.value}))} className="form-input bg-black/60 text-sm py-2 w-full" placeholder="Ex: Aprovado na avaliação técnica" />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2 rounded-xll text-sm text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="flex-1 btn-primary py-2 rounded-xll text-sm font-bold disabled:opacity-50">
                {saving ? 'Salvando...' : 'Salvar Graduação'}
              </button>
            </div>
          </div>
        )}

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-12 text-gray-500">Carregando...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-12 text-gray-600">
              <Trophy size={40} className="mx-auto mb-3 opacity-20" />
              <p className="text-sm">Nenhuma graduação registrada ainda.</p>
              <p className="text-xs text-gray-600 mt-1">Clique em "Nova Graduação" para adicionar.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Linha vertical */}
              <div className="absolute left-5 top-0 bottom-0 w-px bg-white/10" />
              <div className="space-y-6 pl-14">
                {records.map((rec, i) => {
                  const cfg = beltConfig[rec.belt] || beltConfig['white']
                  const nextDate = records[i + 1] ? new Date(records[i + 1].date) : null
                  const currentDate = new Date(rec.date)
                  const duration = timeDiff(currentDate, nextDate || new Date())
                  return (
                    <div key={rec.id} className="relative">
                      {/* Bolinha colorida na timeline */}
                      <div
                        className={`absolute -left-9 top-1 w-5 h-5 rounded-full border-2 border-black flex items-center justify-center shadow-lg ${cfg.bgClass}`}
                        style={{ boxShadow: '0 0 10px rgba(255,255,255,0.2)' }}
                      />
                      <div className="bg-white/5 rounded-xll p-4 border border-white/8">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-black uppercase px-2 py-1 rounded-md ${cfg.bgClass}`} style={{ color: cfg.textColor }}>
                              {cfg.label}{rec.stripes > 0 ? ` · ${rec.stripes}g` : ''}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-500">
                            {new Date(rec.date).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                        {rec.professor && (
                          <p className="text-[11px] text-gray-400">
                            <span className="text-gray-600">Professor: </span>{rec.professor}
                          </p>
                        )}
                        {rec.notes && <p className="text-[11px] text-gray-400 mt-1 italic">{rec.notes}</p>}
                        {duration && (
                          <p className="text-[10px] text-gray-600 mt-2 border-t border-white/5 pt-2">
                            ⏱ {i === records.length - 1 ? 'Tempo nesta faixa:' : 'Permaneceu:'} {duration}
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
        <style>{`@keyframes fadeSlideUp { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); }}`}</style>
      </div>
    </div>
  )
}


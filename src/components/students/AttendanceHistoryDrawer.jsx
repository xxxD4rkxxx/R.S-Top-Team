import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { db } from '../../firebase/config'
import { collectionGroup, query, where, getDocs, orderBy, collection as fsCollection, addDoc, serverTimestamp } from 'firebase/firestore'
import {
  CalendarDays, ChevronLeft, ChevronRight, Award, Activity,
  Trophy, FileDown, Target, MessageSquare, Plus, X, Star
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, ReferenceLine } from 'recharts'
import SlideOver from '../shared/SlideOver'

const DAYS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
const DAYS_FULL  = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const MONTHS = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']
const MONTHS_FULL = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']

const MODALITY_COLORS = { 'Jiu-Jitsu': 'var(--clr-primary)', 'Boxe': '#f59e0b', Ambos: '#8b5cf6' }

// ── helpers ────────────────────────────────────────────────────
function buildStreak(sortedDatesAsc) {
  if (!sortedDatesAsc.length) return 0
  let streak = 0, prev = null
  for (let i = sortedDatesAsc.length - 1; i >= 0; i--) {
    const d = sortedDatesAsc[i]
    if (!prev) { streak = 1; prev = d; continue }
    const diff = Math.round((prev - d) / 86400000)
    if (diff <= 7) { streak++; prev = d }
    else break
  }
  return streak
}

function daysBetween(a, b) {
  return Math.round(Math.abs(b - a) / 86400000)
}

// ── Custom Tooltip ────────────────────────────────────────────
function CustomBarTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#111] border border-white/10 rounded-xl px-3 py-2 text-xs">
      <p className="text-gray-400 font-bold">{MONTHS_FULL[label] || label}</p>
      <p className="text-white font-black">{payload[0].value} treinos</p>
    </div>
  )
}

// ── Component ────────────────────────────────────────────────
export default function AttendanceHistoryDrawer({ student, isOpen, onClose }) {
  const [records, setRecords]       = useState([]) // { date: Date, modality, status, sessionId }
  const [notes, setNotes]           = useState([])
  const [loading, setLoading]       = useState(true)
  const [viewDate, setViewDate]     = useState(() => new Date())
  const [activeTab, setActiveTab]   = useState('calendar') // 'calendar' | 'charts' | 'notes'
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [noteText, setNoteText]     = useState('')
  const [savingNote, setSavingNote] = useState(false)

  // ── Load data ───────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!student?.id) return
    setLoading(true)
    try {
      // All attendance records for this student
      const q = query(
        collectionGroup(db, 'attendances'),
        where('studentId', '==', student.id),
        orderBy('timestamp', 'asc')
      )
      const snap = await getDocs(q)
      const recs = snap.docs.map(d => {
        const data = d.data()
        const ts = data.timestamp
        return {
          date:     ts?.toDate ? ts.toDate() : new Date(ts),
          modality: data.modality || 'Jiu-Jitsu',
          status:   data.status  || 'present',
          sessionId: d.ref.parent.parent?.id || '',
        }
      }).filter(r => !isNaN(r.date))
      setRecords(recs)

      // Professor notes
      const notesSnap = await getDocs(fsCollection(db, 'students', student.id, 'notes'))
      const nts = notesSnap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      setNotes(nts)
    } catch (err) {
      console.error('Erro ao carregar histórico:', err)
    } finally {
      setLoading(false)
    }
  }, [student?.id])

  useEffect(() => { if (isOpen) loadData() }, [isOpen, loadData])

  // ── Derived data ─────────────────────────────────────────────
  const presentRecords = useMemo(() => records.filter(r => r.status === 'present'), [records])

  const today = new Date()

  const thisMonthCount = useMemo(() => {
    const now = new Date()
    return presentRecords.filter(r => r.date.getFullYear() === now.getFullYear() && r.date.getMonth() === now.getMonth()).length
  }, [presentRecords])

  const streak = useMemo(() => buildStreak(presentRecords.map(r => r.date)), [presentRecords])

  // Map of day→[records] for current month view
  const monthPresentMap = useMemo(() => {
    const map = {}
    records.forEach(r => {
      if (r.date.getFullYear() === viewDate.getFullYear() && r.date.getMonth() === viewDate.getMonth()) {
        const d = r.date.getDate()
        if (!map[d]) map[d] = []
        map[d].push(r)
      }
    })
    return map
  }, [records, viewDate])

  // Detect absence runs > 7 days in the viewed month
  const absenceRanges = useMemo(() => {
    const year = viewDate.getFullYear(), month = viewDate.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const ranges = []
    let gapStart = null

    for (let d = 1; d <= daysInMonth; d++) {
      const hasPres = !!monthPresentMap[d]
      if (!hasPres) {
        if (!gapStart) gapStart = d
      } else {
        if (gapStart && (d - gapStart) > 7) ranges.push({ start: gapStart, end: d - 1 })
        gapStart = null
      }
    }
    if (gapStart && (daysInMonth - gapStart + 1) > 7) ranges.push({ start: gapStart, end: daysInMonth })
    return ranges
  }, [monthPresentMap, viewDate])

  const isAbsenceDay = useCallback((day) =>
    absenceRanges.some(r => day >= r.start && day <= r.end), [absenceRanges])

  // Calendar grid
  const calendarGrid = useMemo(() => {
    const year = viewDate.getFullYear(), month = viewDate.getMonth()
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < firstDay; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    return cells
  }, [viewDate])

  // ── Monthly bar chart data ───────────────────────────────────
  const monthlyData = useMemo(() => {
    const counts = {}
    presentRecords.forEach(r => {
      const key = r.date.getMonth()
      counts[key] = (counts[key] || 0) + 1
    })
    return Array.from({ length: 12 }, (_, i) => ({ month: i, label: MONTHS[i], count: counts[i] || 0 }))
  }, [presentRecords])

  // ── Modality pie ─────────────────────────────────────────────
  const modalityData = useMemo(() => {
    const counts = {}
    presentRecords.forEach(r => { counts[r.modality] = (counts[r.modality] || 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
  }, [presentRecords])

  // ── Heatmap: day-of-week vs hour ─────────────────────────────
  const heatmapData = useMemo(() => {
    const grid = Array.from({ length: 7 }, () => ({ morning: 0, afternoon: 0, evening: 0 }))
    presentRecords.forEach(r => {
      const dow = r.date.getDay()
      const h   = r.date.getHours()
      if (h < 12)       grid[dow].morning++
      else if (h < 17)  grid[dow].afternoon++
      else              grid[dow].evening++
    })
    return grid
  }, [presentRecords])

  const heatMax = useMemo(() => Math.max(1, ...heatmapData.flatMap(r => [r.morning, r.afternoon, r.evening])), [heatmapData])

  // ── Graduation progress ──────────────────────────────────────
  const PROMO_TARGET = 60
  const progressData = useMemo(() => {
    const sorted = [...presentRecords].sort((a, b) => a.date - b.date)
    return sorted.map((_, i) => ({ x: i + 1, y: i + 1 }))
  }, [presentRecords])

  // ── Ranking ──────────────────────────────────────────────────
  const rankBadge = useMemo(() => {
    const n = thisMonthCount
    if (n >= 20) return { label: 'Top Atleta 🥇', color: 'text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20' }
    if (n >= 14) return { label: 'Assíduo 🥈', color: 'text-gray-300', bg: 'bg-gray-500/10', border: 'border-gray-500/20' }
    if (n >= 8)  return { label: 'Regular 🥉', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' }
    if (n >= 4)  return { label: 'Iniciante', color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' }
    return null
  }, [thisMonthCount])

  // ── Save note ────────────────────────────────────────────────
  async function handleSaveNote() {
    if (!noteText.trim()) return
    setSavingNote(true)
    try {
      const doc = await addDoc(fsCollection(db, 'students', student.id, 'notes'), {
        text: noteText.trim(),
        author: 'Professor',
        createdAt: serverTimestamp()
      })
      setNotes(prev => [{ id: doc.id, text: noteText.trim(), author: 'Professor', createdAt: { seconds: Date.now() / 1000 } }, ...prev])
      setNoteText('')
      setShowNoteForm(false)
    } finally { setSavingNote(false) }
  }

  // ── Print ────────────────────────────────────────────────────
  function handlePrint() {
    const w = window.open('', '_blank')
    const rows = presentRecords.slice().reverse().map(r =>
      `<tr><td>${r.date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}</td><td>${r.modality}</td><td>✅ Presente</td></tr>`
    ).join('')
    w.document.write(`
      <html><head><title>Frequência — ${student.name}</title><style>
        body{font-family:sans-serif;padding:32px;color:#111}
        h1{font-size:20px;margin-bottom:4px}p{color:#555;font-size:13px;margin:0 0 24px}
        table{width:100%;border-collapse:collapse}th,td{padding:10px 14px;text-align:left;border-bottom:1px solid #eee;font-size:13px}
        th{background:#f5f5f5;font-weight:bold}
        .kpis{display:flex;gap:16px;margin-bottom:24px}
        .kpi{background:#f5f5f5;border-radius:12px;padding:14px 20px}
        .kpi b{display:block;font-size:24px}
      </style></head><body>
        <h1>Relatório de Frequência</h1>
        <p>${student.name} — Gerado em ${new Date().toLocaleDateString('pt-BR')}</p>
        <div class="kpis">
          <div class="kpi"><b>${presentRecords.length}</b>Total de Presenças</div>
          <div class="kpi"><b>${thisMonthCount}</b>Presenças este Mês</div>
          <div class="kpi"><b>${streak}</b>Sequência Ativa (sem)</div>
        </div>
        <table><thead><tr><th>Data</th><th>Modalidade</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody></table>
      </body></html>`)
    w.document.close()
    w.print()
  }

  const tabs = [
    { id: 'calendar', label: 'Calendário' },
    { id: 'charts',   label: 'Gráficos'  },
    { id: 'notes',    label: `Notas${notes.length ? ` (${notes.length})` : ''}` },
  ]

  return (
    <SlideOver isOpen={isOpen} onClose={onClose} title="Histórico de Presença" subtitle={student?.name} width="max-w-xl">
      <div className="flex flex-col h-full">
        {/* ── KPIs ─────────────────────────────────────── */}
        <div className="px-5 pt-5 pb-4 border-b border-white/10 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Activity,  color:'text-emerald-400', label:'Este Mês',  value: loading ? '—' : thisMonthCount },
              { icon: Award,     color:'text-primary',   label:'Total',     value: loading ? '—' : presentRecords.length },
              { icon: Star,      color:'text-yellow-400',  label:'Sequência', value: loading ? '—' : `${streak}s` },
            ].map(({ icon: Icon, color, label, value }) => (
              <div key={label} className="bg-white/5 rounded-2xl p-3 border border-white/10 text-center">
                <Icon size={18} strokeWidth={1.9} className={`${color} mx-auto mb-1`} />
                <p className={`text-2xl font-black ${color}`}>{value}</p>
                <p className="text-[10px] text-gray-600 uppercase tracking-widest mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Ranking badge + Export */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {rankBadge && (
                <span className={`text-[11px] font-bold px-3 py-1 rounded-full border ${rankBadge.bg} ${rankBadge.border} ${rankBadge.color}`}>
                  <Trophy size={11} className="inline mr-1" />{rankBadge.label}
                </span>
              )}
              {/* Graduation progress */}
              {presentRecords.length > 0 && (
                <span className="text-[11px] text-gray-500 flex items-center gap-1">
                  <Target size={11} className="text-purple-400" />
                  {Math.min(presentRecords.length, PROMO_TARGET)}/{PROMO_TARGET} para Promo
                </span>
              )}
            </div>
            <button onClick={handlePrint} title="Exportar PDF"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-colors">
              <FileDown size={13} /> Exportar
            </button>
          </div>
        </div>

        {/* ── Tabs ─────────────────────────────────────── */}
        <div className="flex border-b border-white/10 shrink-0">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest transition-colors ${activeTab === t.id ? 'text-primary border-b-2 border-primary' : 'text-gray-500 hover:text-gray-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Content ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-600 text-sm">Carregando...</div>
          ) : (
            <>
              {/* ══ CALENDAR TAB ══ */}
              {activeTab === 'calendar' && (
                <div className="space-y-5">
                  <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                    {/* Nav */}
                    <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
                      <button onClick={() => setViewDate(p => new Date(p.getFullYear(), p.getMonth() - 1, 1))}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white">
                        <ChevronLeft size={16} />
                      </button>
                      <span className="text-sm font-bold text-white">
                        {MONTHS_FULL[viewDate.getMonth()]} {viewDate.getFullYear()}
                      </span>
                      <button onClick={() => setViewDate(p => new Date(p.getFullYear(), p.getMonth() + 1, 1))}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white">
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <div className="p-4">
                      {/* Day headers */}
                      <div className="grid grid-cols-7 mb-2">
                        {DAYS_FULL.map(d => (
                          <div key={d} className="text-center text-[9px] font-bold text-gray-600 uppercase py-1">{d}</div>
                        ))}
                      </div>

                      {/* Cells */}
                      <div className="grid grid-cols-7 gap-1">
                        {calendarGrid.map((day, i) => {
                          if (!day) return <div key={`e-${i}`} />
                          const dayRecs  = monthPresentMap[day] || []
                          const hasPresent  = dayRecs.some(r => r.status === 'present')
                          const hasJustified = dayRecs.some(r => r.status === 'justified')
                          const isToday  = viewDate.getFullYear() === today.getFullYear() &&
                                           viewDate.getMonth()    === today.getMonth()    &&
                                           day === today.getDate()
                          const absence  = isAbsenceDay(day) && !hasPresent && !hasJustified
                          const modality = dayRecs[0]?.modality

                          return (
                            <div key={day} title={hasPresent ? `✅ ${modality || ''}` : absence ? '⚠️ Ausência prolongada' : ''}
                              className={`aspect-square flex flex-col items-center justify-center rounded-lg text-[10px] font-bold transition-all relative
                                ${hasPresent
                                  ? 'text-white shadow-[0_0_10px_rgba(16,185,129,0.4)]'
                                  : hasJustified
                                    ? 'border border-blue-400/50 text-blue-400'
                                    : absence
                                      ? 'bg-red-500/5 text-red-900 border border-red-500/10'
                                      : isToday
                                        ? 'border border-primary/60 text-primary'
                                        : 'text-gray-500 hover:bg-white/5'
                                }`}
                              style={hasPresent ? { background: `${MODALITY_COLORS[modality || 'Jiu-Jitsu']}30`, borderColor: `${MODALITY_COLORS[modality]}50`, border: '1px solid' } : {}}
                            >
                              <span>{day}</span>
                              {hasPresent && (
                                <div className="w-1.5 h-1.5 rounded-full mt-0.5 shrink-0"
                                  style={{ background: MODALITY_COLORS[modality || 'Jiu-Jitsu'] }} />
                              )}
                              {hasJustified && <span className="text-[7px] leading-none">JUS</span>}
                            </div>
                          )
                        })}
                      </div>

                      {/* Legenda */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-4 justify-center">
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm" style={{ background: 'color-mix(in srgb, var(--clr-primary) 33%, transparent)', border: '1px solid var(--clr-primary)' }} />
                          <span className="text-[10px] text-gray-400">Jiu-Jitsu</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm" style={{ background: '#f59e0b55', border: '1px solid #f59e0b' }} />
                          <span className="text-[10px] text-gray-400">Boxe</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm" style={{ background: '#3b82f655', border: '1px solid #3b82f6' }} />
                          <span className="text-[10px] text-gray-400">Justificado</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm" style={{ background: '#f9731620', border: '1px solid #f97316' }} />
                          <span className="text-[10px] text-gray-400">Ausência longa</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <div className="w-3 h-3 rounded-sm" style={{ border: '1.5px solid #e5e7eb' }} />
                          <span className="text-[10px] text-gray-400">Hoje</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Últimos Treinos */}
                  {presentRecords.length > 0 && (
                    <div>
                      <h3 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-3">Últimos Treinos</h3>
                      <div className="space-y-2">
                        {[...presentRecords].reverse().slice(0, 8).map((r, i) => (
                          <div key={i} className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-2.5 border border-white/5">
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ background: MODALITY_COLORS[r.modality] || 'var(--clr-primary)' }} />
                            <span className="text-sm text-white font-medium flex-1">
                              {r.date.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
                            </span>
                            <span className="text-[10px] text-gray-600 font-bold uppercase">{r.modality}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {presentRecords.length === 0 && (
                    <div className="text-center py-10 text-gray-600">
                      <CalendarDays size={40} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm">Nenhum treino registrado ainda.</p>
                    </div>
                  )}
                </div>
              )}

              {/* ══ CHARTS TAB ══ */}
              {activeTab === 'charts' && (
                <div className="space-y-6">
                  {/* Bar: Consistência Mensal */}
                  <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
                    <h3 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-4">Consistência Mensal</h3>
                    <ResponsiveContainer width="100%" height={140}>
                      <BarChart data={monthlyData} barSize={14}>
                        <XAxis dataKey="label" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                        <Bar dataKey="count" fill="var(--clr-primary)" radius={[4, 4, 0, 0]}
                          label={{ position: 'top', fill: '#6b7280', fontSize: 9, formatter: v => v || '' }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Line: Rumo à Graduação */}
                  <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Rumo à Graduação</h3>
                      <span className="text-[10px] text-purple-400 font-bold">{Math.min(presentRecords.length, PROMO_TARGET)}/{PROMO_TARGET} treinos</span>
                    </div>
                    {/* Progress bar */}
                    <div className="w-full bg-white/10 rounded-full h-2 mb-3 overflow-hidden">
                      <div className="h-2 rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, (presentRecords.length / PROMO_TARGET) * 100)}%`, background: 'linear-gradient(90deg,#8b5cf6,var(--clr-primary))' }} />
                    </div>
                    {presentRecords.length >= PROMO_TARGET
                      ? <p className="text-xs text-emerald-400 font-bold text-center">🎉 Pronto para Graduação!</p>
                      : <p className="text-xs text-gray-600 text-center">{PROMO_TARGET - presentRecords.length} treinos restantes</p>
                    }
                  </div>

                  {/* Pie: Modalidades */}
                  {modalityData.length > 1 && (
                    <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
                      <h3 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-4">Divisão por Modalidade</h3>
                      <div className="flex items-center gap-4">
                        <ResponsiveContainer width={120} height={120}>
                          <PieChart>
                            <Pie data={modalityData} cx="50%" cy="50%" innerRadius={30} outerRadius={52} paddingAngle={3} dataKey="value">
                              {modalityData.map((entry, i) => (
                                <Cell key={i} fill={MODALITY_COLORS[entry.name] || '#8b5cf6'} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex-1 space-y-2">
                          {modalityData.map(m => {
                            const pct = Math.round((m.value / presentRecords.length) * 100)
                            return (
                              <div key={m.name}>
                                <div className="flex items-center justify-between text-xs mb-1">
                                  <span className="text-gray-300 font-medium">{m.name}</span>
                                  <span className="font-black" style={{ color: MODALITY_COLORS[m.name] }}>{pct}%</span>
                                </div>
                                <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                                  <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: MODALITY_COLORS[m.name] }} />
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Heatmap GitHub-style */}
                  <div className="bg-white/5 rounded-2xl border border-white/10 p-4">
                    <h3 className="text-[10px] uppercase tracking-widest text-gray-500 font-bold mb-4">Mapa de Frequência (Horário)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[9px]">
                        <thead>
                          <tr>
                            <th className="text-gray-600 text-left pr-3 font-bold pb-1.5 w-8"></th>
                            <th className="text-gray-600 font-bold pb-1.5 text-center">Manhã</th>
                            <th className="text-gray-600 font-bold pb-1.5 text-center">Tarde</th>
                            <th className="text-gray-600 font-bold pb-1.5 text-center">Noite</th>
                          </tr>
                        </thead>
                        <tbody>
                          {DAYS_FULL.map((day, i) => {
                            const row = heatmapData[i]
                            return (
                              <tr key={day}>
                                <td className="text-gray-600 pr-3 font-bold py-1">{day.slice(0,3)}</td>
                                {['morning','afternoon','evening'].map(period => {
                                  const v = row[period]
                                  const intensity = v / heatMax
                                  return (
                                    <td key={period} className="py-1 px-1 text-center">
                                      <div
                                        title={`${v} treino${v !== 1 ? 's' : ''}`}
                                        className="w-8 h-8 rounded-md mx-auto flex items-center justify-center text-[10px] font-bold transition-all"
                                        style={{
                                          background: v > 0 ? `color-mix(in srgb, var(--clr-primary) ${Math.round((0.1 + intensity * 0.8) * 100)}%, transparent)` : 'rgba(255,255,255,0.04)',
                                          color: intensity > 0.5 ? '#fff' : intensity > 0 ? 'var(--clr-primary)' : '#374151',
                                          border: v > 0 ? '1px solid color-mix(in srgb, var(--clr-primary) 30%, transparent)' : '1px solid rgba(255,255,255,0.05)'
                                        }}
                                      >
                                        {v > 0 ? v : ''}
                                      </div>
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center gap-2 mt-3 justify-end">
                      <span className="text-[9px] text-gray-600">Menos</span>
                      {[0.05,0.3,0.55,0.8,1].map(v => (
                        <div key={v} className="w-3 h-3 rounded-sm" style={{ background: `color-mix(in srgb, var(--clr-primary) ${Math.round(v * 100)}%, transparent)` }} />
                      ))}
                      <span className="text-[9px] text-gray-600">Mais</span>
                    </div>
                  </div>
                </div>
              )}

              {/* ══ NOTES TAB ══ */}
              {activeTab === 'notes' && (
                <div className="space-y-4">
                  {/* Add note */}
                  {!showNoteForm ? (
                    <button onClick={() => setShowNoteForm(true)}
                      className="w-full flex items-center gap-2 justify-center py-3 rounded-xl bg-white/5 border border-dashed border-white/20 text-gray-400 hover:text-white hover:border-white/30 hover:bg-white/8 text-sm font-medium transition-all">
                      <Plus size={16} /> Adicionar Nota do Professor
                    </button>
                  ) : (
                    <div className="bg-white/5 rounded-2xl p-4 border border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-white">Nova Nota</h3>
                        <button onClick={() => setShowNoteForm(false)}><X size={14} className="text-gray-500 hover:text-white" /></button>
                      </div>
                      <textarea
                        value={noteText}
                        onChange={e => setNoteText(e.target.value)}
                        placeholder="Ex: Evoluiu bem na guarda, precisa melhorar o fôlego no sparring..."
                        rows={3}
                        className="form-input bg-black/30 resize-none text-sm w-full"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button onClick={() => setShowNoteForm(false)} className="flex-1 py-2 rounded-xl text-sm text-gray-400 bg-white/5 border border-white/10">Cancelar</button>
                        <button onClick={handleSaveNote} disabled={!noteText.trim() || savingNote}
                          className="flex-1 btn-primary py-2 rounded-xl text-sm font-bold disabled:opacity-50">
                          {savingNote ? 'Salvando...' : 'Salvar'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Notes list */}
                  {notes.length === 0 ? (
                    <div className="text-center py-12 text-gray-600">
                      <MessageSquare size={36} className="mx-auto mb-3 opacity-20" />
                      <p className="text-sm">Nenhuma nota registrada.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {notes.map(note => {
                        const d = note.createdAt?.seconds ? new Date(note.createdAt.seconds * 1000) : null
                        return (
                          <div key={note.id} className="bg-white/5 rounded-2xl p-4 border border-white/8">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                                {note.author || 'Professor'}
                              </span>
                              {d && <span className="text-[10px] text-gray-600">{d.toLocaleDateString('pt-BR')}</span>}
                            </div>
                            <p className="text-sm text-gray-300 leading-relaxed">{note.text}</p>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </SlideOver>
  )
}

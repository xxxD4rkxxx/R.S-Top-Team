/**
 * ExpensesPage.jsx
 * Página de Despesas — design padronizado com a aba Alunos.
 * Rota: /expenses
 * Responsabilidade: saídas de dinheiro (custos operacionais da academia).
 */

import React, { useState, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowDownCircle, Plus, Search, Trash2, X,
  CheckCircle2, Clock, Receipt, Tag,
  ChevronDown, Loader2, RefreshCcw, Calendar, TrendingUp, TrendingDown,
  MoreVertical, Edit2
} from 'lucide-react'
import PageHeader from '../../components/shared/PageHeader'
import MobileHeader from '../../components/navigation/MobileHeader'
import KPICard from '../../components/shared/KPICard'
import { useFinance } from '../../hooks/useFinance'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const R$ = (v) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

const dataBR = (str) => {
  if (!str) return '--'
  return new Date(str + 'T12:00:00').toLocaleDateString('pt-BR')
}

const STATUS_STYLE = {
  paid: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  pending: 'bg-amber-500/10  text-amber-400  border-amber-500/20',
}
const STATUS_LABEL = { paid: 'Pago', pending: 'Pendente' }

const CATEGORIAS = [
  'Aluguel', 'Energia', 'Internet', 'Material',
  'Equipamento', 'Marketing', 'Salários', 'Manutenção', 'Impostos', 'Outros'
]

// ─── CustomSelect — mesmo da página Alunos ────────────────────────────────────

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
    <div className="flex flex-col gap-1.5 relative" ref={ref}>
      <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">{label}</label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="form-input bg-black/40 input-raise text-sm py-2.5 px-4 text-gray-300 font-medium text-left flex justify-between items-center w-full border border-white/10 rounded-2xl transition-all hover:bg-black/60 focus:ring-1 focus:ring-white/20"
      >
        <span className="truncate">{selectedOption ? selectedOption[1] : '...'}</span>
        <ChevronDown size={16} className={`text-gray-500 transition-transform duration-200 shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-full min-w-[200px] bg-[#0d0d0d] border border-white/10 rounded-2xl z-[100] overflow-hidden shadow-2xl py-2"
          style={{ animation: 'fadeSlideUp 0.15s ease-out forwards' }}>
          {options.map(([v, l]) => (
            <button
              key={v}
              onClick={() => { onChange(v); setIsOpen(false) }}
              className={`w-full text-left px-5 py-3 text-sm transition-colors hover:bg-white/5 ${value === v ? 'text-white bg-white/5 font-black' : 'text-gray-400 font-medium'}`}
            >
              {l}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Modal de Nova Despesa ────────────────────────────────────────────────────

function ModalNovaDespesa({ onClose, onSave, loading, initialData }) {
  const [form, setForm] = useState(initialData ? {
    ...initialData,
    amount: initialData.amount?.toString() || '',
    isRecurring: initialData.isRecurring ? 'Sim' : 'Não'
  } : {
    description: '',
    category: 'Aluguel',
    amount: '',
    dueDate: '',
    status: 'pending',
    costType: 'Fixo',
    isRecurring: 'Não'
  })
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.description || !form.amount || !form.dueDate) return
    onSave({
      ...form,
      amount: Number(form.amount),
      isRecurring: form.isRecurring === 'Sim'
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-[#0f0f0f] border border-white/10 rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/5 bg-white/[0.02]">
          <div>
            <h3 className="text-sm font-black text-white uppercase tracking-widest">{initialData ? 'Editar Despesa' : 'Nova Despesa'}</h3>
            <p className="text-[10px] text-gray-500 font-bold mt-0.5 uppercase tracking-wider">{initialData ? 'Altere as informações do custo' : 'Registre um custo operacional'}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Descrição</label>
            <input required type="text" placeholder="Ex: Aluguel do galpão"
              className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/25 placeholder-gray-600"
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Categoria</label>
              <div className="relative">
                <select value={form.category} onChange={e => set('category', e.target.value)}
                  className="w-full appearance-none bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none pr-8">
                  {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Status</label>
              <div className="relative">
                <select value={form.status} onChange={e => set('status', e.target.value)}
                  className="w-full appearance-none bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none pr-8">
                  <option value="pending">Pendente</option>
                  <option value="paid">Pago</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Valor (R$)</label>
              <input required type="number" step="0.01" min="0" placeholder="0,00"
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/25 font-mono placeholder-gray-600"
                value={form.amount} onChange={e => set('amount', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Vencimento</label>
              <input required type="date"
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-white/25 [color-scheme:dark]"
                value={form.dueDate} onChange={e => set('dueDate', e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Tipo de Custo</label>
              <div className="relative">
                <select value={form.costType} onChange={e => set('costType', e.target.value)}
                  className="w-full appearance-none bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none pr-8">
                  <option value="Fixo">Fixo</option>
                  <option value="Variável">Variável</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Recorrente?</label>
              <div className="relative">
                <select value={form.isRecurring} onChange={e => set('isRecurring', e.target.value)}
                  className="w-full appearance-none bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none pr-8">
                  <option value="Não">Não</option>
                  <option value="Sim">Sim</option>
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
              </div>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-2xl bg-white/5 border border-white/10 text-sm font-bold text-gray-400 hover:text-white transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-black uppercase tracking-wide transition-all flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-rose-900/30">
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowDownCircle size={16} />}
              {loading ? 'Salvando...' : 'Registrar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const { expenses, loadingExpenses, addExpense, updateExpense, deleteExpense } = useFinance()

  const [showModal, setShowModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editData, setEditData] = useState(null)
  const [showMenu, setShowMenu] = useState(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0, height: 0 })
  const [deleteDialogExpense, setDeleteDialogExpense] = useState(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [catFilter, setCatFilter] = useState('todas')

  // Fecha o menu ao rolar a página
  useEffect(() => {
    if (!showMenu) return
    const handleScroll = () => setShowMenu(null)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [showMenu])

  // KPIs
  const kpis = useMemo(() => {
    const agora = new Date()
    const mesAtual = agora.getMonth()
    const anoAtual = agora.getFullYear()

    const mesPassado = mesAtual === 0 ? 11 : mesAtual - 1
    const anoMesPassado = mesAtual === 0 ? anoAtual - 1 : anoAtual

    const doMes = expenses.filter(d => {
      if (!d.dueDate) return false
      const dt = new Date(d.dueDate + 'T12:00:00')
      return dt.getMonth() === mesAtual && dt.getFullYear() === anoAtual
    })

    const doMesAnterior = expenses.filter(d => {
      if (!d.dueDate) return false
      const dt = new Date(d.dueDate + 'T12:00:00')
      return dt.getMonth() === mesPassado && dt.getFullYear() === anoMesPassado
    })

    const totalMesAtual = doMes.reduce((s, d) => s + (Number(d.amount) || 0), 0)
    const totalMesAnterior = doMesAnterior.reduce((s, d) => s + (Number(d.amount) || 0), 0)

    let variacao = 0
    if (totalMesAnterior > 0) {
      variacao = ((totalMesAtual - totalMesAnterior) / totalMesAnterior) * 100
    }

    const pendentes = expenses.filter(d => d.status === 'pending')
    const pagas = expenses.filter(d => d.status === 'paid')
    const recorrentes = expenses.filter(d => d.isRecurring)

    return {
      totalMes: totalMesAtual,
      qtdMes: doMes.length,

      totalPendente: pendentes.reduce((s, d) => s + (Number(d.amount) || 0), 0),
      qtdPendente: pendentes.length,

      totalPago: pagas.reduce((s, d) => s + (Number(d.amount) || 0), 0),
      qtdPago: pagas.length,

      totalRecorrente: recorrentes.reduce((s, d) => s + (Number(d.amount) || 0), 0),
      qtdRecorrente: recorrentes.length,

      variacao,
      hasPrevMonth: totalMesAnterior > 0 || doMesAnterior.length > 0
    }
  }, [expenses])

  const hasFilters = searchTerm || statusFilter !== 'todos' || catFilter !== 'todas'

  const filtered = useMemo(() => expenses.filter(d => {
    const byText = (d.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.category?.toLowerCase().includes(searchTerm.toLowerCase()))
    const byStatus = statusFilter === 'todos' || d.status === statusFilter
    const byCat = catFilter === 'todas' || d.category === catFilter
    return byText && byStatus && byCat
  }), [expenses, searchTerm, statusFilter, catFilter])

  const handleSave = async (data) => {
    setSaving(true)
    try {
      if (editData) {
        await updateExpense(editData.id, data)
      } else {
        await addExpense(data)
      }
      setShowModal(false)
      setEditData(null)
    }
    catch (err) { console.error('Erro ao salvar despesa:', err) }
    finally { setSaving(false) }
  }

  return (
    <>
      {showModal && (
        <ModalNovaDespesa
          onClose={() => { setShowModal(false); setEditData(null) }}
          onSave={handleSave}
          loading={saving}
          initialData={editData}
        />
      )}

      <MobileHeader
        title="Despesas"
        actions={
          <button onClick={() => setShowModal(true)}
            className="p-2.5 rounded-xl bg-rose-600 text-white active:scale-90 transition-transform shadow-lg shadow-rose-900/30">
            <Plus size={20} strokeWidth={3} />
          </button>
        }
      />
      <PageHeader
        icon={ArrowDownCircle}
        title="DESPESAS"
        subtitle="GESTÃO DE CUSTOS E SAÍDAS OPERACIONAIS"
        extra={null}

      />

      <div className="px-4 md:px-6 py-6 pb-12 fade-slide-up space-y-6">

        {/* KPIs — grid com 5 colunas no desktop */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 md:gap-5">
          <KPICard
            title="Despesas do Mês"
            value={R$(kpis.totalMes)}
            description={`${kpis.qtdMes} despesa(s) registrada(s)`}
            icon={ArrowDownCircle}
            iconColor="text-rose-500"
            valueColor="text-white"
          />
          <KPICard
            title="A Pagar"
            value={R$(kpis.totalPendente)}
            description={`${kpis.qtdPendente} conta(s) pendente(s)`}
            icon={Clock}
            iconColor="text-orange-500"
            valueColor="text-orange-400"
            onClick={() => setStatusFilter(statusFilter === 'pending' ? 'todos' : 'pending')}
            active={statusFilter === 'pending'}
          />
          <KPICard
            title="Pagas"
            value={R$(kpis.totalPago)}
            description={`${kpis.qtdPago} conta(s) paga(s)`}
            icon={CheckCircle2}
            iconColor="text-emerald-500"
            valueColor="text-emerald-400"
            onClick={() => setStatusFilter(statusFilter === 'paid' ? 'todos' : 'paid')}
            active={statusFilter === 'paid'}
          />
          <KPICard
            title="Recorrentes"
            value={R$(kpis.totalRecorrente)}
            description={`${kpis.qtdRecorrente} despesa(s) recorrente(s)`}
            icon={Calendar}
            iconColor="text-yellow-500"
            valueColor="text-white"
          />
          <KPICard
            title="Variação Mensal"
            value={`${kpis.variacao > 0 ? '+' : ''}${kpis.variacao.toFixed(1)}%`}
            description="vs. mês anterior"
            icon={kpis.variacao >= 0 ? TrendingUp : TrendingDown}
            iconColor={kpis.variacao <= 0 ? 'text-emerald-500' : 'text-rose-500'}
            valueColor={kpis.variacao <= 0 ? 'text-emerald-400' : 'text-rose-400'}
          />
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2 w-full">
          <div className="flex-1 relative group">
            <Search size={18} strokeWidth={1.9} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-white transition-colors" />
            <input
              className="w-full bg-[#111] border border-white/5 rounded-xl pl-12 pr-4 py-3.5 text-sm text-white focus:outline-none focus:border-white/10 transition-all font-medium"
              placeholder="Buscar por descrição ou categoria..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <button onClick={() => setShowModal(true)}
            className="flex items-center justify-center gap-2 px-4 md:px-6 h-[46px] rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap bg-primary text-white shadow-xl shadow-primary/20 hover:shadow-primary/30"
          >
            <Plus size={18} strokeWidth={2.5} /> 
            <span className="hidden md:inline">NOVA DESPESA</span>
          </button>

          {hasFilters && (
            <button
              onClick={() => { setSearchTerm(''); setStatusFilter('todos'); setCatFilter('todas') }}
              className="flex items-center justify-center gap-2 px-4 md:px-6 h-[46px] rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95 whitespace-nowrap bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20"
            >
              <RefreshCcw size={18} strokeWidth={1.9} /> 
              <span className="hidden md:inline">Limpar Filtros</span>
            </button>
          )}
        </div>

        {/* Container principal */}
        <div className="bg-[#0B0B0D]/80 backdrop-blur-md rounded-[24px] p-6 md:p-8 border border-white/5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/5 to-transparent opacity-50" />

          {/* Filtros */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <CustomSelect
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                ['todos', 'Todos'],
                ['paid', 'Pagos'],
                ['pending', 'Pendentes'],
              ]}
            />
            <CustomSelect
              label="Categoria"
              value={catFilter}
              onChange={setCatFilter}
              options={[['todas', 'Todas'], ...CATEGORIAS.map(c => [c, c])]}
            />
            <div className="col-span-2 flex items-end">
              <p className="text-[11px] text-gray-600 font-bold ml-1">
                Exibindo <span className="text-gray-400">{filtered.length}</span> de <span className="text-gray-400">{expenses.length}</span> despesas
              </p>
            </div>
          </div>

          {/* Tabela */}
          <div className="w-full overflow-x-auto rounded-2xl border border-white/5 bg-black/20">
            {loadingExpenses ? (
              <div className="text-center py-16 text-gray-500">Carregando despesas...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <ArrowDownCircle size={48} strokeWidth={1.5} className="mx-auto mb-4 opacity-20" />
                <p className="text-sm font-medium">Nenhuma despesa encontrada.</p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[640px]">
                <thead>
                  <tr className="border-b border-white/10 text-[10px] uppercase font-black text-gray-500 tracking-wider bg-white/5">
                    <th className="py-3 px-5">Data</th>
                    <th className="py-3 px-5 text-center">Categoria</th>
                    <th className="py-3 px-5">Descrição</th>
                    <th className="py-3 px-5 text-right">Valor</th>
                    <th className="py-3 px-5 text-center">Status</th>
                    <th className="py-3 px-5 text-center hidden md:table-cell">Tipo de Custo</th>
                    <th className="py-3 px-5 text-center hidden md:table-cell">Recorrente</th>
                    <th className="py-3 px-5 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map(d => (
                    <tr key={d.id} className="hover:bg-white/5 transition-colors group">
                      <td className="py-4 px-5 font-mono text-xs text-gray-400">
                        {dataBR(d.dueDate)}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-[9px] text-gray-400 uppercase font-black whitespace-nowrap">
                          {d.category || 'Outros'}
                        </span>
                      </td>
                      <td className="py-4 px-5">
                        <span className="text-sm text-app font-medium uppercase tracking-tight group-hover:text-primary transition-colors">
                          {d.description}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-right font-black text-sm text-white font-mono">
                        {R$(d.amount)}
                      </td>
                      <td className="py-4 px-5 text-center">
                        <span className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider border inline-flex ${STATUS_STYLE[d.status] || STATUS_STYLE.pending}`}>
                          {STATUS_LABEL[d.status] || d.status}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-center hidden md:table-cell">
                        <span className="px-2.5 py-1 rounded-lg bg-white/5 text-[10px] text-gray-400 uppercase font-bold border border-white/5">
                          {d.costType || 'Fixo'}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-center hidden md:table-cell">
                        <span className="px-2.5 py-1 rounded-lg bg-white/5 text-[10px] text-gray-400 uppercase font-bold border border-white/5">
                          {d.isRecurring ? 'Sim' : 'Não'}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-center">
                        <div className="relative inline-block">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              const rect = e.currentTarget.getBoundingClientRect()
                              const openUp = window.innerHeight - rect.bottom < 300
                              setMenuPosition({
                                top: openUp ? (rect.top + window.scrollY) - 180 : (rect.top + window.scrollY) + rect.height + 4,
                                left: (rect.left + window.scrollX) - 160 + rect.width,
                                originY: openUp ? 1 : 0
                              })
                              setShowMenu(showMenu === d.id ? null : d.id)
                            }}
                            className={`p-2.5 rounded-xl transition-all active:scale-90 border border-transparent flex items-center justify-center mx-auto ${showMenu === d.id ? 'bg-white/10 text-white border-white/10' : 'hover:bg-white/10 text-white/20 hover:text-white hover:border-white/10'}`}
                          >
                            <MoreVertical size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <ModalNovaDespesa
          onClose={() => { setShowModal(false); setEditData(null) }}
          onSubmit={async (data) => {
            if (editData) {
              await updateExpense(editData.id, data)
            } else {
              await addExpense(data)
            }
            setShowModal(false)
            setEditData(null)
          }}
          initialData={editData}
        />
      )}

      {deleteDialogExpense && (
        <DeleteConfirmSimple
          expense={deleteDialogExpense}
          onConfirm={async () => {
            await deleteExpense(deleteDialogExpense.id)
            setDeleteDialogExpense(null)
          }}
          onClose={() => setDeleteDialogExpense(null)}
        />
      )}

      <AnimatePresence>
        {showMenu && (
          <ExpenseActionMenu
            expense={filtered.find(e => e.id === showMenu)}
            menuPosition={menuPosition}
            onClose={() => setShowMenu(null)}
            onAction={(type, item) => {
              if (type === 'edit') {
                setEditData(item)
                setShowModal(true)
              } else if (type === 'delete') {
                setDeleteDialogExpense(item)
              } else if (type === 'toggleStatus') {
                updateExpense(item.id, { status: item.status === 'paid' ? 'pending' : 'paid' })
              }
              setShowMenu(null)
            }}
          />
        )}
      </AnimatePresence>

      <style>{`@keyframes fadeSlideUp { from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)} }`}</style>
    </>
  )
}

/**
 * Menu de Ações — Desktop e Mobile
 */
function ExpenseActionMenu({ expense, menuPosition, onClose, onAction }) {
  if (!expense) return null

  return createPortal(
    <div className="fixed inset-0 z-[1000]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none" onClick={onClose} />

      {/* Desktop Menu */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        className="hidden md:block absolute z-[1001] w-56 bg-[#0F0F0F] border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-2"
        style={{
          top: menuPosition.top,
          left: menuPosition.left,
          originY: menuPosition.originY
        }}
      >
        <button onClick={() => onAction('toggleStatus', expense)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-all group font-medium">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${expense.status === 'paid' ? 'bg-orange-500/10 group-hover:bg-orange-500/20' : 'bg-emerald-500/10 group-hover:bg-emerald-500/20'}`}>
            {expense.status === 'paid' ? <Clock size={14} className="text-orange-400" /> : <CheckCircle2 size={14} className="text-emerald-400" />}
          </div>
          {expense.status === 'paid' ? 'Marcar como Pendente' : 'Marcar como Pago'}
        </button>

        <button onClick={() => onAction('edit', expense)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-all group font-medium">
          <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
            <Edit2 size={14} className="text-blue-400" />
          </div>
          Editar Despesa
        </button>

        <div className="h-px bg-white/5 my-1" />

        <button onClick={() => onAction('delete', expense)} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-all group font-medium">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center group-hover:bg-red-500/20 transition-colors">
            <Trash2 size={14} className="text-red-500" />
          </div>
          Remover
        </button>
      </motion.div>

      {/* Mobile Drawer */}
      <div className="md:hidden">
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed inset-x-0 bottom-0 bg-[#0A0A0A] border-t border-white/10 rounded-t-[32px] p-6 pb-12 z-[1002] shadow-[0_-8px_30px_rgb(0,0,0,0.8)]"
        >
          <div className="w-12 h-1.5 bg-white/15 rounded-full mx-auto mb-6" />
          <div className="mb-6">
            <p className="text-base font-black text-white truncate">{expense.description}</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{expense.category || 'Despesa'}</p>
          </div>

          <div className="space-y-3">
            <button onClick={() => onAction('toggleStatus', expense)} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 text-sm font-bold text-white">
              {expense.status === 'paid' ? <Clock size={18} className="text-orange-400" /> : <CheckCircle2 size={18} className="text-emerald-400" />}
              {expense.status === 'paid' ? 'Marcar como Pendente' : 'Marcar como Pago'}
            </button>
            <button onClick={() => onAction('edit', expense)} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 text-sm font-bold text-white">
              <Edit2 size={18} className="text-blue-400" /> Editar Despesa
            </button>
            <button onClick={() => onAction('delete', expense)} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-red-500/10 border border-red-500/10 text-sm font-bold text-red-500">
              <Trash2 size={18} /> Remover Definitivamente
            </button>
          </div>
        </motion.div>
      </div>
    </div>,
    document.body
  )
}

/**
 * Diálogo de Confirmação Simples
 */
function DeleteConfirmSimple({ expense, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false)

  return (
    <div className="fixed inset-0 z-[9995] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-[32px] overflow-hidden border border-white/10 shadow-2xl bg-[#0d0d0d] p-8 space-y-6"
        style={{ animation: 'fadeSlideUp 0.22s ease both' }}>

        <div className="w-16 h-16 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto">
          <Trash2 size={32} className="text-red-500" />
        </div>

        <div className="text-center space-y-2">
          <h2 className="text-xl font-black text-white">Tem certeza?</h2>
          <p className="text-xs text-gray-500 leading-relaxed px-4">
            Você está prestes a excluir a despesa <strong>{expense.description}</strong> no valor de <strong>{R$(expense.amount)}</strong>.
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <button onClick={onClose} className="flex-1 py-4 rounded-2xl text-sm font-black text-gray-400 bg-white/5 border border-white/10 hover:bg-white/10 transition-all">
            Cancelar
          </button>
          <button
            onClick={async () => {
              setLoading(true)
              try { await onConfirm() } catch (e) { setLoading(false) }
            }}
            disabled={loading}
            className="flex-1 py-4 rounded-2xl text-sm font-black bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/20 transition-all disabled:opacity-50"
          >
            {loading ? 'Excluindo...' : 'Sim, Excluir'}
          </button>
        </div>
      </div>
    </div>
  )
}

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, FileText, ChevronDown, Search, Calendar, Download, Printer, Eye } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useModalities } from '../../hooks/useModalities'
import { usePaymentReport } from '../../hooks/usePaymentReport'
import { useHideMobileNav } from '../../hooks/useHideMobileNav'

const R$ = (v) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v || 0)

const formatDate = (date) => {
  if (!date) return '-'
  if (typeof date === 'string') return date
  if (date.seconds) return new Date(date.seconds * 1000).toLocaleDateString('pt-BR')
  return '-'
}

function CustomSelect({ label, value, onChange, options, disabled, placeholder = '...' }) {
  const [isOpen, setIsOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    function handleClickOutside(e) { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false) }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  const selectedOption = options.find(o => o[0] === value) || null
  return (
    <div className={`flex flex-col gap-1.5 relative w-full ${isOpen ? 'z-[500]' : 'z-10'}`} ref={ref}>
      <label className="text-[10px] font-black uppercase tracking-widest text-gray-500 ml-1">{label}</label>
      <button type="button" disabled={disabled} onClick={() => !disabled && setIsOpen(!isOpen)} className={`form-input bg-black opacity-100 h-[54px] text-sm px-6 text-gray-300 font-medium text-left flex justify-between items-center w-full disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 rounded-2xl transition-all hover:bg-[#080808] focus:ring-1 focus:ring-white/20 ${isOpen ? 'ring-1 ring-primary/50 border-primary/50' : ''}`}>
        <span className="truncate font-bold">{selectedOption ? selectedOption[1] : placeholder}</span>
        <ChevronDown size={14} className={`text-gray-500 transition-transform duration-300 shrink-0 ml-2 ${isOpen ? 'rotate-180 text-primary' : ''}`} />
      </button>
      {isOpen && !disabled && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-full min-w-[200px] bg-[#0B0B0B] opacity-100 border border-white/10 rounded-2xl z-[600] overflow-hidden shadow-2xl py-2 animate-in fade-in slide-in-from-top-2 duration-200">
          {options.map(([v, l]) => (
            <button key={v} type="button" onClick={() => { onChange(v); setIsOpen(false) }} className={`w-full text-left px-6 py-4 text-[11px] font-black uppercase tracking-wider transition-colors hover:bg-white/5 border-b border-white/[0.02] last:border-0 ${value === v ? 'text-primary bg-primary/5' : 'text-gray-400'}`}>{l}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function PaymentReportView({ data, filters }) {
  if (!data || !data.modalities || data.modalities.length === 0) {
    return (
      <div className="p-12 text-center">
        <p className="text-sm text-gray-500 uppercase tracking-widest font-bold">Nenhum registro encontrado</p>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      {data.modalities.map(mod => (
        <div key={mod.name} className="border border-white/5 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 bg-white/[0.02] border-b border-white/5 flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-white uppercase tracking-wider">{mod.name}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">{mod.bills.length} registros</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Total</p>
              <p className="text-base font-black text-white">{R$(mod.totalAmount)}</p>
            </div>
          </div>
          {mod.turmas.map(turma => (
            <div key={turma.name} className="border-b border-white/[0.02] last:border-0">
              <div className="px-6 py-3 bg-white/[0.01] border-b border-white/[0.02] flex items-center justify-between">
                <div className="pl-4">
                  <p className="text-[11px] font-bold text-gray-300 uppercase tracking-wider">{turma.name}</p>
                  <p className="text-[9px] text-gray-600">{turma.bills.length} registros</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-white">{R$(turma.totalAmount)}</p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-4 py-2 text-[9px] font-black text-gray-600 uppercase tracking-widest">Aluno</th>
                      <th className="text-left px-4 py-2 text-[9px] font-black text-gray-600 uppercase tracking-widest">Mês Ref.</th>
                      <th className="text-left px-4 py-2 text-[9px] font-black text-gray-600 uppercase tracking-widest">Vencimento</th>
                      <th className="text-left px-4 py-2 text-[9px] font-black text-gray-600 uppercase tracking-widest">Pagamento</th>
                      <th className="text-right px-4 py-2 text-[9px] font-black text-gray-600 uppercase tracking-widest">Valor</th>
                      <th className="text-center px-4 py-2 text-[9px] font-black text-gray-600 uppercase tracking-widest">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {turma.bills.map((bill, idx) => (
                      <tr key={bill.id} className={`border-b border-white/[0.02] ${idx % 2 === 0 ? 'bg-transparent' : 'bg-white/[0.01]'}`}>
                        <td className="px-4 py-3 text-[11px] font-medium text-gray-200 truncate max-w-[200px]">{bill.studentName}</td>
                        <td className="px-4 py-3 text-[11px] text-gray-400">{bill.referenceMonth || '-'}</td>
                        <td className="px-4 py-3 text-[11px] text-gray-400">{bill.dueDate || '-'}</td>
                        <td className="px-4 py-3 text-[11px] text-gray-400">{formatDate(bill.paidAt)}</td>
                        <td className="px-4 py-3 text-[11px] font-bold text-white text-right">{R$(bill.amount)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${bill.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : bill.status === 'overdue' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>
                            {bill.status === 'paid' ? 'Pago' : bill.status === 'overdue' ? 'Atrasado' : 'Pendente'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          <div className="px-6 py-3 bg-white/[0.02] border-t border-white/5 flex items-center justify-between">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Subtotal {mod.name}</p>
            <div className="flex gap-6 text-right">
              <div><p className="text-[9px] text-gray-600 uppercase">Pago</p><p className="text-xs font-bold text-emerald-400">{R$(mod.totalPaid)}</p></div>
              <div><p className="text-[9px] text-gray-600 uppercase">Pendente</p><p className="text-xs font-bold text-amber-400">{R$(mod.totalPending)}</p></div>
              <div><p className="text-[9px] text-gray-600 uppercase">Atrasado</p><p className="text-xs font-bold text-rose-400">{R$(mod.totalOverdue)}</p></div>
            </div>
          </div>
        </div>
      ))}
      <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between">
        <p className="text-sm font-black text-white uppercase tracking-wider">Total Geral</p>
        <div className="flex gap-8 text-right">
          <div><p className="text-[9px] text-gray-600 uppercase">Pago</p><p className="text-base font-black text-emerald-400">{R$(data.totalPaid)}</p></div>
          <div><p className="text-[9px] text-gray-600 uppercase">Pendente</p><p className="text-base font-black text-amber-400">{R$(data.totalPending)}</p></div>
          <div><p className="text-[9px] text-gray-600 uppercase">Atrasado</p><p className="text-base font-black text-rose-400">{R$(data.totalOverdue)}</p></div>
          <div><p className="text-[9px] text-gray-600 uppercase">Total</p><p className="text-xl font-black text-white">{R$(data.totalAmount)}</p></div>
        </div>
      </div>
    </div>
  )
}

export default function PaymentReportModal({ isOpen, onClose }) {
  useHideMobileNav(isOpen)
  const { modalities, turmas, loading: loadingModalities } = useModalities()
  const { groupedData, filters, updateFilters, resetFilters, loading } = usePaymentReport()
  const [showReport, setShowReport] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const reportRef = useRef(null)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640)
    window.addEventListener('resize', handleResize)
    handleResize()
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const yearOptions = [
    ['', 'Todos os Anos'],
    ...Array.from({ length: 5 }, (_, i) => {
      const y = new Date().getFullYear() - i
      return [y.toString(), y.toString()]
    })
  ]
  const statusOptions = [
    ['', 'Todas'],
    ['pending', 'Pendente'],
    ['paid', 'Pago'],
    ['overdue', 'Atrasado'],
  ]
  const modalityOptions = [
    ['', 'Todas Modalidades'],
    ...(modalities || []).map(m => [m.id, m.name])
  ]
  const turmaOptions = [
    ['', 'Todas Turmas'],
    ...(turmas || []).map(t => [t.id, t.name])
  ]

  const handlePrint = () => window.print()
  const handlePDF = () => {
    if (reportRef.current) {
      window.print()
    }
  }

  if (!isOpen) return null

  if (showReport) {
    return createPortal(
      <div className="fixed inset-0 z-[10000] flex flex-col bg-[#0a0a0a] animate-in fade-in duration-300">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-black shrink-0">
          <h2 className="text-sm font-black text-white uppercase tracking-wider">Relatório de Pagamentos</h2>
          <div className="flex gap-3">
            <button onClick={handlePDF} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black text-gray-300 uppercase tracking-widest transition-all">
              <Download size={14} /> PDF
            </button>
            <button onClick={handlePrint} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black text-gray-300 uppercase tracking-widest transition-all">
              <Printer size={14} /> Imprimir
            </button>
            <button onClick={() => setShowReport(false)} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black text-gray-300 uppercase tracking-widest transition-all">
              <X size={14} /> Fechar
            </button>
          </div>
        </div>
        <div ref={reportRef} className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="mb-6 text-[10px] text-gray-600 uppercase tracking-widest flex gap-6 flex-wrap">
            <span>Data: {new Date().toLocaleDateString('pt-BR')}</span>
            <span>Hora: {new Date().toLocaleTimeString('pt-BR')}</span>
            <span>Modalidade: {filters.modalityId ? (modalidades.find(m => m.id === filters.modalityId)?.name || '-') : 'Todas'}</span>
            <span>Turma: {filters.turmaId ? (turmas.find(t => t.id === filters.turmaId)?.name || '-') : 'Todas'}</span>
            <span>Ano: {filters.year}</span>
            <span>Status: {statusOptions.find(o => o[0] === filters.status)?.[1] || 'Todas'}</span>
          </div>
          {loading ? (
            <div className="flex items-center justify-center h-40"><p className="text-sm text-gray-500">Carregando...</p></div>
          ) : (
            <PaymentReportView data={groupedData} filters={filters} />
          )}
        </div>
      </div>, document.body
    )
  }

  return createPortal(
    <motion.div className="modal-backdrop z-[1000]" onClick={onClose} animate={{ opacity: 1 }} initial={{ opacity: 0 }} exit={{ opacity: 0 }}>
      <motion.div onClick={e => e.stopPropagation()} drag={isMobile ? "y" : false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.2} onDragEnd={(e, info) => { if (info.offset.y > 100 || info.velocity.y > 500) onClose() }} initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }} className="fixed z-[1001] bg-[#0d0d0d] border border-white/10 shadow-2xl flex flex-col overflow-hidden
          inset-x-0 bottom-0 h-[95vh] rounded-t-[32px]
          sm:inset-auto sm:top-1/2 sm:left-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-w-2xl sm:w-full sm:h-auto sm:max-h-[90vh] sm:rounded-[32px]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/5 flex items-center justify-center"><FileText size={16} className="text-rose-400" /></div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider">Relatório de Pagamentos</h2>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest">Por Turma / Modalidade</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-white/5 transition-colors"><X size={18} className="text-gray-500" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CustomSelect label="Modalidade" value={filters.modalityId} onChange={v => updateFilters('modalityId', v)} options={modalityOptions} disabled={loadingModalities} placeholder="Todas Modalidades" />
            <CustomSelect label="Turma" value={filters.turmaId} onChange={v => updateFilters('turmaId', v)} options={turmaOptions} placeholder="Todas Turmas" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CustomSelect label="Situação" value={filters.status} onChange={v => updateFilters('status', v)} options={statusOptions} placeholder="Todas" />
            <CustomSelect label="Ano" value={filters.year} onChange={v => updateFilters('year', v)} options={yearOptions} />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">Aluno</label>
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
              <input type="text" value={filters.studentName} onChange={e => updateFilters('studentName', e.target.value)} className="w-full pl-10 pr-4 py-3 bg-black border border-white/10 rounded-2xl text-sm text-white focus:outline-none focus:border-white/20 transition-all font-medium" placeholder="Buscar por nome..." />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">Data Início</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                <input type="date" value={filters.startDate} onChange={e => updateFilters('startDate', e.target.value)} className="w-full pl-10 pr-4 py-3 bg-black border border-white/10 rounded-2xl text-sm text-white focus:outline-none focus:border-white/20 transition-all font-medium" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500 uppercase tracking-widest font-bold ml-1">Data Fim</label>
              <div className="relative">
                <Calendar size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
                <input type="date" value={filters.endDate} onChange={e => updateFilters('endDate', e.target.value)} className="w-full pl-10 pr-4 py-3 bg-black border border-white/10 rounded-2xl text-sm text-white focus:outline-none focus:border-white/20 transition-all font-medium" />
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 bg-[#0a0a0a] border-t border-white/5 flex gap-4 shrink-0">
          <button onClick={resetFilters} className="flex-1 py-4 rounded-2xl bg-white/5 text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-all">Limpar Filtros</button>
          <button onClick={() => setShowReport(true)} disabled={loading} className="flex-[2] py-4 rounded-2xl bg-rose-600 text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-rose-600/30 hover:bg-rose-500 transition-all disabled:opacity-30">Gerar Relatório</button>
        </div>
      </motion.div>
    </motion.div>, document.body
  )
}
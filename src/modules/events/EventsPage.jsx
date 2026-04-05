import React, { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BellRing,
  AlertTriangle,
  Siren,
  Eye,
  Plus,
  Search,
  MoreVertical,
  Calendar,
  Trash2,
  Edit2,
  ImagePlus,
  Hash,
  Check,
  X,
} from 'lucide-react'
import { useNotices } from '../../hooks/useNotices'
import PageHeader from '../../components/shared/PageHeader'
import KPICard from '../../components/shared/KPICard'
import MobileHeader from '../../components/navigation/MobileHeader'

// ────────────────────────────────────────────────
//  INLINE FORM COMPONENT
// ────────────────────────────────────────────────
function InlinePostForm({ onSave, onCancel, initialData }) {
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [priority, setPriority] = useState(initialData?.priority || 'normal')
  const [type, setType] = useState(initialData?.type || 'aviso')
  const textareaRef = useRef(null)

  const tags = [
    {
      id: 'normal',
      label: '# Normal',
      baseClass: 'bg-white/5 text-gray-500 hover:bg-white/10 border-transparent',
      activeClass: 'bg-white/10 text-gray-200 border border-white/20',
    },
    {
      id: 'alta',
      label: '⚡ Alta Prioridade',
      baseClass: 'bg-white/5 text-gray-500 hover:bg-yellow-500/10 hover:text-yellow-400 border-transparent',
      activeClass: 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30',
    },
    {
      id: 'urgente',
      label: '🚨 Urgente',
      baseClass: 'bg-white/5 text-gray-500 hover:bg-primary/10 hover:text-primary border-transparent',
      activeClass: 'bg-primary/10 text-primary border border-primary/30',
    },
    {
      id: 'evento',
      label: '📅 Evento',
      baseClass: 'bg-white/5 text-gray-500 hover:bg-emerald-500/10 hover:text-emerald-400 border-transparent',
      activeClass: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30',
    },
  ]

  const handleAutoResize = (e) => {
    e.target.style.height = 'auto'
    e.target.style.height = e.target.scrollHeight + 'px'
  }

  const handlePublish = async () => {
    if (!title.trim() || !description.trim()) return
    await onSave({ title, description, priority, type })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="mb-6 rounded-xll overflow-hidden shadow-2xl"
      style={{
        background: 'var(--clr-surface)',
        border: '1px solid color-mix(in srgb, var(--clr-primary-dark) 45%, transparent)',
        boxShadow: '0 8px 48px rgba(0,0,0,0.6), 0 0 30px color-mix(in srgb, var(--clr-primary-dark) 12%, transparent)',
      }}
    >
      {/* HEADER BAR */}
      <div
        className="flex items-center justify-between px-6 py-3"
        style={{ borderBottom: '1px solid color-mix(in srgb, var(--clr-primary-dark) 20%, transparent)', background: 'color-mix(in srgb, var(--clr-primary-dark) 5%, transparent)' }}
      >
        <span className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <BellRing size={18} strokeWidth={1.9} style={{ color: 'var(--clr-primary)' }} />
          {initialData ? 'Editar aviso' : 'Novo evento / aviso'}
        </span>
        <button onClick={onCancel} className="text-gray-600 hover:text-white transition-colors p-1.5 bg-white/5 rounded-md">
          <X size={18} strokeWidth={1.9} />
        </button>
      </div>

      {/* BODY */}
      <div className="relative px-6 pt-5 pb-2">
        {/* IMAGE UPLOAD BUTTON */}
        <div className="absolute top-5 right-6">
          <button
            className="w-14 h-14 flex flex-col items-center justify-center gap-1 rounded-md text-gray-600 hover:text-gray-400 transition-all"
            style={{ border: '1px dashed color-mix(in srgb, var(--clr-primary-dark) 30%, transparent)', background: 'color-mix(in srgb, var(--clr-primary-dark) 4%, transparent)' }}
          >
            <ImagePlus size={18} strokeWidth={1.9} />
            <span className="text-[9px] font-medium leading-none">Imagem</span>
          </button>
        </div>

        {/* TITLE INPUT */}
        <input
          type="text"
          placeholder="Título"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full bg-transparent text-[22px] font-bold text-white placeholder-gray-700 outline-none pr-20 mb-3 leading-tight"
          autoFocus
        />

        {/* DIVIDER */}
        <div className="h-px mb-3" style={{ background: 'color-mix(in srgb, var(--clr-primary-dark) 20%, transparent)' }} />

        {/* MESSAGE TEXTAREA */}
        <textarea
          ref={textareaRef}
          rows={3}
          placeholder="Inserir mensagem..."
          value={description}
          onChange={e => {
            setDescription(e.target.value)
            handleAutoResize(e)
          }}
          className="w-full bg-transparent text-gray-300 text-sm placeholder-gray-600 outline-none resize-none min-h-[80px] leading-relaxed"
        />
      </div>

      {/* FOOTER */}
      <div
        className="px-6 py-3 flex items-center justify-between gap-3 flex-wrap"
        style={{ borderTop: '1px solid color-mix(in srgb, var(--clr-primary-dark) 20%, transparent)', background: 'rgba(0,0,0,0.3)' }}
      >
        {/* TAG PILLS */}
        <div className="flex items-center gap-2 flex-wrap">
          {tags.map(tag => {
            const isActive = tag.id === 'evento'
              ? type === 'evento'
              : priority === tag.id && type !== 'evento'
            return (
              <button
                key={tag.id}
                onClick={() => {
                  if (tag.id === 'evento') { setType('evento'); setPriority('normal') }
                  else { setType('aviso'); setPriority(tag.id) }
                }}
                className={`px-3 py-1.5 rounded-xll text-[11px] font-bold tracking-wide flex items-center gap-1.5 transition-all duration-150 border ${isActive ? tag.activeClass : tag.baseClass}`}
              >
                {isActive && <Check size={14} strokeWidth={2.5} />}
                {tag.label}
              </button>
            )
          })}
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-md text-sm text-gray-500 hover:text-white hover:bg-white/5 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handlePublish}
            disabled={!title.trim() || !description.trim()}
            className="btn-primary px-5 py-2 rounded-xll text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 transition-all active:scale-95"
            style={{ background: 'linear-gradient(135deg, var(--clr-primary-dark), var(--clr-primary))' }}
          >
            Publicar
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ────────────────────────────────────────────────
//  MAIN PAGE
// ────────────────────────────────────────────────
export default function EventsPage() {
  const { notices, loading, addNotice, updateNotice, deleteNotice } = useNotices()
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingNotice, setEditingNotice] = useState(null)
  const [activeDropdown, setActiveDropdown] = useState(null)

  // ── KPIs ──
  const totalNotices = notices.length
  const highPriority = notices.filter(n => n.priority === 'alta').length
  const urgents = notices.filter(n => n.priority === 'urgente').length
  const totalViews = notices.reduce((acc, n) => acc + (n.views || 0), 0)

  const filteredNotices = notices.filter(n =>
    n.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    n.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSave = async (data) => {
    if (editingNotice) {
      await updateNotice(editingNotice.id, data)
      setEditingNotice(null)
    } else {
      await addNotice(data)
    }
    setShowForm(false)
  }

  const handleEdit = (notice) => {
    setEditingNotice(notice)
    setShowForm(true)
    setActiveDropdown(null)
  }

  const handleDelete = async (id) => {
    if (window.confirm('Apagar este aviso permanentemente?')) {
      await deleteNotice(id)
    }
    setActiveDropdown(null)
  }

  const priorityBadge = {
    alta:    { label: 'Alta',    cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
    urgente: { label: 'Urgente', cls: 'bg-primary/10 text-primary border-primary/25'  },
  }

  return (
    <div className="flex flex-col min-h-full">
      <MobileHeader 
        title="Avisos" 
        actions={
          <button 
            onClick={() => { setEditingNotice(null); setShowForm(s => !s) }}
            className={`p-2.5 rounded-[5px] active:scale-90 transition-all shadow-lg ${showForm && !editingNotice ? 'bg-white/10 text-white' : 'bg-primary text-black shadow-primary/20'}`}
          >
            {showForm && !editingNotice ? <X size={20} strokeWidth={3} /> : <Plus size={20} strokeWidth={3} />}
          </button>
        }
      />
      
      {/* Header Desktop */}
      <PageHeader
        icon={Calendar}
        title="Avisos & Eventos"
        subtitle="Comunique-se com seus alunos em tempo real"
        loading={loading}
      />

      <div className="flex-1 px-4 md:px-6 py-6 w-full pb-20 space-y-6">

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 fade-slide-up">
          <KPICard 
            title="Total" 
            value={loading ? '...' : totalNotices} 
            description="Avisos e eventos" 
            icon={BellRing} 
          />
          <KPICard 
            title="Alta Prioridade" 
            value={loading ? '...' : highPriority} 
            description="Requer atenção" 
            icon={AlertTriangle} 
            valueColor="text-yellow-400"
          />
          <KPICard 
            title="Urgentes" 
            value={loading ? '...' : urgents} 
            description="Críticos / Alertas" 
            icon={Siren} 
            valueColor="text-primary"
          />
          <KPICard 
            title="Visualizações" 
            value={loading ? '...' : totalViews} 
            description="Total acumulado" 
            icon={Eye} 
          />
        </div>

        {/* ── ACTION BAR ── */}
        <div className="flex items-center gap-3 mb-6 fade-slide-up">
          <button
            onClick={() => { setEditingNotice(null); setShowForm(s => !s) }}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 rounded-[5px] text-sm font-bold transition-all"
          >
            {showForm && !editingNotice ? <X size={18} strokeWidth={1.9} /> : <Plus size={18} strokeWidth={1.9} />}
            {showForm && !editingNotice ? 'Cancelar' : 'Novo evento'}
          </button>

          <div
            className="flex-1 flex items-center gap-3 px-4 py-2.5 rounded-[5px] transition-colors"
            style={{ background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            <Search size={18} strokeWidth={1.9} className="text-gray-600 flex-shrink-0" />
            <input
              type="text"
              placeholder="Buscar avisos e eventos..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent outline-none text-white text-sm placeholder-gray-600 w-full"
            />
          </div>
        </div>

        {/* ── INLINE FORM ── */}
        <AnimatePresence>
          {showForm && (
            <InlinePostForm
              key={editingNotice?.id || 'new'}
              initialData={editingNotice}
              onSave={handleSave}
              onCancel={() => { setShowForm(false); setEditingNotice(null) }}
            />
          )}
        </AnimatePresence>

        {/* ── LISTA DE AVISOS ── */}
        <div className="space-y-3">
          {loading ? (
            <p className="text-center text-gray-600 py-10">Carregando avisos...</p>
          ) : filteredNotices.length === 0 ? (
            <div className="text-center py-16 stat-card rounded-[5px]">
              <BellRing size={48} strokeWidth={1.5} className="text-gray-700 mx-auto mb-4" />
              <p className="text-white font-semibold">Nenhum aviso por aqui.</p>
              <p className="text-gray-500 text-sm mt-1">Clique em "Novo evento" para criar o primeiro.</p>
            </div>
          ) : (
            filteredNotices.map((notice, i) => {
              const badge = priorityBadge[notice.priority]
              const isEvento = notice.type === 'evento'
              const dateStr = notice.createdAt?.toLocaleDateString?.('pt-BR', { day: 'numeric', month: 'short' }) || ''
              const timeStr = notice.createdAt?.toLocaleTimeString?.('pt-BR', { hour: '2-digit', minute: '2-digit' }) || ''

              return (
                <motion.div
                  key={notice.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="relative bg-white/5 border border-white/5 hover:border-white/10 p-6 rounded-[5px] group transition-all"
                >
                  {/* DROPDOWN MENU */}
                  <div className="absolute top-6 right-6 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => setActiveDropdown(activeDropdown === notice.id ? null : notice.id)}
                      className="text-gray-600 hover:text-white transition-colors p-1"
                    >
                      <MoreVertical size={18} />
                    </button>
                    <AnimatePresence>
                      {activeDropdown === notice.id && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95, y: -4 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, y: -4 }}
                          transition={{ duration: 0.1 }}
                          className="absolute right-0 mt-1 w-36 shadow-xl rounded-lg overflow-hidden z-20"
                          style={{ background: 'var(--clr-surface)', border: '1px solid color-mix(in srgb, var(--clr-primary-dark) 40%, transparent)' }}
                        >
                          <button
                            onClick={() => handleEdit(notice)}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <Edit2 size={18} strokeWidth={1.9} /> Editar
                          </button>
                          <button
                            onClick={() => handleDelete(notice.id)}
                            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm hover:bg-primary/10 transition-colors border-t border-white/5"
                            style={{ color: 'var(--clr-primary)' }}
                          >
                            <Trash2 size={18} strokeWidth={1.9} /> Excluir
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div className="pr-8">
                    {/* TITLE + BADGES */}
                    <div className="flex items-center gap-2.5 mb-2 flex-wrap">
                      <h3 className="text-xl font-bold text-white tracking-tight">{notice.title}</h3>
                      {badge && (
                        <span className={`px-2 py-0.5 rounded-md border text-[9px] font-black uppercase tracking-wider ${badge.cls}`}>
                          {badge.label}
                        </span>
                      )}
                      {isEvento && (
                        <span className="px-2 py-0.5 rounded-md border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase tracking-wider">
                          Evento
                        </span>
                      )}
                    </div>

                    {/* META */}
                    <div className="flex items-center gap-4 text-[11px] text-gray-500 font-medium mb-4">
                      {dateStr && (
                        <span className="flex items-center gap-1.5 opacity-80">
                          <Calendar size={14} strokeWidth={1.9} className="text-gray-600" /> {dateStr} às {timeStr}
                        </span>
                      )}
                      <span className="flex items-center gap-1.5 opacity-80">
                        <Eye size={14} strokeWidth={1.9} className="text-gray-600" /> {notice.views || 0} views
                      </span>
                    </div>

                    {/* DESCRIPTION */}
                    <p className="text-sm text-gray-400 leading-relaxed max-w-[90%] whitespace-pre-line">
                      {notice.description}
                    </p>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}


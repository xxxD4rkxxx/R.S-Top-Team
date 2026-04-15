import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import {
  BellRing,
  Plus,
  Search,
  Calendar,
  Trash2,
  Edit2,
  X,
  Clock,
  RefreshCcw,
  Bell,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Flame,
  Zap,
  Siren,
  Eye
} from 'lucide-react'
import { useNotices } from '../../hooks/useNotices'
import PageHeader from '../../components/shared/PageHeader'
import KPICard from '../../components/shared/KPICard'
import MobileHeader from '../../components/navigation/MobileHeader'

// ────────────────────────────────────────────────
// EDITOR TOOLBAR COMPONENT (SLIM & RIGHT ALIGNED)
// ────────────────────────────────────────────────
function TextEditorToolbar({ onCommand }) {
  const tools = [
    { cmd: 'bold', icon: <Bold size={12} />, label: 'Negrito' },
    { cmd: 'italic', icon: <Italic size={12} />, label: 'Itálico' },
    { cmd: 'underline', icon: <Underline size={12} />, label: 'Sublinhado' },
    { type: 'separator' },
    { cmd: 'insertUnorderedList', icon: <List size={12} />, label: 'Marcadores' },
    { cmd: 'insertOrderedList', icon: <ListOrdered size={12} />, label: 'Numerada' },
  ]

  return (
    <div className="flex flex-col gap-1 p-1.5 bg-white/5 rounded-xl border border-white/5">
      {tools.map((tool, i) => tool.type === 'separator' ? (
        <div key={i} className="w-full h-px bg-white/10 my-1" />
      ) : (
        <button
          key={tool.cmd}
          type="button"
          onClick={() => onCommand(tool.cmd)}
          className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          title={tool.label}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  )
}

// ────────────────────────────────────────────────
// MAIN FORM COMPONENT
// ────────────────────────────────────────────────
function InlinePostForm({ onSave, onCancel, initialData }) {
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [priority, setPriority] = useState(initialData?.priority || 'normal')
  const [types, setTypes] = useState(initialData?.types || (initialData?.type ? [initialData.type] : ['aviso']))
  
  const [startDate, setStartDate] = useState(initialData?.startDate || new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(initialData?.endDate || new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState(initialData?.startTime || '09:00')
  const [endTime, setEndTime] = useState(initialData?.endTime || '10:00')
  const [isAllDay, setIsAllDay] = useState(initialData?.isAllDay || false)
  
  const [repeat, setRepeat] = useState(initialData?.repeat || 'none')
  const [notification, setNotification] = useState(initialData?.notification || { value: 30, unit: 'minutes' })

  const editorRef = useRef(null)

  const handlePublish = async () => {
    const content = editorRef.current ? editorRef.current.innerHTML : description;
    if (!title.trim() || !content.trim()) return
    await onSave({ 
      title, 
      description: content, 
      priority, 
      types,
      startDate,
      endDate,
      startTime,
      endTime,
      isAllDay,
      repeat,
      notification
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="mb-12 rounded-[32px] overflow-hidden border border-white/10 bg-[#0A0A0A] shadow-2xl"
    >
      <div className="p-10 space-y-10">
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                    <BellRing size={24} className="text-primary" />
               </div>
               <h2 className="text-xl font-black text-white uppercase tracking-tighter">
                  {initialData ? 'Editar Publicação' : 'Nova Publicação'}
               </h2>
            </div>
            <button onClick={onCancel} className="p-3 bg-white/5 hover:bg-white/10 rounded-2xl text-gray-400 transition-all">
               <X size={20} />
            </button>
        </div>

        {/* TITLE INPUT */}
        <input
          type="text"
          placeholder="Qual o título do comunicado?"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="w-full bg-transparent text-5xl font-black text-white placeholder-gray-800 outline-none border-none py-2"
        />

        {/* SCHEDULING BAR */}
        <div className="flex flex-wrap items-center gap-6 p-6 rounded-[24px] bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-3">
                <Calendar size={18} className="text-gray-600" />
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-sm font-bold text-gray-300 outline-none" />
                <span className="text-gray-700 font-bold text-xs">ATÉ</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-sm font-bold text-gray-300 outline-none" />
            </div>
            
            {!isAllDay && (
                <div className="flex items-center gap-3 border-l border-white/10 pl-6">
                    <Clock size={16} className="text-gray-600" />
                    <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="bg-transparent text-sm font-bold text-gray-300 outline-none w-20" />
                    <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="bg-transparent text-sm font-bold text-gray-300 outline-none w-20" />
                </div>
            )}

            <div className="flex items-center gap-4 ml-auto">
               <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isAllDay} onChange={e => setIsAllDay(e.target.checked)} className="sr-only peer" />
                  <div className="w-8 h-4 bg-white/10 rounded-full peer-checked:bg-primary transition-all relative">
                    <div className="absolute left-1 top-1 w-2 h-2 bg-gray-500 rounded-full peer-checked:translate-x-4 peer-checked:bg-black transition-all" />
                  </div>
                  <span className="text-[10px] font-black text-gray-500 uppercase">Dia Inteiro</span>
               </label>
            </div>
        </div>

        {/* SELECTORS ROW */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-4">
                <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest ml-1">Tipo de Postagem</label>
                <div className="flex gap-2">
                    {['aviso', 'evento'].map(t => (
                        <button
                          key={t}
                          onClick={() => types.includes(t) ? setTypes(types.filter(x => x !== t)) : setTypes([...types, t])}
                          className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                            types.includes(t) ? 'bg-primary text-black border-primary shadow-lg shadow-primary/20' : 'bg-white/5 text-gray-500 border-white/5'
                          }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>
            <div className="space-y-4">
                <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest ml-1">Prioridade</label>
                <div className="flex gap-2">
                    {['normal', 'alta', 'urgente'].map(p => (
                        <button
                          key={p}
                          onClick={() => setPriority(p)}
                          className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
                            priority === p 
                            ? p === 'urgente' ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20' : 'bg-white/20 text-white border-white/20'
                            : 'bg-white/5 text-gray-500 border-white/5'
                          }`}
                        >
                            {p}
                        </button>
                    ))}
                </div>
            </div>
        </div>

        {/* DESCRIPTION EDITOR (FOTO 2 STYLE) */}
        <div className="space-y-4">
            <label className="text-[10px] font-black text-gray-700 uppercase tracking-widest ml-1">Descrição</label>
            <div className="flex gap-4 items-start">
               <div className="flex-1 relative group">
                  <div 
                    ref={editorRef}
                    contentEditable
                    onInput={e => setDescription(e.currentTarget.innerHTML)}
                    dangerouslySetInnerHTML={{ __html: initialData?.description || '' }}
                    className="w-full min-h-[250px] p-8 rounded-[32px] bg-white/[0.03] border border-white/5 text-gray-300 text-sm outline-none focus:border-primary/40 transition-all leading-relaxed no-scrollbar overflow-y-auto"
                    style={{ whiteSpace: 'pre-wrap' }}
                  />
               </div>
               <TextEditorToolbar onCommand={(cmd) => {
                  document.execCommand(cmd, false, null);
                  if (editorRef.current) { editorRef.current.focus(); }
               }} />
            </div>
        </div>
      </div>

      <div className="px-10 py-8 bg-white/[0.02] border-t border-white/5 flex justify-end gap-4">
        <button onClick={onCancel} className="px-8 py-4 text-xs font-black text-gray-500 uppercase tracking-widest">Descartar</button>
        <button
          onClick={handlePublish}
          className="px-12 py-4 bg-primary text-black rounded-full text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all"
        >
          {initialData ? 'Salvar Alterações' : 'Publicar Agora'}
        </button>
      </div>
    </motion.div>
  )
}

// ────────────────────────────────────────────────
//  MAIN PAGE
// ────────────────────────────────────────────────
export default function EventsPage() {
  const { notices, loading, addNotice, updateNotice, deleteNotice } = useNotices()
  const { user, userData, effectiveRole } = useAuth()
  const [searchTerm, setSearchTerm] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingNotice, setEditingNotice] = useState(null)
  const [activeTab, setActiveTab] = useState('todos')

  const formatDisplayName = (fullName) => {
    if (!fullName) return 'Autor'
    const parts = fullName.trim().split(/\s+/)
    if (parts.length <= 1) return parts[0]
    return `${parts[0]} ${parts[1]}`
  }

  const getRelativeTime = (date) => {
    if (!date) return ''
    const now = new Date()
    const diffInSeconds = Math.floor((now - date) / 1000)
    const diffInDays = Math.floor(diffInSeconds / 86400)
    if (diffInDays < 1) return 'Hoje'
    return `Há ${diffInDays}d`
  }

  const canEdit = ['admin', 'gestor', 'professor'].includes(effectiveRole)

  const filteredNotices = notices.filter(n => {
    const matchesSearch = n.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTab = activeTab === 'todos' ||
      (activeTab === 'eventos' && n.types?.includes('evento')) ||
      (activeTab === 'avisos' && n.types?.includes('aviso'))
    return matchesSearch && matchesTab
  })

  const handleSave = async (data) => {
    if (editingNotice) {
      await updateNotice(editingNotice.id, data)
      setEditingNotice(null)
    } else {
      const authorName = userData?.name || user?.displayName || user?.email?.split('@')[0] || 'Sistema'
      await addNotice({ ...data, authorName, authorId: user?.uid || 'system' })
    }
    setShowForm(false)
  }

  return (
    <div className="flex-1 w-full bg-[#050505] text-white">
      <MobileHeader
        title="Avisos & Eventos"
        actions={canEdit && (
            <button onClick={() => { setEditingNotice(null); setShowForm(true) }} className="p-2.5 bg-primary rounded-xl text-black font-bold shadow-lg">
                <Plus size={20} />
            </button>
        )}
      />

      <PageHeader icon={BellRing} title="AVISOS & EVENTOS" subtitle="Gestão de comunicados e calendário" />

      <div className="px-4 md:px-6 py-6 w-full max-w-[1600px] mx-auto space-y-8">
        
        {/* FILTERS */}
        <div className="flex flex-col md:flex-row items-center gap-4">
            {canEdit && (
                <button
                    onClick={() => { setEditingNotice(null); setShowForm(true) }}
                    className="w-full md:w-auto px-10 py-4 bg-primary text-black rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl shadow-primary/10 transition-all hover:scale-[1.02]"
                >
                    Novo Comunicado
                </button>
            )}
            <div className="flex-1 w-full flex items-center gap-3 px-6 py-4 rounded-2xl bg-white/5 border border-white/5">
                <Search size={20} className="text-gray-600" />
                <input
                    type="text"
                    placeholder="Pesquisar..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="bg-transparent outline-none text-white text-sm w-full"
                />
            </div>
            <div className="flex bg-white/5 p-1.5 rounded-2xl">
                {['todos', 'eventos', 'avisos'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                            activeTab === tab ? 'bg-white/10 text-white' : 'text-gray-600 hover:text-gray-400'
                        }`}
                    >
                        {tab}
                    </button>
                ))}
            </div>
        </div>

        <AnimatePresence>
          {showForm && (
            <div className="fade-slide-down">
              <InlinePostForm
                key={editingNotice?.id || 'new'}
                initialData={editingNotice}
                onSave={handleSave}
                onCancel={() => { setShowForm(false); setEditingNotice(null) }}
              />
            </div>
          )}
        </AnimatePresence>

        {/* NOTICES LIST (ALONGADO COMO ANTES) */}
        <div className="flex flex-col gap-6 pb-20">
          {filteredNotices.map((notice, i) => {
            const isEvento = notice.types?.includes('evento')
            const isAviso = notice.types?.includes('aviso')
            const pMap = {
                urgente: { cls: 'bg-red-500/20 text-red-500 border-red-500/30', icon: <Flame size={10} /> },
                alta: { cls: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20', icon: <Zap size={10} /> },
                normal: { cls: 'bg-white/5 text-gray-500 border-white/10', icon: <div className="w-1.5 h-1.5 rounded-full bg-gray-500" /> }
            }
            const pStyle = pMap[notice.priority] || pMap.normal

            return (
              <motion.div
                key={notice.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="relative group bg-white/[0.03] border border-white/5 hover:border-white/10 p-10 rounded-[32px] transition-all flex flex-col gap-6"
              >
                {/* 1. TOP ROW (DIVIDER LINE + TAGS) */}
                <div className="flex items-center gap-4">
                    <div className="flex-1 h-px bg-white/5" />
                    <div className="flex items-center gap-2">
                        <div className={`px-3 py-1 rounded-full border text-[8px] font-black uppercase tracking-widest flex items-center gap-1.5 ${pStyle.cls}`}>
                            {pStyle.icon}
                            {notice.priority}
                        </div>
                        <div className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-700 text-[8px] font-black uppercase tracking-widest">
                            {getRelativeTime(new Date(notice.createdAt))}
                        </div>
                        {canEdit && (
                            <div className="flex gap-1 ml-2">
                                <button onClick={() => { setEditingNotice(notice); setShowForm(true) }} className="p-2 hover:bg-white/10 rounded-xl text-gray-600"><Edit2 size={12} /></button>
                                <button onClick={() => deleteNotice(notice.id)} className="p-2 hover:bg-red-500/10 rounded-xl text-gray-600 hover:text-red-500"><Trash2 size={12} /></button>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. TITLE (BIG) */}
                <h3 className="text-4xl font-black text-[#E4E4E6] leading-none uppercase tracking-tighter">
                    {notice.title}
                </h3>

                {/* 3. DESCRIPTION (FORMATO SOLICITADO) */}
                <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest">
                        {formatDisplayName(notice.authorName)} :
                    </span>
                    <div 
                      className="text-[#DCDCDF] text-sm font-medium leading-relaxed rich-content"
                      dangerouslySetInnerHTML={{ __html: notice.description }}
                    />
                </div>

                {/* 4. EVENT DATE MINI BAR */}
                {(notice.startDate || notice.startTime) && (
                    <div className="flex items-center gap-6 pt-6 border-t border-white/5 mt-2">
                        <div className="flex items-center gap-2 text-[10px] font-black text-gray-700 uppercase">
                            <Calendar size={14} className="text-primary/30" />
                            <span>{new Date(notice.startDate).toLocaleDateString('pt-BR')}</span>
                        </div>
                        {!notice.isAllDay && (
                            <div className="flex items-center gap-2 text-[10px] font-black text-gray-700 uppercase">
                                <Clock size={14} className="text-primary/30" />
                                <span>{notice.startTime} - {notice.endTime}</span>
                            </div>
                        )}
                    </div>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import {
  BellRing,
  Plus,
  Search,
  MoreVertical,
  Calendar,
  Trash2,
  Edit2,
  X,
  MessageSquare,
  Clock,
  RefreshCcw,
  Bell,
  HelpCircle,
  Bold,
  Italic,
  Underline,
  List,
  ListOrdered,
  Flame,
  Zap,
  Siren,
  Eye,
  Link as LinkIcon,
  Eraser,
  Type
} from 'lucide-react'
import { useNotices } from '../../hooks/useNotices'
import PageHeader from '../../components/shared/PageHeader'
import KPICard from '../../components/shared/KPICard'
import MobileHeader from '../../components/navigation/MobileHeader'
import { toast } from 'react-hot-toast'

// ────────────────────────────────────────────────
// EDITOR TOOLBAR COMPONENT
// ────────────────────────────────────────────────
function TextEditorToolbar({ editorRef }) {
  const [activeStates, setActiveStates] = useState({});

  const checkStates = () => {
    const states = {
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      insertOrderedList: document.queryCommandState('insertOrderedList'),
      insertUnorderedList: document.queryCommandState('insertUnorderedList'),
    };
    setActiveStates(states);
  };

  useEffect(() => {
    const handleSelectionChange = () => {
      // Só checa se o editor estiver em foco
      if (document.activeElement === editorRef.current) {
        checkStates();
      }
    };
    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [editorRef]);

  const runCommand = (cmd, val = null) => {
    document.execCommand(cmd, false, val);
    checkStates();
    if (editorRef?.current) editorRef.current.focus();
  };

  const tools = [
    { cmd: 'bold', icon: <Bold size={14} />, label: 'Negrito' },
    { cmd: 'italic', icon: <Italic size={14} />, label: 'Itálico' },
    { cmd: 'underline', icon: <Underline size={14} />, label: 'Sublinhado' },
    { type: 'separator' },
    { cmd: 'insertOrderedList', icon: <ListOrdered size={14} />, label: 'Lista Numerada' },
    { cmd: 'insertUnorderedList', icon: <List size={14} />, label: 'Lista Marcadores' },
    { type: 'separator' },
    {
      cmd: 'createLink',
      icon: <LinkIcon size={14} />,
      label: 'Inserir Link',
      action: () => {
        const url = prompt('Digite a URL:');
        if (url) runCommand('createLink', url);
      }
    },
    { cmd: 'removeFormat', icon: <Eraser size={14} />, label: 'Limpar Formatação' },
  ]

  return (
    <div className="flex items-center gap-0.5">
      <div className="p-2 mr-2 text-primary opacity-50 border border-white/5 rounded-lg">
        <Type size={14} />
      </div>
      <div className="w-px h-4 bg-white/5 mx-2" />
      {tools.map((tool, i) => tool.type === 'separator' ? (
        <div key={i} className="w-px h-4 bg-white/5 mx-2" />
      ) : (
        <button
          key={i}
          type="button"
          onClick={() => tool.action ? tool.action() : runCommand(tool.cmd)}
          className={`p-2 rounded-lg transition-all ${activeStates[tool.cmd]
            ? 'text-primary bg-primary/10 border border-primary/20 shadow-[0_0_10px_rgba(var(--primary-rgb),0.1)]'
            : 'text-gray-500 hover:text-white hover:bg-white/5 border border-transparent'
            }`}
          title={tool.label}
        >
          {tool.icon}
        </button>
      ))}
    </div>
  );
}

// Editor de Texto Rico Memorizado para evitar perda de foco e estado
const RichTextEditor = React.memo(React.forwardRef(({ initialValue, onChange, placeholder }, ref) => {
  useEffect(() => {
    if (ref.current && initialValue && !ref.current.innerHTML) {
      ref.current.innerHTML = initialValue;
    }
  }, [initialValue]);

  return (
    <div
      ref={ref}
      contentEditable
      onInput={e => onChange(e.currentTarget.innerHTML)}
      onBlur={e => onChange(e.currentTarget.innerHTML)}
      placeholder={placeholder}
      className="w-full min-h-[160px] p-6 text-gray-300 text-sm outline-none leading-relaxed relative before:content-[attr(placeholder)] before:absolute before:text-gray-700 before:pointer-events-none empty:before:block before:hidden [&_a]:text-blue-500 [&_a]:underline"
      style={{ whiteSpace: 'pre-wrap' }}
    />
  );
}));

// ────────────────────────────────────────────────
// MAIN FORM COMPONENT
// ────────────────────────────────────────────────

// ────────────────────────────────────────────────
// MAIN FORM COMPONENT
// ────────────────────────────────────────────────
function InlinePostForm({ onSave, onCancel, initialData }) {
  const [title, setTitle] = useState(initialData?.title || '')
  const [description, setDescription] = useState(initialData?.description || '')
  const [priority, setPriority] = useState(initialData?.priority || 'normal')
  const [types, setTypes] = useState(initialData?.types || (initialData?.type ? [initialData.type] : ['aviso']))

  // Data / Hora
  const [startDate, setStartDate] = useState(initialData?.startDate || new Date().toISOString().split('T')[0])
  const [endDate, setEndDate] = useState(initialData?.endDate || new Date().toISOString().split('T')[0])
  const [startTime, setStartTime] = useState(initialData?.startTime || '09:00')
  const [endTime, setEndTime] = useState(initialData?.endTime || '10:00')
  const [isAllDay, setIsAllDay] = useState(initialData?.isAllDay || false)

  // Repetição e Notificação
  const [repeat, setRepeat] = useState(initialData?.repeat || 'none')
  const [notification, setNotification] = useState(initialData?.notification || { value: 30, unit: 'minutes' })

  const editorRef = useRef(null)

  // Sincroniza o conteúdo inicial do editor
  useEffect(() => {
    if (editorRef.current && description && !editorRef.current.innerHTML) {
      editorRef.current.innerHTML = description;
    }
  }, []);

  const isNotificationInvalid = () => {
    const limits = { minutes: 1000, hours: 672, days: 31, weeks: 4 };
    return notification.value > (limits[notification.unit] || 9999);
  };

  const handlePublish = async () => {
    const content = editorRef.current ? editorRef.current.innerHTML : description;
    if (!title.trim() || !content.trim()) return

    if (isNotificationInvalid()) {
      const limits = { minutes: 1000, hours: 672, days: 31, weeks: 4 };
      const labels = { minutes: 'minutos', hours: 'horas', days: 'dias', weeks: 'semanas' };
      toast.error(`O limite para ${labels[notification.unit]} é ${limits[notification.unit]}!`);
      return;
    }

    // Se for dia inteiro, normaliza os horários para o banco de dados
    const finalStartTime = isAllDay ? '00:00' : startTime;
    const finalEndTime = isAllDay ? '23:59' : endTime;

    await onSave({
      title,
      description: content,
      priority,
      types,
      startDate,
      endDate: isAllDay ? startDate : endDate, // Geralmente dia inteiro é no mesmo dia
      startTime: finalStartTime,
      endTime: finalEndTime,
      isAllDay,
      allDay: isAllDay,
      repeat,
      notification
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.98 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="mb-8 rounded-[32px] overflow-hidden shadow-2xl border border-white/10 bg-[#0A0A0A]"
    >
      {/* HEADER */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
            <BellRing size={20} className="text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-wider">
              {initialData ? 'Editar Evento / Aviso' : 'Novo Evento / Aviso'}
            </h2>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mt-1">Configure os detalhes abaixo</p>
          </div>
        </div>
        <button onClick={onCancel} className="p-2.5 hover:bg-white/10 rounded-xl text-gray-500 hover:text-white transition-all">
          <X size={20} />
        </button>
      </div>

      <div className="p-8 space-y-8">

        {/* DATE & TIME (CALENDAR STYLE) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 rounded-3xl bg-white/[0.02] border border-white/5">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Calendar size={18} className="text-gray-500 shrink-0" />
              <div className="flex items-center gap-2 flex-1">
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-gray-300 outline-none focus:border-primary/50 flex-1"
                />
                {!isAllDay && (
                  <input
                    type="time"
                    value={startTime}
                    onChange={e => setStartTime(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-gray-300 outline-none focus:border-primary/50 w-28"
                  />
                )}
                <span className="text-gray-600 font-bold text-xs uppercase">até</span>
                {!isAllDay && (
                  <input
                    type="time"
                    value={endTime}
                    onChange={e => setEndTime(e.target.value)}
                    className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-gray-300 outline-none focus:border-primary/50 w-28"
                  />
                )}
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-gray-300 outline-none focus:border-primary/50 flex-1"
                />
              </div>
            </div>

            <div className="flex items-center gap-6 pl-9">
              <label className="flex items-center gap-2 cursor-pointer group">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={isAllDay}
                    onChange={e => setIsAllDay(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-5 bg-white/10 rounded-full peer peer-checked:bg-primary transition-all" />
                  <div className="absolute top-1 left-1 w-3 h-3 bg-gray-500 rounded-full peer-checked:translate-x-5 peer-checked:bg-black transition-all" />
                </div>
                <span className="text-xs font-bold text-gray-500 group-hover:text-gray-300 transition-colors uppercase tracking-widest">Dia Inteiro</span>
                <div className="relative group/tooltip">
                  <HelpCircle size={14} className="text-gray-600 hover:text-primary transition-colors cursor-help" />
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-4 bg-[#111] border border-white/10 rounded-2xl text-[11px] text-gray-400 font-medium invisible group-hover/tooltip:visible opacity-0 group-hover/tooltip:opacity-100 transition-all z-50 shadow-2xl pointer-events-none">
                    <p className="mb-2 text-primary font-black uppercase tracking-widest text-[10px]">Para que serve?</p>
                    <p className="leading-relaxed">
                      Use para eventos sem horário fixo, como <span className="text-white">Feriados</span>, <span className="text-white">Graduações</span> ou <span className="text-white">Avisos Gerais</span> que valem para o dia todo.
                      Os horários são ocultados e você pode agendar o lembrete para dias antes.
                    </p>
                  </div>
                </div>
              </label>

              <div className="flex items-center gap-2">
                <RefreshCcw size={14} className="text-gray-600" />
                <select
                  value={repeat}
                  onChange={e => setRepeat(e.target.value)}
                  className="bg-transparent text-[10px] font-black text-primary uppercase tracking-widest outline-none cursor-pointer"
                >
                  <option value="none" className="bg-[#0A0A0A]">Não se repete</option>
                  <option value="daily" className="bg-[#0A0A0A]">Todos os dias</option>
                  <option value="weekly" className="bg-[#0A0A0A]">Semanalmente</option>
                  <option value="monthly" className="bg-[#0A0A0A]">Mensalmente</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex flex-col justify-center border-l border-white/5 pl-6 gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                <Bell size={16} className="text-emerald-500" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Notificar</span>
                <input
                  type="number"
                  value={notification.value === 0 ? '' : notification.value}
                  placeholder="0"
                  onChange={e => {
                    let valStr = e.target.value.replace(/\D/g, ''); // Apenas números
                    if (valStr === '') {
                      setNotification({ ...notification, value: 0 });
                      return;
                    }

                    // Limite de dígitos
                    const maxDigits = { minutes: 4, hours: 3, days: 2, weeks: 1 };
                    const limit = maxDigits[notification.unit] || 4;
                    if (valStr.length > limit) valStr = valStr.slice(0, limit);

                    setNotification({ ...notification, value: parseInt(valStr) });
                  }}
                  className={`w-20 bg-white/5 border rounded-lg px-2 py-1 text-xs text-center font-bold text-white outline-none transition-all ${(notification.unit === 'minutes' && notification.value > 1000) ||
                    (notification.unit === 'hours' && notification.value > 672) ||
                    (notification.unit === 'days' && notification.value > 31) ||
                    (notification.unit === 'weeks' && notification.value > 4)
                    ? 'border-red-500 bg-red-500/10 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                    : 'border-white/10 focus:border-primary/50'
                    }`}
                />

                {!isAllDay ? (
                  <select
                    value={notification.unit}
                    onChange={e => {
                      const newUnit = e.target.value;
                      let newValue = notification.value;
                      // Ajusta valor se estourar limite da nova unidade
                      if (newUnit === 'hours' && newValue > 672) newValue = 672;
                      if (newUnit === 'days' && newValue > 31) newValue = 31;
                      if (newUnit === 'weeks' && newValue > 4) newValue = 4;
                      if (newUnit === 'minutes' && newValue > 9999) newValue = 9999;

                      setNotification({ ...notification, unit: newUnit, value: newValue });
                    }}
                    className="bg-transparent text-xs font-bold text-gray-300 uppercase tracking-widest outline-none"
                  >
                    <option value="minutes" className="bg-[#0A0A0A]">minutos antes</option>
                    <option value="hours" className="bg-[#0A0A0A]">horas antes</option>
                    <option value="days" className="bg-[#0A0A0A]">dias antes</option>
                    <option value="weeks" className="bg-[#0A0A0A]">semanas antes</option>
                  </select>
                ) : (
                  <div className="flex items-center gap-2">
                    <select
                      value={notification.unit === 'weeks' ? 'weeks' : 'days'}
                      onChange={e => setNotification({
                        ...notification,
                        unit: e.target.value,
                        value: e.target.value === 'weeks' ? Math.min(notification.value, 4) : Math.min(notification.value, 31)
                      })}
                      className="bg-transparent text-xs font-bold text-gray-300 uppercase tracking-widest outline-none"
                    >
                      <option value="days" className="bg-[#0A0A0A]">dias antes</option>
                      <option value="weeks" className="bg-[#0A0A0A]">semanas antes</option>
                    </select>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">às</span>
                    <input
                      type="time"
                      value={notification.time || '09:00'}
                      onChange={e => setNotification({ ...notification, time: e.target.value })}
                      className="bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs font-bold text-white outline-none"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* CATEGORY & PRIORITY SELECTORS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <span className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] ml-1">Categoria</span>
            <div className="flex p-1.5 bg-white/5 border border-white/5 rounded-3xl gap-2">
              {[
                { id: 'aviso', label: 'Aviso', icon: <BellRing size={14} /> },
                { id: 'evento', label: 'Evento', icon: <Calendar size={14} /> }
              ].map(cat => {
                const isSelected = types.includes(cat.id)
                return (
                  <button
                    key={cat.id}
                    onClick={() => {
                      if (isSelected) {
                        if (types.length > 1) setTypes(types.filter(t => t !== cat.id))
                      } else {
                        setTypes([...types, cat.id])
                      }
                    }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${isSelected
                      ? `bg-white/10 text-white border border-white/20 shadow-lg shadow-black/20`
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent opacity-50'
                      }`}
                  >
                    {cat.icon} {cat.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* PRIORIDADE */}
          <div className="space-y-3">
            <span className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] ml-1">Prioridade</span>
            <div className="flex p-1.5 bg-white/5 border border-white/5 rounded-3xl gap-2">
              {[
                { id: 'normal', label: 'Normal' },
                { id: 'alta', label: 'Alta' },
                { id: 'urgente', label: 'Urgente' }
              ].map(prio => (
                <button
                  key={prio.id}
                  onClick={() => setPriority(prio.id)}
                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${priority === prio.id
                    ? prio.id === 'urgente'
                      ? 'bg-primary text-black'
                      : prio.id === 'alta'
                        ? 'bg-yellow-500 text-black'
                        : 'bg-white/30 text-white'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5 border border-transparent'
                    }`}
                >
                  {prio.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* TITLE */}
        <div className="space-y-3">
          <span className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] ml-1">Título do Evento / Aviso</span>
          <input
            type="text"
            placeholder="Digite o título principal aqui..."
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full p-5 rounded-3xl bg-white/[0.02] border border-white/5 text-white text-sm font-medium outline-none focus:border-primary/30 transition-all placeholder:text-gray-700"
          />
        </div>

        {/* UNIFIED DESCRIPTION BOX */}
        <div className="space-y-3">
          <span className="text-[10px] font-black text-gray-600 uppercase tracking-[0.2em] ml-1">Descrição Detalhada</span>

          <div className="flex flex-col rounded-3xl bg-white/[0.02] border border-white/5 overflow-hidden focus-within:border-primary/30 transition-all">
            {/* Toolbar interna */}
            <div className="px-4 py-2 border-b border-white/5 bg-white/[0.01]">
              <TextEditorToolbar editorRef={editorRef} />
            </div>

            {/* Editor */}
            <RichTextEditor
              ref={editorRef}
              initialValue={initialData?.description || ''}
              onChange={setDescription}
              placeholder="Adicionar uma descrição..."
            />
          </div>
        </div>
      </div>

      {/* FOOTER ACTIONS */}
      <div className="px-8 py-6 border-t border-white/5 bg-white/[0.01] flex items-center justify-end gap-4">
        <button
          onClick={onCancel}
          className="px-6 py-3 rounded-full text-xs font-black uppercase tracking-widest text-gray-500 hover:text-white transition-all"
        >
          Cancelar
        </button>
        <button
          onClick={handlePublish}
          disabled={!title.trim() || !description.trim()}
          className="px-10 py-3 rounded-full text-xs font-black uppercase tracking-widest bg-primary text-black shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-30 transition-all border border-primary/20"
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
  const [activeDropdown, setActiveDropdown] = useState(null)
  const [activeTab, setActiveTab] = useState('todos') // 'todos', 'eventos', 'avisos'
  const notifiedIds = useRef(new Set())

  // Helper para nome curto (ex: João Gustavo)
  const formatDisplayName = (fullName) => {
    if (!fullName) return 'Autor'
    const parts = fullName.trim().split(/\s+/)
    if (parts.length <= 1) return parts[0]
    return `${parts[0]} ${parts[1]}`
  }

  // Helper para tempo relativo (estilo solicitado)
  const getRelativeTime = (date) => {
    if (!date) return ''
    const now = new Date()
    const diffInSeconds = Math.floor((now - date) / 1000)
    const diffInDays = Math.floor(diffInSeconds / 86400)

    if (diffInDays < 1) return 'Hoje'
    return `Há ${diffInDays}d`
  }

  // Permissões
  const canEdit = ['admin', 'gestor', 'professor'].includes(effectiveRole)

  // ── KPIs ──
  const totalNotices = notices.length
  const highPriority = notices.filter(n => n.priority === 'alta').length
  const urgents = notices.filter(n => n.priority === 'urgente').length
  const totalViews = notices.reduce((acc, n) => acc + (n.views || 0), 0)

  const filteredNotices = notices.filter(n => {
    const matchesSearch = n.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.description?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesTab = activeTab === 'todos' ||
      (activeTab === 'eventos' && n.types?.includes('evento')) ||
      (activeTab === 'avisos' && n.types?.includes('aviso'))
    return matchesSearch && matchesTab
  })

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  useEffect(() => {
    // Check for upcoming events every minute
    const checkUpcoming = () => {
      if (!('Notification' in window) || Notification.permission !== 'granted') return

      const now = new Date()
      notices.forEach(notice => {
        if (!notice.id) return

        // Only process events with a start date
        if (notice.types?.includes('evento') && notice.startDate) {
          try {
            const eventDate = new Date(`${notice.startDate}T${notice.startTime || '00:00'}`)
            const diffMinutes = (eventDate - now) / (1000 * 60)

            const notifyValue = parseInt(notice.notification?.value) || 30
            const notifyUnit = notice.notification?.unit || 'minutes'

            let triggerMinutes = 0

            if (notice.isAllDay) {
              // Lógica para Dia Inteiro: Notificar X dias antes no horário específico
              const notifyTime = notice.notification?.time || '09:00'
              const daysBefore = parseInt(notice.notification?.value) || 0

              const notificationTarget = new Date(eventDate)
              notificationTarget.setDate(notificationTarget.getDate() - daysBefore)
              const [h, m] = notifyTime.split(':')
              notificationTarget.setHours(parseInt(h), parseInt(m), 0)

              const diffToNotify = (notificationTarget - now) / (1000 * 60)

              if (diffToNotify <= 0 && diffToNotify > -5) {
                const notificationKey = `${notice.id}_allday_target`
                if (!notifiedIds.current.has(notificationKey)) {
                  new Notification(`Lembrete: ${notice.title}`, {
                    body: `Evento de dia inteiro em ${daysBefore} dia(s).`,
                    icon: '/favicon.ico',
                    tag: notificationKey
                  })
                  notifiedIds.current.add(notificationKey)
                }
              }
            } else {
              // Lógica padrão para eventos com horário
              let triggerMinutes = notifyValue
              if (notifyUnit === 'hours') triggerMinutes *= 60
              if (notifyUnit === 'days') triggerMinutes *= 1440
              if (notifyUnit === 'weeks') triggerMinutes *= 10080 // 7 * 24 * 60

              const notificationKey = `${notice.id}_${eventDate.getTime()}`

              // 1. Upcoming Notification
              if (diffMinutes > 0 && diffMinutes <= triggerMinutes) {
                if (!notifiedIds.current.has(`${notificationKey}_upcoming`)) {
                  new Notification(`Evento Próximo: ${notice.title}`, {
                    body: `Inicia em aproximadamente ${Math.round(diffMinutes)} minutos.`,
                    icon: '/favicon.ico',
                    tag: `${notificationKey}_upcoming`
                  })
                  notifiedIds.current.add(`${notificationKey}_upcoming`)
                }
              }
            }

            // 2. Start Time Notification (exactly now or very recently)
            if (diffMinutes <= 0 && diffMinutes > -5) {
              if (!notifiedIds.current.has(`${notificationKey}_started`)) {
                new Notification(`Evento Iniciado: ${notice.title}`, {
                  body: `O evento começou às ${notice.startTime || '00:00'}.`,
                  icon: '/favicon.ico',
                  tag: `${notificationKey}_started`
                })
                notifiedIds.current.add(`${notificationKey}_started`)
              }
            }
          } catch (err) {
            console.error('Error processing notification for notice:', notice.id, err)
          }
        }
      })
    }

    // Run once on mount and then every 30s for better responsiveness
    checkUpcoming()
    const interval = setInterval(checkUpcoming, 30000)
    return () => clearInterval(interval)
  }, [notices])

  const handleSave = async (data) => {
    if (editingNotice) {
      await updateNotice(editingNotice.id, data)
      setEditingNotice(null)
    } else {
      // Tenta pegar o nome de várias fontes para garantir registro do autor
      const authorName = userData?.name || user?.displayName || user?.email?.split('@')[0] || 'Sistema'

      await addNotice({
        ...data,
        authorName: authorName,
        authorId: user?.uid || 'system'
      })
    }
    setShowForm(false)
  }

  const handleEdit = (notice) => {
    if (!canEdit) return
    setEditingNotice(notice)
    setShowForm(true)
    setActiveDropdown(null)
  }

  const handleDelete = async (id) => {
    if (!canEdit) return
    if (window.confirm('Apagar este aviso permanentemente?')) {
      await deleteNotice(id)
    }
    setActiveDropdown(null)
  }

  const priorityBadge = {
    alta: { label: 'Alta', cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' },
    urgente: { label: 'Urgente', cls: 'bg-primary/10 text-primary border-primary/25' },
  }

  return (
    <>
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 blur-[120px] -mr-64 -mt-64 pointer-events-none" />

      <MobileHeader
        title="Avisos & Eventos"
        actions={
          canEdit && (
            <button
              onClick={() => { setEditingNotice(null); setShowForm(s => !s) }}
              className={`p-2.5 rounded-xl active:scale-90 transition-all shadow-lg ${showForm && !editingNotice ? 'bg-white/10 text-white' : 'bg-primary text-black shadow-primary/40'}`}
            >
              {showForm && !editingNotice ? <X size={20} strokeWidth={3} /> : <Plus size={20} strokeWidth={3} />}
            </button>
          )
        }
      />

      {/* Header Desktop */}
      <PageHeader
        icon={BellRing}
        title="AVISOS & EVENTOS"
        subtitle="COMUNICADOS OFICIAIS E CALENDÁRIO DA ACADEMIA"
        loading={loading}
      />

      <div className="flex-1 px-4 md:px-6 py-6 w-full pb-32 space-y-8 max-w-[1600px] mx-auto">

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 fade-slide-up">
          <KPICard
            title="Total"
            value={loading ? '...' : totalNotices}
            description="Ativos no sistema"
            icon={BellRing}
          />
          <KPICard
            title="Atenção"
            value={loading ? '...' : highPriority}
            description="Prioridade alta"
            icon={Zap}
            valueColor="text-yellow-400"
          />
          <KPICard
            title="Urgentes"
            value={loading ? '...' : urgents}
            description="Alertas críticos"
            icon={Siren}
            valueColor="text-primary"
          />
          <KPICard
            title="Engajamento"
            value={loading ? '...' : totalViews}
            description="Visualizações totais"
            icon={Eye}
          />
        </div>

        {/* ── ACTION BAR & FILTERS ── */}
        <div className="flex flex-col md:flex-row items-center gap-4 fade-slide-up">
          {canEdit && (
            <button
              onClick={() => { setEditingNotice(null); setShowForm(s => !s) }}
              className="w-full md:w-auto btn-primary flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-black uppercase tracking-tighter transition-all shadow-xl shadow-primary/10"
            >
              {showForm && !editingNotice ? <X size={20} /> : <Plus size={20} />}
              {showForm && !editingNotice ? 'Cancelar' : 'Novo aviso'}
            </button>
          )}

          <div
            className="flex-1 w-full flex items-center gap-3 px-5 py-3 rounded-xl transition-all border border-white/5 focus-within:border-primary/40 bg-[#111]/80 backdrop-blur-xl"
          >
            <Search size={19} strokeWidth={2.2} className="text-gray-600 flex-shrink-0" />
            <input
              type="text"
              placeholder="Pesquisar comunicados..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="bg-transparent outline-none text-white text-sm placeholder-gray-700 w-full font-medium"
            />
          </div>

          {/* Tab Filter */}
          <div className="flex bg-white/5 p-1 rounded-xl w-full md:w-auto">
            {['todos', 'eventos', 'avisos'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 md:w-24 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab
                  ? 'bg-primary text-white shadow-lg'
                  : 'text-gray-500 hover:text-white'
                  }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* ── INLINE FORM ── */}
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

        {/* ── LISTA DE AVISOS (Alongada) ── */}
        <div className="grid grid-cols-1 gap-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4 opacity-40">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-[10px] font-black uppercase tracking-[0.3em]">Sincronizando Avisos...</p>
            </div>
          ) : filteredNotices.length === 0 ? (
            <div className="text-center py-20 bg-white/[0.02] border border-white/5 rounded-3xl backdrop-blur-sm">
              <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6">
                <BellRing size={32} className="text-gray-700" />
              </div>
              <p className="text-white font-black uppercase tracking-widest text-lg">Nada por aqui</p>
              <p className="text-gray-500 text-xs mt-2 font-medium">Nenhum comunicado encontrado para esta busca.</p>
            </div>
          ) : (
            filteredNotices.map((notice, i) => {
              const badge = priorityBadge[notice.priority]
              const isEvento = notice.types?.includes('evento')
              const isAviso = notice.types?.includes('aviso')
              const relativeTime = getRelativeTime(notice.createdAt)

              const priorityMap = {
                urgente: { label: 'URGENTE', cls: 'bg-primary/20 text-primary border-primary/30', icon: <Flame size={12} /> },
                alta: { label: 'ALTA PRIORIDADE', cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30', icon: <Zap size={12} /> },
                normal: { label: 'NORMAL', cls: 'bg-white/5 text-gray-500 border-white/10', icon: <div className="w-1.5 h-1.5 rounded-full bg-gray-500" /> }
              }
              const pCfg = priorityMap[notice.priority] || priorityMap.normal

              return (
                <motion.div
                  key={notice.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="relative group bg-white/[0.03] border border-white/5 hover:border-white/10 p-4 px-6 rounded-[24px] transition-all overflow-hidden"
                >
                  {/* Visual Decoration for priority bar */}
                  <div className={`absolute top-0 left-0 bottom-0 w-1.5 transition-colors ${notice.priority === 'urgente' ? 'bg-primary' :
                    notice.priority === 'alta' ? 'bg-yellow-500' : 'bg-transparent'
                    }`} />

                  {/* STAFF CONTROLS */}
                  {canEdit && (
                    <div className="absolute top-6 right-6 z-10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                      <button onClick={() => handleEdit(notice)} className="p-2 hover:bg-white/10 rounded-xl text-gray-400 hover:text-white transition-all"><Edit2 size={16} /></button>
                      <button onClick={() => handleDelete(notice.id)} className="p-2 hover:bg-primary/10 rounded-xl text-gray-400 hover:text-primary transition-all"><Trash2 size={16} /></button>
                    </div>
                  )}

                  <div className="flex flex-col">
                    <div className="pt-2"></div>

                    <h3 className="text-lg font-black tracking-tight mb-1" style={{ color: '#E4E4E6' }}>
                      {notice.title}
                    </h3>

                    <div className="space-y-1" style={{ color: '#DCDCDF' }}>
                      <div className="flex items-center gap-2 overflow-hidden">
                        <span className="text-[10px] font-black lowercase opacity-40 whitespace-nowrap shrink-0">{formatDisplayName(notice.authorName)} :</span>
                        <div
                          className="text-sm font-medium opacity-80 line-clamp-1 text-gray-400 flex-1"
                          dangerouslySetInnerHTML={{ __html: notice.description.replace(/<[^>]*>?/gm, ' ') }}
                        />
                      </div>
                    </div>

                    {/* UNIFIED INFO BOX (DATE, TIME & BADGES) */}
                    <div className="mt-5 flex items-center p-3 bg-white/[0.02] border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-500">
                      {/* Left Side: Event Details */}
                      {(notice.startDate || notice.startTime) && (
                        <div className="flex items-center gap-4">
                          <div className="flex items-center gap-2 px-1">
                            <Calendar size={14} className="text-primary opacity-60" />
                            <span>{new Date(notice.startDate).toLocaleDateString('pt-BR')}</span>
                          </div>
                          {!notice.isAllDay && (
                            <div className="flex items-center gap-2 border-l border-white/5 pl-4 px-1">
                              <Clock size={14} className="text-primary opacity-60" />
                              <span>{notice.startTime} - {notice.endTime}</span>
                            </div>
                          )}
                          {notice.repeat !== 'none' && (
                            <div className="flex items-center gap-2 text-emerald-500/40 border-l border-white/5 pl-4 px-1">
                              <RefreshCcw size={12} />
                              <span>Repete</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Spacer to push badges to the right */}
                      <div className="flex-1" />

                      {/* Right Side: Technical Badges */}
                      <div className="flex items-center gap-3">
                        <div className={`px-2.5 py-1 rounded-lg border text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 ${pCfg.cls}`}>
                          {pCfg.icon}
                          {pCfg.label}
                        </div>

                        {isEvento && (
                          <div className="px-2.5 py-1 rounded-lg border border-blue-500/20 bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase tracking-widest">
                            EVENTO
                          </div>
                        )}
                        {isAviso && (
                          <div className="px-2.5 py-1 rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[9px] font-black uppercase tracking-widest">
                            AVISO
                          </div>
                        )}

                        <span className="text-gray-600 text-[9px] font-black bg-white/5 px-2.5 py-1 rounded-lg border border-white/5 whitespace-nowrap">
                          {relativeTime}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )

            })
          )}
        </div>
      </div>
    </>
  )
}


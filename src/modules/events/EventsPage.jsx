import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
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
  BarChart3,
  ChevronLeft,
  Tag,
  Flame,
  Zap,
  Eye,
  Link as LinkIcon,
  Eraser,
  Type,
  ChevronDown
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
function InlinePostForm({ onSave, onCancel, initialData, isInline }) {
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

  const [repeat, setRepeat] = useState(initialData?.repeat || 'none')
  const [notification, setNotification] = useState(initialData?.notification || { value: 30, unit: 'minutes' })

  const editorRef = useRef(null)

  const onPublish = async (e) => {
    if (e) e.preventDefault();
    const currentContent = editorRef.current ? editorRef.current.innerHTML : description;
    if (!title.trim()) { toast.error('O título é obrigatório!'); return; }
    if (!currentContent.trim()) { toast.error('O conteúdo é obrigatório!'); return; }
    if (types.length === 0) { toast.error('Selecione pelo menos uma categoria!'); return; }

    const limits = { minutes: 1000, hours: 672, days: 31, weeks: 4 };
    if (notification.value < 0 || notification.value > limits[notification.unit]) {
      const labels = { minutes: 'minutos', hours: 'horas', days: 'dias', weeks: 'semanas' };
      toast.error(`O limite para ${labels[notification.unit]} é ${limits[notification.unit]}!`);
      return;
    }

    await onSave({
      title,
      description: currentContent,
      priority,
      types,
      startDate,
      endDate: isAllDay ? startDate : endDate,
      startTime: isAllDay ? '00:00' : startTime,
      endTime: isAllDay ? '23:59' : endTime,
      isAllDay,
      allDay: isAllDay,
      repeat,
      notification
    });
  };

  useEffect(() => {
    const handleSave = () => onPublish();
    window.addEventListener('trigger-post-save', handleSave);
    return () => window.removeEventListener('trigger-post-save', handleSave);
  }, [title, description, priority, types, startDate, endDate, startTime, endTime, isAllDay, repeat, notification]);

  const InternalFormFields = (
    <div className="space-y-6 md:space-y-8">
      {/* SEÇÃO DE AGENDAMENTO */}
      <div className="bg-white/[0.02] border border-white/5 rounded-[32px] overflow-hidden shadow-2xl">
        <div className="flex flex-col divide-y divide-white/5">
          <div className="p-6 md:p-8 space-y-6">
            <div className={`grid grid-cols-1 ${isInline ? 'gap-6' : 'md:grid-cols-2 gap-8'}`}>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-1">Data de Início</label>
                <div className="flex items-center gap-3 bg-black/40 rounded-2xl px-4 py-3.5 border border-white/5 shadow-inner group transition-all focus-within:border-primary/20 text-gray-300">
                  <Calendar size={16} className="text-gray-600 group-focus-within:text-primary transition-colors" />
                  <input 
                    type="date" 
                    value={startDate} 
                    onChange={e => setStartDate(e.target.value)}
                    className="bg-transparent text-sm font-bold outline-none w-full font-sans"
                  />
                  {!isAllDay && (
                    <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                      <Clock size={16} className="text-gray-600" />
                      <input 
                        type="time" 
                        value={startTime} 
                        onChange={e => setStartTime(e.target.value)}
                        className="bg-transparent text-sm font-bold outline-none w-16 font-sans text-right"
                      />
                    </div>
                  )}
                </div>
              </div>

              {!isAllDay && !isInline && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-1">Data de Término</label>
                  <div className="flex items-center gap-3 bg-black/40 rounded-2xl px-4 py-3.5 border border-white/5 shadow-inner group transition-all focus-within:border-primary/20 text-gray-300">
                    <Calendar size={16} className="text-gray-600 group-focus-within:text-primary transition-colors" />
                    <input 
                      type="date" 
                      value={endDate} 
                      onChange={e => setEndDate(e.target.value)}
                      className="bg-transparent text-sm font-bold outline-none w-full font-sans"
                    />
                    <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                      <Clock size={16} className="text-gray-600" />
                      <input 
                        type="time" 
                        value={endTime} 
                        onChange={e => setEndTime(e.target.value)}
                        className="bg-transparent text-sm font-bold outline-none w-16 font-sans text-right"
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {isInline && !isAllDay && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] ml-1">Término</label>
                  <div className="flex items-center gap-3 bg-black/40 rounded-2xl px-4 py-3.5 border border-white/5 shadow-inner group transition-all focus-within:border-primary/20 text-gray-300">
                    <Calendar size={16} className="text-gray-600 group-focus-within:text-primary transition-colors" />
                    <input 
                      type="date" 
                      value={endDate} 
                      onChange={e => setEndDate(e.target.value)}
                      className="bg-transparent text-sm font-bold outline-none w-full font-sans"
                    />
                    <div className="flex items-center gap-2 border-l border-white/10 pl-3">
                      <Clock size={16} className="text-gray-600" />
                      <input 
                        type="time" 
                        value={endTime} 
                        onChange={e => setEndTime(e.target.value)}
                        className="bg-transparent text-sm font-bold outline-none w-16 font-sans text-right"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className={`flex flex-wrap items-center gap-6 pt-2 border-t border-white/5 pt-6 ${isInline ? 'flex-col items-start' : 'md:col-span-2'}`}>
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-3 group cursor-pointer">
                    <div className="relative">
                      <input 
                        type="checkbox" 
                        checked={isAllDay} 
                        onChange={e => setIsAllDay(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-10 h-5 bg-white/10 rounded-full peer-checked:bg-primary transition-all duration-300" />
                      <div className="absolute top-1 left-1 w-3 h-3 bg-gray-500 rounded-full peer-checked:translate-x-5 peer-checked:bg-black transition-all duration-300" />
                    </div>
                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest group-hover:text-gray-300 transition-colors">Dia Inteiro</span>
                  </label>

                  <div className="flex items-center gap-3 bg-white/[0.03] px-4 py-2 rounded-xl border border-white/5">
                    <RefreshCcw size={14} className="text-gray-600" />
                    <select 
                      value={repeat} 
                      onChange={e => setRepeat(e.target.value)}
                      className="bg-transparent text-[10px] font-black text-primary uppercase tracking-widest outline-none cursor-pointer"
                    >
                      <option value="none" className="bg-[#0A0A0A]">Não se repete</option>
                      <option value="daily" className="bg-[#0A0A0A]">Todos os dias</option>
                      <option value="weekly" className="bg-[#0A0A0A]">Semanalmente</option>
                    </select>
                  </div>
                </div>

                <div className={`flex items-center gap-4 bg-emerald-500/5 px-4 py-2 rounded-xl border border-emerald-500/10 ${isInline ? 'w-full justify-between' : 'ml-auto'}`}>
                  <div className="flex items-center gap-3">
                    <Bell size={14} className="text-emerald-500" />
                    <span className="text-[10px] font-black text-gray-500 uppercase">Lembrete:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      value={notification.value} 
                      onChange={e => setNotification({...notification, value: parseInt(e.target.value) || 0})}
                      className="w-10 bg-transparent text-[10px] font-black text-white text-center outline-none font-sans"
                    />
                    <select 
                      value={notification.unit} 
                      onChange={e => setNotification({...notification, unit: e.target.value})}
                      className="bg-transparent text-[10px] font-black text-emerald-500/60 uppercase outline-none cursor-pointer hover:text-emerald-500 transition-colors"
                    >
                      <option value="minutes" className="bg-[#0A0A0A]">min</option>
                      <option value="hours" className="bg-[#0A0A0A]">horas</option>
                      <option value="days" className="bg-[#0A0A0A]">dias</option>
                    </select>
                    <span className="text-[9px] font-black text-gray-700 uppercase">antes</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-4">
          <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] ml-2">Categorias (Multi-seleção)</label>
          <div className="flex p-2 bg-white/[0.03] border border-white/5 rounded-[32px] items-center gap-2">
            {[
              { id: 'aviso', label: 'Aviso (Geral)' },
              { id: 'evento', label: 'Evento (Calendário)' }
            ].map(cat => {
              const isSelected = types.includes(cat.id);
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
                  className={`flex-1 py-4 md:py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${isSelected ? 'bg-white/10 text-white shadow-xl scale-[1.01]' : 'text-gray-600 opacity-40 hover:opacity-100 hover:bg-white/5'}`}
                >
                  {cat.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="space-y-4">
          <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] ml-2">Prioridade</label>
          <div className="flex p-2 bg-white/[0.03] border border-white/5 rounded-[32px] items-center gap-2">
            {[
              { id: 'normal', label: 'Normal' },
              { id: 'alta', label: 'Alta' },
              { id: 'urgente', label: 'Urgente' }
            ].map(prio => (
              <button
                key={prio.id}
                onClick={() => setPriority(prio.id)}
                className={`flex-1 py-4 md:py-3.5 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${priority === prio.id 
                  ? prio.id === 'urgente' ? 'bg-primary text-white shadow-lg' : prio.id === 'alta' ? 'bg-yellow-500 text-black shadow-lg' : 'bg-white/10 text-white shadow-lg' 
                  : 'text-gray-600 opacity-40 hover:opacity-100 hover:bg-white/5'}`}
              >
                {prio.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  if (isInline) {
    return (
      <div className="flex flex-col h-full bg-[#0A0A0B] relative">
        <div className="px-8 py-7 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#0A0A0B]/95 backdrop-blur-md z-30 shrink-0">
          <button
            onClick={onCancel}
            className="flex items-center gap-2 text-primary text-[11px] font-black uppercase tracking-[0.3em] active:scale-90 transition-all font-sans"
          >
            <ChevronLeft size={20} strokeWidth={3} />
            Voltar
          </button>
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">
            {initialData ? 'EDITAR' : 'CRIAR'} POSTAGEM
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-7 pb-48 no-scrollbar scroll-smooth">
          {InternalFormFields}
          
          <div className="mt-8 space-y-8">
            <div className="space-y-3">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] ml-2">Título Principal</label>
              <input 
                type="text" 
                value={title} 
                onChange={e => setTitle(e.target.value)}
                className="w-full p-6 rounded-[28px] bg-white/[0.03] border border-white/5 text-white text-base focus:outline-none focus:border-primary/20 transition-all font-medium font-sans placeholder:text-gray-800 shadow-inner"
                placeholder="O que os alunos devem saber?"
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-white/30 uppercase tracking-[0.3em] ml-2">Conteúdo</label>
              <div className="rounded-[28px] bg-white/[0.03] border border-white/5 overflow-hidden transition-all focus-within:border-primary/20 shadow-inner">
                <div className="px-5 py-4 border-b border-white/5 bg-white/[0.01]">
                  <TextEditorToolbar editorRef={editorRef} />
                </div>
                <RichTextEditor 
                  ref={editorRef} 
                  initialValue={initialData?.description} 
                  onChange={setDescription} 
                />
              </div>
            </div>
          </div>
        </div>

        <div className="p-8 pb-12 bg-gradient-to-t from-[#0A0A0B] via-[#0A0A0B]/98 to-transparent border-t border-white/5 flex items-center justify-between gap-8 fixed bottom-0 left-0 w-full z-40">
          <button
            onClick={onCancel}
            className="text-[11px] font-black text-gray-500 uppercase tracking-[0.4em] hover:text-white transition-all active:scale-90 px-2 font-sans"
          >
            DESCARTAR
          </button>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('trigger-post-save'))}
            className="px-14 py-5 rounded-full bg-primary text-black text-[12px] font-black uppercase tracking-[0.3em] shadow-[0_20px_40px_-10px_rgba(235,59,90,0.4)] hover:scale-[1.03] active:scale-95 transition-all text-center"
          >
            ATUALIZAR
          </button>
        </div>
      </div>
    );
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
          onClick={onPublish}
          disabled={!title.trim() || !description.trim()}
          className="px-10 py-3 rounded-full text-xs font-black uppercase tracking-widest bg-primary text-black shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-30 transition-all border border-primary/20"
        >
          {initialData ? 'Salvar Alterações' : 'Publicar Agora'}
        </button>
      </div>
    </motion.div>
  )
}

/**
 * NoticeActionMenu - Menu de ações para comunicados (Padrão Aba Aluno)
 */
function NoticeActionMenu({ notice, menuPosition, onClose, onEdit, onDelete }) {
  if (!notice) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1000]">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 md:bg-transparent backdrop-blur-sm md:backdrop-blur-none" 
        onClick={onClose} 
      />

      {/* Desktop Dropdown */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: -10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: -10 }}
        className="hidden md:block absolute z-[1001] w-56 bg-[#0F0F0F] border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-2"
        style={{
          top: menuPosition?.top,
          left: menuPosition?.left,
          originX: 1
        }}
      >
        <button onClick={() => { onEdit(notice); onClose(); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-300 hover:bg-white/5 hover:text-white transition-all group font-medium text-left">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center group-hover:bg-primary/10 transition-colors">
            <Edit2 size={14} className="group-hover:text-primary transition-colors" />
          </div>
          Editar Comunicado
        </button>
        <button onClick={() => { onDelete(notice.id); onClose(); }} className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-500/10 transition-all group font-medium text-left">
          <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
            <Trash2 size={14} />
          </div>
          Apagar Permanente
        </button>
      </motion.div>

      {/* Mobile Bottom Sheet (Padrão Aba Aluno) */}
      <div className="md:hidden">
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 200 }}
          className="fixed inset-x-0 bottom-0 bg-[#0A0A0A] border-t border-white/10 rounded-t-[32px] p-6 pb-12 z-[1002] shadow-[0_-8px_30px_rgb(0,0,0,0.8)]"
        >
          <div className="w-12 h-1.5 bg-white/15 rounded-full mx-auto mb-6" />
          
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
              <BellRing size={22} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-base font-black text-white truncate uppercase tracking-tight">{notice.title}</p>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">Ações Disponíveis</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => { onEdit(notice); onClose(); }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5 active:scale-95 transition-all text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                <Edit2 size={20} className="text-primary" />
              </div>
              <div>
                <p className="text-sm font-black text-white uppercase tracking-wider">Editar Postagem</p>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none mt-1">Alterar conteúdo ou datas</p>
              </div>
            </button>

            <button
              onClick={() => { onDelete(notice.id); onClose(); }}
              className="w-full flex items-center gap-4 p-4 rounded-2xl bg-red-500/5 border border-red-500/10 active:scale-95 transition-all text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
                <Trash2 size={20} className="text-red-500" />
              </div>
              <div>
                <p className="text-sm font-black text-red-500 uppercase tracking-wider">Apagar Comunicado</p>
                <p className="text-[10px] text-red-900 font-bold uppercase tracking-widest leading-none mt-1">Esta ação é irreversível</p>
              </div>
            </button>
          </div>
        </motion.div>
      </div>
    </div>,
    document.body
  );
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
  const [menuPosition, setMenuPosition] = useState(null)
  const [activeTab, setActiveTab] = useState('todos') // 'todos', 'eventos', 'avisos'
  const [expandedId, setExpandedId] = useState(null)
  const isMobile = window.innerWidth < 768
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

  // LOCK BODY SCROLL WHEN MOBILE MENU IS OPEN
  useEffect(() => {
    if ((expandedId || activeDropdown) && isMobile) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [expandedId, activeDropdown, isMobile])

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
              const notificationKey = `${notice.id}_started`
              if (!notifiedIds.current.has(notificationKey)) {
                new Notification(`Evento Iniciado: ${notice.title}`, {
                  body: `O evento começou às ${notice.startTime || '00:00'}.`,
                  icon: '/favicon.ico',
                  tag: notificationKey
                })
                notifiedIds.current.add(notificationKey)
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
    if (isMobile) setExpandedId(notice.id)
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
            description="Requer ação"
            icon={Flame}
            valueColor="text-primary"
          />
          <KPICard
            title="Engajamento"
            value={loading ? '...' : totalViews}
            description="Visualizações totais"
            icon={BarChart3}
            valueColor="text-blue-400"
          />
        </div>

        {/* ── ACTION BAR & FILTERS ── */}
        <div className="flex flex-col md:flex-row items-center gap-4 fade-slide-up delay-100">
          {canEdit && !isMobile && (
            <button
              onClick={() => { setEditingNotice(null); setShowForm(s => !s) }}
              className={`h-14 px-8 rounded-xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center justify-center gap-3 border shadow-lg active:scale-95 shrink-0 ${showForm && !editingNotice 
                  ? 'bg-white/5 border-white/10 text-white' 
                  : 'bg-primary border-primary/20 text-black shadow-primary/20'
                }`}
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

        {/* ── TOP FORM (NEW POSTS ONLY) ── */}
        <AnimatePresence>
          {showForm && !editingNotice && !isMobile && (
            <div className="fade-slide-down">
              <InlinePostForm
                key="new"
                onSave={handleSave}
                onCancel={() => setShowForm(false)}
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
              // INLINE EDITING LOGIC
              if (editingNotice?.id === notice.id && !isMobile) {
                return (
                  <motion.div
                    layout
                    key={`edit-${notice.id}`}
                    className="p-8 rounded-[32px] bg-[#0A0A0A] border border-primary/20 shadow-2xl mb-8"
                  >
                    <InlinePostForm
                      isInline
                      initialData={notice}
                      onSave={handleSave}
                      onCancel={() => setEditingNotice(null)}
                    />
                  </motion.div>
                )
              }

              const badge = priorityBadge[notice.priority]
              const isEvento = notice.types?.includes('evento')
              const isAviso = notice.types?.includes('aviso')
              const relativeTime = getRelativeTime(notice.createdAt)
              const isExpanded = expandedId === notice.id

              const priorityMap = {
                urgente: { label: 'URGENTE', cls: 'bg-primary/20 text-primary border-primary/30', icon: <Flame size={12} /> },
                alta: { label: 'ALTA', cls: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30', icon: <Zap size={12} /> },
                normal: { label: 'NORMAL', cls: 'bg-white/5 text-gray-500 border-white/10', icon: <div className="w-1.5 h-1.5 rounded-full bg-gray-500" /> }
              }
              const pCfg = priorityMap[notice.priority] || priorityMap.normal

              return (
                <motion.div
                  key={notice.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: i * 0.05,
                    layout: { duration: 0.3, ease: 'easeOut' }
                  }}
                  onClick={() => setExpandedId(isExpanded ? null : notice.id)}
                  className={`relative group bg-white/[0.03] border transition-all overflow-hidden cursor-pointer ${isExpanded
                      ? 'rounded-[32px] border-primary/30 bg-white/[0.05] shadow-2xl shadow-primary/5 p-8 px-10'
                      : 'rounded-[24px] border-white/5 hover:border-white/10 p-4 px-6 p-5 px-8 hover:bg-white/[0.04]'
                    }`}
                >
                  {/* Visual Decoration for priority bar */}
                  <div className={`absolute top-0 left-0 bottom-0 w-1.5 transition-colors ${notice.priority === 'urgente' ? 'bg-primary' :
                      notice.priority === 'alta' ? 'bg-yellow-500' : 'bg-transparent'
                    } ${isExpanded ? 'w-2' : ''}`} />

                  {/* STAFF CONTROLS (MoreVertical) */}
                  {canEdit && (
                    <div className="absolute top-6 right-6 z-10 transition-opacity">
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          const rect = e.currentTarget.getBoundingClientRect();
                          setMenuPosition({
                            top: rect.top + window.scrollY + rect.height + 8,
                            left: rect.left + window.scrollX - 180 + rect.width
                          });
                          setActiveDropdown(notice.id); 
                        }}
                        className={`p-2.5 rounded-xl transition-all active:scale-90 border border-transparent ${activeDropdown === notice.id ? 'bg-white/10 text-white' : 'hover:bg-white/10 text-gray-400 hover:text-white'}`}
                      >
                        <MoreVertical size={20} />
                      </button>
                    </div>
                  )}

                  <div className="flex flex-col">
                    <div className={isExpanded ? 'pt-2' : 'pt-2'}></div>

                    <motion.h3
                      layout="position"
                      className={`font-black tracking-tight transition-all ${isExpanded ? 'text-2xl mb-4' : 'text-lg mb-1'}`}
                      style={{ color: '#E4E4E6' }}
                    >
                      {notice.title}
                    </motion.h3>

                    <div className="space-y-1" style={{ color: '#DCDCDF' }}>
                      <motion.div layout="position" className="flex items-center gap-2 overflow-hidden">
                        <span className="text-[10px] font-black lowercase opacity-40 whitespace-nowrap shrink-0">
                          {(!isExpanded || !isMobile) && `${formatDisplayName(notice.authorName)} :`}
                        </span>
                        {(!isExpanded || !isMobile) && (
                          <div
                            className="text-sm font-medium opacity-80 line-clamp-1 text-gray-400 flex-1"
                            dangerouslySetInnerHTML={{ __html: notice.description.replace(/<[^>]*>?/gm, ' ') }}
                          />
                        )}
                      </motion.div>

                      {/* DESKTOP EXPANDED CONTENT - CARREGAMENTO SOB DEMANDA */}
                      <AnimatePresence>
                        {isExpanded && !isMobile && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3, ease: 'easeOut' }}
                            className="overflow-hidden"
                          >
                            <div className="py-6 border-y border-white/5 my-6">
                              <div className="prose prose-invert max-w-none text-gray-300 text-base leading-relaxed">
                                <span className="text-[10px] font-black lowercase opacity-40 mr-2 float-left mt-1.5">
                                  {formatDisplayName(notice.authorName)} :
                                </span>
                                <div
                                  className="[&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-4"
                                  dangerouslySetInnerHTML={{ __html: notice.description }}
                                />
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* UNIFIED INFO BOX (DATE, TIME & BADGES) */}
                    <motion.div
                      layout="position"
                      className={`mt-4 flex flex-wrap items-center justify-center md:justify-start p-3 bg-white/[0.02] border border-white/5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-500 gap-4 ${isExpanded ? 'bg-primary/5 border-primary/10 py-4' : ''}`}
                    >
                      {/* Left Side: Event Details */}
                      {(notice.startDate || notice.startTime) && (
                        <div className="flex items-center justify-center md:justify-start gap-4 flex-wrap">
                          <div className="flex items-center gap-2 px-1">
                            <Calendar size={14} className={`${isExpanded ? 'text-primary' : 'text-primary opacity-60'}`} />
                            <span className={isExpanded ? 'text-gray-300' : ''}>{new Date(notice.startDate).toLocaleDateString('pt-BR')}</span>
                          </div>
                          {!notice.isAllDay && (
                            <div className="flex items-center gap-2 border-l border-white/5 pl-4 px-1">
                              <Clock size={14} className={`${isExpanded ? 'text-primary' : 'text-primary opacity-60'}`} />
                              <span className={isExpanded ? 'text-gray-300' : ''}>{notice.startTime} - {notice.endTime}</span>
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
                      <div className="flex-1 hidden md:block" />

                      {/* Right Side: Technical Badges */}
                      <div className="flex items-center gap-3 md:ml-auto">
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
                    </motion.div>
                  </div>
                </motion.div>
              )
            })
          )}
        </div>
      </div>

      {/* PORTAL PARA MOBILE (DETALHES E EDIÇÃO) */}
      {isMobile && createPortal(
        <AnimatePresence>
          {(expandedId || (showForm && !editingNotice)) && (
            <div className="fixed inset-0 z-[9999] flex flex-col justify-end p-0 m-0 overflow-hidden">
              {(() => {
                const notice = expandedId ? filteredNotices.find(n => n.id === expandedId) : null;
                const isCreating = showForm && !editingNotice;
                
                if (!notice && !isCreating) return null;
                const isEditing = editingNotice?.id === notice?.id || isCreating;

                return (
                  <>
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      onClick={() => !isEditing && setExpandedId(null)}
                      className="absolute inset-0 bg-black/95 backdrop-blur-md"
                    />
                    <motion.div
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      transition={{ type: 'spring', damping: 32, stiffness: 280, mass: 0.8 }}
                      className="relative bg-[#0A0A0B] rounded-t-[42px] h-full flex flex-col w-full shadow-[0_-20px_60px_rgba(0,0,0,0.8)] overflow-hidden"
                    >
                      {isEditing ? (
                        <div className="h-full">
                          <InlinePostForm
                            isInline
                            initialData={notice}
                            onSave={(updatedData) => {
                              handleSave(updatedData);
                              setEditingNotice(null);
                              setShowForm(false);
                              setExpandedId(null);
                            }}
                            onCancel={() => {
                              setEditingNotice(null);
                              setShowForm(false);
                              setExpandedId(null);
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex flex-col h-full overflow-hidden">
                          {/* HEADER COMPACTO ESTILO ABA ALUNO */}
                          <div className="px-8 py-7 border-b border-white/5 flex items-center justify-between sticky top-0 bg-[#0A0A0B]/95 backdrop-blur-md z-30 shrink-0">
                            <button
                              onClick={() => setExpandedId(null)}
                              className="flex items-center gap-2 text-primary text-[11px] font-black uppercase tracking-[0.3em] active:scale-90 transition-all font-sans"
                            >
                              <ChevronLeft size={20} strokeWidth={3} />
                              Voltar
                            </button>
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/20">
                              Visualizar
                            </span>
                          </div>

                          <div className="flex-1 overflow-y-auto p-10 custom-scrollbar no-scrollbar">
                            <div className="mb-12">
                              <div className="flex items-center gap-3 mb-6 p-3 bg-white/[0.03] border border-white/5 rounded-2xl w-fit">
                                <Calendar className="w-4 h-4 text-primary" />
                                <span className="text-[11px] font-black text-white/60 uppercase tracking-widest">
                                  {new Date(notice.startDate).toLocaleDateString('pt-BR')} {notice.startTime && `às ${notice.startTime}`}
                                </span>
                              </div>
                              <h3 className="text-4xl font-black text-white uppercase tracking-tight leading-[1.1]">
                                {notice.title}
                              </h3>
                              <p className="text-[10px] text-gray-600 font-bold uppercase tracking-[0.3em] mt-5">Autor: {formatDisplayName(notice.authorName)}</p>
                            </div>

                            <div className="prose prose-invert max-w-none text-gray-300 text-lg leading-relaxed mb-16">
                              <div
                                className="[&_a]:text-primary [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:mb-6"
                                dangerouslySetInnerHTML={{ __html: notice.description }}
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </motion.div>
                  </>
                );
              })()}
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* FLOAT ACTION BUTTON (FAB) MOBILE - ESTILO ABA ALUNO */}
      {canEdit && isMobile && !showForm && !expandedId && (
        <div className="fixed bottom-8 right-8 z-[90]">
          <button
            onClick={() => { setEditingNotice(null); setShowForm(true); }}
            className="w-16 h-16 rounded-3xl bg-primary text-black flex items-center justify-center shadow-[0_20px_40px_rgba(235,59,90,0.3)] active:scale-90 transition-all border border-primary/20"
          >
            <Plus size={32} strokeWidth={3} />
          </button>
        </div>
      )}

      {/* ACTION MENU GLOBAL */}
      <AnimatePresence>
        {activeDropdown && (
          <NoticeActionMenu
            notice={notices.find(n => n.id === activeDropdown)}
            menuPosition={menuPosition}
            onClose={() => setActiveDropdown(null)}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
        )}
      </AnimatePresence>
    </>
  )
}

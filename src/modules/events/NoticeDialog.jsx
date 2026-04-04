import React, { useState, useEffect, useRef } from 'react'
import { ImagePlus, AlertCircle, Calendar as CalendarIcon, Hash, Check } from 'lucide-react'

export default function NoticeDialog({ isOpen, onClose, onSave, initialData }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState('normal') // normal, alta, urgente
  const [type, setType] = useState('aviso') // aviso, evento
  const textareaRef = useRef(null)

  useEffect(() => {
    if (isOpen) {
      setTitle(initialData?.title || '')
      setDescription(initialData?.description || '')
      setPriority(initialData?.priority || 'normal')
      setType(initialData?.type || 'aviso')
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto'
      }
    }
  }, [isOpen, initialData])

  const handleInput = (e) => {
    e.target.style.height = 'auto'
    e.target.style.height = `${e.target.scrollHeight}px`
  }

  const handleSave = async () => {
    if (!title.trim() || !description.trim()) return
    await onSave({
      title,
      description,
      priority,
      type,
    })
    setTitle('')
    setDescription('')
    onClose()
  }

  if (!isOpen) return null

  const tags = [
    { id: 'normal', label: 'Normal',    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
    { id: 'alta',   label: 'Alta Prioridade', color: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30' },
    { id: 'urgente',label: 'Urgente',   color: 'bg-red-500/20 text-red-500 border-red-500/30' },
    { id: 'evento', label: 'Evento',    color: 'bg-emerald-500/20 text-emerald-500 border-emerald-500/30' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-3xl glass-card bg-[#141414] shadow-2xl rounded-xl border border-white/10 flex flex-col relative animate-in zoom-in-95 duration-200"
        style={{ minHeight: '60vh' }}
      >
        
        {/* FECHAR X */}
        <button 
          onClick={onClose}
          className="absolute top-4 left-4 p-2 text-gray-400 hover:text-white transition-colors flex items-center gap-2 font-semibold"
        >
          <span className="text-xl leading-none">×</span> Novo evento
        </button>

        {/* CÓDIGO DO TÍTULO E DESCRIÇÃO (ESTILO DISCORD) */}
        <div className="flex-1 overflow-y-auto px-10 pt-16 pb-20 scrollbar-thin scrollbar-thumb-white/10">
          <input
            type="text"
            placeholder="Insira o título aqui..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-transparent text-2xl font-bold text-white placeholder-gray-600 outline-none mb-4"
          />
          <textarea
            ref={textareaRef}
            rows={1}
            placeholder="Inserir mensagem..."
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              handleInput(e)
            }}
            onInput={handleInput}
            className="w-full bg-transparent text-gray-300 text-sm placeholder-gray-600 outline-none resize-none overflow-hidden min-h-[300px]"
          />
        </div>

        {/* IMAGE ATTACH ICON (DECORATIVE FOR NOW) */}
        <div className="absolute top-16 right-10">
          <button className="w-12 h-12 bg-white/5 hover:bg-white/10 rounded-xll flex items-center justify-center text-gray-400 border border-white/5 transition-colors">
            <ImagePlus size={20} />
          </button>
        </div>

        {/* BARRA INFERIOR (TAGS E BOTÃO DE PUBLICAR) */}
        <div className="px-10 py-5 bg-[#0a0a0a] rounded-b-[12px] flex items-center justify-between border-t border-white/5">
          <div className="flex items-center gap-3">
            <Hash size={16} className="text-gray-500" />
            <div className="flex gap-2">
              {tags.map(t => {
                let isActive = priority === t.id
                if (t.id === 'evento') isActive = type === 'evento'

                const selectedStyle = isActive 
                  ? t.color.replace('/20', '/40').replace('/30', '/60') + ' ring-1 ring-inset ' + t.color.split(' ')[1].replace('text-', 'ring-')
                  : 'bg-white/5 text-gray-500 border-transparent hover:bg-white/10'

                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (t.id === 'evento') {
                        setType('evento')
                        setPriority('normal')
                      } else {
                        setType('aviso')
                        setPriority(t.id)
                      }
                    }}
                    className={`px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide border transition-all flex items-center gap-1.5 ${selectedStyle}`}
                  >
                    {isActive && <Check size={12} />}
                    {t.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={!title.trim() || !description.trim()}
              className="bg-[#5865F2] hover:bg-[#4752C4] disabled:bg-[#5865F2]/50 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded text-sm font-semibold transition-colors flex items-center gap-2"
            >
              Publicar
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}


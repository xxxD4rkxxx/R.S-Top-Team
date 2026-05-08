/**
 * Página de Logs de Atividade
 * URL: /logs
 * Acesso: admin, gestor, professor
 * Visual: Cards estilo timeline com cores por role
 */
import React, { useState, useRef, useEffect } from 'react'
import { Activity, Clock, RefreshCw } from 'lucide-react'
import { useSystemLogs } from '../../../hooks/useSystemLogs'
import { useTheme } from '../../../context/ThemeContext'

// Cores por tipo de usuário (tema escuro)
const CORES_ROLE_ESCURO = {
  admin: { cor: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/25', badge: 'bg-purple-500/20 text-purple-300' },
  gestor: { cor: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', badge: 'bg-emerald-500/20 text-emerald-300' },
  professor: { cor: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/25', badge: 'bg-blue-500/20 text-blue-300' },
  aluno: { cor: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/25', badge: 'bg-cyan-500/20 text-cyan-300' },
  sistema: { cor: 'text-gray-400', bg: 'bg-gray-500/10', border: 'border-gray-500/25', badge: 'bg-gray-500/20 text-gray-300' },
}

// Cores por tipo de usuário (tema claro)
const CORES_ROLE_CLARO = {
  admin: { cor: 'text-purple-600', bg: 'bg-purple-100', border: 'border-purple-200', badge: 'bg-purple-200 text-purple-700' },
  gestor: { cor: 'text-emerald-600', bg: 'bg-emerald-100', border: 'border-emerald-200', badge: 'bg-emerald-200 text-emerald-700' },
  professor: { cor: 'text-blue-600', bg: 'bg-blue-100', border: 'border-blue-200', badge: 'bg-blue-200 text-blue-700' },
  aluno: { cor: 'text-cyan-600', bg: 'bg-cyan-100', border: 'border-cyan-200', badge: 'bg-cyan-200 text-cyan-700' },
  sistema: { cor: 'text-gray-600', bg: 'bg-gray-100', border: 'border-gray-200', badge: 'bg-gray-200 text-gray-700' },
}

// Ícones e labels por categoria
const INFO_CATEGORIA = {
  evento: { emoji: '📢', label: 'EVENTO', cor: 'text-blue-400' },
  chamada: { emoji: '📋', label: 'CHAMADA', cor: 'text-green-400' },
  visita: { emoji: '🚪', label: 'VISITANTE', cor: 'text-orange-400' },
  aluno: { emoji: '🎓', label: 'ALUNO', cor: 'text-cyan-400' },
  equipe: { emoji: '👥', label: 'EQUIPE', cor: 'text-pink-400' },
  graduacao: { emoji: '🥋', label: 'GRADUAÇÃO', cor: 'text-yellow-400' },
  financeiro: { emoji: '💰', label: 'FINANCEIRO', cor: 'text-emerald-400' },
  sistema: { emoji: '⚙️', label: 'SISTEMA', cor: 'text-gray-400' },
}

// Card de log individual
function CardLog({ log, cores }) {
  const [expandido, setExpandido] = useState(false)
  const estilo = cores[log.userRole] || cores.sistema
  const info = INFO_CATEGORIA[log.category] || INFO_CATEGORIA.sistema

  const tempoRelativo = (data) => {
    if (!data) return ''
    const d = new Date(data)
    const agora = new Date()
    const diffMs = agora - d
    const diffMins = Math.floor(diffMs / 60000)
    const diffHoras = Math.floor(diffMs / 3600000)
    const diffDias = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'Agora'
    if (diffMins < 60) return `${diffMins}min`
    if (diffHoras < 24) return `${diffHoras}h`
    if (diffDias < 7) return `${diffDias}d`
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
  }

  const formatarDataHora = (data) => {
    if (!data) return ''
    const d = new Date(data)
    return d.toLocaleString('pt-BR', { 
      day: '2-digit', 
      month: 'short', 
      hour: '2-digit', 
      minute: '2-digit' 
    })
  }

  return (
    <div 
      className="group relative bg-white/[0.025] border border-white/5 rounded-2xl p-4 hover:bg-white/[0.05] hover:border-white/10 transition-all cursor-pointer overflow-hidden"
      onClick={() => setExpandido(!expandido)}
    >
      {/* Barra lateral colorida por role */}
      <div className={`absolute left-0 top-0 bottom-0 w-1.5 rounded-l-2xl ${estilo.bg.replace('/10', '/30')}`} />

      <div className="pl-3 flex flex-col gap-3">
        {/* Header: categoria + tempo relativo */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">{info.emoji}</span>
            <span className={`text-[10px] font-black uppercase tracking-wider ${info.cor}`}>{info.label}</span>
          </div>
          <span className="text-[10px] text-gray-600 font-medium">{tempoRelativo(log.createdAt)}</span>
        </div>

        {/* Título principal */}
        <div>
          <h3 className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors line-clamp-2">
            {log.action}
          </h3>
          {log.detail && (
            <p className={`text-xs text-gray-500 mt-1 transition-all ${expandido ? 'max-h-40' : 'max-h-0 overflow-hidden'}`}>
              {log.detail}
            </p>
          )}
        </div>

        {/* Footer: autor + role */}
        <div className="flex items-center gap-2 pt-2 border-t border-white/5">
          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${estilo.badge}`}>
            {estilo.label || log.userRole?.toUpperCase()}
          </span>
          <span className="text-xs text-gray-400 truncate flex-1">{log.userName}</span>
          
          {log.targetName && (
            <span className="text-[10px] text-gray-600 flex items-center gap-1">
              →
              <span className="text-gray-500">{log.targetName}</span>
            </span>
          )}
        </div>

        {/* Timestamp completo quando expandido */}
        {expandido && (
          <div className="text-[10px] text-gray-700 font-mono">
            {formatarDataHora(log.createdAt)}
          </div>
        )}
      </div>
    </div>
  )
}

// Página principal de logs
export default function LogsPagina() {
  const containerRef = useRef(null)
  const { logs, loading, carregandoMais, temMais, carregarMais } = useSystemLogs('activity', 100)
  const { activeId: temaAtivo } = useTheme()

  // Determinar cores baseadas no tema
  const temaEscuro = !['light', 'white', 'clean'].includes(temaAtivo)
  const cores = temaEscuro ? CORES_ROLE_ESCURO : CORES_ROLE_CLARO

  // Scroll infinito
  useEffect(() => {
    if (!containerRef.current || loading || !temMais) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !carregandoMais) {
          carregarMais()
        }
      },
      { threshold: 0.1 }
    )

    const sentinel = containerRef.current.querySelector('[data-sentinel]')
    if (sentinel) observer.observe(sentinel)

    return () => observer.disconnect()
  }, [loading, carregandoMais, temMais, carregarMais])

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white p-4 md:p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Activity size={24} className="text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-wider">Logs de Atividade</h1>
            <p className="text-xs text-gray-500">Registro de todas as ações no sistema</p>
          </div>
        </div>
      </div>

      {/* Lista de logs */}
      <div ref={containerRef} className="max-w-4xl mx-auto space-y-3">
        {loading ? (
          <div className="py-12 flex flex-col items-center gap-3">
            <RefreshCw size={24} className="animate-spin text-gray-500" />
            <p className="text-gray-600 text-sm">Carregando logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-12 flex flex-col items-center gap-3 text-center">
            <Activity size={32} strokeWidth={1.9} className="text-gray-600" />
            <p className="text-gray-500 text-sm font-medium">Nenhum registro de atividade</p>
            <p className="text-gray-700 text-xs">As ações realizadas aparecerão aqui</p>
          </div>
        ) : (
          <>
            {logs.map(log => (
              <CardLog key={log.id} log={log} cores={cores} />
            ))}

            {/* Sentinela para scroll infinito */}
            {temMais && (
              <div data-sentinel className="py-4 flex justify-center">
                {carregandoMais ? (
                  <RefreshCw size={20} className="animate-spin text-gray-500" />
                ) : (
                  <p className="text-xs text-gray-600">Role para baixo para carregar mais</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
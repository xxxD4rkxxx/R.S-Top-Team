import { X, Mail, Phone, Shield, Calendar, Edit2, User, Key, CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { useHideMobileNav } from '../../hooks/useHideMobileNav'
import { useSystemUsers } from '../../hooks/useSystemUsers'
import { useState, useEffect } from 'react'

export default function CollaboratorDetailsModal({ collaborator, onClose, onEdit }) {
  useHideMobileNav(!!collaborator)
  const { userData, isAdmin, isGestor } = useAuth()
  const { fetchUserPin } = useSystemUsers()
  const [pin, setPin] = useState(collaborator?.pin || null)
  const [loadingPin, setLoadingPin] = useState(false)

  const canSeeStaff = isAdmin || isGestor || userData?.permissions?.viewStaffPins

  useEffect(() => {
    if (collaborator && !collaborator.pin && canSeeStaff) {
      const loadPin = async () => {
        setLoadingPin(true)
        const p = await fetchUserPin(collaborator.id)
        setPin(p)
        setLoadingPin(false)
      }
      loadPin()
    } else if (collaborator?.pin) {
      setPin(collaborator.pin)
    }
  }, [collaborator, canSeeStaff, fetchUserPin])

  if (!collaborator) return null;

  const {
    name, email, phone, role, status, createdAt, updatedAt, id
  } = collaborator;

  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'U'

  function formatDate(d) {
    if (!d) return 'Não registrada'
    if (typeof d === 'string') return new Date(d).toLocaleDateString('pt-BR')
    if (d.toDate) return d.toDate().toLocaleDateString('pt-BR')
    if (d instanceof Date) return d.toLocaleDateString('pt-BR')
    return 'Data inválida'
  }

  const roleLabels = {
    admin: 'Administrador',
    gestor: 'Gestor(a)',
    professor: 'Professor(a)',
    aluno: 'Aluno(a)'
  }

  const roleStyles = {
    admin: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    gestor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    professor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    aluno: 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        onClick={e => e.stopPropagation()}
        className="modal-content modal-content-bottom-sheet relative max-w-2xl w-full flex flex-col h-[92vh] sm:h-auto sm:max-h-[85vh] overflow-hidden"
      >
        {/* Mobile Drag Handle */}
        <div className="sm:hidden flex justify-center pt-4 pb-2 shrink-0">
          <div className="w-12 h-1.5 bg-white/10 rounded-full" />
        </div>

        {/* CABEÇALHO PREMIUM FIXO */}
        <div className="p-6 md:p-8 border-b border-white/5 flex items-center justify-between bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 shadow-lg shadow-primary/5">
              <Shield size={28} strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tight leading-none">
                Perfil da Equipe
              </h2>
              <p className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mt-2 flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                Acesso de Gestão
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 text-gray-500 hover:text-white transition-all hover:bg-white/10 border border-white/5">
              <X size={24} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 no-scrollbar">
          {/* Header Info */}
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 shrink-0 rounded-3xl flex items-center justify-center font-black text-3xl shadow-2xl ring-4 ring-white/5 bg-gradient-to-br from-white/10 to-white/5 text-white border border-white/10">
              {collaborator.photo || collaborator.photoURL ? (
                <img src={collaborator.photo || collaborator.photoURL} alt={name} className="w-full h-full rounded-2xl object-cover" />
              ) : (
                initials
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-2xl md:text-3xl font-black text-white truncate leading-tight tracking-tight">{name}</p>
              <div className="flex items-center gap-2 mt-3">
                <span className={`text-[9px] font-black px-3 py-1.5 rounded-xl border uppercase tracking-[0.1em] ${roleStyles[role]}`}>
                  {roleLabels[role] || role.toUpperCase()}
                </span>
                <span className={`text-[9px] font-black px-3 py-1.5 rounded-xl border uppercase tracking-[0.1em] ${status === 'Ativo' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                  {status}
                </span>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-3">
              Informações de Contato
              <div className="h-px flex-1 bg-white/5" />
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-4 bg-white/[0.02] p-5 rounded-2xl border border-white/5 shadow-inner transition-all hover:bg-white/[0.04]">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400">
                  <Mail size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">E-mail de Acesso</p>
                  <p className="text-sm text-white truncate font-bold font-mono">{email}</p>
                </div>
              </div>
              
              <div className="flex items-center gap-4 bg-white/[0.02] p-5 rounded-2xl border border-white/5 shadow-inner transition-all hover:bg-white/[0.04]">
                <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-400">
                  <Phone size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">WhatsApp / Celular</p>
                  <p className="text-sm text-white truncate font-bold">{phone || 'Não informado'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Security & System */}
          {canSeeStaff && (
            <div className="space-y-4">
              <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-3">
                Segurança e Credenciais
                <div className="h-px flex-1 bg-white/5" />
              </h3>
              <div className="grid grid-cols-1 gap-4">
                 <div className="flex items-center gap-4 bg-emerald-500/5 p-5 rounded-2xl border border-emerald-500/10">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <Key size={20} />
                  </div>
                  <div>
                    <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">PIN de Acesso Pessoal</p>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xl text-emerald-400 font-mono tracking-[0.3em] font-black">
                        {loadingPin ? <Loader2 size={16} className="animate-spin" /> : (pin || '---')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Activity */}
          <div className="space-y-4">
            <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] flex items-center gap-3">
              Atividade no Sistema
              <div className="h-px flex-1 bg-white/5" />
            </h3>
            <div className="flex items-center gap-5 bg-white/[0.02] p-5 rounded-2xl border border-white/5">
              <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center text-gray-500">
                <Calendar size={20} />
              </div>
              <div className="flex-1 flex justify-between gap-6">
                <div>
                  <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Membro desde</p>
                  <p className="text-xs text-white font-bold">{formatDate(createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[9px] text-gray-500 uppercase font-black tracking-widest">Última atualização</p>
                  <p className="text-xs text-white font-bold">{formatDate(updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="p-6 md:p-8 bg-[#0d0d0d] border-t border-white/5 flex gap-4 shrink-0">
          <button 
            onClick={onClose} 
            className="w-full py-4 rounded-2xl bg-white/5 text-gray-500 text-[10px] font-black uppercase tracking-[0.2em] hover:bg-white hover:text-black transition-all"
          >
            Fechar Perfil
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}


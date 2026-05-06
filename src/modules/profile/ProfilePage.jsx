import React, { useState, useRef } from 'react'
import {
  User, Shield, Bell, Database, Palette, Info, LogOut,
  ChevronRight, Edit2, Camera, Dumbbell, Activity,
  KeyRound, CheckCircle2, Moon, Monitor, X, Save,
  AlertTriangle, AlertCircle, Clock, Users, UserCog,
  GraduationCap, Crown, Plus, Trash2, Eye, EyeOff,
  ArrowLeft, QrCode, ChevronLeft, Settings, Award, RefreshCw,
  Mail, Phone, Calendar, HeartPulse, UserCheck, ShieldCheck
} from 'lucide-react'
import { beltConfig } from '../../data/beltConfig'
import { modalities } from '../../data/modalities'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useSystemUsers } from '../../hooks/useSystemUsers'
import { useSystemLogs } from '../../hooks/useSystemLogs'
import { useTheme, THEMES } from '../../context/ThemeContext'
import { useApp } from '../../context/AppContext'
import { useAuth } from '../../context/AuthContext'
import { formatPhoneUI, parsePhoneData } from '../../utils/phoneUtils'

// ── Ícones de role ──────────────────────────────────────────────
const roleConfig = {
  admin: { label: 'ADMINISTRADOR', icon: Crown, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/25' },
  gestor: { label: 'GESTOR', icon: Shield, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/25' },
  professor: { label: 'PROFESSOR', icon: UserCog, color: 'text-primary', bg: 'bg-primary/10 border-primary/25' },
  aluno: { label: 'ALUNO', icon: GraduationCap, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/25' },
  desenvolvedor: { label: 'DESENVOLVEDOR', icon: Crown, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/25' },
  dono: { label: 'DONO', icon: Crown, color: 'text-purple-400', bg: 'bg-purple-500/10 border-purple-500/25' },
}

// ── Seções da sidebar ───────────────────────────────────────────
const SECTIONS = [
  {
    group: 'Meu perfil',
    items: [
      { id: 'conta', icon: User, label: 'Minha conta' },
      { id: 'seguranca', icon: KeyRound, label: 'Senha & acesso' },
      { id: 'notificacoes', icon: Bell, label: 'Notificações' },
      { id: 'aparencia', icon: Palette, label: 'Aparência' },
    ],
  },
  {
    group: 'Sistema',
    items: [
      { id: 'usuarios', icon: Users, label: 'Usuários' },
      { id: 'academia', icon: Dumbbell, label: 'Academia' },
      { id: 'dados', icon: Database, label: 'Dados & Backup' },
      { id: 'logs', icon: Activity, label: 'Logs de atividade' },
      { id: 'erros', icon: AlertCircle, label: 'Logs de erros' },
    ],
  },
  {
    group: 'Info',
    items: [
      { id: 'sobre', icon: Info, label: 'Sobre o sistema' },
    ],
  },
]

// ════════════════════════════════════════════════════════════════
//  PAINEL: MINHA CONTA
// ════════════════════════════════════════════════════════════════
function SectionConta({ user, authUser, activeRole, onUpdateProfile }) {
  const [editingField, setEditingField] = useState(null)
  const [fieldValue, setFieldValue] = useState('')
  const [saving, setSaving] = useState(false)

  const startEdit = (field, current) => { setEditingField(field); setFieldValue(current || '') }
  const cancelEdit = () => setEditingField(null)

  const saveField = async () => {
    setSaving(true)
    try { await onUpdateProfile({ [editingField]: fieldValue }) }
    finally { setSaving(false); setEditingField(null) }
  }


  const initials = (user?.name || 'M').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
  const role = roleConfig[activeRole] || roleConfig[user?.role] || roleConfig.aluno

  return (
    <div className="space-y-6">
      {/* PROFILE CARD */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid color-mix(in srgb, var(--clr-primary-dark) 35%, transparent)' }}>
        {/* BANNER (STATIC GRADIENT) */}
        <div className="h-28 w-full relative">
          <div className="w-full h-full" style={{ background: 'linear-gradient(135deg, var(--clr-primary-dark) 0%, var(--clr-primary) 60%, #FF3057 100%)' }}>
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.12) 10px, rgba(0,0,0,0.12) 20px)' }} />
          </div>
        </div>

        {/* AVATAR + INFO */}
        <div className="px-6 pb-5" style={{ background: 'var(--clr-surface-2)' }}>
          <div className="flex items-end gap-4 -mt-10 mb-4">
            {/* AVATAR */}
            {/* AVATAR (INITIALS ONLY) */}
            <div className="relative flex-shrink-0">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-black text-white ring-4 shadow-xl shadow-primary/20" style={{ background: 'linear-gradient(135deg, var(--clr-primary-dark), var(--clr-primary))', ringColor: 'var(--clr-surface-2)' }}>
                {initials}
              </div>
            </div>

            <div className="pb-1 flex-1 min-w-0">
              <p className="text-white font-bold text-lg leading-none truncate">{user?.name || 'Anon'}</p>
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              {/* TAGS DE CARGO (ROLES) */}
              {(() => {
                const rolesSet = new Set()
                
                // 1. Coleta do objeto roles (plural/SSoT)
                if (user?.roles) {
                  Object.entries(user.roles).forEach(([k, active]) => {
                    if (active) rolesSet.add(k.toLowerCase())
                  })
                }

                // 2. Coleta do campo role (singular/Legado)
                if (user?.role) {
                  rolesSet.add(user.role.toLowerCase())
                }

                // 3. Fallback: Se não houver nenhum cargo identificado, assume Aluno
                if (rolesSet.size === 0) {
                  rolesSet.add('aluno')
                }

                // 4. Ordenação por importância: Admin/Dono > Gestor > Professor > Aluno
                const priority = { admin: 0, dono: 0, desenvolvedor: 0, gestor: 1, professor: 2, aluno: 3 }
                const roles = Array.from(rolesSet).sort((a, b) => (priority[a] ?? 99) - (priority[b] ?? 99))

                return roles.map(rKey => {
                  const rCfg = roleConfig[rKey] || roleConfig.aluno
                  return (
                    <div key={rKey} className={`px-3 py-1.5 rounded-2xl text-[10px] font-bold flex items-center gap-1.5 border transition-all hover:scale-105 ${rCfg.bg}`}>
                      <rCfg.icon size={12} className={rCfg.color} />
                      <span className={rCfg.color}>{rCfg.label}</span>
                    </div>
                  )
                })
              })()}

              {/* TAG DE STATUS */}
              {user?.status && (
                <div className={`px-3 py-1.5 rounded-2xl text-[10px] font-bold flex items-center gap-1.5 border transition-all ${
                  user.status === 'ativo' ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400' : 'bg-red-500/10 border-red-500/25 text-red-400'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${user.status === 'ativo' ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
                  <span className="uppercase">{user.status}</span>
                </div>
              )}

              {/* TAG DE FAIXA (Se aplicável) */}
              {user?.belt && user.belt !== 'none' && (
                <div className="px-3 py-1.5 rounded-2xl text-[10px] font-bold flex items-center gap-1.5 border border-white/10 bg-white/5 text-gray-300">
                  <Award size={12} className="text-white/40" />
                  <span className="uppercase">{beltConfig[user.belt]?.label || user.belt}</span>
                </div>
              )}

              {/* TAGS DE MODALIDADE */}
              {(user?.modalities || (user?.modality ? [user.modality] : [])).map(m => (
                <div key={m} className="px-3 py-1.5 rounded-2xl text-[10px] font-bold flex items-center gap-1.5 border border-primary/20 bg-primary/5 text-primary-light">
                  <Dumbbell size={12} className="opacity-50" />
                  <span className="uppercase">{m}</span>
                </div>
              ))}

              {/* TAG DE CATEGORIA (Adulto/Kids) */}
              {user?.ageCategory && (
                <div className="px-3 py-1.5 rounded-2xl text-[10px] font-bold flex items-center gap-1.5 border border-white/10 bg-white/5 text-gray-400">
                  <Users size={12} className="opacity-50" />
                  <span className="uppercase">{user.ageCategory}</span>
                </div>
              )}

              {/* TAG DE GÊNERO */}
              {user?.gender && (
                <div className="px-3 py-1.5 rounded-2xl text-[10px] font-bold flex items-center gap-1.5 border border-white/10 bg-white/5 text-gray-400">
                  <User size={12} className="opacity-50" />
                  <span className="uppercase">{user.gender === 'Masculino' ? 'MASC' : user.gender === 'Feminino' ? 'FEM' : user.gender}</span>
                </div>
              )}

              {/* TAG DE TOTAL DE AULAS */}
              {user?.total_visitas !== undefined && (
                <div className="px-3 py-1.5 rounded-2xl text-[10px] font-bold flex items-center gap-1.5 border border-white/10 bg-white/5 text-gray-400">
                  <Activity size={12} className="text-primary opacity-70" />
                  <span>{user.total_visitas || 0} AULAS</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="px-3 py-1.5 rounded-2xl text-[11px] font-bold text-gray-400" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>🥋 RS Top Team</span>
            <span className="px-3 py-1.5 rounded-2xl text-[11px] font-bold text-gray-400" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
              📅 Desde {
                (() => {
                  const raw = user?.startDate || user?.criadoEm || user?.createdAt || user?.dataRegistro || user?.registrationDate || authUser?.metadata?.creationTime
                  if (!raw) return '—'
                  try {
                    // Função auxiliar para converter qualquer formato de data do Firebase/JS
                    const date = (raw && typeof raw.toDate === 'function')
                      ? raw.toDate()
                      : (typeof raw === 'string' || typeof raw === 'number')
                        ? new Date(raw)
                        : raw

                    return date instanceof Date && !isNaN(date)
                      ? date.toLocaleDateString('pt-BR')
                      : '—'
                  } catch (e) {
                    return '—'
                  }
                })()
              }
            </span>
          </div>
        </div>
      </div>

      {/* EDIT FIELDS */}
      <Section title="Informações da conta">
        {[
          { key: 'name', label: 'Nome', val: user?.name || 'Anon' },
          { key: 'email', label: 'E-mail', val: user?.email || '—' },
          { key: 'phone', label: 'Telefone', val: user?.phone || '—' },
          { key: 'pin', label: 'PIN de Acesso', val: user?.pin || '—' },
        ].map(f => (
          <div key={f.key}>
            {editingField === f.key ? (
              <div className="flex items-center gap-3 px-5 py-3">
                <div className="flex-1">
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">{f.label}</p>
                  <input
                    autoFocus
                    value={fieldValue}
                    onChange={e => setFieldValue(e.target.value)}
                    className="form-input text-sm py-2 px-3 focus:border-primary/50 transition-all"
                    placeholder={f.label}
                    onKeyDown={e => e.key === 'Enter' && saveField()}
                  />
                </div>
                <div className="flex gap-2 items-end pb-0.5 mt-5">
                  <button onClick={saveField} disabled={saving} className="btn-primary px-3 py-1.5 rounded-md text-xs font-bold flex items-center gap-1.5">
                    <Save size={12} /> {saving ? '...' : 'Salvar'}
                  </button>
                  <button onClick={cancelEdit} className="px-3 py-1.5 rounded-md text-xs text-gray-600 hover:text-app hover:bg-white/5 transition-colors border border-white/5">
                    <X size={12} />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between px-5 py-4 group">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-0.5">{f.label}</p>
                  <p className={`text-sm font-medium ${f.key === 'pin' ? 'font-mono tracking-[0.3em] text-emerald-400 font-black' : 'text-app'}`}>{f.val}</p>
                </div>
                {f.key !== 'pin' && (
                  <button onClick={() => startEdit(f.key, f.val)} className="px-3 py-1 rounded-md text-xs text-gray-600 hover:text-app hover:bg-white/5 transition-colors border border-white/5">
                    <Edit2 size={18} strokeWidth={1.9} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </Section>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  PAINEL: PIN & ACESSO
// ════════════════════════════════════════════════════════════════
function SectionSeguranca({ user, onChangePassword, activityLogs }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPwd, setShowPwd] = useState(false)
  const [status, setStatus] = useState(null) // null | 'ok' | 'err'
  const [errMsg, setErrMsg] = useState('')
  const [loading, setLoading] = useState(false)

  // Filtra apenas o histórico deste usuário (Segurança de Dados)
  const myLogs = (activityLogs || []).filter(l => 
    l.action === 'Login' && 
    (l.userName === user?.name || l.userId === user?.id || l.userId === user?.uid)
  ).slice(0, 5)

  // Validação: apenas números e máximo 6 dígitos
  const handlePinInput = (setter) => (val) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 6)
    setter(cleaned)
  }

  const handleUpdate = async () => {
    if (next.length !== 6) { 
      setStatus('err'); 
      setErrMsg('O PIN deve ter exatamente 6 dígitos numéricos'); 
      return 
    }
    if (next !== confirm) { 
      setStatus('err'); 
      setErrMsg('Os PINs não coincidem'); 
      return 
    }
    
    setLoading(true); setStatus(null)
    try {
      // onChangePassword no useSystemUsers já sincroniza Firestore e Firebase Auth
      await onChangePassword(current, next)
      setStatus('ok'); setCurrent(''); setNext(''); setConfirm('')
    } catch (e) {
      console.error('Erro na atualização do PIN:', e)
      setStatus('err')
      // Detecta bloqueio por AdBlock ou falta de rede
      if (!window.navigator.onLine || e.message?.includes('network') || e.code?.includes('network')) {
        setErrMsg('Erro de conexão ou bloqueio do navegador (AdBlock). Verifique suas extensões.')
      } else {
        setErrMsg(e.code === 'auth/wrong-password' ? 'PIN atual incorreto' : 'Erro ao atualizar. Verifique sua conexão.')
      }
    } finally { setLoading(false) }
  }

  return (
    <div className="space-y-6">
      <Section title="Segurança da Conta">
        <div className="px-5 py-4 space-y-4">
          <div className="flex flex-col gap-4">
            <FormInput 
              label="Senha/PIN Atual" 
              value={current} 
              onChange={(v) => setCurrent(v.slice(0, 6))} 
              type={showPwd ? 'text' : 'password'} 
              placeholder="Digite sua senha ou PIN atual"
            />
            <FormInput 
              label="Novo PIN (Exatamente 6 dígitos)" 
              value={next} 
              onChange={handlePinInput(setNext)} 
              type={showPwd ? 'text' : 'password'} 
              placeholder="Ex: 123456"
            />
            <FormInput 
              label="Confirmar Novo PIN" 
              value={confirm} 
              onChange={handlePinInput(setConfirm)} 
              type={showPwd ? 'text' : 'password'} 
              placeholder="Repita o novo PIN"
            />
          </div>

          <div className="flex items-center justify-between pt-2">
            <button 
              onClick={() => setShowPwd(v => !v)} 
              className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-gray-500 hover:text-gray-300 transition-colors"
            >
              {showPwd ? <EyeOff size={16} /> : <Eye size={16} />} {showPwd ? 'Ocultar' : 'Mostrar'} PIN
            </button>
            <button 
              onClick={handleUpdate} 
              disabled={loading || current.length < 6 || next.length < 6 || confirm.length < 6}
              className="px-6 py-2.5 rounded-xl bg-primary text-white text-xs font-black uppercase hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-40"
            >
              {loading ? 'Salvando...' : 'Atualizar PIN'}
            </button>
          </div>

          {status === 'ok' && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <p className="text-[11px] text-emerald-400 font-bold uppercase">PIN atualizado com sucesso!</p>
            </div>
          )}

          {status === 'err' && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center gap-2">
              <AlertTriangle size={16} className="text-red-500" />
              <p className="text-[11px] text-red-400 font-bold uppercase">{errMsg}</p>
            </div>
          )}
        </div>
      </Section>

      <Section title="Histórico de Acesso">
        <div className="divide-y divide-white/5">
          {myLogs.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <ShieldCheck size={32} className="text-gray-700 mx-auto mb-2 opacity-20" />
              <p className="text-gray-600 text-xs uppercase font-bold tracking-widest">Nenhum login recente</p>
            </div>
          ) : (
            myLogs.map(log => (
              <div key={log.id} className="flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                    <Smartphone size={14} className="text-gray-400" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-bold">{log.detail || 'Dispositivo Autorizado'}</p>
                    <p className="text-[10px] text-gray-500 font-medium">{log.ip || 'Localização não identificada'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <LogTime date={log.createdAt} />
                  <p className="text-[8px] text-emerald-500 font-black uppercase tracking-tighter mt-0.5">Ativo</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Section>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  PAINEL: USUÁRIOS DO SISTEMA
// ════════════════════════════════════════════════════════════════
function SectionUsuarios({ users, onAddUser, onUpdateUser, onDeleteUser, onSync }) {
  const [showAdd, setShowAdd] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [errors, setErrors] = useState([])
  const [selectedUser, setSelectedUser] = useState(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [showConfirmExit, setShowConfirmExit] = useState(false)
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null) // State for created PIN

  // -- Form States --
  const initialFormState = {
    name: '',
    role: 'professor',
    cpf: '',
    gender: '',
    email: '',
    phone: '',
    startDate: new Date().toISOString().split('T')[0],
    status: 'Ativo',
    healthInfo: '',
    modalities: [],
    jiuJitsu: { belt: 'white', stripes: 0, lastGraduation: '' }
  }

  const [form, setForm] = useState(initialFormState)

  const updateForm = (updates) => {
    setForm(prev => ({ ...prev, ...updates }))
    setHasChanges(true)
  }

  const handleToggleModality = (m) => {
    const next = form.modalities.includes(m)
      ? form.modalities.filter(x => x !== m)
      : [...form.modalities, m]
    updateForm({ modalities: next })
  }

  const handleCloseForm = () => {
    if (hasChanges) {
      setShowConfirmExit(true)
    } else {
      setShowAdd(false)
      setEditingId(null)
      resetForm()
    }
  }

  const resetForm = () => {
    setForm(initialFormState)
    setHasChanges(false)
    setErrors([])
    setEditingId(null)
  }

  const handleAdd = async () => {
    const newErrors = []
    if (!form.name.trim()) newErrors.push('name')
    if (!form.cpf.trim()) newErrors.push('cpf')
    if (!form.gender) newErrors.push('gender')
    if (!form.email.trim()) newErrors.push('email')

    if (newErrors.length > 0) {
      setErrors(newErrors)
      setTimeout(() => setErrors([]), 3000)
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        // 📱 Processamento do Telefone para edição
        const phoneData = parsePhoneData(form.phone)
        const updates = { ...form }
        if (phoneData) {
          updates.phone = phoneData.display
          updates.ddd = phoneData.ddd
          updates.telefone_limpo = phoneData.telefone_limpo
          updates.telefone_completo = phoneData.telefone_completo
        }
        await onUpdateUser(editingId, updates, form.role)
        resetForm()
        setShowAdd(false)
      } else {
        // 📱 Processamento do Telefone para criação
        const phoneData = parsePhoneData(form.phone)
        if (!phoneData) {
          setErrors(['phone'])
          return
        }

        const payload = {
          ...form,
          phone: phoneData.display,
          ddd: phoneData.ddd,
          telefone_limpo: phoneData.telefone_limpo,
          telefone_completo: phoneData.telefone_completo,
          createdAt: new Date().toISOString()
        }
        const res = await onAddUser(payload)
        setResult(res)
      }
    } catch (err) {
      console.error("Save error:", err)
    } finally {
      setSaving(false)
    }
  }

  const handleEdit = (u) => {
    setForm({
      ...initialFormState,
      ...u,
      jiuJitsu: { ...initialFormState.jiuJitsu, ...(u.jiuJitsu || {}) }
    })
    setEditingId(u.id)
    setShowAdd(true)
    setHasChanges(false)
  }

  const handleDelete = async (userId, role) => {
    if (window.confirm('Tem certeza que deseja excluir este colaborador? Esta ação não pode ser desfeita.')) {
      try {
        await onDeleteUser(userId, role)
      } catch (err) {
        console.error("Delete error:", err)
      }
    }
  }

  // Formatting helpers
  const formatDate = (d) => {
    if (!d) return '—'
    try {
      const date = (typeof d === 'string')
        ? (d.includes('T') ? new Date(d) : new Date(d + 'T12:00:00'))
        : (d.toDate ? d.toDate() : new Date(d))
      return date.toLocaleDateString('pt-BR')
    } catch (e) {
      return '—'
    }
  }

  const formatCPF = (val) => {
    const numbers = val.replace(/\D/g, '')
    return numbers
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1')
      .slice(0, 14)
  }

  const formatPhone = (val) => formatPhoneUI(val)

  const isJiuJitsu = form.modalities.some(m => m.toLowerCase().includes('jiu'))

  return (
    <div className="space-y-8 animate-in fade-in duration-500">

      {/* HEADER + ACTION */}
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <div>
          <h3 className="text-xl font-bold text-white tracking-tight">Equipe & Colaboradores</h3>
          <p className="text-xs text-gray-500 mt-1">Gerencie permissões e acessos de todos os usuários do sistema.</p>
        </div>
        {!showAdd && (
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (window.confirm('Executar sincronização profunda? Isso alinhará todos os IDs de usuários e permissões.')) {
                  try {
                    const stats = await onSync()
                    alert(`Sincronização concluída!\n\nAlunos: ${stats.students}\nEquipe: ${stats.collaborators}\nCorrigidos: ${stats.merged || 0}`)
                  } catch (e) {
                    alert('Erro na sincronização: ' + e.message)
                  }
                }
              }}
              className="px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-gray-400 text-xs font-bold rounded-md flex items-center gap-2 transition-all active:scale-95"
            >
              <RefreshCw size={16} /> Sincronizar Base
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="px-4 py-2 bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary text-xs font-bold rounded-md flex items-center gap-2 transition-all active:scale-95"
            >
              <Plus size={16} />
              Adicionar Membro
            </button>
          </div>
        )}
      </div>

      {/* FORM ADICIONAR (REFACTORADO) */}
      {showAdd && (
        <div className="rounded-xl p-6 space-y-8 bg-[#0a0a0a] border border-white/10 shadow-2xl animate-in slide-in-from-top-2 duration-300 ring-1 ring-white/5">

          <div className="flex items-center justify-between">
            <h4 className="text-sm font-black uppercase tracking-widest text-primary flex items-center gap-2">
              <UserCog size={18} /> {editingId ? 'Editar Colaborador' : 'Novo Colaborador'}
            </h4>
            <button onClick={handleCloseForm} className="text-gray-500 hover:text-white transition-colors">
              <X size={20} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="space-y-2">
              <FormInput
                label="Nome Completo *"
                value={form.name}
                onChange={(val) => updateForm({ name: val })}
                placeholder="Ex: Roberto Silva"
                error={errors.includes('name')}
              />
            </div>

            <div className="space-y-2">
              <FormInput
                label="CPF *"
                value={form.cpf}
                onChange={(val) => updateForm({ cpf: formatCPF(val) })}
                placeholder="000.000.000-00"
                error={errors.includes('cpf')}
              />
            </div>

            <div className="space-y-2">
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 pl-1">Sexo *</p>
              <select
                value={form.gender}
                onChange={(e) => updateForm({ gender: e.target.value })}
                className={`w-full bg-white/5 border rounded-md px-4 py-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-all ${errors.includes('gender') ? 'border-primary shadow-[0_0_10px_rgba(225,29,72,0.2)] animate-pulse' : 'border-white/10'}`}
              >
                <option value="" className="bg-[#111]">Selecione...</option>
                <option value="Masculino" className="bg-[#111]">Masculino</option>
                <option value="Feminino" className="bg-[#111]">Feminino</option>
                <option value="Outro" className="bg-[#111]">Outro</option>
              </select>
              {errors.includes('gender') && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1, x: [-2, 2, -2, 2, 0] }} className="text-[9px] text-primary font-black uppercase tracking-widest ml-1">Obrigatório</motion.p>}
            </div>
          </div>

          {/* CONTATO */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
              <div className="h-px flex-1 bg-white/5" />
              <span>Contato</span>
              <div className="h-px flex-1 bg-white/5" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <FormInput
                label="Email *"
                value={form.email}
                onChange={(val) => updateForm({ email: val })}
                placeholder="roberto@email.com"
                error={errors.includes('email')}
              />
              <FormInput label="Telefone" value={form.phone} onChange={(val) => updateForm({ phone: formatPhone(val) })} placeholder="91 99999-9999" />
            </div>
          </div>

          {/* CADASTRO */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
              <div className="h-px flex-1 bg-white/5" />
              <span>Cadastro & Saúde</span>
              <div className="h-px flex-1 bg-white/5" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <FormInput label="Data Inicial" type="date" value={form.startDate} onChange={(val) => updateForm({ startDate: val })} />
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 pl-1">Estado</p>
                <div className="flex bg-white/5 p-1 rounded-md border border-white/10">
                  <button onClick={() => updateForm({ status: 'Ativo' })} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${form.status === 'Ativo' ? 'bg-emerald-500 text-white' : 'text-gray-500 hover:text-white'}`}>Ativo</button>
                  <button onClick={() => updateForm({ status: 'Inativo' })} className={`flex-1 py-2 text-xs font-bold rounded-md transition-all ${form.status === 'Inativo' ? 'bg-red-500 text-white' : 'text-gray-500 hover:text-white'}`}>Inativo</button>
                </div>
              </div>
              <FormInput label="Doença ou Medicação" value={form.healthInfo} onChange={(val) => updateForm({ healthInfo: val })} placeholder="Opcional..." />
            </div>
          </div>

          {/* MODALIDADES */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">
              <div className="h-px flex-1 bg-white/5" />
              <span>Modalidades e Cargo</span>
              <div className="h-px flex-1 bg-white/5" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Cargo Selection */}
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 pl-1">Cargo no Sistema</p>
                <div className="flex flex-wrap gap-2">
                  {['admin', 'gestor', 'professor'].map(r => {
                    const cfg = roleConfig[r]
                    return (
                      <button key={r} onClick={() => updateForm({ role: r })}
                        className={`px-4 py-3 rounded-md text-xs font-bold border transition-all flex items-center gap-2 ${form.role === r ? 'bg-white border-white text-black' : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/20'}`}>
                        <cfg.icon size={14} /> {cfg.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Modality Selection */}
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 pl-1">Modalidades Ensinadas</p>
                <div className="flex flex-wrap gap-2">
                  {modalities.map(m => (
                    <button key={m} onClick={() => handleToggleModality(m)}
                      className={`px-4 py-3 rounded-md text-xs font-bold border transition-all flex items-center gap-2 ${form.modalities.includes(m) ? 'bg-primary border-primary text-white' : 'bg-white/5 border-white/5 text-gray-500 hover:border-white/20'}`}>
                      {m.toLowerCase().includes('jiu') ? <Award size={14} /> : <Dumbbell size={14} />} {m}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* JIU JITSU SPECIFIC FIELDS */}
          {isJiuJitsu && (
            <div className="rounded-xl p-6 bg-primary/5 border border-primary/20 space-y-5 animate-in zoom-in-95 duration-300">
              <h5 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                🥋 Informações de Jiu Jitsu
              </h5>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div>
                  <p className="text-[10px] font-bold text-primary/60 uppercase tracking-widest mb-1 pl-1">Faixa</p>
                  <select
                    value={form.jiuJitsu.belt}
                    onChange={(e) => updateForm({ jiuJitsu: { ...form.jiuJitsu, belt: e.target.value } })}
                    className="w-full bg-black border border-primary/30 rounded-md px-4 py-3 text-sm text-white"
                  >
                    {Object.entries(beltConfig).map(([id, cfg]) => (
                      <option key={id} value={id} className="bg-[#111]">{cfg.label}</option>
                    ))}
                  </select>
                </div>
                <FormInput
                  label="Grau (0-4)"
                  type="number"
                  value={form.jiuJitsu.degree}
                  onChange={(val) => updateForm({ jiuJitsu: { ...form.jiuJitsu, degree: parseInt(val) || 0 } })}
                />
                <FormInput
                  label="Última Graduação"
                  type="date"
                  value={form.jiuJitsu.lastGraduation}
                  onChange={(val) => updateForm({ jiuJitsu: { ...form.jiuJitsu, lastGraduation: val } })}
                />
              </div>
            </div>
          )}

          {/* SAVE / CANCEL BUTTONS */}
          <div className="flex gap-3 pt-4">
            <button onClick={handleCloseForm} className="flex-1 py-4 bg-white/5 hover:bg-white/10 text-gray-400 font-bold rounded-md transition-all border border-white/5 active:scale-95">
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              disabled={saving}
              className="flex-[2] py-4 bg-primary hover:bg-primary-dark disabled:opacity-50 text-white font-black rounded-md transition-all shadow-xl shadow-primary/20 flex items-center justify-center gap-2 active:scale-95"
            >
              {saving ? <RefreshCw size={20} className="animate-spin" /> : <Save size={20} />}
              {saving ? 'Gravando...' : editingId ? 'Atualizar Colaborador' : 'Salvar Colaborador'}
            </button>
          </div>
        </div>
      )}

      {/* CONFIRM EXIT MODAL (CUSTOM ALERT) */}
      <AnimatePresence>
        {showConfirmExit && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowConfirmExit(false)} className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} className="relative w-full max-w-[420px] bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl overflow-hidden">
              <div className="flex items-center gap-2 px-6 py-4 bg-white/5 border-b border-white/10 justify-between">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Fechar documento</span>
                <X size={16} className="text-gray-600 cursor-pointer hover:text-white" onClick={() => setShowConfirmExit(false)} />
              </div>
              <div className="p-8 flex gap-6 items-start">
                <div className="w-16 h-16 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0 border border-primary/20">
                  <AlertTriangle className="text-primary" size={32} />
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white leading-tight">Alterações não salvas</h4>
                  <p className="text-sm text-gray-500 mt-2">Você deseja salvar as informações do colaborador antes de sair?</p>
                </div>
              </div>
              <div className="p-6 bg-white/5 flex gap-2 justify-center">
                <button
                  onClick={() => { handleAdd(); setShowConfirmExit(false) }}
                  className="flex-1 py-3 bg-primary text-white rounded-md text-sm font-black uppercase tracking-widest shadow-lg shadow-primary/20 active:scale-95 transition-all"
                >
                  Salvar
                </button>
                <button
                  onClick={() => { resetForm(); setShowAdd(false); setShowConfirmExit(false) }}
                  className="flex-1 py-3 bg-white/5 text-gray-400 rounded-md text-sm font-black uppercase tracking-widest hover:text-white active:scale-95 transition-all"
                >
                  Descartar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LISTA DE USUÁRIOS (ESTILO ALUNO) */}
      <div className="bg-[#090909] rounded-xl border border-white/5 overflow-hidden shadow-2xl relative">
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.02] to-transparent pointer-events-none" />

        <div className="hidden md:grid grid-cols-12 gap-4 px-8 py-5 bg-white/5 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-white/5 relative z-10">
          <div className="col-span-5">Membro da Equipe</div>
          <div className="col-span-3">Função / Cargo</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2 text-right">Ações</div>
        </div>

        <div className="divide-y divide-white/5 relative z-10">
          {users.map(u => {
            const ini = (u.name || '?').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
            const cfg = roleConfig[u.role] || roleConfig.aluno
            const dateStr = formatDate(u.startDate || u.createdAt)

            return (
              <div key={u.id} className="group relative transition-all hover:bg-white/[0.03]">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 px-8 py-5 items-center">
                  {/* Avatar + Info */}
                  <div className="col-span-12 md:col-span-5 flex items-center gap-4 cursor-pointer" onClick={() => setSelectedUser(u)}>
                    <div className="w-12 h-12 rounded-md flex items-center justify-center text-sm font-black text-white flex-shrink-0 shadow-lg"
                      style={{ background: 'linear-gradient(135deg, var(--clr-primary-dark), var(--clr-primary))' }}>
                      {u.avatarUrl ? <img src={u.avatarUrl} className="w-full h-full rounded-md object-cover" /> : ini}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-base font-bold truncate leading-none group-hover:text-primary transition-colors mb-2">{u.name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 text-[10px] font-medium tracking-tight truncate">{u.email || '—'}</span>
                        <span className="w-1 h-1 rounded-full bg-white/10" />
                        <span className="text-gray-600 text-[9px] font-bold uppercase tracking-wider">Desde {dateStr}</span>
                      </div>
                    </div>
                  </div>

                  {/* Cargo Badge */}
                  <div className="col-span-6 md:col-span-3">
                    <div className={`w-fit px-3 py-1.5 rounded-sm border text-[9px] font-black tracking-widest flex items-center gap-2 shadow-sm ${cfg.bg} ${cfg.color}`}>
                      <cfg.icon size={12} />
                      {cfg.label}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="col-span-3 md:col-span-2">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-sm border text-[9px] font-black uppercase tracking-widest ${u.status === 'Inativo' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                      }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${u.status === 'Inativo' ? 'bg-red-500 animate-pulse' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`} />
                      {u.status || 'Ativo'}
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="col-span-3 md:col-span-2 flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                    <button
                      onClick={() => setSelectedUser(u)}
                      className="p-2.5 rounded-md bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition-all active:scale-95"
                      title="Ver Detalhes"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => handleEdit(u)}
                      className="p-2.5 rounded-md bg-white/10 border border-white/10 text-gray-300 hover:text-white hover:bg-white/20 transition-all active:scale-95"
                      title="Editar"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(u.id, u.role)}
                      className="p-2.5 rounded-md bg-red-500/10 border border-red-500/10 text-red-400 hover:text-white hover:bg-red-500 transition-all active:scale-95"
                      title="Excluir"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          {users.length === 0 && (
            <div className="py-20 text-center space-y-4">
              <div className="w-16 h-16 rounded-lg bg-white/5 mx-auto flex items-center justify-center text-gray-600">
                <Users size={32} />
              </div>
              <p className="text-gray-500 text-sm font-medium">Nenhum colaborador encontrado.</p>
            </div>
          )}
        </div>
      </div>

      {/* MODAL DE SUCESSO (Criação com PIN) */}
      <AnimatePresence>
        {result && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setResult(null); resetForm(); setShowAdd(false); }} className="absolute inset-0 bg-black/85 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative w-full max-w-md bg-[#1a1a1a] rounded-xl border border-white/10 shadow-2xl overflow-hidden p-8 text-center space-y-6">
              <div className="w-20 h-20 bg-emerald-500/20 rounded-2xl mx-auto flex items-center justify-center border border-emerald-500/20 text-emerald-500">
                <CheckCircle2 size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white">Pronto!</h3>
                <p className="text-sm text-gray-400">O colaborador foi cadastrado com sucesso no sistema.</p>
              </div>

              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest">PIN de Acesso Único</p>
                <div className="flex justify-center gap-2">
                  {result.pin.split('').map((d, i) => (
                    <div key={i} className="w-10 h-14 bg-black border border-primary/30 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-xl shadow-primary/10">
                      {d}
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">Forneça este PIN ao colaborador para o primeiro acesso.</p>
              </div>

              <button
                onClick={() => { setResult(null); resetForm(); setShowAdd(false); }}
                className="w-full py-4 bg-primary text-white font-black rounded-2xl text-sm uppercase tracking-widest shadow-xl shadow-primary/20 active:scale-95 transition-all"
              >
                Concluído
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL DE DETALHES DO COLABORADOR (REF: RS TOP TEAM STUDIO) */}
      <AnimatePresence>
        {selectedUser && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setSelectedUser(null)}
          >
            {/* Overlay linkado ao container para garantir centralização total */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: 'spring', damping: 25, stiffness: 500 }}
              className="relative w-full max-w-md bg-[#0a0a0a] rounded-xl overflow-hidden border border-white/10 ring-1 ring-white/5 shadow-[0_20px_60px_rgba(0,0,0,0.8),0_0_30px_rgba(var(--clr-primary-rgb),0.1)] flex flex-col max-h-[85vh]"
              onClick={e => e.stopPropagation()}
            >
              {/* Header Fixo */}
              <header className="flex items-center justify-between px-6 py-5 border-b border-white/5 shrink-0 bg-[#0a0a0a]">
                <h2 className="text-lg font-black text-white tracking-tight uppercase">Detalhes do Colaborador</h2>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => { handleEdit(selectedUser); setSelectedUser(null); }}
                    className="flex items-center gap-2 px-3.5 py-1.5 bg-[#1a1a1a] hover:bg-[#252525] border border-white/5 rounded-2xl text-[10px] font-black text-gray-300 transition-all active:scale-95 uppercase tracking-wider"
                  >
                    <Edit2 size={11} />
                    Editar
                  </button>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="p-2.5 bg-[#1a1a1a] hover:bg-[#252525] border border-white/5 rounded-2xl text-gray-400 hover:text-white transition-all active:scale-95"
                  >
                    <X size={18} />
                  </button>
                </div>
              </header>

              {/* Body com Scroll Interno (Alta Densidade) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-[#0a0a0a]">

                {/* Perfil Header */}
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-primary flex items-center justify-center text-lg font-black text-white shadow-[0_0_20px_rgba(var(--clr-primary-rgb),0.3)] shrink-0">
                    {selectedUser.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <h3 className="text-base font-black text-white uppercase tracking-tight leading-tight truncate">
                      {selectedUser.name}
                    </h3>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${selectedUser.role === 'admin' ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                        selectedUser.role === 'professor' ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                          'bg-gray-500/10 text-gray-400 border-gray-500/20'
                        }`}>
                        {selectedUser.role || 'Staff'}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black border uppercase tracking-widest ${selectedUser.status === 'Inativo' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        }`}>
                        {selectedUser.status || 'Ativo'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Seção 1: IDENTIFICAÇÃO E CONTATO */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.25em] ml-1">Identificação & Contato</h4>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 flex items-center gap-3">
                      <div className="text-gray-500"><User size={14} /></div>
                      <div>
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Sexo</p>
                        <p className="text-xs font-bold text-gray-200">{selectedUser.gender || '—'}</p>
                      </div>
                    </div>
                    <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 flex items-center gap-3">
                      <div className="text-gray-500"><Shield size={14} /></div>
                      <div>
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Documento</p>
                        <p className="text-xs font-bold text-gray-200">{selectedUser.cpf || '—'}</p>
                      </div>
                    </div>
                    <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 flex items-center gap-3 col-span-2">
                      <div className="text-gray-500"><Mail size={14} /></div>
                      <div className="min-w-0">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">E-mail</p>
                        <p className="text-xs font-bold text-gray-200 truncate">{selectedUser.email || '—'}</p>
                      </div>
                    </div>
                    <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 flex items-center gap-3 col-span-2">
                      <div className="text-gray-500"><Phone size={14} /></div>
                      <div>
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Telefone</p>
                        <p className="text-xs font-bold text-gray-200">{selectedUser.phone || 'Não informado'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seção 2: ATUAÇÃO PROFISSIONAL */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.25em] ml-1">Atuação & Equipe</h4>
                  <div className="grid grid-cols-1 gap-2.5">
                    <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 flex items-center gap-3.5">
                      <div className="w-9 h-9 rounded-2xl bg-primary/5 flex items-center justify-center text-primary/60">
                        <Award size={16} />
                      </div>
                      <div className="flex-1">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-0.5">Cargo / Função</p>
                        <p className="text-sm font-bold text-gray-200">
                          {selectedUser.role === 'admin' ? 'Administrador do Sistema' :
                            selectedUser.role === 'gestor' ? 'Gestor de Unidade' :
                              'Professor / Instrutor'}
                        </p>
                      </div>
                    </div>

                    <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 space-y-3">
                      <div>
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Modalidades Ensinadas</p>
                        <div className="flex flex-wrap gap-1.5">
                          {selectedUser.modalities?.length > 0 ? (
                            selectedUser.modalities.map(m => (
                              <span key={m} className="px-2 py-1 rounded bg-white/5 text-[10px] font-bold text-gray-400 border border-white/5">{m}</span>
                            ))
                          ) : (
                            <span className="text-[10px] text-gray-600 italic">Nenhuma modalidade vinculada</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 flex items-center gap-3">
                        <div className="text-gray-500"><Calendar size={14} /></div>
                        <div>
                          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Início</p>
                          <p className="text-xs font-bold text-gray-200">{formatDate(selectedUser.startDate) || '—'}</p>
                        </div>
                      </div>
                      <div className="bg-primary/5 border border-primary/10 rounded-2xl p-4 flex items-center gap-3">
                        <div className="text-primary/60"><KeyRound size={14} /></div>
                        <div>
                          <p className="text-[9px] font-black text-primary/50 uppercase tracking-widest">PIN Sistema</p>
                          <p className="text-xs font-black text-white">{selectedUser.pin || '****'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Seção 3: JIU JITSU (Condicional) */}
                {selectedUser.jiuJitsu && (selectedUser.modalities?.some(m => m.toLowerCase().includes('jiu')) || selectedUser.jiuJitsu.belt !== 'white') && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.25em] ml-1">Graduação Jiu-Jitsu</h4>
                    <div className="bg-primary/10 border border-primary/20 rounded-[20px] p-5 relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                        <Award size={64} />
                      </div>
                      <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center border-2 shadow-xl"
                          style={{
                            backgroundColor: beltConfig[selectedUser.jiuJitsu.belt]?.color || '#fff',
                            borderColor: 'rgba(255,255,255,0.2)'
                          }}>
                          <span className="text-[10px] font-black leading-none" style={{ color: (selectedUser.jiuJitsu.belt === 'white' || selectedUser.jiuJitsu.belt === 'yellow') ? '#000' : '#fff' }}>
                            {selectedUser.jiuJitsu.degree || 0}º
                          </span>
                          <span className="text-[8px] font-black uppercase" style={{ color: (selectedUser.jiuJitsu.belt === 'white' || selectedUser.jiuJitsu.belt === 'yellow') ? '#000' : '#fff' }}>
                            GRAU
                          </span>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-0.5">Faixa Atual</p>
                          <h5 className="text-xl font-black text-white uppercase italic">
                            Faixa {beltConfig[selectedUser.jiuJitsu.belt]?.label || 'Branca'}
                          </h5>
                          <p className="text-[10px] font-bold text-gray-500 mt-1">
                            Graduação em: {formatDate(selectedUser.jiuJitsu.lastGraduation)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Seção 4: SAÚDE & OBSERVAÇÕES */}
                <div className="space-y-3 pb-2">
                  <h4 className="text-[10px] font-black text-gray-600 uppercase tracking-[0.25em] ml-1">Saúde & Observações</h4>
                  <div className="bg-[#121212] border border-white/5 rounded-2xl p-4 flex items-start gap-3.5 group">
                    <div className="w-9 h-9 rounded-2xl bg-white/5 flex items-center justify-center text-gray-500 group-hover:text-primary transition-colors shrink-0 mt-0.5">
                      <HeartPulse size={16} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1.5">Doença ou Medicação</p>
                      <p className="text-sm font-medium text-gray-300 leading-relaxed italic">
                        {selectedUser.healthInfo || 'Nenhuma informação de saúde registrada para este colaborador.'}
                      </p>
                    </div>
                  </div>
                </div>

              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  PAINEL: LOGS DE ATIVIDADE
// ════════════════════════════════════════════════════════════════
function SectionLogs({ logs, loading }) {
  const activity = logs.filter(l => l.type === 'activity')
  const levelIcon = { info: <Activity size={18} strokeWidth={1.9} className="text-blue-400" />, warn: <AlertTriangle size={18} strokeWidth={1.9} className="text-yellow-400" /> }
  return (
    <div className="space-y-6">
      <Section title={`Atividade do sistema (${activity.length})`}>
        {loading ? <p className="px-5 py-4 text-gray-600 text-sm">Carregando...</p>
          : activity.length === 0 ? <p className="px-5 py-4 text-gray-600 text-sm">Nenhuma atividade registrada.</p>
            : activity.map(log => (
              <div key={log.id} className="flex items-center gap-3 px-5 py-3 border-b border-white/5 last:border-0">
                <span className="flex-shrink-0">{levelIcon[log.level] || levelIcon.info}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-app text-sm font-semibold">{log.action}</p>
                  <p className="text-gray-500 text-xs truncate">{log.detail} · {log.userName}</p>
                </div>
                <LogTime date={log.createdAt} />
              </div>
            ))
        }
      </Section>
    </div>
  )
}

// ════════════════════════════════════════════════════════════════
//  PAINEL: LOGS DE ERRO
// ════════════════════════════════════════════════════════════════
function SectionErros({ logs, loading }) {
  const errors = logs.filter(l => l.type === 'error')
  return (
    <div className="space-y-6">
      <Section title={`Erros registrados (${errors.length})`}>
        {loading ? <p className="px-5 py-4 text-gray-600 text-sm">Carregando...</p>
          : errors.length === 0
            ? (
              <div className="px-5 py-8 flex flex-col items-center gap-3 text-center">
                <CheckCircle2 size={32} strokeWidth={1.9} className="text-emerald-500" />
                <p className="text-app font-semibold">Nenhum erro registrado</p>
                <p className="text-gray-500 text-sm">O sistema está funcionando perfeitamente.</p>
              </div>
            )
            : errors.map(log => (
              <div key={log.id} className="flex items-start gap-3 px-5 py-3 border-b border-white/5 last:border-0">
                <AlertCircle size={18} strokeWidth={1.9} style={{ color: 'var(--clr-primary)' }} className="flex-shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold" style={{ color: 'var(--clr-primary)' }}>{log.action}</p>
                  <p className="text-gray-500 text-xs font-mono break-all">{log.detail}</p>
                  <p className="text-gray-700 text-[10px] mt-0.5">{log.userName}</p>
                </div>
                <LogTime date={log.createdAt} />
              </div>
            ))
        }
      </Section>
    </div>
  )
}

import ModuleUnderDevelopment from '../../components/shared/ModuleUnderDevelopment'

// ════════════════════════════════════════════════════════════════
//  PAINÉIS SIMPLES
// ════════════════════════════════════════════════════════════════

function SectionAparencia() {
  const { activeId, setTheme, customPrimary, setCustomPrimary, customSecondary, setCustomSecondary } = useTheme()

  const presets = Object.values(THEMES)

  return (
    <div className="space-y-6">

      {/* GRID DE TEMAS */}
      <Section title="Temas pré-definidos">
        <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {presets.map(t => {
            const isActive = activeId === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className="relative overflow-hidden rounded-xl transition-all hover:scale-[1.03] active:scale-100"
                style={{
                  border: `2px solid ${isActive ? t.primary : 'rgba(255,255,255,0.07)'}`,
                  boxShadow: isActive ? `0 0 20px ${t.primary}55` : 'none',
                }}
              >
                {/* Mini preview */}
                <div className="h-16 w-full" style={{ background: t.bg }}>
                  {/* Sidebar strip */}
                  <div className="h-full w-6 float-left" style={{ background: t.sidebar || t.surface }}>
                    <div className="mt-2 mx-auto w-2 h-2 rounded-full" style={{ background: t.primary }} />
                    <div className="mt-1.5 mx-auto w-2 h-0.5 rounded" style={{ background: t.primary + '66' }} />
                    <div className="mt-1 mx-auto w-2 h-0.5 rounded" style={{ background: t.primary + '44' }} />
                  </div>
                  {/* Content area */}
                  <div className="ml-6 h-full p-1.5 flex flex-col gap-1">
                    <div className="h-1.5 w-10 rounded" style={{ background: t.primary }} />
                    <div className="h-1 w-8 rounded" style={{ background: t.textMuted + '60' }} />
                    <div className="mt-auto flex gap-1">
                      <div className="h-3 w-4 rounded" style={{ background: t.surface2, border: `1px solid ${t.primary}40` }} />
                      <div className="h-3 w-4 rounded" style={{ background: t.primary + '30' }} />
                    </div>
                  </div>
                </div>

                {/* Label */}
                <div className="px-2 py-1.5 flex items-center justify-between"
                  style={{ background: t.surface }}>
                  <span className="text-[11px] font-bold" style={{ color: t.text }}>
                    {t.emoji} {t.name}
                  </span>
                  {isActive && (
                    <CheckCircle2 size={18} strokeWidth={1.9} style={{ color: t.primary }} />
                  )}
                </div>
              </button>
            )
          })}

          {/* CUSTOM TILE */}
          <button
            onClick={() => setTheme('custom')}
            className="relative overflow-hidden rounded-2xl transition-all hover:scale-[1.03] active:scale-100"
            style={{
              border: `2px solid ${activeId === 'custom' ? customPrimary : 'rgba(255,255,255,0.07)'}`,
              boxShadow: activeId === 'custom' ? `0 0 20px ${customPrimary}55` : 'none',
            }}
          >
            <div className="h-16 w-full flex items-center justify-center" style={{
              background: `linear-gradient(135deg, ${customSecondary}22, ${customPrimary}33)`,
            }}>
              <div className="flex gap-1.5">
                <div className="w-5 h-5 rounded-full border-2 border-white/20" style={{ background: customPrimary }} />
                <div className="w-5 h-5 rounded-full border-2 border-white/20" style={{ background: customSecondary }} />
              </div>
            </div>
            <div className="px-2 py-1.5 flex items-center justify-between" style={{ background: 'var(--clr-surface-2)' }}>
              <span className="text-[11px] font-bold text-app">🎨 Personalizado</span>
              {activeId === 'custom' && <CheckCircle2 size={18} strokeWidth={1.9} style={{ color: customPrimary }} />}
            </div>
          </button>
        </div>
      </Section>

      {/* COLOR PICKERS */}
      <Section title="Cores personalizadas">
        <div className="px-5 py-4 space-y-5">
          <p className="text-gray-500 text-xs">Defina suas cores e clique em "Personalizado" para aplicar.</p>

          {/* Cor primária */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-app text-sm font-semibold">Cor primária</p>
              <p className="text-gray-500 text-xs mt-0.5">Acentos, botões e destaques</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-gray-400">{customPrimary.toUpperCase()}</span>
              <label className="relative cursor-pointer">
                <div
                  className="w-9 h-9 rounded-lg ring-2 ring-white/10 transition-transform hover:scale-110"
                  style={{ background: customPrimary }}
                />
                <input
                  type="color"
                  value={customPrimary}
                  onChange={e => { setCustomPrimary(e.target.value); setTheme('custom') }}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-white/5" />

          {/* Cor secundária */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-app text-sm font-semibold">Cor secundária</p>
              <p className="text-gray-500 text-xs mt-0.5">Sidebar, gradientes e fundos</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono text-gray-400">{customSecondary.toUpperCase()}</span>
              <label className="relative cursor-pointer">
                <div
                  className="w-9 h-9 rounded-lg ring-2 ring-white/10 transition-transform hover:scale-110"
                  style={{ background: customSecondary }}
                />
                <input
                  type="color"
                  value={customSecondary}
                  onChange={e => { setCustomSecondary(e.target.value); setTheme('custom') }}
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* Preview gradient */}
          <div
            className="h-10 rounded-lg"
            style={{ background: `linear-gradient(135deg, ${customSecondary}, ${customPrimary})`, opacity: activeId === 'custom' ? 1 : 0.4 }}
          >
            <div className="h-full rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">Preview do gradiente</span>
            </div>
          </div>

          <button
            onClick={() => setTheme('custom')}
            className="btn-primary w-full py-2.5 rounded-2xl text-sm font-bold"
            style={{ background: `linear-gradient(135deg, ${customSecondary}, ${customPrimary})` }}
          >
            {activeId === 'custom' ? '✓ Tema personalizado ativo' : 'Aplicar cores personalizadas'}
          </button>
        </div>
      </Section>
    </div>
  )
}

function SectionAcademia({ user, onUpdateProfile }) {
  const initialSettings = (user && user.academyConfig) ? user.academyConfig : { inativacao_visitante: 10 }
  const [localSettings, setLocalSettings] = React.useState(initialSettings)

  React.useEffect(() => {
    if (user?.academyConfig) {
      setLocalSettings(user.academyConfig)
    }
  }, [user?.academyConfig])

  const handleUpdateLocal = (key, val) => {
    setLocalSettings(prev => ({ ...prev, [key]: val }))
  }

  const handleSave = (key, val) => {
    onUpdateProfile({
      academyConfig: {
        ...localSettings,
        [key]: val
      }
    })
  }

  return (
    <div className="space-y-6">
      <Section title="Informações da Academia">
        <InlineField label="Nome" value={user?.academyName || user?.name || "RS Top Team"} />
      </Section>

      <Section title="Configuração de Visitantes">
        <SettingRow 
          label="Inativação Automática" 
          desc="Após quantos dias de ausência o visitante é movido para inativo?" 
          action={
            <div className="flex items-center gap-6">
              <div className="flex-1 max-w-[200px]">
                <input 
                  type="range" 
                  min="1" 
                  max="60" 
                  value={localSettings.inativacao_visitante || 10}
                  onChange={(e) => handleUpdateLocal('inativacao_visitante', parseInt(e.target.value))}
                  onMouseUp={(e) => handleSave('inativacao_visitante', parseInt(e.target.value))}
                  onTouchEnd={(e) => handleSave('inativacao_visitante', parseInt(e.target.value))}
                  className="w-full h-1.5 bg-white/10 rounded-full appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between mt-2">
                  <span className="text-[8px] text-gray-600 font-bold uppercase tracking-tighter">1 dia</span>
                  <span className="text-[8px] text-gray-600 font-bold uppercase tracking-tighter">60 dias</span>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center bg-primary/10 border border-primary/20 rounded-xl px-4 py-2 min-w-[90px] shadow-lg shadow-primary/5">
                <span className="text-[14px] font-black text-primary leading-none">{localSettings.inativacao_visitante || 10}</span>
                <span className="text-[8px] font-bold text-primary/60 uppercase tracking-widest mt-1">Dias</span>
              </div>
            </div>
          } 
        />
      </Section>

      <Section title="Planos ativos">
        <SettingRow label="Mensalidade Jiu-Jitsu" desc="Valor padrão da mensalidade" action={<ChipButton label="R$ 180" />} />
        <SettingRow label="Mensalidade Boxe" desc="Valor padrão da mensalidade" action={<ChipButton label="R$ 150" />} />
      </Section>
    </div>
  )
}
function SectionDados({ onSync }) {
  const [syncing, setSyncing] = useState(false)

  const handleSync = async () => {
    if (!window.confirm('🚀 INICIAR MIGRAÇÃO TOTAL?\n\nEste processo irá:\n1. Mover dados de coleções antigas (users, students, sessions) para as novas (usuarios, chamadas).\n2. Traduzir todos os campos para Português.\n3. Remover sufixos internos dos IDs.\n\nDeseja continuar?')) return
    
    setSyncing(true)
    try {
      const stats = await onSync()
      alert(`✅ MIGRACAO CONCLUÍDA!\n\nUsuários: ${stats.usuarios}\nChamadas: ${stats.chamadas}\nEventos: ${stats.eventos}`)
    } catch (e) {
      alert('❌ Erro na migração: ' + e.message)
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-6">
      <Section title="Manutenção do Sistema">
        <SettingRow 
          label="Migração de Banco de Dados" 
          desc="Transpor dados legados para a nova estrutura PT-BR e limpar IDs internos." 
          action={
            <button 
              onClick={handleSync}
              disabled={syncing}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${syncing ? 'bg-white/5 text-gray-500' : 'bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 active:scale-95'}`}
            >
              {syncing ? 'Processando...' : 'Iniciar Migração'}
            </button>
          } 
        />
      </Section>

      <Section title="Exportar dados">
        <SettingRow label="Exportar alunos" desc="Baixar lista completa em CSV" action={<ChipButton label="Exportar CSV" />} />
        <SettingRow label="Exportar presenças" desc="Histórico completo de presenças" action={<ChipButton label="Exportar CSV" />} />
      </Section>
      <Section title="Infraestrutura Firestore">
        <SettingRow label="Projeto Firebase" desc="academia-rstopteam" action={<span className="text-xs text-emerald-500 font-semibold">conectado ✓</span>} />
        <SettingRow label="Status das Coleções" desc="Nova estrutura PT-BR ativa" action={<div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />} />
      </Section>
    </div>
  )
}

function SectionSobre() {
  return (
    <Section title="RS Top Team — Sistema de Gestão">
      <div className="divide-y divide-white/5">
        {[
          { label: 'Versão', value: '1.0.0-beta' },
          { label: 'Framework', value: 'React 19 + Vite' },
          { label: 'Banco de dados', value: 'Firebase Firestore' },
          { label: 'Hospedagem', value: 'Firebase Hosting' },
          { label: 'Desenvolvido por', value: '@mad.exe', link: 'https://www.instagram.com/mad.exe/' },
        ].map(row => (
          <div key={row.label} className="flex items-center justify-between px-5 py-3">
            <span className="text-gray-500 text-sm">{row.label}</span>
            {row.link ? (
              <a 
                href={row.link} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-sm font-semibold hover:underline"
                style={{ color: 'var(--clr-primary)' }}
              >
                {row.value}
              </a>
            ) : (
              <span className="text-white text-sm font-semibold">{row.value}</span>
            )}
          </div>
        ))}
      </div>
    </Section>
  )
}

function SectionNotificacoes({ user, onUpdateProfile }) {
  // Estado local para feedback instantâneo na UI
  const [localPrefs, setLocalPrefs] = React.useState({
    general: user?.preferences?.notifications?.general ?? true,
    sound: user?.preferences?.notifications?.sound ?? true,
    vibrate: user?.preferences?.notifications?.vibrate ?? true,
  })

  // Sincroniza o estado local quando os dados do usuário terminam de carregar
  React.useEffect(() => {
    if (user?.preferences?.notifications) {
      setLocalPrefs(prev => ({
        ...prev,
        ...user.preferences.notifications
      }))
    }
  }, [user?.preferences?.notifications])

  const togglePref = (key) => {
    const newVal = !localPrefs[key]
    const updated = { ...localPrefs, [key]: newVal }
    
    // Atualiza localmente primeiro para ser instantâneo
    setLocalPrefs(updated)

    // Persiste no banco
    onUpdateProfile({
      preferences: {
        ...user?.preferences,
        notifications: {
          ...user?.preferences?.notifications,
          [key]: newVal
        }
      }
    })
  }

  const openSystemSettings = () => {
    try {
      if (/Android/i.test(navigator.userAgent)) {
        window.location.href = 'intent:package:com.android.settings#Intent;action=android.settings.APP_NOTIFICATION_SETTINGS;S.android.provider.extra.APP_PACKAGE=' + window.location.hostname + ';end'
      } else {
        alert('Para gerenciar notificações do sistema, acesse as Configurações do seu dispositivo e procure por este Aplicativo.')
      }
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="space-y-6">
      <Section title="Geral">
        <SettingRow
          label="Notificações Gerais"
          desc="Ativar ou desativar todos os avisos do app"
          action={<Toggle isOn={localPrefs.general} onToggle={() => togglePref('general')} />}
        />
        <SettingRow
          label="Som"
          desc="Reproduzir som ao receber notificações"
          action={<Toggle isOn={localPrefs.sound} onToggle={() => togglePref('sound')} />}
        />
        <SettingRow
          label="Vibrar"
          desc="Vibrar o dispositivo ao receber notificações"
          action={<Toggle isOn={localPrefs.vibrate} onToggle={() => togglePref('vibrate')} />}
        />
      </Section>

      <div className="bg-white/5 border border-white/5 rounded-xl p-6 flex flex-col md:flex-row items-center gap-6">
        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center text-primary flex-shrink-0">
          <Settings size={28} />
        </div>
        <div className="flex-1 text-center md:text-left">
          <p className="text-sm font-bold text-white mb-1">Configurações do Dispositivo</p>
          <p className="text-xs text-gray-500 max-w-sm">Para gerenciar permissões de nível de sistema (bloquear totalmente ou fixar no topo), use as configurações nativas.</p>
        </div>
        <button
          onClick={openSystemSettings}
          className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-black text-white hover:bg-white/10 transition-all active:scale-95 whitespace-nowrap"
        >
          ABRIR AJUSTES
        </button>
      </div>
    </div>
  )
}


// ════════════════════════════════════════════════════════════════
//  MAIN PAGE
// ════════════════════════════════════════════════════════════════
export default function ProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'conta'

  const setActive = (id) => {
    setSearchParams({ tab: id })
  }

  const [mobileDetailOpen, setMobileDetailOpen] = useState(false)
  const navigate = useNavigate()
  const { user: authUser, userData, logout, effectiveRole } = useAuth()
  const { setIsMobileNavHidden } = useApp()
  const { users, loading: usersLoading, updateProfile, uploadAvatar, uploadBanner, createNewUser, changePassword, deleteUser, runDeepMigration } = useSystemUsers()
  const { logs, loading: logsLoading } = useSystemLogs('all', 100)

  // O 'id' do usuário logado para as operações de salvamento
  const currentUserId = userData?.id || userData?.uid || ''
  const currentUserRole = effectiveRole || 'aluno'

  const handleUpdateProfile = async (data) => {
    if (currentUserId && currentUserRole) await updateProfile(currentUserId, data, currentUserRole)
  }

  const initials = (userData?.name || 'A')[0].toUpperCase()
  const role = roleConfig[effectiveRole] || roleConfig.aluno

  const panels = {
    conta: <SectionConta user={userData} authUser={authUser} activeRole={effectiveRole} onUpdateProfile={handleUpdateProfile} />,
    seguranca: <SectionSeguranca user={userData} onChangePassword={changePassword} activityLogs={logs} />,
    notificacoes: <SectionNotificacoes user={userData} onUpdateProfile={handleUpdateProfile} />,
    aparencia: <SectionAparencia />,
    academia: <SectionAcademia user={userData} onUpdateProfile={handleUpdateProfile} />,
    usuarios: <SectionUsuarios
      users={users}
      onAddUser={createNewUser}
      onUpdateUser={(id, data, role) => updateProfile(id, data, role)}
      onDeleteUser={deleteUser}
      onSync={runDeepMigration}
    />,
    dados: <SectionDados onSync={runDeepMigration} />,
    logs: <SectionLogs logs={logs} loading={logsLoading} />,
    erros: <SectionErros logs={logs} loading={logsLoading} />,
    sobre: <SectionSobre />,
  }

  const isStaff = !['aluno', 'professor'].includes(effectiveRole)

  // Filtra as seções baseado no cargo (Sistema apenas para Gestor/Admin)
  const visibleSections = SECTIONS.filter(sec => {
    if (sec.group === 'Sistema') return isStaff
    return true
  })

  // Se o usuário tentar acessar uma aba restrita via URL, volta para 'conta'
  const isRestrictedTab = SECTIONS.find(s => s.group === 'Sistema')?.items.some(i => i.id === activeTab)
  const canAccess = !isRestrictedTab || isStaff

  React.useEffect(() => {
    if (!canAccess) setActive('conta')
  }, [canAccess])

  const activeSection = SECTIONS.flatMap(s => s.items).find(i => i.id === activeTab)

  // Handlers
  const handleSelectSection = (id) => {
    setActive(id)
    setMobileDetailOpen(true)
  }

  React.useEffect(() => {
    // Esconde a navegação mobile enquanto estiver na página de perfil/configurações
    setIsMobileNavHidden(true)
    
    // Cleanup ao desmontar a página (garante que volte ao navegar para outro lugar)
    return () => setIsMobileNavHidden(false)
  }, [setIsMobileNavHidden])

  const goBack = () => {
    navigate('/')
  }

  return (
    <div className="flex min-h-full" style={{ background: 'var(--clr-bg)' }}>

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="hidden md:flex w-[280px] flex-shrink-0 flex-col py-8 px-4 overflow-y-auto"
        style={{ background: 'var(--clr-bg)', borderRight: '1px solid rgba(255,255,255,0.03)' }}>

        {/* BACK BUTTON */}
        <button
          onClick={goBack}
          className="group flex items-center gap-2 px-3 py-2 mb-8 text-gray-500 hover:text-white transition-all rounded-2xl hover:bg-white/5 w-fit"
        >
          <div className="p-1.5 rounded-lg bg-white/5 border border-white/5 group-hover:border-primary/30 transition-colors">
            <ArrowLeft size={16} strokeWidth={2.5} />
          </div>
          <span className="text-xs font-bold tracking-tight">Voltar ao Início</span>
        </button>

        {/* MINI PERFIL */}
        <div className="flex items-center gap-3 px-3 mb-5">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-black text-white flex-shrink-0 shadow-lg shadow-primary/10"
            style={{ background: 'linear-gradient(135deg, var(--clr-primary-dark), var(--clr-primary))' }}>{initials}</div>
          <div className="min-w-0">
            <p className="text-white text-sm font-bold leading-none truncate">{userData?.name || 'Anon'}</p>
            <p className="text-[10px] text-gray-600 truncate">{userData?.handle || '@user'}</p>
            <span className={`text-[9px] font-bold ${role.color}`}>{role.label}</span>
          </div>
        </div>

        <div className="h-px mx-3 mb-4" style={{ background: 'rgba(255,255,255,0.05)' }} />

        {/* NAV */}
        <nav className="flex-1 space-y-0.5">
          {visibleSections.map(sec => (
            <div key={sec.group} className="mb-4">
              <p className="text-[9px] font-bold text-gray-700 uppercase tracking-widest px-3 mb-1">{sec.group}</p>
              {sec.items.map(item => (
                <button key={item.id} onClick={() => setActive(item.id)}
                  className={`nav-item w-full text-left mb-0.5 ${activeTab === item.id ? 'active' : ''}`}>
                  <item.icon size={18} strokeWidth={1.9} className={activeTab === item.id ? 'nav-icon' : ''} />
                  <span className="text-[13px] font-medium">{item.label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="h-px mx-3 mb-3" style={{ background: 'rgba(255,255,255,0.05)' }} />
        <button className="nav-item w-full text-left" onClick={async () => { await logout(); navigate('/login'); }} style={{ color: 'var(--clr-primary)' }}>
          <LogOut size={18} strokeWidth={1.9} /> <span className="text-[13px]">Sair</span>
        </button>
      </aside>

      {/* ── MOBILE VIEW ── */}
      <div className="md:hidden flex flex-col w-full h-full overflow-hidden" style={{ background: 'var(--clr-bg)' }}>
        <AnimatePresence mode="wait">
          {!mobileDetailOpen ? (
            <motion.div
              key="mobile-menu"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="flex flex-col h-full overflow-y-auto pb-10"
            >
              {/* Header Mobile - Just the back button */}
              <div className="flex items-center px-6 py-5">
                <button onClick={() => navigate('/')} className="p-2 -ml-2 text-white/50 hover:text-white transition-colors bg-white/5 rounded-2xl border border-white/5 shadow-2xl active:scale-90">
                  <ArrowLeft size={18} strokeWidth={1.9} />
                </button>
              </div>

              {/* Profile Intro */}
              <div className="flex flex-col items-center px-8 pb-10 pt-2 text-center">
                <div
                  className="relative w-32 h-32 rounded-full mb-6 p-1 bg-black/20"
                >
                  <div className="w-full h-full rounded-full bg-[#000] p-1 overflow-hidden relative border border-white/5 shadow-2xl">
                    {userData?.avatarUrl ? (
                      <img src={userData.avatarUrl} className="w-full h-full rounded-full object-cover" alt="" />
                    ) : (
                      <div className="w-full h-full rounded-full flex items-center justify-center text-4xl font-black bg-gradient-to-br from-white/10 to-white/5 text-white/20">
                        {initials}
                      </div>
                    )}
                  </div>
                </div>

                <h1 className="text-3xl font-bold text-white tracking-tight mb-3">{userData?.name || 'Anon'}</h1>
                <div className="flex flex-wrap justify-center gap-2 max-w-xs">
                  {Object.entries(userData?.roles || {}).filter(([_, active]) => active).map(([rKey]) => {
                    const rCfg = roleConfig[rKey] || roleConfig.aluno
                    return (
                      <div key={rKey} className={`px-3 py-1.5 rounded-2xl text-[9px] font-black uppercase tracking-[0.1em] border ${rCfg.bg} ${rCfg.color}`}>
                        {rCfg.label}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Menu Sections */}
              <div className="px-6 space-y-10">
                {visibleSections.map((sec) => (
                  <div key={sec.group} className="space-y-3">
                    <h3 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em] ml-2">{sec.group}</h3>
                    <div className="bg-[#111] rounded-lg overflow-hidden border border-white/5 shadow-sm">
                      {sec.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSelectSection(item.id)}
                          className="w-full flex items-center gap-4 px-5 py-4 border-b border-white/5 last:border-0 active:bg-white/5 transition-colors"
                        >
                          <div className="w-9 h-9 rounded-2xl flex items-center justify-center bg-white/5 text-gray-400">
                            <item.icon size={18} strokeWidth={1.9} />
                          </div>
                          <span className="flex-1 text-left text-sm font-bold text-white/90">{item.label}</span>
                          <ChevronRight size={18} strokeWidth={1.9} className="text-gray-700" />
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Sair */}
                <button
                  onClick={async () => { await logout(); navigate('/login'); }}
                  className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl bg-white/5 border border-white/5 text-gray-400 font-bold text-sm hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20 transition-all active:scale-[0.98] mt-4 mb-20 group"
                >
                  <LogOut size={16} className="group-hover:text-red-400" />
                  <span>Sair da conta</span>
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="mobile-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex flex-col h-full overflow-y-auto"
            >
              {/* Header Detalhe */}
              <div className="sticky top-0 z-20 flex items-center justify-between px-6 py-5 bg-[#000]/80 backdrop-blur-md border-b border-white/5">
                <button onClick={() => setMobileDetailOpen(false)} className="p-2 -ml-2 text-white placeholder-gray-500 bg-white/5 rounded-2xl border border-white/5 active:scale-90">
                  <ArrowLeft size={20} strokeWidth={2.4} />
                </button>
                <div className="text-center absolute left-1/2 -translate-x-1/2">
                  <h1 className="font-bold text-sm text-white">{activeSection?.label}</h1>
                  <p className="text-[9px] uppercase tracking-widest text-gray-500 font-black mt-0.5">Configurações</p>
                </div>
                <div className="w-8" />
              </div>

              {/* Content */}
              <div className="p-6 pb-40 fade-in">
                {panels[activeTab]}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── DESKTOP MAIN PANEL ── */}
      <main className="hidden md:flex flex-1 overflow-y-auto px-4 md:px-6 py-6 justify-center">
        <div className="w-full">
          <div className="mb-10 flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-black text-white tracking-tight leading-none mb-2">{activeSection?.label}</h1>
              <p className="text-gray-500 text-sm font-medium">Gerencie suas configurações e preferências do sistema.</p>
            </div>
            <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center text-gray-500">
              <activeSection.icon size={24} strokeWidth={1.5} />
            </div>
          </div>

          <div key={activeTab} className="fade-slide-up pb-20">
            {panels[activeTab]}
          </div>
        </div>
      </main>
    </div>
  )
}

// ── Sub-componentes auxiliares ──────────────────────────────

function InfoCard({ icon: Icon, label, value }) {
  return (
    <div className="stat-card border border-white/5 rounded-xl p-5 flex items-center gap-4 transition-all hover:border-white/10 group">
      <div className="w-12 h-12 rounded-2xl bg-black flex items-center justify-center text-gray-500 group-hover:text-primary transition-colors">
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-sm text-white font-bold truncate group-hover:text-primary/90 transition-colors">{value || 'Não informado'}</p>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-[#0a0a0a]/40 backdrop-blur-md rounded-xl border border-white/5 overflow-hidden shadow-xl">
      <div className="px-6 py-4 bg-white/5 border-b border-white/5 flex items-center justify-between">
        <h3 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">{title}</h3>
      </div>
      <div className="divide-y divide-white/5">
        {children}
      </div>
    </div>
  )
}

function FormInput({ label, value, onChange, type = 'text', placeholder, error }) {
  return (
    <div className="space-y-1.5 flex-1">
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 pl-1">{label}</p>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-white/5 border rounded-md px-5 py-3.5 text-sm text-white placeholder:text-gray-700 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all ${error ? 'border-primary shadow-[0_0_10px_rgba(225,29,72,0.15)]' : 'border-white/10 hover:border-white/20'
          }`}
      />
      {error && (
        <motion.p
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[9px] text-primary font-black uppercase tracking-widest ml-1 mt-1"
        >
          Campo obrigatório
        </motion.p>
      )}
    </div>
  )
}

function SettingRow({ label, desc, action }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 group hover:bg-white/[0.02] transition-colors">
      <div className="min-w-0 pr-4">
        <p className="text-sm font-bold text-gray-200 group-hover:text-white transition-colors">{label}</p>
        <p className="text-xs text-gray-500 group-hover:text-gray-400 transition-colors mt-0.5">{desc}</p>
      </div>
      <div className="flex-shrink-0">{action}</div>
    </div>
  )
}

function InlineField({ label, value, placeholder }) {
  return (
    <div className="flex items-center justify-between px-6 py-4 group hover:bg-white/[0.02]">
      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">{label}</p>
      <p className={`text-sm font-bold ${value ? 'text-white' : 'text-gray-600 italic'}`}>
        {value || placeholder}
      </p>
    </div>
  )
}

function LogTime({ date }) {
  const d = (typeof date === 'string' || typeof date === 'number') ? new Date(date) : date.toDate()
  return (
    <div className="text-right flex-shrink-0">
      <p className="text-gray-500 text-[10px] font-bold">{d.toLocaleDateString('pt-BR')}</p>
      <p className="text-gray-700 text-[10px]">{d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
    </div>
  )
}

function Toggle({ isOn = false, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`w-11 h-6 rounded-full relative transition-all duration-300 ${isOn ? 'bg-primary' : 'bg-white/10'}`}
    >
      <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all duration-300 ${isOn ? 'left-6 shadow-md' : 'left-1'}`} />
    </button>
  )
}

function ChipButton({ label }) {
  return (
    <button className="px-4 py-1.5 rounded-2xl bg-white/5 border border-white/10 text-xs font-black text-gray-400 hover:text-white hover:bg-white/10 transition-all">
      {label}
    </button>
  )
}



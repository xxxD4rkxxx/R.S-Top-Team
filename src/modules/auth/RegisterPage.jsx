// RESUMO: Página de Configuração Inicial (Setup) do Sistema.
// Dividida em duas fases: Fase 1 (Admin Master) e Fase 2 (Gestor Principal).
// Garante a criação dos primeiros administradores para o controle total da academia.
import React, { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { UserPlus, Mail, Lock, User, ShieldCheck, ArrowLeft } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../../firebase/config'
import { COLLECTIONS, FIELDS } from '../../firebase/collections'
import AmbientBackground from '../../components/shared/AmbientBackground'

/** 🔐 INTERNAL IDENTITY HELPER */
const getPinAuthEmail = (raw) => {
  const rawId = String(raw || '').toLowerCase().trim()
  if (rawId.endsWith('@rstopteam.internal')) return rawId
  const safeId = rawId.replace(/[@.]/g, '_').replace(/\s+/g, '_').replace(/_{2,}/g, '_')
  return `${safeId}@rstopteam.internal`
}

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const { isSetupMode, hasAdmin, hasGestor } = useAuth()
  const navigate = useNavigate()

  if (!isSetupMode) {
    return <Navigate to="/login" replace />
  }

  const isGestorPhase = hasAdmin && !hasGestor

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const role = isGestorPhase ? 'gestor' : 'admin'
      const pinToUse = isGestorPhase ? pin : password
      const internalEmail = getPinAuthEmail(email)

      let userCredential;
      try {
        // Criamos o acesso Auth usando o e-mail interno (sanitizado) para permitir LOGIN POR PIN
        userCredential = await createUserWithEmailAndPassword(auth, internalEmail, pinToUse)
      } catch (authErr) {
        if (authErr.code === 'auth/email-already-in-use') {
          setError('Este e-mail já possui acesso configurado. Tente logar com o PIN.')
          setLoading(false)
          return
        }
        throw authErr
      }

      const user = userCredential.user
      const trimmedName = name.trim()
      const emailLower = email.toLowerCase()
      const now = new Date()
      const since = now.toLocaleString('pt-BR', { month: 'long', year: 'numeric' })
      const finalPin = isGestorPhase ? pin : password

      // SSoT: Grava na coleção unificada 'usuarios' usando o email sanitizado como ID
      await setDoc(doc(db, COLLECTIONS.USUARIOS, internalEmail), {
        [FIELDS.ID]: internalEmail,
        [FIELDS.EMAIL]: emailLower,
        authEmail: internalEmail, // Campo auxiliar para o login por PIN
        [FIELDS.NOME]: trimmedName,
        [FIELDS.PAPEIS]: { [role]: true },
        [FIELDS.STATUS]: 'Ativo',
        since,
        [FIELDS.PIN]: finalPin,
        adminPin: role === 'admin' ? finalPin : null,
        [FIELDS.CRIADO_EM]: serverTimestamp(),
        [FIELDS.PERMISSOES]: {
          viewFinance: true,
          manageFinance: role === 'admin',
          manageUsers: role === 'admin',
          all: role === 'admin'
        }
      })

      window.location.href = '/'
    } catch (err) {
      console.error('Registration Error:', err)
      setError(`Erro: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-[#050505] overflow-hidden relative">
      <AmbientBackground />

      <button
        onClick={() => navigate('/login')}
        className="absolute top-6 left-6 p-2 rounded-xl bg-white/5 border border-white/10 text-gray-500 hover:text-white transition-all z-50 flex items-center gap-2 px-4 active:scale-95"
      >
        <ArrowLeft size={18} />
        <span className="text-[10px] uppercase tracking-widest font-black">Voltar</span>
      </button>

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-4 bg-primary/10 border border-primary/20 px-3 py-1 rounded-xl">
            <ShieldCheck size={14} className="text-primary" />
            <span className="text-[10px] text-primary uppercase font-black tracking-widest">
              {isGestorPhase ? 'Fase 2: Gestor Principal' : 'Fase 1: Administrador Master'}
            </span>
          </div>
          <h1 className="text-4xl font-black text-white tracking-tighter uppercase">
            {isGestorPhase ? 'Configurar Gestor' : 'Configurar Admin'}
          </h1>
          <p className="mt-2 text-gray-600 text-sm font-medium tracking-tight opacity-60">
            {isGestorPhase
              ? 'Registre o gestor operacional da academia'
              : 'Iniciando o sistema de gestão de alto nível'}
          </p>
        </div>

        {/* Card Section Layer */}
        <div className="relative group">
          {/* Logo Watermark Behind Card */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] flex items-center justify-center pointer-events-none z-0">
            <div className="absolute inset-0 bg-primary/5 rounded-full blur-[80px] opacity-40 scale-110" />
            <img
              src="/logo.png"
              alt=""
              className="w-[320px] h-[320px] object-contain rounded-full opacity-[0.05] grayscale brightness-50 p-8 transition-all duration-1000"
            />
          </div>

          <div className="bg-[#121212]/80 border border-white/5 rounded-2xl p-8 shadow-2xl relative z-10 backdrop-blur-3xl overflow-hidden animate-entrance">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="p-3 rounded-[5px] bg-red-500/10 border border-red-500/20 text-red-500 text-xs text-center animate-shake">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold ml-1">Nome Completo</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <User size={16} className="text-gray-600 group-focus-within:text-primary transition-colors" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="block w-full pl-10 pr-4 py-3.5 bg-black border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-gray-800"
                    placeholder="Ex: Mestre Rickson"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold ml-1">Endereço de E-mail</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail size={16} className="text-gray-600 group-focus-within:text-primary transition-colors" />
                  </div>
                  <input
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 pr-4 py-3.5 bg-black border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-gray-800"
                    placeholder="exemplo@rstoppteam.com"
                    required
                  />
                </div>
              </div>

              {isGestorPhase ? (
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold ml-1">PIN DE ACESSO (6 DÍGITOS)</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock size={16} className="text-gray-600 group-focus-within:text-primary transition-colors" />
                    </div>
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      autoComplete="new-password"
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      className="block w-full pl-10 pr-4 py-3.5 bg-black border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-primary/50 tracking-[0.8em] font-black"
                      placeholder="000000"
                      required
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold ml-1">PIN Mestre (6 Dígitos)</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock size={16} className="text-gray-600 group-focus-within:text-primary transition-colors" />
                    </div>
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="new-password"
                      maxLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value.replace(/\D/g, ''))}
                      className="block w-full pl-10 pr-4 py-3.5 bg-black border border-primary/20 rounded-xl text-white text-sm focus:outline-none focus:border-primary/50 transition-all font-sans tabular-nums tracking-[0.8em]"
                      placeholder="000000"
                      required
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-white hover:bg-gray-200 text-black py-4 rounded-xl flex items-center justify-center gap-2 font-black text-lg uppercase tracking-widest transition-all shadow-lg active:scale-95"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    {isGestorPhase ? 'Finalizar Configuração' : 'Próximo Passo'}
                    <UserPlus size={20} />
                  </>
                )}
              </button>
            </form>
          </div>
        </div>

        <p className="mt-8 text-center text-[10px] text-gray-600 uppercase tracking-[0.4em] font-medium opacity-50">
          2026 | R.S Top Team | Powered by @Mad.exe
        </p>
      </div>
    </div>
  )
}

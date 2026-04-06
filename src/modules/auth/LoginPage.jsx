// RESUMO: Tela de Login.
// Suporta login por E-mail/Senha (Administradores) e por E-mail/PIN (Gestores/Professores).
// Implementa detecção de cliques no logo para alternar entre os modos de acesso.
import React, { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { LogIn, Lock, Mail, Eye, EyeOff, HelpCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import AmbientBackground from '../../components/shared/AmbientBackground'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const [clickCount, setClickCount] = useState(0)
  const [isAdminMode, setIsAdminMode] = useState(false)

  const { login, isSetupMode } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/'

  const handleLogoClick = () => {
    setClickCount(prev => {
      const newCount = prev + 1
      if (newCount === 3) {
        setIsAdminMode(true)
        return 0
      }
      return newCount
    })
    setTimeout(() => setClickCount(0), 2000)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const credential = isAdminMode ? password : pin
      await login(email, credential)
      navigate(from, { replace: true })
    } catch (err) {
      console.error(err)
      setError('Credenciais inválidas ou conta inativa.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-4 bg-[#050505] overflow-hidden relative">
      <AmbientBackground />

      <div className="w-full max-w-md relative z-10">
        {/* Logo Section */}
        <div className="text-center mb-10">
          <button
            onClick={handleLogoClick}
            className="group relative inline-flex flex-col items-center transition-all active:scale-95"
          >
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <img 
                src="/logo.png" 
                alt="Logo Academy" 
                className="w-20 h-20 object-cover rounded-full border-2 border-white/10 shadow-2xl relative z-10 transition-transform duration-500 group-hover:scale-110"
                style={{ boxShadow: '0 0 30px color-mix(in srgb, var(--clr-primary) 30%, transparent)' }}
              />
            </div>
            <div className="flex flex-col items-center">
              <span className="text-[12px] text-gray-500 uppercase tracking-[0.3em] font-medium leading-none mb-1">Rs</span>
              <h1 className="text-5xl font-display font-bold tracking-tighter animate-text-reveal">
                TOP TEAM
              </h1>
            </div>
          </button>
          <p className="mt-3 text-gray-400 text-sm font-light uppercase tracking-[0.2em] opacity-40">Gestão Esportiva de Alto Nível</p>
        </div>

        {/* Login Card Layer Container */}
        <div className="relative">
          {/* Logo Watermark */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] flex items-center justify-center pointer-events-none z-0">
            <div className="absolute inset-0 bg-primary/5 rounded-full blur-[80px] opacity-40 scale-110" />
            <img
              src="/logo.png"
              alt=""
              className="w-[320px] h-[320px] object-contain rounded-full opacity-[0.05] grayscale brightness-50 p-8 transition-all duration-1000"
            />
          </div>

          {/* Actual Login Card */}
          <div
            className="bg-[#121212]/80 border border-white/5 rounded-2xl p-8 shadow-2xl relative z-10 backdrop-blur-3xl overflow-hidden animate-entrance"
          >
            {/* Decorative Gradient Background */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-[80px] -mr-16 -mt-16 pointer-events-none" />

            <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
              {error && (
                <div className="p-3 rounded-[10px] bg-red-500/10 border border-red-500/20 text-red-500 text-xs text-center animate-shake">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold ml-1">E-mail ou Usuário</label>
                <div className="relative group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Mail size={16} className="text-gray-600 group-focus-within:text-primary transition-colors" />
                  </div>
                    <input
                      type="text"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-primary/50 transition-all placeholder:text-gray-800"
                      placeholder="Digite seu e-mail"
                      required
                    />
                </div>
              </div>

              {isAdminMode ? (
                <div className="space-y-2">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold">Senha de Administrador</label>
                    <button type="button" className="text-[10px] text-primary hover:text-primary-dark transition-colors uppercase font-bold tracking-tighter">Esqueci Senha</button>
                  </div>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock size={16} className="text-gray-600 group-focus-within:text-primary transition-colors" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-12 py-3.5 bg-black/40 border border-primary/20 rounded-xl text-white text-sm focus:outline-none focus:border-primary/50 transition-all font-mono"
                      placeholder="••••••••"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-600 hover:text-white transition-colors"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-bold ml-1">PIN de Acesso (6 Dígitos)</label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock size={16} className="text-gray-600 group-focus-within:text-primary transition-colors" />
                    </div>
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="current-password"
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                      className="block w-full pl-10 pr-4 py-3.5 bg-black/40 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:border-primary/50 tracking-[0.8em] transition-all placeholder:text-gray-800"
                      placeholder="000000"
                      required
                    />
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                      <HelpCircle size={14} className="text-gray-800" />
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl flex items-center justify-center gap-2 font-black text-lg uppercase tracking-widest transition-all active:scale-[0.98] bg-primary hover:bg-primary-dark text-white shadow-lg shadow-primary/20 btn-primary"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Acessar Dashboard
                    <LogIn size={20} />
                  </>
                )}
              </button>
            </form>

            {isSetupMode && (
              <div className="mt-8 pt-6 border-t border-white/5 text-center">
                <p className="text-xs text-gray-600 mb-3 uppercase tracking-widest font-bold">Início do Sistema</p>
                <Link
                  to="/register"
                  className="text-xs font-black text-primary hover:text-white transition-colors uppercase tracking-[0.2em]"
                >
                  Configurar Administrador Master
                </Link>
              </div>
            )}
          </div>
        </div>

        <p className="mt-8 text-center text-[10px] text-gray-600 uppercase tracking-[0.4em] font-medium opacity-50">
          2026 | R.S Top Team | Powered by @Mad.exe
        </p>
      </div>
    </div>
  )
}


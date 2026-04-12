import React, { useState } from 'react'
import { createPortal } from 'react-dom'
import { ShieldAlert } from 'lucide-react'
import { motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { useHideMobileNav } from '../../hooks/useHideMobileNav'

/**
 * PinVerificationModal - Modal de Segurança Universal
 * 
 * Solicita o PIN do usuário logado para autorizar ações sensíveis 
 * (como revelar senhas de terceiros).
 */
export default function PinVerificationModal({ onConfirm, onClose, title = "Segurança", message = "Para visualizar dados sensíveis, confirme seu próprio PIN de segurança." }) {
    useHideMobileNav(true)
    const [pin, setPin] = useState('')

    const [error, setError] = useState(false)
    const [loading, setLoading] = useState(false)
    const { verifyPIN } = useAuth()

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (loading || pin.length < 4) return

        setLoading(true)
        setError(false)
        try {
            const isValid = await verifyPIN(pin)
            if (isValid) {
                onConfirm(pin)
            } else {
                setError(true)
            }
        } finally {
            setLoading(false)
        }
    }

    const modalContent = (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md" onClick={onClose} />
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative bg-[#0d0d0d] border border-white/10 rounded-[32px] p-8 w-full max-w-sm text-center shadow-2xl"
            >
                <div className="w-16 h-16 rounded-2xl bg-orange-500/10 flex items-center justify-center mx-auto mb-6 border border-orange-500/20">
                    <ShieldAlert className="text-orange-500" size={32} />
                </div>
                <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-tight">{title}</h3>
                <p className="text-[11px] text-gray-400 mb-8 font-medium leading-relaxed">
                    {message}
                </p>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Campos ocultos para acessibilidade e gerenciadores de senha */}
                    <input type="text" name="username" autoComplete="username" className="hidden" value="admin" readOnly />
                    <input
                        id="pin-verification-input"
                        type="password"
                        autoComplete="current-password"
                        maxLength={6}
                        value={pin}
                        onChange={(e) => { setPin(e.target.value); setError(false) }}
                        className={`w-full bg-black/40 border ${error ? 'border-red-500/50' : 'border-white/10'} rounded-2xl py-4 text-center text-3xl font-mono tracking-[0.5em] text-white focus:outline-none focus:border-white/30 transition-all`}
                        placeholder="••••••"
                        autoFocus
                    />
                    {error && <p className="text-[10px] text-red-500 font-black uppercase tracking-widest animate-pulse">PIN Incorreto</p>}
                    <div className="flex gap-3">
                        <button type="button" onClick={onClose} className="flex-1 py-4 rounded-xl bg-white/5 text-gray-400 font-bold text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all">Cancelar</button>
                        <button
                            type="submit"
                            disabled={loading}
                            className={`flex-1 py-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 ${loading ? 'bg-gray-700 text-gray-500 cursor-wait' : 'bg-orange-500 text-black hover:shadow-lg hover:shadow-orange-500/20'}`}
                        >
                            {loading ? 'Verificando...' : 'Verificar'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    )

    return createPortal(modalContent, document.body)
}

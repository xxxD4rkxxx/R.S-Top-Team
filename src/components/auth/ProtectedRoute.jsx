import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, loading, effectiveRole } = useAuth()
  const location = useLocation()

  if (loading) return null

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // If roles are specified, check if effectiveRole is authorized
  if (allowedRoles && !allowedRoles.includes(effectiveRole)) {
    console.warn(`🚫 [ProtectedRoute] Acesso negado para rota: ${location.pathname}. Papel atual: ${effectiveRole}. Permitidos: ${allowedRoles.join(', ')}`)
    return <Navigate to="/" replace />
  }

  return children
}

/**
 * Hook para logs do sistema
 * Coleção: systemLogs
 * Campos: type (activity|error), action, detail, userId, userName, level (info|warn|error), createdAt
 */
import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, limit
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { COLLECTIONS } from '../firebase/collections'

const COLLECTION = COLLECTIONS.LOGS_SISTEMA

export function useSystemLogs(logType = 'all', maxLogs = 50) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'), limit(maxLogs))
    const unsub = onSnapshot(q, snap => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date()
      }))
      setLogs(logType === 'all' ? all : all.filter(l => l.type === logType))
      setLoading(false)
    }, () => setLoading(false))
    return unsub
  }, [logType, maxLogs])

  /** Registra log de atividade */
  async function logActivity(action, detail, userName = 'Sistema') {
    try {
      await addDoc(collection(db, COLLECTION), {
        type: 'activity',
        level: 'info',
        action,
        detail,
        userName,
        createdAt: serverTimestamp(),
      })
    } catch (_) { /* silencioso */ }
  }

  /** Registra log de erro */
  async function logError(action, error, userName = 'Sistema') {
    try {
      await addDoc(collection(db, COLLECTION), {
        type: 'error',
        level: 'error',
        action,
        detail: error?.message || String(error),
        userName,
        createdAt: serverTimestamp(),
      })
    } catch (_) { /* silencioso */ }
  }

  /** Registra log de aviso */
  async function logWarning(action, detail, userName = 'Sistema') {
    try {
      await addDoc(collection(db, COLLECTION), {
        type: 'activity',
        level: 'warn',
        action,
        detail,
        userName,
        createdAt: serverTimestamp(),
      })
    } catch (_) { /* silencioso */ }
  }

  return { logs, loading, logActivity, logError, logWarning }
}

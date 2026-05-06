import { useState, useEffect, useMemo, useCallback } from 'react'
import { db } from '../firebase/config'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { COLLECTIONS } from '../firebase/collections'
import { useAuth } from '../context/AuthContext'

let _cachedBills = null
let _billListeners = []

export function usePaymentReport() {
  const { userData } = useAuth()
  const [bills, setBills] = useState(_cachedBills || [])
  const [loading, setLoading] = useState(!_cachedBills)

  const [filters, setFilters] = useState({
    modalityId: '',
    turmaId: '',
    startDate: '',
    endDate: '',
    year: '',
    studentName: '',
    status: '',
  })

  useEffect(() => {
    const listener = { setBills, setLoading }
    _billListeners.push(listener)

    if (_cachedBills) {
      _billListeners.forEach(l => l.setBills(_cachedBills))
      _billListeners.forEach(l => l.setLoading(false))
      return
    }

    const q = query(
      collection(db, COLLECTIONS.FATURAMENTO),
      orderBy('dueDate', 'desc')
    )

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      _cachedBills = data
      _billListeners.forEach(l => l.setBills(data))
      _billListeners.forEach(l => l.setLoading(false))
    }, (err) => {
      console.error('Erro ao buscar cobranças para relatório:', err)
      _billListeners.forEach(l => l.setBills([]))
      _billListeners.forEach(l => l.setLoading(false))
    })

    return () => {
      _billListeners = _billListeners.filter(l => l !== listener)
      if (_billListeners.length === 0 && unsub) {
        unsub()
        _cachedBills = null
      }
    }
  }, [])

  const updateFilters = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }, [])

  const resetFilters = useCallback(() => {
    setFilters({
      modalityId: '',
      turmaId: '',
      startDate: '',
      endDate: '',
      year: '',
      studentName: '',
      status: '',
    })
  }, [])

  const filteredBills = useMemo(() => {
    return bills.filter(bill => {
      if (filters.modalityId && bill.modalityId !== filters.modalityId) return false
      if (filters.turmaId && bill.turmaId !== filters.turmaId) return false
      if (filters.status && bill.status !== filters.status) return false
      if (filters.studentName && !(bill.studentName || '').toLowerCase().includes(filters.studentName.toLowerCase())) return false
      if (filters.startDate && bill.dueDate < filters.startDate) return false
      if (filters.endDate && bill.dueDate > filters.endDate) return false
      if (filters.year) {
        const billYear = bill.dueDate ? bill.dueDate.split('-')[0] : ''
        if (billYear !== filters.year) return false
      }
      return true
    })
  }, [bills, filters])

  const groupedData = useMemo(() => {
    const modalityMap = {}

    const normalize = (str) => str?.toLowerCase().trim() || ''

    filteredBills.forEach(bill => {
      let modName = bill.modalityName || bill.modalityId || 'Outros'
      const modKey = normalize(modName)

      if (!modalityMap[modKey]) {
        modalityMap[modKey] = {
          name: modName,
          modalityId: bill.modalityId,
          turmas: {},
          bills: [],
          totalPaid: 0,
          totalPending: 0,
          totalOverdue: 0,
          totalAmount: 0,
        }
      }
      const mod = modalityMap[modKey]
      const turmaName = bill.turmaName || bill.turmaId || 'Sem turma'
      const turmaKey = normalize(turmaName)
      if (!mod.turmas[turmaKey]) {
        mod.turmas[turmaKey] = {
          name: turmaName,
          turmaId: bill.turmaId,
          bills: [],
          totalPaid: 0,
          totalPending: 0,
          totalOverdue: 0,
          totalAmount: 0,
        }
      }
      const turma = mod.turmas[turmaKey]
      const amount = Number(bill.amount) || 0
      mod.bills.push(bill)
      turma.bills.push(bill)
      mod.totalAmount += amount
      turma.totalAmount += amount
      if (bill.status === 'paid') {
        mod.totalPaid += amount
        turma.totalPaid += amount
      } else if (bill.status === 'pending') {
        mod.totalPending += amount
        turma.totalPending += amount
      } else if (bill.status === 'overdue') {
        mod.totalOverdue += amount
        turma.totalOverdue += amount
      }
    })

    const modalities = Object.values(modalityMap).map(mod => ({
      ...mod,
      turmas: Object.values(mod.turmas),
    })).sort((a, b) => a.name.localeCompare(b.name))

    const totalPaid = filteredBills.reduce((s, b) => s + (b.status === 'paid' ? Number(b.amount) || 0 : 0), 0)
    const totalPending = filteredBills.reduce((s, b) => s + (b.status === 'pending' ? Number(b.amount) || 0 : 0), 0)
    const totalOverdue = filteredBills.reduce((s, b) => s + (b.status === 'overdue' ? Number(b.amount) || 0 : 0), 0)
    const totalAmount = filteredBills.reduce((s, b) => s + (Number(b.amount) || 0), 0)

    return { modalities, totalPaid, totalPending, totalOverdue, totalAmount, count: filteredBills.length }
  }, [filteredBills])

  return {
    bills: filteredBills,
    loading,
    filters,
    updateFilters,
    resetFilters,
    groupedData,
  }
}
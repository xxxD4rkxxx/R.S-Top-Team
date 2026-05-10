import { useState, useEffect, useMemo, useCallback } from 'react'
import { db } from '../firebase/config'
import { collection, query, onSnapshot, orderBy, getDocs } from 'firebase/firestore'
import { COLLECTIONS } from '../firebase/collections'
import { useAuth } from '../context/AuthContext'
import { useModalities } from './useModalities'

let _cachedBills = null
let _billListeners = []

/**
 * Enriquece um bill com dados de modalidade e turma vindos do perfil do aluno.
 * Garante compatibilidade retroativa com cobranças antigas que não têm esses campos.
 */
function enrichBillWithStudentData(bill, studentsMap) {
  // Se já tem os campos preenchidos, não precisa enriquecer
  if (bill.modalityName && bill.turmaName) return bill

  const aluno = studentsMap[bill.studentId]
  if (!aluno) return bill

  // Extrai a primeira modalidade do aluno
  const modalities = Array.isArray(aluno.modalities) ? aluno.modalities : 
                     aluno.modality ? [aluno.modality] : []
  
  const firstMod = modalities[0]
  const modalityName = bill.modalityName || 
                       (typeof firstMod === 'object' ? firstMod?.name : firstMod) || 
                       null

  // Extrai a primeira turma do aluno
  const turmas = Array.isArray(aluno.turmas) ? aluno.turmas : 
                 aluno.turma ? [aluno.turma] : []
  const firstTurma = turmas[0]
  const turmaName = bill.turmaName || 
                    (typeof firstTurma === 'object' ? firstTurma?.name : firstTurma) || 
                    null

  return {
    ...bill,
    modalityName: modalityName || bill.modalityName,
    turmaName: turmaName || bill.turmaName,
  }
}

export function usePaymentReport() {
  const { userData } = useAuth()
  const { modalities } = useModalities()
  const [bills, setBills] = useState(_cachedBills || [])
  const [loading, setLoading] = useState(!_cachedBills)
  const [students, setStudents] = useState([])
  const [loadingStudents, setLoadingStudents] = useState(true)

  const [filters, setFilters] = useState({
    modalityId: '',
    turmaId: '',
    startDate: '',
    endDate: '',
    year: '',
    studentName: '',
    status: '',
    paymentType: '',
    earlyPaymentOnly: false,
    paymentDateStart: '',
    paymentDateEnd: '',
  })

  // Busca alunos para enriquecimento retroativo
  useEffect(() => {
    let active = true
    getDocs(collection(db, COLLECTIONS.USUARIOS))
      .then(snap => {
        if (!active) return
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        setStudents(data)
        setLoadingStudents(false)
      })
      .catch(err => {
        console.error('Erro ao buscar alunos para relatório:', err)
        setLoadingStudents(false)
      })
    return () => { active = false }
  }, [])

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
      paymentType: '',
      earlyPaymentOnly: false,
      paymentDateStart: '',
      paymentDateEnd: '',
    })
  }, [])

  // Mapa de alunos por ID para lookup O(1)
  const studentsMap = useMemo(() => {
    const map = {}
    students.forEach(s => { map[s.id] = s })
    return map
  }, [students])

  /**
   * Mapa de turmas: "modId:turmaId" → { modName, turmaDisplayName }
   * Permite resolver nomes legíveis a partir dos uniqueIds salvos nos perfis dos alunos.
   */
  const turmaLookup = useMemo(() => {
    const map = {}
    if (!modalities) return map
    modalities.forEach(mod => {
      (mod.turmas || []).forEach(turma => {
        const key = `${mod.id}:${turma.id}`
        map[key] = {
          modName: mod.name,
          modId: mod.id,
          turmaDisplayName: turma.name,
          turmaId: turma.id,
        }
      })
    })
    return map
  }, [modalities])

  // Bills enriquecidos com dados de modalidade/turma do perfil do aluno
  const enrichedBills = useMemo(() => {
    if (loadingStudents || students.length === 0) return bills
    return bills.map(bill => enrichBillWithStudentData(bill, studentsMap))
  }, [bills, studentsMap, loadingStudents, students.length])

  const filteredBills = useMemo(() => {
    return enrichedBills.filter(bill => {
      if (filters.modalityId) {
        const matchById = bill.modalityId === filters.modalityId
        const matchByName = (bill.modalityName || '').toLowerCase() === filters.modalityId.toLowerCase()
        if (!matchById && !matchByName) return false
      }
      if (filters.turmaId && bill.turmaId !== filters.turmaId) return false
      if (filters.status && bill.status !== filters.status) return false
      if (filters.studentName && !(bill.studentName || '').toLowerCase().includes(filters.studentName.toLowerCase())) return false
      if (filters.startDate && bill.dueDate < filters.startDate) return false
      if (filters.endDate && bill.dueDate > filters.endDate) return false
      if (filters.year) {
        const billYear = bill.dueDate ? bill.dueDate.split('-')[0] : ''
        if (billYear !== filters.year) return false
      }
      if (filters.paymentType && bill.type !== filters.paymentType) return false
      if (filters.earlyPaymentOnly) {
        if (bill.status !== 'paid' || !bill.paidAt || !bill.dueDate) return false
        const paidTs = bill.paidAt?.seconds
          ? new Date(bill.paidAt.seconds * 1000)
          : new Date(bill.paidAt)
        const dueTs = new Date(bill.dueDate + 'T23:59:59')
        if (paidTs > dueTs) return false
      }
      if (filters.paymentDateStart || filters.paymentDateEnd) {
        if (!bill.paidAt) return false
        const paidStr = bill.paidAt?.seconds
          ? new Date(bill.paidAt.seconds * 1000).toISOString().slice(0, 10)
          : (typeof bill.paidAt === 'string' ? bill.paidAt.slice(0, 10) : null)
        if (!paidStr) return false
        if (filters.paymentDateStart && paidStr < filters.paymentDateStart) return false
        if (filters.paymentDateEnd && paidStr > filters.paymentDateEnd) return false
      }
      return true
    })
  }, [enrichedBills, filters])

  const groupedData = useMemo(() => {
    const modalityMap = {}
    const normalize = (str) => str?.toLowerCase().trim() || ''

    /**
     * Para cada bill, retorna array de { modName, turmaName } — um par por modalidade do aluno.
     * Se o bill já tem modalityName salvo → usa ele direto.
     * Senão, itera TODAS as modalidades do aluno e vincula a turma correspondente de cada uma.
     */
    const getModalityTurmaPairs = (bill) => {
      const aluno = studentsMap[bill.studentId]

      // Aluno desconhecido → usa o que está salvo no bill (fallback)
      if (!aluno) {
        return [{ modName: bill.modalityName || 'Outros', turmaName: bill.turmaName || 'Sem Turma' }]
      }

      // SEMPRE usa o perfil do aluno para pegar TODAS as modalidades corretas
      const alunoMods = Array.isArray(aluno.modalities) ? aluno.modalities :
                        aluno.modality ? [aluno.modality] : []
      const modNames = alunoMods.map(m => typeof m === 'object' ? m?.name : m).filter(Boolean)

      // Sem modalidades no perfil → usa o que está salvo no bill
      if (modNames.length === 0) {
        return [{ modName: bill.modalityName || 'Outros', turmaName: 'Sem Turma' }]
      }

      // Turmas do aluno como uniqueIds (ex: "boxe:tarde", "jiu-jitsu:geral")
      const alunoTurmas = Array.isArray(aluno.turmas) ? aluno.turmas : []

      return modNames.map(modName => {
        // Localiza a modalidade nos dados carregados para obter o ID
        const matchedMod = (modalities || []).find(m =>
          m.name.toLowerCase() === modName.toLowerCase()
        )

        if (!matchedMod) return { modName, turmaName: 'Sem Turma' }

        // Encontra o uniqueId da turma do aluno que pertence a ESTA modalidade
        const matchingUniqueId = alunoTurmas.find(t => {
          if (typeof t !== 'string') return false
          if (t.includes(':')) {
            const [tModId] = t.split(':')
            return tModId === matchedMod.id
          }
          // Formato legado (só turmaId): procura dentro das turmas da modalidade
          return (matchedMod.turmas || []).some(tr => tr.id === t)
        })

        if (!matchingUniqueId) return { modName, turmaName: 'Sem Turma' }

        // Resolve o nome legível via turmaLookup (ex: "boxe:tarde" → "Tarde")
        const looked = turmaLookup[matchingUniqueId]
        if (looked) return { modName, turmaName: looked.turmaDisplayName }

        // Fallback: capitaliza a parte após os dois pontos
        const parts = matchingUniqueId.split(':')
        const rawName = parts.length > 1 ? parts[1] : matchingUniqueId
        return { modName, turmaName: rawName.charAt(0).toUpperCase() + rawName.slice(1) }
      })
    }


    const addBillToGroup = (bill, modName, turmaName) => {
      const modKey = normalize(modName)
      const turmaKey = normalize(turmaName)
      const amount = Number(bill.amount) || 0

      if (!modalityMap[modKey]) {
        modalityMap[modKey] = {
          name: modName,
          turmas: {},
          totalPaid: 0, totalPending: 0, totalOverdue: 0, totalAmount: 0,
        }
      }
      const mod = modalityMap[modKey]

      if (!mod.turmas[turmaKey]) {
        mod.turmas[turmaKey] = {
          name: turmaName,
          bills: [],
          totalPaid: 0, totalPending: 0, totalOverdue: 0, totalAmount: 0,
        }
      }
      const turma = mod.turmas[turmaKey]

      turma.bills.push(bill)
      turma.totalAmount += amount
      mod.totalAmount += amount
      if (bill.status === 'paid') {
        mod.totalPaid += amount; turma.totalPaid += amount
      } else if (bill.status === 'pending') {
        mod.totalPending += amount; turma.totalPending += amount
      } else if (bill.status === 'overdue') {
        mod.totalOverdue += amount; turma.totalOverdue += amount
      }
    }

    filteredBills.forEach(bill => {
      const pairs = getModalityTurmaPairs(bill)
      pairs.forEach(({ modName, turmaName }) => {
        addBillToGroup(bill, modName || 'Outros', turmaName || 'Sem Turma')
      })
    })

    const modalities_result = Object.values(modalityMap).map(mod => ({
      ...mod,
      turmas: Object.values(mod.turmas),
    })).sort((a, b) => {
      if (a.name === 'Outros') return 1
      if (b.name === 'Outros') return -1
      return a.name.localeCompare(b.name, 'pt-BR')
    })

    // Totais gerais deduplica por ID para não inflar quando o aluno tem múltiplas modalidades
    const seenIds = new Set()
    let totalPaid = 0, totalPending = 0, totalOverdue = 0, totalAmount = 0
    filteredBills.forEach(b => {
      if (seenIds.has(b.id)) return
      seenIds.add(b.id)
      const amt = Number(b.amount) || 0
      totalAmount += amt
      if (b.status === 'paid') totalPaid += amt
      else if (b.status === 'pending') totalPending += amt
      else if (b.status === 'overdue') totalOverdue += amt
    })

    return { modalities: modalities_result, totalPaid, totalPending, totalOverdue, totalAmount, count: filteredBills.length }
  }, [filteredBills, studentsMap, modalities, turmaLookup])

  return {
    bills: filteredBills,
    loading: loading || loadingStudents,
    filters,
    updateFilters,
    resetFilters,
    groupedData,
  }
}

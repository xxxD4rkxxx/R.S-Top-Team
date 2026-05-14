import { useState, useEffect } from 'react'
import { db } from '../firebase/config'
import { 
  collection, query, where, onSnapshot, 
  orderBy, getDocs, limit, addDoc, doc, 
  updateDoc, deleteDoc, serverTimestamp, runTransaction 
} from 'firebase/firestore'
import { COLLECTIONS } from '../firebase/collections'
import { useAuth } from '../context/AuthContext'
import { calculateModalityValue } from '../utils/billingUtils'

const toDateKeyUTC = (date) => {
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const toDateFromAny = (value) => {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (value?.seconds) return new Date(value.seconds * 1000)
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  return null
}

const getReferenceMonthLabelUTC = (date) => {
  const month = date.toLocaleString('pt-BR', { month: 'long', timeZone: 'UTC' })
  const year = date.getUTCFullYear()
  return `${month} / ${year}`
}

const getNextMonthlyDueDate = (baseValue) => {
  const baseDate = toDateFromAny(baseValue)
  if (!baseDate) return null

  const day = baseDate.getUTCDate()
  const nextMonthStart = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth() + 1, 1, 12, 0, 0))
  const targetYear = nextMonthStart.getUTCFullYear()
  const targetMonth = nextMonthStart.getUTCMonth()
  const maxDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0, 12, 0, 0)).getUTCDate()
  const normalizedDay = Math.min(day, maxDay)

  return new Date(Date.UTC(targetYear, targetMonth, normalizedDay, 12, 0, 0))
}

/**
 * Hook para gerenciar as operações financeiras (Receitas e Despesas).
 * Possui proteções no lado do cliente para evitar que Alunos acessem
 * ou modifiquem dados confidenciais financeiros.
 */

// ============================================================================
// FUNÇÃO AUXILIAR: Verificar e criar cobranças expiradas automaticamente
// ============================================================================
// Esta função verifica se o aluno tem uma cobrança paga com dueDate vencida
// e cria automaticamente uma nova cobrança PENDENTE para o próximo mês
// ============================================================================
async function verificarECriarCobrancasExpiradas() {
  try {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]
    const currentMonth = `${today.toLocaleString('pt-BR', { month: 'long' })} / ${today.getFullYear()}`
    
    
// 1. Buscar TODAS as cobranças (para verificar existência) e filtrar pagas depois
const allChargesSnap = await getDocs(collection(db, COLLECTIONS.FATURAMENTO))

// 2. Buscar modalidades
const modalitiesSnap = await getDocs(collection(db, COLLECTIONS.MODALIDADES))
const modalitiesList = modalitiesSnap.docs.map(d => ({ id: d.id, ...d.data() }))

// 3. Buscar alunos
const studentsSnap = await getDocs(collection(db, COLLECTIONS.USUARIOS))
const studentsList = studentsSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    
    let criadas = 0

    // Filtrar apenas cobranças pagas para processar
    const paidCharges = allChargesSnap.docs.filter(d => d.data().status === 'paid')
    
    // 4. Verificar cada cobrança paga
    for (const docSnap of paidCharges) {
      const cobranca = { id: docSnap.id, ...docSnap.data() }
      
      // Se não venceu ainda, pular
      if (cobranca.dueDate >= todayStr) continue
      
      const studentId = cobranca.studentId
      
      // Verificar se já existe QUALQUER cobrança (pending/paid) para o mês atual deste aluno
      const existingCurrentMonth = allChargesSnap.docs.find(d => {
        const data = d.data()
        return data.studentId === studentId && 
               data.referenceMonth === currentMonth
      })
      
      if (existingCurrentMonth) continue
      
      const aluno = studentsList.find(s => s.id === studentId)
      if (!aluno) continue
      
      const statusAluno = String(aluno.status || '').toLowerCase()
      if (statusAluno !== 'ativo' && statusAluno !== 'active') continue
      if (aluno.isPaymentExempt) continue
      
      const novoValor = calculateModalityValue(aluno, modalitiesList)
      
      if (novoValor <= 0) continue
      
      // Próximo vencimento mensal no mesmo dia-base do pagamento.
      const nextDueDate = getNextMonthlyDueDate(cobranca.paidAt || cobranca.dueDate)
      if (!nextDueDate) continue
      const dueDateStr = toDateKeyUTC(nextDueDate)
      
      // Extrair primeira modalidade e turma do aluno para o relatório
      const alunoMods = Array.isArray(aluno.modalities) ? aluno.modalities : aluno.modality ? [aluno.modality] : []
      const firstMod = alunoMods[0]
      const alunoModalityName = typeof firstMod === 'object' ? (firstMod?.name || '') : (firstMod || '')
      const alunoTurmas = Array.isArray(aluno.turmas) ? aluno.turmas : aluno.turma ? [aluno.turma] : []
      const firstTurma = alunoTurmas[0]
      const alunoTurmaName = typeof firstTurma === 'object' ? (firstTurma?.name || '') : (firstTurma || '')

      // Criar nova cobrança PENDENTE
      await addDoc(collection(db, COLLECTIONS.FATURAMENTO), {
        studentId: studentId,
        studentName: aluno.name || cobranca.studentName,
        amount: novoValor,
        status: 'pending',
        dueDate: dueDateStr,
        referenceMonth: getReferenceMonthLabelUTC(nextDueDate),
        modalityName: alunoModalityName || null,
        turmaName: alunoTurmaName || null,
        createdAt: serverTimestamp(),
        autoGenerated: true,
        previousBillId: cobranca.id
      })
      
      criadas++
      console.log(`✅ Nova cobrança PENDENTE criada para ${aluno.name || studentId} - Vencimento: ${dueDateStr}`)
    }
    
    if (criadas > 0) {
      console.log(`🎉 Total de ${criadas} novas cobranças pendentes criadas automaticamente.`)
    } else {
      console.log('✅ Nenhuma cobrança vencida encontrada para processar.')
    }
  } catch (err) {
    console.error('❌ Erro ao verificar/criar cobranças expiradas:', err)
  }
}

// ── Cache em memória (Singleton) ───────────────────────────────────────────────
let _cachedCobrancas = null
let _cachedDespesas = null
let _financeListeners = {
  cobrancas: { unsub: null, subscribers: [], loading: true },
  despesas: { unsub: null, subscribers: [], loading: true }
}

function subscribeToFinance(type, userId, role, callback) {
  const channel = _financeListeners[type]
  channel.subscribers.push(callback)

  if (type === 'cobrancas' && _cachedCobrancas) callback(_cachedCobrancas, false)
  if (type === 'despesas' && _cachedDespesas) callback(_cachedDespesas, false)

  if (!channel.unsub) {
    const ref = collection(db, type === 'cobrancas' ? COLLECTIONS.FATURAMENTO : COLLECTIONS.DESPESAS)
    let q;
    
    if (type === 'cobrancas') {
      q = role === 'aluno' ? query(ref, where('studentId', '==', userId), orderBy('dueDate', 'desc')) : query(ref, orderBy('dueDate', 'desc'))
    } else {
      q = query(ref, orderBy('dueDate', 'desc'))
    }

    channel.unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      if (type === 'cobrancas') _cachedCobrancas = data
      else _cachedDespesas = data
      channel.loading = false
      channel.subscribers.forEach(cb => cb(data, false))
    }, (err) => {
      console.error(`Erro no canal ${type}:`, err)
      channel.loading = false
      channel.subscribers.forEach(cb => cb([], false))
    })
  }

  return () => {
    channel.subscribers = channel.subscribers.filter(cb => cb !== callback)
    if (channel.subscribers.length === 0 && channel.unsub) {
      channel.unsub()
      channel.unsub = null
      channel.loading = true
    }
  }
}

export function useFinance() {
  const { user, userData, effectiveRole } = useAuth()
  const [cobrancas, setCobrancas] = useState(_cachedCobrancas || [])
  const [carregandoCobrancas, setCarregandoCobrancas] = useState(_financeListeners.cobrancas.loading)
  const [despesas, setDespesas] = useState(_cachedDespesas || [])
  const [carregandoDespesas, setCarregandoDespesas] = useState(_financeListeners.despesas.loading)

  useEffect(() => {
    if (!user) {
      setCarregandoCobrancas(false)
      setCarregandoDespesas(false)
      return
    }

    // ========================================================================
    // VERIFICAR COBRANÇAS EXPIRADAS AO INICIALIZAR
    // ========================================================================
    verificarECriarCobrancasExpiradas().then(() => {
      console.log('✅ Verificação de cobranças expiradas concluída.')
    }).catch(err => {
      console.error('❌ Erro na verificação de cobranças expiradas:', err)
    })

    const unsubCob = subscribeToFinance('cobrancas', userData?.id || user.uid, effectiveRole, (data, loading) => {
      setCobrancas(data)
      setCarregandoCobrancas(loading)
    })

    let unsubDesp = () => {}
    if (effectiveRole !== 'aluno' && effectiveRole !== 'professor') {
      unsubDesp = subscribeToFinance('despesas', userData?.id || user.uid, effectiveRole, (data, loading) => {
        setDespesas(data)
        setCarregandoDespesas(loading)
      })
    } else {
      setDespesas([])
      setCarregandoDespesas(false)
    }

    return () => {
      unsubCob()
      unsubDesp()
    }
  }, [user, effectiveRole])

  // ==========================================
  // CÁLCULOS E KPIs (RECEITAS)
  // ==========================================
  const todayStr = new Date().toISOString().split('T')[0]
  const cobrancasVencidas = cobrancas.filter(b => 
    b.status === 'overdue' || (b.status === 'pending' && b.dueDate < todayStr)
  )
  const cobrancasPendentes = cobrancas.filter(b => b.status === 'pending' && b.dueDate >= todayStr)
  const cobrancasPagas = cobrancas.filter(b => b.status === 'paid')

  const totalVencido = cobrancasVencidas.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
  const totalPendente = cobrancasPendentes.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)
  const totalPago = cobrancasPagas.reduce((sum, b) => sum + (Number(b.amount) || 0), 0)

  // ==========================================
  // CÁLCULOS E KPIs (DESPESAS)
  // ==========================================
  const despesasPagas = despesas.filter(d => d.status === 'paid')
  const despesasPendentes = despesas.filter(d => d.status === 'pending')

  const totalDespesasPagas = despesasPagas.reduce((sum, d) => sum + (Number(d.amount) || 0), 0)
  const totalDespesasPendentes = despesasPendentes.reduce((sum, d) => sum + (Number(d.amount) || 0), 0)

  // ==========================================
  // MÉTODOS CRUD - COBRANÇAS (RECEITAS)
  // ==========================================

  /**
   * Adiciona uma nova cobrança. Restrito a admin/gestor.
   */
  async function criarCobranca(dadosCobranca) {
    if (effectiveRole === 'aluno') {
      throw new Error('Segurança Operacional: Acesso Negado para criar cobranças.')
    }
    const cobrancasRef = collection(db, COLLECTIONS.FATURAMENTO)
    await addDoc(cobrancasRef, {
      ...dadosCobranca,
      createdAt: serverTimestamp(),
      amount: Number(dadosCobranca.amount)
    })
  }

  /**
   * Gera cobranças mensais em lote para alunos ativos e não-isentos.
   * Agora suporta cálculo dinâmico baseado no plano sugerido das modalidades.
   */
  async function gerarCobrancasEmLote(alunos, modalidades, mesReferencia, dataVencimento) {
    if (effectiveRole === 'aluno' || effectiveRole === 'professor') {
      throw new Error('Segurança Operacional: Acesso Negado para processamento em lote.')
    }
    
    // Filtra alunos que são ATIVOS
    const alunosAtivos = alunos.filter(a => 
      a.roles?.aluno === true &&
      a.status === 'Ativo'
    )

    const cobrancasRef = collection(db, COLLECTIONS.FATURAMENTO)
    let criadas = 0
    
    for (const aluno of alunosAtivos) {
      // 1. Pular se o aluno for marcado globalmente como isento
      if (aluno.isPaymentExempt) continue

      let valorFinal = 0

      // 2. Se o modo for manual, usa o valor fixo definido no perfil
      if (aluno.billingMode === 'manual') {
        valorFinal = Number(aluno.manualPlanValue || aluno.planValue) || 0
      } 
      // 3. Caso contrário, calcula com base nas modalidades e categoria de idade
      else {
        valorFinal = calculateModalityValue(aluno, modalidades)
      }

      // 4. Só cria cobrança se o valor for maior que zero
      if (valorFinal > 0) {
        // Extrair primeira modalidade e turma para o relatório
        const bMods = Array.isArray(aluno.modalities) ? aluno.modalities : aluno.modality ? [aluno.modality] : []
        const bFirstMod = bMods[0]
        const bModalityName = typeof bFirstMod === 'object' ? (bFirstMod?.name || '') : (bFirstMod || '')
        const bTurmas = Array.isArray(aluno.turmas) ? aluno.turmas : aluno.turma ? [aluno.turma] : []
        const bFirstTurma = bTurmas[0]
        const bTurmaName = typeof bFirstTurma === 'object' ? (bFirstTurma?.name || '') : (bFirstTurma || '')

        const payload = {
          studentId: aluno.id,
          studentName: aluno.name,
          amount: valorFinal,
          status: 'pending',
          dueDate: dataVencimento,
          referenceMonth: mesReferencia,
          modalityName: bModalityName || null,
          turmaName: bTurmaName || null,
          createdAt: serverTimestamp()
        }
        
        await addDoc(cobrancasRef, payload)
        criadas++
      }
    }

    return criadas
  }

  /**
   * Atualiza o status (Ex: marcar como Paga). Restrito a admin/gestor.
   * @param {string} idCobranca - ID da cobrança no Firestore
   * @param {string} novoStatus - Novo status ('paid', 'pending', 'overdue')
   * @param {string|null} paidBy - Nome do gestor que registrou o pagamento (primeiro + segundo nome)
   */
  async function atualizarStatusCobranca(idCobranca, novoStatus, paidBy = null) {
    if (effectiveRole === 'aluno') {
      throw new Error('Segurança Operacional: Acesso Negado para alterar status.')
    }
    const cobrancaRef = doc(db, COLLECTIONS.FATURAMENTO, idCobranca)
    const payload = { 
      status: novoStatus,
      updatedAt: serverTimestamp()
    }
    if (novoStatus === 'paid') {
      payload.paidAt = serverTimestamp()
      if (paidBy) {
        payload.paidBy = paidBy
      }
    } else {
      payload.paidAt = null
      payload.paidBy = null
    }
    await updateDoc(cobrancaRef, payload)
  }

  /**
   * Atualiza dados de uma cobrança (Ex: valor).
   */
  async function atualizarCobranca(idCobranca, dados) {
    if (effectiveRole === 'aluno') {
      throw new Error('Segurança Operacional: Acesso Negado.')
    }
    const cobrancaRef = doc(db, COLLECTIONS.FATURAMENTO, idCobranca)
    await updateDoc(cobrancaRef, {
      ...dados,
      updatedAt: serverTimestamp()
    })
  }

/**
   * Deleta uma cobrança específica.
   */
  async function deletarCobranca(idCobranca) {
    if (effectiveRole === 'aluno') {
      throw new Error('Segurança Operacional: Acesso Negado para deletar.')
    }
    await deleteDoc(doc(db, COLLECTIONS.FATURAMENTO, idCobranca))
  }

  /**
   * Ajusta a cobrança pendente do aluno quando suas modalidades mudam.
   * Chamado quando um aluno sai ou entra em uma modalidade.
   * @param {string} studentId - ID do aluno
   * @param {string[]} newModalities - Novas modalidades do aluno
   * @param {Array} modalitiesConfig - Configuração de preços das modalidades (do useModalities)
   */
  async function ajustarCobrancaPorMudancaModalidade(studentId, newModalities, modalitiesConfig) {
    if (effectiveRole === 'aluno') {
      throw new Error('Segurança Operacional: Acesso Negado.')
    }

    if (!studentId || !Array.isArray(newModalities) || !Array.isArray(modalitiesConfig)) {
      return
    }

    // Buscar cobrança pendente mais recente do aluno
    const today = new Date()
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
    const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    
    const q = query(
      collection(db, COLLECTIONS.FATURAMENTO),
      where('studentId', '==', studentId),
      where('status', '==', 'pending'),
      orderBy('dueDate', 'desc'),
      limit(1)
    )

    const snapshot = await getDocs(q)
    
    if (snapshot.empty) {
      console.log('[Cobrança] Nenhuma cobrança pendente encontrada para ajuste')
      return
    }

    const cobranca = snapshot.docs[0]
    const cobrancaData = cobranca.data()

    // Verificar se a cobrança é do mês atual ou futuro próximo
    const cobrancaDueDate = new Date(cobrancaData.dueDate + 'T00:00:00')
    if (cobrancaDueDate < currentMonthStart || cobrancaDueDate > currentMonthEnd) {
      console.log('[Cobrança] Cobrança pendente não é do mês atual, não precisa ajustar')
      return
    }

    // Calcular novo valor baseado nas novas modalidades
    // Passamos um objeto fake que simula o aluno para o utilitário
    const studentProxy = {
      ...cobrancaData,
      modalities: newModalities
    }
    const novoValor = calculateModalityValue(studentProxy, modalitiesConfig)

    // Verificar se o valor mudou
    const valorAtual = Number(cobrancaData.amount) || 0
    if (novoValor !== valorAtual && novoValor > 0) {
      await updateDoc(doc(db, COLLECTIONS.FATURAMENTO, cobranca.id), {
        amount: novoValor,
        modalities: newModalities,
        updatedAt: serverTimestamp()
      })
      console.log(`[Cobrança] Valor ajustado de R$${valorAtual} para R$${novoValor}`)
    }
  }

  // Compatibilidade Legada (Mantendo nomes em inglês pro restante do app não quebrar instantaneamente)
  return {
    // Legacy Exports
    bills: cobrancas,
    loading: carregandoCobrancas,
    overdueBills: cobrancasVencidas,
    overdueCount: cobrancasVencidas.length,
    pendingCount: cobrancasPendentes.length,
    totalOverdue: totalVencido,
    totalPending: totalPendente,
    totalPaid: totalPago,
    addBill: criarCobranca,
    updateBill: atualizarCobranca,
    gerarCobrancasEmLote: gerarCobrancasEmLote, // Export nativo
    generateBatchBilling: gerarCobrancasEmLote, // Legacy alias
    updateBillStatus: atualizarStatusCobranca,
    deleteBill: deletarCobranca,
    
    // Novos Exports (Despesas)
    expenses: despesas,
    loadingExpenses: carregandoDespesas,
    expensesPaidTotal: totalDespesasPagas,
    expensesPendingTotal: totalDespesasPendentes,
    
    // Ajuste de cobrança por mudança de modalidade
    ajustarCobrancaPorMudancaModalidade
  }
}

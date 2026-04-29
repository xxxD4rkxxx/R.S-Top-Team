import { useState, useEffect } from 'react'
import { db } from '../firebase/config'
import { 
  collection, query, where, onSnapshot, 
  orderBy, getDocs, limit, addDoc, doc, 
  updateDoc, deleteDoc, serverTimestamp, runTransaction 
} from 'firebase/firestore'
import { COLLECTIONS } from '../firebase/collections'
import { useAuth } from '../context/AuthContext'

/**
 * Hook para gerenciar as operações financeiras (Receitas e Despesas).
 * Possui proteções no lado do cliente para evitar que Alunos acessem
 * ou modifiquem dados confidenciais financeiros.
 */
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
        const cat = (aluno.ageCategory || 'Adulto').toLowerCase()
        const modsAluno = Array.isArray(aluno.modalities) ? aluno.modalities : [aluno.modality].filter(Boolean)

        modsAluno.forEach(modName => {
          // Encontra a configuração da modalidade pelo nome ou slug
          const modConfig = modalidades.find(m => m.name === modName || m.id === modName)
          if (modConfig && modConfig.pricing && modConfig.pricing[cat]) {
            const rule = modConfig.pricing[cat]
            if (rule.enabled) {
              valorFinal += Number(rule.price) || 0
            }
          }
        })

        // Fallback: se não encontrou nada nas modalidades mas tem um planValue legado, usa ele
        if (valorFinal === 0 && aluno.planValue) {
          valorFinal = Number(aluno.planValue) || 0
        }
      }

      // 4. Só cria cobrança se o valor for maior que zero
      if (valorFinal > 0) {
        const payload = {
          studentId: aluno.id,
          studentName: aluno.name,
          amount: valorFinal,
          status: 'pending',
          dueDate: dataVencimento, 
          referenceMonth: mesReferencia,
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
   */
  async function atualizarStatusCobranca(idCobranca, novoStatus) {
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
    } else {
      payload.paidAt = null // Limpa se foi marcado como pendente/vencido por engano
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

  // ==========================================
  // MÉTODOS CRUD - DESPESAS
  // ==========================================

  /**
   * Adiciona uma nova despesa do estúdio/academia.
   */
  async function criarDespesa(dadosDespesa) {
    if (effectiveRole !== 'gestor' && effectiveRole !== 'admin') {
      throw new Error('Segurança Operacional: Apenas gestores podem lançar despesas.')
    }
    const despesasRef = collection(db, COLLECTIONS.DESPESAS)
    await addDoc(despesasRef, {
      ...dadosDespesa,
      createdAt: serverTimestamp(),
      amount: Number(dadosDespesa.amount)
    })
  }

  /**
   * Atualiza uma despesa existente (Status de pago, etc).
   */
  async function atualizarDespesa(idDespesa, dadosAtualizados) {
    if (effectiveRole !== 'gestor' && effectiveRole !== 'admin') {
      throw new Error('Segurança Operacional: Apenas gestores podem editar despesas.')
    }
    const despesaRef = doc(db, COLLECTIONS.DESPESAS, idDespesa)
    await updateDoc(despesaRef, {
      ...dadosAtualizados,
      updatedAt: serverTimestamp()
    })
  }

  /**
   * Deleta uma despesa.
   */
  async function deletarDespesa(idDespesa) {
    if (effectiveRole !== 'gestor' && effectiveRole !== 'admin') {
      throw new Error('Segurança Operacional: Acesso Negado.')
    }
    await deleteDoc(doc(db, COLLECTIONS.DESPESAS, idDespesa))
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
    addExpense: criarDespesa,
    updateExpense: atualizarDespesa,
    deleteExpense: deletarDespesa
  }
}

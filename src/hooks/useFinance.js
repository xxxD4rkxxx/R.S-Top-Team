import { useState, useEffect } from 'react'
import { db } from '../firebase/config'
import { 
  collection, query, where, onSnapshot, 
  orderBy, getDocs, limit, addDoc, doc, 
  updateDoc, deleteDoc, serverTimestamp 
} from 'firebase/firestore'
import { useAuth } from '../context/AuthContext'

/**
 * Hook para gerenciar as operações financeiras (Receitas e Despesas).
 * Possui proteções no lado do cliente para evitar que Alunos acessem
 * ou modifiquem dados confidenciais financeiros.
 */
export function useFinance() {
  const { user, effectiveRole } = useAuth()
  
  // ==========================================
  // ESTADOS - RECEITAS (Cobranças / Billing)
  // ==========================================
  const [cobrancas, setCobrancas] = useState([]) // bills
  const [carregandoCobrancas, setCarregandoCobrancas] = useState(true)

  // ==========================================
  // ESTADOS - DESPESAS (Expenses)
  // ==========================================
  const [despesas, setDespesas] = useState([]) // expenses
  const [carregandoDespesas, setCarregandoDespesas] = useState(true)

  // -------------------------------------------------------------
  // EFEITO: BUCAR COBRANÇAS (SEGURANÇA POR ROLE)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!user) {
      setCarregandoCobrancas(false)
      return
    }

    const cobrancasRef = collection(db, 'billing')
    let q;

    // Se for Aluno, busca APENAS as cobranças dele mesmo para evitar VAZAMENTO (Zero Leaks).
    if (effectiveRole === 'aluno') {
      q = query(cobrancasRef, where('studentId', '==', user.uid), orderBy('dueDate', 'desc'))
    } else {
      // Admin, Gestor ou Professor (se tiver permissão) veem todas
      q = query(cobrancasRef, orderBy('dueDate', 'desc'))
    }

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setCobrancas(data)
      setCarregandoCobrancas(false)
    }, (err) => {
      console.error('Erro ao buscar cobranças (useFinance):', err)
      setCarregandoCobrancas(false)
    })

    return () => unsubscribe()
  }, [user, effectiveRole])

  // -------------------------------------------------------------
  // EFEITO: BUCAR DESPESAS (SOMENTE GESTORES)
  // -------------------------------------------------------------
  useEffect(() => {
    if (!user) {
      setCarregandoDespesas(false)
      return
    }

    // Alunos e professores básicos não deveriam ver despesas do negócio.
    if (effectiveRole === 'aluno' || effectiveRole === 'professor') {
      setDespesas([])
      setCarregandoDespesas(false)
      return
    }

    const despesasRef = collection(db, 'expenses')
    const q = query(despesasRef, orderBy('dueDate', 'desc'))

    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setDespesas(data)
      setCarregandoDespesas(false)
    }, (err) => {
      console.error('Erro ao buscar despesas (useFinance):', err)
      setCarregandoDespesas(false)
    })

    return () => unsubscribe()
  }, [user, effectiveRole])

  // ==========================================
  // CÁLCULOS E KPIs (RECEITAS)
  // ==========================================
  const cobrancasVencidas = cobrancas.filter(b => b.status === 'overdue')
  const cobrancasPendentes = cobrancas.filter(b => b.status === 'pending')
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
    const cobrancasRef = collection(db, 'billing')
    await addDoc(cobrancasRef, {
      ...dadosCobranca,
      createdAt: serverTimestamp(),
      amount: Number(dadosCobranca.amount)
    })
  }

  /**
   * Gera cobranças mensais em lote para alunos ativos e não-isentos.
   * Restrito a admin/gestor.
   */
  async function gerarCobrancasEmLote(alunos, mesReferencia, dataVencimento) {
    if (effectiveRole === 'aluno' || effectiveRole === 'professor') {
      throw new Error('Segurança Operacional: Acesso Negado para processamento em lote.')
    }
    
    // Filtra alunos que são ATIVOS e NÃO SÃO isentos
    const alunosPagantes = alunos.filter(a => 
      a.roles?.aluno === true &&
      a.status === 'Ativo' && 
      !a.isPaymentExempt
    )

    const cobrancasRef = collection(db, 'billing')
    const novasCobrancas = []
    
    // Criamos as pendências no banco
    for (const aluno of alunosPagantes) {
      // Valor base do plano do aluno, fallback para 0 se não configurado
      const valorBase = Number(aluno.planValue) || 0
      
      const payload = {
        studentId: aluno.id,
        studentName: aluno.name,
        amount: valorBase,
        status: 'pending',
        dueDate: dataVencimento, // Formato string YYYY-MM-DD
        referenceMonth: mesReferencia, // Ex: "04/2026"
        createdAt: serverTimestamp()
      }
      
      await addDoc(cobrancasRef, payload)
      novasCobrancas.push(payload)
    }

    return novasCobrancas.length
  }

  /**
   * Atualiza o status (Ex: marcar como Paga). Restrito a admin/gestor.
   */
  async function atualizarStatusCobranca(idCobranca, novoStatus) {
    if (effectiveRole === 'aluno') {
      throw new Error('Segurança Operacional: Acesso Negado para alterar status.')
    }
    const cobrancaRef = doc(db, 'billing', idCobranca)
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
   * Deleta uma cobrança específica.
   */
  async function deletarCobranca(idCobranca) {
    if (effectiveRole === 'aluno') {
      throw new Error('Segurança Operacional: Acesso Negado para deletar.')
    }
    await deleteDoc(doc(db, 'billing', idCobranca))
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
    const despesasRef = collection(db, 'expenses')
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
    const despesaRef = doc(db, 'expenses', idDespesa)
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
    await deleteDoc(doc(db, 'expenses', idDespesa))
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
    generateBatchBilling: gerarCobrancasEmLote,
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

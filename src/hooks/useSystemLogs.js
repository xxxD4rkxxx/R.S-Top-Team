/**
 * Hook para logs de atividade do sistema
 * Coleção: logs_sistema
 * 
 * Campos:
 * - type: 'activity' | 'error'
 * - level: 'info' | 'warn' | 'error'
 * - action: título da ação
 * - detail: descrição detalhada
 * - userId: ID do usuário que realizou a ação
 * - userName: nome do usuário
 * - userRole: papel do usuário (admin, gestor, professor, aluno)
 * - category: categoria da atividade (evento, chamada, visita, aluno, equipe, graduacao, financeiro)
 * - targetId: ID do alvo da ação
 * - targetName: nome do alvo
 * - createdAt: data/hora
 */
import { useState, useEffect, useCallback } from 'react'
import {
  collection, onSnapshot, query, orderBy, addDoc, serverTimestamp, limit, startAfter, getDocs
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { COLLECTIONS } from '../firebase/collections'

const COLECAO = COLLECTIONS.LOGS_SISTEMA
const LIMITE_PAGINA = 20

export function useSystemLogs(tipoLog = 'all', maxLogs = 100) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [carregandoMais, setCarregandoMais] = useState(false)
  const [temMais, setTemMais] = useState(true)
  const [ultimoDoc, setUltimoDoc] = useState(null)

  // Carregar logs iniciais
  useEffect(() => {
    setLogs([])
    setTemMais(true)
    setUltimoDoc(null)
    
    const q = query(
      collection(db, COLECAO),
      orderBy('createdAt', 'desc'),
      limit(LIMITE_PAGINA)
    )
    
    const unsub = onSnapshot(q, snap => {
      const todos = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date()
      }))
      
      // Filtrar por tipo se necessário
      const filtrados = tipoLog === 'all' 
        ? todos 
        : todos.filter(l => l.type === tipoLog)
      
      setLogs(filtrados)
      setUltimoDoc(snap.docs[snap.docs.length - 1] || null)
      setTemMais(snap.docs.length === LIMITE_PAGINA)
      setLoading(false)
    }, () => setLoading(false))
    
    return unsub
  }, [tipoLog])

  // Função para carregar mais logs (scroll infinito)
  const carregarMais = useCallback(async () => {
    if (carregandoMais || !temMais || !ultimoDoc) return
    
    setCarregandoMais(true)
    
    try {
      const q = query(
        collection(db, COLECAO),
        orderBy('createdAt', 'desc'),
        startAfter(ultimoDoc),
        limit(LIMITE_PAGINA)
      )
      
      const snap = await getDocs(q)
      const novos = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        createdAt: d.data().createdAt?.toDate?.() || new Date()
      }))
      
      const filtrados = tipoLog === 'all' 
        ? novos 
        : novos.filter(l => l.type === tipoLog)
      
      setLogs(prev => [...prev, ...filtrados])
      setUltimoDoc(snap.docs[snap.docs.length - 1] || null)
      setTemMais(snap.docs.length === LIMITE_PAGINA)
    } catch (e) {
      console.error('Erro ao carregar mais logs:', e)
    } finally {
      setCarregandoMais(false)
    }
  }, [carregandoMais, temMais, ultimoDoc, tipoLog])

  /**
   * Registra log de atividade
   * @param {string} action - Título da ação
   * @param {string} detail - Descrição detalhada
   * @param {object} opcoes - Opções adicionais
   * @param {string} opcoes.userId - ID do usuário
   * @param {string} opcoes.userName - Nome do usuário
   * @param {string} opcoes.userRole - Papel do usuário (admin, gestor, professor, aluno)
   * @param {string} opcoes.category - Categoria (evento, chamada, visita, aluno, equipe, graduacao, financeiro)
   * @param {string} opcoes.targetId - ID do alvo
   * @param {string} opcoes.targetName - Nome do alvo
   */
  async function registrarAtividade(action, detail, opcoes = {}) {
    try {
      const {
        userId = 'sistema',
        userName = 'Sistema',
        userRole = 'sistema',
        category = 'sistema',
        targetId = null,
        targetName = null
      } = opcoes

      await addDoc(collection(db, COLECAO), {
        type: 'activity',
        level: 'info',
        action,
        detail,
        userId,
        userName,
        userRole,
        category,
        targetId,
        targetName,
        createdAt: serverTimestamp(),
      })
    } catch (e) {
      console.error('Erro ao registrar atividade:', e)
    }
  }

  /**
   * Registra log de erro
   * @param {string} action - Título da ação
   * @param {string|Error} error - Erro
   * @param {object} opcoes - Opções adicionais
   */
  async function registrarErro(action, error, opcoes = {}) {
    try {
      const {
        userId = 'sistema',
        userName = 'Sistema',
        userRole = 'sistema'
      } = opcoes

      await addDoc(collection(db, COLECAO), {
        type: 'error',
        level: 'error',
        action,
        detail: error?.message || String(error),
        userId,
        userName,
        userRole,
        category: 'sistema',
        createdAt: serverTimestamp(),
      })
    } catch (e) {
      console.error('Erro ao registrar erro:', e)
    }
  }

  /**
   * Registra log de aviso
   * @param {string} action - Título da ação
   * @param {string} detail - Descrição detalhada
   * @param {object} opcoes - Opções adicionais
   */
  async function registrarAviso(action, detail, opcoes = {}) {
    try {
      const {
        userId = 'sistema',
        userName = 'Sistema',
        userRole = 'sistema',
        category = 'sistema',
        targetId = null,
        targetName = null
      } = opcoes

      await addDoc(collection(db, COLECAO), {
        type: 'activity',
        level: 'warn',
        action,
        detail,
        userId,
        userName,
        userRole,
        category,
        targetId,
        targetName,
        createdAt: serverTimestamp(),
      })
    } catch (e) {
      console.error('Erro ao registrar aviso:', e)
    }
  }

  return {
    logs,
    loading,
    carregandoMais,
    temMais,
    carregarMais,
    registrarAtividade,
    registrarErro,
    registrarAviso
  }
}
/**
 * Hook para gerenciar as operações de Alunos na arquitetura unificada.
 * Agora todas as mutações são direcionadas para a coleção 'users' com o papel 'aluno'.
 */
import { useState, useCallback } from 'react'
import { db, firebaseConfig } from '../firebase/config'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
  setDoc,
  query,
  where,
  getDocs,
  getDoc,
  deleteField
} from 'firebase/firestore'
import { initializeApp, getApps } from 'firebase/app'
import {
  getAuth,
  setPersistence,
  inMemoryPersistence,
  createUserWithEmailAndPassword
} from 'firebase/auth'
import { COLLECTIONS, FIELDS } from '../firebase/collections'
import { useStudentsContext } from '../context/StudentsContext'
import { sanitizeString } from '../utils/security'

// Inicialização Silenciosa de Auth Secundário para Criação de Contas
const getVerifyAuth = () => {
  const apps = getApps()
  const verifyApp = apps.find(a => a.name === 'verify') || initializeApp(firebaseConfig, 'verify')
  const vAuth = getAuth(verifyApp)
  setPersistence(vAuth, inMemoryPersistence)
  return vAuth
}
const vAuth = getVerifyAuth()

/**
 * Gera e-mail técnico para autenticação via PIN.
 */
const getPinAuthEmail = (raw) => {
  const rawId = String(raw || '').toLowerCase().trim()
  if (rawId.includes('@') && !rawId.endsWith('.internal')) return rawId
  return `${rawId.replace(/[^a-z0-9]/g, '_')}@rstopteam.internal`
}

// Nome da coleção unificada
const USERS_COLLECTION = 'usuarios'
const VISITORS_COLLECTION = 'visitantes' // Nova coleção para Leads

/**
 * Normaliza o ID do usuário (E-mail ou Nome sanitizado).
 */
const sanitizeId = (identifier, forceName = false) => {
  if (!identifier) return 'visitante_' + Date.now()
  
  const idStr = identifier.toString().toLowerCase().trim()

  // Se forçado a usar nome ou não for um e-mail válido, sanitizamos como slug
  const isEmail = idStr.includes('@') && idStr.includes('.')
  
  if (forceName || !isEmail) {
    return idStr
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
  }
  
  return idStr
}

/**
 * Gera iniciais a partir do nome completo para o avatar visual.
 */
function buildInitials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function useStudents() {
  const { students, isLoadingStudents } = useStudentsContext()
  const [isUpdating, setIsUpdating] = useState(false)

  /**
   * Gera um PIN aleatório de 6 dígitos.
   */
  const generatePIN = useCallback(() => {
    return Math.floor(100000 + Math.random() * 900000).toString()
  }, [])

  /**
   * Atualiza o status de presença rápida do aluno (Marcando presença no dia).
   */
  const updateStudentStatus = useCallback(async (id, newStatus) => {
    const student = students.find(s => s.id === id)
    const payload = {
      [FIELDS.STATUS]: newStatus ?? null,
      lastStatusAt: serverTimestamp(),
    }

    if (newStatus === 'present') {
      payload.lastAttendanceAt = serverTimestamp()
    }

    // Atualiza o documento na coleção unificada
    const collectionName = student?.isVisitor ? VISITORS_COLLECTION : USERS_COLLECTION
    await updateDoc(doc(db, collectionName, id), payload)

    // Registra no histórico de chamadas
    if (newStatus) {
      await addDoc(collection(db, COLLECTIONS.PRESENCAS_LOG), {
        studentId: id,
        studentName: student?.name || id,
        date: serverTimestamp(),
        status: newStatus,
        modality: student?.modality || 'Jiu Jitsu'
      })
    }
  }, [students])

  /**
   * Altera o status administrativo do aluno (Ativo, Inativo, Suspenso).
   */
  const changeStudentStatus = useCallback(async (id, newStatus, extra = {}) => {
    const student = students.find(s => s.id === id)
    const payload = {
      [FIELDS.STATUS]: newStatus,
      lastStatusAt: serverTimestamp(),
    }
    if (extra.reason !== undefined) payload.statusReason = extra.reason
    if (extra.returnDate !== undefined) payload.statusReturnDate = extra.returnDate

    const collectionName = student?.isVisitor ? VISITORS_COLLECTION : USERS_COLLECTION
    await updateDoc(doc(db, collectionName, id), payload)
  }, [students])

  /**
   * Realiza o 'Soft Delete' do aluno. 
   * Em vez de remover permanentemente, altera o status para 'Inativo'
   * e registra a data de desativação para auditoria e histórico.
   */
  /**
   * DELETAR ALUNO (Hard Delete)
   * Alterado para exclusão permanente conforme solicitado pelo usuário, 
   * já que o Soft Delete mantinha o registro visível e causava erros de permissão em sub-serviços.
   */
  const deleteStudent = useCallback(async (studentId) => {
    if (!studentId) return

    const target = students.find(s => s.id === studentId)
    if (!target) return

    try {
      const collectionName = target?.isVisitor ? VISITORS_COLLECTION : USERS_COLLECTION
      
      // Realizamos o Hard Delete (Exclusão Permanente)
      await deleteDoc(doc(db, collectionName, studentId))
      
      console.log(`✅ Aluno ${studentId} removido permanentemente.`)
    } catch (e) {
      console.error('Erro ao remover aluno:', e)
      throw e
    }
  }, [students])

  /**
   * ADICIONAR NOVO ALUNO / VISITANTE
   */
  const addStudent = useCallback(async (newStudent, modality, options = {}) => {
    const { isVisitor = false, belt = 'white' } = options

    // Normalização de modalidades (Deduplicação e Padronização)
    let rawModalities = Array.isArray(modality) ? modality : [modality || 'Jiu Jitsu']
    
    // Filtramos e normalizamos para evitar 'jiu-jitsu' vs 'Jiu Jitsu'
    const finalModalities = Array.from(new Set(rawModalities.map(m => {
      if (typeof m !== 'string') return m
      // Se for o ID 'jiu-jitsu', normalizamos para o nome padrão 'Jiu Jitsu'
      // Isso será reforçado no Modal para enviar apenas os nomes oficiais
      return m.toLowerCase() === 'jiu-jitsu' ? 'Jiu Jitsu' : m
    }))).filter(Boolean)

    if (finalModalities.length === 0) finalModalities.push('Jiu Jitsu')

    const beltFinal = finalModalities.some(m => m.toLowerCase().includes('jiu')) ? (belt || 'white') : 'none'

    const pin = newStudent.pin || generatePIN()

    const payload = {
      [FIELDS.NOME]: sanitizeString(newStudent.name),
      name: sanitizeString(newStudent.name),
      initials: buildInitials(newStudent.name),
      belt: beltFinal,
      [FIELDS.MODALIDADE]: finalModalities[0],
      modality: finalModalities[0],
      [FIELDS.MODALIDADES]: finalModalities,
      modalities: finalModalities,
      stripes: 0,
      [FIELDS.STATUS]: 'ativo',
      status: 'ativo',
      isVisitor,
      photo: null,
      [FIELDS.EMAIL]: (newStudent.email || '').toLowerCase().trim(),
      email: (newStudent.email || '').toLowerCase().trim(),
      [FIELDS.TELEFONE]: newStudent.phone || '',
      phone: newStudent.phone || '',
      emergency: newStudent.emergency || '',
      medical: newStudent.medical || '',
      ageCategory: newStudent.ageCategory || 'Adulto',
      gender: newStudent.gender || 'Masculino',
      parentName: newStudent.parentName || '',
      parentPhone: newStudent.parentPhone || '',
      isPaymentExempt: newStudent.isPaymentExempt || false,
      planValue: newStudent.planValue || '',
      [FIELDS.PIN]: pin,
      pin: pin,
      [FIELDS.PAPEIS]: isVisitor ? { visitante: true } : { aluno: true },
      roles: isVisitor ? { visitante: true } : { aluno: true },
      [FIELDS.JORNADA_TECNICA]: {
        [FIELDS.FAIXA_ATUAL]: beltFinal,
        [FIELDS.GRAUS_ATUAIS]: 0,
        [FIELDS.AULAS_DESDE_ULTIMA_GRADUACAO]: 0,
        [FIELDS.DATA_ULTIMA_GRADUACAO]: serverTimestamp(),
        [FIELDS.HISTORICO]: [{
          belt: beltFinal,
          date: new Date(),
          reason: 'Ingresso na Academia'
        }]
      },
      [FIELDS.CRIADO_EM]: serverTimestamp(),
      [FIELDS.ATUALIZADO_EM]: serverTimestamp(),
      ultima_visita: null,
      total_visitas: 0
    }

    // 🔥 REGRA: Visitantes usam NOME como ID, Alunos usam E-MAIL
    const docId = isVisitor 
      ? sanitizeId(newStudent.name, true) 
      : sanitizeId(newStudent.email || newStudent.name)
    
    const emailKey = (newStudent.email || '').toLowerCase().trim()

    // Gerencia o Cofre de PINs
    if (emailKey && !isVisitor && payload.pin) {
      try {
        const vaultRef = doc(db, COLLECTIONS.COFRE_PINS, emailKey)
        await setDoc(vaultRef, { pin: payload.pin, updatedAt: serverTimestamp() }, { merge: true })
      } catch (e) {}
    }

    const targetCollection = isVisitor ? VISITORS_COLLECTION : USERS_COLLECTION
    await setDoc(doc(db, targetCollection, docId), payload)

    // 🔐 CRIAÇÃO DE AUTH (SSoT): Apenas para Alunos Reais
    if (!isVisitor && emailKey) {
      try {
        const pinAuthEmail = getPinAuthEmail(emailKey)
        const securePIN = pin.length >= 6 ? pin : pin.padEnd(6, '0')
        await createUserWithEmailAndPassword(vAuth, pinAuthEmail, securePIN)
        console.log(`🔐 Academy Auth: Conta criada para ${emailKey} com sucesso.`)
      } catch (e) {
        if (e.code === 'auth/email-already-in-use') {
          console.warn('⚠️ Aluno já possui conta de autenticação.')
        } else {
          console.error('❌ Erro ao criar Auth Secundário:', e.message)
        }
      }
    }

    // Subcoleções apenas para Alunos
    if (!isVisitor) {
      const visitorSubRef = collection(doc(db, targetCollection, docId), 'visitantes')
      await addDoc(visitorSubRef, { data: serverTimestamp(), tipo: 'entrada', observacao: 'Cadastro inicial' })

      // Faturamento Inicial
      if (newStudent.initialPaymentStatus && payload.planValue > 0) {
        try {
          await addDoc(collection(db, COLLECTIONS.FATURAMENTO), {
            studentId: docId,
            studentName: payload.name,
            amount: Number(payload.planValue),
            status: newStudent.initialPaymentStatus,
            dueDate: new Date().toISOString().split('T')[0],
            referenceMonth: `${new Date().toLocaleString('pt-BR', { month: 'long' })} / ${new Date().getFullYear()}`,
            createdAt: serverTimestamp()
          })
        } catch (err) {}
      }
    }
  }, [])

  /**
   * Atualiza dados cadastrais do perfil.
   */
  const updateStudentProfile = useCallback(async (id, updates) => {
    setIsUpdating(true)
    try {
      const student = (students || []).find(s => s.id === id)
      const collectionName = student?.isVisitor ? VISITORS_COLLECTION : USERS_COLLECTION
      
      const payload = {
        ...updates,
        [FIELDS.ATUALIZADO_EM]: serverTimestamp(),
      }
      
      if (payload.name) {
        payload[FIELDS.NOME] = sanitizeString(payload.name)
        payload.initials = buildInitials(payload.name)
      }
      if (payload.email) payload[FIELDS.EMAIL] = payload.email.toLowerCase().trim()

      await updateDoc(doc(db, collectionName, id), payload)
    } catch (err) {
      console.error('Erro ao atualizar:', err)
      throw err
    } finally {
      setIsUpdating(false)
    }
  }, [students])

  /**
   * Remove um visitante da coleção de leads.
   */
  const deleteVisitor = useCallback(async (visitorId) => {
    try {
      await deleteDoc(doc(db, VISITORS_COLLECTION, visitorId))
      return true
    } catch (err) {
      throw err
    }
  }, [])

  return {
    students,
    isLoadingStudents,
    updateStudentStatus,
    changeStudentStatus,
    deleteStudent,
    deleteVisitor,
    addStudent,
    updateStudentProfile,
  }
}

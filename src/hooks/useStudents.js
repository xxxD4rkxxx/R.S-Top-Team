/**
 * Hook para gerenciar as operações de Alunos na arquitetura unificada.
 * Agora todas as mutações são direcionadas para a coleção 'users' com o papel 'aluno'.
 */
import { useState, useCallback } from 'react'
import { db } from '../firebase/config'
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
  getDoc
} from 'firebase/firestore'
import { COLLECTIONS, FIELDS } from '../firebase/collections'
import { useStudentsContext } from '../context/StudentsContext'
import { sanitizeString } from '../utils/security'

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
    const collectionName = student?.roles?.visitante ? VISITORS_COLLECTION : USERS_COLLECTION
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

    const collectionName = student?.roles?.visitante ? VISITORS_COLLECTION : USERS_COLLECTION
    await updateDoc(doc(db, collectionName, id), payload)
  }, [students])

  /**
   * Remove permanentemente o aluno de todas as coleções do Firebase.
   */
  const deleteStudent = useCallback(async (studentId) => {
    if (!studentId) return

    const target = students.find(s => s.id === studentId)
    const email = target?.email

    try {
      const collectionName = target?.roles?.visitante ? VISITORS_COLLECTION : USERS_COLLECTION
      await deleteDoc(doc(db, collectionName, studentId))
      
      // Background Cleanup for legacy
      const bgCleanup = async () => {
        if (email) {
          const cleanEmail = email.toLowerCase().trim()
          const legacyRefs = [
            doc(db, 'users', cleanEmail),
            doc(db, 'students', cleanEmail),
            doc(db, 'equipe', cleanEmail)
          ]
          for (const ref of legacyRefs) {
            try { await deleteDoc(ref) } catch (e) {}
          }
        }
      }
      bgCleanup()
    } catch (e) {
      console.error('Erro ao deletar:', e)
      throw e
    }
  }, [students])

  /**
   * ADICIONAR NOVO ALUNO / VISITANTE
   */
  const addStudent = useCallback(async (newStudent, modality, options = {}) => {
    const { isVisitor = false, belt = 'white' } = options

    // Normalização de modalidades
    let finalModalities = Array.isArray(modality) ? modality : [modality || 'Jiu Jitsu']
    if (finalModalities.length === 0) finalModalities = ['Jiu Jitsu']

    const beltFinal = finalModalities.some(m => m.toLowerCase().includes('jiu')) ? (belt || 'white') : 'none'

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
      [FIELDS.STATUS]: 'Ativo',
      status: 'Ativo',
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
      [FIELDS.PIN]: newStudent.pin || null,
      pin: newStudent.pin || null,
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
    setIsLoadingStudents(true)
    try {
      const student = students.find(s => s.id === id)
      const collectionName = student?.roles?.visitante ? VISITORS_COLLECTION : USERS_COLLECTION
      
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
      setIsLoadingStudents(false)
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

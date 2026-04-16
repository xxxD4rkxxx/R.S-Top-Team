/**
 * Hook para gerenciar as operações de Alunos na arquitetura unificada.
 * Agora todas as mutações são direcionadas para a coleção 'users' com o papel 'aluno'.
 */
import { useState } from 'react'
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
  getDocs
} from 'firebase/firestore'
import { db, auth } from '../firebase/config'
import { updatePassword } from 'firebase/auth'
import { useStudentsContext } from '../context/StudentsContext'

// Nome da coleção unificada
const USERS_COLLECTION = 'users'

/**
 * Normaliza o ID do usuário (E-mail ou Nome sanitizado).
 */
const sanitizeId = (identifier) => {
  if (!identifier) return 'student_' + Math.random().toString(36).substring(7)
  const safeId = identifier.toLowerCase().trim()
    .replace(/[@.]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
  
  return `${safeId}@rstopteam.internal`
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
  // Obtém a lista de alunos filtrada do contexto global (que já lê da coleção 'users')
  const { students, isLoadingStudents } = useStudentsContext()
  const [isUpdating, setIsUpdating] = useState(false)

  /**
   * Atualiza o status de presença rápida do aluno (Marcando presença no dia).
   */
  async function updateStudentStatus(id, newStatus) {
    const student = students.find(s => s.id === id)
    const payload = {
      status: newStatus ?? null,
      lastStatusAt: serverTimestamp(),
    }

    if (newStatus === 'present') {
      payload.lastAttendanceAt = serverTimestamp()
    }

    // Atualiza o documento na coleção unificada 'users'
    await updateDoc(doc(db, USERS_COLLECTION, id), payload)

    // Registra no histórico de chamadas (coleção separada para relatórios)
    if (newStatus) {
      await addDoc(collection(db, 'attendance'), {
        studentId: id,
        studentName: student?.name || id,
        date: serverTimestamp(),
        status: newStatus,
        modality: student?.modality || 'Jiu Jitsu'
      })
    }
  }

  /**
   * Altera o status administrativo do aluno (Ativo, Inativo, Suspenso).
   */
  async function changeStudentStatus(id, newStatus, extra = {}) {
    const payload = {
      status: newStatus,
      lastStatusAt: serverTimestamp(),
    }
    if (extra.reason !== undefined) payload.statusReason = extra.reason
    if (extra.returnDate !== undefined) payload.statusReturnDate = extra.returnDate

    await updateDoc(doc(db, USERS_COLLECTION, id), payload)
  }

  /**
   * Remove permanentemente o aluno de todas as coleções do Firebase.
   * Hardened para evitar a "ressurreição" de dados legados.
   */
  async function deleteStudent(studentId) {
    if (!studentId) {
      console.error('❌ Erro: Tentativa de deletar aluno sem ID válido.')
      return
    }

    console.log('🗑️ Iniciando Deleção Exhaustiva do Aluno:', studentId)
    
    // 1. Localizar o aluno no nosso estado para obter dados extras (e-mail)
    const target = students.find(s => s.id === studentId)
    const email = target?.email || (studentId.includes('@') ? studentId : null)
    
    // A. Deleção Primária (Imediata)
    try {
      await Promise.all([
        deleteDoc(doc(db, 'users', studentId)),
        deleteDoc(doc(db, 'users', studentId, 'privacy', 'secrets'))
      ])
    } catch (e) {
      console.error('Falha na deleção principal:', e)
      throw e
    }

    // B. Limpeza de Legados em Background (Non-blocking)
    const bgCleanup = async () => {
      const tasks = []
      
      if (email) {
        const cleanEmail = email.toLowerCase().trim()
        tasks.push(deleteDoc(doc(db, 'users', cleanEmail)))
        tasks.push(deleteDoc(doc(db, 'users', cleanEmail, 'privacy', 'secrets')))
        tasks.push(deleteDoc(doc(db, 'students', cleanEmail)))
        tasks.push(deleteDoc(doc(db, 'students', cleanEmail, 'privacy', 'secrets')))
        tasks.push(deleteDoc(doc(db, 'equipe', cleanEmail)))
        tasks.push(deleteDoc(doc(db, 'equipe', cleanEmail, 'privacy', 'secrets')))
        
        try {
          const qStudents = query(collection(db, 'students'), where('email', '==', cleanEmail))
          const qEquipe = query(collection(db, 'equipe'), where('email', '==', cleanEmail))
          
          const [snapS, snapE] = await Promise.all([getDocs(qStudents), getDocs(qEquipe)])
          snapS.forEach(d => tasks.push(deleteDoc(d.ref)))
          snapE.forEach(d => tasks.push(deleteDoc(d.ref)))
        } catch (e) {
          console.warn('Erro na busca de legados:', e)
        }
      }

      if (target?.name) {
        tasks.push(deleteDoc(doc(db, 'students', target.name)))
        tasks.push(deleteDoc(doc(db, 'students', target.name, 'privacy', 'secrets')))
      }

      await Promise.allSettled(tasks)
      console.log('Background cleanup finished for student:', studentId)
    }

    bgCleanup()
  }

  /**
   * ADICIONAR NOVO ALUNO
   * 🎯 Agora cria o documento na coleção 'users' com 'roles.aluno: true'.
   */
  async function addStudent(newStudent, modality, options = {}) {
    const { isVisitor = false, belt = 'white' } = options
    
    // Normalização de modalidades
    let finalModalities = []
    if (Array.isArray(modality)) {
      finalModalities = modality
    } else {
      const normalized = (modality || 'Jiu Jitsu').toLowerCase()
      finalModalities = normalized === 'ambos' ? ['Jiu Jitsu', 'Boxe'] : [normalized === 'boxe' ? 'Boxe' : 'Jiu Jitsu']
    }

    // Lógica de faixa padrão
    const hasBJJ = finalModalities.some(m => m.toLowerCase().includes('jiu') || m.toLowerCase().includes('bjj'))
    const beltFinal = hasBJJ ? (belt || 'white') : 'none'

    const payload = {
      name: newStudent.name,
      initials: buildInitials(newStudent.name),
      belt: beltFinal,
      modality: finalModalities[0] || 'Jiu Jitsu',
      modalities: finalModalities,
      stripes: 0,
      status: 'Ativo',
      isVisitor,
      photo: null,
      email: newStudent.email || '',
      phone: newStudent.phone || '',
      emergency: newStudent.emergency || '',
      medical: newStudent.medical || '',
      ageCategory: newStudent.ageCategory || 'Adulto',
      gender: newStudent.gender || 'Masculino',
      parentName: newStudent.parentName || '',
      parentPhone: newStudent.parentPhone || '',
      isPaymentExempt: newStudent.isPaymentExempt || false,
      planValue: newStudent.planValue || '',
      pin: newStudent.pin || Math.floor(100000 + Math.random() * 900000).toString(),
      roles: isVisitor ? { visitante: true } : { aluno: true }, // Define o papel baseado no tipo de ingresso
      tech_journey: {
        current_belt: beltFinal,
        current_stripes: 0,
        sessions_since_last_promotion: 0,
        last_promotion_date: serverTimestamp(),
        history: [{
          belt: beltFinal,
          date: new Date(),
          reason: 'Ingresso na Academia'
        }]
      },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    // Define o ID do documento baseado no e-mail (se existir) ou nome usando a identidade unificada
    const docId = sanitizeId(newStudent.email || newStudent.name)
    await setDoc(doc(db, USERS_COLLECTION, docId), payload)
  }

  /**
   * Atualiza dados cadastrais do perfil.
   */
  async function updateStudentProfile(id, data) {
    const payload = { updatedAt: serverTimestamp() }
    
    if (data.name !== undefined) {
      payload.name = data.name
      payload.initials = buildInitials(data.name)
    }
    
    // Mapeamento de campos permitidos para atualização
    const updatableFields = [
      'belt', 'stripes', 'email', 'phone', 'emergency', 'medical', 
      'birthday', 'medicalExamDate', 'ageCategory', 'gender', 
      'parentName', 'parentPhone', 'pin', 'modality', 'modalities',
      'isPaymentExempt', 'planValue'
    ]

    updatableFields.forEach(field => {
      if (data[field] !== undefined) payload[field] = data[field]
    })

    // 🔐 SINCRONIZAÇÃO DE SEGURANÇA: Se o próprio aluno estiver alterando o PIN
    if (data.pin !== undefined && auth.currentUser) {
      const emailId = id.includes('@') ? id : (data.email || '')
      if (auth.currentUser.email === emailId.toLowerCase().trim()) {
        try {
          const securePIN = data.pin.length >= 6 ? data.pin : data.pin.padEnd(6, '0')
          await updatePassword(auth.currentUser, securePIN)
          console.log('✅ PIN do Aluno sincronizado no Authentication.')
        } catch (e) {
          console.warn('⚠️ Sincronização direta falhou. O sistema JIT resolverá no próximo login.')
        }
      }
    }

    await updateDoc(doc(db, USERS_COLLECTION, id), payload)
  }

  return {
    students,
    isLoadingStudents,
    isLoading: isLoadingStudents,
    updateStudentStatus,
    changeStudentStatus,
    deleteStudent,
    addStudent,
    updateStudentProfile,
  }
}


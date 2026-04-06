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
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useStudentsContext } from '../context/StudentsContext'

// Nome da coleção unificada
const USERS_COLLECTION = 'users'

/**
 * Normaliza o ID do usuário (E-mail ou Nome sanitizado).
 */
const sanitizeId = (identifier) => {
  if (!identifier) return 'student_' + Math.random().toString(36).substring(7)
  return identifier.toLowerCase().trim().replace(/[@.]/g, '_').replace(/\//g, '-')
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
        modality: student?.modality || 'Jiu-Jitsu'
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
   * Remove permanentemente o registro do usuário (Cuidado: remove todas as roles).
   */
  async function deleteStudent(id) {
    await deleteDoc(doc(db, USERS_COLLECTION, id))
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
      const normalized = (modality || 'Jiu-Jitsu').toLowerCase()
      finalModalities = normalized === 'ambos' ? ['Jiu-Jitsu', 'Boxe'] : [normalized === 'boxe' ? 'Boxe' : 'Jiu-Jitsu']
    }

    // Lógica de faixa padrão
    const hasBJJ = finalModalities.some(m => m.toLowerCase().includes('jiu') || m.toLowerCase().includes('bjj'))
    const beltFinal = hasBJJ ? (belt || 'white') : 'none'

    const payload = {
      name: newStudent.name,
      initials: buildInitials(newStudent.name),
      belt: beltFinal,
      modality: finalModalities[0] || 'Jiu-Jitsu',
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
      pin: newStudent.pin || Math.floor(100000 + Math.random() * 900000).toString(),
      roles: isVisitor ? { visitante: true } : { aluno: true }, // Define o papel baseado no tipo de ingresso
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }

    // Define o ID do documento baseado no e-mail (se existir) ou nome
    const docId = newStudent.email ? newStudent.email.toLowerCase().trim() : sanitizeId(newStudent.name)
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
      'parentName', 'parentPhone', 'pin'
    ]

    updatableFields.forEach(field => {
      if (data[field] !== undefined) payload[field] = data[field]
    })

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


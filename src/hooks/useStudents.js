// Resumo: hook para carregar, adicionar e atualizar alunos no Firestore; converte datas e trata iniciais.
import { useEffect, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  setDoc,
} from 'firebase/firestore'
import { db } from '../firebase/config'

const sanitizeId = (name) => {
  if (!name) return 'unknown_' + Math.random().toString(36).substring(7)
  return name.replace(/\//g, '-').trim()
}

function buildInitials(name) {
  return (name || '')
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function parseFirestoreDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function useStudents() {
  const [students, setStudents] = useState([])
  const [isLoadingStudents, setIsLoadingStudents] = useState(true)

  useEffect(() => {
    const studentsRef = collection(db, 'students')
    const studentsQuery = query(studentsRef, orderBy('createdAt', 'asc'))

    const unsubscribe = onSnapshot(
      studentsQuery,
      snapshot => {
        const fromDb = snapshot.docs.map(item => {
          const data = item.data()
          const modalities = data.modalities || [data.modality || 'Jiu-Jitsu']
          return {
            id: item.id,
            name: data.name || '',
            initials: data.initials || buildInitials(data.name),
            belt: data.belt || 'white',
            modality: data.modality || modalities[0] || 'Jiu-Jitsu',
            modalities,
            modalityPrimary: modalities[0] || data.modality || 'Jiu-Jitsu',
            stripes: Number.isFinite(data.stripes) ? data.stripes : 0,
            pin: data.pin || '',
            status: data.status ?? null,
            isVisitor: Boolean(data.isVisitor),
            photo: data.photo || null,
            email: data.email || '',
            phone: data.phone || '',
            emergency: data.emergency || '',
            medical: data.medical || '',
            birthday: parseFirestoreDate(data.birthday),
            medicalExamDate: parseFirestoreDate(data.medicalExamDate),
            ageCategory: data.ageCategory || 'Adulto',
            gender: data.gender || 'Masculino',
            parentName: data.parentName || '',
            parentPhone: data.parentPhone || '',
            createdAt: parseFirestoreDate(data.createdAt),
            lastAttendanceAt: parseFirestoreDate(data.lastAttendanceAt),
            lastStatusAt: parseFirestoreDate(data.lastStatusAt),
            statusReason: data.statusReason || '',
            statusReturnDate: data.statusReturnDate || '',
          }
        })

        setStudents(fromDb)
        setIsLoadingStudents(false)
      },
      error => {
        console.error('Erro ao carregar alunos do Firestore:', error)
        setIsLoadingStudents(false)
      },
    )

    return () => unsubscribe()
  }, [])

  async function updateStudentStatus(id, newStatus) {
    const student = students.find(s => s.id === id)
    const payload = {
      status: newStatus ?? null,
      lastStatusAt: serverTimestamp(),
    }

    if (newStatus === 'present') {
      payload.lastAttendanceAt = serverTimestamp()
    }

    // Update student document
    await updateDoc(doc(db, 'students', id), payload)

    // Log to attendance history if status changed to a valid state
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
   * Altera o status do aluno (ativo, inativo, suspenso, arquivado)
   */
  async function changeStudentStatus(id, newStatus, extra = {}) {
    const payload = {
      status: newStatus,
      lastStatusAt: serverTimestamp(),
    }
    if (extra.reason !== undefined) payload.statusReason = extra.reason
    if (extra.returnDate !== undefined) payload.statusReturnDate = extra.returnDate

    await updateDoc(doc(db, 'students', id), payload)
  }

  /**
   * Remove permanentemente o aluno do Firestore
   */
  async function deleteStudent(id) {
    await deleteDoc(doc(db, 'students', id))
  }

  async function addStudent(newStudent, modality, options = {}) {
    const { isVisitor = false, belt = 'white' } = options
    const normalized = (modality || 'Jiu-Jitsu').toLowerCase()
    const modalities = normalized === 'ambos' ? ['Jiu-Jitsu', 'Boxe'] : [normalized === 'boxe' ? 'Boxe' : 'Jiu-Jitsu']

    const beltFinal = modalities.length === 1 && modalities[0] === 'Boxe' ? 'none' : belt || 'white'

    const payload = {
      name: newStudent.name,
      initials: buildInitials(newStudent.name),
      belt: beltFinal,
      modality: modalities[0],
      modalities,
      stripes: 0,
      status: null,
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
      pin: Math.floor(100000 + Math.random() * 900000).toString(),
      createdAt: serverTimestamp(),
    }

    const nameId = sanitizeId(newStudent.name)
    await setDoc(doc(db, 'students', nameId), payload)
  }

  async function updateStudentProfile(id, data) {
    const payload = {}
    if (data.name !== undefined) {
      payload.name = data.name
      payload.initials = buildInitials(data.name)
    }
    if (data.belt !== undefined) payload.belt = data.belt
    if (data.stripes !== undefined) payload.stripes = Number(data.stripes)
    if (data.email !== undefined) payload.email = data.email
    if (data.phone !== undefined) payload.phone = data.phone
    if (data.emergency !== undefined) payload.emergency = data.emergency
    if (data.medical !== undefined) payload.medical = data.medical
    if (data.birthday !== undefined) payload.birthday = data.birthday
    if (data.medicalExamDate !== undefined) payload.medicalExamDate = data.medicalExamDate
    if (data.ageCategory !== undefined) payload.ageCategory = data.ageCategory
    if (data.gender !== undefined) payload.gender = data.gender
    if (data.parentName !== undefined) payload.parentName = data.parentName
    if (data.parentPhone !== undefined) payload.parentPhone = data.parentPhone

    await updateDoc(doc(db, 'students', id), payload)
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

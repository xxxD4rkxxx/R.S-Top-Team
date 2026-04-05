import React, { createContext, useContext, useState, useEffect } from 'react'
import {
  collection,
  onSnapshot,
  orderBy,
  query
} from 'firebase/firestore'
import { db } from '../firebase/config'

const StudentsContext = createContext()

function buildInitials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
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

export function StudentsProvider({ children }) {
  const [students, setStudents] = useState([])
  const [isLoadingStudents, setIsLoadingStudents] = useState(true)

  useEffect(() => {
    // Escuta global única para todos os alunos
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
        console.error('Erro ao carregar alunos (Context):', error)
        setIsLoadingStudents(false)
      }
    )

    return () => unsubscribe()
  }, [])

  return (
    <StudentsContext.Provider value={{ students, isLoadingStudents }}>
      {children}
    </StudentsContext.Provider>
  )
}

export const useStudentsContext = () => {
  const context = useContext(StudentsContext)
  if (!context) {
    throw new Error('useStudentsContext deve ser usado dentro de um StudentsProvider')
  }
  return context
}

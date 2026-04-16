/**
 * Provedor de Contexto para Alunos (Arquitetura Unificada)
 * 
 * Este contexto mantém uma escuta em tempo real (onSnapshot) de todos os usuários
 * que possuem o papel 'aluno' ativo no sistema.
 */
import React, { createContext, useContext, useState, useEffect } from 'react'
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from './AuthContext'

const StudentsContext = createContext()

/**
 * Gera as iniciais do nome para exibição quando não há foto.
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

/**
 * Utilitário para converter Timestamps do Firestore ou Strings ISO em objetos Date.
 */
function parseFirestoreDate(value) {
  if (!value) return null
  if (typeof value.toDate === 'function') return value.toDate()
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}
export function StudentsProvider({ children }) {
  const [students, setStudents] = useState([])
  const [isLoadingStudents, setIsLoadingStudents] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    // 🛡️ PROTEÇÃO: Só iniciamos a escuta se houver um utilizador autenticado.
    // Isso evita erros de "Permission Denied" na tela de login.
    if (!user) {
      setStudents([])
      setIsLoadingStudents(false)
      return
    }

    const usersRef = collection(db, 'users')
    const studentsQuery = query(
      usersRef, 
      where('roles.aluno', '==', true)
    )

    const unsubscribe = onSnapshot(
      studentsQuery,
      snapshot => {
        const fromDb = snapshot.docs.map(item => {
          const data = item.data()
          const modalities = data.modalities || [data.modality || 'Jiu Jitsu']
          
          return {
            id: item.id,
            name: data.name || '',
            initials: data.initials || buildInitials(data.name),
            belt: data.belt || 'white',
            modality: data.modality || modalities[0] || 'Jiu Jitsu',
            modalities,
            modalityPrimary: modalities[0] || data.modality || 'Jiu Jitsu',
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
            roles: data.roles || {}
          }
        })
        
        const sorted = fromDb.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
        setStudents(sorted)
        setIsLoadingStudents(false)
      },
      error => {
        console.error('Erro ao carregar alunos unificados (Context):', error)
        setIsLoadingStudents(false)
      }
    )

    return () => unsubscribe()
  }, [user])

  return (
    <StudentsContext.Provider value={{ students, isLoadingStudents }}>
      {children}
    </StudentsContext.Provider>
  )
}

/**
 * Hook customizado para consumir o contexto de alunos.
 */
export const useStudentsContext = () => {
  const context = useContext(StudentsContext)
  if (!context) {
    throw new Error('useStudentsContext deve ser usado dentro de um StudentsProvider')
  }
  return context
}


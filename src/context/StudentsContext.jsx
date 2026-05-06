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
  const [rawUsers, setRawUsers] = useState([])
  const [rawVisitors, setRawVisitors] = useState([])
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

    const usersRef = collection(db, 'usuarios')
    const visitorsRef = collection(db, 'visitantes')

    // Função para mapear documentos (DRY)
    const mapDoc = (item, isVisitorForce = false) => {
      const data = item.data()
      const modalities = data.modalities || [data.modality || 'Jiu Jitsu']
      
      let rawName = data.name || data.nome || ''
      const cleanName = rawName.toLowerCase().trim()
      if (!rawName || cleanName === 'undefined' || cleanName === 'null' || cleanName.includes('indefin')) {
        rawName = 'Pessoa'
      }

      let photo = data.photo || null
      if (photo === 'undefined' || photo === 'null' || (typeof photo === 'string' && photo.includes('undefined'))) {
        photo = null
      }
      
      const tech = data.jornada_tecnica || {}
      
      return {
        id: item.id,
        name: rawName,
        initials: data.initials || buildInitials(rawName),
        belt: (tech.faixa_atual || data.belt || data.faixa || 'none').toLowerCase(),
        modality: data.modality || modalities[0] || 'Jiu Jitsu',
        modalities,
        modalityPrimary: modalities[0] || data.modality || 'Jiu Jitsu',
        stripes: Number.isFinite(tech.graus_atuais) ? tech.graus_atuais : (Number.isFinite(data.stripes) ? data.stripes : 0),
        pin: data.pin || '',
        gender: data.gender || '',
        status: data.status ?? 'Ativo',
        isVisitor: isVisitorForce || Boolean(data.isVisitor) || Boolean(data.roles?.visitante),
        photo: photo,
        email: data.email || '',
        phone: data.phone || data.telefone || '',
        emergency: data.emergency || '',
        medical: data.medical || '',
        birthday: parseFirestoreDate(data.birthday),
        createdAt: parseFirestoreDate(data.createdAt || data.criadoEm),
        lastAttendanceAt: parseFirestoreDate(data.lastAttendanceAt),
        roles: data.roles || data.papeis || {},
        turmas: data.turmas || []
      }
    }

    // Escuta Alunos/Professores
    const unsubUsers = onSnapshot(usersRef, snapshot => {
      const usersData = snapshot.docs.map(d => mapDoc(d))
      setRawUsers(usersData)
    }, (err) => {
      console.error("❌ Erro ao escutar 'usuarios' no StudentsContext:", err)
      setRawUsers([])
    })

    // Escuta Visitantes (Leads)
    const unsubVisitors = onSnapshot(visitorsRef, snapshot => {
      const visitorsData = snapshot.docs.map(d => mapDoc(d, true))
      setRawVisitors(visitorsData)
    }, (err) => {
      console.error("❌ Erro ao escutar 'visitantes' no StudentsContext:", err)
      setRawVisitors([])
    })

    return () => {
      unsubUsers()
      unsubVisitors()
    }
  }, [user])

  // Consolidação dos dados
  useEffect(() => {
    const combined = [...rawUsers, ...rawVisitors]
    const sorted = combined.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    
    console.log(`👥 [StudentsContext] Sincronização concluída: ${rawUsers.length} usuários, ${rawVisitors.length} visitantes. Total: ${combined.length}`)
    
    setStudents(sorted)
    setIsLoadingStudents(false)
  }, [rawUsers, rawVisitors])

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


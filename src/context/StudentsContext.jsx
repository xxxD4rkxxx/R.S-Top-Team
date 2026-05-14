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
  const [rawAlunos, setRawAlunos] = useState([])
  const [rawStudents, setRawStudents] = useState([])
  const [rawUsersOld, setRawUsersOld] = useState([]) // 🔥 Adicionado para a coleção 'users'
  const [rawVisitors, setRawVisitors] = useState([])
  const [isLoadingStudents, setIsLoadingStudents] = useState(true)
  const { user } = useAuth()

  useEffect(() => {
    if (!user) {
      setStudents([])
      setIsLoadingStudents(false)
      return
    }

    // Todas as coleções possíveis onde os alunos podem estar
    const refs = {
      usuarios: collection(db, 'usuarios'),
      alunos: collection(db, 'alunos'),
      students: collection(db, 'students'),
      users: collection(db, 'users'), // 🔥 A coleção que faltava
      visitantes: collection(db, 'visitantes')
    }

    const mapDoc = (item, collectionName, isVisitorForce = false) => {
      try {
        const data = item.data()
        
        // 🛡️ Captura Flexível de Modalidades (Suporta pt-BR e en-US)
        const rawModalities = data.modalities || data.modalidades || []
        const rawModality = data.modality || data.modalidade || null
        const modalities = Array.isArray(rawModalities) ? rawModalities : (rawModality ? [rawModality] : [])
        if (modalities.length === 0 && rawModality) modalities.push(rawModality)

        let rawName = data.nome || data.name || 'Sem Nome'
        const tech = data.jornada_tecnica || {}
        const roles = data.roles || data.papeis || {}
        
        return {
          id: item.id,
          name: rawName,
          initials: data.initials || buildInitials(rawName),
          belt: (tech.faixa_atual || data.belt || data.faixa || 'none').toLowerCase(),
          modality: rawModality || modalities[0] || null,
          modalities,
          stripes: Number(tech.graus_atuais || data.stripes || 0),
          pin: data.pin || '',
          status: String(data.status || 'Ativo').toLowerCase(),
          isVisitor: isVisitorForce || Boolean(data.isVisitor) || Boolean(roles.visitante) || Boolean(roles.papeis?.visitante),
          photo: data.photo || null,
          email: data.email || '',
          phone: data.phone || data.telefone || data.whatsapp || '',
          data: data.data || null,
          createdAt: parseFirestoreDate(data.createdAt || data.criadoEm || data.criado_em),
          roles,
          turmas: data.turmas || [],
          collectionName
        }
      } catch (e) {
        console.error("❌ Erro ao mapear aluno:", item.id, e)
        return { id: item.id, name: 'Erro no mapeamento', status: 'inativo' }
      }
    }

    const unsub1 = onSnapshot(refs.usuarios, snap => setRawUsers(snap.docs.map(d => mapDoc(d, 'usuarios'))), err => console.warn("usuarios off"))
    const unsub2 = onSnapshot(refs.alunos, snap => setRawAlunos(snap.docs.map(d => mapDoc(d, 'alunos'))), err => console.warn("alunos off"))
    const unsub3 = onSnapshot(refs.students, snap => setRawStudents(snap.docs.map(d => mapDoc(d, 'students'))), err => console.warn("students off"))
    const unsub4 = onSnapshot(refs.users, snap => setRawUsersOld(snap.docs.map(d => mapDoc(d, 'users'))), err => console.warn("users off"))
    const unsub5 = onSnapshot(refs.visitantes, snap => setRawVisitors(snap.docs.map(d => mapDoc(d, 'visitantes', true))), err => console.warn("visitantes off"))

    return () => {
      unsub1(); unsub2(); unsub3(); unsub4(); unsub5();
    }
  }, [user])

  useEffect(() => {
    const combined = [...rawUsers, ...rawAlunos, ...rawStudents, ...rawUsersOld, ...rawVisitors]
    const uniqueMap = new Map()
    combined.forEach(s => {
      if (s.id && !uniqueMap.has(s.id)) uniqueMap.set(s.id, s)
    })
    
    const finalData = Array.from(uniqueMap.values())
    const sorted = finalData.sort((a, b) => (a.name || '').localeCompare(b.name || ''))
    
    const names = finalData.map(s => s.name).join(', ')
    console.log(`👥 [Context] FINAL: ${finalData.length} registros únicos. Nomes: [${names}]`)
    
    setStudents(sorted)
    setIsLoadingStudents(false)
  }, [rawUsers, rawAlunos, rawStudents, rawUsersOld, rawVisitors])

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


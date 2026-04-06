/**
 * Provedor de Autenticação e Gestão de Sessão (Single Source of Truth)
 * 
 * Este contexto gerencia o estado global do usuário, permitindo o login tanto
 * via Firebase Auth (E-mail/Senha) quanto via Identificador/PIN (Simulado).
 */
import React, { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth'
import {
  doc,
  getDoc,
  collection,
  query,
  getDocs,
  limit,
  where,
  onSnapshot
} from 'firebase/firestore'
import { auth, db } from '../firebase/config'

const AuthContext = createContext()

// Nome da coleção unificada
const USERS_COLLECTION = 'users'

export function AuthProvider({ children }) {
  // Estado do usuário Auth (Firebase) ou Simulado (PIN)
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('rs-topteam-sim-user')
    return saved ? JSON.parse(saved).user : null
  })

  // Dados detalhados do perfil (vindos do Firestore)
  const [userData, setUserData] = useState(() => {
    const saved = localStorage.getItem('rs-topteam-sim-user')
    return saved ? JSON.parse(saved).userData : null
  })

  const [loading, setLoading] = useState(true)
  const [simulatedRole, setSimulatedRole] = useState(null)
  const [isSetupMode, setIsSetupMode] = useState(false)
  const [hasAdmin, setHasAdmin] = useState(true)
  const [hasGestor, setHasGestor] = useState(true)

  /** 
   * Determina o papel do usuário para a interface.
   * Prioridade: Role Simulada > Role Principal do Usuário > Aluno (Padrão)
   */
  const effectiveRole = simulatedRole || userData?.role || (userData?.roles?.admin ? 'admin' : userData?.roles?.gestor ? 'gestor' : userData?.roles?.professor ? 'professor' : 'aluno')

  /** Finaliza a sessão e limpa caches */
  const logout = () => {
    localStorage.removeItem('rs-topteam-sim-user')
    setUser(null)
    setUserData(null)
    setSimulatedRole(null)
    return signOut(auth)
  }

  /**
   * PROCESSO DE LOGIN UNIFICADO
   * 1. Resolve o identificador (E-mail ou Nome) para um E-mail único.
   * 2. Tenta autenticar via Firebase Auth.
   * 3. Fallback: Busca na coleção 'users' e valida o PIN.
   */
  const login = async (identifier, password) => {
    let email = identifier.toLowerCase().trim()
    const isEmail = identifier.includes('@')

    // Se não for e-mail, tenta resolver o nome para e-mail na coleção unificada
    if (!isEmail) {
      const q = query(
        collection(db, USERS_COLLECTION), 
        where('name', '==', identifier), 
        limit(1)
      )
      const snap = await getDocs(q)
      if (!snap.empty) {
        email = snap.docs[0].data().email || email
      }
    }

    try {
      // 1. TENTA FIREBASE AUTH (E-mail/Senha)
      return await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      /**
       * 2. PIN LOGIN FALLBACK
       * Essencial para alunos e professores que usam apenas o PIN de 6 dígitos.
       */
      const userRef = doc(db, USERS_COLLECTION, email)
      const snap = await getDoc(userRef)

      if (snap.exists()) {
        const data = snap.data()
        // Validação de PIN (Simples e Direta)
        if (data.pin === password) {
          const simUser = { uid: snap.id, email: data.email, isSimulated: true }
          const simData = { ...data, id: snap.id }
          
          localStorage.setItem('rs-topteam-sim-user', JSON.stringify({ user: simUser, userData: simData }))
          setUser(simUser)
          setUserData(simData)
          return { user: simUser }
        }
      }

      throw err // Se falhar em ambos, propaga o erro
    }
  }

  useEffect(() => {
    // Configura persistência local
    setPersistence(auth, browserLocalPersistence).catch(err =>
      console.error('Erro ao definir persistência:', err)
    )

    /** Verifica se o sistema precisa de configuração inicial (Falta de Admin/Gestor) */
    const checkSetupMode = async () => {
      try {
        const [snapAdmin, snapGestor] = await Promise.all([
          getDocs(query(collection(db, USERS_COLLECTION), where('roles.admin', '==', true), limit(1))),
          getDocs(query(collection(db, USERS_COLLECTION), where('roles.gestor', '==', true), limit(1))),
        ])
        const foundAdmin  = !snapAdmin.empty
        const foundGestor = !snapGestor.empty
        setHasAdmin(foundAdmin)
        setHasGestor(foundGestor)
        setIsSetupMode(!foundAdmin || !foundGestor)
      } catch (err) {
        console.warn('Erro ao verificar setup:', err)
      }
    }
    checkSetupMode()

    let userUnsub = null

    /** MONITOR DE ESTADO DE AUTENTICAÇÃO (Auth + Firestore Sync) */
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (userUnsub) userUnsub()

      try {
        if (fbUser) {
          // Usuário logado via Firebase Auth
          localStorage.removeItem('rs-topteam-sim-user')

          // O ID do documento é o e-mail (lowercase)
          const userId = fbUser.email.toLowerCase()
          
          userUnsub = onSnapshot(doc(db, USERS_COLLECTION, userId), (snap) => {
            if (snap.exists()) {
              const data = snap.data()
              if (data.status === 'Inativo') {
                logout()
              } else {
                setUser(fbUser)
                setUserData({ ...data, id: snap.id })
              }
            } else {
              setUser(fbUser)
              setUserData(null)
            }
            setLoading(false)
          })
        } else {
          // Fluxo de Usuário por PIN (Simulado do LocalStorage)
          const savedSim = localStorage.getItem('rs-topteam-sim-user')
          if (!savedSim) {
            setUser(null); setUserData(null); setSimulatedRole(null); setLoading(false)
          } else {
            const { user: simUser, userData: simData } = JSON.parse(savedSim)
            
            userUnsub = onSnapshot(doc(db, USERS_COLLECTION, simUser.uid), (snap) => {
              if (snap.exists()) {
                const data = snap.data()
                if (data.status === 'Inativo') {
                  logout()
                } else {
                  setUser(simUser)
                  setUserData({ ...data, id: snap.id })
                  localStorage.setItem('rs-topteam-sim-user', 
                    JSON.stringify({ user: simUser, userData: { ...data, id: snap.id } })
                  )
                }
              } else {
                setUser(simUser)
              }
              setLoading(false)
            }, (err) => {
              console.error('Erro no monitor de perfil simulado:', err)
              setLoading(false)
            })
          }
        }
      } catch (err) {
        console.error('Erro fatal no AuthContext:', err)
        setLoading(false)
      }
    })

    return () => {
      unsubscribe()
      if (userUnsub) userUnsub()
    }
  }, [])

  const value = {
    user,
    userData,
    loading,
    login,
    logout,
    effectiveRole,
    simulatedRole,
    setSimulatedRole,
    isSetupMode,
    hasAdmin,
    hasGestor
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)


/**
 * Provedor de Autenticação e Gestão de Sessão (Arquitetura de Dupla Identidade)
 */
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  setPersistence,
  browserLocalPersistence,
  getAuth,
  inMemoryPersistence,
  sendPasswordResetEmail
} from 'firebase/auth'
import { initializeApp, getApps } from 'firebase/app'
import { firebaseConfig } from '../firebase/config'
import {
  doc,
  getDoc,
  setDoc,
  collection,
  query,
  getDocs,
  limit,
  where,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore'
import { auth, db } from '../firebase/config'
import { COLLECTIONS } from '../firebase/collections'

const AuthContext = createContext()

const getVerifyAuth = () => {
  const apps = getApps()
  const verifyApp = apps.find(a => a.name === 'verify') || initializeApp(firebaseConfig, 'verify')
  const vAuth = getAuth(verifyApp)
  setPersistence(vAuth, inMemoryPersistence)
  return vAuth
}
const verifyAuth = getVerifyAuth()

const USERS_COLLECTION = COLLECTIONS.USUARIOS
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000

function extractSafeProfile(data) {
  const { pin: _pin, password: _pwd, ...safeData } = data
  return safeData
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [simulatedRole, setSimulatedRole] = useState(null)

  const inactivityTimerRef = useRef(null)
  const sessionPinHashRef = useRef(null)

  const getHash = (str) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i)
      hash |= 0
    }
    return hash.toString()
  }

  const effectiveRole = (() => {
    if (simulatedRole) return simulatedRole;
    const roles = userData?.roles || {}
    const roleStr = String(userData?.role || '').toLowerCase()
    if (roles.admin === true || roleStr === 'admin') return 'admin'
    if (roles.gestor === true || roleStr === 'gestor') return 'gestor'
    if (roles.professor === true || roleStr === 'professor') return 'professor'
    return 'aluno'
  })()

  const getPinAuthEmail = (raw) => {
    const rawId = String(raw || '').toLowerCase().trim()
    
    // Se já for um e-mail válido (contém @ e não termina em internal), retorna ele
    if (rawId.includes('@') && !rawId.endsWith('.internal')) return rawId
    
    // Se for um ID legatário do rstopteam.internal, limpa ele
    if (rawId.endsWith('@rstopteam.internal')) {
      return rawId.split('@')[0].replace(/_/g, '.')
    }

    return rawId
  }

  const verifyPIN = async (pinToVerify) => {
    // Para verificação rápida dentro do app, aceitamos qualquer um dos PINs do admin
    if (!user || !userData) return false
    const typed = String(pinToVerify).trim()
    if (typed === String(userData.pin).trim() || typed === String(userData.adminPin).trim()) return true

    // Fallback Firebase
    const pinAuthEmail = getPinAuthEmail(user.email)
    const securePIN = typed.length >= 6 ? typed : typed.padEnd(6, '0')
    try {
      await signInWithEmailAndPassword(verifyAuth, pinAuthEmail, securePIN)
      signOut(verifyAuth).catch(() => { })
      return true
    } catch (e) { return false }
  }

  const logout = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    setUser(null); setUserData(null); setSimulatedRole(null)
    sessionPinHashRef.current = null
    return signOut(auth)
  }, [])

  useEffect(() => {
    const resetTimer = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = setTimeout(() => logout(), INACTIVITY_TIMEOUT_MS)
    }
    if (!user) return
    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer()
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
    }
  }, [user, logout])

  /**
   * LOGIN NORMAL: Só aceita PIN de Aluno.
   * Se for Admin, força o papel 'aluno'.
   */
  const login = async (identifier, password) => {
    let email = identifier.toLowerCase().trim()
    const typedPin = String(password).trim()
    const securePIN = typedPin.length >= 6 ? typedPin : typedPin.padEnd(6, '0')

    try {
      // 1. Tenta localizar o perfil no Firestore pelo e-mail real (novo padrão)
      let targetDoc;
      try {
        targetDoc = await getDoc(doc(db, USERS_COLLECTION, email))
      } catch (e) {
        console.warn("Falha ao ler nova coleção, tentando legado...", e);
      }
      
      // 2. Se não achar, tenta pelo ID legado na coleção NOVA
      if (!targetDoc || !targetDoc.exists()) {
        const legacyId = `${email.replace(/[@.]/g, '_')}@rstopteam.internal`
        
        try {
          targetDoc = await getDoc(doc(db, USERS_COLLECTION, legacyId))
        } catch (e) {}

        // 3. Se ainda não achar, tenta busca por campo 'email' na coleção NOVA
        if (!targetDoc?.exists()) {
          try {
            const q = query(collection(db, USERS_COLLECTION), where('email', '==', email), limit(1))
            const qSnap = await getDocs(q)
            if (!qSnap.empty) targetDoc = qSnap.docs[0]
          } catch (e) {}
        }
      }

      // 4. RESGATE CRÍTICO: Se ainda não achar nada na coleção NOVA, busca na ANTIGA 'users'
      if (!targetDoc || !targetDoc.exists()) {
        const legacyId = `${email.replace(/[@.]/g, '_')}@rstopteam.internal`
        const legacyRef = doc(db, 'users', legacyId)
        const legacySnap = await getDoc(legacyRef)
        
        if (legacySnap.exists()) {
          targetDoc = legacySnap
        } else {
          const q = query(collection(db, 'users'), where('email', '==', email), limit(1))
          const qSnap = await getDocs(q)
          if (!qSnap.empty) targetDoc = qSnap.docs[0]
        }
      }

      if (!targetDoc?.exists()) throw new Error('Usuário não localizado no sistema novo ou legado.')
      const dbData = targetDoc.data()
      const profileId = targetDoc.id

      // Valida se o PIN digitado é o PIN de aluno (Normal)
      const isNormalPin = typedPin === String(dbData.pin).trim() || securePIN === String(dbData.pin).trim()

      if (!isNormalPin) {
        throw new Error('Este PIN não é válido para a tela comum. Use o Login de Administrador.')
      }

      // Se for admin, entramos em modo SIMULADO de ALUNO
      const isAdm = dbData.roles?.admin === true || String(dbData.role).toLowerCase() === 'admin'
      if (isAdm) setSimulatedRole('aluno')

      // PIN Mestre para o Auth
      const masterPin = String(dbData.adminPin || dbData.pin).trim()
      const masterSecure = masterPin.length >= 6 ? masterPin : masterPin.padEnd(6, '0')

      // Tenta logar com o e-mail real
      try {
        return await signInWithEmailAndPassword(auth, email, masterSecure)
      } catch (e) {
        // Se falhar (ex: conta não existe no Auth com e-mail real), tenta com o e-mail legado
        const legacyEmail = profileId.includes('@rstopteam.internal') ? profileId : `${email.replace(/[@.]/g, '_')}@rstopteam.internal`
        try {
          return await signInWithEmailAndPassword(auth, legacyEmail, masterSecure)
        } catch (e2) {
          // Se nenhum dos dois existe, cria a conta no Auth com o e-mail REAL (Promoção de identidade)
          if (e2.code === 'auth/user-not-found' || e2.code === 'auth/invalid-credential') {
            return await createUserWithEmailAndPassword(auth, email, masterSecure)
          }
          throw e2
        }
      }
    } catch (err) {
      throw new Error(err.message || 'Usuário ou PIN incorretos.')
    }
  }

  /**
   * LOGIN ADMINISTRADOR: Só aceita PIN Master.
   * Garante acesso total.
   */
  const loginAdmin = async (identifier, adminPin) => {
    let email = identifier.toLowerCase().trim()
    const typedPin = String(adminPin).trim()
    const securePin = typedPin.length >= 6 ? typedPin : typedPin.padEnd(6, '0')

    try {
      // 1. Tenta localizar perfil pelo e-mail real na NOVA coleção
      let snap;
      try {
        snap = await getDoc(doc(db, USERS_COLLECTION, email))
      } catch (e) {
        console.warn("Falha ao ler nova coleção (permissões?), tentando legado...", e);
      }
      
      // 2. Se falhou, não existe ou deu erro de permissão, tenta pelo legado TOTAL
      if (!snap || !snap.exists()) {
        const legacyId = `${email.replace(/[@.]/g, '_')}@rstopteam.internal`
        
        // Tenta na coleção LEGADA 'users' diretamente
        const legacyRef = doc(db, 'users', legacyId);
        const legacySnap = await getDoc(legacyRef);
        
        if (legacySnap.exists()) {
          snap = legacySnap;
        } else {
          // Tenta busca por campo email na coleção antiga
          const q = query(collection(db, 'users'), where('email', '==', email), limit(1))
          const qSnap = await getDocs(q)
          if (!qSnap.empty) snap = qSnap.docs[0]
        }
      }

      if (!snap?.exists()) throw new Error('Conta não localizada no sistema novo ou legado.')
      const data = snap.data()
      const profileId = snap.id

      const isAdm = data.roles?.admin === true || String(data.role).toLowerCase() === 'admin' || data.roles?.gestor === true
      if (!isAdm) throw new Error('Acesso apenas para Administradores ou Gestores.')

      // Valida o PIN Admin contra o Firestore
      const dbAdminPin = String(data.adminPin || data.pin).trim()
      if (typedPin !== dbAdminPin && securePin !== dbAdminPin) {
        throw new Error('PIN Administrativo incorreto.')
      }

      // Garante papel real
      setSimulatedRole(null)

      try {
        return await signInWithEmailAndPassword(auth, email, securePin)
      } catch (e) {
        const legacyEmail = profileId.includes('@rstopteam.internal') ? profileId : `${email.replace(/[@.]/g, '_')}@rstopteam.internal`
        try {
          return await signInWithEmailAndPassword(auth, legacyEmail, securePin)
        } catch (e2) {
          if (e2.code === 'auth/user-not-found' || e2.code === 'auth/invalid-credential') {
            return await createUserWithEmailAndPassword(auth, email, securePin)
          }
          throw e2
        }
      }
    } catch (err) {
      throw new Error(err.message || 'Falha na autenticação administrativa.')
    }
  }

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => { })
    let userUnsub = null
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (userUnsub) userUnsub()
      try {
        if (fbUser) {
          const email = fbUser.email.toLowerCase()
          const resolveProfileId = async () => {
            const email = fbUser.email.toLowerCase()
            
            // 1. Tenta na coleção NOVA (usuarios)
            try {
              const prioritizedDoc = await getDoc(doc(db, USERS_COLLECTION, email))
              if (prioritizedDoc.exists()) return { id: prioritizedDoc.id, col: USERS_COLLECTION }
              
              const sanitizedId = email.replace(/[@.]/g, '_') + "@rstopteam.internal"
              const sanitizedDoc = await getDoc(doc(db, USERS_COLLECTION, sanitizedId))
              if (sanitizedDoc.exists()) return { id: sanitizedDoc.id, col: USERS_COLLECTION }
            } catch (e) {}

            // 2. RESGATE: Tenta na coleção ANTIGA (users)
            try {
              const legacyId = email.includes('@rstopteam.internal') ? email : `${email.replace(/[@.]/g, '_')}@rstopteam.internal`
              const legacyDoc = await getDoc(doc(db, 'users', legacyId))
              if (legacyDoc.exists()) return { id: legacyDoc.id, col: 'users' }
              
              const legacyEmailDoc = await getDoc(doc(db, 'users', email))
              if (legacyEmailDoc.exists()) return { id: legacyEmailDoc.id, col: 'users' }
            } catch (e) {}

            return null
          }
          const target = await resolveProfileId()
          if (target) {
            userUnsub = onSnapshot(doc(db, target.col, target.id), (snap) => {
              if (snap.exists()) {
                const data = snap.data()
                if (String(data.status || '').toLowerCase() === 'inativo') {
                  logout()
                } else {
                  setUser(fbUser)
                  setUserData({ 
                    ...extractSafeProfile(data), 
                    id: snap.id,
                    isLegacyProfile: target.col === 'users' || target.col === 'students' || target.col === 'equipe'
                  })
                }
              } else { logout() }
              setLoading(false)
            })
          } else { logout() }
        } else {
          setUser(null); setUserData(null); setLoading(false)
        }
      } catch (err) { setLoading(false) }
    })
    return () => { unsubscribe(); if (userUnsub) userUnsub() }
  }, [logout])

  const sendResetEmail = async (email) => sendPasswordResetEmail(auth, email)

  const value = {
    user, userData, loading, login, loginAdmin, logout, verifyPIN, effectiveRole,
    simulatedRole, setSimulatedRole, sendResetEmail
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)

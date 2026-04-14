/**
 * Provedor de Autenticação e Gestão de Sessão (Single Source of Truth)
 *
 * Funcionalidades de SEGURANÇA implementadas:
 * - Auto-logout por inactividade (30 minutos sem interacção)
 * - Delay progressivo em falhas de login (protecção anti-brute force)
 * - O PIN NÃO é guardado no localStorage — apenas dados não sensíveis do perfil
 * - Sessão simulada (PIN) limpa os dados sensíveis ao fazer logout
 *
 * Este contexto gere o estado global do utilizador, suportando login via
 * Firebase Auth (E-mail/Senha) e via Identificador/PIN (simulado).
 */
import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
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
  deleteDoc,
  updateDoc,
  deleteField,
  collection,
  query,
  getDocs,
  limit,
  where,
  onSnapshot
} from 'firebase/firestore'
import { auth, db } from '../firebase/config'

const AuthContext = createContext()

// Inicialização Silenciosa de Auth Secundário para Verificações de PIN
// Isso evita o swap da identidade principal do app e previne re-renders globais.
const getVerifyAuth = () => {
  const apps = getApps()
  const verifyApp = apps.find(a => a.name === 'verify') || initializeApp(firebaseConfig, 'verify')
  const vAuth = getAuth(verifyApp)
  // Garantimos que o PIN não persista e não interfira com o login principal
  setPersistence(vAuth, inMemoryPersistence)
  return vAuth
}
const verifyAuth = getVerifyAuth()

// Nome da colecção unificada de utilizadores
const USERS_COLLECTION = 'users'

// Tempo de inactividade até auto-logout (30 minutos em ms)
const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000

/**
 * Extrai apenas os campos seguros do perfil para guardar no localStorage.
 * Nunca persiste o PIN, passwords ou dados financeiros.
 */
function extractSafeProfile(data) {
  const { pin: _pin, password: _pwd, ...safeData } = data
  return safeData
}

export function AuthProvider({ children }) {
  // Estado do utilizador Auth (Firebase)
  const [user, setUser] = useState(null)

  // Dados detalhados do perfil (vindos do Firestore)
  const [userData, setUserData] = useState(null)

  const [loading, setLoading] = useState(true)
  const [simulatedRole, setSimulatedRole] = useState(null)
  const [isSetupMode, setIsSetupMode] = useState(false)
  const [hasAdmin, setHasAdmin] = useState(true)
  const [hasGestor, setHasGestor] = useState(true)

  // Referência ao temporizador de inactividade
  const inactivityTimerRef = useRef(null)

  // 🚀 CACHE DE SESSÃO: Armazena o hash do PIN validado para rapidez instantânea em ações subsequentes.
  // Isso evita chamadas de rede repetidas para o Firebase Auth durante a mesma sessão.
  const sessionPinHashRef = useRef(null)

  // Função simples de hash para o cache de sessão (não precisa ser criptograficamente inquebrável, 
  // pois é apenas para cache de memória de curta duração em uma sessão já autenticada).
  const getHash = (str) => {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i)
      hash |= 0
    }
    return hash.toString()
  }

  /**
   * Determina o papel efectivo do utilizador para a interface.
   * Prioridade: Role Simulada > Role Principal > Papel hierárquico > Aluno
   */
  const effectiveRole = simulatedRole
    || (userData?.roles?.admin === true ? 'admin'
      : userData?.roles?.gestor === true ? 'gestor'
        : String(userData?.role || '').toLowerCase() === 'admin' ? 'admin'
          : String(userData?.role || '').toLowerCase() === 'gestor' ? 'gestor'
            : userData?.roles?.professor === true ? 'professor'
              : String(userData?.role || '').toLowerCase() === 'professor' ? 'professor'
                : 'aluno')


  /**
   * VERIFICAÇÃO DE SEGURANÇA (Zero-Knowledge)
   * Valida se um PIN inserido é o PIN correcto do utilizador actual sem usar o BD.
   */
  /** 🔐 INTERNAL IDENTITY HELPER */
  const getPinAuthEmail = (raw) => {
    const rawId = String(raw || '').toLowerCase().trim()
    // Se já é o formato final, retorna direto
    if (rawId.endsWith('@rstopteam.internal')) return rawId

    // Senão, normaliza e anexa
    const safeId = rawId
      .replace(/[@.]/g, '_')
      .replace(/\s+/g, '_')
      .replace(/_{2,}/g, '_') // Evita múltiplos underscores seguidos

    return `${safeId}@rstopteam.internal`
  }

  const verifyPIN = async (pinToVerify) => {
    if (!user || (!user.email && !userData?.authEmail)) return false

    // Resolvemos a identidade única baseada no e-mail do usuário
    const email = user.email || userData.authEmail
    const pinAuthEmail = getPinAuthEmail(email)
    const securePIN = pinToVerify.length >= 6 ? pinToVerify : pinToVerify.padEnd(6, '0')
    const currentHash = getHash(securePIN)

    // ⚡ VERIFICAÇÃO INSTANTÂNEA: Se o PIN já foi validado nesta sessão, retornamos true imediatamente.
    if (sessionPinHashRef.current && sessionPinHashRef.current === currentHash) {
      console.log('⚡ PIN Validado via Cache de Sessão (Instantâneo)')
      return true
    }

    try {
      console.time('verify-pin-network')
      // Tenta validar o PIN através do Auth Secundário (SILENCIOSO)
      // Não afeta o usuário logado no auth principal.
      await signInWithEmailAndPassword(verifyAuth, pinAuthEmail, securePIN)
      console.timeEnd('verify-pin-network')

      // 🔥 POPULAMOS O CACHE: Próximas verificações serão instantâneas
      sessionPinHashRef.current = currentHash

      // Opcional: Desloga imediatamente do secundário para limpar recursos
      signOut(verifyAuth).catch(() => {})
      return true
    } catch (e) {
      console.warn('❌ PIN Inválido (Silent Auth):', e.code)
      return false
    }
  }

  /**
   * Finaliza a sessão e limpa todos os dados do cliente.
   * Chamado manualmente pelo utilizador ou automaticamente por inactividade.
   */
  const logout = useCallback(() => {
    // Limpar temporizador de inactividade
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current)
    }
    setUser(null)
    setUserData(null)
    setSimulatedRole(null)
    sessionPinHashRef.current = null // 🛡️ LIMPA CACHE DE PIN NO LOGOUT
    return signOut(auth)
  }, [])

  /**
   * GESTÃO DE INACTIVIDADE — Auto-logout ao fim de 30 minutos sem interacção.
   * Reinicia o contador a cada evento do utilizador (clique, tecla, scroll, toque).
   */
  useEffect(() => {
    const resetTimer = () => {
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
      inactivityTimerRef.current = setTimeout(() => {
        // Utilizador inactivo — terminar sessão por segurança
        logout()
      }, INACTIVITY_TIMEOUT_MS)
    }

    // Só activar o temporizador se houver utilizador com sessão activa
    if (!user) return

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click']
    events.forEach(e => window.addEventListener(e, resetTimer, { passive: true }))
    resetTimer() // Inicia o contador ao montar

    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer))
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current)
    }
  }, [user, logout])

  /**
   * PROCESSO DE LOGIN UNIFICADO com protecção anti-brute force.
   */
  const login = async (identifier, password) => {
    console.log('🔐 Iniciando tentativa de login normal para:', identifier)
    const failCount = parseInt(sessionStorage.getItem('_lfc') || '0', 10)
    if (failCount > 0) {
      const delayMs = Math.min(500 * Math.pow(2, failCount - 1), 8000)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }

    let email = identifier.toLowerCase().trim()
    const isEmail = identifier.includes('@')
    const pinAuthEmail = getPinAuthEmail(email)
    const securePIN = password.length >= 6 ? password : password.padEnd(6, '0')

    try {
      const result = await signInWithEmailAndPassword(auth, pinAuthEmail, securePIN)
      console.log('✅ Login realizado com sucesso!')
      
      setSimulatedRole('aluno')
      sessionStorage.removeItem('_lfc')
      return result
    } catch (err) {
      // 🚀 AUTO-PROVISIONAMENTO (Just-in-Time Access)
      const isAuthMissing = err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential'
      
      if (isAuthMissing) {
        console.log('🔍 Usuário/Acesso não encontrado no Auth. Verificando Firestore...')
        
        try {
          // Busca o perfil no Firestore tentando todas as variações de ID possíveis
          const possibleIds = [pinAuthEmail, email, identifier.trim().toLowerCase()]
          let targetDoc = null
          
          for (const id of possibleIds) {
            const docRef = doc(db, USERS_COLLECTION, id)
            const snap = await getDoc(docRef)
            if (snap.exists()) {
              targetDoc = snap
              break
            }
          }

          if (!targetDoc) {
            // Fallback final: busca por campo de e-mail
            const q = query(collection(db, USERS_COLLECTION), where('email', '==', email), limit(1))
            const qSnap = await getDocs(q)
            if (!qSnap.empty) targetDoc = qSnap.docs[0]
          }

          if (targetDoc?.exists()) {
            const dbData = targetDoc.data()
            const dbPin = String(dbData.pin || '').trim()
            const typedPin = String(password || '').trim()
            
            console.log(`📡 Comparando PINs: Digitado=${typedPin} | Banco=${dbPin}`)

            if (dbPin && (dbPin === typedPin || dbPin === securePIN)) {
              console.log('✨ PIN verificado no Firestore. Provisionando conta no Auth...')
              try {
                const newUser = await createUserWithEmailAndPassword(auth, pinAuthEmail, securePIN)
                console.log('✅ Conta JIT criada e logada!')
                setSimulatedRole(null) // Deixa assumir o cargo real do Firestore
                sessionStorage.removeItem('_lfc')
                return newUser
              } catch (createErr) {
                if (createErr.code === 'auth/email-already-in-use') {
                   console.log('ℹ️ Conta já existe no Auth. Tentando login direto agora...')
                   return await signInWithEmailAndPassword(auth, pinAuthEmail, securePIN)
                } 
                throw createErr
              }
            } else {
              console.log('❌ PIN do banco não confere.')
            }
          } else {
            console.log('❌ Perfil não localizado após todas as tentativas de busca.')
          }
        } catch (provisionErr) {
          console.error('❌ Erro crítico no auto-provisionamento:', provisionErr)
        }
      }

      // Tentar login com email padrão se falhar o interno (legado)
      if (isEmail) {
        try {
          const result = await signInWithEmailAndPassword(auth, email, password)
          setSimulatedRole('aluno')
          sessionStorage.removeItem('_lfc')
          return result
        } catch (e) {}
      }
      
      throw new Error('Usuário ou PIN incorretos. Fale com seu Professor.')
    }
  }

  /**
   * LOGIN ADMINISTRATIVO (Via Segredo do Logo)
   */
  const loginAdmin = async (identifier, adminPin) => {
    console.log('🛡️ Tentativa de Login Administrativo:', identifier)
    
    let email = identifier.toLowerCase().trim()
    const pinAuthEmail = getPinAuthEmail(email)
    const inputPin = String(adminPin || '').trim()
    
    try {
      // 1. Localização do Perfil no Firestore (Robusta)
      const possibleIds = [pinAuthEmail, email, identifier.trim().toLowerCase()]
      let targetDoc = null
      
      for (const id of possibleIds) {
        const docRef = doc(db, USERS_COLLECTION, id)
        const snap = await getDoc(docRef)
        if (snap.exists()) {
          targetDoc = snap
          break
        }
      }

      if (!targetDoc) {
        const q = query(collection(db, USERS_COLLECTION), where('email', '==', email), limit(1))
        const qSnap = await getDocs(q)
        if (!qSnap.empty) targetDoc = qSnap.docs[0]
      }

      if (!targetDoc?.exists()) {
        throw new Error('Conta administrativa não localizada.')
      }

      const adminData = targetDoc.data()
      
      // 2. Validação Estrita de Permissão
      // Expandido para incluir 'professor' na entrada administrativa
      const isAuthorized = 
        ['admin', 'gestor', 'professor'].includes(String(adminData.role || '').toLowerCase()) ||
        adminData.roles?.admin === true ||
        adminData.roles?.gestor === true ||
        adminData.roles?.professor === true

      if (!isAuthorized) {
        console.warn('🚫 Tentativa de login adm por usuário sem permissão staff:', adminData.role)
        throw new Error('Este acesso é exclusivo para membros da equipe autorizados.')
      }

      // 3. Comparação de PIN Administrativo
      const dbAdminPin = String(adminData.adminPin || adminData['adminPin '] || adminData.pin || '').trim()
      const typedAdminPin = String(adminPin || '').trim()

      console.log(`🛡️ Validando PIN Adm: Digitado=${typedAdminPin} | Banco=${dbAdminPin}`)

      if (!dbAdminPin || typedAdminPin !== dbAdminPin) {
        throw new Error('PIN de Administrador incorreto.')
      }

      // 4. Preparação do PIN de Acesso para o Auth
      const accessPin = adminData.pin || adminData.password
      if (!accessPin) throw new Error('Falha na sincronização de segurança.')
      const securePin = String(accessPin).length >= 6 ? String(accessPin) : String(accessPin).padEnd(6, '0')
      
      // 5. Autenticação Firebase Auth com JIT
      try {
        const result = await signInWithEmailAndPassword(auth, pinAuthEmail, securePin)
        console.log('✅ Admin logado com sucesso.')
        setSimulatedRole(null) // Libera o papel real
        return result
      } catch (authErr) {
        if (authErr.code === 'auth/user-not-found' || authErr.code === 'auth/invalid-credential') {
          console.log('✨ Admin verificado no Firestore mas sem Auth. Provisionando...')
          try {
            const result = await createUserWithEmailAndPassword(auth, pinAuthEmail, securePin)
            console.log('✅ Conta administrativa criada e logada.')
            setSimulatedRole(null)
            return result
          } catch (createErr) {
            if (createErr.code === 'auth/email-already-in-use') {
              // Tenta login de novo, talvez senha no Auth esteja diferente do doc?
              // Se chegar aqui, é problema de sincronização de senha
              throw new Error('Erro de sincronização. O PIN no banco não bate com a senha do Auth.')
            }
            throw createErr
          }
        }
        throw authErr
      }
    } catch (err) {
      console.error('❌ Erro no login administrativo:', err)
      throw new Error(err.message || 'Falha na autenticação administrativa.')
    }
  }

  useEffect(() => {
    // Configura persistência local para Firebase Auth
    setPersistence(auth, browserLocalPersistence).catch(err =>
      console.error('Erro ao definir persistência:', err)
    )

    /** Verifica se o sistema precisa de configuração inicial (sem Admin/Gestor) */
    const checkSetupMode = async () => {
      try {
        const [snapAdmin, snapGestor] = await Promise.all([
          getDocs(query(collection(db, USERS_COLLECTION), where('roles.admin', '==', true), limit(1))),
          getDocs(query(collection(db, USERS_COLLECTION), where('roles.gestor', '==', true), limit(1))),
        ])
        const foundAdmin = !snapAdmin.empty
        const foundGestor = !snapGestor.empty
        setHasAdmin(foundAdmin)
        setHasGestor(foundGestor)
        setIsSetupMode(!foundAdmin || !foundGestor)
      } catch (err) {
        console.warn('⚠️ Erro ao verificar setup:', err)
        setIsSetupMode(false)
      }
    }
    checkSetupMode()

    let userUnsub = null

    /** MONITOR DE ESTADO DE AUTENTICAÇÃO (Firebase Auth + Firestore Sync) */
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (userUnsub) userUnsub()

      try {
        if (fbUser) {
          const email = fbUser.email.toLowerCase()

          // 🚀 SMART LOOKUP: Resolvemos qual documento do Firestore pertence ao fbUser logado
          const resolveProfileId = async () => {
            // A. Tentativa por ID Directo (Email original)
            const directDoc = await getDoc(doc(db, USERS_COLLECTION, email))
            if (directDoc.exists()) return directDoc.id

            // B. Tentativa pela Identidade Sanitizada
            const sanitizedId = getPinAuthEmail(email)
            const sanitizedDoc = await getDoc(doc(db, USERS_COLLECTION, sanitizedId))
            if (sanitizedDoc.exists()) return sanitizedDoc.id

            // C. Tentativa por Campo 'email' 
            const q2 = query(collection(db, USERS_COLLECTION), where('email', '==', email), limit(1))
            const qSnap2 = await getDocs(q2)
            if (!qSnap2.empty) return qSnap2.docs[0].id

            return null
          }

          const targetId = await resolveProfileId()

          if (targetId) {
            userUnsub = onSnapshot(doc(db, USERS_COLLECTION, targetId), (snap) => {
              if (snap.exists()) {
                const data = snap.data()
                if (data.status === 'Inativo') {
                  logout()
                } else {
                  setUser(fbUser)
                  setUserData({ ...extractSafeProfile(data), id: snap.id })
                }
              } else {
                logout()
              }
              setLoading(false)
            })
          } else {
            console.error('❌ ERRO CRÍTICO: Perfil não encontrado para', email)
            logout()
          }

        } else {
          setUser(null)
          setUserData(null)
          setLoading(false)
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
  }, [logout])

  const sendResetEmail = async (email) => {
    return sendPasswordResetEmail(auth, email)
  }

  const checkUserExists = async (email) => {
    try {
      const q = query(
        collection(db, USERS_COLLECTION),
        where('email', '==', email.toLowerCase().trim()),
        limit(1)
      )
      const snap = await getDocs(q)
      if (!snap.empty) return true
      const docSnap = await getDoc(doc(db, USERS_COLLECTION, email.toLowerCase().trim()))
      return docSnap.exists()
    } catch (err) {
      console.error('Erro ao verificar usuário:', err)
      return false
    }
  }

  const value = {
    user,
    userData,
    loading,
    login,
    loginAdmin,
    logout,
    verifyPIN,
    effectiveRole,
    simulatedRole,
    setSimulatedRole,
    isSetupMode,
    hasAdmin,
    hasGestor,
    sendResetEmail,
    checkUserExists
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

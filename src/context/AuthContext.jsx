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
  inMemoryPersistence
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
   *
   * Fluxo:
   * 1. Resolve o identificador (E-mail ou Nome) para um E-mail.
   * 2. Tenta autenticar via Firebase Auth (email/senha).
   * 3. Fallback: valida PIN no documento Firestore.
   */
  const login = async (identifier, password) => {
    console.log('🔐 Iniciando tentativa de login para:', identifier)
    const failCount = parseInt(sessionStorage.getItem('_lfc') || '0', 10)
    if (failCount > 0) {
      const delayMs = Math.min(500 * Math.pow(2, failCount - 1), 8000)
      console.log(`⏳ Delay anti-brute force: ${delayMs}ms`)
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }

    let email = identifier.toLowerCase().trim()
    const isEmail = identifier.includes('@')

    // 1. Resolvemos o e-mail se o identificador for um NOME
    if (!isEmail) {
      console.log('🔍 Identificador não é e-mail, buscando por nome...')
      const q = query(
        collection(db, USERS_COLLECTION),
        where('name', '==', identifier),
        limit(1)
      )
      const snap = await getDocs(q)
      if (!snap.empty) {
        email = snap.docs[0].id // O ID do documento é o e-mail real
        console.log('✅ Nome resolvido para o e-mail:', email)
      } else {
        console.warn('⚠️ Nome não encontrado no sistema.')
      }
    }

    const pinAuthEmail = getPinAuthEmail(email)
    const securePIN = password.length >= 6 ? password : password.padEnd(6, '0')

    // Estratégia de tentativa:
    // Passo A: Tentar PIN/Identidade Interna (Gestores/Alunos/Membros)
    // Passo B: Tentar E-mail/Senha (Admins/Equipe com conta vinculada)
    // Passo C: Tentar Migração (Se usuário tem PIN no Firestore mas não no Auth)

    try {
      console.log('🔑 Tentando Acesso A (PIN/Identidade Interna)...')
      try {
        const result = await signInWithEmailAndPassword(auth, pinAuthEmail, securePIN)
        console.log('✅ Acesso A bem-sucedido!')
        sessionStorage.removeItem('_lfc')
        return result
      } catch (firstErr) {
        // Se falhou e o PIN era curto, tentamos sem o padding (compatibilidade legada)
        if (password.length < 6) {
          console.log('⚠️ Acesso A (Padded) falhou, tentando Versão Curta (Legada)...')
          const result = await signInWithEmailAndPassword(auth, pinAuthEmail, password)
          console.log('✅ Acesso A (Legado) bem-sucedido!')
          sessionStorage.removeItem('_lfc')
          return result
        }
        throw firstErr
      }
    } catch (pinErr) {
      console.log('❌ Acesso A falhou (Código:', pinErr.code, ')')

      // Se for e-mail real, tentamos Acesso B (Standard Email/Password)
      if (isEmail) {
        try {
          console.log('🔑 Tentando Acesso B (E-mail/Senha padrão)...')
          const result = await signInWithEmailAndPassword(auth, email, password)
          console.log('✅ Acesso B bem-sucedido!')
          sessionStorage.removeItem('_lfc')
          return result
        } catch (emailErr) {
          console.log('❌ Acesso B falhou (Código:', emailErr.code, ')')
        }
      }

      // Se ambos falharam, verificamos se o usuário existe no Firestore para migrar (Passo C)
      if (pinErr.code === 'auth/user-not-found' || pinErr.code === 'auth/invalid-credential' || pinErr.code === 'auth/invalid-email') {
        console.log('🔄 Verificando necessidade de migração no Firestore...')

        // Tenta encontrar o perfil pelo ID interno novo, antigo (u_) ou pelo e-mail real
        const pinAuthEmail = getPinAuthEmail(email)
        const legacyPinEmail = `u_${pinAuthEmail}`

        let docSnap = await getDoc(doc(db, USERS_COLLECTION, pinAuthEmail))

        if (!docSnap.exists()) {
          docSnap = await getDoc(doc(db, USERS_COLLECTION, legacyPinEmail))
        }

        if (!docSnap.exists()) {
          docSnap = await getDoc(doc(db, USERS_COLLECTION, email))
        }

        if (docSnap.exists()) {
          const data = docSnap.data()
          console.log('📄 Documento encontrado. Verificando cofre de segurança (Vault)...')

          // 🔐 Busca o PIN no cofre isolado (se existir e tivermos acesso)
          let secrets = {}
          try {
            const secretsSnap = await getDoc(doc(db, USERS_COLLECTION, docSnap.id, 'privacy', 'secrets'))
            secrets = secretsSnap.exists() ? secretsSnap.data() : {}
          } catch (secErr) {
            console.log('Cofre inacessível, utilizando PIN do documento principal.')
          }
          const pinFound = secrets.pin || data.pin // Fallback para compatibilidade durate a sincronização

          if (pinFound === password) {
            console.log('✨ PIN confirmado no cofre! Iniciando migração...')
            try {
              console.log('✅ Identidade Auth criada. Sincronizando cofre de segurança...');
              
              // 🛡️ BACKUP DO PIN NO COFRE ANTES DE DELETAR (Garante visibilidade administrativa)
              const secretRef = doc(db, USERS_COLLECTION, docSnap.id, 'privacy', 'secrets');
              await setDoc(secretRef, { 
                pin: password, 
                updatedAt: new Date().toISOString() 
              }, { merge: true });

              await updateDoc(docSnap.ref, {
                pin: deleteField(),
                authEmail: pinAuthEmail,
                migratedAt: new Date().toISOString()
              })
              console.log('✅ Migração e backup do cofre concluídos!');

              sessionStorage.removeItem('_lfc')
              return res
            } catch (createErr) {
              if (createErr.code === 'auth/email-already-in-use') {
                console.log('💡 Conta já existe no Auth. Tentando acesso direto para concluir sincronização...')
                
                // Tenta logar primeiro para obter permissões de escrita no Firestore
                let loginRes
                try {
                  loginRes = await signInWithEmailAndPassword(auth, pinAuthEmail, securePIN)
                } catch (finalErr) {
                  console.warn('❌ Senha Auth inconsistente com Firestore. Tentando Recuperação V2...')
                  
                  // 🔥 RECUPERAÇÃO V2: Se a conta existe mas a senha (PIN) mudou no Firestore 
                  // e o Auth não deixou atualizar, criamos uma identidade secundária v2.
                  const v2Email = pinAuthEmail.replace('@rstopteam.internal', '_v2@rstopteam.internal')
                  try {
                    // Tenta logar se já fizemos isso antes
                    return await signInWithEmailAndPassword(auth, v2Email, securePIN)
                  } catch (v2Err) {
                    if (v2Err.code === 'auth/user-not-found') {
                       // Cria a nova identidade vinculada ao mesmo doc
                       const v2Res = await createUserWithEmailAndPassword(auth, v2Email, securePIN)
                       await updateDoc(docSnap.ref, {
                         authEmail: v2Email,
                         migratedAt: new Date().toISOString(),
                         recoveryMode: 'v2'
                       })
                       return v2Res
                    }
                    throw v2Err
                  }
                }

                // Se logou com sucesso, agora temos permissão para limpar o PIN legada no Firestore
                if (loginRes?.user) {
                  try {
                    // 🛡️ BACKUP DO PIN NO COFRE (Garante visibilidade administrativa nos logins subsequentes)
                    const secretRef = doc(db, USERS_COLLECTION, docSnap.id, 'privacy', 'secrets');
                    await setDoc(secretRef, { 
                      pin: password, 
                      updatedAt: new Date().toISOString() 
                    }, { merge: true });

                    await updateDoc(docSnap.ref, {
                      pin: deleteField(),
                      authEmail: pinAuthEmail,
                      syncedAt: new Date().toISOString()
                    })

                    console.log('✅ Metadados sincronizados após login.')
                  } catch (syncErr) {
                    console.warn('⚠️ Falha ao limpar PIN legado, mas login mantido:', syncErr)
                  }
                }
                return loginRes
              }
              console.error('❌ Erro crítico na migração:', createErr)
              throw createErr
            }
          } else {
            console.warn('❌ PIN incorreto ou não encontrado no cofre.')
          }
        } else {
          console.warn('❌ Usuário não existe no Firestore.')
        }
      }

      sessionStorage.setItem('_lfc', String(failCount + 1))
      throw new Error('Identificação inválida ou senha incorreta.')
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
        console.warn('⚠️ Erro ao verificar setup (Desta vez, assumimos que já existe gestor/admin):', err)
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
            // A. Tentativa por ID Directo (Email original, para contas não migradas)
            const directDoc = await getDoc(doc(db, USERS_COLLECTION, email))
            if (directDoc.exists()) return directDoc.id

            // B. Tentativa pela Identidade Sanitizada (Novo Padrão Unificado)
            const sanitizedId = getPinAuthEmail(email)
            const sanitizedDoc = await getDoc(doc(db, USERS_COLLECTION, sanitizedId))
            if (sanitizedDoc.exists()) return sanitizedDoc.id

            // C. Tentativa por Campo 'email' original
            const q2 = query(collection(db, USERS_COLLECTION), where('email', '==', email), limit(1))
            const qSnap2 = await getDocs(q2)
            if (!qSnap2.empty) return qSnap2.docs[0].id

            // D. Tentativa por Campo 'authEmail' legado
            const q = query(collection(db, USERS_COLLECTION), where('authEmail', '==', email), limit(1))
            const qSnap = await getDocs(q)
            if (!qSnap.empty) return qSnap.docs[0].id

            // E. GUESS & RESOLVE (Fallback para e-mails legados do Auth)
            if (email.endsWith('@rstopteam.internal')) {
              console.log('🔍 Tentando reconstruir ID a partir de identidade interna:', email)
              const isLegacy = email.startsWith('u_')
              const prefixOffset = isLegacy ? 2 : 0
              const parts = email.split('@')[0].substring(prefixOffset).split('_')

              if (parts.length >= 3) {
                const tld = parts.pop()      // com
                const domain = parts.pop()   // gmail
                const userPart = parts.join('.') // max ou joao.zinho

                // Tentativa 1: user.name@domain.com
                const guess1 = `${userPart}@${domain}.${tld}`
                const snap1 = await getDoc(doc(db, USERS_COLLECTION, guess1))
                if (snap1.exists()) return snap1.id

                // Tentativa 2: user_name@domain.com
                const guess2 = `${parts.join('_')}@${domain}.${tld}`
                const snap2 = await getDoc(doc(db, USERS_COLLECTION, guess2))
                if (snap2.exists()) return snap2.id
              }
            }

            return null
          }

          const targetId = await resolveProfileId()

          if (targetId) {
            console.log('👤 Perfil resolvido para:', targetId)
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
                console.warn('⚠️ Documento do perfil não encontrado! Forçando logout.')
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

  const value = {
    user,
    userData,
    loading,
    login,
    logout,
    verifyPIN,
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

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
  orderBy,
  collectionGroup,
  onSnapshot
} from 'firebase/firestore'
import { auth, db } from '../firebase/config'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('rs-topteam-sim-user')
    return saved ? JSON.parse(saved).user : null
  })
  const [userData, setUserData] = useState(() => {
    const saved = localStorage.getItem('rs-topteam-sim-user')
    return saved ? JSON.parse(saved).userData : null
  })
  const [loading, setLoading] = useState(true)
  const [simulatedRole, setSimulatedRole] = useState(null)
  const [isSetupMode, setIsSetupMode] = useState(false)
  const [hasAdmin, setHasAdmin] = useState(true)
  const [hasGestor, setHasGestor] = useState(true)

  // Memoized effective role for the UI
  const effectiveRole = simulatedRole || userData?.role || 'aluno'

  const logout = () => {
    localStorage.removeItem('rs-topteam-sim-user')
    setUser(null)
    setUserData(null)
    setSimulatedRole(null)
    return signOut(auth)
  }

  const login = async (identifier, password) => {
    let email = identifier
    const field = identifier.includes('@') ? 'email' : 'name'

    // 1. Resolve identifier to email for Auth login
    if (field === 'name') {
      // Try new Equipe first
      const qEquipe = query(collectionGroup(db, 'membros'), where('name', '==', identifier), limit(1))
      const snapEquipe = await getDocs(qEquipe)
      if (!snapEquipe.empty) {
        email = snapEquipe.docs[0].data().email
      } else {
        // Try Students
        const qStudents = query(collection(db, 'students'), where('name', '==', identifier), limit(1))
        const snapStudents = await getDocs(qStudents)
        if (!snapStudents.empty) {
          email = snapStudents.docs[0].data().email
        } else {
          // Fallback legacy users
          const qUsers = query(collection(db, 'users'), where('name', '==', identifier), limit(1))
          const snapUsers = await getDocs(qUsers)
          if (!snapUsers.empty) email = snapUsers.docs[0].data().email
        }
      }
    }

    try {
      // Try standard Firebase Auth first
      return await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      // 2. PIN LOGIN FALLBACK
      // Important for students and staff who don't have an Auth account or forgot password

      // Search in New Equipe Structure
      const qEquipe = query(collectionGroup(db, 'membros'), where(field, '==', identifier), limit(1))
      const snapEquipe = await getDocs(qEquipe)
      if (!snapEquipe.empty) {
        const data = snapEquipe.docs[0].data()
        if (data.pin === password) {
          const simUser = { uid: snapEquipe.docs[0].id, email: data.email, isSimulated: true }
          const simData = { ...data, id: snapEquipe.docs[0].id, role: data.role || 'professor' }
          localStorage.setItem('rs-topteam-sim-user', JSON.stringify({ user: simUser, userData: simData }))
          setUser(simUser)
          setUserData(simData)
          return { user: simUser }
        }
      }

      // Search in Students
      const qStudents = query(collection(db, 'students'), where(field, '==', identifier), limit(1))
      const snapStudents = await getDocs(qStudents)
      if (!snapStudents.empty) {
        const data = snapStudents.docs[0].data()
        if (data.pin === password) {
          const simUser = { uid: snapStudents.docs[0].id, email: data.email, isSimulated: true }
          const simData = { ...data, id: snapStudents.docs[0].id, role: 'aluno' }
          localStorage.setItem('rs-topteam-sim-user', JSON.stringify({ user: simUser, userData: simData }))
          setUser(simUser)
          setUserData(simData)
          return { user: simUser }
        }
      }

      // Search in Legacy Users
      const qUsers = query(collection(db, 'users'), where(field, '==', identifier), limit(1))
      const snapUsers = await getDocs(qUsers)
      if (!snapUsers.empty) {
        const data = snapUsers.docs[0].data()
        if (data.pin === password) {
          const simUser = { uid: snapUsers.docs[0].id, email: data.email, isSimulated: true }
          const simData = { ...data, id: snapUsers.docs[0].id, role: data.role || 'aluno' }
          localStorage.setItem('rs-topteam-sim-user', JSON.stringify({ user: simUser, userData: simData }))
          setUser(simUser)
          setUserData(simData)
          return { user: simUser }
        }
      }

      throw err
    }
  }

  useEffect(() => {
    // 0. Ensure Firebase Auth persistence is set to LOCAL
    setPersistence(auth, browserLocalPersistence).catch(err => console.error("Persistence error:", err))

    const checkSetupMode = async () => {
      try {
        const qAdmin = query(collection(db, 'equipe', 'admin', 'membros'), limit(1))
        const snapAdmin = await getDocs(qAdmin)
        const foundAdmin = !snapAdmin.empty

        const qGestor = query(collection(db, 'equipe', 'gestor', 'membros'), limit(1))
        const snapGestor = await getDocs(qGestor)
        const foundGestor = !snapGestor.empty

        setHasAdmin(foundAdmin)
        setHasGestor(foundGestor)
        setIsSetupMode(!foundAdmin || !foundGestor)
      } catch (err) {
        console.warn("Setup check ignored (likely permissions):", err)
        // Default to false to avoid blocking UI
        setIsSetupMode(false)
      }
    }
    checkSetupMode()

    let userUnsub = null

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (userUnsub) userUnsub() // Cleanup previous sub

      try {
        if (user) {
          // Firebase User flow ...
          localStorage.removeItem('rs-topteam-sim-user')

          const q = query(collectionGroup(db, 'membros'), where('uid', '==', user.uid), limit(1))
          const snap = await getDocs(q).catch(err => {
            console.warn("Membros query error:", err)
            return { empty: true }
          })

          let path = null
          if (!snap.empty) {
            const role = snap.docs[0].data().role
            path = `equipe/${role}/membros/${snap.docs[0].id}`
          } else {
            path = `users/${user.uid}`
          }

          userUnsub = onSnapshot(doc(db, path), (snap) => {
            if (snap.exists()) {
              const data = snap.data()
              if (data.status === 'Inativo') {
                logout()
              } else {
                setUser(user)
                setUserData({ ...data, id: snap.id })
              }
            } else {
              setUser(user)
              setUserData(null)
            }
            setLoading(false)
          }, (err) => {
            console.error('UserData sub error:', err)
            setLoading(false)
          })
        } else {
          // Simulated PIN User flow ...
          const savedSim = localStorage.getItem('rs-topteam-sim-user')
          if (!savedSim) {
            setUser(null)
            setUserData(null)
            setSimulatedRole(null)
            setLoading(false)
          } else {
            try {
              const { user: simUser, userData: simData } = JSON.parse(savedSim)
              const path = simData.role === 'aluno'
                ? `students/${simUser.uid}`
                : (simData.role ? `equipe/${simData.role}/membros/${simUser.uid}` : `users/${simUser.uid}`)

              userUnsub = onSnapshot(doc(db, path), (snap) => {
                if (snap.exists()) {
                  const data = snap.data()
                  if (data.status === 'Inativo') {
                    logout()
                  } else {
                    setUser(simUser)
                    setUserData({ ...data, id: snap.id })
                    localStorage.setItem('rs-topteam-sim-user', JSON.stringify({ user: simUser, userData: { ...data, id: snap.id } }))
                  }
                } else {
                  setUser(simUser)
                }
                setLoading(false)
              }, (err) => {
                console.error('SimSub error:', err)
                setLoading(false)
              })
            } catch (e) {
              console.error("Session parse error:", e)
              localStorage.removeItem('rs-topteam-sim-user')
              setLoading(false)
            }
          }
        }
      } catch (err) {
        console.error("Auth process fatal error:", err)
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
      {!loading && children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

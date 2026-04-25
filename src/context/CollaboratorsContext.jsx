import React, { createContext, useContext, useState, useEffect } from 'react'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { db, auth } from '../firebase/config'
import { COLLECTIONS } from '../firebase/collections'

const CollaboratorsContext = createContext()

export function CollaboratorsProvider({ children }) {
  const [collaborators, setCollaborators] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 🛡️ SEGURANÇA: Só inicia a escuta se houver um usuário autenticado no Firebase Auth
    // Isso evita o erro de "Missing Permission" na tela de login.
    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      if (fbUser) {
        console.log('📡 [CollaboratorsContext] Usuário detectado. Iniciando escuta da equipe...')
        
        const q = query(
          collection(db, COLLECTIONS.USUARIOS), 
          where('papeis.professor', '==', true)
        )

        const unsubscribeSnapshot = onSnapshot(q, (snapshot) => {
          const staffList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          
          console.log(`✅ [CollaboratorsContext] ${staffList.length} membros da equipe sincronizados.`)
          setCollaborators(staffList)
          setLoading(false)
        }, (error) => {
          // Se der erro de permissão mesmo logado, pode ser falta de Index ou regra estrita
          console.error('❌ [CollaboratorsContext] Erro na escuta:', error)
          setLoading(false)
        })

        return () => unsubscribeSnapshot()
      } else {
        // Se deslogar, limpa a lista e para a escuta
        setCollaborators([])
        setLoading(false)
      }
    })

    return () => unsubscribeAuth()
  }, [])

  return (
    <CollaboratorsContext.Provider value={{ collaborators, isLoadingCollaborators: loading }}>
      {children}
    </CollaboratorsContext.Provider>
  )
}

export const useCollaboratorsContext = () => {
  const context = useContext(CollaboratorsContext)
  if (!context) {
    throw new Error('useCollaboratorsContext deve ser usado dentro de um CollaboratorsProvider')
  }
  return context
}

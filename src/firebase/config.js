// Resumo: inicializa Firebase (Auth, Firestore e Storage).
// OTIMIZAÇÃO: persistência offline do Firestore ativada via IndexedDB.
// Na segunda visita, dados são servidos do cache local instantaneamente
// enquanto o Firebase sincroniza em background — sem tela em branco.

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyBjDGUmUVWOXIqzITiG9g9dalAGshQDgww",
  authDomain: "academia-rstopteam.firebaseapp.com",
  projectId: "academia-rstopteam",
  storageBucket: "academia-rstopteam.firebasestorage.app",
  messagingSenderId: "427455835491",
  appId: "1:427455835491:web:83c029a7e400c35e1c7756"
}

const app = initializeApp(firebaseConfig)

export const auth    = getAuth(app)
export const db      = getFirestore(app)
export const storage = getStorage(app)

// Ativa persistência offline — dados em cache para carregamento instantâneo
// na segunda visita. Erros são ignorados silenciosamente (ex: múltiplas abas).
enableIndexedDbPersistence(db).catch(err => {
  if (err.code === 'failed-precondition') {
    // Múltiplas abas abertas — cache desativado nesta aba
    console.warn('Persistência offline desativada (múltiplas abas)')
  } else if (err.code === 'unimplemented') {
    // Navegador não suporta IndexedDB
    console.warn('Este navegador não suporta cache offline do Firestore')
  }
})

export default app


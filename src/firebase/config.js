/**
 * Configuração e inicialização do Firebase SDK.
 *
 * OTIMIZAÇÃO DE PERFORMANCE:
 * A persistência offline é activada via IndexedDB usando a API moderna
 * `persistentLocalCache` (substitui `enableIndexedDbPersistence` que foi
 * removida no Firebase SDK v12+).
 * Na segunda visita, dados são servidos do cache local instantaneamente
 * enquanto o Firebase sincroniza em background — sem tela em branco.
 *
 * SEGURANÇA:
 * A chave de API aqui presente é segura de expor no cliente pelo design do
 * Firebase — o acesso real aos dados é controlado pelas Firestore Security Rules.
 * Nunca colocar chaves de service account (firebase-key.json) no cliente.
 */

import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

export const firebaseConfig = {
  apiKey:            "AIzaSyBjDGUmUVWOXIqzITiG9g9dalAGshQDgww",
  authDomain:        "academia-rstopteam.firebaseapp.com",
  projectId:         "academia-rstopteam",
  storageBucket:     "academia-rstopteam.firebasestorage.app",
  messagingSenderId: "427455835491",
  appId:             "1:427455835491:web:83c029a7e400c35e1c7756"
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)

// Inicializa Firestore com cache persistente em IndexedDB.
// persistentMultipleTabManager: permite uso em múltiplas abas sem erros
// (substitui a antiga enableIndexedDbPersistence que era incompatível com múltiplas abas).
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
})

export const storage = getStorage(app)

export default app

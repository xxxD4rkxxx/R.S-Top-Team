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

import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager,
  CACHE_SIZE_UNLIMITED
} from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

export const firebaseConfig = {
  apiKey: "AIzaSyBjDGUmUVWOXIqzITiG9g9dalAGshQDgww",
  authDomain: "academia-rstopteam.firebaseapp.com",
  projectId: "academia-rstopteam",
  storageBucket: "academia-rstopteam.firebasestorage.app",
  messagingSenderId: "427455835491",
  appId: "1:427455835491:web:83c029a7e400c35e1c7756"
}

// Inicializa o App (HMR Safe)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp()

// ─── Firestore Initialization (Resilient Singleton) ──────────────────────────
let dbInstance = null
try {
  // Verificamos se já existe um app inicializado
  if (app) {
    dbInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager(),
        cacheSizeBytes: CACHE_SIZE_UNLIMITED
      })
    })
    console.log('🔥 [Firebase/Config] Firestore inicializado com Persistent Cache (Single Tab).')
  }
} catch (error) {
  // Se falhar (ex: erro b815 ou disco cheio), tentamos o fallback em memória
  if (error.code === 'failed-precondition' || error.message?.includes('INTERNAL ASSERTION FAILED')) {
    console.warn('⚠️ [Firebase/Config] Persistent cache falhou ou já está em uso. Fallback para cache em memória...')
    dbInstance = getFirestore(app)
  } else {
    console.error('❌ [Firebase/Config] Erro crítico ao inicializar Firestore:', error)
    dbInstance = getFirestore(app)
  }
}

export const db = dbInstance
export const auth = getAuth(app)
export const storage = getStorage(app)

export default app

// 🕵️ Monitor de Conectividade (Detecta AdBlockers/Firewalls)
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => {
    fetch('https://firestore.googleapis.com/google.firestore.v1.Firestore/Write/channel', { mode: 'no-cors' })
      .catch(() => {
        console.error('🚨 [ALERTA] Conexão com Google Cloud bloqueada! Desative seu AdBlocker ou verifique o Firewall para evitar o erro b815.')
      })
  })
}

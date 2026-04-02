// Resumo: inicializa Firebase (Auth, Firestore e Storage) com as credenciais do projeto.
// Firebase configuration
// Replace with your own Firebase project credentials
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: "AIzaSyBjDGUmUVWOXIqzITiG9g9dalAGshQDgww",
  authDomain: "academia-rstopteam.firebaseapp.com",
  projectId: "academia-rstopteam",
  storageBucket: "academia-rstopteam.firebasestorage.app",
  messagingSenderId: "427455835491",
  appId: "1:427455835491:web:83c029a7e400c35e1c7756"
};
const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)

export default app

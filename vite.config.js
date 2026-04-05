import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  build: {
    // Alvo browsers modernos — saída menor com async/await nativo
    target: 'esnext',
    // Aviso de chunk a partir de 1MB (padrão 500KB era muito restritivo)
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        // Vite 8 (rolldown) exige manualChunks como FUNÇÃO, não objeto
        // Separa dependências pesadas do bundle inicial para download paralelo
        manualChunks(id) {
          if (id.includes('node_modules/firebase/')) {
            // Divide SDK do Firebase por serviço para tree-shaking eficaz
            if (id.includes('/auth'))      return 'firebase-auth'
            if (id.includes('/firestore')) return 'firebase-firestore'
            if (id.includes('/storage'))   return 'firebase-storage'
            return 'firebase-app'
          }
          if (id.includes('node_modules/recharts'))      return 'recharts'
          if (id.includes('node_modules/framer-motion')) return 'framer-motion'
          if (id.includes('node_modules/react-dom'))     return 'react-vendor'
          if (id.includes('node_modules/react-router'))  return 'react-vendor'
        }
      }
    }
  }
})



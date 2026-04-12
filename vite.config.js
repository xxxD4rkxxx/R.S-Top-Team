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

    // Source maps desactivados em produção — evita exposição do código fonte.
    // NOTE: Para o deploy final de produção, adicionar: drop: ['console', 'debugger']
    sourcemap: false,

    // Aviso de chunk a partir de 800KB
    chunkSizeWarningLimit: 800,

    rollupOptions: {
      output: {
        // Separa dependências pesadas do bundle inicial para download paralelo.
        // Cada serviço Firebase fica no seu próprio chunk — tree-shaking eficaz.
        manualChunks(id) {
          if (id.includes('node_modules/firebase/')) {
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

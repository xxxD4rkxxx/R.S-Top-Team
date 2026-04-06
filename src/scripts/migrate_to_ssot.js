import { db } from '../firebase/config'
import { collection, getDocs, setDoc, doc, serverTimestamp } from 'firebase/firestore'

/**
 * Script de Migração SSoT (Single Source of Truth)
 * Este script lê as coleções legadas 'students' e 'equipe' e unifica em 'users'.
 */
export async function runDeepMigration() {
  console.log('🚀 Iniciando Migração Profunda...')
  
  const stats = {
    students: 0,
    collaborators: 0,
    merged: 0,
    errors: 0
  }

  try {
    // 1. Migrar Alunos
    const studentSnap = await getDocs(collection(db, 'students'))
    console.log(`📂 Processando ${studentSnap.size} alunos...`)
    
    for (const d of studentSnap.docs) {
      const data = d.data()
      const emailId = (data.email || d.id).toLowerCase().trim()
      const userRef = doc(db, 'users', emailId)
      
      await setDoc(userRef, {
        ...data,
        roles: { aluno: true },
        updatedAt: serverTimestamp()
      }, { merge: true })
      
      stats.students++
    }

    // 2. Migrar Equipe (Colaboradores)
    const equipeSnap = await getDocs(collection(db, 'equipe'))
    console.log(`📂 Processando ${equipeSnap.size} colaboradores...`)

    for (const d of equipeSnap.docs) {
      const data = d.data()
      const emailId = (data.email || d.id).toLowerCase().trim()
      const userRef = doc(db, 'users', emailId)
      
      // Determina o cargo unificado
      let role = data.role || 'professor'
      if (data.isAdmin) role = 'admin'

      await setDoc(userRef, {
        ...data,
        role: role, // Garantir campo legível
        roles: { [role]: true },
        updatedAt: serverTimestamp()
      }, { merge: true })
      
      stats.collaborators++
    }

    console.log('✅ Migração concluída com sucesso!', stats)
    return stats
  } catch (error) {
    console.error('❌ Erro durante a migração:', error)
    throw error
  }
}

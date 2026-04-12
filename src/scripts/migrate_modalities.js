/**
 * SCRIPT DE MIGRAÇÃO: IDs de Modalidades -> Nomes
 * 
 * Este script lê todas as modalidades na coleção 'modalities',
 * cria novos documentos usando o 'name' como ID e migra as subcoleções 'turmas'.
 * 
 * Execução: Node.js (via firebase-admin ou similar conceitual)
 */
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../firebase/config';

export async function migrateModalitiesToNamedIds() {
  console.log('--- Iniciando Migração de IDs de Modalidades ---');
  
  const modalitiesSnap = await getDocs(collection(db, 'modalities'));
  
  for (const modDoc of modalitiesSnap.docs) {
    const data = modDoc.data();
    const oldId = modDoc.id;
    const newId = data.name.trim();
    
    // Se o ID já for o nome, ignora
    if (oldId === newId) {
      console.log(`[PULAR] Modalidade '${newId}' já possui ID correto.`);
      continue;
    }
    
    console.log(`[MIGRAR] ${oldId} -> ${newId}`);
    
    try {
      // 1. Criar novo documento com o Nome como ID
      const newDocRef = doc(db, 'modalities', newId);
      await setDoc(newDocRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      
      // 2. Migrar subcoleção 'turmas'
      const turmasSnap = await getDocs(collection(db, 'modalities', oldId, 'turmas'));
      for (const turmaDoc of turmasSnap.docs) {
        const turmaData = turmaDoc.data();
        const newTurmaRef = doc(db, 'modalities', newId, 'turmas', turmaDoc.id);
        await setDoc(newTurmaRef, turmaData);
        // Opcional: deletar a turma antiga (feito automaticamente se deletarmos o pai)
      }
      
      // 3. Deletar documento antigo
      // ATENÇÃO: Verifique se não há referências a este ID em outros locais antes de deletar!
      // Se houver, é melhor manter o antigo por enquanto.
      await deleteDoc(doc(db, 'modalities', oldId));
      
      console.log(`[SUCESSO] ${newId} migrado.`);
    } catch (err) {
      console.error(`[ERRO] Falha ao migrar ${oldId}:`, err);
    }
  }
  
  console.log('--- Migração Concluída ---');
}

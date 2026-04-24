/**
 * SCRIPT DE MIGRAÇÃO GLOBAL: LEGADO (EN) -> PORTUGUÊS (PT-BR)
 * 
 * Este script automatiza a migração de todos os dados do Firestore para as novas coleções traduzidas.
 */
import { collection, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase/config'
import { COLLECTIONS, SUB_COLLECTIONS } from '../firebase/collections'

const MAPPING = [
  { old: 'users', new: COLLECTIONS.USUARIOS, subs: { 'graduations': SUB_COLLECTIONS.GRADUACOES, 'notes': SUB_COLLECTIONS.ANOTACOES } },
  { old: 'students', new: COLLECTIONS.ALUNOS, subs: { 'notes': SUB_COLLECTIONS.ANOTACOES } },
  { old: 'collaborators', new: COLLECTIONS.EQUIPE, subs: { 'notes': SUB_COLLECTIONS.ANOTACOES } },
  { old: 'sessions', new: COLLECTIONS.CHAMADAS, subs: { 'attendances': SUB_COLLECTIONS.PRESENCAS } },
  { old: 'modalities', new: COLLECTIONS.MODALIDADES, subs: { 'turmas': SUB_COLLECTIONS.TURMAS } },
  { old: 'notices', new: COLLECTIONS.EVENTOS },
  { old: 'notice_views', new: COLLECTIONS.VISUALIZACOES_EVENTOS },
  { old: 'billing', new: COLLECTIONS.FATURAMENTO },
  { old: 'expenses', new: COLLECTIONS.DESPESAS },
  { old: 'contracts', new: COLLECTIONS.CONTRATOS },
  { old: 'counters', new: COLLECTIONS.CONTADORES },
  { old: 'vault', new: COLLECTIONS.COFRE_PINS },
  { old: 'tech_journey_configs', new: COLLECTIONS.CONFIGURACOES_JORNADA },
  { old: 'plans', new: COLLECTIONS.PLANOS },
]

export async function runGlobalMigration(onProgress) {
  console.log('🚀 Iniciando Migração Global para PT-BR...');
  let totalMigrated = 0;

  for (const item of MAPPING) {
    if (onProgress) onProgress(`Migrando ${item.old} -> ${item.new}...`);
    console.log(`📦 Processando: ${item.old} -> ${item.new}`);
    
    try {
      const snap = await getDocs(collection(db, item.old));
      console.log(`Found ${snap.docs.length} documents in ${item.old}`);
      
      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        
        // 1. Criar novo documento na coleção PT
        await setDoc(doc(db, item.new, docSnap.id), {
          ...data,
          migration_date: serverTimestamp()
        });

        // 2. Processar Subcoleções se existirem
        if (item.subs) {
          for (const [oldSub, newSub] of Object.entries(item.subs)) {
            const subSnap = await getDocs(collection(db, item.old, docSnap.id, oldSub));
            for (const subDoc of subSnap.docs) {
              await setDoc(doc(db, item.new, docSnap.id, newSub, subDoc.id), subDoc.data());
            }
          }
        }
        totalMigrated++;
      }
      console.log(`✅ ${item.old} migrado com sucesso.`);
    } catch (err) {
      console.error(`❌ Erro ao migrar ${item.old}:`, err);
    }
  }

  console.log(`🏁 Migração Concluída! Total de documentos processados: ${totalMigrated}`);
  return totalMigrated;
}

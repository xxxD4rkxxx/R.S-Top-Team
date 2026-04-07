/**
 * Serviço de Gestão de Presenças (Chamadas)
 * 
 * Responsável por criar sessões de aula e registrar a assiduidade dos usuários.
 */
import { db } from '../firebase/config'
import { 
  collection, doc, addDoc, writeBatch, serverTimestamp, 
  getDocs, query, orderBy, limit, 
  collectionGroup, where, setDoc, deleteDoc, increment
} from 'firebase/firestore'

const USERS_COLLECTION = 'users'

export const attendanceService = {
  /**
   * Cria uma nova sessão (aula) no banco de dados.
   */
  async createSession(payload) {
    try {
      const now = new Date()
      // Gera um SeqId simples para ordenação visual rápida
      const simpleSeqId = `99${now.getMinutes()}${now.getSeconds()}`
      
      const sessionData = {
        ...payload,
        seqId: Number(simpleSeqId),
        createdAt: serverTimestamp(),
      }
      
      // O ID da sessão já vem gerado do frontend para persistência imediata
      await setDoc(doc(db, 'sessions', payload.id), sessionData)
      return sessionData
    } catch (error) {
      console.error('Erro ao criar sessão:', error)
      throw error
    }
  },

  /**
   * REGISTRO DE CHAMADA EM LOTE (Batch)
   * 🎯 Agora atualiza a coleção unificada 'users' para marcar a última presença.
   */
  async markAttendanceBatch(activeSession, activeList) {
    try {
      const batch = writeBatch(db)
      const sessionRef = doc(db, 'sessions', activeSession.id)

      activeList.forEach(student => {
        if (student.status) {
          // 1. Grava o registro individual de presença na sub-coleção da sessão
          const recordRef = doc(collection(sessionRef, 'attendances'), student.id)
          batch.set(recordRef, {
            studentId: student.id,
            studentName: student.name,
            status: student.status,
            modality: activeSession.modality,
            date: activeSession.date,
            timestamp: serverTimestamp() 
          })

          /**
           * 2. ATUALIZAÇÃO NO PERFIL UNIFICADO
           * Se estiver presente, marca a data de última atividade no documento 'users/{id}'
           */
          if (student.status === 'present') {
            const userRef = doc(db, USERS_COLLECTION, student.id)
            batch.update(userRef, {
              lastAttendanceAt: serverTimestamp(),
              'tech_journey.sessions_since_last_promotion': increment(1), // Incrementa para graduação
              updatedAt: serverTimestamp()
            })
          }
        }
      })

      // Executa todas as operações de forma atômica
      await batch.commit()
      return true
    } catch (error) {
      console.error('Erro ao salvar lote de chamadas unificado:', error)
      throw error
    }
  },

  /**
   * Recupera a lista de presenças de uma sessão específica.
   */
  async getSessionAttendances(sessionId) {
    try {
      const attendancesRef = collection(db, 'sessions', sessionId, 'attendances')
      const snapshot = await getDocs(attendancesRef)
      const records = {}

      snapshot.docs.forEach(docSnap => {
        const data = docSnap.data()
        records[data.studentId] = data.status
      })

      return records
    } catch (error) {
      console.error('Erro ao buscar presenças da sessão:', error)
      throw error
    }
  },

  /**
   * Busca a última presença global de um usuário usando Collection Group.
   */
  async getLastAttendance(studentId) {
    try {
      const q = query(
        collectionGroup(db, 'attendances'),
        where('studentId', '==', studentId),
        orderBy('timestamp', 'desc'),
        limit(1)
      )

      const snapshot = await getDocs(q)
      if (!snapshot.empty) {
        return snapshot.docs[0].data()
      }
      return null
    } catch (error) {
      console.error('Erro ao buscar última presença (CollectionGroup):', error)
      throw error
    }
  },

  /**
   * Remove uma sessão de aula completa.
   */
  async deleteSession(sessionId) {
    try {
      await deleteDoc(doc(db, 'sessions', sessionId))
      return true
    } catch (error) {
      console.error('Erro ao deletar sessão:', error)
      throw error
    }
  }
}


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
    console.log('📅 Criando nova sessão:', payload.id, payload.classTitle)
    try {
      const now = new Date()
      const simpleSeqId = `99${now.getMinutes()}${now.getSeconds()}`
      
      const sessionData = {
        ...payload,
        seqId: Number(simpleSeqId),
        createdAt: serverTimestamp(),
      }
      
      await setDoc(doc(db, 'sessions', payload.id), sessionData)
      console.log('✅ Sessão criada com sucesso no Firestore.')
      return sessionData
    } catch (error) {
      console.error('❌ Erro ao criar sessão:', error)
      throw error
    }
  },

  /**
   * REGISTRO DE CHAMADA EM LOTE (Batch)
   * 🎯 Agora atualiza a coleção unificada 'users' para marcar a última presença.
   */
  async markAttendanceBatch(activeSession, activeList) {
    console.log(`📝 Iniciando registro em lote para ${activeList.length} registros...`)
    try {
      const batch = writeBatch(db)
      const sessionRef = doc(db, 'sessions', activeSession.id)

      let presences = 0
      let absents = 0
      let justified = 0

      activeList.forEach(student => {
        if (student.status) {
          if (student.status === 'present') presences++
          else if (student.status === 'absent') absents++
          else if (student.status === 'justified') justified++

          const recordRef = doc(collection(sessionRef, 'attendances'), student.id)
          batch.set(recordRef, {
            studentId: student.id,
            studentName: student.name,
            status: student.status,
            modality: activeSession.modality,
            date: activeSession.date,
            timestamp: serverTimestamp() 
          })

          if (student.status === 'present') {
            const userRef = doc(db, USERS_COLLECTION, student.id)
            batch.update(userRef, {
              lastAttendanceAt: serverTimestamp(),
              'tech_journey.sessions_since_last_promotion': increment(1),
              updatedAt: serverTimestamp()
            })
          }
        }
      })

      console.log(`📊 Totais da sessão: ${presences} presenças, ${absents} faltas.`)
      
      batch.update(sessionRef, {
        presencasCount: presences,
        faltasCount: absents,
        justificadosCount: justified,
        totalCount: activeList.length,
        isFinished: true,
        updatedAt: serverTimestamp()
      })

      await batch.commit()
      console.log('✅ Lote de presença persistido com sucesso.')
      return true
    } catch (error) {
      console.error('❌ Erro fatal ao salvar lote de chamadas:', error)
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


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
import { COLLECTIONS, SUB_COLLECTIONS, FIELDS } from '../firebase/collections'

const USERS_COLLECTION = COLLECTIONS.USUARIOS

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
        presencasCount: 0,
        faltasCount: 0,
        totalCount: 0,
        [FIELDS.FINALIZADA]: false,
        [FIELDS.CRIADO_EM]: serverTimestamp(),
      }
      
      await setDoc(doc(db, COLLECTIONS.CHAMADAS, payload.id), sessionData)
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
      const sessionRef = doc(db, COLLECTIONS.CHAMADAS, activeSession.id)

      let presences = 0
      let absents = 0
      let justified = 0

      activeList.forEach(student => {
        if (student.status) {
          if (student.status === 'present') presences++
          else if (student.status === 'absent') absents++
          else if (student.status === 'justified') justified++

          const recordRef = doc(collection(sessionRef, SUB_COLLECTIONS.PRESENCAS), student.id)
          batch.set(recordRef, {
            studentId: student.id,
            studentName: student.name,
            [FIELDS.STATUS]: student.status,
            [FIELDS.MODALIDADE]: activeSession.modality,
            [FIELDS.DATA]: activeSession.date,
            timestamp: serverTimestamp() 
          })

          if (student.status === 'present') {
            const userRef = doc(db, USERS_COLLECTION, student.id)
            const JORNADA = FIELDS.JORNADA_TECNICA || 'jornada_tecnica'
            const AULAS = FIELDS.AULAS_DESDE_ULTIMA_GRADUACAO || 'aulas_desde_ultima_graduacao'
            
            batch.set(userRef, {
              lastAttendanceAt: serverTimestamp(),
              ultima_visita: serverTimestamp(),
              total_visitas: increment(1),
              [FIELDS.STATUS]: 'Ativo',
              [`${JORNADA}.${AULAS}`]: increment(1),
              [FIELDS.ATUALIZADO_EM]: serverTimestamp()
            }, { merge: true })
          }
        }
      })

      console.log(`📊 Totais da sessão: ${presences} presenças, ${absents} faltas.`)
      
      const CRIADO_EM = FIELDS.CRIADO_EM || 'criadoEm'
      const now = new Date()
      // Fallback para seqId baseado no horário atual se não houver no payload
      const simpleSeqId = activeSession.seqId || `99${now.getMinutes()}${now.getSeconds()}`

      batch.set(sessionRef, {
        ...activeSession,
        seqId: Number(simpleSeqId),
        presencasCount: presences,
        faltasCount: absents,
        justificadosCount: justified,
        totalCount: activeList.length,
        [FIELDS.FINALIZADA]: true,
        [CRIADO_EM]: serverTimestamp(),
        [FIELDS.ATUALIZADO_EM]: serverTimestamp()
      }, { merge: true })

      console.log('🚀 Iniciando commit do lote de presença...')
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
      const attendancesRef = collection(db, COLLECTIONS.CHAMADAS, sessionId, SUB_COLLECTIONS.PRESENCAS)
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
        collectionGroup(db, SUB_COLLECTIONS.PRESENCAS),
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
      await deleteDoc(doc(db, COLLECTIONS.CHAMADAS, sessionId))
      return true
    } catch (error) {
      console.error('Erro ao deletar sessão:', error)
      throw error
    }
  }
}


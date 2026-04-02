import { db } from '../firebase/config'
import { collection, doc, addDoc, writeBatch, serverTimestamp, runTransaction, getDocs, query, orderBy, limit, collectionGroup, where } from 'firebase/firestore'

export const attendanceService = {
  /**
   * Cria uma nova sessão (aula) configurando um SeqId de forma atômica
   */
  async createSession(payload) {
    try {
      const counterRef = doc(db, 'counters', 'sessions')
      const newSeqId = await runTransaction(db, async (transaction) => {
        const counterSnap = await transaction.get(counterRef)
        const currentCount = counterSnap.exists() ? counterSnap.data().count : 100
        const nextCount = currentCount + 1
        transaction.set(counterRef, { count: nextCount }, { merge: true })
        return nextCount
      })

      const sessionRef = await addDoc(collection(db, 'sessions'), {
        ...payload,
        seqId: newSeqId,
        createdAt: serverTimestamp(),
      })

      return { ...payload, id: sessionRef.id, seqId: newSeqId }
    } catch (error) {
      console.error('Erro ao criar sessão:', error)
      throw error
    }
  },

  /**
   * Registra Múltiplas Chamadas (Assiduidades) dentro da sessão específica usando Sub-coleções
   */
  async markAttendanceBatch(activeSession, activeList) {
    try {
      const batch = writeBatch(db)
      const sessionRef = doc(db, 'sessions', activeSession.id)

      activeList.forEach(student => {
        if (student.status) {
          // Usa o ID do aluno como chave do documento dentro da sub-coleção "attendances"
          const recordRef = doc(collection(sessionRef, 'attendances'), student.id)
          batch.set(recordRef, {
            studentId: student.id,
            studentName: student.name,
            status: student.status,
            modality: activeSession.modality,
            date: activeSession.date,
            timestamp: serverTimestamp() // Usado pela Collection-group para calcular faltas
          })

          // Se a marcação for de Presença, atualiza o perfil do aluno com a última chamada
          if (student.status === 'present') {
            const studentRef = doc(db, 'students', student.id)
            batch.update(studentRef, {
              lastAttendanceAt: serverTimestamp()
            })
          }
        }
      })

      await batch.commit()
      return true
    } catch (error) {
      console.error('Erro ao salvar lote de chamadas na sub-coleção:', error)
      throw error
    }
  },

  /**
   * Busca as presenças de uma determinada sessão/aula (Para repovoamento visual)
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
      console.error('Erro ao buscar presenças da sessão em:', sessionId, error)
      throw error
    }
  },

  /**
   * Dashboard Global Query: Busca a última aula registrada para determinado aluno em qualquer sessão.
   */
  async getLastAttendance(studentId) {
    try {
      // Usa Collection-Group para varrer "attendances" em qualquer lugar da árvore Firebase
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
      console.error('Erro ao buscar a ultima presença (CollectionGroup):', error)
      throw error
    }
  }
}

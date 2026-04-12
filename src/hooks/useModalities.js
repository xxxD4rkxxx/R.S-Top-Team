import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, query, orderBy,
  addDoc, updateDoc, doc, serverTimestamp, setDoc,
  getDocs, deleteDoc
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useStudents } from './useStudents'

const COLLECTION_MODALITIES = 'modalities'

/**
 * Hook para gerenciar Modalidades e Turmas.
 */
export function useModalities() {
  const [modalities, setModalities] = useState([])
  const [loading, setLoading] = useState(true)
  const { students } = useStudents()

  useEffect(() => {
    const q = query(collection(db, COLLECTION_MODALITIES), orderBy('createdAt', 'desc'))

    const unsub = onSnapshot(q, async (snap) => {
      try {
        const modalitiesData = await Promise.all(
          snap.docs.map(async (d) => {
            const modality = { id: d.id, ...d.data() }
            const turmasSnap = await getDocs(
              collection(db, COLLECTION_MODALITIES, d.id, 'turmas')
            )
            modality.turmas = turmasSnap.docs.map(td => ({ id: td.id, ...td.data() }))
            return modality
          })
        )
        setModalities(modalitiesData)
      } catch (err) {
        console.error('Erro ao carregar turmas das modalidades:', err)
      } finally {
        setLoading(false)
      }
    }, (err) => {
      console.error('Erro ao carregar modalidades:', err)
      setLoading(false)
    })

    return unsub
  }, [])

  const addModality = async (data) => {
    const { initialClass, ...modalityData } = data
    const documentId = modalityData.name.trim()
    const docRef = doc(db, COLLECTION_MODALITIES, documentId)
    
    const newModality = {
      ...modalityData,
      status: modalityData.status || 'ativo',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    
    await setDoc(docRef, newModality)
    if (initialClass) {
      await addClass(documentId, initialClass)
    }
    return documentId
  }

  const updateModality = async (id, data) => {
    const ref = doc(db, COLLECTION_MODALITIES, id)
    await updateDoc(ref, {
      ...data,
      updatedAt: serverTimestamp()
    })
  }

  /**
   * Remove a modalidade dos alunos e os inativa se ficarem sem nenhuma.
   */
  const cleanupStudents = async (modalityId) => {
    // Buscamos a modalidade real para saber o nome exibido atual (caso o ID seja diferente do nome)
    const modDoc = (modalities || []).find(m => m && m.id === modalityId)
    const modName = modDoc?.name || modalityId

    const affectedStudents = (students || []).filter(s => 
      s && (s.modality === modName || s.modality === modalityId || 
      (Array.isArray(s.modalities) && (s.modalities.includes(modName) || s.modalities.includes(modalityId))))
    )

    if (affectedStudents.length === 0) return

    console.log(`🧹 Limpando modalidade '${modName}' de ${affectedStudents.length} alunos...`)

    const updates = affectedStudents.map(student => {
      const studentRef = doc(db, 'users', student.id)
      const currentModalities = Array.isArray(student.modalities) ? student.modalities : [student.modality].filter(Boolean)
      
      // Remove tanto pelo nome quanto pelo ID por segurança
      const newModalities = currentModalities.filter(m => m !== modName && m !== modalityId)
      
      const payload = {
        modalities: newModalities,
        updatedAt: serverTimestamp()
      }

      // Se não sobrou nenhuma modalidade, inativa o aluno
      if (newModalities.length === 0) {
        payload.status = 'Inativo'
        payload.modality = '--'
      } else {
        // Se a modalidade removida era a "principal", troca pela próxima disponível
        if (student.modality === modName || student.modality === modalityId) {
          payload.modality = newModalities[0]
        }
      }

      return updateDoc(studentRef, payload).catch(err => console.error(`Erro ao atualizar aluno ${student.id}:`, err))
    })

    await Promise.all(updates)
  }

  const toggleModalityStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo'
    await updateModality(id, { status: newStatus })
    if (newStatus === 'inativo') {
      await cleanupStudents(id)
    }
  }

  const addClass = async (modalityId, classData) => {
    const turmasRef = collection(db, COLLECTION_MODALITIES, modalityId, 'turmas')
    await addDoc(turmasRef, {
      ...classData,
      status: 'ativo',
      createdAt: serverTimestamp(),
    })
    await updateModality(modalityId, { updatedAt: serverTimestamp() })
  }

  const updateClass = async (modalityId, classId, data) => {
    const classRef = doc(db, COLLECTION_MODALITIES, modalityId, 'turmas', classId)
    await updateDoc(classRef, {
      ...data,
      updatedAt: serverTimestamp()
    })
    await updateModality(modalityId, { updatedAt: serverTimestamp() })
  }

  const toggleClassStatus = async (modalityId, classId, currentStatus) => {
    const newStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo'
    await updateClass(modalityId, classId, { status: newStatus })
  }

  const deleteClass = async (modalityId, classId) => {
    const classRef = doc(db, COLLECTION_MODALITIES, modalityId, 'turmas', classId)
    await deleteDoc(classRef)
    await updateModality(modalityId, { updatedAt: serverTimestamp() })
  }

  const activeModalitiesList = modalities.filter(m => m.status === 'ativo')
  const activeClassesCount = modalities.reduce((acc, m) => acc + (m.turmas?.filter(t => t.status === 'ativo').length || 0), 0)
  
  let totalCapacity = 0
  let totalEnrolled = 0
  
  modalities.forEach(mod => {
    if (mod.status === 'ativo') {
      const modStudents = students.filter(s => s.modalities?.includes(mod.name) || s.modality === mod.name)
      const modCapacity = mod.turmas?.filter(t => t.status === 'ativo').reduce((acc, t) => acc + (t.capacidade || 0), 0) || 0
      totalEnrolled += modStudents.length
      totalCapacity += modCapacity
    }
  })

  const avgOccupancy = totalCapacity > 0 ? Math.round((totalEnrolled / totalCapacity) * 100) : 0
  const avgStudentsPerClass = activeClassesCount > 0 ? (totalEnrolled / activeClassesCount) : 0

  const kpis = {
    totalModalities: activeModalitiesList.length,
    totalClasses: activeClassesCount,
    avgOccupancy,
    avgStudentsPerClass,
  }

  return {
    modalities,
    loading,
    kpis,
    addModality,
    updateModality,
    toggleModalityStatus,
    addClass,
    updateClass,
    toggleClassStatus,
    deleteClass,
    deleteModality: async (id) => {
      const ref = doc(db, COLLECTION_MODALITIES, id)
      await cleanupStudents(id)
      await deleteDoc(ref)
    }
  }
}

import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, query, orderBy,
  addDoc, updateDoc, doc, serverTimestamp,
  getDocs, deleteDoc
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useStudents } from './useStudents'

const COLLECTION_MODALITIES = 'modalities'

/**
 * Hook para gerenciar Modalidades e Turmas.
 * OTIMIZAÇÃO: subcoleções de turmas agora carregadas em paralelo (Promise.all)
 * em vez de um loop serial com await, eliminando N queries sequenciais.
 */
export function useModalities() {
  const [modalities, setModalities] = useState([])
  const [loading, setLoading] = useState(true)
  const { students } = useStudents()

  useEffect(() => {
    const q = query(collection(db, COLLECTION_MODALITIES), orderBy('createdAt', 'desc'))

    const unsub = onSnapshot(q, async (snap) => {
      try {
        // Busca todas as subcoleções de turmas em paralelo — antes era serial (N+1)
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


  // Função para criar modalidade
  const addModality = async (data) => {
    const { initialClass, ...modalityData } = data
    
    const newModality = {
      ...modalityData,
      status: modalityData.status || 'ativo',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    
    const docRef = await addDoc(collection(db, COLLECTION_MODALITIES), newModality)
    
    // Se houver uma turma inicial, adiciona
    if (initialClass) {
      await addClass(docRef.id, initialClass)
    }
    
    return docRef.id
  }

  // Função para atualizar modalidade
  const updateModality = async (id, data) => {
    const ref = doc(db, COLLECTION_MODALITIES, id)
    await updateDoc(ref, {
      ...data,
      updatedAt: serverTimestamp()
    })
  }

  // Soft delete / Toggle status
  const toggleModalityStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo'
    await updateModality(id, { status: newStatus })
  }

  // --- TURMAS ---

  // Função para adicionar uma nova turma a uma modalidade
  const addClass = async (modalityId, classData) => {
    const turmasRef = collection(db, COLLECTION_MODALITIES, modalityId, 'turmas')
    await addDoc(turmasRef, {
      ...classData,
      status: 'ativo',
      createdAt: serverTimestamp(),
    })
    // Força atualização da modalidade pai para disparar o onSnapshot
    await updateModality(modalityId, { updatedAt: serverTimestamp() })
  }

  // Função para atualizar dados de uma turma existente
  const updateClass = async (modalityId, classId, data) => {
    const classRef = doc(db, COLLECTION_MODALITIES, modalityId, 'turmas', classId)
    await updateDoc(classRef, {
      ...data,
      updatedAt: serverTimestamp()
    })
    // Força atualização da modalidade pai para disparar o onSnapshot
    await updateModality(modalityId, { updatedAt: serverTimestamp() })
  }

  // Alterna status (Ativo/Inativo) de uma turma
  const toggleClassStatus = async (modalityId, classId, currentStatus) => {
    const newStatus = currentStatus === 'ativo' ? 'inativo' : 'ativo'
    await updateClass(modalityId, classId, { status: newStatus })
  }

  // Remove permanentemente uma turma
  const deleteClass = async (modalityId, classId) => {
    const classRef = doc(db, COLLECTION_MODALITIES, modalityId, 'turmas', classId)
    await deleteDoc(classRef)
    // Força atualização da modalidade pai para disparar o onSnapshot
    await updateModality(modalityId, { updatedAt: serverTimestamp() })
  }

  // KPIs
  const activeModalities = modalities.filter(m => m.status === 'ativo')
  const activeClasses = modalities.reduce((acc, m) => acc + (m.turmas?.filter(t => t.status === 'ativo').length || 0), 0)
  
  // Calculate average occupancy
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
  const avgStudentsPerClass = activeClasses > 0 ? (totalEnrolled / activeClasses) : 0

  const kpis = {
    totalModalities: activeModalities.length,
    totalClasses: activeClasses,
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
      await deleteDoc(ref)
    }
  }
}

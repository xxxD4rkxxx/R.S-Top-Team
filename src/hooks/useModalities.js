import { useState, useEffect } from 'react'
import {
  collection, onSnapshot, query, orderBy,
  addDoc, updateDoc, doc, serverTimestamp, setDoc,
  getDocs, deleteDoc
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { COLLECTIONS, SUB_COLLECTIONS } from '../firebase/collections'
import { useStudents } from './useStudents'

const COLLECTION_MODALITIES = COLLECTIONS.MODALIDADES

/**
 * Hook para gerenciar Modalidades e Turmas.
 */
// ── Cache em memória (Singleton) ───────────────────────────────────────────────
let _cachedModalities = null
let _activeModalityListener = null
let _modalitySubscribers = []
let _isModalityLoading = true

function subscribeToModalities(callback) {
  _modalitySubscribers.push(callback)

  if (_cachedModalities) {
    callback(_cachedModalities, false)
  }

  if (!_activeModalityListener) {
    const q = query(collection(db, COLLECTION_MODALITIES), orderBy('createdAt', 'desc'))

    _activeModalityListener = onSnapshot(q, async (snap) => {
      try {
        const modalitiesData = await Promise.all(
          snap.docs.map(async (d) => {
            const modality = { id: d.id, ...d.data() }
            const turmasSnap = await getDocs(
              collection(db, COLLECTION_MODALITIES, d.id, SUB_COLLECTIONS.TURMAS)
            )
            modality.turmas = turmasSnap.docs.map(td => ({ id: td.id, ...td.data() }))
            return modality
          })
        )
        _cachedModalities = modalitiesData
        _isModalityLoading = false
        _modalitySubscribers.forEach(cb => cb(modalitiesData, false))
      } catch (err) {
        console.error('Erro no canal modalities:', err)
        _isModalityLoading = false
        _modalitySubscribers.forEach(cb => cb([], false))
      }
    }, (err) => {
      console.error('Erro fatal no listener de modalidades:', err)
      _isModalityLoading = false
      _modalitySubscribers.forEach(cb => cb([], false))
    })
  }

  return () => {
    _modalitySubscribers = _modalitySubscribers.filter(cb => cb !== callback)
    if (_modalitySubscribers.length === 0 && _activeModalityListener) {
      _activeModalityListener()
      _activeModalityListener = null
      _isModalityLoading = true
    }
  }
}

export function useModalities() {
  const [modalities, setModalities] = useState(_cachedModalities || [])
  const [loading, setLoading] = useState(_isModalityLoading)
  const { students } = useStudents()

  useEffect(() => {
    const unsub = subscribeToModalities((data, isLoading) => {
      setModalities(data)
      setLoading(isLoading)
    })
    return unsub
  }, [])

  /**
   * Sanitiza o nome para ser usado como ID de documento no Firestore.
   * Remove barras e caracteres que podem quebrar a estrutura de pastas do DB.
   */
  const slugify = (text) => {
    return text
      .toString()
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .replace(/[^a-z0-9 -]/g, '')    // Remove caracteres especiais (incluindo /)
      .replace(/\s+/g, '-')           // Troca espaços por -
      .replace(/-+/g, '-')            // Evita múltiplos -
  }

  const addModality = async (data) => {
    const { initialClass, ...modalityData } = data
    // Sanitizamos o ID para evitar erro "não está indo" com nomes como "A / B"
    const documentId = slugify(modalityData.name)
    const docRef = doc(db, COLLECTION_MODALITIES, documentId)
    
    const newModality = {
      ...modalityData,
      status: modalityData.status || 'ativo',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
    
    await setDoc(docRef, newModality)
    if (initialClass) {
      // Passamos o ID sanitizado para a criação da turma
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
      const studentRef = doc(db, COLLECTIONS.USUARIOS, student.id)
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
    const turmasRef = collection(db, COLLECTION_MODALITIES, modalityId, SUB_COLLECTIONS.TURMAS)
    await addDoc(turmasRef, {
      ...classData,
      status: 'ativo',
      createdAt: serverTimestamp(),
    })
    await updateModality(modalityId, { updatedAt: serverTimestamp() })
  }

  const updateClass = async (modalityId, classId, data) => {
    const classRef = doc(db, COLLECTION_MODALITIES, modalityId, SUB_COLLECTIONS.TURMAS, classId)
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
    const classRef = doc(db, COLLECTION_MODALITIES, modalityId, SUB_COLLECTIONS.TURMAS, classId)
    await deleteDoc(classRef)
    await updateModality(modalityId, { updatedAt: serverTimestamp() })
  }

  const activeModalitiesList = modalities.filter(m => m.status === 'ativo')
  const activeClassesCount = modalities.reduce((acc, m) => acc + (m.turmas?.filter(t => t.status === 'ativo').length || 0), 0)
  
  let totalCapacity = 0
  let totalEnrolled = 0
  
  modalities.forEach(mod => {
    if (mod.status === 'ativo') {
      // REGRA: Se só existe 1 modalidade, ela assume todos os alunos
      const isSingleModality = activeModalitiesList.length === 1
      
      const modStudents = isSingleModality 
        ? students.filter(s => s.status === 'Ativo')
        : students.filter(s => s.modalities?.includes(mod.name) || s.modality === mod.name)
        
      const modCapacity = mod.turmas?.filter(t => t.status === 'ativo').reduce((acc, t) => acc + (t.capacidade || 0), 0) || 0
      
      // Anexamos a contagem real ao objeto da modalidade para uso nos cards da UI
      mod.studentCount = modStudents.length
      
      // REGRA PARA TURMAS: Se só existe 1 turma na modalidade, ela leva todos os alunos
      if (mod.turmas && mod.turmas.length === 1) {
        mod.turmas[0].enrolledCount = modStudents.length
      } else if (mod.turmas) {
        // Se houver mais de uma, aqui poderíamos adicionar lógica de divisão por horário,
        // mas por enquanto mantemos a contagem individual se já existir.
        mod.turmas.forEach(t => {
            // Se a turma não tem contador, inicializamos para não dar erro visual
            if (t.enrolledCount === undefined) t.enrolledCount = 0
        })
      }
      
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

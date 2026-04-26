import { useState, useEffect, useMemo } from 'react'
import { db } from '../firebase/config'
import { 
  collection, query, onSnapshot, 
  setDoc, doc, updateDoc, deleteDoc, 
  serverTimestamp, collectionGroup, arrayUnion 
} from 'firebase/firestore'
import { COLLECTIONS, SUB_COLLECTIONS } from '../firebase/collections'

/**
 * Hook OTIMIZADO para gerenciar modalidades e turmas.
 * Melhoras:
 * 1. Cache Singleton para navegação instantânea.
 * 2. Busca de turmas via collectionGroup (eliminando N queries).
 * 3. Ordenação em memória para suportar updates otimistas (evita o bug do 'vazio').
 * 4. KPIs calculados em tempo real.
 */

let _cachedModalities = null
let _cachedTurmas = null
let _modalitiesListeners = []
let _isGlobalSubscribed = false

export function useModalities() {
  const [modalities, setModalities] = useState(_cachedModalities || [])
  const [turmas, setTurmas] = useState(_cachedTurmas || [])
  const [loading, setLoading] = useState(!_cachedModalities)

  useEffect(() => {
    // Adiciona o setter à lista de ouvintes
    const listener = { setModalities, setTurmas, setLoading }
    _modalitiesListeners.push(listener)

    if (!_isGlobalSubscribed) {
      _isGlobalSubscribed = true
      console.log('📡 Iniciando Real-time Monitor (Modalidades + Turmas)...')

      // 1. Monitor de Modalidades
      const qMods = collection(db, COLLECTIONS.MODALIDADES)
      const unsubMods = onSnapshot(qMods, (snap) => {
        const data = snap.docs.map(d => ({ 
          id: d.id, 
          ...d.data(),
          _sortKey: d.data().createdAt?.toMillis() || Date.now()
        }))
        
        data.sort((a, b) => b._sortKey - a._sortKey)

        _cachedModalities = data
        _modalitiesListeners.forEach(l => {
          l.setModalities(data)
          l.setLoading(false)
        })
      }, (err) => {
        console.error('❌ Erro ao monitorar modalidades:', err)
        _modalitiesListeners.forEach(l => l.setLoading(false))
      })

      // 2. Monitor de Todas as Turmas (via collectionGroup)
      const qTurmas = collectionGroup(db, SUB_COLLECTIONS.TURMAS)
      const unsubTurmas = onSnapshot(qTurmas, (snap) => {
        const data = snap.docs.map(d => ({
          id: d.id,
          modalityId: d.ref.parent.parent?.id,
          ...d.data()
        }))
        _cachedTurmas = data
        _modalitiesListeners.forEach(l => l.setTurmas(data))
      }, (err) => {
        console.error('❌ Erro ao monitorar turmas:', err)
      })

      // Cleanup global (raro)
      return () => {
        unsubMods()
        unsubTurmas()
        _isGlobalSubscribed = false
      }
    }

    return () => {
      _modalitiesListeners = _modalitiesListeners.filter(l => l !== listener)
    }
  }, [])

  // ==========================================
  // DADOS ENRIQUECIDOS (Modalidades + Turmas)
  // ==========================================
  const enrichedModalities = useMemo(() => {
    return modalities.map(mod => {
      const modalityTurmas = turmas.filter(t => t.modalityId === mod.id);
      const studentCount = modalityTurmas.reduce((acc, t) => acc + (t.totalAlunos || 0), 0);
      
      return {
        ...mod,
        turmas: modalityTurmas,
        studentCount // 🔥 Dinâmico baseado nas turmas
      };
    });
  }, [modalities, turmas])

  // ==========================================
  // KPIs CALCULADOS
  // ==========================================
  const kpis = useMemo(() => {
    const totalModalities = modalities.length
    const totalClasses = turmas.length
    
    // Média de alunos por turma (Lógica baseada nos dados reais das turmas)
    const totalStudents = turmas.reduce((acc, t) => acc + (t.enrolledCount || 0), 0)
    const avgStudentsPerClass = totalClasses > 0 ? totalStudents / totalClasses : 0
    
    // Ocupação média
    const totalCapacity = turmas.reduce((acc, t) => acc + (t.capacidade || 0), 0)
    const avgOccupancy = totalCapacity > 0 ? Math.round((totalStudents / totalCapacity) * 100) : 0

    return {
      totalModalities,
      totalClasses,
      avgStudentsPerClass,
      avgOccupancy
    }
  }, [modalities, turmas])

  // ==========================================
  // OPERAÇÕES DE ESCRITA
  // ==========================================

  const addModality = async (modalityData) => {
    const slug = modalityData.name.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .replace(/\s+/g, '-') // Espaços para hífens
      .replace(/[^\w-]/g, '') // Remover caracteres especiais remanescentes
    const modRef = doc(db, COLLECTIONS.MODALIDADES, slug)
    const capacity = modalityData.capacity === '' || modalityData.capacity === 0 ? null : Number(modalityData.capacity)

    // Extrair initialClass para criação atômica
    const { initialClass, ...pureData } = modalityData

    await setDoc(modRef, {
      ...pureData,
      id: slug,
      capacity,
      status: 'ativo',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })

    // Se houver uma turma configurada no menu de criação, salva ela agora
    if (initialClass) {
      await addClass(slug, initialClass)
    }

    return slug
  }

  const updateModality = async (id, data) => {
    const modRef = doc(db, COLLECTIONS.MODALIDADES, id)
    const capacity = data.capacity === '' || data.capacity === 0 ? null : Number(data.capacity)
    
    await updateDoc(modRef, {
      ...data,
      capacity,
      updatedAt: serverTimestamp()
    })
  }

  const toggleModalityStatus = async (id, currentStatus) => {
    const modRef = doc(db, COLLECTIONS.MODALIDADES, id)
    await updateDoc(modRef, {
      status: currentStatus === 'ativo' ? 'inativo' : 'ativo',
      updatedAt: serverTimestamp()
    })
  }

  const deleteModality = async (id) => {
    await deleteDoc(doc(db, COLLECTIONS.MODALIDADES, id))
  }

  // ALIASES PARA COMPATIBILIDADE COM O COMPONENTE (addClass -> addTurma, etc)
  const addClass = async (modalityId, data) => {
    // Gerar ID baseado no nome (slugify)
    const slug = data.name.toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Remover acentos
      .replace(/\s+/g, '-') // Espaços para hífens
      .replace(/[^\w-]/g, '') // Remover caracteres especiais remanescentes

    const classRef = doc(db, COLLECTIONS.MODALIDADES, modalityId, SUB_COLLECTIONS.TURMAS, slug)
    
    await setDoc(classRef, {
      ...data,
      id: slug,
      modalityId,
      createdAt: serverTimestamp()
    })

    // Sincronizar modalidades no perfil dos professores
    await syncProfessorModalities(data.professors || [], modalityId)
  }

  const updateClass = async (modalityId, classId, data) => {
    const classRef = doc(db, COLLECTIONS.MODALIDADES, modalityId, SUB_COLLECTIONS.TURMAS, classId)
    await updateDoc(classRef, {
      ...data,
      updatedAt: serverTimestamp()
    })

    // Sincronizar modalidades no perfil dos professores
    await syncProfessorModalities(data.professors || [], modalityId)
  }

  /**
   * Sincroniza as modalidades no perfil dos professores designados.
   * Adiciona a modalidade ao array 'modalities' de cada professor.
   */
  const syncProfessorModalities = async (professors, modalityId) => {
    if (!professors || professors.length === 0) return

    const modalityDoc = modalities.find(m => m.id === modalityId)
    const modalityName = modalityDoc?.name || modalityId

    try {
      const promises = professors.map(async (p) => {
        if (!p.id) return
        const userRef = doc(db, COLLECTIONS.USUARIOS, p.id)
        
        // Adiciona a modalidade à lista do professor (sem duplicar)
        await updateDoc(userRef, {
          modalities: arrayUnion(modalityName),
          updatedAt: serverTimestamp()
        })
      })

      await Promise.all(promises)
    } catch (err) {
      console.error('❌ Erro ao sincronizar modalidades do professor:', err)
    }
  }

  const deleteClass = async (modalityId, classId) => {
    const classRef = doc(db, COLLECTIONS.MODALIDADES, modalityId, SUB_COLLECTIONS.TURMAS, classId)
    await deleteDoc(classRef)
  }

  const getTurmasByModality = (modId) => {
    return turmas.filter(t => t.modalityId === modId)
  }

  return {
    modalities: enrichedModalities,
    allTurmas: turmas,
    getTurmasByModality,
    loading,
    kpis,
    addModality,
    updateModality,
    toggleModalityStatus,
    deleteModality,
    addClass,
    updateClass,
    deleteClass,
    // Legado
    addTurma: addClass,
    updateTurma: updateClass,
    deleteTurma: deleteClass
  }
}

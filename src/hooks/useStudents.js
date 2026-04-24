/**
 * Hook para gerenciar as operações de Alunos na arquitetura unificada.
 * Agora todas as mutações são direcionadas para a coleção 'users' com o papel 'aluno'.
 */
import { useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  updateDoc,
  setDoc,
  query,
  where,
  getDocs
} from 'firebase/firestore'
import { COLLECTIONS, FIELDS } from '../firebase/collections'
import { updatePassword } from 'firebase/auth'
import { useStudentsContext } from '../context/StudentsContext'
import { sanitizeString } from '../utils/security'

// Nome da coleção unificada
const USERS_COLLECTION = COLLECTIONS.USUARIOS

/**
 * Normaliza o ID do usuário (E-mail ou Nome sanitizado).
 */
const sanitizeId = (identifier) => {
  if (!identifier) return 'student_' + Math.random().toString(36).substring(7)
  const safeId = identifier.toLowerCase().trim()
    .replace(/[@.]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')

  return `${safeId}@rstopteam.internal`
}

/**
 * Gera iniciais a partir do nome completo para o avatar visual.
 */
function buildInitials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function useStudents() {
  // Obtém a lista de alunos filtrada do contexto global (que já lê da coleção 'users')
  const { students, isLoadingStudents } = useStudentsContext()
  const [isUpdating, setIsUpdating] = useState(false)

  /**
   * Atualiza o status de presença rápida do aluno (Marcando presença no dia).
   */
  async function updateStudentStatus(id, newStatus) {
    const student = students.find(s => s.id === id)
    const payload = {
      [FIELDS.STATUS]: newStatus ?? null,
      lastStatusAt: serverTimestamp(),
    }

    if (newStatus === 'present') {
      payload.lastAttendanceAt = serverTimestamp()
    }

    // Atualiza o documento na coleção unificada 'users'
    await updateDoc(doc(db, USERS_COLLECTION, id), payload)

    // Registra no histórico de chamadas (coleção separada para relatórios)
    if (newStatus) {
      await addDoc(collection(db, COLLECTIONS.PRESENCAS_LOG), {
        studentId: id,
        studentName: student?.name || id,
        date: serverTimestamp(),
        status: newStatus,
        modality: student?.modality || 'Jiu Jitsu'
      })
    }
  }

  /**
   * Altera o status administrativo do aluno (Ativo, Inativo, Suspenso).
   */
  async function changeStudentStatus(id, newStatus, extra = {}) {
    const payload = {
      [FIELDS.STATUS]: newStatus,
      lastStatusAt: serverTimestamp(),
    }
    if (extra.reason !== undefined) payload.statusReason = extra.reason
    if (extra.returnDate !== undefined) payload.statusReturnDate = extra.returnDate

    await updateDoc(doc(db, USERS_COLLECTION, id), payload)
  }

  /**
   * Remove permanentemente o aluno de todas as coleções do Firebase.
   * Hardened para evitar a "ressurreição" de dados legados.
   */
  async function deleteStudent(studentId) {
    if (!studentId) {
      console.error('❌ Erro: Tentativa de deletar aluno sem ID válido.')
      return
    }

    console.log('🗑️ Iniciando Deleção Exhaustiva do Aluno:', studentId)

    // 1. Localizar o aluno no nosso estado para obter dados extras (e-mail)
    const target = students.find(s => s.id === studentId)
    const email = target?.email || (studentId.includes('@') ? studentId : null)

    // A. Deleção Primária (Imediata)
    const safeDelete = async (ref) => {
      try {
        await deleteDoc(ref)
      } catch (e) {
        console.warn(`⚠️ Registro não encontrado ou bloqueado: ${ref.path}`)
      }
    }

    try {
      await Promise.all([
        safeDelete(doc(db, COLLECTIONS.USUARIOS, studentId)),
        safeDelete(doc(db, COLLECTIONS.USUARIOS, studentId, 'privacidade', 'segredos'))
      ])
      console.log('✅ Registro principal do aluno removido.')
    } catch (e) {
      console.error('Falha crítica na deleção do aluno:', e)
      throw e
    }

    // B. Limpeza de Legados em Background (Non-blocking)
    const bgCleanup = async () => {
      const tasks = []

      if (email) {
        const cleanEmail = email.toLowerCase().trim()
        tasks.push(deleteDoc(doc(db, COLLECTIONS.USUARIOS, cleanEmail)))
        tasks.push(deleteDoc(doc(db, 'users', cleanEmail, 'privacy', 'secrets')))
        tasks.push(deleteDoc(doc(db, 'students', cleanEmail)))
        tasks.push(deleteDoc(doc(db, 'students', cleanEmail, 'privacy', 'secrets')))
        tasks.push(deleteDoc(doc(db, 'equipe', cleanEmail)))
        tasks.push(deleteDoc(doc(db, 'equipe', cleanEmail, 'privacy', 'secrets')))

        try {
          const qStudents = query(collection(db, 'students'), where('email', '==', cleanEmail))
          const qEquipe = query(collection(db, 'equipe'), where('email', '==', cleanEmail))

          const [snapS, snapE] = await Promise.all([getDocs(qStudents), getDocs(qEquipe)])
          snapS.forEach(d => tasks.push(deleteDoc(d.ref)))
          snapE.forEach(d => tasks.push(deleteDoc(d.ref)))
        } catch (e) {
          console.warn('Erro na busca de legados:', e)
        }
      }

      if (target?.name) {
        tasks.push(deleteDoc(doc(db, 'students', target.name)))
        tasks.push(deleteDoc(doc(db, 'students', target.name, 'privacy', 'secrets')))
      }

      await Promise.allSettled(tasks)
      console.log('Background cleanup finished for student:', studentId)
      console.warn('⚠️ AVISO DE SEGURANÇA: O Firebase Client SDK não permite excluir usuários de terceiros do Authentication. Por favor, remova o e-mail do aluno manualmente no Firebase Console para evitar conflitos de PIN.')
    }

    bgCleanup()
  }

  /**
   * ADICIONAR NOVO ALUNO
   * 🎯 Agora cria o documento na coleção 'users' com 'roles.aluno: true'.
   */
  async function addStudent(newStudent, modality, options = {}) {
    const { isVisitor = false, belt = 'white' } = options

    // Lógica de Detecção de Turma Única
    let finalModalities = []
    
    // Se não veio modalidade, tentamos descobrir a padrão
    if (!modality || (Array.isArray(modality) && modality.length === 0)) {
      try {
        const modsSnap = await getDocs(query(collection(db, COLLECTIONS.MODALIDADES), where('status', '==', 'ativo')))
        const activeMods = modsSnap.docs.map(d => d.data().name || d.id)
        
        if (activeMods.length === 1) {
          finalModalities = [activeMods[0]]
        } else {
          finalModalities = ['Jiu Jitsu'] // Fallback legatário
        }
      } catch (err) {
        finalModalities = ['Jiu Jitsu']
      }
    } else if (Array.isArray(modality)) {
      finalModalities = modality
    } else {
      const normalized = modality.toLowerCase()
      finalModalities = normalized === 'ambos' ? ['Jiu Jitsu', 'Boxe'] : [normalized === 'boxe' ? 'Boxe' : 'Jiu Jitsu']
    }

    // Lógica de faixa padrão
    const hasBJJ = finalModalities.some(m => m.toLowerCase().includes('jiu') || m.toLowerCase().includes('bjj'))
    const beltFinal = hasBJJ ? (belt || 'white') : 'none'

    const payload = {
      [FIELDS.NOME]: sanitizeString(newStudent.name),
      initials: buildInitials(newStudent.name),
      belt: beltFinal,
      [FIELDS.MODALIDADE]: finalModalities[0] || 'Jiu Jitsu',
      [FIELDS.MODALIDADES]: finalModalities,
      stripes: 0,
      [FIELDS.STATUS]: 'Ativo',
      isVisitor,
      photo: null,
      [FIELDS.EMAIL]: (newStudent.email || '').toLowerCase().trim(),
      [FIELDS.TELEFONE]: newStudent.phone || '',
      emergency: newStudent.emergency || '',
      medical: newStudent.medical || '',
      ageCategory: newStudent.ageCategory || 'Adulto',
      gender: newStudent.gender || 'Masculino',
      parentName: newStudent.parentName || '',
      parentPhone: newStudent.parentPhone || '',
      isPaymentExempt: newStudent.isPaymentExempt || false,
      planValue: newStudent.planValue || '',
      [FIELDS.PIN]: newStudent.pin || Math.floor(100000 + Math.random() * 900000).toString(),
      [FIELDS.PAPEIS]: isVisitor ? { visitante: true } : { aluno: true },
      [FIELDS.JORNADA_TECNICA]: {
        [FIELDS.FAIXA_ATUAL]: beltFinal,
        [FIELDS.GRAUS_ATUAIS]: 0,
        [FIELDS.AULAS_DESDE_ULTIMA_GRADUACAO]: 0,
        [FIELDS.DATA_ULTIMA_GRADUACAO]: serverTimestamp(),
        [FIELDS.HISTORICO]: [{
          belt: beltFinal,
          date: new Date(),
          reason: 'Ingresso na Academia'
        }]
      },
      [FIELDS.CRIADO_EM]: serverTimestamp(),
      [FIELDS.ATUALIZADO_EM]: serverTimestamp(),
    }

    // Define o ID do documento baseado no e-mail (se existir) ou nome usando a identidade unificada
    const docId = sanitizeId(newStudent.email || newStudent.name)
    const emailKey = (newStudent.email || '').toLowerCase().trim()

    // 🔒 RECUPERAÇÃO DE PIN (MEMÓRIA DE SEGURANÇA)
    // Se o aluno já existiu antes, puxamos o PIN antigo para manter sincronia com o Google Auth
    if (emailKey) {
      try {
        const vaultRef = doc(db, COLLECTIONS.COFRE_PINS, emailKey)
        const vaultSnap = await getDoc(vaultRef)

        if (vaultSnap.exists()) {
          console.log('🔐 PIN Antigo recuperado do Cofre para manter sincronia Auth.')
          payload.pin = vaultSnap.data().pin
        } else {
          // Se é novo, registramos no cofre para o futuro
          await setDoc(vaultRef, { pin: payload.pin, createdAt: serverTimestamp() })
        }
      } catch (e) {
        console.warn('⚠️ Falha ao acessar cofre de PINs:', e)
      }
    }

    await setDoc(doc(db, USERS_COLLECTION, docId), payload)

    // 💰 INTEGRAÇÃO FINANCEIRA: Se houver status de pagamento e valor, cria a cobrança inicial
    if (newStudent.initialPaymentStatus && payload.planValue > 0) {
      try {
        const billingRef = collection(db, COLLECTIONS.FATURAMENTO)
        const now = new Date()
        const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
        const refMonth = `${months[now.getMonth()]} / ${now.getFullYear()}`

        await addDoc(billingRef, {
          studentId: docId,
          studentName: payload.name,
          amount: Number(payload.planValue),
          status: newStudent.initialPaymentStatus, // 'paid' ou 'pending'
          dueDate: now.toISOString().split('T')[0], // Hoje
          referenceMonth: refMonth,
          paidAt: newStudent.initialPaymentStatus === 'paid' ? serverTimestamp() : null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          category: 'Mensalidade',
          method: 'Dinheiro', // Default para cadastro manual
          notes: 'Gerado automaticamente no cadastro inicial'
        })
        console.log(`💰 Cobrança inicial (${newStudent.initialPaymentStatus}) gerada para:`, payload.name)
      } catch (err) {
        console.error('⚠️ Erro ao gerar cobrança inicial:', err)
      }
    }
  }

  /**
   * Atualiza dados cadastrais do perfil.
   */
  async function updateStudentProfile(id, data) {
    const payload = { [FIELDS.ATUALIZADO_EM]: serverTimestamp() }

    if (data.name !== undefined) {
      payload[FIELDS.NOME] = sanitizeString(data.name)
      payload.initials = buildInitials(data.name)
    }

    // Mapeamento de campos permitidos para atualização
    const updatableFields = [
      { old: 'belt', new: 'belt' },
      { old: 'stripes', new: 'stripes' },
      { old: 'email', new: FIELDS.EMAIL },
      { old: 'phone', new: FIELDS.TELEFONE },
      { old: 'pin', new: FIELDS.PIN },
      { old: 'modality', new: FIELDS.MODALIDADE },
      { old: 'modalities', new: FIELDS.MODALIDADES },
    ]

    updatableFields.forEach(f => {
      if (data[f.old] !== undefined) payload[f.new] = data[f.old]
    })

    // 🔐 SINCRONIZAÇÃO DE SEGURANÇA: Se o próprio aluno estiver alterando o PIN
    if (data.pin !== undefined && auth.currentUser) {
      const emailId = id.includes('@') ? id : (data.email || '')
      if (auth.currentUser.email === emailId.toLowerCase().trim()) {
        try {
          const securePIN = data.pin.length >= 6 ? data.pin : data.pin.padEnd(6, '0')
          await updatePassword(auth.currentUser, securePIN)
          console.log('✅ PIN do Aluno sincronizado no Authentication.')
        } catch (e) {
          console.warn('⚠️ Sincronização direta falhou. O sistema JIT resolverá no próximo login.')
        }
      }
    }

    // 🔒 ATUALIZA COFRE: Garante que a memória de PIN esteja sempre atualizada
    if (data.pin !== undefined) {
      try {
        const student = students.find(s => s.id === id)
        const emailKey = (data.email || student?.email || '').toLowerCase().trim()
        if (emailKey) {
          const vaultRef = doc(db, COLLECTIONS.COFRE_PINS, emailKey)
          await setDoc(vaultRef, { pin: data.pin, updatedAt: serverTimestamp() }, { merge: true })
        }
      } catch (e) {
        console.warn('⚠️ Erro ao atualizar cofre durante edição:', e)
      }
    }

    await updateDoc(doc(db, USERS_COLLECTION, id), payload)
  }

  return {
    students,
    isLoadingStudents,
    isLoading: isLoadingStudents,
    updateStudentStatus,
    changeStudentStatus,
    deleteStudent,
    addStudent,
    updateStudentProfile,
  }
}


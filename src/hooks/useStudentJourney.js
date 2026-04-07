import { useState, useEffect, useMemo } from 'react'
import { useStudents } from './useStudents'
import { db } from '../firebase/config'
import { collection, getDocs } from 'firebase/firestore'
import { beltConfig as defaultBelts } from '../data/beltConfig'

/**
 * Hook de Inteligência da Jornada Técnica (SaaS Premium)
 * Gerencia o cálculo dinâmico de progressão, métricas e histórico baseado em regras de negócio.
 */
export function useStudentJourney() {
  const { students, loading: studentsLoading } = useStudents()
  const [configs, setConfigs] = useState({})
  const [configsLoading, setConfigsLoading] = useState(true)

  // 1. Carrega as configurações de graduação (Regras por Modalidade/Categoria)
  useEffect(() => {
    async function fetchConfigs() {
      try {
        const snap = await getDocs(collection(db, 'tech_journey_configs'))
        const data = {}
        snap.forEach(d => { data[d.id] = d.data() })
        setConfigs(data)
      } catch (err) {
        console.error('Erro ao carregar regras de jornada:', err)
      } finally {
        setConfigsLoading(false)
      }
    }
    fetchConfigs()
  }, [])

  // 2. Processa a inteligência de dados da Jornada
  const journeyStats = useMemo(() => {
    if (!students || studentsLoading || configsLoading) {
      return { 
        all: [],
        metrics: { totalGraduated: 0, upcomingEvaluations: 0, recentChanges: 0 }
      }
    }

    const now = new Date()
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(now.getDate() - 30)

    const processed = students.reduce((acc, student) => {
      // Filtragem Logística: Ignora visitantes e inativos
      if (student.isVisitor || student.status === 'Inativo') return acc

      // Cálculo de Datas (Última Promoção)
      const lastPromoDate = student.tech_journey?.last_promotion_date?.toDate?.() || 
                            student.createdAt?.toDate?.() || 
                            new Date(student.createdAt) || 
                            now
      
      const diffTime = Math.abs(now - lastPromoDate)
      const monthsInBelt = Math.max(Math.floor(diffTime / (1000 * 60 * 60 * 24 * 30.44)), 0)
      
      const wasRecent = lastPromoDate >= thirtyDaysAgo

      // LÓGICA DINÂMICA DE PROGRESSÃO (O Cérebro)
      // Tenta encontrar a regra específica para a modalidade e categoria do aluno
      const modalityId = student.modalityId || (student.modalities?.[0] || 'geral')
      const category = student.ageCategory || 'Adulto'
      const configKey = `${modalityId}_${category}`
      const rule = configs[configKey]

      let progression = 0
      let status = 'Em progresso'
      let minMonthsRequired = 0

      if (rule && rule.belts) {
        // Busca a configuração da faixa atual do aluno nas regras
        const beltRule = rule.belts.find(b => b.label === (defaultBelts[student.belt]?.label || student.belt))
        if (beltRule) {
          minMonthsRequired = beltRule.minMonths || 0
          if (minMonthsRequired > 0) {
            progression = Math.min(Math.round((monthsInBelt / minMonthsRequired) * 100), 100)
          }
        }
      } else {
        // Fallback genérico para quando não há regra cadastrada
        minMonthsRequired = defaultBelts[student.belt]?.minMonths || 6
        progression = Math.min(Math.round((monthsInBelt / minMonthsRequired) * 100), 100)
      }

      // Determinação de Status Visual
      if (progression >= 100) status = 'Avaliação pendente'
      else if (progression > 80) status = 'Próximo'
      else status = 'Em progresso'

      const entry = {
        ...student,
        graduation: {
          lastPromotionDate: lastPromoDate,
          monthsInBelt,
          progression,
          status,
          wasRecent,
          minMonthsRequired,
          joinedAt: lastPromoDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })
        }
      }

      acc._all.push(entry)
      if (student.belt && student.belt !== 'none') acc._graduatedCount++
      if (wasRecent) acc._recentCount++
      if (progression >= 90) acc._upcomingCount++
      
      return acc
    }, { _all: [], _graduatedCount: 0, _recentCount: 0, _upcomingCount: 0 })

    return {
      all: processed._all,
      totalGraduated: processed._graduatedCount,
      dueForAssessment: processed._upcomingCount,
      recentPromotions: processed._recentCount
    }
  }, [students, studentsLoading, configs, configsLoading])

  return {
    ...journeyStats,
    loading: studentsLoading || configsLoading
  }
}

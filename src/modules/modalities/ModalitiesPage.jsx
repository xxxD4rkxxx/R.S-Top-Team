// RESUMO: Gestão de Modalidades e Turmas.
// Permite cadastrar modalidades (Jiu Jitsu, Muay Thai, etc.) e vincular turmas (horários, dias, professores).
// Inclui KPIs de ocupação e capacidade para otimização da academia.
import React, { useState, useMemo } from 'react'
import { 
  Plus, Search, Layers, 
  GraduationCap, Users, TrendingUp, X
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useModalities } from '../../hooks/useModalities'
import ModalityCard from './components/ModalityCard'
import ModalityModal from './components/ModalityModal'
import ClassModal from './components/ClassModal'
import PageHeader from '../../components/shared/PageHeader'
import MobileHeader from '../../components/navigation/MobileHeader'
import KPICard from '../../components/shared/KPICard'

export default function ModalitiesPage() {
  const { 
    modalities, loading, kpis, 
    addModality, updateModality, toggleModalityStatus, deleteModality,
    addClass, updateClass, deleteClass
  } = useModalities()

  const [searchTerm, setSearchTerm] = useState('')
  const [isModalityModalOpen, setIsModalityModalOpen] = useState(false)
  const [isClassModalOpen, setIsClassModalOpen] = useState(false)
  const [editingModality, setEditingModality] = useState(null)
  const [editingClass, setEditingClass] = useState(null)
  const [activeModalityId, setActiveModalityId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [showMobileSearch, setShowMobileSearch] = useState(false)

  const handleToggleExpand = (id) => {
    const stringId = String(id)
    setExpandedId(prev => prev === stringId ? null : stringId)
  }

  const handleAddModality = () => {
    setEditingModality(null)
    setIsModalityModalOpen(true)
  }

  const handleEditModality = (modality) => {
    setEditingModality(modality)
    setIsModalityModalOpen(true)
  }

  const handleSaveModality = async (data) => {
    if (editingModality) await updateModality(editingModality.id, data)
    else await addModality(data)
    setIsModalityModalOpen(false)
  }

  const handleDeleteModality = async (id) => {
    if (confirm('Deseja realmente excluir esta modalidade?')) await deleteModality(id)
  }

  const handleAddClass = (modalityId) => {
    setActiveModalityId(modalityId)
    setEditingClass(null)
    setIsClassModalOpen(true)
  }

  const handleEditClass = (modalityId, turma) => {
    setActiveModalityId(modalityId)
    setEditingClass(turma)
    setIsClassModalOpen(true)
  }

  const handleSaveClass = async (data) => {
    if (editingClass) await updateClass(activeModalityId, editingClass.id, data)
    else await addClass(activeModalityId, data)
    setIsClassModalOpen(false)
  }

  const handleDeleteClass = async (modalityId, classId) => {
    if (confirm('Deseja realmente excluir esta turma?')) await deleteClass(modalityId, classId)
  }

  const filteredModalities = useMemo(() => 
    modalities.filter(m => m.name.toLowerCase().includes(searchTerm.toLowerCase())),
    [modalities, searchTerm]
  )

  return (
    <div className="flex flex-col flex-1 w-full min-h-dvh bg-black overflow-x-hidden">
      <MobileHeader 
        title="Modalidades" 
        showSearch 
        onSearch={() => setShowMobileSearch(!showMobileSearch)}
        actions={
          <button 
            onClick={handleAddModality}
            className="p-2.5 rounded-xl bg-primary text-black active:scale-90 transition-transform shadow-lg shadow-primary/20"
          >
            <Plus size={20} strokeWidth={3} />
          </button>
        }
      />

      <PageHeader
        icon={Layers}
        title="MODALIDADES E TURMAS"
        subtitle="Gestão Operacional"
        extra={
          <button 
            onClick={handleAddModality}
            className="btn-primary flex items-center gap-2 px-5 py-2.5 text-[11px] font-bold uppercase tracking-widest shadow-xl group"
          >
            <Plus size={16} className="group-hover:rotate-90 transition-transform" /> NOVA MODALIDADE
          </button>
        }
      />

      <main className="flex-1 px-4 md:px-6 py-6 space-y-6 w-full pb-20">
        
        {/* Mobile Search Expandable */}
        <AnimatePresence>
          {showMobileSearch && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="md:hidden overflow-hidden">
              <div className="relative mb-4">
                <input 
                  autoFocus value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar modalidade..."
                  className="w-full bg-white/[0.05] border border-white/10 rounded-xl py-3.5 pl-12 pr-4 text-white text-sm"
                />
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                {searchTerm && <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30"><X size={18}/></button>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          <KPICard title="Modalidades" value={loading ? '...' : kpis.totalModalities} desc="Ativas no sistema" icon={Layers} iconColor="text-primary" />
          <KPICard title="Turmas" value={loading ? '...' : kpis.totalClasses} desc="Horários cadastrados" icon={GraduationCap} iconColor="text-blue-400" />
          <KPICard title="Média" value={loading ? '...' : kpis.avgStudentsPerClass.toFixed(1)} desc="Alunos por turma" icon={Users} iconColor="text-emerald-400" />
          <KPICard title="Ocupação" value={loading ? '...' : `${kpis.avgOccupancy}%`} desc="Capacidade geral" icon={TrendingUp} iconColor="text-amber-400" />
        </div>

        {/* Desktop Search & Filter */}
        <div className="hidden md:flex gap-4">
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-white transition-colors" size={18} />
            <input type="text" placeholder="Pesquisar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#111] border border-white/5 rounded-xl pl-12 pr-4 py-3.5 text-sm" />
          </div>
        </div>

        {/* Categories / Modalidade List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          {loading ? (
             Array(4).fill(0).map((_, i) => <div key={i} className="h-20 bg-white/5 rounded-[32px] animate-pulse" />)
          ) : filteredModalities.length === 0 ? (
            <div className="py-20 text-center col-span-full border border-dashed border-white/10 rounded-[32px] opacity-20">
               <Layers size={48} className="mx-auto mb-4" />
               <p className="text-xs font-black uppercase tracking-widest">Nenhuma modalidade disponível</p>
            </div>
          ) : (
            filteredModalities.map(modality => (
              <ModalityCard 
                key={modality.id}
                modality={modality}
                isExpanded={expandedId === String(modality.id)}
                onToggleExpand={() => handleToggleExpand(modality.id)}
                onEdit={handleEditModality}
                onDelete={handleDeleteModality}
                onToggleStatus={toggleModalityStatus}
                onAddClass={handleAddClass}
                onEditClass={handleEditClass}
                onDeleteClass={handleDeleteClass}
              />
            ))
          )}
        </div>
      </main>

      {/* MODALS */}
      <ModalityModal 
        isOpen={isModalityModalOpen}
        onClose={() => setIsModalityModalOpen(false)}
        onSave={handleSaveModality}
        editingModality={editingModality}
        onAddClass={handleAddClass}
        onEditClass={handleEditClass}
        onDeleteClass={handleDeleteClass}
      />

      <ClassModal 
        isOpen={isClassModalOpen}
        onClose={() => setIsClassModalOpen(false)}
        onSave={handleSaveClass}
        editingClass={editingClass}
        modalityId={activeModalityId}
      />
    </div>
  )
}


/**
 * UTILITÁRIO DE DATA RESILIENTE (SSoT)
 * 🎯 Resolve o problema: user.createdAt.toDate is not a function
 * 
 * Este utilitário lida com 3 tipos de formatos que o Firebase/JS podem retornar:
 * 1. Timestamp do Firestore (objeto com .toDate())
 * 2. Objeto Date nativo
 * 3. String ISO (após migrações manuais)
 */

export function parseFirestoreDate(value) {
  if (!value) return null
  
  // 1. Se for um Timestamp do Firestore
  if (typeof value.toDate === 'function') {
    return value.toDate()
  }
  
  // 2. Se for uma string ISO ou número (timestamp)
  const parsed = new Date(value)
  
  // 3. Verifica se a data resultante é válida
  if (!isNaN(parsed.getTime())) {
    return parsed
  }
  
  return null
}

/**
 * FORMATAÇÃO DE DATA EM PORTUGUÊS (BR)
 */
export function formatLongDate(date) {
  const d = parseFirestoreDate(date)
  if (!d) return 'DATA INDISPONÍVEL'
  
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}

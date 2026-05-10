export const normalizeText = (text) => {
  if (text === null || text === undefined) return '';
  // Garante que o input seja tratado como string antes de chamar toLowerCase
  const str = typeof text === 'string' ? text : String(text);
  return str.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

export function calculateModalityValue(aluno, modalities) {
  if (!aluno || !modalities) return 0;
  
  // 1. Pular se o aluno for marcado globalmente como isento
  if (aluno.isPaymentExempt) return 0;

  // 2. Se o modo for manual, usa o valor fixo definido no perfil
  if (aluno.billingMode === 'manual') {
    return Number(aluno.manualPlanValue || aluno.planValue) || 0;
  } 

  const normalizedCat = normalizeText(aluno.ageCategory || 'Adulto');
  const modsAluno = Array.isArray(aluno.modalities) ? aluno.modalities : [aluno.modality].filter(Boolean);

  let total = 0;
  modsAluno.forEach(modItem => {
    // Se o item for um objeto (comum em dados legados ou estruturas ricas), extraímos o identificador
    const modIdentifier = (typeof modItem === 'object' && modItem !== null)
      ? (modItem.id || modItem.name || modItem.slug || '')
      : modItem;

    const normalizedSearch = normalizeText(modIdentifier);
    
    // Busca robusta na configuração da modalidade
    const modConfig = modalities.find(m => 
      normalizeText(m.name) === normalizedSearch || 
      normalizeText(m.id) === normalizedSearch ||
      normalizeText(m.slug) === normalizedSearch
    );

    if (modConfig && modConfig.pricing) {
      // Busca robusta da chave de preço (ex: 'kids' ou 'Kids')
      const pricingKey = Object.keys(modConfig.pricing).find(k => normalizeText(k) === normalizedCat);
      
      if (pricingKey) {
        const rule = modConfig.pricing[pricingKey];
        if (rule.enabled) {
          total += Number(rule.price) || 0;
        }
      }
    }
  });

  // Fallback: se não encontrou nada nas modalidades mas tem um planValue legado, usa ele
  if (total === 0 && aluno.planValue) {
    total = Number(aluno.planValue) || 0;
  }

  return total;
}
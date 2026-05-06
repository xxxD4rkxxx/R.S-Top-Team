export const normalizeText = (text) => {
  if (!text) return '';
  return text.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

export function calculateModalityValue(aluno, modalities) {
  const cat = (aluno.ageCategory || 'Adulto').toLowerCase();
  const modsAluno = Array.isArray(aluno.modalities) ? aluno.modalities : [aluno.modality].filter(Boolean);

  let total = 0;
  modsAluno.forEach(modName => {
    const normalizedSearch = normalizeText(modName);
    const modConfig = modalities.find(m => 
      normalizeText(m.name) === normalizedSearch || 
      normalizeText(m.id) === normalizedSearch ||
      normalizeText(m.slug) === normalizedSearch
    );
    if (modConfig && modConfig.pricing && modConfig.pricing[cat]) {
      const rule = modConfig.pricing[cat];
      if (rule.enabled) {
        total += Number(rule.price) || 0;
      }
    }
  });

  return total;
}
// Resumo: tabela de faixas com rótulo, cor de texto e classe de fundo.
// Próxima graduação definida para lógica de progressão automática.
export const beltConfig = {
  none: { label: 'Sem faixa', textColor: '#E5E7EB', bgClass: 'belt-none', next: 'white' },
  white: { label: 'Branca', textColor: '#111111', bgClass: 'belt-white', next: 'blue' },
  blue: { label: 'Azul', textColor: '#FFFFFF', bgClass: 'belt-blue', next: 'purple' },
  purple: { label: 'Roxa', textColor: '#FFFFFF', bgClass: 'belt-purple', next: 'brown' },
  brown: { label: 'Marrom', textColor: '#FFFFFF', bgClass: 'belt-brown', next: 'black' },
  black: { label: 'Preta', textColor: '#FFFFFF', bgClass: 'belt-black', next: 'none' },
}

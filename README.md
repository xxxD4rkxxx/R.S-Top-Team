# 🛡️ RS Top Team - Sistema de Gestão de Academia

## 📝 Descrição
O **RS Top Team** é uma plataforma premium de gestão para academias, projetada com uma estética moderna de "high-density" e foco total na experiência do usuário (UX). O sistema oferece um painel administrativo e de alunos completo para monitoramento de frequências, modalidades e métricas de desempenho em tempo real.

O projeto utiliza uma interface dark mode sofisticada, com efeitos de iluminação ambiente (ambient light) e micro-interações que proporcionam uma sensação de software de alto nível (SaaS).

## 🚀 Funcionalidades Principais
- **Dashboard Central**: Visualização de KPIs (indicadores-chave) com gráficos interativos.
- **Gestão de Alunos**: Lista completa com busca avançada, filtros de status e visualização de perfis.
- **Sistema de Presenças (Attendance)**: Controle de check-ins e histórico de frequência simplificado.
- **Módulo de Modalidades & Aulas**: Gerenciamento integrado de diferentes categorias de treino e horários.
- **Navegação Mobile Premium**: Menu inferior (Bottom Navigation) otimizado para celulares, garantindo uma experiência de App nativo.
- **Autenticação Robusta**: Fluxo de login e registro seguro via Firebase Authentication.

## 🛠️ Tecnologias Utilizadas
- **Core**: [React 19](https://react.dev/) & [Vite](https://vitejs.dev/) para um desenvolvimento ultra-rápido.
- **Estilização**: [TailwindCSS 4](https://tailwindcss.com/) para design responsivo e moderno.
- **Animações**: [Framer Motion](https://www.framer.com/motion/) para transições suaves e efeitos visuais premium.
- **Ícones**: [Lucide React](https://lucide.dev/) para um conjunto visual limpo e consistente.
- **Métricas & Gráficos**: [Recharts](https://recharts.org/) para visualização de dados.
- **Backend**: [Firebase](https://firebase.google.com/) (Firestore, Auth, Hosting).
- **Data Connect**: Utilização do novo [Firebase Data Connect](https://firebase.google.com/docs/data-connect) para consultas tipadas e eficientes.

## 📂 Organização do Código
O projeto segue uma estrutura modular para facilitar a manutenção:
- `src/modules/auth`: Páginas de login e registro.
- `src/modules/attendance`: Lógica de frequência e histórico.
- `src/modules/modalities`: Gestão de aulas e planos.
- `src/theme`: Tokens de design e sistema de cores.
- `src/components/shared`: Componentes reutilizáveis (botões, cards, barras superiores).

## ⚙️ Como Começar
Para rodar este projeto localmente:

1. Instale as dependências:
   ```bash
   npm install
   ```

2. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```

3. Acesse no navegador: `http://localhost:5173`

---
Desenvolvido por **[xxxD4rkxxx]** 🚀

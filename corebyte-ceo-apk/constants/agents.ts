// constants/agents.ts
export interface Agent {
  id: string;
  nome: string;
  emoji: string;
  cor: string;
  keywords: string[];
}

export type AgentStatus = 'idle' | 'processando' | 'concluido';

export const AGENTS: Agent[] = [
  { id: "licitacoes",     nome: "Licitações",    emoji: "⚆���",  cor: "#F59E0B", keywords: ["licitação","edital","pncp","pregão","dispensa"] },
  { id: "juridico",       nome: "Jurídico",       emoji: "📜",  cor: "#8B5CF6", keywords: ["contrato","jurídico","cláusula","compliance"] },
  { id: "financeiro",     nome: "Financeiro",     emoji: "💰",  cor: "#10B981", keywords: ["financeiro","fluxo de caixa","imposto","tributário","regime"] },
  { id: "comercial",      nome: "Comercial",      emoji: "🤝",  cor: "#3B82F6", keywords: ["proposta","comercial","negociação","cliente","vendas"] },
  { id: "sdr",            nome: "SDR IA",          emoji: "📱",  cor: "#06B6D4", keywords: ["lead","qualificação","bant","agendamento"] },
  { id: "consultor",      nome: "Consultor IA",   emoji: "👍",  cor: "#6366F1", keywords: ["diagnóstico","automação","consultoria","ia"] },
  { id: "suporte",        nome: "Suporte",         emoji: "🎯",  cor: "#EC4899", keywords: ["suporte","ticket","problema","pós-venda"] },
  { id: "desenvolvimento", nome: "Desenvolvimento",emoji: "💻",  cor: "#14B8A6", keywords: ["código","app","sistema","bug","api","programação"] },
  { id: "infraestrutura", nome: "Infraestrutura", emoji: "📵ￏ",  cor: "#64748B", keywords: ["servidor","docker","deploy","vps","linux"] },
  { id: "marketing",      nome: "Marketing",       emoji: "📣",  cor: "#F97316", keywords: ["marketing","post","linkedin","conteúdo","campanha"] },
  { id: "pesquisa",       nome: "Pesquisa",        emoji: "💮",  cor: "#A855F7", keywords: ["pesquisa","mercado","concorrente","tendência","fornecedor"] },
  { id: "cetico",         nome: "Cético",          emoji: "😈",  cor: "#EF4444", keywords: ["risco","crítica","revisão","stress-test"] },
  { id: "operacoes",      nome: "Operações",       emoji: "💍",  cor: "#78716C", keywords: ["operações","nota fiscal","empenho","fornecedor","cobrança"] },
  { id: "mobile",         nome: "Mobile/APK",      emoji: "🔲",  cor: "#0EA5E9", keywords: ["app","mobile","android","apk","flutter","react native"] },
];

export const COLORS = {
  bg:       '#0F172A',
  card:     '#1E293B',
  border:   '#334155',
  blue:     '#3B82F6',
  cyan:     '#06B6D4',
  text:     '#F1F5F9',
  subtext:  '#94A3B8',
  success:  '#10B981',
  warning:  '#F59E0B',
  error:    '#EF4404',
};

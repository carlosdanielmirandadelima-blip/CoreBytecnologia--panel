// constants/responses.ts
import { AGENTS } from './agents';

export const CEO_RESPONSES: Record<string, string[]> = {
  licitacoes: [
    "⚆/️ **Agente Licitações acionado.**\n\nAnalisei o contexto. Para editais no PNCP, recomendo:\n- Verificar habilitação jurídica e regularidade fiscal\n- Prazo mínimo de 8 dias úteis para pregão eletrônico\n- Solicitar vista do processo administrativo antes de impugnar\n\n **Próximo passo:** enviar documentação de habilitação?",
  ],
  juridico: [
    "📜 **Agente Jurídico acionado.**\n\nAnálise contratual em andamento:\n- Verificar cláusula de reajuste (INPC/IPCA)\n- Garantia contratual: 5% do valor do contrato\n- Prazo de vigência e prorrogação automática\n\n**Atenção:** cláusula penal deve ser revisada antes da assinatura.",
  ],
  financeiro: [
    "💰 **Agente Financeiro acionado.**\n\nDiagnóstico financeiro:\n| Indicador | Status |\n|-----------|--------|\n| Fluxo de Caixa | 🟂 Positivo |\n| DRE  | 🟡 Revisar |\n| Impostos | 🟴 Atenção |\n\nRecomendo migrar para Lucro Presumido se faturamento < R$ 78M/ano.",
  ],
  default: [
    "📾 **CEO IA processando sua solicitação...**\n\nIdentifiquei sua demanda e estou coordenando os agentes necessários. Qual área você deseja aprofundar?",
    "📾 **Análise concluída.**\n\nBaseado no contexto da CoreByte Tecnologia, recomendo uma abordagem estruturada em 3 fases:\n\n1. **Diagnóstico** -- mapeamento da situação atual\n2. **Plano de ação** -- definição de prioridades\n3. **Execução** -- delegação para agentes especializados\n\nDeseja detalhar alguma fase?",
    "📾 **CoreByte Command Center ativo.**\n\nTodos os 14 agentes estão online e prontos. Como posso ajudar a CoreByte hoje?",
  ],
};

export function detectAgents(text: string): string[] {
  const lower = text.toLowerCase();
  return AGENTS
    .filter((a) => a.keywords.some((kw) => lower.includes(kw)))
    .map((a) => a.id);
}

export function getCeoResponse(agentIds: string[]): string {
  if (agentIds.length === 0) {
    const arr = CE_RESPONSES.default;
    return arr[Math.floor(Math.random() * arr.length)];
  }
  const key = agentIds[0];
  const arr = CE_RESPONSES[key] ?? CE_RESPONSES.default;
  return arr[Math.floor(Math.random() * arr.length)];
}

import { CONFIGURACAO_PADRAO_DO_PLANEJAMENTO, validarConfiguracaoDoPlanejamento, type ConfiguracaoDoPlanejamento } from '../domain/planoDeEnfesto';

/**
 * As configurações do planejamento de corte (margens da mesa, pontas, perdas, limites do enfesto, tamanho da mesa,
 * busca dos riscos) ficam guardadas neste computador: são da fábrica, e não de cada projeto. Cada plano guarda
 * também as que usou. O que não dá para ler vale como a configuração padrão; a configuração da primeira versão do
 * planejamento (margens, pontas, folhas e tolerância) continua valendo onde ela já existia.
 */
const CHAVE = 'enfesto-cad:configuracao-do-planejamento';
const CHAVE_DA_PRIMEIRA_VERSAO = 'enfesto-cad:configuracao-do-plano-de-corte';

function ehConfiguracao(valor: unknown): valor is ConfiguracaoDoPlanejamento {
  if (typeof valor !== 'object' || valor === null) return false;
  const c = { ...CONFIGURACAO_PADRAO_DO_PLANEJAMENTO, ...(valor as object) } as ConfiguracaoDoPlanejamento;
  return Object.values(c).every((v) => typeof v === 'number') && validarConfiguracaoDoPlanejamento(c).length === 0;
}

export function lerConfiguracaoDoPlanejamento(armazenamento: Pick<Storage, 'getItem'>): ConfiguracaoDoPlanejamento {
  try {
    const lido: unknown = JSON.parse(armazenamento.getItem(CHAVE) ?? 'null');
    if (ehConfiguracao(lido)) return { ...CONFIGURACAO_PADRAO_DO_PLANEJAMENTO, ...lido };
    const antiga = JSON.parse(armazenamento.getItem(CHAVE_DA_PRIMEIRA_VERSAO) ?? 'null') as Record<string, unknown> | null;
    if (antiga && typeof antiga === 'object') {
      const comAntiga: Record<string, number | undefined> = { ...CONFIGURACAO_PADRAO_DO_PLANEJAMENTO };
      for (const campo of ['margemInicialDaMesaMm', 'margemFinalDaMesaMm', 'sobraPorCamadaMm', 'folhasPorEnfestoMax', 'toleranciaDeRendimentoPercentual'] as const) {
        const valor = antiga[campo];
        if (typeof valor === 'number') comAntiga[campo] = valor;
      }
      if (ehConfiguracao(comAntiga)) return comAntiga;
    }
  } catch {
    // Ilegível: vale a padrão.
  }
  return CONFIGURACAO_PADRAO_DO_PLANEJAMENTO;
}

/** Guarda a configuração (só a válida). Devolve `false` se não deu para gravar. */
export function gravarConfiguracaoDoPlanejamento(armazenamento: Pick<Storage, 'setItem'>, configuracao: ConfiguracaoDoPlanejamento): boolean {
  if (!ehConfiguracao(configuracao)) return false;
  try {
    armazenamento.setItem(CHAVE, JSON.stringify(configuracao));
    return true;
  } catch {
    return false;
  }
}

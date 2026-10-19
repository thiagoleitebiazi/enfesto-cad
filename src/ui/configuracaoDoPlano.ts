import { CONFIGURACAO_PADRAO_DO_PLANO, type ConfiguracaoDoPlano } from '../domain/planoDeCorte';

/**
 * As configurações do planejamento de corte (as margens da mesa, a sobra de pontas, o limite de folhas e a
 * tolerância de rendimento) ficam guardadas neste computador: são da fábrica, e não de cada projeto. Cada plano
 * guarda também as que usou. O que não dá para ler vale como a configuração padrão.
 */
const CHAVE = 'enfesto-cad:configuracao-do-plano-de-corte';

function ehConfiguracao(valor: unknown): valor is ConfiguracaoDoPlano {
  if (typeof valor !== 'object' || valor === null) return false;
  const c = valor as Record<string, unknown>;
  const naoNegativo = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v) && v >= 0;
  return (
    naoNegativo(c.margemInicialDaMesaMm) &&
    naoNegativo(c.margemFinalDaMesaMm) &&
    naoNegativo(c.sobraPorCamadaMm) &&
    typeof c.folhasPorEnfestoMax === 'number' &&
    Number.isInteger(c.folhasPorEnfestoMax) &&
    c.folhasPorEnfestoMax >= 1 &&
    naoNegativo(c.toleranciaDeRendimentoPercentual)
  );
}

export function lerConfiguracaoDoPlano(armazenamento: Pick<Storage, 'getItem'>): ConfiguracaoDoPlano {
  try {
    const lido: unknown = JSON.parse(armazenamento.getItem(CHAVE) ?? 'null');
    return ehConfiguracao(lido) ? lido : CONFIGURACAO_PADRAO_DO_PLANO;
  } catch {
    return CONFIGURACAO_PADRAO_DO_PLANO;
  }
}

/** Guarda a configuração (só a válida). Devolve `false` se não deu para gravar. */
export function gravarConfiguracaoDoPlano(armazenamento: Pick<Storage, 'setItem'>, configuracao: ConfiguracaoDoPlano): boolean {
  if (!ehConfiguracao(configuracao)) return false;
  try {
    armazenamento.setItem(CHAVE, JSON.stringify(configuracao));
    return true;
  } catch {
    return false;
  }
}

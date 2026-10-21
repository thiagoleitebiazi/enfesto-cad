import type { MalhaDoCadastro } from './cadastroDeProducao';
import type { RiscoDoPlanejamento } from './planoDeEnfesto';

/**
 * Compensação de encolhimento no risco. Uma malha que encolhe e% numa direção pede a peça cortada maior, na razão
 * 1 / (1 − e/100): 3% de encolhimento → × 1,0309 (a peça de 1000 mm é cortada com 1030,9 mm e fica com 1000 mm).
 *
 * - O comprimento é o sentido do rolo (o y do risco); a largura, o de lado a lado (o x).
 * - O risco é feito na largura da malha dividida pelo fator da largura e depois é aumentado pelos fatores: assim o
 *   risco compensado cabe na malha, e a distância entre as peças só aumenta.
 * - Nunca duas vezes: com o molde já compensado (cadastro da malha), a compensação é recusada.
 * - Só com a decisão de quem planeja (`compensarEncolhimento` no plano), e o plano guarda os fatores.
 */

export type FonteDoEncolhimento = 'ensaio-de-lavagem' | 'fornecedor' | 'estimativa';

export const ROTULO_DA_FONTE_DO_ENCOLHIMENTO: Readonly<Record<FonteDoEncolhimento, string>> = {
  'ensaio-de-lavagem': 'Ensaio de lavagem',
  fornecedor: 'Informado pelo fornecedor',
  estimativa: 'Estimativa',
};

export interface FatoresDeCompensacao {
  readonly comprimento: number;
  readonly largura: number;
  readonly encolhimentoComprimentoPercentual: number;
  readonly encolhimentoLarguraPercentual: number;
}

/** O fator de uma direção: 1 / (1 − e/100). Valor ausente, zero ou inválido não compensa (fator 1), e o inválido é dito. */
export function fatorDoEncolhimento(percentual: number | undefined): number {
  if (percentual === undefined || percentual === 0) return 1;
  if (!(percentual > 0 && percentual < 50)) throw new Error(`O encolhimento de ${String(percentual).replace('.', ',')}% não vale: ele precisa ficar entre 0 e 50%.`);
  return 1 / (1 - percentual / 100);
}

/** Os fatores da malha, ou o motivo de não compensar. */
export function fatoresDeCompensacao(malha: Pick<MalhaDoCadastro, 'encolhimentoComprimentoPercentual' | 'encolhimentoLarguraPercentual' | 'encolhimentoCompensadoNoMolde'>): FatoresDeCompensacao | { readonly erro: string } {
  if (malha.encolhimentoCompensadoNoMolde) {
    return { erro: 'O encolhimento desta malha já está compensado no molde (cadastro da malha): compensar no risco também o aplicaria duas vezes.' };
  }
  const eC = malha.encolhimentoComprimentoPercentual ?? 0;
  const eL = malha.encolhimentoLarguraPercentual ?? 0;
  if (eC === 0 && eL === 0) return { erro: 'A malha não tem encolhimento informado: não há o que compensar.' };
  try {
    return { comprimento: fatorDoEncolhimento(eC), largura: fatorDoEncolhimento(eL), encolhimentoComprimentoPercentual: eC, encolhimentoLarguraPercentual: eL };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : String(e) };
  }
}

/** As medidas de uma peça antes e depois da compensação (para a pré-visualização). */
export function medidasCompensadas(larguraMm: number, comprimentoMm: number, fatores: FatoresDeCompensacao): { readonly larguraMm: number; readonly comprimentoMm: number } {
  return { larguraMm: larguraMm * fatores.largura, comprimentoMm: comprimentoMm * fatores.comprimento };
}

/** O risco aumentado pelos fatores (as peças, o fio, o comprimento, a largura ocupada e a área). */
export function riscoCompensado(risco: RiscoDoPlanejamento, fatores: FatoresDeCompensacao, larguraDoRiscoMm: number): RiscoDoPlanejamento {
  const levar = (p: { readonly x: number; readonly y: number }) => ({ x: Math.round(p.x * fatores.largura * 100) / 100, y: Math.round(p.y * fatores.comprimento * 100) / 100 });
  const area = risco.areaDasPecasMm2 === null ? null : risco.areaDasPecasMm2 * fatores.largura * fatores.comprimento;
  const comprimentoMm = Math.round(risco.comprimentoMm * fatores.comprimento * 100) / 100;
  return {
    ...risco,
    comprimentoMm,
    larguraMm: Math.round(risco.larguraMm * fatores.largura * 100) / 100,
    larguraDoRiscoMm,
    areaDasPecasMm2: area,
    eficienciaPercentual: area === null ? null : (area / (comprimentoMm * larguraDoRiscoMm)) * 100,
    pecas: risco.pecas.map((p) => ({ ...p, contorno: p.contorno.map(levar), fio: { inicio: levar(p.fio.inicio), fim: levar(p.fio.fim) } })),
    compensado: { comprimento: fatores.comprimento, largura: fatores.largura },
  };
}

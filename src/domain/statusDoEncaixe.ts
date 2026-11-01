import { area, retanguloEnvolvente } from '../core/geometria';
import type { ConfiguracaoDeEnfesto, ReferenciaDaLinha } from './enfesto';
import { linhaDeCorteDaPeca, type Molde } from './molde';

/**
 * O "Status" do encaixe (ADR 0198): o que está na mesa, por tamanho e por molde, o consumo com as perdas e o rendimento.
 * Conta só as peças que estão na mesa: as que foram para fora dela (Ctrl+F) não entram.
 */

export interface LinhaDoTamanho {
  readonly tamanho: string;
  /** Quantas peças completas: o menor número de cópias entre os moldes desse tamanho. */
  readonly completos: number;
  readonly encaixados: number;
}

export interface LinhaDoMolde {
  readonly nome: string;
  readonly encaixados: number;
  /** A área das peças deste molde na mesa, e a parte do consumo que cabe a ele, pela área (ADR 0223). */
  readonly areaMm2: number;
  readonly parteDoConsumoPercentual: number;
  readonly consumoMm: number;
}

export interface StatusDoEncaixe {
  readonly encaixados: number;
  readonly foraDaMesa: number;
  readonly comprimentoMm: number;
  /** O comprimento com as perdas do tecido. */
  readonly consumoMm: number;
  readonly areaMm2: number;
  readonly aproveitamentoPercentual: number;
  readonly porTamanho: readonly LinhaDoTamanho[];
  readonly porMolde: readonly LinhaDoMolde[];
  /** Metros de tecido por peça pronta; `null` sem nenhuma peça completa. */
  readonly rendimentoConsumoM: number | null;
  /** Quilos de tecido por peça pronta, com a gramatura; `null` sem ela. */
  readonly rendimentoPesoKg: number | null;
}

/** O comprimento com as perdas: a porcentagem e os centímetros somados. */
export function consumoComPerdasMm(comprimentoMm: number, enfesto: Pick<ConfiguracaoDeEnfesto, 'perdaPercentual' | 'perdaMm'>): number {
  if (comprimentoMm <= 0) return 0;
  return comprimentoMm * (1 + (enfesto.perdaPercentual ?? 0) / 100) + (enfesto.perdaMm ?? 0);
}

export function statusDoEncaixe(pecas: readonly Molde[], enfesto: ConfiguracaoDeEnfesto, gramaturaGm2?: number): StatusDoEncaixe {
  const naMesa = pecas.filter((p) => retanguloEnvolvente(linhaDeCorteDaPeca(p)).minY < enfesto.comprimentoMm);
  const cortes = naMesa.map(linhaDeCorteDaPeca);
  const comprimentoMm = cortes.length > 0 ? Math.max(...cortes.map((c) => retanguloEnvolvente(c).maxY)) : 0;
  const areaMm2 = cortes.reduce((s, c) => s + area(c), 0);
  const nomes = [...new Set(pecas.map((p) => p.nome))];
  const tamanhos = [...new Set(pecas.map((p) => p.tamanho))];
  const conta = (nome: string, tamanho: string): number => naMesa.filter((p) => p.nome === nome && p.tamanho === tamanho).length;
  const porTamanho = tamanhos.map((tamanho) => {
    const dele = nomes.filter((n) => pecas.some((p) => p.nome === n && p.tamanho === tamanho));
    return { tamanho, completos: Math.min(...dele.map((n) => conta(n, tamanho))), encaixados: naMesa.filter((p) => p.tamanho === tamanho).length };
  });
  const consumoMm = consumoComPerdasMm(comprimentoMm, enfesto);
  const completos = porTamanho.reduce((s, t) => s + t.completos, 0);
  const areaDoConsumoM2 = (consumoMm * enfesto.larguraUtilMm) / 1_000_000;
  return {
    encaixados: naMesa.length,
    foraDaMesa: pecas.length - naMesa.length,
    comprimentoMm,
    consumoMm,
    areaMm2,
    aproveitamentoPercentual: comprimentoMm > 0 ? (areaMm2 / (enfesto.larguraUtilMm * comprimentoMm)) * 100 : 0,
    porTamanho,
    porMolde: nomes.map((nome) => {
      const doMolde = naMesa.filter((p) => p.nome === nome);
      const areaDoMolde = doMolde.reduce((soma, p) => soma + area(linhaDeCorteDaPeca(p)), 0);
      const parte = areaMm2 > 0 ? areaDoMolde / areaMm2 : 0;
      return { nome, encaixados: doMolde.length, areaMm2: areaDoMolde, parteDoConsumoPercentual: parte * 100, consumoMm: consumoMm * parte };
    }),
    rendimentoConsumoM: completos > 0 ? consumoMm / 1000 / completos : null,
    rendimentoPesoKg: completos > 0 && gramaturaGm2 ? (areaDoConsumoM2 * gramaturaGm2) / 1000 / completos : null,
  };
}

export interface OpcoesDaEmenda {
  /** O espaço mínimo e o máximo entre dois pontos (Método 1), e a margem que a peça pede em volta da emenda. */
  readonly minimaMm: number;
  readonly maximaMm: number;
  readonly margemMm: number;
}

export interface PontoDeEmenda {
  readonly posicaoMm: number;
  /** Quanto o tecido novo tem de voltar sobre o anterior: o que falta para cobrir as peças que atravessam o ponto. */
  readonly transpasseMm: number;
}

/** O transpasse de uma emenda: da posição até o começo mais distante entre as peças que a atravessam. */
function transpasseEm(posicao: number, caixas: readonly { readonly minY: number; readonly maxY: number }[]): number {
  const comeco = Math.min(posicao, ...caixas.filter((c) => c.minY < posicao && c.maxY > posicao).map((c) => c.minY));
  return posicao - comeco;
}

/**
 * Os pontos de emenda automáticos (Método 1): a partir do começo, dentro da faixa entre a distância mínima e a máxima,
 * o ponto de menor transpasse. As caixas das peças crescem pela margem. Um rolo não precisa de emenda antes do fim
 * do risco: o último ponto fica antes do comprimento.
 */
export function emendasAutomaticas(pecas: readonly Molde[], comprimentoMm: number, o: OpcoesDaEmenda): PontoDeEmenda[] {
  if (!(o.minimaMm > 0) || o.maximaMm < o.minimaMm) throw new Error('A distância mínima precisa ser maior que zero, e a máxima, não menor que ela.');
  const caixas = pecas.map((p) => {
    const c = retanguloEnvolvente(linhaDeCorteDaPeca(p));
    return { minY: c.minY - o.margemMm, maxY: c.maxY + o.margemMm };
  });
  const candidatos = [...new Set(caixas.flatMap((c) => [c.minY, c.maxY]))].sort((a, b) => a - b);
  const pontos: PontoDeEmenda[] = [];
  for (let s = 0; s + o.minimaMm < comprimentoMm; ) {
    const de = s + o.minimaMm;
    const ate = Math.min(s + o.maximaMm, comprimentoMm);
    const faixa = [ate, ...candidatos.filter((c) => c >= de && c <= ate)];
    const melhor = faixa.reduce((a, b) => (transpasseEm(b, caixas) < transpasseEm(a, caixas) || (transpasseEm(b, caixas) === transpasseEm(a, caixas) && b > a) ? b : a));
    if (melhor >= comprimentoMm) break;
    pontos.push({ posicaoMm: melhor, transpasseMm: transpasseEm(melhor, caixas) });
    s = melhor;
  }
  return pontos;
}

/** Método 2: de espaço em espaço, a partir do começo ou do fim do enfesto, com o transpasse de cada ponto. */
export function emendasPorEspaco(pecas: readonly Molde[], comprimentoMm: number, espacoMm: number, direcao: 'ida' | 'volta'): PontoDeEmenda[] {
  if (!(espacoMm > 0)) throw new Error('O espaço entre os pontos precisa ser maior que zero.');
  const caixas = pecas.map((p) => retanguloEnvolvente(linhaDeCorteDaPeca(p)));
  const pontos: PontoDeEmenda[] = [];
  for (let k = 1; k * espacoMm < comprimentoMm; k++) {
    const posicaoMm = direcao === 'ida' ? k * espacoMm : comprimentoMm - k * espacoMm;
    pontos.push({ posicaoMm, transpasseMm: transpasseEm(posicaoMm, caixas) });
  }
  return pontos.sort((a, b) => a.posicaoMm - b.posicaoMm);
}

export const REFERENCIAS_DA_LINHA: readonly ReferenciaDaLinha[] = ['esquerda', 'direita', 'superior', 'inferior'];

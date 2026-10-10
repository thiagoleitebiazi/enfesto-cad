import { distancia, type Ponto2D, type PosicaoNoContorno } from '../core/geometria';
import {
  acrescentarControle,
  controlePerto,
  curvaPerto,
  curvasDaPeca,
  moverControle,
  removerControle,
  tornarTrechoCurva,
} from '../domain/curvasDaPeca';
import type { Molde } from '../domain/molde';
import type { PreviaDeFerramentaDeMolde } from './ferramentasDeMolde';
import { formatarMm } from './medidas';

/**
 * "Editar pontos de curva", na curva que tem registro: um clique escolhe um
 * ponto de passagem (as alças, marcadas com um anel) e o seguinte diz onde
 * ele deve ficar — a curva é refeita por ele.
 */
export interface AlcaEscolhida {
  readonly curvaId: string;
  readonly indice: number;
}

export interface CliqueNaAlca {
  /** O clique era para as alças (escolheu uma, ou pôs a escolhida no lugar)? Se não, vale o que a ferramenta já fazia. */
  readonly tratou: boolean;
  readonly alca: AlcaEscolhida | null;
  /** As peças do projeto depois do clique, quando a curva mudou (um passo de desfazer). */
  readonly pecas?: readonly Molde[];
  readonly recado: string | null;
}

/** O que um clique faz com as alças: sem alça escolhida, escolhe a que está perto; com uma escolhida, leva-a para o ponto clicado. */
export function cliqueNaAlca(pecas: readonly Molde[], peca: Molde, alca: AlcaEscolhida | null, p: Ponto2D, raioMm: number): CliqueNaAlca {
  if (!alca) {
    const perto = controlePerto(peca, p, raioMm);
    return perto ? { tratou: true, alca: { curvaId: perto.curva.id, indice: perto.indice }, recado: null } : { tratou: false, alca: null, recado: null };
  }
  try {
    const nova = moverControle(peca, alca.curvaId, alca.indice, p);
    return {
      tratou: true,
      alca: null,
      pecas: pecas.map((q) => (q.id === peca.id ? nova : q)),
      recado: `Ponto de passagem movido em “${peca.nome}”: a curva foi refeita por ele.`,
    };
  } catch (e) {
    return { tratou: true, alca: null, recado: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * A prévia das alças: um anel em cada ponto de passagem das curvas
 * registradas e, com uma alça escolhida, a curva como ficaria com ela no
 * lugar do mouse. `null` quando a peça não tem curva registrada.
 */
export function previaDasAlcas(peca: Molde, alca: AlcaEscolhida | null, mouse: Ponto2D | null): PreviaDeFerramentaDeMolde | null {
  const curvas = curvasDaPeca(peca);
  if (curvas.length === 0) return null;
  const marcas = curvas.flatMap((curva) => curva.controles.slice(1, -1));
  const escolhida = alca ? curvas.find((c) => c.id === alca.curvaId) : undefined;
  if (!alca || !escolhida || !mouse) return { marcas };
  try {
    const refeita = curvasDaPeca(moverControle(peca, alca.curvaId, alca.indice, mouse)).find((c) => c.id === alca.curvaId);
    return refeita ? { marcas, novo: refeita.pontos, substituido: escolhida.pontos } : { marcas };
  } catch {
    return { marcas, substituido: escolhida.pontos };
  }
}

/** A instrução com uma alça escolhida. */
export const INSTRUCAO_COM_ALCA =
  'Editar pontos de curva: clique onde o ponto de passagem deve ficar — a curva é refeita por ele. Delete tira o ponto de passagem.';

/** O que a instrução da ferramenta acrescenta quando a peça tem curvas registradas. */
export function avisoDasAlcas(peca: Molde | null | undefined): string {
  return peca && curvasDaPeca(peca).length > 0
    ? ' Ou clique num ponto de passagem de uma curva (os anéis) e, depois, onde ele deve ficar. Dois cliques no mesmo lugar de uma curva põem um ponto de passagem ali.'
    : '';
}

/** Tira da curva o ponto de passagem escolhido (Delete, com uma alça escolhida). */
export function apagarAlca(pecas: readonly Molde[], peca: Molde, alca: AlcaEscolhida): { readonly pecas?: readonly Molde[]; readonly recado: string } {
  try {
    // Os pontos de passagem que ficam: os de antes (sem as duas pontas) menos o que sai.
    const restam = (curvasDaPeca(peca).find((c) => c.id === alca.curvaId)?.controles.length ?? 3) - 3;
    const nova = removerControle(peca, alca.curvaId, alca.indice);
    const ficou = curvasDaPeca(nova).some((c) => c.id === alca.curvaId);
    return {
      pecas: pecas.map((q) => (q.id === peca.id ? nova : q)),
      recado: ficou
        ? `Ponto de passagem tirado em “${peca.nome}”: a curva foi refeita ${restam === 1 ? 'pelo que ficou' : 'pelos que ficaram'}.`
        : `Último ponto de passagem tirado em “${peca.nome}”: o trecho ficou reto, de uma ponta à outra.`,
    };
  } catch (e) {
    return { recado: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * O segundo clique no mesmo lugar em que o trecho começou, em cima de uma
 * curva registrada: em vez de um trecho (que não teria comprimento), entra um
 * ponto de passagem ali.
 */
export function cliqueDeNovoPontoDePassagem(
  pecas: readonly Molde[],
  peca: Molde,
  inicioDoTrecho: Ponto2D,
  p: Ponto2D,
  raioMm: number,
): { readonly tratou: boolean; readonly pecas?: readonly Molde[]; readonly recado: string | null } {
  if (distancia(inicioDoTrecho, p) > raioMm) return { tratou: false, recado: null };
  const curva = curvaPerto(peca, inicioDoTrecho, raioMm);
  if (!curva) return { tratou: false, recado: null };
  try {
    const nova = acrescentarControle(peca, curva.id, inicioDoTrecho);
    return {
      tratou: true,
      pecas: pecas.map((q) => (q.id === peca.id ? nova : q)),
      recado: `Ponto de passagem posto na curva de “${peca.nome}”: clique nele (o anel) e, depois, onde ele deve ficar.`,
    };
  } catch (e) {
    return { tratou: true, recado: e instanceof Error ? e.message : String(e) };
  }
}

/** Torna o trecho indicado uma curva editável, com os pontos de passagem pedidos; lança erro, sem mudar nada, quando não dá. */
export function aplicarTornarCurva(
  pecas: readonly Molde[],
  peca: Molde,
  inicio: PosicaoNoContorno,
  fim: PosicaoNoContorno,
  pontosDePassagem: number,
  id: string,
): { readonly pecas: readonly Molde[]; readonly recado: string } {
  const { molde, desvioMm } = tornarTrechoCurva(peca, inicio, fim, pontosDePassagem, id);
  const mudanca = desvioMm < 0.05 ? 'A forma não mudou.' : `A forma mudou ${formatarMm(desvioMm)} no ponto em que mais mudou.`;
  return {
    pecas: pecas.map((q) => (q.id === peca.id ? molde : q)),
    recado: `Trecho de “${peca.nome}” tornado curva editável, com ${pontosDePassagem} ${pontosDePassagem === 1 ? 'ponto' : 'pontos'} de passagem (os anéis). ${mudanca}`,
  };
}

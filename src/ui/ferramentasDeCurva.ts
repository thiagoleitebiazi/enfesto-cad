import type { Ponto2D } from '../core/geometria';
import { controlePerto, curvasDaPeca, moverControle } from '../domain/curvasDaPeca';
import type { Molde } from '../domain/molde';
import type { PreviaDeFerramentaDeMolde } from './ferramentasDeMolde';

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
export const INSTRUCAO_COM_ALCA = 'Editar pontos de curva: clique onde o ponto de passagem deve ficar — a curva é refeita por ele.';

/** O que a instrução da ferramenta acrescenta quando a peça tem curvas registradas. */
export function avisoDasAlcas(peca: Molde | null | undefined): string {
  return peca && curvasDaPeca(peca).length > 0 ? ' Ou clique num ponto de passagem de uma curva (os anéis) e, depois, onde ele deve ficar.' : '';
}

import { distancia, type Ponto2D, type PosicaoNoContorno } from '../core/geometria';
import {
  acrescentarControle,
  alcasDeTangente,
  controlePerto,
  curvaPerto,
  curvasDaPeca,
  definirTangente,
  moverControle,
  removerControle,
  removerTangente,
  tangentePerto,
  tornarTrechoCurva,
  type PontaDaCurva,
} from '../domain/curvasDaPeca';
import type { Molde } from '../domain/molde';
import type { PreviaDeFerramentaDeMolde } from './ferramentasDeMolde';
import { formatarMm } from './medidas';

/**
 * "Editar pontos de curva", na curva que tem registro: um clique escolhe um
 * ponto de passagem (as alças, marcadas com um anel) e o seguinte diz onde
 * ele deve ficar — a curva é refeita por ele.
 *
 * A curva por pontos de passagem tem ainda uma alça de tangente em cada
 * ponta (um anel preso à ponta por um traço): escolhida, o clique seguinte
 * diz para onde ela aponta, e a curva passa a sair da ponta nessa direção.
 */
export interface AlcaEscolhida {
  readonly curvaId: string;
  readonly indice: number;
  /** A escolhida é a alça de tangente desta ponta da curva (o `indice` não conta). */
  readonly tangente?: PontaDaCurva;
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
    if (perto) return { tratou: true, alca: { curvaId: perto.curva.id, indice: perto.indice }, recado: null };
    const tangente = tangentePerto(peca, p, raioMm);
    return tangente ? { tratou: true, alca: { curvaId: tangente.curva.id, indice: -1, tangente: tangente.ponta }, recado: null } : { tratou: false, alca: null, recado: null };
  }
  if (alca.tangente) {
    try {
      const nova = definirTangente(peca, alca.curvaId, alca.tangente, p);
      return {
        tratou: true,
        alca: null,
        pecas: pecas.map((q) => (q.id === peca.id ? nova : q)),
        recado: `Alça de tangente posta em “${peca.nome}”: a curva sai dessa ponta na direção dela.`,
      };
    } catch (e) {
      // A alça continua escolhida: o clique seguinte pode apontá-la para um lugar que sirva.
      const aindaHa = curvasDaPeca(peca).some((c) => c.id === alca.curvaId);
      return { tratou: true, alca: aindaHa ? alca : null, recado: e instanceof Error ? e.message : String(e) };
    }
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
  // As alças de tangente: um anel em cada uma, preso à ponta dela por um traço.
  const tracos = curvas.flatMap((curva) => {
    const alcas = alcasDeTangente(curva);
    return alcas ? [[curva.controles[0]!, alcas.inicio], [curva.controles.at(-1)!, alcas.fim]] : [];
  });
  const marcas = [...curvas.flatMap((curva) => curva.controles.slice(1, -1)), ...tracos.map((traco) => traco[1]!)];
  const base: PreviaDeFerramentaDeMolde = tracos.length > 0 ? { marcas, linhas: tracos } : { marcas };
  const escolhida = alca ? curvas.find((c) => c.id === alca.curvaId) : undefined;
  if (!alca || !escolhida || !mouse) return base;
  try {
    const mexida = alca.tangente ? definirTangente(peca, alca.curvaId, alca.tangente, mouse) : moverControle(peca, alca.curvaId, alca.indice, mouse);
    const refeita = curvasDaPeca(mexida).find((c) => c.id === alca.curvaId);
    return refeita ? { ...base, novo: refeita.pontos, substituido: escolhida.pontos } : base;
  } catch {
    return { ...base, substituido: escolhida.pontos };
  }
}

/** A instrução com um ponto de passagem escolhido. */
export const INSTRUCAO_COM_ALCA =
  'Editar pontos de curva: clique onde o ponto de passagem deve ficar — a curva é refeita por ele. Delete tira o ponto de passagem.';
/** A instrução com uma alça de tangente escolhida. */
export const INSTRUCAO_COM_TANGENTE =
  'Editar pontos de curva: clique para onde a alça de tangente deve apontar — a curva sai dessa ponta na direção dela (o comprimento não conta). A alça precisa apontar para o lado do ponto de passagem vizinho, até 85° da reta que vai até ele: de lado ou para trás, a curva teria de dar a volta para chegar a ele. Delete tira a alça.';

/** A instrução com uma alça escolhida: a do ponto de passagem ou a da alça de tangente. */
export function instrucaoComAlca(alca: AlcaEscolhida): string {
  return alca.tangente ? INSTRUCAO_COM_TANGENTE : INSTRUCAO_COM_ALCA;
}

/** O que a instrução da ferramenta acrescenta quando a peça tem curvas registradas. */
export function avisoDasAlcas(peca: Molde | null | undefined): string {
  if (!peca || curvasDaPeca(peca).length === 0) return '';
  const comTangente = curvasDaPeca(peca).some((curva) => alcasDeTangente(curva) !== null);
  return (
    ' Ou clique num ponto de passagem de uma curva (os anéis) e, depois, onde ele deve ficar. Dois cliques no mesmo lugar de uma curva põem um ponto de passagem ali.' +
    (comTangente ? ' O anel preso a cada ponta da curva por um traço é a alça de tangente: dá a direção em que a curva sai dali.' : '')
  );
}

/** Tira da curva o ponto de passagem escolhido (Delete, com uma alça escolhida). */
export function apagarAlca(pecas: readonly Molde[], peca: Molde, alca: AlcaEscolhida): { readonly pecas?: readonly Molde[]; readonly recado: string } {
  if (alca.tangente) {
    try {
      const posta = curvasDaPeca(peca).find((c) => c.id === alca.curvaId)?.tangentes?.[alca.tangente] !== undefined;
      const nova = removerTangente(peca, alca.curvaId, alca.tangente);
      if (!posta) return { recado: 'Essa ponta não tem alça de tangente posta: a curva já sai dela na direção do ponto de passagem vizinho.' };
      return {
        pecas: pecas.map((q) => (q.id === peca.id ? nova : q)),
        recado: `Alça de tangente tirada em “${peca.nome}”: a curva voltou a sair dessa ponta na direção do ponto de passagem vizinho.`,
      };
    } catch (e) {
      return { recado: e instanceof Error ? e.message : String(e) };
    }
  }
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

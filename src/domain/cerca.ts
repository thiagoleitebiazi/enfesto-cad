import type { Contorno, Ponto2D } from '../core/geometria';
import { area, somar } from '../core/geometria';
import { reancorarPiques, type Molde } from './molde';

/**
 * Cerca ("Definir cerca"/"Mover cerca" de CADs de moldes): um retângulo
 * fixo, em mm no espaço do mundo, que delimita QUAIS pontos uma operação de
 * mover pode alterar. Diferente da seleção de vértices da ferramenta "Mover
 * ponto" (`moverVariosPontosDoMolde`): a cerca fica desenhada e ativa até ser
 * desligada, vale para todas as peças que tiverem pontos dentro dela e,
 * depois de mover, ela acompanha o deslocamento — dá para repetir o
 * movimento sobre a mesma região.
 */
export interface Cerca {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

/** Cerca definida por dois cantos opostos, em qualquer ordem. */
export function cercaEntre(a: Ponto2D, b: Ponto2D): Cerca {
  return {
    minX: Math.min(a.x, b.x),
    minY: Math.min(a.y, b.y),
    maxX: Math.max(a.x, b.x),
    maxY: Math.max(a.y, b.y),
  };
}

/** Ponto dentro da cerca, bordas incluídas. */
export function pontoDentroDaCerca(p: Ponto2D, cerca: Cerca): boolean {
  return p.x >= cerca.minX && p.x <= cerca.maxX && p.y >= cerca.minY && p.y <= cerca.maxY;
}

export function transladarCerca(cerca: Cerca, delta: Ponto2D): Cerca {
  return {
    minX: cerca.minX + delta.x,
    minY: cerca.minY + delta.y,
    maxX: cerca.maxX + delta.x,
    maxY: cerca.maxY + delta.y,
  };
}

/**
 * O que a cerca pode mover. Piques não têm opção: ficam sempre sobre a sua
 * aresta, na mesma proporção (`reancorarPiques`). A linha de fio só se move
 * inteira — as duas pontas dentro da cerca —, porque mover uma ponta só
 * mudaria a direção do fio, que é a referência de todo o encaixe.
 */
export interface OpcoesDeMoverCerca {
  readonly pontosDoContorno: boolean;
  readonly furos: boolean;
  readonly linhasInternas: boolean;
  readonly marcas: boolean;
  readonly linhaDeFio: boolean;
}

export type CategoriaDaCerca = keyof OpcoesDeMoverCerca;

/** Quantos itens de cada categoria estão dentro da cerca (pontos de contorno/furos/linhas, marcas; linha de fio: 1 se inteira dentro). */
export type ContagemNaCerca = Readonly<Record<CategoriaDaCerca, number>>;

/** Área abaixo da qual um contorno é considerado degenerado depois de mover (mm²). */
const AREA_MINIMA_MM2 = 1e-6;

function pontosDentro(contorno: Contorno, cerca: Cerca): number {
  let total = 0;
  for (const p of contorno) if (pontoDentroDaCerca(p, cerca)) total++;
  return total;
}

function fioInteiroDentro(molde: Molde, cerca: Cerca): boolean {
  return pontoDentroDaCerca(molde.linhaDeFio.inicio, cerca) && pontoDentroDaCerca(molde.linhaDeFio.fim, cerca);
}

export function contarDentroDaCerca(molde: Molde, cerca: Cerca): ContagemNaCerca {
  return {
    pontosDoContorno: pontosDentro(molde.contorno, cerca),
    furos: molde.furos.reduce((soma, furo) => soma + pontosDentro(furo, cerca), 0),
    linhasInternas: molde.linhasInternas.reduce((soma, linha) => soma + pontosDentro(linha, cerca), 0),
    marcas: molde.marcas.filter((m) => pontoDentroDaCerca(m.posicao, cerca)).length,
    linhaDeFio: fioInteiroDentro(molde, cerca) ? 1 : 0,
  };
}

/** Verdadeiro se, com essas opções, a cerca mexeria em alguma coisa da peça. */
export function cercaAfetaMolde(molde: Molde, cerca: Cerca, opcoes: OpcoesDeMoverCerca): boolean {
  const contagem = contarDentroDaCerca(molde, cerca);
  return (Object.keys(opcoes) as CategoriaDaCerca[]).some((categoria) => opcoes[categoria] && contagem[categoria] > 0);
}

/**
 * Peças sobre as quais "Mover cerca" age: a seleção em lote, senão a peça
 * selecionada, senão todas. A mesma regra decide quais pontos o desenho
 * destaca na cerca, para o destaque mostrar só o que o diálogo vai mover.
 */
export function pecasAlvoDaCerca(
  pecas: readonly Molde[],
  idsSelecionadosEmLote: ReadonlySet<string>,
  selecionadoId: string | null,
): readonly Molde[] {
  if (idsSelecionadosEmLote.size > 0) return pecas.filter((p) => idsSelecionadosEmLote.has(p.id));
  if (selecionadoId) return pecas.filter((p) => p.id === selecionadoId);
  return pecas;
}

/**
 * Pontos da peça que "Mover cerca" pode deslocar com todas as opções
 * marcadas: os do contorno, dos furos e das linhas internas que estão dentro
 * da cerca, as marcas dentro dela e as duas pontas da linha de fio, se ela
 * estiver inteira dentro.
 */
export function pontosMoveisNaCerca(molde: Molde, cerca: Cerca): Ponto2D[] {
  const pontos: Ponto2D[] = [];
  const incluirSeDentro = (p: Ponto2D): void => {
    if (pontoDentroDaCerca(p, cerca)) pontos.push(p);
  };
  molde.contorno.forEach(incluirSeDentro);
  for (const furo of molde.furos) furo.forEach(incluirSeDentro);
  for (const linha of molde.linhasInternas) linha.forEach(incluirSeDentro);
  for (const marca of molde.marcas) incluirSeDentro(marca.posicao);
  if (fioInteiroDentro(molde, cerca)) pontos.push(molde.linhaDeFio.inicio, molde.linhaDeFio.fim);
  return pontos;
}

function moverContornoNaCerca(contorno: Contorno, cerca: Cerca, delta: Ponto2D): Contorno {
  if (!contorno.some((p) => pontoDentroDaCerca(p, cerca))) return contorno;
  return contorno.map((p) => (pontoDentroDaCerca(p, cerca) ? somar(p, delta) : p));
}

/**
 * Move por `delta` os pontos da peça que estão dentro da cerca, conforme as
 * opções. Pontos fora da cerca não mudam. Lança erro (sem alterar nada) se o
 * contorno ou um furo ficaria sem área — por exemplo, um lado inteiro levado
 * para cima do lado oposto.
 */
export function moverDentroDaCerca(molde: Molde, cerca: Cerca, delta: Ponto2D, opcoes: OpcoesDeMoverCerca): Molde {
  const contorno = opcoes.pontosDoContorno ? moverContornoNaCerca(molde.contorno, cerca, delta) : molde.contorno;
  if (contorno !== molde.contorno && area(contorno) <= AREA_MINIMA_MM2) {
    throw new Error(`O contorno da peça "${molde.nome}" ficaria sem área com esse movimento.`);
  }
  const furos = opcoes.furos ? molde.furos.map((furo) => moverContornoNaCerca(furo, cerca, delta)) : molde.furos;
  furos.forEach((furo, i) => {
    if (furo !== molde.furos[i] && area(furo) <= AREA_MINIMA_MM2) {
      throw new Error(`Um furo da peça "${molde.nome}" ficaria sem área com esse movimento.`);
    }
  });
  const linhasInternas = opcoes.linhasInternas
    ? molde.linhasInternas.map((linha) => moverContornoNaCerca(linha, cerca, delta))
    : molde.linhasInternas;
  const marcas = opcoes.marcas
    ? molde.marcas.map((m) => (pontoDentroDaCerca(m.posicao, cerca) ? { ...m, posicao: somar(m.posicao, delta) } : m))
    : molde.marcas;
  const linhaDeFio =
    opcoes.linhaDeFio && fioInteiroDentro(molde, cerca)
      ? { inicio: somar(molde.linhaDeFio.inicio, delta), fim: somar(molde.linhaDeFio.fim, delta) }
      : molde.linhaDeFio;
  return {
    ...molde,
    contorno,
    furos,
    linhasInternas,
    marcas,
    linhaDeFio,
    piques: reancorarPiques(molde.piques, molde.contorno, contorno),
  };
}

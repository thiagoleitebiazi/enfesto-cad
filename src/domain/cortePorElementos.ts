import {
  distancia,
  pontoDentroDoContorno,
  pontoMaisProximoNoContorno,
  type Contorno,
  type Ponto2D,
  type PosicaoNoContorno,
} from '../core/geometria';
import { cortarMoldeComOpcoes, CORTE_SEM_COSTURA, type OpcoesDeCorte } from './corteEUniao';
import type { Molde } from './molde';

/**
 * O corte por um elemento que não é uma reta — uma curva, um arco, uma linha
 * quebrada — ou por vários elementos emendados. Os elementos são linhas
 * internas da peça; a linha do corte vai de uma borda à outra por cima deles.
 *
 * O elemento que passa do contorno é aparado nele; o que para a até 1 mm do
 * contorno é levado até ele; o que para antes, dentro da peça, é prolongado em
 * linha reta, na direção em que acaba, até a borda.
 */

/** Duas pontas de elementos a até isto (mm) uma da outra estão emendadas. */
export const EMENDA_DE_ELEMENTOS_MM = 1;
/** A ponta do elemento a até isto (mm) do contorno está nele. */
const PONTA_NO_CONTORNO_MM = 1;
/** Dois pontos da linha de corte a menos disto (mm) um do outro viram um só. */
const PASSO_MINIMO_MM = 0.05;
/** O ponto do caminho a menos disto (mm) da reta entre os vizinhos não faz falta. */
const NA_RETA_MM = 1e-6;
/** O cruzamento a menos disto (mm) de um ponto do contorno é esse ponto (como nas outras retas que cruzam a peça). */
const VERTICE_NO_CRUZAMENTO_MM = 1e-3;
const PARALELAS = 1e-12;

/** A linha de um corte: as duas pontas, no contorno, e os pontos do caminho entre elas. */
export interface LinhaDeCorte {
  readonly a: PosicaoNoContorno;
  readonly b: PosicaoNoContorno;
  readonly miolo: readonly Ponto2D[];
}

/** Os elementos, emendados ponta com ponta numa linha só (cada um entra no sentido que serve). */
function emendar(linhas: readonly Contorno[]): Ponto2D[] {
  let cadeia = [...linhas[0]!];
  const resto = linhas.slice(1).map((l) => [...l]);
  while (resto.length > 0) {
    const cabeca = cadeia[0]!;
    const cauda = cadeia.at(-1)!;
    const k = resto.findIndex((l) => [l[0]!, l.at(-1)!].some((p) => distancia(p, cabeca) <= EMENDA_DE_ELEMENTOS_MM || distancia(p, cauda) <= EMENDA_DE_ELEMENTOS_MM));
    if (k < 0) {
      throw new Error('Os elementos indicados não se emendam: a ponta de um precisa estar na ponta do outro (a até 1 mm).');
    }
    const [l] = resto.splice(k, 1) as [Ponto2D[]];
    if (distancia(l[0]!, cauda) <= EMENDA_DE_ELEMENTOS_MM) cadeia = [...cadeia, ...l.slice(1)];
    else if (distancia(l.at(-1)!, cauda) <= EMENDA_DE_ELEMENTOS_MM) cadeia = [...cadeia, ...l.reverse().slice(1)];
    else if (distancia(l.at(-1)!, cabeca) <= EMENDA_DE_ELEMENTOS_MM) cadeia = [...l.slice(0, -1), ...cadeia];
    else cadeia = [...l.reverse().slice(0, -1), ...cadeia];
  }
  return cadeia;
}

/** O ponto do contorno onde a semirreta (ou, com `ateT`, o segmento) que sai de `origem` o encontra primeiro. */
function ondeEncontraOContorno(contorno: Contorno, origem: Ponto2D, direcao: Ponto2D, ateT = Infinity): PosicaoNoContorno | null {
  const n = contorno.length;
  let melhor: { t: number; indiceAresta: number; ponto: Ponto2D } | null = null;
  for (let i = 0; i < n; i++) {
    const p = contorno[i]!;
    const q = contorno[(i + 1) % n]!;
    const aresta = { x: q.x - p.x, y: q.y - p.y };
    const cruzado = direcao.x * aresta.y - direcao.y * aresta.x;
    if (Math.abs(cruzado) < PARALELAS) continue;
    const t = ((p.x - origem.x) * aresta.y - (p.y - origem.y) * aresta.x) / cruzado;
    const s = ((p.x - origem.x) * direcao.y - (p.y - origem.y) * direcao.x) / cruzado;
    if (t <= 1e-9 || t > ateT || s < -1e-9 || s > 1 + 1e-9) continue;
    if (!melhor || t < melhor.t) melhor = { t, indiceAresta: i, ponto: { x: origem.x + direcao.x * t, y: origem.y + direcao.y * t } };
  }
  return melhor ? noPontoDoContorno(contorno, melhor.indiceAresta, melhor.ponto) : null;
}

/** A posição no contorno, levada ao ponto dele quando está em cima de um (a aresta que começa nele). */
function noPontoDoContorno(contorno: Contorno, indiceAresta: number, p: Ponto2D): PosicaoNoContorno {
  const seguinte = (indiceAresta + 1) % contorno.length;
  if (distancia(p, contorno[indiceAresta]!) <= VERTICE_NO_CRUZAMENTO_MM) return { indiceAresta, ponto: contorno[indiceAresta]! };
  if (distancia(p, contorno[seguinte]!) <= VERTICE_NO_CRUZAMENTO_MM) return { indiceAresta: seguinte, ponto: contorno[seguinte]! };
  return { indiceAresta, ponto: p };
}

/**
 * A linha com a primeira ponta posta no contorno: levada até ele (a até 1 mm),
 * prolongada em linha reta (se para dentro da peça) ou aparada onde entra na
 * peça (se começa fora).
 */
function comAPontaNoContorno(contorno: Contorno, cadeia: readonly Ponto2D[]): { readonly posicao: PosicaoNoContorno; readonly cadeia: Ponto2D[] } {
  const ponta = cadeia[0]!;
  const perto = pontoMaisProximoNoContorno(ponta, contorno);
  if (perto.distancia <= PONTA_NO_CONTORNO_MM) {
    const posicao = noPontoDoContorno(contorno, perto.indiceAresta, perto.ponto);
    return { posicao, cadeia: [posicao.ponto, ...cadeia.slice(1)] };
  }
  if (pontoDentroDoContorno(ponta, contorno)) {
    const seguinte = cadeia[1]!;
    const comprimento = distancia(seguinte, ponta);
    const posicao = ondeEncontraOContorno(contorno, ponta, { x: (ponta.x - seguinte.x) / comprimento, y: (ponta.y - seguinte.y) / comprimento });
    if (!posicao) throw new Error('O elemento indicado não chega ao contorno da peça.');
    return { posicao, cadeia: [posicao.ponto, ...cadeia] };
  }
  for (let k = 0; k + 1 < cadeia.length; k++) {
    const de = cadeia[k]!;
    const ate = cadeia[k + 1]!;
    const posicao = ondeEncontraOContorno(contorno, de, { x: ate.x - de.x, y: ate.y - de.y }, 1);
    if (posicao) return { posicao, cadeia: [posicao.ponto, ...cadeia.slice(k + 1)] };
  }
  throw new Error('O elemento indicado não passa pela peça.');
}

/** A linha sem os pontos repetidos em seguida e sem os que estão na reta entre os vizinhos; as duas pontas ficam. */
function enxuta(linha: readonly Ponto2D[]): Ponto2D[] {
  const semRepetidos: Ponto2D[] = [];
  linha.forEach((p, i) => {
    const ultimoDaLinha = i === linha.length - 1;
    if (semRepetidos.length === 0) semRepetidos.push(p);
    else if (distancia(semRepetidos.at(-1)!, p) >= PASSO_MINIMO_MM) semRepetidos.push(p);
    // A ponta final fica no lugar: sai o ponto do caminho que estava colado nela.
    else if (ultimoDaLinha && semRepetidos.length > 1) semRepetidos[semRepetidos.length - 1] = p;
  });
  // Cada ponto é medido contra a reta do último que ficou ao seguinte: assim uma curva suave, de pontos juntos, não vira reta.
  const semAlinhados: Ponto2D[] = [];
  semRepetidos.forEach((p, i) => {
    const antes = semAlinhados.at(-1);
    const depois = semRepetidos[i + 1];
    if (!antes || !depois) {
      semAlinhados.push(p);
      return;
    }
    const comprimento = distancia(antes, depois);
    const desvio = comprimento < PASSO_MINIMO_MM ? Infinity : Math.abs(((depois.x - antes.x) * (p.y - antes.y) - (depois.y - antes.y) * (p.x - antes.x)) / comprimento);
    if (desvio > NA_RETA_MM) semAlinhados.push(p);
  });
  return semAlinhados;
}

/**
 * A linha de corte feita dos elementos indicados (linhas internas da peça,
 * pelo número): um só — reto, curvo ou quebrado — ou vários que se emendam
 * ponta com ponta. Lança erro quando eles não dão uma linha de uma borda à
 * outra.
 */
export function linhaDeCortePelosElementos(molde: Molde, indices: readonly number[]): LinhaDeCorte {
  if (indices.length === 0) throw new Error('Indique ao menos um elemento para o corte.');
  const linhas = indices.map((i) => molde.linhasInternas[i]);
  if (new Set(indices).size !== indices.length || linhas.some((l) => !l || l.length < 2)) throw new Error('Elemento não encontrado na peça.');
  const emendada = enxuta(emendar(linhas as Contorno[]));
  if (emendada.length < 2 || (emendada.length > 2 && distancia(emendada[0]!, emendada.at(-1)!) <= EMENDA_DE_ELEMENTOS_MM)) {
    throw new Error('Os elementos indicados fecham uma volta: a linha de corte precisa ir de uma borda da peça à outra.');
  }
  const doComeco = comAPontaNoContorno(molde.contorno, emendada);
  const doFim = comAPontaNoContorno(molde.contorno, [...doComeco.cadeia].reverse());
  const caminho = enxuta([...doFim.cadeia].reverse());
  return { a: doComeco.posicao, b: doFim.posicao, miolo: caminho.slice(1, -1) };
}

/**
 * "Cortar" pelos elementos indicados: a peça é dividida pela linha deles, que
 * sai da peça (virou a borda das duas partes), e o corte ganha a costura
 * pedida, como no corte pela reta.
 */
export function cortarMoldePelosElementos(
  molde: Molde,
  indices: readonly number[],
  novoId: () => string,
  opcoes: OpcoesDeCorte = CORTE_SEM_COSTURA,
): readonly [Molde, Molde] {
  const { a, b, miolo } = linhaDeCortePelosElementos(molde, indices);
  const semOsElementos: Molde = { ...molde, linhasInternas: molde.linhasInternas.filter((_, i) => !indices.includes(i)) };
  return cortarMoldeComOpcoes(semOsElementos, a, b, novoId, opcoes, miolo);
}

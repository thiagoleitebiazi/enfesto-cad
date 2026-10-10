import { arcoDaAresta } from '../core/arcos';
import {
  andarNoContorno,
  area,
  distancia,
  pontoDentroDoContorno,
  pontoMaisProximoNoContorno,
  pontoMaisProximoNoSegmento,
  trechoDoContorno,
  type Contorno,
  type Ponto2D,
  type PosicaoNoContorno,
} from '../core/geometria';
import { fioDaParte } from './corteEUniao';
import { adicionarMarca, piquesQueFicamNoContorno, semGraduacao, type Molde } from './molde';
import { semPontosRepetidos } from './regioes';

/**
 * Retas e pontos de construção (abas Construção e Produção). Neste programa
 * não há elementos soltos: as retas são as **linhas internas** da peça, e os
 * pontos, as **marcas** dela. Assim já andam, giram e são salvos com a peça.
 */

const MESMO_PONTO_MM = 1e-6;
/** Uma linha interna divide a região quando as duas pontas dela estão a menos disso (mm) da borda. */
const NA_BORDA_MM = 0.05;
const AREA_MINIMA_MM2 = 1e-6;

export type PontaDaLinha = 'inicio' | 'fim';

/** Uma linha interna perto de um ponto: qual é, e de que ponta o ponto está mais perto. */
export interface LinhaPerto {
  readonly linha: number;
  readonly ponta: PontaDaLinha;
}

function distanciaAteALinha(p: Ponto2D, linha: Contorno): number {
  let menor = Infinity;
  for (let i = 1; i < linha.length; i++) menor = Math.min(menor, distancia(p, pontoMaisProximoNoSegmento(p, linha[i - 1]!, linha[i]!)));
  return menor;
}

/** A linha interna que passa a até `raioMm` do ponto (a mais próxima), e a ponta dela mais perto dele. */
export function linhaInternaPerto(molde: Molde, p: Ponto2D, raioMm: number): LinhaPerto | null {
  let melhor: { linha: number; distancia: number } | null = null;
  molde.linhasInternas.forEach((linha, i) => {
    if (linha.length < 2) return;
    const d = distanciaAteALinha(p, linha);
    if (d <= raioMm && (!melhor || d < melhor.distancia)) melhor = { linha: i, distancia: d };
  });
  if (!melhor) return null;
  const { linha } = melhor as { linha: number };
  const pontos = molde.linhasInternas[linha]!;
  return { linha, ponta: distancia(p, pontos[0]!) <= distancia(p, pontos.at(-1)!) ? 'inicio' : 'fim' };
}

/** Um trecho reto da peça: uma aresta do contorno ou um segmento de uma linha interna. */
export interface SegmentoDaPeca {
  readonly de: Ponto2D;
  readonly ate: Ponto2D;
}

/** O trecho reto (aresta do contorno ou segmento de linha interna) que passa mais perto do ponto, a até `raioMm`. */
export function segmentoPerto(molde: Molde, p: Ponto2D, raioMm: number): SegmentoDaPeca | null {
  let melhor: { segmento: SegmentoDaPeca; distancia: number } | null = null;
  const considerar = (de: Ponto2D, ate: Ponto2D): void => {
    if (distancia(de, ate) < MESMO_PONTO_MM) return;
    const d = distancia(p, pontoMaisProximoNoSegmento(p, de, ate));
    if (d <= raioMm && (!melhor || d < melhor.distancia)) melhor = { segmento: { de, ate }, distancia: d };
  };
  molde.contorno.forEach((v, i) => considerar(v, molde.contorno[(i + 1) % molde.contorno.length]!));
  for (const linha of molde.linhasInternas) for (let i = 1; i < linha.length; i++) considerar(linha[i - 1]!, linha[i]!);
  return melhor ? (melhor as { segmento: SegmentoDaPeca }).segmento : null;
}

/**
 * A direção, no mundo, de um ângulo medido na tela: 0° aponta para a direita e
 * o ângulo cresce no sentido anti-horário, como se vê no desenho. (A tela
 * troca os eixos: a horizontal é o `y` do mundo, e a vertical, o `x`, para
 * baixo.)
 */
export function direcaoDoAngulo(anguloGraus: number): Ponto2D {
  const a = (anguloGraus * Math.PI) / 180;
  return { x: -Math.sin(a), y: Math.cos(a) };
}

/** "Por ângulo": uma reta nova, de `inicio`, com o ângulo (o da tela) e o comprimento dados. */
export function criarRetaPorAngulo(molde: Molde, inicio: Ponto2D, anguloGraus: number, comprimentoMm: number): Molde {
  if (!Number.isFinite(anguloGraus)) throw new Error('O ângulo precisa ser um número.');
  if (!Number.isFinite(comprimentoMm) || !(comprimentoMm > 0)) throw new Error('O comprimento da reta precisa ser maior que zero.');
  const d = direcaoDoAngulo(anguloGraus);
  const fim = { x: inicio.x + d.x * comprimentoMm, y: inicio.y + d.y * comprimentoMm };
  return { ...molde, linhasInternas: [...molde.linhasInternas, [inicio, fim]] };
}

/** A ponta da linha e a direção em que ela se prolonga (a do último trecho, para fora). */
function saidaDaLinha(linha: Contorno, ponta: PontaDaLinha): { readonly ponto: Ponto2D; readonly direcao: Ponto2D } {
  const ponto = ponta === 'inicio' ? linha[0]! : linha.at(-1)!;
  const anterior = ponta === 'inicio' ? linha[1]! : linha.at(-2)!;
  const comprimento = distancia(anterior, ponto);
  if (comprimento < MESMO_PONTO_MM) throw new Error('Essa ponta da linha não tem direção para prolongar.');
  return { ponto, direcao: { x: (ponto.x - anterior.x) / comprimento, y: (ponto.y - anterior.y) / comprimento } };
}

function linhaDoMolde(molde: Molde, indice: number): Contorno {
  const linha = molde.linhasInternas[indice];
  if (!linha || linha.length < 2) throw new Error('Linha interna não encontrada na peça.');
  return linha;
}

function comAPonta(molde: Molde, indice: number, ponta: PontaDaLinha, novaPonta: Ponto2D): Molde {
  return {
    ...molde,
    linhasInternas: molde.linhasInternas.map((linha, i) => {
      if (i !== indice) return linha;
      return ponta === 'inicio' ? [novaPonta, ...linha.slice(1)] : [...linha.slice(0, -1), novaPonta];
    }),
  };
}

/** "Estender reta": a ponta indicada da linha interna anda `comprimentoMm` para fora, na direção em que a linha já ia. */
export function estenderReta(molde: Molde, linha: number, ponta: PontaDaLinha, comprimentoMm: number): Molde {
  if (!Number.isFinite(comprimentoMm) || !(comprimentoMm > 0)) throw new Error('O comprimento a acrescentar precisa ser maior que zero.');
  const { ponto, direcao } = saidaDaLinha(linhaDoMolde(molde, linha), ponta);
  return comAPonta(molde, linha, ponta, { x: ponto.x + direcao.x * comprimentoMm, y: ponto.y + direcao.y * comprimentoMm });
}

/** Onde a semirreta (de `origem`, na direção unitária `d`) encontra o segmento, e a que distância; `null` se não encontra. */
function encontroComSegmento(origem: Ponto2D, d: Ponto2D, a: Ponto2D, b: Ponto2D): { readonly ponto: Ponto2D; readonly distancia: number } | null {
  const e = { x: b.x - a.x, y: b.y - a.y };
  const denominador = d.x * e.y - d.y * e.x;
  if (Math.abs(denominador) < 1e-12) return null;
  const t = ((a.x - origem.x) * e.y - (a.y - origem.y) * e.x) / denominador;
  const u = ((a.x - origem.x) * d.y - (a.y - origem.y) * d.x) / denominador;
  if (t <= 1e-6 || u < -1e-9 || u > 1 + 1e-9) return null;
  return { ponto: { x: a.x + e.x * Math.max(0, Math.min(1, u)), y: a.y + e.y * Math.max(0, Math.min(1, u)) }, distancia: t };
}

/**
 * "Estender até elemento": a ponta indicada da linha interna anda, na direção
 * em que a linha já ia, até o primeiro elemento que encontra — o contorno, um
 * furo ou outra linha interna.
 */
export function estenderAteElemento(molde: Molde, linha: number, ponta: PontaDaLinha): Molde {
  const { ponto, direcao } = saidaDaLinha(linhaDoMolde(molde, linha), ponta);
  let melhor: { ponto: Ponto2D; distancia: number } | null = null;
  const considerar = (a: Ponto2D, b: Ponto2D): void => {
    const encontro = encontroComSegmento(ponto, direcao, a, b);
    if (encontro && (!melhor || encontro.distancia < melhor.distancia)) melhor = encontro;
  };
  for (const fechado of [molde.contorno, ...molde.furos]) fechado.forEach((v, i) => considerar(v, fechado[(i + 1) % fechado.length]!));
  molde.linhasInternas.forEach((outra, i) => {
    if (i === linha) return;
    for (let k = 1; k < outra.length; k++) considerar(outra[k - 1]!, outra[k]!);
  });
  if (!melhor) throw new Error('Nessa direção a linha não encontra o contorno nem outro elemento da peça.');
  return comAPonta(molde, linha, ponta, (melhor as { ponto: Ponto2D }).ponto);
}

/** Onde as retas dos dois segmentos (prolongadas) se encontram; `null` se são paralelas. */
export function encontroDasRetas(a: SegmentoDaPeca, b: SegmentoDaPeca): Ponto2D | null {
  const da = { x: a.ate.x - a.de.x, y: a.ate.y - a.de.y };
  const db = { x: b.ate.x - b.de.x, y: b.ate.y - b.de.y };
  const denominador = da.x * db.y - da.y * db.x;
  if (Math.abs(denominador) < 1e-9 * Math.hypot(da.x, da.y) * Math.hypot(db.x, db.y)) return null;
  const t = ((b.de.x - a.de.x) * db.y - (b.de.y - a.de.y) * db.x) / denominador;
  return { x: a.de.x + da.x * t, y: a.de.y + da.y * t };
}

/**
 * "Estender duas retas": as pontas indicadas de duas linhas internas vão para
 * o ponto em que as duas retas se encontram (prolongando ou encurtando cada
 * uma), formando um canto.
 */
export function estenderDuasRetas(molde: Molde, linhaA: number, pontaA: PontaDaLinha, linhaB: number, pontaB: PontaDaLinha): Molde {
  if (linhaA === linhaB) throw new Error('Indique duas linhas diferentes.');
  const a = saidaDaLinha(linhaDoMolde(molde, linhaA), pontaA);
  const b = saidaDaLinha(linhaDoMolde(molde, linhaB), pontaB);
  const encontro = encontroDasRetas(
    { de: a.ponto, ate: { x: a.ponto.x + a.direcao.x, y: a.ponto.y + a.direcao.y } },
    { de: b.ponto, ate: { x: b.ponto.x + b.direcao.x, y: b.ponto.y + b.direcao.y } },
  );
  if (!encontro) throw new Error('As duas retas são paralelas: não se encontram.');
  return comAPonta(comAPonta(molde, linhaA, pontaA, encontro), linhaB, pontaB, encontro);
}

/** "Por interseção": um ponto (marca) onde as retas dos dois trechos se encontram. */
export function pontoPorIntersecao(molde: Molde, a: SegmentoDaPeca, b: SegmentoDaPeca, id: string): Molde {
  const encontro = encontroDasRetas(a, b);
  if (!encontro) throw new Error('Os dois trechos são paralelos: as retas deles não se encontram.');
  return adicionarMarca(molde, encontro, id);
}

/** "No centro do arco": um ponto (marca) no centro do arco que passa pela posição indicada no contorno. */
export function pontoNoCentroDoArco(molde: Molde, posicao: PosicaoNoContorno, id: string): Molde {
  const n = molde.contorno.length;
  const noVertice = distancia(posicao.ponto, molde.contorno[posicao.indiceAresta]!) < MESMO_PONTO_MM;
  const arco =
    arcoDaAresta(molde.contorno, posicao.indiceAresta) ?? (noVertice ? arcoDaAresta(molde.contorno, (posicao.indiceAresta - 1 + n) % n) : null);
  if (!arco) throw new Error('Esse trecho do contorno é uma reta: não tem centro. Clique sobre um arco.');
  return adicionarMarca(molde, arco.centro, id);
}

/**
 * "No perímetro": um ponto (marca) sobre o contorno, a `distanciaMm` da
 * posição indicada, andando no sentido da numeração dos pontos (ou no
 * contrário, com distância negativa).
 */
export function pontoNoPerimetro(molde: Molde, de: PosicaoNoContorno, distanciaMm: number, id: string): Molde {
  if (!Number.isFinite(distanciaMm)) throw new Error('A distância precisa ser um número.');
  return adicionarMarca(molde, andarNoContorno(molde.contorno, de, distanciaMm).ponto, id);
}

/** "Por distância": um ponto (marca) a `distanciaMm` de `de`, na direção de `para`. */
export function pontoPorDistancia(molde: Molde, de: Ponto2D, para: Ponto2D, distanciaMm: number, id: string): Molde {
  if (!Number.isFinite(distanciaMm) || !(distanciaMm > 0)) throw new Error('A distância precisa ser maior que zero.');
  const comprimento = distancia(de, para);
  if (comprimento < MESMO_PONTO_MM) throw new Error('Indique um segundo ponto diferente do primeiro, para dar a direção.');
  const k = distanciaMm / comprimento;
  return adicionarMarca(molde, { x: de.x + (para.x - de.x) * k, y: de.y + (para.y - de.y) * k }, id);
}

/**
 * A região da peça em que está o ponto `dentro`, delimitada pelo contorno e
 * pelas linhas internas: cada linha que vai de borda a borda divide a região,
 * e fica o lado do ponto; um laço fechado que contém o ponto passa a ser a
 * região. `null` se nenhuma linha interna delimita nada ali (a região seria a
 * peça inteira).
 */
export function regiaoDaPeca(molde: Molde, dentro: Ponto2D): Ponto2D[] | null {
  if (!pontoDentroDoContorno(dentro, molde.contorno)) throw new Error('Clique dentro da peça, na região a extrair.');
  let regiao: Ponto2D[] = [...molde.contorno];
  let delimitada = false;
  for (const linha of molde.linhasInternas) {
    if (linha.length < 2) continue;
    if (linha.length >= 4 && distancia(linha[0]!, linha.at(-1)!) < MESMO_PONTO_MM) {
      const laco = linha.slice(0, -1);
      if (pontoDentroDoContorno(dentro, laco) && area(laco) < area(regiao)) {
        regiao = laco;
        delimitada = true;
      }
      continue;
    }
    // Só conta o pedaço da linha que atravessa a região de hoje, de borda a borda (a linha pode cruzar outra divisa).
    for (const pedaco of pedacosQueAtravessam(linha, regiao)) {
      const a = pontoMaisProximoNoContorno(pedaco[0]!, regiao);
      const b = pontoMaisProximoNoContorno(pedaco.at(-1)!, regiao);
      if (distancia(a.ponto, b.ponto) < MESMO_PONTO_MM) continue;
      const posA = { indiceAresta: a.indiceAresta, ponto: a.ponto };
      const posB = { indiceAresta: b.indiceAresta, ponto: b.ponto };
      const miolo = pedaco.slice(1, -1);
      const lados = [
        [...trechoDoContorno(regiao, posA, posB), ...[...miolo].reverse()],
        [...trechoDoContorno(regiao, posB, posA), ...miolo],
      ].map((lado) => semPontosRepetidos(lado));
      if (!lados.every((lado) => lado.length >= 3 && area(lado) > AREA_MINIMA_MM2)) continue;
      const doPonto = lados.find((lado) => pontoDentroDoContorno(dentro, lado));
      if (doPonto) {
        regiao = doPonto;
        delimitada = true;
      }
    }
  }
  return delimitada ? regiao : null;
}

/** Em que fração (de 0 a 1) do segmento `p`→`q` ele cruza o segmento `a`→`b`; `null` se não cruza. */
function cruzamento(p: Ponto2D, q: Ponto2D, a: Ponto2D, b: Ponto2D): number | null {
  const d = { x: q.x - p.x, y: q.y - p.y };
  const e = { x: b.x - a.x, y: b.y - a.y };
  const denominador = d.x * e.y - d.y * e.x;
  if (Math.abs(denominador) < 1e-12) return null;
  const t = ((a.x - p.x) * e.y - (a.y - p.y) * e.x) / denominador;
  const u = ((a.x - p.x) * d.y - (a.y - p.y) * d.x) / denominador;
  return t >= -1e-9 && t <= 1 + 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 ? Math.max(0, Math.min(1, t)) : null;
}

/**
 * Os pedaços da linha que atravessam a região de uma borda a outra, por
 * dentro dela. A linha é cortada em cada ponto em que toca a borda; valem os
 * pedaços que começam e terminam na borda e passam por dentro.
 */
function pedacosQueAtravessam(linha: Contorno, regiao: Contorno): Ponto2D[][] {
  // A linha com um ponto a mais em cada cruzamento com a borda da região.
  const pontos: Ponto2D[] = [linha[0]!];
  for (let i = 1; i < linha.length; i++) {
    const p = linha[i - 1]!;
    const q = linha[i]!;
    const cortes = regiao
      .map((a, k) => cruzamento(p, q, a, regiao[(k + 1) % regiao.length]!))
      .filter((t): t is number => t !== null && t > 1e-9 && t < 1 - 1e-9)
      .sort((x, y) => x - y);
    for (const t of cortes) pontos.push({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    pontos.push(q);
  }
  const naBorda = (p: Ponto2D): boolean => pontoMaisProximoNoContorno(p, regiao).distancia <= NA_BORDA_MM;
  const pedacos: Ponto2D[][] = [];
  let atual: Ponto2D[] = [];
  for (const p of pontos.filter((q, i) => i === 0 || distancia(q, pontos[i - 1]!) > 1e-9)) {
    atual.push(p);
    if (atual.length > 1 && naBorda(p)) {
      pedacos.push(atual);
      atual = [p];
    }
  }
  return pedacos.filter((pedaco) => {
    if (!naBorda(pedaco[0]!)) return false;
    const meio = { x: (pedaco[0]!.x + pedaco[1]!.x) / 2, y: (pedaco[0]!.y + pedaco[1]!.y) / 2 };
    return pontoDentroDoContorno(meio, regiao) && pontoMaisProximoNoContorno(meio, regiao).distancia > NA_BORDA_MM;
  });
}

/**
 * "Extrair molde": uma peça nova com a forma da região em que está o ponto
 * `dentro` (ver `regiaoDaPeca`). Leva os furos, as linhas internas e as marcas
 * que estão inteiros dentro dela e os piques das bordas que herdou; a peça de
 * origem não muda.
 */
export function extrairMolde(molde: Molde, dentro: Ponto2D, novoId: () => string, nome: string): Molde {
  const regiao = regiaoDaPeca(molde, dentro);
  if (!regiao) {
    throw new Error(
      'Nenhuma linha interna delimita uma região aí: seria a peça inteira. Desenhe a linha de divisão (com “Por ângulo” e “Estender até elemento”, por exemplo) e clique de novo.',
    );
  }
  const naRegiao = (p: Ponto2D): boolean => pontoDentroDoContorno(p, regiao);
  return {
    ...semGraduacao(molde),
    id: novoId(),
    nome,
    contorno: regiao,
    furos: molde.furos.filter((furo) => furo.every(naRegiao)),
    linhasInternas: molde.linhasInternas.filter((linha) => linha.every(naRegiao)),
    marcas: molde.marcas.filter((m) => naRegiao(m.posicao)).map((m) => ({ ...m, id: novoId() })),
    piques: piquesQueFicamNoContorno(molde.piques, regiao).map((p) => ({ ...p, id: novoId() })),
    linhaDeFio: fioDaParte(molde.linhaDeFio, regiao),
    cotas: [],
  };
}

/** Um elemento de construção da peça: uma linha interna (pelo número) ou uma marca (pelo id). */
export type ElementoDaPeca = { readonly tipo: 'linha'; readonly indice: number } | { readonly tipo: 'marca'; readonly id: string };

/** O elemento da peça que está a até `raioMm` do ponto: uma marca, se houver uma ali; senão, a linha interna mais próxima. */
export function elementoPerto(molde: Molde, p: Ponto2D, raioMm: number): ElementoDaPeca | null {
  let marca: { id: string; distancia: number } | null = null;
  for (const m of molde.marcas) {
    const d = distancia(p, m.posicao);
    if (d <= raioMm && (!marca || d < marca.distancia)) marca = { id: m.id, distancia: d };
  }
  if (marca) return { tipo: 'marca', id: marca.id };
  const linha = linhaInternaPerto(molde, p, raioMm);
  return linha ? { tipo: 'linha', indice: linha.linha } : null;
}

/** Um ponto de referência do elemento: a posição da marca, ou o primeiro ponto da linha. */
export function ancoraDoElemento(molde: Molde, elemento: ElementoDaPeca): Ponto2D | null {
  if (elemento.tipo === 'marca') return molde.marcas.find((m) => m.id === elemento.id)?.posicao ?? null;
  return molde.linhasInternas[elemento.indice]?.[0] ?? null;
}

/** Move o elemento inteiro pelo deslocamento dado. */
export function moverElemento(molde: Molde, elemento: ElementoDaPeca, delta: Ponto2D): Molde {
  const levar = (p: Ponto2D): Ponto2D => ({ x: p.x + delta.x, y: p.y + delta.y });
  if (elemento.tipo === 'marca') {
    if (!molde.marcas.some((m) => m.id === elemento.id)) throw new Error('Ponto não encontrado na peça.');
    return { ...molde, marcas: molde.marcas.map((m) => (m.id === elemento.id ? { ...m, posicao: levar(m.posicao) } : m)) };
  }
  linhaDoMolde(molde, elemento.indice);
  return { ...molde, linhasInternas: molde.linhasInternas.map((linha, i) => (i === elemento.indice ? linha.map(levar) : linha)) };
}

/** Tira o elemento da peça. */
export function removerElemento(molde: Molde, elemento: ElementoDaPeca): Molde {
  if (elemento.tipo === 'marca') return { ...molde, marcas: molde.marcas.filter((m) => m.id !== elemento.id) };
  return { ...molde, linhasInternas: molde.linhasInternas.filter((_, i) => i !== elemento.indice) };
}

/**
 * "Dividir elementos": a linha interna passa a ser duas, separadas no ponto
 * dela mais próximo de `em`. Recusa dividir bem numa das pontas.
 */
export function dividirLinha(molde: Molde, indice: number, em: Ponto2D): Molde {
  const linha = linhaDoMolde(molde, indice);
  let melhor = { segmento: 1, ponto: linha[0]!, distancia: Infinity };
  for (let i = 1; i < linha.length; i++) {
    const noSegmento = pontoMaisProximoNoSegmento(em, linha[i - 1]!, linha[i]!);
    const d = distancia(em, noSegmento);
    if (d < melhor.distancia) melhor = { segmento: i, ponto: noSegmento, distancia: d };
  }
  const corte = melhor.ponto;
  if (distancia(corte, linha[0]!) < MESMO_PONTO_MM || distancia(corte, linha.at(-1)!) < MESMO_PONTO_MM) {
    throw new Error('Clique no meio da linha, e não numa das pontas, para dividi-la.');
  }
  const primeira = semPontosRepetidosNaLinha([...linha.slice(0, melhor.segmento), corte]);
  const segunda = semPontosRepetidosNaLinha([corte, ...linha.slice(melhor.segmento)]);
  return {
    ...molde,
    linhasInternas: molde.linhasInternas.flatMap((outra, i) => (i === indice ? [primeira, segunda] : [outra])),
  };
}

function semPontosRepetidosNaLinha(linha: readonly Ponto2D[]): Ponto2D[] {
  return linha.filter((p, i) => i === 0 || distancia(p, linha[i - 1]!) > MESMO_PONTO_MM);
}

/**
 * "Transformar em elementos": o contorno da peça `origem` entra na peça
 * `destino` como uma linha interna fechada, no lugar em que está — a marcação
 * de um bolso sobre a frente, por exemplo. A peça de origem não muda.
 */
export function contornoComoLinhaInterna(destino: Molde, origem: Molde): Molde {
  if (destino.id === origem.id) throw new Error('Clique em outra peça: o contorno dela entra como linha interna da peça selecionada.');
  return { ...destino, linhasInternas: [...destino.linhasInternas, [...origem.contorno, origem.contorno[0]!]] };
}

/** "Copiar elemento": o elemento da peça `origem` ganha uma cópia, no mesmo lugar, na peça `destino`. */
export function copiarElemento(destino: Molde, origem: Molde, elemento: ElementoDaPeca, novoId: () => string): Molde {
  if (elemento.tipo === 'marca') {
    const marca = origem.marcas.find((m) => m.id === elemento.id);
    if (!marca) throw new Error('Ponto não encontrado na peça.');
    return { ...destino, marcas: [...destino.marcas, { ...marca, id: novoId() }] };
  }
  return { ...destino, linhasInternas: [...destino.linhasInternas, [...linhaDoMolde(origem, elemento.indice)]] };
}

import { curvaPorPontos, reamostrarLinha } from '../core/curvas';
import {
  area,
  comprimentoDaLinha,
  distancia,
  pontoMaisProximoNoSegmento,
  trechoDoContorno,
  trechoMaisCurto,
  type Ponto2D,
  type PosicaoNoContorno,
} from '../core/geometria';
import { comAFilaTrocada, filaNoContorno, gerarCurva } from './filaDeCurva';
import { arcoRegistrado, piquesQueFicamNoContorno, semCampo, substituirTrechoDoMolde, type CurvaDaPeca, type Molde } from './molde';
import { distanciaAteALinha } from './regioes';

export { gerarCurva } from './filaDeCurva';

/**
 * As curvas e os arcos registrados na peça (`Molde.curvas`): cada um guarda
 * os pontos por onde passa e os pontos do contorno que gerou. Com o registro,
 * dá para mexer num ponto de passagem depois e ter a curva refeita por ele,
 * em vez de arrastar os pontos do contorno um a um.
 */

const AREA_MINIMA_MM2 = 1e-6;
/** Dois pontos de passagem da mesma curva ficam, pelo menos, a esta distância um do outro, medida sobre ela (mm). */
const MINIMO_ENTRE_PONTOS_DE_PASSAGEM_MM = 1;
/** O máximo de pontos de passagem de um trecho tornado curva editável. */
export const MAXIMO_DE_PONTOS_DE_PASSAGEM = 20;

/** As curvas registradas que continuam na peça como foram postas. */
export function curvasDaPeca(molde: Molde): CurvaDaPeca[] {
  return (molde.curvas ?? []).filter((curva) => filaNoContorno(molde.contorno, curva.pontos) !== null);
}

/** A peça sem os registros de curva que deixaram de valer (os pontos deles mudaram). */
export function comCurvasValidas(molde: Molde): Molde {
  if (!molde.curvas) return molde;
  const validas = curvasDaPeca(molde);
  if (validas.length === 0) return semCampo(molde, 'curvas');
  return validas.length === molde.curvas.length ? molde : { ...molde, curvas: validas };
}

/**
 * A peça com a curva que acabou de entrar no contorno registrada: os pontos
 * por onde ela passa (`controles`) e os pontos que gerou (`pontos`, de uma
 * ponta à outra). Sem ponto de passagem não há o que registrar — a não ser na
 * curva pré-definida, que fica registrada pela `forma` e pelas duas pontas.
 */
export function comCurvaRegistrada(
  molde: Molde,
  tipo: CurvaDaPeca['tipo'],
  controles: readonly Ponto2D[],
  pontos: readonly Ponto2D[],
  id: string,
  forma?: CurvaDaPeca['forma'],
): Molde {
  const serve = tipo === 'forma' ? controles.length === 2 && forma !== undefined && pontos.length >= 3 : controles.length >= 3;
  if (!serve) return comCurvasValidas(molde);
  return comCurvasValidas({ ...molde, curvas: [...(molde.curvas ?? []), { id, tipo, controles, pontos, ...(forma ? { forma } : {}) }] });
}

/** A peça com um arco de círculo que acabou de entrar no contorno registrado: as pontas e o ponto do meio dele como ponto de passagem. */
export function comArcoRegistrado(molde: Molde, pontos: readonly Ponto2D[], id: string): Molde {
  if (pontos.length < 3) return comCurvasValidas(molde);
  return comCurvasValidas({ ...molde, curvas: [...(molde.curvas ?? []), arcoRegistrado(id, pontos)] });
}

/** Um ponto de passagem de uma curva registrada: a curva e o número dele entre os pontos por onde ela passa. */
export interface ControleDeCurva {
  readonly curva: CurvaDaPeca;
  readonly indice: number;
}

/** O ponto de passagem mais perto do ponto dado, a até `raioMm`. As duas pontas da curva não contam: são pontos do contorno como os outros. */
export function controlePerto(molde: Molde, p: Ponto2D, raioMm: number): ControleDeCurva | null {
  let melhor: { controle: ControleDeCurva; distancia: number } | null = null;
  for (const curva of curvasDaPeca(molde)) {
    for (let indice = 1; indice < curva.controles.length - 1; indice++) {
      const d = distancia(p, curva.controles[indice]!);
      if (d <= raioMm && (!melhor || d < melhor.distancia)) melhor = { controle: { curva, indice }, distancia: d };
    }
  }
  return melhor ? melhor.controle : null;
}

/** A curva registrada que passa mais perto do ponto, a até `raioMm` dele. */
export function curvaPerto(molde: Molde, p: Ponto2D, raioMm: number): CurvaDaPeca | null {
  let melhor: { curva: CurvaDaPeca; distancia: number } | null = null;
  for (const curva of curvasDaPeca(molde)) {
    const d = distanciaAteALinha(p, curva.pontos);
    if (d <= raioMm && (!melhor || d < melhor.distancia)) melhor = { curva, distancia: d };
  }
  return melhor ? melhor.curva : null;
}

function curvaRegistrada(molde: Molde, curvaId: string): CurvaDaPeca {
  const curva = curvasDaPeca(molde).find((c) => c.id === curvaId);
  if (!curva) throw new Error('Essa curva foi mexida à mão e já não pode ser mudada pelos pontos de passagem.');
  return curva;
}

/**
 * A peça com a curva refeita pelos pontos de passagem dados, no lugar da
 * antiga. As pontas não saem do lugar. Sem nenhum ponto de passagem, o trecho
 * vira a reta entre as pontas, e o registro sai.
 */
function comACurvaRefeita(molde: Molde, curva: CurvaDaPeca, controles: readonly Ponto2D[]): Molde {
  const fila = filaNoContorno(molde.contorno, curva.pontos)!;
  const reta = curva.tipo !== 'forma' && controles.length < 3;
  const linha = reta ? [controles[0]!, controles.at(-1)!] : gerarCurva(curva.tipo, controles, curva.forma);
  const novo = comAFilaTrocada(molde.contorno, fila, curva.pontos.length, linha);
  if (novo.length < 3 || !(area(novo) > AREA_MINIMA_MM2)) throw new Error('A peça ficaria sem área com a curva passando por aí.');
  return comCurvasValidas({
    ...molde,
    contorno: novo,
    piques: piquesQueFicamNoContorno(molde.piques, novo),
    curvas: reta
      ? (molde.curvas ?? []).filter((c) => c.id !== curva.id)
      : (molde.curvas ?? []).map((c) => (c.id === curva.id ? { ...c, controles, pontos: linha } : c)),
  });
}

/**
 * Leva um ponto de passagem para outro lugar: a curva é refeita pelos pontos
 * de passagem de agora e entra no contorno no lugar da antiga. As pontas não
 * saem do lugar.
 */
export function moverControle(molde: Molde, curvaId: string, indice: number, novaPosicao: Ponto2D): Molde {
  const curva = curvaRegistrada(molde, curvaId);
  if (!Number.isInteger(indice) || indice <= 0 || indice >= curva.controles.length - 1) {
    throw new Error('As pontas da curva não se movem por aqui: use Mover ponto, e a curva acompanha.');
  }
  return comACurvaRefeita(
    molde,
    curva,
    curva.controles.map((c, i) => (i === indice ? novaPosicao : c)),
  );
}

/** A que distância do começo da linha, medida sobre ela, fica o ponto dela mais perto de `p` — e que ponto é esse. */
function posicaoNaLinha(linha: readonly Ponto2D[], p: Ponto2D): { readonly s: number; readonly ponto: Ponto2D } {
  let melhor = { s: 0, ponto: linha[0]!, distancia: Infinity };
  let andado = 0;
  for (let i = 1; i < linha.length; i++) {
    const a = linha[i - 1]!;
    const b = linha[i]!;
    const perto = pontoMaisProximoNoSegmento(p, a, b);
    const d = distancia(p, perto);
    if (d < melhor.distancia) melhor = { s: andado + distancia(a, perto), ponto: perto, distancia: d };
    andado += distancia(a, b);
  }
  return { s: melhor.s, ponto: melhor.ponto };
}

/**
 * Põe mais um ponto de passagem na curva, no ponto dela mais perto de `p`. A
 * curva é refeita com ele: como o ponto novo está sobre a curva, a forma
 * quase não muda — ele serve para ser movido depois.
 */
export function acrescentarControle(molde: Molde, curvaId: string, p: Ponto2D): Molde {
  const curva = curvaRegistrada(molde, curvaId);
  if (curva.tipo === 'arco') {
    throw new Error('O arco passa por três pontos só: para ter mais pontos de passagem, torne o trecho uma curva editável.');
  }
  if (curva.tipo === 'forma') {
    throw new Error('A curva pré-definida não tem pontos de passagem: para tê-los, torne o trecho uma curva editável.');
  }
  const novo = posicaoNaLinha(curva.pontos, p);
  const dosControles = curva.controles.map((c) => posicaoNaLinha(curva.pontos, c).s);
  if (dosControles.some((s) => Math.abs(s - novo.s) < MINIMO_ENTRE_PONTOS_DE_PASSAGEM_MM)) {
    throw new Error('Já há um ponto de passagem aí (ou é uma ponta da curva).');
  }
  const depois = dosControles.findIndex((s) => s > novo.s);
  if (depois <= 0) throw new Error('O ponto de passagem novo precisa ficar entre as duas pontas da curva.');
  return comACurvaRefeita(molde, curva, [...curva.controles.slice(0, depois), novo.ponto, ...curva.controles.slice(depois)]);
}

/**
 * Tira um ponto de passagem: a curva é refeita pelos que ficam. Tirado o
 * último, o trecho vira a reta entre as pontas, e a curva deixa de ter
 * registro.
 */
export function removerControle(molde: Molde, curvaId: string, indice: number): Molde {
  const curva = curvaRegistrada(molde, curvaId);
  if (!Number.isInteger(indice) || indice <= 0 || indice >= curva.controles.length - 1) {
    throw new Error('As pontas da curva não saem por aqui: são pontos do contorno.');
  }
  return comACurvaRefeita(
    molde,
    curva,
    curva.controles.filter((_, i) => i !== indice),
  );
}

/**
 * Torna um trecho do contorno (o caminho mais curto entre as duas posições)
 * uma curva registrada: `pontosDePassagem` pontos igualmente espaçados sobre
 * o trecho viram os pontos de passagem, e a curva suave por eles entra no
 * lugar do trecho. É o caminho para a curva que não tem registro — de um
 * projeto antigo, de uma peça importada, desenhada ponto a ponto ou mexida à
 * mão. `desvioMm` diz quanto a forma mudou, no ponto em que mais mudou.
 */
export function tornarTrechoCurva(
  molde: Molde,
  a: PosicaoNoContorno,
  b: PosicaoNoContorno,
  pontosDePassagem: number,
  id: string,
): { readonly molde: Molde; readonly desvioMm: number } {
  if (!Number.isInteger(pontosDePassagem) || pontosDePassagem < 1 || pontosDePassagem > MAXIMO_DE_PONTOS_DE_PASSAGEM) {
    throw new Error(`O número de pontos de passagem precisa ser um inteiro de 1 a ${MAXIMO_DE_PONTOS_DE_PASSAGEM}.`);
  }
  const { de, ate, invertido } = trechoMaisCurto(molde.contorno, a, b);
  const naOrdem = trechoDoContorno(molde.contorno, de, ate);
  const caminho = invertido ? naOrdem.reverse() : naOrdem;
  if (caminho.length < 2 || !(comprimentoDaLinha(caminho) > 2 * MINIMO_ENTRE_PONTOS_DE_PASSAGEM_MM)) {
    throw new Error('O trecho é curto demais para virar uma curva.');
  }
  const controles = reamostrarLinha(caminho, pontosDePassagem + 2);
  const linha = curvaPorPontos(controles);
  const trocada = substituirTrechoDoMolde(molde, a, b, linha.slice(1, -1));
  const desvioMm = Math.max(...caminho.map((p) => distanciaAteALinha(p, linha)), ...linha.map((p) => distanciaAteALinha(p, caminho)));
  return { molde: comCurvaRegistrada(trocada, 'curva', controles, linha, id), desvioMm };
}

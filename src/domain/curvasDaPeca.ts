import { arcoPorTresPontos, curvaPorPontos } from '../core/curvas';
import { area, distancia, substituirTrechoDoContorno, type Contorno, type Ponto2D } from '../core/geometria';
import { piquesQueFicamNoContorno, semCampo, type CurvaDaPeca, type Molde } from './molde';

/**
 * As curvas e os arcos registrados na peça (`Molde.curvas`): cada um guarda
 * os pontos por onde passa e os pontos do contorno que gerou. Com o registro,
 * dá para mexer num ponto de passagem depois e ter a curva refeita por ele,
 * em vez de arrastar os pontos do contorno um a um.
 */

const NO_MESMO_LUGAR_MM = 1e-6;
const AREA_MINIMA_MM2 = 1e-6;

function mesmoLugar(a: Ponto2D, b: Ponto2D): boolean {
  return distancia(a, b) <= NO_MESMO_LUGAR_MM;
}

/**
 * Onde começa, no contorno, a fila de pontos da curva, e em que sentido ela
 * corre (1: o da numeração; -1: o contrário). `null` se os pontos já não
 * estão no contorno, seguidos e na ordem.
 */
function filaNoContorno(contorno: Contorno, pontos: readonly Ponto2D[]): { readonly inicio: number; readonly passo: 1 | -1 } | null {
  const n = contorno.length;
  const k = pontos.length;
  if (k < 2 || k > n) return null;
  for (let i = 0; i < n; i++) {
    if (!mesmoLugar(contorno[i]!, pontos[0]!)) continue;
    for (const passo of [1, -1] as const) {
      if (pontos.every((p, j) => mesmoLugar(contorno[(((i + passo * j) % n) + n) % n]!, p))) return { inicio: i, passo };
    }
  }
  return null;
}

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

/** A linha que passa pelos pontos dados: a curva suave por todos eles, ou o arco de círculo pelos três. */
export function gerarCurva(tipo: CurvaDaPeca['tipo'], controles: readonly Ponto2D[]): Ponto2D[] {
  if (tipo === 'arco') {
    const [inicio, meio, fim] = controles;
    if (!inicio || !meio || !fim || controles.length !== 3) throw new Error('O arco passa por três pontos: as duas pontas e um ponto dele.');
    return arcoPorTresPontos(inicio, meio, fim);
  }
  return curvaPorPontos(controles);
}

/**
 * A peça com a curva que acabou de entrar no contorno registrada: os pontos
 * por onde ela passa (`controles`) e os pontos que gerou (`pontos`, de uma
 * ponta à outra). Sem ponto de passagem não há o que registrar.
 */
export function comCurvaRegistrada(molde: Molde, tipo: CurvaDaPeca['tipo'], controles: readonly Ponto2D[], pontos: readonly Ponto2D[], id: string): Molde {
  if (controles.length < 3) return comCurvasValidas(molde);
  return comCurvasValidas({ ...molde, curvas: [...(molde.curvas ?? []), { id, tipo, controles, pontos }] });
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

/**
 * Leva um ponto de passagem para outro lugar: a curva é refeita pelos pontos
 * de passagem de agora e entra no contorno no lugar da antiga. As pontas não
 * saem do lugar.
 */
export function moverControle(molde: Molde, curvaId: string, indice: number, novaPosicao: Ponto2D): Molde {
  const curva = curvasDaPeca(molde).find((c) => c.id === curvaId);
  if (!curva) throw new Error('Essa curva foi mexida à mão e já não pode ser mudada pelos pontos de passagem.');
  if (!Number.isInteger(indice) || indice <= 0 || indice >= curva.controles.length - 1) {
    throw new Error('As pontas da curva não se movem por aqui: use Mover ponto.');
  }
  const controles = curva.controles.map((c, i) => (i === indice ? novaPosicao : c));
  const linha = gerarCurva(curva.tipo, controles);
  const contorno = molde.contorno;
  const n = contorno.length;
  const k = curva.pontos.length;
  const { inicio, passo } = filaNoContorno(contorno, curva.pontos)!;
  const ultimo = (((inicio + passo * (k - 1)) % n) + n) % n;
  // A troca segue a numeração: da ponta de menor número da fila até a outra.
  const novo =
    passo === 1
      ? substituirTrechoDoContorno(contorno, { indiceAresta: inicio, ponto: contorno[inicio]! }, { indiceAresta: ultimo, ponto: contorno[ultimo]! }, linha.slice(1, -1))
      : substituirTrechoDoContorno(
          contorno,
          { indiceAresta: ultimo, ponto: contorno[ultimo]! },
          { indiceAresta: inicio, ponto: contorno[inicio]! },
          linha.slice(1, -1).reverse(),
        );
  if (novo.length < 3 || !(area(novo) > AREA_MINIMA_MM2)) throw new Error('A peça ficaria sem área com a curva passando por aí.');
  return comCurvasValidas({
    ...molde,
    contorno: novo,
    piques: piquesQueFicamNoContorno(molde.piques, novo),
    curvas: (molde.curvas ?? []).map((c) => (c.id === curvaId ? { ...c, controles, pontos: linha } : c)),
  });
}

import { ajustarCurvaAosExtremos, arcoPorTresPontos, curvaPorPontos, direcaoServeDeTangente, type DirecoesNasPontas } from '../core/curvas';
import { distancia, type Contorno, type Ponto2D } from '../core/geometria';
import type { CurvaDaPeca, TangentesDaCurva } from './molde';

/**
 * O que os registros de curva (`Molde.curvas`) precisam para se achar no
 * contorno e para serem refeitos. Fica separado de `curvasDaPeca.ts` porque
 * as edições de forma de `molde.ts` também usam: a curva acompanha as pontas
 * quando elas mudam de lugar.
 */

const NO_MESMO_LUGAR_MM = 1e-6;
/** Abaixo disso (mm) o ponto do contorno conta como parado. */
const PARADO_MM = 1e-9;

export function mesmoLugar(a: Ponto2D, b: Ponto2D): boolean {
  return distancia(a, b) <= NO_MESMO_LUGAR_MM;
}

/** Onde a fila de pontos de uma curva começa no contorno, e em que sentido corre (1: o da numeração; -1: o contrário). */
export interface FilaNoContorno {
  readonly inicio: number;
  readonly passo: 1 | -1;
}

/** A fila de pontos da curva no contorno; `null` se os pontos já não estão nele, seguidos e na ordem. */
export function filaNoContorno(contorno: Contorno, pontos: readonly Ponto2D[]): FilaNoContorno | null {
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

/** A direção que cada alça de tangente dá à ponta dela: da ponta para a alça. */
function direcoesDasTangentes(controles: readonly Ponto2D[], tangentes: TangentesDaCurva | undefined): DirecoesNasPontas {
  const de = controles[0];
  const ate = controles.at(-1);
  const direcao = (ponta: Ponto2D | undefined, alca: Ponto2D | undefined): Ponto2D | undefined => (ponta && alca ? { x: alca.x - ponta.x, y: alca.y - ponta.y } : undefined);
  return { inicio: direcao(de, tangentes?.inicio), fim: direcao(ate, tangentes?.fim) };
}

/**
 * Das alças de tangente, as que servem com os pontos de passagem dados: a
 * direção de cada uma fica a até 85° da reta que vai da ponta ao ponto de
 * passagem vizinho. `undefined` se não sobra nenhuma.
 */
export function tangentesQueValem(controles: readonly Ponto2D[], tangentes: TangentesDaCurva | undefined): TangentesDaCurva | undefined {
  if (!tangentes || controles.length < 3) return undefined;
  const direcoes = direcoesDasTangentes(controles, tangentes);
  const inicio = direcoes.inicio && direcaoServeDeTangente(controles[0]!, controles[1]!, direcoes.inicio) ? tangentes.inicio : undefined;
  const fim = direcoes.fim && direcaoServeDeTangente(controles.at(-1)!, controles.at(-2)!, direcoes.fim) ? tangentes.fim : undefined;
  if (!inicio && !fim) return undefined;
  return { ...(inicio ? { inicio } : {}), ...(fim ? { fim } : {}) };
}

/** O registro com as alças de tangente dadas — ou sem o campo, se não há nenhuma. */
export function comTangentes(curva: CurvaDaPeca, tangentes: TangentesDaCurva | undefined): CurvaDaPeca {
  if (tangentes) return { ...curva, tangentes };
  if (!curva.tangentes) return curva;
  const copia: { -readonly [K in keyof CurvaDaPeca]: CurvaDaPeca[K] } = { ...curva };
  delete copia.tangentes;
  return copia;
}

/**
 * A linha que passa pelos pontos dados: a curva suave por todos eles (saindo
 * de cada ponta na direção da alça de tangente, se há), o arco de círculo
 * pelos três ou, na curva pré-definida, a forma guardada posta entre as duas
 * pontas.
 */
export function gerarCurva(
  tipo: CurvaDaPeca['tipo'],
  controles: readonly Ponto2D[],
  forma?: CurvaDaPeca['forma'],
  tangentes?: TangentesDaCurva,
): Ponto2D[] {
  if (tipo === 'arco') {
    const [inicio, meio, fim] = controles;
    if (!inicio || !meio || !fim || controles.length !== 3) throw new Error('O arco passa por três pontos: as duas pontas e um ponto dele.');
    return arcoPorTresPontos(inicio, meio, fim);
  }
  if (tipo === 'forma') {
    const [inicio, fim] = controles;
    if (!inicio || !fim || controles.length !== 2 || !forma) throw new Error('A curva pré-definida fica entre duas pontas.');
    return ajustarCurvaAosExtremos(forma.pontos, inicio, fim, forma.espelhar);
  }
  return curvaPorPontos(controles, direcoesDasTangentes(controles, tangentes));
}

/**
 * O contorno com a fila de pontos da curva trocada pela linha nova (dada de
 * uma ponta à outra, no sentido da fila). As pontas ficam: só o miolo muda.
 */
export function comAFilaTrocada(contorno: Contorno, fila: FilaNoContorno, quantos: number, linha: readonly Ponto2D[]): Ponto2D[] {
  const n = contorno.length;
  const indice = (j: number): number => (((fila.inicio + fila.passo * j) % n) + n) % n;
  const sai = new Set<number>();
  for (let j = 1; j < quantos - 1; j++) sai.add(indice(j));
  // O miolo entra depois da ponta de menor número da fila, na ordem da numeração.
  const depoisDe = fila.passo === 1 ? indice(0) : indice(quantos - 1);
  const miolo = fila.passo === 1 ? linha.slice(1, -1) : linha.slice(1, -1).reverse();
  const novo: Ponto2D[] = [];
  for (let i = 0; i < n; i++) {
    if (sai.has(i)) continue;
    novo.push(i === indice(0) ? linha[0]! : i === indice(quantos - 1) ? linha.at(-1)! : contorno[i]!);
    if (i === depoisDe) novo.push(...miolo);
  }
  return novo;
}

/**
 * As curvas depois que pontos do contorno mudaram de lugar (mesma quantidade
 * de pontos, mesma ordem):
 * - a curva que andou inteira, pelo mesmo tanto, anda junto;
 * - a que teve só as pontas movidas é refeita entre as pontas de agora, pelos
 *   mesmos pontos de passagem — o contorno devolvido já tem a curva nova;
 * - a que teve um ponto do meio mexido fica como está: o registro deixa de
 *   valer, como sempre.
 */
export function curvasAcompanhando(
  curvas: readonly CurvaDaPeca[],
  contornoAntigo: Contorno,
  contornoNovo: Contorno,
): { readonly contorno: Contorno; readonly curvas: readonly CurvaDaPeca[] } {
  if (contornoAntigo === contornoNovo || contornoAntigo.length !== contornoNovo.length) return { contorno: contornoNovo, curvas };
  const n = contornoAntigo.length;
  const refeitas: Array<{ readonly antiga: readonly Ponto2D[]; readonly linha: readonly Ponto2D[] }> = [];
  let mudou = false;
  const novas = curvas.map((curva): CurvaDaPeca => {
    const fila = filaNoContorno(contornoAntigo, curva.pontos);
    if (!fila) return curva;
    const k = curva.pontos.length;
    const indice = (j: number): number => (((fila.inicio + fila.passo * j) % n) + n) % n;
    const deltas = curva.pontos.map((_, j) => {
      const antes = contornoAntigo[indice(j)]!;
      const depois = contornoNovo[indice(j)]!;
      return { x: depois.x - antes.x, y: depois.y - antes.y };
    });
    const parado = (d: Ponto2D): boolean => Math.abs(d.x) <= PARADO_MM && Math.abs(d.y) <= PARADO_MM;
    if (deltas.every(parado)) return curva;
    const primeiro = deltas[0]!;
    if (deltas.every((d) => Math.abs(d.x - primeiro.x) <= PARADO_MM && Math.abs(d.y - primeiro.y) <= PARADO_MM)) {
      mudou = true;
      const andar = (p: Ponto2D): Ponto2D => ({ x: p.x + primeiro.x, y: p.y + primeiro.y });
      const { inicio, fim } = curva.tangentes ?? {};
      return comTangentes(
        { ...curva, controles: curva.controles.map(andar), pontos: curva.pontos.map((_, j) => contornoNovo[indice(j)]!) },
        curva.tangentes ? { ...(inicio ? { inicio: andar(inicio) } : {}), ...(fim ? { fim: andar(fim) } : {}) } : undefined,
      );
    }
    if (!deltas.slice(1, -1).every(parado)) return curva;
    const controles = [contornoNovo[indice(0)]!, ...curva.controles.slice(1, -1), contornoNovo[indice(k - 1)]!];
    // Cada alça de tangente anda com a ponta dela (a direção em relação à ponta fica); a que deixa de servir sai.
    const comAPonta = (alca: Ponto2D | undefined, d: Ponto2D): Ponto2D | undefined => (alca ? { x: alca.x + d.x, y: alca.y + d.y } : undefined);
    const [daInicial, daFinal] = [comAPonta(curva.tangentes?.inicio, deltas[0]!), comAPonta(curva.tangentes?.fim, deltas[k - 1]!)];
    const tangentes = tangentesQueValem(controles, { ...(daInicial ? { inicio: daInicial } : {}), ...(daFinal ? { fim: daFinal } : {}) });
    let linha: Ponto2D[];
    try {
      linha = gerarCurva(curva.tipo, controles, curva.forma, tangentes);
    } catch {
      return curva;
    }
    if (linha.length < 2) return curva;
    mudou = true;
    refeitas.push({ antiga: curva.pontos.map((_, j) => contornoNovo[indice(j)]!), linha });
    return comTangentes({ ...curva, controles, pontos: linha }, tangentes);
  });
  if (!mudou) return { contorno: contornoNovo, curvas };
  // Cada curva refeita entra no contorno no lugar da fila antiga (as pontas já estão no lugar novo).
  let contorno: Contorno = contornoNovo;
  for (const { antiga, linha } of refeitas) {
    const fila = filaNoContorno(contorno, antiga);
    if (fila) contorno = comAFilaTrocada(contorno, fila, antiga.length, linha);
  }
  return { contorno, curvas: novas };
}

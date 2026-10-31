import { distancia, type Contorno, type Ponto2D } from '../core/geometria';
import { cantosDoContorno } from './graduacao';
import { converterCosturaEmContorno, modificarPontosDoMolde, type Molde } from './molde';

/**
 * Os modos do "Modificar" (ADR 0181). O manual da referência diz só que o Discreto "move o ponto junto aos pontos
 * próximos" e que o Proporcional "move os pontos mantendo a proporção"; o como é leitura minha:
 * - Discreto: os pontos a menos de um alcance, medido sobre o contorno, andam cada vez menos, até zero no fim dele.
 * - Proporcional: o trecho entre os dois cantos vizinhos acompanha, na proporção da distância a esses cantos, que ficam
 *   no lugar: a curva estica sem mudar de jeito.
 */

export type ModoDeModificar = 'pontos' | 'discreto' | 'proporcional';

export const ALCANCE_DO_DISCRETO_MM = 30;

/** Quanto do deslocamento cada vértice recebe (1 nos indicados). */
export function pesosDoModificar(contorno: Contorno, indices: readonly number[], modo: ModoDeModificar, alcanceMm = ALCANCE_DO_DISCRETO_MM): ReadonlyMap<number, number> {
  const n = contorno.length;
  const pesos = new Map<number, number>();
  const somar = (i: number, peso: number): void => {
    if (peso > (pesos.get(i) ?? 0)) pesos.set(i, peso);
  };
  const cantos = new Set(modo === 'proporcional' ? cantosDoContorno(contorno) : []);
  for (const i of indices) {
    somar(i, 1);
    if (modo === 'pontos') continue;
    for (const passo of [1, -1]) {
      const vizinhos: Array<{ readonly indice: number; readonly s: number }> = [];
      let s = 0;
      let atual = i;
      for (let k = 1; k < n; k++) {
        const proximo = (atual + passo + n) % n;
        s += distancia(contorno[atual]!, contorno[proximo]!);
        if (modo === 'discreto' ? s >= alcanceMm : cantos.has(proximo)) break;
        vizinhos.push({ indice: proximo, s });
        atual = proximo;
      }
      const total = modo === 'discreto' ? alcanceMm : s;
      for (const v of vizinhos) somar(v.indice, 1 - v.s / total);
    }
  }
  return pesos;
}

/** "Inverter costura" (ADR 0190): a linha de corte vira o contorno, e a costura fica por dentro, como uma linha do molde. */
export function comCosturaInvertida(molde: Molde): Molde {
  if (molde.margemDeCosturaMm <= 0) return molde;
  const convertida = converterCosturaEmContorno(molde);
  return { ...convertida, linhasInternas: [...convertida.linhasInternas, [...molde.contorno, molde.contorno[0]!]] };
}

export function modificarComModo(molde: Molde, indices: readonly number[], delta: Ponto2D, modo: ModoDeModificar, alcanceMm = ALCANCE_DO_DISCRETO_MM): Molde {
  if (modo === 'pontos') return modificarPontosDoMolde(molde, indices, delta);
  if (modo === 'discreto' && !(alcanceMm > 0)) throw new Error('O alcance precisa ser maior que zero.');
  let m = molde;
  for (const [i, peso] of pesosDoModificar(molde.contorno, indices, modo, alcanceMm)) {
    m = modificarPontosDoMolde(m, [i], { x: delta.x * peso, y: delta.y * peso });
  }
  return m;
}

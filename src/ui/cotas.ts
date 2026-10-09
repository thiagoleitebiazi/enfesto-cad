import { distancia, type Ponto2D } from '../core/geometria';
import { ancoraDoRotulo, cotaDeAngulo, cotaDeDistancia, cotaHorizontalOuVertical, type Cota } from '../domain/cota';
import type { Molde } from '../domain/molde';

/** Ferramentas de cota que se montam com vários cliques (a de perímetro é um clique só). */
export type FerramentaDeCotaPorPontos = 'cota-distancia' | 'cota-horizontal-vertical' | 'cota-angulo';

/**
 * Quantos cliques cada cota pede, contando o último, que diz onde ela fica:
 * a linear, os dois pontos medidos; a de ângulo, um ponto de um lado, o
 * vértice e um ponto do outro lado.
 */
export const CLIQUES_DA_COTA: Readonly<Record<FerramentaDeCotaPorPontos, number>> = {
  'cota-distancia': 3,
  'cota-horizontal-vertical': 3,
  'cota-angulo': 4,
};

/** Monta a cota com todos os cliques dela. Lança erro se os pontos não servem (dois iguais, por exemplo). */
export function montarCota(ferramenta: FerramentaDeCotaPorPontos, id: string, cliques: readonly Ponto2D[]): Cota {
  if (cliques.length !== CLIQUES_DA_COTA[ferramenta]) throw new Error('Faltam pontos para montar a cota.');
  if (ferramenta === 'cota-angulo') return cotaDeAngulo(id, cliques[0]!, cliques[1]!, cliques[2]!, cliques[3]!);
  return ferramenta === 'cota-distancia'
    ? cotaDeDistancia(id, cliques[0]!, cliques[1]!, cliques[2]!)
    : cotaHorizontalOuVertical(id, cliques[0]!, cliques[1]!, cliques[2]!);
}

/**
 * A cota como ficaria se o próximo clique fosse onde o mouse está — só quando
 * falta apenas o clique que a posiciona. `null` enquanto faltam pontos
 * medidos, sem mouse sobre o desenho, ou se os pontos não formam uma cota.
 */
export function previaDaCota(
  ferramenta: FerramentaDeCotaPorPontos,
  cliques: readonly Ponto2D[],
  mouse: Ponto2D | null,
): Cota | null {
  if (!mouse || cliques.length !== CLIQUES_DA_COTA[ferramenta] - 1) return null;
  try {
    return montarCota(ferramenta, 'previa', [...cliques, mouse]);
  } catch {
    return null;
  }
}

/** A cota cujo número está a até `raioMm` do ponto (a mais próxima), e a peça que a guarda. */
export function cotaSobOPonto(
  pecas: readonly Molde[],
  p: Ponto2D,
  raioMm: number,
): { readonly pecaId: string; readonly cotaId: string } | null {
  let melhor: { readonly pecaId: string; readonly cotaId: string; readonly distancia: number } | null = null;
  for (const peca of pecas) {
    for (const cota of peca.cotas ?? []) {
      const d = distancia(p, ancoraDoRotulo(cota));
      if (d <= raioMm && (!melhor || d < melhor.distancia)) melhor = { pecaId: peca.id, cotaId: cota.id, distancia: d };
    }
  }
  return melhor && { pecaId: melhor.pecaId, cotaId: melhor.cotaId };
}

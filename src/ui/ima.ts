import { distancia, type Ponto2D } from '../core/geometria';
import type { Molde } from '../domain/molde';

/** Onde o ímã prendeu o ponto: num vértice existente ou num ponto da grade. */
export type TipoDeCaptura = 'vertice' | 'grade';

export interface PontoCapturado {
  readonly ponto: Ponto2D;
  /** `null` quando nada estava perto e o ponto ficou livre. */
  readonly tipo: TipoDeCaptura | null;
}

/**
 * Ímã: prende o ponto do mouse (em mm) no vértice mais próximo dentro de
 * `raioMm`; se não houver nenhum e a grade estiver visível
 * (`passoDaGradeMm` não nulo), no ponto da grade mais próximo; senão
 * devolve o próprio ponto. Vértice tem prioridade sobre grade: encostar
 * num canto que já existe é o que se quer ao desenhar.
 */
export function capturarComIma(
  mundo: Ponto2D,
  vertices: Iterable<Ponto2D>,
  raioMm: number,
  passoDaGradeMm: number | null,
): PontoCapturado {
  let maisProximo: Ponto2D | null = null;
  let menorDistancia = Infinity;
  for (const v of vertices) {
    const d = distancia(mundo, v);
    if (d < menorDistancia) {
      menorDistancia = d;
      maisProximo = v;
    }
  }
  if (maisProximo && menorDistancia <= raioMm) return { ponto: maisProximo, tipo: 'vertice' };
  if (passoDaGradeMm !== null && passoDaGradeMm > 0) {
    return {
      ponto: {
        // `+ 0` troca -0 por 0 (Math.round(-0.2) dá -0, que apareceria como "-0" na barra de status).
        x: Math.round(mundo.x / passoDaGradeMm) * passoDaGradeMm + 0,
        y: Math.round(mundo.y / passoDaGradeMm) * passoDaGradeMm + 0,
      },
      tipo: 'grade',
    };
  }
  return { ponto: mundo, tipo: null };
}

/** Pontos em que o ímã pode prender: vértices do contorno, dos furos e das linhas internas de cada peça. */
export function* pontosDeCapturaDasPecas(pecas: readonly Molde[]): Generator<Ponto2D> {
  for (const peca of pecas) {
    yield* peca.contorno;
    for (const furo of peca.furos) yield* furo;
    for (const linha of peca.linhasInternas) yield* linha;
  }
}

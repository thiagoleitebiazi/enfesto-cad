import type { Ponto2D } from '../core/geometria';

/** Estado da câmera do canvas: como o espaço em mm (mundo) mapeia para pixels de tela. */
export interface TransformacaoDeTela {
  readonly escalaPxPorMm: number;
  readonly offsetXPx: number;
  readonly offsetYPx: number;
}

export const ESCALA_MINIMA = 0.05;
export const ESCALA_MAXIMA = 40;

export function mundoParaTela(p: Ponto2D, t: TransformacaoDeTela): Ponto2D {
  return {
    x: t.offsetXPx + p.x * t.escalaPxPorMm,
    y: t.offsetYPx + p.y * t.escalaPxPorMm,
  };
}

export function telaParaMundo(p: Ponto2D, t: TransformacaoDeTela): Ponto2D {
  return {
    x: (p.x - t.offsetXPx) / t.escalaPxPorMm,
    y: (p.y - t.offsetYPx) / t.escalaPxPorMm,
  };
}

/** Aplica zoom mantendo `pivotTela` (em px) fixo na mesma posição da tela. */
export function aplicarZoom(
  t: TransformacaoDeTela,
  fatorMultiplicativo: number,
  pivotTela: Ponto2D,
): TransformacaoDeTela {
  const novaEscala = Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, t.escalaPxPorMm * fatorMultiplicativo));
  const razao = novaEscala / t.escalaPxPorMm;
  return {
    escalaPxPorMm: novaEscala,
    offsetXPx: pivotTela.x - (pivotTela.x - t.offsetXPx) * razao,
    offsetYPx: pivotTela.y - (pivotTela.y - t.offsetYPx) * razao,
  };
}

/** Escolhe um espaçamento "redondo" em mm (1, 2, 5, 10, 20, 50, ...) cujo espaçamento em tela fique perto de `alvoPx`. */
export function passoDeReguaEmMm(escalaPxPorMm: number, alvoPx: number = 60): number {
  const passosBase = [1, 2, 5];
  let potencia = 0.001;
  let melhor = passosBase[0]! * potencia;
  let melhorDiferenca = Infinity;
  for (let i = 0; i < 12; i++) {
    for (const base of passosBase) {
      const passoMm = base * potencia;
      const espacoPx = passoMm * escalaPxPorMm;
      const diferenca = Math.abs(espacoPx - alvoPx);
      if (diferenca < melhorDiferenca) {
        melhorDiferenca = diferenca;
        melhor = passoMm;
      }
    }
    potencia *= 10;
  }
  return melhor;
}

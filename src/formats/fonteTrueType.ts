import { create } from 'fontkit';
import type { Ponto2D } from '../core/geometria';

/**
 * A fonte TrueType dos textos (ADR 0211): no plotter, o contorno de cada letra vira linhas; no PDF, a fonte vai embutida.
 * A leitura do arquivo é da fontkit, a mesma que o pdfkit usa.
 */

export interface ComandoDoGlifo {
  readonly command: string;
  readonly args: readonly number[];
}

export interface FonteLida {
  readonly unitsPerEm: number;
  readonly capHeight?: number;
  layout(texto: string): {
    readonly glyphs: readonly { readonly path: { readonly commands: readonly ComandoDoGlifo[] } }[];
    readonly positions: readonly { readonly xAdvance: number; readonly xOffset: number; readonly yOffset: number }[];
  };
}

export interface FonteDoPlotter {
  readonly nome: string;
  readonly bytes: Uint8Array;
  readonly tracos: (texto: string, alturaMm: number) => Ponto2D[][];
}

/** Quantos segmentos cada curva da letra vira: o bastante para letras de poucos milímetros. */
const PASSOS_DA_CURVA = 6;

function tracosDoGlifo(comandos: readonly ComandoDoGlifo[], escala: number, origem: Ponto2D): Ponto2D[][] {
  const tracos: Ponto2D[][] = [];
  let atual: Ponto2D[] = [];
  const fechar = (): void => {
    if (atual.length >= 2) tracos.push(atual);
    atual = [];
  };
  const em = (x: number, y: number): Ponto2D => ({ x: origem.x + x * escala, y: origem.y + y * escala });
  for (const { command, args } of comandos) {
    const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = args;
    if (command === 'moveTo') {
      fechar();
      atual = [em(a, b)];
    } else if (command === 'lineTo') atual.push(em(a, b));
    else if (command === 'quadraticCurveTo' || command === 'bezierCurveTo') {
      const p0 = atual[atual.length - 1] ?? em(0, 0);
      const quadratica = command === 'quadraticCurveTo';
      const p1 = em(a, b);
      const p2 = em(c, d);
      const p3 = em(e, f);
      for (let i = 1; i <= PASSOS_DA_CURVA; i++) {
        const t = i / PASSOS_DA_CURVA;
        const s = 1 - t;
        const ponto = (eixo: 'x' | 'y'): number => (quadratica ? s * s * p0[eixo] + 2 * s * t * p1[eixo] + t * t * p2[eixo] : s * s * s * p0[eixo] + 3 * s * s * t * p1[eixo] + 3 * s * t * t * p2[eixo] + t * t * t * p3[eixo]);
        atual.push({ x: ponto('x'), y: ponto('y') });
      }
    } else if (command === 'closePath') {
      if (atual[0]) atual.push(atual[0]);
      fechar();
    }
  }
  fechar();
  return tracos;
}

/** O texto em linhas, com o começo em (0, 0) e as maiúsculas na altura pedida. */
export function tracosDaFonte(fonte: FonteLida, texto: string, alturaMm: number): Ponto2D[][] {
  const escala = alturaMm / (fonte.capHeight || fonte.unitsPerEm * 0.7);
  const { glyphs, positions } = fonte.layout(texto);
  let x = 0;
  return glyphs.flatMap((glifo, i) => {
    const p = positions[i];
    const tracos = tracosDoGlifo(glifo.path.commands, escala, { x: x + (p?.xOffset ?? 0) * escala, y: (p?.yOffset ?? 0) * escala });
    x += (p?.xAdvance ?? 0) * escala;
    return tracos;
  });
}

/** O arquivo da fonte; dá erro se não for uma fonte. */
export function fonteDoArquivo(bytes: Uint8Array, nome: string): FonteDoPlotter {
  const fonte = create(bytes) as FonteLida;
  if (typeof fonte.layout !== 'function') throw new Error('Este arquivo tem várias fontes dentro: escolha um .ttf ou .otf de uma só.');
  return { nome, bytes, tracos: (texto, alturaMm) => tracosDaFonte(fonte, texto, alturaMm) };
}

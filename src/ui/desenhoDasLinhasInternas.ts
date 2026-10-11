import { elementosDaPeca } from '../domain/linhasAuxiliares';
import type { Molde } from '../domain/molde';
import { mundoParaTela, type TransformacaoDeTela } from './transformacaoDeTela';

/** A cor dos elementos: as linhas internas só de construção, que não fazem parte do molde. */
export const COR_ELEMENTO_DE_CONSTRUCAO = '#8a93a0';
/** O pontilhado dos elementos, em pixels: risco e vão. */
export const PONTILHADO_DO_ELEMENTO: readonly number[] = [2, 4];

/** O que o desenho das linhas internas usa do contexto do canvas. */
export type PincelDeLinhas = Pick<CanvasRenderingContext2D, 'beginPath' | 'moveTo' | 'lineTo' | 'stroke' | 'setLineDash' | 'strokeStyle' | 'lineWidth'>;

/**
 * Desenha as linhas internas da peça: as que fazem parte do molde, cheias, na
 * cor dada; os elementos (só de construção), claros e pontilhados. O
 * tracejado do contexto volta a ser linha cheia no fim de cada linha.
 */
export function desenharLinhasInternas(ctx: PincelDeLinhas, peca: Molde, transform: TransformacaoDeTela, corDoMolde: string): void {
  const deConstrucao = new Set(peca.elementos ? elementosDaPeca(peca) : []);
  peca.linhasInternas.forEach((linha, numero) => {
    ctx.beginPath();
    linha.forEach((p, i) => {
      const tela = mundoParaTela(p, transform);
      if (i === 0) ctx.moveTo(tela.x, tela.y);
      else ctx.lineTo(tela.x, tela.y);
    });
    const elemento = deConstrucao.has(numero);
    ctx.strokeStyle = elemento ? COR_ELEMENTO_DE_CONSTRUCAO : corDoMolde;
    ctx.lineWidth = 1;
    if (elemento) ctx.setLineDash([...PONTILHADO_DO_ELEMENTO]);
    ctx.stroke();
    ctx.setLineDash([]);
  });
}

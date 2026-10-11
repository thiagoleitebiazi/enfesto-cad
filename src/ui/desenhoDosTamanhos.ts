import type { Ponto2D } from '../core/geometria';
import type { Molde } from '../domain/molde';
import { tracosDaMarca, tracosDoPique } from '../domain/piques';
import { piquesNosOutrosTamanhos } from '../domain/tamanhosGraduados';
import { mundoParaTela, type TransformacaoDeTela } from './transformacaoDeTela';

/** O raio (px) do ponto que marca, num tamanho que não é o base, a marca sem formato. */
export const RAIO_DO_PONTO_DO_TAMANHO_PX = 2;

/** O que os piques de um tamanho que não é o base têm para desenhar, em mm. */
export interface DesenhoDosPiquesDoTamanho {
  /** O número do tamanho na graduação. */
  readonly tamanho: number;
  /** Os traços dos piques do contorno e dos piques internos (as marcas com formato). */
  readonly tracos: readonly (readonly Ponto2D[])[];
  /** As marcas sem formato: cada uma é um ponto. */
  readonly pontos: readonly Ponto2D[];
}

/**
 * Os piques da peça graduada como ficam em cada tamanho que não é o base —
 * os do contorno, na borda desse tamanho, e os internos, onde o alinhamento
 * (ou a proporção da peça) os põe. Nada, na peça sem graduação ou sem pique
 * nem marca.
 */
export function piquesDosTamanhosParaDesenhar(peca: Molde): DesenhoDosPiquesDoTamanho[] {
  if (peca.piques.length === 0 && peca.marcas.length === 0) return [];
  return piquesNosOutrosTamanhos(peca).map(({ tamanho, contorno, piques, marcas }) => {
    // O pique do contorno é desenhado pela borda em que está: a do tamanho.
    const noTamanho: Molde = { ...peca, contorno };
    return {
      tamanho,
      tracos: [...piques.flatMap((pique) => tracosDoPique(noTamanho, pique)), ...marcas.flatMap((marca) => tracosDaMarca(marca) ?? [])],
      pontos: marcas.filter((marca) => !marca.formato).map((marca) => marca.posicao),
    };
  });
}

/** O que o desenho dos piques dos tamanhos usa do contexto do canvas. */
export type PincelDosTamanhos = Pick<CanvasRenderingContext2D, 'beginPath' | 'moveTo' | 'lineTo' | 'stroke' | 'arc' | 'fill' | 'strokeStyle' | 'fillStyle' | 'lineWidth'>;

/**
 * Desenha, na cor dada e em linha fina, os piques da peça graduada nos
 * tamanhos que não são o base: é por eles que se vê, na tela, onde cada pique
 * fica de tamanho em tamanho (e o que o "Alinhar" fez).
 */
export function desenharPiquesDosTamanhos(ctx: PincelDosTamanhos, peca: Molde, transform: TransformacaoDeTela, cor: string): void {
  const dosTamanhos = piquesDosTamanhosParaDesenhar(peca);
  if (dosTamanhos.length === 0) return;
  ctx.strokeStyle = cor;
  ctx.fillStyle = cor;
  ctx.lineWidth = 1;
  for (const { tracos, pontos } of dosTamanhos) {
    for (const traco of tracos) {
      ctx.beginPath();
      traco.forEach((q, k) => {
        const naTela = mundoParaTela(q, transform);
        if (k === 0) ctx.moveTo(naTela.x, naTela.y);
        else ctx.lineTo(naTela.x, naTela.y);
      });
      ctx.stroke();
    }
    for (const p of pontos) {
      const naTela = mundoParaTela(p, transform);
      ctx.beginPath();
      ctx.arc(naTela.x, naTela.y, RAIO_DO_PONTO_DO_TAMANHO_PX, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

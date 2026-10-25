import type { Ponto2D } from '../core/geometria';
import { ALTURA_DA_FOLHA, LARGURA_DA_FOLHA } from '../domain/desenhoTecnico';

/**
 * A vista da folha do desenho técnico (ADR 0116): o zoom (1: a folha inteira no quadro) e o ponto da folha no meio do
 * quadro. A janela nunca sai da folha: de perto, ela anda dentro dela.
 */
export interface VistaDaFolha {
  readonly zoom: number;
  readonly meio: Ponto2D;
}

export interface JanelaDaFolha {
  readonly x: number;
  readonly y: number;
  readonly largura: number;
  readonly altura: number;
}

export const ZOOM_MAXIMO = 8;
export const VISTA_INTEIRA: VistaDaFolha = { zoom: 1, meio: { x: LARGURA_DA_FOLHA / 2, y: ALTURA_DA_FOLHA / 2 } };

/** O pedaço da folha que aparece no quadro: a folha dividida pelo zoom, em volta do meio, sem sair da folha. */
export function janelaDaFolha(v: VistaDaFolha): JanelaDaFolha {
  const largura = LARGURA_DA_FOLHA / v.zoom;
  const altura = ALTURA_DA_FOLHA / v.zoom;
  return {
    x: Math.min(Math.max(v.meio.x - largura / 2, 0), LARGURA_DA_FOLHA - largura),
    y: Math.min(Math.max(v.meio.y - altura / 2, 0), ALTURA_DA_FOLHA - altura),
    largura,
    altura,
  };
}

/** A vista com o zoom entre 1 e o máximo e o meio onde a janela consegue ficar. */
function ajustar(zoom: number, meio: Ponto2D): VistaDaFolha {
  const z = Math.min(Math.max(zoom, 1), ZOOM_MAXIMO);
  const j = janelaDaFolha({ zoom: z, meio });
  return { zoom: z, meio: { x: j.x + j.largura / 2, y: j.y + j.altura / 2 } };
}

/**
 * O zoom vezes o fator, com o ponto `p` da folha parado no mesmo lugar do quadro (o ponto debaixo do mouse); sem
 * `p`, em volta do meio do quadro.
 */
export function zoomNoPonto(v: VistaDaFolha, fator: number, p?: Ponto2D): VistaDaFolha {
  const j = janelaDaFolha(v);
  const z = Math.min(Math.max(v.zoom * fator, 1), ZOOM_MAXIMO);
  const alvo = p ?? { x: j.x + j.largura / 2, y: j.y + j.altura / 2 };
  const fracaoX = (alvo.x - j.x) / j.largura;
  const fracaoY = (alvo.y - j.y) / j.altura;
  const largura = LARGURA_DA_FOLHA / z;
  const altura = ALTURA_DA_FOLHA / z;
  return ajustar(z, { x: alvo.x - fracaoX * largura + largura / 2, y: alvo.y - fracaoY * altura + altura / 2 });
}

/** A vista arrastada: a folha anda junto com o mouse (`dx`, `dy` em unidades da folha). */
export const arrastarVista = (v: VistaDaFolha, dx: number, dy: number): VistaDaFolha => ajustar(v.zoom, { x: v.meio.x - dx, y: v.meio.y - dy });

/** O passo da grade, em unidades da folha (400 × 500): 10 na folha inteira; 5 de perto (zoom 2 ou mais). */
export const passoDaGrade = (zoom: number): number => (zoom >= 2 ? 5 : 10);

/** O ponto preso no cruzamento mais perto da grade. */
export const naGrade = (p: Ponto2D, passo: number): Ponto2D => ({ x: Math.round(p.x / passo) * passo, y: Math.round(p.y / passo) * passo });

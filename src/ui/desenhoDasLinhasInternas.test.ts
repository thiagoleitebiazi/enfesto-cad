import { describe, it, expect } from 'vitest';
import { ponto } from '../core/geometria';
import { tornarElementos } from '../domain/linhasAuxiliares';
import { criarMolde, type Molde } from '../domain/molde';
import { COR_ELEMENTO_DE_CONSTRUCAO, desenharLinhasInternas, PONTILHADO_DO_ELEMENTO, type PincelDeLinhas } from './desenhoDasLinhasInternas';
import { mundoParaTela, type TransformacaoDeTela } from './transformacaoDeTela';

const TRANSFORM: TransformacaoDeTela = { escalaPxPorMm: 2, offsetXPx: 10, offsetYPx: 20 };
const COR_DO_MOLDE = '#2b2f36';
const RETA = [ponto(20, 50), ponto(180, 50)];
const EM_L = [ponto(20, 100), ponto(100, 100), ponto(100, 200)];
const molde = (): Molde =>
  criarMolde({ nome: 'Frente', referencia: 'R', tamanho: 'M', contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)], linhasInternas: [RETA, EM_L], linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 280) } }, 'f');

/** Um pincel de mentira: anota cada linha traçada, com a cor e o tracejado que valiam na hora do traço. */
function pincel() {
  const tracadas: { pontos: [number, number][]; cor: string; tracejado: number[]; largura: number }[] = [];
  let pontos: [number, number][] = [];
  let tracejado: number[] = [];
  const ctx: PincelDeLinhas = {
    strokeStyle: '',
    lineWidth: 0,
    beginPath: () => {
      pontos = [];
    },
    moveTo: (x: number, y: number) => {
      pontos.push([x, y]);
    },
    lineTo: (x: number, y: number) => {
      pontos.push([x, y]);
    },
    setLineDash: (segmentos: Iterable<number>) => {
      tracejado = [...segmentos];
    },
    stroke: () => {
      tracadas.push({ pontos, cor: String(ctx.strokeStyle), tracejado: [...tracejado], largura: ctx.lineWidth });
    },
  };
  return { ctx, tracadas, tracejadoNoFim: () => tracejado };
}
const naTela = (linha: readonly { x: number; y: number }[]): [number, number][] => linha.map((p) => [mundoParaTela(p, TRANSFORM).x, mundoParaTela(p, TRANSFORM).y]);

describe('o desenho das linhas internas', () => {
  it('as linhas que fazem parte do molde saem cheias, na cor do molde, com os pontos da tela', () => {
    const { ctx, tracadas } = pincel();
    desenharLinhasInternas(ctx, molde(), TRANSFORM, COR_DO_MOLDE);

    expect(tracadas).toEqual([
      { pontos: naTela(RETA), cor: COR_DO_MOLDE, tracejado: [], largura: 1 },
      { pontos: naTela(EM_L), cor: COR_DO_MOLDE, tracejado: [], largura: 1 },
    ]);
  });

  it('o elemento (só de construção) sai claro e pontilhado; a linha seguinte volta a ser cheia', () => {
    const { ctx, tracadas } = pincel();
    desenharLinhasInternas(ctx, tornarElementos(molde(), [0]), TRANSFORM, COR_DO_MOLDE);

    expect(tracadas).toEqual([
      { pontos: naTela(RETA), cor: COR_ELEMENTO_DE_CONSTRUCAO, tracejado: [...PONTILHADO_DO_ELEMENTO], largura: 1 },
      { pontos: naTela(EM_L), cor: COR_DO_MOLDE, tracejado: [], largura: 1 },
    ]);
    expect(PONTILHADO_DO_ELEMENTO).toEqual([2, 4]);
    expect(COR_ELEMENTO_DE_CONSTRUCAO).not.toBe(COR_DO_MOLDE);
    // O contexto não fica pontilhado para o que for desenhado depois.
    const soElementos = pincel();
    desenharLinhasInternas(soElementos.ctx, tornarElementos(molde(), [0, 1]), TRANSFORM, COR_DO_MOLDE);
    expect(soElementos.tracadas.map((t) => t.tracejado)).toEqual([[2, 4], [2, 4]]);
    expect(soElementos.tracejadoNoFim()).toEqual([]);
  });

  it('a peça sem linhas internas não traça nada', () => {
    const { ctx, tracadas } = pincel();
    desenharLinhasInternas(ctx, { ...molde(), linhasInternas: [] }, TRANSFORM, COR_DO_MOLDE);
    expect(tracadas).toEqual([]);
  });
});

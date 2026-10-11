import { describe, it, expect } from 'vitest';
import { ponto, type Ponto2D } from '../core/geometria';
import { alinharPiqueInterno } from '../domain/alinharPiques';
import { definirRegra } from '../domain/graduacao';
import { criarMolde, type Molde } from '../domain/molde';
import { definirTamanhosDoMolde } from '../domain/tamanhosGraduados';
import { desenharPiquesDosTamanhos, piquesDosTamanhosParaDesenhar, RAIO_DO_PONTO_DO_TAMANHO_PX, type PincelDosTamanhos } from './desenhoDosTamanhos';
import { mundoParaTela, type TransformacaoDeTela } from './transformacaoDeTela';

const TRANSFORM: TransformacaoDeTela = { escalaPxPorMm: 2, offsetXPx: 10, offsetYPx: 20 };
const COR = 'rgba(0, 121, 107, 0.8)';
const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
const molde = (extra: Partial<Molde> = {}): Molde => ({
  ...criarMolde({ nome: 'Frente', referencia: 'R', tamanho: 'M', contorno: RETANGULO, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) } }, 'f'),
  ...extra,
});
/**
 * P, M (base) e G, com a peça crescendo na proporção (10% no x e 20% no y por tamanho). Um pique em traço no meio da
 * aresta 1 (x = 200), um pique interno em cruz em (100, 150), alinhado na horizontal, e um ponto sem formato em (50, 50).
 */
function graduada(): Molde {
  const peca = definirTamanhosDoMolde(
    molde({
      piques: [{ id: 'p', posicao: ponto(200, 150), indiceAresta: 1, formato: { tipo: 'traco', larguraMm: 4, alturaMm: 6, anguloGraus: 0 } }],
      marcas: [
        { id: 'i', posicao: ponto(100, 150), formato: { tipo: 'cruz', larguraMm: 4, alturaMm: 4, anguloGraus: 0 } },
        { id: 'j', posicao: ponto(50, 50) },
      ],
    }),
    ['P', 'M', 'G'],
    'M',
  );
  let graduacao = peca.graduacao!;
  RETANGULO.forEach((q, n) => {
    graduacao = definirRegra(graduacao, RETANGULO, n, [ponto(0 - q.x * 0.1, 0 - q.y * 0.2), ponto(0, 0), ponto(q.x * 0.1, q.y * 0.2)]);
  });
  return alinharPiqueInterno({ ...peca, graduacao }, 'i', 'horizontal').molde;
}
const perto = (achados: readonly Ponto2D[], esperados: readonly Ponto2D[]): void => {
  expect(achados).toHaveLength(esperados.length);
  achados.forEach((q, i) => {
    expect(q.x).toBeCloseTo(esperados[i]!.x, 6);
    expect(q.y).toBeCloseTo(esperados[i]!.y, 6);
  });
};

/** Um pincel de mentira: anota os traços e os pontos desenhados, com a cor e a largura que valiam na hora. */
function pincel() {
  const tracados: { pontos: [number, number][]; cor: string; largura: number }[] = [];
  const pontosCheios: { x: number; y: number; raio: number; cor: string }[] = [];
  let caminho: [number, number][] = [];
  let circulo: { x: number; y: number; raio: number } | null = null;
  const ctx: PincelDosTamanhos = {
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    beginPath: () => {
      caminho = [];
      circulo = null;
    },
    moveTo: (x: number, y: number) => {
      caminho.push([x, y]);
    },
    lineTo: (x: number, y: number) => {
      caminho.push([x, y]);
    },
    arc: (x: number, y: number, raio: number) => {
      circulo = { x, y, raio };
    },
    stroke: () => {
      tracados.push({ pontos: caminho, cor: String(ctx.strokeStyle), largura: ctx.lineWidth });
    },
    fill: () => {
      if (circulo) pontosCheios.push({ ...circulo, cor: String(ctx.fillStyle) });
    },
  };
  return { ctx, tracados, pontosCheios };
}

describe('os piques da peça graduada nos outros tamanhos', () => {
  it('a peça sem graduação, ou sem pique nem marca, não tem o que desenhar', () => {
    expect(piquesDosTamanhosParaDesenhar(molde({ piques: [{ id: 'p', posicao: ponto(200, 150), indiceAresta: 1 }] }))).toEqual([]);
    expect(piquesDosTamanhosParaDesenhar({ ...graduada(), piques: [], marcas: [] })).toEqual([]);
  });

  it('em cada tamanho que não é o base: o pique do contorno na borda desse tamanho, o interno onde o alinhamento manda, o ponto na proporção', () => {
    const [noP, noG, ...resto] = piquesDosTamanhosParaDesenhar(graduada());

    expect(resto).toEqual([]);
    expect([noP!.tamanho, noG!.tamanho]).toEqual([0, 2]);
    // No G a peça vai a 220 × 360: o traço do contorno sai do meio da aresta (220, 180) e entra 6 mm.
    perto(noG!.tracos[0]!, [ponto(220, 180), ponto(214, 180)]);
    perto(noP!.tracos[0]!, [ponto(180, 120), ponto(174, 120)]);
    // A cruz interna, alinhada na horizontal: o mesmo x do mundo em todos os tamanhos; os dois traços dela passam pelo centro.
    const centroDe = (tracos: readonly (readonly Ponto2D[])[]): Ponto2D => ponto((tracos[1]![0]!.x + tracos[1]![1]!.x) / 2, (tracos[1]![0]!.y + tracos[1]![1]!.y) / 2);
    expect(noG!.tracos).toHaveLength(3);
    perto([centroDe(noG!.tracos)], [ponto(100, 180)]);
    perto([centroDe(noP!.tracos)], [ponto(100, 120)]);
    // O ponto sem formato acompanha a peça na proporção.
    perto(noG!.pontos, [ponto(55, 60)]);
    perto(noP!.pontos, [ponto(45, 40)]);
  });

  it('são desenhados em linha fina, na cor dada: um traço por traço, um ponto cheio por marca sem formato', () => {
    const { ctx, tracados, pontosCheios } = pincel();
    const peca = graduada();
    desenharPiquesDosTamanhos(ctx, peca, TRANSFORM, COR);
    const esperado = piquesDosTamanhosParaDesenhar(peca);

    // Três traços por tamanho (o do contorno e os dois da cruz), em dois tamanhos.
    expect(tracados).toHaveLength(6);
    expect(tracados.every((t) => t.cor === COR && t.largura === 1)).toBe(true);
    expect(tracados[0]!.pontos).toEqual(esperado[0]!.tracos[0]!.map((q) => [mundoParaTela(q, TRANSFORM).x, mundoParaTela(q, TRANSFORM).y]));
    expect(tracados[3]!.pontos).toEqual(esperado[1]!.tracos[0]!.map((q) => [mundoParaTela(q, TRANSFORM).x, mundoParaTela(q, TRANSFORM).y]));
    expect(pontosCheios).toEqual(esperado.map((t) => ({ x: mundoParaTela(t.pontos[0]!, TRANSFORM).x, y: mundoParaTela(t.pontos[0]!, TRANSFORM).y, raio: RAIO_DO_PONTO_DO_TAMANHO_PX, cor: COR })));
  });

  it('a peça sem graduação não mexe no pincel', () => {
    const { ctx, tracados, pontosCheios } = pincel();
    desenharPiquesDosTamanhos(ctx, molde({ marcas: [{ id: 'j', posicao: ponto(50, 50) }] }), TRANSFORM, COR);

    expect(tracados).toEqual([]);
    expect(pontosCheios).toEqual([]);
    expect(ctx.strokeStyle).toBe('');
    expect(ctx.lineWidth).toBe(0);
  });
});

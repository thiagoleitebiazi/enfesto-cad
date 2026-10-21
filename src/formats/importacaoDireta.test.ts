import { describe, expect, it } from 'vitest';
import { area, ponto, retanguloEnvolvente } from '../core/geometria';
import { comOFioNaHorizontal, criarMolde } from '../domain/molde';
import { importarDxf } from './dxf-importacao';
import { moldesDoDxf, moldesDosContornosDoPdf } from './importacaoDireta';
import { mundoParaTela } from '../ui/transformacaoDeTela';

type Par = readonly [number, string | number];
const montar = (pares: readonly Par[]): string => pares.map(([c, v]) => `${c}\n${v}`).join('\n');
const documento = (entidades: readonly Par[]): string =>
  montar([[0, 'SECTION'], [2, 'HEADER'], [9, '$INSUNITS'], [70, 4], [0, 'ENDSEC'], [0, 'SECTION'], [2, 'ENTITIES'], ...entidades, [0, 'ENDSEC'], [0, 'EOF']]);
const lw = (camada: string, pontos: readonly [number, number][], fechada = true): Par[] => [
  [0, 'LWPOLYLINE'],
  [8, camada],
  [90, pontos.length],
  [70, fechada ? 1 : 0],
  ...pontos.flatMap(([x, y]): Par[] => [[10, x], [20, y]]),
];
const linha = (camada: string, x1: number, y1: number, x2: number, y2: number): Par[] => [[0, 'LINE'], [8, camada], [10, x1], [20, y1], [11, x2], [21, y2]];
let n = 0;
const novoId = () => `id-${++n}`;
/** A direção de uma linha na tela: 'horizontal' quando ela anda só na horizontal. */
const naTela = (de: { x: number; y: number }, ate: { x: number; y: number }) => {
  const t = { offsetXPx: 0, offsetYPx: 0, escalaPxPorMm: 1 };
  const a = mundoParaTela(de, t);
  const b = mundoParaTela(ate, t);
  return Math.abs(b.y - a.y) < 1e-9 ? 'horizontal' : Math.abs(b.x - a.x) < 1e-9 ? 'vertical' : 'inclinada';
};

describe('moldesDoDxf — a importação direta', () => {
  it('sem camada de fio: as peças entram com o nome do arquivo e o fio na horizontal da tela, sem girar', () => {
    const r = importarDxf(documento([...lw('C', [[0, 0], [300, 0], [300, 100], [0, 100]]), ...lw('C', [[400, 0], [500, 0], [500, 200], [400, 200]])]), 'camiseta');
    const { moldes, giradas, semFioNoArquivo } = moldesDoDxf(r, novoId);
    expect(moldes.map((m) => m.nome)).toEqual(['camiseta-1', 'camiseta-2']);
    expect(moldes.map((m) => m.tamanho)).toEqual(['', '']);
    expect(moldes.every((m) => naTela(m.linhaDeFio.inicio, m.linhaDeFio.fim) === 'horizontal')).toBe(true);
    expect(giradas).toEqual([]);
    expect(semFioNoArquivo).toEqual(['camiseta-1', 'camiseta-2']);
    // A forma é a do arquivo: 300 × 100 mm, o comprimento (x do DXF) na horizontal da tela.
    const caixa = retanguloEnvolvente(moldes[0]!.contorno);
    expect([caixa.altura, caixa.largura]).toEqual([300, 100]);
  });

  it('com a linha de fio do arquivo já deitada, ela fica como veio', () => {
    const r = importarDxf(documento([...lw('CONTORNO', [[0, 0], [300, 0], [300, 100], [0, 100]]), ...linha('FIO', 20, 50, 280, 50)]), 'p');
    const { moldes, giradas } = moldesDoDxf(r, novoId);
    expect(giradas).toEqual([]);
    expect(naTela(moldes[0]!.linhaDeFio.inicio, moldes[0]!.linhaDeFio.fim)).toBe('horizontal');
  });

  it('com a linha de fio do arquivo em pé, a peça é girada 90° para o fio ficar deitado (e não só a seta trocada)', () => {
    // 100 de largura por 300 de altura no DXF, com o fio ao longo da altura: na mesa, o fio tem de seguir o comprimento.
    const r = importarDxf(documento([...lw('CONTORNO', [[0, 0], [100, 0], [100, 300], [0, 300]]), ...linha('FIO', 50, 20, 50, 280)]), 'p');
    const { moldes, giradas } = moldesDoDxf(r, novoId);
    expect(giradas).toHaveLength(1);
    expect(Math.abs(giradas[0]!.giroGraus)).toBeCloseTo(90, 9);
    const m = moldes[0]!;
    expect(naTela(m.linhaDeFio.inicio, m.linhaDeFio.fim)).toBe('horizontal');
    // A peça girou junto: agora os 300 mm (ao longo do fio) estão na horizontal da tela (o y do mundo).
    const caixa = retanguloEnvolvente(m.contorno);
    expect(caixa.altura).toBeCloseTo(300, 9);
    expect(caixa.largura).toBeCloseTo(100, 9);
    expect(area(m.contorno)).toBeCloseTo(30_000, 6);
    // A orientação que chega é a de origem da peça.
    expect(m.anguloDeRotacaoGraus).toBe(0);
  });

  it('o pique do arquivo vai para a peça, no lugar dele', () => {
    const r = importarDxf(documento([...lw('C', [[0, 0], [300, 0], [300, 100], [0, 100]]), ...lw('C', [[150, -3], [150, 3]], false)]), 'p');
    const m = moldesDoDxf(r, novoId).moldes[0]!;
    expect(m.piques).toHaveLength(1);
    const a = m.contorno[m.piques[0]!.indiceAresta]!;
    const b = m.contorno[(m.piques[0]!.indiceAresta + 1) % m.contorno.length]!;
    const cruz = (b.x - a.x) * (m.piques[0]!.posicao.y - a.y) - (b.y - a.y) * (m.piques[0]!.posicao.x - a.x);
    expect(Math.abs(cruz)).toBeLessThan(1e-6);
  });
});

describe('comOFioNaHorizontal', () => {
  const peca = (fim: { x: number; y: number }) =>
    criarMolde({ nome: 'p', referencia: '', tamanho: '', contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 50), ponto(0, 50)], linhaDeFio: { inicio: ponto(0, 0), fim } }, 'p');

  it('gira pelo menor ângulo: o fio a 30° da horizontal gira 30°, e não 150°', () => {
    // Deitado na tela é ao longo do y do mundo; a linha a 60° do eixo x está a 30° dele.
    const fim = { x: Math.cos(Math.PI / 3) * 10, y: Math.sin(Math.PI / 3) * 10 };
    const { molde, giroGraus } = comOFioNaHorizontal(peca(fim));
    expect(giroGraus).toBeCloseTo(30, 9);
    expect(Math.abs(molde.linhaDeFio.fim.x - molde.linhaDeFio.inicio.x)).toBeLessThan(1e-9);
  });

  it('a seta para o outro lado da horizontal também é deitada: não gira', () => {
    expect(comOFioNaHorizontal(peca({ x: 0, y: -10 })).giroGraus).toBe(0);
    expect(comOFioNaHorizontal(peca({ x: 0, y: 10 })).giroGraus).toBe(0);
  });
});

describe('moldesDosContornosDoPdf', () => {
  it('os contornos do PDF de outro programa viram peças no tamanho do papel, com o nome do arquivo e o fio deitado', () => {
    const lado = 72; // 1 polegada = 25,4 mm
    const contornos = {
      candidatos: [
        { id: 'a', contornoPt: [ponto(0, 0), ponto(lado, 0), ponto(lado, lado), ponto(0, lado)], vertices: 4, larguraPt: lado, alturaPt: lado },
        { id: 'b', contornoPt: [ponto(100, 0), ponto(100 + lado, 0), ponto(100 + lado, lado), ponto(100, lado)], vertices: 4, larguraPt: lado, alturaPt: lado },
      ],
      descartados: { borda: 0, areaPequena: 0, abertos: 0 },
      curvasAproximadas: 0,
      alturaPaginaPt: 842,
    };
    const moldes = moldesDosContornosDoPdf(contornos, 'folha', novoId);
    expect(moldes.map((m) => m.nome)).toEqual(['folha-1', 'folha-2']);
    expect(area(moldes[0]!.contorno)).toBeCloseTo(25.4 * 25.4, 6);
    expect(moldes.every((m) => naTela(m.linhaDeFio.inicio, m.linhaDeFio.fim) === 'horizontal')).toBe(true);
    expect(moldesDosContornosDoPdf({ ...contornos, alturaPaginaPt: null }, 'folha', novoId)).toEqual([]);
  });
});

describe('moldesDosContornosDoPdf — um contorno só', () => {
  it('a peça única leva o nome do arquivo, sem número', () => {
    const lado = 72;
    const contornos = {
      candidatos: [{ id: 'a', contornoPt: [ponto(0, 0), ponto(lado, 0), ponto(lado, lado), ponto(0, lado)], vertices: 4, larguraPt: lado, alturaPt: lado }],
      descartados: { borda: 0, areaPequena: 0, abertos: 0 },
      curvasAproximadas: 0,
      alturaPaginaPt: 842,
    };
    expect(moldesDosContornosDoPdf(contornos, 'bolso', novoId).map((m) => m.nome)).toEqual(['bolso']);
  });
});

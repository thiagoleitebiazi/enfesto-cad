// A matriz dos formatos de molde que o programa declara: cada entidade do DXF e cada unidade, num arquivo sintético
// escrito à mão pela especificação pública do DXF ASCII (não há arquivo real de outro CAD neste repositório: ver o
// risco R-1). Cada caso confere a medida que sai (em mm), o fechamento e o aviso quando há.
import { describe, expect, it } from 'vitest';
import { area, retanguloEnvolvente } from '../core/geometria';
import { importarDxf } from './dxf-importacao';

type Par = readonly [number, string | number];
const montar = (pares: readonly Par[]): string => pares.map(([c, v]) => `${c}\n${v}`).join('\n');
const documento = (entidades: readonly Par[], insunits?: number, blocos: readonly Par[] = []): string =>
  montar([
    ...(insunits === undefined ? [] : ([[0, 'SECTION'], [2, 'HEADER'], [9, '$INSUNITS'], [70, insunits], [0, 'ENDSEC']] as Par[])),
    ...(blocos.length > 0 ? ([[0, 'SECTION'], [2, 'BLOCKS'], ...blocos, [0, 'ENDSEC']] as Par[]) : []),
    [0, 'SECTION'],
    [2, 'ENTITIES'],
    ...entidades,
    [0, 'ENDSEC'],
    [0, 'EOF'],
  ]);
const lw = (camada: string, pontos: readonly [number, number][], fechada = true, bulges: readonly number[] = []): Par[] => [
  [0, 'LWPOLYLINE'],
  [8, camada],
  [90, pontos.length],
  [70, fechada ? 1 : 0],
  ...pontos.flatMap(([x, y], i): Par[] => [[10, x], [20, y], ...(bulges[i] ? ([[42, bulges[i]!]] as Par[]) : [])]),
];
const linha = (camada: string, x1: number, y1: number, x2: number, y2: number): Par[] => [[0, 'LINE'], [8, camada], [10, x1], [20, y1], [11, x2], [21, y2]];
const FIO = linha('FIO', 50, 10, 50, 90);
const QUADRADO: [number, number][] = [
  [0, 0],
  [100, 0],
  [100, 100],
  [0, 100],
];
const medida = (doc: string) => {
  const r = importarDxf(doc, 'p');
  const caixa = r.pecas[0] ? retanguloEnvolvente(r.pecas[0].contorno) : null;
  return { pecas: r.pecas.length, largura: caixa?.largura, altura: caixa?.altura, area: r.pecas[0] ? area(r.pecas[0].contorno) : 0, unidade: r.unidadeDetectada, assumida: r.unidadeAssumida, avisos: r.avisos };
};

describe('DXF — as unidades declaradas ($INSUNITS)', () => {
  it.each([
    [4, 'milímetros', 100],
    [5, 'centímetros', 1000],
    [6, 'metros', 100_000],
    [1, 'polegadas', 2540],
    [2, 'pés', 30_480],
  ])('código %i (%s): o quadrado de 100 unidades mede %i mm', (codigo, nome, mm) => {
    const m = medida(documento([...lw('CONTORNO', QUADRADO), ...FIO], codigo));
    expect(m).toMatchObject({ pecas: 1, largura: mm, altura: mm, unidade: nome, assumida: false });
  });

  it('sem $INSUNITS ou com código desconhecido: presume mm e diz', () => {
    expect(medida(documento([...lw('CONTORNO', QUADRADO), ...FIO]))).toMatchObject({ largura: 100, assumida: true });
    const desconhecida = medida(documento([...lw('CONTORNO', QUADRADO), ...FIO], 99));
    expect(desconhecida).toMatchObject({ largura: 100, assumida: true });
    expect(desconhecida.unidade).toBe('desconhecida (código INSUNITS 99, assumido mm)');
  });
});

describe('DXF — as entidades que viram peça', () => {
  it('LWPOLYLINE fechada', () => {
    expect(medida(documento([...lw('CONTORNO', QUADRADO), ...FIO], 4))).toMatchObject({ pecas: 1, area: 10_000 });
  });

  it('POLYLINE clássica (VERTEX/SEQEND)', () => {
    const vertices = QUADRADO.flatMap(([x, y]): Par[] => [[0, 'VERTEX'], [8, 'CONTORNO'], [10, x], [20, y]]);
    const doc = documento([[0, 'POLYLINE'], [8, 'CONTORNO'], [66, 1], [70, 1], ...vertices, [0, 'SEQEND'], ...FIO], 4);
    expect(medida(doc)).toMatchObject({ pecas: 1, area: 10_000 });
  });

  it('arco dentro da polilinha (bulge): o lado de cima vira meio círculo', () => {
    // De (100,100) a (0,100) com bulge 1: meio círculo de raio 50 por cima — a área é a do quadrado mais meio círculo.
    const m = medida(documento([...lw('CONTORNO', QUADRADO, true, [0, 0, 1, 0]), ...FIO], 4));
    expect(m.area).toBeGreaterThan(10_000 + Math.PI * 50 * 50 * 0.5 * 0.98);
    expect(m.area).toBeLessThan(10_000 + Math.PI * 50 * 50 * 0.5 * 1.001);
  });

  it('contorno em pedaços (LINE + ARC soltos que fecham)', () => {
    const arco: Par[] = [[0, 'ARC'], [8, 'CONTORNO'], [10, 50], [20, 100], [40, 50], [50, 0], [51, 180]];
    const doc = documento([...linha('CONTORNO', 0, 0, 100, 0), ...linha('CONTORNO', 100, 0, 100, 100), ...linha('CONTORNO', 0, 100, 0, 0), ...arco, ...FIO], 4);
    const m = medida(doc);
    expect(m.pecas).toBe(1);
    expect(m.altura).toBeCloseTo(150, 0);
  });

  it('SPLINE fechada', () => {
    const controles = [
      [0, 0],
      [100, 0],
      [100, 100],
      [0, 100],
      [0, 0],
    ] as const;
    const nos = [0, 0, 0, 0, 0.5, 1, 1, 1, 1];
    const spline: Par[] = [[0, 'SPLINE'], [8, 'CONTORNO'], [70, 1], [71, 3], [72, nos.length], [73, controles.length], ...nos.map((k): Par => [40, k]), ...controles.flatMap(([x, y]): Par[] => [[10, x], [20, y]])];
    const m = medida(documento([...spline, ...FIO], 4));
    expect(m.pecas).toBe(1);
    expect(m.area).toBeGreaterThan(0);
  });

  it('peça num bloco (INSERT), com escala 2: o dobro', () => {
    const bloco: Par[] = [[0, 'BLOCK'], [2, 'PECA'], [8, '0'], [10, 0], [20, 0], ...lw('CONTORNO', QUADRADO), ...FIO, [0, 'ENDBLK']];
    const m = medida(documento([[0, 'INSERT'], [2, 'PECA'], [8, '0'], [10, 0], [20, 0], [41, 2], [42, 2]], 4, bloco));
    expect(m).toMatchObject({ pecas: 1, largura: 200, altura: 200 });
  });

  it('CIRCLE na camada de furo vira furo da peça, não peça', () => {
    const r = importarDxf(documento([...lw('CONTORNO', QUADRADO), ...FIO, [0, 'CIRCLE'], [8, 'FURO'], [10, 50], [20, 50], [40, 5]], 4), 'p');
    expect(r.pecas).toHaveLength(1);
    expect(r.pecas[0]!.furos).toHaveLength(1);
  });
});

describe('DXF — o que não vira peça, e os erros', () => {
  it('a polilinha aberta não é contorno', () => {
    expect(medida(documento([...lw('CONTORNO', QUADRADO, false), ...FIO], 4)).pecas).toBe(0);
  });

  it('arquivo vazio, sem entidades, ou que não é DXF: nenhuma peça e o aviso, sem quebrar', () => {
    for (const conteudo of ['', documento([], 4), 'isto não é um dxf\ncom duas linhas']) {
      const r = importarDxf(conteudo, 'p');
      expect(r.pecas).toEqual([]);
      expect(r.avisos.join(' ')).toContain('Nenhuma polilinha fechada encontrada no arquivo');
    }
  });

  it('sem a linha de fio no arquivo, a peça vem sem fio (nunca presumido) e o aviso diz', () => {
    const r = importarDxf(documento([...lw('CONTORNO', QUADRADO)], 4), 'p');
    expect(r.pecas[0]!.linhaDeFio).toBeNull();
    expect(r.avisos.length).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from 'vitest';
import { importarDxf } from './dxf-importacao';
import { area, perimetro, type Ponto2D } from '../core/geometria';

// Fixtures sintéticas pela especificação pública dos códigos de grupo do DXF ASCII: blocos (BLOCK/INSERT),
// arcos dentro de polilinhas (bulge, código 42), ARC solto e contornos desenhados em pedaços. Continuam sem
// arquivos reais de outros programas (ver MATRIZ_DE_RISCOS.md, R-1).

type Par = readonly [number, string | number];

function montar(pares: readonly Par[]): string {
  return pares.map(([codigo, valor]) => `${codigo}\n${valor}`).join('\n');
}

function lwpolyline(camada: string, pontos: readonly [number, number][], fechada = true, bulges: Readonly<Record<number, number>> = {}): Par[] {
  const pares: Par[] = [
    [0, 'LWPOLYLINE'],
    [8, camada],
    [90, pontos.length],
    [70, fechada ? 1 : 0],
  ];
  pontos.forEach(([x, y], i) => {
    pares.push([10, x], [20, y]);
    if (bulges[i] !== undefined) pares.push([42, bulges[i]!]);
  });
  return pares;
}

function linha(camada: string, x1: number, y1: number, x2: number, y2: number): Par[] {
  return [
    [0, 'LINE'],
    [8, camada],
    [10, x1],
    [20, y1],
    [11, x2],
    [21, y2],
  ];
}

function arco(camada: string, cx: number, cy: number, raio: number, de: number, ate: number): Par[] {
  return [
    [0, 'ARC'],
    [8, camada],
    [10, cx],
    [20, cy],
    [40, raio],
    [50, de],
    [51, ate],
  ];
}

function insercao(bloco: string, x: number, y: number, extra: { escalaX?: number; escalaY?: number; giro?: number; camada?: string } = {}): Par[] {
  return [
    [0, 'INSERT'],
    [8, extra.camada ?? '0'],
    [2, bloco],
    [10, x],
    [20, y],
    ...(extra.escalaX !== undefined ? ([[41, extra.escalaX]] as Par[]) : []),
    ...(extra.escalaY !== undefined ? ([[42, extra.escalaY]] as Par[]) : []),
    ...(extra.giro !== undefined ? ([[50, extra.giro]] as Par[]) : []),
  ];
}

function bloco(nome: string, base: [number, number], entidades: readonly Par[]): Par[] {
  return [[0, 'BLOCK'], [8, '0'], [2, nome], [70, 0], [10, base[0]], [20, base[1]], [3, nome], ...entidades, [0, 'ENDBLK'], [8, '0']];
}

function documento(entidades: readonly Par[], blocos: readonly Par[] = []): string {
  return montar([
    [0, 'SECTION'],
    [2, 'HEADER'],
    [9, '$INSUNITS'],
    [70, 4],
    [0, 'ENDSEC'],
    ...(blocos.length > 0 ? ([[0, 'SECTION'], [2, 'BLOCKS'], ...blocos, [0, 'ENDSEC']] as Par[]) : []),
    [0, 'SECTION'],
    [2, 'ENTITIES'],
    ...entidades,
    [0, 'ENDSEC'],
    [0, 'EOF'],
  ]);
}

const RETANGULO: readonly [number, number][] = [
  [0, 0],
  [300, 0],
  [300, 400],
  [0, 400],
];

function caixa(pontos: readonly Ponto2D[]): { minX: number; maxX: number; minY: number; maxY: number } {
  return {
    minX: Math.min(...pontos.map((p) => p.x)),
    maxX: Math.max(...pontos.map((p) => p.x)),
    minY: Math.min(...pontos.map((p) => p.y)),
    maxY: Math.max(...pontos.map((p) => p.y)),
  };
}

describe('importarDxf — peças dentro de blocos (INSERT), como no padrão AAMA/ASTM', () => {
  it('a peça que está num bloco entra, no lugar do INSERT, com a linha de fio dela', () => {
    const doc = documento(
      [...insercao('FRENTE', 1000, 500)],
      bloco('FRENTE', [0, 0], [...lwpolyline('CONTORNO', RETANGULO), ...linha('FIO', 150, 50, 150, 350)]),
    );
    const resultado = importarDxf(doc, 'aama');
    expect(resultado.pecas).toHaveLength(1);
    expect(caixa(resultado.pecas[0]!.contorno)).toEqual({ minX: 1000, maxX: 1300, minY: 500, maxY: 900 });
    expect(resultado.pecas[0]!.linhaDeFio).toEqual({ inicio: { x: 1150, y: 550 }, fim: { x: 1150, y: 850 } });
  });

  it('o ponto-base do bloco, a escala e o giro do INSERT valem', () => {
    // Base em (100, 100): o canto (100, 100) do bloco vai para o ponto de inserção. Girado 90° e escala 2.
    const doc = documento(
      [...insercao('P', 0, 0, { escalaX: 2, escalaY: 2, giro: 90 })],
      bloco('P', [100, 100], [...lwpolyline('CONTORNO', RETANGULO.map(([x, y]) => [x + 100, y + 100] as [number, number]))]),
    );
    const [peca] = importarDxf(doc, 'p').pecas;
    const c = caixa(peca!.contorno);
    // 300 x 400 com escala 2 = 600 x 800; girado 90°: x de -800 a 0, y de 0 a 600.
    expect(c.minX).toBeCloseTo(-800, 6);
    expect(c.maxX).toBeCloseTo(0, 6);
    expect(c.minY).toBeCloseTo(0, 6);
    expect(c.maxY).toBeCloseTo(600, 6);
    expect(area(peca!.contorno)).toBeCloseTo(600 * 800, 3);
  });

  it('o mesmo bloco inserido duas vezes dá duas peças; o bloco que ninguém insere não entra', () => {
    const doc = documento(
      [...insercao('FRENTE', 0, 0), ...insercao('frente', 500, 0)],
      [...bloco('FRENTE', [0, 0], lwpolyline('CONTORNO', RETANGULO)), ...bloco('SOBRA', [0, 0], lwpolyline('CONTORNO', [[5000, 0], [5100, 0], [5100, 100], [5000, 100]]))],
    );
    const resultado = importarDxf(doc, 'dois');
    expect(resultado.pecas.map((p) => caixa(p.contorno).minX)).toEqual([0, 500]);
  });

  it('o que está na camada 0 do bloco fica na camada do INSERT', () => {
    const doc = documento([...insercao('B', 0, 0, { camada: 'CONTORNO' })], bloco('B', [0, 0], lwpolyline('0', RETANGULO)));
    const resultado = importarDxf(doc, 'camada');
    expect(resultado.pecas).toHaveLength(1);
    // A camada de contorno foi reconhecida: não houve o aviso de "nenhuma camada de contorno".
    expect(resultado.avisos.join(' ')).not.toContain('Nenhuma camada de contorno');
  });

  it('bloco dentro de bloco: as transformações se somam; o bloco que insere a si mesmo não trava', () => {
    const doc = documento(
      [...insercao('FORA', 1000, 0)],
      [
        ...bloco('FORA', [0, 0], insercao('DENTRO', 0, 2000)),
        ...bloco('DENTRO', [0, 0], lwpolyline('CONTORNO', RETANGULO)),
        ...bloco('CIRCULAR', [0, 0], insercao('CIRCULAR', 1, 1)),
      ],
    );
    expect(caixa(importarDxf(doc, 'aninhado').pecas[0]!.contorno)).toEqual({ minX: 1000, maxX: 1300, minY: 2000, maxY: 2400 });
    const circular = documento([...insercao('CIRCULAR', 0, 0)], bloco('CIRCULAR', [0, 0], insercao('CIRCULAR', 1, 1)));
    expect(importarDxf(circular, 'circular').pecas).toEqual([]);
  });
});

describe('importarDxf — arcos dentro das polilinhas (bulge)', () => {
  it('o meio círculo de bulge 1 vira arco, e não a reta entre os vértices', () => {
    // Retângulo 300 x 400 com o lado de baixo, de (0,0) a (300,0), trocado por meio círculo para fora (anti-horário: para baixo).
    const doc = documento(lwpolyline('CONTORNO', RETANGULO, true, { 0: 1 }));
    const [peca] = importarDxf(doc, 'arco').pecas;
    const c = caixa(peca!.contorno);
    expect(c.minY).toBeCloseTo(-150, 0);
    expect(peca!.contorno.length).toBeGreaterThan(30);
    // Área: o retângulo mais meio círculo de raio 150 (a poligonal fica um pouco abaixo do círculo).
    const esperada = 300 * 400 + (Math.PI * 150 * 150) / 2;
    expect(area(peca!.contorno)).toBeGreaterThan(esperada * 0.995);
    expect(area(peca!.contorno)).toBeLessThan(esperada);
    // Todo ponto do arco fica a 150 mm do centro (150, 0).
    for (const p of peca!.contorno.filter((q) => q.y < -1e-6)) expect(Math.hypot(p.x - 150, p.y)).toBeCloseTo(150, 6);
  });

  it('o bulge negativo gira para o outro lado; o do último vértice fecha o contorno com arco', () => {
    // Bulge -1 no lado de cima, de (300,400) a (0,400)? Não: o lado 2 vai de (300,400) a (0,400); negativo = horário = para dentro.
    const paraDentro = importarDxf(documento(lwpolyline('CONTORNO', RETANGULO, true, { 2: -0.5 })), 'a').pecas[0]!;
    expect(caixa(paraDentro.contorno).maxY).toBeCloseTo(400, 6);
    expect(area(paraDentro.contorno)).toBeLessThan(300 * 400);
    // Bulge -0,5 numa corda de 300: raio 187,5, centro em (150, 512,5); todo ponto do arco fica nesse círculo.
    const doArco = paraDentro.contorno.filter((p) => !RETANGULO.some(([x, y]) => Math.abs(p.x - x) < 1e-9 && Math.abs(p.y - y) < 1e-9));
    expect(doArco.length).toBeGreaterThan(10);
    for (const p of doArco) expect(Math.hypot(p.x - 150, p.y - 512.5)).toBeCloseTo(187.5, 6);
    // O último vértice, (0,400), fecha em (0,0): o arco dele também entra.
    const fechando = importarDxf(documento(lwpolyline('CONTORNO', RETANGULO, true, { 3: 0.5 })), 'b').pecas[0]!;
    expect(caixa(fechando.contorno).minX).toBeLessThan(-50);
  });

  it('o bulge do VERTEX da POLYLINE clássica também vale', () => {
    const doc = montar([
      [0, 'SECTION'],
      [2, 'ENTITIES'],
      [0, 'POLYLINE'],
      [8, 'CONTORNO'],
      [66, 1],
      [0, 'VERTEX'],
      [10, 0],
      [20, 0],
      [42, 1],
      [0, 'VERTEX'],
      [10, 300],
      [20, 0],
      [0, 'VERTEX'],
      [10, 300],
      [20, 400],
      [0, 'VERTEX'],
      [10, 0],
      [20, 400],
      [0, 'SEQEND'],
      [0, 'ENDSEC'],
      [0, 'EOF'],
    ]);
    expect(caixa(importarDxf(doc, 'poly').pecas[0]!.contorno).minY).toBeCloseTo(-150, 0);
  });
});

describe('importarDxf — contorno desenhado em pedaços (linhas e arcos soltos)', () => {
  it('quatro linhas soltas que fecham um retângulo viram uma peça; a linha de fio continua linha de fio', () => {
    const doc = documento([
      ...linha('CONTORNO', 0, 0, 300, 0),
      ...linha('CONTORNO', 300, 400, 300, 0), // ao contrário: a ordem das pontas não importa
      ...linha('CONTORNO', 300, 400, 0, 400),
      ...linha('CONTORNO', 0, 400, 0, 0),
      ...linha('FIO', 150, 50, 150, 350),
    ]);
    const resultado = importarDxf(doc, 'pedacos');
    expect(resultado.pecas).toHaveLength(1);
    expect(area(resultado.pecas[0]!.contorno)).toBeCloseTo(120000, 6);
    expect(resultado.pecas[0]!.linhaDeFio).toEqual({ inicio: { x: 150, y: 50 }, fim: { x: 150, y: 350 } });
    expect(resultado.avisos.join(' ')).toContain('1 contorno(s) desenhado(s) em pedaços');
  });

  it('linhas e um arco: a peça com a frente redonda', () => {
    const doc = documento([
      ...linha('0', 0, 0, 300, 0),
      ...linha('0', 300, 0, 300, 400),
      ...arco('0', 150, 400, 150, 0, 180), // de (300,400) a (0,400), por cima
      ...linha('0', 0, 400, 0, 0),
    ]);
    const [peca] = importarDxf(doc, 'redonda').pecas;
    expect(caixa(peca!.contorno).maxY).toBeCloseTo(550, 6);
    expect(perimetro(peca!.contorno)).toBeCloseTo(300 + 400 + 400 + Math.PI * 150, -1);
  });

  it('numa bifurcação (três pedaços na mesma ponta) não inventa caminho', () => {
    const doc = documento([
      ...linha('0', 0, 0, 300, 0),
      ...linha('0', 300, 0, 300, 400),
      ...linha('0', 300, 400, 0, 400),
      ...linha('0', 0, 400, 0, 0),
      ...linha('0', 0, 0, 150, 200), // a terceira linha no canto (0,0)
    ]);
    expect(importarDxf(doc, 'bifurcacao').pecas).toEqual([]);
  });

  it('pedaços de camadas diferentes não se juntam', () => {
    const doc = documento([
      ...linha('A', 0, 0, 300, 0),
      ...linha('A', 300, 0, 300, 400),
      ...linha('B', 300, 400, 0, 400),
      ...linha('B', 0, 400, 0, 0),
    ]);
    expect(importarDxf(doc, 'camadas').pecas).toEqual([]);
  });
});

describe('importarDxf — as retas soltas dentro da peça', () => {
  it('a reta dentro da peça vira linha interna dela; a de fora é avisada', () => {
    const doc = documento([
      ...lwpolyline('CONTORNO', RETANGULO),
      ...linha('FIO', 150, 50, 150, 350),
      ...linha('BOLSO', 50, 200, 250, 200),
      ...linha('BOLSO', 2000, 0, 2100, 0),
    ]);
    const resultado = importarDxf(doc, 'retas');
    expect(resultado.pecas[0]!.linhasInternas).toEqual([[{ x: 50, y: 200 }, { x: 250, y: 200 }]]);
    expect(resultado.pecas[0]!.linhaDeFio).toEqual({ inicio: { x: 150, y: 50 }, fim: { x: 150, y: 350 } });
    expect(resultado.avisos).toContain('1 linha(s) reta(s) fora das peças foram ignoradas.');
  });

  it('a polilinha aberta de dois pontos também', () => {
    const doc = documento([...lwpolyline('CONTORNO', RETANGULO), ...lwpolyline('INTERNA', [[100, 100], [100, 300]], false)]);
    expect(importarDxf(doc, 'dois-pontos').pecas[0]!.linhasInternas).toEqual([[{ x: 100, y: 100 }, { x: 100, y: 300 }]]);
  });
});

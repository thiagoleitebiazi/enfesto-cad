import { describe, it, expect } from 'vitest';
import { importarDxf } from './dxf-importacao';
import { area } from '../core/geometria';

// Fixtures sintéticas escritas à mão seguindo a especificação de grupos de
// código do DXF ASCII (uma AutoCAD DXF Reference). NÃO existem arquivos DXF
// reais de terceiros (outros softwares CAD/AAMA) neste repositório para
// validar contra — ver MATRIZ_DE_RISCOS.md / ADR 0002. O parser é testado
// apenas contra estas fixtures construídas conforme a especificação pública.

type Par = readonly [number, string | number];

function montar(pares: readonly Par[]): string {
  return pares.map(([codigo, valor]) => `${codigo}\n${valor}`).join('\n');
}

function cabecalho(insunits?: number): Par[] {
  if (insunits === undefined) return [];
  return [
    [0, 'SECTION'],
    [2, 'HEADER'],
    [9, '$INSUNITS'],
    [70, insunits],
    [0, 'ENDSEC'],
  ];
}

function lwpolyline(camada: string, pontos: readonly [number, number][], fechada = true): Par[] {
  const pares: Par[] = [
    [0, 'LWPOLYLINE'],
    [8, camada],
    [90, pontos.length],
    [70, fechada ? 1 : 0],
  ];
  for (const [x, y] of pontos) {
    pares.push([10, x], [20, y]);
  }
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

function circulo(camada: string, cx: number, cy: number, raio: number): Par[] {
  return [
    [0, 'CIRCLE'],
    [8, camada],
    [10, cx],
    [20, cy],
    [40, raio],
  ];
}

function documento(entidades: readonly Par[], insunits?: number): string {
  return montar([
    ...cabecalho(insunits),
    [0, 'SECTION'],
    [2, 'ENTITIES'],
    ...entidades,
    [0, 'ENDSEC'],
    [0, 'EOF'],
  ]);
}

const RETANGULO_300X400: readonly [number, number][] = [
  [0, 0],
  [300, 0],
  [300, 400],
  [0, 400],
];

describe('importarDxf — caso básico (contorno + linha de fio, mm)', () => {
  it('importa uma peça retangular com linha de fio reconhecida', () => {
    const doc = documento(
      [...lwpolyline('CONTORNO', RETANGULO_300X400), ...linha('FIO', 150, 50, 150, 350)],
      4, // $INSUNITS = milímetros
    );

    const resultado = importarDxf(doc, 'peca-teste');

    expect(resultado.avisos).toEqual([]);
    expect(resultado.unidadeAssumida).toBe(false);
    expect(resultado.unidadeDetectada).toBe('milímetros');
    expect(resultado.pecas).toHaveLength(1);
    const peca = resultado.pecas[0]!;
    expect(peca.nome).toBe('peca-teste');
    expect(peca.contorno).toEqual([
      { x: 0, y: 0 },
      { x: 300, y: 0 },
      { x: 300, y: 400 },
      { x: 0, y: 400 },
    ]);
    expect(peca.linhaDeFio).toEqual({ inicio: { x: 150, y: 50 }, fim: { x: 150, y: 350 } });
    expect(peca.furos).toEqual([]);
    expect(peca.linhasInternas).toEqual([]);
  });
});

describe('importarDxf — unidades', () => {
  it('converte polegadas para milímetros (INSUNITS=1, fator 25.4)', () => {
    const doc = documento([...lwpolyline('CONTORNO', [[0, 0], [1, 0], [1, 1], [0, 1]])], 1);
    const resultado = importarDxf(doc, 'quadrado-polegada');
    expect(resultado.unidadeDetectada).toBe('polegadas');
    expect(resultado.unidadeAssumida).toBe(false);
    const bbox = resultado.pecas[0]!.contorno;
    expect(bbox[2]).toEqual({ x: 25.4, y: 25.4 });
  });

  it('assume milímetros e avisa quando $INSUNITS não está presente', () => {
    const doc = documento([...lwpolyline('CONTORNO', RETANGULO_300X400)]);
    const resultado = importarDxf(doc, 'sem-unidade');
    expect(resultado.unidadeAssumida).toBe(true);
    expect(resultado.unidadeDetectada).toMatch(/assumido mm/);
  });
});

describe('importarDxf — furos e linhas internas', () => {
  it('associa um furo (CIRCLE em camada FURO) à peça que o contém', () => {
    const doc = documento(
      [
        ...lwpolyline('CONTORNO', RETANGULO_300X400),
        ...linha('FIO', 150, 50, 150, 350),
        ...circulo('FURO', 150, 200, 10),
      ],
      4,
    );
    const resultado = importarDxf(doc, 'com-furo');
    expect(resultado.pecas).toHaveLength(1);
    expect(resultado.pecas[0]!.furos).toHaveLength(1);
    // Círculo aproximado por polígono de 32 lados: a área de um 32-gono
    // inscrito é necessariamente um pouco menor que a do círculo verdadeiro
    // (erro geométrico esperado de discretização, ~0.6% para 32 lados).
    const areaDoFuro = area(resultado.pecas[0]!.furos[0]!);
    const areaDoCirculo = Math.PI * 10 * 10;
    expect(areaDoFuro).toBeLessThan(areaDoCirculo);
    expect(areaDoFuro / areaDoCirculo).toBeGreaterThan(0.99);
  });

  it('classifica uma polilinha fechada em camada não reconhecida como linha interna', () => {
    const doc = documento(
      [
        ...lwpolyline('CONTORNO', RETANGULO_300X400),
        ...linha('FIO', 150, 50, 150, 350),
        ...lwpolyline('DETALHE', [[100, 100], [200, 100], [200, 150], [100, 150]]),
      ],
      4,
    );
    const resultado = importarDxf(doc, 'com-detalhe');
    expect(resultado.pecas[0]!.linhasInternas).toHaveLength(1);
    expect(resultado.pecas[0]!.furos).toHaveLength(0);
  });
});

describe('importarDxf — regra crítica do sentido do fio (nunca presumir)', () => {
  it('retorna linhaDeFio null e um aviso explícito quando o arquivo não declara uma camada de fio', () => {
    const doc = documento([...lwpolyline('CONTORNO', RETANGULO_300X400)], 4);
    const resultado = importarDxf(doc, 'sem-fio');
    expect(resultado.pecas[0]!.linhaDeFio).toBeNull();
    expect(resultado.avisos.some((a) => /linha de fio/i.test(a) && /sentido do fio|regra crítica/i.test(a))).toBe(
      true,
    );
  });
});

describe('importarDxf — camada de contorno ausente (heurística de fallback)', () => {
  it('usa a polilinha de maior área como contorno e avisa sobre a heurística', () => {
    const doc = documento(
      [
        ...lwpolyline('CAMADA_QUALQUER', RETANGULO_300X400),
        ...lwpolyline('OUTRA_CAMADA', [[0, 0], [10, 0], [10, 10], [0, 10]]),
      ],
      4,
    );
    const resultado = importarDxf(doc, 'sem-camada-contorno');
    expect(resultado.pecas).toHaveLength(1);
    expect(area(resultado.pecas[0]!.contorno)).toBe(300 * 400);
    expect(resultado.avisos.some((a) => /maior área/i.test(a))).toBe(true);
  });
});

describe('importarDxf — múltiplas peças no mesmo arquivo', () => {
  it('separa duas peças em camadas de contorno reconhecidas, cada uma com seu próprio furo', () => {
    const doc = documento(
      [
        ...lwpolyline('CONTORNO', RETANGULO_300X400),
        ...linha('FIO', 150, 50, 150, 350),
        ...circulo('FURO', 150, 200, 5),
        ...lwpolyline('CONTORNO', [[1000, 0], [1200, 0], [1200, 100], [1000, 100]]),
        ...linha('FIO', 1100, 10, 1100, 90),
        ...circulo('FURO', 1100, 50, 3),
      ],
      4,
    );
    const resultado = importarDxf(doc, 'multi');
    expect(resultado.pecas).toHaveLength(2);
    expect(resultado.pecas[0]!.nome).toBe('multi-1');
    expect(resultado.pecas[1]!.nome).toBe('multi-2');
    expect(resultado.pecas[0]!.furos).toHaveLength(1);
    expect(resultado.pecas[1]!.furos).toHaveLength(1);
    expect(resultado.pecas[0]!.linhaDeFio).not.toBeNull();
    expect(resultado.pecas[1]!.linhaDeFio).not.toBeNull();
  });
});

describe('importarDxf — POLYLINE clássica (VERTEX/SEQEND)', () => {
  it('lê uma POLYLINE/VERTEX/SEQEND como um contorno fechado', () => {
    const doc = montar([
      [0, 'SECTION'],
      [2, 'HEADER'],
      [9, '$INSUNITS'],
      [70, 4],
      [0, 'ENDSEC'],
      [0, 'SECTION'],
      [2, 'ENTITIES'],
      [0, 'POLYLINE'],
      [8, 'CONTORNO'],
      [66, 1],
      [0, 'VERTEX'],
      [8, 'CONTORNO'],
      [10, 0],
      [20, 0],
      [0, 'VERTEX'],
      [8, 'CONTORNO'],
      [10, 50],
      [20, 0],
      [0, 'VERTEX'],
      [8, 'CONTORNO'],
      [10, 50],
      [20, 50],
      [0, 'VERTEX'],
      [8, 'CONTORNO'],
      [10, 0],
      [20, 50],
      [0, 'SEQEND'],
      [0, 'ENDSEC'],
      [0, 'EOF'],
    ]);
    const resultado = importarDxf(doc, 'polyline-classica');
    expect(resultado.pecas).toHaveLength(1);
    expect(area(resultado.pecas[0]!.contorno)).toBe(2500);
  });
});

describe('importarDxf — arquivo sem nenhuma polilinha', () => {
  it('retorna lista de peças vazia com aviso, sem lançar exceção', () => {
    const doc = documento([...linha('FIO', 0, 0, 10, 10)], 4);
    const resultado = importarDxf(doc, 'vazio');
    expect(resultado.pecas).toEqual([]);
    expect(resultado.avisos.some((a) => /nenhuma peça/i.test(a))).toBe(true);
  });
});

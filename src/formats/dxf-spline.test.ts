import { describe, it, expect } from 'vitest';
import { dxfParaMundo, importarDxf } from './dxf-importacao';

// Quadrado de 10 cm por 10 cm desenhado como SPLINE fechada de grau 1 com nós
// "clamped": pontos de controle (0,0), (10,0), (10,10), (0,10), (0,0). Nós:
// 7 valores para 5 pontos de controle e grau 1. INSUNITS 5 = centímetros, então
// o contorno deve sair em mm: 100 mm × 100 mm.
function dxfComSpline(flags: number, camada = 'CONTORNO'): string {
  const controle = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
  const nos = [0, 0, 1, 2, 3, 4, 4];
  const linhas = [
    '0', 'SECTION', '2', 'HEADER',
    '9', '$INSUNITS', '70', '5',
    '0', 'ENDSEC',
    '0', 'SECTION', '2', 'ENTITIES',
    '0', 'SPLINE', '8', camada,
    '70', String(flags), '71', '1', '72', String(nos.length), '73', String(controle.length), '74', '0',
    ...nos.flatMap((n) => ['40', String(n)]),
    ...controle.flatMap(([x, y]) => ['10', String(x), '20', String(y)]),
    '0', 'ENDSEC',
    '0', 'EOF',
  ];
  return linhas.join('\n') + '\n';
}

function areaDoContorno(pontos: readonly { x: number; y: number }[]): number {
  let soma = 0;
  for (let i = 0; i < pontos.length; i++) {
    const a = pontos[i]!;
    const b = pontos[(i + 1) % pontos.length]!;
    soma += a.x * b.y - b.x * a.y;
  }
  return Math.abs(soma) / 2;
}

describe('importarDxf com SPLINE', () => {
  it('importa uma SPLINE fechada como contorno, convertida de cm para mm', () => {
    const resultado = importarDxf(dxfComSpline(1), 'quadrado');

    expect(resultado.pecas).toHaveLength(1);
    const contorno = resultado.pecas[0]!.contorno;
    const xs = contorno.map((p) => p.x);
    const ys = contorno.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(100, 6);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(100, 6);
    expect(areaDoContorno(contorno)).toBeCloseTo(10000, 4);
  });

  it('não usa SPLINE aberta como contorno', () => {
    const resultado = importarDxf(dxfComSpline(0), 'aberta');

    expect(resultado.pecas).toHaveLength(0);
    expect(resultado.avisos.join(' ')).toContain('Nenhuma polilinha fechada');
  });
});

describe('dxfParaMundo', () => {
  it('põe o eixo x do DXF na horizontal e inverte o y, como a página do PDF', () => {
    expect(dxfParaMundo({ x: 10, y: 0 }, 50)).toEqual({ x: 50, y: 10 });
    expect(dxfParaMundo({ x: 0, y: 50 }, 50)).toEqual({ x: 0, y: 0 });
  });
});

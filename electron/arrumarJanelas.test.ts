// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { emCascata, ladoALado, type Retangulo } from './arrumarJanelas';

const AREA: Retangulo = { x: 100, y: 40, width: 1920, height: 1040 };
const dentro = (r: Retangulo): boolean => r.x >= AREA.x && r.y >= AREA.y && r.x + r.width <= AREA.x + AREA.width && r.y + r.height <= AREA.y + AREA.height;

describe('as janelas arrumadas (ADR 0211)', () => {
  it('em cascata, cada uma desce um degrau, e todas têm o mesmo tamanho', () => {
    const r = emCascata(3, AREA);
    expect(r[1]).toMatchObject({ x: 132, y: 72 });
    expect(new Set(r.map((j) => j.width)).size).toBe(1);
    expect(r.every(dentro)).toBe(true);
  });

  it('uma só ocupa a área toda', () => {
    expect(emCascata(1, AREA)).toEqual([AREA]);
    expect(ladoALado(1, AREA)).toEqual([AREA]);
  });

  it('muitas janelas em cascata não saem da área', () => {
    const r = emCascata(60, AREA);
    expect(r.every(dentro)).toBe(true);
    expect(r[59]!.width).toBeGreaterThan(0);
  });

  it('lado a lado: duas dividem a largura', () => {
    expect(ladoALado(2, AREA)).toEqual([
      { x: 100, y: 40, width: 960, height: 1040 },
      { x: 1060, y: 40, width: 960, height: 1040 },
    ]);
  });

  it('cinco: três em cima, duas embaixo dividindo a largura, sem sobrepor', () => {
    const r = ladoALado(5, AREA);
    expect(r.map((j) => j.width)).toEqual([640, 640, 640, 960, 960]);
    expect(r[3]!.y).toBe(560);
    expect(r.every(dentro)).toBe(true);
  });
});

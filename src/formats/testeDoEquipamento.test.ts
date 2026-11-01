import { describe, expect, it } from 'vitest';
import { testeDaMesaDeCorte } from './testeDoEquipamento';

describe('o teste da mesa de corte (ADR 0217)', () => {
  it('é um quadrado de 100 mm com a faca', () => {
    const iso = testeDaMesaDeCorte();
    expect(iso).toContain('T1');
    expect(iso).toContain('M30');
    expect(iso).toContain('X120.00 Y120.00');
    expect(iso).toContain('G21');
  });
});

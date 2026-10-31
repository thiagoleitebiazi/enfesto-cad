import { describe, expect, it } from 'vitest';
import { passoDeReguaEmPolegadas, rotuloDaRegua, valorDaReguaEmUnidade } from './transformacaoDeTela';

describe('a régua em polegadas (ADR 0178)', () => {
  it('converte, escreve as frações, e o passo é redondo em polegadas', () => {
    expect(valorDaReguaEmUnidade(25.4, 'pol')).toBe(1);
    expect(rotuloDaRegua(63.5, 'pol')).toBe('2.5');
    expect(rotuloDaRegua(25.4, 'cm')).toBe('3');
    expect(passoDeReguaEmPolegadas(60 / 25.4)).toBeCloseTo(25.4);
    expect(passoDeReguaEmPolegadas(6 / 25.4)).toBeCloseTo(254);
  });
});

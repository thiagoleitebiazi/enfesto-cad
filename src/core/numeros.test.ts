import { describe, expect, it } from 'vitest';
import { numeroComVirgula } from './numeros';

describe('numeroComVirgula — o número como a tela o mostra', () => {
  it('com as casas pedidas, arredondado como o toFixed, e a vírgula no lugar do ponto', () => {
    expect(numeroComVirgula(954, 1)).toBe('954,0');
    expect(numeroComVirgula(19.4999, 1)).toBe('19,5');
    expect(numeroComVirgula(0.0626, 3)).toBe('0,063');
    expect(numeroComVirgula(12.346, 2)).toBe('12,35');
    expect(numeroComVirgula(-3.26, 1)).toBe('-3,3');
  });

  it('sem as casas, as que o número tem; inteiro fica inteiro, sem ponto de milhar', () => {
    expect(numeroComVirgula(1500)).toBe('1500');
    expect(numeroComVirgula(180.5)).toBe('180,5');
    expect(numeroComVirgula(0.5)).toBe('0,5');
    expect(numeroComVirgula(1234567.25)).toBe('1234567,25');
  });
});

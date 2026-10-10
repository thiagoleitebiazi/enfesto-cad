import { describe, it, expect } from 'vitest';
import { colunaDaSeta, dePolar, paraPolar } from './tabelaDeGraduacao';

describe('distância e ângulo', () => {
  it('0° é para a direita e o ângulo cresce no sentido anti-horário da tela (para cima é 90°)', () => {
    expect(paraPolar({ dx: 10, dy: 0 })).toEqual({ distancia: 10, angulo: 0 });
    expect(paraPolar({ dx: 0, dy: -10 })).toEqual({ distancia: 10, angulo: 90 });
    expect(paraPolar({ dx: -10, dy: 0 })).toEqual({ distancia: 10, angulo: 180 });
    expect(paraPolar({ dx: 0, dy: 10 })).toEqual({ distancia: 10, angulo: 270 });
    expect(paraPolar({ dx: 3, dy: -4 }).distancia).toBe(5);
  });

  it('o deslocamento nulo tem distância zero e ângulo zero', () => {
    expect(paraPolar({ dx: 0, dy: 0 })).toEqual({ distancia: 0, angulo: 0 });
  });

  it('de volta, dá o DX e o DY de onde saiu, sem ruído', () => {
    expect(dePolar({ distancia: 10, angulo: 0 })).toEqual({ dx: 10, dy: 0 });
    expect(dePolar({ distancia: 10, angulo: 90 })).toEqual({ dx: 0, dy: -10 });
    expect(dePolar({ distancia: 10, angulo: 180 })).toEqual({ dx: -10, dy: 0 });
    for (const d of [{ dx: 7.5, dy: -2 }, { dx: -3, dy: 4 }, { dx: 0, dy: 12.25 }]) {
      const volta = dePolar(paraPolar(d));
      expect(volta.dx).toBeCloseTo(d.dx, 6);
      expect(volta.dy).toBeCloseTo(d.dy, 6);
    }
  });
});

describe('as setas da tabela', () => {
  it('direita e esquerda preenchem o DX; cima e baixo, o DY — os tamanhos maiores vão para o lado da seta', () => {
    expect(colunaDaSeta('direita', 5, 5, 2)).toEqual({ coluna: 'dx', valores: [-10, -5, 0, 5, 10] });
    expect(colunaDaSeta('esquerda', 5, 5, 2)).toEqual({ coluna: 'dx', valores: [10, 5, 0, -5, -10] });
    // Na tela o DY cresce para baixo: para cima, os maiores ficam com DY negativo.
    expect(colunaDaSeta('cima', 5, 3, 1)).toEqual({ coluna: 'dy', valores: [5, 0, -5] });
    expect(colunaDaSeta('baixo', 5, 3, 1)).toEqual({ coluna: 'dy', valores: [-5, 0, 5] });
  });

  it('o sinal do valor digitado não conta: quem diz o lado é a seta', () => {
    expect(colunaDaSeta('direita', -5, 3, 1)).toEqual(colunaDaSeta('direita', 5, 3, 1));
    expect(colunaDaSeta('direita', 5, 3, 0).valores).toEqual([0, 5, 10]);
  });
});

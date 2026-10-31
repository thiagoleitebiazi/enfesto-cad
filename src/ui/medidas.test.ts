import { eixoTravado } from '../domain/posicionamento';
import { describe, expect, it } from 'vitest';
import { calcularConta, lerMedida, numeroDoTexto } from './medidas';

describe('a conta nos campos de medida (ADR 0163)', () => {
  it('as quatro operações, a precedência, os parênteses, a vírgula e o x', () => {
    expect(calcularConta('45/2+1')).toBe(23.5);
    expect(calcularConta('(80-4)/4')).toBe(19);
    expect(calcularConta('3x12')).toBe(36);
    expect(calcularConta('1,5 + 2,5')).toBe(4);
    expect(calcularConta('2+3*4')).toBe(14);
    expect(calcularConta('-5+10')).toBe(5);
    expect(calcularConta('.5*4')).toBe(2);
  });

  it('o que não é conta, e a divisão por zero, não valem', () => {
    for (const ruim of ['abc', '1+', '(1+2', '1 2', '5/0', '1..2', '']) expect(calcularConta(ruim), ruim).toBeNull();
  });

  it('os campos: vazio como antes, número simples como antes, conta aceita', () => {
    expect(lerMedida('')).toBe(0);
    expect(lerMedida('12,5')).toBe(12.5);
    expect(lerMedida('10+2,5')).toBe(12.5);
    expect(lerMedida('x')).toBeNull();
    expect(numeroDoTexto('  ')).toBeNull();
    expect(numeroDoTexto('1,5')).toBe(1.5);
    expect(numeroDoTexto('3/2')).toBe(1.5);
    expect(numeroDoTexto('abc')).toBeNaN();
  });
});

describe('o movimento travado (ADR 0164)', () => {
  it('com Shift, só o eixo em que mais andou; sem Shift, o movimento inteiro', () => {
    expect(eixoTravado({ x: 30, y: 10 }, true)).toEqual({ x: 30, y: 0 });
    expect(eixoTravado({ x: -5, y: 20 }, true)).toEqual({ x: 0, y: 20 });
    expect(eixoTravado({ x: 30, y: 10 }, false)).toEqual({ x: 30, y: 10 });
  });
});

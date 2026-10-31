import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { contornosDosTamanhos, pontosNaoGraduados } from './graduacao';
import { criarMolde, type Molde } from './molde';
import { modificarComModo, pesosDoModificar } from './modificarElemento';
import { definirTamanhosDoMolde } from './tamanhosGraduados';

/** Um retângulo com a borda de cima dividida em pontos de 10 em 10 mm: uma "curva" reta entre dois cantos. */
const borda = [ponto(0, 0), ponto(0, 10), ponto(0, 20), ponto(0, 30), ponto(0, 40), ponto(0, 50), ponto(100, 50), ponto(100, 0)];
const peca = (contorno = borda): Molde =>
  criarMolde(
    { nome: 'a', referencia: '', tamanho: 'M', quantidade: 1, contorno, margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(50, 10), fim: ponto(50, 40) }, restricaoDeRotacao: { permite180: false, permite90e270: false } },
    'a',
  );

describe('os modos do Modificar (ADR 0181)', () => {
  it('pontos: só os indicados', () => {
    expect([...pesosDoModificar(borda, [2, 3], 'pontos')]).toEqual([
      [2, 1],
      [3, 1],
    ]);
  });

  it('discreto: os vizinhos dentro do alcance andam cada vez menos', () => {
    const p = pesosDoModificar(borda, [2], 'discreto', 20);
    expect(p.get(2)).toBe(1);
    expect(p.get(1)).toBeCloseTo(0.5);
    expect(p.get(3)).toBeCloseTo(0.5);
    expect(p.has(0)).toBe(false);
    expect(p.has(4)).toBe(false);
  });

  it('proporcional: o trecho até os cantos acompanha, e os cantos ficam', () => {
    const p = pesosDoModificar(borda, [2], 'proporcional');
    expect(p.get(1)).toBeCloseTo(0.5);
    expect(p.get(3)).toBeCloseTo(2 / 3);
    expect(p.get(4)).toBeCloseTo(1 / 3);
    expect(p.has(0)).toBe(false);
    expect(p.has(5)).toBe(false);
  });

  it('o molde muda com os pesos, e os cantos seguem no lugar', () => {
    const m = modificarComModo(peca(), [2], { x: -10, y: 0 }, 'proporcional');
    expect(m.contorno[2]!.x).toBeCloseTo(-10);
    expect(m.contorno[1]!.x).toBeCloseTo(-5);
    expect(m.contorno[0]!.x).toBe(0);
    expect(m.contorno[5]!.x).toBe(0);
  });

  it('o modo "pontos" faz o que já fazia', () => {
    const m = modificarComModo(peca(), [2], { x: -10, y: 0 }, 'pontos');
    expect(m.contorno[1]).toEqual(ponto(0, 10));
    expect(m.contorno[2]).toEqual(ponto(-10, 20));
  });

  it('o alcance precisa ser positivo', () => {
    expect(() => modificarComModo(peca(), [2], { x: 1, y: 0 }, 'discreto', 0)).toThrow(/alcance/);
  });
});

describe('o ponto não graduado (ADR 0181)', () => {
  const quadrado = [ponto(0, 0), ponto(100, 0), ponto(100, 100), ponto(0, 100)];

  it('sem graduação, não há o que mostrar', () => {
    expect(pontosNaoGraduados(peca(quadrado))).toEqual([]);
  });

  it('os cantos sem regra aparecem; o que tem regra, não', () => {
    const graduada = definirTamanhosDoMolde(peca(quadrado), ['P', 'M'], 'M');
    expect(pontosNaoGraduados(graduada)).toEqual([0, 1, 2, 3]);
    const comRegra: Molde = { ...graduada, graduacao: { ...graduada.graduacao!, pontos: [{ posicao: ponto(0, 0), deslocamentos: [ponto(-5, 0), ponto(0, 0)] }] } };
    expect(contornosDosTamanhos(comRegra.graduacao!, comRegra.contorno)[0]![0]).toEqual(ponto(-5, 0));
    expect(pontosNaoGraduados(comRegra)).toEqual([1, 2, 3]);
  });
});

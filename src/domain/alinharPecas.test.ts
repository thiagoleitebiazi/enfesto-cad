import { describe, expect, it } from 'vitest';
import { ponto, retanguloEnvolvente } from '../core/geometria';
import { criarMolde } from './molde';
import { alinharPecas, type ModoDeAlinhar } from './alinharPecas';

const peca = (id: string, x: number, y: number, a = 100, c = 200) =>
  criarMolde({ nome: id, referencia: '', tamanho: '', contorno: [ponto(x, y), ponto(x + a, y), ponto(x + a, y + c), ponto(x, y + c)], linhaDeFio: { inicio: ponto(x + 10, y + 10), fim: ponto(x + 10, y + 90) } }, id);

const PECAS = [peca('a', 0, 0), peca('b', 300, 500, 50, 100), peca('c', 100, 900), peca('d', 700, 700)];
const caixas = (modo: ModoDeAlinhar) => Object.fromEntries(alinharPecas(PECAS, new Set(['a', 'b', 'c']), modo).map((p) => [p.id, retanguloEnvolvente(p.contorno)]));

describe('alinhar e distribuir (ADR 0161)', () => {
  it('pelo começo, pelo fim, pelo alto, pela base e pelo meio; a de fora da seleção não anda', () => {
    expect(caixas('comeco').c!.minY).toBe(0);
    expect(caixas('fim').b!.maxY).toBe(1100);
    expect(caixas('topo').b!.minX).toBe(0);
    expect(caixas('base').a!.maxX).toBe(350);
    const meio = caixas('meio-do-comprimento');
    expect((meio.b!.minY + meio.b!.maxY) / 2).toBe(550);
    expect((caixas('meio-da-largura').a!.minX + caixas('meio-da-largura').a!.maxX) / 2).toBe(175);
    expect(caixas('comeco').d!.minY).toBe(700);
  });

  it('distribuir: as pontas ficam, e os espaços entre as peças ficam iguais', () => {
    const d = caixas('distribuir-comprimento');
    expect(d.a!.minY).toBe(0);
    expect(d.c!.maxY).toBe(1100);
    expect(d.b!.minY - d.a!.maxY).toBeCloseTo(d.c!.minY - d.b!.maxY);
    expect(d.b!.minX).toBe(300);
  });

  it('com menos de duas peças, nada muda', () => {
    expect(alinharPecas(PECAS, new Set(['a']), 'fim')).toEqual(PECAS);
  });
});

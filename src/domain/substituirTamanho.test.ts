import { describe, expect, it } from 'vitest';
import { ponto, retanguloEnvolvente } from '../core/geometria';
import { criarMolde, rotacionarMolde, transladarMolde, type Molde } from './molde';
import { definirTamanhosDoMolde, substituirTamanho } from './tamanhosGraduados';

const peca = (nome: string): Molde =>
  criarMolde({ nome, referencia: '', tamanho: 'M', quantidade: 1, contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 200), ponto(0, 200)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 180) }, restricaoDeRotacao: { permite180: true, permite90e270: true } }, nome);

const graduada = (nome: string): Molde => {
  const g = definirTamanhosDoMolde(peca(nome), ['P', 'M', 'G'], 'M');
  return { ...g, graduacao: { ...g.graduacao!, pontos: [{ posicao: ponto(100, 200), deslocamentos: [ponto(-10, -20), ponto(0, 0), ponto(10, 20)] }, { posicao: ponto(100, 0), deslocamentos: [ponto(-10, 0), ponto(0, 0), ponto(10, 0)] }, { posicao: ponto(0, 200), deslocamentos: [ponto(0, -20), ponto(0, 0), ponto(0, 20)] }] } };
};

describe('substituir o tamanho no encaixe (ADR 0206)', () => {
  it('a peça troca de tamanho no mesmo lugar, com o centro onde estava', () => {
    const noEncaixe = transladarMolde(peca('Frente'), { x: 300, y: 500 }, 'x');
    const r = substituirTamanho([noEncaixe], new Set(['x']), [graduada('Frente')], 'G');
    const c = retanguloEnvolvente(r.pecas[0]!.contorno);
    expect(r.trocadas).toBe(1);
    expect(r.pecas[0]).toMatchObject({ id: 'x', tamanho: 'G' });
    expect(c.maxX - c.minX).toBeCloseTo(110, 6);
    expect(c.maxY - c.minY).toBeCloseTo(220, 6);
    expect((c.minX + c.maxX) / 2).toBeCloseTo(350, 6);
    expect((c.minY + c.maxY) / 2).toBeCloseTo(600, 6);
  });

  it('mantém o giro que a peça tinha no encaixe', () => {
    const noEncaixe = rotacionarMolde(peca('Frente'), 90);
    const r = substituirTamanho([{ ...noEncaixe, id: 'x' }], new Set(['x']), [graduada('Frente')], 'G');
    expect(r.pecas[0]!.anguloDeRotacaoGraus).toBe(90);
    const c = retanguloEnvolvente(r.pecas[0]!.contorno);
    expect(c.maxX - c.minX).toBeCloseTo(220, 6);
  });

  it('o tamanho base da peça graduada também serve', () => {
    const r = substituirTamanho([{ ...peca('Frente'), tamanho: 'G', id: 'x' }], new Set(['x']), [graduada('Frente')], 'M');
    expect(r.pecas[0]!.graduacao).toBeUndefined();
    expect(r.pecas[0]!.tamanho).toBe('M');
  });

  it('diz o que não achou, e deixa a peça como estava', () => {
    const p = { ...peca('Costas'), id: 'x' };
    const r = substituirTamanho([p], new Set(['x']), [graduada('Frente')], 'G');
    expect(r.pecas[0]).toBe(p);
    expect(r.semFonte).toEqual(['Costas']);
    expect(r.trocadas).toBe(0);
  });

  it('a peça não indicada não muda', () => {
    const p = { ...peca('Frente'), id: 'y' };
    expect(substituirTamanho([p], new Set(['x']), [graduada('Frente')], 'G').pecas[0]).toBe(p);
  });
});

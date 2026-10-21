import { describe, it, expect } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde, type Molde } from './molde';
import { alternarNaSelecao, inverterSelecao, pecasDentroDoRetangulo, selecionarPeloRetangulo } from './selecao';

const IDS = ['a', 'b', 'c', 'd'];

describe('inverterSelecao', () => {
  it('com uma peça selecionada, passa a valer o lote das outras', () => {
    const invertida = inverterSelecao(IDS, { selecionadoId: 'b', idsEmLote: new Set() });
    expect(invertida.selecionadoId).toBeNull();
    expect([...invertida.idsEmLote]).toEqual(['a', 'c', 'd']);
  });

  it('com um lote, o lote é o que conta, mesmo havendo uma peça única', () => {
    const invertida = inverterSelecao(IDS, { selecionadoId: 'a', idsEmLote: new Set(['b', 'c']) });
    expect(invertida.selecionadoId).toBeNull();
    expect([...invertida.idsEmLote]).toEqual(['a', 'd']);
  });

  it('se sobra uma só, ela vira a seleção única', () => {
    const invertida = inverterSelecao(IDS, { selecionadoId: null, idsEmLote: new Set(['a', 'b', 'd']) });
    expect(invertida.selecionadoId).toBe('c');
    expect(invertida.idsEmLote.size).toBe(0);
  });

  it('sem nada selecionado, seleciona tudo; com tudo selecionado, não sobra nada', () => {
    const tudo = inverterSelecao(IDS, { selecionadoId: null, idsEmLote: new Set() });
    expect([...tudo.idsEmLote]).toEqual(IDS);
    const nada = inverterSelecao(IDS, tudo);
    expect(nada.selecionadoId).toBeNull();
    expect(nada.idsEmLote.size).toBe(0);
  });

  it('ignora ids de peças que já não existem', () => {
    const invertida = inverterSelecao(['a', 'b'], { selecionadoId: null, idsEmLote: new Set(['a', 'apagada']) });
    expect(invertida.selecionadoId).toBe('b');
  });

  it('sem peças, continua vazia', () => {
    const invertida = inverterSelecao([], { selecionadoId: null, idsEmLote: new Set() });
    expect(invertida.selecionadoId).toBeNull();
    expect(invertida.idsEmLote.size).toBe(0);
  });
});

describe('alternarNaSelecao — o Ctrl+clique', () => {
  it('com uma peça selecionada, o Ctrl+clique em outra faz o lote das duas', () => {
    const s = alternarNaSelecao({ selecionadoId: 'a', idsEmLote: new Set() }, 'b');
    expect(s.selecionadoId).toBeNull();
    expect([...s.idsEmLote]).toEqual(['a', 'b']);
  });

  it('o Ctrl+clique numa peça do lote a tira; sobrando uma, ela vira a seleção única; sem nenhuma, nada', () => {
    const doLote = alternarNaSelecao({ selecionadoId: null, idsEmLote: new Set(['a', 'b', 'c']) }, 'b');
    expect([...doLote.idsEmLote]).toEqual(['a', 'c']);
    expect(alternarNaSelecao({ selecionadoId: null, idsEmLote: new Set(['a', 'b']) }, 'b')).toEqual({ selecionadoId: 'a', idsEmLote: new Set() });
    expect(alternarNaSelecao({ selecionadoId: 'a', idsEmLote: new Set() }, 'a')).toEqual({ selecionadoId: null, idsEmLote: new Set() });
  });

  it('sem nada selecionado, o Ctrl+clique seleciona a peça', () => {
    expect(alternarNaSelecao({ selecionadoId: null, idsEmLote: new Set() }, 'c')).toEqual({ selecionadoId: 'c', idsEmLote: new Set() });
  });
});

describe('selecionarPeloRetangulo e pecasDentroDoRetangulo — arrastar no vazio', () => {
  const quadrado = (id: string, x: number, y: number): Molde =>
    criarMolde({ nome: id, referencia: '', tamanho: '', contorno: [ponto(x, y), ponto(x + 10, y), ponto(x + 10, y + 10), ponto(x, y + 10)], linhaDeFio: { inicio: ponto(x + 5, y + 1), fim: ponto(x + 5, y + 9) } }, id);
  const PECAS = [quadrado('a', 0, 0), quadrado('b', 20, 0), quadrado('c', 40, 0)];

  it('só as peças inteiras dentro do retângulo, de qualquer canto para qualquer canto', () => {
    expect(pecasDentroDoRetangulo(PECAS, ponto(-1, -1), ponto(31, 11))).toEqual(['a', 'b']);
    expect(pecasDentroDoRetangulo(PECAS, ponto(31, 11), ponto(-1, -1))).toEqual(['a', 'b']);
    // A peça só em parte dentro fica de fora.
    expect(pecasDentroDoRetangulo(PECAS, ponto(-1, -1), ponto(45, 11))).toEqual(['a', 'b']);
    expect(pecasDentroDoRetangulo(PECAS, ponto(100, 100), ponto(200, 200))).toEqual([]);
  });

  it('sem o Ctrl, as do retângulo são a seleção; com o Ctrl, somam-se às que já estavam', () => {
    expect(selecionarPeloRetangulo({ selecionadoId: 'c', idsEmLote: new Set() }, ['a', 'b'], false)).toEqual({ selecionadoId: null, idsEmLote: new Set(['a', 'b']) });
    expect(selecionarPeloRetangulo({ selecionadoId: 'c', idsEmLote: new Set() }, ['a'], true)).toEqual({ selecionadoId: null, idsEmLote: new Set(['c', 'a']) });
    expect(selecionarPeloRetangulo({ selecionadoId: 'c', idsEmLote: new Set() }, ['a'], false)).toEqual({ selecionadoId: 'a', idsEmLote: new Set() });
    expect(selecionarPeloRetangulo({ selecionadoId: 'c', idsEmLote: new Set() }, [], false)).toEqual({ selecionadoId: null, idsEmLote: new Set() });
  });
});

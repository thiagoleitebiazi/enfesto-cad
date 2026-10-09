import { describe, it, expect } from 'vitest';
import { inverterSelecao } from './selecao';

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

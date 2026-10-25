import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde, type Molde } from './molde';
import { comPontoDeCasamento, gruposDeCasamentoDaPeca, nomeDoPontoDeCasamento, rotuloDoPontoDeCasamento } from './pontosDeCasamento';
import { grupoDaMarcaDeCasamento } from './risco';

const frente = (): Molde =>
  criarMolde(
    {
      nome: 'Frente',
      referencia: 'R',
      tamanho: 'M',
      contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)],
      linhaDeFio: { inicio: ponto(100, 20), fim: ponto(100, 280) },
      marcas: [{ id: 'b', posicao: ponto(50, 50), rotulo: 'botão' }],
    },
    'f',
  );

describe('os pontos de casamento na peça (ADR 0130)', () => {
  it('o rótulo e o nome: o principal e o do grupo (que o risco lê de volta)', () => {
    expect(rotuloDoPontoDeCasamento('')).toBe('casamento');
    expect(rotuloDoPontoDeCasamento('  Manga ')).toBe('casamento: manga');
    expect(grupoDaMarcaDeCasamento(rotuloDoPontoDeCasamento('Bolso do peito'))).toBe('bolso do peito');
    expect(grupoDaMarcaDeCasamento(rotuloDoPontoDeCasamento(''))).toBe('');
    expect(nomeDoPontoDeCasamento('')).toBe('o ponto de casamento principal');
    expect(nomeDoPontoDeCasamento('Manga')).toBe('o ponto “casamento: manga”');
  });

  it('põe o ponto onde foi clicado; o do mesmo grupo anda, o de outro grupo é outro ponto', () => {
    const um = comPontoDeCasamento(frente(), '', ponto(100, 150), 'k1');
    expect(um.movido).toBe(false);
    expect(um.molde.marcas.at(-1)).toEqual({ id: 'k1', posicao: ponto(100, 150), rotulo: 'casamento' });
    const dois = comPontoDeCasamento(um.molde, 'Manga', ponto(180, 250), 'k2');
    expect(gruposDeCasamentoDaPeca(dois.molde)).toEqual(['', 'manga']);
    const andou = comPontoDeCasamento(dois.molde, 'manga ', ponto(170, 260), 'k3');
    expect(andou.movido).toBe(true);
    expect(andou.molde.marcas).toHaveLength(3);
    expect(andou.molde.marcas.find((m) => m.rotulo === 'casamento: manga')!.posicao).toEqual(ponto(170, 260));
    // A marca que não é de casamento não muda.
    expect(andou.molde.marcas[0]).toEqual({ id: 'b', posicao: ponto(50, 50), rotulo: 'botão' });
  });

  it('fora da peça, ou o nome com dois-pontos, não', () => {
    expect(() => comPontoDeCasamento(frente(), '', ponto(500, 500), 'k')).toThrow('Clique dentro da peça');
    expect(() => comPontoDeCasamento(frente(), 'manga: esquerda', ponto(100, 100), 'k')).toThrow('dois-pontos');
  });
});

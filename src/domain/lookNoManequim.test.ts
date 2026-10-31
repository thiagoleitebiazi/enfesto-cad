import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde } from './molde';
import { configuracoesDasInstancias, instanciasDasPecas, MONTAGEM_VAZIA, type Montagem3D } from './montagem3d';
import { montagemDoLook, type ModeloDoLook } from './lookNoManequim';

const peca = (id: string) =>
  criarMolde({ nome: 'Frente', referencia: '', tamanho: 'M', contorno: [ponto(0, 0), ponto(300, 0), ponto(300, 200), ponto(0, 200)], linhaDeFio: { inicio: ponto(50, 100), fim: ponto(250, 100) } }, id);

function modelo(nome: string, comBolso = false): ModeloDoLook {
  const pecas = comBolso ? [peca('a'), peca('b')] : [peca('a')];
  const base = configuracoesDasInstancias(instanciasDasPecas(pecas), MONTAGEM_VAZIA);
  const config = { ...base, 'a#0': { ...base['a#0']!, posicao: 'frente' as const } };
  const lado = { chave: 'a#0', de: 0, ate: 1, assinatura: 'x' };
  const montagem: Montagem3D = {
    ...MONTAGEM_VAZIA,
    pecas: comBolso ? { ...config, 'b#0': { ...base['b#0']!, posicao: 'sobre-outra-peca', sobre: { chave: 'a#0', doAltoMm: 10, doMeioMm: 0, bocaEmCima: true } } } : config,
    costuras: [{ id: 'c1', a: lado, b: { ...lado, de: 2, ate: 3 }, invertida: false }],
    resolucaoMm: comBolso ? 12 : 30,
  };
  return { nome, pecas, montagem };
}

describe('o look no manequim (ADR 0155)', () => {
  it('as peças, a configuração e as costuras dos dois modelos, sem os ids colidirem; o manequim e o tecido do primeiro', () => {
    const { pecas, montagem } = montagemDoLook([modelo('Blusa', true), modelo('Saia')]);
    expect(pecas.map((p) => p.id)).toEqual(['0~a', '0~b', '1~a']);
    expect(Object.keys(montagem.pecas).sort()).toEqual(instanciasDasPecas(pecas).map((i) => i.chave).sort());
    expect(montagem.pecas['0~b#0']!.sobre?.chave).toBe('0~a#0');
    expect(montagem.costuras.map((c) => [c.id, c.a.chave, c.b.chave])).toEqual([
      ['0~c1', '0~a#0', '0~a#0'],
      ['1~c1', '1~a#0', '1~a#0'],
    ]);
    expect(montagem.resolucaoMm).toBe(12);
  });

  it('precisa de dois modelos, todos montados no provador', () => {
    expect(() => montagemDoLook([modelo('Blusa')])).toThrow(/ao menos dois/);
    expect(() => montagemDoLook([modelo('Blusa'), { nome: 'Saia', pecas: [peca('a')], montagem: MONTAGEM_VAZIA }])).toThrow(/Monte antes no provador 3D .*: Saia\./);
  });
});

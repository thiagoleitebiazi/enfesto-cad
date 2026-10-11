import { describe, it, expect } from 'vitest';
import { ponto } from '../core/geometria';
import { tornarElementos } from '../domain/linhasAuxiliares';
import { criarMolde, type FormatoDePique, type Molde } from '../domain/molde';
import { lerRegistroDaPagina, registroDaPeca } from './pdf-registro';

// Uma peça de 200 × 300 mm. A origem da página fica em (10, 20): o registro guarda as posições contadas dela.
const ORIGEM = ponto(10, 20);
const molde = (extra: Partial<Molde> = {}): Molde => ({
  ...criarMolde({ nome: 'Frente', referencia: 'R', tamanho: 'M', contorno: [ponto(10, 20), ponto(210, 20), ponto(210, 320), ponto(10, 320)], linhaDeFio: { inicio: ponto(60, 60), fim: ponto(60, 260) } }, 'f'),
  ...extra,
});
const EM_L: FormatoDePique = { tipo: 'cadastrado:c1', larguraMm: 10, alturaMm: 20, anguloGraus: 15, nome: 'Pé — nº 1', forma: [[ponto(0, 0), ponto(0, 1), ponto(0.5, 1)]], espelhado: true };
const DO_V: FormatoDePique = { tipo: 'v', larguraMm: 8, alturaMm: 10, anguloGraus: -30 };
/** A linha do registro lida de volta, como se viesse dentro da stream de uma página. */
const lido = (linha: string | null) => lerRegistroDaPagina(['q', '0 0 m', linha ?? '', 'Q'].join('\n'));
/** Uma linha de registro com o JSON dado. */
const comOJson = (json: string): string => '% enfesto-cad:peca:1 ' + Array.from(json, (c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join('');

describe('o registro da peça no PDF', () => {
  it('a peça em que o desenho já diz tudo não tem registro', () => {
    const simples = molde({ piques: [{ id: 'p', posicao: ponto(110, 20), indiceAresta: 0 }], marcas: [{ id: 'm', posicao: ponto(50, 50) }], linhasInternas: [[ponto(30, 40), ponto(190, 40)]] });

    expect(registroDaPeca(simples, ORIGEM)).toBeNull();
    expect(lido(null)).toBeNull();
  });

  it('leva o formato, o pique na costura e o código de cada pique que tem o que dizer, na posição da página', () => {
    const peca = molde({
      piques: [
        { id: 'a', posicao: ponto(110, 20), indiceAresta: 0, formato: EM_L, naCostura: 'estendido', codigo: 'K7' },
        { id: 'b', posicao: ponto(60, 20), indiceAresta: 0 },
        { id: 'c', posicao: ponto(210, 100.12345678), indiceAresta: 1, formato: DO_V },
        { id: 'd', posicao: ponto(160, 20), indiceAresta: 0, codigo: '2' },
      ],
    });
    const linha = registroDaPeca(peca, ORIGEM)!;

    // Uma linha só, de comentário, com letras minúsculas e números depois do começo.
    expect(linha).toMatch(/^% enfesto-cad:peca:1 [0-9a-f]+$/);
    expect(lido(linha)).toEqual({
      piques: [
        { posicao: ponto(100, 0), formato: EM_L, naCostura: 'estendido', codigo: 'K7' },
        { posicao: ponto(200, 80.1235), formato: DO_V },
        { posicao: ponto(150, 0), codigo: '2' },
      ],
      marcas: [],
      textos: [],
      elementos: [],
    });
  });

  it('leva todas as marcas quando alguma é um pique interno; os textos, com o ângulo e a âncora; e as linhas só de construção', () => {
    const peca = tornarElementos(
      molde({
        marcas: [
          { id: 'm', posicao: ponto(110, 170), formato: EM_L },
          { id: 'n', posicao: ponto(50, 50) },
        ],
        textos: [
          { id: 't', posicao: ponto(110, 220), texto: 'Ação — 1ª', alturaMm: 12, anguloGraus: 30, ancora: 'fim' },
          { id: 'u', posicao: ponto(60, 120), texto: 'DOBRA', alturaMm: 8 },
        ],
        linhasInternas: [[ponto(30, 40), ponto(190, 40)], [ponto(30, 60), ponto(110, 60), ponto(110, 160)]],
      }),
      [1],
    );

    expect(lido(registroDaPeca(peca, ORIGEM))).toEqual({
      piques: [],
      marcas: [{ posicao: ponto(100, 150), formato: EM_L }, { posicao: ponto(40, 30) }],
      textos: [
        { posicao: ponto(100, 200), texto: 'Ação — 1ª', alturaMm: 12, anguloGraus: 30, ancora: 'fim' },
        { posicao: ponto(50, 100), texto: 'DOBRA', alturaMm: 8 },
      ],
      elementos: [[ponto(20, 40), ponto(100, 40), ponto(100, 140)]],
    });
    // Só com marcas sem formato, elas não vão: o desenho basta.
    expect(lido(registroDaPeca(molde({ marcas: [{ id: 'n', posicao: ponto(50, 50) }], textos: [{ id: 'u', posicao: ponto(60, 120), texto: 'X', alturaMm: 8 }] }), ORIGEM))).toMatchObject({ marcas: [] });
  });

  it('o texto com ângulo zero guarda o ângulo: é diferente do texto sem ângulo', () => {
    const peca = molde({ textos: [{ id: 't', posicao: ponto(110, 220), texto: 'A', alturaMm: 12, anguloGraus: 0 }] });
    expect(lido(registroDaPeca(peca, ORIGEM))).toMatchObject({ textos: [{ texto: 'A', anguloGraus: 0 }] });
  });

  it('o registro cortado, trocado ou com um campo fora do esperado não é aproveitado', () => {
    const boa = registroDaPeca(molde({ piques: [{ id: 'a', posicao: ponto(110, 20), indiceAresta: 0, formato: DO_V }] }), ORIGEM)!;

    expect(lido(boa)).not.toBe('ilegivel');
    expect(lido(boa.slice(0, -1))).toBe('ilegivel');
    expect(lido(boa.slice(0, -8))).toBe('ilegivel');
    expect(lido(boa + 'zz')).toBe('ilegivel');
    expect(lido('% enfesto-cad:peca:1 ')).toBe('ilegivel');
    for (const json of [
      '[]',
      '"texto"',
      '{}',
      '{"p":[],"m":[],"t":[]}',
      '{"p":{},"m":[],"t":[],"e":[]}',
      '{"p":[{"p":[1]}],"m":[],"t":[],"e":[]}',
      '{"p":[{"p":[1,"2"]}],"m":[],"t":[],"e":[]}',
      '{"p":[{"p":[1,2],"f":{"t":"v","l":0,"h":6,"a":0}}],"m":[],"t":[],"e":[]}',
      '{"p":[{"p":[1,2],"f":{"t":"v","l":4,"h":-6,"a":0}}],"m":[],"t":[],"e":[]}',
      '{"p":[{"p":[1,2],"f":{"t":"","l":4,"h":6,"a":0}}],"m":[],"t":[],"e":[]}',
      '{"p":[{"p":[1,2],"f":{"t":"v","l":4,"h":6}}],"m":[],"t":[],"e":[]}',
      '{"p":[{"p":[1,2],"f":{"t":"x","l":4,"h":6,"a":0,"n":7}}],"m":[],"t":[],"e":[]}',
      '{"p":[{"p":[1,2],"f":{"t":"x","l":4,"h":6,"a":0,"f":[]}}],"m":[],"t":[],"e":[]}',
      '{"p":[{"p":[1,2],"f":{"t":"x","l":4,"h":6,"a":0,"f":[[[0,0]]]}}],"m":[],"t":[],"e":[]}',
      '{"p":[{"p":[1,2],"c":"outro"}],"m":[],"t":[],"e":[]}',
      '{"p":[{"p":[1,2],"k":5}],"m":[],"t":[],"e":[]}',
      '{"p":[],"m":[{"f":{"t":"v","l":4,"h":6,"a":0}}],"t":[],"e":[]}',
      '{"p":[],"m":[{"p":[1,2],"f":7}],"t":[],"e":[]}',
      '{"p":[],"m":[],"t":[{"p":[1,2],"s":"","h":8}],"e":[]}',
      '{"p":[],"m":[],"t":[{"p":[1,2],"s":"A","h":0}],"e":[]}',
      '{"p":[],"m":[],"t":[{"p":[1,2],"s":"A","h":8,"a":"30"}],"e":[]}',
      '{"p":[],"m":[],"t":[{"p":[1,2],"s":"A","h":8,"n":"meio"}],"e":[]}',
      '{"p":[],"m":[],"t":[],"e":[[[1,2]]]}',
      '{"p":[],"m":[],"t":[],"e":[[[1,2],[3]]]}',
      '{"p":[],"m":[],"t":[],"e":[7]}',
    ]) {
      expect(lido(comOJson(json)), json).toBe('ilegivel');
    }
    // Uma lista grande demais também não serve.
    const comTantosPontos = (quantos: number): string => comOJson('{"p":[],"m":[],"t":[],"e":[[' + Array.from({ length: quantos }, () => '[1,2]').join(',') + ']]}');
    expect(lido(comTantosPontos(20001))).toBe('ilegivel');
    expect(lido(comTantosPontos(20000))).not.toBe('ilegivel');
    // O mínimo que serve: as quatro listas, vazias.
    expect(lido(comOJson('{"p":[],"m":[],"t":[],"e":[]}'))).toEqual({ piques: [], marcas: [], textos: [], elementos: [] });
    // A marca de espelhado só vale no formato que traz a forma.
    expect(lido(comOJson('{"p":[{"p":[1,2],"f":{"t":"v","l":4,"h":6,"a":0,"e":1}}],"m":[],"t":[],"e":[]}'))).toEqual({ piques: [{ posicao: ponto(1, 2), formato: { tipo: 'v', larguraMm: 4, alturaMm: 6, anguloGraus: 0 } }], marcas: [], textos: [], elementos: [] });
  });
});

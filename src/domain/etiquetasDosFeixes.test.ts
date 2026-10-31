import { describe, expect, it } from 'vitest';
import { lerCsv } from '../core/csv';
import { barrasDoCode39, csvDasEtiquetas, feixesDaOrdem, htmlDasEtiquetas, padroesDoCode39, textoParaCode39 } from './etiquetasDosFeixes';

const DADOS = {
  ordem: 'OP-12',
  produto: 'Camiseta',
  cor: 'Azul',
  quantidadesPorTamanho: { P: 25, M: 20, G: 0 },
  pecas: [
    { nome: 'Frente', quantidade: 1 },
    { nome: 'Manga', quantidade: 2 },
  ],
  roupasPorFeixe: 10,
};

describe('as etiquetas dos feixes (ADR 0159)', () => {
  it('um feixe a cada N roupas, por tamanho; o último com o que sobrar; o código sequencial', () => {
    const e = feixesDaOrdem(DADOS);
    expect(e.map((x) => [x.codigo, x.tamanho, x.feixe, x.feixesDoTamanho, x.de, x.ate, x.roupas])).toEqual([
      ['OP-12-001', 'P', 1, 3, 1, 10, 10],
      ['OP-12-002', 'P', 2, 3, 11, 20, 10],
      ['OP-12-003', 'P', 3, 3, 21, 25, 5],
      ['OP-12-004', 'M', 1, 2, 1, 10, 10],
      ['OP-12-005', 'M', 2, 2, 11, 20, 10],
    ]);
    expect(() => feixesDaOrdem({ ...DADOS, roupasPorFeixe: 0 })).toThrow(/de 1 para cima/);
  });

  it('o Code 39: cada símbolo com 9 elementos, 3 largos, todos diferentes; a sequência de começo e fim', () => {
    const padroes = Object.values(padroesDoCode39());
    expect(padroes).toHaveLength(40);
    expect(new Set(padroes).size).toBe(40);
    for (const p of padroes) {
      expect(p).toHaveLength(9);
      expect([...p].filter((c) => c === 'w')).toHaveLength(3);
    }
    expect(textoParaCode39('op_ção/1')).toBe('OP-CAO-1');
    const { barras, larguraTotal } = barrasDoCode39('A');
    // Três símbolos (* A *): 5 barras cada; 12 módulos... 9 elementos com 3 largos = 15 módulos, mais os 2 intervalos.
    expect(barras).toHaveLength(15);
    expect(larguraTotal).toBe(3 * 15 + 2);
    expect(barras[0]).toEqual({ x: 0, largura: 1 });
  });

  it('o CSV e a folha para imprimir, com a lista das peças e o texto escapado', () => {
    const e = feixesDaOrdem({ ...DADOS, produto: 'Blusa <nova>' });
    expect(lerCsv(csvDasEtiquetas(e))[1]).toEqual(['OP-12-001', 'OP-12', 'Blusa <nova>', 'Azul', 'P', '1', '3', '1', '10', '10']);
    const html = htmlDasEtiquetas(e, DADOS.pecas);
    expect(html.match(/<article>/g)).toHaveLength(5);
    expect(html).toContain('Blusa &lt;nova&gt;');
    expect(html).toContain('Frente, Manga × 2');
    expect(html).toContain('Feixe 3 de 3');
    expect(html.match(/<svg/g)).toHaveLength(5);
  });
});

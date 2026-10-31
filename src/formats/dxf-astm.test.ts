import { describe, expect, it } from 'vitest';
import { area, ponto } from '../core/geometria';
import { criarMolde } from '../domain/molde';
import { definirTamanhosDoMolde } from '../domain/tamanhosGraduados';
import { gerarDxfAstm } from './dxf-astm';
import { importarDxf } from './dxf-importacao';

const peca = criarMolde(
  {
    nome: 'Frente',
    referencia: '',
    tamanho: 'M',
    quantidade: 2,
    contorno: [ponto(0, 0), ponto(300, 0), ponto(300, 200), ponto(0, 200)],
    linhaDeFio: { inicio: ponto(150, 20), fim: ponto(150, 180) },
    furos: [[ponto(100, 50), ponto(120, 50), ponto(120, 70), ponto(100, 70)]],
    linhasInternas: [[ponto(50, 100), ponto(250, 100)]],
    marcas: [{ id: 'm', posicao: ponto(200, 150) }],
    piques: [{ id: 'q', posicao: ponto(300, 100), indiceAresta: 1 }],
  },
  'f',
);
let k = 0;
const novoId = (): string => `n${++k}`;

describe('o DXF no padrão ASTM (ADR 0166)', () => {
  it('um bloco por peça, com os atributos e as camadas por número', () => {
    const dxf = gerarDxfAstm([peca], 'Saia 2027', novoId);
    expect(dxf.match(/\r\nBLOCK\r\n/g)).toHaveLength(1);
    expect(dxf.match(/\r\nINSERT\r\n/g)).toHaveLength(1);
    for (const t of ['Piece Name: Frente', 'Size: M', 'Quantity: 2', 'Style Name: Saia 2027']) expect(dxf).toContain(t);
    // Contorno 1, cantos 2, pique 4, fio 7, linha interna 8, furo 11, marca 13.
    for (const c of ['POLYLINE\r\n8\r\n1\r\n', 'POINT\r\n8\r\n2\r\n', 'LINE\r\n8\r\n4\r\n', 'LINE\r\n8\r\n7\r\n', 'POLYLINE\r\n8\r\n8\r\n', 'POLYLINE\r\n8\r\n11\r\n', 'POINT\r\n8\r\n13\r\n']) {
      expect(dxf, c).toContain(c);
    }
    expect(dxf.trim().endsWith('EOF')).toBe(true);
  });

  it('com graduação, um bloco por tamanho', () => {
    const dxf = gerarDxfAstm([definirTamanhosDoMolde(peca, ['P', 'M', 'G'], 'M')], 'Saia', novoId);
    expect(dxf.match(/\r\nBLOCK\r\n/g)).toHaveLength(3);
    for (const t of ['Size: P', 'Size: M', 'Size: G']) expect(dxf).toContain(t);
  });

  it('volta pelo importador deste programa, com a área da peça', () => {
    const r = importarDxf(gerarDxfAstm([peca], 'Saia', novoId), 'x');
    expect(r.pecas).toHaveLength(1);
    expect(area(r.pecas[0]!.contorno)).toBeCloseTo(60_000, -1);
  });
});

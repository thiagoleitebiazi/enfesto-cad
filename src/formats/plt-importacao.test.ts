import { describe, expect, it } from 'vitest';
import { area, ponto } from '../core/geometria';
import { criarMolde } from '../domain/molde';
import { gerarPlt } from './plt-exportacao';
import { lerHpgl, pecasDoPlt } from './plt-importacao';

const peca = (id: string, y0: number) =>
  criarMolde(
    {
      nome: `Frente ${id}`,
      referencia: '',
      tamanho: 'M',
      contorno: [ponto(100, y0), ponto(500, y0), ponto(500, y0 + 300), ponto(100, y0 + 300)],
      linhaDeFio: { inicio: ponto(300, y0 + 40), fim: ponto(300, y0 + 260) },
      furos: [[ponto(200, y0 + 100), ponto(240, y0 + 100), ponto(240, y0 + 140), ponto(200, y0 + 140)]],
      linhasInternas: [[ponto(150, y0 + 200), ponto(250, y0 + 200)]],
      piques: [{ id: 'q', posicao: ponto(500, y0 + 150), indiceAresta: 1 }],
    },
    id,
  );

describe('o HPGL lido (ADR 0157)', () => {
  it('caneta, absoluto e relativo, o terminador do texto e os comandos desconhecidos', () => {
    const { tracos, textos } = lerHpgl('IN;SP1;DT*;PU10,20;PD30,20,30,40;PU;PA50,50;LBNome da peça*;XX1,2;PR;PD10,0,0,10;PU;\n');
    expect(tracos.map((t) => t.pontos.map((p) => [p.x, p.y]))).toEqual([
      [
        [10, 20],
        [30, 20],
        [30, 40],
      ],
      [
        [50, 50],
        [60, 50],
        [60, 60],
      ],
    ]);
    expect(textos).toEqual([{ p: { x: 50, y: 50 }, texto: 'Nome da peça' }]);
  });
});

describe('as peças do PLT (ADR 0157)', () => {
  it('o PLT deste programa volta: a mesa fica de fora; o contorno, o nome, o furo, a linha, o pique e o fio de cada peça', () => {
    const { pecas, avisos } = pecasDoPlt(gerarPlt([peca('a', 100), peca('b', 600)], { larguraDaMesaMm: 1000, comprimentoDaMesaMm: 2000 }));
    expect(avisos).toEqual([]);
    expect(pecas.map((p) => p.nome).sort()).toEqual(['Frente a M', 'Frente b M']);
    for (const p of pecas) {
      expect(area(p.contorno)).toBeCloseTo(120_000, -1);
      expect(p.furos).toHaveLength(1);
      expect(p.linhasInternas).toHaveLength(1);
      expect(p.piques).toHaveLength(1);
      expect(Math.hypot(p.fio!.inicio.x - p.fio!.fim.x, p.fio!.inicio.y - p.fio!.fim.y)).toBeCloseTo(220, 0);
    }
  });

  it('a peça sozinha na mesa continua peça, e sem a mesa também', () => {
    expect(pecasDoPlt(gerarPlt([peca('a', 100)], { larguraDaMesaMm: 1000, comprimentoDaMesaMm: 2000 })).pecas).toHaveLength(1);
    expect(pecasDoPlt(gerarPlt([peca('a', 100)])).pecas).toHaveLength(1);
  });

  it('a linha de costura de dentro (mais de metade da área) não vira furo; sem linha fechada, o aviso', () => {
    const r = pecasDoPlt('IN;PU0,0;PD4000,0,4000,4000,0,4000,0,0;PU400,400;PD3600,400,3600,3600,400,3600,400,400;PU;');
    expect(r.pecas).toHaveLength(1);
    expect(r.pecas[0]!.furos).toEqual([]);
    expect(pecasDoPlt('IN;PU0,0;PD100,100;PU;').avisos[0]).toMatch(/Nenhuma linha fechada/);
  });
});

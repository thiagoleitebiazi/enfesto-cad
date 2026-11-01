import { describe, expect, it } from 'vitest';
import { area, ponto } from '../core/geometria';
import { criarMolde } from '../domain/molde';
import { gerarIso } from './iso-exportacao';
import { tracosDoIso } from './iso-importacao';
import { lerTracos, pecasDosTracos } from './tracos-importacao';

const peca = (id: string, y0: number) =>
  criarMolde(
    {
      nome: `Frente ${id}`,
      referencia: '',
      tamanho: 'M',
      contorno: [ponto(100, y0), ponto(500, y0), ponto(500, y0 + 300), ponto(100, y0 + 300)],
      linhaDeFio: { inicio: ponto(300, y0 + 40), fim: ponto(300, y0 + 260) },
    },
    id,
  );

describe('os traços lidos (ADR 0157)', () => {
  it('ferramenta embaixo e em cima, absoluto e relativo', () => {
    const { tracos } = lerTracos('IN;PU10,20;PD30,20,30,40;PU;PA50,50;XX1,2;PR;PD10,0,0,10;PU;\n');
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
  });
});

describe('as peças dos traços (ADR 0157)', () => {
  it('o ISO deste programa volta com uma peça para cada contorno, sem depender da mesa', () => {
    const { pecas, avisos } = pecasDosTracos(tracosDoIso(gerarIso([peca('a', 100), peca('b', 600)], { larguraDaMesaMm: 1000 })));
    expect(avisos).toEqual([]);
    expect(pecas).toHaveLength(2);
    for (const p of pecas) expect(area(p.contorno)).toBeCloseTo(120_000, -1);
  });

  it('a linha de costura de dentro (mais de metade da área) não vira furo; sem linha fechada, o aviso', () => {
    const r = pecasDosTracos('IN;PU0,0;PD4000,0,4000,4000,0,4000,0,0;PU400,400;PD3600,400,3600,3600,400,3600,400,400;PU;');
    expect(r.pecas).toHaveLength(1);
    expect(r.pecas[0]!.furos).toEqual([]);
    expect(pecasDosTracos('IN;PU0,0;PD100,100;PU;').avisos[0]).toMatch(/Nenhuma linha fechada/);
  });
});

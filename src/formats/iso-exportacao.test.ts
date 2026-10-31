import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde, type Molde } from '../domain/molde';
import { gerarIso, resumoDoIso, rumoContinuo } from './iso-exportacao';

function peca(id: string, y0: number, extras: Partial<Parameters<typeof criarMolde>[0]> = {}): Molde {
  return criarMolde(
    {
      nome: `Peça ${id}`,
      referencia: '',
      tamanho: 'M',
      contorno: [ponto(0, y0), ponto(100, y0), ponto(100, y0 + 200), ponto(0, y0 + 200)],
      linhaDeFio: { inicio: ponto(50, y0 + 20), fim: ponto(50, y0 + 180) },
      ...extras,
    },
    id,
  );
}

const comandos = (iso: string): string[] => iso.split('\n').filter((l) => l !== '');

describe('o arquivo ISO para a mesa de corte (ADR 0140)', () => {
  it('o cabeçalho, as unidades, o fim; as peças na ordem do comprimento', () => {
    const iso = gerarIso([peca('b', 500), peca('a', 0)], { larguraDaMesaMm: 1000 });
    const c = comandos(iso);
    expect(c.slice(0, 6)).toEqual(['%', '(ENFESTO CAD - CORTE AUTOMATICO, ISO 6983)', '(T1 FACA, T2 PIQUETEADOR, T3 CANETA, T4 FURADOR)', 'G21', 'G90', 'G0 Z5.00']);
    expect(c.slice(-3)).toEqual(['G0 X0.00 Y0.00', 'M30', '%']);
    expect(c.indexOf('(Peca a M)')).toBeLessThan(c.indexOf('(Peca b M)'));
  });

  it('o contorno com a faca: anda subida, desce, corta fechando no começo, sobe', () => {
    const c = comandos(gerarIso([peca('a', 0)], { larguraDaMesaMm: 1000, velocidadeMmMin: 9000 }));
    const i = c.indexOf('T1');
    expect(c.slice(i + 1, i + 9)).toEqual([
      'G0 Z5.00',
      // O x da mesa é o y do mundo; o y da mesa, a largura contada da borda (1000 − x).
      'G0 X0.00 Y1000.00',
      'G1 Z0.00',
      'G1 X0.00 Y900.00 F9000',
      'G1 X200.00 Y900.00',
      'G1 X200.00 Y1000.00',
      'G1 X0.00 Y1000.00',
      'G0 Z5.00',
    ]);
  });

  it('em cada peça, o de dentro antes do contorno: a caneta, o furador, o piqueteador, depois a faca', () => {
    const p = peca('a', 0, {
      linhasInternas: [[ponto(20, 50), ponto(80, 50)]],
      marcas: [{ id: 'm', posicao: ponto(50, 100), rotulo: 'botão' }],
      piques: [{ id: 'q', posicao: ponto(100, 100), indiceAresta: 1 }],
      furos: [[ponto(40, 140), ponto(60, 140), ponto(60, 160), ponto(40, 160)]],
    });
    const c = comandos(gerarIso([p], { larguraDaMesaMm: 1000, comCaneta: true }));
    const ordem = c.filter((l) => /^T\d$/.test(l));
    expect(ordem).toEqual(['T3', 'T4', 'T2', 'T1']);
    // Sem a caneta, ela não aparece.
    expect(comandos(gerarIso([p], { larguraDaMesaMm: 1000 })).filter((l) => /^T\d$/.test(l))).toEqual(['T4', 'T2', 'T1']);
    // O furo é cortado antes do contorno, com a faca.
    const t1 = c.indexOf('T1');
    expect(c.slice(t1).filter((l) => l.startsWith('G1 Z0.00'))).toHaveLength(2);
  });

  it('o resumo: as peças, o caminho cortado (contorno e furos) e os piques', () => {
    const p = peca('a', 0, { furos: [[ponto(40, 140), ponto(60, 140), ponto(60, 160), ponto(40, 160)]], piques: [{ id: 'q', posicao: ponto(100, 100), indiceAresta: 1 }] });
    expect(resumoDoIso([p])).toEqual({ pecas: 1, corteM: (600 + 80) / 1000, piques: 1 });
  });
});

describe('a faca tangencial (ADR 0148)', () => {
  it('o rumo fica na volta mais perto: a faca não dá a volta inteira', () => {
    expect(rumoContinuo(170, -170)).toBe(190);
    expect(rumoContinuo(-170, 170)).toBe(-190);
    expect(rumoContinuo(10, 20)).toBe(20);
  });

  it('nos cantos a faca sobe, gira e desce; sem a opção, não há eixo C', () => {
    const c = comandos(gerarIso([peca('a', 0)], { larguraDaMesaMm: 1000, velocidadeMmMin: 9000, facaTangencial: true }));
    const i = c.indexOf('T1');
    expect(c.slice(i + 1, i + 9)).toEqual(['G0 Z5.00', 'G0 X0.00 Y1000.00 C-90.00', 'G1 Z0.00', 'G1 X0.00 Y900.00 C-90.00 F9000', 'G0 Z5.00', 'G0 C0.00', 'G1 Z0.00', 'G1 X200.00 Y900.00 C0.00']);
    expect(gerarIso([peca('a', 0)], { larguraDaMesaMm: 1000 })).not.toMatch(/ C-?\d/);
  });

  it('na virada pequena a faca gira cortando, e o ângulo de subir é o pedido', () => {
    const curva = criarMolde(
      { nome: 'Curva', referencia: '', tamanho: 'M', contorno: [ponto(0, 0), ponto(0, 100), ponto(10, 200), ponto(100, 200), ponto(100, 0)], linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 180) } },
      'curva',
    );
    const c = comandos(gerarIso([curva], { larguraDaMesaMm: 1000, facaTangencial: true }));
    const antes = c[c.indexOf('G1 X200.00 Y990.00 C-5.71') - 1]!;
    expect(antes.startsWith('G1 X100.00')).toBe(true);
    const estrito = comandos(gerarIso([curva], { larguraDaMesaMm: 1000, facaTangencial: true, anguloDeLevantarGraus: 3 }));
    expect(estrito[estrito.indexOf('G1 X200.00 Y990.00 C-5.71') - 1]).toBe('G1 Z0.00');
  });
});

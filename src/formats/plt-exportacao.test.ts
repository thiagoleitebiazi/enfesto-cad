import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde } from '../domain/molde';
import { gerarPlt, textoParaPlotter, UNIDADES_POR_MM } from './plt-exportacao';

const ETX = String.fromCharCode(3);

/** Uma peça de 200 × 300 mm na mesa, com um pique na aresta x = 10. */
const peca = (extras: Partial<Parameters<typeof criarMolde>[0]> = {}) =>
  criarMolde(
    {
      nome: 'Calça',
      referencia: '',
      tamanho: 'M',
      contorno: [ponto(10, 20), ponto(210, 20), ponto(210, 320), ponto(10, 320)],
      linhaDeFio: { inicio: ponto(110, 40), fim: ponto(110, 300) },
      piques: [{ id: 'p', posicao: ponto(10, 170), indiceAresta: 3 }],
      ...extras,
    },
    'f',
  );

/** Os comandos do arquivo, sem o ponto e vírgula. */
const comandos = (plt: string): string[] => plt.trim().split(';').filter((c) => c !== '');

describe('gerarPlt — o risco para o plotter (HPGL)', () => {
  it('começa iniciando o plotter e escolhendo a caneta, e termina guardando a caneta', () => {
    const c = comandos(gerarPlt([peca()]));
    expect(c.slice(0, 3)).toEqual(['IN', 'SP1', `DT${ETX}`]);
    expect(c.slice(-2)).toEqual(['PU0,0', 'SP0']);
    expect(UNIDADES_POR_MM).toBe(40);
  });

  it('a escala é 1:1 em unidades de 0,025 mm; o comprimento da mesa no x e a largura no y, como na tela', () => {
    const c = comandos(gerarPlt([peca()], { larguraDaMesaMm: 1500, comprimentoDaMesaMm: 3000 }));
    // A mesa: (0,0) → (0,1500 mm) … no papel: x = y do mundo, y = 1500 − x do mundo.
    expect(c[3]).toBe('PU0,60000');
    expect(c[4]).toBe('PD0,0,120000,0,120000,60000,0,60000');
    // A linha de corte da peça: o primeiro ponto (10, 20) → x = 20 mm, y = 1490 mm; fechada (volta ao começo).
    expect(c[5]).toBe('PU800,59600');
    expect(c[6]).toBe('PD800,51600,12800,51600,12800,59600,800,59600');
  });

  it('o fio, o pique (o corte que atravessa a linha de corte) e o nome sem acento', () => {
    const c = comandos(gerarPlt([peca()], { larguraDaMesaMm: 1500 }));
    // Fio: (110, 40) → (110, 300): no papel, x de 40 a 300 mm, y = 1390 mm.
    expect(c).toContain('PU1600,55600');
    expect(c).toContain('PD12000,55600');
    // Pique: de 1 mm fora a 6 mm dentro da aresta x = 10, em y = 170: no papel, y de 1491 a 1484 mm, x = 170 mm.
    expect(c).toContain('PU6800,59640');
    expect(c).toContain('PD6800,59360');
    expect(c.some((x) => x === `LBCalca M${ETX}`)).toBe(true);
  });

  it('a costura sai junto da linha de corte, e as linhas internas abertas não fecham', () => {
    const plt = gerarPlt([peca({ margemDeCosturaMm: 10, linhasInternas: [[ponto(50, 60), ponto(80, 150), ponto(60, 250)]] })]);
    const desenhos = comandos(plt).filter((x) => x.startsWith('PD'));
    // Linha de corte, costura, linha interna, fio e pique.
    expect(desenhos).toHaveLength(5);
    const interna = desenhos[2]!.slice(2).split(',').map(Number);
    expect(interna).toHaveLength(4); // os 2 pontos depois do primeiro, sem voltar ao começo
  });

  it('o texto para o plotter: sem acentos, e o que não é ASCII vira "?"', () => {
    expect(textoParaPlotter('Calça — Ação ✓')).toBe('Calca - Acao ?');
  });
});

describe('gerarPlt — as canetas e os grupos do encaixe (ADR 0115)', () => {
  it('com uma caneta (o padrão), nada vai para a 2; com duas, a linha de corte vai na 1 e o resto na 2', () => {
    expect(comandos(gerarPlt([peca()]))).not.toContain('SP2');
    const c = comandos(gerarPlt([peca({ margemDeCosturaMm: 10 })], { canetas: 2 }));
    // A linha de corte (com a costura de 10 mm, fora do contorno) e logo depois a troca para a 2.
    const corte = c.findIndex((x) => x.startsWith('PU'));
    expect(c[corte + 2]).toBe('SP2');
    expect(c.filter((x) => x === 'SP1')).toHaveLength(1);
    expect(c.filter((x) => x === 'SP2')).toHaveLength(1);
  });

  it('a divisa entre os trechos dos grupos atravessa a mesa, e cada trecho leva o nome', () => {
    const entretela = { ...peca(), id: 'e', grupoDoEncaixe: 'Entretela' };
    const outra = { ...criarMolde({ nome: 'Frente', referencia: '', tamanho: 'M', contorno: [ponto(10, 400), ponto(210, 400), ponto(210, 700), ponto(10, 700)], linhaDeFio: { inicio: ponto(110, 420), fim: ponto(110, 680) } }, 'o') };
    const c = comandos(gerarPlt([entretela, outra], { larguraDaMesaMm: 1500, comprimentoDaMesaMm: 3000 }));
    // A divisa no meio de 320 e 400 mm (360 mm), da borda (y = 1500) à outra (y = 0) no papel.
    expect(c).toContain('PU14400,60000');
    expect(c).toContain('PD14400,0');
    expect(c).toContain(`LBEntretela${ETX}`);
    expect(c).toContain(`LBSem grupo${ETX}`);
  });
});

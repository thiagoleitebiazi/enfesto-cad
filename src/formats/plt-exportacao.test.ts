import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde } from '../domain/molde';
import { cabecalhoDoRisco, gerarPlt, textoParaPlotter, UNIDADES_POR_MM } from './plt-exportacao';

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

describe('o PLT por partes (ADR 0158)', () => {
  const quadrado = criarMolde(
    { nome: 'Q', referencia: '', tamanho: '', contorno: [ponto(100, 1000), ponto(200, 1000), ponto(200, 1100), ponto(100, 1100)], linhaDeFio: { inicio: ponto(150, 1010), fim: ponto(150, 1090) } },
    'q',
  );

  it('sem as opções, nada muda: não há janela', () => {
    expect(gerarPlt([quadrado], { larguraDaMesaMm: 1000 })).not.toContain('IW');
  });

  it('o X inicial desconta o comprimento e recorta o que vem antes', () => {
    const plt = gerarPlt([quadrado], { larguraDaMesaMm: 1000, xInicialMm: 900 });
    expect(plt).toContain('IW0,0,8000,40000;');
    // A peça começa a 1000 mm do risco: 100 mm depois do novo começo.
    expect(plt).toContain('PU4000,36000;');
  });

  it('a faixa 2 do papel de 600 mm: a largura desconta 600 e a janela tem a largura do papel', () => {
    const plt = gerarPlt([quadrado], { larguraDaMesaMm: 1000, larguraDoPapelMm: 600, faixa: 2 });
    expect(plt).toContain('IW0,0,44000,24000;');
    expect(plt).toContain('PU40000,12000;');
  });
});

describe('o cabeçalho do risco (ADR 0162)', () => {
  const peca = criarMolde(
    { nome: 'Q', referencia: '', tamanho: '', contorno: [ponto(0, 0), ponto(500, 0), ponto(500, 1000), ponto(0, 1000)], linhaDeFio: { inicio: ponto(50, 10), fim: ponto(50, 90) } },
    'q',
  );

  it('o modelo, a data, as medidas e o aproveitamento', () => {
    expect(cabecalhoDoRisco({ nome: 'Saia', codigo: 'ENF-1', pecas: [peca], larguraMm: 1000, dataIso: '2026-10-31T10:00:00.000Z' })).toEqual([
      'Saia (ENF-1) - 31/10/2026',
      'Largura 100,0 cm - Comprimento 100,0 cm - Aproveitamento 50,0% - 1 pecas',
    ]);
    expect(cabecalhoDoRisco({ nome: 'Saia', codigo: 'ENF-1', pecas: [], larguraMm: null, dataIso: '2026-10-31T10:00:00.000Z' })).toHaveLength(1);
  });

  it('sai depois da última peça, sem acento; sem cabeçalho, o arquivo não muda', () => {
    const plt = gerarPlt([peca], { larguraDaMesaMm: 1000, cabecalho: ['Saia Évasê'] });
    expect(plt).toContain('PU40800,39600;SI0.25,0.35;LBSaia Evase');
    expect(gerarPlt([peca], { larguraDaMesaMm: 1000 })).not.toContain('SI0.25');
  });
});

describe('os textos no risco (ADR 0165)', () => {
  it('saem no lugar deles, sem acento', () => {
    const peca = criarMolde({ nome: 'Q', referencia: '', tamanho: '', contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 100), ponto(0, 100)], linhaDeFio: { inicio: ponto(50, 10), fim: ponto(50, 90) } }, 'q');
    expect(gerarPlt([peca], { larguraDaMesaMm: 1000, textos: [{ x: 300, y: 1200, texto: 'Emenda aqui é' }] })).toContain('PU48000,28000;SI0.25,0.35;LBEmenda aqui e');
  });
});

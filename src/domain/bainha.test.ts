import { describe, it, expect } from 'vitest';
import { area, ponto, type Ponto2D, type PosicaoNoContorno } from '../core/geometria';
import { criarBainha, geometriaDaBainha, MAXIMO_DE_DOBRAS_DA_BAINHA, type OpcoesDeBainha } from './bainha';
import { adicionarPique, criarMolde, type DadosDeNovoMolde, type Molde } from './molde';

// Retângulo de 200 × 300 mm, anti-horário; a aresta 0 é a barra, em y = 0, e o lado de fora dela é y < 0.
const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
// Saia evasê: barra de 200 mm embaixo, cintura de 100 mm a 300 mm de altura (as laterais entram 50 mm em 300).
const TRAPEZIO = [ponto(0, 0), ponto(200, 0), ponto(150, 300), ponto(50, 300)];

function molde(sobrescrever: Partial<DadosDeNovoMolde> = {}): Molde {
  return criarMolde(
    {
      nome: 'Saia',
      referencia: 'REF-001',
      tamanho: 'M',
      contorno: RETANGULO,
      linhaDeFio: { inicio: ponto(100, 50), fim: ponto(100, 250) },
      ...sobrescrever,
    },
    'm1',
  );
}

function na(indiceAresta: number, x: number, y: number): PosicaoNoContorno {
  return { indiceAresta, ponto: ponto(x, y) };
}

function ids(): () => string {
  let n = 0;
  return () => `pique-${++n}`;
}

function esperarPontos(obtido: readonly Ponto2D[], esperado: readonly Ponto2D[]): void {
  expect(obtido).toHaveLength(esperado.length);
  obtido.forEach((p, i) => {
    expect(p.x).toBeCloseTo(esperado[i]!.x, 6);
    expect(p.y).toBeCloseTo(esperado[i]!.y, 6);
  });
}

const SIMPLES: OpcoesDeBainha = { dobras: 1, larguraMm: 30, piques: false };

describe('criarBainha', () => {
  it('bainha simples numa aresta reta: uma faixa da largura pedida para fora da peça', () => {
    const comBainha = criarBainha(molde(), na(0, 0, 0), na(1, 200, 0), SIMPLES, ids());
    esperarPontos(comBainha.contorno, [ponto(0, 0), ponto(0, -30), ponto(200, -30), ponto(200, 0), ponto(200, 300), ponto(0, 300)]);
    // 200 × 30 a mais.
    expect(area(comBainha.contorno)).toBeCloseTo(66000, 6);
  });

  it('a linha original da bainha vira linha interna (a linha de dobra)', () => {
    const comBainha = criarBainha(molde(), na(0, 0, 0), na(1, 200, 0), SIMPLES, ids());
    expect(comBainha.linhasInternas).toEqual([[ponto(0, 0), ponto(200, 0)]]);
  });

  it('a ordem dos dois pontos não muda o resultado', () => {
    const ida = criarBainha(molde(), na(0, 0, 0), na(1, 200, 0), SIMPLES, ids());
    const volta = criarBainha(molde(), na(1, 200, 0), na(0, 0, 0), SIMPLES, ids());
    expect(volta.contorno).toEqual(ida.contorno);
  });

  it('com duas dobras, a sobra tem duas larguras e ganha a linha da dobra do meio', () => {
    const comBainha = criarBainha(molde(), na(0, 0, 0), na(1, 200, 0), { ...SIMPLES, dobras: 2 }, ids());
    esperarPontos(comBainha.contorno, [
      ponto(0, 0),
      ponto(0, -30),
      ponto(0, -60),
      ponto(200, -60),
      ponto(200, -30),
      ponto(200, 0),
      ponto(200, 300),
      ponto(0, 300),
    ]);
    expect(area(comBainha.contorno)).toBeCloseTo(72000, 6);
    expect(comBainha.linhasInternas).toHaveLength(2);
    esperarPontos(comBainha.linhasInternas[1]!, [ponto(0, -30), ponto(200, -30)]);
  });

  it('as laterais da bainha copiam, espelhadas, as costuras vizinhas', () => {
    // No trapézio as laterais entram 50 mm em 300 de altura: em 30 mm de bainha, 5 mm de cada lado.
    const comBainha = criarBainha(molde({ contorno: TRAPEZIO }), na(0, 0, 0), na(1, 200, 0), SIMPLES, ids());
    esperarPontos(comBainha.contorno.slice(0, 4), [ponto(0, 0), ponto(5, -30), ponto(195, -30), ponto(200, 0)]);
    // Trapézio de bases 200 e 190 e altura 30.
    expect(area(comBainha.contorno) - area(TRAPEZIO)).toBeCloseTo(5850, 6);
  });

  it('com duas dobras, as laterais vão em ziguezague: a segunda dobra volta à largura da barra', () => {
    const comBainha = criarBainha(molde({ contorno: TRAPEZIO }), na(0, 0, 0), na(1, 200, 0), { ...SIMPLES, dobras: 2 }, ids());
    esperarPontos(comBainha.contorno.slice(0, 6), [
      ponto(0, 0),
      ponto(5, -30),
      ponto(0, -60),
      ponto(200, -60),
      ponto(195, -30),
      ponto(200, 0),
    ]);
    expect(area(comBainha.contorno) - area(TRAPEZIO)).toBeCloseTo(11700, 6);
  });

  it('com Largura 2, a bainha muda de largura por igual de uma ponta à outra', () => {
    const comBainha = criarBainha(molde(), na(0, 0, 0), na(1, 200, 0), { ...SIMPLES, largura2Mm: 60 }, ids());
    esperarPontos(comBainha.contorno.slice(0, 4), [ponto(0, 0), ponto(0, -30), ponto(200, -60), ponto(200, 0)]);
    // Trapézio de alturas 30 e 60 sobre 200 mm.
    expect(area(comBainha.contorno)).toBeCloseTo(60000 + 9000, 6);
  });

  it('a largura 1 é a do primeiro ponto clicado, também quando ele é o de numeração maior', () => {
    const comBainha = criarBainha(molde(), na(1, 200, 0), na(0, 0, 0), { ...SIMPLES, largura2Mm: 60 }, ids());
    esperarPontos(comBainha.contorno.slice(0, 4), [ponto(0, 0), ponto(0, -60), ponto(200, -30), ponto(200, 0)]);
  });

  it('no meio de uma aresta, as laterais saem em esquadro', () => {
    const comBainha = criarBainha(molde(), na(0, 50, 0), na(0, 150, 0), SIMPLES, ids());
    esperarPontos(comBainha.contorno, [
      ponto(0, 0),
      ponto(50, 0),
      ponto(50, -30),
      ponto(150, -30),
      ponto(150, 0),
      ponto(200, 0),
      ponto(200, 300),
      ponto(0, 300),
    ]);
    expect(area(comBainha.contorno)).toBeCloseTo(63000, 6);
  });

  it('o trecho que vira um canto ganha a esquadria no canto', () => {
    // De (100, 0), pelo canto (200, 0), até (200, 100).
    const comBainha = criarBainha(molde(), na(0, 100, 0), na(1, 200, 100), SIMPLES, ids());
    esperarPontos(comBainha.contorno, [
      ponto(0, 0),
      ponto(100, 0),
      ponto(100, -30),
      ponto(230, -30),
      ponto(230, 100),
      ponto(200, 100),
      ponto(200, 300),
      ponto(0, 300),
    ]);
    // 100 × 30 + 30 × 30 + 100 × 30.
    expect(area(comBainha.contorno)).toBeCloseTo(66900, 6);
    // A linha de dobra é o trecho original, com o canto.
    expect(comBainha.linhasInternas).toEqual([[ponto(100, 0), ponto(200, 0), ponto(200, 100)]]);
  });

  it('funciona numa peça desenhada no sentido horário', () => {
    const horaria = molde({ contorno: [ponto(0, 0), ponto(0, 300), ponto(200, 300), ponto(200, 0)] });
    const comBainha = criarBainha(horaria, na(3, 200, 0), na(0, 0, 0), SIMPLES, ids());
    expect(area(comBainha.contorno)).toBeCloseTo(66000, 6);
    expect(Math.min(...comBainha.contorno.map((p) => p.y))).toBeCloseTo(-30, 6);
  });

  it('com piques, cada ponta de cada linha de dobra ganha um', () => {
    const umaDobra = criarBainha(molde(), na(0, 0, 0), na(1, 200, 0), { ...SIMPLES, piques: true }, ids());
    expect(umaDobra.piques.map((p) => p.posicao)).toEqual([ponto(0, 0), ponto(200, 0)]);
    const duasDobras = criarBainha(molde(), na(0, 0, 0), na(1, 200, 0), { ...SIMPLES, dobras: 2, piques: true }, ids());
    esperarPontos(
      duasDobras.piques.map((p) => p.posicao),
      [ponto(0, 0), ponto(200, 0), ponto(0, -30), ponto(200, -30)],
    );
    expect(new Set(duasDobras.piques.map((p) => p.id)).size).toBe(4);
  });

  it('sem piques, não cria nenhum; os piques que estavam no trecho saem e os outros ficam', () => {
    const original = adicionarPique(adicionarPique(molde(), ponto(100, 0), 'na-barra'), ponto(0, 150), 'lateral');
    const comBainha = criarBainha(original, na(0, 0, 0), na(1, 200, 0), SIMPLES, ids());
    expect(comBainha.piques.map((p) => p.id)).toEqual(['lateral']);
    // (0, 300)→(0, 0) passou de aresta 3 a aresta 5.
    expect(comBainha.piques[0]).toMatchObject({ posicao: ponto(0, 150), indiceAresta: 5 });
  });

  it('o resto da peça não muda', () => {
    const original = molde();
    const comBainha = criarBainha(original, na(0, 0, 0), na(1, 200, 0), SIMPLES, ids());
    expect(comBainha.linhaDeFio).toEqual(original.linhaDeFio);
    expect(comBainha.id).toBe('m1');
    expect(original.contorno).toEqual(RETANGULO);
  });

  it('recusa número de dobras que não seja inteiro de 1 ao máximo', () => {
    for (const dobras of [0, -1, 1.5, MAXIMO_DE_DOBRAS_DA_BAINHA + 1, Number.NaN]) {
      expect(() => criarBainha(molde(), na(0, 0, 0), na(1, 200, 0), { ...SIMPLES, dobras }, ids())).toThrow(/número de dobras/);
    }
  });

  it('recusa largura zero, negativa ou que não é número', () => {
    for (const larguraMm of [0, -5, Number.NaN, Infinity]) {
      expect(() => criarBainha(molde(), na(0, 0, 0), na(1, 200, 0), { ...SIMPLES, larguraMm }, ids())).toThrow(/largura/);
    }
    expect(() => criarBainha(molde(), na(0, 0, 0), na(1, 200, 0), { ...SIMPLES, largura2Mm: 0 }, ids())).toThrow(/largura/);
  });

  it('recusa dois pontos iguais', () => {
    expect(() => criarBainha(molde(), na(0, 50, 0), na(0, 50, 0), SIMPLES, ids())).toThrow(/dois pontos diferentes/);
  });

  it('recusa a bainha larga demais para o trecho, quando as laterais se cruzariam', () => {
    // Triângulo de base 40 e altura 40: as laterais entram 0,5 mm por mm; com 60 mm de bainha, 30 de cada lado.
    const triangulo = molde({ contorno: [ponto(0, 0), ponto(40, 0), ponto(20, 40)], linhaDeFio: { inicio: ponto(20, 5), fim: ponto(20, 25) } });
    expect(() => criarBainha(triangulo, na(0, 0, 0), na(1, 40, 0), { ...SIMPLES, larguraMm: 60 }, ids())).toThrow(/não cabe/);
  });
});

describe('geometriaDaBainha', () => {
  it('dá o que entra no contorno e as linhas de dobra, sem mexer na peça', () => {
    const geometria = geometriaDaBainha(molde(), na(0, 0, 0), na(1, 200, 0), { ...SIMPLES, dobras: 3 });
    esperarPontos(geometria.miolo, [ponto(0, -30), ponto(0, -60), ponto(0, -90), ponto(200, -90), ponto(200, -60), ponto(200, -30)]);
    expect(geometria.linhasDeDobra).toHaveLength(3);
    expect(geometria.de.ponto).toEqual(ponto(0, 0));
    expect(geometria.ate.ponto).toEqual(ponto(200, 0));
  });
});

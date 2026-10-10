import { describe, it, expect } from 'vitest';
import {
  arcoDaAresta,
  arcosDoContorno,
  arcoTangente,
  concordanciaNoCanto,
  direcaoDoContornoEm,
  ladosDoCanto,
  linhaDoArcoTangente,
} from './arcos';
import { arcoPorTresPontos, circulo } from './curvas';
import { arredondarCantoDoContorno, distancia, ponto, substituirTrechoDoContorno, type Ponto2D } from './geometria';

const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];

/** Retângulo de 200 × 300 com o lado de cima trocado por um arco que passa por (100, 340): centro (100, 195), raio 145. */
function comArcoEmCima(): Ponto2D[] {
  const arco = arcoPorTresPontos(ponto(200, 300), ponto(100, 340), ponto(0, 300));
  return [ponto(0, 0), ponto(200, 0), ...arco];
}

/** Uma "lente": dois arcos de raio 145 que se encontram em (0, 0) e em (200, 0). O de baixo vem primeiro. */
function lente(): { contorno: Ponto2D[]; canto: number } {
  const deBaixo = arcoPorTresPontos(ponto(0, 0), ponto(100, -40), ponto(200, 0));
  const deCima = arcoPorTresPontos(ponto(200, 0), ponto(100, 40), ponto(0, 0));
  return { contorno: [...deBaixo, ...deCima.slice(1, -1)], canto: deBaixo.length - 1 };
}

describe('arcosDoContorno', () => {
  it('um retângulo não tem arcos (mesmo com os quatro cantos num círculo)', () => {
    expect(arcosDoContorno(RETANGULO)).toEqual([]);
  });

  it('um polígono de poucos lados não é um círculo; um círculo desenhado é', () => {
    const poligono = (lados: number): Ponto2D[] =>
      Array.from({ length: lados }, (_, i) => ponto(100 * Math.cos((2 * Math.PI * i) / lados), 100 * Math.sin((2 * Math.PI * i) / lados)));
    expect(arcosDoContorno(poligono(8))).toEqual([]);
    const [inteiro] = arcosDoContorno(circulo(ponto(50, 70), ponto(150, 70)));
    expect(inteiro).toMatchObject({ completo: true });
    expect(inteiro!.raio).toBeCloseTo(100, 6);
    expect(distancia(inteiro!.centro, ponto(50, 70))).toBeLessThan(1e-6);
  });

  it('reconhece o canto arredondado: centro e raio do arco', () => {
    const arredondado = arredondarCantoDoContorno(RETANGULO, 1, 50);
    const arcos = arcosDoContorno(arredondado);
    expect(arcos).toHaveLength(1);
    expect(arcos[0]!.raio).toBeCloseTo(50, 6);
    expect(distancia(arcos[0]!.centro, ponto(150, 50))).toBeLessThan(1e-6);
    // Vai do toque na aresta de baixo, (150, 0), ao toque na lateral, (200, 50).
    expect(distancia(arredondado[arcos[0]!.inicio]!, ponto(150, 0))).toBeLessThan(1e-6);
    expect(distancia(arredondado[arcos[0]!.fim]!, ponto(200, 50))).toBeLessThan(1e-6);
    expect(arcos[0]!.completo).toBe(false);
  });

  it('reconhece um arco feito por três pontos', () => {
    const [arco] = arcosDoContorno(comArcoEmCima());
    expect(arco!.raio).toBeCloseTo(145, 6);
    expect(distancia(arco!.centro, ponto(100, 195))).toBeLessThan(1e-6);
    expect(comArcoEmCima()[arco!.inicio]).toEqual(ponto(200, 300));
    expect(comArcoEmCima()[arco!.fim]).toEqual(ponto(0, 300));
  });

  it('dois arcos seguidos, de círculos diferentes, são dois arcos — também quando um deles dá a volta na numeração', () => {
    const { contorno, canto } = lente();
    const arcos = arcosDoContorno(contorno);
    expect(arcos).toHaveLength(2);
    expect(arcos.map((a) => [a.inicio, a.fim])).toEqual([
      [0, canto],
      [canto, 0],
    ]);
    expect(distancia(arcos[0]!.centro, ponto(100, 105))).toBeLessThan(1e-6);
    expect(distancia(arcos[1]!.centro, ponto(100, -105))).toBeLessThan(1e-6);
  });

  it('diz de que arco é cada aresta, ou que ela é uma reta', () => {
    const contorno = comArcoEmCima();
    expect(arcoDaAresta(contorno, 0)).toBeNull();
    expect(arcoDaAresta(contorno, 1)).toBeNull();
    expect(arcoDaAresta(contorno, 2)!.raio).toBeCloseTo(145, 6);
    expect(arcoDaAresta(contorno, contorno.length - 2)!.raio).toBeCloseTo(145, 6);
    // A última aresta volta de (0, 300) a (0, 0): reta.
    expect(arcoDaAresta(contorno, contorno.length - 1)).toBeNull();
  });
});

describe('direcaoDoContornoEm', () => {
  it('numa reta, é a direção da aresta', () => {
    expect(direcaoDoContornoEm(RETANGULO, { indiceAresta: 0, ponto: ponto(100, 0) }, 'antes')).toEqual(ponto(1, 0));
    // No canto (200, 0): chega pela aresta de baixo e sai pela lateral.
    expect(direcaoDoContornoEm(RETANGULO, { indiceAresta: 1, ponto: ponto(200, 0) }, 'antes')).toEqual(ponto(1, 0));
    expect(direcaoDoContornoEm(RETANGULO, { indiceAresta: 1, ponto: ponto(200, 0) }, 'depois')).toEqual(ponto(0, 1));
  });

  it('num arco, é a tangente exata ao círculo, e não a do pequeno trecho amostrado', () => {
    const contorno = comArcoEmCima();
    // Saindo de (200, 300) pelo arco: o raio é (100, 105) / 145, e a tangente é a perpendicular, para cima e para a esquerda.
    const tangente = direcaoDoContornoEm(contorno, { indiceAresta: 2, ponto: ponto(200, 300) }, 'depois');
    expect(tangente.x).toBeCloseTo(-105 / 145, 9);
    expect(tangente.y).toBeCloseTo(100 / 145, 9);
    // Chegando ao mesmo ponto, vem-se pela lateral reta.
    expect(direcaoDoContornoEm(contorno, { indiceAresta: 2, ponto: ponto(200, 300) }, 'antes')).toEqual(ponto(0, 1));
  });
});

describe('arcoTangente', () => {
  const noCirculo = (pontos: readonly Ponto2D[], centro: Ponto2D, raio: number): number =>
    Math.max(...pontos.map((p) => Math.abs(distancia(p, centro) - raio)));

  it('sai na direção dada e chega ao fim: um quarto de círculo', () => {
    const arco = arcoTangente(ponto(0, 0), ponto(1, 0), ponto(100, 100));
    expect(arco[0]).toEqual(ponto(0, 0));
    expect(arco.at(-1)).toEqual(ponto(100, 100));
    expect(noCirculo(arco, ponto(0, 100), 100)).toBeLessThan(1e-9);
    // O primeiro passo ainda vai quase na direção de saída.
    expect(arco[1]!.x).toBeGreaterThan(0);
    expect(Math.abs(arco[1]!.y)).toBeLessThan(arco[1]!.x);
  });

  it('vira para o lado em que o fim está', () => {
    const paraBaixo = arcoTangente(ponto(0, 0), ponto(1, 0), ponto(100, -100));
    expect(noCirculo(paraBaixo, ponto(0, -100), 100)).toBeLessThan(1e-9);
    expect(paraBaixo.every((p) => p.y <= 1e-9)).toBe(true);
  });

  it('com o fim para trás, dá mais de meia volta', () => {
    const arco = arcoTangente(ponto(0, 0), ponto(1, 0), ponto(-100, 100));
    expect(noCirculo(arco, ponto(0, 100), 100)).toBeLessThan(1e-9);
    // Passa pelo ponto mais à direita do círculo, (100, 100), e pelo de cima, (0, 200).
    expect(Math.max(...arco.map((p) => p.x))).toBeCloseTo(100, 0);
    expect(Math.max(...arco.map((p) => p.y))).toBeCloseTo(200, 0);
  });

  it('com o fim bem em frente, é uma reta; para trás, na mesma reta, não existe', () => {
    expect(arcoTangente(ponto(0, 0), ponto(1, 0), ponto(200, 0))).toEqual([ponto(0, 0), ponto(200, 0)]);
    expect(() => arcoTangente(ponto(0, 0), ponto(1, 0), ponto(-200, 0))).toThrow(/para trás do começo/);
    expect(() => arcoTangente(ponto(0, 0), ponto(1, 0), ponto(0, 0))).toThrow(/dois pontos diferentes/);
  });
});

describe('linhaDoArcoTangente', () => {
  it('dá continuidade à reta que fica do outro lado do começo', () => {
    // De (200, 150), na lateral direita, até (100, 300), em cima: o arco continua a lateral, que sobe.
    const inicio = { indiceAresta: 1, ponto: ponto(200, 150) };
    const fim = { indiceAresta: 2, ponto: ponto(100, 300) };
    const arco = linhaDoArcoTangente(RETANGULO, inicio, fim);
    expect(arco[0]).toEqual(ponto(200, 150));
    expect(arco.at(-1)).toEqual(ponto(100, 300));
    // Tangente a x = 200 em (200, 150): o centro está na horizontal desse ponto.
    const centroX = arco.length > 2 ? 200 - (100 * 100 + 150 * 150) / (2 * 100) : 0;
    expect(Math.max(...arco.map((p) => Math.abs(distancia(p, ponto(centroX, 150)) - (200 - centroX))))).toBeLessThan(1e-9);
  });

  it('com os pontos na ordem contrária à numeração, continua o elemento do outro lado', () => {
    // De (100, 300) para (200, 150): o trecho trocado anda contra a numeração; fica a aresta de cima, que vem da esquerda.
    const inicio = { indiceAresta: 2, ponto: ponto(100, 300) };
    const fim = { indiceAresta: 1, ponto: ponto(200, 150) };
    const arco = linhaDoArcoTangente(RETANGULO, inicio, fim);
    // Sai para a direita (+x), tangente a y = 300.
    expect(arco[1]!.x).toBeGreaterThan(100);
    expect(Math.abs(arco[1]!.y - 300)).toBeLessThan(arco[1]!.x - 100);
  });

  it('dá continuidade a um arco: a tangente é a do círculo', () => {
    const contorno = comArcoEmCima();
    // Começa no fim do arco de cima, (0, 300), e termina na lateral esquerda, em (0, 100).
    const inicio = { indiceAresta: contorno.length - 1, ponto: ponto(0, 300) };
    const fim = { indiceAresta: contorno.length - 1, ponto: ponto(0, 100) };
    const arco = linhaDoArcoTangente(contorno, inicio, fim);
    // O arco de cima chega em (0, 300) descendo para a esquerda: (−105, −100) / 145.
    const saida = { x: arco[1]!.x - arco[0]!.x, y: arco[1]!.y - arco[0]!.y };
    expect(saida.x).toBeLessThan(0);
    expect(saida.y).toBeLessThan(0);
  });
});

describe('concordanciaNoCanto', () => {
  it('entre duas retas: o arco toca cada aresta a um raio do canto', () => {
    const c = concordanciaNoCanto(RETANGULO, 1, 50);
    expect(c.lados).toEqual(['reta', 'reta']);
    expect(distancia(c.de.ponto, ponto(150, 0))).toBeLessThan(1e-9);
    expect(distancia(c.ate.ponto, ponto(200, 50))).toBeLessThan(1e-9);
    expect(distancia(c.centro, ponto(150, 50))).toBeLessThan(1e-9);
    expect(c.miolo.every((p) => Math.abs(distancia(p, ponto(150, 50)) - 50) < 1e-9)).toBe(true);
  });

  it('entre uma reta e um arco', () => {
    // Canto (200, 300): a lateral x = 200 encontra o arco de centro (100, 195) e raio 145.
    const contorno = comArcoEmCima();
    expect(ladosDoCanto(contorno, 2)).toEqual(['reta', 'arco']);
    const c = concordanciaNoCanto(contorno, 2, 20);
    // O centro fica a 20 da reta (x = 180) e a 125 do centro do arco.
    const y = 195 + Math.sqrt(125 * 125 - 80 * 80);
    expect(distancia(c.centro, ponto(180, y))).toBeLessThan(1e-6);
    expect(distancia(c.de.ponto, ponto(200, y))).toBeLessThan(1e-6);
    expect(distancia(c.ate.ponto, ponto(100 + (80 * 145) / 125, 195 + ((y - 195) * 145) / 125))).toBeLessThan(1e-6);
    // O toque no arco está sobre o círculo dele.
    expect(distancia(c.ate.ponto, ponto(100, 195))).toBeCloseTo(145, 6);
  });

  it('entre dois arcos', () => {
    const { contorno, canto } = lente();
    expect(ladosDoCanto(contorno, canto)).toEqual(['arco', 'arco']);
    const c = concordanciaNoCanto(contorno, canto, 10);
    // O centro fica a 135 dos dois centros, (100, 105) e (100, −105): sobre y = 0.
    const x = 100 + Math.sqrt(135 * 135 - 105 * 105);
    expect(distancia(c.centro, ponto(x, 0))).toBeLessThan(1e-6);
    expect(distancia(c.de.ponto, ponto(100 + ((x - 100) * 145) / 135, 105 - (105 * 145) / 135))).toBeLessThan(1e-6);
    expect(distancia(c.ate.ponto, ponto(100 + ((x - 100) * 145) / 135, -105 + (105 * 145) / 135))).toBeLessThan(1e-6);
  });

  it('posto no contorno, o arco fica reconhecível, com o raio pedido', () => {
    const contorno = comArcoEmCima();
    const c = concordanciaNoCanto(contorno, 2, 20);
    const novo = substituirTrechoDoContorno(contorno, c.de, c.ate, c.miolo);
    const raios = arcosDoContorno(novo).map((a) => Math.round(a.raio * 1000) / 1000);
    expect(raios).toContain(20);
    expect(raios).toContain(145);
    // O canto vivo saiu.
    expect(novo.some((p) => distancia(p, ponto(200, 300)) < 1e-6)).toBe(false);
  });

  it('recusa o raio que não cabe, o raio que não é maior que zero e o ponto no meio de um arco', () => {
    expect(() => concordanciaNoCanto(comArcoEmCima(), 2, 500)).toThrow(/não cabe/);
    expect(() => concordanciaNoCanto(RETANGULO, 1, 0)).toThrow(/maior que zero/);
    expect(() => concordanciaNoCanto(RETANGULO, 9, 10)).toThrow(/fora do contorno/);
    expect(() => concordanciaNoCanto(comArcoEmCima(), 5, 10)).toThrow(/no meio de um arco/);
  });
});

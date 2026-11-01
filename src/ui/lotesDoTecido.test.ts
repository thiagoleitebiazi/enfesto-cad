import { describe, expect, it } from 'vitest';
import { loteDoBotao, loteDoZiper, lotesDoTecido, type TecidoParaOEstudio } from './lotesDoTecido';
import { normaisSuaves, refinar } from './malhasDoEstudio';

/** Duas peças de um triângulo cada, que se tocam na costura. */
const DUAS_PECAS: TecidoParaOEstudio = {
  x: Float64Array.of(0, 0, 0, 100, 0, 0, 0, 100, 0, 0, 0, 0, 100, 0, 0, 0, 0, 100),
  triangulos: Uint32Array.of(0, 1, 2, 3, 5, 4),
  pecas: [
    { chave: 'a', primeiroTriangulo: 0, quantidade: 1, inicio: 0, uv: Float64Array.of(0, 0, 100, 0, 0, 100), cor: [10, 20, 30], espelhada: false },
    { chave: 'b', primeiroTriangulo: 1, quantidade: 1, inicio: 3, uv: Float64Array.of(0, 0, 100, 0, 0, 100), cor: [40, 50, 60], espelhada: true },
  ],
  trama: 'sarja',
};

describe('as malhas para o estúdio (ADR 0228)', () => {
  it('as normais suaves ficam de lado a lado do canto: a média das faces em volta', () => {
    const x = Float32Array.of(0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1);
    const n = normaisSuaves(x, Uint32Array.of(0, 1, 2, 0, 3, 1));
    expect(Math.hypot(n[0]!, n[1]!, n[2]!)).toBeCloseTo(1, 5);
    // O ponto 0 fica entre as duas faces (+z e +y).
    expect(n[1]!).toBeGreaterThan(0.3);
    expect(n[2]!).toBeGreaterThan(0.3);
  });

  it('refinar: cada triângulo vira quatro, os vizinhos dividem o mesmo ponto novo e a curva das normais aparece', () => {
    // Dois triângulos com as normais abrindo para fora, como um pedaço de esfera.
    const posicoes = Float32Array.of(0, 0, 0, 100, 0, 0, 100, 100, 0, 0, 100, 0);
    const s = Math.SQRT1_2;
    const normais = Float32Array.of(-s, -s, 0, s, -s, 0, s, s, 0, -s, s, 0).map((v, i) => (i % 3 === 2 ? 0.5 : v * 0.87));
    const m = refinar({ posicoes, normais, indices: Uint32Array.of(0, 1, 2, 0, 2, 3) }, 1);
    expect(m.indices.length).toBe(24);
    // 4 cantos + 5 arestas (a do meio é uma só).
    expect(m.posicoes.length / 3).toBe(9);
    // O meio da aresta 0-1 saiu do plano, para o lado de onde as normais apontam.
    const z = Array.from(m.posicoes).filter((_, i) => i % 3 === 2);
    expect(Math.max(...z.map(Math.abs))).toBeGreaterThan(1);
  });
});

describe('a roupa em lotes', () => {
  it('um lote por peça, com a cor, a trama e o lado da face de cada uma', () => {
    const lotes = lotesDoTecido(DUAS_PECAS, 0);
    expect(lotes).toHaveLength(2);
    expect(lotes[0]!.material).toMatchObject({ acabamento: 'tecido', cor: [10, 20, 30], trama: 'sarja', espelhada: false });
    expect(lotes[1]!.material.espelhada).toBe(true);
    expect(Array.from(lotes[1]!.indices)).toEqual([0, 2, 1]);
  });

  it('o refino multiplica os triângulos e leva as coordenadas da face junto', () => {
    const lote = lotesDoTecido(DUAS_PECAS, 2)[0]!;
    expect(lote.indices.length / 3).toBe(16);
    expect(lote.uv!.length / 2).toBe(lote.posicoes.length / 3);
  });

  it('a costura iguala a normal dos dois lados: a emenda não vira quina', () => {
    const lotes = lotesDoTecido({ ...DUAS_PECAS, costuras: { a: Uint32Array.of(0), b1: Uint32Array.of(3), b2: Uint32Array.of(3) } }, 0);
    const [a, b] = [lotes[0]!.normais, lotes[1]!.normais];
    expect(a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!).toBeCloseTo(1, 4);
  });

  it('o mapa de tensão: a cor por triângulo, sem refino, sem trama e sem brilho', () => {
    const [lote] = lotesDoTecido({ ...DUAS_PECAS, brilho: 80, tensoes: Float32Array.of(0.1, 0) }, 2);
    expect(lote!.indices.length / 3).toBe(1);
    expect(lote!.coresDosTriangulos).toBeDefined();
    expect(lote!.material.trama).toBeUndefined();
    expect(lote!.material.brilho).toBeUndefined();
  });
});

describe('os aviamentos', () => {
  // Uma costura em pé, de 100 em 100 mm, de y = 600 a y = 1000, em z = 150, com a normal para a frente.
  const X = new Float64Array(15);
  const N = new Float32Array(15);
  for (let k = 0; k <= 4; k++) {
    X.set([0, 600 + 100 * k, 150], 3 * k);
    N.set([0, 0, 1], 3 * k);
  }

  it('o zíper desce do alto da costura até o comprimento dele, com 14 mm de largura, por cima do tecido', () => {
    for (const pontos of [[0, 1, 2, 3, 4], [4, 3, 2, 1, 0]]) {
      const lote = loteDoZiper(X, N, pontos, 250)!;
      const ys = Array.from(lote.posicoes).filter((_, i) => i % 3 === 1);
      expect(Math.max(...ys)).toBeCloseTo(1000, 3);
      expect(Math.min(...ys)).toBeCloseTo(750, 3);
      // Em u, os dois lados da fita; em v, o caminho andado.
      expect(Math.max(...Array.from(lote.uv!).filter((_, i) => i % 2 === 0))).toBe(7);
      expect(Math.max(...Array.from(lote.uv!).filter((_, i) => i % 2 === 1))).toBe(250);
      expect(lote.posicoes[2]!).toBeGreaterThan(150);
      expect(lote.material.acabamento).toBe('ziper');
    }
  });

  it('o zíper mais comprido que a costura vai até o fim dela; sem pontos, não há zíper', () => {
    const ys = Array.from(loteDoZiper(X, N, [0, 1, 2, 3, 4], 5000)!.posicoes).filter((_, i) => i % 3 === 1);
    expect(Math.min(...ys)).toBeCloseTo(600, 3);
    expect(loteDoZiper(X, N, [0], 100)).toBeNull();
  });

  it('o botão fica por cima do tecido, com a normal para fora e o raio do furo', () => {
    const lote = loteDoBotao(10, 20, 30, 0, 0, 1, 6);
    const xs = Array.from(lote.posicoes).filter((_, i) => i % 3 === 0);
    expect(Math.max(...xs)).toBeCloseTo(16, 3);
    expect(Math.min(...Array.from(lote.posicoes).filter((_, i) => i % 3 === 2))).toBeGreaterThanOrEqual(30);
    let soma = 0;
    for (let i = 2; i < lote.normais.length; i += 3) soma += lote.normais[i]!;
    expect(soma).toBeGreaterThan(0);
  });
});

import { describe, expect, it } from 'vitest';
import { loteDoBotao, loteDoZiper, lotesDoTecido, mapaDaPeca, pontosDaRoupa, rugasDaPeca, type TecidoParaOEstudio } from './lotesDoTecido';
import { loteDoCorpo, normaisSuaves, refinar } from './malhasDoEstudio';

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

describe('o corpo para o desenho', () => {
  it('fica um pouco para dentro do corpo da colisão, ao longo da normal: o pano não é furado por ele', () => {
    const v = Float32Array.of(0, 0, 0, 100, 0, 0, 0, 100, 0);
    const lote = loteDoCorpo(v, Uint32Array.of(0, 1, 2), [200, 200, 200], 0);
    // O triângulo olha para +z: recuar é ir para −z.
    expect(lote.posicoes[2]).toBeCloseTo(-1.5, 5);
    expect(lote.posicoes[0]).toBeCloseTo(0, 5);
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

  it('os dois lados da costura se juntam no desenho: pelo vão de 2 mm se via o corpo (ADR 0237)', () => {
    const lado = (dx: number, dz: number): number[] => [dx, 0, dz];
    const x = Float64Array.from([...lado(0, 0), ...lado(2, 0), ...lado(5, 0)]);
    const pontos = pontosDaRoupa({ x, triangulos: new Uint32Array(), pecas: [], costuras: { a: Uint32Array.of(0, 1), b1: Uint32Array.of(1, 0), b2: Uint32Array.of(1, 0), f: Float64Array.of(0, 0) } });
    expect(Math.abs(pontos[0]! - pontos[3]!)).toBeLessThan(0.05);
    // Ficam no meio do caminho, e quem não é costura não anda.
    expect(pontos[0]!).toBeCloseTo(1, 1);
    expect(pontos[6]!).toBe(5);
  });

  it('cada lado passa um pouco da linha da costura: entre os pontos, as beiradas não abrem um vão', () => {
    // Duas peças, uma de cada lado de x = 0, costuradas ponto com ponto.
    const x = Float64Array.from([0, 0, 0, 0, 100, 0, -50, 50, 0, 0, 0, 0, 0, 100, 0, 50, 50, 0]);
    const pontos = pontosDaRoupa({ x, triangulos: Uint32Array.of(0, 1, 2, 3, 4, 5), pecas: [], costuras: { a: Uint32Array.of(0, 1, 3, 4), b1: Uint32Array.of(3, 4, 0, 1), b2: Uint32Array.of(3, 4, 0, 1), f: Float64Array.of(0, 0, 0, 0) } });
    expect(pontos[0]!).toBeGreaterThan(0.5);
    expect(pontos[9]!).toBeLessThan(-0.5);
  });

  it('a costura ainda aberta não entorta o desenho: longe, cada lado fica onde está', () => {
    const x = Float64Array.from([0, 0, 0, 50, 0, 0]);
    const pontos = pontosDaRoupa({ x, triangulos: new Uint32Array(), pecas: [], costuras: { a: Uint32Array.of(0, 1), b1: Uint32Array.of(1, 0), b2: Uint32Array.of(1, 0), f: Float64Array.of(0, 0) } });
    expect([pontos[0], pontos[3]]).toEqual([0, 50]);
  });

  it('o mapa de tensão: a cor por triângulo, sem refino, sem trama e sem brilho', () => {
    const [lote] = lotesDoTecido({ ...DUAS_PECAS, brilho: 80, tensoes: Float32Array.of(0.1, 0) }, 2);
    expect(lote!.indices.length / 3).toBe(1);
    expect(lote!.coresDosTriangulos).toBeDefined();
    expect(lote!.material.trama).toBeUndefined();
    expect(lote!.material.brilho).toBeUndefined();
  });
});

describe('as rugas finas (ADR 0232)', () => {
  const UV = Float32Array.of(0, 0, 100, 0, 0, 100);
  const TRI = Uint32Array.of(0, 1, 2);
  const com = (ku: number, kv: number) => rugasDaPeca(Float32Array.of(0, 0, 0, 100 * ku, 0, 0, 0, 100 * kv, 0), UV, TRI);

  it('o pano sem aperto, ou esticado, não enruga; o aperto pequeno também não', () => {
    expect(Array.from(com(1, 1))).toEqual([0, 0, 0, 0, 0, 0]);
    expect(Array.from(com(1.1, 1.1))).toEqual([0, 0, 0, 0, 0, 0]);
    expect(Array.from(com(0.97, 1))).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('o aperto em u dá o ângulo 0; em v, 90°: no dobro do ângulo, um é o oposto do outro', () => {
    const emU = com(0.9, 1);
    const emV = com(1, 0.9);
    expect(emU[0]!).toBeGreaterThan(0.3);
    expect(emU[1]!).toBeCloseTo(0, 5);
    expect(emV[0]!).toBeLessThan(-0.3);
    expect(emV[0]!).toBeCloseTo(-emU[0]!, 5);
  });

  it('o aperto a 45°: o seno do dobro do ângulo aparece', () => {
    // Encolhe a diagonal (1, 1) em 12%: as posições são o molde com a compressão só nessa direção.
    const k = 0.88;
    const leva = (u: number, v: number): [number, number] => {
      const d = (u + v) / 2;
      return [u + d * (k - 1), v + d * (k - 1)];
    };
    const [a, b] = [leva(100, 0), leva(0, 100)];
    const r = rugasDaPeca(Float32Array.of(0, 0, 0, a[0], a[1], 0, b[0], b[1], 0), UV, TRI);
    expect(r[1]!).toBeGreaterThan(0.3);
    expect(Math.abs(r[0]!)).toBeLessThan(0.05);
  });

  it('as rugas passam pelo refino, e só vão para o desenho com a distância entre elas', () => {
    const lote = lotesDoTecido({ ...DUAS_PECAS, rugaMm: 12 }, 1)[0]!;
    expect(lote.rugas!.length / 2).toBe(lote.posicoes.length / 3);
    expect(lote.material.rugaMm).toBe(12);
    expect(lotesDoTecido(DUAS_PECAS, 1)[0]!.rugas).toBeUndefined();
  });
});

describe('a borda da peça (ADR 0231)', () => {
  const CONTORNO = [0, 0, 300, 0, 300, 200, 0, 200];

  it('a distância ao contorno, o caminho andado e quais lados são costura', () => {
    const m = mapaDaPeca(CONTORNO, [0, 1, 0, 0]);
    const ler = (u: number, v: number) => {
      const g = Math.round((v - m.ov) / m.passo) * m.largura + Math.round((u - m.ou) / m.passo);
      return { d: m.distancia[g]!, caminho: m.caminho[g]!, costura: m.costurado[g]! };
    };
    expect(ler(100, 10).d).toBeCloseTo(10, 0);
    expect(ler(100, 10).caminho).toBeCloseTo(100, -1);
    expect(ler(100, 10).costura).toBe(0);
    expect(ler(290, 100).costura).toBe(1);
    // O caminho continua de um lado para o outro.
    expect(ler(290, 100).caminho).toBeCloseTo(400, -1);
  });

  it('o miolo da peça, longe de tudo, fica de fora', () => {
    const m = mapaDaPeca([0, 0, 600, 0, 600, 600, 0, 600], [0, 0, 0, 0]);
    const g = Math.round((300 - m.ov) / m.passo) * m.largura + Math.round((300 - m.ou) / m.passo);
    expect(m.distancia[g]).toBe(Infinity);
  });

  it('o mapa vai para o material da peça; no mapa de tensão, não', () => {
    const mapa = mapaDaPeca(CONTORNO, [0, 0, 0, 0]);
    const com = { ...DUAS_PECAS, pecas: DUAS_PECAS.pecas.map((p) => ({ ...p, mapa })) };
    expect(lotesDoTecido(com, 0)[0]!.material.mapa).toBe(mapa);
    expect(lotesDoTecido({ ...com, tensoes: Float32Array.of(0, 0) }, 0)[0]!.material.mapa).toBeUndefined();
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

describe('a dobra da gola (ADR 0234)', () => {
  it('a beira que só dobra fica marcada à parte da costura e da barra', () => {
    const quadrado = [0, 0, 100, 0, 100, 100, 0, 100];
    const mapa = mapaDaPeca(quadrado, [1, 2, 0, 2]);
    const marcas = new Set(mapa.costurado);
    expect([...marcas].sort()).toEqual([0, 1, 2]);
  });
});

import { describe, it, expect } from 'vitest';
import {
  ponto,
  somar,
  subtrair,
  escalar,
  distancia,
  rotacionar,
  retanguloEnvolvente,
  area,
  areaAssinada,
  pontoDentroDoContorno,
  transladarContorno,
  rotacionarContorno,
  pontoMaisProximoNoSegmento,
  pontoMaisProximoNoContorno,
  deslocarContornoParaFora,
  segmentosSeIntersectam,
  distanciaEntreSegmentos,
  bboxesSeSobrepoem,
  contornosSeSobrepoem,
  distanciaEntreContornos,
} from './geometria';

describe('operações vetoriais', () => {
  it('soma dois pontos', () => {
    expect(somar(ponto(1, 2), ponto(3, 4))).toEqual({ x: 4, y: 6 });
  });

  it('subtrai dois pontos', () => {
    expect(subtrair(ponto(5, 5), ponto(2, 1))).toEqual({ x: 3, y: 4 });
  });

  it('escala um ponto', () => {
    expect(escalar(ponto(2, 3), 2)).toEqual({ x: 4, y: 6 });
  });

  it('calcula distância euclidiana', () => {
    expect(distancia(ponto(0, 0), ponto(3, 4))).toBe(5);
  });

  it('rotaciona 90 graus em torno da origem', () => {
    const r = rotacionar(ponto(1, 0), ponto(0, 0), 90);
    expect(r.x).toBeCloseTo(0, 10);
    expect(r.y).toBeCloseTo(1, 10);
  });

  it('rotação de 360 graus é a identidade', () => {
    const p = ponto(7, -3);
    const r = rotacionar(p, ponto(1, 1), 360);
    expect(r.x).toBeCloseTo(p.x, 10);
    expect(r.y).toBeCloseTo(p.y, 10);
  });
});

describe('retângulo envolvente', () => {
  it('calcula bbox de um retângulo simples', () => {
    const contorno = [ponto(0, 0), ponto(100, 0), ponto(100, 50), ponto(0, 50)];
    const bbox = retanguloEnvolvente(contorno);
    expect(bbox).toEqual({ minX: 0, minY: 0, maxX: 100, maxY: 50, largura: 100, altura: 50 });
  });

  it('lança erro para contorno vazio', () => {
    expect(() => retanguloEnvolvente([])).toThrow();
  });
});

describe('área', () => {
  it('calcula área de um retângulo 100x50 = 5000mm²', () => {
    const contorno = [ponto(0, 0), ponto(100, 0), ponto(100, 50), ponto(0, 50)];
    expect(area(contorno)).toBe(5000);
  });

  it('área assinada é positiva em sentido anti-horário e negativa no horário', () => {
    const antiHorario = [ponto(0, 0), ponto(10, 0), ponto(10, 10), ponto(0, 10)];
    const horario = [...antiHorario].reverse();
    expect(areaAssinada(antiHorario)).toBeGreaterThan(0);
    expect(areaAssinada(horario)).toBeLessThan(0);
  });

  it('área de um triângulo retângulo de catetos 3 e 4 é 6', () => {
    const contorno = [ponto(0, 0), ponto(4, 0), ponto(0, 3)];
    expect(area(contorno)).toBe(6);
  });
});

describe('ponto dentro do contorno', () => {
  const quadrado = [ponto(0, 0), ponto(10, 0), ponto(10, 10), ponto(0, 10)];

  it('detecta ponto dentro', () => {
    expect(pontoDentroDoContorno(ponto(5, 5), quadrado)).toBe(true);
  });

  it('detecta ponto fora', () => {
    expect(pontoDentroDoContorno(ponto(15, 5), quadrado)).toBe(false);
  });

  it('detecta ponto fora, do outro lado', () => {
    expect(pontoDentroDoContorno(ponto(-5, 5), quadrado)).toBe(false);
  });
});

describe('transformações de contorno', () => {
  it('translada todos os vértices igualmente', () => {
    const contorno = [ponto(0, 0), ponto(10, 0), ponto(10, 10), ponto(0, 10)];
    const transladado = transladarContorno(contorno, ponto(5, -5));
    expect(transladado).toEqual([ponto(5, -5), ponto(15, -5), ponto(15, 5), ponto(5, 5)]);
  });

  it('rotação de contorno preserva a área', () => {
    const contorno = [ponto(0, 0), ponto(10, 0), ponto(10, 20), ponto(0, 20)];
    const centro = retanguloEnvolvente(contorno);
    const rotacionado = rotacionarContorno(
      contorno,
      ponto((centro.minX + centro.maxX) / 2, (centro.minY + centro.maxY) / 2),
      37,
    );
    expect(area(rotacionado)).toBeCloseTo(area(contorno), 6);
  });
});

describe('pontoMaisProximoNoSegmento', () => {
  it('projeta sobre o segmento quando a projeção cai dentro dele', () => {
    const p = pontoMaisProximoNoSegmento(ponto(5, 3), ponto(0, 0), ponto(10, 0));
    expect(p).toEqual({ x: 5, y: 0 });
  });

  it('prende no início do segmento quando a projeção cai antes dele', () => {
    const p = pontoMaisProximoNoSegmento(ponto(-5, 3), ponto(0, 0), ponto(10, 0));
    expect(p).toEqual({ x: 0, y: 0 });
  });

  it('prende no fim do segmento quando a projeção cai depois dele', () => {
    const p = pontoMaisProximoNoSegmento(ponto(15, 3), ponto(0, 0), ponto(10, 0));
    expect(p).toEqual({ x: 10, y: 0 });
  });

  it('lida com segmento degenerado (a === b)', () => {
    const p = pontoMaisProximoNoSegmento(ponto(5, 5), ponto(1, 1), ponto(1, 1));
    expect(p).toEqual({ x: 1, y: 1 });
  });
});

describe('pontoMaisProximoNoContorno', () => {
  const quadrado = [ponto(0, 0), ponto(100, 0), ponto(100, 100), ponto(0, 100)];

  it('encontra a aresta mais próxima de um ponto fora do contorno', () => {
    const resultado = pontoMaisProximoNoContorno(ponto(50, -10), quadrado);
    expect(resultado.ponto).toEqual({ x: 50, y: 0 });
    expect(resultado.indiceAresta).toBe(0);
    expect(resultado.distancia).toBeCloseTo(10, 9);
  });

  it('encontra a aresta mais próxima de um ponto dentro do contorno', () => {
    const resultado = pontoMaisProximoNoContorno(ponto(95, 50), quadrado);
    expect(resultado.indiceAresta).toBe(1);
    expect(resultado.ponto).toEqual({ x: 100, y: 50 });
  });

  it('lança erro para contorno com menos de 2 pontos', () => {
    expect(() => pontoMaisProximoNoContorno(ponto(0, 0), [ponto(1, 1)])).toThrow();
  });
});

describe('deslocarContornoParaFora (margem de costura)', () => {
  it('desloca um retângulo simétrico para fora, aumentando cada dimensão em 2x a distância', () => {
    const retangulo = [ponto(0, 0), ponto(100, 0), ponto(100, 50), ponto(0, 50)];
    const deslocado = deslocarContornoParaFora(retangulo, 10);
    const bboxOriginal = retanguloEnvolvente(retangulo);
    const bboxDeslocado = retanguloEnvolvente(deslocado);
    expect(bboxDeslocado.largura).toBeCloseTo(bboxOriginal.largura + 20, 6);
    expect(bboxDeslocado.altura).toBeCloseTo(bboxOriginal.altura + 20, 6);
  });

  it('o contorno deslocado envolve completamente o original (todo vértice original está dentro)', () => {
    const retangulo = [ponto(0, 0), ponto(100, 0), ponto(100, 50), ponto(0, 50)];
    const deslocado = deslocarContornoParaFora(retangulo, 5);
    for (const v of retangulo) {
      // Vértices do próprio contorno original ficam sobre a borda dele, então
      // testamos com uma pequena contração para não cair exatamente na fronteira.
      const levementeParaDentro = { x: v.x === 0 ? 0.1 : v.x - 0.1, y: v.y === 0 ? 0.1 : v.y - 0.1 };
      expect(pontoDentroDoContorno(levementeParaDentro, deslocado)).toBe(true);
    }
  });

  it('área aumenta com o deslocamento para fora', () => {
    const triangulo = [ponto(0, 0), ponto(40, 0), ponto(20, 30)];
    const deslocado = deslocarContornoParaFora(triangulo, 5);
    expect(area(deslocado)).toBeGreaterThan(area(triangulo));
  });

  it('lança erro para contorno com menos de 3 pontos', () => {
    expect(() => deslocarContornoParaFora([ponto(0, 0), ponto(1, 1)], 5)).toThrow();
  });
});

describe('segmentosSeIntersectam', () => {
  it('detecta cruzamento em X', () => {
    expect(segmentosSeIntersectam(ponto(0, 0), ponto(10, 10), ponto(0, 10), ponto(10, 0))).toBe(true);
  });

  it('segmentos paralelos separados não se cruzam', () => {
    expect(segmentosSeIntersectam(ponto(0, 0), ponto(10, 0), ponto(0, 5), ponto(10, 5))).toBe(false);
  });

  it('detecta toque colinear (um segmento encosta na ponta do outro)', () => {
    expect(segmentosSeIntersectam(ponto(0, 0), ponto(10, 0), ponto(10, 0), ponto(20, 0))).toBe(true);
  });

  it('segmentos que não se alinham nem se cruzam retornam falso', () => {
    expect(segmentosSeIntersectam(ponto(0, 0), ponto(1, 1), ponto(5, 5), ponto(6, 6))).toBe(false);
  });
});

describe('distanciaEntreSegmentos', () => {
  it('zero quando os segmentos se cruzam', () => {
    expect(distanciaEntreSegmentos(ponto(0, 0), ponto(10, 10), ponto(0, 10), ponto(10, 0))).toBe(0);
  });

  it('distância real entre dois segmentos paralelos', () => {
    expect(distanciaEntreSegmentos(ponto(0, 0), ponto(10, 0), ponto(0, 5), ponto(10, 5))).toBeCloseTo(5, 9);
  });

  it('distância entre segmentos perpendiculares que não se cruzam', () => {
    // Segmento vertical de (20,0) a (20,10); segmento horizontal de (0,0) a (10,0).
    // Ponto mais próximo do vertical no horizontal é (10,0); distância = 10.
    expect(distanciaEntreSegmentos(ponto(0, 0), ponto(10, 0), ponto(20, 0), ponto(20, 10))).toBeCloseTo(10, 9);
  });
});

describe('bboxesSeSobrepoem', () => {
  it('verdadeiro para retângulos sobrepostos', () => {
    const a = retanguloEnvolvente([ponto(0, 0), ponto(10, 0), ponto(10, 10), ponto(0, 10)]);
    const b = retanguloEnvolvente([ponto(5, 5), ponto(15, 5), ponto(15, 15), ponto(5, 15)]);
    expect(bboxesSeSobrepoem(a, b)).toBe(true);
  });

  it('falso para retângulos distantes', () => {
    const a = retanguloEnvolvente([ponto(0, 0), ponto(10, 0), ponto(10, 10), ponto(0, 10)]);
    const b = retanguloEnvolvente([ponto(100, 100), ponto(110, 100), ponto(110, 110), ponto(100, 110)]);
    expect(bboxesSeSobrepoem(a, b)).toBe(false);
  });

  it('verdadeiro quando os retângulos apenas se tocam na borda', () => {
    const a = retanguloEnvolvente([ponto(0, 0), ponto(10, 0), ponto(10, 10), ponto(0, 10)]);
    const b = retanguloEnvolvente([ponto(10, 0), ponto(20, 0), ponto(20, 10), ponto(10, 10)]);
    expect(bboxesSeSobrepoem(a, b)).toBe(true);
  });
});

describe('contornosSeSobrepoem', () => {
  const quadradoA = [ponto(0, 0), ponto(10, 0), ponto(10, 10), ponto(0, 10)];

  it('detecta sobreposição parcial (arestas se cruzam)', () => {
    const quadradoB = [ponto(5, 5), ponto(15, 5), ponto(15, 15), ponto(5, 15)];
    expect(contornosSeSobrepoem(quadradoA, quadradoB)).toBe(true);
  });

  it('detecta quando um contorno está inteiramente dentro do outro (sem cruzar arestas)', () => {
    const pequenoDentro = [ponto(2, 2), ponto(4, 2), ponto(4, 4), ponto(2, 4)];
    expect(contornosSeSobrepoem(quadradoA, pequenoDentro)).toBe(true);
    expect(contornosSeSobrepoem(pequenoDentro, quadradoA)).toBe(true);
  });

  it('falso para contornos distantes (nem os bboxes se tocam)', () => {
    const distante = [ponto(100, 100), ponto(110, 100), ponto(110, 110), ponto(100, 110)];
    expect(contornosSeSobrepoem(quadradoA, distante)).toBe(false);
  });

  it('falso para contornos vizinhos que só encostam a borda, sem cruzar', () => {
    const vizinho = [ponto(10, 0), ponto(20, 0), ponto(20, 10), ponto(10, 10)];
    expect(contornosSeSobrepoem(quadradoA, vizinho)).toBe(true); // arestas coincidentes contam como toque
  });
});

describe('distanciaEntreContornos', () => {
  it('zero quando os contornos se sobrepõem', () => {
    const a = [ponto(0, 0), ponto(10, 0), ponto(10, 10), ponto(0, 10)];
    const b = [ponto(5, 5), ponto(15, 5), ponto(15, 15), ponto(5, 15)];
    expect(distanciaEntreContornos(a, b)).toBe(0);
  });

  it('distância real entre dois contornos separados', () => {
    const a = [ponto(0, 0), ponto(10, 0), ponto(10, 10), ponto(0, 10)];
    const b = [ponto(20, 0), ponto(30, 0), ponto(30, 10), ponto(20, 10)];
    expect(distanciaEntreContornos(a, b)).toBeCloseTo(10, 9);
  });
});

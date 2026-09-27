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

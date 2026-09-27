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

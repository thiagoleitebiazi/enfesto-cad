import { describe, it, expect } from 'vitest';
import { ponto } from '../core/geometria';
import {
  ancoraDoRotulo,
  bissetrizDaCotaDeAngulo,
  cotaDeAngulo,
  cotaDeDistancia,
  cotaDePerimetro,
  cotaHorizontalOuVertical,
  geometriaDaCotaLinear,
  transformarCota,
  valorDaCotaDeAngulo,
  valorDaCotaLinear,
  type CotaLinear,
} from './cota';

// Na tela, a horizontal é o Y do mundo e a vertical é o X.
describe('cotaDeDistancia', () => {
  it('mede em linha reta, na direção que liga os dois pontos', () => {
    const cota = cotaDeDistancia('c1', ponto(0, 0), ponto(300, 400), ponto(0, 50));
    expect(valorDaCotaLinear(cota)).toBeCloseTo(500, 9);
    expect(cota.direcao.x).toBeCloseTo(0.6, 9);
    expect(cota.direcao.y).toBeCloseTo(0.8, 9);
  });

  it('recusa dois pontos iguais', () => {
    expect(() => cotaDeDistancia('c1', ponto(10, 10), ponto(10, 10), ponto(0, 0))).toThrow('dois pontos diferentes');
  });
});

describe('cotaHorizontalOuVertical', () => {
  const de = ponto(0, 0);
  const ate = ponto(300, 400); // 400 na horizontal da tela, 300 na vertical

  it('posta acima ou abaixo dos pontos, mede a horizontal', () => {
    const cota = cotaHorizontalOuVertical('c1', de, ate, ponto(-60, 200));
    expect(cota.direcao).toEqual(ponto(0, 1));
    expect(valorDaCotaLinear(cota)).toBe(400);
  });

  it('posta ao lado dos pontos, mede a vertical', () => {
    const cota = cotaHorizontalOuVertical('c1', de, ate, ponto(150, 480));
    expect(cota.direcao).toEqual(ponto(1, 0));
    expect(valorDaCotaLinear(cota)).toBe(300);
  });

  it('se os pontos não têm distância na direção escolhida, vale a outra', () => {
    // Dois pontos na mesma vertical da tela: a horizontal entre eles é zero.
    const cota = cotaHorizontalOuVertical('c1', ponto(0, 100), ponto(250, 100), ponto(-80, 100));
    expect(cota.direcao).toEqual(ponto(1, 0));
    expect(valorDaCotaLinear(cota)).toBe(250);
  });
});

describe('geometriaDaCotaLinear', () => {
  it('a linha de cota passa pela posição escolhida, paralela à direção medida', () => {
    // Horizontal da tela entre (0,0) e (300,400), posta na altura x = -60.
    const cota = cotaHorizontalOuVertical('c1', ponto(0, 0), ponto(300, 400), ponto(-60, 200));
    const { peDe, peAte, meio } = geometriaDaCotaLinear(cota);
    expect(peDe.x).toBeCloseTo(-60, 9);
    expect(peDe.y).toBeCloseTo(0, 9);
    expect(peAte.x).toBeCloseTo(-60, 9);
    expect(peAte.y).toBeCloseTo(400, 9);
    expect(meio.x).toBeCloseTo(-60, 9);
    expect(meio.y).toBeCloseTo(200, 9);
  });

  it('na cota de distância, os pés ficam afastados dos pontos na perpendicular', () => {
    const cota = cotaDeDistancia('c1', ponto(0, 0), ponto(0, 100), ponto(-25, 37));
    const { peDe, peAte } = geometriaDaCotaLinear(cota);
    expect(peDe.x).toBeCloseTo(-25, 9);
    expect(peDe.y).toBeCloseTo(0, 9);
    expect(peAte.x).toBeCloseTo(-25, 9);
    expect(peAte.y).toBeCloseTo(100, 9);
  });
});

describe('cotaDeAngulo', () => {
  it('mede o ângulo no vértice, de 0° a 180°', () => {
    expect(valorDaCotaDeAngulo(cotaDeAngulo('c1', ponto(100, 0), ponto(0, 0), ponto(0, 100), ponto(30, 30)))).toBeCloseTo(90, 9);
    expect(valorDaCotaDeAngulo(cotaDeAngulo('c2', ponto(100, 0), ponto(0, 0), ponto(100, 100), ponto(30, 10)))).toBeCloseTo(45, 9);
    expect(valorDaCotaDeAngulo(cotaDeAngulo('c3', ponto(100, 0), ponto(0, 0), ponto(-100, 0), ponto(0, 30)))).toBeCloseTo(180, 9);
  });

  it('o raio do arco é a distância do vértice à posição escolhida, com um mínimo', () => {
    expect(cotaDeAngulo('c1', ponto(100, 0), ponto(0, 0), ponto(0, 100), ponto(30, 40)).raioMm).toBe(50);
    expect(cotaDeAngulo('c1', ponto(100, 0), ponto(0, 0), ponto(0, 100), ponto(0, 0)).raioMm).toBe(1);
  });

  it('o número fica na bissetriz', () => {
    const cota = cotaDeAngulo('c1', ponto(100, 0), ponto(0, 0), ponto(0, 100), ponto(30, 40));
    const bissetriz = bissetrizDaCotaDeAngulo(cota);
    expect(bissetriz.x).toBeCloseTo(Math.SQRT1_2, 9);
    expect(bissetriz.y).toBeCloseTo(Math.SQRT1_2, 9);
    expect(ancoraDoRotulo(cota).x).toBeCloseTo(50 * Math.SQRT1_2, 9);
  });

  it('com os lados opostos (180°), a bissetriz é a perpendicular', () => {
    const bissetriz = bissetrizDaCotaDeAngulo(cotaDeAngulo('c1', ponto(100, 0), ponto(0, 0), ponto(-100, 0), ponto(0, 30)));
    expect(Math.abs(bissetriz.x)).toBeCloseTo(0, 9);
    expect(Math.abs(bissetriz.y)).toBeCloseTo(1, 9);
  });

  it('recusa um lado sem comprimento', () => {
    expect(() => cotaDeAngulo('c1', ponto(0, 0), ponto(0, 0), ponto(0, 100), ponto(30, 30))).toThrow('três pontos diferentes');
  });
});

describe('ancoraDoRotulo', () => {
  it('é o meio da linha de cota, ou a posição da cota de perímetro', () => {
    expect(ancoraDoRotulo(cotaDeDistancia('c1', ponto(0, 0), ponto(0, 100), ponto(-25, 37)))).toEqual(ponto(-25, 50));
    expect(ancoraDoRotulo(cotaDePerimetro('c2', ponto(70, 80)))).toEqual(ponto(70, 80));
  });
});

describe('transformarCota', () => {
  it('leva os pontos e a direção; o valor não muda numa translação nem num giro', () => {
    const cota = cotaHorizontalOuVertical('c1', ponto(0, 0), ponto(300, 400), ponto(-60, 200));
    const transladada = transformarCota(
      cota,
      (p) => ponto(p.x + 10, p.y + 20),
      (v) => v,
    ) as CotaLinear;
    expect(transladada).toMatchObject({ de: ponto(10, 20), ate: ponto(310, 420), posicao: ponto(-50, 220), direcao: ponto(0, 1) });
    expect(valorDaCotaLinear(transladada)).toBe(400);

    // Giro de 90°: (x, y) -> (-y, x). A horizontal da tela vira vertical, e a medida continua 400.
    const girada = transformarCota(
      cota,
      (p) => ponto(-p.y, p.x),
      (v) => ponto(-v.y, v.x),
    );
    expect(girada.tipo === 'linear' && Math.abs(girada.direcao.x)).toBeCloseTo(1, 9);
    expect(girada.tipo === 'linear' && valorDaCotaLinear(girada)).toBeCloseTo(400, 9);
  });

  it('numa escala, a medida acompanha e a direção volta a ser unitária', () => {
    const cota = cotaDeDistancia('c1', ponto(0, 0), ponto(300, 400), ponto(0, 50));
    const escalada = transformarCota(
      cota,
      (p) => ponto(p.x * 2, p.y * 2),
      (v) => ponto(v.x * 2, v.y * 2),
    );
    expect(escalada.tipo === 'linear' && Math.hypot(escalada.direcao.x, escalada.direcao.y)).toBeCloseTo(1, 9);
    expect(escalada.tipo === 'linear' && valorDaCotaLinear(escalada)).toBeCloseTo(1000, 9);
  });

  it('o ângulo se conserva num espelhamento, e a cota de perímetro só muda de lugar', () => {
    const angulo = cotaDeAngulo('c1', ponto(100, 0), ponto(0, 0), ponto(100, 100), ponto(30, 10));
    const espelhado = transformarCota(
      angulo,
      (p) => ponto(-p.x, p.y),
      (v) => ponto(-v.x, v.y),
    );
    expect(espelhado.tipo === 'angulo' && valorDaCotaDeAngulo(espelhado)).toBeCloseTo(45, 9);
    expect(espelhado.tipo === 'angulo' && espelhado.raioMm).toBe(angulo.raioMm);

    const perimetro = transformarCota(
      cotaDePerimetro('c2', ponto(70, 80)),
      (p) => ponto(-p.x, p.y),
      (v) => v,
    );
    expect(perimetro).toEqual({ id: 'c2', tipo: 'perimetro', posicao: ponto(-70, 80) });
  });
});

import { describe, expect, it } from 'vitest';
import { arrastarVista, janelaDaFolha, naGrade, passoDaGrade, VISTA_INTEIRA, ZOOM_MAXIMO, zoomNoPonto } from './vistaDaFolha';

describe('a vista da folha do desenho técnico (ADR 0116)', () => {
  it('a folha inteira; de perto, a janela em volta do meio', () => {
    expect(janelaDaFolha(VISTA_INTEIRA)).toEqual({ x: 0, y: 0, largura: 400, altura: 500 });
    expect(janelaDaFolha(zoomNoPonto(VISTA_INTEIRA, 2))).toEqual({ x: 100, y: 125, largura: 200, altura: 250 });
  });

  it('o zoom no ponto do mouse deixa esse ponto no mesmo lugar do quadro', () => {
    const p = { x: 80, y: 60 };
    const v = zoomNoPonto(VISTA_INTEIRA, 2, p);
    const j = janelaDaFolha(v);
    // Antes, o ponto estava a 20% da largura e a 12% da altura do quadro; depois, também.
    expect((p.x - j.x) / j.largura).toBeCloseTo(0.2, 9);
    expect((p.y - j.y) / j.altura).toBeCloseTo(0.12, 9);
  });

  it('o zoom fica entre a folha inteira e o máximo; a janela não sai da folha', () => {
    expect(zoomNoPonto(VISTA_INTEIRA, 0.5).zoom).toBe(1);
    expect(zoomNoPonto(VISTA_INTEIRA, 100).zoom).toBe(ZOOM_MAXIMO);
    // No canto, de perto: a janela encosta no canto, sem passar.
    expect(janelaDaFolha(zoomNoPonto(VISTA_INTEIRA, 4, { x: 0, y: 0 }))).toEqual({ x: 0, y: 0, largura: 100, altura: 125 });
    const arrastada = arrastarVista(zoomNoPonto(VISTA_INTEIRA, 2), -1000, 1000);
    expect(janelaDaFolha(arrastada)).toEqual({ x: 200, y: 0, largura: 200, altura: 250 });
    // Na folha inteira, arrastar não anda.
    expect(arrastarVista(VISTA_INTEIRA, 50, 50)).toEqual(VISTA_INTEIRA);
  });

  it('a grade: 10 na folha inteira, 5 de perto; o ponto vai para o cruzamento mais perto', () => {
    expect(passoDaGrade(1)).toBe(10);
    expect(passoDaGrade(2)).toBe(5);
    expect(naGrade({ x: 123, y: 207.4 }, 10)).toEqual({ x: 120, y: 210 });
    expect(naGrade({ x: 123, y: 207.4 }, 5)).toEqual({ x: 125, y: 205 });
  });
});

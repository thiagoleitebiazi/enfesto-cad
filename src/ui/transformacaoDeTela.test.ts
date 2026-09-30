import { describe, it, expect } from 'vitest';
import { mundoParaTela, telaParaMundo, aplicarZoom, passoDeReguaEmMm } from './transformacaoDeTela';

describe('mundoParaTela / telaParaMundo', () => {
  it('são inversas uma da outra', () => {
    const t = { escalaPxPorMm: 3, offsetXPx: 40, offsetYPx: -10 };
    const mundo = { x: 123.4, y: -56.7 };
    const tela = mundoParaTela(mundo, t);
    const voltaAoMundo = telaParaMundo(tela, t);
    expect(voltaAoMundo.x).toBeCloseTo(mundo.x, 9);
    expect(voltaAoMundo.y).toBeCloseTo(mundo.y, 9);
  });

  it('troca os eixos de propósito: mundo.y (comprimento do enfesto) vai para a horizontal da tela, mundo.x (largura) para a vertical — mesa sempre deitada', () => {
    const t = { escalaPxPorMm: 2, offsetXPx: 10, offsetYPx: 5 };
    // Um ponto bem mais longe no eixo comprimento (y) que no eixo largura (x)
    // do domínio deve terminar mais longe na horizontal da tela (x), não na vertical.
    const mundo = { x: 50, y: 500 };
    const tela = mundoParaTela(mundo, t);
    expect(tela.x).toBeCloseTo(t.offsetXPx + mundo.y * t.escalaPxPorMm, 9);
    expect(tela.y).toBeCloseTo(t.offsetYPx + mundo.x * t.escalaPxPorMm, 9);
  });
});

describe('aplicarZoom', () => {
  it('mantém o pivô fixo na tela ao aumentar o zoom', () => {
    const t = { escalaPxPorMm: 2, offsetXPx: 0, offsetYPx: 0 };
    const pivot = { x: 200, y: 150 };
    const mundoNoPivotAntes = telaParaMundo(pivot, t);

    const depois = aplicarZoom(t, 2, pivot);
    const mundoNoPivotDepois = telaParaMundo(pivot, depois);

    expect(mundoNoPivotDepois.x).toBeCloseTo(mundoNoPivotAntes.x, 9);
    expect(mundoNoPivotDepois.y).toBeCloseTo(mundoNoPivotAntes.y, 9);
    expect(depois.escalaPxPorMm).toBeCloseTo(4, 9);
  });

  it('respeita o limite mínimo e máximo de escala', () => {
    const t = { escalaPxPorMm: 1, offsetXPx: 0, offsetYPx: 0 };
    const zoomOutExtremo = aplicarZoom(t, 0.00001, { x: 0, y: 0 });
    const zoomInExtremo = aplicarZoom(t, 100000, { x: 0, y: 0 });
    expect(zoomOutExtremo.escalaPxPorMm).toBeGreaterThan(0);
    expect(zoomInExtremo.escalaPxPorMm).toBeLessThan(1000);
  });
});

describe('passoDeReguaEmMm', () => {
  it('escolhe um passo maior quando o zoom diminui (mesmo alvo em px)', () => {
    const passoZoomAlto = passoDeReguaEmMm(10, 60);
    const passoZoomBaixo = passoDeReguaEmMm(0.5, 60);
    expect(passoZoomBaixo).toBeGreaterThan(passoZoomAlto);
  });

  it('o passo escolhido sempre gera um espaçamento em tela dentro de uma faixa razoável do alvo', () => {
    for (const escala of [0.05, 0.2, 1, 3, 15, 40]) {
      const passo = passoDeReguaEmMm(escala, 60);
      const espacoPx = passo * escala;
      // Deve ficar entre 20px e 200px — não pode gerar réguas ilegíveis (muito densas ou muito esparsas).
      expect(espacoPx).toBeGreaterThan(20);
      expect(espacoPx).toBeLessThan(200);
    }
  });
});

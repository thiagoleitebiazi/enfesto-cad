import { describe, it, expect } from 'vitest';
import {
  mundoParaTela,
  telaParaMundo,
  aplicarZoom,
  enquadrarRetanguloDeTela,
  enquadrarRetanguloDoMundo,
  passoDaGradeEmMm,
  passoDeReguaEmMm,
  subdivisoesDaRegua,
  valorDaReguaEmUnidade,
  ESCALA_MAXIMA,
} from './transformacaoDeTela';

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

describe('enquadrarRetanguloDeTela (zoom por janela)', () => {
  const tamanho = { largura: 800, altura: 600 };

  it('o centro do retângulo vai para o centro da tela e o lado que limita passa a ocupá-la', () => {
    const t = { escalaPxPorMm: 2, offsetXPx: 30, offsetYPx: -20 };
    const a = { x: 100, y: 100 };
    const b = { x: 300, y: 200 }; // 200 × 100 px → fator min(800/200, 600/100) = 4
    const centroNoMundo = telaParaMundo({ x: 200, y: 150 }, t);
    const depois = enquadrarRetanguloDeTela(t, a, b, tamanho);
    expect(depois.escalaPxPorMm).toBeCloseTo(8, 9);
    const centroNaTela = mundoParaTela(centroNoMundo, depois);
    expect(centroNaTela.x).toBeCloseTo(400, 9);
    expect(centroNaTela.y).toBeCloseTo(300, 9);
    // Os dois cantos ficam dentro da tela; a largura (lado que limita) ocupa os 800 px.
    const cantoA = mundoParaTela(telaParaMundo(a, t), depois);
    const cantoB = mundoParaTela(telaParaMundo(b, t), depois);
    expect(cantoA.x).toBeCloseTo(0, 9);
    expect(cantoB.x).toBeCloseTo(800, 9);
  });

  it('cantos em qualquer ordem dão o mesmo resultado', () => {
    const t = { escalaPxPorMm: 1, offsetXPx: 0, offsetYPx: 0 };
    expect(enquadrarRetanguloDeTela(t, { x: 300, y: 50 }, { x: 100, y: 250 }, tamanho)).toEqual(
      enquadrarRetanguloDeTela(t, { x: 100, y: 250 }, { x: 300, y: 50 }, tamanho),
    );
  });

  it('respeita a escala máxima e ignora retângulo sem altura ou largura', () => {
    const t = { escalaPxPorMm: 30, offsetXPx: 0, offsetYPx: 0 };
    expect(enquadrarRetanguloDeTela(t, { x: 0, y: 0 }, { x: 4, y: 3 }, tamanho).escalaPxPorMm).toBe(ESCALA_MAXIMA);
    expect(enquadrarRetanguloDeTela(t, { x: 10, y: 10 }, { x: 10, y: 90 }, tamanho)).toBe(t);
  });
});

describe('enquadrarRetanguloDoMundo (ajustar à tela)', () => {
  it('mostra o retângulo inteiro, centralizado, com o comprimento (Y) na horizontal', () => {
    // Mesa 1500 × 3000 mm numa área de 1000 × 600 px, margem 50:
    // escala = min(900/3000, 500/1500) = 0,3 → 900 × 450 px na tela.
    const t = enquadrarRetanguloDoMundo({ minX: 0, minY: 0, maxX: 1500, maxY: 3000 }, { largura: 1000, altura: 600 }, 50);
    expect(t.escalaPxPorMm).toBeCloseTo(0.3, 9);
    const cantoInicial = mundoParaTela({ x: 0, y: 0 }, t);
    const cantoFinal = mundoParaTela({ x: 1500, y: 3000 }, t);
    expect(cantoInicial.x).toBeCloseTo(50, 9);
    expect(cantoFinal.x).toBeCloseTo(950, 9);
    expect(cantoInicial.y).toBeCloseTo(75, 9);
    expect(cantoFinal.y).toBeCloseTo(525, 9);
  });

  it('respeita a escala máxima para um retângulo minúsculo, mantendo-o no centro', () => {
    const t = enquadrarRetanguloDoMundo({ minX: 10, minY: 10, maxX: 10.5, maxY: 10.5 }, { largura: 800, altura: 600 });
    expect(t.escalaPxPorMm).toBe(ESCALA_MAXIMA);
    const centro = mundoParaTela({ x: 10.25, y: 10.25 }, t);
    expect(centro.x).toBeCloseTo(400, 9);
    expect(centro.y).toBeCloseTo(300, 9);
  });
});

describe('passoDaGradeEmMm', () => {
  it('menor passo redondo com pelo menos 12 px entre pontos', () => {
    expect(passoDaGradeEmMm(40)).toBe(1); // 1 mm = 40 px
    expect(passoDaGradeEmMm(1)).toBe(20); // 10 mm = 10 px não cabe; 20 mm = 20 px
    expect(passoDaGradeEmMm(0.5)).toBe(50); // 20 mm = 10 px; 50 mm = 25 px
    expect(passoDaGradeEmMm(0.05)).toBe(500); // 200 mm = 10 px; 500 mm = 25 px
  });

  it('o passo nunca fica abaixo do mínimo em pixels', () => {
    for (const escala of [0.05, 0.13, 0.7, 2.2, 9, 40]) {
      expect(passoDaGradeEmMm(escala) * escala).toBeGreaterThanOrEqual(12);
    }
  });
});

describe('valorDaReguaEmUnidade', () => {
  it('cm divide por 10, preservando o valor interno em mm', () => {
    expect(valorDaReguaEmUnidade(125, 'cm')).toBeCloseTo(12.5, 9);
  });

  it('mm é a identidade', () => {
    expect(valorDaReguaEmUnidade(125, 'mm')).toBe(125);
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

describe('subdivisoesDaRegua', () => {
  it('usa 10 subdivisões quando há espaço, e menos quando os traços ficariam colados', () => {
    expect(subdivisoesDaRegua(100, 1)).toBe(10); // 10 px entre traços
    expect(subdivisoesDaRegua(100, 0.3)).toBe(5); // 20 mm × 0,3 = 6 px; 10 mm × 0,3 = 3 px
    expect(subdivisoesDaRegua(100, 0.12)).toBe(2); // 50 mm × 0,12 = 6 px
    expect(subdivisoesDaRegua(100, 0.05)).toBe(1); // nem 2 cabem
  });
});

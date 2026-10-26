import { describe, expect, it } from 'vitest';
import { cameraDeFrente, desenharSombraNoChao, guinadasDoGiro, montarCena, projecao, type ItemDaCena, type TecidoParaDesenhar } from './cena3d';

/** Uma esfera de tecido de 30 cm na altura do peito: tem faces em todas as direções, uma delas de frente para o reflexo. */
function esfera(extras: Partial<TecidoParaDesenhar> = {}): TecidoParaDesenhar {
  const pontos: number[] = [];
  const triangulos: number[] = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= N; j++) {
      const t = (Math.PI * i) / N;
      const f = (2 * Math.PI * j) / N;
      pontos.push(300 * Math.sin(t) * Math.cos(f), 900 + 300 * Math.cos(t), 300 * Math.sin(t) * Math.sin(f));
    }
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const a = i * (N + 1) + j;
      triangulos.push(a, a + N + 1, a + 1, a + 1, a + N + 1, a + N + 2);
    }
  }
  return {
    x: Float64Array.from(pontos),
    triangulos: Uint32Array.from(triangulos),
    pecas: [{ chave: 'p', primeiroTriangulo: 0, quantidade: triangulos.length / 3, cor: [60, 90, 160], espelhada: false, inicio: 0 }],
    ...extras,
  };
}

const triangulos = (itens: readonly ItemDaCena[]) => itens.filter((i): i is Extract<ItemDaCena, { tipo: 'triangulo' }> => i.tipo === 'triangulo');
const cena = (tecido: TecidoParaDesenhar) => triangulos(montarCena(projecao(cameraDeFrente(1700), 800, 600, 1700), null, tecido));

describe('o brilho e a transparência do tecido no provador (ADR 0131)', () => {
  it('fosco e opaco: nenhum reflexo, nenhuma transparência', () => {
    const itens = cena(esfera());
    expect(itens.length).toBeGreaterThan(0);
    expect(itens.every((i) => i.reflexo === undefined && i.opacidade === undefined)).toBe(true);
  });

  it('com brilho, a face voltada para o meio entre a luz e o olho reflete; mais brilho, reflexo mais forte e mais estreito', () => {
    const pouco = cena(esfera({ brilho: 30 }));
    const muito = cena(esfera({ brilho: 100 }));
    const maior = (itens: typeof pouco): number => Math.max(...itens.map((i) => i.reflexo ?? 0));
    const quantos = (itens: typeof pouco): number => itens.filter((i) => (i.reflexo ?? 0) > 0.05).length;
    expect(maior(pouco)).toBeGreaterThan(0.1);
    expect(maior(muito)).toBeGreaterThan(maior(pouco));
    expect(maior(muito)).toBeLessThanOrEqual(0.9);
    expect(quantos(muito)).toBeLessThan(quantos(pouco));
    // Pintado pela tensão, o brilho não entra (a cor diz o quanto estica).
    expect(cena(esfera({ brilho: 100, tensoes: new Float64Array(24 * 24 * 2) })).every((i) => i.reflexo === undefined)).toBe(true);
  });

  it('com transparência, a opacidade cai; o mais transparente guarda 15% da cor', () => {
    expect(cena(esfera({ transparencia: 40 })).every((i) => Math.abs(i.opacidade! - 0.66) < 1e-9)).toBe(true);
    expect(cena(esfera({ transparencia: 100 })).every((i) => Math.abs(i.opacidade! - 0.15) < 1e-9)).toBe(true);
  });
});

describe('o zíper na costura (ADR 0132)', () => {
  // Uma costura em pé, de 100 em 100 mm, de y = 600 a y = 1000, em z = 150 (na frente do corpo).
  const costura = (deBaixoParaCima: boolean) => {
    const pontos: number[] = [];
    for (let k = 0; k <= 4; k++) pontos.push(0, 600 + 100 * k, 150);
    const indices = [0, 1, 2, 3, 4];
    return { x: Float64Array.from(pontos), indices: deBaixoParaCima ? indices : [...indices].reverse() };
  };
  const ziper = (deBaixoParaCima: boolean, comprimentoMm: number) => {
    const c = costura(deBaixoParaCima);
    const tecido: TecidoParaDesenhar = { x: c.x, triangulos: new Uint32Array(0), pecas: [], ziperes: [{ pontos: c.indices, comprimentoMm }] };
    return montarCena(projecao(cameraDeFrente(1700), 800, 600, 1700), null, tecido).filter((i): i is Extract<ItemDaCena, { tipo: 'ziper' }> => i.tipo === 'ziper');
  };

  it('do alto da costura para baixo, até o comprimento: o primeiro pedaço leva o cursor', () => {
    for (const sentido of [true, false]) {
      const itens = ziper(sentido, 250);
      // 100 + 100 + 50 mm: três pedaços, o último pela metade.
      expect(itens).toHaveLength(3);
      // Os itens vêm na ordem da profundidade: o cursor é o do pedaço mais alto (o y da tela cresce para baixo).
      const cursores = itens.filter((i) => i.cursor);
      expect(cursores).toHaveLength(1);
      expect(cursores[0]!.de[1]).toBe(Math.min(...itens.map((i) => i.de[1])));
      expect(cursores[0]!.de[1]).toBeLessThan(cursores[0]!.ate[1]);
      const comprimentoNaTela = (i: (typeof itens)[number]): number => Math.hypot(i.ate[0] - i.de[0], i.ate[1] - i.de[1]);
      expect(Math.min(...itens.map(comprimentoNaTela))).toBeCloseTo(comprimentoNaTela(cursores[0]!) / 2, 0);
      expect(itens.every((i) => i.largura >= 3 && i.largura <= 18)).toBe(true);
    }
  });

  it('o zíper mais comprido que a costura vai até o fim dela', () => {
    expect(ziper(true, 5000)).toHaveLength(4);
  });
});

describe('a sombra no chão e o giro em vídeo (ADR 0139)', () => {
  it('o giro: uma volta inteira, quadro a quadro, a partir da vista de agora', () => {
    expect(guinadasDoGiro(0.5, 4)).toEqual([0.5, 0.5 + Math.PI / 2, 0.5 + Math.PI, 0.5 + (3 * Math.PI) / 2]);
    expect(guinadasDoGiro(0, 0)).toEqual([0]);
  });

  it('a sombra: uma mancha achatada sob os pés, mais escura no meio', () => {
    const chamadas: string[] = [];
    const paradas: number[] = [];
    let raio = 0;
    const ctx = {
      save: () => chamadas.push('save'),
      restore: () => chamadas.push('restore'),
      translate: () => {},
      scale: (_x: number, y: number) => chamadas.push(`scale ${y.toFixed(2)}`),
      createRadialGradient: (_x0: number, _y0: number, _r0: number, _x1: number, _y1: number, r1: number) => {
        raio = r1;
        return { addColorStop: (p: number) => paradas.push(p) };
      },
      beginPath: () => {},
      arc: () => {},
      fill: () => chamadas.push('fill'),
      fillStyle: '',
    } as unknown as CanvasRenderingContext2D;
    desenharSombraNoChao(ctx, projecao(cameraDeFrente(1700), 800, 600, 1700));
    expect(raio).toBeGreaterThan(10);
    expect(paradas).toEqual([0, 0.55, 1]);
    // Achatada: a altura é uma fração da largura.
    const escala = Number(chamadas.find((c) => c.startsWith('scale'))!.split(' ')[1]);
    expect(escala).toBeGreaterThan(0.1);
    expect(escala).toBeLessThan(1);
    expect(chamadas).toContain('fill');
  });
});

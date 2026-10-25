import { describe, expect, it } from 'vitest';
import { cameraDeFrente, montarCena, projecao, type ItemDaCena, type TecidoParaDesenhar } from './cena3d';

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

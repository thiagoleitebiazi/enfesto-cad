// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { emCascata, ladoALado, porNoLugar, type JanelaArrumavel, type Retangulo } from './arrumarJanelas';

const AREA: Retangulo = { x: 100, y: 40, width: 1920, height: 1040 };
const dentro = (r: Retangulo): boolean => r.x >= AREA.x && r.y >= AREA.y && r.x + r.width <= AREA.x + AREA.width && r.y + r.height <= AREA.y + AREA.height;

describe('as janelas arrumadas (ADR 0211)', () => {
  it('em cascata, cada uma desce um degrau, e todas têm o mesmo tamanho', () => {
    const r = emCascata(3, AREA);
    expect(r[1]).toMatchObject({ x: 132, y: 72 });
    expect(new Set(r.map((j) => j.width)).size).toBe(1);
    expect(r.every(dentro)).toBe(true);
  });

  it('uma só ocupa a área toda', () => {
    expect(emCascata(1, AREA)).toEqual([AREA]);
    expect(ladoALado(1, AREA)).toEqual([AREA]);
  });

  it('muitas janelas em cascata não saem da área', () => {
    const r = emCascata(60, AREA);
    expect(r.every(dentro)).toBe(true);
    expect(r[59]!.width).toBeGreaterThan(0);
  });

  it('lado a lado: duas dividem a largura', () => {
    expect(ladoALado(2, AREA)).toEqual([
      { x: 100, y: 40, width: 960, height: 1040 },
      { x: 1060, y: 40, width: 960, height: 1040 },
    ]);
  });

  it('cinco: três em cima, duas embaixo dividindo a largura, sem sobrepor', () => {
    const r = ladoALado(5, AREA);
    expect(r.map((j) => j.width)).toEqual([640, 640, 640, 960, 960]);
    expect(r[3]!.y).toBe(560);
    expect(r.every(dentro)).toBe(true);
  });
});

describe('pôr a janela no lugar, e conferir', () => {
  const LUGAR: Retangulo = { x: 640, y: 0, width: 640, height: 674 };
  const esperar = async (): Promise<void> => undefined;

  /** Uma janela de mentira: ignora os primeiros pedidos, como o Windows faz saindo do maximizado. */
  const janela = (extra: { ignorar?: number; maximizada?: boolean; demoraParaRestaurar?: number; arredonda?: number } = {}) => {
    let ignorar = extra.ignorar ?? 0;
    let maximizada = extra.maximizada ?? false;
    let demora = extra.demoraParaRestaurar ?? 0;
    let bounds: Retangulo = { x: 0, y: 0, width: 1280, height: 700 };
    const j = {
      pedidos: 0,
      minimo: [1024, 700],
      fechada: false,
      isDestroyed: () => j.fechada,
      isMaximized: () => maximizada,
      unmaximize: () => {
        if (demora-- <= 0) maximizada = false;
      },
      getBounds: () => bounds,
      setBounds: (l: Retangulo) => {
        j.pedidos++;
        if (maximizada || ignorar-- > 0) return;
        bounds = { ...l, width: l.width + (extra.arredonda ?? 0) };
      },
      getMinimumSize: () => j.minimo,
      setMinimumSize: (l: number, a: number) => {
        j.minimo = [l, a];
      },
    };
    return j satisfies JanelaArrumavel;
  };

  it('vai de primeira, sem repetir', async () => {
    const j = janela();
    expect(await porNoLugar(j, LUGAR, esperar)).toBe(true);
    expect(j.pedidos).toBe(1);
    expect(j.getBounds()).toEqual(LUGAR);
  });

  it('o Windows ignora os primeiros pedidos: repete até ficar', async () => {
    const j = janela({ ignorar: 3 });
    expect(await porNoLugar(j, LUGAR, esperar)).toBe(true);
    expect(j.pedidos).toBe(4);
    expect(j.getBounds()).toEqual(LUGAR);
  });

  it('a janela demora a sair do maximizado: espera, e só então conta', async () => {
    const j = janela({ maximizada: true, demoraParaRestaurar: 2 });
    expect(await porNoLugar(j, LUGAR, esperar)).toBe(true);
    expect(j.isMaximized()).toBe(false);
    expect(j.getBounds()).toEqual(LUGAR);
  });

  it('o mínimo da janela cede, para caber', async () => {
    const j = janela();
    await porNoLugar(j, LUGAR, esperar);
    expect(j.minimo).toEqual([640, 674]);
  });

  it('o arredondamento da escala da tela não é erro', async () => {
    const j = janela({ arredonda: 3 });
    expect(await porNoLugar(j, LUGAR, esperar)).toBe(true);
    expect(j.pedidos).toBe(1);
  });

  it('se a janela não vai de jeito nenhum, diz que não foi', async () => {
    expect(await porNoLugar(janela({ ignorar: 1000 }), LUGAR, esperar)).toBe(false);
  });

  it('a janela fechada no meio do arranjo não dá erro', async () => {
    const j = janela({ ignorar: 1000 });
    const fechando = async (): Promise<void> => {
      j.fechada = true;
    };
    expect(await porNoLugar(j, LUGAR, fechando)).toBe(true);
  });
});

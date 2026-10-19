import { describe, expect, it } from 'vitest';
import { ehMac, gestoDaRoda, PASSO_DO_ZOOM, type EventoDeRoda } from './rodaDoMouse';

const roda = (extras: Partial<EventoDeRoda>): EventoDeRoda => ({ deltaX: 0, deltaY: 0, deltaMode: 0, ctrlKey: false, metaKey: false, ...extras });

describe('gestoDaRoda — no Windows', () => {
  it('a roda do mouse é o zoom, um dente por evento, como antes', () => {
    expect(gestoDaRoda(roda({ deltaY: -100 }), false)).toEqual({ tipo: 'zoom', fator: PASSO_DO_ZOOM });
    expect(gestoDaRoda(roda({ deltaY: 100 }), false)).toEqual({ tipo: 'zoom', fator: 1 / PASSO_DO_ZOOM });
  });

  it('a rolagem só de lado move a vista (antes afastava)', () => {
    expect(gestoDaRoda(roda({ deltaX: 40 }), false)).toEqual({ tipo: 'mover', dx: -40, dy: -0 });
  });

  it('a pinça do touchpad (roda com Ctrl, em passos pequenos) dá zoom suave; Ctrl + roda do mouse, um dente', () => {
    const pinca = gestoDaRoda(roda({ deltaY: -4, ctrlKey: true }), false);
    expect(pinca.tipo).toBe('zoom');
    expect(pinca.tipo === 'zoom' && pinca.fator).toBeCloseTo(Math.exp(0.04), 9);
    expect(gestoDaRoda(roda({ deltaY: -100, ctrlKey: true }), false)).toEqual({ tipo: 'zoom', fator: PASSO_DO_ZOOM });
    expect(gestoDaRoda(roda({ deltaY: 300, ctrlKey: true }), false)).toEqual({ tipo: 'zoom', fator: 1 / PASSO_DO_ZOOM });
  });
});

describe('gestoDaRoda — no Mac', () => {
  it('dois dedos no trackpad movem a vista, nas duas direções', () => {
    expect(gestoDaRoda(roda({ deltaX: 12, deltaY: -30 }), true)).toEqual({ tipo: 'mover', dx: -12, dy: 30 });
  });

  it('a pinça (Ctrl) e ⌘ + rolagem dão o zoom', () => {
    expect(gestoDaRoda(roda({ deltaY: -3, ctrlKey: true }), true).tipo).toBe('zoom');
    expect(gestoDaRoda(roda({ deltaY: -3, metaKey: true }), true).tipo).toBe('zoom');
  });

  it('o evento em linhas é convertido para pixels', () => {
    expect(gestoDaRoda(roda({ deltaY: 3, deltaMode: 1 }), true)).toEqual({ tipo: 'mover', dx: -0, dy: -48 });
  });
});

describe('ehMac', () => {
  it('reconhece o Mac pelo que a página sabe do sistema', () => {
    expect(ehMac({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Electron/44.4.5' })).toBe(true);
    expect(ehMac({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Electron/44.4.5' })).toBe(false);
    expect(ehMac(undefined)).toBe(false);
  });
});

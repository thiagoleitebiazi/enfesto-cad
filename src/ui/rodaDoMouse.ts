/** O que fazer com um evento de roda (do mouse, ou dos dedos no trackpad): aproximar/afastar, ou mover a vista. */
export type GestoDaRoda = { readonly tipo: 'zoom'; readonly fator: number } | { readonly tipo: 'mover'; readonly dx: number; readonly dy: number };

/** O zoom de um "dente" da roda do mouse. */
export const PASSO_DO_ZOOM = 1.15;
/** Pixels de uma "linha" de rolagem, quando o evento vem em linhas. */
const PIXELS_POR_LINHA = 16;

export interface EventoDeRoda {
  readonly deltaX: number;
  readonly deltaY: number;
  /** 0: pixels; 1: linhas; 2: páginas. */
  readonly deltaMode: number;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
}

/**
 * - Com Ctrl (ou ⌘) — e a pinça do trackpad, que o sistema manda como roda com Ctrl —: zoom, proporcional ao
 *   tamanho do gesto e no máximo um dente por evento. Antes cada evento dava um dente inteiro (15%), e a pinça,
 *   que manda dezenas de eventos pequenos, aproximava aos saltos.
 * - No Mac, a rolagem com dois dedos no trackpad move a vista, como nos programas de desenho de lá (antes,
 *   cada um dos muitos eventos do gesto dava um dente de zoom: a vista disparava).
 * - No Windows, a roda do mouse continua sendo o zoom; a rolagem só de lado (a roda inclinada) move a vista
 *   (antes afastava).
 */
export function gestoDaRoda(e: EventoDeRoda, noMac: boolean): GestoDaRoda {
  const fatorDePixels = e.deltaMode === 1 ? PIXELS_POR_LINHA : 1;
  const dx = e.deltaX * fatorDePixels;
  const dy = e.deltaY * fatorDePixels;
  if (e.ctrlKey || e.metaKey) {
    const fator = Math.min(PASSO_DO_ZOOM, Math.max(1 / PASSO_DO_ZOOM, Math.exp(-dy * 0.01)));
    return { tipo: 'zoom', fator };
  }
  if (noMac || dy === 0) return { tipo: 'mover', dx: -dx, dy: -dy };
  return { tipo: 'zoom', fator: dy < 0 ? PASSO_DO_ZOOM : 1 / PASSO_DO_ZOOM };
}

/** Este computador é um Mac (pelo que a página sabe do sistema). */
export function ehMac(navegador: Pick<Navigator, 'userAgent'> | undefined = typeof navigator === 'undefined' ? undefined : navigator): boolean {
  return navegador !== undefined && /Macintosh|Mac OS X/i.test(navegador.userAgent);
}

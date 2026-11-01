import { ehDmpl, hpglDoDmpl } from './dmpl-importacao';
import { hpglDoIso } from './iso-importacao';

/**
 * O que chega no receptor do plotter (ADR 0222), em HPGL. O driver de impressora costuma embrulhar o HP-GL/2 em comandos
 * de PJL e PCL, e isso sai aqui. PostScript e imagem não têm linhas para ler: `null`.
 */
export function hpglDoRecebido(texto: string): string | null {
  // eslint-disable-next-line no-control-regex
  const semPjl = texto.replace(/\x1b%-12345X/g, '').replace(/^@PJL.*$/gm, '');
  // eslint-disable-next-line no-control-regex
  const miolo = /\x1b%-?\d*B([\s\S]*?)(?:\x1b%-?\d*A|$)/.exec(semPjl)?.[1] ?? semPjl;
  // eslint-disable-next-line no-control-regex
  const limpo = miolo.replace(/\x1b[^;]{0,12}?[A-Z@]/g, '').trim();
  if (limpo === '' || limpo.startsWith('%!') || limpo.startsWith('%PDF')) return null;
  if (ehDmpl(limpo)) return hpglDoDmpl(limpo);
  if (/(^|\n)\s*(%\s*\n|G0?[01]\b)/.test(limpo)) return hpglDoIso(limpo);
  return /\b(PD|PA|PU)\s*-?\d/i.test(limpo) ? limpo : null;
}

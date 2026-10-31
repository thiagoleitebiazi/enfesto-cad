import { UNIDADES_POR_MM } from './plt-exportacao';

/**
 * DMPL (ADR 0210), a linguagem dos plotters Houston: lido como o ISO, passando para HPGL e seguindo pelo importador do
 * PLT. Não há especificação pública à mão: estes são os comandos que aparecem nos exemplos públicos (";:" abre, "H" vai
 * à origem, "A" e "R" são absoluto e relativo, "EC" dá a unidade, "U" e "D" levantam e descem a caneta, "Pn" escolhe a
 * caneta e "@" encerra). Nunca foi lido um arquivo de plotter de verdade.
 */

/** A unidade de cada "EC"; sem ele, a dos exemplos. */
const MM_POR_UNIDADE: Readonly<Record<string, number>> = { EC1: 0.0254, EC5: 0.127, ECN: 0.1 };

export const ehDmpl = (texto: string): boolean => /^\s*;:/.test(texto);

export function hpglDoDmpl(texto: string): string {
  const comandos = ['IN', 'SP1'];
  let escala = MM_POR_UNIDADE['EC1']! * UNIDADES_POR_MM;
  let absoluto = true;
  let descida = false;
  let x = 0;
  let y = 0;
  let metade: number | null = null;
  for (const t of texto.toUpperCase().match(/;:|EC[0-9A-Z]|P\d+|[A-Z@]|-?\d+(?:\.\d+)?/g) ?? []) {
    if (t === '@') break;
    if (/^-?\d/.test(t)) {
      if (metade === null) {
        metade = Number(t);
        continue;
      }
      x = absoluto ? metade : x + metade;
      y = absoluto ? Number(t) : y + Number(t);
      metade = null;
      comandos.push(`${descida ? 'PD' : 'PU'}${Math.round(x * escala)},${Math.round(y * escala)}`);
    } else if (t.startsWith('EC')) escala = (MM_POR_UNIDADE[t] ?? MM_POR_UNIDADE['EC1']!) * UNIDADES_POR_MM;
    else if (/^P\d/.test(t)) comandos.push(`SP${t.slice(1)}`);
    else if (t === 'A' || t === 'R') absoluto = t === 'A';
    else if (t === 'U' || t === 'D') descida = t === 'D';
    else if (t === 'H') {
      x = 0;
      y = 0;
      descida = false;
      comandos.push('PU0,0');
    }
  }
  return `${comandos.join(';')};\n`;
}

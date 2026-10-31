import { textoCsv } from '../core/csv';

/**
 * As etiquetas dos feixes (ADR 0159): depois do corte, as peças de cada tamanho são separadas em feixes para a costura.
 * Cada feixe ganha uma etiqueta com a ordem, o produto, a cor, o tamanho, a numeração das roupas dele e um código de
 * barras (Code 39, lido por qualquer leitor comum), para acompanhar o feixe na produção.
 */

export interface DadosDasEtiquetas {
  readonly ordem: string;
  readonly produto?: string;
  readonly cor?: string;
  readonly quantidadesPorTamanho: Readonly<Record<string, number>>;
  readonly pecas: ReadonlyArray<{ readonly nome: string; readonly quantidade: number }>;
  readonly roupasPorFeixe: number;
}

export interface EtiquetaDoFeixe {
  readonly codigo: string;
  readonly ordem: string;
  readonly produto: string;
  readonly cor: string;
  readonly tamanho: string;
  readonly feixe: number;
  readonly feixesDoTamanho: number;
  readonly de: number;
  readonly ate: number;
  readonly roupas: number;
}

const CODE39: Readonly<Record<string, string>> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnw',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  '*': 'nwnnwnwnn',
};

export const padroesDoCode39 = (): Readonly<Record<string, string>> => CODE39;

/** O texto no que o Code 39 aceita: maiúsculas sem acento; o resto vira hífen. */
export function textoParaCode39(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^0-9A-Z. -]/g, '-');
}

/** As barras do código (com os asteriscos de começo e fim): a posição e a largura de cada barra preta, em módulos. */
export function barrasDoCode39(texto: string): { readonly barras: ReadonlyArray<{ readonly x: number; readonly largura: number }>; readonly larguraTotal: number } {
  const barras: Array<{ x: number; largura: number }> = [];
  let x = 0;
  for (const c of `*${textoParaCode39(texto)}*`) {
    [...CODE39[c]!].forEach((e, i) => {
      const largura = e === 'w' ? 3 : 1;
      if (i % 2 === 0) barras.push({ x, largura });
      x += largura;
    });
    x += 1;
  }
  return { barras, larguraTotal: x - 1 };
}

/** Um feixe a cada `roupasPorFeixe` roupas, por tamanho, na ordem da grade; o último fica com o que sobrar. */
export function feixesDaOrdem(d: DadosDasEtiquetas): EtiquetaDoFeixe[] {
  if (!Number.isInteger(d.roupasPorFeixe) || d.roupasPorFeixe < 1) throw new Error('As roupas por feixe precisam ser um número inteiro, de 1 para cima.');
  const etiquetas: EtiquetaDoFeixe[] = [];
  for (const [tamanho, total] of Object.entries(d.quantidadesPorTamanho)) {
    const feixesDoTamanho = Math.ceil(total / d.roupasPorFeixe);
    for (let f = 0; f < feixesDoTamanho; f++) {
      const de = f * d.roupasPorFeixe + 1;
      const ate = Math.min(total, de + d.roupasPorFeixe - 1);
      etiquetas.push({
        codigo: textoParaCode39(`${d.ordem}-${String(etiquetas.length + 1).padStart(3, '0')}`),
        ordem: d.ordem,
        produto: d.produto ?? '',
        cor: d.cor ?? '',
        tamanho,
        feixe: f + 1,
        feixesDoTamanho,
        de,
        ate,
        roupas: ate - de + 1,
      });
    }
  }
  return etiquetas;
}

export function csvDasEtiquetas(etiquetas: readonly EtiquetaDoFeixe[]): string {
  const cabecalho = ['Código', 'Ordem', 'Produto', 'Cor', 'Tamanho', 'Feixe', 'Feixes do tamanho', 'Da roupa', 'Até a roupa', 'Roupas'];
  return textoCsv([cabecalho, ...etiquetas.map((e) => [e.codigo, e.ordem, e.produto, e.cor, e.tamanho, String(e.feixe), String(e.feixesDoTamanho), String(e.de), String(e.ate), String(e.roupas)])]);
}

const escapar = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function barrasEmSvg(codigo: string): string {
  const { barras, larguraTotal } = barrasDoCode39(codigo);
  return `<svg viewBox="0 0 ${larguraTotal} 40" preserveAspectRatio="none" role="img" aria-label="${escapar(codigo)}">${barras.map((b) => `<rect x="${b.x}" y="0" width="${b.largura}" height="40"/>`).join('')}</svg>`;
}

/** A folha para imprimir: uma etiqueta por feixe, com as peças que vão nele. */
export function htmlDasEtiquetas(etiquetas: readonly EtiquetaDoFeixe[], pecas: DadosDasEtiquetas['pecas']): string {
  const lista = pecas.map((p) => `${escapar(p.nome)}${p.quantidade > 1 ? ` × ${p.quantidade}` : ''}`).join(', ');
  const cartoes = etiquetas
    .map(
      (e) => `<article>
<h2>${escapar(e.ordem)} · Tam. ${escapar(e.tamanho)}</h2>
<p>${escapar([e.produto, e.cor].filter((x) => x !== '').join(' · '))}</p>
<p><strong>Feixe ${e.feixe} de ${e.feixesDoTamanho}</strong> · roupas ${e.de} a ${e.ate} (${e.roupas})</p>
<p class="pecas">${lista}</p>
${barrasEmSvg(e.codigo)}
<p class="codigo">${escapar(e.codigo)}</p>
</article>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Etiquetas dos feixes</title>
<style>body{font-family:system-ui,sans-serif;margin:8mm;color:#000}main{display:grid;grid-template-columns:repeat(2,1fr);gap:4mm}article{border:1px dashed #666;padding:3mm;break-inside:avoid}h2{font-size:13pt;margin:0}p{margin:1mm 0;font-size:10pt}.pecas{font-size:8pt}svg{width:100%;height:12mm;display:block;margin-top:1mm}.codigo{text-align:center;font-family:monospace}</style>
</head><body><main>
${cartoes}
</main></body></html>
`;
}

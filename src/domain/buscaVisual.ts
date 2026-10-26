import type { ImagemDePixels } from './digitalizacao';

/**
 * A busca por imagem na biblioteca (ADR 0145): uma foto (de uma vitrine, de um caderno de tendências, de uma peça da
 * coleção passada) é comparada às imagens dos modelos guardados, e os mais parecidos vêm primeiro. A comparação é a de
 * duas assinaturas pequenas de cada imagem:
 * - a forma: o "hash de diferença" (64 bits: cada ponto de uma miniatura 9 × 8 em tons de cinza é mais claro ou mais
 *   escuro que o vizinho da direita) — parecido com o desenho da peça, não muda com o tamanho da foto;
 * - as cores: a proporção de cada uma de 64 faixas de cor, sem o fundo quase branco.
 * Não é reconhecimento de imagem: acha o parecido no traço e nas cores, não "a mesma peça em outra pose".
 */

export interface AssinaturaVisual {
  /** 64 zeros e uns. */
  readonly forma: readonly number[];
  /** 64 proporções que somam 1 (ou todas zero: imagem só de fundo). */
  readonly cores: readonly number[];
}

/** A média dos tons de cinza de cada célula de uma grade `colunas` × `linhas`. */
function miniatura(img: ImagemDePixels, colunas: number, linhas: number): number[] {
  const soma = new Array<number>(colunas * linhas).fill(0);
  const conta = new Array<number>(colunas * linhas).fill(0);
  for (let y = 0; y < img.altura; y++) {
    const linha = Math.min(linhas - 1, Math.floor((y * linhas) / img.altura));
    for (let x = 0; x < img.largura; x++) {
      const coluna = Math.min(colunas - 1, Math.floor((x * colunas) / img.largura));
      const i = (y * img.largura + x) * 4;
      const a = img.dados[i + 3]! / 255;
      // O transparente conta como fundo branco.
      const cinza = a * (0.299 * img.dados[i]! + 0.587 * img.dados[i + 1]! + 0.114 * img.dados[i + 2]!) + (1 - a) * 255;
      soma[linha * colunas + coluna]! += cinza;
      conta[linha * colunas + coluna]! += 1;
    }
  }
  return soma.map((s, k) => (conta[k]! > 0 ? s / conta[k]! : 255));
}

export function assinaturaDaImagem(img: ImagemDePixels): AssinaturaVisual {
  const mini = miniatura(img, 9, 8);
  const forma: number[] = [];
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) forma.push(mini[y * 9 + x]! < mini[y * 9 + x + 1]! ? 1 : 0);
  const cores = new Array<number>(64).fill(0);
  let total = 0;
  for (let i = 0; i < img.dados.length; i += 4) {
    const [r, g, b, a] = [img.dados[i]!, img.dados[i + 1]!, img.dados[i + 2]!, img.dados[i + 3]!];
    if (a < 128 || (r > 235 && g > 235 && b > 235)) continue;
    cores[(r >> 6) * 16 + (g >> 6) * 4 + (b >> 6)]! += 1;
    total++;
  }
  return { forma, cores: total > 0 ? cores.map((c) => c / total) : cores };
}

/** De 0 (nada a ver) a 1 (a mesma): metade pela forma, metade pelas cores. */
export function semelhanca(a: AssinaturaVisual, b: AssinaturaVisual): number {
  const diferentes = a.forma.reduce((s, bit, i) => s + (bit === b.forma[i] ? 0 : 1), 0);
  const distanciaDasCores = a.cores.reduce((s, c, i) => s + Math.abs(c - b.cores[i]!), 0);
  return 0.5 * (1 - diferentes / 64) + 0.5 * (1 - Math.min(2, distanciaDasCores) / 2);
}

/** Os candidatos do mais parecido ao menos; cada um vale pela sua imagem mais parecida. Os sem imagem ficam de fora. */
export function maisParecidos<T extends { readonly assinaturas: readonly AssinaturaVisual[] }>(
  referencia: AssinaturaVisual,
  candidatos: readonly T[],
): Array<{ readonly candidato: T; readonly semelhanca: number }> {
  return candidatos
    .filter((c) => c.assinaturas.length > 0)
    .map((c) => ({ candidato: c, semelhanca: Math.max(...c.assinaturas.map((a) => semelhanca(referencia, a))) }))
    .sort((x, y) => y.semelhanca - x.semelhanca);
}

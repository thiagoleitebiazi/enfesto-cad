import { create } from 'fontkit';

/** A fonte TrueType do PDF (ADR 0211, 0225): a fontkit só confere o arquivo; quem embute é o pdfkit. */
export interface FonteDoPdf {
  readonly nome: string;
  readonly bytes: Uint8Array;
}

/** O arquivo da fonte; dá erro se não for uma fonte. */
export function fonteDoArquivo(bytes: Uint8Array, nome: string): FonteDoPdf {
  const fonte = create(bytes) as { readonly unitsPerEm?: number };
  if (typeof fonte.unitsPerEm !== 'number') throw new Error('Este arquivo tem várias fontes dentro: escolha um .ttf ou .otf de uma só.');
  return { nome, bytes };
}

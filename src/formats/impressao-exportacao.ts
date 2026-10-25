import PDFDocument from 'pdfkit';
// @ts-expect-error @types/pdfkit ainda não declara este export nomeado (existe em runtime, ver node_modules/pdfkit/js/pdfkit.browser.mjs)
import { registerStdFonts } from 'pdfkit';
// @ts-expect-error módulo de dados de fonte sem tipos próprios
import Helvetica from 'pdfkit/standard-fonts/Helvetica';
import blobStream from 'blob-stream';
import type { Molde } from '../domain/molde';
import { linhaDeCorteDaPeca } from '../domain/molde';
import { deslocarContornoParaFora, retanguloEnvolvente, type Contorno } from '../core/geometria';
import type { ConfiguracaoDeEnfesto } from '../domain/enfesto';
import { colocacaoNaPeca, estampaDaPeca, trechosDoComprimento, type ImpressaoDigital, type Matriz } from '../domain/impressaoDigital';
import { comprimentoDoEncaixeAImprimirMm, mmParaPontos } from './pdf-exportacao';

if (typeof registerStdFonts === 'function') {
  registerStdFonts(Helvetica);
}

/** Uma imagem que pode ir para a impressão: os dados (data URL) e o tamanho em px. */
export interface ImagemParaImpressao {
  readonly dados: string;
  readonly larguraPx: number;
  readonly alturaPx: number;
}

/**
 * O PDF para a impressão digital do tecido (ADR 0113): uma página por trecho do comprimento (até 5 m), na escala 1:1,
 * com a largura útil do tecido na horizontal e o comprimento descendo — a vista da tela girada (não espelhada: a
 * face do tecido sai como a tela mostra). Em cada peça, a estampa recortada pela linha de corte com a sangria; a linha
 * de corte, se pedida, num traço fino cinza. O resto do tecido fica sem tinta. A imagem entra uma vez no arquivo.
 */
export async function gerarPdfParaImpressaoDigital(
  pecas: readonly Molde[],
  enfesto: ConfiguracaoDeEnfesto,
  imagens: ReadonlyMap<string, ImagemParaImpressao>,
  config: ImpressaoDigital,
  titulo: string,
): Promise<Blob> {
  const largura = enfesto.larguraUtilMm;
  const comprimento = comprimentoDoEncaixeAImprimirMm(pecas, enfesto);
  const trechos = trechosDoComprimento(comprimento);
  const k = mmParaPontos(1);
  const primeiro = trechos[0]!;
  const doc = new PDFDocument({ size: [k * largura, k * (primeiro.ate - primeiro.de)], margin: 0, compress: false, info: { Title: titulo, Creator: 'Enfesto CAD' } });
  trechos.forEach((trecho, i) => {
    if (i > 0) doc.addPage({ size: [k * largura, k * (trecho.ate - trecho.de)], margin: 0 });
    // Do mundo (mm) para a página (pontos): a largura (o x do mundo) ao contrário na horizontal, o comprimento descendo.
    const mundoParaPagina: Matriz = [-k, 0, 0, k, k * largura, -k * trecho.de];
    for (const peca of pecas) {
      const corte = linhaDeCorteDaPeca(peca);
      if (corte.length < 3) continue;
      const caixa = retanguloEnvolvente(corte);
      if (caixa.maxY < trecho.de - 50 || caixa.minY > trecho.ate + 50) continue;
      const estampa = estampaDaPeca(config, peca.id);
      const imagem = estampa ? imagens.get(estampa.imagemId) : undefined;
      if (estampa && imagem) {
        const recorte = config.sangriaMm > 0 ? deslocarContornoSeguro(corte, config.sangriaMm) : corte;
        const colocacao = colocacaoNaPeca(peca, estampa, imagem.larguraPx, imagem.alturaPx, config.sangriaMm, config.giroPorPeca?.[peca.id] ?? 0);
        doc.save();
        doc.transform(...mundoParaPagina);
        tracar(doc, recorte);
        doc.clip();
        doc.transform(...colocacao.imagemParaMundo);
        for (const l of colocacao.ladrilhos) doc.image(imagem.dados, l.x, l.y, { width: imagem.larguraPx, height: imagem.alturaPx });
        doc.restore();
      }
      if (config.linhaDeCorte) {
        doc.save();
        doc.transform(...mundoParaPagina);
        tracar(doc, corte);
        doc.lineWidth(0.25).strokeColor('#808080').stroke();
        doc.restore();
      }
    }
  });
  return new Promise((resolve, reject) => {
    const stream = doc.pipe(blobStream());
    stream.on('finish', () => resolve(stream.toBlob('application/pdf')));
    stream.on('error', reject);
    doc.end();
  });
}

function tracar(doc: PDFKit.PDFDocument, contorno: Contorno): void {
  doc.moveTo(contorno[0]!.x, contorno[0]!.y);
  for (let i = 1; i < contorno.length; i++) doc.lineTo(contorno[i]!.x, contorno[i]!.y);
  doc.closePath();
}

/** A linha de corte com a sangria; se o contorno não deixa deslocar (um contorno inválido), a linha como está. */
function deslocarContornoSeguro(contorno: Contorno, mm: number): Contorno {
  try {
    return deslocarContornoParaFora(contorno, mm);
  } catch {
    return contorno;
  }
}

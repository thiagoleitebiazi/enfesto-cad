import PDFDocument from 'pdfkit';
// @ts-expect-error @types/pdfkit ainda não declara este export nomeado (existe em runtime, ver node_modules/pdfkit/js/pdfkit.browser.mjs)
import { registerStdFonts } from 'pdfkit';
// @ts-expect-error módulo de dados de fonte sem tipos próprios
import Helvetica from 'pdfkit/standard-fonts/Helvetica';
import blobStream from 'blob-stream';
import type { Molde } from '../domain/molde';
import { contornoDeCorte } from '../domain/molde';
import type { ConfiguracaoDeEnfesto } from '../domain/enfesto';
import { retanguloEnvolvente, type Contorno, type Ponto2D } from '../core/geometria';

// A build para navegador do pdfkit (usada no processo de renderer do
// Electron) não lê fontes do disco como a build Node — é preciso registrar
// os dados da fonte padrão explicitamente antes de usá-la. Registrado uma
// única vez, no carregamento do módulo. Sob Node (ex.: testes via vitest),
// o pdfkit resolve para a build Node, que carrega fontes do disco sozinha e
// nem exporta `registerStdFonts` — daí a checagem antes de chamar.
if (typeof registerStdFonts === 'function') {
  registerStdFonts(Helvetica);
}

/**
 * Exportação de PDF vetorial em escala 1:1 (seção 8 do escopo). Todo
 * contorno vira operações de linha/curva reais no PDF (moveTo/lineTo),
 * nunca uma imagem rasterizada. Unidade interna: mm; convertida para
 * pontos PDF (72/polegada) só no momento de desenhar.
 *
 * `compress: false` deliberado — arquivos de molde/encaixe são pequenos
 * o bastante para o tamanho não importar, e isso permite inspecionar/
 * testar o conteúdo do PDF gerado diretamente (ver pdf-exportacao.test.ts).
 */

export type FormatoDePagina = 'A4' | 'A3' | 'Letter';
export type OrientacaoDePagina = 'retrato' | 'paisagem';

export interface OpcoesDePagina {
  readonly formato: FormatoDePagina;
  readonly orientacao: OrientacaoDePagina;
  readonly margemMm: number;
}

const TAMANHOS_DE_PAGINA_MM: Record<FormatoDePagina, { largura: number; altura: number }> = {
  A4: { largura: 210, altura: 297 },
  A3: { largura: 297, altura: 420 },
  Letter: { largura: 215.9, altura: 279.4 },
};

export const PONTOS_POR_MM = 72 / 25.4;

export function mmParaPontos(valorMm: number): number {
  return valorMm * PONTOS_POR_MM;
}

export function dimensoesDaPaginaMm(opcoes: OpcoesDePagina): { largura: number; altura: number } {
  const base = TAMANHOS_DE_PAGINA_MM[opcoes.formato];
  return opcoes.orientacao === 'paisagem'
    ? { largura: base.altura, altura: base.largura }
    : { largura: base.largura, altura: base.altura };
}

function novoDocumento(opcoes: OpcoesDePagina): PDFKit.PDFDocument {
  const pagina = dimensoesDaPaginaMm(opcoes);
  return new PDFDocument({
    size: [mmParaPontos(pagina.largura), mmParaPontos(pagina.altura)],
    margin: 0,
    compress: false,
  });
}

async function finalizarComoBlob(doc: PDFKit.PDFDocument): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const stream = doc.pipe(blobStream());
    stream.on('finish', () => resolve(stream.toBlob('application/pdf')));
    stream.on('error', reject);
    doc.end();
  });
}

/** Traça um contorno (mm, relativo à origem da página) como um caminho vetorial real. */
function tracarContorno(doc: PDFKit.PDFDocument, contorno: Contorno, origem: Ponto2D): void {
  if (contorno.length === 0) return;
  doc.moveTo(mmParaPontos(contorno[0]!.x - origem.x), mmParaPontos(contorno[0]!.y - origem.y));
  for (let i = 1; i < contorno.length; i++) {
    doc.lineTo(mmParaPontos(contorno[i]!.x - origem.x), mmParaPontos(contorno[i]!.y - origem.y));
  }
  doc.closePath();
}

function desenharSeta(doc: PDFKit.PDFDocument, inicio: Ponto2D, fim: Ponto2D, origem: Ponto2D): void {
  const i = { x: mmParaPontos(inicio.x - origem.x), y: mmParaPontos(inicio.y - origem.y) };
  const f = { x: mmParaPontos(fim.x - origem.x), y: mmParaPontos(fim.y - origem.y) };
  doc.moveTo(i.x, i.y).lineTo(f.x, f.y).stroke();

  const angulo = Math.atan2(f.y - i.y, f.x - i.x);
  const tamanhoPonta = mmParaPontos(4);
  doc
    .moveTo(f.x, f.y)
    .lineTo(f.x - tamanhoPonta * Math.cos(angulo - Math.PI / 7), f.y - tamanhoPonta * Math.sin(angulo - Math.PI / 7))
    .lineTo(f.x - tamanhoPonta * Math.cos(angulo + Math.PI / 7), f.y - tamanhoPonta * Math.sin(angulo + Math.PI / 7))
    .closePath()
    .fill();
}

function desenharPique(doc: PDFKit.PDFDocument, peca: Molde, indice: number, origem: Ponto2D): void {
  const pique = peca.piques[indice]!;
  const n = peca.contorno.length;
  const a = peca.contorno[pique.indiceAresta % n]!;
  const b = peca.contorno[(pique.indiceAresta + 1) % n]!;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const comprimento = Math.hypot(dx, dy) || 1;
  const normalX = dy / comprimento;
  const normalY = -dx / comprimento;
  const tamanhoMm = 6;
  const p1 = { x: pique.posicao.x, y: pique.posicao.y };
  const p2 = { x: pique.posicao.x + normalX * tamanhoMm, y: pique.posicao.y + normalY * tamanhoMm };
  doc
    .moveTo(mmParaPontos(p1.x - origem.x), mmParaPontos(p1.y - origem.y))
    .lineTo(mmParaPontos(p2.x - origem.x), mmParaPontos(p2.y - origem.y))
    .stroke();
}

/** Desenha uma peça completa (contorno, furos, linhas internas, linha de corte, piques, fio, rótulo). */
function desenharPeca(doc: PDFKit.PDFDocument, peca: Molde, origem: Ponto2D): void {
  doc.lineWidth(mmParaPontos(0.25));

  doc.save();
  tracarContorno(doc, peca.contorno, origem);
  for (const furo of peca.furos) tracarContorno(doc, furo, origem);
  doc.fillColor('#f4f5f7').fillOpacity(1);
  doc.fillAndStroke('#f4f5f7', '#000000');
  doc.restore();

  for (const furo of peca.furos) {
    doc.save();
    tracarContorno(doc, furo, origem);
    doc.stroke('#000000');
    doc.restore();
  }

  for (const linha of peca.linhasInternas) {
    doc.save();
    tracarContorno(doc, linha, origem);
    doc.dash(mmParaPontos(1.5), { space: mmParaPontos(1) });
    doc.stroke('#000000');
    doc.undash();
    doc.restore();
  }

  if (peca.margemDeCosturaMm > 0) {
    doc.save();
    tracarContorno(doc, contornoDeCorte(peca), origem);
    doc.dash(mmParaPontos(3), { space: mmParaPontos(2) });
    doc.stroke('#555555');
    doc.undash();
    doc.restore();
  }

  doc.save();
  doc.fillColor('#c62828').strokeColor('#c62828');
  desenharSeta(doc, peca.linhaDeFio.inicio, peca.linhaDeFio.fim, origem);
  doc.restore();

  doc.save();
  doc.strokeColor('#8e24aa');
  for (let i = 0; i < peca.piques.length; i++) desenharPique(doc, peca, i, origem);
  doc.restore();

  doc.save();
  doc.fillColor('#00838f');
  for (const marca of peca.marcas) {
    const p = { x: mmParaPontos(marca.posicao.x - origem.x), y: mmParaPontos(marca.posicao.y - origem.y) };
    doc.circle(p.x, p.y, mmParaPontos(1.2)).fill();
  }
  doc.restore();

  const bbox = retanguloEnvolvente(peca.contorno);
  const centroTexto = { x: mmParaPontos(bbox.minX - origem.x + 2), y: mmParaPontos(bbox.minY - origem.y + 2) };
  doc.save();
  doc.fillColor('#000000').fontSize(mmParaPontos(3));
  doc.text(`${peca.nome} (${peca.referencia || '—'}) ${peca.tamanho}`, centroTexto.x, centroTexto.y);
  doc.restore();
}

/** Régua de referência: uma linha de 100mm com marcação, para conferir a escala após imprimir. */
function desenharReguaDeReferencia(doc: PDFKit.PDFDocument, xMm: number, yMm: number): void {
  const x = mmParaPontos(xMm);
  const y = mmParaPontos(yMm);
  const comprimento = mmParaPontos(100);
  doc.save();
  doc.lineWidth(mmParaPontos(0.3)).strokeColor('#000000');
  doc.moveTo(x, y).lineTo(x + comprimento, y).stroke();
  doc.moveTo(x, y - mmParaPontos(2)).lineTo(x, y + mmParaPontos(2)).stroke();
  doc
    .moveTo(x + comprimento, y - mmParaPontos(2))
    .lineTo(x + comprimento, y + mmParaPontos(2))
    .stroke();
  doc.fillColor('#000000').fontSize(mmParaPontos(3));
  doc.text('100 mm — conferir escala após imprimir', x, y + mmParaPontos(3));
  doc.restore();
}

export interface OpcoesDeExportacaoDeEncaixe extends OpcoesDePagina {
  readonly tecidoNome?: string;
}

/**
 * PDF do encaixe completo (tipo A da seção 8): tecido, moldes posicionados,
 * limites, dimensões, comprimento e quantidade de camadas. Se a área
 * configurada for maior que uma folha, o resultado sai em várias páginas
 * (ladrilhado), cada uma com uma etiqueta de posição para remontagem.
 */
export async function gerarPdfDeEncaixe(
  pecas: readonly Molde[],
  enfesto: ConfiguracaoDeEnfesto,
  opcoes: OpcoesDeExportacaoDeEncaixe,
): Promise<Blob> {
  const doc = novoDocumento(opcoes);
  const pagina = dimensoesDaPaginaMm(opcoes);
  const larguraImprimivel = pagina.largura - 2 * opcoes.margemMm;
  const alturaImprimivel = pagina.altura - 2 * opcoes.margemMm;

  const larguraTotal = enfesto.larguraUtilMm;
  const alturaTotal = enfesto.comprimentoMm;
  const colunas = Math.max(1, Math.ceil(larguraTotal / larguraImprimivel));
  const linhas = Math.max(1, Math.ceil(alturaTotal / alturaImprimivel));
  const totalDePaginas = colunas * linhas;

  let indicePagina = 0;
  for (let linha = 0; linha < linhas; linha++) {
    for (let coluna = 0; coluna < colunas; coluna++) {
      if (indicePagina > 0) doc.addPage();
      indicePagina++;

      const origem = { x: coluna * larguraImprimivel, y: linha * alturaImprimivel };

      doc.save();
      doc.rect(mmParaPontos(opcoes.margemMm), mmParaPontos(opcoes.margemMm), mmParaPontos(larguraImprimivel), mmParaPontos(alturaImprimivel));
      doc.clip();
      doc.translate(mmParaPontos(opcoes.margemMm), mmParaPontos(opcoes.margemMm));

      for (const peca of pecas) desenharPeca(doc, peca, origem);

      doc.restore();

      doc.save();
      doc.fontSize(mmParaPontos(3)).fillColor('#000000');
      doc.text(
        `Página ${indicePagina}/${totalDePaginas} (linha ${linha + 1}, coluna ${coluna + 1}) — ${opcoes.tecidoNome ?? 'tecido não identificado'} — largura útil ${larguraTotal} mm, comprimento ${alturaTotal} mm, ${enfesto.quantidadeDeCamadas} camada(s)`,
        mmParaPontos(2),
        mmParaPontos(2),
        { width: mmParaPontos(pagina.largura - 4) },
      );
      doc.restore();

      if (indicePagina === 1) {
        desenharReguaDeReferencia(doc, opcoes.margemMm, pagina.altura - opcoes.margemMm - 15);
      }
    }
  }

  return finalizarComoBlob(doc);
}

/**
 * PDF de moldes individuais (tipo B da seção 8): cada peça em escala real,
 * uma ou mais páginas por peça se ela for maior que uma folha.
 */
export async function gerarPdfDeMoldesIndividuais(
  pecas: readonly Molde[],
  opcoes: OpcoesDePagina,
): Promise<Blob> {
  const doc = novoDocumento(opcoes);
  const pagina = dimensoesDaPaginaMm(opcoes);
  const larguraImprimivel = pagina.largura - 2 * opcoes.margemMm;
  const alturaImprimivel = pagina.altura - 2 * opcoes.margemMm;

  let primeiraPagina = true;
  for (const peca of pecas) {
    const bbox = retanguloEnvolvente(peca.contorno);
    const colunas = Math.max(1, Math.ceil(bbox.largura / larguraImprimivel));
    const linhas = Math.max(1, Math.ceil(bbox.altura / alturaImprimivel));
    const totalDePaginasDaPeca = colunas * linhas;

    let indiceNaPeca = 0;
    for (let linha = 0; linha < linhas; linha++) {
      for (let coluna = 0; coluna < colunas; coluna++) {
        if (!primeiraPagina) doc.addPage();
        primeiraPagina = false;
        indiceNaPeca++;

        const origem = { x: bbox.minX + coluna * larguraImprimivel, y: bbox.minY + linha * alturaImprimivel };

        doc.save();
        doc.rect(mmParaPontos(opcoes.margemMm), mmParaPontos(opcoes.margemMm), mmParaPontos(larguraImprimivel), mmParaPontos(alturaImprimivel));
        doc.clip();
        doc.translate(mmParaPontos(opcoes.margemMm), mmParaPontos(opcoes.margemMm));
        desenharPeca(doc, peca, origem);
        doc.restore();

        doc.save();
        doc.fontSize(mmParaPontos(3)).fillColor('#000000');
        doc.text(
          `${peca.nome} (${peca.referencia || '—'}) ${peca.tamanho} — página ${indiceNaPeca}/${totalDePaginasDaPeca} — quantidade: ${peca.quantidade}`,
          mmParaPontos(2),
          mmParaPontos(2),
          { width: mmParaPontos(pagina.largura - 4) },
        );
        doc.restore();

        desenharReguaDeReferencia(doc, opcoes.margemMm, pagina.altura - opcoes.margemMm - 15);
      }
    }
  }

  return finalizarComoBlob(doc);
}

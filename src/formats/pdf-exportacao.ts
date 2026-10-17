import PDFDocument from 'pdfkit';
// @ts-expect-error @types/pdfkit ainda não declara este export nomeado (existe em runtime, ver node_modules/pdfkit/js/pdfkit.browser.mjs)
import { registerStdFonts } from 'pdfkit';
// @ts-expect-error módulo de dados de fonte sem tipos próprios
import Helvetica from 'pdfkit/standard-fonts/Helvetica';
import blobStream from 'blob-stream';
import type { Molde } from '../domain/molde';
import { contornoDeCorte, linhaDeCorteDaPeca } from '../domain/molde';
import { arestaDeSimetria, ondeEscreverOCodigo } from '../domain/anotacoes';
import { tracosDaMarca, tracosDoPique, tracosNaLinhaDeCorte } from '../domain/piques';
import { linhasDoMolde } from '../domain/linhasAuxiliares';
import { registroDaPeca } from './pdf-registro';
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

/** O menor espaço (mm) que a margem pode deixar na folha, em cada direção: a régua de conferência tem 100 mm. */
export const ESPACO_MINIMO_NA_FOLHA_MM = 110;

/** A maior margem (mm, inteira) que ainda deixa o espaço mínimo na folha escolhida. */
export function margemMaximaMm(opcoes: Pick<OpcoesDePagina, 'formato' | 'orientacao'>): number {
  const pagina = dimensoesDaPaginaMm({ ...opcoes, margemMm: 0 });
  return Math.floor((Math.min(pagina.largura, pagina.altura) - ESPACO_MINIMO_NA_FOLHA_MM) / 2);
}

/**
 * A parte da folha que recebe o desenho, sem as margens. Erro se a margem não deixa espaço: antes, uma margem
 * de metade da folha dava área zero, e o ladrilhamento virava um laço sem fim que travava o programa.
 */
export function areaImprimivelMm(opcoes: OpcoesDePagina): { largura: number; altura: number } {
  if (!Number.isFinite(opcoes.margemMm) || opcoes.margemMm < 0) throw new Error('A margem precisa ser um número de 0 mm para cima.');
  const maxima = margemMaximaMm(opcoes);
  if (opcoes.margemMm > maxima) {
    throw new Error(`A margem de ${opcoes.margemMm} mm não deixa espaço na folha ${opcoes.formato} (${opcoes.orientacao}): ela vai até ${maxima} mm.`);
  }
  const pagina = dimensoesDaPaginaMm(opcoes);
  return { largura: pagina.largura - 2 * opcoes.margemMm, altura: pagina.altura - 2 * opcoes.margemMm };
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
  const tracos = [...tracosDoPique(peca, pique), ...(tracosNaLinhaDeCorte(peca, pique) ?? [])];
  // O pique com formato começa por um traço sem comprimento no ponto dele: é por ele que a importação do PDF acha onde o pique está.
  const comAPosicao = pique.formato ? [[pique.posicao, pique.posicao], ...tracos] : tracos;
  for (const traco of comAPosicao) {
    traco.forEach((q, k) => {
      const [x, y] = [mmParaPontos(q.x - origem.x), mmParaPontos(q.y - origem.y)];
      if (k === 0) doc.moveTo(x, y);
      else doc.lineTo(x, y);
    });
  }
  doc.stroke();
  // O código de relacionamento, escrito do lado de dentro da peça, em frente ao pique.
  if (pique.codigo) {
    doc.save();
    doc.fillColor('#8e24aa').fontSize(mmParaPontos(3));
    escreverCentrado(doc, pique.codigo, ondeEscreverOCodigo(peca, pique, 4), origem);
    doc.restore();
  }
}

/** Escreve o texto centrado no ponto (mm), no tamanho de letra já escolhido no documento. */
function escreverCentrado(doc: PDFKit.PDFDocument, texto: string, centro: Ponto2D, origem: Ponto2D): void {
  const x = mmParaPontos(centro.x - origem.x) - doc.widthOfString(texto) / 2;
  const y = mmParaPontos(centro.y - origem.y) - doc.currentLineHeight() / 2;
  doc.text(texto, x, y, { lineBreak: false });
}

/**
 * Desenha uma peça completa (contorno, furos, linhas internas, linha de corte,
 * linha de simetria, piques com o código, fio, textos, rótulo).
 */
/**
 * Desenha a peça na página, com `origem` no canto dela. Com `comRegistro`, escreve também o registro da peça —
 * ela inteira, num comentário do PDF, que não aparece na folha: é por ele que a importação a traz de volta como era.
 */
function desenharPeca(doc: PDFKit.PDFDocument, peca: Molde, origem: Ponto2D, comRegistro = false): void {
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

  // Só as linhas que fazem parte do molde: os elementos de construção ficam fora do PDF.
  for (const linha of linhasDoMolde(peca)) {
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

  // Linha de simetria: traço e ponto por cima da aresta em que a peça dobra.
  const simetria = arestaDeSimetria(peca);
  if (simetria !== null) {
    const de = peca.contorno[simetria]!;
    const ate = peca.contorno[(simetria + 1) % peca.contorno.length]!;
    doc.save();
    doc.lineWidth(mmParaPontos(0.6));
    // @ts-expect-error @types/pdfkit só declara o traço simples; o pdfkit aceita o padrão inteiro (traço, vão, ponto, vão)
    doc.dash([mmParaPontos(6), mmParaPontos(2), mmParaPontos(1), mmParaPontos(2)], {});
    doc
      .moveTo(mmParaPontos(de.x - origem.x), mmParaPontos(de.y - origem.y))
      .lineTo(mmParaPontos(ate.x - origem.x), mmParaPontos(ate.y - origem.y))
      .stroke('#6a1b9a');
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
    // A marca com formato é um pique interno: sai traçada pelo formato, na cor das marcas.
    const doFormato = tracosDaMarca(marca);
    if (doFormato) {
      doc.strokeColor('#00838f');
      for (const traco of doFormato) {
        traco.forEach((q, k) => {
          const [x, y] = [mmParaPontos(q.x - origem.x), mmParaPontos(q.y - origem.y)];
          if (k === 0) doc.moveTo(x, y);
          else doc.lineTo(x, y);
        });
      }
      doc.stroke();
      continue;
    }
    const p = { x: mmParaPontos(marca.posicao.x - origem.x), y: mmParaPontos(marca.posicao.y - origem.y) };
    doc.circle(p.x, p.y, mmParaPontos(1.2)).fill();
  }
  doc.restore();

  // Textos da peça: centrados no ponto em que foram postos, com as letras na altura pedida.
  for (const texto of peca.textos ?? []) {
    doc.save();
    doc.fillColor('#000000').fontSize(mmParaPontos(texto.alturaMm));
    if (texto.anguloGraus === undefined) {
      escreverCentrado(doc, texto.texto, texto.posicao, origem);
    } else {
      // O "Pique texto" acompanha a peça: na folha os eixos da tela vêm trocados, e a linha do texto, que na tela
      // está a `anguloGraus`, fica a 90° + esse ângulo (as letras não são espelhadas).
      const [x, y] = [mmParaPontos(texto.posicao.x - origem.x), mmParaPontos(texto.posicao.y - origem.y)];
      const largura = doc.widthOfString(texto.texto);
      const antes = texto.ancora === 'inicio' ? 0 : texto.ancora === 'fim' ? largura : largura / 2;
      doc.rotate(90 + texto.anguloGraus, { origin: [x, y] });
      doc.text(texto.texto, x - antes, y - doc.currentLineHeight() / 2, { lineBreak: false });
    }
    doc.restore();
  }

  const bbox = retanguloEnvolvente(peca.contorno);
  const centroTexto = { x: mmParaPontos(bbox.minX - origem.x + 2), y: mmParaPontos(bbox.minY - origem.y + 2) };
  doc.save();
  doc.fillColor('#000000').fontSize(mmParaPontos(3));
  // Sem quebra de linha: com ela, o texto que cai fora da folha (a peça de outra folha do ladrilhado) fazia o
  // PDFKit abrir folhas novas sozinho — folhas em branco no meio, e a numeração da remontagem errada.
  doc.text(`${peca.nome} (${peca.referencia || '—'}) ${peca.tamanho}`, centroTexto.x, centroTexto.y, { lineBreak: false });
  doc.restore();

  if (comRegistro) doc.addContent(registroDaPeca(peca, origem));
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
 * Até onde o PDF do encaixe vai no comprimento: até a ponta da peça mais distante, mais a margem de
 * extremidade. Antes ia sempre até o fim da mesa — numa mesa de 10 m com um risco de 3 m, mais de cem folhas
 * em branco. Sem peças, a mesa inteira.
 */
export function comprimentoDoEncaixeAImprimirMm(pecas: readonly Molde[], enfesto: ConfiguracaoDeEnfesto): number {
  const comContorno = pecas.filter((p) => p.contorno.length > 0);
  if (comContorno.length === 0) return enfesto.comprimentoMm;
  return Math.max(...comContorno.map((p) => retanguloEnvolvente(linhaDeCorteDaPeca(p)).maxY)) + enfesto.margemDeExtremidadeMm;
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
  const { largura: larguraImprimivel, altura: alturaImprimivel } = areaImprimivelMm(opcoes);
  const doc = novoDocumento(opcoes);
  const pagina = dimensoesDaPaginaMm(opcoes);

  const larguraTotal = enfesto.larguraUtilMm;
  const alturaTotal = comprimentoDoEncaixeAImprimirMm(pecas, enfesto);
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

      // Só as peças que caem nesta folha.
      for (const peca of pecas) {
        const caixa = retanguloEnvolvente(linhaDeCorteDaPeca(peca));
        const naFolha =
          caixa.maxX >= origem.x && caixa.minX <= origem.x + larguraImprimivel && caixa.maxY >= origem.y && caixa.minY <= origem.y + alturaImprimivel;
        if (naFolha) desenharPeca(doc, peca, origem);
      }

      doc.restore();

      doc.save();
      doc.fontSize(mmParaPontos(3)).fillColor('#000000');
      doc.text(
        `Página ${indicePagina}/${totalDePaginas} (linha ${linha + 1}, coluna ${coluna + 1}) — ${opcoes.tecidoNome ?? 'tecido não identificado'} — largura útil ${larguraTotal} mm, comprimento usado ${Math.round(alturaTotal)} mm (mesa de ${enfesto.comprimentoMm} mm), ${enfesto.quantidadeDeCamadas} camada(s)`,
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
  const { largura: larguraImprimivel, altura: alturaImprimivel } = areaImprimivelMm(opcoes);
  const doc = novoDocumento(opcoes);
  const pagina = dimensoesDaPaginaMm(opcoes);

  let primeiraPagina = true;
  for (const peca of pecas) {
    // A folha enquadra a linha de corte: enquadrando o contorno, a costura (que fica fora dele) saía cortada na beira.
    const bbox = retanguloEnvolvente(linhaDeCorteDaPeca(peca));
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
        // O registro vai só na primeira página da peça: nas outras (a peça maior que uma folha) seria ela de novo.
        desenharPeca(doc, peca, origem, indiceNaPeca === 1);
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

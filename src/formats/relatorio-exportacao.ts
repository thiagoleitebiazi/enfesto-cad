import PDFDocument from 'pdfkit';
// @ts-expect-error @types/pdfkit ainda não declara este export nomeado (existe em runtime, ver node_modules/pdfkit/js/pdfkit.browser.mjs)
import { registerStdFonts } from 'pdfkit';
// @ts-expect-error módulo de dados de fonte sem tipos próprios
import Helvetica from 'pdfkit/standard-fonts/Helvetica';
// @ts-expect-error módulo de dados de fonte sem tipos próprios
import HelveticaBold from 'pdfkit/standard-fonts/HelveticaBold';
import blobStream from 'blob-stream';
import ExcelJS from 'exceljs';
import { numeroComVirgula } from '../core/numeros';
import type { RelatorioDeProducao } from '../domain/relatorio';

// Este módulo usa negrito (.font('Helvetica-Bold')) além da fonte regular —
// registra os dois pesos, diferente de pdf-exportacao.ts que só usa a fonte
// padrão do pdfkit e por isso nunca precisou de Helvetica-Bold.
if (typeof registerStdFonts === 'function') {
  registerStdFonts(Helvetica, HelveticaBold);
}

/**
 * Exportação do relatório de produção (seção 12): PDF e Excel, cada um
 * associável ao projeto na biblioteca pela UI (não aqui — este módulo só
 * gera o Blob).
 */

function linhaDeCampo(doc: PDFKit.PDFDocument, rotulo: string, valor: string, y: number): void {
  doc.fontSize(10).font('Helvetica-Bold').text(rotulo, 40, y, { continued: true });
  doc.font('Helvetica').text(`  ${valor}`);
}

/** O número com vírgula, ou o travessão quando não há (as unidades ficam no texto, como antes). */
const ouTraco = (valor: number | null, casas?: number): string => (valor === null ? '—' : numeroComVirgula(valor, casas));

/** O peso de uma linha de "Peças por tamanho", como o PDF o escreve. */
export const pesoDaLinhaEmPdf = (pesoKg: number | null): string => (pesoKg !== null ? `${numeroComVirgula(pesoKg, 3)} kg` : '—');

/**
 * Os campos do PDF (rótulo e valor), com os números em português: vírgula decimal, como na tela. O Excel recebe os
 * números como números (o próprio Excel os mostra na configuração de quem abre).
 */
export function camposDoRelatorioEmPdf(relatorio: RelatorioDeProducao): Array<[string, string]> {
  return [
    ['Projeto:', `${relatorio.nomeDoProjeto} (${relatorio.codigoDoProjeto})`],
    ['Status:', relatorio.status],
    ['Referências:', relatorio.referencias.length > 0 ? relatorio.referencias.join(', ') : '—'],
    ['Tecido:', relatorio.tecidoNome],
    ['Largura total / útil:', `${ouTraco(relatorio.larguraTotalMm)} mm / ${ouTraco(relatorio.larguraUtilMm)} mm`],
    ['Comprimento configurado:', `${ouTraco(relatorio.comprimentoConfiguradoMm)} mm`],
    ['Tipo de enfesto:', relatorio.tipoDeEnfesto ?? '—'],
    ['Quantidade de camadas:', String(relatorio.quantidadeDeCamadas ?? '—')],
    ['Comprimento utilizado:', `${numeroComVirgula(relatorio.comprimentoUtilizadoMm, 1)} mm`],
    ['Área ocupada:', `${numeroComVirgula(relatorio.areaOcupadaMm2 / 1_000_000, 3)} m²`],
    [
      'Aproveitamento / Desperdício:',
      relatorio.aproveitamentoPercentual !== null
        ? `${numeroComVirgula(relatorio.aproveitamentoPercentual, 1)}% / ${numeroComVirgula(relatorio.desperdicioPercentual!, 1)}%`
        : '— (configure o enfesto)',
    ],
    ['Gramatura:', relatorio.gramaturaGm2 !== null ? `${numeroComVirgula(relatorio.gramaturaGm2)} g/m²` : '— (configure no tecido)'],
    ['Estoque disponível:', relatorio.quantidadeDisponivelKg !== null ? `${numeroComVirgula(relatorio.quantidadeDisponivelKg)} kg` : '—'],
    ['Peso total estimado:', relatorio.pesoTotalEstimadoKg !== null ? `${numeroComVirgula(relatorio.pesoTotalEstimadoKg, 3)} kg` : '—'],
    [
      'Rendimento:',
      relatorio.rendimentoLotes !== null
        ? `${relatorio.rendimentoLotes} lote(s) igual(is) a este projeto cabem no estoque`
        : '—',
    ],
    ['Versão do encaixe:', String(relatorio.versaoDoEncaixe)],
    ['Data:', new Date(relatorio.dataIso).toLocaleString('pt-BR')],
  ];
}

export async function gerarPdfDeRelatorio(relatorio: RelatorioDeProducao): Promise<Blob> {
  const doc = new PDFDocument({ size: 'A4', margin: 40, compress: false });

  doc.fontSize(16).font('Helvetica-Bold').text('Relatório de Produção', { align: 'center' });
  doc.moveDown();

  let y = doc.y;
  const passo = 18;
  const campos = camposDoRelatorioEmPdf(relatorio);
  for (const [rotulo, valor] of campos) {
    linhaDeCampo(doc, rotulo, valor, y);
    y += passo;
  }

  y += 10;
  doc.fontSize(12).font('Helvetica-Bold').text('Peças por tamanho', 40, y);
  y += 20;
  doc.fontSize(10).font('Helvetica-Bold');
  doc.text('Tamanho', 40, y, { width: 100 });
  doc.text('Modelos distintos', 140, y, { width: 120 });
  doc.text('Quantidade total', 260, y, { width: 120 });
  doc.text('Peso estimado', 400, y, { width: 100 });
  y += 16;
  doc.font('Helvetica');
  for (const linha of relatorio.pecasPorTamanho) {
    doc.text(linha.tamanho, 40, y, { width: 100 });
    doc.text(String(linha.quantidadeDeModelos), 140, y, { width: 120 });
    doc.text(String(linha.quantidadeTotal), 260, y, { width: 120 });
    doc.text(pesoDaLinhaEmPdf(linha.pesoEstimadoKg), 400, y, { width: 100 });
    y += 16;
  }
  if (relatorio.pecasPorTamanho.length === 0) {
    doc.text('Nenhuma peça no projeto.', 40, y);
  }

  return new Promise((resolve, reject) => {
    const stream = doc.pipe(blobStream());
    stream.on('finish', () => resolve(stream.toBlob('application/pdf')));
    stream.on('error', reject);
    doc.end();
  });
}

export async function gerarExcelDeRelatorio(relatorio: RelatorioDeProducao): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  const planilha = workbook.addWorksheet('Relatório de Produção');

  planilha.columns = [
    { header: 'Campo', key: 'campo', width: 28 },
    { header: 'Valor', key: 'valor', width: 40 },
  ];

  const linhas: Array<[string, string | number]> = [
    ['Projeto', `${relatorio.nomeDoProjeto} (${relatorio.codigoDoProjeto})`],
    ['Status', relatorio.status],
    ['Referências', relatorio.referencias.length > 0 ? relatorio.referencias.join(', ') : '—'],
    ['Tecido', relatorio.tecidoNome],
    ['Largura total (mm)', relatorio.larguraTotalMm ?? '—'],
    ['Largura útil (mm)', relatorio.larguraUtilMm ?? '—'],
    ['Comprimento configurado (mm)', relatorio.comprimentoConfiguradoMm ?? '—'],
    ['Tipo de enfesto', relatorio.tipoDeEnfesto ?? '—'],
    ['Quantidade de camadas', relatorio.quantidadeDeCamadas ?? '—'],
    ['Comprimento utilizado (mm)', Number(relatorio.comprimentoUtilizadoMm.toFixed(1))],
    ['Área ocupada (m²)', Number((relatorio.areaOcupadaMm2 / 1_000_000).toFixed(3))],
    ['Aproveitamento (%)', relatorio.aproveitamentoPercentual !== null ? Number(relatorio.aproveitamentoPercentual.toFixed(1)) : '—'],
    ['Desperdício (%)', relatorio.desperdicioPercentual !== null ? Number(relatorio.desperdicioPercentual.toFixed(1)) : '—'],
    ['Gramatura (g/m²)', relatorio.gramaturaGm2 ?? '—'],
    ['Estoque disponível (kg)', relatorio.quantidadeDisponivelKg ?? '—'],
    ['Peso total estimado (kg)', relatorio.pesoTotalEstimadoKg !== null ? Number(relatorio.pesoTotalEstimadoKg.toFixed(3)) : '—'],
    ['Rendimento (lotes no estoque)', relatorio.rendimentoLotes ?? '—'],
    ['Versão do encaixe', relatorio.versaoDoEncaixe],
    ['Data', new Date(relatorio.dataIso).toLocaleString('pt-BR')],
  ];
  for (const [campo, valor] of linhas) {
    planilha.addRow({ campo, valor });
  }
  planilha.getRow(1).font = { bold: true };

  const planilhaDePecas = workbook.addWorksheet('Peças por tamanho');
  planilhaDePecas.columns = [
    { header: 'Tamanho', key: 'tamanho', width: 16 },
    { header: 'Modelos distintos', key: 'modelos', width: 18 },
    { header: 'Quantidade total', key: 'total', width: 18 },
    { header: 'Peso estimado (kg)', key: 'peso', width: 18 },
  ];
  for (const linha of relatorio.pecasPorTamanho) {
    planilhaDePecas.addRow({
      tamanho: linha.tamanho,
      modelos: linha.quantidadeDeModelos,
      total: linha.quantidadeTotal,
      peso: linha.pesoEstimadoKg !== null ? Number(linha.pesoEstimadoKg.toFixed(3)) : '—',
    });
  }
  planilhaDePecas.getRow(1).font = { bold: true };

  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

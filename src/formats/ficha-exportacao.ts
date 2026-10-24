import PDFDocument from 'pdfkit';
// @ts-expect-error @types/pdfkit ainda não declara este export nomeado (existe em runtime, ver node_modules/pdfkit/js/pdfkit.browser.mjs)
import { registerStdFonts } from 'pdfkit';
// @ts-expect-error módulo de dados de fonte sem tipos próprios
import Helvetica from 'pdfkit/standard-fonts/Helvetica';
// @ts-expect-error módulo de dados de fonte sem tipos próprios
import HelveticaBold from 'pdfkit/standard-fonts/HelveticaBold';
import blobStream from 'blob-stream';
import { numeroComVirgula } from '../core/numeros';
import { retanguloEnvolvente } from '../core/geometria';
import { linhaDeCorteDaPeca, type Molde } from '../domain/molde';
import { ROTULO_DA_ACAO_DA_FICHA, ROTULO_DA_SITUACAO_DA_FICHA, medidaComTolerancia, tempoTotalDasOperacoes, type FichaTecnica } from '../domain/fichaTecnica';
import { centavos, ROTULO_DO_GRUPO_DA_LINHA, totaisPorGrupo, type PreCusto } from '../domain/preCusto';

if (typeof registerStdFonts === 'function') {
  registerStdFonts(Helvetica, HelveticaBold);
}

/**
 * A ficha técnica em PDF (ADR 0105): a descrição, o desenho das peças (como estão na mesa), a tabela de medidas,
 * os materiais com o consumo, a sequência operacional, as instruções, o pré-custo e o histórico da aprovação. O
 * conteúdo (os textos e as tabelas) sai de `conteudoDaFichaEmPdf`, que os testes conferem; o PDF só desenha.
 */

export interface TabelaDoPdf {
  readonly titulo: string;
  readonly colunas: readonly string[];
  /** A largura de cada coluna (em partes do total). */
  readonly pesos: readonly number[];
  /** As colunas de número (alinhadas à direita). */
  readonly numericas: readonly number[];
  readonly linhas: ReadonlyArray<readonly string[]>;
  readonly rodape?: string;
}

export interface ConteudoDaFichaEmPdf {
  readonly titulo: string;
  readonly campos: ReadonlyArray<readonly [string, string]>;
  readonly descricao: string;
  readonly tabelas: readonly TabelaDoPdf[];
  readonly instrucoes: ReadonlyArray<readonly [string, string]>;
  readonly custo: ReadonlyArray<readonly [string, string]>;
  readonly faltando: readonly string[];
}

const reais = (v: number | null): string => (v === null ? '—' : `R$ ${numeroComVirgula(centavos(v), 2)}`);
const data = (iso: string): string => (iso ? new Date(iso).toLocaleDateString('pt-BR') : '—');

export function conteudoDaFichaEmPdf(ficha: FichaTecnica, preCusto: PreCusto | null, agoraIso: string): ConteudoDaFichaEmPdf {
  const tabelas: TabelaDoPdf[] = [];
  if (ficha.medidas.length > 0) {
    tabelas.push({
      titulo: 'Tabela de medidas (cm)',
      colunas: ['Ponto de medida', ...ficha.tamanhos],
      pesos: [3, ...ficha.tamanhos.map(() => 1.4)],
      numericas: ficha.tamanhos.map((_, i) => i + 1),
      linhas: ficha.medidas.map((p) => [p.comoMedir ? `${p.nome} (${p.comoMedir})` : p.nome, ...ficha.tamanhos.map((t) => medidaComTolerancia(p, t))]),
    });
  }
  if (preCusto && preCusto.linhas.some((l) => l.grupo !== 'mao-de-obra')) {
    tabelas.push({
      titulo: 'Materiais e aviamentos (por peça)',
      colunas: ['Material', 'Aplicação', 'Consumo', 'Preço', 'Valor'],
      pesos: [3, 2, 1.5, 1.6, 1.2],
      numericas: [2, 3, 4],
      linhas: preCusto.linhas.filter((l) => l.grupo !== 'mao-de-obra').map((l) => [l.descricao, l.aplicacao || '—', l.consumo, l.preco, reais(l.valor)]),
      rodape: `Materiais por peça: ${reais(preCusto.materiais)}`,
    });
  }
  if (ficha.operacoes.length > 0) {
    tabelas.push({
      titulo: 'Sequência operacional',
      colunas: ['#', 'Operação', 'Máquina', 'Tempo (min)', 'Observação'],
      pesos: [0.5, 3, 2, 1.2, 2.5],
      numericas: [0, 3],
      linhas: ficha.operacoes.map((o, i) => [String(i + 1), o.descricao, o.maquina || '—', numeroComVirgula(o.tempoMin, 2), o.observacao || '']),
      rodape: `Tempo total por peça: ${numeroComVirgula(tempoTotalDasOperacoes(ficha.operacoes), 2)} min`,
    });
  }
  if (ficha.decisoes.length > 0) {
    tabelas.push({
      titulo: 'Histórico da aprovação',
      colunas: ['Data', 'Versão', 'O que foi feito', 'Responsável', 'Comentário', 'Custo'],
      pesos: [1.2, 0.8, 2, 1.6, 3, 1.2],
      numericas: [1, 5],
      linhas: ficha.decisoes.map((d) => [data(d.dataIso), String(d.versao), ROTULO_DA_ACAO_DA_FICHA[d.acao], d.responsavel, d.comentario || '—', d.custoNaHora !== undefined ? reais(d.custoNaHora) : '—']),
    });
  }
  const custo: Array<readonly [string, string]> = [];
  if (preCusto) {
    for (const g of totaisPorGrupo(preCusto)) custo.push([ROTULO_DO_GRUPO_DA_LINHA[g.grupo], reais(g.valor)]);
    custo.push(['Custo direto', reais(preCusto.custoDireto)]);
    custo.push([`Indiretos (${numeroComVirgula(preCusto.padroes.indiretosPercentual, 1)}%)`, reais(preCusto.indiretos)]);
    custo.push([preCusto.completo ? 'Custo total' : 'Custo total (parcial)', reais(preCusto.custoTotal)]);
    custo.push([`Preço sugerido${preCusto.markup !== null ? ` (markup ${numeroComVirgula(preCusto.markup, 2)})` : ''}`, reais(preCusto.precoSugerido)]);
  }
  const instrucoes = (
    [
      ['Costura', ficha.instrucoes.costura],
      ['Acabamento', ficha.instrucoes.acabamento],
      ['Conservação', ficha.instrucoes.conservacao],
      ['Embalagem', ficha.instrucoes.embalagem],
    ] as const
  ).filter(([, t]) => t.trim() !== '');
  return {
    titulo: `${ficha.referencia || 'Sem referência'} — ${ficha.nomeDoModelo || 'sem nome'}`,
    campos: [
      ['Coleção', ficha.colecao || '—'],
      ['Marca', ficha.marca || '—'],
      ['Estilista', ficha.estilista || '—'],
      ['Modelista', ficha.modelista || '—'],
      ['Tamanhos', ficha.tamanhos.join(', ') || '—'],
      ['Versão', `${ficha.versao} — ${ROTULO_DA_SITUACAO_DA_FICHA[ficha.situacao]}`],
      ['Emitida em', new Date(agoraIso).toLocaleString('pt-BR')],
    ],
    descricao: ficha.descricao,
    tabelas,
    instrucoes,
    custo,
    faltando: preCusto && !preCusto.completo ? preCusto.faltando : [],
  };
}

const MARGEM = 40;

export async function gerarPdfDaFichaTecnica(ficha: FichaTecnica, preCusto: PreCusto | null, pecas: readonly Molde[], agoraIso: string): Promise<Blob> {
  const c = conteudoDaFichaEmPdf(ficha, preCusto, agoraIso);
  const doc = new PDFDocument({ size: 'A4', margin: MARGEM, compress: false });
  const largura = doc.page.width - MARGEM * 2;
  const garantir = (altura: number): void => {
    if (doc.y + altura > doc.page.height - MARGEM) doc.addPage();
  };
  const secao = (titulo: string): void => {
    garantir(40);
    doc.moveDown(0.6);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1b2a4a').text(titulo, MARGEM, doc.y, { width: largura });
    doc.moveDown(0.25);
    doc.fillColor('black');
  };

  doc.fontSize(9).font('Helvetica').fillColor('#5a6270').text('FICHA TÉCNICA', MARGEM, MARGEM, { width: largura });
  doc.fontSize(16).font('Helvetica-Bold').fillColor('black').text(c.titulo, { width: largura });
  doc.moveDown(0.4);
  // Os campos em duas colunas, uma linha de cada vez.
  const colunaDosCampos = largura / 2;
  for (let i = 0; i < c.campos.length; i += 2) {
    const y = doc.y;
    for (let k = 0; k < 2 && i + k < c.campos.length; k++) {
      const [rotulo, valor] = c.campos[i + k]!;
      doc.fontSize(9).font('Helvetica-Bold').text(`${rotulo}: `, MARGEM + k * colunaDosCampos, y, { continued: true, width: colunaDosCampos - 6 });
      doc.font('Helvetica').text(valor);
    }
    doc.y = y + 14;
  }
  if (c.descricao.trim()) {
    secao('Descrição');
    doc.fontSize(10).font('Helvetica').text(c.descricao, { width: largura });
  }

  // O desenho das peças, como estão na mesa, numa caixa de 160 pt de altura.
  const cortes = pecas.map((p) => linhaDeCorteDaPeca(p)).filter((x) => x.length >= 3);
  if (cortes.length > 0) {
    secao('Moldes');
    garantir(170);
    const caixa = retanguloEnvolvente(cortes.flat());
    // A tela deita a mesa: o comprimento (y) vai na horizontal, a largura (x) na vertical.
    const escala = Math.min(largura / Math.max(1, caixa.maxY - caixa.minY), 160 / Math.max(1, caixa.maxX - caixa.minX));
    const y0 = doc.y;
    doc.lineWidth(0.6).strokeColor('#2b2f36');
    for (const corte of cortes) {
      corte.forEach((p, i) => {
        const x = MARGEM + (p.y - caixa.minY) * escala;
        const y = y0 + (p.x - caixa.minX) * escala;
        if (i === 0) doc.moveTo(x, y);
        else doc.lineTo(x, y);
      });
      doc.closePath().stroke();
    }
    doc.y = y0 + (caixa.maxX - caixa.minX) * escala + 6;
    doc.fontSize(8).font('Helvetica').fillColor('#5a6270').text(`${pecas.length} peça(s), na posição em que estão na mesa.`, MARGEM, doc.y, { width: largura });
    doc.fillColor('black');
  }

  for (const t of c.tabelas) {
    secao(t.titulo);
    const total = t.pesos.reduce((s, p) => s + p, 0);
    const larguras = t.pesos.map((p) => (p / total) * largura);
    const linha = (celulas: readonly string[], negrito: boolean): void => {
      doc.fontSize(8.5).font(negrito ? 'Helvetica-Bold' : 'Helvetica');
      const altura = Math.max(...celulas.map((texto, i) => doc.heightOfString(texto, { width: larguras[i]! - 6 }))) + 4;
      garantir(altura);
      const y = doc.y;
      let x = MARGEM;
      celulas.forEach((texto, i) => {
        doc.text(texto, x + 3, y + 2, { width: larguras[i]! - 6, align: t.numericas.includes(i) ? 'right' : 'left' });
        x += larguras[i]!;
      });
      doc.y = y + altura;
      doc.moveTo(MARGEM, doc.y).lineTo(MARGEM + largura, doc.y).lineWidth(0.3).strokeColor('#c5cad3').stroke();
    };
    linha(t.colunas, true);
    for (const l of t.linhas) linha(l, false);
    if (t.rodape) {
      doc.moveDown(0.2);
      doc.fontSize(9).font('Helvetica-Bold').text(t.rodape, MARGEM, doc.y, { width: largura, align: 'right' });
    }
  }

  if (c.instrucoes.length > 0) {
    secao('Instruções');
    for (const [rotulo, texto] of c.instrucoes) {
      garantir(30);
      doc.fontSize(9).font('Helvetica-Bold').text(rotulo, MARGEM, doc.y, { width: largura });
      doc.font('Helvetica').text(texto, { width: largura });
      doc.moveDown(0.3);
    }
  }

  if (c.custo.length > 0) {
    secao('Pré-custo (por peça)');
    for (const [rotulo, valor] of c.custo) {
      garantir(14);
      const y = doc.y;
      doc.fontSize(9.5).font(rotulo.startsWith('Custo total') || rotulo.startsWith('Preço') ? 'Helvetica-Bold' : 'Helvetica').text(rotulo, MARGEM, y, { width: largura * 0.6 });
      doc.text(valor, MARGEM + largura * 0.6, y, { width: largura * 0.4, align: 'right' });
    }
    if (c.faltando.length > 0) {
      doc.moveDown(0.3);
      doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#8a5000').text('Custo parcial — falta:', MARGEM, doc.y, { width: largura });
      doc.font('Helvetica');
      for (const f of c.faltando) doc.text(`• ${f}`, { width: largura });
      doc.fillColor('black');
    }
  }

  return new Promise((resolve, reject) => {
    const stream = doc.pipe(blobStream());
    stream.on('finish', () => resolve(stream.toBlob('application/pdf')));
    stream.on('error', reject);
    doc.end();
  });
}

import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { ponto } from '../core/geometria';
import { criarMolde } from '../domain/molde';
import { criarTecido } from '../domain/tecido';
import { criarProjeto } from '../domain/projeto';
import { gerarRelatorioDeProducao } from '../domain/relatorio';
import { gerarPdfDeRelatorio, gerarExcelDeRelatorio } from './relatorio-exportacao';

function projetoDeTeste() {
  const pecas = [
    criarMolde(
      {
        nome: 'Frente',
        referencia: 'REF-001',
        tamanho: 'M',
        contorno: [ponto(0, 0), ponto(300, 0), ponto(300, 400), ponto(0, 400)],
        linhaDeFio: { inicio: ponto(150, 50), fim: ponto(150, 350) },
        quantidade: 3,
      },
      'a',
    ),
  ];
  return criarProjeto('Camiseta Verão', 'p1', 'ENF-20260928-001', '2026-09-28T10:00:00.000Z', {
    pecas,
    tecido: null,
    enfesto: null,
  });
}

describe('gerarPdfDeRelatorio', () => {
  it('produz um PDF de verdade com conteúdo', async () => {
    const relatorio = gerarRelatorioDeProducao(projetoDeTeste(), '2026-09-28T11:00:00.000Z');
    const blob = await gerarPdfDeRelatorio(relatorio);
    expect(blob.size).toBeGreaterThan(300);
    const buffer = Buffer.from(await blob.arrayBuffer());
    expect(buffer.toString('latin1').startsWith('%PDF-')).toBe(true);
  });
});

describe('gerarExcelDeRelatorio', () => {
  it('produz um .xlsx real, legível de volta pelo exceljs', async () => {
    const relatorio = gerarRelatorioDeProducao(projetoDeTeste(), '2026-09-28T11:00:00.000Z');
    const blob = await gerarExcelDeRelatorio(relatorio);
    expect(blob.size).toBeGreaterThan(0);

    const buffer = await blob.arrayBuffer();
    const workbookLido = new ExcelJS.Workbook();
    await workbookLido.xlsx.load(buffer);

    expect(workbookLido.worksheets.map((w) => w.name)).toEqual(['Relatório de Produção', 'Peças por tamanho']);

    const planilha = workbookLido.getWorksheet('Relatório de Produção')!;
    const linhaDoProjeto = planilha.getRow(2);
    expect(linhaDoProjeto.getCell(1).value).toBe('Projeto');
    expect(String(linhaDoProjeto.getCell(2).value)).toContain('Camiseta Verão');
    expect(String(linhaDoProjeto.getCell(2).value)).toContain('ENF-20260928-001');
  });

  it('a planilha de peças por tamanho contém os dados reais agrupados', async () => {
    const relatorio = gerarRelatorioDeProducao(projetoDeTeste(), '2026-09-28T11:00:00.000Z');
    const blob = await gerarExcelDeRelatorio(relatorio);
    const buffer = await blob.arrayBuffer();
    const workbookLido = new ExcelJS.Workbook();
    await workbookLido.xlsx.load(buffer);

    const planilhaDePecas = workbookLido.getWorksheet('Peças por tamanho')!;
    const linha2 = planilhaDePecas.getRow(2);
    expect(linha2.getCell(1).value).toBe('M');
    expect(linha2.getCell(2).value).toBe(1);
    expect(linha2.getCell(3).value).toBe(3);
  });

  it('inclui gramatura, estoque, peso estimado e rendimento quando o tecido os informa', async () => {
    const pecas = [
      criarMolde(
        {
          nome: 'Frente',
          referencia: 'REF-001',
          tamanho: 'M',
          // 1000x1000mm = 1 m², quantidade 1: peso = 1 m² * 200 g/m² = 0.2 kg.
          contorno: [ponto(0, 0), ponto(1000, 0), ponto(1000, 1000), ponto(0, 1000)],
          linhaDeFio: { inicio: ponto(500, 50), fim: ponto(500, 950) },
          quantidade: 1,
        },
        'a',
      ),
    ];
    const tecido = criarTecido(
      {
        nome: 'Malha PV',
        referencia: 'TEC-1',
        larguraTotalMm: 1600,
        larguraUtilMm: 1500,
        gramaturaGm2: 200,
        quantidadeDisponivelKg: 1,
      },
      't1',
    );
    const projeto = criarProjeto('Camiseta Verão', 'p1', 'ENF-20260928-002', '2026-09-28T10:00:00.000Z', {
      pecas,
      tecido,
      enfesto: null,
    });
    const relatorio = gerarRelatorioDeProducao(projeto, '2026-09-28T11:00:00.000Z');
    expect(relatorio.pesoTotalEstimadoKg).toBeCloseTo(0.2, 6);
    expect(relatorio.rendimentoLotes).toBe(5); // 1kg de estoque / 0.2kg por lote = 5

    const blob = await gerarExcelDeRelatorio(relatorio);
    const buffer = await blob.arrayBuffer();
    const workbookLido = new ExcelJS.Workbook();
    await workbookLido.xlsx.load(buffer);

    const planilha = workbookLido.getWorksheet('Relatório de Produção')!;
    function valorDoCampo(rotulo: string): ExcelJS.CellValue {
      for (let i = 1; i <= planilha.rowCount; i++) {
        const linha = planilha.getRow(i);
        if (linha.getCell(1).value === rotulo) return linha.getCell(2).value;
      }
      throw new Error(`Campo "${rotulo}" não encontrado na planilha.`);
    }
    expect(valorDoCampo('Gramatura (g/m²)')).toBe(200);
    expect(valorDoCampo('Rendimento (lotes no estoque)')).toBe(5);

    const planilhaDePecas = workbookLido.getWorksheet('Peças por tamanho')!;
    const linha2 = planilhaDePecas.getRow(2);
    expect(linha2.getCell(4).value).toBeCloseTo(0.2, 6);

    const pdfBlob = await gerarPdfDeRelatorio(relatorio);
    const textoPdf = Buffer.from(await pdfBlob.arrayBuffer()).toString('latin1');
    expect(textoPdf.startsWith('%PDF-')).toBe(true);
  });
});

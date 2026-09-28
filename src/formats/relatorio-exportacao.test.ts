import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { ponto } from '../core/geometria';
import { criarMolde } from '../domain/molde';
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
});

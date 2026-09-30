import { describe, it, expect } from 'vitest';
import { importarDxf } from './formats/dxf-importacao';
import { gerarPdfDeEncaixe } from './formats/pdf-exportacao';
import { gerarPdfDeRelatorio, gerarExcelDeRelatorio } from './formats/relatorio-exportacao';
import { criarMolde } from './domain/molde';
import { criarTecido } from './domain/tecido';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from './domain/enfesto';
import { executarNestingAutomatico } from './domain/nesting';
import { criarProjeto, registrarEvento } from './domain/projeto';
import { gerarRelatorioDeProducao } from './domain/relatorio';

/**
 * Teste integrado (Etapa 10): encadeia módulos que, isoladamente, já têm
 * cobertura unitária própria, para pegar problemas de integração entre eles
 * que testes unitários (com fixtures artificiais e isoladas) não pegam —
 * ex.: um formato de dado que uma camada devolve e a próxima não consegue
 * consumir de verdade. Fluxo: DXF → Molde → nesting automático → PDF do
 * encaixe → Projeto → relatório de produção (PDF e Excel).
 */

const DXF_DE_UMA_PECA_RETANGULAR = [
  '0', 'SECTION',
  '2', 'HEADER',
  '9', '$INSUNITS',
  '70', '4',
  '0', 'ENDSEC',
  '0', 'SECTION',
  '2', 'ENTITIES',
  '0', 'LWPOLYLINE',
  '8', 'CONTORNO',
  '90', '4',
  '70', '1',
  '10', '0', '20', '0',
  '10', '200', '20', '0',
  '10', '200', '20', '300',
  '10', '0', '20', '300',
  '0', 'LINE',
  '8', 'FIO',
  '10', '100', '20', '20',
  '11', '100', '21', '280',
  '0', 'ENDSEC',
  '0', 'EOF',
].join('\n');

describe('integração: DXF → molde → nesting → PDF → relatório', () => {
  it('encadeia todas as camadas com dados reais, sem mocks', async () => {
    // 1. Importação DXF real (mm, via $INSUNITS = 4).
    const importado = importarDxf(DXF_DE_UMA_PECA_RETANGULAR, 'peca-integracao');
    expect(importado.unidadeDetectada).toBe('milímetros');
    expect(importado.unidadeAssumida).toBe(false);
    expect(importado.pecas).toHaveLength(1);
    expect(importado.pecas[0]!.linhaDeFio).not.toBeNull();
    expect(importado.avisos).toHaveLength(0);

    // 2. Peça importada vira um Molde de verdade, com quantidade > 1.
    const pecaImportada = importado.pecas[0]!;
    const molde = criarMolde(
      {
        nome: pecaImportada.nome,
        referencia: 'INT-001',
        tamanho: 'M',
        contorno: pecaImportada.contorno,
        linhaDeFio: pecaImportada.linhaDeFio!,
        quantidade: 4,
      },
      'molde-integracao',
    );

    // 3. Tecido e enfesto reais, largos o bastante para as 4 cópias caberem.
    const tecido = criarTecido(
      { nome: 'Malha PV', referencia: 'TEC-INT', larguraTotalMm: 1600, larguraUtilMm: 1500 },
      'tecido-integracao',
    );
    const enfesto = criarConfiguracaoDeEnfesto({
      tipo: 'par',
      larguraUtilMm: 1500,
      comprimentoMm: 2000,
      quantidadeDeCamadas: 10,
      margemLateralMm: 10,
      margemDeExtremidadeMm: 10,
      distanciaMinimaEntrePecasMm: 5,
    } as ConfiguracaoDeEnfesto);

    // 4. Nesting automático de verdade (varredura real, sem mock de posição).
    const resultadoNesting = executarNestingAutomatico([molde], enfesto);
    expect(resultadoNesting.pecasColocadas).toHaveLength(4);
    expect(resultadoNesting.pecasNaoColocadas).toHaveLength(0);
    expect(resultadoNesting.interrompido).toBe(false);
    expect(resultadoNesting.aproveitamentoPercentual).toBeGreaterThan(0);

    const pecasEncaixadas = resultadoNesting.pecasColocadas.map((p) => p.molde);

    // 5. PDF vetorial real do encaixe resultante.
    const pdfDoEncaixe = await gerarPdfDeEncaixe(pecasEncaixadas, enfesto, {
      formato: 'A4',
      orientacao: 'retrato',
      margemMm: 10,
      tecidoNome: tecido.nome,
    });
    expect(pdfDoEncaixe.size).toBeGreaterThan(300);
    const bufferPdfEncaixe = Buffer.from(await pdfDoEncaixe.arrayBuffer());
    expect(bufferPdfEncaixe.toString('latin1').startsWith('%PDF-')).toBe(true);

    // 6. Projeto persistível com o resultado real do nesting, e o evento
    // correspondente registrado no histórico (não perdido, não fabricado).
    let projeto = criarProjeto('Projeto de integração', 'projeto-integracao', 'ENF-INTEGRACAO-001', '2026-09-28T09:00:00.000Z', {
      pecas: [molde],
      tecido,
      enfesto,
    });
    projeto = registrarEvento(
      projeto,
      'execucao-de-nesting',
      { pecas: pecasEncaixadas, tecido, enfesto },
      '2026-09-28T09:30:00.000Z',
      `${resultadoNesting.pecasColocadas.length} peça(s) colocada(s)`,
    );
    expect(projeto.historico.filter((e) => e.tipo === 'execucao-de-nesting')).toHaveLength(1);

    // 7. Relatório de produção calculado a partir do Projeto persistido —
    // cruza com o resultado do próprio motor de nesting (calculado de forma
    // independente, a partir da geometria, não copiado de um campo salvo).
    const relatorio = gerarRelatorioDeProducao(projeto, '2026-09-28T10:00:00.000Z');
    expect(relatorio.versaoDoEncaixe).toBe(1);
    // A explosão em instâncias do nesting (uma peça por cópia, quantidade 1
    // cada) vira o novo estadoAtual via registrarEvento — 4 "modelos"
    // distintos de tamanho M, não 1 modelo com quantidade 4.
    expect(relatorio.pecasPorTamanho).toEqual([
      { tamanho: 'M', quantidadeDeModelos: 4, quantidadeTotal: 4, pesoEstimadoKg: null },
    ]);
    expect(relatorio.aproveitamentoPercentual).not.toBeNull();
    expect(relatorio.aproveitamentoPercentual).toBeCloseTo(resultadoNesting.aproveitamentoPercentual, 6);
    expect(relatorio.comprimentoUtilizadoMm).toBeCloseTo(resultadoNesting.comprimentoUtilizadoMm, 6);

    // 8. Exportação do relatório em PDF e Excel a partir do mesmo objeto.
    const pdfDoRelatorio = await gerarPdfDeRelatorio(relatorio);
    expect(Buffer.from(await pdfDoRelatorio.arrayBuffer()).toString('latin1').startsWith('%PDF-')).toBe(true);

    const excelDoRelatorio = await gerarExcelDeRelatorio(relatorio);
    expect(excelDoRelatorio.size).toBeGreaterThan(0);
    const assinaturaExcel = Buffer.from(await excelDoRelatorio.arrayBuffer()).subarray(0, 4).toString('latin1');
    expect(assinaturaExcel).toBe('PK\u0003\u0004');
  });
});

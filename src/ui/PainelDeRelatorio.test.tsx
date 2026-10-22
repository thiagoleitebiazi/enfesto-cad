import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ponto } from '../core/geometria';
import { criarMolde } from '../domain/molde';
import { criarProjeto } from '../domain/projeto';
import { gerarRelatorioDeProducao, type RelatorioDeProducao } from '../domain/relatorio';
import { PainelDeRelatorio } from './PainelDeRelatorio';

afterEach(() => cleanup());

function relatorio(extras: Partial<RelatorioDeProducao> = {}): RelatorioDeProducao {
  const peca = criarMolde(
    { nome: 'Frente', referencia: 'REF-001', tamanho: 'M', contorno: [ponto(0, 0), ponto(300, 0), ponto(300, 400), ponto(0, 400)], linhaDeFio: { inicio: ponto(150, 50), fim: ponto(150, 350) } },
    'a',
  );
  const projeto = criarProjeto('Camiseta', 'p1', 'ENF-1', '2026-10-20T10:00:00.000Z', { pecas: [peca], tecido: null, enfesto: null });
  return { ...gerarRelatorioDeProducao(projeto, '2026-10-20T11:00:00.000Z'), ...extras };
}

function mostrar(r: RelatorioDeProducao) {
  render(<PainelDeRelatorio relatorio={r} gerando={false} onExportarPdf={() => {}} onExportarExcel={() => {}} onFechar={() => {}} />);
  return screen.getByRole('dialog', { name: 'Relatório de produção' });
}

/** O valor (dd) ao lado de um rótulo (dt). */
const valorDe = (janela: HTMLElement, rotulo: string): string => within(janela).getByText(rotulo, { selector: 'dt' }).nextElementSibling!.textContent!;

describe('PainelDeRelatorio — os números em português', () => {
  it('vírgula decimal nas medidas, porcentagens e pesos (antes: 954.0 mm, 19.5% / 80.5%)', () => {
    const janela = mostrar(
      relatorio({
        larguraTotalMm: 1600,
        larguraUtilMm: 1500.5,
        comprimentoConfiguradoMm: 3000,
        comprimentoUtilizadoMm: 954,
        aproveitamentoPercentual: 19.54,
        desperdicioPercentual: 80.46,
        gramaturaGm2: 180.5,
        quantidadeDisponivelKg: 12.25,
        pesoTotalEstimadoKg: 0.2,
        pecasPorTamanho: [{ tamanho: 'M', quantidadeDeModelos: 1, quantidadeTotal: 3, pesoEstimadoKg: 0.0626 }],
      }),
    );
    expect(valorDe(janela, 'Largura total / útil')).toBe('1600 mm / 1500,5 mm');
    expect(valorDe(janela, 'Comprimento configurado')).toBe('3000 mm');
    expect(valorDe(janela, 'Comprimento utilizado')).toBe('954,0 mm');
    expect(valorDe(janela, 'Aproveitamento / Desperdício')).toBe('19,5% / 80,5%');
    expect(valorDe(janela, 'Gramatura')).toBe('180,5 g/m²');
    expect(valorDe(janela, 'Estoque disponível')).toBe('12,25 kg');
    expect(valorDe(janela, 'Peso total estimado')).toBe('0,200 kg');
    expect(within(janela).getAllByRole('row')[1]).toHaveTextContent('M130,063 kg');
    // Nenhum número com ponto decimal na janela inteira.
    expect(janela.textContent).not.toMatch(/\d\.\d/);
  });

  it('sem os dados, o travessão e as notas, como antes', () => {
    const janela = mostrar(relatorio({ larguraTotalMm: null, larguraUtilMm: null, comprimentoConfiguradoMm: null, aproveitamentoPercentual: null, desperdicioPercentual: null }));
    expect(valorDe(janela, 'Largura total / útil')).toBe('— mm / — mm');
    expect(valorDe(janela, 'Aproveitamento / Desperdício')).toBe('— (configure o enfesto)');
    expect(valorDe(janela, 'Gramatura')).toBe('— (configure no tecido)');
  });
});

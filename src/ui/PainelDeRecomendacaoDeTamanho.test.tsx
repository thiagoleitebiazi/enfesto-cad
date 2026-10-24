import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { novaFichaTecnica, type FichaTecnica } from '../domain/fichaTecnica';
import type { RegrasDeCaimento } from '../domain/recomendacaoDeTamanho';
import { PainelDeRecomendacaoDeTamanho, type ParteDaRecomendacao } from './PainelDeRecomendacaoDeTamanho';

afterEach(() => cleanup());

const AGORA = '2026-10-24T18:00:00.000Z';

const FICHA: FichaTecnica = {
  ...novaFichaTecnica({ nome: 'Camisa', codigo: 'CAM-01', pecas: [] }, AGORA),
  referencia: 'CAM-01',
  tamanhos: ['P', 'M', 'G', 'GG'],
  medidas: [
    { id: 'busto', nome: 'Busto', comoMedir: '', toleranciaCm: 1, valoresCm: { P: 96, M: 100, G: 104, GG: 110 } },
    { id: 'quadril', nome: 'Quadril', comoMedir: '', toleranciaCm: 1, valoresCm: { P: 98, M: 102, G: 106, GG: 112 } },
    { id: 'comp', nome: 'Comprimento total', comoMedir: '', toleranciaCm: 1, valoresCm: { P: 70, M: 72, G: 74, GG: 76 } },
  ],
};

function abrir(opcoes: { readonly ficha?: FichaTecnica | null; readonly parte?: ParteDaRecomendacao; readonly regras?: RegrasDeCaimento } = {}) {
  const onGuardarRegras = vi.fn();
  const onAbrirMedidas = vi.fn();
  const onSalvarTexto = vi.fn(async (nome: string, conteudo: string) => (conteudo === '' ? null : `C:\\Downloads\\${nome}`));
  const onFechar = vi.fn();
  render(
    <PainelDeRecomendacaoDeTamanho
      ficha={opcoes.ficha === undefined ? FICHA : opcoes.ficha}
      regrasGuardadas={opcoes.regras ?? {}}
      parteInicial={opcoes.parte ?? 'recomendar'}
      onGuardarRegras={onGuardarRegras}
      onAbrirMedidas={onAbrirMedidas}
      onSalvarTexto={onSalvarTexto}
      onFechar={onFechar}
    />,
  );
  return { onGuardarRegras, onAbrirMedidas, onSalvarTexto, onFechar };
}

const digitar = (rotulo: string, valor: string) => fireEvent.change(screen.getByLabelText(rotulo), { target: { value: valor } });
const tamanho = (t: string) => within(screen.getByRole('list', { name: 'Tamanhos' })).getByText(t);

describe('PainelDeRecomendacaoDeTamanho', () => {
  it('sem a tabela de medidas: diz o que falta e abre a tabela da ficha', () => {
    const { onAbrirMedidas } = abrir({ ficha: null });
    expect(screen.getByText(/O projeto ainda não tem a ficha técnica/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir a tabela de medidas' }));
    expect(onAbrirMedidas).toHaveBeenCalledTimes(1);
  });

  it('as medidas do corpo dão o tamanho, em destaque, com a comparação colorida e a explicação', () => {
    abrir();
    expect(screen.getByText('Digite as medidas do corpo da pessoa para ver o tamanho.')).toBeInTheDocument();
    digitar('Corpo: Busto', '92');
    digitar('Corpo: Quadril', '96');
    digitar('Corpo: Comprimento total', '72');
    expect(screen.getByLabelText('Tamanho recomendado: M')).toBeInTheDocument();
    expect(tamanho('M')).toHaveClass('tamanho-recomendado');
    // O P (96 num busto de 92) não aperta: só fica mais justo que o ideal.
    expect(tamanho('P')).toHaveClass('tamanho-neutro');
    expect(screen.getByText(/^Busto: corpo 92,0 cm \+ folga 8,0 cm = 100,0 cm; o M tem 100,0 cm/)).toBeInTheDocument();
    const tabela = screen.getByRole('table', { name: /A peça de cada tamanho contra o ideal/ });
    const linhaDoBusto = within(tabela).getByRole('row', { name: /^Busto/ });
    const celulas = within(linhaDoBusto).getAllByRole('cell');
    // Corpo, ideal, P, M, G, GG.
    expect(celulas[2]).toHaveClass('medida-justa');
    expect(celulas[3]).toHaveClass('medida-certa');
    expect(celulas[4]).toHaveClass('medida-folgada');
    expect(screen.queryByText(/Entre dois tamanhos/)).toBeNull();
  });

  it('entre dois tamanhos: o segundo aparece; limpar tira as medidas', () => {
    abrir();
    digitar('Corpo: Busto', '94');
    digitar('Corpo: Quadril', '98');
    digitar('Corpo: Comprimento total', '73');
    expect(screen.getByLabelText('Tamanho recomendado: G')).toBeInTheDocument();
    expect(screen.getByText('Entre dois tamanhos: o M também serve (mais justo).')).toBeInTheDocument();
    expect(tamanho('M')).toHaveClass('tamanho-alternativo');
    fireEvent.click(screen.getByRole('button', { name: 'Limpar as medidas' }));
    expect(screen.getByLabelText('Corpo: Busto')).toHaveValue('');
    expect(screen.queryByLabelText(/Tamanho recomendado/)).toBeNull();
  });

  it('nenhum veste: o mais próximo, em vermelho, com o quanto aperta', () => {
    abrir();
    digitar('Corpo: Busto', '115');
    digitar('Corpo: Quadril', '100');
    digitar('Corpo: Comprimento total', '76');
    expect(screen.getByText('O mais próximo (aperta)')).toBeInTheDocument();
    expect(tamanho('GG')).toHaveClass('tamanho-recomendado', 'tamanho-aperta');
    expect(screen.getByText(/aperta em Busto \(4,0 cm a menos que o corpo\)/)).toBeInTheDocument();
  });

  it('o caimento muda a recomendação e é guardado no projeto (não as medidas da pessoa)', async () => {
    const { onGuardarRegras } = abrir({ parte: 'caimento' });
    expect(screen.getByLabelText('Usar Busto')).toBeChecked();
    fireEvent.click(screen.getByLabelText('Usar Comprimento total'));
    digitar('Folga de Busto', '4');
    await waitFor(() => expect(onGuardarRegras).toHaveBeenCalled(), { timeout: 2000 });
    const guardadas = onGuardarRegras.mock.calls.at(-1)![0] as RegrasDeCaimento;
    expect(guardadas.busto).toMatchObject({ usar: true, folgaCm: 4 });
    expect(guardadas.comp).toMatchObject({ usar: false });
    fireEvent.click(screen.getByRole('tab', { name: 'Recomendar' }));
    expect(screen.queryByLabelText('Corpo: Comprimento total')).toBeNull();
    digitar('Corpo: Busto', '96');
    digitar('Corpo: Quadril', '96');
    // Folga 4: o busto ideal é 100 — o M.
    expect(screen.getByLabelText('Tamanho recomendado: M')).toBeInTheDocument();
    expect(JSON.stringify(onGuardarRegras.mock.calls)).not.toContain('96');
  });

  it('a regra guardada vale ao abrir; voltar às sugeridas', async () => {
    const { onGuardarRegras } = abrir({ parte: 'caimento', regras: { busto: { usar: true, tipo: 'circunferencia', folgaCm: 12, peso: 3 } } });
    expect(screen.getByLabelText('Folga de Busto')).toHaveValue('12,0');
    expect(screen.getByLabelText('Peso de Busto')).toHaveValue('3');
    fireEvent.click(screen.getByRole('button', { name: 'Voltar às folgas sugeridas pelo nome' }));
    expect(screen.getByLabelText('Folga de Busto')).toHaveValue('8,0');
    await waitFor(() => expect(onGuardarRegras).toHaveBeenCalled(), { timeout: 2000 });
  });

  it('o guia de medidas: as faixas do corpo, e salvar CSV e a página', async () => {
    const { onSalvarTexto } = abrir({ parte: 'guia' });
    const tabela = screen.getByRole('table', { name: /Guia de medidas — Camisa/ });
    expect(within(within(tabela).getByRole('row', { name: /^Busto/ })).getAllByRole('cell').map((c) => c.textContent)).toEqual(['86 a 90', '90 a 94', '94 a 99', '99 a 105']);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar CSV (planilha)' }));
    await waitFor(() => expect(screen.getByText('Salvo em C:\\Downloads\\guia-de-medidas-CAM-01.csv')).toBeInTheDocument());
    expect(onSalvarTexto.mock.calls[0]![1]).toContain('Busto;86–90;90–94;94–99;99–105');
    fireEvent.click(screen.getByRole('button', { name: /Salvar a página/ }));
    await waitFor(() => expect(onSalvarTexto).toHaveBeenCalledTimes(2));
    expect(onSalvarTexto.mock.calls[1]![0]).toBe('guia-de-medidas-CAM-01.html');
    expect(onSalvarTexto.mock.calls[1]![1]).toContain('<title>Guia de medidas — Camisa</title>');
  });
});

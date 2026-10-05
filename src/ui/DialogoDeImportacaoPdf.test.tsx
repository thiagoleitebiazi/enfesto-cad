import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { DialogoDeImportacaoPdf } from './DialogoDeImportacaoPdf';
import type { ContornoCandidatoPdf } from '../formats/pdf-pecas-vetoriais';

const candidatos: ContornoCandidatoPdf[] = [
  { id: 'c1', contornoPt: [], vertices: 16, larguraPt: 200, alturaPt: 200 },
  { id: 'c2', contornoPt: [], vertices: 12, larguraPt: 120, alturaPt: 120 },
];

const descartados = { borda: 1, poucosVertices: 2, areaPequena: 0, abertos: 0 };

function renderizar(onConfirmar = vi.fn()) {
  render(
    <DialogoDeImportacaoPdf
      candidatos={candidatos}
      descartados={descartados}
      curvasAproximadas={0}
      onConfirmar={onConfirmar}
      onCancelar={() => {}}
    />,
  );
  return onConfirmar;
}

describe('DialogoDeImportacaoPdf', () => {
  afterEach(() => cleanup());

  it('não permite importar sem nome e direção do fio definidos pelo usuário', () => {
    renderizar();
    const botao = screen.getByRole('button', { name: /Importar 2 contorno/ });

    expect(botao).toBeDisabled();
  });

  it('libera a importação só quando cada contorno selecionado tem nome e direção do fio', () => {
    const onConfirmar = renderizar();
    const nomes = screen.getAllByLabelText('Nome da peça');
    const direcoes = screen.getAllByLabelText('Direção do fio');

    fireEvent.change(nomes[0]!, { target: { value: 'Frente' } });
    fireEvent.change(direcoes[0]!, { target: { value: 'vertical' } });
    fireEvent.change(nomes[1]!, { target: { value: 'Manga' } });
    expect(screen.getByRole('button', { name: /Importar 2 contorno/ })).toBeDisabled();

    fireEvent.change(direcoes[1]!, { target: { value: 'horizontal' } });
    fireEvent.click(screen.getByRole('button', { name: /Importar 2 contorno/ }));

    expect(onConfirmar).toHaveBeenCalledTimes(1);
    const itens = onConfirmar.mock.calls[0]![0];
    expect(itens.map((i: { nome: string }) => i.nome)).toEqual(['Frente', 'Manga']);
    expect(itens.map((i: { direcaoDoFio: string }) => i.direcaoDoFio)).toEqual(['vertical', 'horizontal']);
    expect(itens[0].fatorDeEscala).toBe(1);
  });

  it('desmarcar um contorno o tira da importação sem exigir nome nem fio', () => {
    renderizar();
    const nomes = screen.getAllByLabelText('Nome da peça');
    const direcoes = screen.getAllByLabelText('Direção do fio');
    const checkboxes = screen.getAllByLabelText('Importar este contorno');

    fireEvent.change(nomes[0]!, { target: { value: 'Frente' } });
    fireEvent.change(direcoes[0]!, { target: { value: 'vertical' } });
    fireEvent.click(checkboxes[1]!);

    expect(screen.getByRole('button', { name: /Importar 1 contorno/ })).toBeEnabled();
  });

  it('recusa fator de escala que não seja um número positivo', () => {
    renderizar();
    const nomes = screen.getAllByLabelText('Nome da peça');
    const direcoes = screen.getAllByLabelText('Direção do fio');
    fireEvent.change(nomes[0]!, { target: { value: 'A' } });
    fireEvent.change(direcoes[0]!, { target: { value: 'vertical' } });
    fireEvent.change(nomes[1]!, { target: { value: 'B' } });
    fireEvent.change(direcoes[1]!, { target: { value: 'vertical' } });

    fireEvent.change(screen.getByLabelText(/Fator de escala/), { target: { value: '0' } });

    expect(screen.getByRole('button', { name: /Importar 2 contorno/ })).toBeDisabled();
    expect(screen.getByText('Informe um número maior que zero.')).toBeInTheDocument();
  });
});

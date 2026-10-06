import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { DialogoDeImportacaoDeContornos, type CandidatoDeContorno } from './DialogoDeImportacaoDeContornos';

const candidatos: CandidatoDeContorno[] = [
  { id: 'c1', vertices: 16 },
  { id: 'c2', vertices: 12 },
];

function renderizar(options: { mostrarEscala?: boolean; candidatos?: CandidatoDeContorno[] } = {}) {
  const onConfirmar = vi.fn();
  render(
    <DialogoDeImportacaoDeContornos
      titulo="Importar contornos"
      descricao="teste"
      resumoDeDescartes="resumo"
      candidatos={options.candidatos ?? candidatos}
      mostrarEscala={options.mostrarEscala ?? true}
      onConfirmar={onConfirmar}
      onCancelar={() => {}}
    />,
  );
  return onConfirmar;
}

describe('DialogoDeImportacaoDeContornos', () => {
  afterEach(() => cleanup());

  it('não permite importar sem nome e direção do fio definidos pelo usuário', () => {
    renderizar();

    expect(screen.getByRole('button', { name: /Importar 2 contorno/ })).toBeDisabled();
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
    expect(itens.map((i: { candidatoId: string }) => i.candidatoId)).toEqual(['c1', 'c2']);
    expect(itens[0].fatorDeEscala).toBe(1);
    expect(itens[0].tamanho).toBe('');
  });

  it('usa a direção do fio sugerida pelo arquivo, mas ainda deixa o usuário alterá-la', () => {
    renderizar({ candidatos: [{ id: 'c1', vertices: 8, direcaoSugerida: 'horizontal' }] });
    const direcoes = screen.getAllByLabelText('Direção do fio') as HTMLSelectElement[];

    expect(direcoes[0]!.value).toBe('horizontal');
  });

  it('esconde o fator de escala quando a unidade já vem do arquivo', () => {
    renderizar({ mostrarEscala: false });

    expect(screen.queryByLabelText(/Fator de escala/)).toBeNull();
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

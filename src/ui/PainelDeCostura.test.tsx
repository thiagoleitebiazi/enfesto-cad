import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { PainelDeCostura } from './PainelDeCostura';
import { ponto } from '../core/geometria';
import { criarMolde, type Molde } from '../domain/molde';

function peca(nome: string, margemDeCosturaMm: number): Molde {
  return criarMolde(
    {
      nome,
      referencia: 'REF-001',
      tamanho: 'M',
      contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)],
      linhaDeFio: { inicio: ponto(100, 50), fim: ponto(100, 250) },
      margemDeCosturaMm,
    },
    nome,
  );
}

function renderizar(pecas: readonly Molde[], onAplicar: (margemMm: number) => string | null = () => null) {
  const aplicar = vi.fn(onAplicar);
  const fechar = vi.fn();
  render(<PainelDeCostura pecas={pecas} onAplicar={aplicar} onFechar={fechar} />);
  return { aplicar, fechar };
}

const campo = (): HTMLElement => screen.getByLabelText('Margem de costura (mm)');
const aplicar = (): boolean => fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

describe('PainelDeCostura', () => {
  afterEach(() => cleanup());

  it('mostra a peça e a costura que ela já tem, e começa por esse valor', () => {
    renderizar([peca('Frente', 7.5)]);

    expect(screen.getByText('Frente')).toBeInTheDocument();
    expect(screen.getByText('7,5 mm')).toBeInTheDocument();
    expect(campo()).toHaveValue('7,5');
  });

  it('sem costura na peça, sugere 10 mm', () => {
    renderizar([peca('Frente', 0)]);

    expect(screen.getByText('0,0 mm')).toBeInTheDocument();
    expect(campo()).toHaveValue('10');
  });

  it('com várias peças de costuras diferentes, diz quantas são, lista as costuras e sugere 10 mm', () => {
    renderizar([peca('Frente', 5), peca('Costas', 8), peca('Manga', 5)]);

    expect(screen.getByText('3 selecionadas')).toBeInTheDocument();
    expect(screen.getByText('5,0 mm, 8,0 mm')).toBeInTheDocument();
    expect(campo()).toHaveValue('10');
  });

  it('aplica a margem digitada, com vírgula decimal, e fecha', () => {
    const { aplicar: onAplicar, fechar } = renderizar([peca('Frente', 0)]);
    fireEvent.change(campo(), { target: { value: '12,5' } });

    aplicar();

    expect(onAplicar).toHaveBeenCalledExactlyOnceWith(12.5);
    expect(fechar).toHaveBeenCalledTimes(1);
  });

  it('zero é aceito: remove a costura', () => {
    const { aplicar: onAplicar } = renderizar([peca('Frente', 10)]);
    fireEvent.change(campo(), { target: { value: '0' } });

    aplicar();

    expect(onAplicar).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('não aplica campo vazio nem texto que não é número', () => {
    const { aplicar: onAplicar, fechar } = renderizar([peca('Frente', 0)]);

    fireEvent.change(campo(), { target: { value: '' } });
    aplicar();
    expect(screen.getByRole('alert')).toHaveTextContent('Digite a margem de costura');

    fireEvent.change(campo(), { target: { value: 'dez' } });
    aplicar();
    expect(screen.getByRole('alert')).toHaveTextContent('Digite a margem de costura');

    expect(onAplicar).not.toHaveBeenCalled();
    expect(fechar).not.toHaveBeenCalled();
  });

  it('mostra o erro devolvido ao aplicar e mantém o diálogo aberto', () => {
    const { fechar } = renderizar([peca('Frente', 0)], () => 'A margem de costura precisa ser um número maior ou igual a zero.');
    fireEvent.change(campo(), { target: { value: '-3' } });

    aplicar();

    expect(screen.getByRole('alert')).toHaveTextContent('maior ou igual a zero');
    expect(fechar).not.toHaveBeenCalled();
  });
});

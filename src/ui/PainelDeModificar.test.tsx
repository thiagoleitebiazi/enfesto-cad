import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { PainelDeModificar } from './PainelDeModificar';
import { ponto } from '../core/geometria';
import { criarMolde } from '../domain/molde';

const frente = criarMolde(
  {
    nome: 'Frente',
    referencia: 'REF-001',
    tamanho: 'M',
    contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)],
    linhaDeFio: { inicio: ponto(100, 50), fim: ponto(100, 250) },
  },
  'p1',
);

function renderizar(indices: readonly number[], onAplicar: (delta: unknown) => string | null = () => null) {
  const aplicar = vi.fn(onAplicar);
  const fechar = vi.fn();
  render(<PainelDeModificar peca={frente} indices={indices} onAplicar={aplicar} onFechar={fechar} />);
  return { aplicar, fechar };
}

function preencher(horizontal: string, vertical: string): void {
  fireEvent.change(screen.getByLabelText(/Horizontal/), { target: { value: horizontal } });
  fireEvent.change(screen.getByLabelText(/Vertical/), { target: { value: vertical } });
}

describe('PainelDeModificar', () => {
  afterEach(() => cleanup());

  it('mostra a peça e o ponto indicado com o número que o desenho mostra (a partir de 1)', () => {
    renderizar([2]);

    expect(screen.getByText('Frente')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByLabelText('1 ponto: só ele anda')).toBeChecked();
  });

  it('lista vários pontos em ordem', () => {
    renderizar([3, 0, 1]);

    expect(screen.getByText('1, 2 e 4')).toBeInTheDocument();
    expect(screen.getByLabelText('N pontos: só os 3 indicados andam')).toBeChecked();
  });

  it('traduz horizontal/vertical da tela para os eixos do mundo, aceitando vírgula decimal', () => {
    const { aplicar, fechar } = renderizar([1]);
    preencher('12,5', '-4');

    fireEvent.click(screen.getByRole('button', { name: 'Modificar' }));

    // Eixos trocados na tela: horizontal = Y do mundo, vertical = X do mundo.
    expect(aplicar).toHaveBeenCalledExactlyOnceWith({ x: -4, y: 12.5 });
    expect(fechar).toHaveBeenCalledTimes(1);
  });

  it('não aplica deslocamento zero nem texto que não é número', () => {
    const { aplicar } = renderizar([1]);

    fireEvent.click(screen.getByRole('button', { name: 'Modificar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('diferente de zero');

    preencher('abc', '0');
    fireEvent.click(screen.getByRole('button', { name: 'Modificar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('precisam ser números');
    expect(aplicar).not.toHaveBeenCalled();
  });

  it('mostra o erro devolvido ao aplicar e mantém o diálogo aberto', () => {
    const { fechar } = renderizar([1], () => 'O contorno da peça "Frente" ficaria sem área com esse deslocamento.');
    preencher('0', '-200');

    fireEvent.click(screen.getByRole('button', { name: 'Modificar' }));

    expect(screen.getByRole('alert')).toHaveTextContent('ficaria sem área');
    expect(fechar).not.toHaveBeenCalled();
  });

  it('Discreto e Proporcional aparecem desligados, dizendo por quê', () => {
    renderizar([1]);

    for (const modo of [/Discreto/, /Proporcional/]) {
      const opcao = screen.getByLabelText(modo);
      expect(opcao).toBeDisabled();
      expect(opcao.closest('label')).toHaveAttribute('title', expect.stringContaining('não foi confirmado'));
    }
  });
});

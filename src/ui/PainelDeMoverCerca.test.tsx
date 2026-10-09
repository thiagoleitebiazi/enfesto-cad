import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { PainelDeMoverCerca } from './PainelDeMoverCerca';
import { ponto } from '../core/geometria';
import { criarMolde } from '../domain/molde';
import { cercaEntre } from '../domain/cerca';

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

// Só o canto (200, 300) da peça fica dentro da cerca.
const cerca = cercaEntre(ponto(150, 250), ponto(250, 350));

function renderizar(onAplicar: (delta: unknown, opcoes: unknown) => string | null = () => null) {
  const aplicar = vi.fn(onAplicar);
  const fechar = vi.fn();
  render(<PainelDeMoverCerca cerca={cerca} pecas={[frente]} temSelecao={false} onAplicar={aplicar} onFechar={fechar} />);
  return { aplicar, fechar };
}

function preencher(horizontal: string, vertical: string): void {
  fireEvent.change(screen.getByLabelText(/Horizontal/), { target: { value: horizontal } });
  fireEvent.change(screen.getByLabelText(/Vertical/), { target: { value: vertical } });
}

describe('PainelDeMoverCerca', () => {
  afterEach(() => cleanup());

  it('conta o que está dentro da cerca e lista a peça que vai mudar', () => {
    renderizar();

    expect(screen.getByLabelText(/Pontos do contorno/).closest('label')).toHaveTextContent('(1)');
    expect(screen.getByLabelText(/Linha de fio/).closest('label')).toHaveTextContent('(0)');
    expect(screen.getByText('Frente')).toBeInTheDocument();
  });

  it('traduz horizontal/vertical da tela para os eixos do mundo, aceitando vírgula decimal', () => {
    const { aplicar, fechar } = renderizar();
    preencher('12,5', '-4');

    fireEvent.click(screen.getByRole('button', { name: 'Mover' }));

    // Eixos trocados na tela: horizontal = Y do mundo, vertical = X do mundo.
    expect(aplicar).toHaveBeenCalledWith({ x: -4, y: 12.5 }, expect.objectContaining({ pontosDoContorno: true }));
    expect(fechar).toHaveBeenCalledTimes(1);
  });

  it('não aplica deslocamento zero nem texto que não é número', () => {
    const { aplicar } = renderizar();

    fireEvent.click(screen.getByRole('button', { name: 'Mover' }));
    expect(screen.getByRole('alert')).toHaveTextContent('diferente de zero');

    preencher('abc', '0');
    fireEvent.click(screen.getByRole('button', { name: 'Mover' }));
    expect(screen.getByRole('alert')).toHaveTextContent('precisam ser números');
    expect(aplicar).not.toHaveBeenCalled();
  });

  it('avisa quando, com as opções marcadas, nada dentro da cerca mudaria', () => {
    const { aplicar } = renderizar();
    fireEvent.click(screen.getByLabelText(/Pontos do contorno/));
    preencher('10', '0');

    fireEvent.click(screen.getByRole('button', { name: 'Mover' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Nada dentro da cerca');
    expect(aplicar).not.toHaveBeenCalled();
  });

  it('mostra o erro devolvido ao aplicar e mantém o diálogo aberto', () => {
    const { fechar } = renderizar(() => 'O contorno da peça "Frente" ficaria sem área com esse movimento.');
    preencher('10', '0');

    fireEvent.click(screen.getByRole('button', { name: 'Mover' }));

    expect(screen.getByRole('alert')).toHaveTextContent('ficaria sem área');
    expect(fechar).not.toHaveBeenCalled();
  });
});

import { useState } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { PainelDeRedefinirPerimetro, type RedefinicaoDePerimetro } from './PainelDeRedefinirPerimetro';
import { ponto } from '../core/geometria';
import { criarMolde } from '../domain/molde';

// Aresta 0: do ponto 1, (0, 0), ao ponto 2, (200, 0) — 200 mm.
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

function renderizar(
  inicial: Partial<RedefinicaoDePerimetro> = {},
  onAplicar: (comprimento: number, ponta: unknown) => string | null = () => null,
) {
  const aplicar = vi.fn(onAplicar);
  const fechar = vi.fn();
  const alterar = vi.fn();
  // A aresta, o modo e a ponta ficam com quem abre o diálogo (o desenho os destaca).
  function ComRedefinicao(): React.JSX.Element {
    const [redefinicao, setRedefinicao] = useState<RedefinicaoDePerimetro>({
      indiceAresta: 0,
      modo: 'uni-direcional',
      extremidade: 'fim',
      ...inicial,
    });
    return (
      <PainelDeRedefinirPerimetro
        peca={frente}
        redefinicao={redefinicao}
        onAlterar={(nova) => {
          alterar(nova);
          setRedefinicao(nova);
        }}
        onAplicar={aplicar}
        onFechar={fechar}
      />
    );
  }
  render(<ComRedefinicao />);
  return { aplicar, fechar, alterar };
}

function digitar(valor: string): void {
  fireEvent.change(screen.getByLabelText(/Para \(mm\)/), { target: { value: valor } });
}

function redefinir(): void {
  fireEvent.click(screen.getByRole('button', { name: 'Redefinir' }));
}

describe('PainelDeRedefinirPerimetro', () => {
  afterEach(() => cleanup());

  it('mostra a aresta indicada e o comprimento atual dela', () => {
    renderizar();

    expect(screen.getByText('do ponto 1 ao ponto 2')).toBeInTheDocument();
    expect(screen.getByText('200,00 mm')).toBeInTheDocument();
  });

  it('a aresta que fecha o contorno vai do último ponto ao primeiro', () => {
    renderizar({ indiceAresta: 3 });

    expect(screen.getByText('do ponto 4 ao ponto 1')).toBeInTheDocument();
    expect(screen.getByText('300,00 mm')).toBeInTheDocument();
  });

  it('uni-direcional: aplica o novo comprimento movendo só a ponta marcada', () => {
    const { aplicar, fechar } = renderizar();
    expect(screen.getByLabelText('Ponto 2')).toBeChecked();
    digitar('250,5');
    expect(screen.getByText('Cresce 50,50 mm: só o ponto 2 anda.')).toBeInTheDocument();

    redefinir();

    expect(aplicar).toHaveBeenCalledExactlyOnceWith(250.5, 'fim');
    expect(fechar).toHaveBeenCalledTimes(1);
  });

  it('trocar a ponta que anda avisa quem abriu o diálogo', () => {
    const { aplicar, alterar } = renderizar();
    fireEvent.click(screen.getByLabelText('Ponto 1'));
    expect(alterar).toHaveBeenCalledExactlyOnceWith({ indiceAresta: 0, modo: 'uni-direcional', extremidade: 'inicio' });
    digitar('150');
    expect(screen.getByText('Encolhe 50,00 mm: só o ponto 1 anda.')).toBeInTheDocument();

    redefinir();

    expect(aplicar).toHaveBeenCalledExactlyOnceWith(150, 'inicio');
  });

  it('bi-direcional: as duas pontas andam, metade cada uma', () => {
    const { aplicar, alterar } = renderizar();
    fireEvent.click(screen.getByLabelText(/Bi-direcional/));
    expect(alterar).toHaveBeenCalledExactlyOnceWith({ indiceAresta: 0, modo: 'bi-direcional', extremidade: 'fim' });
    expect(screen.getByLabelText('Ponto 1')).toBeDisabled();
    expect(screen.getByLabelText('Ponto 2')).toBeDisabled();
    digitar('260');
    expect(screen.getByText('Cresce 60,00 mm: cada ponta anda 30,00 mm.')).toBeInTheDocument();

    redefinir();

    expect(aplicar).toHaveBeenCalledExactlyOnceWith(260, 'ambas');
  });

  it('"Manter extremos" aparece desligado, dizendo por quê: é só para curvas', () => {
    renderizar();

    const opcao = screen.getByLabelText(/Manter extremos/);
    expect(opcao).toBeDisabled();
    expect(opcao.closest('label')).toHaveAttribute('title', expect.stringContaining('arestas do contorno são retas'));
  });

  it('não aplica comprimento vazio, que não é número, zero ou igual ao atual', () => {
    const { aplicar } = renderizar();

    redefinir();
    expect(screen.getByRole('alert')).toHaveTextContent('Digite o novo comprimento');

    digitar('abc');
    redefinir();
    expect(screen.getByRole('alert')).toHaveTextContent('precisa ser um número');

    digitar('0');
    redefinir();
    expect(screen.getByRole('alert')).toHaveTextContent('maior que zero');

    digitar('200');
    expect(screen.getByText('Mesmo comprimento de agora.')).toBeInTheDocument();
    redefinir();
    expect(screen.getByRole('alert')).toHaveTextContent('já tem esse comprimento');

    expect(aplicar).not.toHaveBeenCalled();
  });

  it('mostra o erro devolvido ao aplicar e mantém o diálogo aberto', () => {
    const { fechar } = renderizar(
      {},
      () => 'Um pique dessa aresta ficaria fora dela com esse comprimento. Exclua o pique antes, ou use um comprimento maior.',
    );
    digitar('20');

    redefinir();

    expect(screen.getByRole('alert')).toHaveTextContent('ficaria fora dela');
    expect(fechar).not.toHaveBeenCalled();
  });
});

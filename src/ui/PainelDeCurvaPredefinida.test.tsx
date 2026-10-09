import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { PainelDeCurvaPredefinida } from './PainelDeCurvaPredefinida';
import { ponto } from '../core/geometria';
import { curvaDoTrecho, CURVAS_DE_FABRICA } from './curvasCadastradas';

const cava = curvaDoTrecho('c1', 'Cava da frente', [ponto(0, 0), ponto(50, 20), ponto(100, 0)]);
const CURVAS = [...CURVAS_DE_FABRICA, cava];

function renderizar(opcoes: { idInicial?: string | null; espelharInicial?: boolean; curvas?: typeof CURVAS } = {}) {
  const escolher = vi.fn();
  const excluir = vi.fn();
  const fechar = vi.fn();
  render(
    <PainelDeCurvaPredefinida
      curvas={opcoes.curvas ?? CURVAS}
      idInicial={opcoes.idInicial ?? null}
      espelharInicial={opcoes.espelharInicial ?? false}
      onEscolher={escolher}
      onExcluir={excluir}
      onFechar={fechar}
    />,
  );
  return { escolher, excluir, fechar };
}

const usar = (): boolean => fireEvent.click(screen.getByRole('button', { name: 'Usar esta curva' }));

describe('PainelDeCurvaPredefinida', () => {
  afterEach(() => cleanup());

  it('lista as curvas de fábrica e as do usuário, com a primeira marcada', () => {
    renderizar();

    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.getByLabelText('Arco raso (flecha de 10% da corda)')).toBeChecked();
    expect(screen.getByLabelText('Cava da frente')).not.toBeChecked();
  });

  it('abre com a curva e o espelhamento usados da última vez', () => {
    renderizar({ idInicial: 'c1', espelharInicial: true });

    expect(screen.getByLabelText('Cava da frente')).toBeChecked();
    expect(screen.getByLabelText(/Espelhar/)).toBeChecked();
  });

  it('entrega a curva escolhida e o espelhamento, e fecha', () => {
    const { escolher, fechar } = renderizar();
    fireEvent.click(screen.getByLabelText('Cava da frente'));
    fireEvent.click(screen.getByLabelText(/Espelhar/));

    usar();

    expect(escolher).toHaveBeenCalledExactlyOnceWith(cava, true);
    expect(fechar).toHaveBeenCalledTimes(1);
  });

  it('só as curvas do usuário têm o botão Excluir', () => {
    const { excluir } = renderizar();

    expect(screen.getAllByRole('button', { name: /^Excluir a curva/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Excluir a curva Cava da frente' }));

    expect(excluir).toHaveBeenCalledExactlyOnceWith('c1');
  });

  it('excluir a curva marcada passa a marca para outra', () => {
    renderizar({ idInicial: 'c1' });

    fireEvent.click(screen.getByRole('button', { name: 'Excluir a curva Cava da frente' }));

    expect(screen.getByLabelText('Arco raso (flecha de 10% da corda)')).toBeChecked();
  });

  it('um id inicial que já não existe cai na primeira curva; sem curvas, não há o que usar', () => {
    renderizar({ idInicial: 'apagada' });
    expect(screen.getByLabelText('Arco raso (flecha de 10% da corda)')).toBeChecked();
    cleanup();

    const { escolher } = renderizar({ curvas: [] });
    expect(screen.getByRole('button', { name: 'Usar esta curva' })).toBeDisabled();
    usar();
    expect(escolher).not.toHaveBeenCalled();
  });
});

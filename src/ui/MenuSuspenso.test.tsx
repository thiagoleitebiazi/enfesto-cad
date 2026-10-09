import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { MenuSuspenso, type ItemDeMenu } from './MenuSuspenso';

function renderizar(itens: readonly ItemDeMenu[]) {
  const aoTeclarFora = vi.fn();
  render(
    <div onKeyDown={aoTeclarFora}>
      <MenuSuspenso rotulo="Visão" itens={itens} />
      <button type="button">fora</button>
    </div>,
  );
  return { aoTeclarFora, botao: screen.getByRole('button', { name: 'Visão' }) };
}

describe('MenuSuspenso', () => {
  afterEach(() => cleanup());

  it('abre a lista ao clicar, executa a ação escolhida e fecha', () => {
    const onZoom = vi.fn();
    const { botao } = renderizar([{ tipo: 'acao', rotulo: 'Aumentar zoom', atalho: '+', onEscolher: onZoom }]);

    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(botao);
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: /Aumentar zoom/ })).toHaveFocus();

    fireEvent.click(screen.getByRole('menuitem', { name: /Aumentar zoom/ }));
    expect(onZoom).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(botao).toHaveFocus();
  });

  it('item desabilitado não executa a ação, e as setas o pulam', () => {
    const onAnterior = vi.fn();
    const onAjustar = vi.fn();
    const onGrade = vi.fn();
    const { botao } = renderizar([
      { tipo: 'acao', rotulo: 'Ajustar à tela', onEscolher: onAjustar },
      { tipo: 'separador' },
      { tipo: 'acao', rotulo: 'Vista anterior', desabilitado: true, onEscolher: onAnterior },
      { tipo: 'alternar', rotulo: 'Grade', marcado: true, onEscolher: onGrade },
    ]);
    fireEvent.click(botao);

    const anterior = screen.getByRole('menuitem', { name: /Vista anterior/ });
    expect(anterior).toBeDisabled();
    fireEvent.click(anterior);
    expect(onAnterior).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole('menuitem', { name: /Ajustar/ }), { key: 'ArrowDown' });
    const grade = screen.getByRole('menuitemcheckbox', { name: /Grade/ });
    expect(grade).toHaveFocus();
    expect(grade).toHaveAttribute('aria-checked', 'true');
    fireEvent.keyDown(grade, { key: 'ArrowDown' });
    expect(screen.getByRole('menuitem', { name: /Ajustar/ })).toHaveFocus();
  });

  it('Esc fecha e devolve o foco ao botão, sem que a tecla chegue aos atalhos do programa', () => {
    const { botao, aoTeclarFora } = renderizar([{ tipo: 'acao', rotulo: 'Ajustar à tela', onEscolher: () => {} }]);
    fireEvent.click(botao);

    fireEvent.keyDown(screen.getByRole('menuitem', { name: /Ajustar/ }), { key: 'Delete' });
    fireEvent.keyDown(screen.getByRole('menuitem', { name: /Ajustar/ }), { key: 'Escape' });

    expect(aoTeclarFora).not.toHaveBeenCalled();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(botao).toHaveFocus();
  });

  it('um clique fora fecha a lista', () => {
    const { botao } = renderizar([{ tipo: 'acao', rotulo: 'Ajustar à tela', onEscolher: () => {} }]);
    fireEvent.click(botao);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'fora' }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opção de grupo exclusivo usa o papel de rádio e marca só a escolhida', () => {
    const { botao } = renderizar([
      { tipo: 'opcao', rotulo: 'Régua em centímetros', marcado: true, onEscolher: () => {} },
      { tipo: 'opcao', rotulo: 'Régua em milímetros', marcado: false, onEscolher: () => {} },
    ]);
    fireEvent.click(botao);

    expect(screen.getByRole('menuitemradio', { name: /centímetros/ })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('menuitemradio', { name: /milímetros/ })).toHaveAttribute('aria-checked', 'false');
  });
});

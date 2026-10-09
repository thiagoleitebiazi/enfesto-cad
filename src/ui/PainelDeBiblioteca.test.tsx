import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { PainelDeBiblioteca } from './PainelDeBiblioteca';
import { criarProjeto } from '../domain/projeto';

const projeto = criarProjeto('Camisa polo', 'projeto-1', 'ENF-20261009-001', '2026-10-09T12:00:00.000Z', {
  pecas: [],
  tecido: null,
  enfesto: null,
});

/** Abre a biblioteca, clica em "Renomear" e escreve `novoNome` no campo, sem confirmar. */
function renomearPara(novoNome: string) {
  const onRenomear = vi.fn();
  const onFechar = vi.fn();
  render(
    <PainelDeBiblioteca
      projetos={[projeto]}
      projetoAtualId="outro-projeto"
      onAbrir={vi.fn()}
      onDuplicar={vi.fn()}
      onRenomear={onRenomear}
      onArquivar={vi.fn()}
      onExcluir={vi.fn()}
      onFechar={onFechar}
    />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Renomear' }));
  const campo = screen.getByLabelText('Novo nome de Camisa polo');
  fireEvent.change(campo, { target: { value: novoNome } });
  return { onRenomear, onFechar, campo };
}

describe('PainelDeBiblioteca — renomear', () => {
  afterEach(() => cleanup());

  it('Esc cancela só a troca de nome, sem fechar a biblioteca', () => {
    const { onRenomear, onFechar, campo } = renomearPara('Camisa nova');
    fireEvent.keyDown(campo, { key: 'Escape' });

    expect(onFechar).not.toHaveBeenCalled();
    expect(onRenomear).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Novo nome de Camisa polo')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Renomear' })).toBeInTheDocument();
  });

  it('Enter confirma o novo nome, como o botão OK', () => {
    const { onRenomear, onFechar, campo } = renomearPara('Camisa nova');
    fireEvent.keyDown(campo, { key: 'Enter' });

    expect(onRenomear).toHaveBeenCalledExactlyOnceWith('projeto-1', 'Camisa nova');
    expect(onFechar).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Novo nome de Camisa polo')).not.toBeInTheDocument();
  });
});

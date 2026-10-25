import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
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

describe('as bases aprovadas na biblioteca (ADR 0126)', () => {
  afterEach(() => cleanup());
  const base = { ...criarProjeto('Camisa base', 'base-1', 'ENF-B', '2026-10-09T12:00:00.000Z', { pecas: [], tecido: null, enfesto: null }), base: { aprovadaEmIso: '2026-10-10T12:00:00.000Z', responsavel: 'Ana', nota: 'camisa social' } };
  const modelo = {
    ...criarProjeto('Camisa listrada', 'modelo-1', 'ENF-M', '2026-10-11T12:00:00.000Z', { pecas: [], tecido: null, enfesto: null }),
    feitoDaBase: { id: 'base-1', nome: 'Camisa base', codigo: 'ENF-B', revisao: 2, emIso: '2026-10-11T12:00:00.000Z' },
  };
  const abrir = (acoes: Partial<Parameters<typeof PainelDeBiblioteca>[0]> = {}) => {
    const onAprovarComoBase = vi.fn((_id: string, responsavel: string) => (responsavel.trim() === '' ? 'Informe quem aprova a base.' : null));
    const onNovoModeloDaBase = vi.fn(() => null);
    const onPorPecasDaBase = vi.fn();
    const onTirarDasBases = vi.fn();
    render(
      <PainelDeBiblioteca
        projetos={[projeto, base, modelo]}
        projetoAtualId="outro-projeto"
        onAbrir={vi.fn()}
        onDuplicar={vi.fn()}
        onRenomear={vi.fn()}
        onArquivar={vi.fn()}
        onExcluir={vi.fn()}
        onFechar={vi.fn()}
        onAprovarComoBase={onAprovarComoBase}
        onNovoModeloDaBase={onNovoModeloDaBase}
        onPorPecasDaBase={onPorPecasDaBase}
        onTirarDasBases={onTirarDasBases}
        {...acoes}
      />,
    );
    return { onAprovarComoBase, onNovoModeloDaBase, onPorPecasDaBase, onTirarDasBases };
  };
  const linhaDe = (nome: string): HTMLElement => screen.getByText(nome).closest('li')!;

  it('a base tem o selo, quem aprovou e a nota; o modelo diz de que base veio', () => {
    abrir();
    expect(linhaDe('Camisa base')).toHaveClass('item-de-base');
    expect(linhaDe('Camisa base')).toHaveTextContent('Base aprovada');
    expect(linhaDe('Camisa base')).toHaveTextContent('Aprovada por Ana em');
    expect(linhaDe('Camisa base')).toHaveTextContent('camisa social');
    expect(linhaDe('Camisa listrada')).toHaveTextContent('Feito da base “Camisa base” (ENF-B), revisão 2 do molde');
    expect(linhaDe('Camisa polo')).not.toHaveClass('item-de-base');
  });

  it('"Só as bases aprovadas" deixa só as bases na lista', () => {
    abrir();
    fireEvent.click(screen.getByLabelText('Só as bases aprovadas'));
    expect(screen.queryByText('Camisa polo')).toBeNull();
    expect(screen.queryByText('Camisa listrada')).toBeNull();
    expect(screen.getByText('Camisa base')).toBeInTheDocument();
  });

  it('aprovar como base: pede quem aprova; o erro fica na linha, e o certo fecha o formulário', () => {
    const { onAprovarComoBase } = abrir();
    fireEvent.click(within(linhaDe('Camisa polo')).getByRole('button', { name: 'Aprovar como base' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Informe quem aprova a base.');
    fireEvent.change(screen.getByLabelText('Quem aprova Camisa polo como base'), { target: { value: 'Bia' } });
    fireEvent.change(screen.getByLabelText('O que é a base Camisa polo'), { target: { value: 'polo, tabela 2026' } });
    fireEvent.keyDown(screen.getByLabelText('O que é a base Camisa polo'), { key: 'Enter' });
    expect(onAprovarComoBase).toHaveBeenLastCalledWith('projeto-1', 'Bia', 'polo, tabela 2026');
    expect(screen.queryByLabelText('Quem aprova Camisa polo como base')).toBeNull();
  });

  it('na base: o modelo novo (com o nome sugerido), as peças no aberto e tirar das bases', () => {
    const { onNovoModeloDaBase, onPorPecasDaBase, onTirarDasBases } = abrir();
    const linha = linhaDe('Camisa base');
    expect(within(linha).queryByRole('button', { name: 'Aprovar como base' })).toBeNull();
    fireEvent.click(within(linha).getByRole('button', { name: 'Pôr as peças no aberto' }));
    expect(onPorPecasDaBase).toHaveBeenCalledWith('base-1');
    fireEvent.click(within(linha).getByRole('button', { name: 'Tirar das bases' }));
    expect(onTirarDasBases).toHaveBeenCalledWith('base-1');
    fireEvent.click(within(linha).getByRole('button', { name: 'Novo modelo desta base' }));
    expect(screen.getByLabelText('Nome do modelo novo da base Camisa base')).toHaveValue('Camisa base — modelo novo');
    fireEvent.change(screen.getByLabelText('Nome do modelo novo da base Camisa base'), { target: { value: 'Camisa xadrez' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar o modelo' }));
    expect(onNovoModeloDaBase).toHaveBeenCalledWith('base-1', 'Camisa xadrez');
    // O modelo e a camisa polo não são bases: não têm esses botões.
    expect(within(linhaDe('Camisa listrada')).queryByRole('button', { name: 'Novo modelo desta base' })).toBeNull();
  });

  it('a base aberta não oferece pôr as peças nela mesma', () => {
    cleanup();
    render(
      <PainelDeBiblioteca
        projetos={[base]}
        projetoAtualId="base-1"
        onAbrir={vi.fn()}
        onDuplicar={vi.fn()}
        onRenomear={vi.fn()}
        onArquivar={vi.fn()}
        onExcluir={vi.fn()}
        onFechar={vi.fn()}
        onAprovarComoBase={vi.fn(() => null)}
        onPorPecasDaBase={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Pôr as peças no aberto' })).toBeNull();
  });
});

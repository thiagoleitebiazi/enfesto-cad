import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { PainelDeVariantes } from './PainelDeVariantes';
import { criarProjeto, criarVariante, type EstadoDoProjeto } from '../domain/projeto';

const VAZIO: EstadoDoProjeto = { pecas: [], tecido: null, enfesto: null };
const original = criarProjeto('Camisa', 'p1', 'ENF-001', '2026-10-01T10:00:00.000Z', VAZIO);
const variante2 = criarVariante(original, 'Camisa — variante 2', 'p2', 'ENF-002', '2026-10-02T10:00:00.000Z', VAZIO);

function renderizar(
  opcoes: { projetoAtualId?: string; nomeSugerido?: string; onCriar?: (nome: string) => string | null } = {},
) {
  const criar = vi.fn(opcoes.onCriar ?? (() => null));
  const abrir = vi.fn();
  const fechar = vi.fn();
  const resultado = render(
    <PainelDeVariantes
      variantes={[original, variante2]}
      projetoAtualId={opcoes.projetoAtualId ?? 'p1'}
      nomeSugerido={opcoes.nomeSugerido ?? 'Camisa — variante 3'}
      onCriar={criar}
      onAbrir={abrir}
      onFechar={fechar}
    />,
  );
  return { criar, abrir, fechar, ...resultado };
}

const campo = (): HTMLElement => screen.getByLabelText('Nome da nova variante');
const itens = (): HTMLElement[] => within(screen.getByRole('list', { name: 'Variantes deste projeto' })).getAllByRole('listitem');

describe('PainelDeVariantes', () => {
  afterEach(() => cleanup());

  it('lista o original e as variantes, e marca a que está aberta', () => {
    renderizar();

    expect(itens()).toHaveLength(2);
    expect(itens()[0]).toHaveTextContent('Camisa');
    expect(itens()[0]).toHaveTextContent('original');
    expect(itens()[0]).toHaveTextContent('aberta');
    expect(itens()[0]).toHaveAttribute('aria-current', 'true');
    expect(itens()[1]).toHaveTextContent('Camisa — variante 2');
    expect(itens()[1]).toHaveTextContent('variante · 0 peça(s)');
    expect(itens()[1]).not.toHaveAttribute('aria-current');
  });

  it('só as outras variantes têm o botão Abrir', () => {
    const { abrir } = renderizar();

    expect(within(itens()[0]!).queryByRole('button', { name: 'Abrir' })).not.toBeInTheDocument();
    fireEvent.click(within(itens()[1]!).getByRole('button', { name: 'Abrir' }));

    expect(abrir).toHaveBeenCalledExactlyOnceWith('p2');
  });

  it('cria a variante com o nome sugerido, ou com o que for digitado (sem espaços nas pontas)', () => {
    const { criar } = renderizar();
    expect(campo()).toHaveValue('Camisa — variante 3');

    fireEvent.click(screen.getByRole('button', { name: 'Criar variante' }));
    fireEvent.change(campo(), { target: { value: '  Camisa em malha  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar variante' }));

    expect(criar.mock.calls).toEqual([['Camisa — variante 3'], ['Camisa em malha']]);
  });

  it('não cria variante sem nome', () => {
    const { criar } = renderizar();
    fireEvent.change(campo(), { target: { value: '   ' } });

    fireEvent.click(screen.getByRole('button', { name: 'Criar variante' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Dê um nome à variante');
    expect(criar).not.toHaveBeenCalled();
  });

  it('mostra o erro devolvido ao criar', () => {
    renderizar({ onCriar: () => 'Não foi possível salvar a variante.' });

    fireEvent.click(screen.getByRole('button', { name: 'Criar variante' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar');
  });

  it('depois de criar, o campo passa a sugerir o nome seguinte', () => {
    const { rerender } = renderizar();

    rerender(
      <PainelDeVariantes
        variantes={[original, variante2]}
        projetoAtualId="p2"
        nomeSugerido="Camisa — variante 4"
        onCriar={() => null}
        onAbrir={() => {}}
        onFechar={() => {}}
      />,
    );

    expect(campo()).toHaveValue('Camisa — variante 4');
    expect(itens()[1]).toHaveAttribute('aria-current', 'true');
  });
});

import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { MAXIMO_DE_PROGRAMAS, type Programa } from '../domain/programas';
import { PainelDeProgramas } from './PainelDeProgramas';

const PLOTTER: Programa = { id: 'a', nome: 'Plotter', tipo: 'arquivo', alvo: 'C:\\plot.exe' };
const PEDIDOS: Programa = { id: 'b', nome: 'Pedidos', tipo: 'endereco', alvo: 'https://exemplo.com.br/' };

function renderizar(programas: readonly Programa[], erro: string | null = null) {
  const acoes = {
    onAbrir: vi.fn(),
    onRemover: vi.fn(),
    onAdicionarArquivo: vi.fn(),
    onAdicionarEndereco: vi.fn(),
    onFechar: vi.fn(),
  };
  render(<PainelDeProgramas programas={programas} erro={erro} {...acoes} />);
  return acoes;
}

const campoDoNome = (): HTMLElement => screen.getByLabelText(/Nome do atalho novo/);
const campoDoEndereco = (): HTMLElement => screen.getByLabelText(/Endereço, para um atalho de site/);

describe('PainelDeProgramas', () => {
  afterEach(() => cleanup());

  it('sem atalhos, explica para que servem', () => {
    renderizar([]);

    expect(screen.getByRole('dialog', { name: 'Programas' })).toBeInTheDocument();
    expect(screen.getByText(/Nenhum atalho ainda/)).toBeInTheDocument();
  });

  it('cada atalho mostra o nome e o que ele abre, com Abrir e Remover', () => {
    const acoes = renderizar([PLOTTER, PEDIDOS]);

    expect(screen.getByText('C:\\plot.exe')).toBeInTheDocument();
    expect(screen.getByText('https://exemplo.com.br/')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Pedidos' }));
    expect(acoes.onAbrir).toHaveBeenCalledWith('b');
    fireEvent.click(screen.getByRole('button', { name: 'Remover o atalho Plotter' }));
    expect(acoes.onRemover).toHaveBeenCalledWith('a');
  });

  it('escolher programa ou arquivo leva o nome digitado e limpa o campo', () => {
    const acoes = renderizar([]);

    fireEvent.change(campoDoNome(), { target: { value: 'Máquina de corte' } });
    fireEvent.click(screen.getByRole('button', { name: 'Escolher programa ou arquivo…' }));

    expect(acoes.onAdicionarArquivo).toHaveBeenCalledWith('Máquina de corte');
    expect(campoDoNome()).toHaveValue('');
  });

  it('adicionar endereço só liga com o endereço escrito, e leva o nome e o endereço', () => {
    const acoes = renderizar([]);
    const adicionar = screen.getByRole('button', { name: 'Adicionar endereço' });

    expect(adicionar).toBeDisabled();
    expect(adicionar.title).toBe('Escreva o endereço primeiro');

    fireEvent.change(campoDoEndereco(), { target: { value: 'exemplo.com.br/pedidos' } });
    fireEvent.click(adicionar);

    expect(acoes.onAdicionarEndereco).toHaveBeenCalledWith('', 'exemplo.com.br/pedidos');
    expect(campoDoEndereco()).toHaveValue('');
  });

  it('com a lista cheia, não dá para adicionar mais', () => {
    renderizar(Array.from({ length: MAXIMO_DE_PROGRAMAS }, (_, i) => ({ ...PLOTTER, id: `p${i}`, nome: `P${i}`, alvo: `C:\\p${i}.exe` })));

    expect(screen.getByRole('button', { name: 'Escolher programa ou arquivo…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Escolher programa ou arquivo…' }).title).toBe('A lista já tem 12 atalhos');
    expect(screen.getByRole('button', { name: 'Adicionar endereço' })).toBeDisabled();
  });

  it('o erro de um pedido recusado aparece no painel', () => {
    renderizar([PLOTTER], 'Não foi possível abrir “Plotter”: arquivo não encontrado');

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível abrir “Plotter”');
  });
});

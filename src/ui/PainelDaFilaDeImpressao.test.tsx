import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { comEstado, comTrabalho, FILA_DE_IMPRESSAO_VAZIA, type FilaDeImpressao } from '../domain/filaDeImpressao';
import { PainelDaFilaDeImpressao } from './PainelDaFilaDeImpressao';

afterEach(cleanup);

const fila = comEstado(comTrabalho(comTrabalho(FILA_DE_IMPRESSAO_VAZIA, { id: 'a', nome: 'Risco A', destino: 'COM1', texto: 'IN;' }), { id: 'b', nome: 'Risco B', destino: 'COM1', texto: 'IN;' }), 'a', 'erro', 'sem papel');

const abrir = (f: FilaDeImpressao) => {
  const acoes = { onPausar: vi.fn(), onMover: vi.fn(), onCancelar: vi.fn(), onReenviar: vi.fn(), onLimpar: vi.fn(), onFechar: vi.fn() };
  render(<PainelDaFilaDeImpressao fila={f} {...acoes} />);
  return acoes;
};

describe('a fila da mesa de corte (ADR 0210)', () => {
  it('mostra o erro e deixa enviar de novo', () => {
    const acoes = abrir(fila);
    expect(screen.getByText('Erro: sem papel')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar de novo Risco A' }));
    expect(acoes.onReenviar).toHaveBeenCalledWith('a');
  });

  it('o que espera sobe, desce e se cancela', () => {
    const acoes = abrir(fila);
    fireEvent.click(screen.getByRole('button', { name: 'Subir Risco B' }));
    expect(acoes.onMover).toHaveBeenCalledWith('b', -1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar Risco B' }));
    expect(acoes.onCancelar).toHaveBeenCalledWith('b');
  });

  it('pausa e continua', () => {
    const acoes = abrir({ ...fila, pausada: true });
    fireEvent.click(screen.getByRole('button', { name: 'Continuar a fila' }));
    expect(acoes.onPausar).toHaveBeenCalled();
  });

  it('sem nada na fila, diz o que fazer', () => {
    abrir(FILA_DE_IMPRESSAO_VAZIA);
    expect(screen.getByText(/Nenhum arquivo na fila/)).toBeTruthy();
  });
});

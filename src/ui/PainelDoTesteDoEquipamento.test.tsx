import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PainelDoTesteDoEquipamento } from './PainelDoTesteDoEquipamento';

afterEach(cleanup);

describe('o teste da mesa de corte (ADR 0217)', () => {
  it('envia para a porta escolhida', () => {
    const onEnviarAMesa = vi.fn();
    render(<PainelDoTesteDoEquipamento destino="192.168.0.50" onEnviarAMesa={onEnviarAMesa} onFechar={vi.fn()} />);
    expect(screen.getByText(/192\.168\.0\.50/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Enviar o teste de corte' }));
    expect(onEnviarAMesa).toHaveBeenCalledOnce();
  });

  it('sem porta, espera a escolha', () => {
    render(<PainelDoTesteDoEquipamento destino="" onEnviarAMesa={vi.fn()} onFechar={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Enviar o teste de corte' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

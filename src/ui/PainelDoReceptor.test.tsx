import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PainelDoReceptor, type ApiDoReceptor } from './PainelDoReceptor';

afterEach(cleanup);

const abrir = (extra: Partial<ApiDoReceptor> = {}): ApiDoReceptor => {
  const api: ApiDoReceptor = { estado: async () => null, ligar: async (porta) => ({ porta, enderecos: ['192.168.0.5'] }), desligar: async () => undefined, ...extra };
  render(<PainelDoReceptor api={api} onFechar={() => undefined} />);
  return api;
};

describe('o painel do receptor (ADR 0222)', () => {
  it('liga na porta dos plotters e mostra o endereço', async () => {
    const ligar = vi.fn(async (porta: number) => ({ porta, enderecos: ['192.168.0.5'] }));
    abrir({ ligar });
    fireEvent.click(screen.getByRole('button', { name: 'Ligar o receptor' }));
    await screen.findByText(/192\.168\.0\.5/);
    expect(ligar).toHaveBeenCalledWith(9100);
  });

  it('a porta ocupada é explicada', async () => {
    abrir({ ligar: async () => 'A porta 9100 não pôde ser aberta.' });
    fireEvent.click(screen.getByRole('button', { name: 'Ligar o receptor' }));
    expect((await screen.findByRole('alert')).textContent).toContain('9100');
  });

  it('já ligado, deixa desligar', async () => {
    const desligar = vi.fn(async () => undefined);
    abrir({ estado: async () => ({ porta: 9100, enderecos: [] }), desligar });
    fireEvent.click(await screen.findByRole('button', { name: 'Desligar o receptor' }));
    expect(desligar).toHaveBeenCalled();
    await screen.findByRole('button', { name: 'Ligar o receptor' });
  });
});

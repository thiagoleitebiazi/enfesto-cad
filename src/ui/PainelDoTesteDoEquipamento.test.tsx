import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PainelDoTesteDoEquipamento } from './PainelDoTesteDoEquipamento';

afterEach(cleanup);

const abrir = (extra: Partial<Parameters<typeof PainelDoTesteDoEquipamento>[0]> = {}) => {
  const acoes = { onEnviarAoPlotter: vi.fn(), onEnviarAMesa: vi.fn(), onCalibracao: vi.fn(), onFechar: vi.fn() };
  render(<PainelDoTesteDoEquipamento destino="192.168.0.50" calibracao={null} agoraIso={() => '2026-10-31T12:00:00.000Z'} {...acoes} {...extra} />);
  return acoes;
};

describe('o teste do equipamento (ADR 0217)', () => {
  it('envia a página no comprimento pedido', () => {
    const acoes = abrir();
    fireEvent.change(screen.getByLabelText('Comprimento do teste (mm)'), { target: { value: '2000' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar a página de teste' }));
    expect(acoes.onEnviarAoPlotter).toHaveBeenCalledWith(2000);
    expect(screen.getByRole('status').textContent).toContain('192.168.0.50');
  });

  it('recusa o comprimento fora do que dá para medir', () => {
    const acoes = abrir();
    fireEvent.change(screen.getByLabelText('Comprimento do teste (mm)'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar a página de teste' }));
    expect(acoes.onEnviarAoPlotter).not.toHaveBeenCalled();
  });

  it('calcula a correção pelas medidas, com vírgula', () => {
    const acoes = abrir();
    fireEvent.change(screen.getByLabelText(/Comprimento medido/), { target: { value: '1005' } });
    fireEvent.change(screen.getByLabelText(/Largura medida/), { target: { value: '139,3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar a correção' }));
    const c = acoes.onCalibracao.mock.calls[0]![0] as { horizontal: number; vertical: number };
    expect(c.horizontal).toBeCloseTo(1000 / 1005, 6);
    expect(c.vertical).toBeCloseTo(140 / 139.3, 6);
  });

  it('a medida absurda é explicada, e nada muda', () => {
    const acoes = abrir();
    fireEvent.change(screen.getByLabelText(/Comprimento medido/), { target: { value: '500' } });
    fireEvent.change(screen.getByLabelText(/Largura medida/), { target: { value: '140' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar a correção' }));
    expect(acoes.onCalibracao).not.toHaveBeenCalled();
    expect(screen.getByRole('status').textContent).toContain('10%');
  });

  it('mostra a correção em uso e deixa apagar', () => {
    const acoes = abrir({ calibracao: { horizontal: 0.995, vertical: 1.005, quandoIso: '' } });
    expect(screen.getByText(/Correção em uso: -0,50% no comprimento e \+0,50% na largura/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Apagar a correção' }));
    expect(acoes.onCalibracao).toHaveBeenCalledWith(null);
  });

  it('sem porta, a mesa de corte espera a escolha', () => {
    abrir({ destino: '' });
    expect((screen.getByRole('button', { name: 'Enviar o teste de corte' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

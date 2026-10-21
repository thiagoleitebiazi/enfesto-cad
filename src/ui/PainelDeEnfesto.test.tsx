import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from '../domain/enfesto';
import { PainelDeEnfesto } from './PainelDeEnfesto';

afterEach(() => cleanup());

const enfesto = (margemLateralMm: number, margemDeExtremidadeMm: number): ConfiguracaoDeEnfesto =>
  criarConfiguracaoDeEnfesto({ tipo: 'impar', larguraUtilMm: 1500, comprimentoMm: 3000, quantidadeDeCamadas: 1, margemLateralMm, margemDeExtremidadeMm, distanciaMinimaEntrePecasMm: 3 });
const campo = (inicio: string) => screen.getByLabelText(new RegExp(`^${inicio}`)) as HTMLInputElement;

describe('PainelDeEnfesto — a margem de segurança da mesa (4 mm)', () => {
  it('o projeto de antes, gravado com margem zero, abre mostrando a de segurança', () => {
    render(<PainelDeEnfesto configAtual={enfesto(0, 0)} onSalvar={vi.fn()} onFechar={vi.fn()} />);
    expect(campo('Margem lateral').value).toBe('4');
    expect(campo('Margem de extremidade').value).toBe('4');
  });

  it('a margem maior que a de segurança fica como está', () => {
    render(<PainelDeEnfesto configAtual={enfesto(10, 20)} onSalvar={vi.fn()} onFechar={vi.fn()} />);
    expect(campo('Margem lateral').value).toBe('10');
    expect(campo('Margem de extremidade').value).toBe('20');
  });

  it('a margem abaixo de 4 mm é recusada, em qualquer um dos dois lados, e diz por quê', () => {
    for (const nome of ['Margem lateral', 'Margem de extremidade']) {
      const onSalvar = vi.fn();
      render(<PainelDeEnfesto configAtual={enfesto(4, 4)} onSalvar={onSalvar} onFechar={vi.fn()} />);
      fireEvent.change(campo(nome), { target: { value: '3' } });
      fireEvent.click(screen.getByRole('button', { name: 'Salvar enfesto' }));
      expect(onSalvar).not.toHaveBeenCalled();
      expect(screen.getByText(/margem de segurança/)).toBeInTheDocument();
      cleanup();
    }
  });

  it('com 4 mm, salva', () => {
    const onSalvar = vi.fn();
    render(<PainelDeEnfesto configAtual={enfesto(0, 0)} onSalvar={onSalvar} onFechar={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar enfesto' }));
    expect(onSalvar).toHaveBeenCalledWith(expect.objectContaining({ margemLateralMm: 4, margemDeExtremidadeMm: 4 }));
  });
});

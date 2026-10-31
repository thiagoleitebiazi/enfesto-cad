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

describe('a padronagem, a cor do tecido e as emendas (ADR 0187 e 0188)', () => {
  it('as emendas e a cor entram na configuração, e voltam ao abrir de novo', () => {
    const onSalvar = vi.fn();
    render(<PainelDeEnfesto configAtual={enfesto(4, 4)} onSalvar={onSalvar} onFechar={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(/Pontos de emenda/), { target: { value: '2400 1200' } });
    fireEvent.click(screen.getByLabelText('Cor do tecido nas peças'));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar enfesto' }));
    expect(onSalvar.mock.calls[0]![0]).toMatchObject({ emendasMm: [1200, 2400], corDoTecido: '#cfe2ff' });
    cleanup();
    render(<PainelDeEnfesto configAtual={onSalvar.mock.calls[0]![0]} onSalvar={vi.fn()} onFechar={vi.fn()} />);
    expect(screen.getByLabelText(/Pontos de emenda/)).toHaveValue('1200 2400');
  });

  it('sem imagem, a padronagem ligada não entra; o campo do padrão só aparece com ela', () => {
    const onSalvar = vi.fn();
    render(<PainelDeEnfesto configAtual={enfesto(4, 4)} onSalvar={onSalvar} onFechar={vi.fn()} />);
    expect(screen.queryByLabelText(/Comprimento do padrão/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Mostra padronagem'));
    expect(screen.getByLabelText(/Comprimento do padrão/)).toHaveValue(100);
    fireEvent.click(screen.getByRole('button', { name: 'Salvar enfesto' }));
    expect(onSalvar.mock.calls[0]![0].padronagem).toBeUndefined();
  });

  it('recusa o que não é imagem', () => {
    render(<PainelDeEnfesto configAtual={enfesto(4, 4)} onSalvar={vi.fn()} onFechar={vi.fn()} />);
    fireEvent.click(screen.getByLabelText('Mostra padronagem'));
    fireEvent.change(screen.getByLabelText(/Padrão \(imagem/), { target: { files: [new File(['x'], 'a.txt', { type: 'text/plain' })] } });
    expect(screen.getByRole('alert')).toHaveTextContent(/imagem/);
  });
});

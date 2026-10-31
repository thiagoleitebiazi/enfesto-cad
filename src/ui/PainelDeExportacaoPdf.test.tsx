import { ponto } from '../core/geometria';
import { criarMolde } from '../domain/molde';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PainelDeExportacaoPdf } from './PainelDeExportacaoPdf';

afterEach(() => cleanup());

function abrir() {
  const onExportar = vi.fn();
  render(<PainelDeExportacaoPdf podeExportarEncaixeCompleto gerando={false} onExportar={onExportar} onFechar={() => {}} />);
  const margem = screen.getByLabelText('Margem (mm)');
  const exportar = screen.getByRole('button', { name: 'Exportar' });
  return { onExportar, margem, exportar };
}

describe('PainelDeExportacaoPdf — a margem', () => {
  it('a margem com vírgula vale', () => {
    const { onExportar, margem, exportar } = abrir();
    fireEvent.change(margem, { target: { value: '12,5' } });
    fireEvent.click(exportar);
    expect(onExportar).toHaveBeenCalledWith(expect.objectContaining({ margemMm: 12.5, formato: 'A4', orientacao: 'paisagem' }));
  });

  it('a margem que não deixa espaço na folha é recusada, e o botão fica desligado', () => {
    const { onExportar, margem, exportar } = abrir();
    fireEvent.change(margem, { target: { value: '105' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Nesta folha, a margem vai até 50 mm.');
    expect(exportar).toBeDisabled();
    fireEvent.click(exportar);
    expect(onExportar).not.toHaveBeenCalled();
  });

  it('na A4, 50 mm passa e 50,5 mm não', () => {
    const { margem, exportar } = abrir();
    fireEvent.change(margem, { target: { value: '50' } });
    expect(exportar).toBeEnabled();
    fireEvent.change(margem, { target: { value: '50,5' } });
    expect(exportar).toBeDisabled();
  });

  it('o que não é número, ou é negativo, também', () => {
    const { margem, exportar } = abrir();
    for (const valor of ['abc', '-5', '']) {
      fireEvent.change(margem, { target: { value: valor } });
      expect(screen.getByRole('alert')).toHaveTextContent('A margem precisa ser um número de 0 mm para cima.');
      expect(exportar).toBeDisabled();
    }
  });
});

describe('a proporção, as cores e a prévia (ADR 0185)', () => {
  const peca = criarMolde(
    { nome: 'a', referencia: '', tamanho: 'M', quantidade: 1, contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 200), ponto(0, 200)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 180) }, restricaoDeRotacao: { permite180: false, permite90e270: false } },
    'a',
  );

  it('entrega a proporção escolhida e as cores', () => {
    const onExportar = vi.fn();
    render(<PainelDeExportacaoPdf podeExportarEncaixeCompleto gerando={false} onExportar={onExportar} onFechar={() => {}} />);
    fireEvent.change(screen.getByLabelText('Proporção'), { target: { value: 'porcentagem' } });
    fireEvent.change(screen.getByLabelText('Porcentagem (%)'), { target: { value: '50' } });
    fireEvent.click(screen.getByLabelText('Em cores'));
    fireEvent.click(screen.getByRole('button', { name: 'Exportar' }));
    expect(onExportar).toHaveBeenCalledWith(expect.objectContaining({ emCores: false, escala: expect.objectContaining({ proporcao: 'porcentagem', porcentagem: 50 }) }));
  });

  it('recusa a porcentagem que não é número', () => {
    render(<PainelDeExportacaoPdf podeExportarEncaixeCompleto gerando={false} onExportar={() => {}} onFechar={() => {}} />);
    fireEvent.change(screen.getByLabelText('Proporção'), { target: { value: 'porcentagem' } });
    fireEvent.change(screen.getByLabelText('Porcentagem (%)'), { target: { value: 'x' } });
    expect(screen.getByRole('button', { name: 'Exportar' })).toBeDisabled();
  });

  it('Visualizar mostra as peças e as folhas', () => {
    render(<PainelDeExportacaoPdf podeExportarEncaixeCompleto gerando={false} pecas={[peca]} desenho={{ larguraMm: 100, comprimentoMm: 200 }} onExportar={() => {}} onFechar={() => {}} />);
    expect(screen.queryByRole('img', { name: 'Prévia da impressão' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Visualizar' }));
    expect(screen.getByRole('img', { name: 'Prévia da impressão' })).toBeInTheDocument();
    expect(screen.getByText('1 folha')).toBeInTheDocument();
  });
});

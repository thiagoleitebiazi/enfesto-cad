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
    expect(onExportar).toHaveBeenCalledWith(expect.objectContaining({ margemMm: 12.5, formato: 'A4' }));
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

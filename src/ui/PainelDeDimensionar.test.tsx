import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PainelDeDimensionar } from './PainelDeDimensionar';

afterEach(() => cleanup());

describe('PainelDeDimensionar — os números em português', () => {
  it('as medidas atuais e as novas com vírgula decimal (antes: 100.3 mm)', () => {
    render(<PainelDeDimensionar larguraAtualMm={100.26} alturaAtualMm={50.44} onAplicar={() => {}} onFechar={() => {}} />);
    const valor = (rotulo: string) => screen.getByText(rotulo, { selector: 'dt' }).nextElementSibling!.textContent;
    expect(valor('Largura atual')).toBe('100,3 mm');
    expect(valor('Altura atual')).toBe('50,4 mm');
    expect(valor('Nova largura')).toBe('100,3 mm');

    fireEvent.change(screen.getByLabelText('Fator X'), { target: { value: '1.5' } });
    fireEvent.change(screen.getByLabelText('Fator Y'), { target: { value: '2' } });
    expect(valor('Nova largura')).toBe('150,4 mm');
    expect(valor('Nova altura')).toBe('100,9 mm');
    expect(screen.getByText('Largura atual').closest('dl')!.textContent).not.toMatch(/\d\.\d/);
  });

  it('com fator inválido, o travessão, como antes', () => {
    render(<PainelDeDimensionar larguraAtualMm={100} alturaAtualMm={50} onAplicar={() => {}} onFechar={() => {}} />);
    fireEvent.change(screen.getByLabelText('Fator X'), { target: { value: '0' } });
    expect(screen.getByText('Nova largura', { selector: 'dt' }).nextElementSibling!.textContent).toBe('— mm');
  });
});

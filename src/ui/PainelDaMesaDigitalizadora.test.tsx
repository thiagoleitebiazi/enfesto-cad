import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { PecaDaMesa } from '../domain/mesaDigitalizadora';
import { PainelDaMesaDigitalizadora, type EscolhaDePortaSerial } from './PainelDaMesaDigitalizadora';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

/** Dois retângulos tocados com o cursor (a 1000 linhas por polegada), o segundo com um pique, mais duas linhas de lixo. */
const REGISTRO = [
  'MESA PRONTA',
  '0,0,1',
  '4000,0,1',
  '4000,2000,1',
  '0,2000,1',
  '0,0,5',
  '0,0,1',
  '2000,0,1',
  '2000,1000,3',
  '2000,2000,1',
  '0,2000,1',
  '0,0,5',
  '1,2',
].join('\r\n');

function abrir(escolha: EscolhaDePortaSerial | null = null) {
  const onCriarPecas = vi.fn((pecas: readonly PecaDaMesa[]) => pecas.map((_, i) => `Peça da mesa ${i + 1}`));
  render(<PainelDaMesaDigitalizadora onCriarPecas={onCriarPecas} escolhaDePorta={escolha} onFechar={() => {}} />);
  return onCriarPecas;
}

describe('a janela da mesa digitalizadora (ADR 0144)', () => {
  it('o registro colado vira peças: as duas juntas no desenho, com o pique, e as linhas de lixo contadas', () => {
    const onCriarPecas = abrir();
    expect(screen.getByRole('table', { name: 'Os botões do cursor' })).toHaveTextContent('Fechar a peça');
    fireEvent.change(screen.getByLabelText('Registro da mesa'), { target: { value: REGISTRO } });
    fireEvent.click(screen.getByRole('button', { name: 'Ler o registro' }));
    expect(onCriarPecas).toHaveBeenCalledTimes(1);
    const pecas = onCriarPecas.mock.calls[0]![0];
    expect(pecas).toHaveLength(2);
    // 4000 × 2000 linhas a 1000 lpi = 101,6 × 50,8 mm.
    const ys = pecas[0]!.contorno.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(101.6);
    expect(pecas[1]!.piques).toHaveLength(1);
    expect(screen.getByRole('status')).toHaveTextContent('Peça fechada com 5 pontos e 1 pique(s). No desenho: Peça da mesa 1, Peça da mesa 2. 2 linha(s) que não são toques ficaram de fora.');
    expect(screen.getByText('Peças desta mesa: Peça da mesa 1, Peça da mesa 2.')).toBeInTheDocument();
  });

  it('a peça pela metade fica na mesa (o contador mostra), e a ordem dos campos e a resolução ficam guardadas', () => {
    const onCriarPecas = abrir();
    fireEvent.change(screen.getByLabelText('Ordem dos campos'), { target: { value: 'bxy' } });
    fireEvent.change(screen.getByLabelText('Resolução (linhas por polegada)'), { target: { value: '254' } });
    fireEvent.change(screen.getByLabelText('Registro da mesa'), { target: { value: '1,0,0\n2,100,0\n4,10,10\n' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ler o registro' }));
    expect(onCriarPecas).not.toHaveBeenCalled();
    expect(screen.getByText('Peça na mesa: 2 ponto(s), 1 de curva · fio 1/2')).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem('enfesto-cad:mesa-digitalizadora')!)).toMatchObject({ botaoNoComeco: true, linhasPorPolegada: 254 });
  });

  it('a lista das portas que o programa manda: escolher uma, ou cancelar; sem nenhuma, diz isso', () => {
    let mostrar: ((portas: ReadonlyArray<{ readonly id: string; readonly nome: string }>) => void) | null = null;
    const escolher = vi.fn();
    abrir({
      aoEscolher: (ouvir) => {
        mostrar = ouvir;
        return () => {
          mostrar = null;
        };
      },
      escolher,
    });
    act(() => mostrar!([{ id: 'p1', nome: 'USB Serial (COM3)' }]));
    fireEvent.click(screen.getByRole('button', { name: 'Usar USB Serial (COM3)' }));
    expect(escolher).toHaveBeenLastCalledWith('p1');
    act(() => mostrar!([]));
    expect(screen.getByText(/Nenhuma porta serial encontrada/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(escolher).toHaveBeenLastCalledWith('');
  });
});

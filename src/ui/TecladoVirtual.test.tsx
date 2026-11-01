import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { digitarNoCampo } from './digitarNoCampo';
import { TecladoVirtual } from './TecladoVirtual';

afterEach(cleanup);

function Campo(): React.JSX.Element {
  const [valor, setValor] = useState('ab');
  return <input aria-label="campo" value={valor} onChange={(e) => setValor(e.target.value)} />;
}

const campo = (): HTMLInputElement => screen.getByLabelText<HTMLInputElement>('campo');

describe('o teclado virtual (ADR 0211)', () => {
  it('escreve no campo controlado, onde o cursor está', () => {
    render(<Campo />);
    campo().setSelectionRange(1, 1);
    expect(digitarNoCampo(campo(), 'x')).toBe(true);
    expect(campo().value).toBe('axb');
    expect(campo().selectionStart).toBe(2);
  });

  it('apaga para trás, ou a parte selecionada', () => {
    render(<Campo />);
    campo().setSelectionRange(2, 2);
    digitarNoCampo(campo(), 'apagar');
    expect(campo().value).toBe('a');
    digitarNoCampo(campo(), 'cd');
    campo().setSelectionRange(0, 2);
    digitarNoCampo(campo(), 'apagar');
    expect(campo().value).toBe('d');
  });

  it('o campo de número aceita, sem ter cursor', () => {
    const o = document.createElement('input');
    o.type = 'number';
    o.value = '12';
    expect(digitarNoCampo(o, '3')).toBe(true);
    expect(o.value).toBe('123');
  });

  it('sem campo com o foco, não faz nada', () => {
    expect(digitarNoCampo(document.body, 'x')).toBe(false);
    expect(digitarNoCampo(null, 'x')).toBe(false);
  });

  it('as teclas escrevem no campo com o foco, e as maiúsculas alternam', () => {
    render(
      <>
        <Campo />
        <TecladoVirtual onFechar={() => undefined} />
      </>,
    );
    campo().focus();
    campo().setSelectionRange(2, 2);
    fireEvent.click(screen.getByRole('button', { name: 'q' }));
    fireEvent.click(screen.getByRole('button', { name: 'Maiúsculas' }));
    fireEvent.click(screen.getByRole('button', { name: 'Q' }));
    fireEvent.click(screen.getByRole('button', { name: 'Espaço' }));
    expect(campo().value).toBe('abqQ ');
  });

  it('apertar a tecla não tira o foco do campo', () => {
    render(<TecladoVirtual onFechar={() => undefined} />);
    expect(fireEvent.mouseDown(screen.getByRole('button', { name: 'q' }))).toBe(false);
  });

  it('fecha', () => {
    const onFechar = vi.fn();
    render(<TecladoVirtual onFechar={onFechar} />);
    fireEvent.click(screen.getByRole('button', { name: 'Fechar o teclado' }));
    expect(onFechar).toHaveBeenCalled();
  });
});

describe('o resto do teclado (ADR 0218)', () => {
  it('escreve os acentos', () => {
    render(
      <>
        <Campo />
        <TecladoVirtual onFechar={() => undefined} />
      </>,
    );
    campo().focus();
    campo().setSelectionRange(2, 2);
    fireEvent.click(screen.getByRole('button', { name: 'ã' }));
    expect(campo().value).toBe('abã');
  });

  it('Tab vai ao campo seguinte, sem cair no teclado', () => {
    render(
      <div role="dialog">
        <input aria-label="um" />
        <input aria-label="dois" />
        <TecladoVirtual onFechar={() => undefined} />
      </div>,
    );
    screen.getByLabelText('um').focus();
    fireEvent.click(screen.getByRole('button', { name: 'Tab' }));
    expect(document.activeElement).toBe(screen.getByLabelText('dois'));
    fireEvent.click(screen.getByRole('button', { name: 'Tab' }));
    expect(document.activeElement).toBe(screen.getByLabelText('um'));
  });

  it('Enter envia o formulário do campo', () => {
    const enviar = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <>
        <form onSubmit={enviar}>
          <input aria-label="campo" />
        </form>
        <TecladoVirtual onFechar={() => undefined} />
      </>,
    );
    campo().focus();
    fireEvent.click(screen.getByRole('button', { name: 'Enter' }));
    expect(enviar).toHaveBeenCalled();
  });
});

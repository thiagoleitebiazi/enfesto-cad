import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MARGEM_DE_SEGURANCA_DA_MESA_MM } from '../domain/enfesto';
import { PainelDeNovoProjeto } from './PainelDeNovoProjeto';

afterEach(() => cleanup());

describe('PainelDeNovoProjeto — a nota das margens da mesa', () => {
  it('diz que não há margens adicionais, mas que a margem de segurança de 4 mm vale sempre (antes: "sem margens")', () => {
    render(<PainelDeNovoProjeto onCriar={() => {}} onFechar={() => {}} />);
    const nota = screen.getByText(/Não há margens adicionais/);
    expect(MARGEM_DE_SEGURANCA_DA_MESA_MM).toBe(4);
    expect(nota).toHaveTextContent(
      'As medidas da mesa definem o enfesto inicial (tipo Ímpar). Não há margens adicionais, mas a margem de segurança de 4 mm vale sempre: nenhuma peça chega mais perto que isso das bordas da mesa. Ajuste depois pelo botão "Enfesto" se precisar de outro tipo ou de margens maiores.',
    );
    expect(screen.queryByText(/sem margens\)/)).toBeNull();
  });
});

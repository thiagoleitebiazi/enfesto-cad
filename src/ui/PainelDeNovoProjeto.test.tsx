import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MARGEM_DE_SEGURANCA_DA_MESA_MM } from '../domain/enfesto';
import { PainelDeNovoProjeto } from './PainelDeNovoProjeto';
import { criarProjeto } from '../domain/projeto';

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

describe('PainelDeNovoProjeto — começar de uma base aprovada (ADR 0126)', () => {
  const base = {
    ...criarProjeto('Calça base', 'base-1', 'ENF-B', '2026-10-09T12:00:00.000Z', { pecas: [], tecido: null, enfesto: null }),
    base: { aprovadaEmIso: '2026-10-10T12:00:00.000Z', responsavel: 'Ana', nota: 'calça reta' },
  };

  it('sem bases, nada muda: só a mesa vazia', () => {
    render(<PainelDeNovoProjeto onCriar={() => {}} onFechar={() => {}} bases={[]} onCriarDaBase={() => null} />);
    expect(screen.queryByText('Começar de')).toBeNull();
    expect(screen.getByLabelText('Largura útil da mesa (mm)')).toBeInTheDocument();
  });

  it('com a base escolhida, a mesa e o tecido vêm dela: o nome vai para a base, e o erro aparece', () => {
    const onCriarDaBase = vi.fn((_id: string, nome: string) => (nome === 'Repetido' ? 'Já existe.' : null));
    const onCriar = vi.fn();
    render(<PainelDeNovoProjeto onCriar={onCriar} onFechar={() => {}} bases={[base]} onCriarDaBase={onCriarDaBase} />);
    expect(screen.getByLabelText('Uma mesa vazia')).toBeChecked();
    fireEvent.click(screen.getByLabelText(/Da base “Calça base” \(ENF-B, 0 peça\(s\)\) — calça reta/));
    expect(screen.queryByLabelText('Largura útil da mesa (mm)')).toBeNull();
    expect(screen.getByText(/As peças, o tecido e a mesa vêm da base “Calça base”/)).toBeInTheDocument();
    // O nome que ninguém escreveu vira o da base.
    expect(screen.getByLabelText('Nome do projeto')).toHaveValue('Calça base — modelo novo');
    fireEvent.change(screen.getByLabelText('Nome do projeto'), { target: { value: 'Repetido' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar da base' }));
    expect(screen.getByText('Já existe.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nome do projeto'), { target: { value: 'Calça cargo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar da base' }));
    expect(onCriarDaBase).toHaveBeenLastCalledWith('base-1', 'Calça cargo');
    expect(onCriar).not.toHaveBeenCalled();
    // De volta à mesa vazia: os campos voltam.
    fireEvent.click(screen.getByLabelText('Uma mesa vazia'));
    expect(screen.getByLabelText('Largura útil da mesa (mm)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Criar projeto' })).toBeInTheDocument();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { criarTecido, type Tecido } from '../domain/tecido';
import { PainelDeTecido } from './PainelDeTecido';

afterEach(() => cleanup());

// Um tecido gravado antes do tipo, do custo e do rendimento existirem.
const ANTIGO: Tecido = criarTecido({ nome: 'Malha algodão', referencia: 'TEC-001', larguraTotalMm: 1600, larguraUtilMm: 1500, gramaturaGm2: 180 }, 'tecido-1');

function abrir(tecidoAtual: Tecido | null = ANTIGO) {
  const onSalvar = vi.fn<(t: Tecido) => void>();
  render(<PainelDeTecido tecidoAtual={tecidoAtual} onSalvar={onSalvar} onFechar={() => {}} />);
  const campo = (rotulo: string) => screen.getByLabelText(rotulo) as HTMLInputElement | HTMLSelectElement;
  const salvar = () => fireEvent.click(screen.getByRole('button', { name: 'Salvar tecido' }));
  return { onSalvar, campo, salvar };
}

describe('PainelDeTecido — o tipo, o custo e o rendimento (opcionais)', () => {
  it('o tecido de antes abre com os três "não informado" e salva igual, sem ganhar campo nenhum', () => {
    const { onSalvar, campo, salvar } = abrir();
    expect(campo('Tipo de tecido').value).toBe('');
    expect((campo('Tipo de tecido') as HTMLSelectElement).selectedOptions[0]!.textContent).toBe('Não informado');
    expect(campo('Custo do tecido (R$, opcional)').value).toBe('');
    expect(campo('Rendimento (m/kg, opcional)').value).toBe('');
    salvar();
    expect(onSalvar).toHaveBeenCalledWith(ANTIGO);
  });

  it('com o tipo, o custo e o rendimento, salva os três; ao reabrir, eles voltam como foram digitados', () => {
    const { onSalvar, campo, salvar } = abrir();
    fireEvent.change(campo('Tipo de tecido'), { target: { value: 'tubular' } });
    fireEvent.change(campo('Custo do tecido (R$, opcional)'), { target: { value: '41,90' } });
    fireEvent.change(campo('Unidade do custo'), { target: { value: 'kg' } });
    fireEvent.change(campo('Rendimento (m/kg, opcional)'), { target: { value: '3,2' } });
    salvar();
    const salvo = onSalvar.mock.calls[0]![0];
    expect(salvo).toEqual({ ...ANTIGO, tipoDeTecido: 'tubular', custo: { valor: 41.9, unidade: 'kg', moeda: 'BRL' }, rendimentoMmPorG: 3.2 });
    cleanup();
    const reaberto = abrir(salvo);
    expect([reaberto.campo('Tipo de tecido').value, reaberto.campo('Custo do tecido (R$, opcional)').value, reaberto.campo('Unidade do custo').value, reaberto.campo('Rendimento (m/kg, opcional)').value]).toEqual([
      'tubular',
      '41,90',
      'kg',
      '3,2',
    ]);
  });

  it('o custo negativo, com 3 casas, sem a unidade ou com "R$", e o rendimento que não é número: diz o motivo e não salva', () => {
    const { onSalvar, campo, salvar } = abrir();
    const tentar = (custo: string, unidade: string, rendimento = '') => {
      fireEvent.change(campo('Custo do tecido (R$, opcional)'), { target: { value: custo } });
      fireEvent.change(campo('Unidade do custo'), { target: { value: unidade } });
      fireEvent.change(campo('Rendimento (m/kg, opcional)'), { target: { value: rendimento } });
      salvar();
      return screen.getByText(/custo do tecido|rendimento/i, { selector: '.mensagem-de-erro' }).textContent;
    };
    expect(tentar('-10', 'kg')).toBe('O custo do tecido não pode ser negativo.');
    expect(tentar('10,123', 'kg')).toBe('O custo do tecido pode ter no máximo 2 casas decimais (os centavos).');
    expect(tentar('10', '')).toBe('Diga se o custo do tecido é por metro linear ou por quilo.');
    expect(tentar('R$ 10', 'kg')).toContain('precisa ser um número');
    expect(tentar('', '', 'três')).toBe('O rendimento precisa ser um número (m/kg), com vírgula nas casas decimais.');
    expect(tentar('', '', '0')).toContain('o rendimento precisa ser > 0');
    expect(onSalvar).not.toHaveBeenCalled();
  });

  it('um tecido novo pode ser salvo sem nenhum dos três', () => {
    const { onSalvar, campo, salvar } = abrir(null);
    fireEvent.change(campo('Nome'), { target: { value: 'Ribana' } });
    salvar();
    const salvo = onSalvar.mock.calls[0]![0];
    expect(salvo.nome).toBe('Ribana');
    expect('tipoDeTecido' in salvo || 'custo' in salvo || 'rendimentoMmPorG' in salvo).toBe(false);
  });
});

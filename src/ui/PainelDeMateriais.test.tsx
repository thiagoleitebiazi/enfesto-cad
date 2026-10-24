import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { BIBLIOTECA_VAZIA, salvarMaterial, type BibliotecaDeMateriais } from '../domain/materiais';
import type { MalhaDoCadastro } from '../domain/cadastroDeProducao';
import { PainelDeMateriais } from './PainelDeMateriais';

afterEach(() => cleanup());

const BOTAO = salvarMaterial(
  BIBLIOTECA_VAZIA,
  { id: 'b1', codigo: 'BOT-12', descricao: 'Botão 12 mm', categoria: 'aviamento', unidade: 'un', precoPorUnidade: 0.35, fornecedor: 'Casa do Botão', atualizadoEmIso: '2026-10-01T10:00:00.000Z' },
  '2026-10-01T10:00:00.000Z',
);

const MALHA: MalhaDoCadastro = {
  id: 'k1',
  descricao: 'Malha PV',
  larguraUtilMm: 1700,
  gramaturaGm2: 180,
  tubular: false,
  sentidoUnico: false,
  padrao: 'liso',
  encolhimentoCompensadoNoMolde: false,
  custo: { valor: 38.9, unidade: 'kg', moeda: 'BRL' },
};

/** A janela com a biblioteca guardada de verdade (no estado), como o App faz. */
function Tela(props: { readonly inicial: BibliotecaDeMateriais; readonly onSalvarTexto?: (nome: string, conteudo: string) => Promise<string | null>; readonly usam?: readonly string[] }): React.JSX.Element {
  const [b, setB] = useState(props.inicial);
  let n = 0;
  return (
    <PainelDeMateriais
      biblioteca={b}
      avisos={[]}
      somenteLeitura={false}
      malhasDoCadastro={[MALHA]}
      modelosQueUsam={() => props.usam ?? []}
      onMudar={async (nova) => {
        setB(nova);
        return null;
      }}
      onSalvarTexto={props.onSalvarTexto ?? (async () => null)}
      agoraIso={() => '2026-10-24T12:00:00.000Z'}
      novoId={() => `novo-${++n}`}
      onFechar={() => {}}
    />
  );
}

const linhas = (): HTMLElement[] => within(screen.getByRole('table', { name: 'Materiais da biblioteca' })).getAllByRole('row').slice(1);

describe('PainelDeMateriais', () => {
  it('vazia: diz o que cadastrar e para que serve', () => {
    render(<Tela inicial={BIBLIOTECA_VAZIA} />);
    expect(screen.getByText(/A biblioteca está vazia/)).toBeInTheDocument();
  });

  it('a lista: código, descrição, categoria, preço com vírgula, fornecedor', () => {
    render(<Tela inicial={BOTAO} />);
    expect(linhas()[0]).toHaveTextContent('BOT-12Botão 12 mmAviamentoR$ 0,35/unCasa do Botão');
  });

  it('novo material (um tecido por metro): os campos do tecido aparecem; guardado, entra na lista', async () => {
    render(<Tela inicial={BOTAO} />);
    fireEvent.click(screen.getByRole('button', { name: 'Novo material' }));
    fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Tricoline' } });
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'tecido' } });
    fireEvent.change(screen.getByLabelText('Unidade de compra'), { target: { value: 'm' } });
    fireEvent.change(screen.getByLabelText('Preço por m (R$)'), { target: { value: '18,90' } });
    fireEvent.change(screen.getByLabelText('Largura útil (mm)'), { target: { value: '1480' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('“Tricoline” guardado na biblioteca.'));
    expect(linhas()[0]).toHaveTextContent('Tricoline');
    expect(linhas()[0]).toHaveTextContent('R$ 18,90/m');
  });

  it('o erro (código repetido, número que não é número) aparece e não muda nada', async () => {
    render(<Tela inicial={BOTAO} />);
    fireEvent.click(screen.getByRole('button', { name: 'Novo material' }));
    fireEvent.change(screen.getByLabelText('Descrição *'), { target: { value: 'Outro botão' } });
    fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'bot-12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('O código bot-12 já é de outro material.'));
    fireEvent.change(screen.getByLabelText('Código'), { target: { value: 'BOT-15' } });
    fireEvent.change(screen.getByLabelText('Preço por un (R$)'), { target: { value: 'dez' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/precisam ser números/));
  });

  it('editar o preço guarda o anterior, que aparece no formulário', async () => {
    render(<Tela inicial={BOTAO} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar Botão 12 mm' }));
    expect(screen.getByLabelText('Preço por un (R$)')).toHaveValue('0,35');
    fireEvent.change(screen.getByLabelText('Preço por un (R$)'), { target: { value: '0,42' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await waitFor(() => expect(linhas()[0]).toHaveTextContent('R$ 0,42/un'));
    fireEvent.click(screen.getByRole('button', { name: 'Editar Botão 12 mm' }));
    expect(screen.getByText(/R\$ 0,35 — até/)).toBeInTheDocument();
  });

  it('remover avisa os modelos que usam o material', async () => {
    const confirmar = vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<Tela inicial={BOTAO} usam={['Camisa social (ENF-1)']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover Botão 12 mm' }));
    expect(confirmar.mock.calls[0]![0]).toMatch(/usado na ficha técnica de: Camisa social \(ENF-1\)/);
    await waitFor(() => expect(screen.getByText(/A biblioteca está vazia/)).toBeInTheDocument());
    confirmar.mockRestore();
  });

  it('trazer as malhas do cadastro e exportar o CSV', async () => {
    const onSalvarTexto = vi.fn(async () => 'C:/x/materiais-e-aviamentos.csv');
    render(<Tela inicial={BOTAO} onSalvarTexto={onSalvarTexto} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trazer as malhas do cadastro (1)' }));
    await waitFor(() => expect(linhas()).toHaveLength(2));
    expect(linhas()[0]).toHaveTextContent('Malha PVTecidoR$ 38,90/kg');
    expect(screen.getByRole('button', { name: 'Trazer as malhas do cadastro' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Salvo em C:/x/materiais-e-aviamentos.csv.'));
    expect((onSalvarTexto.mock.calls[0] as unknown as [string, string])[1]).toMatch(/^Código;Descrição/);
  });

  it('a busca e o filtro de categoria', async () => {
    render(<Tela inicial={BOTAO} />);
    fireEvent.click(screen.getByRole('button', { name: 'Trazer as malhas do cadastro (1)' }));
    await waitFor(() => expect(linhas()).toHaveLength(2));
    fireEvent.change(screen.getByLabelText('Procurar'), { target: { value: 'casa do botao' } });
    expect(linhas().map((l) => l.textContent)).toEqual([expect.stringContaining('Botão 12 mm')]);
    fireEvent.change(screen.getByLabelText('Procurar'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'tecido' } });
    expect(linhas().map((l) => l.textContent)).toEqual([expect.stringContaining('Malha PV')]);
  });

  it('os padrões de custo: guardados com vírgula; a soma de 100% ou mais é recusada', async () => {
    render(<Tela inicial={BOTAO} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Padrões de custo' }));
    fireEvent.change(screen.getByLabelText('Custo do minuto de costura (R$)'), { target: { value: '0,48' } });
    fireEvent.change(screen.getByLabelText('Margem de lucro (% do preço)'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar os padrões' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/abaixo de 100%/));
    fireEvent.change(screen.getByLabelText('Margem de lucro (% do preço)'), { target: { value: '25' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar os padrões' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Padrões de custo guardados'));
  });
});

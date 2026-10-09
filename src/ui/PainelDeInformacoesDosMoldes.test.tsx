import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { PainelDeInformacoesDosMoldes } from './PainelDeInformacoesDosMoldes';
import { ponto } from '../core/geometria';
import { adicionarPique, criarMolde } from '../domain/molde';

// Frente: 200 × 300 mm, 600 cm², perímetro 1000 mm; 2 unidades, costura de 10 mm e um pique.
const frente = adicionarPique(
  criarMolde(
    {
      nome: 'Frente',
      referencia: 'REF-001',
      tamanho: 'M',
      contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)],
      linhaDeFio: { inicio: ponto(100, 50), fim: ponto(100, 250) },
      quantidade: 2,
      margemDeCosturaMm: 10,
    },
    'frente',
  ),
  ponto(100, 0),
  'p1',
);
// Gola: triângulo 30-40-50, 6 cm², perímetro 120 mm; sem referência nem tamanho.
const gola = criarMolde(
  {
    nome: 'Gola',
    referencia: '',
    tamanho: '',
    contorno: [ponto(300, 0), ponto(330, 0), ponto(300, 40)],
    linhaDeFio: { inicio: ponto(305, 5), fim: ponto(305, 25) },
    quantidade: 3,
  },
  'gola',
);

function renderizar(pecas = [frente, gola], selecionadoId: string | null = null) {
  const selecionar = vi.fn();
  const fechar = vi.fn();
  render(
    <PainelDeInformacoesDosMoldes pecas={pecas} selecionadoId={selecionadoId} onSelecionar={selecionar} onFechar={fechar} />,
  );
  return { selecionar, fechar };
}

const celulasDaLinha = (nome: string): string[] =>
  within(screen.getByRole('rowheader', { name: nome }).closest('tr')!)
    .getAllByRole('cell')
    .map((c) => c.textContent ?? '');

describe('PainelDeInformacoesDosMoldes', () => {
  afterEach(() => cleanup());

  it('mostra uma linha por peça, com as medidas do contorno', () => {
    renderizar();

    // Referência, tamanho, quantidade, largura, altura, área, perímetro, costura, pontos, piques, furos.
    expect(celulasDaLinha('Frente')).toEqual(['REF-001', 'M', '2', '200,0', '300,0', '600,0', '1000,0', '10,0', '4', '1', '0']);
    expect(celulasDaLinha('Gola')).toEqual(['—', '—', '3', '30,0', '40,0', '6,0', '120,0', '0,0', '3', '0', '0']);
  });

  it('soma no rodapé as peças a cortar e a área, contando a quantidade de cada molde', () => {
    renderizar();

    const rodape = screen.getByRole('rowheader', { name: '2 moldes' }).closest('tr')!;
    // 2 + 3 unidades; 2 × 600 + 3 × 6 = 1218 cm².
    expect(within(rodape).getByText('5')).toBeInTheDocument();
    expect(within(rodape).getByText('1218,0')).toBeInTheDocument();
  });

  it('com um molde só, o rodapé fica no singular', () => {
    renderizar([frente]);

    expect(screen.getByRole('rowheader', { name: '1 molde' })).toBeInTheDocument();
  });

  it('marca a linha da peça selecionada, e clicar noutra linha a seleciona', () => {
    const { selecionar } = renderizar([frente, gola], 'frente');
    expect(screen.getByRole('rowheader', { name: 'Frente' }).closest('tr')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('rowheader', { name: 'Gola' }).closest('tr')).toHaveAttribute('aria-selected', 'false');

    fireEvent.click(screen.getByRole('rowheader', { name: 'Gola' }));

    expect(selecionar).toHaveBeenCalledExactlyOnceWith('gola');
  });

  it('sem peças, diz isso em vez de mostrar uma tabela vazia', () => {
    renderizar([]);

    expect(screen.getByText('Nenhuma peça no projeto.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('o botão Fechar fecha o diálogo', () => {
    const { fechar } = renderizar();

    fireEvent.click(screen.getByText('Fechar'));

    expect(fechar).toHaveBeenCalledTimes(1);
  });
});

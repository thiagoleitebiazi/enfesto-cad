import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ImagemDePixels } from '../domain/digitalizacao';
import type { ImagemDoModelo } from '../domain/imagens';
import { criarProjeto, type Projeto } from '../domain/projeto';
import { BuscaPorImagem } from './BuscaPorImagem';

afterEach(() => cleanup());

function imagem(largura: number, altura: number, cor: (x: number, y: number) => readonly [number, number, number]): ImagemDePixels {
  const dados = new Uint8ClampedArray(largura * altura * 4);
  for (let y = 0; y < altura; y++)
    for (let x = 0; x < largura; x++) {
      const [r, g, b] = cor(x, y);
      dados.set([r, g, b, 255], (y * largura + x) * 4);
    }
  return { largura, altura, dados };
}
const vestido = (e: number) => imagem(90 * e, 80 * e, (x, y) => (Math.abs(x - 45 * e) < 10 * e + (y / (80 * e)) * 30 * e ? [30, 60, 200] : [255, 255, 255]));
const camiseta = imagem(90, 80, (x, y) => ((y < 25 && x > 5 && x < 85) || (x > 30 && x < 60) ? [200, 30, 30] : [255, 255, 255]));

/** As imagens "lidas": pelo texto da imagem guardada; a foto escolhida (o arquivo) é o vestido pequeno. */
const lerPixels = vi.fn(async (dados: string): Promise<ImagemDePixels> => {
  if (dados === 'data:vestido-grande') return vestido(2);
  if (dados === 'data:camiseta') return camiseta;
  if (dados.startsWith('data:image/png')) return vestido(1);
  throw new Error('imagem desconhecida');
});

const comImagem = (id: string, nome: string, dados: string): Projeto => ({
  ...criarProjeto(nome, id, `ENF-${id}`, '2026-10-26T10:00:00.000Z', { pecas: [], tecido: null, enfesto: null }),
  imagens: [{ id: `img-${id}`, nome: 'foto', dados, larguraPx: 90, alturaPx: 80, origem: { x: 0, y: 0 }, mmPorPx: 1, calibrada: false, opacidade: 1, visivel: true } satisfies ImagemDoModelo],
});

describe('a busca por imagem na biblioteca (ADR 0145)', () => {
  it('a foto escolhida acha o modelo mais parecido primeiro; os sem imagem ficam de fora, contados; abrir abre', async () => {
    const onAbrir = vi.fn();
    const projetos = [comImagem('c', 'Camiseta', 'data:camiseta'), criarProjeto('Sem foto', 's', 'ENF-s', '2026-10-26T10:00:00.000Z', { pecas: [], tecido: null, enfesto: null }), comImagem('v', 'Vestido', 'data:vestido-grande')];
    render(<BuscaPorImagem projetos={projetos} onAbrir={onAbrir} lerPixels={lerPixels} />);
    fireEvent.change(screen.getByLabelText('Imagem para buscar'), { target: { files: [new File([new Uint8Array([1, 2, 3])], 'vitrine.png', { type: 'image/png' })] } });
    const resultado = await screen.findByRole('status');
    expect(resultado).toHaveTextContent('Os mais parecidos com vitrine.png: 1 projeto(s) sem imagem ficaram de fora');
    const itens = within(resultado).getAllByRole('listitem');
    expect(itens.map((li) => li.querySelector('strong')!.textContent)).toEqual(['Vestido', 'Camiseta']);
    expect(itens[0]).toHaveTextContent(/parecido (9\d|100)%/);
    fireEvent.click(within(itens[0]!).getByRole('button', { name: 'Abrir' }));
    expect(onAbrir).toHaveBeenCalledWith('v');
    // A segunda busca não lê de novo as imagens dos modelos.
    const lidasAntes = lerPixels.mock.calls.length;
    fireEvent.change(screen.getByLabelText('Imagem para buscar'), { target: { files: [new File([new Uint8Array([1])], 'outra.png', { type: 'image/png' })] } });
    expect(await screen.findByText(/Os mais parecidos com outra.png/)).toBeInTheDocument();
    expect(lerPixels.mock.calls.length).toBe(lidasAntes + 1);
  });
});

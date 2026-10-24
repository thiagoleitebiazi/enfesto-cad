import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { DESENHO_VAZIO, type DesenhoTecnico, type TracoDoDesenho } from '../domain/desenhoTecnico';
import type { ImagemDoModelo } from '../domain/imagens';
import { PainelDoDesenhoTecnico } from './PainelDoDesenhoTecnico';

const IMAGEM: ImagemDoModelo = {
  id: 'img1',
  nome: 'Estampa floral',
  dados: 'data:image/png;base64,iVBORw0KGgo=',
  larguraPx: 200,
  alturaPx: 100,
  origem: { x: 0, y: 0 },
  mmPorPx: 0.26,
  calibrada: false,
  opacidade: 1,
  visivel: true,
};

// A folha ocupa 400 × 500 px a partir de (0, 0): o ponto da tela é o ponto da folha.
const caixaOriginal = Element.prototype.getBoundingClientRect;
beforeEach(() => {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    return { left: 0, top: 0, width: 400, height: 500, right: 400, bottom: 500, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
});
afterEach(() => {
  Element.prototype.getBoundingClientRect = caixaOriginal;
  cleanup();
});

function abrir(opcoes: { readonly desenho?: DesenhoTecnico; readonly somenteLeitura?: string | null } = {}) {
  const onGuardar = vi.fn();
  const onExportarSvg = vi.fn();
  let n = 0;
  render(
    <PainelDoDesenhoTecnico
      desenho={opcoes.desenho ?? DESENHO_VAZIO}
      somenteLeitura={opcoes.somenteLeitura ?? null}
      imagens={[IMAGEM]}
      onGuardar={onGuardar}
      onExportarSvg={onExportarSvg}
      novoId={() => `d${++n}`}
      onFechar={() => {}}
    />,
  );
  const folha = screen.getByRole('img', { name: /^Folha do desenho/ });
  /** Um clique (apertar e soltar) num ponto da folha. */
  const clicar = (x: number, y: number): void => {
    fireEvent.pointerDown(folha, { clientX: x, clientY: y, pointerId: 1 });
    fireEvent.pointerUp(folha, { clientX: x, clientY: y, pointerId: 1 });
  };
  const ultimo = (): DesenhoTecnico => onGuardar.mock.calls.at(-1)![0] as DesenhoTecnico;
  return { onGuardar, onExportarSvg, folha, clicar, ultimo };
}

const ferramenta = (nome: string) => fireEvent.click(within(screen.getByRole('toolbar', { name: 'Ferramentas' })).getByRole('button', { name: nome }));

describe('PainelDoDesenhoTecnico', () => {
  it('pôr a base: o contorno da frente e das costas e os detalhes; guardado sozinho na ficha', async () => {
    const { onGuardar, ultimo } = abrir();
    fireEvent.change(screen.getByLabelText('Base técnica'), { target: { value: 'calca' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pôr a base (frente e costas)' }));
    expect(screen.getByRole('tab', { name: 'Frente (4)' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Costas (3)' })).toBeInTheDocument();
    await waitFor(() => expect(onGuardar).toHaveBeenCalled(), { timeout: 2000 });
    expect(ultimo().elementos).toHaveLength(7);
  });

  it('a reta: clica os pontos, duplo clique termina; com o espelho, aparece dos dois lados', async () => {
    const { folha, clicar, onGuardar, ultimo } = abrir();
    ferramenta('Reta');
    clicar(120, 200);
    clicar(150, 260);
    fireEvent.doubleClick(folha);
    // O traço e o espelho dele (e o realce dos dois, por estar escolhido).
    const caminhos = folha.querySelectorAll('path:not(.traco-em-desenho)');
    expect(caminhos.length).toBeGreaterThanOrEqual(2);
    await waitFor(() => expect(onGuardar).toHaveBeenCalled(), { timeout: 2000 });
    const traco = ultimo().elementos[0] as TracoDoDesenho;
    expect(traco).toMatchObject({ tipo: 'traco', vista: 'frente', estilo: 'contorno', espelhar: true, pontos: [{ x: 120, y: 200 }, { x: 150, y: 260 }] });
  });

  it('escolher (também pelo espelho), mudar o estilo, apagar; desfazer volta', async () => {
    const { clicar, folha } = abrir();
    ferramenta('Reta');
    clicar(100, 100);
    clicar(140, 100);
    fireEvent.doubleClick(folha);
    ferramenta('Selecionar');
    clicar(10, 10);
    expect(screen.getByText(/Escolha um elemento/)).toBeInTheDocument();
    // O espelho da reta fica em x de 260 a 300.
    clicar(280, 101);
    expect(screen.getByLabelText('Estilo')).toHaveValue('contorno');
    fireEvent.change(screen.getByLabelText('Estilo'), { target: { value: 'pesponto' } });
    expect(folha.querySelector('path[stroke-dasharray="4 3"]')).not.toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Apagar' }));
    expect(screen.getByRole('tab', { name: 'Frente (0)' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    expect(screen.getByRole('tab', { name: 'Frente (1)' })).toBeInTheDocument();
  });

  it('arrastar move o elemento (o arrasto inteiro é um desfazer só); arrastar um ponto muda só ele', async () => {
    const { clicar, folha, onGuardar, ultimo } = abrir();
    ferramenta('Reta');
    clicar(100, 100);
    clicar(140, 100);
    fireEvent.doubleClick(folha);
    ferramenta('Selecionar');
    fireEvent.pointerDown(folha, { clientX: 120, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(folha, { clientX: 125, clientY: 110, pointerId: 1 });
    fireEvent.pointerMove(folha, { clientX: 130, clientY: 120, pointerId: 1 });
    fireEvent.pointerUp(folha, { clientX: 130, clientY: 120, pointerId: 1 });
    // Agora o ponto do começo (110, 120) é puxado para (110, 150).
    fireEvent.pointerDown(folha, { clientX: 110, clientY: 120, pointerId: 1 });
    fireEvent.pointerMove(folha, { clientX: 110, clientY: 150, pointerId: 1 });
    fireEvent.pointerUp(folha, { clientX: 110, clientY: 150, pointerId: 1 });
    await waitFor(() => expect(onGuardar).toHaveBeenCalled(), { timeout: 2000 });
    await waitFor(() => expect((ultimo().elementos[0] as TracoDoDesenho).pontos).toEqual([{ x: 110, y: 150 }, { x: 150, y: 120 }]), { timeout: 2000 });
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    await waitFor(() => expect((ultimo().elementos[0] as TracoDoDesenho).pontos).toEqual([{ x: 100, y: 100 }, { x: 140, y: 100 }]), { timeout: 2000 });
  });

  it('o texto, a forma e a estampa', async () => {
    const { clicar, folha, onGuardar, ultimo } = abrir();
    ferramenta('Texto');
    clicar(40, 470);
    fireEvent.change(screen.getByLabelText('Texto'), { target: { value: 'Pesponto duplo a 6 mm' } });
    expect(folha).toHaveTextContent('Pesponto duplo a 6 mm');
    fireEvent.change(screen.getByLabelText('Forma'), { target: { value: 'botao' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pôr a forma' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pôr a estampa' }));
    expect(folha.querySelector('image')).not.toBeNull();
    fireEvent.change(screen.getByLabelText('Largura da estampa'), { target: { value: '120' } });
    await waitFor(() => expect(onGuardar).toHaveBeenCalled(), { timeout: 2000 });
    await waitFor(() => expect(ultimo().elementos.map((e) => e.tipo)).toEqual(['texto', 'traco', 'traco', 'estampa']), { timeout: 2000 });
    expect(ultimo().elementos[3]).toMatchObject({ imagemId: 'img1', largura: 120 });
  });

  it('as costas são outra folha; copiar o elemento para a outra vista', () => {
    const { clicar, folha } = abrir();
    ferramenta('Reta');
    clicar(100, 100);
    clicar(140, 100);
    fireEvent.doubleClick(folha);
    fireEvent.click(screen.getByRole('button', { name: 'Copiar para as costas' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Costas (1)' }));
    expect(screen.getByRole('img', { name: 'Folha do desenho — Costas' })).toBeInTheDocument();
  });

  it('só para ver (a ficha aprovada): o motivo, as ferramentas travadas, nada é guardado; o SVG sai', async () => {
    const { onGuardar, onExportarSvg } = abrir({ somenteLeitura: 'A ficha está aprovada (versão 1): o desenho só pode ser visto.' });
    expect(screen.getByText('A ficha está aprovada (versão 1): o desenho só pode ser visto.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reta' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Pôr a base (frente e costas)' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar SVG' }));
    expect(onExportarSvg).toHaveBeenCalledTimes(1);
    await new Promise((r) => setTimeout(r, 700));
    expect(onGuardar).not.toHaveBeenCalled();
  });
});

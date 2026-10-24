import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Ponto2D } from '../core/geometria';
import { pontoDentroDoContorno } from '../core/geometria';
import { aplicarHomografia, homografia, type ImagemDePixels, type Quadrilatero } from '../domain/digitalizacao';
import type { ImagemDoModelo } from '../domain/imagens';
import { PainelDaFotoParaMolde } from './PainelDaFotoParaMolde';

const pt = (x: number, y: number): Ponto2D => ({ x, y });

/** A foto sintética: uma placa de 140 × 190 mm fotografada torta, com o papel de 100 × 150 mm (furo, fio e pique). */
function fotoSintetica(): ImagemDePixels {
  const largura = 600;
  const altura = 720;
  const dados = new Uint8ClampedArray(largura * altura * 4).fill(255);
  const cantos: Quadrilatero = [pt(60, 40), pt(520, 80), pt(560, 690), pt(30, 640)];
  const h = homografia([pt(0, 0), pt(140, 0), pt(140, 190), pt(0, 190)], cantos);
  const camadas: Array<[Ponto2D[], number]> = [
    [[pt(0, 0), pt(140, 0), pt(140, 190), pt(0, 190)], 60],
    [[pt(20, 20), pt(68, 20), pt(70, 24), pt(72, 20), pt(120, 20), pt(120, 170), pt(20, 170)], 220],
    [Array.from({ length: 36 }, (_, i) => pt(50 + 4 * Math.cos((i * Math.PI) / 18), 60 + 4 * Math.sin((i * Math.PI) / 18))), 60],
    [[pt(69.5, 50), pt(70.5, 50), pt(70.5, 140), pt(69.5, 140)], 40],
  ];
  const projetadas = camadas.map(([p, tom]) => [p.map((q) => aplicarHomografia(h, q)), tom] as const);
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      let tom = 100;
      for (const [poligono, t] of projetadas) if (pontoDentroDoContorno(pt(x + 0.5, y + 0.5), poligono)) tom = t;
      const o = (y * largura + x) * 4;
      dados[o] = dados[o + 1] = dados[o + 2] = tom;
    }
  }
  return { largura, altura, dados };
}
const FOTO = fotoSintetica();
const IMAGEM: ImagemDoModelo = { id: 'f1', nome: 'Foto do molde', dados: 'data:image/png;base64,AA==', larguraPx: 600, alturaPx: 720, origem: pt(0, 0), mmPorPx: 0.26, calibrada: false, opacidade: 1, visivel: true };

// O quadro de cada imagem tem o tamanho dela em pixels (o viewBox): o clique na tela é o ponto da imagem.
const caixaOriginal = Element.prototype.getBoundingClientRect;
beforeEach(() => {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    const [, , w, h] = (this.getAttribute('viewBox') ?? '0 0 100 100').split(' ').map(Number);
    return { left: 0, top: 0, width: w!, height: h!, right: w!, bottom: h!, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  };
});
afterEach(() => {
  Element.prototype.getBoundingClientRect = caixaOriginal;
  cleanup();
});

function abrir(imagens: readonly ImagemDoModelo[] = [IMAGEM]) {
  const onCriarPeca = vi.fn(() => null);
  const onTrazerFoto = vi.fn();
  render(
    <PainelDaFotoParaMolde
      imagens={imagens}
      onTrazerFoto={onTrazerFoto}
      onCriarPeca={onCriarPeca}
      lerPixels={async () => FOTO}
      paraDataUrl={() => 'data:,'}
      onFechar={() => {}}
    />,
  );
  return { onCriarPeca, onTrazerFoto };
}

async function marcarECorrigir(): Promise<void> {
  const foto = await screen.findByRole('img', { name: 'Foto para marcar os cantos' });
  for (const [x, y] of [[60, 40], [520, 80], [560, 690], [30, 640]]) fireEvent.click(foto, { clientX: x, clientY: y });
  expect(screen.getByText('Os quatro cantos estão marcados.')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Largura da referência'), { target: { value: '140' } });
  fireEvent.change(screen.getByLabelText('Altura da referência'), { target: { value: '190' } });
  fireEvent.click(screen.getByRole('button', { name: 'Corrigir a perspectiva' }));
}

describe('PainelDaFotoParaMolde', () => {
  it('sem foto: como fotografar; "Trazer uma foto…" abre a escolha do arquivo', () => {
    const { onTrazerFoto } = abrir([]);
    expect(screen.getByText(/Fotografe o molde de papel de cima/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Trazer uma foto…' }));
    expect(onTrazerFoto).toHaveBeenCalled();
  });

  it('os cantos pedidos um por um; corrigida a perspectiva, o clique no molde dá as medidas, o furo, o pique e o fio', async () => {
    abrir();
    expect(await screen.findByText('Clique o canto em cima à esquerda da referência (0 de 4).')).toBeInTheDocument();
    await marcarECorrigir();
    const corrigida = screen.getByRole('img', { name: 'Foto corrigida' });
    // A placa corrigida a 0,5 mm por ponto: o papel começa em 20 mm (40 pontos).
    expect(corrigida.getAttribute('viewBox')).toBe('0 0 280 380');
    fireEvent.click(corrigida, { clientX: 140, clientY: 300 });
    const medidas = screen.getByLabelText('Medidas do molde');
    const largura = Number(medidas.textContent!.match(/Largura × altura([\d,]+) mm/)![1]!.replace(',', '.'));
    expect(Math.abs(largura - 100)).toBeLessThan(1.5);
    expect(medidas).toHaveTextContent(/1 furo\(s\), 1 pique\(s\), fio sugerido/);
  });

  it('o clique fora do molde diz o que fazer', async () => {
    abrir();
    await marcarECorrigir();
    fireEvent.click(screen.getByRole('img', { name: 'Foto corrigida' }), { clientX: 10, clientY: 10 });
    expect(screen.getByText(/O clique não caiu no molde/)).toBeInTheDocument();
  });

  it('conferir uma medida, corrigir a escala por ela, e criar a peça', async () => {
    const { onCriarPeca } = abrir();
    await marcarECorrigir();
    const corrigida = screen.getByRole('img', { name: 'Foto corrigida' });
    fireEvent.click(corrigida, { clientX: 140, clientY: 300 });
    fireEvent.click(screen.getByRole('button', { name: 'Uma medida (2 cliques)' }));
    // Do lado esquerdo ao direito do papel, na altura de 100 mm: 100 mm na foto.
    fireEvent.click(corrigida, { clientX: 40, clientY: 200 });
    fireEvent.click(corrigida, { clientX: 240, clientY: 200 });
    expect(screen.getByLabelText('Conferência da medida')).toHaveTextContent('Na foto: 100,0 mm');
    fireEvent.change(screen.getByLabelText('Medida de verdade'), { target: { value: '102' } });
    expect(screen.getByLabelText('Conferência da medida')).toHaveTextContent('diferença de -2,0%');
    fireEvent.click(screen.getByRole('button', { name: 'Corrigir a escala por esta medida' }));
    expect(screen.getByLabelText('Conferência da medida')).toHaveTextContent('Na foto: 102,0 mm');
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Frente' } });
    fireEvent.change(screen.getByLabelText('Tamanho'), { target: { value: 'M' } });
    fireEvent.click(screen.getByRole('button', { name: 'Criar a peça' }));
    await waitFor(() => expect(onCriarPeca).toHaveBeenCalled());
    // A janela fica pronta para o próximo molde da mesma foto.
    expect(screen.getByRole('status')).toHaveTextContent('Peça(s) criada(s) desta foto: Frente. Para outro molde da mesma foto, clique dentro dele.');
    expect(screen.queryByLabelText('Medidas do molde')).toBeNull();
    const dados = (onCriarPeca.mock.calls[0] as unknown as [{ nome: string; tamanho: string; quantidade: number; molde: { contorno: Ponto2D[]; furos: unknown[]; fio: unknown } }])[0];
    expect(dados).toMatchObject({ nome: 'Frente', tamanho: 'M', quantidade: 1 });
    const xs = dados.molde.contorno.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(100.5);
    expect(dados.molde.furos).toHaveLength(1);
    expect(dados.molde.fio).not.toBeNull();
  });

  it('o fio marcado à mão (dois cliques) fica no lugar do sugerido', async () => {
    abrir();
    await marcarECorrigir();
    const corrigida = screen.getByRole('img', { name: 'Foto corrigida' });
    fireEvent.click(corrigida, { clientX: 140, clientY: 300 });
    fireEvent.click(screen.getByRole('button', { name: 'O fio (2 cliques)' }));
    fireEvent.click(corrigida, { clientX: 100, clientY: 100 });
    fireEvent.click(corrigida, { clientX: 100, clientY: 300 });
    expect(screen.getByLabelText('Medidas do molde')).toHaveTextContent('fio marcado');
  });
});

import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { AreaDeDesenho } from './AreaDeDesenho';
import { criarMolde } from '../domain/molde';
import { TODAS_AS_OPCOES_DA_CERCA } from '../domain/cerca';
import { ponto, type Ponto2D } from '../core/geometria';

// Escala 1 px/mm, sem deslocamento: na tela, x = mundo.y e y = mundo.x (eixos
// trocados, ADR 0012). Com essa escala o ímã prende a até 10 mm e a grade
// visível tem passo de 20 mm.
const TRANSFORM = { escalaPxPorMm: 1, offsetXPx: 0, offsetYPx: 0 };

// Peça selecionada; o vértice 1, (103, 0), fica fora da grade de 20 mm.
const SELECIONADA = criarMolde(
  {
    nome: 'Frente',
    referencia: 'REF-001',
    tamanho: 'M',
    contorno: [ponto(0, 0), ponto(103, 0), ponto(103, 100), ponto(0, 100)],
    linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 80) },
  },
  'a',
);
const VIZINHA = criarMolde(
  {
    nome: 'Costas',
    referencia: 'REF-001',
    tamanho: 'M',
    contorno: [ponto(200, 0), ponto(300, 0), ponto(300, 100), ponto(200, 100)],
    linhaDeFio: { inicio: ponto(250, 20), fim: ponto(250, 80) },
  },
  'b',
);

function canvasDoDesenho(container: HTMLElement): HTMLCanvasElement {
  const canvas = container.querySelector<HTMLCanvasElement>('.area-de-desenho-container canvas');
  if (!canvas) throw new Error('canvas do desenho não encontrado');
  return canvas;
}

function renderizarMoverPonto(opcoes: { imaAtivo: boolean; mostrarGrade: boolean }) {
  const onMoverVariosPontos = vi.fn();
  const { container } = render(
    <AreaDeDesenho
      pecas={[SELECIONADA, VIZINHA]}
      selecionadoId="a"
      idsSelecionadosEmLote={new Set()}
      enfesto={null}
      idsComErro={new Set()}
      transform={TRANSFORM}
      modo="mover-ponto"
      pontosEmEdicao={[]}
      contornoFinalizado={null}
      onTransformChange={vi.fn()}
      onSelecionar={vi.fn()}
      onCursorMove={vi.fn()}
      onCliqueNoCanvas={vi.fn()}
      onMoverPeca={vi.fn()}
      onMoverVariosPontos={onMoverVariosPontos}
      cerca={null}
      opcoesDaCerca={TODAS_AS_OPCOES_DA_CERCA}
      ferramentaDeVista={null}
      mostrarGrade={opcoes.mostrarGrade}
      imaAtivo={opcoes.imaAtivo}
      unidadeDaRegua="cm"
      onAlternarUnidadeDaRegua={vi.fn()}
    />,
  );
  const canvas = canvasDoDesenho(container);
  const naTela = (mundo: Ponto2D) => ({ clientX: mundo.y, clientY: mundo.x });
  return {
    onMoverVariosPontos,
    shiftClique: (mundo: Ponto2D) => {
      fireEvent.mouseDown(canvas, { button: 0, shiftKey: true, ...naTela(mundo) });
      fireEvent.mouseUp(canvas, { button: 0, shiftKey: true, ...naTela(mundo) });
    },
    /** Aperta o mouse em `de`, leva até `ate` e solta lá. */
    arrastar: (de: Ponto2D, ate: Ponto2D) => {
      fireEvent.mouseDown(canvas, { button: 0, ...naTela(de) });
      fireEvent.mouseMove(canvas, naTela(ate));
      fireEvent.mouseUp(canvas, { button: 0, ...naTela(ate) });
    },
  };
}

describe('AreaDeDesenho — "Mover ponto" com o ímã', () => {
  beforeEach(() => {
    // O jsdom não tem ResizeObserver nem desenha em canvas; aqui só importa
    // o que o arrasto entrega ao programa.
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        unobserve = vi.fn();
        disconnect = vi.fn();
      },
    );
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('o vértice arrastado prende no vértice de outra peça', () => {
    const { arrastar, onMoverVariosPontos } = renderizarMoverPonto({ imaAtivo: true, mostrarGrade: false });
    arrastar(ponto(103, 0), ponto(196, 3)); // a 5 mm de (200, 0), canto da vizinha
    expect(onMoverVariosPontos).toHaveBeenCalledExactlyOnceWith([1], { x: 97, y: 0 });
  });

  it('não prende nos vértices da própria peça', () => {
    const { arrastar, onMoverVariosPontos } = renderizarMoverPonto({ imaAtivo: true, mostrarGrade: false });
    arrastar(ponto(103, 0), ponto(100, 96)); // a 5 mm de (103, 100), da própria peça
    expect(onMoverVariosPontos).toHaveBeenCalledExactlyOnceWith([1], { x: -3, y: 96 });
  });

  it('com a grade visível e nenhum vértice perto, prende na grade', () => {
    const { arrastar, onMoverVariosPontos } = renderizarMoverPonto({ imaAtivo: true, mostrarGrade: true });
    arrastar(ponto(103, 0), ponto(133, 7)); // grade de 20 mm: (140, 0)
    expect(onMoverVariosPontos).toHaveBeenCalledExactlyOnceWith([1], { x: 37, y: 0 });
  });

  it('um clique com tremor menor que 3 px não tira o vértice do lugar, nem com a grade', () => {
    const { arrastar, onMoverVariosPontos } = renderizarMoverPonto({ imaAtivo: true, mostrarGrade: true });
    arrastar(ponto(103, 0), ponto(104, 1));
    expect(onMoverVariosPontos).not.toHaveBeenCalled();
  });

  it('os outros vértices da seleção andam o mesmo tanto que o agarrado', () => {
    const { shiftClique, arrastar, onMoverVariosPontos } = renderizarMoverPonto({ imaAtivo: true, mostrarGrade: false });
    shiftClique(ponto(103, 0));
    shiftClique(ponto(103, 100));
    arrastar(ponto(103, 0), ponto(196, 3));
    expect(onMoverVariosPontos).toHaveBeenCalledExactlyOnceWith([1, 2], { x: 97, y: 0 });
  });

  it('com o ímã desligado, o vértice anda exatamente o que o mouse andou', () => {
    const { arrastar, onMoverVariosPontos } = renderizarMoverPonto({ imaAtivo: false, mostrarGrade: true });
    arrastar(ponto(103, 0), ponto(196, 3));
    expect(onMoverVariosPontos).toHaveBeenCalledExactlyOnceWith([1], { x: 93, y: 3 });
  });
});

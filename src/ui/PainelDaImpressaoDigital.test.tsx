import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ponto } from '../core/geometria';
import { criarMolde, transladarMolde, type Molde } from '../domain/molde';
import { IMPRESSAO_VAZIA, type ImpressaoDigital } from '../domain/impressaoDigital';
import { PainelDaImpressaoDigital, type ImagemDeEstampa } from './PainelDaImpressaoDigital';

afterEach(() => cleanup());

const peca = (id: string, nome: string): Molde =>
  criarMolde({ nome, referencia: 'R', tamanho: 'M', contorno: [ponto(0, 0), ponto(0, 200), ponto(300, 200), ponto(300, 0)], linhaDeFio: { inicio: ponto(250, 100), fim: ponto(50, 100) } }, id);
const PECAS = [peca('f', 'Frente'), transladarMolde(peca('c', 'Costas'), ponto(0, 300), 'c')];
const IMAGENS: ImagemDeEstampa[] = [
  { id: 'listras', nome: 'Listras', dados: 'data:image/png;base64,AA', larguraPx: 100, alturaPx: 50 },
  { id: 'flor', nome: 'Flor', dados: 'data:image/png;base64,BB', larguraPx: 80, alturaPx: 80 },
];

function abrir(opcoes: { readonly config?: ImpressaoDigital; readonly mesa?: { larguraMm: number; comprimentoMm: number } | null; readonly imagens?: ImagemDeEstampa[] } = {}) {
  const onGuardar = vi.fn();
  const onExportar = vi.fn(async () => 'C:\\saida\\impressao.pdf');
  render(
    <PainelDaImpressaoDigital
      pecas={PECAS}
      mesa={opcoes.mesa === undefined ? { larguraMm: 1500, comprimentoMm: 7000 } : opcoes.mesa}
      imagens={opcoes.imagens ?? IMAGENS}
      config={opcoes.config ?? IMPRESSAO_VAZIA}
      onGuardar={onGuardar}
      onExportar={onExportar}
      onFechar={() => {}}
    />,
  );
  return { onGuardar, onExportar, ultima: (): ImpressaoDigital => onGuardar.mock.calls.at(-1)![0] as ImpressaoDigital };
}

describe('PainelDaImpressaoDigital', () => {
  it('sem estampa: as peças tracejadas na prévia, e nada a exportar', () => {
    abrir();
    expect(screen.getByRole('status')).toHaveTextContent('0 de 2 peça(s) com estampa · tecido de 1500 mm × 7000 mm · 2 página(s) de até 5 m, na escala 1:1');
    expect(screen.getByRole('img', { name: 'Prévia do tecido estampado' }).querySelectorAll('polygon[stroke-dasharray]')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Exportar PDF para impressão (1:1)' })).toBeDisabled();
  });

  it('a estampa de todas (corrida), uma peça com a sua (localizada), outra sem; a prévia e o PDF', async () => {
    const { onGuardar, onExportar, ultima } = abrir();
    fireEvent.change(screen.getByLabelText('Imagem de todas as peças'), { target: { value: 'listras' } });
    fireEvent.change(screen.getByLabelText('Largura da estampa de todas as peças'), { target: { value: '120' } });
    expect(screen.getByRole('status')).toHaveTextContent('2 de 2 peça(s) com estampa');
    const previa = screen.getByRole('img', { name: 'Prévia do tecido estampado' });
    expect(previa.querySelectorAll('pattern')).toHaveLength(2);
    fireEvent.change(screen.getByLabelText('Estampa de Costas'), { target: { value: 'flor' } });
    fireEvent.change(screen.getByLabelText('Como vai a estampa de Costas'), { target: { value: 'localizada' } });
    expect(previa.querySelectorAll('pattern')).toHaveLength(1);
    expect(previa.querySelectorAll('clipPath')).toHaveLength(1);
    fireEvent.change(screen.getByLabelText('Estampa de Frente'), { target: { value: '__sem__' } });
    expect(screen.getByRole('status')).toHaveTextContent('1 de 2 peça(s) com estampa');
    fireEvent.change(screen.getByLabelText('Sangria'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Exportar PDF para impressão (1:1)' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('PDF para impressão salvo em C:\\saida\\impressao.pdf'));
    const exportada = (onExportar.mock.calls[0] as unknown as [ImpressaoDigital])[0];
    expect(exportada).toEqual({
      padrao: { imagemId: 'listras', modo: 'corrida', larguraMm: 120, alturaMm: 0 },
      porPeca: { c: { imagemId: 'flor', modo: 'localizada', larguraMm: 120, alturaMm: 0 }, f: null },
      sangriaMm: 5,
      linhaDeCorte: true,
    });
    await waitFor(() => expect(onGuardar).toHaveBeenCalled(), { timeout: 2000 });
    expect(ultima()).toEqual(exportada);
  });

  it('sem a mesa, diz; sem imagens, diz de onde trazer', () => {
    abrir({ mesa: null, imagens: [] });
    expect(screen.getByText(/Configure a mesa/)).toBeInTheDocument();
    expect(screen.getByText(/Sem imagens: traga a estampa em Modelo › Imagens/)).toBeInTheDocument();
  });
});

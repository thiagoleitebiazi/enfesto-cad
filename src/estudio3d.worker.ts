import { renderizarEstudio, type FaixaDaImagem, type FundoDoEstudio, type LoteDoEstudio, type QualidadeDoEstudio, type VistaDoEstudio } from './ui/estudio3d';

export interface PedidoDoEstudio {
  readonly vista: VistaDoEstudio;
  readonly lotes: readonly LoteDoEstudio[];
  readonly qualidade: QualidadeDoEstudio;
  readonly fundo: FundoDoEstudio;
  readonly faixa: FaixaDaImagem;
}

export interface RespostaDoEstudio {
  readonly rgba: Uint8ClampedArray;
}

self.addEventListener('message', (evento: MessageEvent<PedidoDoEstudio>) => {
  const { vista, lotes, qualidade, fundo, faixa } = evento.data;
  const rgba = renderizarEstudio(vista, lotes, qualidade, fundo, faixa);
  const resposta: RespostaDoEstudio = { rgba };
  (self as unknown as Worker).postMessage(resposta, [rgba.buffer as ArrayBuffer]);
});

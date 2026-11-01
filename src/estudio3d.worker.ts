import { renderizarEstudio, type FundoDoEstudio, type LoteDoEstudio, type QualidadeDoEstudio, type VistaDoEstudio } from './ui/estudio3d';

export interface PedidoDoEstudio {
  readonly vista: VistaDoEstudio;
  readonly lotes: readonly LoteDoEstudio[];
  readonly qualidade: QualidadeDoEstudio;
  readonly fundo: FundoDoEstudio;
}

export interface RespostaDoEstudio {
  readonly rgba: Uint8ClampedArray;
}

self.addEventListener('message', (evento: MessageEvent<PedidoDoEstudio>) => {
  const { vista, lotes, qualidade, fundo } = evento.data;
  const rgba = renderizarEstudio(vista, lotes, qualidade, fundo);
  const resposta: RespostaDoEstudio = { rgba };
  (self as unknown as Worker).postMessage(resposta, [rgba.buffer as ArrayBuffer]);
});

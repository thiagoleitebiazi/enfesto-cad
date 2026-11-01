import type { FundoDoEstudio, LoteDoEstudio, QualidadeDoEstudio, VistaDoEstudio } from './estudio3d';
import { renderizarEstudio } from './estudio3d';
import type { PedidoDoEstudio, RespostaDoEstudio } from '../estudio3d.worker';

/**
 * A imagem final do estúdio num Worker: leva um segundo ou mais, e a janela não pode parar. Sem Worker (ou se ele falhar),
 * calcula aqui mesmo. `pronta` dá `null` se o pedido foi cancelado.
 */
export function imagemDoEstudio(vista: VistaDoEstudio, lotes: readonly LoteDoEstudio[], qualidade: QualidadeDoEstudio, fundo: FundoDoEstudio): { readonly pronta: Promise<Uint8ClampedArray | null>; readonly cancelar: () => void } {
  const aqui = (): Uint8ClampedArray => renderizarEstudio(vista, lotes, qualidade, fundo);
  if (typeof Worker === 'undefined') return { pronta: Promise.resolve(aqui()), cancelar: () => undefined };
  let cancelado = false;
  let trabalhador: Worker | null = null;
  let responder: (r: Uint8ClampedArray | null) => void = () => undefined;
  const pronta = new Promise<Uint8ClampedArray | null>((resolver) => {
    responder = resolver;
    try {
      trabalhador = new Worker(new URL('../estudio3d.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      resolver(aqui());
      return;
    }
    const w = trabalhador;
    w.onmessage = (e: MessageEvent<RespostaDoEstudio>) => {
      w.terminate();
      resolver(e.data.rgba);
    };
    w.onerror = () => {
      w.terminate();
      if (!cancelado) resolver(aqui());
    };
    const pedido: PedidoDoEstudio = { vista, lotes, qualidade, fundo };
    w.postMessage(pedido);
  });
  return {
    pronta,
    cancelar: () => {
      cancelado = true;
      trabalhador?.terminate();
      responder(null);
    },
  };
}

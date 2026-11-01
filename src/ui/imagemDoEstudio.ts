import type { FundoDoEstudio, LoteDoEstudio, QualidadeDoEstudio, VistaDoEstudio } from './estudio3d';
import { faixasDaImagem, renderizarEstudio } from './estudio3d';
import type { PedidoDoEstudio, RespostaDoEstudio } from '../estudio3d.worker';

/** Quantos trabalhadores no máximo: cada um guarda uma cópia da cena. */
const MAIS_TRABALHADORES = 6;

/**
 * A imagem final dividida em faixas, cada uma num Worker (ADR 0233): a conta é a mesma, mas todos os núcleos do computador
 * trabalham nela, e a janela não para. Sem Worker (ou se algum falhar), calcula aqui mesmo. `pronta` dá `null` se o pedido
 * foi cancelado.
 */
export function imagemDoEstudio(vista: VistaDoEstudio, lotes: readonly LoteDoEstudio[], qualidade: QualidadeDoEstudio, fundo: FundoDoEstudio): { readonly pronta: Promise<Uint8ClampedArray | null>; readonly cancelar: () => void } {
  const aqui = (): Uint8ClampedArray => renderizarEstudio(vista, lotes, qualidade, fundo);
  if (typeof Worker === 'undefined') return { pronta: Promise.resolve(aqui()), cancelar: () => undefined };
  const nucleos = typeof navigator !== 'undefined' && navigator.hardwareConcurrency > 0 ? navigator.hardwareConcurrency : 2;
  const faixas = faixasDaImagem(vista.altura, Math.min(MAIS_TRABALHADORES, Math.max(1, nucleos - 1)));
  const trabalhadores: Worker[] = [];
  let acabou = false;
  let responder: (r: Uint8ClampedArray | null) => void = () => undefined;
  const parar = (): void => {
    acabou = true;
    for (const w of trabalhadores) w.terminate();
  };
  const pronta = new Promise<Uint8ClampedArray | null>((resolver) => {
    responder = resolver;
    const imagem = new Uint8ClampedArray(vista.largura * vista.altura * 4);
    let faltam = faixas.length;
    const falhou = (): void => {
      if (acabou) return;
      parar();
      resolver(aqui());
    };
    try {
      for (const faixa of faixas) {
        const w = new Worker(new URL('../estudio3d.worker.ts', import.meta.url), { type: 'module' });
        trabalhadores.push(w);
        w.onmessage = (e: MessageEvent<RespostaDoEstudio>) => {
          w.terminate();
          if (acabou) return;
          imagem.set(e.data.rgba, faixa.de * vista.largura * 4);
          faltam--;
          if (faltam === 0) {
            acabou = true;
            resolver(imagem);
          }
        };
        w.onerror = falhou;
        const pedido: PedidoDoEstudio = { vista, lotes, qualidade, fundo, faixa };
        w.postMessage(pedido);
      }
    } catch {
      falhou();
    }
  });
  return {
    pronta,
    cancelar: () => {
      parar();
      responder(null);
    },
  };
}

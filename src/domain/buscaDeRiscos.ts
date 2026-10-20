import type { PedidoDeRisco } from './planejamento';
import { fazerRisco, type RiscoGerado } from './risco';

/**
 * A busca dos riscos de um planejamento: faz os riscos pedidos um por um, até o tempo da busca acabar (os que não
 * deu tempo de fazer ficam ditos), com uma pausa entre um e outro — é nela que o pedido de cancelar chega.
 */

export interface OpcoesDaBusca {
  readonly larguraMm: number;
  readonly comprimentoMaximoMm: number;
  readonly distanciaMm: number;
  readonly sentidoUnico: boolean;
  readonly tempoTotalMs: number;
}

export interface ResultadoDaBusca {
  readonly feitos: ReadonlyArray<{ readonly chave: string; readonly risco: RiscoGerado }>;
  readonly naoSairam: ReadonlyArray<{ readonly chave: string; readonly motivo: string }>;
  /** As chaves dos riscos que não foram tentados (o tempo acabou, ou a busca foi cancelada). */
  readonly semTempo: readonly string[];
  readonly tempoMs: number;
  readonly cancelada: boolean;
}

export async function executarBusca(
  pedidos: readonly PedidoDeRisco[],
  opcoes: OpcoesDaBusca,
  meios: {
    readonly aoProgredir?: (feitos: number, total: number) => void;
    readonly deveParar?: () => boolean;
    readonly pausar?: () => Promise<void>;
    readonly agora?: () => number;
  } = {},
): Promise<ResultadoDaBusca> {
  const agora = meios.agora ?? Date.now;
  const inicio = agora();
  const feitos: { chave: string; risco: RiscoGerado }[] = [];
  const naoSairam: { chave: string; motivo: string }[] = [];
  const semTempo: string[] = [];
  let cancelada = false;
  // Cada risco tenta outras ordens de peças só enquanto houver tempo para todos.
  const tempoPorRiscoMs = Math.max(200, opcoes.tempoTotalMs / Math.max(1, pedidos.length) / 2);
  for (const [i, pedido] of pedidos.entries()) {
    if (meios.deveParar?.()) cancelada = true;
    if (cancelada || agora() - inicio > opcoes.tempoTotalMs) {
      semTempo.push(pedido.chave);
      continue;
    }
    const risco = fazerRisco(pedido.pecas, pedido.grade, {
      larguraMm: opcoes.larguraMm,
      comprimentoMaximoMm: opcoes.comprimentoMaximoMm,
      distanciaMm: opcoes.distanciaMm,
      sentidoUnico: opcoes.sentidoUnico,
      tempoLimiteMs: tempoPorRiscoMs,
      agora,
    });
    if (risco.ok) feitos.push({ chave: pedido.chave, risco });
    else naoSairam.push({ chave: pedido.chave, motivo: risco.motivo });
    meios.aoProgredir?.(i + 1, pedidos.length);
    if (meios.pausar) await meios.pausar();
  }
  return { feitos, naoSairam, semTempo, tempoMs: agora() - inicio, cancelada };
}

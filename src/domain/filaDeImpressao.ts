/**
 * O gerenciador de impressão (ADR 0210): os riscos esperando o plotter, um de cada vez. Se um falha, a fila pausa: o
 * plotter desligado ou sem papel faria os seguintes falharem também.
 */

export type EstadoDaImpressao = 'na-fila' | 'enviando' | 'enviado' | 'erro' | 'cancelado';

export interface TrabalhoDeImpressao {
  readonly id: string;
  readonly nome: string;
  readonly destino: string;
  readonly texto: string;
  readonly estado: EstadoDaImpressao;
  readonly erro?: string;
}

export interface FilaDeImpressao {
  readonly pausada: boolean;
  readonly trabalhos: readonly TrabalhoDeImpressao[];
}

export const FILA_DE_IMPRESSAO_VAZIA: FilaDeImpressao = { pausada: false, trabalhos: [] };

export const comTrabalho = (fila: FilaDeImpressao, t: Pick<TrabalhoDeImpressao, 'id' | 'nome' | 'destino' | 'texto'>): FilaDeImpressao => ({ ...fila, trabalhos: [...fila.trabalhos, { ...t, estado: 'na-fila' }] });

export const proximoDaFila = (fila: FilaDeImpressao): TrabalhoDeImpressao | null => (fila.pausada ? null : (fila.trabalhos.find((t) => t.estado === 'na-fila') ?? null));

export function comEstado(fila: FilaDeImpressao, id: string, estado: EstadoDaImpressao, erro?: string): FilaDeImpressao {
  return {
    ...fila,
    trabalhos: fila.trabalhos.map((t) => {
      if (t.id !== id) return t;
      const { erro: _antigo, ...resto } = t;
      void _antigo;
      return { ...resto, estado, ...(erro !== undefined ? { erro } : {}) };
    }),
  };
}

/** Sobe ou desce na fila: só entre os que ainda esperam. */
export function moverNaFila(fila: FilaDeImpressao, id: string, passo: -1 | 1): FilaDeImpressao {
  const lista = [...fila.trabalhos];
  const i = lista.findIndex((t) => t.id === id);
  const a = lista[i];
  const b = lista[i + passo];
  if (a?.estado !== 'na-fila' || b?.estado !== 'na-fila') return fila;
  lista[i] = b;
  lista[i + passo] = a;
  return { ...fila, trabalhos: lista };
}

/** Só o que ainda não foi: o que está indo não volta. */
export const cancelarNaFila = (fila: FilaDeImpressao, id: string): FilaDeImpressao => (fila.trabalhos.find((t) => t.id === id)?.estado === 'na-fila' ? comEstado(fila, id, 'cancelado') : fila);

export const semConcluidos = (fila: FilaDeImpressao): FilaDeImpressao => ({ ...fila, trabalhos: fila.trabalhos.filter((t) => t.estado !== 'enviado' && t.estado !== 'cancelado') });

/** Manda um por vez, até a fila acabar ou pausar. A fila é lida de novo a cada passo: quem mexeu nela enquanto isso vale. */
export async function esvaziarFila(ler: () => FilaDeImpressao, mudar: (fila: FilaDeImpressao) => void, enviar: (trabalho: TrabalhoDeImpressao) => Promise<{ readonly ok: boolean; readonly erro?: string }>): Promise<void> {
  for (let t = proximoDaFila(ler()); t; t = proximoDaFila(ler())) {
    mudar(comEstado(ler(), t.id, 'enviando'));
    const r = await enviar(t).catch((e: unknown) => ({ ok: false, erro: e instanceof Error ? e.message : String(e) }));
    if (r.ok) mudar(comEstado(ler(), t.id, 'enviado'));
    else mudar({ ...comEstado(ler(), t.id, 'erro', r.erro ?? 'O plotter não recebeu o risco.'), pausada: true });
  }
}

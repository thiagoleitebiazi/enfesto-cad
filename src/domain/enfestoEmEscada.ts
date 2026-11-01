import type { BlocoDoGrupo } from './gruposDoEncaixe';

/**
 * O enfesto em escada (ADR 0224): o encaixe por blocos em que cada bloco leva um número de camadas. As camadas que todos
 * os blocos têm vão na mesa inteira; as que só alguns têm vão até o fim deles, em degraus. Por isso o bloco de mais
 * camadas fica no começo da mesa.
 */

export interface DegrauDaEscada {
  /** Do começo da mesa até onde este degrau vai. */
  readonly comprimentoMm: number;
  readonly camadas: number;
}

export function degrausDaEscada(blocos: readonly BlocoDoGrupo[], camadasPorBloco: Readonly<Record<string, number>>, camadasPadrao: number): DegrauDaEscada[] {
  const comCamadas = blocos.map((b) => ({ fimMm: b.fimMm, camadas: camadasPorBloco[b.grupo] ?? camadasPadrao }));
  const niveis = [...new Set(comCamadas.map((b) => b.camadas))].sort((a, b) => a - b);
  return niveis.map((nivel, i) => ({ comprimentoMm: Math.max(...comCamadas.filter((b) => b.camadas >= nivel).map((b) => b.fimMm)), camadas: nivel - (niveis[i - 1] ?? 0) }));
}

export const consumoDaEscadaMm = (degraus: readonly DegrauDaEscada[]): number => degraus.reduce((soma, d) => soma + d.comprimentoMm * d.camadas, 0);

/** O bloco escrito no campo pode dizer as camadas dele: "P M x40; G GG x20". */
export function camadasDosBlocos(texto: string): (number | null)[] {
  return texto
    .split(/[;\n]/)
    .filter((l) => l.trim() !== '')
    .map((l) => {
      const achado = /(?:^|\s)x\s*(\d+)\s*$/i.exec(l.trim());
      return achado ? Number(achado[1]) : null;
    });
}

/** Os blocos na ordem da escada, do que tem mais camadas para o que tem menos, e as camadas de cada um pelo nome. */
export function blocosEmEscada(blocos: readonly (readonly string[])[], camadas: readonly (number | null)[]): { readonly blocos: readonly (readonly string[])[]; readonly camadasPorBloco: Readonly<Record<string, number>> | null } {
  if (!camadas.some((c) => c !== null)) return { blocos, camadasPorBloco: null };
  const ordenados = blocos.map((tamanhos, i) => ({ tamanhos, camadas: camadas[i] ?? 0 })).sort((a, b) => b.camadas - a.camadas);
  const camadasPorBloco: Record<string, number> = {};
  ordenados.forEach((b, i) => {
    if (b.camadas > 0) camadasPorBloco[`Bloco ${i + 1}`] = b.camadas;
  });
  return { blocos: ordenados.map((b) => b.tamanhos), camadasPorBloco };
}

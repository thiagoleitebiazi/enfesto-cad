import type { Contorno } from '../core/geometria';
import { retanguloEnvolvente } from '../core/geometria';
import { linhaDeCorteDaPeca, type Molde } from './molde';

/**
 * Os grupos do encaixe (ADR 0103): as peças do mesmo grupo (por exemplo, as que vão para a entretela) saem juntas,
 * num trecho só do comprimento — um bloco que pode ser cortado e levado à parte. Os grupos entram na ordem em que
 * aparecem na lista de peças, um depois do outro; as peças sem grupo vêm por último, depois do último bloco.
 */

/** O grupo do encaixe da peça (`''`: sem grupo). Os espaços das pontas não contam. */
export const grupoDaPeca = (molde: Pick<Molde, 'grupoDoEncaixe'>): string => molde.grupoDoEncaixe?.trim() ?? '';

/** Os grupos, na ordem em que aparecem nas peças. */
export function ordemDosGrupos(pecas: ReadonlyArray<Pick<Molde, 'grupoDoEncaixe'>>): string[] {
  const grupos: string[] = [];
  for (const p of pecas) {
    const g = grupoDaPeca(p);
    if (g !== '' && !grupos.includes(g)) grupos.push(g);
  }
  return grupos;
}

/** A vez do grupo no encaixe: os grupos na ordem; as peças sem grupo por último. */
export function indiceDoGrupo(ordem: readonly string[], grupo: string): number {
  const i = ordem.indexOf(grupo);
  return grupo === '' || i < 0 ? ordem.length : i;
}

/** A peça com o grupo do encaixe (só espaços: sem grupo). */
export function comGrupoDoEncaixe(molde: Molde, grupo: string): Molde {
  if (grupo.trim() === '') {
    if (molde.grupoDoEncaixe === undefined) return molde;
    const copia: Partial<Record<keyof Molde, unknown>> = { ...molde };
    delete copia.grupoDoEncaixe;
    return copia as Molde;
  }
  return { ...molde, grupoDoEncaixe: grupo };
}

export interface BlocoDoGrupo {
  /** `''`: as peças sem grupo. */
  readonly grupo: string;
  /** De onde a onde o bloco vai no comprimento (mm, pelas linhas de corte). */
  readonly inicioMm: number;
  readonly fimMm: number;
  readonly pecas: number;
}

/** Os blocos de peças já postas: um por grupo (e um das sem grupo), na ordem dos grupos. Sem nenhum grupo, nenhum. */
export function blocosDasPostas(postas: ReadonlyArray<{ readonly grupo: string; readonly corte: Contorno }>, ordem: readonly string[]): BlocoDoGrupo[] {
  if (!postas.some((p) => p.grupo !== '')) return [];
  const porGrupo = new Map<string, { inicioMm: number; fimMm: number; pecas: number }>();
  for (const p of postas) {
    const caixa = retanguloEnvolvente(p.corte);
    const atual = porGrupo.get(p.grupo);
    porGrupo.set(
      p.grupo,
      atual
        ? { inicioMm: Math.min(atual.inicioMm, caixa.minY), fimMm: Math.max(atual.fimMm, caixa.maxY), pecas: atual.pecas + 1 }
        : { inicioMm: caixa.minY, fimMm: caixa.maxY, pecas: 1 },
    );
  }
  return [...porGrupo.entries()]
    .map(([grupo, b]) => ({ grupo, ...b }))
    .sort((a, b) => indiceDoGrupo(ordem, a.grupo) - indiceDoGrupo(ordem, b.grupo));
}

/** Os blocos das peças como estão na mesa. */
export function blocosNaMesa(pecas: readonly Molde[]): BlocoDoGrupo[] {
  return blocosDasPostas(
    pecas.map((p) => ({ grupo: grupoDaPeca(p), corte: linhaDeCorteDaPeca(p) })),
    ordemDosGrupos(pecas),
  );
}

/** Os pares de blocos que se misturam no comprimento (peças de grupos diferentes no mesmo trecho). */
export function blocosQueSeMisturam(blocos: readonly BlocoDoGrupo[]): Array<readonly [BlocoDoGrupo, BlocoDoGrupo]> {
  const pares: Array<readonly [BlocoDoGrupo, BlocoDoGrupo]> = [];
  for (let i = 0; i < blocos.length; i++) {
    for (let j = i + 1; j < blocos.length; j++) {
      const a = blocos[i]!;
      const b = blocos[j]!;
      if (a.inicioMm < b.fimMm - 1e-6 && b.inicioMm < a.fimMm - 1e-6) pares.push([a, b]);
    }
  }
  return pares;
}

/**
 * As divisas entre os trechos dos grupos (mm no comprimento): no meio entre o fim de um bloco e o começo do seguinte,
 * só quando eles não se misturam (misturados, a validação avisa). Servem à tela, ao PDF e ao DXF.
 */
export function divisasEntreOsBlocos(blocos: readonly BlocoDoGrupo[]): number[] {
  const divisas: number[] = [];
  blocos.forEach((bloco, i) => {
    const seguinte = blocos[i + 1];
    if (seguinte && seguinte.inicioMm >= bloco.fimMm) divisas.push((bloco.fimMm + seguinte.inicioMm) / 2);
  });
  return divisas;
}

/** O nome do bloco para a tela. */
export const nomeDoBloco = (bloco: Pick<BlocoDoGrupo, 'grupo'>): string => (bloco.grupo === '' ? 'Sem grupo' : bloco.grupo);

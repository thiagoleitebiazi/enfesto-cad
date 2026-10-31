import type { Molde } from './molde';
import type { ConfiguracaoDaInstancia, Costura3D, Montagem3D } from './montagem3d';

/**
 * O look vestido no manequim (ADR 0155): as peças de dois a quatro modelos, cada um com a montagem do próprio projeto,
 * juntas numa montagem só para o provador. Cada modelo ganha um prefixo nos ids (dois projetos podem ter ids iguais) e
 * o manequim e o tecido são os do primeiro: a simulação tem um tecido só.
 */

export interface ModeloDoLook {
  readonly nome: string;
  readonly pecas: readonly Molde[];
  readonly montagem: Montagem3D;
}

const noCorpo = (m: Montagem3D): boolean => Object.values(m.pecas).some((c) => c.posicao !== 'fora');

/** Lança o motivo, se há menos de dois modelos ou um deles ainda não foi montado no provador. */
export function montagemDoLook(modelos: readonly ModeloDoLook[]): { readonly pecas: Molde[]; readonly montagem: Montagem3D } {
  if (modelos.length < 2) throw new Error('O look precisa de ao menos dois modelos com projeto.');
  const semMontagem = modelos.filter((m) => !noCorpo(m.montagem)).map((m) => m.nome);
  if (semMontagem.length > 0) throw new Error(`Monte antes no provador 3D (peças no corpo e costuras): ${semMontagem.join(', ')}.`);
  const pecas: Record<string, ConfiguracaoDaInstancia> = {};
  const costuras: Costura3D[] = [];
  modelos.forEach((m, i) => {
    const nova = (chave: string): string => `${i}~${chave}`;
    for (const [chave, c] of Object.entries(m.montagem.pecas)) pecas[nova(chave)] = c.sobre ? { ...c, sobre: { ...c.sobre, chave: nova(c.sobre.chave) } } : c;
    for (const c of m.montagem.costuras) costuras.push({ ...c, id: nova(c.id), a: { ...c.a, chave: nova(c.a.chave) }, b: { ...c.b, chave: nova(c.b.chave) } });
  });
  return { pecas: modelos.flatMap((m, i) => m.pecas.map((p) => ({ ...p, id: `${i}~${p.id}` }))), montagem: { ...modelos[0]!.montagem, pecas, costuras } };
}

import { retanguloEnvolvente } from '../core/geometria';
import { linhaDeCorteDaPeca, transladarMolde, type Molde } from './molde';

/**
 * Alinhar e distribuir as peças selecionadas no encaixe manual (ADR 0161), pela caixa da linha de corte. Só a posição
 * muda; se uma peça cair sobre outra, a validação avisa.
 */

export type ModoDeAlinhar = 'comeco' | 'fim' | 'meio-do-comprimento' | 'topo' | 'base' | 'meio-da-largura' | 'distribuir-comprimento' | 'distribuir-largura';

export const ROTULO_DE_ALINHAR: Readonly<Record<ModoDeAlinhar, string>> = {
  comeco: 'Pelo começo do comprimento',
  fim: 'Pelo fim do comprimento',
  'meio-do-comprimento': 'Pelo meio do comprimento',
  topo: 'Pelo alto da largura',
  base: 'Pela base da largura',
  'meio-da-largura': 'Pelo meio da largura',
  'distribuir-comprimento': 'Distribuir no comprimento (espaços iguais)',
  'distribuir-largura': 'Distribuir na largura (espaços iguais)',
};

export function alinharPecas(pecas: readonly Molde[], ids: ReadonlySet<string>, modo: ModoDeAlinhar): Molde[] {
  const caixas = new Map(pecas.filter((p) => ids.has(p.id)).map((p) => [p.id, retanguloEnvolvente(linhaDeCorteDaPeca(p))]));
  const lista = [...caixas.values()];
  if (lista.length < 2) return [...pecas];
  const minX = Math.min(...lista.map((c) => c.minX));
  const maxX = Math.max(...lista.map((c) => c.maxX));
  const minY = Math.min(...lista.map((c) => c.minY));
  const maxY = Math.max(...lista.map((c) => c.maxY));
  const deltas = new Map<string, { x: number; y: number }>();
  if (modo === 'distribuir-comprimento' || modo === 'distribuir-largura') {
    const noComprimento = modo === 'distribuir-comprimento';
    const inicio = (c: (typeof lista)[number]): number => (noComprimento ? c.minY : c.minX);
    const fim = (c: (typeof lista)[number]): number => (noComprimento ? c.maxY : c.maxX);
    const ordem = [...caixas].sort((a, b) => inicio(a[1]) - inicio(b[1]));
    const ocupado = lista.reduce((s, c) => s + fim(c) - inicio(c), 0);
    const espaco = ((noComprimento ? maxY - minY : maxX - minX) - ocupado) / (ordem.length - 1);
    let onde = noComprimento ? minY : minX;
    for (const [id, c] of ordem) {
      const d = onde - inicio(c);
      deltas.set(id, noComprimento ? { x: 0, y: d } : { x: d, y: 0 });
      onde += fim(c) - inicio(c) + espaco;
    }
  } else {
    for (const [id, c] of caixas) {
      const y = modo === 'comeco' ? minY - c.minY : modo === 'fim' ? maxY - c.maxY : modo === 'meio-do-comprimento' ? (minY + maxY) / 2 - (c.minY + c.maxY) / 2 : 0;
      const x = modo === 'topo' ? minX - c.minX : modo === 'base' ? maxX - c.maxX : modo === 'meio-da-largura' ? (minX + maxX) / 2 - (c.minX + c.maxX) / 2 : 0;
      deltas.set(id, { x, y });
    }
  }
  return pecas.map((p) => {
    const d = deltas.get(p.id);
    return d ? transladarMolde(p, d, p.id) : p;
  });
}

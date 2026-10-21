import type { Ponto2D } from '../core/geometria';
import type { Molde } from './molde';

/**
 * A seleção de peças do programa: uma peça "única" (a que as ferramentas de
 * forma editam) ou um lote marcado na lista. Quando há lote, é ele que vale
 * para as ações em conjunto — a mesma regra de Excluir e Duplicar.
 */
export interface SelecaoDePecas {
  readonly selecionadoId: string | null;
  readonly idsEmLote: ReadonlySet<string>;
}

/**
 * "Inverter seleção": passam a estar selecionadas as peças que não estavam.
 * Se sobrar uma só, ela vira a seleção única; se sobrarem várias, o lote; se
 * todas estavam selecionadas, não fica nenhuma.
 */
export function inverterSelecao(idsDasPecas: readonly string[], atual: SelecaoDePecas): SelecaoDePecas {
  const selecionadas =
    atual.idsEmLote.size > 0 ? atual.idsEmLote : new Set(atual.selecionadoId ? [atual.selecionadoId] : []);
  const restantes = idsDasPecas.filter((id) => !selecionadas.has(id));
  if (restantes.length === 1) return { selecionadoId: restantes[0]!, idsEmLote: new Set() };
  return { selecionadoId: null, idsEmLote: new Set(restantes) };
}

/** As peças selecionadas agora, numa lista só (o lote, ou a peça única). */
function selecionadas(atual: SelecaoDePecas): Set<string> {
  return new Set(atual.idsEmLote.size > 0 ? atual.idsEmLote : atual.selecionadoId ? [atual.selecionadoId] : []);
}

/** A seleção de um conjunto de peças: nenhuma, a peça única (uma), ou o lote (várias). */
export function selecaoDe(ids: Iterable<string>): SelecaoDePecas {
  const lista = [...new Set(ids)];
  if (lista.length === 0) return { selecionadoId: null, idsEmLote: new Set() };
  if (lista.length === 1) return { selecionadoId: lista[0]!, idsEmLote: new Set() };
  return { selecionadoId: null, idsEmLote: new Set(lista) };
}

/** Ctrl+clique numa peça: ela entra na seleção (junto com as que já estavam), ou sai dela, se já estava. */
export function alternarNaSelecao(atual: SelecaoDePecas, id: string): SelecaoDePecas {
  const ids = selecionadas(atual);
  if (ids.has(id)) ids.delete(id);
  else ids.add(id);
  return selecaoDe(ids);
}

/** O retângulo de seleção: as peças dele passam a ser a seleção; com o Ctrl (`somar`), juntam-se às que já estavam. */
export function selecionarPeloRetangulo(atual: SelecaoDePecas, ids: readonly string[], somar: boolean): SelecaoDePecas {
  return selecaoDe(somar ? [...selecionadas(atual), ...ids] : ids);
}

/** As peças inteiras dentro do retângulo entre `a` e `b` (mm do mundo), pelo contorno. */
export function pecasDentroDoRetangulo(pecas: readonly Molde[], a: Ponto2D, b: Ponto2D): string[] {
  const minX = Math.min(a.x, b.x);
  const maxX = Math.max(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxY = Math.max(a.y, b.y);
  return pecas
    .filter((p) => p.contorno.length > 0 && p.contorno.every((q) => q.x >= minX && q.x <= maxX && q.y >= minY && q.y <= maxY))
    .map((p) => p.id);
}

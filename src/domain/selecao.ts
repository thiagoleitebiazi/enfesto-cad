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

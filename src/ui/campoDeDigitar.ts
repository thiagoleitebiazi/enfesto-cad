/** Tipos de `<input>` que não recebem texto: neles, os atalhos do programa continuam valendo. */
const SEM_TEXTO = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image']);

/**
 * O elemento recebe o que se digita? Num campo de texto, Delete apaga a letra e Ctrl+Z desfaz a digitação:
 * os atalhos do programa ficam de fora. Numa caixa de marcar (a do lote, na lista de peças) não — antes, depois
 * de marcar as peças, Delete, Ctrl+C e Ctrl+Z não faziam nada até se clicar no desenho.
 */
export function ehCampoDeDigitar(alvo: EventTarget | null): boolean {
  if (alvo instanceof HTMLTextAreaElement || alvo instanceof HTMLSelectElement) return true;
  if (alvo instanceof HTMLInputElement) return !SEM_TEXTO.has(alvo.type);
  return alvo instanceof HTMLElement && alvo.isContentEditable === true;
}

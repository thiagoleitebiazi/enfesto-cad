/** Escreve no campo com o foco como quem digita: o React recebe o evento de sempre. */
export function digitarNoCampo(campo: Element | null, tecla: string): boolean {
  if (!(campo instanceof HTMLInputElement || campo instanceof HTMLTextAreaElement)) return false;
  const apagar = tecla === 'apagar';
  const valor = campo.value;
  const de = campo.selectionStart ?? valor.length;
  const ate = campo.selectionEnd ?? valor.length;
  const comeco = apagar && de === ate ? Math.max(0, de - 1) : de;
  const novo = valor.slice(0, comeco) + (apagar ? '' : tecla) + valor.slice(ate);
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(campo) as object, 'value')?.set?.call(campo, novo);
  campo.dispatchEvent(new Event('input', { bubbles: true }));
  const posicao = comeco + (apagar ? 0 : tecla.length);
  if (campo.selectionStart !== null) campo.setSelectionRange(posicao, posicao);
  return true;
}

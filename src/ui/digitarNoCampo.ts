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

/** Enter: como a tecla de verdade, avisa o campo e envia o formulário dele; no texto longo, quebra a linha. */
export function confirmarCampo(campo: Element | null): void {
  if (campo instanceof HTMLTextAreaElement) {
    digitarNoCampo(campo, '\n');
    return;
  }
  if (!(campo instanceof HTMLInputElement)) return;
  campo.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
  campo.form?.requestSubmit();
}

/** Tab: o campo seguinte da janela aberta, ou da tela, sem contar o próprio teclado. */
export function irAoProximoCampo(atual: Element | null): void {
  const raiz = atual?.closest('[role=dialog]') ?? document.body;
  const campos = Array.from(raiz.querySelectorAll<HTMLElement>('input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])')).filter((c) => !c.closest('.teclado-virtual'));
  const i = atual instanceof HTMLElement ? campos.indexOf(atual) : -1;
  campos[(i + 1) % campos.length]?.focus();
}

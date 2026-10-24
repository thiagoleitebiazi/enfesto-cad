/** Número digitado com vírgula ou ponto decimal; campo vazio vale 0. `null` se não for um número. */
export function lerMedida(texto: string): number | null {
  const valor = Number(texto.trim().replace(',', '.'));
  return Number.isFinite(valor) ? valor : null;
}

/** Medida em mm para os diálogos, com vírgula decimal: "12,5 mm". */
export function formatarMm(valor: number, casas = 1): string {
  return `${valor.toFixed(casas).replace('.', ',')} mm`;
}

/** O número do texto (vírgula ou ponto); `null` vazio; `NaN` se não for número. */
export function numeroDoTexto(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, '').replace(',', '.');
  if (limpo === '') return null;
  const v = Number(limpo);
  return Number.isFinite(v) ? v : Number.NaN;
}

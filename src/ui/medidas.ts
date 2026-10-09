/** Número digitado com vírgula ou ponto decimal; campo vazio vale 0. `null` se não for um número. */
export function lerMedida(texto: string): number | null {
  const valor = Number(texto.trim().replace(',', '.'));
  return Number.isFinite(valor) ? valor : null;
}

/** Medida em mm para os diálogos, com vírgula decimal: "12,5 mm". */
export function formatarMm(valor: number, casas = 1): string {
  return `${valor.toFixed(casas).replace('.', ',')} mm`;
}

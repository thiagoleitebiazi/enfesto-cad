/**
 * Os números como o programa os mostra, em português: a vírgula como separador decimal ("12,5 mm", "19,5%"), sem
 * ponto de milhar — como nos diálogos e no planejamento. Só a escrita muda: o número guardado e as contas são os
 * mesmos. Os campos de digitação aceitam a vírgula e o ponto (ver `lerMedida`).
 */

/**
 * O número com vírgula decimal. Com `casas`, o número de casas é fixo (como `toFixed`); sem, ficam as casas que o
 * número tem ("1500", "180,5").
 */
export function numeroComVirgula(valor: number, casas?: number): string {
  const texto = casas === undefined ? String(valor) : valor.toFixed(casas);
  return texto.replace('.', ',');
}

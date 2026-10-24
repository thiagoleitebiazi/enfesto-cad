/**
 * Os relatórios em CSV: separados por ponto e vírgula, com vírgula decimal (o padrão das planilhas em português). A
 * célula com ponto e vírgula, aspas ou quebra de linha vai entre aspas.
 */

const celula = (v: string): string => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export const linhaCsv = (valores: readonly string[]): string => valores.map(celula).join(';');

/** O arquivo inteiro: o cabeçalho e as linhas, com a quebra de linha do Windows. */
export const textoCsv = (linhas: ReadonlyArray<readonly string[]>): string => linhas.map(linhaCsv).join('\r\n') + '\r\n';

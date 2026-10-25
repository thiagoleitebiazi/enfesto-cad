/**
 * Os relatórios em CSV: separados por ponto e vírgula, com vírgula decimal (o padrão das planilhas em português). A
 * célula com ponto e vírgula, aspas ou quebra de linha vai entre aspas.
 */

const celula = (v: string): string => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export const linhaCsv = (valores: readonly string[]): string => valores.map(celula).join(';');

/** O arquivo inteiro: o cabeçalho e as linhas, com a quebra de linha do Windows. */
export const textoCsv = (linhas: ReadonlyArray<readonly string[]>): string => linhas.map(linhaCsv).join('\r\n') + '\r\n';

/**
 * Lê um CSV (ou o que vem colado de uma planilha): as células de cada linha. O separador sai da primeira linha — a
 * tabulação (o colado do Excel), o ponto e vírgula (o CSV em português) ou a vírgula —; as aspas protegem o separador e
 * as quebras de linha, e "" dentro delas é uma aspa. As linhas vazias ficam de fora.
 */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^\uFEFF/, '');
  const primeira = t.split(/\r?\n/, 1)[0] ?? '';
  const separador = primeira.includes('\t') ? '\t' : primeira.includes(';') ? ';' : ',';
  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = '';
  let entreAspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i]!;
    if (entreAspas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          celula += '"';
          i++;
        } else entreAspas = false;
      } else celula += c;
      continue;
    }
    if (c === '"' && celula === '') entreAspas = true;
    else if (c === separador) {
      linha.push(celula);
      celula = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++;
      linha.push(celula);
      if (linha.some((x) => x.trim() !== '')) linhas.push(linha);
      linha = [];
      celula = '';
    } else celula += c;
  }
  linha.push(celula);
  if (linha.some((x) => x.trim() !== '')) linhas.push(linha);
  return linhas;
}

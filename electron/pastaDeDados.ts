import path from 'node:path';

/** A pasta de dados de sempre, de antes da troca do nome para Enfesto (ADR 0238): %APPDATA%\enfesto-cad. */
export const PASTA_DE_DADOS = 'enfesto-cad';

/**
 * Para onde a pasta de dados vai: a de sempre, se a de agora é a que o Electron dá pelo nome do programa; senão, fica como está
 * (a escolhida por quem abre, com --user-data-dir, ou pelos testes). `null`: não muda.
 */
export function pastaDeDadosDeSempre(atual: string, nomeDoPrograma: string, pastaDosProgramas: string): string | null {
  if (path.basename(atual) !== nomeDoPrograma || nomeDoPrograma === PASTA_DE_DADOS) return null;
  return path.join(pastaDosProgramas, PASTA_DE_DADOS);
}

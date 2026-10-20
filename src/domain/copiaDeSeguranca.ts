/**
 * A cópia de segurança de um arquivo de projeto antes de ele ser gravado por cima. Ela é feita quando o arquivo no
 * disco é de uma versão mais antiga do formato (a primeira gravação no formato novo o trocaria) ou quando ele não
 * pode ser lido (gravar por cima apagaria o que houver nele). As cópias ficam na pasta `copias-de-seguranca`, ao
 * lado dos projetos, e nunca são apagadas pelo programa.
 */

export const PASTA_DAS_COPIAS = 'copias-de-seguranca';

/** O motivo da cópia (`v1`, `v2`… a versão do arquivo que ia ser trocada; ou `ilegivel`), ou `null` se ela não é preciso. */
export function motivoDaCopiaDeSeguranca(conteudoNoDisco: string | null, versaoQueVaiSerGravada: number): string | null {
  if (conteudoNoDisco === null) return null;
  let lido: unknown;
  try {
    lido = JSON.parse(conteudoNoDisco);
  } catch {
    return 'ilegivel';
  }
  if (typeof lido !== 'object' || lido === null || Array.isArray(lido)) return 'ilegivel';
  const bruta = (lido as Record<string, unknown>).versaoDoFormato;
  const versao = typeof bruta === 'number' && Number.isInteger(bruta) && bruta >= 1 ? bruta : 1;
  return versao < versaoQueVaiSerGravada ? `v${versao}` : null;
}

/** O nome do arquivo da cópia: o id do projeto, o motivo e a hora (sem ":" — não vale em nome de arquivo no Windows). */
export function nomeDaCopiaDeSeguranca(idDoProjeto: string, motivo: string, agoraIso: string): string {
  return `${idDoProjeto}.${motivo}.${agoraIso.replace(/[:.]/g, '-')}.json`;
}

/**
 * Se já há uma cópia do mesmo projeto pelo mesmo motivo de versão, outra não é preciso (a versão antiga já está
 * guardada). O arquivo ilegível é copiado toda vez: cada um pode ser diferente.
 */
export function copiaJaFeita(idDoProjeto: string, motivo: string, arquivosNaPasta: readonly string[]): boolean {
  if (motivo === 'ilegivel') return false;
  return arquivosNaPasta.some((nome) => nome.startsWith(`${idDoProjeto}.${motivo}.`));
}

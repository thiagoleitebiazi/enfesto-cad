/** Como terminou o último salvamento do projeto: a hora, ou o motivo da falha. */
export type EstadoDoSalvamento =
  | { readonly ok: true; readonly hora: string }
  | { readonly ok: false; readonly erro: string; readonly dispensado: boolean };

/** A mensagem de um salvamento que falhou, sem o prefixo técnico do Electron ("Error invoking remote method…"). */
export function motivoDoErroDeSalvar(e: unknown): string {
  const bruto = e instanceof Error ? e.message : String(e);
  const semPrefixo = bruto.replace(/^Error invoking remote method '[^']*': /, '').replace(/^Error: /, '');
  return semPrefixo.endsWith('.') ? semPrefixo : `${semPrefixo}.`;
}

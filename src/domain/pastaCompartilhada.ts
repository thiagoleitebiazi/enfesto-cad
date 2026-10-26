/**
 * Uma pasta compartilhada vista pela interface (ADR 0141, 0142): os arquivos trocados só pelo nome, dentro de uma das
 * subpastas do tipo. No programa, é a pasta escolhida no processo principal; nos testes, uma de mentira.
 */
export interface PastaDeArquivos {
  readonly listar: (subpasta: string) => Promise<ReadonlyArray<{ readonly nome: string }> | null>;
  readonly ler: (subpasta: string, nome: string) => Promise<string | null>;
  readonly gravar: (subpasta: string, nome: string, texto: string) => Promise<boolean>;
  /** Não substitui: `false` se o destino existe ou se o arquivo já não está lá. */
  readonly mover: (de: string, nome: string, para: string, novoNome: string) => Promise<boolean>;
  /** `false` se o arquivo já existe: a trava de quem chegou primeiro. */
  readonly criarSeNaoExiste: (subpasta: string, nome: string, texto: string) => Promise<boolean>;
  readonly apagar: (subpasta: string, nome: string) => Promise<boolean>;
}

/** Além dos arquivos: saber onde a pasta está, escolher outra e deixar de usá-la. */
export interface AcessoAPasta extends PastaDeArquivos {
  readonly onde: () => Promise<string | null>;
  readonly escolher: () => Promise<string | null>;
  readonly esquecer: () => Promise<boolean>;
}

/**
 * O nome da pessoa ou da estação nas pastas da rede (ADR 0142, 0143): vai na trava da biblioteca e no pedido da fila.
 * Não é conta nem senha — o programa não tem login —; fica lembrado neste computador.
 */

const CHAVE_DO_NOME = 'enfesto-cad:nome-na-rede';

export function lerNomeNaRede(): string {
  try {
    return window.localStorage.getItem(CHAVE_DO_NOME) ?? '';
  } catch {
    return '';
  }
}

export function guardarNomeNaRede(nome: string): void {
  try {
    window.localStorage.setItem(CHAVE_DO_NOME, nome);
  } catch {
    // Sem o armazenamento do navegador, o nome vale até fechar o programa.
  }
}

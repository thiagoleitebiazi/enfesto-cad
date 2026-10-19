/**
 * O cadastro de malhas do planejamento de corte: as malhas que a fábrica usa, com a gramatura, o rendimento, a
 * largura útil e as restrições, para não digitar tudo a cada plano. Fica no armazenamento local deste computador
 * (como os cadastros de piques e de curvas) e vale para todos os projetos abertos nele. O peso disponível não
 * entra: ele é do estoque de cada ordem, informado no plano.
 */
export interface MalhaCadastrada {
  readonly id: string;
  readonly descricao: string;
  readonly gramaturaGm2?: number;
  /** mm/g, que é o mesmo número que m/kg. */
  readonly rendimentoMmPorG?: number;
  readonly larguraUtilMm: number;
  readonly tubular: boolean;
  readonly sentidoUnico: boolean;
  readonly encolhimentoPercentual?: number;
}

const CHAVE = 'enfesto-cad:malhas';
export const MAXIMO_DE_MALHAS = 100;
export const TAMANHO_MAXIMO_DA_DESCRICAO = 80;

const positivoOuAusente = (v: unknown): boolean => v === undefined || (typeof v === 'number' && Number.isFinite(v) && v > 0);

function ehMalha(valor: unknown): valor is MalhaCadastrada {
  if (typeof valor !== 'object' || valor === null) return false;
  const m = valor as Record<string, unknown>;
  return (
    typeof m.id === 'string' &&
    typeof m.descricao === 'string' &&
    m.descricao.trim() !== '' &&
    typeof m.larguraUtilMm === 'number' &&
    Number.isFinite(m.larguraUtilMm) &&
    m.larguraUtilMm > 0 &&
    typeof m.tubular === 'boolean' &&
    typeof m.sentidoUnico === 'boolean' &&
    positivoOuAusente(m.gramaturaGm2) &&
    positivoOuAusente(m.rendimentoMmPorG) &&
    (m.encolhimentoPercentual === undefined || (typeof m.encolhimentoPercentual === 'number' && m.encolhimentoPercentual >= 0 && m.encolhimentoPercentual < 50))
  );
}

/** As malhas guardadas neste computador; o que não dá para ler fica de fora (nunca impede o programa de abrir). */
export function lerMalhas(armazenamento: Pick<Storage, 'getItem'>): MalhaCadastrada[] {
  try {
    const lido: unknown = JSON.parse(armazenamento.getItem(CHAVE) ?? '[]');
    return Array.isArray(lido) ? lido.filter(ehMalha) : [];
  } catch {
    return [];
  }
}

/** Guarda a lista. Devolve `false` se não deu para gravar. */
export function gravarMalhas(armazenamento: Pick<Storage, 'setItem'>, lista: readonly MalhaCadastrada[]): boolean {
  try {
    armazenamento.setItem(CHAVE, JSON.stringify(lista));
    return true;
  } catch {
    return false;
  }
}

/** A lista com a malha nova no fim. Não troca uma malha que já existe: a mesma descrição é recusada. */
export function cadastrarMalha(lista: readonly MalhaCadastrada[], malha: MalhaCadastrada): MalhaCadastrada[] {
  const descricao = malha.descricao.trim();
  if (descricao === '') throw new Error('Dê uma descrição à malha (por exemplo, “Malha algodão 30/1”).');
  if (descricao.length > TAMANHO_MAXIMO_DA_DESCRICAO) throw new Error(`A descrição pode ter até ${TAMANHO_MAXIMO_DA_DESCRICAO} caracteres.`);
  if (lista.some((m) => m.descricao.trim().toLocaleLowerCase('pt-BR') === descricao.toLocaleLowerCase('pt-BR'))) {
    throw new Error(`Já há uma malha “${descricao}” no cadastro: use outra descrição.`);
  }
  if (lista.length >= MAXIMO_DE_MALHAS) throw new Error(`O cadastro tem até ${MAXIMO_DE_MALHAS} malhas: tire alguma antes.`);
  const nova = { ...malha, descricao };
  if (!ehMalha(nova)) throw new Error('A malha precisa da largura útil e de valores maiores que zero.');
  return [...lista, nova];
}

export function removerMalha(lista: readonly MalhaCadastrada[], id: string): MalhaCadastrada[] {
  return lista.filter((m) => m.id !== id);
}

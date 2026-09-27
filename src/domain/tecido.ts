/**
 * Cadastro de tecido (seção 3 do escopo). Cada projeto de enfesto deve estar
 * associado a exatamente um tecido — a associação em si vive em
 * `domain/enfesto.ts`/`App.tsx`, este módulo só descreve a entidade.
 */
export type PadraoDoTecido = 'liso' | 'listrado' | 'xadrez';

export interface Tecido {
  readonly id: string;
  readonly nome: string;
  readonly referencia: string;
  readonly composicao?: string;
  readonly larguraTotalMm: number;
  readonly larguraUtilMm: number;
  /** Estampa/textura com sentido único (não pode ser virada 180° sem inverter o desenho). */
  readonly direcional: boolean;
  readonly temPelo: boolean;
  readonly padrao: PadraoDoTecido;
  readonly observacoes?: string;
}

export interface DadosDeNovoTecido {
  readonly nome: string;
  readonly referencia: string;
  readonly composicao?: string;
  readonly larguraTotalMm: number;
  readonly larguraUtilMm: number;
  readonly direcional?: boolean;
  readonly temPelo?: boolean;
  readonly padrao?: PadraoDoTecido;
  readonly observacoes?: string;
}

export function criarTecido(dados: DadosDeNovoTecido, id: string): Tecido {
  if (!Number.isFinite(dados.larguraTotalMm) || dados.larguraTotalMm <= 0) {
    throw new Error(`Tecido "${dados.nome}" precisa de largura total > 0.`);
  }
  if (!Number.isFinite(dados.larguraUtilMm) || dados.larguraUtilMm <= 0) {
    throw new Error(`Tecido "${dados.nome}" precisa de largura útil > 0.`);
  }
  if (dados.larguraUtilMm > dados.larguraTotalMm) {
    throw new Error(`Tecido "${dados.nome}": largura útil não pode ser maior que a largura total.`);
  }
  return {
    id,
    nome: dados.nome,
    referencia: dados.referencia,
    ...(dados.composicao !== undefined ? { composicao: dados.composicao } : {}),
    larguraTotalMm: dados.larguraTotalMm,
    larguraUtilMm: dados.larguraUtilMm,
    direcional: dados.direcional ?? false,
    temPelo: dados.temPelo ?? false,
    padrao: dados.padrao ?? 'liso',
    ...(dados.observacoes !== undefined ? { observacoes: dados.observacoes } : {}),
  };
}

/** Verdadeiro se o tecido impõe alguma restrição de orientação (seção 5: direcional, listrado, xadrez ou com pelo). */
export function tecidoExigeRespeitoDeOrientacao(tecido: Tecido): boolean {
  return tecido.direcional || tecido.temPelo || tecido.padrao !== 'liso';
}

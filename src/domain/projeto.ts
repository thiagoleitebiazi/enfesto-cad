import type { Molde } from './molde';
import type { Tecido } from './tecido';
import type { ConfiguracaoDeEnfesto } from './enfesto';

/**
 * Biblioteca permanente de trabalhos + histórico/versões (seções 9, 10 e 11
 * do escopo). Um Projeto é a unidade persistida: identificador único, nome,
 * código, datas, status, e todo o estado necessário para reabrir o trabalho
 * completo (moldes, tecido, enfesto). O histórico guarda um snapshot
 * completo a cada evento significativo — simples e correto, mesmo que não
 * seja o mais compacto possível (ver ADR 0006).
 */

export type StatusDoProjeto = 'em-edicao' | 'calculando' | 'concluido' | 'pronto-para-producao' | 'arquivado';

export const ROTULO_DO_STATUS: Record<StatusDoProjeto, string> = {
  'em-edicao': 'Em edição',
  calculando: 'Calculando',
  concluido: 'Concluído',
  'pronto-para-producao': 'Pronto para produção',
  arquivado: 'Arquivado',
};

export type TipoDeEvento =
  | 'criacao'
  | 'salvamento'
  | 'mudanca-de-configuracao'
  | 'mudanca-de-moldes'
  | 'execucao-de-nesting'
  | 'exportacao-de-pdf'
  | 'envio-para-producao'
  | 'restauracao-de-versao';

export const ROTULO_DO_EVENTO: Record<TipoDeEvento, string> = {
  criacao: 'Criação do projeto',
  salvamento: 'Salvamento',
  'mudanca-de-configuracao': 'Mudança de tecido/enfesto',
  'mudanca-de-moldes': 'Mudança nos moldes',
  'execucao-de-nesting': 'Execução do nesting automático',
  'exportacao-de-pdf': 'Exportação de PDF',
  'envio-para-producao': 'Envio para produção',
  'restauracao-de-versao': 'Restauração de versão anterior',
};

/** Estado completo do trabalho num dado momento — o que entra/sai ao salvar ou restaurar uma versão. */
export interface EstadoDoProjeto {
  readonly pecas: readonly Molde[];
  readonly tecido: Tecido | null;
  readonly enfesto: ConfiguracaoDeEnfesto | null;
}

export interface EventoDeHistorico {
  readonly id: string;
  readonly tipo: TipoDeEvento;
  readonly dataHoraIso: string;
  readonly descricao?: string;
  readonly estado: EstadoDoProjeto;
}

export interface Projeto {
  readonly id: string;
  readonly nome: string;
  readonly codigo: string;
  readonly criadoEmIso: string;
  readonly modificadoEmIso: string;
  readonly status: StatusDoProjeto;
  readonly estadoAtual: EstadoDoProjeto;
  readonly historico: readonly EventoDeHistorico[];
  /** Id do projeto original de que este é uma variante. Ausente no original e em projetos sem variantes. */
  readonly varianteDe?: string;
  /** Quem fez o modelo (aba Modelo > Autor). Ausente enquanto não for informado. */
  readonly autor?: string;
}

export const TAMANHO_MAXIMO_DO_AUTOR = 80;

/** "Autor": guarda no projeto o nome de quem fez o modelo; vazio, tira o autor. */
export function definirAutor(projeto: Projeto, autor: string, agoraIso: string): Projeto {
  const limpo = autor.trim();
  if (limpo.length > TAMANHO_MAXIMO_DO_AUTOR) throw new Error(`O nome do autor pode ter até ${TAMANHO_MAXIMO_DO_AUTOR} caracteres.`);
  if (limpo !== '') return { ...projeto, autor: limpo, modificadoEmIso: agoraIso };
  const copia: { -readonly [K in keyof Projeto]: Projeto[K] } = { ...projeto, modificadoEmIso: agoraIso };
  delete copia.autor;
  return copia;
}

export function gerarCodigoDeProjeto(dataIso: string, sequencial: number): string {
  const data = new Date(dataIso);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `ENF-${ano}${mes}${dia}-${String(sequencial).padStart(3, '0')}`;
}

export function criarProjeto(
  nome: string,
  id: string,
  codigo: string,
  agoraIso: string,
  estadoInicial: EstadoDoProjeto,
): Projeto {
  const eventoDeCriacao: EventoDeHistorico = {
    id: `${id}-hist-0`,
    tipo: 'criacao',
    dataHoraIso: agoraIso,
    estado: estadoInicial,
  };
  return {
    id,
    nome,
    codigo,
    criadoEmIso: agoraIso,
    modificadoEmIso: agoraIso,
    status: 'em-edicao',
    estadoAtual: estadoInicial,
    historico: [eventoDeCriacao],
  };
}

/** Registra um evento (com snapshot do estado) e atualiza o estado atual + data de modificação. */
export function registrarEvento(
  projeto: Projeto,
  tipo: TipoDeEvento,
  novoEstado: EstadoDoProjeto,
  agoraIso: string,
  descricao?: string,
): Projeto {
  const evento: EventoDeHistorico = {
    id: `${projeto.id}-hist-${projeto.historico.length}`,
    tipo,
    dataHoraIso: agoraIso,
    estado: novoEstado,
    ...(descricao !== undefined ? { descricao } : {}),
  };
  return {
    ...projeto,
    estadoAtual: novoEstado,
    modificadoEmIso: agoraIso,
    historico: [...projeto.historico, evento],
  };
}

/** Restaura um estado de um evento passado — SEM apagar histórico; registra a própria restauração como novo evento. */
export function restaurarVersao(projeto: Projeto, idDoEvento: string, agoraIso: string): Projeto {
  const evento = projeto.historico.find((e) => e.id === idDoEvento);
  if (!evento) {
    throw new Error(`Evento de histórico "${idDoEvento}" não encontrado no projeto "${projeto.nome}".`);
  }
  return registrarEvento(
    projeto,
    'restauracao-de-versao',
    evento.estado,
    agoraIso,
    `Restaurado a partir de "${ROTULO_DO_EVENTO[evento.tipo]}" (${evento.dataHoraIso})`,
  );
}

export function alterarStatus(projeto: Projeto, novoStatus: StatusDoProjeto, agoraIso: string): Projeto {
  return { ...projeto, status: novoStatus, modificadoEmIso: agoraIso };
}

export function renomearProjeto(projeto: Projeto, novoNome: string, agoraIso: string): Projeto {
  return { ...projeto, nome: novoNome, modificadoEmIso: agoraIso };
}

/**
 * Filtra projetos por texto livre (nome, código, tecido, tamanho) e/ou
 * status — usado pela busca da biblioteca (seção 9).
 */
export function filtrarProjetos(
  projetos: readonly Projeto[],
  termoDeBusca: string,
  status: StatusDoProjeto | 'todos',
): Projeto[] {
  const termo = termoDeBusca.trim().toLowerCase();
  return projetos.filter((p) => {
    if (status !== 'todos' && p.status !== status) return false;
    if (termo === '') return true;
    const camposDeBusca = [p.nome, p.codigo, p.estadoAtual.tecido?.nome ?? '', p.estadoAtual.tecido?.referencia ?? ''];
    return camposDeBusca.some((campo) => campo.toLowerCase().includes(termo));
  });
}

/** Ordena por data de modificação decrescente (mais recentes primeiro) — seção 9. */
export function ordenarPorMaisRecente(projetos: readonly Projeto[]): Projeto[] {
  return [...projetos].sort((a, b) => b.modificadoEmIso.localeCompare(a.modificadoEmIso));
}

/**
 * Variantes: cópias de um projeto para testar outra versão do mesmo trabalho
 * (outras quantidades, outro tecido, outro encaixe) sem perder a original.
 * Cada variante é um projeto inteiro da biblioteca, com histórico próprio,
 * ligado ao original por `varianteDe`. A variante de uma variante continua
 * ligada ao mesmo original: a família é uma lista, não uma árvore.
 */
export function criarVariante(
  origem: Projeto,
  nome: string,
  id: string,
  codigo: string,
  agoraIso: string,
  estado: EstadoDoProjeto,
): Projeto {
  return {
    ...criarProjeto(nome, id, codigo, agoraIso, estado),
    varianteDe: origem.varianteDe ?? origem.id,
    // A variante é do mesmo modelo: o autor vai junto.
    ...(origem.autor ? { autor: origem.autor } : {}),
  };
}

/** O projeto e as variantes da mesma família, da mais antiga à mais nova (o original vem primeiro). */
export function variantesDoProjeto(projetos: readonly Projeto[], projeto: Projeto): Projeto[] {
  const original = projeto.varianteDe ?? projeto.id;
  const familia = projetos.filter((p) => p.id !== projeto.id && (p.varianteDe ?? p.id) === original);
  return [...familia, projeto].sort((a, b) => a.criadoEmIso.localeCompare(b.criadoEmIso));
}

const SUFIXO_DE_VARIANTE = / — variante (\d+)$/;

/**
 * Nome sugerido para a próxima variante: o do original e o número seguinte
 * ao maior já usado na família ("Camisa — variante 3"). O original conta
 * como a primeira, então a primeira variante é a 2.
 */
export function nomeDaProximaVariante(projetos: readonly Projeto[], projeto: Projeto): string {
  const familia = variantesDoProjeto(projetos, projeto);
  const original = familia.find((p) => p.varianteDe === undefined) ?? projeto;
  const numerosUsados = familia.map((p) => Number(SUFIXO_DE_VARIANTE.exec(p.nome)?.[1] ?? 0));
  return `${original.nome.replace(SUFIXO_DE_VARIANTE, '')} — variante ${Math.max(familia.length, ...numerosUsados) + 1}`;
}

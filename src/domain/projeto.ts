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

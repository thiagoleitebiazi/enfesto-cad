import type { ConfiguracaoDeEnfesto } from './enfesto';
import { estaTerminado, type DadosDoTrabalho, type OpcoesDoTrabalho, type PrioridadeNaFila, type TrabalhoDeEncaixe } from './filaDeEncaixes';
import type { Molde } from './molde';
import type { ResultadoDeNesting } from './nesting';
import type { PastaDeArquivos } from './pastaCompartilhada';

/**
 * A fila de encaixes na rede (ADR 0143): o servidor de encaixes sem servidor. As estações usam uma pasta da rede:
 * - quem pede grava o trabalho em "pedidos";
 * - uma estação que atende a fila leva o pedido mais antigo para "calculando" — a mudança de pasta é a posse: se outra
 *   estação levou antes, ele não está mais lá —, calcula como um encaixe da sua própria fila e grava o resultado em
 *   "prontos";
 * - quem pediu encontra o resultado ali, e o trabalho termina na fila dele, com o encaixe e o nome de quem calculou.
 */

export const PEDIDOS_DA_FILA = 'pedidos';
export const CALCULANDO_NA_FILA = 'calculando';
export const PRONTOS_DA_FILA = 'prontos';

export interface PedidoDeEncaixe {
  readonly id: string;
  readonly pedidoPor: string;
  readonly enviadoEmIso: string;
  readonly projetoId: string;
  readonly projetoNome: string;
  readonly projetoCodigo: string;
  readonly impressaoDasPecas: string;
  readonly prioridade: PrioridadeNaFila;
  readonly pecas: readonly Molde[];
  readonly enfesto: ConfiguracaoDeEnfesto;
  readonly opcoes: OpcoesDoTrabalho;
}

export interface EncaixePronto {
  readonly id: string;
  readonly calculadoPor: string;
  readonly terminadoEmIso: string;
  readonly resultado?: ResultadoDeNesting;
  readonly erro?: string;
}

export const arquivoDoPedido = (id: string): string => `${id}.json`;

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function lerJson(texto: string | null): Record<string, unknown> | null {
  if (texto === null) return null;
  try {
    const v: unknown = JSON.parse(texto);
    return ehObjeto(v) ? v : null;
  } catch {
    return null;
  }
}

export function pedidoDoTrabalho(t: TrabalhoDeEncaixe, pedidoPor: string, agoraIso: string): PedidoDeEncaixe {
  return {
    id: t.id,
    pedidoPor,
    enviadoEmIso: agoraIso,
    projetoId: t.projetoId,
    projetoNome: t.projetoNome,
    projetoCodigo: t.projetoCodigo,
    impressaoDasPecas: t.impressaoDasPecas,
    prioridade: t.prioridade,
    pecas: t.pecas,
    enfesto: t.enfesto,
    opcoes: t.opcoes,
  };
}

/** O pedido lido da pasta; `null` se o arquivo não é um pedido (ele não é calculado). */
export function lerPedido(texto: string | null): PedidoDeEncaixe | null {
  const p = lerJson(texto);
  if (!p) return null;
  const textos = ['id', 'pedidoPor', 'enviadoEmIso', 'projetoId', 'projetoNome', 'projetoCodigo', 'impressaoDasPecas'] as const;
  if (!textos.every((c) => typeof p[c] === 'string')) return null;
  if (p.prioridade !== 'alta' && p.prioridade !== 'normal' && p.prioridade !== 'baixa') return null;
  if (!Array.isArray(p.pecas) || p.pecas.length === 0 || !p.pecas.every((x) => ehObjeto(x) && Array.isArray(x.contorno))) return null;
  if (!ehObjeto(p.enfesto) || typeof p.enfesto.larguraUtilMm !== 'number' || typeof p.enfesto.comprimentoMm !== 'number') return null;
  if (!ehObjeto(p.opcoes) || (p.opcoes.metodo !== 'grade' && p.opcoes.metodo !== 'pontos-de-canto')) return null;
  return p as unknown as PedidoDeEncaixe;
}

export function lerPronto(texto: string | null): EncaixePronto | null {
  const p = lerJson(texto);
  if (!p || typeof p.id !== 'string' || typeof p.calculadoPor !== 'string' || typeof p.terminadoEmIso !== 'string') return null;
  if (p.resultado !== undefined && (!ehObjeto(p.resultado) || !Array.isArray(p.resultado.pecasColocadas) || !Array.isArray(p.resultado.pecasNaoColocadas))) return null;
  if (p.resultado === undefined && typeof p.erro !== 'string') return null;
  return p as unknown as EncaixePronto;
}

/** O pedido como um trabalho da fila de quem atende (marcado como pedido da rede). */
export function dadosDoPedido(p: PedidoDeEncaixe): DadosDoTrabalho {
  return {
    projetoId: p.projetoId,
    projetoNome: p.projetoNome,
    projetoCodigo: p.projetoCodigo,
    impressaoDasPecas: p.impressaoDasPecas,
    prioridade: p.prioridade,
    pecas: p.pecas,
    enfesto: p.enfesto,
    opcoes: p.opcoes,
    pedidoDaRede: { id: p.id, pedidoPor: p.pedidoPor },
  };
}

/** O resultado de um pedido calculado aqui, para voltar à rede. */
export function prontoDoTrabalho(t: TrabalhoDeEncaixe, calculadoPor: string, agoraIso: string): EncaixePronto | null {
  if (!t.pedidoDaRede || !estaTerminado(t)) return null;
  const comum = { id: t.pedidoDaRede.id, calculadoPor, terminadoEmIso: t.terminadoEmIso ?? agoraIso };
  if (t.situacao === 'concluido' && t.resultado) return { ...comum, resultado: t.resultado };
  return { ...comum, erro: t.erro ?? `cancelado na estação ${calculadoPor}` };
}

export async function mandarPedido(pasta: PastaDeArquivos, pedido: PedidoDeEncaixe): Promise<boolean> {
  return pasta.gravar(PEDIDOS_DA_FILA, arquivoDoPedido(pedido.id), JSON.stringify(pedido));
}

/** Tira o pedido da pasta, se ninguém o levou ainda (`false`: outra estação já está calculando). */
export async function retirarPedido(pasta: PastaDeArquivos, id: string): Promise<boolean> {
  return pasta.apagar(PEDIDOS_DA_FILA, arquivoDoPedido(id));
}

/**
 * Leva o pedido mais antigo para "calculando" e o devolve. O que outra estação levou primeiro é pulado; o arquivo
 * que não é um pedido é apagado de "calculando" (não há o que calcular).
 */
export async function pegarOProximoPedido(pasta: PastaDeArquivos): Promise<PedidoDeEncaixe | null> {
  for (const { nome } of (await pasta.listar(PEDIDOS_DA_FILA)) ?? []) {
    if (!nome.endsWith('.json')) continue;
    if (!(await pasta.mover(PEDIDOS_DA_FILA, nome, CALCULANDO_NA_FILA, nome))) continue;
    const pedido = lerPedido(await pasta.ler(CALCULANDO_NA_FILA, nome));
    if (pedido && arquivoDoPedido(pedido.id) === nome) return pedido;
    await pasta.apagar(CALCULANDO_NA_FILA, nome);
  }
  return null;
}

/** Devolve a "pedidos" um pedido levado que esta estação não conseguiu pôr na fila dela. */
export async function devolverPedido(pasta: PastaDeArquivos, id: string): Promise<boolean> {
  return pasta.mover(CALCULANDO_NA_FILA, arquivoDoPedido(id), PEDIDOS_DA_FILA, arquivoDoPedido(id));
}

/** Grava o resultado em "prontos" e tira o pedido de "calculando". */
export async function entregarPronto(pasta: PastaDeArquivos, pronto: EncaixePronto): Promise<boolean> {
  if (!(await pasta.gravar(PRONTOS_DA_FILA, arquivoDoPedido(pronto.id), JSON.stringify(pronto)))) return false;
  await pasta.apagar(CALCULANDO_NA_FILA, arquivoDoPedido(pronto.id));
  return true;
}

/** Os resultados prontos dos pedidos `ids` (os que ainda não voltaram ficam de fora). */
export async function buscarProntos(pasta: PastaDeArquivos, ids: readonly string[]): Promise<EncaixePronto[]> {
  const prontos: EncaixePronto[] = [];
  for (const id of ids) {
    const pronto = lerPronto(await pasta.ler(PRONTOS_DA_FILA, arquivoDoPedido(id)));
    if (pronto && pronto.id === id) prontos.push(pronto);
  }
  return prontos;
}

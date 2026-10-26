import type { Molde } from './molde';
import type { ConfiguracaoDeEnfesto } from './enfesto';
import type { MetodoDoNesting, ResultadoDeNesting } from './nesting';
import { numeroComVirgula } from '../core/numeros';
import { textoCsv } from '../core/csv';

/**
 * A fila de encaixes (ADR 0102): vários encaixes automáticos esperando a vez, calculados um de cada vez em segundo
 * plano enquanto o programa está aberto — a pessoa continua desenhando, ou fecha o projeto e abre outro. Cada
 * trabalho guarda as peças e a mesa como estavam ao entrar na fila (o cálculo é delas, não das de agora), a
 * prioridade, a situação e, no fim, o resultado, que é aplicado no projeto quando a pessoa quiser.
 *
 * A fila fica num arquivo próprio da pasta de dados (`fila-de-encaixes.json`) e sobrevive a fechar o programa; um
 * trabalho que estava calculando quando ele fechou volta para "aguardando" e recomeça do início.
 */

export const VERSAO_DA_FILA = 1;
export const MAXIMO_DE_TRABALHOS = 100;

export type SituacaoNaFila = 'aguardando' | 'executando' | 'pausado' | 'na-rede' | 'concluido' | 'falhou' | 'cancelado';
export type PrioridadeNaFila = 'alta' | 'normal' | 'baixa';

export const ROTULO_DA_SITUACAO_NA_FILA: Readonly<Record<SituacaoNaFila, string>> = {
  aguardando: 'Aguardando',
  executando: 'Calculando',
  pausado: 'Pausado',
  'na-rede': 'Na fila da rede',
  concluido: 'Concluído',
  falhou: 'Falhou',
  cancelado: 'Cancelado',
};

export const ROTULO_DA_PRIORIDADE: Readonly<Record<PrioridadeNaFila, string>> = { alta: 'Alta', normal: 'Normal', baixa: 'Baixa' };
const PESO_DA_PRIORIDADE: Readonly<Record<PrioridadeNaFila, number>> = { alta: 0, normal: 1, baixa: 2 };

export interface OpcoesDoTrabalho {
  readonly metodo: MetodoDoNesting;
  readonly limiteDeTempoMs?: number;
  readonly aproveitamentoDesejadoPercentual?: number;
  readonly tecidoDeSentidoUnico?: boolean;
  /** Só para dizer na tela como as peças entraram (as peças do trabalho já vêm abertas e com os tamanhos). */
  readonly todosOsTamanhos?: boolean;
  readonly abrirSimetrias?: boolean;
}

export interface TrabalhoDeEncaixe {
  readonly id: string;
  readonly projetoId: string;
  readonly projetoNome: string;
  readonly projetoCodigo: string;
  /** A marca das peças do projeto quando o trabalho entrou na fila: diz, antes de aplicar, se elas mudaram depois. */
  readonly impressaoDasPecas: string;
  readonly criadoEmIso: string;
  readonly prioridade: PrioridadeNaFila;
  /** A vez dentro da mesma prioridade (a menor primeiro). */
  readonly ordem: number;
  readonly situacao: SituacaoNaFila;
  /** As peças a encaixar, como estavam ao entrar na fila (já com os tamanhos e as simetrias abertas, se pedido). */
  readonly pecas: readonly Molde[];
  readonly enfesto: ConfiguracaoDeEnfesto;
  readonly opcoes: OpcoesDoTrabalho;
  readonly iniciadoEmIso?: string;
  readonly terminadoEmIso?: string;
  readonly resultado?: ResultadoDeNesting;
  readonly erro?: string;
  readonly aplicadoEmIso?: string;
  /** Quantas vezes o cálculo recomeçou do início (pausado no meio, ou o programa fechado no meio). */
  readonly recomecos?: number;
  /** Veio de um pedido da fila da rede (ADR 0143): ao terminar, o resultado volta para a pasta e o trabalho sai daqui. */
  readonly pedidoDaRede?: { readonly id: string; readonly pedidoPor: string };
  /** Mandado para a fila da rede: quando foi; e, ao voltar, quem calculou. */
  readonly enviadoParaARedeEmIso?: string;
  readonly calculadoPor?: string;
}

export interface FilaDeEncaixes {
  readonly versaoDoFormato: number;
  /** Pausada: nenhum trabalho novo começa (o que está calculando vai até o fim). */
  readonly pausada: boolean;
  readonly trabalhos: readonly TrabalhoDeEncaixe[];
}

export const FILA_VAZIA: FilaDeEncaixes = { versaoDoFormato: VERSAO_DA_FILA, pausada: false, trabalhos: [] };

const PENDENTES: ReadonlySet<SituacaoNaFila> = new Set(['aguardando', 'pausado']);
const TERMINADOS: ReadonlySet<SituacaoNaFila> = new Set(['concluido', 'falhou', 'cancelado']);

export const estaPendente = (t: TrabalhoDeEncaixe): boolean => PENDENTES.has(t.situacao);
export const estaTerminado = (t: TrabalhoDeEncaixe): boolean => TERMINADOS.has(t.situacao);

const pelaVez = (a: TrabalhoDeEncaixe, b: TrabalhoDeEncaixe): number =>
  PESO_DA_PRIORIDADE[a.prioridade] - PESO_DA_PRIORIDADE[b.prioridade] || a.ordem - b.ordem;

/** Os trabalhos como a tela mostra: o que está calculando, depois os da fila na vez deles, depois os terminados (o mais recente primeiro). */
export function trabalhosNaOrdem(fila: FilaDeEncaixes): TrabalhoDeEncaixe[] {
  const executando = fila.trabalhos.filter((t) => t.situacao === 'executando');
  const naRede = fila.trabalhos.filter((t) => t.situacao === 'na-rede');
  const pendentes = fila.trabalhos.filter(estaPendente).sort(pelaVez);
  const terminados = fila.trabalhos
    .filter(estaTerminado)
    .sort((a, b) => (b.terminadoEmIso ?? b.criadoEmIso).localeCompare(a.terminadoEmIso ?? a.criadoEmIso));
  return [...executando, ...naRede, ...pendentes, ...terminados];
}

/** O próximo a calcular: o primeiro aguardando na vez — nenhum, com a fila pausada ou com um já calculando. */
export function proximoTrabalho(fila: FilaDeEncaixes): TrabalhoDeEncaixe | null {
  if (fila.pausada || fila.trabalhos.some((t) => t.situacao === 'executando')) return null;
  return fila.trabalhos.filter((t) => t.situacao === 'aguardando').sort(pelaVez)[0] ?? null;
}

/** A posição do trabalho na fila (1 = o próximo), contando só os que aguardam ou estão pausados; `null` fora da fila. */
export function posicaoNaFila(fila: FilaDeEncaixes, id: string): number | null {
  const i = fila.trabalhos.filter(estaPendente).sort(pelaVez).findIndex((t) => t.id === id);
  return i < 0 ? null : i + 1;
}

export interface DadosDoTrabalho {
  readonly projetoId: string;
  readonly projetoNome: string;
  readonly projetoCodigo: string;
  readonly impressaoDasPecas: string;
  readonly prioridade: PrioridadeNaFila;
  readonly pecas: readonly Molde[];
  readonly enfesto: ConfiguracaoDeEnfesto;
  readonly opcoes: OpcoesDoTrabalho;
  readonly pedidoDaRede?: { readonly id: string; readonly pedidoPor: string };
}

/** Põe um trabalho no fim da fila da prioridade dele. Recusa (com o motivo) sem peças ou com a fila cheia. */
export function adicionarTrabalho(fila: FilaDeEncaixes, dados: DadosDoTrabalho, id: string, agoraIso: string): FilaDeEncaixes {
  if (dados.pecas.length === 0) throw new Error('Não há peças para encaixar.');
  if (fila.trabalhos.length >= MAXIMO_DE_TRABALHOS) {
    throw new Error(`A fila já tem ${MAXIMO_DE_TRABALHOS} encaixes: remova os terminados ("Limpar os terminados") antes de pôr outro.`);
  }
  const ordem = fila.trabalhos.reduce((maior, t) => Math.max(maior, t.ordem), 0) + 1;
  const trabalho: TrabalhoDeEncaixe = { ...dados, id, criadoEmIso: agoraIso, ordem, situacao: 'aguardando' };
  return { ...fila, trabalhos: [...fila.trabalhos, trabalho] };
}

function mudar(fila: FilaDeEncaixes, id: string, mudanca: (t: TrabalhoDeEncaixe) => TrabalhoDeEncaixe | null): FilaDeEncaixes {
  let mudou = false;
  const trabalhos = fila.trabalhos.map((t) => {
    if (t.id !== id) return t;
    const novo = mudanca(t);
    if (novo === null) return t;
    mudou = true;
    return novo;
  });
  return mudou ? { ...fila, trabalhos } : fila;
}

/** Tira os campos do cálculo anterior (para recomeçar). */
function semCalculo(t: TrabalhoDeEncaixe): TrabalhoDeEncaixe {
  const copia: Partial<Record<keyof TrabalhoDeEncaixe, unknown>> = { ...t };
  for (const campo of ['iniciadoEmIso', 'terminadoEmIso', 'resultado', 'erro', 'aplicadoEmIso'] as const) delete copia[campo];
  return copia as TrabalhoDeEncaixe;
}

export function iniciarTrabalho(fila: FilaDeEncaixes, id: string, agoraIso: string): FilaDeEncaixes {
  return mudar(fila, id, (t) => (t.situacao === 'aguardando' ? { ...t, situacao: 'executando', iniciadoEmIso: agoraIso } : null));
}

export function concluirTrabalho(fila: FilaDeEncaixes, id: string, resultado: ResultadoDeNesting, agoraIso: string): FilaDeEncaixes {
  return mudar(fila, id, (t) => (t.situacao === 'executando' ? { ...t, situacao: 'concluido', resultado, terminadoEmIso: agoraIso } : null));
}

export function falharTrabalho(fila: FilaDeEncaixes, id: string, erro: string, agoraIso: string): FilaDeEncaixes {
  return mudar(fila, id, (t) => (t.situacao === 'executando' ? { ...t, situacao: 'falhou', erro, terminadoEmIso: agoraIso } : null));
}

/** Pausa um trabalho da fila; o que está calculando para e, ao ser retomado, recomeça do início. */
export function pausarTrabalho(fila: FilaDeEncaixes, id: string): FilaDeEncaixes {
  return mudar(fila, id, (t) => {
    if (t.situacao === 'aguardando') return { ...t, situacao: 'pausado' };
    if (t.situacao === 'executando') return { ...semCalculo(t), situacao: 'pausado', recomecos: (t.recomecos ?? 0) + 1 };
    return null;
  });
}

export function retomarTrabalho(fila: FilaDeEncaixes, id: string): FilaDeEncaixes {
  return mudar(fila, id, (t) => (t.situacao === 'pausado' ? { ...t, situacao: 'aguardando' } : null));
}

export function cancelarTrabalho(fila: FilaDeEncaixes, id: string, agoraIso: string): FilaDeEncaixes {
  return mudar(fila, id, (t) => (estaPendente(t) || t.situacao === 'executando' ? { ...semCalculo(t), situacao: 'cancelado', terminadoEmIso: agoraIso } : null));
}

/** Põe de novo na fila (no fim da prioridade dele) um trabalho que falhou, foi cancelado ou já terminou. */
export function reenfileirarTrabalho(fila: FilaDeEncaixes, id: string): FilaDeEncaixes {
  const ordem = fila.trabalhos.reduce((maior, t) => Math.max(maior, t.ordem), 0) + 1;
  return mudar(fila, id, (t) => (estaTerminado(t) ? { ...semCalculo(t), situacao: 'aguardando', ordem } : null));
}

/** Tira o trabalho da fila (o que está calculando não: pause ou cancele antes; o que está na rede, traga de volta antes). */
export function removerTrabalho(fila: FilaDeEncaixes, id: string): FilaDeEncaixes {
  const trabalhos = fila.trabalhos.filter((t) => t.id !== id || t.situacao === 'executando' || t.situacao === 'na-rede');
  return trabalhos.length === fila.trabalhos.length ? fila : { ...fila, trabalhos };
}

export function removerTerminados(fila: FilaDeEncaixes): FilaDeEncaixes {
  const trabalhos = fila.trabalhos.filter((t) => !estaTerminado(t));
  return trabalhos.length === fila.trabalhos.length ? fila : { ...fila, trabalhos };
}

export function mudarPrioridade(fila: FilaDeEncaixes, id: string, prioridade: PrioridadeNaFila): FilaDeEncaixes {
  return mudar(fila, id, (t) => (estaPendente(t) && t.prioridade !== prioridade ? { ...t, prioridade } : null));
}

/** Troca a vez com o vizinho de cima (−1) ou de baixo (+1) na mesma prioridade; sem vizinho, nada muda. */
export function moverNaFila(fila: FilaDeEncaixes, id: string, direcao: -1 | 1): FilaDeEncaixes {
  const trabalho = fila.trabalhos.find((t) => t.id === id);
  if (!trabalho || !estaPendente(trabalho)) return fila;
  const mesmaPrioridade = fila.trabalhos.filter((t) => estaPendente(t) && t.prioridade === trabalho.prioridade).sort(pelaVez);
  const vizinho = mesmaPrioridade[mesmaPrioridade.findIndex((t) => t.id === id) + direcao];
  if (!vizinho) return fila;
  return {
    ...fila,
    trabalhos: fila.trabalhos.map((t) => (t.id === id ? { ...t, ordem: vizinho.ordem } : t.id === vizinho.id ? { ...t, ordem: trabalho.ordem } : t)),
  };
}

/** Se o trabalho pode subir (−1) ou descer (+1) na fila. */
export function podeMover(fila: FilaDeEncaixes, id: string, direcao: -1 | 1): boolean {
  return moverNaFila(fila, id, direcao) !== fila;
}

/** Manda para a fila da rede (ADR 0143) um trabalho que ainda espera a vez aqui: outra estação o calcula. */
export function enviarParaARede(fila: FilaDeEncaixes, id: string, agoraIso: string): FilaDeEncaixes {
  return mudar(fila, id, (t) => (estaPendente(t) && !t.pedidoDaRede ? { ...t, situacao: 'na-rede', enviadoParaARedeEmIso: agoraIso } : null));
}

/** Traz de volta para esta fila um trabalho mandado para a rede (ele volta a esperar a vez aqui). */
export function trazerDaRede(fila: FilaDeEncaixes, id: string): FilaDeEncaixes {
  return mudar(fila, id, (t) => {
    if (t.situacao !== 'na-rede') return null;
    const copia: Partial<Record<keyof TrabalhoDeEncaixe, unknown>> = { ...t, situacao: 'aguardando' };
    delete copia.enviadoParaARedeEmIso;
    return copia as TrabalhoDeEncaixe;
  });
}

/** O resultado que voltou da rede: o trabalho termina aqui, com o encaixe (ou o erro) e quem calculou. */
export function receberDaRede(
  fila: FilaDeEncaixes,
  id: string,
  pronto: { readonly calculadoPor: string; readonly terminadoEmIso: string; readonly resultado?: ResultadoDeNesting; readonly erro?: string },
): FilaDeEncaixes {
  return mudar(fila, id, (t) => {
    if (t.situacao !== 'na-rede') return null;
    const comum = { ...t, calculadoPor: pronto.calculadoPor, terminadoEmIso: pronto.terminadoEmIso };
    return pronto.resultado ? { ...comum, situacao: 'concluido', resultado: pronto.resultado } : { ...comum, situacao: 'falhou', erro: pronto.erro ?? 'a estação que atendeu não devolveu o encaixe' };
  });
}

export function marcarAplicado(fila: FilaDeEncaixes, id: string, agoraIso: string): FilaDeEncaixes {
  return mudar(fila, id, (t) => (t.situacao === 'concluido' ? { ...t, aplicadoEmIso: agoraIso } : null));
}

export function pausarAFila(fila: FilaDeEncaixes, pausada: boolean): FilaDeEncaixes {
  return fila.pausada === pausada ? fila : { ...fila, pausada };
}

/** Ao abrir o programa: o que estava calculando quando ele fechou volta para a fila e recomeça do início. */
export function recuperarInterrompidos(fila: FilaDeEncaixes): FilaDeEncaixes {
  if (!fila.trabalhos.some((t) => t.situacao === 'executando')) return fila;
  return {
    ...fila,
    trabalhos: fila.trabalhos.map((t) => (t.situacao === 'executando' ? { ...semCalculo(t), situacao: 'aguardando', recomecos: (t.recomecos ?? 0) + 1 } : t)),
  };
}

/** Quantos de cada situação (para o resumo na barra de status). */
export function contagemDaFila(fila: FilaDeEncaixes): Readonly<Record<SituacaoNaFila, number>> {
  const contagem: Record<SituacaoNaFila, number> = { aguardando: 0, executando: 0, pausado: 0, 'na-rede': 0, concluido: 0, falhou: 0, cancelado: 0 };
  for (const t of fila.trabalhos) contagem[t.situacao]++;
  return contagem;
}

/** Os concluídos ainda não aplicados (o que espera a pessoa olhar). */
export function concluidosSemAplicar(fila: FilaDeEncaixes): number {
  // Os pedidos de outra estação não contam: o resultado deles volta para a rede, não é aplicado aqui.
  return fila.trabalhos.filter((t) => t.situacao === 'concluido' && t.aplicadoEmIso === undefined && !t.pedidoDaRede).length;
}

// ---- Comparar os resultados

/**
 * O melhor encaixe concluído de cada projeto: primeiro o que pôs todas as peças, depois o de maior aproveitamento,
 * depois o mais curto. Só conta quando o projeto tem mais de um concluído (para comparar).
 */
export function melhoresPorProjeto(fila: FilaDeEncaixes): ReadonlySet<string> {
  const porProjeto = new Map<string, TrabalhoDeEncaixe[]>();
  for (const t of fila.trabalhos) {
    if (t.situacao !== 'concluido' || !t.resultado || t.resultado.pecasColocadas.length === 0) continue;
    porProjeto.set(t.projetoId, [...(porProjeto.get(t.projetoId) ?? []), t]);
  }
  const melhores = new Set<string>();
  for (const lista of porProjeto.values()) {
    if (lista.length < 2) continue;
    const [melhor] = [...lista].sort(
      (a, b) =>
        a.resultado!.pecasNaoColocadas.length - b.resultado!.pecasNaoColocadas.length ||
        b.resultado!.aproveitamentoPercentual - a.resultado!.aproveitamentoPercentual ||
        a.resultado!.comprimentoUtilizadoMm - b.resultado!.comprimentoUtilizadoMm,
    );
    melhores.add(melhor!.id);
  }
  return melhores;
}

/** As opções do trabalho em palavras: "Busca em grade · até 5 min · meta de 85%". */
export function descricaoDasOpcoes(opcoes: OpcoesDoTrabalho): string {
  const partes = [opcoes.metodo === 'pontos-de-canto' ? 'Pontos de canto' : 'Busca em grade'];
  if (opcoes.limiteDeTempoMs !== undefined) partes.push(`até ${numeroComVirgula(opcoes.limiteDeTempoMs / 60_000, 1)} min`);
  if (opcoes.aproveitamentoDesejadoPercentual !== undefined) partes.push(`meta de ${numeroComVirgula(opcoes.aproveitamentoDesejadoPercentual, 1)}%`);
  if (opcoes.todosOsTamanhos) partes.push('todos os tamanhos');
  if (opcoes.abrirSimetrias) partes.push('simetrias abertas');
  if (opcoes.tecidoDeSentidoUnico) partes.push('tecido de sentido único');
  return partes.join(' · ');
}

/** Quantas cópias de peça o trabalho encaixa. */
export const copiasDoTrabalho = (t: TrabalhoDeEncaixe): number => t.pecas.reduce((s, p) => s + p.quantidade, 0);

// ---- O relatório de eficiência

export interface RelatorioDaFila {
  readonly concluidos: number;
  readonly comPecasDeFora: number;
  readonly falharam: number;
  /** A média dos aproveitamentos dos concluídos (cada encaixe pesa o mesmo). */
  readonly aproveitamentoMedio: number | null;
  readonly melhorAproveitamento: number | null;
  readonly comprimentoTotalMm: number;
  readonly tempoTotalMs: number;
  readonly tempoMedioMs: number | null;
}

export function relatorioDaFila(fila: FilaDeEncaixes): RelatorioDaFila {
  const feitos = fila.trabalhos.filter((t) => t.situacao === 'concluido' && t.resultado);
  const aproveitamentos = feitos.map((t) => t.resultado!.aproveitamentoPercentual);
  const tempoTotalMs = feitos.reduce((s, t) => s + t.resultado!.tempoDeProcessamentoMs, 0);
  return {
    concluidos: feitos.length,
    comPecasDeFora: feitos.filter((t) => t.resultado!.pecasNaoColocadas.length > 0).length,
    falharam: fila.trabalhos.filter((t) => t.situacao === 'falhou').length,
    aproveitamentoMedio: feitos.length === 0 ? null : aproveitamentos.reduce((s, a) => s + a, 0) / feitos.length,
    melhorAproveitamento: feitos.length === 0 ? null : Math.max(...aproveitamentos),
    comprimentoTotalMm: feitos.reduce((s, t) => s + t.resultado!.comprimentoUtilizadoMm, 0),
    tempoTotalMs,
    tempoMedioMs: feitos.length === 0 ? null : tempoTotalMs / feitos.length,
  };
}

const dataHora = (iso: string | undefined): string => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');

/** Todos os trabalhos da fila, um por linha (ponto e vírgula, vírgula decimal). */
export function csvDaFila(fila: FilaDeEncaixes): string {
  const cabecalho = [
    'Projeto',
    'Código',
    'Situação',
    'Prioridade',
    'Opções',
    'Cópias de peça',
    'Peças colocadas',
    'Peças de fora',
    'Comprimento (m)',
    'Aproveitamento (%)',
    'Tempo de cálculo (s)',
    'Entrou na fila',
    'Terminou',
    'Aplicado',
    'Erro',
  ];
  const linhas = trabalhosNaOrdem(fila).map((t) => {
    const r = t.resultado;
    return [
      t.projetoNome,
      t.projetoCodigo,
      ROTULO_DA_SITUACAO_NA_FILA[t.situacao],
      ROTULO_DA_PRIORIDADE[t.prioridade],
      descricaoDasOpcoes(t.opcoes),
      String(copiasDoTrabalho(t)),
      r ? String(r.pecasColocadas.length) : '',
      r ? String(r.pecasNaoColocadas.length) : '',
      r ? numeroComVirgula(r.comprimentoUtilizadoMm / 1000, 3) : '',
      r ? numeroComVirgula(r.aproveitamentoPercentual, 1) : '',
      r ? numeroComVirgula(r.tempoDeProcessamentoMs / 1000, 1) : '',
      dataHora(t.criadoEmIso),
      dataHora(t.terminadoEmIso),
      dataHora(t.aplicadoEmIso),
      t.erro ?? '',
    ];
  });
  return textoCsv([cabecalho, ...linhas]);
}

// ---- A leitura do arquivo

export interface FilaLida {
  readonly fila: FilaDeEncaixes;
  /** O que ficou de fora (o motivo de cada um). */
  readonly descartados: readonly string[];
  /** O arquivo é de uma versão mais nova do programa: mostrar, mas não gravar por cima. */
  readonly maisNovo: boolean;
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const SITUACOES: ReadonlySet<string> = new Set(Object.keys(ROTULO_DA_SITUACAO_NA_FILA));
const PRIORIDADES: ReadonlySet<string> = new Set(Object.keys(ROTULO_DA_PRIORIDADE));

function motivoDeRecusa(t: Record<string, unknown>): string | null {
  const textos = ['id', 'projetoId', 'projetoNome', 'projetoCodigo', 'impressaoDasPecas', 'criadoEmIso'] as const;
  const faltando = textos.filter((c) => typeof t[c] !== 'string');
  if (faltando.length > 0) return `sem ${faltando.join(', ')}`;
  if (!SITUACOES.has(String(t.situacao))) return 'com uma situação desconhecida';
  if (!PRIORIDADES.has(String(t.prioridade))) return 'com uma prioridade desconhecida';
  if (typeof t.ordem !== 'number' || !Number.isFinite(t.ordem)) return 'sem a vez na fila';
  if (!Array.isArray(t.pecas) || t.pecas.length === 0 || !t.pecas.every((p) => ehObjeto(p) && Array.isArray(p.contorno))) return 'sem as peças';
  if (!ehObjeto(t.enfesto) || typeof t.enfesto.larguraUtilMm !== 'number' || typeof t.enfesto.comprimentoMm !== 'number') return 'sem a mesa';
  if (!ehObjeto(t.opcoes) || (t.opcoes.metodo !== 'grade' && t.opcoes.metodo !== 'pontos-de-canto')) return 'sem o método';
  if (t.resultado !== undefined && (!ehObjeto(t.resultado) || !Array.isArray(t.resultado.pecasColocadas) || !Array.isArray(t.resultado.pecasNaoColocadas))) {
    return 'com o resultado quebrado';
  }
  if (t.situacao === 'concluido' && t.resultado === undefined) return 'concluído sem o resultado';
  return null;
}

/** Lê a fila vinda do disco (ou `null`, sem arquivo): o que não é um trabalho é deixado de fora, com o motivo. */
export function lerFilaDeEncaixes(bruto: unknown): FilaLida {
  if (bruto === null || bruto === undefined) return { fila: FILA_VAZIA, descartados: [], maisNovo: false };
  if (!ehObjeto(bruto) || !Array.isArray(bruto.trabalhos)) return { fila: FILA_VAZIA, descartados: ['O arquivo da fila não é uma fila de encaixes.'], maisNovo: false };
  const descartados: string[] = [];
  const trabalhos: TrabalhoDeEncaixe[] = [];
  bruto.trabalhos.forEach((t, i) => {
    const motivo = ehObjeto(t) ? motivoDeRecusa(t) : 'não é um trabalho';
    if (motivo !== null) descartados.push(`O encaixe ${i + 1} da fila ficou de fora: ${motivo}.`);
    else trabalhos.push(t as unknown as TrabalhoDeEncaixe);
  });
  const maisNovo = typeof bruto.versaoDoFormato === 'number' && bruto.versaoDoFormato > VERSAO_DA_FILA;
  return { fila: { versaoDoFormato: VERSAO_DA_FILA, pausada: bruto.pausada === true, trabalhos }, descartados, maisNovo };
}

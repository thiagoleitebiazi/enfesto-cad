import { estadoDoRolo, rendimentoDaMalha, type CadastroDeProducao, type ExecucaoDoCorte, type RoloDeEstoque } from './cadastroDeProducao';
import { comparativoDaExecucao, ROTULO_DA_SITUACAO } from './execucaoDoCorte';
import { numeroComVirgula } from '../core/numeros';
import { textoCsv } from '../core/csv';

/**
 * A sala de corte inteira (ADR 0100): todas as execuções do cadastro (de todos os projetos), os indicadores, as
 * sugestões de correção tiradas do planejado × executado, os retalhos em estoque e os relatórios para compras e
 * auditoria. Os números são os informados por quem operou (sem máquina ligada); as sugestões dizem de onde vêm.
 */

/** A malha da execução: a guardada ao liberar, ou a do primeiro rolo consumido. */
export function malhaDaExecucao(cadastro: CadastroDeProducao, execucao: ExecucaoDoCorte): string {
  if (execucao.malha) return execucao.malha;
  const roloId = execucao.consumoPorRolo?.[0]?.roloId ?? execucao.usosPlanejados?.[0]?.roloId;
  const rolo = roloId ? cadastro.rolos.find((r) => r.id === roloId) : undefined;
  const malha = rolo ? cadastro.malhas.find((m) => m.id === rolo.malhaId) : undefined;
  return malha?.descricao ?? '(malha não registrada)';
}

/** As execuções concluídas a partir de uma data (ISO); sem data, todas. */
function concluidas(cadastro: CadastroDeProducao, desdeIso?: string): ExecucaoDoCorte[] {
  return cadastro.execucoes.filter((e) => e.situacao === 'concluida' && (desdeIso === undefined || (e.concluidaEmIso ?? '') >= desdeIso));
}

export interface IndicadoresDoOperador {
  readonly operador: string;
  readonly cortes: number;
  readonly metrosReais: number;
  readonly desvioPercentual: number | null;
  readonly tempoMedioMin: number | null;
}

export interface IndicadoresDaSalaDeCorte {
  readonly cortesConcluidos: number;
  readonly abertas: { readonly liberadas: number; readonly emCorte: number };
  readonly consumoPlanejadoMm: number;
  readonly consumoRealMm: number;
  /** (real − planejado) ÷ planejado, de todos os cortes concluídos do período. */
  readonly desvioPercentual: number | null;
  readonly camadasPlanejadas: number;
  readonly camadasRealizadas: number;
  /** Os cortes com as duas horas registradas (começo e conclusão). */
  readonly tempoTotalMin: number;
  readonly tempoMedioMin: number | null;
  /** Metros de malha cortados por hora de corte (só os cortes com as duas horas). */
  readonly metrosPorHora: number | null;
  readonly porOperador: readonly IndicadoresDoOperador[];
}

export function indicadoresDaSalaDeCorte(cadastro: CadastroDeProducao, desdeIso?: string): IndicadoresDaSalaDeCorte {
  const feitas = concluidas(cadastro, desdeIso);
  const planejado = feitas.reduce((s, e) => s + e.consumoPlanejadoMm, 0);
  const real = feitas.reduce((s, e) => s + (e.consumoRealMm ?? 0), 0);
  const comTempo = feitas.map((e) => ({ e, c: comparativoDaExecucao(e) })).filter((x) => x.c.duracaoMin !== null);
  const tempoTotal = comTempo.reduce((s, x) => s + x.c.duracaoMin!, 0);
  const metrosComTempo = comTempo.reduce((s, x) => s + (x.e.consumoRealMm ?? 0), 0) / 1000;
  const operadores = [...new Set(feitas.map((e) => e.operador ?? '(sem operador)'))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  return {
    cortesConcluidos: feitas.length,
    abertas: {
      liberadas: cadastro.execucoes.filter((e) => e.situacao === 'liberada').length,
      emCorte: cadastro.execucoes.filter((e) => e.situacao === 'em-corte').length,
    },
    consumoPlanejadoMm: planejado,
    consumoRealMm: real,
    desvioPercentual: planejado > 0 ? ((real - planejado) / planejado) * 100 : null,
    camadasPlanejadas: feitas.reduce((s, e) => s + e.camadasPlanejadas, 0),
    camadasRealizadas: feitas.reduce((s, e) => s + (e.camadasRealizadas ?? 0), 0),
    tempoTotalMin: tempoTotal,
    tempoMedioMin: comTempo.length > 0 ? tempoTotal / comTempo.length : null,
    // Com menos de um minuto de corte registrado, a conta não diz nada (os cliques de começar e concluir quase juntos).
    metrosPorHora: tempoTotal >= 1 ? metrosComTempo / (tempoTotal / 60) : null,
    porOperador: operadores.map((operador) => {
      const dele = feitas.filter((e) => (e.operador ?? '(sem operador)') === operador);
      const p = dele.reduce((s, e) => s + e.consumoPlanejadoMm, 0);
      const r = dele.reduce((s, e) => s + (e.consumoRealMm ?? 0), 0);
      const tempos = dele.map((e) => comparativoDaExecucao(e).duracaoMin).filter((t): t is number => t !== null);
      return {
        operador,
        cortes: dele.length,
        metrosReais: r / 1000,
        desvioPercentual: p > 0 ? ((r - p) / p) * 100 : null,
        tempoMedioMin: tempos.length > 0 ? tempos.reduce((s, t) => s + t, 0) / tempos.length : null,
      };
    }),
  };
}

export interface SugestaoDaSalaDeCorte {
  readonly nivel: 'aviso' | 'info';
  readonly texto: string;
}

export interface OpcoesDasSugestoes {
  /** A diferença por camada (em %) a partir da qual o consumo pede correção. */
  readonly toleranciaPercentual: number;
  /** Quantos cortes concluídos, no mínimo, para tirar uma média. */
  readonly minimoDeCortes: number;
  readonly agoraIso: string;
}

export const OPCOES_PADRAO_DAS_SUGESTOES: Omit<OpcoesDasSugestoes, 'agoraIso'> = { toleranciaPercentual: 3, minimoDeCortes: 3 };

const HORA_MS = 3_600_000;
const m = (mm: number, casas = 2): string => `${numeroComVirgula(mm / 1000, casas)} m`;

/**
 * As sugestões de correção, cada uma com o dado de que vem: o consumo por camada acima ou abaixo do planejado (a
 * média ponderada pelas camadas, dos cortes concluídos), os cortes com camadas a menos, e as ordens paradas.
 */
export function sugestoesDeCorrecao(cadastro: CadastroDeProducao, opcoes: OpcoesDasSugestoes, desdeIso?: string): SugestaoDaSalaDeCorte[] {
  const sugestoes: SugestaoDaSalaDeCorte[] = [];
  const feitas = concluidas(cadastro, desdeIso).filter((e) => (e.camadasRealizadas ?? 0) > 0 && e.camadasPlanejadas > 0 && e.consumoRealMm !== undefined);

  if (feitas.length >= opcoes.minimoDeCortes) {
    const camadas = feitas.reduce((s, e) => s + e.camadasRealizadas!, 0);
    // A diferença por camada de cada corte, pesada pelas camadas dele: o que cada camada gastou a mais (ou a menos).
    const diferencaPorCamada = feitas.reduce((s, e) => s + (e.consumoRealMm! / e.camadasRealizadas! - e.consumoPlanejadoMm / e.camadasPlanejadas) * e.camadasRealizadas!, 0) / camadas;
    const planejadoPorCamada = feitas.reduce((s, e) => s + (e.consumoPlanejadoMm / e.camadasPlanejadas) * e.camadasRealizadas!, 0) / camadas;
    const percentual = (diferencaPorCamada / planejadoPorCamada) * 100;
    if (percentual > opcoes.toleranciaPercentual) {
      sugestoes.push({
        nivel: 'aviso',
        texto: `Nos ${feitas.length} cortes concluídos, cada camada gastou em média ${m(diferencaPorCamada, 3)} a mais que o planejado (+${numeroComVirgula(percentual, 1)}%, acima da tolerância de ${numeroComVirgula(opcoes.toleranciaPercentual, 1)}%). Aumente as pontas por camada na configuração do plano em cerca de ${m(diferencaPorCamada, 3)}, ou confira o comprimento do risco na mesa.`,
      });
    } else if (percentual < -opcoes.toleranciaPercentual) {
      sugestoes.push({
        nivel: 'info',
        texto: `Nos ${feitas.length} cortes concluídos, cada camada gastou em média ${m(-diferencaPorCamada, 3)} a menos que o planejado (${numeroComVirgula(percentual, 1)}%): as pontas por camada da configuração do plano podem diminuir em cerca de ${m(-diferencaPorCamada, 3)} — o plano está comprando malha a mais.`,
      });
    }
  } else if (concluidas(cadastro, desdeIso).length > 0) {
    sugestoes.push({ nivel: 'info', texto: `Com menos de ${opcoes.minimoDeCortes} cortes concluídos no período, ainda não há média para sugerir correção do consumo.` });
  }

  const comMenos = feitas.filter((e) => e.camadasRealizadas! < e.camadasPlanejadas);
  if (comMenos.length > 0) {
    sugestoes.push({
      nivel: 'aviso',
      texto: `${comMenos.length} corte(s) com menos camadas que o planejado (${comMenos.map((e) => `${e.ordem}: ${e.camadasRealizadas} de ${e.camadasPlanejadas}`).join('; ')}): a ordem pode não ter fechado — confira a produção e se faltou malha.`,
    });
  }

  const agora = Date.parse(opcoes.agoraIso);
  const paradas = cadastro.execucoes.filter((e) => e.situacao === 'liberada' && agora - Date.parse(e.liberadaEmIso) > 48 * HORA_MS);
  if (paradas.length > 0) {
    sugestoes.push({ nivel: 'info', texto: `${paradas.length} ordem(ns) liberada(s) há mais de 2 dias sem começar o corte: ${paradas.map((e) => e.ordem).join(', ')}.` });
  }
  const longas = cadastro.execucoes.filter((e) => e.situacao === 'em-corte' && e.iniciadaEmIso !== undefined && agora - Date.parse(e.iniciadaEmIso) > 12 * HORA_MS);
  if (longas.length > 0) {
    sugestoes.push({
      nivel: 'aviso',
      texto: `${longas.length} corte(s) começado(s) há mais de 12 h e não concluído(s): ${longas.map((e) => e.ordem).join(', ')} — conclua (com o consumo real) ou cancele.`,
    });
  }
  return sugestoes;
}

export interface RetalhoEmEstoque {
  readonly rolo: RoloDeEstoque;
  readonly malha: string;
  readonly saldoMm: number | null;
}

/** Os rolos marcados como retalho, ainda no estoque (os indisponíveis ficam de fora), do maior saldo ao menor. */
export function retalhosEmEstoque(cadastro: CadastroDeProducao): RetalhoEmEstoque[] {
  return cadastro.rolos
    .filter((r) => r.retalho === true && !r.indisponivel)
    .map((rolo) => ({ rolo, malha: cadastro.malhas.find((x) => x.id === rolo.malhaId)?.descricao ?? '(malha fora do cadastro)', saldoMm: estadoDoRolo(cadastro, rolo).saldoFisicoMm }))
    .sort((a, b) => (b.saldoMm ?? -1) - (a.saldoMm ?? -1));
}

export interface LinhaDoRastreio {
  readonly rolo: string;
  readonly lote: string;
  readonly malha: string;
  readonly movimento: string;
  readonly comprimentoMm: number;
  readonly dataIso: string;
  readonly responsavel: string;
  readonly ordem: string;
  readonly projeto: string;
}

/**
 * A rastreabilidade do material (ADR 0203): cada movimento do estoque com o rolo, o lote, a ordem, o projeto e quem
 * fez, do mais novo ao mais velho. A busca acha por rolo, lote, malha, ordem ou projeto.
 */
export function rastreioDosMateriais(cadastro: CadastroDeProducao, nomeDoProjeto: (projetoId: string) => string, busca = ''): LinhaDoRastreio[] {
  const termo = busca.trim().toLocaleLowerCase('pt-BR');
  return cadastro.movimentos
    .map((m) => {
      const rolo = cadastro.rolos.find((r) => r.id === m.roloId);
      return {
        rolo: rolo?.identificacao ?? '(rolo fora do cadastro)',
        lote: rolo?.lote ?? '',
        malha: cadastro.malhas.find((x) => x.id === rolo?.malhaId)?.descricao ?? '',
        movimento: m.tipo as string,
        comprimentoMm: m.comprimentoMm,
        dataIso: m.dataIso,
        responsavel: m.responsavel,
        ordem: cadastro.execucoes.find((e) => e.planoId === m.planoId)?.ordem ?? '',
        projeto: nomeDoProjeto(m.projetoId),
      };
    })
    .filter((l) => termo === '' || [l.rolo, l.lote, l.malha, l.ordem, l.projeto].some((t) => t.toLocaleLowerCase('pt-BR').includes(termo)))
    .sort((a, b) => b.dataIso.localeCompare(a.dataIso));
}

export function csvDoRastreio(linhas: readonly LinhaDoRastreio[]): string {
  const cabecalho = ['Data', 'Rolo', 'Lote', 'Malha', 'Movimento', 'Comprimento (m)', 'Ordem', 'Projeto', 'Responsável'];
  return textoCsv([cabecalho, ...linhas.map((l) => [l.dataIso, l.rolo, l.lote, l.malha, l.movimento, metros(l.comprimentoMm), l.ordem, l.projeto, l.responsavel])]);
}

export interface PrevisaoDaMalha {
  readonly malha: string;
  /** O que os cortes liberados e em andamento ainda pedem. */
  readonly necessarioMm: number;
  /** O que há nos rolos dela. */
  readonly saldoMm: number;
  readonly faltaMm: number;
  /** A falta em peso, quando a malha tem rendimento. */
  readonly faltaG: number | null;
}

/** A previsão de compra (ADR 0203): por malha, o que os cortes pendentes pedem e o que falta no estoque. */
export function previsaoDeCompra(cadastro: CadastroDeProducao): PrevisaoDaMalha[] {
  const grupos = new Map<string, number>();
  for (const e of cadastro.execucoes) {
    if (e.situacao !== 'liberada' && e.situacao !== 'em-corte') continue;
    const nome = malhaDaExecucao(cadastro, e);
    grupos.set(nome, (grupos.get(nome) ?? 0) + e.consumoPlanejadoMm);
  }
  return [...grupos]
    .map(([nome, necessarioMm]) => {
      const malha = cadastro.malhas.find((m) => m.descricao === nome);
      const saldoMm = cadastro.rolos.filter((r) => r.malhaId === malha?.id && !r.indisponivel).reduce((s, r) => s + (estadoDoRolo(cadastro, r).saldoFisicoMm ?? 0), 0);
      const faltaMm = Math.max(0, necessarioMm - saldoMm);
      const rendimento = rendimentoDaMalha(malha);
      return { malha: nome, necessarioMm, saldoMm, faltaMm, faltaG: rendimento ? faltaMm / rendimento : null };
    })
    .sort((a, b) => b.faltaMm - a.faltaMm);
}

export function csvDaPrevisao(previsao: readonly PrevisaoDaMalha[]): string {
  const cabecalho = ['Malha', 'Necessário (m)', 'Saldo (m)', 'Falta (m)', 'Falta (kg)'];
  return textoCsv([cabecalho, ...previsao.map((p) => [p.malha, metros(p.necessarioMm), metros(p.saldoMm), metros(p.faltaMm), p.faltaG === null ? '' : numeroComVirgula(p.faltaG / 1000, 2)])]);
}

export interface ConsumoDaMalha {
  readonly malha: string;
  readonly cortes: number;
  readonly planejadoMm: number;
  readonly realMm: number;
  /** O peso do consumo real, quando a malha tem rendimento (informado ou pela gramatura). */
  readonly realG: number | null;
}

/** O consumo real por malha no período (para compras), da que mais consumiu à que menos. */
export function consumoPorMalha(cadastro: CadastroDeProducao, desdeIso?: string): ConsumoDaMalha[] {
  const grupos = new Map<string, { cortes: number; planejadoMm: number; realMm: number; realG: number | null }>();
  for (const e of concluidas(cadastro, desdeIso)) {
    const nome = malhaDaExecucao(cadastro, e);
    const g = grupos.get(nome) ?? { cortes: 0, planejadoMm: 0, realMm: 0, realG: 0 };
    g.cortes += 1;
    g.planejadoMm += e.consumoPlanejadoMm;
    g.realMm += e.consumoRealMm ?? 0;
    const malha = cadastro.malhas.find((x) => x.descricao === nome);
    const rendimento = rendimentoDaMalha(malha);
    g.realG = g.realG === null || rendimento === null ? null : g.realG + (e.consumoRealMm ?? 0) / rendimento;
    grupos.set(nome, g);
  }
  return [...grupos.entries()].map(([malha, g]) => ({ malha, ...g })).sort((a, b) => b.realMm - a.realMm);
}

// ---- Relatórios em CSV: separados por ponto e vírgula, com vírgula decimal (o padrão das planilhas em português).

const dataHora = (iso: string | undefined): string => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');
const metros = (mm: number | undefined): string => (mm === undefined ? '' : numeroComVirgula(mm / 1000, 3));

/** O histórico de todas as execuções (para auditoria), uma por linha. */
export function csvDasExecucoes(cadastro: CadastroDeProducao, nomeDoProjeto: (projetoId: string) => string): string {
  const cabecalho = [
    'Ordem',
    'Projeto',
    'Malha',
    'Situação',
    'Liberada em',
    'Liberada por',
    'Começada em',
    'Operador',
    'Concluída em',
    'Concluída por',
    'Camadas planejadas',
    'Camadas realizadas',
    'Consumo planejado (m)',
    'Consumo real (m)',
    'Diferença (%)',
    'Tempo do corte (min)',
    'Cancelada em',
    'Motivo do cancelamento',
    'Observações',
  ];
  const linhas = cadastro.execucoes.map((e) => {
    const c = comparativoDaExecucao(e);
    return [
      e.ordem,
      nomeDoProjeto(e.projetoId),
      malhaDaExecucao(cadastro, e),
      ROTULO_DA_SITUACAO[e.situacao],
      dataHora(e.liberadaEmIso),
      e.liberadaPor,
      dataHora(e.iniciadaEmIso),
      e.operador ?? '',
      dataHora(e.concluidaEmIso),
      e.concluidaPor ?? '',
      String(e.camadasPlanejadas),
      e.camadasRealizadas === undefined ? '' : String(e.camadasRealizadas),
      metros(e.consumoPlanejadoMm),
      metros(e.consumoRealMm),
      c.diferencaPercentual === null ? '' : numeroComVirgula(c.diferencaPercentual, 1),
      c.duracaoMin === null ? '' : numeroComVirgula(c.duracaoMin, 0),
      dataHora(e.canceladaEmIso),
      e.motivoDoCancelamento ?? '',
      e.observacoes ?? '',
    ];
  });
  return textoCsv([cabecalho, ...linhas]);
}

/** O consumo por malha (para compras). */
export function csvDoConsumoPorMalha(consumo: readonly ConsumoDaMalha[]): string {
  const cabecalho = ['Malha', 'Cortes', 'Consumo planejado (m)', 'Consumo real (m)', 'Consumo real (kg)'];
  const linhas = consumo.map((c) => [c.malha, String(c.cortes), metros(c.planejadoMm), metros(c.realMm), c.realG === null ? '' : numeroComVirgula(c.realG / 1000, 2)]);
  return textoCsv([cabecalho, ...linhas]);
}

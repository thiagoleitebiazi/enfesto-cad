import {
  darBaixaDoPlano,
  estadoDoRolo,
  estornarMovimento,
  MAXIMO_DE_EXECUCOES,
  movimentosDoPlano,
  type CadastroDeProducao,
  type ConsumoRealDoRolo,
  type ExecucaoDoCorte,
  type SituacaoDaExecucao,
  type UsoDoRolo,
} from './cadastroDeProducao';
import type { PlanoDeCorteV2 } from './planejamento';

/**
 * A execução do plano de corte na sala de corte (ADR 0098): o que separa o planejado do feito. O plano confirmado
 * não muda; a execução passa por liberada → em corte → concluída (ou é cancelada antes de concluir), e guarda quem
 * liberou e quem cortou (informados: o programa não tem login), as horas, as camadas enfestadas e o consumo real.
 *
 * Ao concluir um plano com rolos, a baixa do estoque passa a ser a do consumo real: a baixa planejada que já tinha
 * sido dada é estornada (o movimento fica no histórico, com o motivo) e a do real entra no lugar. Nada é apagado.
 * A sobra de um rolo pode ficar marcada como retalho: ela continua no estoque, com o saldo do rolo.
 *
 * O programa não se liga a máquina nenhuma: as horas e o consumo são os informados por quem opera.
 */

export const ROTULO_DA_SITUACAO: Readonly<Record<SituacaoDaExecucao, string>> = {
  liberada: 'Liberada para o corte',
  'em-corte': 'Em corte',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
};

/** O que a execução precisa saber do plano confirmado. */
export interface PlanoParaExecutar {
  readonly planoId: string;
  readonly projetoId: string;
  readonly ordem: string;
  readonly camadas: number;
  readonly consumoMm: number;
  /** O que o plano usa de cada rolo (vazio: o material é um peso, sem rolos). */
  readonly usos: readonly UsoDoRolo[];
}

/** O que a execução precisa do plano confirmado: as camadas, o consumo e o que ele usa de cada rolo. */
export function planoParaExecutar(plano: PlanoDeCorteV2): PlanoParaExecutar {
  return {
    planoId: plano.id,
    projetoId: plano.entrada.molde.projetoId,
    ordem: plano.entrada.ordem.codigo,
    camadas: plano.resultado.camadas,
    consumoMm: plano.resultado.consumoMm,
    usos: (plano.resultado.rolos ?? []).filter((r) => r.usadoMm > 0).map((r) => ({ roloId: r.id, comprimentoMm: r.usadoMm })),
  };
}

/** As execuções de um plano, da mais antiga à mais nova. */
export function execucoesDoPlano(cadastro: CadastroDeProducao, planoId: string): ExecucaoDoCorte[] {
  return cadastro.execucoes.filter((e) => e.planoId === planoId);
}

/** A execução que vale para o plano: a mais nova que não foi cancelada, ou `null`. */
export function execucaoAtualDoPlano(cadastro: CadastroDeProducao, planoId: string): ExecucaoDoCorte | null {
  const vivas = execucoesDoPlano(cadastro, planoId).filter((e) => e.situacao !== 'cancelada');
  return vivas.at(-1) ?? null;
}

function trocar(cadastro: CadastroDeProducao, execucao: ExecucaoDoCorte): CadastroDeProducao {
  return { ...cadastro, execucoes: cadastro.execucoes.map((e) => (e.id === execucao.id ? execucao : e)) };
}

function aExecucao(cadastro: CadastroDeProducao, execucaoId: string): ExecucaoDoCorte {
  const execucao = cadastro.execucoes.find((e) => e.id === execucaoId);
  if (!execucao) throw new Error('Esta execução do corte não está no cadastro.');
  return execucao;
}

/** Libera o plano para a sala de corte. Um plano tem uma execução que vale por vez (a cancelada não conta). */
export function liberarParaOCorte(
  cadastro: CadastroDeProducao,
  plano: PlanoParaExecutar,
  dados: { readonly responsavel: string; readonly agoraIso: string; readonly novoId: () => string },
): CadastroDeProducao {
  if (dados.responsavel.trim() === '') throw new Error('Informe quem está liberando o plano para o corte.');
  const atual = execucaoAtualDoPlano(cadastro, plano.planoId);
  if (atual) throw new Error(`Este plano já está ${atual.situacao === 'concluida' ? 'com o corte concluído' : `"${ROTULO_DA_SITUACAO[atual.situacao].toLowerCase()}"`}.`);
  if (cadastro.execucoes.length >= MAXIMO_DE_EXECUCOES) throw new Error('O registro de execuções chegou ao limite deste cadastro.');
  const nova: ExecucaoDoCorte = {
    id: dados.novoId(),
    planoId: plano.planoId,
    projetoId: plano.projetoId,
    ordem: plano.ordem,
    situacao: 'liberada',
    camadasPlanejadas: plano.camadas,
    consumoPlanejadoMm: plano.consumoMm,
    liberadaEmIso: dados.agoraIso,
    liberadaPor: dados.responsavel.trim(),
  };
  return { ...cadastro, execucoes: [...cadastro.execucoes, nova] };
}

/** O corte começa: quem corta e a hora. Só a execução liberada começa. */
export function iniciarOCorte(cadastro: CadastroDeProducao, execucaoId: string, dados: { readonly operador: string; readonly agoraIso: string }): CadastroDeProducao {
  const execucao = aExecucao(cadastro, execucaoId);
  if (execucao.situacao !== 'liberada') throw new Error(`Só um plano liberado começa o corte (este está "${ROTULO_DA_SITUACAO[execucao.situacao].toLowerCase()}").`);
  if (dados.operador.trim() === '') throw new Error('Informe quem está cortando.');
  return trocar(cadastro, { ...execucao, situacao: 'em-corte', iniciadaEmIso: dados.agoraIso, operador: dados.operador.trim() });
}

/** Cancela a liberação (antes de concluir), com o motivo. O plano pode ser liberado de novo depois. */
export function cancelarAExecucao(
  cadastro: CadastroDeProducao,
  execucaoId: string,
  dados: { readonly responsavel: string; readonly motivo: string; readonly agoraIso: string },
): CadastroDeProducao {
  const execucao = aExecucao(cadastro, execucaoId);
  if (execucao.situacao === 'concluida') throw new Error('Um corte concluído não se cancela: o estoque já saiu (estorne os movimentos, se for o caso).');
  if (execucao.situacao === 'cancelada') throw new Error('Esta execução já foi cancelada.');
  if (dados.responsavel.trim() === '') throw new Error('Informe quem está cancelando.');
  if (dados.motivo.trim() === '') throw new Error('Diga o motivo do cancelamento.');
  return trocar(cadastro, { ...execucao, situacao: 'cancelada', canceladaEmIso: dados.agoraIso, canceladaPor: dados.responsavel.trim(), motivoDoCancelamento: dados.motivo.trim() });
}

export interface ConclusaoDoCorte {
  readonly responsavel: string;
  readonly agoraIso: string;
  readonly camadasRealizadas: number;
  /** Nos planos com rolos: o consumo real de cada rolo do plano (mm) e se a sobra vira retalho. */
  readonly consumoPorRolo?: readonly { readonly roloId: string; readonly realMm: number; readonly sobraViraRetalho: boolean }[];
  /** Nos planos sem rolos (um peso de malha): o consumo real (mm). */
  readonly consumoRealMm?: number;
  readonly observacoes?: string;
  readonly novoId: () => string;
}

export interface ResultadoDaConclusao {
  readonly cadastro: CadastroDeProducao;
  /** O que a conclusão fez no estoque, por extenso. */
  readonly mensagens: readonly string[];
}

const valido = (n: number): boolean => Number.isFinite(n) && n >= 0;

/**
 * Conclui o corte com o que de fato aconteceu. Tudo ou nada: com um dado errado (ou um rolo sem saldo para o consumo
 * real), nada muda. Com rolos, a baixa do estoque fica sendo a do consumo real.
 */
export function concluirOCorte(cadastro: CadastroDeProducao, execucaoId: string, plano: PlanoParaExecutar, conclusao: ConclusaoDoCorte): ResultadoDaConclusao {
  const execucao = aExecucao(cadastro, execucaoId);
  if (execucao.situacao !== 'em-corte') throw new Error(`Só um corte em andamento é concluído (este está "${ROTULO_DA_SITUACAO[execucao.situacao].toLowerCase()}").`);
  if (conclusao.responsavel.trim() === '') throw new Error('Informe quem está concluindo o corte.');
  if (!Number.isInteger(conclusao.camadasRealizadas) || conclusao.camadasRealizadas < 1) {
    throw new Error('As camadas enfestadas precisam ser um número inteiro de 1 para cima (sem nenhuma, cancele a execução).');
  }
  const mensagens: string[] = [];
  let atual = cadastro;
  let consumoPorRolo: ConsumoRealDoRolo[] | undefined;
  let consumoRealMm: number;

  if (plano.usos.length > 0) {
    const informados = conclusao.consumoPorRolo ?? [];
    consumoPorRolo = plano.usos.map((uso) => {
      const informado = informados.find((c) => c.roloId === uso.roloId);
      const rolo = cadastro.rolos.find((r) => r.id === uso.roloId);
      const nome = rolo?.identificacao ?? uso.roloId;
      if (!informado) throw new Error(`Falta o consumo real do rolo ${nome}.`);
      if (!valido(informado.realMm)) throw new Error(`O consumo real do rolo ${nome} precisa ser um número de 0 para cima.`);
      return { roloId: uso.roloId, planejadoMm: uso.comprimentoMm, realMm: informado.realMm, sobraViraRetalho: informado.sobraViraRetalho };
    });
    consumoRealMm = consumoPorRolo.reduce((s, c) => s + c.realMm, 0);

    // A baixa planejada já dada sai (estorno, com o motivo), e a do consumo real entra.
    const baixasAtivas = movimentosDoPlano(atual, plano.planoId).filter((m) => m.tipo === 'baixa' && m.ativo);
    for (const baixa of baixasAtivas) {
      atual = estornarMovimento(atual, baixa.id, {
        responsavel: conclusao.responsavel,
        motivo: 'Trocada pela baixa do consumo real (execução do corte).',
        agoraIso: conclusao.agoraIso,
        novoId: conclusao.novoId,
      });
    }
    if (baixasAtivas.length > 0) mensagens.push(`A baixa planejada (${baixasAtivas.length} rolo(s)) foi estornada e trocada pela do consumo real.`);
    const baixa = darBaixaDoPlano(
      atual,
      consumoPorRolo.filter((c) => c.realMm > 0).map((c) => ({ roloId: c.roloId, comprimentoMm: c.realMm })),
      { planoId: plano.planoId, projetoId: plano.projetoId, responsavel: conclusao.responsavel, agoraIso: conclusao.agoraIso, novoId: conclusao.novoId, motivo: 'Consumo real (execução do corte).' },
    );
    atual = baixa.cadastro;
    if (baixa.feitos.length > 0) mensagens.push(`Baixa do consumo real: ${baixa.feitos.join(', ')}.`);

    // O rolo reservado que o corte não usou: a reserva sai (senão ele ficaria preso a este plano para sempre).
    const naoUsados = new Set(consumoPorRolo.filter((c) => c.realMm === 0).map((c) => c.roloId));
    const reservasSobrando = movimentosDoPlano(atual, plano.planoId).filter((m) => m.tipo === 'reserva' && m.ativo && naoUsados.has(m.roloId));
    for (const reserva of reservasSobrando) {
      atual = estornarMovimento(atual, reserva.id, {
        responsavel: conclusao.responsavel,
        motivo: 'O rolo não foi usado no corte (execução do corte).',
        agoraIso: conclusao.agoraIso,
        novoId: conclusao.novoId,
      });
    }
    if (reservasSobrando.length > 0) mensagens.push(`A reserva de ${reservasSobrando.length} rolo(s) não usado(s) no corte foi estornada.`);

    // A sobra que vira retalho: o rolo fica marcado (continua no estoque, com o saldo que sobrou).
    const retalhos: string[] = [];
    atual = {
      ...atual,
      rolos: atual.rolos.map((rolo) => {
        const consumo = consumoPorRolo!.find((c) => c.roloId === rolo.id);
        if (!consumo?.sobraViraRetalho) return rolo;
        const saldo = estadoDoRolo(atual, rolo).saldoFisicoMm;
        if (saldo !== null && saldo <= 0) return rolo;
        retalhos.push(rolo.identificacao);
        return { ...rolo, retalho: true };
      }),
    };
    if (retalhos.length > 0) mensagens.push(`Sobra guardada como retalho: ${retalhos.join(', ')}.`);
  } else {
    if (conclusao.consumoRealMm === undefined || !valido(conclusao.consumoRealMm) || conclusao.consumoRealMm === 0) {
      throw new Error('Informe o consumo real de malha (maior que zero).');
    }
    consumoRealMm = conclusao.consumoRealMm;
    mensagens.push('O plano usa um peso de malha, sem rolos: não há baixa por rolo no estoque.');
  }

  const concluida: ExecucaoDoCorte = {
    ...execucao,
    situacao: 'concluida',
    concluidaEmIso: conclusao.agoraIso,
    concluidaPor: conclusao.responsavel.trim(),
    camadasRealizadas: conclusao.camadasRealizadas,
    consumoRealMm,
    ...(consumoPorRolo ? { consumoPorRolo } : {}),
    ...(conclusao.observacoes && conclusao.observacoes.trim() !== '' ? { observacoes: conclusao.observacoes.trim() } : {}),
  };
  return { cadastro: trocar(atual, concluida), mensagens };
}

/** O planejado ao lado do executado, com as diferenças. */
export interface ComparativoDaExecucao {
  readonly camadasPlanejadas: number;
  readonly camadasRealizadas: number | null;
  readonly consumoPlanejadoMm: number;
  readonly consumoRealMm: number | null;
  /** Real − planejado (mm): positivo, gastou-se mais que o planejado. */
  readonly diferencaMm: number | null;
  readonly diferencaPercentual: number | null;
  readonly consumoPorCamadaPlanejadoMm: number | null;
  readonly consumoPorCamadaRealMm: number | null;
  /** Do início à conclusão do corte (minutos), pelas horas registradas. */
  readonly duracaoMin: number | null;
}

export function comparativoDaExecucao(execucao: ExecucaoDoCorte): ComparativoDaExecucao {
  const real = execucao.consumoRealMm ?? null;
  const camadas = execucao.camadasRealizadas ?? null;
  const diferenca = real === null ? null : real - execucao.consumoPlanejadoMm;
  const inicio = execucao.iniciadaEmIso ? Date.parse(execucao.iniciadaEmIso) : NaN;
  const fim = execucao.concluidaEmIso ? Date.parse(execucao.concluidaEmIso) : NaN;
  return {
    camadasPlanejadas: execucao.camadasPlanejadas,
    camadasRealizadas: camadas,
    consumoPlanejadoMm: execucao.consumoPlanejadoMm,
    consumoRealMm: real,
    diferencaMm: diferenca,
    diferencaPercentual: diferenca === null || execucao.consumoPlanejadoMm <= 0 ? null : (diferenca / execucao.consumoPlanejadoMm) * 100,
    consumoPorCamadaPlanejadoMm: execucao.camadasPlanejadas > 0 ? execucao.consumoPlanejadoMm / execucao.camadasPlanejadas : null,
    consumoPorCamadaRealMm: real !== null && camadas !== null && camadas > 0 ? real / camadas : null,
    duracaoMin: Number.isFinite(inicio) && Number.isFinite(fim) && fim >= inicio ? (fim - inicio) / 60_000 : null,
  };
}

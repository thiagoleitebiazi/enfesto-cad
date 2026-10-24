import { espessurasFisicasPorCamada, type TipoDeEnfesto } from './enfesto';
import { gerarComposicoes, gradesDasComposicoes, type Composicao } from './composicaoDeRiscos';
import type { EstimativaDeCustoDoTecido } from './custoDoTecido';
import type { ModeloDoPlano } from './modeloDoPlano';
import type { PlanoDeCorte } from './planoDeCorte';
import {
  calcularPlanejamento,
  CRITERIOS,
  escolherAlternativas,
  type AjustesDoPlanejamento,
  type AlertaDoPlanejamento,
  type CalculoDoPlanejamento,
  type CamadasDoRisco,
  type ConfiguracaoDoPlanejamento,
  type Criterio,
  type EntradaDoPlanejamento,
  type ResultadoDoPlanejamento,
  type RiscoDoPlanejamento,
} from './planoDeEnfesto';
import type { Projeto } from './projeto';
import { METODO_DO_RISCO, pecasDaGrade, type GradeDoRisco, type PecaDoRisco, type RiscoGerado } from './risco';

/**
 * O planejamento de corte de ponta a ponta: as composições a avaliar, os riscos a fazer, as alternativas
 * comparáveis, e o plano guardado no projeto — rascunho (muda à vontade) ou confirmado (fica como foi: nunca é
 * recalculado nem mudado; um plano novo a partir dele é sempre outro plano).
 */

export type SituacaoDoPlano = 'rascunho' | 'confirmado';
export type EstrategiaDoPlano = Criterio | 'risco-da-mesa' | 'risco-informado';

export const ROTULO_DA_ESTRATEGIA: Readonly<Record<EstrategiaDoPlano, string>> = {
  'menor-consumo': CRITERIOS['menor-consumo'].rotulo,
  'menos-enfestos': CRITERIOS['menos-enfestos'].rotulo,
  equilibrada: CRITERIOS.equilibrada.rotulo,
  'risco-da-mesa': 'Risco da mesa (o encaixe que está no projeto)',
  'risco-informado': 'Risco informado à mão',
};

/** Como os riscos foram feitos (guardado no plano, para dizer depois o que foi tentado). */
export interface BuscaDosRiscos {
  readonly metodo: string;
  readonly composicoesAvaliadas: number;
  readonly riscosFeitos: number;
  readonly riscosQueNaoSairam: ReadonlyArray<{ readonly grade: GradeDoRisco; readonly motivo: string }>;
  /** Riscos que nem foram tentados, porque o tempo da busca acabou. */
  readonly riscosSemTempo: number;
  readonly tempoMs: number;
}

export interface AjusteRegistrado {
  readonly campo: string;
  readonly sugerido: number;
  readonly escolhido: number;
}

export interface PlanoDeCorteV2 {
  readonly versaoDoCalculo: 2;
  readonly id: string;
  readonly criadoEmIso: string;
  readonly atualizadoEmIso: string;
  readonly situacao: SituacaoDoPlano;
  readonly confirmadoEmIso?: string;
  /** Digitado por quem planeja (o programa não tem login): é o que foi informado, não uma identificação conferida. */
  readonly responsavel: string;
  readonly entrada: EntradaDoPlanejamento;
  readonly configuracao: ConfiguracaoDoPlanejamento;
  readonly estrategia: EstrategiaDoPlano;
  /** O critério que escolheu esta alternativa, por extenso. */
  readonly criterio: string;
  readonly origemDaComposicao: string;
  readonly riscos: readonly RiscoDoPlanejamento[];
  /** As camadas de cada risco como a composição sugeriu (antes dos ajustes). */
  readonly composicaoSugerida: readonly CamadasDoRisco[];
  readonly ajustes: AjustesDoPlanejamento;
  readonly ajustesFeitos: readonly AjusteRegistrado[];
  readonly resultado: ResultadoDoPlanejamento;
  readonly alertas: readonly AlertaDoPlanejamento[];
  readonly premissas: readonly string[];
  readonly busca: BuscaDosRiscos | null;
  /** O plano confirmado anterior da mesma ordem, que este substitui (ele continua guardado). */
  readonly substituiPlanoId?: string;
  /** O plano de que este foi copiado ("duplicar" ou "recalcular como novo"). */
  readonly copiaDePlanoId?: string;
  /**
   * A estimativa do custo do tecido, como saiu ao guardar o plano (com o custo e a malha de então): não é refeita
   * depois. Ausente nos planos de antes dela, que continuam sem estimativa.
   */
  readonly custoDoTecido?: EstimativaDeCustoDoTecido;
}

/** Um plano no projeto: os da primeira versão do cálculo (um risco só) continuam como foram guardados. */
export type PlanoGuardado = PlanoDeCorte | PlanoDeCorteV2;

export function ehPlanoV2(plano: PlanoGuardado): plano is PlanoDeCorteV2 {
  return plano.versaoDoCalculo === 2;
}

const daOrdem = (p: PlanoGuardado): string => p.entrada.ordem.codigo.trim().toLocaleLowerCase('pt-BR');
const confirmado = (p: PlanoGuardado): boolean => !ehPlanoV2(p) || p.situacao === 'confirmado';

/** Guarda (ou troca) o rascunho. Um plano confirmado não volta a ser rascunho nem muda. */
export function guardarRascunho(projeto: Projeto, plano: PlanoDeCorteV2, agoraIso: string): Projeto {
  if (plano.situacao !== 'rascunho') throw new Error('Só um rascunho é guardado assim.');
  const existentes = projeto.planosDeCorte ?? [];
  const antes = existentes.find((p) => p.id === plano.id);
  if (antes && confirmado(antes)) throw new Error('Este plano já foi confirmado: ele não muda. Use "Duplicar como novo".');
  const guardado = { ...plano, atualizadoEmIso: agoraIso };
  const planosDeCorte = antes ? existentes.map((p) => (p.id === plano.id ? guardado : p)) : [...existentes, guardado];
  return { ...projeto, planosDeCorte, modificadoEmIso: agoraIso };
}

/**
 * Confirma o plano: ele passa a valer como foi calculado, com a hora e o responsável, e não muda mais. Se era um
 * rascunho guardado, o rascunho vira ele. O plano confirmado anterior da mesma ordem continua guardado, e o novo
 * diz qual substitui.
 */
export function confirmarPlano(projeto: Projeto, plano: PlanoDeCorteV2, agoraIso: string): Projeto {
  if (plano.responsavel.trim() === '') throw new Error('Informe o responsável pelo plano.');
  const existentes = projeto.planosDeCorte ?? [];
  const antes = existentes.find((p) => p.id === plano.id);
  if (antes && confirmado(antes)) throw new Error('Este plano já foi confirmado.');
  const anterior = [...existentes].reverse().find((p) => p.id !== plano.id && confirmado(p) && daOrdem(p) === daOrdem(plano));
  const confirmadoAgora: PlanoDeCorteV2 = {
    ...plano,
    situacao: 'confirmado',
    confirmadoEmIso: agoraIso,
    atualizadoEmIso: agoraIso,
    ...(anterior ? { substituiPlanoId: anterior.id } : {}),
  };
  const planosDeCorte = antes ? existentes.map((p) => (p.id === plano.id ? confirmadoAgora : p)) : [...existentes, confirmadoAgora];
  return { ...projeto, planosDeCorte, modificadoEmIso: agoraIso };
}

/** Tira um rascunho. Plano confirmado não sai (é o histórico). */
export function removerRascunho(projeto: Projeto, id: string, agoraIso: string): Projeto {
  const existentes = projeto.planosDeCorte ?? [];
  const plano = existentes.find((p) => p.id === id);
  if (!plano) throw new Error('Este plano não está no projeto.');
  if (confirmado(plano)) throw new Error('Plano confirmado não é apagado: ele é o histórico do que foi planejado.');
  return { ...projeto, planosDeCorte: existentes.filter((p) => p.id !== id), modificadoEmIso: agoraIso };
}

/** Um rascunho novo a partir de um plano (o original fica como está). */
export function copiaComoRascunho(plano: PlanoDeCorteV2, novoId: string, agoraIso: string): PlanoDeCorteV2 {
  const copia: { -readonly [K in keyof PlanoDeCorteV2]: PlanoDeCorteV2[K] } = { ...plano, id: novoId, criadoEmIso: agoraIso, atualizadoEmIso: agoraIso, situacao: 'rascunho', copiaDePlanoId: plano.id };
  delete copia.confirmadoEmIso;
  delete copia.substituiPlanoId;
  return copia;
}

// ---- A busca: as composições e os riscos a fazer

export interface PedidoDeRisco {
  readonly chave: string;
  readonly grade: GradeDoRisco;
  readonly pecas: readonly PecaDoRisco[];
}

/** O pedido da ordem nos tamanhos do molde (o que a ordem pede de tamanho que o molde não tem fica de fora: é erro à parte). */
export function pedidoNoModelo(modelo: ModeloDoPlano, quantidades: Readonly<Record<string, number>>): Record<string, number> {
  return Object.fromEntries(modelo.tamanhos.map((t) => [t, Math.max(0, quantidades[t] ?? 0)]));
}

/** As composições candidatas e os riscos que elas pedem (os da grade proporcional primeiro: se o tempo acabar, eles já foram feitos). */
export function prepararBusca(
  modelo: ModeloDoPlano,
  quantidadesPorRoupa: Readonly<Record<string, number>>,
  quantidadesDaOrdem: Readonly<Record<string, number>>,
  tipoDeEnfesto: TipoDeEnfesto,
  roupasPorRiscoMax: number,
): { readonly composicoes: Composicao[]; readonly pedidos: PedidoDeRisco[] } {
  const composicoes = gerarComposicoes(pedidoNoModelo(modelo, quantidadesDaOrdem), modelo.tamanhos, espessurasFisicasPorCamada(tipoDeEnfesto), roupasPorRiscoMax);
  const pedidos = gradesDasComposicoes(composicoes).map((g) => ({ chave: g.chave, grade: g.grade, pecas: pecasDaGrade(modelo, g.grade, quantidadesPorRoupa) }));
  return { composicoes, pedidos };
}

export function riscoGeradoNoPlano(chave: string, risco: RiscoGerado): RiscoDoPlanejamento {
  return {
    chave,
    grade: risco.grade,
    origem: 'gerado',
    comprimentoMm: risco.comprimentoMm,
    larguraMm: risco.larguraOcupadaMm,
    larguraDoRiscoMm: risco.larguraDoRiscoMm,
    areaDasPecasMm2: risco.areaDasPecasMm2,
    eficienciaPercentual: risco.eficienciaPercentual,
    pecas: risco.pecas,
    ...(risco.casamento ? { casamento: risco.casamento } : {}),
    ...(risco.blocosDosGrupos ? { blocosDosGrupos: risco.blocosDosGrupos } : {}),
  };
}

export interface AlternativaDoPlano {
  readonly criterios: readonly Criterio[];
  readonly composicao: Composicao;
  readonly calculo: Extract<CalculoDoPlanejamento, { ok: true }>;
}

export interface AlternativasMontadas {
  readonly alternativas: readonly AlternativaDoPlano[];
  readonly avaliadas: number;
  /** As composições que ficaram de fora, e por quê (risco que não saiu, ou sem tempo). */
  readonly descartadas: ReadonlyArray<{ readonly origem: string; readonly motivo: string }>;
  /** Quando nenhuma composição calcula pelo mesmo motivo (falta um dado, rolos incompatíveis): esses erros. */
  readonly errosComuns: readonly string[];
}

/** Avalia cada composição com os riscos feitos e escolhe as alternativas pelos três critérios. */
export function montarAlternativas(
  entrada: EntradaDoPlanejamento,
  composicoes: readonly Composicao[],
  riscosFeitos: ReadonlyMap<string, RiscoDoPlanejamento>,
  naoSairam: ReadonlyMap<string, string>,
  configuracao: ConfiguracaoDoPlanejamento,
): AlternativasMontadas {
  const avaliadas: { composicao: Composicao; calculo: Extract<CalculoDoPlanejamento, { ok: true }> }[] = [];
  const descartadas: { origem: string; motivo: string }[] = [];
  const errosDasQueCalcularam: string[][] = [];
  for (const composicao of composicoes) {
    const faltando = composicao.riscos.find((r) => !riscosFeitos.has(r.chave));
    if (faltando) {
      descartadas.push({ origem: composicao.origem, motivo: naoSairam.get(faltando.chave) ?? 'um dos riscos não foi feito (o tempo da busca acabou).' });
      continue;
    }
    const riscos = composicao.riscos.map((r) => riscosFeitos.get(r.chave)!);
    const calculo = calcularPlanejamento(entrada, riscos, composicao.riscos.map((r) => ({ chave: r.chave, camadas: r.camadas })), configuracao);
    if (calculo.ok) avaliadas.push({ composicao, calculo });
    else {
      errosDasQueCalcularam.push([...calculo.erros]);
      descartadas.push({ origem: composicao.origem, motivo: calculo.erros[0] ?? 'não calculou.' });
    }
  }
  const escolhidas = escolherAlternativas(avaliadas.map((a) => ({ consumoMm: a.calculo.resultado.consumoMm, enfestos: a.calculo.resultado.enfestos.length })));
  const porIndice = new Map<number, Criterio[]>();
  if (escolhidas) for (const criterio of ['menor-consumo', 'menos-enfestos', 'equilibrada'] as const) porIndice.set(escolhidas[criterio], [...(porIndice.get(escolhidas[criterio]) ?? []), criterio]);
  const alternativas = [...porIndice].map(([i, criterios]) => ({ criterios, composicao: avaliadas[i]!.composicao, calculo: avaliadas[i]!.calculo }));
  const primeira = errosDasQueCalcularam[0];
  const errosComuns =
    avaliadas.length === 0 && primeira && errosDasQueCalcularam.every((e) => JSON.stringify(e) === JSON.stringify(primeira)) ? primeira : [];
  return { alternativas, avaliadas: avaliadas.length, descartadas, errosComuns };
}

/** O que foi tentado na busca, para guardar no plano. */
export function resumoDaBusca(
  composicoesAvaliadas: number,
  feitos: number,
  naoSairam: ReadonlyMap<string, string>,
  grades: ReadonlyMap<string, GradeDoRisco>,
  semTempo: number,
  tempoMs: number,
): BuscaDosRiscos {
  return {
    metodo: METODO_DO_RISCO,
    composicoesAvaliadas,
    riscosFeitos: feitos,
    riscosQueNaoSairam: [...naoSairam].map(([chave, motivo]) => ({ grade: grades.get(chave) ?? {}, motivo })),
    riscosSemTempo: semTempo,
    tempoMs,
  };
}

/** Os ajustes que de fato mudaram a sugestão (os iguais a ela não contam), para guardar ao lado dos valores finais. */
export function ajustesRegistrados(args: {
  readonly sugerido: ResultadoDoPlanejamento;
  readonly ajustes: AjustesDoPlanejamento;
  readonly quantidades: ReadonlyArray<{ readonly nome: string; readonly sugerida: number; readonly escolhida: number }>;
  readonly larguraDoRisco: { readonly sugerida: number; readonly escolhida: number };
}): AjusteRegistrado[] {
  const feitos: AjusteRegistrado[] = [];
  for (const q of args.quantidades) if (q.sugerida !== q.escolhida) feitos.push({ campo: `quantidade por roupa: ${q.nome}`, sugerido: q.sugerida, escolhido: q.escolhida });
  if (Math.abs(args.larguraDoRisco.sugerida - args.larguraDoRisco.escolhida) > 0.5) {
    feitos.push({ campo: 'largura do risco (mm)', sugerido: args.larguraDoRisco.sugerida, escolhido: args.larguraDoRisco.escolhida });
  }
  for (const r of args.sugerido.riscos) {
    const escolhido = args.ajustes.camadasPorRisco?.[r.chave];
    if (escolhido !== undefined && escolhido !== r.camadas) feitos.push({ campo: `camadas do risco ${r.chave}`, sugerido: r.camadas, escolhido });
  }
  const capSugerido = Math.min(...args.sugerido.riscos.map((r) => r.camadasPorEnfestoMax));
  if (args.ajustes.camadasPorEnfesto !== undefined && args.ajustes.camadasPorEnfesto !== capSugerido) {
    feitos.push({ campo: 'camadas por enfesto', sugerido: capSugerido, escolhido: args.ajustes.camadasPorEnfesto });
  }
  if (args.ajustes.comprimentoDaMesaMm !== undefined && Math.abs(args.ajustes.comprimentoDaMesaMm - args.sugerido.mesa.comprimentoSugeridoMm) > 0.5) {
    feitos.push({ campo: 'comprimento da mesa (mm)', sugerido: args.sugerido.mesa.comprimentoSugeridoMm, escolhido: args.ajustes.comprimentoDaMesaMm });
  }
  return feitos;
}

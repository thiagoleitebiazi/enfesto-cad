import type { Molde } from './molde';
import type { Projeto } from './projeto';
import { area, retanguloEnvolvente } from '../core/geometria';
import { ROTULO_DO_TIPO } from './enfesto';
import { ROTULO_DO_STATUS } from './projeto';

/**
 * Relatório de produção (seção 12 do escopo). Calculado a partir do estado
 * ATUAL do projeto (não de um resultado de nesting guardado à parte) — o
 * aproveitamento/consumo são propriedades da disposição geométrica real das
 * peças no momento, sejam elas posicionadas manualmente, semiautomaticamente
 * ou pelo motor automático (Etapa 7); calcular na hora evita duplicar/
 * desatualizar um "último resultado" guardado separadamente.
 */

export interface LinhaDePecasPorTamanho {
  readonly tamanho: string;
  readonly quantidadeDeModelos: number;
  readonly quantidadeTotal: number;
  /** Peso estimado de tecido para cortar todas as peças deste tamanho (null sem gramatura configurada). */
  readonly pesoEstimadoKg: number | null;
}

export interface RelatorioDeProducao {
  readonly codigoDoProjeto: string;
  readonly nomeDoProjeto: string;
  readonly referencias: readonly string[];
  readonly tecidoNome: string;
  readonly larguraTotalMm: number | null;
  readonly larguraUtilMm: number | null;
  readonly comprimentoConfiguradoMm: number | null;
  readonly tipoDeEnfesto: string | null;
  readonly quantidadeDeCamadas: number | null;
  readonly pecasPorTamanho: readonly LinhaDePecasPorTamanho[];
  readonly comprimentoUtilizadoMm: number;
  readonly areaOcupadaMm2: number;
  readonly aproveitamentoPercentual: number | null;
  readonly desperdicioPercentual: number | null;
  /** Gramatura do tecido configurado (g/m²), null se não informada. */
  readonly gramaturaGm2: number | null;
  /** Estoque de tecido disponível para o projeto (kg), null se não informado. */
  readonly quantidadeDisponivelKg: number | null;
  /** Peso estimado de tecido para cortar TODAS as peças do projeto (null sem gramatura configurada). */
  readonly pesoTotalEstimadoKg: number | null;
  /** Quantos conjuntos iguais ao projeto atual cabem no estoque informado (null sem gramatura e/ou estoque). */
  readonly rendimentoLotes: number | null;
  readonly dataIso: string;
  readonly versaoDoEncaixe: number;
  readonly status: string;
}

/** Peso de tecido (kg) para uma área em mm², dada a gramatura em g/m². */
function pesoEmKg(areaMm2: number, gramaturaGm2: number): number {
  const areaM2 = areaMm2 / 1_000_000;
  return (areaM2 * gramaturaGm2) / 1000;
}

function agruparPorTamanho(pecas: readonly Molde[], gramaturaGm2: number | null): LinhaDePecasPorTamanho[] {
  const porTamanho = new Map<string, { modelos: number; total: number; areaTotalMm2: number }>();
  for (const peca of pecas) {
    const atual = porTamanho.get(peca.tamanho) ?? { modelos: 0, total: 0, areaTotalMm2: 0 };
    atual.modelos += 1;
    atual.total += peca.quantidade;
    atual.areaTotalMm2 += area(peca.contorno) * peca.quantidade;
    porTamanho.set(peca.tamanho, atual);
  }
  return [...porTamanho.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tamanho, dados]) => ({
      tamanho,
      quantidadeDeModelos: dados.modelos,
      quantidadeTotal: dados.total,
      pesoEstimadoKg: gramaturaGm2 !== null ? pesoEmKg(dados.areaTotalMm2, gramaturaGm2) : null,
    }));
}

export function gerarRelatorioDeProducao(projeto: Projeto, agoraIso: string): RelatorioDeProducao {
  const { pecas, tecido, enfesto } = projeto.estadoAtual;

  const comprimentoUtilizadoMm =
    pecas.length === 0 ? 0 : Math.max(...pecas.map((p) => retanguloEnvolvente(p.contorno).maxY));
  const areaOcupadaMm2 = pecas.reduce((soma, p) => soma + area(p.contorno) * p.quantidade, 0);

  const larguraUtilMm = enfesto?.larguraUtilMm ?? null;
  const areaDisponivelMm2 = larguraUtilMm !== null ? larguraUtilMm * comprimentoUtilizadoMm : 0;
  const aproveitamentoPercentual = areaDisponivelMm2 > 0 ? (areaOcupadaMm2 / areaDisponivelMm2) * 100 : null;
  const desperdicioPercentual = aproveitamentoPercentual !== null ? 100 - aproveitamentoPercentual : null;

  const referencias = [...new Set(pecas.map((p) => p.referencia).filter((r) => r.trim() !== ''))];
  const versaoDoEncaixe = projeto.historico.filter((e) => e.tipo === 'execucao-de-nesting').length;

  const gramaturaGm2 = tecido?.gramaturaGm2 ?? null;
  const quantidadeDisponivelKg = tecido?.quantidadeDisponivelKg ?? null;
  const pesoTotalEstimadoKg = gramaturaGm2 !== null ? pesoEmKg(areaOcupadaMm2, gramaturaGm2) : null;
  const rendimentoLotes =
    pesoTotalEstimadoKg !== null && quantidadeDisponivelKg !== null && pesoTotalEstimadoKg > 0
      ? Math.floor(quantidadeDisponivelKg / pesoTotalEstimadoKg)
      : null;

  return {
    codigoDoProjeto: projeto.codigo,
    nomeDoProjeto: projeto.nome,
    referencias,
    tecidoNome: tecido?.nome ?? 'não configurado',
    larguraTotalMm: tecido?.larguraTotalMm ?? null,
    larguraUtilMm,
    comprimentoConfiguradoMm: enfesto?.comprimentoMm ?? null,
    tipoDeEnfesto: enfesto ? ROTULO_DO_TIPO[enfesto.tipo] : null,
    quantidadeDeCamadas: enfesto?.quantidadeDeCamadas ?? null,
    pecasPorTamanho: agruparPorTamanho(pecas, gramaturaGm2),
    comprimentoUtilizadoMm,
    areaOcupadaMm2,
    aproveitamentoPercentual,
    desperdicioPercentual,
    gramaturaGm2,
    quantidadeDisponivelKg,
    pesoTotalEstimadoKg,
    rendimentoLotes,
    dataIso: agoraIso,
    versaoDoEncaixe,
    status: ROTULO_DO_STATUS[projeto.status],
  };
}

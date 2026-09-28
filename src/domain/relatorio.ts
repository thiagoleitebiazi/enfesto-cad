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
  readonly dataIso: string;
  readonly versaoDoEncaixe: number;
  readonly status: string;
}

function agruparPorTamanho(pecas: readonly Molde[]): LinhaDePecasPorTamanho[] {
  const porTamanho = new Map<string, { modelos: number; total: number }>();
  for (const peca of pecas) {
    const atual = porTamanho.get(peca.tamanho) ?? { modelos: 0, total: 0 };
    atual.modelos += 1;
    atual.total += peca.quantidade;
    porTamanho.set(peca.tamanho, atual);
  }
  return [...porTamanho.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([tamanho, dados]) => ({ tamanho, quantidadeDeModelos: dados.modelos, quantidadeTotal: dados.total }));
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
    pecasPorTamanho: agruparPorTamanho(pecas),
    comprimentoUtilizadoMm,
    areaOcupadaMm2,
    aproveitamentoPercentual,
    desperdicioPercentual,
    dataIso: agoraIso,
    versaoDoEncaixe,
    status: ROTULO_DO_STATUS[projeto.status],
  };
}

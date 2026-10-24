import type { BibliotecaDeMateriais, CategoriaDoMaterial, PadroesDeCusto } from './materiais';
import { problemaDosPadroes, ROTULO_DA_UNIDADE } from './materiais';
import { consumoDoItem, consumoEscrito, lerFichaTecnica, tempoTotalDasOperacoes, ultimaAprovacao, type EncaixeParaConsumo, type FichaTecnica } from './fichaTecnica';
import { encaixeParaConsumo } from './fichaTecnica';
import type { Projeto } from './projeto';
import { numeroComVirgula } from '../core/numeros';
import { textoCsv } from '../core/csv';

/**
 * O pré-custo do modelo (ADR 0106): o custo de uma peça pronta antes de produzir — os materiais da ficha técnica
 * (o consumo de cada um × o preço da biblioteca, ou o digitado), a mão de obra (o tempo da sequência operacional × o
 * custo do minuto) e os custos indiretos (% sobre o direto) — e o preço sugerido pelo markup: o custo ÷ (100% −
 * impostos − comissão − margem). O simulador de meta diz, para um custo ou um preço-alvo, quanto falta e o que
 * mudar para chegar lá (cada caminho sozinho).
 *
 * O que não tem preço ou consumo não é tomado por zero: o custo sai parcial, e a lista do que falta diz o quê.
 */

export type GrupoDaLinha = CategoriaDoMaterial | 'mao-de-obra';

export const ROTULO_DO_GRUPO_DA_LINHA: Readonly<Record<GrupoDaLinha, string>> = {
  tecido: 'Tecido',
  aviamento: 'Aviamentos',
  embalagem: 'Embalagem',
  outro: 'Outros',
  'mao-de-obra': 'Mão de obra',
};

export interface LinhaDoPreCusto {
  readonly grupo: GrupoDaLinha;
  readonly descricao: string;
  readonly aplicacao: string;
  /** "0,735 m", "6 un", "4,30 min". */
  readonly consumo: string;
  readonly quantidade: number | null;
  readonly precoUnitario: number | null;
  /** "R$ 38,90/kg". */
  readonly preco: string;
  readonly valor: number | null;
  readonly origemDoPreco: 'biblioteca' | 'informado' | 'sem preço' | 'material removido' | 'padrões';
  readonly itemId?: string;
}

export interface PreCusto {
  readonly linhas: readonly LinhaDoPreCusto[];
  readonly padroes: PadroesDeCusto;
  /** Os padrões são os da empresa (a biblioteca), e não os próprios da ficha. */
  readonly padroesDaEmpresa: boolean;
  readonly materiais: number;
  readonly tempoMin: number;
  readonly maoDeObra: number;
  readonly custoDireto: number;
  readonly indiretos: number;
  readonly custoTotal: number;
  /** `null`: impostos + comissão + margem chegam a 100%. */
  readonly precoSugerido: number | null;
  readonly markup: number | null;
  /** O que sai do preço sugerido (R$). */
  readonly impostos: number | null;
  readonly comissao: number | null;
  readonly margem: number | null;
  readonly faltando: readonly string[];
  readonly completo: boolean;
  /** O custo da última aprovação da ficha, para comparar (R$). */
  readonly custoAprovado: number | null;
}

/** Em reais, com o meio centavo para cima (22,495 → 22,50), sem o erro da conta com vírgula flutuante. */
export const centavos = (v: number): number => Math.round(v * 100 + 1e-6) / 100;
const reais = (v: number): string => `R$ ${numeroComVirgula(centavos(v), 2)}`;

/** Os padrões de custo da ficha: os próprios dela, ou os da empresa. */
export function padroesDaFicha(ficha: FichaTecnica, biblioteca: BibliotecaDeMateriais): { readonly padroes: PadroesDeCusto; readonly daEmpresa: boolean } {
  return ficha.padroesDeCusto ? { padroes: ficha.padroesDeCusto, daEmpresa: false } : { padroes: biblioteca.padroesDeCusto, daEmpresa: true };
}

export function calcularPreCusto(ficha: FichaTecnica, biblioteca: BibliotecaDeMateriais, encaixe: EncaixeParaConsumo | null): PreCusto {
  const { padroes, daEmpresa } = padroesDaFicha(ficha, biblioteca);
  const faltando: string[] = [];
  const linhas: LinhaDoPreCusto[] = [];
  for (const item of ficha.materiais) {
    const material = item.materialId ? biblioteca.materiais.find((m) => m.id === item.materialId) : undefined;
    const removido = item.materialId !== null && !material;
    const consumo = consumoDoItem(item, material, encaixe);
    if (consumo.erro) faltando.push(`${item.descricao}: ${consumo.erro}`);
    const precoUnitario = material ? material.precoPorUnidade : removido ? null : (item.precoInformado ?? null);
    const origemDoPreco: LinhaDoPreCusto['origemDoPreco'] = removido ? 'material removido' : precoUnitario === null ? 'sem preço' : material ? 'biblioteca' : 'informado';
    if (removido) faltando.push(`${item.descricao}: o material saiu da biblioteca (escolha outro, ou digite o preço).`);
    else if (precoUnitario === null) faltando.push(`${item.descricao}: sem preço${material ? ' na biblioteca' : ''}.`);
    // O material da biblioteca em outra unidade que a do item não se multiplica (seria somar metro com quilo).
    const unidadeConfere = !material || material.unidade === item.unidade;
    if (!unidadeConfere) faltando.push(`${item.descricao}: o item está em ${ROTULO_DA_UNIDADE[item.unidade]} e o preço da biblioteca é por ${ROTULO_DA_UNIDADE[material.unidade]}.`);
    const valor = consumo.quantidade !== null && precoUnitario !== null && unidadeConfere ? consumo.quantidade * precoUnitario : null;
    linhas.push({
      grupo: material?.categoria ?? 'outro',
      descricao: item.descricao,
      aplicacao: item.aplicacao,
      consumo: consumoEscrito(consumo.quantidade, item.unidade),
      quantidade: consumo.quantidade,
      precoUnitario,
      preco: precoUnitario === null ? '—' : `${reais(precoUnitario)}/${ROTULO_DA_UNIDADE[material?.unidade ?? item.unidade]}`,
      valor,
      origemDoPreco,
      itemId: item.id,
    });
  }
  if (ficha.materiais.length === 0) faltando.push('A ficha não tem materiais (aba Materiais).');
  const tempoMin = tempoTotalDasOperacoes(ficha.operacoes);
  let maoDeObra = 0;
  if (ficha.operacoes.length === 0) faltando.push('A ficha não tem a sequência operacional (aba Operações): a mão de obra fica de fora.');
  else if (padroes.custoDoMinuto === null) faltando.push('Falta o custo do minuto de costura (Materiais e aviamentos › Padrões de custo, ou o pré-custo desta ficha).');
  else maoDeObra = tempoMin * padroes.custoDoMinuto;
  if (ficha.operacoes.length > 0) {
    linhas.push({
      grupo: 'mao-de-obra',
      descricao: `Costura e acabamento (${ficha.operacoes.length} ${ficha.operacoes.length === 1 ? 'operação' : 'operações'})`,
      aplicacao: '',
      consumo: `${numeroComVirgula(tempoMin, 2)} min`,
      quantidade: tempoMin,
      precoUnitario: padroes.custoDoMinuto,
      preco: padroes.custoDoMinuto === null ? '—' : `${reais(padroes.custoDoMinuto)}/min`,
      valor: padroes.custoDoMinuto === null ? null : maoDeObra,
      origemDoPreco: padroes.custoDoMinuto === null ? 'sem preço' : 'padrões',
    });
  }
  const materiais = linhas.filter((l) => l.grupo !== 'mao-de-obra').reduce((s, l) => s + (l.valor ?? 0), 0);
  const custoDireto = materiais + maoDeObra;
  const indiretos = custoDireto * (padroes.indiretosPercentual / 100);
  const custoTotal = custoDireto + indiretos;
  const sobreOPreco = padroes.impostosPercentual + padroes.comissaoPercentual + padroes.margemPercentual;
  const precoSugerido = sobreOPreco < 100 && custoTotal > 0 ? custoTotal / (1 - sobreOPreco / 100) : null;
  const custoAprovado = ultimaAprovacao(ficha)?.custoNaHora ?? null;
  return {
    linhas,
    padroes,
    padroesDaEmpresa: daEmpresa,
    materiais,
    tempoMin,
    maoDeObra,
    custoDireto,
    indiretos,
    custoTotal,
    precoSugerido,
    markup: precoSugerido !== null && custoTotal > 0 ? precoSugerido / custoTotal : null,
    impostos: precoSugerido === null ? null : precoSugerido * (padroes.impostosPercentual / 100),
    comissao: precoSugerido === null ? null : precoSugerido * (padroes.comissaoPercentual / 100),
    margem: precoSugerido === null ? null : precoSugerido * (padroes.margemPercentual / 100),
    faltando,
    completo: faltando.length === 0 && problemaDosPadroes(padroes) === null,
    custoAprovado,
  };
}

/** O total de cada grupo (tecido, aviamentos, embalagem, outros, mão de obra), na ordem; `null` no grupo sem nenhum valor calculado. */
export function totaisPorGrupo(preCusto: PreCusto): Array<{ readonly grupo: GrupoDaLinha; readonly valor: number | null }> {
  const ordem: GrupoDaLinha[] = ['tecido', 'aviamento', 'embalagem', 'outro', 'mao-de-obra'];
  return ordem
    .map((grupo) => preCusto.linhas.filter((l) => l.grupo === grupo))
    .map((linhas, i) => ({ grupo: ordem[i]!, linhas }))
    .filter((g) => g.linhas.length > 0)
    .map(({ grupo, linhas }) => ({ grupo, valor: linhas.every((l) => l.valor === null) ? null : linhas.reduce((s, l) => s + (l.valor ?? 0), 0) }));
}

// ---- O simulador de meta

export type MetaDeCusto = { readonly tipo: 'custo'; readonly valor: number } | { readonly tipo: 'preco'; readonly valor: number };

export interface SimulacaoDaMeta {
  /** O custo que a meta pede (para a meta de preço, o custo que dá aquele preço com os percentuais de agora). */
  readonly custoAlvo: number;
  /** Custo de agora − custo-alvo (positivo: acima da meta). */
  readonly diferenca: number;
  readonly dentro: boolean;
  /** Cada caminho para chegar à meta, sozinho (ou o que sobra, dentro dela). */
  readonly caminhos: readonly string[];
}

export function simularMeta(preCusto: PreCusto, meta: MetaDeCusto): SimulacaoDaMeta | { readonly erro: string } {
  if (!(meta.valor > 0)) return { erro: 'A meta precisa ser um valor maior que zero (R$).' };
  const p = preCusto.padroes;
  const sobreOPreco = p.impostosPercentual + p.comissaoPercentual + p.margemPercentual;
  const custoAlvo = meta.tipo === 'custo' ? meta.valor : meta.valor * (1 - sobreOPreco / 100);
  const diferenca = preCusto.custoTotal - custoAlvo;
  const caminhos: string[] = [];
  const pct = (v: number): string => `${numeroComVirgula(v, 1)}%`;
  if (diferenca <= 0) {
    caminhos.push(`Dentro da meta: sobram ${reais(-diferenca)} por peça.`);
    if (meta.tipo === 'preco') {
      const margemPossivel = 100 * (1 - preCusto.custoTotal / meta.valor) - p.impostosPercentual - p.comissaoPercentual;
      caminhos.push(`Com o preço de ${reais(meta.valor)}, a margem pode ir a ${pct(margemPossivel)} (hoje ${pct(p.margemPercentual)}).`);
    }
    return { custoAlvo, diferenca, dentro: true, caminhos };
  }
  // O que cada caminho precisa tirar do custo direto (os indiretos caem junto, na mesma proporção).
  const doDireto = diferenca / (1 + p.indiretosPercentual / 100);
  if (p.custoDoMinuto !== null && p.custoDoMinuto > 0 && preCusto.tempoMin > 0) {
    const minutos = doDireto / p.custoDoMinuto;
    caminhos.push(
      minutos <= preCusto.tempoMin
        ? `Reduzir o tempo de costura em ${numeroComVirgula(minutos, 2)} min (de ${numeroComVirgula(preCusto.tempoMin, 2)} para ${numeroComVirgula(preCusto.tempoMin - minutos, 2)} min).`
        : `Nem sem a mão de obra inteira (${reais(preCusto.maoDeObra)}) chega: faltaria ${reais(doDireto - preCusto.maoDeObra)} do custo direto.`,
    );
  }
  const maiores = preCusto.linhas.filter((l) => l.grupo !== 'mao-de-obra' && l.valor !== null && l.valor > 0 && l.quantidade !== null && l.precoUnitario !== null).sort((a, b) => b.valor! - a.valor!);
  for (const linha of maiores.slice(0, 2)) {
    if (doDireto < linha.valor!) {
      const novoPreco = (linha.valor! - doDireto) / linha.quantidade!;
      const novoConsumo = (linha.valor! - doDireto) / linha.precoUnitario!;
      const unidade = linha.preco.split('/').pop() ?? '';
      caminhos.push(
        `“${linha.descricao}”: baixar o preço de ${reais(linha.precoUnitario!)} para ${reais(novoPreco)}/${unidade} (−${pct((1 - novoPreco / linha.precoUnitario!) * 100)}), ou o consumo de ${numeroComVirgula(linha.quantidade!, 3)} para ${numeroComVirgula(novoConsumo, 3)} ${unidade}.`,
      );
    } else {
      caminhos.push(`“${linha.descricao}” custa ${reais(linha.valor!)} por peça: nem sem ele chega.`);
    }
  }
  if (p.indiretosPercentual > 0 && preCusto.custoDireto > 0) {
    const novos = (custoAlvo / preCusto.custoDireto - 1) * 100;
    caminhos.push(novos >= 0 ? `Baixar os custos indiretos de ${pct(p.indiretosPercentual)} para ${pct(novos)}.` : `Nem sem os custos indiretos chega (o custo direto já passa da meta).`);
  }
  if (meta.tipo === 'preco') {
    const margemPossivel = 100 * (1 - preCusto.custoTotal / meta.valor) - p.impostosPercentual - p.comissaoPercentual;
    caminhos.push(
      margemPossivel >= 0
        ? `Ou manter o custo e vender a ${reais(meta.valor)} com a margem de ${pct(margemPossivel)} (hoje ${pct(p.margemPercentual)}).`
        : `Com o custo de agora, o preço de ${reais(meta.valor)} não paga os impostos e a comissão: não há margem.`,
    );
  }
  return { custoAlvo, diferenca, dentro: false, caminhos };
}

// ---- O custo de todos os modelos (a biblioteca mudada atualiza todos de uma vez)

export interface CustoDoModelo {
  readonly projetoId: string;
  readonly nome: string;
  readonly codigo: string;
  readonly referencia: string;
  readonly versao: number;
  readonly situacao: FichaTecnica['situacao'];
  readonly custoAtual: number;
  readonly completo: boolean;
  readonly precoSugerido: number | null;
  readonly custoAprovado: number | null;
  /** (atual − aprovado) ÷ aprovado. */
  readonly diferencaPercentual: number | null;
  /** Os materiais da biblioteca que a ficha usa. */
  readonly materiaisIds: readonly string[];
}

/** O custo de cada modelo com ficha técnica, com os preços de agora da biblioteca (e o encaixe da mesa de cada um). */
export function custosDosModelos(projetos: readonly Projeto[], biblioteca: BibliotecaDeMateriais): CustoDoModelo[] {
  const linhas: CustoDoModelo[] = [];
  for (const projeto of projetos) {
    const ficha = lerFichaTecnica(projeto.fichaTecnica);
    if (!ficha) continue;
    const estado = projeto.estadoAtual;
    const encaixe = encaixeParaConsumo(estado.pecas, estado.enfesto?.larguraUtilMm ?? null);
    const c = calcularPreCusto(ficha, biblioteca, encaixe);
    linhas.push({
      projetoId: projeto.id,
      nome: projeto.nome,
      codigo: projeto.codigo,
      referencia: ficha.referencia,
      versao: ficha.versao,
      situacao: ficha.situacao,
      custoAtual: c.custoTotal,
      completo: c.completo,
      precoSugerido: c.precoSugerido,
      custoAprovado: c.custoAprovado,
      diferencaPercentual: c.custoAprovado !== null && c.custoAprovado > 0 ? ((c.custoTotal - c.custoAprovado) / c.custoAprovado) * 100 : null,
      materiaisIds: [...new Set(ficha.materiais.map((i) => i.materialId).filter((id): id is string => id !== null))],
    });
  }
  return linhas.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
}

export function csvDosCustosDosModelos(custos: readonly CustoDoModelo[]): string {
  const cabecalho = ['Modelo', 'Código', 'Referência', 'Versão da ficha', 'Custo atual (R$)', 'Custo completo', 'Preço sugerido (R$)', 'Custo aprovado (R$)', 'Diferença (%)'];
  const linhas = custos.map((c) => [
    c.nome,
    c.codigo,
    c.referencia,
    String(c.versao),
    numeroComVirgula(centavos(c.custoAtual), 2),
    c.completo ? 'sim' : 'não (falta dado)',
    c.precoSugerido === null ? '' : numeroComVirgula(centavos(c.precoSugerido), 2),
    c.custoAprovado === null ? '' : numeroComVirgula(centavos(c.custoAprovado), 2),
    c.diferencaPercentual === null ? '' : numeroComVirgula(c.diferencaPercentual, 1),
  ]);
  return textoCsv([cabecalho, ...linhas]);
}

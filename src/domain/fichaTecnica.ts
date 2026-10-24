import type { Molde } from './molde';
import type { Material, PadroesDeCusto, UnidadeDoMaterial } from './materiais';
import { problemaDosPadroes, ROTULO_DA_UNIDADE } from './materiais';
import { riscoDaMesa } from './planoDeCorte';
import { lerDesenhoTecnico, type DesenhoTecnico } from './desenhoTecnico';
import { numeroComVirgula } from '../core/numeros';

/**
 * A ficha técnica do modelo (ADR 0105): o que a produção precisa para fazer a peça igual — a descrição, os
 * tamanhos, a tabela de medidas com as tolerâncias, os materiais e aviamentos com o consumo por peça, a sequência
 * operacional (operação, máquina, tempo), as instruções, a versão e a aprovação com o histórico. Ela mora no
 * projeto (`Projeto.fichaTecnica`) e usa a biblioteca de materiais (ADR 0104): a descrição e o preço vêm de lá.
 *
 * O consumo do tecido pode vir do encaixe da mesa: o comprimento do encaixe ÷ as roupas que ele tem (contadas pelas
 * peças na mesa, ou informadas), com a perda pedida — em metros, ou passado a quilos ou m² pela largura e a
 * gramatura do tecido.
 */

export const VERSAO_DA_FICHA = 1;

export interface PontoDeMedida {
  readonly id: string;
  /** "Busto", "Comprimento total". */
  readonly nome: string;
  /** Onde e como medir ("2 cm abaixo da cava"). */
  readonly comoMedir: string;
  /** A tolerância, para mais ou para menos (cm). */
  readonly toleranciaCm: number;
  /** A medida de cada tamanho (cm); o tamanho sem medida não aparece. */
  readonly valoresCm: Readonly<Record<string, number>>;
}

export type ConsumoDoItem =
  | { readonly tipo: 'informado'; readonly quantidade: number }
  | {
      readonly tipo: 'pelo-encaixe';
      /** Quantas roupas o encaixe da mesa tem; `null`: contadas pelas peças na mesa. */
      readonly roupasNoEncaixe: number | null;
      /** A perda somada ao consumo (pontas, emendas, defeitos), em %. */
      readonly perdaPercentual: number;
    };

export interface ItemDeMaterial {
  readonly id: string;
  /** O material da biblioteca; `null`: um item digitado só nesta ficha. */
  readonly materialId: string | null;
  /** A descrição (a da biblioteca, guardada para o caso de o material sair dela; ou a digitada). */
  readonly descricao: string;
  /** Onde vai: "Corpo", "Gola", "Fechamento". */
  readonly aplicacao: string;
  readonly unidade: UnidadeDoMaterial;
  /** O consumo por peça pronta (uma roupa), na unidade do item. */
  readonly consumo: ConsumoDoItem;
  /** O preço do item digitado (R$ por unidade); o da biblioteca vem dela. */
  readonly precoInformado?: number | null;
}

export interface Operacao {
  readonly id: string;
  readonly descricao: string;
  readonly maquina: string;
  /** O tempo-padrão da operação, em minutos (por peça pronta). */
  readonly tempoMin: number;
  readonly observacao: string;
}

export interface InstrucoesDaFicha {
  readonly costura: string;
  readonly acabamento: string;
  readonly conservacao: string;
  readonly embalagem: string;
}

export type SituacaoDaFicha = 'rascunho' | 'em-aprovacao' | 'aprovada' | 'alteracao-pedida';

export const ROTULO_DA_SITUACAO_DA_FICHA: Readonly<Record<SituacaoDaFicha, string>> = {
  rascunho: 'Rascunho',
  'em-aprovacao': 'Em aprovação',
  aprovada: 'Aprovada',
  'alteracao-pedida': 'Alteração pedida',
};

export type AcaoDaFicha = 'enviada' | 'aprovada' | 'alteracao-pedida' | 'nova-versao';

export const ROTULO_DA_ACAO_DA_FICHA: Readonly<Record<AcaoDaFicha, string>> = {
  enviada: 'Enviada para aprovação',
  aprovada: 'Aprovada',
  'alteracao-pedida': 'Alteração pedida',
  'nova-versao': 'Nova versão aberta',
};

export interface DecisaoDaFicha {
  readonly versao: number;
  readonly dataIso: string;
  /** Digitado por quem decide (o programa não tem login). */
  readonly responsavel: string;
  readonly acao: AcaoDaFicha;
  readonly comentario: string;
  /** O custo da peça na hora da aprovação (R$), quando o pré-custo saiu inteiro. */
  readonly custoNaHora?: number;
}

export interface FichaTecnica {
  readonly versaoDoFormato: number;
  readonly referencia: string;
  readonly nomeDoModelo: string;
  readonly colecao: string;
  readonly marca: string;
  readonly estilista: string;
  readonly modelista: string;
  readonly descricao: string;
  readonly tamanhos: readonly string[];
  readonly medidas: readonly PontoDeMedida[];
  readonly materiais: readonly ItemDeMaterial[];
  readonly operacoes: readonly Operacao[];
  readonly instrucoes: InstrucoesDaFicha;
  /** A versão da ficha (começa em 1; a aprovada que muda vira a seguinte). */
  readonly versao: number;
  readonly situacao: SituacaoDaFicha;
  readonly decisoes: readonly DecisaoDaFicha[];
  /** Os padrões de custo próprios desta ficha (ADR 0106); ausente: os da empresa (a biblioteca de materiais). */
  readonly padroesDeCusto?: PadroesDeCusto;
  /** O desenho técnico (o croqui de frente e costas, ADR 0107); ausente: ainda não feito. */
  readonly desenho?: DesenhoTecnico;
  readonly atualizadaEmIso: string;
}

const INSTRUCOES_VAZIAS: InstrucoesDaFicha = { costura: '', acabamento: '', conservacao: '', embalagem: '' };

/** Os tamanhos das peças, na ordem: os da graduação e os das peças soltas, sem repetir. */
export function tamanhosDasPecas(pecas: readonly Molde[]): string[] {
  const tamanhos: string[] = [];
  for (const p of pecas) {
    for (const t of p.graduacao ? p.graduacao.tamanhos : [p.tamanho]) {
      const limpo = t.trim();
      if (limpo !== '' && !tamanhos.includes(limpo)) tamanhos.push(limpo);
    }
  }
  return tamanhos;
}

/** A ficha nova do projeto: a referência das peças (ou o código), o nome, o autor como modelista e os tamanhos do molde. */
export function novaFichaTecnica(projeto: { readonly nome: string; readonly codigo: string; readonly autor?: string; readonly pecas: readonly Molde[] }, agoraIso: string): FichaTecnica {
  const referencia = projeto.pecas.map((p) => p.referencia.trim()).find((r) => r !== '') ?? projeto.codigo;
  return {
    versaoDoFormato: VERSAO_DA_FICHA,
    referencia,
    nomeDoModelo: projeto.nome,
    colecao: '',
    marca: '',
    estilista: '',
    modelista: projeto.autor ?? '',
    descricao: '',
    tamanhos: tamanhosDasPecas(projeto.pecas),
    medidas: [],
    materiais: [],
    operacoes: [],
    instrucoes: INSTRUCOES_VAZIAS,
    versao: 1,
    situacao: 'rascunho',
    decisoes: [],
    atualizadaEmIso: agoraIso,
  };
}

/** A ficha pode ser mudada: rascunho ou com alteração pedida (a aprovada e a em aprovação, só abrindo nova versão). */
export const fichaEditavel = (ficha: Pick<FichaTecnica, 'situacao'>): boolean => ficha.situacao === 'rascunho' || ficha.situacao === 'alteracao-pedida';

/** Muda a ficha (a mudança vem pronta); recusa se ela não está aberta para mudança. */
export function mudarFicha(ficha: FichaTecnica, mudanca: Partial<Omit<FichaTecnica, 'versaoDoFormato' | 'versao' | 'situacao' | 'decisoes'>>, agoraIso: string): FichaTecnica {
  if (!fichaEditavel(ficha)) {
    throw new Error(`A ficha está ${ROTULO_DA_SITUACAO_DA_FICHA[ficha.situacao].toLowerCase()} (versão ${ficha.versao}): para mudar, abra uma nova versão (aba Aprovação).`);
  }
  return { ...ficha, ...mudanca, atualizadaEmIso: agoraIso };
}

// ---- Tamanhos e medidas

/** Os tamanhos de um texto ("P, M, G" ou "P M G" ou "P;M;G"), sem repetir. */
export function lerTamanhos(texto: string): string[] {
  const tamanhos: string[] = [];
  for (const t of texto.split(/[,;\s]+/)) {
    const limpo = t.trim();
    if (limpo !== '' && !tamanhos.includes(limpo)) tamanhos.push(limpo);
  }
  return tamanhos;
}

/** A medida do tamanho, com a tolerância: "52,0 ± 1,0". */
export function medidaComTolerancia(ponto: PontoDeMedida, tamanho: string): string {
  const v = ponto.valoresCm[tamanho];
  if (v === undefined) return '—';
  return ponto.toleranciaCm > 0 ? `${numeroComVirgula(v, 1)} ± ${numeroComVirgula(ponto.toleranciaCm, 1)}` : numeroComVirgula(v, 1);
}

/** Um número escrito com vírgula ou ponto; `null` se não for número. */
function numeroEscrito(texto: string): number | null {
  const limpo = texto.trim().replace(/\s/g, '').replace(',', '.');
  if (limpo === '') return null;
  const v = Number(limpo);
  return Number.isFinite(v) ? v : null;
}

/**
 * A tabela de medidas colada de uma planilha: a primeira linha diz os tamanhos (e, se tiver, a coluna "Tol" ou
 * "Tolerância"); cada linha seguinte, o ponto e as medidas (cm). Separada por tabulação ou ponto e vírgula. Os
 * tamanhos que a ficha não tem entram nela.
 */
export function lerMedidasColadas(texto: string, novoId: () => string): { readonly pontos: PontoDeMedida[]; readonly tamanhos: string[]; readonly erros: string[] } {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+$/, ''))
    .filter((l) => l.trim() !== '');
  if (linhas.length < 2) return { pontos: [], tamanhos: [], erros: ['Cole a primeira linha com os tamanhos e, abaixo, uma linha por ponto de medida.'] };
  const separador = linhas[0]!.includes('\t') ? '\t' : ';';
  const cabecalho = linhas[0]!.split(separador).map((c) => c.trim());
  const colunaDaTolerancia = cabecalho.findIndex((c, i) => i > 0 && /^tol/i.test(c));
  const colunasDosTamanhos = cabecalho.map((c, i) => ({ c, i })).filter(({ c, i }) => i > 0 && i !== colunaDaTolerancia && c !== '' && !/^como/i.test(c));
  const colunaDoComoMedir = cabecalho.findIndex((c, i) => i > 0 && /^como/i.test(c));
  const erros: string[] = [];
  const pontos: PontoDeMedida[] = [];
  linhas.slice(1).forEach((linha, n) => {
    const celulas = linha.split(separador);
    const nome = (celulas[0] ?? '').trim();
    if (nome === '') {
      erros.push(`Linha ${n + 2}: falta o nome do ponto de medida.`);
      return;
    }
    const valoresCm: Record<string, number> = {};
    for (const { c, i } of colunasDosTamanhos) {
      const texto = celulas[i] ?? '';
      if (texto.trim() === '') continue;
      const v = numeroEscrito(texto);
      if (v === null || v < 0) erros.push(`Linha ${n + 2} (${nome}), tamanho ${c}: “${texto.trim()}” não é uma medida.`);
      else valoresCm[c] = v;
    }
    const tolerancia = colunaDaTolerancia >= 0 ? numeroEscrito(celulas[colunaDaTolerancia] ?? '') : 0;
    if (tolerancia === null && (celulas[colunaDaTolerancia] ?? '').trim() !== '') erros.push(`Linha ${n + 2} (${nome}): a tolerância não é um número.`);
    pontos.push({ id: novoId(), nome, comoMedir: colunaDoComoMedir >= 0 ? (celulas[colunaDoComoMedir] ?? '').trim() : '', toleranciaCm: Math.abs(tolerancia ?? 0), valoresCm });
  });
  return { pontos, tamanhos: colunasDosTamanhos.map(({ c }) => c), erros };
}

// ---- O consumo dos materiais

/** O encaixe da mesa, para o consumo do tecido: o comprimento, as roupas que ele tem e a largura do tecido. */
export interface EncaixeParaConsumo {
  readonly comprimentoMm: number;
  /** As roupas contadas pelas peças na mesa (o menor número de cópias de cada peça, somado nos tamanhos). */
  readonly roupasContadas: number;
  /** A largura do tecido (a útil do enfesto), para passar a m² e a quilos quando o material não diz a dele. */
  readonly larguraDoTecidoMm: number | null;
}

/** O encaixe das peças na mesa (`null` sem peças). */
export function encaixeParaConsumo(pecas: readonly Molde[], larguraDoTecidoMm: number | null): EncaixeParaConsumo | null {
  const risco = riscoDaMesa(pecas);
  if (!risco || !(risco.comprimentoMm > 0)) return null;
  const roupasContadas = Object.values(risco.gradePorTamanho).reduce((s, n) => s + n, 0);
  return { comprimentoMm: risco.comprimentoMm, roupasContadas: Math.max(1, roupasContadas), larguraDoTecidoMm };
}

export interface ConsumoCalculado {
  /** Por peça pronta, na unidade do item; `null`: não saiu (o motivo em `erro`). */
  readonly quantidade: number | null;
  /** Como saiu ("1,234 m ÷ 2 roupas + 5% de perda"). */
  readonly explicacao: string;
  readonly erro?: string;
}

/** O consumo do item por peça pronta. */
export function consumoDoItem(item: ItemDeMaterial, material: Material | undefined, encaixe: EncaixeParaConsumo | null): ConsumoCalculado {
  const consumo = item.consumo;
  if (consumo.tipo === 'informado') return { quantidade: consumo.quantidade, explicacao: 'informado' };
  if (!encaixe) return { quantidade: null, explicacao: '', erro: 'Pelo encaixe: não há peças encaixadas na mesa.' };
  const roupas = consumo.roupasNoEncaixe ?? encaixe.roupasContadas;
  if (!(roupas > 0)) return { quantidade: null, explicacao: '', erro: 'Pelo encaixe: as roupas no encaixe precisam ser 1 ou mais.' };
  const metros = (encaixe.comprimentoMm / 1000 / roupas) * (1 + consumo.perdaPercentual / 100);
  const comoSaiu = `${numeroComVirgula(encaixe.comprimentoMm / 1000, 3)} m ÷ ${roupas} roupa(s)${consumo.roupasNoEncaixe === null ? ' (contadas na mesa)' : ''}${consumo.perdaPercentual > 0 ? ` + ${numeroComVirgula(consumo.perdaPercentual, 1)}% de perda` : ''}`;
  const largura = material?.larguraMm ?? encaixe.larguraDoTecidoMm;
  switch (item.unidade) {
    case 'm':
      return { quantidade: metros, explicacao: comoSaiu };
    case 'cm':
      return { quantidade: metros * 100, explicacao: comoSaiu };
    case 'm2':
    case 'kg':
    case 'g': {
      if (!largura) return { quantidade: null, explicacao: '', erro: 'Pelo encaixe em m², kg ou g: falta a largura do tecido (no material ou no enfesto).' };
      const m2 = metros * (largura / 1000);
      if (item.unidade === 'm2') return { quantidade: m2, explicacao: `${comoSaiu} × ${numeroComVirgula(largura / 1000, 2)} m de largura` };
      const gramatura = material?.gramaturaGm2;
      if (!gramatura) return { quantidade: null, explicacao: '', erro: 'Pelo encaixe em quilos: falta a gramatura do tecido (no material da biblioteca).' };
      const gramas = m2 * gramatura;
      return { quantidade: item.unidade === 'kg' ? gramas / 1000 : gramas, explicacao: `${comoSaiu} × ${numeroComVirgula(largura / 1000, 2)} m × ${numeroComVirgula(gramatura, 0)} g/m²` };
    }
    default:
      return { quantidade: null, explicacao: '', erro: `Pelo encaixe, só em m, cm, m², kg ou g (o item está em ${ROTULO_DA_UNIDADE[item.unidade]}).` };
  }
}

/** O consumo escrito com a unidade: "1,234 m", "0,250 kg", "4 un". */
export function consumoEscrito(quantidade: number | null, unidade: UnidadeDoMaterial): string {
  if (quantidade === null) return '—';
  const inteira = unidade === 'un' || unidade === 'par';
  return `${numeroComVirgula(quantidade, inteira && Number.isInteger(quantidade) ? 0 : 3)} ${ROTULO_DA_UNIDADE[unidade]}`;
}

/** O tempo total da sequência operacional (min por peça). */
export const tempoTotalDasOperacoes = (operacoes: readonly Operacao[]): number => operacoes.reduce((s, o) => s + o.tempoMin, 0);

/** Os problemas de um item (vazio: nenhum). */
export function validarItem(item: ItemDeMaterial): string[] {
  const erros: string[] = [];
  if (item.descricao.trim() === '') erros.push('O item precisa da descrição do material.');
  if (item.consumo.tipo === 'informado' && (!Number.isFinite(item.consumo.quantidade) || item.consumo.quantidade < 0)) erros.push(`${item.descricao}: o consumo precisa ser um número de 0 para cima.`);
  if (item.consumo.tipo === 'pelo-encaixe') {
    if (item.consumo.roupasNoEncaixe !== null && !(Number.isInteger(item.consumo.roupasNoEncaixe) && item.consumo.roupasNoEncaixe >= 1)) erros.push(`${item.descricao}: as roupas no encaixe precisam ser um número inteiro de 1 para cima.`);
    if (!Number.isFinite(item.consumo.perdaPercentual) || item.consumo.perdaPercentual < 0) erros.push(`${item.descricao}: a perda precisa ser um número de 0 para cima (%).`);
  }
  if (item.precoInformado !== undefined && item.precoInformado !== null && (!Number.isFinite(item.precoInformado) || item.precoInformado < 0)) erros.push(`${item.descricao}: o preço precisa ser um número de 0 para cima.`);
  return erros;
}

// ---- A aprovação

/** Rascunho (ou com alteração pedida) → em aprovação. */
export function enviarParaAprovacao(ficha: FichaTecnica, responsavel: string, comentario: string, agoraIso: string): FichaTecnica {
  if (!fichaEditavel(ficha)) throw new Error('Só a ficha em rascunho, ou com alteração pedida, vai para aprovação.');
  if (responsavel.trim() === '') throw new Error('Diga quem envia a ficha para aprovação.');
  return decidir(ficha, 'em-aprovacao', { acao: 'enviada', responsavel, comentario }, agoraIso);
}

/** Em aprovação → aprovada (com o custo da hora, se saiu). */
export function aprovarFicha(ficha: FichaTecnica, responsavel: string, comentario: string, agoraIso: string, custoNaHora: number | null): FichaTecnica {
  if (ficha.situacao !== 'em-aprovacao') throw new Error('Só a ficha em aprovação pode ser aprovada.');
  if (responsavel.trim() === '') throw new Error('Diga quem aprova a ficha.');
  return decidir(ficha, 'aprovada', { acao: 'aprovada', responsavel, comentario, ...(custoNaHora !== null ? { custoNaHora } : {}) }, agoraIso);
}

/** Em aprovação → alteração pedida (o comentário diz o que mudar). */
export function pedirAlteracao(ficha: FichaTecnica, responsavel: string, comentario: string, agoraIso: string): FichaTecnica {
  if (ficha.situacao !== 'em-aprovacao') throw new Error('Só a ficha em aprovação pode voltar com alteração pedida.');
  if (responsavel.trim() === '') throw new Error('Diga quem pede a alteração.');
  if (comentario.trim() === '') throw new Error('Diga o que precisa ser alterado (no comentário).');
  return decidir(ficha, 'alteracao-pedida', { acao: 'alteracao-pedida', responsavel, comentario }, agoraIso);
}

/** Aprovada (ou em aprovação) → a versão seguinte, em rascunho: a aprovada fica no histórico. */
export function abrirNovaVersao(ficha: FichaTecnica, responsavel: string, comentario: string, agoraIso: string): FichaTecnica {
  if (fichaEditavel(ficha)) throw new Error('A ficha já está aberta para mudança.');
  if (responsavel.trim() === '') throw new Error('Diga quem abre a nova versão.');
  const nova = { ...ficha, versao: ficha.versao + 1 };
  return decidir(nova, 'rascunho', { acao: 'nova-versao', responsavel, comentario }, agoraIso);
}

function decidir(ficha: FichaTecnica, situacao: SituacaoDaFicha, d: Omit<DecisaoDaFicha, 'versao' | 'dataIso'>, agoraIso: string): FichaTecnica {
  const decisao: DecisaoDaFicha = { ...d, responsavel: d.responsavel.trim(), comentario: d.comentario.trim(), versao: ficha.versao, dataIso: agoraIso };
  return { ...ficha, situacao, decisoes: [...ficha.decisoes, decisao], atualizadaEmIso: agoraIso };
}

/** A última aprovação (para o custo aprovado e a data). */
export function ultimaAprovacao(ficha: FichaTecnica): DecisaoDaFicha | null {
  return [...ficha.decisoes].reverse().find((d) => d.acao === 'aprovada') ?? null;
}

// ---- A leitura (de dentro do projeto)

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const texto = (v: unknown): string => (typeof v === 'string' ? v : '');
const SITUACOES: ReadonlySet<string> = new Set(Object.keys(ROTULO_DA_SITUACAO_DA_FICHA));

/** A ficha guardada no projeto, conferida (`null`: não há, ou não é uma ficha). O que falta entra vazio. */
export function lerFichaTecnica(bruto: unknown): FichaTecnica | null {
  if (!ehObjeto(bruto) || typeof bruto.versao !== 'number' || !SITUACOES.has(String(bruto.situacao))) return null;
  const lista = <T>(v: unknown, ok: (x: Record<string, unknown>) => boolean): T[] => (Array.isArray(v) ? (v.filter((x) => ehObjeto(x) && ok(x)) as T[]) : []);
  const instrucoes = ehObjeto(bruto.instrucoes) ? bruto.instrucoes : {};
  return {
    versaoDoFormato: VERSAO_DA_FICHA,
    referencia: texto(bruto.referencia),
    nomeDoModelo: texto(bruto.nomeDoModelo),
    colecao: texto(bruto.colecao),
    marca: texto(bruto.marca),
    estilista: texto(bruto.estilista),
    modelista: texto(bruto.modelista),
    descricao: texto(bruto.descricao),
    tamanhos: Array.isArray(bruto.tamanhos) ? bruto.tamanhos.filter((t): t is string => typeof t === 'string') : [],
    medidas: lista<PontoDeMedida>(bruto.medidas, (p) => typeof p.id === 'string' && typeof p.nome === 'string' && ehObjeto(p.valoresCm) && typeof p.toleranciaCm === 'number'),
    materiais: lista<ItemDeMaterial>(bruto.materiais, (i) => typeof i.id === 'string' && typeof i.descricao === 'string' && ehObjeto(i.consumo) && typeof i.unidade === 'string'),
    operacoes: lista<Operacao>(bruto.operacoes, (o) => typeof o.id === 'string' && typeof o.descricao === 'string' && typeof o.tempoMin === 'number'),
    instrucoes: { costura: texto(instrucoes.costura), acabamento: texto(instrucoes.acabamento), conservacao: texto(instrucoes.conservacao), embalagem: texto(instrucoes.embalagem) },
    versao: bruto.versao,
    situacao: bruto.situacao as SituacaoDaFicha,
    decisoes: lista<DecisaoDaFicha>(bruto.decisoes, (d) => typeof d.versao === 'number' && typeof d.dataIso === 'string' && typeof d.acao === 'string'),
    ...(padroesValidos(bruto.padroesDeCusto) ? { padroesDeCusto: bruto.padroesDeCusto } : {}),
    ...(lerDesenhoTecnico(bruto.desenho) ? { desenho: lerDesenhoTecnico(bruto.desenho)! } : {}),
    atualizadaEmIso: texto(bruto.atualizadaEmIso),
  };
}

function padroesValidos(v: unknown): v is PadroesDeCusto {
  if (!ehObjeto(v)) return false;
  const numero = (x: unknown): boolean => typeof x === 'number' && Number.isFinite(x);
  if (!(v.custoDoMinuto === null || numero(v.custoDoMinuto))) return false;
  if (![v.indiretosPercentual, v.impostosPercentual, v.comissaoPercentual, v.margemPercentual].every(numero)) return false;
  return problemaDosPadroes(v as unknown as PadroesDeCusto) === null;
}

/** Os padrões de custo próprios da ficha (`null`: volta aos da empresa). */
export function definirPadroesDeCustoDaFicha(ficha: FichaTecnica, padroes: PadroesDeCusto | null, agoraIso: string): FichaTecnica {
  if (!fichaEditavel(ficha)) throw new Error(`A ficha está ${ROTULO_DA_SITUACAO_DA_FICHA[ficha.situacao].toLowerCase()}: para mudar o custo dela, abra uma nova versão (aba Aprovação).`);
  if (padroes) {
    const erro = problemaDosPadroes(padroes);
    if (erro) throw new Error(erro);
    return { ...ficha, padroesDeCusto: padroes, atualizadaEmIso: agoraIso };
  }
  const copia: Partial<Record<keyof FichaTecnica, unknown>> = { ...ficha, atualizadaEmIso: agoraIso };
  delete copia.padroesDeCusto;
  return copia as FichaTecnica;
}

/** O desenho técnico da ficha (a ficha aprovada não muda: só com nova versão). */
export function definirDesenhoDaFicha(ficha: FichaTecnica, desenho: DesenhoTecnico, agoraIso: string): FichaTecnica {
  if (!fichaEditavel(ficha)) throw new Error(`A ficha está ${ROTULO_DA_SITUACAO_DA_FICHA[ficha.situacao].toLowerCase()} (versão ${ficha.versao}): para mudar o desenho, abra uma nova versão (Ficha técnica › Aprovação).`);
  return { ...ficha, desenho, atualizadaEmIso: agoraIso };
}

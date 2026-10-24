import type { MalhaDoCadastro } from './cadastroDeProducao';
import { numeroComVirgula } from '../core/numeros';
import { textoCsv } from '../core/csv';

/**
 * A biblioteca de materiais e aviamentos (ADR 0104): o cadastro da empresa, usado por todas as fichas técnicas —
 * tecidos, aviamentos (botão, zíper, linha, etiqueta, elástico, entretela…), embalagem. Cada material tem a unidade
 * em que é comprado e o preço por ela; o preço mudado guarda o anterior (com a data), e o custo de todos os modelos
 * que usam o material passa a sair com o preço novo.
 *
 * Mora num arquivo próprio da pasta de dados (`biblioteca-de-materiais.json`), com os padrões de custo da empresa
 * (o custo do minuto, os indiretos, os impostos, a comissão e a margem), que cada pré-custo pode trocar.
 */

export const VERSAO_DA_BIBLIOTECA_DE_MATERIAIS = 1;
export const MAXIMO_DE_MATERIAIS = 5000;
export const TAMANHO_MAXIMO_DO_TEXTO_DO_MATERIAL = 160;

export type CategoriaDoMaterial = 'tecido' | 'aviamento' | 'embalagem' | 'outro';

export const ROTULO_DA_CATEGORIA: Readonly<Record<CategoriaDoMaterial, string>> = {
  tecido: 'Tecido',
  aviamento: 'Aviamento',
  embalagem: 'Embalagem',
  outro: 'Outro',
};

export type UnidadeDoMaterial = 'm' | 'cm' | 'kg' | 'g' | 'un' | 'par' | 'm2';

export const ROTULO_DA_UNIDADE: Readonly<Record<UnidadeDoMaterial, string>> = {
  m: 'm',
  cm: 'cm',
  kg: 'kg',
  g: 'g',
  un: 'un',
  par: 'par',
  m2: 'm²',
};

export interface PrecoAnterior {
  readonly precoPorUnidade: number | null;
  /** Até quando valeu (a hora em que foi trocado). */
  readonly ateIso: string;
}

export interface Material {
  readonly id: string;
  /** O código da empresa (pode ficar em branco; preenchido, não se repete). */
  readonly codigo: string;
  readonly descricao: string;
  readonly categoria: CategoriaDoMaterial;
  readonly unidade: UnidadeDoMaterial;
  /** R$ por unidade; `null`: sem preço (o custo diz o que falta). */
  readonly precoPorUnidade: number | null;
  readonly fornecedor?: string;
  readonly cor?: string;
  /** Tecido: "100% algodão". */
  readonly composicao?: string;
  /** Tecido: a largura útil (mm) e a gramatura (g/m²), que passam o consumo de metros a quilos. */
  readonly larguraMm?: number;
  readonly gramaturaGm2?: number;
  readonly observacoes?: string;
  /** O tecido veio da malha do cadastro de produção (para não trazer duas vezes). */
  readonly malhaId?: string;
  readonly atualizadoEmIso: string;
  /** Os preços de antes, o mais recente primeiro. */
  readonly precosAnteriores?: readonly PrecoAnterior[];
}

/** Os padrões de custo da empresa: o pré-custo de cada modelo começa com eles. */
export interface PadroesDeCusto {
  /** R$ por minuto de costura (o custo da mão de obra); `null`: não informado. */
  readonly custoDoMinuto: number | null;
  /** Os custos indiretos, em % sobre o custo direto (materiais + mão de obra). */
  readonly indiretosPercentual: number;
  /** Sobre o preço de venda (%). */
  readonly impostosPercentual: number;
  readonly comissaoPercentual: number;
  readonly margemPercentual: number;
}

export const PADROES_DE_CUSTO_INICIAIS: PadroesDeCusto = {
  custoDoMinuto: null,
  indiretosPercentual: 0,
  impostosPercentual: 0,
  comissaoPercentual: 0,
  margemPercentual: 0,
};

export interface BibliotecaDeMateriais {
  readonly versaoDoFormato: number;
  readonly materiais: readonly Material[];
  readonly padroesDeCusto: PadroesDeCusto;
}

export const BIBLIOTECA_VAZIA: BibliotecaDeMateriais = {
  versaoDoFormato: VERSAO_DA_BIBLIOTECA_DE_MATERIAIS,
  materiais: [],
  padroesDeCusto: PADROES_DE_CUSTO_INICIAIS,
};

const CATEGORIAS: ReadonlySet<string> = new Set(Object.keys(ROTULO_DA_CATEGORIA));
const UNIDADES: ReadonlySet<string> = new Set(Object.keys(ROTULO_DA_UNIDADE));

/** O preço escrito: "R$ 12,50/m", ou "sem preço". */
export function precoEscrito(material: Pick<Material, 'precoPorUnidade' | 'unidade'>): string {
  return material.precoPorUnidade === null ? 'sem preço' : `R$ ${numeroComVirgula(material.precoPorUnidade, 2)}/${ROTULO_DA_UNIDADE[material.unidade]}`;
}

/** O que está errado no material (vazio: nada). */
export function validarMaterial(material: Material, outros: readonly Material[]): string[] {
  const erros: string[] = [];
  if (material.descricao.trim() === '') erros.push('A descrição do material é obrigatória.');
  for (const [nome, valor] of [
    ['A descrição', material.descricao],
    ['O código', material.codigo],
    ['O fornecedor', material.fornecedor ?? ''],
    ['A cor', material.cor ?? ''],
    ['A composição', material.composicao ?? ''],
  ] as const) {
    if (valor.length > TAMANHO_MAXIMO_DO_TEXTO_DO_MATERIAL) erros.push(`${nome} passa de ${TAMANHO_MAXIMO_DO_TEXTO_DO_MATERIAL} letras.`);
  }
  const codigo = material.codigo.trim();
  if (codigo !== '' && outros.some((o) => o.id !== material.id && o.codigo.trim().toLowerCase() === codigo.toLowerCase())) {
    erros.push(`O código ${codigo} já é de outro material.`);
  }
  if (!CATEGORIAS.has(material.categoria)) erros.push('A categoria do material não é conhecida.');
  if (!UNIDADES.has(material.unidade)) erros.push('A unidade do material não é conhecida.');
  if (material.precoPorUnidade !== null && (!Number.isFinite(material.precoPorUnidade) || material.precoPorUnidade < 0)) {
    erros.push('O preço precisa ser um número de 0 para cima (ou em branco, sem preço).');
  }
  if (material.larguraMm !== undefined && !(material.larguraMm > 0)) erros.push('A largura precisa ser maior que zero.');
  if (material.gramaturaGm2 !== undefined && !(material.gramaturaGm2 > 0)) erros.push('A gramatura precisa ser maior que zero.');
  return erros;
}

/**
 * Guarda o material (novo ou mudado). O preço trocado vai para os preços anteriores, com a hora; o material
 * inválido é recusado com os motivos.
 */
export function salvarMaterial(biblioteca: BibliotecaDeMateriais, material: Material, agoraIso: string): BibliotecaDeMateriais {
  const erros = validarMaterial(material, biblioteca.materiais);
  if (erros.length > 0) throw new Error(erros.join(' '));
  const antes = biblioteca.materiais.find((m) => m.id === material.id);
  if (!antes && biblioteca.materiais.length >= MAXIMO_DE_MATERIAIS) throw new Error(`A biblioteca já tem ${MAXIMO_DE_MATERIAIS} materiais.`);
  const precoMudou = antes !== undefined && antes.precoPorUnidade !== material.precoPorUnidade;
  const guardado: Material = {
    ...material,
    descricao: material.descricao.trim(),
    codigo: material.codigo.trim(),
    atualizadoEmIso: agoraIso,
    ...(precoMudou ? { precosAnteriores: [{ precoPorUnidade: antes.precoPorUnidade, ateIso: agoraIso }, ...(antes.precosAnteriores ?? [])] } : {}),
  };
  return {
    ...biblioteca,
    materiais: antes ? biblioteca.materiais.map((m) => (m.id === material.id ? guardado : m)) : [...biblioteca.materiais, guardado],
  };
}

export function removerMaterial(biblioteca: BibliotecaDeMateriais, id: string): BibliotecaDeMateriais {
  return { ...biblioteca, materiais: biblioteca.materiais.filter((m) => m.id !== id) };
}

export function salvarPadroesDeCusto(biblioteca: BibliotecaDeMateriais, padroes: PadroesDeCusto): BibliotecaDeMateriais {
  const erro = problemaDosPadroes(padroes);
  if (erro) throw new Error(erro);
  return { ...biblioteca, padroesDeCusto: padroes };
}

/** O que está errado nos padrões de custo, ou `null`. */
export function problemaDosPadroes(p: PadroesDeCusto): string | null {
  if (p.custoDoMinuto !== null && (!Number.isFinite(p.custoDoMinuto) || p.custoDoMinuto < 0)) return 'O custo do minuto precisa ser um número de 0 para cima.';
  for (const [nome, v] of [
    ['Os indiretos', p.indiretosPercentual],
    ['Os impostos', p.impostosPercentual],
    ['A comissão', p.comissaoPercentual],
    ['A margem', p.margemPercentual],
  ] as const) {
    if (!Number.isFinite(v) || v < 0) return `${nome} precisam ser um número de 0 para cima (%).`;
  }
  if (p.impostosPercentual + p.comissaoPercentual + p.margemPercentual >= 100) {
    return 'Os impostos, a comissão e a margem somados precisam ficar abaixo de 100% do preço (senão não há preço que os pague).';
  }
  return null;
}

/** A ordem da lista: por categoria, depois pela descrição. */
export function materiaisNaOrdem(materiais: readonly Material[]): Material[] {
  const ordem = Object.keys(ROTULO_DA_CATEGORIA);
  return [...materiais].sort((a, b) => ordem.indexOf(a.categoria) - ordem.indexOf(b.categoria) || a.descricao.localeCompare(b.descricao, 'pt-BR'));
}

/** Procura pelo código, descrição, fornecedor, cor ou composição (sem diferença de maiúsculas e acentos). */
export function procurarMateriais(materiais: readonly Material[], texto: string): Material[] {
  const simples = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const busca = simples(texto.trim());
  if (busca === '') return materiaisNaOrdem(materiais);
  return materiaisNaOrdem(materiais.filter((m) => [m.codigo, m.descricao, m.fornecedor ?? '', m.cor ?? '', m.composicao ?? ''].some((c) => simples(c).includes(busca))));
}

/**
 * As malhas do cadastro de produção como tecidos da biblioteca (as que ainda não vieram): a descrição, a composição,
 * a largura útil, a gramatura e o custo (por metro ou por quilo). Devolve a biblioteca e quantas entraram.
 */
export function trazerMalhasDoCadastro(
  biblioteca: BibliotecaDeMateriais,
  malhas: readonly MalhaDoCadastro[],
  novoId: () => string,
  agoraIso: string,
): { readonly biblioteca: BibliotecaDeMateriais; readonly trazidas: number } {
  let atual = biblioteca;
  let trazidas = 0;
  for (const malha of malhas) {
    if (atual.materiais.some((m) => m.malhaId === malha.id)) continue;
    const material: Material = {
      id: novoId(),
      codigo: '',
      descricao: malha.descricao,
      categoria: 'tecido',
      unidade: malha.custo?.unidade === 'kg' ? 'kg' : 'm',
      precoPorUnidade: malha.custo ? malha.custo.valor : null,
      ...(malha.composicao ? { composicao: malha.composicao } : {}),
      larguraMm: malha.larguraUtilMm,
      ...(malha.gramaturaGm2 !== undefined ? { gramaturaGm2: malha.gramaturaGm2 } : {}),
      malhaId: malha.id,
      atualizadoEmIso: agoraIso,
    };
    try {
      atual = salvarMaterial(atual, material, agoraIso);
      trazidas++;
    } catch {
      // A malha com algum dado que a biblioteca não aceita fica de fora (o cadastro dela continua como está).
    }
  }
  return { biblioteca: atual, trazidas };
}

/** A biblioteca em CSV (ponto e vírgula, vírgula decimal). */
export function csvDosMateriais(materiais: readonly Material[]): string {
  const cabecalho = ['Código', 'Descrição', 'Categoria', 'Unidade', 'Preço (R$)', 'Fornecedor', 'Cor', 'Composição', 'Largura (mm)', 'Gramatura (g/m²)', 'Atualizado em', 'Observações'];
  const linhas = materiaisNaOrdem(materiais).map((m) => [
    m.codigo,
    m.descricao,
    ROTULO_DA_CATEGORIA[m.categoria],
    ROTULO_DA_UNIDADE[m.unidade],
    m.precoPorUnidade === null ? '' : numeroComVirgula(m.precoPorUnidade, 2),
    m.fornecedor ?? '',
    m.cor ?? '',
    m.composicao ?? '',
    m.larguraMm === undefined ? '' : numeroComVirgula(m.larguraMm, 0),
    m.gramaturaGm2 === undefined ? '' : numeroComVirgula(m.gramaturaGm2, 0),
    new Date(m.atualizadoEmIso).toLocaleDateString('pt-BR'),
    m.observacoes ?? '',
  ]);
  return textoCsv([cabecalho, ...linhas]);
}

// ---- A leitura do arquivo

export interface BibliotecaDeMateriaisLida {
  readonly biblioteca: BibliotecaDeMateriais;
  readonly descartados: readonly string[];
  readonly maisNova: boolean;
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function padroesLidos(bruto: unknown): PadroesDeCusto {
  if (!ehObjeto(bruto)) return PADROES_DE_CUSTO_INICIAIS;
  const numero = (v: unknown, padrao: number): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : padrao);
  const lidos: PadroesDeCusto = {
    custoDoMinuto: typeof bruto.custoDoMinuto === 'number' && Number.isFinite(bruto.custoDoMinuto) && bruto.custoDoMinuto >= 0 ? bruto.custoDoMinuto : null,
    indiretosPercentual: numero(bruto.indiretosPercentual, 0),
    impostosPercentual: numero(bruto.impostosPercentual, 0),
    comissaoPercentual: numero(bruto.comissaoPercentual, 0),
    margemPercentual: numero(bruto.margemPercentual, 0),
  };
  return problemaDosPadroes(lidos) === null ? lidos : PADROES_DE_CUSTO_INICIAIS;
}

/** Lê a biblioteca vinda do disco (`null`: sem arquivo). O material quebrado fica de fora, com o motivo. */
export function lerBibliotecaDeMateriais(bruto: unknown): BibliotecaDeMateriaisLida {
  if (bruto === null || bruto === undefined) return { biblioteca: BIBLIOTECA_VAZIA, descartados: [], maisNova: false };
  if (!ehObjeto(bruto) || !Array.isArray(bruto.materiais)) {
    return { biblioteca: BIBLIOTECA_VAZIA, descartados: ['O arquivo da biblioteca de materiais não é uma biblioteca.'], maisNova: false };
  }
  const descartados: string[] = [];
  const materiais: Material[] = [];
  bruto.materiais.forEach((m, i) => {
    if (!ehObjeto(m) || typeof m.id !== 'string' || typeof m.descricao !== 'string' || typeof m.codigo !== 'string' || typeof m.atualizadoEmIso !== 'string') {
      descartados.push(`O material ${i + 1} da biblioteca ficou de fora: faltam o código, a descrição ou a data.`);
      return;
    }
    const material = { ...m, precoPorUnidade: typeof m.precoPorUnidade === 'number' ? m.precoPorUnidade : null } as unknown as Material;
    const erros = validarMaterial(material, materiais);
    if (erros.length > 0) {
      descartados.push(`O material ${i + 1} da biblioteca (${m.descricao || 'sem descrição'}) ficou de fora: ${erros.join(' ')}`);
      return;
    }
    materiais.push(material);
  });
  const maisNova = typeof bruto.versaoDoFormato === 'number' && bruto.versaoDoFormato > VERSAO_DA_BIBLIOTECA_DE_MATERIAIS;
  return {
    biblioteca: { versaoDoFormato: VERSAO_DA_BIBLIOTECA_DE_MATERIAIS, materiais, padroesDeCusto: padroesLidos(bruto.padroesDeCusto) },
    descartados,
    maisNova,
  };
}

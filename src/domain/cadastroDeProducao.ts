import type { PadraoDoTecido } from './tecido';

/**
 * O cadastro de produção do planejamento de corte: as malhas que a fábrica usa, os rolos em estoque e as ordens de
 * produção. Fica num arquivo próprio (`cadastro-de-producao.json`, ao lado dos projetos), e vale para todos os
 * projetos deste computador. Unidades internas: mm, g, g/m², mm/g (o mesmo número que m/kg). As datas são ISO.
 *
 * Nada aqui decide o plano: o cadastro só guarda o que foi informado, com a origem de cada medida, e diz o que está
 * faltando ou não confere.
 */

export const VERSAO_DO_CADASTRO = 1;
export const MAXIMO_DE_MALHAS = 200;
export const MAXIMO_DE_ROLOS = 2000;
export const MAXIMO_DE_ORDENS = 2000;
export const TAMANHO_MAXIMO_DO_TEXTO = 120;

export interface MalhaDoCadastro {
  readonly id: string;
  /** "Malha algodão 30/1": como a fábrica chama a malha. */
  readonly descricao: string;
  readonly composicao?: string;
  /** O título do fio (30/1, 24/1…), quando a fábrica usa. */
  readonly tituloDoFio?: string;
  readonly gramaturaGm2?: number;
  readonly larguraNominalMm?: number;
  readonly larguraUtilMm: number;
  /** O rendimento informado pelo fornecedor ou medido (mm/g = m/kg). */
  readonly rendimentoMmPorG?: number;
  readonly tubular: boolean;
  /** Pelo ou estampa com sentido: nenhuma peça vira 180°, e o zigue-zague vira o tecido. */
  readonly sentidoUnico: boolean;
  readonly padrao: PadraoDoTecido;
  readonly encolhimentoComprimentoPercentual?: number;
  readonly encolhimentoLarguraPercentual?: number;
  /**
   * O encolhimento já está compensado no molde (o molde foi feito maior). O plano nunca aplica encolhimento: ele só
   * diz se a compensação está, ou não, no molde.
   */
  readonly encolhimentoCompensadoNoMolde: boolean;
  /** Quanto a largura útil de um rolo pode ficar abaixo da do cadastro sem ser um problema (mm). */
  readonly toleranciaDeLarguraMm?: number;
  /** A espessura de uma folha (mm), para o limite de altura do enfesto. */
  readonly espessuraDaFolhaMm?: number;
  readonly observacoes?: string;
}

export interface DefeitoDoRolo {
  readonly descricao: string;
  /** Quanto do comprimento do rolo o defeito tira (mm). */
  readonly perdaMm: number;
}

export type UnidadeDePeso = 'kg' | 'g';
export type UnidadeDeComprimento = 'm' | 'cm' | 'mm';

export interface RoloDeEstoque {
  readonly id: string;
  readonly malhaId: string;
  /** A etiqueta do rolo. */
  readonly identificacao: string;
  readonly pesoLiquidoG?: number;
  /** Medido (na enroladeira, na mesa); sem ele, o comprimento sai do peso e é uma estimativa. */
  readonly comprimentoMedidoMm?: number;
  readonly larguraUtilMedidaMm?: number;
  readonly lote: string;
  readonly tonalidade: string;
  readonly defeitos: readonly DefeitoDoRolo[];
  readonly localizacao?: string;
  /** De onde vêm as medidas: "balança da expedição", "etiqueta do fornecedor"… */
  readonly origemDaMedicao?: string;
  /** AAAA-MM-DD. */
  readonly dataDaMedicao?: string;
  /** As unidades em que as medidas foram digitadas (o cadastro guarda em mm e g). */
  readonly unidadeDoPeso: UnidadeDePeso;
  readonly unidadeDoComprimento: UnidadeDeComprimento;
  /** Fora do estoque (usado, reservado, devolvido): não aparece para escolher num plano novo. */
  readonly indisponivel: boolean;
  readonly observacoes?: string;
}

export interface OrdemDeProducao {
  readonly id: string;
  readonly codigo: string;
  readonly produto?: string;
  /** O projeto (molde) e a revisão para que a ordem foi aberta. */
  readonly projetoId?: string;
  readonly codigoDoMolde?: string;
  readonly revisaoDoMolde?: number;
  readonly cor?: string;
  readonly quantidadesPorTamanho: Readonly<Record<string, number>>;
  /** AAAA-MM-DD. */
  readonly prazo?: string;
  readonly observacoes?: string;
  readonly criadaEmIso: string;
  readonly atualizadaEmIso: string;
}

export interface CadastroDeProducao {
  readonly versaoDoFormato: number;
  readonly malhas: readonly MalhaDoCadastro[];
  readonly rolos: readonly RoloDeEstoque[];
  readonly ordens: readonly OrdemDeProducao[];
}

export const CADASTRO_VAZIO: CadastroDeProducao = { versaoDoFormato: VERSAO_DO_CADASTRO, malhas: [], rolos: [], ordens: [] };

// ---- Leitura tolerante: o que não dá para ler fica de fora, com o motivo; nada impede o programa de abrir.

const ehTexto = (v: unknown): v is string => typeof v === 'string';
const numeroPositivo = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0;
const positivoOuAusente = (v: unknown): boolean => v === undefined || numeroPositivo(v);
const textoOuAusente = (v: unknown): boolean => v === undefined || ehTexto(v);
const DATA = /^\d{4}-\d{2}-\d{2}$/;

function ehMalha(v: unknown): v is MalhaDoCadastro {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    ehTexto(m.id) &&
    ehTexto(m.descricao) &&
    m.descricao.trim() !== '' &&
    numeroPositivo(m.larguraUtilMm) &&
    typeof m.tubular === 'boolean' &&
    typeof m.sentidoUnico === 'boolean' &&
    (m.padrao === 'liso' || m.padrao === 'listrado' || m.padrao === 'xadrez') &&
    typeof m.encolhimentoCompensadoNoMolde === 'boolean' &&
    positivoOuAusente(m.gramaturaGm2) &&
    positivoOuAusente(m.larguraNominalMm) &&
    positivoOuAusente(m.rendimentoMmPorG) &&
    positivoOuAusente(m.espessuraDaFolhaMm) &&
    (m.toleranciaDeLarguraMm === undefined || (typeof m.toleranciaDeLarguraMm === 'number' && m.toleranciaDeLarguraMm >= 0)) &&
    [m.composicao, m.tituloDoFio, m.observacoes].every(textoOuAusente)
  );
}

function ehRolo(v: unknown): v is RoloDeEstoque {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return (
    ehTexto(r.id) &&
    ehTexto(r.malhaId) &&
    ehTexto(r.identificacao) &&
    ehTexto(r.lote) &&
    ehTexto(r.tonalidade) &&
    Array.isArray(r.defeitos) &&
    r.defeitos.every((d: unknown) => {
      const x = d as Record<string, unknown> | null;
      return typeof x === 'object' && x !== null && ehTexto(x.descricao) && typeof x.perdaMm === 'number' && x.perdaMm >= 0;
    }) &&
    (r.unidadeDoPeso === 'kg' || r.unidadeDoPeso === 'g') &&
    (r.unidadeDoComprimento === 'm' || r.unidadeDoComprimento === 'cm' || r.unidadeDoComprimento === 'mm') &&
    typeof r.indisponivel === 'boolean' &&
    positivoOuAusente(r.pesoLiquidoG) &&
    positivoOuAusente(r.comprimentoMedidoMm) &&
    positivoOuAusente(r.larguraUtilMedidaMm) &&
    (numeroPositivo(r.pesoLiquidoG) || numeroPositivo(r.comprimentoMedidoMm)) &&
    (r.dataDaMedicao === undefined || (ehTexto(r.dataDaMedicao) && DATA.test(r.dataDaMedicao))) &&
    [r.localizacao, r.origemDaMedicao, r.observacoes].every(textoOuAusente)
  );
}

function ehOrdem(v: unknown): v is OrdemDeProducao {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  const q = o.quantidadesPorTamanho;
  return (
    ehTexto(o.id) &&
    ehTexto(o.codigo) &&
    o.codigo.trim() !== '' &&
    typeof q === 'object' &&
    q !== null &&
    Object.values(q).every((n) => Number.isInteger(n) && (n as number) >= 0) &&
    ehTexto(o.criadaEmIso) &&
    ehTexto(o.atualizadaEmIso) &&
    (o.revisaoDoMolde === undefined || (Number.isInteger(o.revisaoDoMolde) && (o.revisaoDoMolde as number) >= 0)) &&
    (o.prazo === undefined || (ehTexto(o.prazo) && DATA.test(o.prazo))) &&
    [o.produto, o.projetoId, o.codigoDoMolde, o.cor, o.observacoes].every(textoOuAusente)
  );
}

export interface CadastroLido {
  readonly cadastro: CadastroDeProducao;
  /** O que ficou de fora, e por quê (para mostrar a quem abriu). */
  readonly descartados: readonly string[];
  /** O arquivo é de uma versão mais nova do programa: ler pode perder campos, e gravar por cima não é seguro. */
  readonly maisNovo: boolean;
}

/** Lê o conteúdo do arquivo (já como objeto). Sem arquivo (`null`/`undefined`), o cadastro vazio. */
export function lerCadastroDeProducao(bruto: unknown): CadastroLido {
  if (bruto === null || bruto === undefined) return { cadastro: CADASTRO_VAZIO, descartados: [], maisNovo: false };
  if (typeof bruto !== 'object' || Array.isArray(bruto)) {
    return { cadastro: CADASTRO_VAZIO, descartados: ['O arquivo do cadastro não é um cadastro (formato desconhecido).'], maisNovo: false };
  }
  const b = bruto as Record<string, unknown>;
  const versao = typeof b.versaoDoFormato === 'number' ? b.versaoDoFormato : 1;
  const descartados: string[] = [];
  const filtrar = <T>(lista: unknown, eh: (v: unknown) => v is T, nome: string): T[] => {
    if (lista === undefined) return [];
    if (!Array.isArray(lista)) {
      descartados.push(`A lista de ${nome} não pôde ser lida.`);
      return [];
    }
    const bons = lista.filter(eh);
    if (bons.length < lista.length) descartados.push(`${lista.length - bons.length} registro(s) de ${nome} com dados inválidos ficaram de fora.`);
    return bons;
  };
  return {
    cadastro: {
      versaoDoFormato: VERSAO_DO_CADASTRO,
      malhas: filtrar(b.malhas, ehMalha, 'malhas'),
      rolos: filtrar(b.rolos, ehRolo, 'rolos'),
      ordens: filtrar(b.ordens, ehOrdem, 'ordens'),
    },
    descartados,
    maisNovo: versao > VERSAO_DO_CADASTRO,
  };
}

// ---- Validação: cada mensagem diz o dado e como corrigir.

const mesmoTexto = (a: string, b: string): boolean => a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR');

function textoCurto(valor: string | undefined, nome: string, erros: string[]): void {
  if (valor !== undefined && valor.length > TAMANHO_MAXIMO_DO_TEXTO) erros.push(`${nome}: até ${TAMANHO_MAXIMO_DO_TEXTO} caracteres.`);
}

export function validarMalha(malha: MalhaDoCadastro, outras: readonly MalhaDoCadastro[]): string[] {
  const erros: string[] = [];
  if (malha.descricao.trim() === '') erros.push('Dê uma descrição à malha (por exemplo, “Malha algodão 30/1”).');
  textoCurto(malha.descricao, 'Descrição', erros);
  if (outras.some((m) => m.id !== malha.id && mesmoTexto(m.descricao, malha.descricao))) {
    erros.push(`Já há uma malha “${malha.descricao.trim()}” no cadastro: use outra descrição.`);
  }
  if (!numeroPositivo(malha.larguraUtilMm)) erros.push('Informe a largura útil da malha (maior que zero).');
  if (malha.larguraNominalMm !== undefined && !numeroPositivo(malha.larguraNominalMm)) erros.push('A largura nominal precisa ser maior que zero.');
  if (numeroPositivo(malha.larguraNominalMm) && numeroPositivo(malha.larguraUtilMm) && malha.larguraUtilMm > malha.larguraNominalMm) {
    erros.push('A largura útil não pode passar da largura nominal: confira as duas.');
  }
  if (malha.gramaturaGm2 !== undefined && !numeroPositivo(malha.gramaturaGm2)) erros.push('A gramatura precisa ser maior que zero (g/m²).');
  if (malha.rendimentoMmPorG !== undefined && !numeroPositivo(malha.rendimentoMmPorG)) erros.push('O rendimento precisa ser maior que zero (m/kg).');
  if (malha.espessuraDaFolhaMm !== undefined && !numeroPositivo(malha.espessuraDaFolhaMm)) erros.push('A espessura da folha precisa ser maior que zero (mm).');
  for (const [valor, nome] of [
    [malha.encolhimentoComprimentoPercentual, 'O encolhimento no comprimento'],
    [malha.encolhimentoLarguraPercentual, 'O encolhimento na largura'],
  ] as const) {
    if (valor !== undefined && !(valor >= 0 && valor < 50)) erros.push(`${nome} precisa ficar entre 0 e 50%.`);
  }
  if (malha.toleranciaDeLarguraMm !== undefined && !(malha.toleranciaDeLarguraMm >= 0)) erros.push('A tolerância de largura precisa ser de 0 para cima (mm).');
  textoCurto(malha.composicao, 'Composição', erros);
  textoCurto(malha.tituloDoFio, 'Título do fio', erros);
  return erros;
}

export function validarRolo(rolo: RoloDeEstoque, cadastro: CadastroDeProducao): string[] {
  const erros: string[] = [];
  const malha = cadastro.malhas.find((m) => m.id === rolo.malhaId);
  if (!malha) erros.push('Escolha a malha do rolo (ela precisa estar no cadastro).');
  if (rolo.identificacao.trim() === '') erros.push('Informe a identificação do rolo (a etiqueta).');
  textoCurto(rolo.identificacao, 'Identificação', erros);
  if (cadastro.rolos.some((r) => r.id !== rolo.id && r.malhaId === rolo.malhaId && mesmoTexto(r.identificacao, rolo.identificacao))) {
    erros.push(`Já há um rolo “${rolo.identificacao.trim()}” desta malha: use outra identificação.`);
  }
  if (!numeroPositivo(rolo.pesoLiquidoG) && !numeroPositivo(rolo.comprimentoMedidoMm)) {
    erros.push('Informe o peso líquido ou o comprimento medido do rolo (pelo menos um, maior que zero).');
  }
  if (rolo.pesoLiquidoG !== undefined && !numeroPositivo(rolo.pesoLiquidoG)) erros.push('O peso líquido precisa ser maior que zero.');
  if (rolo.comprimentoMedidoMm !== undefined && !numeroPositivo(rolo.comprimentoMedidoMm)) erros.push('O comprimento medido precisa ser maior que zero.');
  if (rolo.larguraUtilMedidaMm !== undefined && !numeroPositivo(rolo.larguraUtilMedidaMm)) erros.push('A largura útil medida precisa ser maior que zero.');
  if (rolo.defeitos.some((d) => !(d.perdaMm >= 0) || d.descricao.trim() === '')) erros.push('Cada defeito precisa da descrição e da perda (de 0 mm para cima).');
  if (rolo.dataDaMedicao !== undefined && !DATA.test(rolo.dataDaMedicao)) erros.push('A data da medição precisa ser uma data (dia/mês/ano).');
  textoCurto(rolo.lote, 'Lote', erros);
  textoCurto(rolo.tonalidade, 'Tonalidade', erros);
  return erros;
}

export function validarOrdem(ordem: OrdemDeProducao, outras: readonly OrdemDeProducao[]): string[] {
  const erros: string[] = [];
  if (ordem.codigo.trim() === '') erros.push('Informe o código da ordem de produção.');
  textoCurto(ordem.codigo, 'Código', erros);
  if (outras.some((o) => o.id !== ordem.id && mesmoTexto(o.codigo, ordem.codigo))) {
    erros.push(`Já há uma ordem “${ordem.codigo.trim()}” no cadastro: abra a que existe ou use outro código.`);
  }
  const quantidades = Object.entries(ordem.quantidadesPorTamanho);
  if (quantidades.some(([t]) => t.trim() === '')) erros.push('Cada quantidade precisa do nome do tamanho.');
  if (quantidades.some(([, n]) => !Number.isInteger(n) || n < 0)) erros.push('As quantidades precisam ser números inteiros de 0 para cima.');
  else if (!quantidades.some(([, n]) => n > 0)) erros.push('Informe a quantidade de pelo menos um tamanho.');
  if (ordem.prazo !== undefined && !DATA.test(ordem.prazo)) erros.push('O prazo precisa ser uma data (dia/mês/ano).');
  return erros;
}

// ---- Mudanças no cadastro (cada uma devolve um cadastro novo; o que não vale é recusado com a mensagem).

function exigir(erros: readonly string[]): void {
  if (erros.length > 0) throw new Error(erros.join(' '));
}

function trocarOuIncluir<T extends { readonly id: string }>(lista: readonly T[], item: T, maximo: number, nome: string): T[] {
  const i = lista.findIndex((x) => x.id === item.id);
  if (i >= 0) return lista.map((x, j) => (j === i ? item : x));
  if (lista.length >= maximo) throw new Error(`O cadastro tem até ${maximo} ${nome}: tire algum antes.`);
  return [...lista, item];
}

export function salvarMalha(cadastro: CadastroDeProducao, malha: MalhaDoCadastro): CadastroDeProducao {
  const limpa = { ...malha, descricao: malha.descricao.trim() };
  exigir(validarMalha(limpa, cadastro.malhas));
  return { ...cadastro, malhas: trocarOuIncluir(cadastro.malhas, limpa, MAXIMO_DE_MALHAS, 'malhas') };
}

/** Tira a malha. Recusa enquanto houver rolos dela no estoque (eles ficariam sem malha). */
export function removerMalha(cadastro: CadastroDeProducao, id: string): CadastroDeProducao {
  const rolos = cadastro.rolos.filter((r) => r.malhaId === id).length;
  if (rolos > 0) throw new Error(`Há ${rolos} rolo(s) desta malha no estoque: tire-os (ou passe-os para outra malha) antes.`);
  return { ...cadastro, malhas: cadastro.malhas.filter((m) => m.id !== id) };
}

export function salvarRolo(cadastro: CadastroDeProducao, rolo: RoloDeEstoque): CadastroDeProducao {
  const limpo = { ...rolo, identificacao: rolo.identificacao.trim(), lote: rolo.lote.trim(), tonalidade: rolo.tonalidade.trim() };
  exigir(validarRolo(limpo, cadastro));
  return { ...cadastro, rolos: trocarOuIncluir(cadastro.rolos, limpo, MAXIMO_DE_ROLOS, 'rolos') };
}

export function removerRolo(cadastro: CadastroDeProducao, id: string): CadastroDeProducao {
  return { ...cadastro, rolos: cadastro.rolos.filter((r) => r.id !== id) };
}

export function salvarOrdem(cadastro: CadastroDeProducao, ordem: OrdemDeProducao): CadastroDeProducao {
  const limpa = { ...ordem, codigo: ordem.codigo.trim() };
  exigir(validarOrdem(limpa, cadastro.ordens));
  return { ...cadastro, ordens: trocarOuIncluir(cadastro.ordens, limpa, MAXIMO_DE_ORDENS, 'ordens') };
}

export function removerOrdem(cadastro: CadastroDeProducao, id: string): CadastroDeProducao {
  return { ...cadastro, ordens: cadastro.ordens.filter((o) => o.id !== id) };
}

/** As malhas do cadastro antigo (do armazenamento do navegador): entram as que ainda não estão, pela descrição. */
export function incluirMalhasAntigas(
  cadastro: CadastroDeProducao,
  antigas: ReadonlyArray<{
    readonly id: string;
    readonly descricao: string;
    readonly gramaturaGm2?: number;
    readonly rendimentoMmPorG?: number;
    readonly larguraUtilMm: number;
    readonly tubular: boolean;
    readonly sentidoUnico: boolean;
    readonly encolhimentoPercentual?: number;
  }>,
): CadastroDeProducao {
  let atual = cadastro;
  for (const a of antigas) {
    if (atual.malhas.some((m) => mesmoTexto(m.descricao, a.descricao) || m.id === a.id)) continue;
    try {
      atual = salvarMalha(atual, {
        id: a.id,
        descricao: a.descricao,
        larguraUtilMm: a.larguraUtilMm,
        tubular: a.tubular,
        sentidoUnico: a.sentidoUnico,
        padrao: 'liso',
        // O cadastro antigo não dizia se o encolhimento estava no molde: fica "não", e o plano avisa.
        encolhimentoCompensadoNoMolde: false,
        ...(a.gramaturaGm2 !== undefined ? { gramaturaGm2: a.gramaturaGm2 } : {}),
        ...(a.rendimentoMmPorG !== undefined ? { rendimentoMmPorG: a.rendimentoMmPorG } : {}),
        ...(a.encolhimentoPercentual !== undefined ? { encolhimentoComprimentoPercentual: a.encolhimentoPercentual } : {}),
      });
    } catch {
      // Uma malha antiga que não vale mais (descrição repetida, largura) fica de fora; o resto entra.
    }
  }
  return atual;
}

// ---- Rolos no plano

export const SEM_LOTE = '(sem lote)';
export const SEM_TONALIDADE = '(sem tonalidade)';

/** O grupo do rolo: lote e tonalidade. Rolos de grupos diferentes não são equivalentes. */
export function grupoDoRolo(rolo: Pick<RoloDeEstoque, 'lote' | 'tonalidade'>): string {
  return `${rolo.lote.trim() || SEM_LOTE} · ${rolo.tonalidade.trim() || SEM_TONALIDADE}`;
}

export interface ComprimentoDoRolo {
  readonly comprimentoMm: number;
  /** `medido`: o comprimento medido; `pelo peso`: peso × rendimento — uma estimativa. */
  readonly origem: 'medido' | 'pelo peso';
}

/** O comprimento do rolo: o medido, ou o do peso pelo rendimento (estimado). `null` se não há como saber. */
export function comprimentoDoRolo(rolo: Pick<RoloDeEstoque, 'comprimentoMedidoMm' | 'pesoLiquidoG'>, rendimentoMmPorG: number | null): ComprimentoDoRolo | null {
  if (numeroPositivo(rolo.comprimentoMedidoMm)) return { comprimentoMm: rolo.comprimentoMedidoMm, origem: 'medido' };
  if (numeroPositivo(rolo.pesoLiquidoG) && rendimentoMmPorG !== null && numeroPositivo(rendimentoMmPorG)) {
    return { comprimentoMm: rolo.pesoLiquidoG * rendimentoMmPorG, origem: 'pelo peso' };
  }
  return null;
}

// ---- Ordem colada de uma planilha

export interface GradeColada {
  readonly quantidades: Record<string, number>;
  readonly erros: string[];
}

/**
 * A grade colada de uma planilha: duas linhas (os tamanhos, e as quantidades embaixo) ou um tamanho por linha
 * ("P; 40" ou "P<tab>40"). Separadores aceitos: tabulação, ponto e vírgula e espaços.
 */
export function lerGradeColada(texto: string): GradeColada {
  const linhas = texto
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== '')
    .map((l) => l.split(/\t|;|\s+/).map((c) => c.trim()).filter((c) => c !== ''));
  const erros: string[] = [];
  const quantidades: Record<string, number> = {};
  const inteiro = (c: string): number | null => (/^\d+$/.test(c) ? Number(c) : null);
  const guardar = (tamanho: string, valor: string): void => {
    const n = inteiro(valor);
    if (n === null) erros.push(`A quantidade do tamanho ${tamanho} (“${valor}”) não é um número inteiro.`);
    else if (tamanho in quantidades) erros.push(`O tamanho ${tamanho} aparece duas vezes.`);
    else quantidades[tamanho] = n;
  };
  if (linhas.length === 0) return { quantidades, erros: ['Nada foi colado.'] };
  const soNumeros = (l: readonly string[]): boolean => l.every((c) => inteiro(c) !== null);
  const [primeira, segunda] = linhas;
  const deitada = linhas.length === 2 && primeira!.length === segunda!.length && soNumeros(segunda!);
  if (deitada && primeira!.length === 2 && soNumeros(primeira!)) {
    // "36 38 / 10 20" e "36 10 / 38 20" se escrevem igual: não dá para saber qual é o tamanho. Com ponto e
    // vírgula, vale um tamanho por linha (como a mensagem pede).
    if (texto.includes(';')) for (const [t, v] of linhas) guardar(t!, v!);
    else erros.push('Com dois tamanhos numéricos, a grade fica ambígua: cole um tamanho e a quantidade por linha, separados por ponto e vírgula (36;10).');
  } else if (deitada && (primeira!.length > 2 || inteiro(primeira![1]!) === null)) {
    primeira!.forEach((t, i) => guardar(t, segunda![i]!));
  } else if (linhas.every((l) => l.length === 2)) {
    for (const [t, v] of linhas) guardar(t!, v!);
  } else {
    erros.push('Não deu para ler a grade: cole duas linhas (os tamanhos e, embaixo, as quantidades) ou um tamanho e a quantidade por linha.');
  }
  return { quantidades, erros };
}

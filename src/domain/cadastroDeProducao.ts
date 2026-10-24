import { ehTipoDeTecido, problemaDoCusto, type CustoDoTecido, type PadraoDoTecido, type TipoDeTecido } from './tecido';
import { rendimentoPelaGramatura } from './planoDeCorte';

/**
 * O cadastro de produção do planejamento de corte: as malhas que a fábrica usa, os rolos em estoque e as ordens de
 * produção. Fica num arquivo próprio (`cadastro-de-producao.json`, ao lado dos projetos), e vale para todos os
 * projetos deste computador. Unidades internas: mm, g, g/m², mm/g (o mesmo número que m/kg). As datas são ISO.
 *
 * Nada aqui decide o plano: o cadastro só guarda o que foi informado, com a origem de cada medida, e diz o que está
 * faltando ou não confere.
 */

/**
 * 2: os defeitos com posição e os movimentos de estoque (reserva, baixa, estorno).
 * 3: a execução do corte (situação, consumo real, camadas, tempos) e o rolo marcado como retalho (ADR 0098). O arquivo
 * da versão 2 é lido como está (sem execuções), e é copiado para as cópias de segurança antes da primeira gravação.
 */
export const VERSAO_DO_CADASTRO = 3;
export const MAXIMO_DE_MOVIMENTOS = 50_000;
export const MAXIMO_DE_EXECUCOES = 5000;
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
  /** A malha é tubular: é o que o plano usa (a largura na mesa, os avisos). Com o tipo informado, os dois conferem. */
  readonly tubular: boolean;
  /**
   * Ramado ou tubular, quando informado. As malhas de antes não têm: a marcada como tubular é tubular, e a não marcada
   * fica "não informado" (não é tomada por ramada).
   */
  readonly tipoDeTecido?: TipoDeTecido;
  /** O custo da malha; ausente: não informado. Só a estimativa de custo do plano o usa. */
  readonly custo?: CustoDoTecido;
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
  /**
   * Listras e xadrez: a repetição do desenho (o rapport) no comprimento e na largura, e a fase (onde a linha de
   * referência cai, do começo do risco e da borda da malha). Com elas, o risco pode casar o desenho (ver
   * `Casamento` em risco.ts); sem elas, o casamento é feito à parte.
   */
  readonly rapportComprimentoMm?: number;
  readonly rapportLarguraMm?: number;
  readonly faseComprimentoMm?: number;
  readonly faseLarguraMm?: number;
  /** De onde vem o valor do encolhimento. */
  readonly fonteDoEncolhimento?: 'ensaio-de-lavagem' | 'fornecedor' | 'estimativa';
  /** Quanto a largura útil de um rolo pode ficar abaixo da do cadastro sem ser um problema (mm). */
  readonly toleranciaDeLarguraMm?: number;
  /** A espessura de uma folha (mm), para o limite de altura do enfesto. */
  readonly espessuraDaFolhaMm?: number;
  readonly observacoes?: string;
}

export type TipoDeDefeito = 'furo' | 'mancha' | 'fio-puxado' | 'barramento' | 'falha-de-tinturaria' | 'outro';

export const ROTULO_DO_DEFEITO: Readonly<Record<TipoDeDefeito, string>> = {
  furo: 'Furo',
  mancha: 'Mancha',
  'fio-puxado': 'Fio puxado',
  barramento: 'Barramento',
  'falha-de-tinturaria': 'Falha de tinturaria',
  outro: 'Outro',
};

export interface DefeitoDoRolo {
  readonly descricao: string;
  /** A extensão do defeito no comprimento do rolo (mm): o quanto ele tira. */
  readonly perdaMm: number;
  /**
   * Onde o defeito começa, medido do começo do rolo (mm). Com ela, o plano tira só o trecho do defeito e as
   * camadas não passam por cima dele; sem ela, o defeito não é evitado (o plano pede uma decisão).
   */
  readonly posicaoMm?: number;
  /** Quanto da largura o defeito pega (mm), quando se sabe. */
  readonly larguraAfetadaMm?: number;
  readonly tipo?: TipoDeDefeito;
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
  /** O que sobrou do rolo depois de um corte, guardado como retalho (ADR 0098): continua no estoque, com o saldo dele. */
  readonly retalho?: boolean;
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

/**
 * Um movimento de estoque de um rolo, ligado a um plano de corte confirmado. Os movimentos nunca são apagados nem
 * mudados: desfazer é um estorno (outro movimento, que aponta o que desfaz).
 * - reserva: o comprimento separado para o plano (sai do disponível, continua no saldo físico);
 * - baixa: o comprimento consumido pelo plano (sai do saldo físico; a reserva do mesmo plano e rolo deixa de valer);
 * - estorno: desfaz uma reserva ou uma baixa.
 */
export type TipoDeMovimento = 'reserva' | 'baixa' | 'estorno';

export interface MovimentoDeEstoque {
  readonly id: string;
  readonly tipo: TipoDeMovimento;
  readonly roloId: string;
  readonly planoId: string;
  readonly projetoId: string;
  /** O comprimento movimentado (mm). */
  readonly comprimentoMm: number;
  /** O peso equivalente (g), pelo rendimento da malha, quando há. */
  readonly pesoG?: number;
  readonly dataIso: string;
  /** Informado por quem fez o movimento (o programa não tem login). */
  readonly responsavel: string;
  readonly motivo?: string;
  /** No estorno: o movimento desfeito. */
  readonly estornaId?: string;
}

/**
 * A execução de um plano confirmado na sala de corte (ADR 0098): liberada → em corte → concluída (ou cancelada). O
 * plano continua como foi confirmado; a execução guarda o que de fato aconteceu — quem liberou e quem cortou (os nomes
 * são informados: o programa não tem login), as horas, as camadas enfestadas e o consumo real de malha.
 */
export type SituacaoDaExecucao = 'liberada' | 'em-corte' | 'concluida' | 'cancelada';

/** O consumo de um rolo no corte: o do plano e o real (o que saiu do rolo: as camadas e as pontas). */
export interface ConsumoRealDoRolo {
  readonly roloId: string;
  readonly planejadoMm: number;
  readonly realMm: number;
  /** O que sobrou do rolo foi guardado como retalho. */
  readonly sobraViraRetalho: boolean;
}

export interface ExecucaoDoCorte {
  readonly id: string;
  readonly planoId: string;
  readonly projetoId: string;
  /** O código da ordem do plano (para a lista). */
  readonly ordem: string;
  readonly situacao: SituacaoDaExecucao;
  readonly camadasPlanejadas: number;
  readonly consumoPlanejadoMm: number;
  readonly liberadaEmIso: string;
  readonly liberadaPor: string;
  readonly iniciadaEmIso?: string;
  readonly operador?: string;
  readonly concluidaEmIso?: string;
  readonly concluidaPor?: string;
  readonly camadasRealizadas?: number;
  readonly consumoRealMm?: number;
  /** Nos planos com rolos: o consumo de cada um. */
  readonly consumoPorRolo?: readonly ConsumoRealDoRolo[];
  readonly canceladaEmIso?: string;
  readonly canceladaPor?: string;
  readonly motivoDoCancelamento?: string;
  readonly observacoes?: string;
}

export interface CadastroDeProducao {
  readonly versaoDoFormato: number;
  readonly malhas: readonly MalhaDoCadastro[];
  readonly rolos: readonly RoloDeEstoque[];
  readonly ordens: readonly OrdemDeProducao[];
  readonly movimentos: readonly MovimentoDeEstoque[];
  readonly execucoes: readonly ExecucaoDoCorte[];
}

export const CADASTRO_VAZIO: CadastroDeProducao = { versaoDoFormato: VERSAO_DO_CADASTRO, malhas: [], rolos: [], ordens: [], movimentos: [], execucoes: [] };

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
    (m.tipoDeTecido === undefined || (ehTipoDeTecido(m.tipoDeTecido) && (m.tipoDeTecido === 'tubular') === m.tubular)) &&
    (m.custo === undefined || problemaDoCusto(m.custo) === null) &&
    typeof m.sentidoUnico === 'boolean' &&
    (m.padrao === 'liso' || m.padrao === 'listrado' || m.padrao === 'xadrez') &&
    typeof m.encolhimentoCompensadoNoMolde === 'boolean' &&
    (m.fonteDoEncolhimento === undefined || m.fonteDoEncolhimento === 'ensaio-de-lavagem' || m.fonteDoEncolhimento === 'fornecedor' || m.fonteDoEncolhimento === 'estimativa') &&
    positivoOuAusente(m.gramaturaGm2) &&
    positivoOuAusente(m.larguraNominalMm) &&
    positivoOuAusente(m.rendimentoMmPorG) &&
    positivoOuAusente(m.espessuraDaFolhaMm) &&
    positivoOuAusente(m.rapportComprimentoMm) &&
    positivoOuAusente(m.rapportLarguraMm) &&
    (m.faseComprimentoMm === undefined || (typeof m.faseComprimentoMm === 'number' && m.faseComprimentoMm >= 0)) &&
    (m.faseLarguraMm === undefined || (typeof m.faseLarguraMm === 'number' && m.faseLarguraMm >= 0)) &&
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
      return (
        typeof x === 'object' &&
        x !== null &&
        ehTexto(x.descricao) &&
        typeof x.perdaMm === 'number' &&
        x.perdaMm >= 0 &&
        (x.posicaoMm === undefined || (typeof x.posicaoMm === 'number' && x.posicaoMm >= 0)) &&
        positivoOuAusente(x.larguraAfetadaMm) &&
        (x.tipo === undefined || (typeof x.tipo === 'string' && x.tipo in ROTULO_DO_DEFEITO))
      );
    }) &&
    (r.unidadeDoPeso === 'kg' || r.unidadeDoPeso === 'g') &&
    (r.unidadeDoComprimento === 'm' || r.unidadeDoComprimento === 'cm' || r.unidadeDoComprimento === 'mm') &&
    typeof r.indisponivel === 'boolean' &&
    (r.retalho === undefined || typeof r.retalho === 'boolean') &&
    positivoOuAusente(r.pesoLiquidoG) &&
    positivoOuAusente(r.comprimentoMedidoMm) &&
    positivoOuAusente(r.larguraUtilMedidaMm) &&
    (numeroPositivo(r.pesoLiquidoG) || numeroPositivo(r.comprimentoMedidoMm)) &&
    (r.dataDaMedicao === undefined || (ehTexto(r.dataDaMedicao) && DATA.test(r.dataDaMedicao))) &&
    [r.localizacao, r.origemDaMedicao, r.observacoes].every(textoOuAusente)
  );
}

function ehMovimento(v: unknown): v is MovimentoDeEstoque {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    ehTexto(m.id) &&
    (m.tipo === 'reserva' || m.tipo === 'baixa' || m.tipo === 'estorno') &&
    ehTexto(m.roloId) &&
    ehTexto(m.planoId) &&
    ehTexto(m.projetoId) &&
    typeof m.comprimentoMm === 'number' &&
    Number.isFinite(m.comprimentoMm) &&
    m.comprimentoMm >= 0 &&
    positivoOuAusente(m.pesoG) &&
    ehTexto(m.dataIso) &&
    ehTexto(m.responsavel) &&
    textoOuAusente(m.motivo) &&
    (m.tipo === 'estorno' ? ehTexto(m.estornaId) : m.estornaId === undefined)
  );
}

const naoNegativo = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const inteiroNaoNegativo = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0;

function ehExecucao(v: unknown): v is ExecucaoDoCorte {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  const situacoes: readonly unknown[] = ['liberada', 'em-corte', 'concluida', 'cancelada'];
  const consumoOk =
    e.consumoPorRolo === undefined ||
    (Array.isArray(e.consumoPorRolo) &&
      e.consumoPorRolo.every((c: unknown) => {
        const x = c as Record<string, unknown> | null;
        return typeof x === 'object' && x !== null && ehTexto(x.roloId) && naoNegativo(x.planejadoMm) && naoNegativo(x.realMm) && typeof x.sobraViraRetalho === 'boolean';
      }));
  return (
    ehTexto(e.id) &&
    ehTexto(e.planoId) &&
    ehTexto(e.projetoId) &&
    ehTexto(e.ordem) &&
    situacoes.includes(e.situacao) &&
    inteiroNaoNegativo(e.camadasPlanejadas) &&
    naoNegativo(e.consumoPlanejadoMm) &&
    ehTexto(e.liberadaEmIso) &&
    ehTexto(e.liberadaPor) &&
    (e.camadasRealizadas === undefined || inteiroNaoNegativo(e.camadasRealizadas)) &&
    (e.consumoRealMm === undefined || naoNegativo(e.consumoRealMm)) &&
    consumoOk &&
    // Cada situação com o que ela tem de ter: em corte, quem corta e quando começou; concluída, também o consumo real.
    (e.situacao === 'liberada' || e.situacao === 'cancelada' || (ehTexto(e.iniciadaEmIso) && ehTexto(e.operador))) &&
    (e.situacao !== 'concluida' || (ehTexto(e.concluidaEmIso) && ehTexto(e.concluidaPor) && naoNegativo(e.consumoRealMm) && inteiroNaoNegativo(e.camadasRealizadas))) &&
    (e.situacao !== 'cancelada' || (ehTexto(e.canceladaEmIso) && ehTexto(e.canceladaPor) && ehTexto(e.motivoDoCancelamento))) &&
    [e.iniciadaEmIso, e.operador, e.concluidaEmIso, e.concluidaPor, e.canceladaEmIso, e.canceladaPor, e.motivoDoCancelamento, e.observacoes].every(textoOuAusente)
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
      // Da versão 1 para a 2 só entram os movimentos (vazios) e os campos opcionais dos defeitos.
      movimentos: filtrar(b.movimentos, ehMovimento, 'movimentos de estoque'),
      // Da 2 para a 3, as execuções do corte (vazias) e a marca de retalho do rolo (ausente).
      execucoes: filtrar(b.execucoes, ehExecucao, 'execuções do corte'),
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
  for (const [valor, nome] of [
    [malha.rapportComprimentoMm, 'A repetição do desenho no comprimento'],
    [malha.rapportLarguraMm, 'A repetição do desenho na largura'],
  ] as const) {
    if (valor !== undefined && !(valor > 0)) erros.push(`${nome} precisa ser maior que zero (mm).`);
  }
  for (const [valor, nome] of [
    [malha.faseComprimentoMm, 'A fase do desenho no comprimento'],
    [malha.faseLarguraMm, 'A fase do desenho na largura'],
  ] as const) {
    if (valor !== undefined && !(valor >= 0)) erros.push(`${nome} precisa ser de 0 para cima (mm).`);
  }
  textoCurto(malha.composicao, 'Composição', erros);
  textoCurto(malha.tituloDoFio, 'Título do fio', erros);
  if (malha.tipoDeTecido !== undefined && (!ehTipoDeTecido(malha.tipoDeTecido) || (malha.tipoDeTecido === 'tubular') !== malha.tubular)) {
    erros.push('O tipo de tecido é ramado ou tubular, e precisa conferir com a malha tubular.');
  }
  if (malha.custo !== undefined) {
    const problema = problemaDoCusto(malha.custo);
    if (problema) erros.push(problema);
  }
  return erros;
}

/** O tipo da malha: o informado; nas malhas de antes, a marcada como tubular é tubular e a outra não está informada. */
export function tipoDeTecidoDaMalha(malha: Pick<MalhaDoCadastro, 'tubular' | 'tipoDeTecido'>): TipoDeTecido | null {
  return malha.tipoDeTecido ?? (malha.tubular ? 'tubular' : null);
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
  if (rolo.defeitos.some((d) => d.posicaoMm !== undefined && !(d.posicaoMm >= 0))) erros.push('A posição de um defeito precisa ser de 0 para cima (medida do começo do rolo).');
  if (rolo.comprimentoMedidoMm !== undefined && rolo.defeitos.some((d) => d.posicaoMm !== undefined && d.posicaoMm + d.perdaMm > rolo.comprimentoMedidoMm! + 0.5)) {
    erros.push('Um defeito passa do fim do rolo (posição + extensão maior que o comprimento medido): confira.');
  }
  if (rolo.defeitos.some((d) => d.larguraAfetadaMm !== undefined && !(d.larguraAfetadaMm > 0))) erros.push('A largura afetada de um defeito precisa ser maior que zero.');
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

// ---- Estoque: o estado de cada rolo pelos movimentos, e as operações (sempre um movimento novo, nunca apagar)

/**
 * O casamento que a malha permite (a repetição e a fase cadastradas), ou `null` se ela é lisa ou não tem a
 * repetição: aí o casamento não é automático.
 */
export function casamentoDaMalha(malha: MalhaDoCadastro): { readonly rapportComprimentoMm?: number; readonly rapportLarguraMm?: number; readonly faseComprimentoMm: number; readonly faseLarguraMm: number } | null {
  if (malha.padrao === 'liso') return null;
  const comprimento = numeroPositivo(malha.rapportComprimentoMm) ? malha.rapportComprimentoMm : undefined;
  const largura = numeroPositivo(malha.rapportLarguraMm) ? malha.rapportLarguraMm : undefined;
  if (comprimento === undefined && largura === undefined) return null;
  return {
    ...(comprimento !== undefined ? { rapportComprimentoMm: comprimento } : {}),
    ...(largura !== undefined ? { rapportLarguraMm: largura } : {}),
    faseComprimentoMm: malha.faseComprimentoMm ?? 0,
    faseLarguraMm: malha.faseLarguraMm ?? 0,
  };
}

/**
 * O rendimento da malha para converter peso em comprimento: o informado, ou o pela gramatura — na tubular, com as
 * duas folhas do tubo achatado (ADR 0098).
 */
export function rendimentoDaMalha(
  malha: (Pick<MalhaDoCadastro, 'rendimentoMmPorG' | 'gramaturaGm2' | 'larguraUtilMm'> & { readonly tubular?: boolean }) | undefined,
): number | null {
  if (!malha) return null;
  if (numeroPositivo(malha.rendimentoMmPorG)) return malha.rendimentoMmPorG;
  if (numeroPositivo(malha.gramaturaGm2) && numeroPositivo(malha.larguraUtilMm)) return rendimentoPelaGramatura(malha.larguraUtilMm, malha.gramaturaGm2, malha.tubular === true);
  return null;
}

/** Os movimentos que valem: as reservas e baixas não estornadas, sem as reservas já trocadas pela baixa do mesmo plano e rolo. */
export function movimentosAtivos(movimentos: readonly MovimentoDeEstoque[]): MovimentoDeEstoque[] {
  const estornados = new Set(movimentos.filter((m) => m.tipo === 'estorno').map((m) => m.estornaId!));
  const vivos = movimentos.filter((m) => m.tipo !== 'estorno' && !estornados.has(m.id));
  const baixas = new Set(vivos.filter((m) => m.tipo === 'baixa').map((m) => `${m.planoId}|${m.roloId}`));
  return vivos.filter((m) => m.tipo === 'baixa' || !baixas.has(`${m.planoId}|${m.roloId}`));
}

export interface EstadoDoRolo {
  /** O comprimento do rolo como entrou (medido, ou peso × rendimento), ou `null` se não há como saber. */
  readonly inicialMm: number | null;
  readonly origem: 'medido' | 'pelo peso' | null;
  readonly consumidoMm: number;
  readonly reservadoMm: number;
  /** Reservado por outros planos (sem contar `excetoPlanoId`). */
  readonly reservadoPorOutrosMm: number;
  /** O que ainda existe do rolo: o inicial menos o consumido. */
  readonly saldoFisicoMm: number | null;
  /** O que pode ir para um plano novo: o saldo físico menos o reservado (por outros planos). */
  readonly disponivelMm: number | null;
}

export function estadoDoRolo(cadastro: CadastroDeProducao, rolo: RoloDeEstoque, excetoPlanoId?: string): EstadoDoRolo {
  const malha = cadastro.malhas.find((m) => m.id === rolo.malhaId);
  const inicial = comprimentoDoRolo(rolo, rendimentoDaMalha(malha));
  const doRolo = movimentosAtivos(cadastro.movimentos).filter((m) => m.roloId === rolo.id);
  const consumidoMm = doRolo.filter((m) => m.tipo === 'baixa').reduce((s, m) => s + m.comprimentoMm, 0);
  const reservadoMm = doRolo.filter((m) => m.tipo === 'reserva').reduce((s, m) => s + m.comprimentoMm, 0);
  const reservadoPorOutrosMm = doRolo.filter((m) => m.tipo === 'reserva' && m.planoId !== excetoPlanoId).reduce((s, m) => s + m.comprimentoMm, 0);
  const saldoFisicoMm = inicial ? Math.max(0, inicial.comprimentoMm - consumidoMm) : null;
  return {
    inicialMm: inicial?.comprimentoMm ?? null,
    origem: inicial?.origem ?? null,
    consumidoMm,
    reservadoMm,
    reservadoPorOutrosMm,
    saldoFisicoMm,
    disponivelMm: saldoFisicoMm === null ? null : Math.max(0, saldoFisicoMm - reservadoPorOutrosMm),
  };
}

export interface UsoDoRolo {
  readonly roloId: string;
  readonly comprimentoMm: number;
}

export interface DadosDoMovimento {
  readonly planoId: string;
  readonly projetoId: string;
  readonly responsavel: string;
  readonly agoraIso: string;
  readonly novoId: () => string;
  readonly motivo?: string;
}

export interface ResultadoDoMovimento {
  readonly cadastro: CadastroDeProducao;
  /** Os rolos em que o movimento foi feito agora. */
  readonly feitos: readonly string[];
  /** Os rolos em que ele já estava feito (não se repete). */
  readonly jaFeitos: readonly string[];
}

function movimentar(cadastro: CadastroDeProducao, tipo: 'reserva' | 'baixa', usos: readonly UsoDoRolo[], dados: DadosDoMovimento): ResultadoDoMovimento {
  if (dados.responsavel.trim() === '') throw new Error('Informe quem está fazendo o movimento de estoque.');
  const ativos = movimentosAtivos(cadastro.movimentos);
  const novos: MovimentoDeEstoque[] = [];
  const feitos: string[] = [];
  const jaFeitos: string[] = [];
  const erros: string[] = [];
  for (const uso of usos) {
    if (!(uso.comprimentoMm > 0)) continue;
    const rolo = cadastro.rolos.find((r) => r.id === uso.roloId);
    if (!rolo) {
      erros.push(`O rolo do plano (${uso.roloId}) não está mais no cadastro.`);
      continue;
    }
    // Sem repetir: a mesma operação do mesmo plano no mesmo rolo já feita (e não estornada) não é feita de novo.
    if (ativos.some((m) => m.tipo === tipo && m.planoId === dados.planoId && m.roloId === rolo.id)) {
      jaFeitos.push(rolo.identificacao);
      continue;
    }
    if (tipo === 'reserva' && ativos.some((m) => m.tipo === 'baixa' && m.planoId === dados.planoId && m.roloId === rolo.id)) {
      jaFeitos.push(rolo.identificacao);
      continue;
    }
    const estado = estadoDoRolo(cadastro, rolo, dados.planoId);
    const limite = tipo === 'reserva' ? estado.disponivelMm : estado.saldoFisicoMm;
    if (limite !== null && uso.comprimentoMm > limite + 0.5) {
      erros.push(
        `O rolo ${rolo.identificacao} tem ${(limite / 1000).toFixed(2).replace('.', ',')} m ${tipo === 'reserva' ? 'disponíveis' : 'de saldo'}, menos que os ${(uso.comprimentoMm / 1000).toFixed(2).replace('.', ',')} m do plano.`,
      );
      continue;
    }
    const malha = cadastro.malhas.find((m) => m.id === rolo.malhaId);
    const rendimento = rendimentoDaMalha(malha);
    novos.push({
      id: dados.novoId(),
      tipo,
      roloId: rolo.id,
      planoId: dados.planoId,
      projetoId: dados.projetoId,
      comprimentoMm: uso.comprimentoMm,
      ...(rendimento !== null ? { pesoG: uso.comprimentoMm / rendimento } : {}),
      dataIso: dados.agoraIso,
      responsavel: dados.responsavel.trim(),
      ...(dados.motivo ? { motivo: dados.motivo } : {}),
    });
    feitos.push(rolo.identificacao);
  }
  // Tudo ou nada: com um erro, nenhum movimento entra.
  if (erros.length > 0) throw new Error(erros.join(' '));
  if (cadastro.movimentos.length + novos.length > MAXIMO_DE_MOVIMENTOS) throw new Error('O histórico de estoque chegou ao limite deste cadastro.');
  return { cadastro: { ...cadastro, movimentos: [...cadastro.movimentos, ...novos] }, feitos, jaFeitos };
}

/** Reserva os rolos do plano (o comprimento que o plano usa de cada um). Repetir não reserva de novo. */
export function reservarPlano(cadastro: CadastroDeProducao, usos: readonly UsoDoRolo[], dados: DadosDoMovimento): ResultadoDoMovimento {
  return movimentar(cadastro, 'reserva', usos, dados);
}

/** Dá baixa do que o plano consumiu de cada rolo. A reserva do mesmo plano deixa de valer. Repetir não baixa de novo. */
export function darBaixaDoPlano(cadastro: CadastroDeProducao, usos: readonly UsoDoRolo[], dados: DadosDoMovimento): ResultadoDoMovimento {
  return movimentar(cadastro, 'baixa', usos, dados);
}

/** Desfaz um movimento (reserva ou baixa) com um estorno; o histórico fica. */
export function estornarMovimento(
  cadastro: CadastroDeProducao,
  movimentoId: string,
  dados: { readonly responsavel: string; readonly motivo: string; readonly agoraIso: string; readonly novoId: () => string },
): CadastroDeProducao {
  const alvo = cadastro.movimentos.find((m) => m.id === movimentoId);
  if (!alvo) throw new Error('Este movimento não está no histórico.');
  if (alvo.tipo === 'estorno') throw new Error('Um estorno não se estorna: faça o movimento de novo, se for o caso.');
  if (cadastro.movimentos.some((m) => m.tipo === 'estorno' && m.estornaId === movimentoId)) throw new Error('Este movimento já foi estornado.');
  if (dados.responsavel.trim() === '') throw new Error('Informe quem está estornando.');
  if (dados.motivo.trim() === '') throw new Error('Diga o motivo do estorno.');
  const estorno: MovimentoDeEstoque = {
    id: dados.novoId(),
    tipo: 'estorno',
    roloId: alvo.roloId,
    planoId: alvo.planoId,
    projetoId: alvo.projetoId,
    comprimentoMm: alvo.comprimentoMm,
    ...(alvo.pesoG !== undefined ? { pesoG: alvo.pesoG } : {}),
    dataIso: dados.agoraIso,
    responsavel: dados.responsavel.trim(),
    motivo: dados.motivo.trim(),
    estornaId: alvo.id,
  };
  return { ...cadastro, movimentos: [...cadastro.movimentos, estorno] };
}

/** Os movimentos de um plano (para a tela do plano), do mais antigo ao mais novo, com o que ainda vale marcado. */
export function movimentosDoPlano(cadastro: CadastroDeProducao, planoId: string): Array<MovimentoDeEstoque & { readonly ativo: boolean; readonly estornado: boolean }> {
  const ativos = new Set(movimentosAtivos(cadastro.movimentos).map((m) => m.id));
  const estornados = new Set(cadastro.movimentos.filter((m) => m.tipo === 'estorno').map((m) => m.estornaId!));
  return cadastro.movimentos.filter((m) => m.planoId === planoId).map((m) => ({ ...m, ativo: ativos.has(m.id), estornado: estornados.has(m.id) }));
}

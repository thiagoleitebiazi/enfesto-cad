import { perimetro } from '../core/geometria';
import { numeroComVirgula } from '../core/numeros';
import type { Molde, RestricaoDeRotacao } from '../domain/molde';
import { tecidoDaPeca } from '../domain/tecidosDoModelo';

/**
 * "Moldes no encaixe" (ADR 0199): o que aparece em cada peça na tela, sem mudar o que sai na impressão; os pacotes do
 * encaixe; e as opções gerais do encaixe, lembradas neste computador.
 */

export type AtributoDaVisao = 'nome' | 'preencher' | 'fio' | 'numeros' | 'graduacao' | 'piques' | 'descricao' | 'linhas' | 'costura' | 'perimetro' | 'tamanho' | 'tecido' | 'quantidade' | 'giro';

export const ROTULO_DO_ATRIBUTO: Readonly<Record<AtributoDaVisao, string>> = {
  nome: 'Nome',
  preencher: 'Preencher com a cor',
  fio: 'Fio',
  numeros: 'Números dos pontos',
  graduacao: 'Graduação',
  piques: 'Piques',
  descricao: 'Descrição',
  linhas: 'Linhas auxiliares',
  costura: 'Costura',
  perimetro: 'Perímetro do molde',
  tamanho: 'Nome da graduação',
  tecido: 'Tecido',
  quantidade: 'Quantidade',
  giro: 'Giro',
};

export type VisaoDasPecas = Readonly<Record<AtributoDaVisao, boolean>>;

export const VISAO_PADRAO: VisaoDasPecas = { nome: true, preencher: true, fio: true, numeros: true, graduacao: true, piques: true, descricao: false, linhas: true, costura: true, perimetro: false, tamanho: false, tecido: false, quantidade: false, giro: false };

type Leitura = { getItem(chave: string): string | null };
type Escrita = { setItem(chave: string, valor: string): void };

const CHAVE_DA_VISAO = 'enfesto-cad:visao-das-pecas';

export function visaoGuardada(a: Leitura): VisaoDasPecas {
  try {
    return { ...VISAO_PADRAO, ...(JSON.parse(a.getItem(CHAVE_DA_VISAO) ?? '{}') as Partial<VisaoDasPecas>) };
  } catch {
    return VISAO_PADRAO;
  }
}

export function guardarVisao(a: Escrita, visao: VisaoDasPecas): void {
  a.setItem(CHAVE_DA_VISAO, JSON.stringify(visao));
}

/** O texto que acompanha a peça, com o que a visão pede. */
export function rotuloDaPeca(peca: Molde, visao: VisaoDasPecas, pacote: string | null = null): string {
  const partes = [
    pacote,
    visao.nome ? peca.nome : null,
    visao.tamanho && peca.tamanho ? peca.tamanho : null,
    visao.tecido ? tecidoDaPeca(peca) : null,
    visao.descricao && peca.descricao ? peca.descricao : null,
    visao.quantidade ? `${peca.quantidade}×` : null,
    visao.giro ? `${numeroComVirgula(peca.anguloDeRotacaoGraus, 1)}°` : null,
    visao.perimetro ? `${numeroComVirgula(perimetro(peca.contorno) / 10, 1)} cm` : null,
    peca.meiaCamada ? '(½ camada)' : null,
  ];
  return partes.filter((p) => p !== null).join(' · ');
}

const CORES_DOS_PACOTES = ['#ffd8a8', '#b2f2bb', '#a5d8ff', '#eebefa', '#ffec99', '#99e9f2', '#fcc2d7', '#d0bfff'] as const;

/** O pacote da peça: o tamanho e o número da cópia que o encaixe deu a ela. */
export function pacoteDaPeca(peca: Molde): string {
  const copia = /#(\d+)$/.exec(peca.id)?.[1] ?? '0';
  return `${peca.tamanho}#${copia}`;
}

export const pacotesDoEncaixe = (pecas: readonly Molde[]): string[] => [...new Set(pecas.map(pacoteDaPeca))].sort();

export type CodigoDosPacotes = 'alfanumerico' | 'numerico';

/** "Código dos pacotes": A, B... Z, AA, ou 1, 2... */
export function codigoDoPacote(indice: number, modo: CodigoDosPacotes): string {
  if (modo === 'numerico') return String(indice + 1);
  let codigo = '';
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) codigo = String.fromCharCode(65 + ((n - 1) % 26)) + codigo;
  return codigo;
}

/** A cor do pacote: a escolhida para a posição dele, ou a da paleta. */
export const corDoPacote = (indice: number, escolhidas: readonly string[] = []): string => escolhidas[indice] ?? CORES_DOS_PACOTES[indice % CORES_DOS_PACOTES.length]!;

export const QUANTAS_CORES_DE_PACOTE = CORES_DOS_PACOTES.length;

export interface OpcoesDoEncaixe {
  /** O giro de Ctrl+setas (graus). */
  readonly anguloDeGiro: number;
  /** As casas decimais das medidas da barra de status; `null`, as de sempre. */
  readonly precisao: number | null;
  /** O clique numa peça da lista põe na mesa a que está fora dela. */
  readonly encaixaAoClicar: boolean;
  /** A peça solta anda no rumo do arrasto até encostar: o SNAP do encaixe. */
  readonly encostarAoSoltar: boolean;
  readonly verificarAoPlotar: boolean;
  readonly codigoDosPacotes: CodigoDosPacotes;
  readonly coresDosPacotes?: readonly string[];
}

export const OPCOES_PADRAO_DO_ENCAIXE: OpcoesDoEncaixe = { anguloDeGiro: 90, precisao: null, encaixaAoClicar: false, encostarAoSoltar: false, verificarAoPlotar: true, codigoDosPacotes: 'alfanumerico' };

const CHAVE_DAS_OPCOES = 'enfesto-cad:opcoes-do-encaixe';

export function opcoesDoEncaixeGuardadas(a: Leitura): OpcoesDoEncaixe {
  try {
    return { ...OPCOES_PADRAO_DO_ENCAIXE, ...(JSON.parse(a.getItem(CHAVE_DAS_OPCOES) ?? '{}') as Partial<OpcoesDoEncaixe>) };
  } catch {
    return OPCOES_PADRAO_DO_ENCAIXE;
  }
}

export function guardarOpcoesDoEncaixe(a: Escrita, opcoes: OpcoesDoEncaixe): void {
  a.setItem(CHAVE_DAS_OPCOES, JSON.stringify(opcoes));
}

/** "Propriedades de encaixe" (ADR 0202): um conjunto com nome, para aplicar de uma vez. */
export interface ConjuntoDePropriedades {
  readonly nome: string;
  readonly restricao: RestricaoDeRotacao;
  readonly quantidade: number;
  readonly tecidoDoMolde?: string;
}

const CHAVE_DOS_CONJUNTOS = 'enfesto-cad:propriedades-de-encaixe';

export function conjuntosGuardados(a: Leitura): readonly ConjuntoDePropriedades[] {
  try {
    const v = JSON.parse(a.getItem(CHAVE_DOS_CONJUNTOS) ?? '[]') as unknown;
    return Array.isArray(v) ? (v as ConjuntoDePropriedades[]) : [];
  } catch {
    return [];
  }
}

export function guardarConjuntos(a: Escrita, conjuntos: readonly ConjuntoDePropriedades[]): void {
  a.setItem(CHAVE_DOS_CONJUNTOS, JSON.stringify(conjuntos));
}

/** A lista com o conjunto: o do mesmo nome é trocado. */
export const comConjunto = (lista: readonly ConjuntoDePropriedades[], conjunto: ConjuntoDePropriedades): ConjuntoDePropriedades[] => [...lista.filter((c) => c.nome !== conjunto.nome), conjunto];

export function aplicarConjunto(peca: Molde, conjunto: ConjuntoDePropriedades): Molde {
  return { ...peca, restricaoDeRotacao: conjunto.restricao, quantidade: conjunto.quantidade, ...(conjunto.tecidoDoMolde ? { tecidoDoMolde: conjunto.tecidoDoMolde } : {}) };
}

/** A quantidade por tamanho no campo: "P:2 M:1"; o que não é número fica de fora. */
export function lerQuantidades(texto: string): Readonly<Record<string, number>> {
  return Object.fromEntries(
    texto
      .split(/\s+/)
      .map((par) => par.split(':'))
      .filter(([t, q]) => t && q && /^\d+$/.test(q))
      .map(([t, q]) => [t, Number(q)]),
  );
}

export const textoDasQuantidades = (q: Readonly<Record<string, number>> | undefined): string => Object.entries(q ?? {}).map(([t, n]) => `${t}:${n}`).join(' ');

export type CampoDaBarra = 'encaixados' | 'comprimento' | 'largura' | 'area' | 'perimetro' | 'rendimentoConsumo' | 'rendimentoPeso';

export const ROTULO_DO_CAMPO_DA_BARRA: Readonly<Record<CampoDaBarra, string>> = {
  encaixados: 'Encaixados',
  comprimento: 'Comprimento',
  largura: 'Largura',
  area: 'Área',
  perimetro: 'Perímetro da peça',
  rendimentoConsumo: 'Rendimento consumo',
  rendimentoPeso: 'Rendimento peso',
};

const CHAVE_DOS_CAMPOS = 'enfesto-cad:campos-da-barra';

export function camposDaBarraGuardados(a: Leitura): readonly CampoDaBarra[] {
  try {
    const v = JSON.parse(a.getItem(CHAVE_DOS_CAMPOS) ?? '[]') as unknown;
    return Array.isArray(v) ? v.filter((c): c is CampoDaBarra => typeof c === 'string' && c in ROTULO_DO_CAMPO_DA_BARRA) : [];
  } catch {
    return [];
  }
}

export function guardarCamposDaBarra(a: Escrita, campos: readonly CampoDaBarra[]): void {
  a.setItem(CHAVE_DOS_CAMPOS, JSON.stringify(campos));
}

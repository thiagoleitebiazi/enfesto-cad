import type { Contorno, Ponto2D } from '../core/geometria';
import { elementosDaPeca } from '../domain/linhasAuxiliares';
import type { FormatoDePique, Molde } from '../domain/molde';

/**
 * O registro da peça no PDF: o que o desenho dela não diz, e a importação
 * precisa para trazê-la de volta como era.
 *
 * - O **formato** de cada pique: o desenho sai na folha, mas não o tipo, as
 *   medidas, o ângulo, o "pique na costura" nem o código.
 * - Os **piques internos**: onde cada um está de verdade (o desenho só mostra
 *   os traços) e o formato dele.
 * - Os **textos** da peça, com o ângulo e a âncora.
 * - As **linhas só de construção** (os elementos), que nem são desenhadas.
 *
 * Vai escrito na página da peça como um comentário do PDF: quem abre ou
 * imprime o arquivo não vê nada, e o desenho continua o mesmo. As posições
 * são as da página (em mm, contadas do mesmo canto que o desenho), para a
 * importação não ter conta a fazer.
 *
 * Quem lê o registro trata-o como dado vindo de fora: cada campo é conferido,
 * e o que não serve é deixado de lado — a peça volta, então, só pelo desenho.
 */
export interface PiqueDoRegistro {
  readonly posicao: Ponto2D;
  readonly formato?: FormatoDePique;
  readonly naCostura?: 'projetado' | 'estendido';
  readonly codigo?: string;
}

export interface MarcaDoRegistro {
  readonly posicao: Ponto2D;
  readonly formato?: FormatoDePique;
}

export interface TextoDoRegistro {
  readonly posicao: Ponto2D;
  readonly texto: string;
  readonly alturaMm: number;
  readonly anguloGraus?: number;
  readonly ancora?: 'inicio' | 'fim';
}

export interface RegistroDaPeca {
  /** Só os piques do contorno que têm o que dizer além do traço. */
  readonly piques: readonly PiqueDoRegistro[];
  /** Todas as marcas da peça, quando alguma é um pique interno; senão, nenhuma (o desenho basta). */
  readonly marcas: readonly MarcaDoRegistro[];
  readonly textos: readonly TextoDoRegistro[];
  readonly elementos: readonly Contorno[];
}

/** O começo da linha do registro. O número é a versão do que vem depois dele, separado por um espaço. */
const INICIO = '% enfesto-cad:peca:1';
/** O registro maior que isto (em caracteres) não é lido. */
const TAMANHO_MAXIMO = 4_000_000;
/** Quantos itens (piques, marcas, textos, linhas, pontos de uma linha) um registro pode ter de cada. */
const MAXIMO_DE_ITENS = 20_000;

/** Décimos de milésimo de mm: o bastante para a peça voltar igual, sem números compridos. */
function mm(valor: number): number {
  return Math.round(valor * 1e4) / 1e4;
}

type PontoBruto = readonly [number, number];
interface FormatoBruto {
  readonly t: string;
  readonly l: number;
  readonly h: number;
  readonly a: number;
  readonly n?: string;
  readonly f?: readonly (readonly PontoBruto[])[];
  readonly e?: 1;
}

function formatoBruto(formato: FormatoDePique): FormatoBruto {
  return {
    t: formato.tipo,
    l: formato.larguraMm,
    h: formato.alturaMm,
    a: formato.anguloGraus,
    ...(formato.nome !== undefined ? { n: formato.nome } : {}),
    // A forma do pique cadastrado é uma proporção (o quadro de 1 × 1): vai como está, sem arredondar para mm.
    ...(formato.forma ? { f: formato.forma.map((traco) => traco.map((q): PontoBruto => [q.x, q.y])) } : {}),
    ...(formato.espelhado ? { e: 1 as const } : {}),
  };
}

/**
 * A linha do registro da peça, para escrever na página dela, ou `null`
 * quando o desenho já diz tudo (peça sem pique com formato, sem código, sem
 * texto e sem linha de construção).
 */
export function registroDaPeca(peca: Molde, origem: Ponto2D): string | null {
  const naPagina = (q: Ponto2D): PontoBruto => [mm(q.x - origem.x), mm(q.y - origem.y)];
  const piques = peca.piques
    .filter((pique) => pique.formato || pique.naCostura || pique.codigo)
    .map((pique) => ({
      p: naPagina(pique.posicao),
      ...(pique.formato ? { f: formatoBruto(pique.formato) } : {}),
      ...(pique.naCostura ? { c: pique.naCostura } : {}),
      ...(pique.codigo ? { k: pique.codigo } : {}),
    }));
  const marcas = peca.marcas.some((marca) => marca.formato)
    ? peca.marcas.map((marca) => ({ p: naPagina(marca.posicao), ...(marca.formato ? { f: formatoBruto(marca.formato) } : {}) }))
    : [];
  const textos = (peca.textos ?? []).map((texto) => ({
    p: naPagina(texto.posicao),
    s: texto.texto,
    h: texto.alturaMm,
    ...(texto.anguloGraus !== undefined ? { a: texto.anguloGraus } : {}),
    ...(texto.ancora ? { n: texto.ancora } : {}),
  }));
  const elementos = elementosDaPeca(peca).map((i) => peca.linhasInternas[i]!.map(naPagina));
  if (piques.length + marcas.length + textos.length + elementos.length === 0) return null;
  // Só letras e números na linha: o texto do registro vai em hexadecimal, com o que não é ASCII escrito como \uXXXX.
  const json = JSON.stringify({ p: piques, m: marcas, t: textos, e: elementos }).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
  let hex = '';
  for (let i = 0; i < json.length; i++) hex += json.charCodeAt(i).toString(16).padStart(2, '0');
  return `${INICIO} ${hex}`;
}

// ---------------------------------------------------------------------------
// A leitura: tudo conferido, como dado vindo de fora
// ---------------------------------------------------------------------------

function ehNumero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isFinite(valor);
}

function ehLista(valor: unknown): valor is readonly unknown[] {
  return Array.isArray(valor) && valor.length <= MAXIMO_DE_ITENS;
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function pontoLido(valor: unknown): Ponto2D | null {
  return ehLista(valor) && valor.length === 2 && ehNumero(valor[0]) && ehNumero(valor[1]) ? { x: valor[0], y: valor[1] } : null;
}

function linhaLida(valor: unknown): Ponto2D[] | null {
  if (!ehLista(valor) || valor.length < 2) return null;
  const pontos = valor.map(pontoLido);
  return pontos.every((q): q is Ponto2D => q !== null) ? pontos : null;
}

function formatoLido(valor: unknown): FormatoDePique | null {
  if (!ehObjeto(valor)) return null;
  const { t, l, h, a, n, f, e } = valor;
  if (typeof t !== 'string' || t === '' || !ehNumero(l) || !ehNumero(h) || !ehNumero(a) || !(l > 0) || !(h > 0)) return null;
  if (n !== undefined && typeof n !== 'string') return null;
  let forma: Ponto2D[][] | undefined;
  if (f !== undefined) {
    if (!ehLista(f) || f.length === 0) return null;
    const tracos = f.map(linhaLida);
    if (!tracos.every((traco): traco is Ponto2D[] => traco !== null)) return null;
    forma = tracos;
  }
  return { tipo: t, larguraMm: l, alturaMm: h, anguloGraus: a, ...(n !== undefined ? { nome: n } : {}), ...(forma ? { forma } : {}), ...(e === 1 && forma ? { espelhado: true as const } : {}) };
}

/** Os itens lidos de uma lista, ou `null` se algum deles não serve. */
function todos<T>(valor: unknown, ler: (item: unknown) => T | null): T[] | null {
  if (!ehLista(valor)) return null;
  const lidos = valor.map(ler);
  return lidos.every((item): item is T => item !== null) ? lidos : null;
}

function piqueLido(valor: unknown): PiqueDoRegistro | null {
  if (!ehObjeto(valor)) return null;
  const posicao = pontoLido(valor.p);
  const formato = valor.f === undefined ? undefined : formatoLido(valor.f);
  if (!posicao || formato === null) return null;
  if (valor.c !== undefined && valor.c !== 'projetado' && valor.c !== 'estendido') return null;
  if (valor.k !== undefined && typeof valor.k !== 'string') return null;
  return { posicao, ...(formato ? { formato } : {}), ...(valor.c ? { naCostura: valor.c } : {}), ...(valor.k ? { codigo: valor.k } : {}) };
}

function marcaLida(valor: unknown): MarcaDoRegistro | null {
  if (!ehObjeto(valor)) return null;
  const posicao = pontoLido(valor.p);
  const formato = valor.f === undefined ? undefined : formatoLido(valor.f);
  if (!posicao || formato === null) return null;
  return { posicao, ...(formato ? { formato } : {}) };
}

function textoLido(valor: unknown): TextoDoRegistro | null {
  if (!ehObjeto(valor)) return null;
  const posicao = pontoLido(valor.p);
  if (!posicao || typeof valor.s !== 'string' || valor.s === '' || !ehNumero(valor.h) || !(valor.h > 0)) return null;
  if (valor.a !== undefined && !ehNumero(valor.a)) return null;
  if (valor.n !== undefined && valor.n !== 'inicio' && valor.n !== 'fim') return null;
  return { posicao, texto: valor.s, alturaMm: valor.h, ...(valor.a !== undefined ? { anguloGraus: valor.a } : {}), ...(valor.n ? { ancora: valor.n } : {}) };
}

/**
 * O registro da peça escrito na página (a stream dela, como texto), `null` se
 * a página não tem registro, ou `'ilegivel'` se tem e ele não serve — está
 * cortado, não é o que este programa escreve, ou tem algum campo fora do
 * esperado. Nesse caso nada dele é aproveitado.
 */
export function lerRegistroDaPagina(streamDaPagina: string): RegistroDaPeca | 'ilegivel' | null {
  const linha = streamDaPagina.split('\n').find((l) => l.trim().startsWith(INICIO));
  if (linha === undefined) return null;
  const hex = linha.trim().slice(INICIO.length).trim();
  if (hex.length > TAMANHO_MAXIMO || hex.length % 2 !== 0 || !/^[0-9a-f]*$/.test(hex)) return 'ilegivel';
  let json = '';
  for (let i = 0; i < hex.length; i += 2) json += String.fromCharCode(Number.parseInt(hex.slice(i, i + 2), 16));
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    return 'ilegivel';
  }
  if (!ehObjeto(bruto)) return 'ilegivel';
  const piques = todos(bruto.p, piqueLido);
  const marcas = todos(bruto.m, marcaLida);
  const textos = todos(bruto.t, textoLido);
  const elementos = todos(bruto.e, linhaLida);
  if (!piques || !marcas || !textos || !elementos) return 'ilegivel';
  return { piques, marcas, textos, elementos };
}

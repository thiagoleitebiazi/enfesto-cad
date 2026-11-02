import type { EstiloDeLinha, FormatoDePique } from '../domain/molde';
import { PIQUE_PADRAO } from '../domain/piques';
/**
 * As preferências deste computador (ADR 0175 a 0177): as teclas de atalho, o perfil (salvar, carregar, restaurar) e o
 * esquema de cores. Tudo fica no armazenamento do navegador, nas chaves que começam por `enfesto-cad:`.
 */

const PREFIXO = 'enfesto-cad:';

export interface Armazenamento {
  readonly length: number;
  key(i: number): string | null;
  getItem(chave: string): string | null;
  setItem(chave: string, valor: string): void;
  removeItem(chave: string): void;
}

const chaves = (a: Armazenamento): string[] => Array.from({ length: a.length }, (_, i) => a.key(i)).filter((k): k is string => k !== null && k.startsWith(PREFIXO));

export function perfilAtual(a: Armazenamento): string {
  return JSON.stringify({ perfilDoEnfestoCad: 1, valores: Object.fromEntries(chaves(a).map((k) => [k, a.getItem(k)])) }, null, 2);
}

/** Troca as preferências pelas do arquivo; devolve quantas entraram. Lança se o arquivo não for um perfil. */
export function aplicarPerfil(a: Armazenamento, texto: string): number {
  let bruto: { perfilDoEnfestoCad?: unknown; valores?: unknown };
  try {
    bruto = JSON.parse(texto) as typeof bruto;
  } catch {
    throw new Error('O arquivo não é um perfil do Enfesto.');
  }
  if (bruto.perfilDoEnfestoCad !== 1 || typeof bruto.valores !== 'object' || bruto.valores === null) throw new Error('O arquivo não é um perfil do Enfesto.');
  const entradas = Object.entries(bruto.valores).filter((e): e is [string, string] => e[0].startsWith(PREFIXO) && typeof e[1] === 'string');
  restaurarPadroes(a);
  for (const [k, v] of entradas) a.setItem(k, v);
  return entradas.length;
}

export function restaurarPadroes(a: Armazenamento): void {
  for (const k of chaves(a)) a.removeItem(k);
}

// ---- As teclas de atalho (ADR 0175).

/** As combinações que o programa já usa: a nova não pode ser uma delas. */
export const TECLAS_DO_PROGRAMA: ReadonlySet<string> = new Set(['Ctrl+Shift+D', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12', 'Ctrl+F', 'Ctrl+R', 'Ctrl+G', 'Ctrl+U', 'Ctrl+W', 'Ctrl+T', 'Ctrl+K', 'Ctrl+P', 'Ctrl+L', 'Ctrl+Shift+T', 'Ctrl+N', 'Ctrl+O', 'Ctrl+S', 'Ctrl+Shift+S', 'Ctrl+E', 'Ctrl+I', 'Ctrl+H', 'Ctrl+Z', 'Ctrl+Y', 'Ctrl+Shift+Z', 'Ctrl+C', 'Ctrl+X', 'Ctrl+V', 'Ctrl+A']);

/** A combinação de uma tecla apertada ("Ctrl+Shift+K"), ou `null`: só vale com Ctrl ou Alt, ou numa tecla F. */
export function combinacaoDaTecla(e: { readonly key: string; readonly ctrlKey: boolean; readonly altKey: boolean; readonly shiftKey: boolean; readonly metaKey: boolean }): string | null {
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null;
  const funcao = /^F\d{1,2}$/.test(e.key);
  if (!e.ctrlKey && !e.metaKey && !e.altKey && !funcao) return null;
  const tecla = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  return [e.ctrlKey || e.metaKey ? 'Ctrl' : null, e.altKey ? 'Alt' : null, e.shiftKey ? 'Shift' : null, tecla].filter((p) => p !== null).join('+');
}

// ---- O pique padrão, o estilo da costura e as cores dos tamanhos (ADR 0182).

const CHAVE_DO_PIQUE = `${PREFIXO}pique-padrao`;

export function piquePadraoGuardado(a: Pick<Armazenamento, 'getItem'>): FormatoDePique {
  try {
    const v = JSON.parse(a.getItem(CHAVE_DO_PIQUE) ?? 'null') as Partial<FormatoDePique> | null;
    const numero = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);
    if (v && numero(v.larguraMm) && numero(v.alturaMm) && numero(v.anguloGraus)) return { ...PIQUE_PADRAO, larguraMm: v.larguraMm, alturaMm: v.alturaMm, anguloGraus: v.anguloGraus };
  } catch {
    // Valor estragado: fica o padrão do programa.
  }
  return PIQUE_PADRAO;
}

export function guardarPiquePadrao(a: Pick<Armazenamento, 'setItem'>, pique: Pick<FormatoDePique, 'larguraMm' | 'alturaMm' | 'anguloGraus'>): void {
  a.setItem(CHAVE_DO_PIQUE, JSON.stringify({ larguraMm: pique.larguraMm, alturaMm: pique.alturaMm, anguloGraus: pique.anguloGraus }));
}

export type EstiloDaCostura = EstiloDeLinha;

export const ROTULO_DO_ESTILO_DA_COSTURA: Readonly<Record<EstiloDaCostura, string>> = { tracejada: 'Costura tracejada', pontilhada: 'Costura pontilhada', continua: 'Costura contínua' };

/** Os traços da linha na tela (px). */
export const TRACOS_DA_COSTURA: Readonly<Record<EstiloDaCostura, readonly number[]>> = { tracejada: [5, 4], pontilhada: [1, 3], continua: [] };

const CHAVE_DA_COSTURA = `${PREFIXO}estilo-da-costura`;

export function estiloDaCosturaGuardado(a: Pick<Armazenamento, 'getItem'>): EstiloDaCostura {
  const v = a.getItem(CHAVE_DA_COSTURA);
  return v !== null && v in ROTULO_DO_ESTILO_DA_COSTURA ? (v as EstiloDaCostura) : 'tracejada';
}

export function guardarEstiloDaCostura(a: Pick<Armazenamento, 'setItem'>, estilo: EstiloDaCostura): void {
  a.setItem(CHAVE_DA_COSTURA, estilo);
}

const CORES_PADRAO_DOS_TAMANHOS = ['#d9480f', '#2b8a3e', '#1971c2', '#9c36b5', '#e67700', '#0b7285', '#c2255c'] as const;
const CHAVE_DAS_CORES = `${PREFIXO}cores-dos-tamanhos`;

/** A cor do tamanho na área de trabalho: a escolhida para esse nome, ou a da paleta, pela posição dele. */
export function corDoTamanho(nome: string, indice: number, escolhidas: Readonly<Record<string, string>>): string {
  return escolhidas[nome] ?? CORES_PADRAO_DOS_TAMANHOS[indice % CORES_PADRAO_DOS_TAMANHOS.length]!;
}

export function coresDosTamanhosGuardadas(a: Pick<Armazenamento, 'getItem'>): Readonly<Record<string, string>> {
  try {
    const v = JSON.parse(a.getItem(CHAVE_DAS_CORES) ?? 'null') as unknown;
    if (typeof v === 'object' && v !== null) return Object.fromEntries(Object.entries(v).filter((e): e is [string, string] => typeof e[1] === 'string' && /^#[0-9a-f]{6}$/i.test(e[1])));
  } catch {
    // Valor estragado: fica a paleta.
  }
  return {};
}

export function guardarCoresDosTamanhos(a: Pick<Armazenamento, 'setItem'>, cores: Readonly<Record<string, string>>): void {
  a.setItem(CHAVE_DAS_CORES, JSON.stringify(cores));
}


// ---- As cores da área de trabalho (ADR 0203).

export interface CoresDaArea {
  readonly mesa: string;
  readonly margem: string;
  readonly contorno: string;
  readonly selecao: string;
}

export const CORES_DA_AREA_PADRAO: CoresDaArea = { mesa: '#ffffff', margem: '#eef0f3', contorno: '#2b2f36', selecao: '#1565c0' };

export type EsquemaDaArea = 'padrao' | 'user1' | 'user2' | 'user3';

export interface EsquemasDaArea {
  readonly esquema: EsquemaDaArea;
  readonly user1: CoresDaArea;
  readonly user2: CoresDaArea;
  readonly user3: CoresDaArea;
}

const CHAVE_DAS_CORES_DA_AREA = `${PREFIXO}cores-da-area`;

export function coresDaAreaGuardadas(a: Pick<Armazenamento, 'getItem'>): EsquemasDaArea {
  const padrao: EsquemasDaArea = { esquema: 'padrao', user1: CORES_DA_AREA_PADRAO, user2: CORES_DA_AREA_PADRAO, user3: CORES_DA_AREA_PADRAO };
  try {
    return { ...padrao, ...(JSON.parse(a.getItem(CHAVE_DAS_CORES_DA_AREA) ?? '{}') as Partial<EsquemasDaArea>) };
  } catch {
    return padrao;
  }
}

export function guardarCoresDaArea(a: Pick<Armazenamento, 'setItem'>, esquemas: EsquemasDaArea): void {
  a.setItem(CHAVE_DAS_CORES_DA_AREA, JSON.stringify(esquemas));
}

/** As cores do esquema escolhido; no padrão, nenhuma: vale o que o desenho já usa. */
export const corDaAreaNoEsquema = (e: EsquemasDaArea): CoresDaArea | null => (e.esquema === 'padrao' ? null : e[e.esquema]);


// ---- As unidades de área e de peso (ADR 0189).

export type UnidadeDeArea = 'cm2' | 'm2' | 'pol2';
export type UnidadeDePeso = 'kg' | 'g' | 'lb';

export const ROTULO_DA_UNIDADE_DE_AREA: Readonly<Record<UnidadeDeArea, string>> = { cm2: 'cm²', m2: 'm²', pol2: 'pol²' };
export const ROTULO_DA_UNIDADE_DE_PESO: Readonly<Record<UnidadeDePeso, string>> = { kg: 'kg', g: 'g', lb: 'lb' };

const MM2_DA_UNIDADE: Readonly<Record<UnidadeDeArea, number>> = { cm2: 100, m2: 1_000_000, pol2: 645.16 };
const UNIDADES_POR_KG: Readonly<Record<UnidadeDePeso, number>> = { kg: 1, g: 1000, lb: 1 / 0.45359237 };

export const areaNaUnidade = (mm2: number, unidade: UnidadeDeArea): number => mm2 / MM2_DA_UNIDADE[unidade];
export const pesoNaUnidade = (kg: number, unidade: UnidadeDePeso): number => kg * UNIDADES_POR_KG[unidade];

const CHAVE_DA_AREA = `${PREFIXO}unidade-de-area`;
const CHAVE_DO_PESO = `${PREFIXO}unidade-de-peso`;

export function unidadeDeAreaGuardada(a: Pick<Armazenamento, 'getItem'>): UnidadeDeArea {
  const v = a.getItem(CHAVE_DA_AREA);
  return v !== null && v in ROTULO_DA_UNIDADE_DE_AREA ? (v as UnidadeDeArea) : 'cm2';
}

export function unidadeDePesoGuardada(a: Pick<Armazenamento, 'getItem'>): UnidadeDePeso {
  const v = a.getItem(CHAVE_DO_PESO);
  return v !== null && v in ROTULO_DA_UNIDADE_DE_PESO ? (v as UnidadeDePeso) : 'kg';
}

export function guardarUnidades(a: Pick<Armazenamento, 'setItem'>, unidades: { readonly area?: UnidadeDeArea; readonly peso?: UnidadeDePeso }): void {
  if (unidades.area) a.setItem(CHAVE_DA_AREA, unidades.area);
  if (unidades.peso) a.setItem(CHAVE_DO_PESO, unidades.peso);
}

// ---- O esquema de cores (ADR 0177).

export type EsquemaDeCores = 'padrao' | 'escuro' | 'alto-contraste' | 'areia';

export const ROTULO_DO_ESQUEMA: Readonly<Record<EsquemaDeCores, string>> = { padrao: 'Cores padrão', escuro: 'Cores escuras', 'alto-contraste': 'Alto contraste', areia: 'Cores areia' };

const CHAVE_DO_ESQUEMA = `${PREFIXO}esquema-de-cores`;

export function esquemaGuardado(a: Pick<Armazenamento, 'getItem'>): EsquemaDeCores {
  const v = a.getItem(CHAVE_DO_ESQUEMA);
  return v !== null && v in ROTULO_DO_ESQUEMA ? (v as EsquemaDeCores) : 'padrao';
}

export function aplicarEsquema(esquema: EsquemaDeCores, a: Pick<Armazenamento, 'setItem'> | null, raiz: HTMLElement): void {
  raiz.dataset.esquema = esquema;
  a?.setItem(CHAVE_DO_ESQUEMA, esquema);
}

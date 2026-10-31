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
    throw new Error('O arquivo não é um perfil do Enfesto CAD.');
  }
  if (bruto.perfilDoEnfestoCad !== 1 || typeof bruto.valores !== 'object' || bruto.valores === null) throw new Error('O arquivo não é um perfil do Enfesto CAD.');
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
export const TECLAS_DO_PROGRAMA: ReadonlySet<string> = new Set(['F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F12', 'Ctrl+F', 'Ctrl+N', 'Ctrl+O', 'Ctrl+S', 'Ctrl+Shift+S', 'Ctrl+E', 'Ctrl+I', 'Ctrl+H', 'Ctrl+Z', 'Ctrl+Y', 'Ctrl+Shift+Z', 'Ctrl+C', 'Ctrl+X', 'Ctrl+V', 'Ctrl+A']);

/** A combinação de uma tecla apertada ("Ctrl+Shift+K"), ou `null`: só vale com Ctrl ou Alt, ou numa tecla F. */
export function combinacaoDaTecla(e: { readonly key: string; readonly ctrlKey: boolean; readonly altKey: boolean; readonly shiftKey: boolean; readonly metaKey: boolean }): string | null {
  if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return null;
  const funcao = /^F\d{1,2}$/.test(e.key);
  if (!e.ctrlKey && !e.metaKey && !e.altKey && !funcao) return null;
  const tecla = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  return [e.ctrlKey || e.metaKey ? 'Ctrl' : null, e.altKey ? 'Alt' : null, e.shiftKey ? 'Shift' : null, tecla].filter((p) => p !== null).join('+');
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

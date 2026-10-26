import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { gravarSemCorromper } from './gravacao';

/**
 * As pastas compartilhadas (ADR 0141): uma pasta que o usuário escolhe — no computador ou na rede — para trocar
 * arquivos com outro sistema ou outra estação, sem servidor. A interface nunca dá um caminho: diz o tipo da pasta, a
 * subpasta (uma das conhecidas daquele tipo) e o nome do arquivo (sem barra, sem ".."); o caminho sai daqui, sempre
 * dentro da pasta escolhida.
 */

export type TipoDePasta = 'erp' | 'biblioteca';

/** As subpastas de cada tipo: as únicas em que a interface lê e grava. */
export const SUBPASTAS: Readonly<Record<TipoDePasta, readonly string[]>> = {
  // O ERP deixa as ordens em "entrada"; o programa move cada arquivo lido para "processados" (ou "com-erro", com o
  // relatório dos erros) e deixa em "saida" as ordens, os rolos, os movimentos de estoque e os cortes.
  erp: ['entrada', 'processados', 'com-erro', 'saida'],
  // A biblioteca na rede (ADR 0142): um arquivo por modelo em "projetos" e a trava de quem está editando em "travas".
  biblioteca: ['projetos', 'travas'],
};

export const ehTipoDePasta = (v: unknown): v is TipoDePasta => typeof v === 'string' && Object.prototype.hasOwnProperty.call(SUBPASTAS, v);

/** Um nome de arquivo, sem pasta: nada de barras, "..", caracteres que o Windows recusa ou espaço nas pontas. */
export function nomeDeArquivoValido(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    v.length > 0 &&
    v.length <= 200 &&
    v === v.trim() &&
    v !== '.' &&
    v !== '..' &&
    !v.endsWith('.') &&
    // eslint-disable-next-line no-control-regex
    !/[\\/:*?"<>|\u0000-\u001f]/.test(v)
  );
}

/** O caminho de um arquivo (ou da subpasta, sem nome) dentro da pasta escolhida; `null` se o pedido não vale. */
export function caminhoNaPasta(raiz: string, tipo: unknown, subpasta: unknown, nome?: unknown): string | null {
  if (!ehTipoDePasta(tipo) || typeof subpasta !== 'string' || !SUBPASTAS[tipo].includes(subpasta)) return null;
  if (nome !== undefined && !nomeDeArquivoValido(nome)) return null;
  const caminho = nome === undefined ? path.join(raiz, subpasta) : path.join(raiz, subpasta, nome);
  const relativo = path.relative(raiz, caminho);
  return relativo.startsWith('..') || path.isAbsolute(relativo) ? null : caminho;
}

// ---- As pastas escolhidas: <userData>/pastas-compartilhadas.json, { tipo: caminho }.

export type PastasEscolhidas = Partial<Record<TipoDePasta, string>>;

export async function lerPastasEscolhidas(arquivo: string): Promise<PastasEscolhidas> {
  try {
    const bruto: unknown = JSON.parse(await readFile(arquivo, 'utf-8'));
    if (typeof bruto !== 'object' || bruto === null) return {};
    const pastas: PastasEscolhidas = {};
    for (const [tipo, caminho] of Object.entries(bruto as Record<string, unknown>)) {
      if (ehTipoDePasta(tipo) && typeof caminho === 'string' && path.isAbsolute(caminho)) pastas[tipo] = caminho;
    }
    return pastas;
  } catch {
    return {};
  }
}

export async function guardarPastaEscolhida(arquivo: string, tipo: TipoDePasta, caminho: string | null): Promise<void> {
  const pastas = await lerPastasEscolhidas(arquivo);
  if (caminho === null) delete pastas[tipo];
  else pastas[tipo] = caminho;
  await mkdir(path.dirname(arquivo), { recursive: true });
  await gravarSemCorromper(arquivo, JSON.stringify(pastas, null, 2));
}

/** Cria as subpastas do tipo (as que faltam). */
export async function prepararPasta(raiz: string, tipo: TipoDePasta): Promise<void> {
  for (const sub of SUBPASTAS[tipo]) await mkdir(path.join(raiz, sub), { recursive: true });
}

export interface ArquivoNaPasta {
  readonly nome: string;
  readonly tamanho: number;
  readonly modificadoEmMs: number;
}

/** Os arquivos de uma subpasta, do mais antigo ao mais novo; os ocultos e os temporários de gravação ficam de fora. */
export async function listarNaPasta(raiz: string, tipo: unknown, subpasta: unknown): Promise<ArquivoNaPasta[] | null> {
  const pasta = caminhoNaPasta(raiz, tipo, subpasta);
  if (!pasta) return null;
  let entradas;
  try {
    entradas = await readdir(pasta, { withFileTypes: true });
  } catch {
    return [];
  }
  const arquivos: ArquivoNaPasta[] = [];
  for (const e of entradas) {
    if (!e.isFile() || e.name.startsWith('.') || e.name.endsWith('.tmp') || !nomeDeArquivoValido(e.name)) continue;
    try {
      const s = await stat(path.join(pasta, e.name));
      arquivos.push({ nome: e.name, tamanho: s.size, modificadoEmMs: s.mtimeMs });
    } catch {
      // Sumiu entre a lista e a leitura (outra estação moveu): fica de fora.
    }
  }
  return arquivos.sort((a, b) => a.modificadoEmMs - b.modificadoEmMs || a.nome.localeCompare(b.nome));
}

export async function lerNaPasta(raiz: string, tipo: unknown, subpasta: unknown, nome: unknown): Promise<string | null> {
  const caminho = caminhoNaPasta(raiz, tipo, subpasta, nome);
  if (!caminho) return null;
  try {
    return await readFile(caminho, 'utf-8');
  } catch {
    return null;
  }
}

/** Grava sem deixar o arquivo pela metade (o outro lado nunca lê um arquivo sendo escrito). */
export async function gravarNaPasta(raiz: string, tipo: unknown, subpasta: unknown, nome: unknown, texto: unknown): Promise<boolean> {
  const caminho = caminhoNaPasta(raiz, tipo, subpasta, nome);
  if (!caminho || typeof texto !== 'string') return false;
  await mkdir(path.dirname(caminho), { recursive: true });
  await gravarSemCorromper(caminho, texto);
  return true;
}

/**
 * Move um arquivo de uma subpasta para outra (com outro nome, se pedido). Não substitui: se o destino já existe, ou
 * se o arquivo já não está lá (outra estação levou antes), devolve `false`.
 */
export async function moverNaPasta(raiz: string, tipo: unknown, de: unknown, nome: unknown, para: unknown, novoNome?: unknown): Promise<boolean> {
  const origem = caminhoNaPasta(raiz, tipo, de, nome);
  const destino = caminhoNaPasta(raiz, tipo, para, novoNome ?? nome);
  if (!origem || !destino) return false;
  try {
    await stat(destino);
    return false;
  } catch {
    // O destino não existe: pode mover.
  }
  try {
    await mkdir(path.dirname(destino), { recursive: true });
    await rename(origem, destino);
    return true;
  } catch {
    return false;
  }
}

/** Cria o arquivo só se ele ainda não existe (`false` se existe): a trava de "quem está usando". */
export async function criarSeNaoExiste(raiz: string, tipo: unknown, subpasta: unknown, nome: unknown, texto: unknown): Promise<boolean> {
  const caminho = caminhoNaPasta(raiz, tipo, subpasta, nome);
  if (!caminho || typeof texto !== 'string') return false;
  try {
    await mkdir(path.dirname(caminho), { recursive: true });
    await writeFile(caminho, texto, { encoding: 'utf-8', flag: 'wx' });
    return true;
  } catch {
    return false;
  }
}

export async function apagarNaPasta(raiz: string, tipo: unknown, subpasta: unknown, nome: unknown): Promise<boolean> {
  const caminho = caminhoNaPasta(raiz, tipo, subpasta, nome);
  if (!caminho) return false;
  try {
    await rm(caminho);
    return true;
  } catch {
    return false;
  }
}

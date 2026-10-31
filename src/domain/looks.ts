import type { Colecao, ModeloDaColecao } from './colecoes';

/**
 * Os looks da coleção (ADR 0145): combinações de 2 a 4 modelos da coleção que vão juntos (a blusa, a saia, o casaco),
 * vistos lado a lado pelos croquis, com as cores que eles têm em comum. Ficam na própria coleção.
 */

export interface LookDaColecao {
  readonly id: string;
  readonly nome: string;
  readonly modeloIds: readonly string[];
  readonly nota: string;
}

export const MINIMO_DE_MODELOS_NO_LOOK = 2;
export const MAXIMO_DE_MODELOS_NO_LOOK = 4;

const chave = (t: string): string => t.trim().toLocaleLowerCase('pt-BR');

/** Os looks da coleção, cada um só com os modelos que ainda estão nela (o que ficou com menos de 2 sai). */
export function looksDaColecao(colecao: Colecao): LookDaColecao[] {
  const ids = new Set(colecao.modelos.map((m) => m.id));
  return (colecao.looks ?? []).map((l) => ({ ...l, modeloIds: l.modeloIds.filter((id) => ids.has(id)) })).filter((l) => l.modeloIds.length >= MINIMO_DE_MODELOS_NO_LOOK);
}

export function validarLook(look: LookDaColecao, colecao: Colecao): string[] {
  const erros: string[] = [];
  if (look.nome.trim() === '') erros.push('Dê um nome ao look.');
  else if ((colecao.looks ?? []).some((l) => l.id !== look.id && chave(l.nome) === chave(look.nome))) erros.push(`Já há um look “${look.nome.trim()}” nesta coleção.`);
  const distintos = new Set(look.modeloIds);
  if (distintos.size !== look.modeloIds.length) erros.push('Um modelo entrou duas vezes no look.');
  if (distintos.size < MINIMO_DE_MODELOS_NO_LOOK || distintos.size > MAXIMO_DE_MODELOS_NO_LOOK) {
    erros.push(`Um look tem de ${MINIMO_DE_MODELOS_NO_LOOK} a ${MAXIMO_DE_MODELOS_NO_LOOK} modelos (este tem ${distintos.size}).`);
  }
  if (look.modeloIds.some((id) => !colecao.modelos.some((m) => m.id === id))) erros.push('Um dos modelos não está nesta coleção.');
  return erros;
}

/** Guarda o look (novo, ou no lugar do de mesmo id); lança o erro se ele não vale. */
export function guardarLook(colecao: Colecao, look: LookDaColecao): Colecao {
  const erros = validarLook(look, colecao);
  if (erros.length > 0) throw new Error(erros.join(' '));
  const limpo = { ...look, nome: look.nome.trim(), nota: look.nota.trim() };
  const looks = colecao.looks ?? [];
  return { ...colecao, looks: looks.some((l) => l.id === look.id) ? looks.map((l) => (l.id === look.id ? limpo : l)) : [...looks, limpo] };
}

export function tirarLook(colecao: Colecao, id: string): Colecao {
  return { ...colecao, looks: (colecao.looks ?? []).filter((l) => l.id !== id) };
}

/** As cores que todos os modelos do look têm (sem diferença de maiúsculas), na grafia do primeiro. */
export function coresEmComum(modelos: readonly ModeloDaColecao[]): string[] {
  if (modelos.length === 0) return [];
  return modelos[0]!.cores.filter((cor) => modelos.every((m) => m.cores.some((c) => chave(c) === chave(cor))));
}

/** Os looks como estão no disco: o que não é um look fica de fora. */
export function lerLooks(bruto: unknown): LookDaColecao[] {
  if (!Array.isArray(bruto)) return [];
  return bruto.flatMap((l: unknown) => {
    if (typeof l !== 'object' || l === null) return [];
    const x = l as Record<string, unknown>;
    if (typeof x.id !== 'string' || typeof x.nome !== 'string' || !Array.isArray(x.modeloIds)) return [];
    return [{ id: x.id, nome: x.nome, modeloIds: x.modeloIds.filter((m): m is string => typeof m === 'string'), nota: typeof x.nota === 'string' ? x.nota : '' }];
  });
}

const escapar = (t: string): string => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A prancha do look para mandar a quem aprova: uma página com o croqui de cada modelo (o SVG da tela), o nome e as cores. */
/** O catálogo da coleção (ADR 0203): uma página com todos os modelos, para mandar a quem compra ou aprova. */
export function htmlDoCatalogo(
  colecao: string,
  modelos: ReadonlyArray<{ readonly nome: string; readonly referencia: string; readonly categoria: string; readonly cores: readonly string[]; readonly tecido: string; readonly croquiSvg: string | null }>,
): string {
  const cartoes = modelos
    .map(
      (m) =>
        `<figure>${m.croquiSvg ?? '<div class="sem">sem croqui</div>'}<figcaption><strong>${escapar(m.nome)}</strong><br>${escapar(m.referencia)}${m.categoria ? ` · ${escapar(m.categoria)}` : ''}${m.tecido ? `<br>${escapar(m.tecido)}` : ''}${m.cores.length > 0 ? `<br>${m.cores.map(escapar).join(', ')}` : ''}</figcaption></figure>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Catálogo — ${escapar(colecao)}</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;color:#1f2937}h1{margin:0 0 16px}.modelos{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}figure{margin:0;border:1px solid #d1d5db;border-radius:8px;padding:12px;break-inside:avoid}figure svg{width:100%;height:auto}.sem{height:160px;display:flex;align-items:center;justify-content:center;color:#9ca3af}figcaption{margin-top:8px;font-size:14px}</style>
</head><body>
<h1>${escapar(colecao)}</h1>
<div class="modelos">
${cartoes}
</div>
</body></html>
`;
}

export function htmlDaPrancha(
  colecao: string,
  look: LookDaColecao,
  modelos: ReadonlyArray<{ readonly nome: string; readonly referencia: string; readonly cores: readonly string[]; readonly tecido: string; readonly croquiSvg: string | null }>,
  emComum: readonly string[],
): string {
  const cartoes = modelos
    .map(
      (m) =>
        `<figure>${m.croquiSvg ?? '<div class="sem">sem croqui</div>'}<figcaption><strong>${escapar(m.nome)}</strong><br>${escapar(m.referencia || 'sem referência')}${m.tecido ? ` · ${escapar(m.tecido)}` : ''}${m.cores.length > 0 ? `<br>${m.cores.map(escapar).join(', ')}` : ''}</figcaption></figure>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>${escapar(look.nome)} — ${escapar(colecao)}</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;color:#1f2937}h1{margin:0}p{color:#4b5563}.looks{display:flex;flex-wrap:wrap;gap:16px}figure{margin:0;width:260px;border:1px solid #d1d5db;border-radius:8px;padding:8px}figure svg{width:100%;height:auto}.sem{height:200px;display:grid;place-items:center;color:#9ca3af}</style>
</head><body>
<h1>${escapar(look.nome)}</h1>
<p>${escapar(colecao)}${emComum.length > 0 ? ` · cores em comum: ${emComum.map(escapar).join(', ')}` : ''}${look.nota ? ` · ${escapar(look.nota)}` : ''}</p>
<div class="looks">
${cartoes}
</div>
</body></html>
`;
}

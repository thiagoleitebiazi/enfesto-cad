import type { Ponto2D } from '../core/geometria';
import { indiceDoTamanho, type Graduacao } from '../domain/graduacao';

/**
 * Regra de graduação guardada para reuso ("Criar regra" / "Regras"): o
 * deslocamento de um ponto em cada tamanho, com os nomes dos tamanhos. Ao ser
 * aplicada noutra peça, vale pelo nome de cada tamanho.
 */
export interface RegraCadastrada {
  readonly id: string;
  readonly nome: string;
  readonly tamanhos: readonly string[];
  /** O nome do tamanho base da peça de onde a regra saiu. */
  readonly base: string;
  /** O deslocamento em cada tamanho (na ordem de `tamanhos`), em mm, a partir do base. */
  readonly deslocamentos: readonly Ponto2D[];
}

const CHAVE = 'enfesto-cad:regras-de-graduacao';

function ehPonto(valor: unknown): valor is Ponto2D {
  const p = valor as { x?: unknown; y?: unknown } | null;
  return typeof p === 'object' && p !== null && Number.isFinite(p.x) && Number.isFinite(p.y);
}

function ehRegra(valor: unknown): valor is RegraCadastrada {
  const r = valor as { id?: unknown; nome?: unknown; tamanhos?: unknown; base?: unknown; deslocamentos?: unknown } | null;
  return (
    typeof r === 'object' &&
    r !== null &&
    typeof r.id === 'string' &&
    typeof r.nome === 'string' &&
    typeof r.base === 'string' &&
    Array.isArray(r.tamanhos) &&
    r.tamanhos.length >= 2 &&
    r.tamanhos.every((t) => typeof t === 'string') &&
    Array.isArray(r.deslocamentos) &&
    r.deslocamentos.length === r.tamanhos.length &&
    r.deslocamentos.every(ehPonto)
  );
}

/**
 * As regras cadastradas neste computador. Um conteúdo guardado que não dá
 * para ler vale como lista vazia: o cadastro nunca impede o programa de abrir.
 */
export function lerRegrasCadastradas(armazenamento: Pick<Storage, 'getItem'>): RegraCadastrada[] {
  try {
    const lido: unknown = JSON.parse(armazenamento.getItem(CHAVE) ?? '[]');
    return Array.isArray(lido)
      ? lido.filter(ehRegra).map((r) => ({ id: r.id, nome: r.nome, tamanhos: r.tamanhos, base: r.base, deslocamentos: r.deslocamentos }))
      : [];
  } catch {
    return [];
  }
}

/** Guarda as regras. Devolve `false` se não deu para gravar. */
export function gravarRegrasCadastradas(armazenamento: Pick<Storage, 'setItem'>, regras: readonly RegraCadastrada[]): boolean {
  try {
    armazenamento.setItem(CHAVE, JSON.stringify(regras));
    return true;
  } catch {
    return false;
  }
}

/** Cria a regra cadastrada a partir da regra de um ponto de uma peça graduada. */
export function regraDoPonto(id: string, nome: string, graduacao: Graduacao, deslocamentos: readonly Ponto2D[]): RegraCadastrada {
  if (nome.trim() === '') throw new Error('Dê um nome à regra.');
  return {
    id,
    nome: nome.trim(),
    tamanhos: [...graduacao.tamanhos],
    base: graduacao.tamanhos[graduacao.base]!,
    deslocamentos: deslocamentos.map((d) => ({ x: d.x, y: d.y })),
  };
}

/**
 * A regra cadastrada nos tamanhos da graduação dada, pelo nome de cada
 * tamanho e contada a partir do base dessa graduação. Recusa a regra que não
 * tem algum dos tamanhos da peça.
 */
export function regraParaAGraduacao(regra: RegraCadastrada, graduacao: Graduacao): Ponto2D[] {
  const naRegra = graduacao.tamanhos.map((nome) => indiceDoTamanho(regra.tamanhos, nome));
  const faltam = graduacao.tamanhos.filter((_, t) => naRegra[t]! < 0);
  if (faltam.length > 0) {
    throw new Error(
      `A regra “${regra.nome}” não tem ${faltam.length === 1 ? 'o tamanho' : 'os tamanhos'} ${faltam.join(', ')}: ela foi criada para ${regra.tamanhos.join(', ')}.`,
    );
  }
  const doBase = regra.deslocamentos[naRegra[graduacao.base]!]!;
  return naRegra.map((i) => {
    const d = regra.deslocamentos[i]!;
    return { x: d.x - doBase.x, y: d.y - doBase.y };
  });
}

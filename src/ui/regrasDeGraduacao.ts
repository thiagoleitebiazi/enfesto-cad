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
  /** O código da regra (o "código mesa" da referência): um rótulo curto para achá-la, sem efeito nas contas. */
  readonly codigo?: string;
}

/**
 * Um conjunto de regras: várias regras do cadastro, em ordem. Em uso, cada
 * clique num ponto aplica a regra seguinte do conjunto.
 */
export interface ConjuntoDeRegras {
  readonly id: string;
  readonly nome: string;
  /** Os ids das regras, na ordem em que são aplicadas. */
  readonly regras: readonly string[];
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
      ? lido.filter(ehRegra).map((r) => ({
          id: r.id,
          nome: r.nome,
          tamanhos: r.tamanhos,
          base: r.base,
          deslocamentos: r.deslocamentos,
          ...(typeof r.codigo === 'string' && r.codigo.trim() !== '' ? { codigo: r.codigo.trim() } : {}),
        }))
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
export function regraDoPonto(id: string, nome: string, graduacao: Graduacao, deslocamentos: readonly Ponto2D[], codigo = ''): RegraCadastrada {
  if (nome.trim() === '') throw new Error('Dê um nome à regra.');
  return {
    id,
    nome: nome.trim(),
    tamanhos: [...graduacao.tamanhos],
    base: graduacao.tamanhos[graduacao.base]!,
    deslocamentos: deslocamentos.map((d) => ({ x: d.x, y: d.y })),
    ...(codigo.trim() !== '' ? { codigo: codigo.trim() } : {}),
  };
}

const CHAVE_DOS_CONJUNTOS = 'enfesto-cad:conjuntos-de-regras';
/** Um conjunto tem, no máximo, esta quantidade de regras. */
export const MAXIMO_DE_REGRAS_NO_CONJUNTO = 40;

function ehConjunto(valor: unknown): valor is ConjuntoDeRegras {
  const c = valor as { id?: unknown; nome?: unknown; regras?: unknown } | null;
  return typeof c === 'object' && c !== null && typeof c.id === 'string' && typeof c.nome === 'string' && Array.isArray(c.regras) && c.regras.every((r) => typeof r === 'string');
}

/** Os conjuntos de regras cadastrados neste computador; o que não dá para ler vale como lista vazia. */
export function lerConjuntosDeRegras(armazenamento: Pick<Storage, 'getItem'>): ConjuntoDeRegras[] {
  try {
    const lido: unknown = JSON.parse(armazenamento.getItem(CHAVE_DOS_CONJUNTOS) ?? '[]');
    return Array.isArray(lido) ? lido.filter(ehConjunto).map((c) => ({ id: c.id, nome: c.nome, regras: [...c.regras] })) : [];
  } catch {
    return [];
  }
}

/** Guarda os conjuntos. Devolve `false` se não deu para gravar. */
export function gravarConjuntosDeRegras(armazenamento: Pick<Storage, 'setItem'>, conjuntos: readonly ConjuntoDeRegras[]): boolean {
  try {
    armazenamento.setItem(CHAVE_DOS_CONJUNTOS, JSON.stringify(conjuntos));
    return true;
  } catch {
    return false;
  }
}

/** Cria um conjunto com as regras dadas, na ordem dada. */
export function criarConjuntoDeRegras(id: string, nome: string, regras: readonly string[]): ConjuntoDeRegras {
  if (nome.trim() === '') throw new Error('Dê um nome ao conjunto.');
  if (regras.length < 2) throw new Error('Um conjunto tem pelo menos duas regras: marque-as na ordem em que devem ser aplicadas.');
  if (regras.length > MAXIMO_DE_REGRAS_NO_CONJUNTO) throw new Error(`Um conjunto tem, no máximo, ${MAXIMO_DE_REGRAS_NO_CONJUNTO} regras.`);
  return { id, nome: nome.trim(), regras: [...regras] };
}

/** As regras do conjunto que continuam no cadastro, na ordem dele. */
export function regrasDoConjunto(conjunto: ConjuntoDeRegras, regras: readonly RegraCadastrada[]): RegraCadastrada[] {
  return conjunto.regras.flatMap((id) => regras.filter((r) => r.id === id));
}

/**
 * A regra da vez de um conjunto em uso: a de número `posicao` (contada a
 * partir de 0, dando a volta quando o conjunto acaba). `null` se o conjunto
 * ficou sem regras no cadastro.
 */
export function regraDaVez(conjunto: ConjuntoDeRegras, regras: readonly RegraCadastrada[], posicao: number): { readonly regra: RegraCadastrada; readonly numero: number; readonly total: number } | null {
  const doConjunto = regrasDoConjunto(conjunto, regras);
  if (doConjunto.length === 0) return null;
  const i = ((posicao % doConjunto.length) + doConjunto.length) % doConjunto.length;
  return { regra: doConjunto[i]!, numero: i + 1, total: doConjunto.length };
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

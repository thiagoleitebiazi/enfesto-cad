import type { Ponto2D } from '../core/geometria';
import type { PiqueCadastrado } from './ferramentasDeMarcacao';

/**
 * O cadastro de formatos de pique deste computador ("Cadastrar pique"): fica
 * no armazenamento local, como as regras de graduação. O pique posto com um
 * formato cadastrado leva a forma consigo, então o projeto abre igual em
 * outro computador, mesmo sem este cadastro.
 */
const CHAVE = 'enfesto-cad:piques-cadastrados';

function ehPonto(valor: unknown): valor is Ponto2D {
  const p = valor as { x?: unknown; y?: unknown } | null;
  return typeof p === 'object' && p !== null && Number.isFinite(p.x) && Number.isFinite(p.y);
}

function ehCadastrado(valor: unknown): valor is PiqueCadastrado {
  const c = valor as { id?: unknown; nome?: unknown; descricao?: unknown; forma?: unknown } | null;
  return (
    typeof c === 'object' &&
    c !== null &&
    typeof c.id === 'string' &&
    typeof c.nome === 'string' &&
    c.nome.trim() !== '' &&
    typeof c.descricao === 'string' &&
    Array.isArray(c.forma) &&
    c.forma.length > 0 &&
    c.forma.every((traco) => Array.isArray(traco) && traco.length >= 2 && traco.every(ehPonto))
  );
}

/** Os formatos cadastrados neste computador. O que não dá para ler vale como lista vazia: o cadastro nunca impede o programa de abrir. */
export function lerPiquesCadastrados(armazenamento: Pick<Storage, 'getItem'>): PiqueCadastrado[] {
  try {
    const lido: unknown = JSON.parse(armazenamento.getItem(CHAVE) ?? '[]');
    return Array.isArray(lido) ? lido.filter(ehCadastrado).map((c) => ({ id: c.id, nome: c.nome, descricao: c.descricao, forma: c.forma })) : [];
  } catch {
    return [];
  }
}

/** Guarda os formatos. Devolve `false` se não deu para gravar. */
export function gravarPiquesCadastrados(armazenamento: Pick<Storage, 'setItem'>, cadastrados: readonly PiqueCadastrado[]): boolean {
  try {
    armazenamento.setItem(CHAVE, JSON.stringify(cadastrados));
    return true;
  } catch {
    return false;
  }
}

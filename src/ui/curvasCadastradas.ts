import type { Ponto2D } from '../core/geometria';
import { arcoPorTresPontos, normalizarCurva } from '../core/curvas';

/**
 * Curva guardada para reuso ("Cadastrar curva" / "Pré-definida"): só a forma,
 * sem tamanho nem posição — o primeiro ponto em (0, 0) e o último em (1, 0).
 */
export interface CurvaCadastrada {
  readonly id: string;
  readonly nome: string;
  readonly forma: readonly Ponto2D[];
  /** Curva que já vem com o programa: não pode ser excluída. */
  readonly deFabrica?: boolean;
}

/** Arco de círculo cuja flecha é a fração dada da corda, como forma normalizada. */
function arcoComFlecha(fracao: number): Ponto2D[] {
  // Amostrado numa corda de 300 mm, para a forma ter pontos suficientes ao ser esticada.
  return normalizarCurva(arcoPorTresPontos({ x: 0, y: 0 }, { x: 150, y: 300 * fracao }, { x: 300, y: 0 }));
}

/**
 * Curvas que já vêm com o programa: arcos de círculo simples, descritos pela
 * própria geometria. As demais são as que o usuário cadastra a partir dos
 * seus moldes.
 */
export const CURVAS_DE_FABRICA: readonly CurvaCadastrada[] = [
  { id: 'fabrica-arco-raso', nome: 'Arco raso (flecha de 10% da corda)', forma: arcoComFlecha(0.1), deFabrica: true },
  { id: 'fabrica-arco', nome: 'Arco (flecha de 25% da corda)', forma: arcoComFlecha(0.25), deFabrica: true },
  { id: 'fabrica-meio-circulo', nome: 'Meio círculo', forma: arcoComFlecha(0.5), deFabrica: true },
];

const CHAVE = 'enfesto-cad:curvas-cadastradas';

function ehPonto(valor: unknown): valor is Ponto2D {
  const p = valor as { x?: unknown; y?: unknown } | null;
  return typeof p === 'object' && p !== null && Number.isFinite(p.x) && Number.isFinite(p.y);
}

function ehCurva(valor: unknown): valor is CurvaCadastrada {
  const c = valor as { id?: unknown; nome?: unknown; forma?: unknown } | null;
  return (
    typeof c === 'object' &&
    c !== null &&
    typeof c.id === 'string' &&
    typeof c.nome === 'string' &&
    Array.isArray(c.forma) &&
    c.forma.length >= 2 &&
    c.forma.every(ehPonto)
  );
}

/**
 * As curvas cadastradas pelo usuário neste computador. Um conteúdo guardado
 * que não dá para ler (corrompido, de outra versão) vale como lista vazia:
 * o cadastro de curvas nunca impede o programa de abrir.
 */
export function lerCurvasCadastradas(armazenamento: Pick<Storage, 'getItem'>): CurvaCadastrada[] {
  try {
    const lido: unknown = JSON.parse(armazenamento.getItem(CHAVE) ?? '[]');
    return Array.isArray(lido) ? lido.filter(ehCurva).map((c) => ({ id: c.id, nome: c.nome, forma: c.forma })) : [];
  } catch {
    return [];
  }
}

/** Guarda as curvas do usuário (as de fábrica não são gravadas). Devolve `false` se não deu para gravar. */
export function gravarCurvasCadastradas(armazenamento: Pick<Storage, 'setItem'>, curvas: readonly CurvaCadastrada[]): boolean {
  try {
    armazenamento.setItem(CHAVE, JSON.stringify(curvas.filter((c) => !c.deFabrica)));
    return true;
  } catch {
    return false;
  }
}

/** Cria a curva cadastrada a partir de um trecho de contorno (pontos do mundo, em ordem). */
export function curvaDoTrecho(id: string, nome: string, trecho: readonly Ponto2D[]): CurvaCadastrada {
  if (nome.trim() === '') throw new Error('Dê um nome à curva.');
  return { id, nome: nome.trim(), forma: normalizarCurva(trecho) };
}

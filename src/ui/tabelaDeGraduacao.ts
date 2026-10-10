import type { Ponto2D } from '../core/geometria';

/**
 * A tabela de graduação de um ponto, como o usuário a vê. Na tela os eixos
 * são trocados em relação ao mundo (ver `transformacaoDeTela.ts`): **DX** é a
 * horizontal (o `y` do mundo, + para a direita) e **DY** é a vertical (o `x`
 * do mundo, + para baixo) — as mesmas direções do diálogo "Modificar".
 */
export interface DeslocamentoNaTela {
  readonly dx: number;
  readonly dy: number;
}

export function paraATela(doMundo: Ponto2D): DeslocamentoNaTela {
  return { dx: doMundo.y, dy: doMundo.x };
}

export function paraOMundo(daTela: DeslocamentoNaTela): Ponto2D {
  return { x: daTela.dy, y: daTela.dx };
}

/**
 * De absoluto (o deslocamento de cada tamanho a partir do base) para
 * incremental (a diferença de cada tamanho para o vizinho do lado do base).
 * Com passos iguais, o incremental repete o mesmo número para cada lado.
 */
export function paraIncremental(absolutos: readonly number[], base: number): number[] {
  return absolutos.map((valor, t) => {
    if (t === base) return 0;
    return valor - absolutos[t > base ? t - 1 : t + 1]!;
  });
}

/** O caminho de volta: de incremental para absoluto. */
export function paraAbsoluto(incrementais: readonly number[], base: number): number[] {
  const absolutos = incrementais.map(() => 0);
  for (let t = base + 1; t < incrementais.length; t++) absolutos[t] = absolutos[t - 1]! + incrementais[t]!;
  for (let t = base - 1; t >= 0; t--) absolutos[t] = absolutos[t + 1]! + incrementais[t]!;
  return absolutos;
}

/** Número da tabela para mostrar num campo: com vírgula, sem zeros sobrando, e sem ruído de conta. */
export function paraOCampo(valor: number): string {
  const arredondado = Math.round(valor * 1000) / 1000;
  return String(arredondado === 0 ? 0 : arredondado).replace('.', ',');
}

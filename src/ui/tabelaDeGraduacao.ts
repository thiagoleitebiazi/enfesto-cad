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

/** O deslocamento na tela dado pela distância e pelo ângulo. */
export interface PolarNaTela {
  /** A distância, em mm. */
  readonly distancia: number;
  /** O ângulo, em graus: 0° é para a direita, e cresce no sentido anti-horário, como se vê no desenho (90° é para cima). */
  readonly angulo: number;
}

/** Sem o ruído das contas: o que é quase um número redondo vira ele. */
function limpo(valor: number): number {
  const arredondado = Math.round(valor * 1e9) / 1e9;
  return arredondado === 0 ? 0 : arredondado;
}

/** De DX e DY para distância e ângulo (o ângulo de um deslocamento nulo é 0°). */
export function paraPolar(daTela: DeslocamentoNaTela): PolarNaTela {
  const distancia = Math.hypot(daTela.dx, daTela.dy);
  if (distancia < 1e-9) return { distancia: 0, angulo: 0 };
  // Na tela o DY cresce para baixo: para cima é o ângulo positivo.
  const graus = (Math.atan2(0 - daTela.dy, daTela.dx) * 180) / Math.PI;
  return { distancia: limpo(distancia), angulo: limpo(graus < 0 ? graus + 360 : graus) };
}

/** De distância e ângulo para DX e DY. */
export function dePolar(polar: PolarNaTela): DeslocamentoNaTela {
  const a = (polar.angulo * Math.PI) / 180;
  return { dx: limpo(polar.distancia * Math.cos(a)), dy: limpo(0 - polar.distancia * Math.sin(a)) };
}

export type SetaDaTabela = 'direita' | 'esquerda' | 'cima' | 'baixo';

/**
 * O que uma seta da tabela faz com o valor digitado: preenche a coluna DX
 * (direita, esquerda) ou DY (cima, baixo) com esse valor por tamanho, de modo
 * que os tamanhos maiores vão para o lado da seta e os menores, para o outro.
 * Devolve a coluna e os valores absolutos (a partir do base) de cada tamanho.
 */
export function colunaDaSeta(seta: SetaDaTabela, valor: number, quantosTamanhos: number, base: number): { readonly coluna: 'dx' | 'dy'; readonly valores: number[] } {
  const sinal = seta === 'direita' || seta === 'baixo' ? 1 : -1;
  const passo = Math.abs(valor) * sinal;
  return {
    coluna: seta === 'direita' || seta === 'esquerda' ? 'dx' : 'dy',
    valores: Array.from({ length: quantosTamanhos }, (_, t) => limpo(passo * (t - base))),
  };
}

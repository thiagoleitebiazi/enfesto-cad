import type { Ponto2D } from '../core/geometria';

/** Estado da câmera do canvas: como o espaço em mm (mundo) mapeia para pixels de tela. */
export interface TransformacaoDeTela {
  readonly escalaPxPorMm: number;
  readonly offsetXPx: number;
  readonly offsetYPx: number;
}

export const ESCALA_MINIMA = 0.05;
export const ESCALA_MAXIMA = 40;

/**
 * Eixos trocados de propósito: no domínio (`domain/enfesto.ts`,
 * `domain/nesting.ts`), X é a largura útil da mesa (curta) e Y é o
 * comprimento do enfesto (longo, o sentido em que o tecido é desenfestado).
 * Numa mesa de corte real o operador vê o comprimento correndo na
 * horizontal (anda ao longo dele) e a largura na vertical (mais estreita)
 * — por isso a tela mostra mundo.y na horizontal e mundo.x na vertical,
 * para a mesa aparecer sempre retangular deitada, nunca em pé, não importa
 * a proporção largura×comprimento configurada. Esta troca fica só aqui
 * (camada de apresentação); o domínio continua em X=largura/Y=comprimento.
 */
export function mundoParaTela(p: Ponto2D, t: TransformacaoDeTela): Ponto2D {
  return {
    x: t.offsetXPx + p.y * t.escalaPxPorMm,
    y: t.offsetYPx + p.x * t.escalaPxPorMm,
  };
}

export function telaParaMundo(p: Ponto2D, t: TransformacaoDeTela): Ponto2D {
  return {
    x: (p.y - t.offsetYPx) / t.escalaPxPorMm,
    y: (p.x - t.offsetXPx) / t.escalaPxPorMm,
  };
}

/** Aplica zoom mantendo `pivotTela` (em px) fixo na mesma posição da tela. */
export function aplicarZoom(
  t: TransformacaoDeTela,
  fatorMultiplicativo: number,
  pivotTela: Ponto2D,
): TransformacaoDeTela {
  const novaEscala = Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, t.escalaPxPorMm * fatorMultiplicativo));
  const razao = novaEscala / t.escalaPxPorMm;
  return {
    escalaPxPorMm: novaEscala,
    offsetXPx: pivotTela.x - (pivotTela.x - t.offsetXPx) * razao,
    offsetYPx: pivotTela.y - (pivotTela.y - t.offsetYPx) * razao,
  };
}

/** Unidade de exibição da régua — o valor interno continua sempre em mm; isto só afeta o que é desenhado/lido. */
export type UnidadeDeRegua = 'cm' | 'mm';

/** Converte um valor em mm para a unidade de exibição da régua (cm = mm/10, mm = identidade). */
export function valorDaReguaEmUnidade(mm: number, unidade: UnidadeDeRegua): number {
  return unidade === 'cm' ? mm / 10 : mm;
}

/** Escolhe um espaçamento "redondo" em mm (1, 2, 5, 10, 20, 50, ...) cujo espaçamento em tela fique perto de `alvoPx`. */
export function passoDeReguaEmMm(escalaPxPorMm: number, alvoPx: number = 60): number {
  const passosBase = [1, 2, 5];
  let potencia = 0.001;
  let melhor = passosBase[0]! * potencia;
  let melhorDiferenca = Infinity;
  for (let i = 0; i < 12; i++) {
    for (const base of passosBase) {
      const passoMm = base * potencia;
      const espacoPx = passoMm * escalaPxPorMm;
      const diferenca = Math.abs(espacoPx - alvoPx);
      if (diferenca < melhorDiferenca) {
        melhorDiferenca = diferenca;
        melhor = passoMm;
      }
    }
    potencia *= 10;
  }
  return melhor;
}

/**
 * Quantas subdivisões desenhar entre duas marcas numeradas da régua: 10, 5, 2
 * ou nenhuma (1), a maior que ainda deixe pelo menos `minimoPx` entre traços.
 */
export function subdivisoesDaRegua(passoMm: number, escalaPxPorMm: number, minimoPx = 5): number {
  for (const divisoes of [10, 5, 2]) {
    if ((passoMm / divisoes) * escalaPxPorMm >= minimoPx) return divisoes;
  }
  return 1;
}

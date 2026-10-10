import {
  area,
  distancia,
  pontoDentroDoContorno,
  pontoMaisProximoNoSegmento,
  rotacionar,
  type Contorno,
  type Ponto2D,
} from '../core/geometria';
import { ancoraDoRotulo, transformarCota } from './cota';
import type { Molde } from './molde';

/**
 * Pences e pregas abrem a peça: uma parte dela gira ou anda, e leva junto o
 * que está nela. Aqui fica o que essas operações têm em comum.
 */

/** Um movimento rígido: para onde vai um ponto e para onde aponta uma direção. */
export interface Transformacao {
  readonly ponto: (p: Ponto2D) => Ponto2D;
  readonly vetor: (v: Ponto2D) => Ponto2D;
}

const ORIGEM: Ponto2D = { x: 0, y: 0 };

/** Giro de `graus` (anti-horário positivo) em torno de `centro` e, depois, o deslocamento dado. */
export function giroEDeslocamento(centro: Ponto2D, graus: number, deslocamento: Ponto2D = ORIGEM): Transformacao {
  return {
    ponto: (p) => {
      const girado = rotacionar(p, centro, graus);
      return { x: girado.x + deslocamento.x, y: girado.y + deslocamento.y };
    },
    vetor: (v) => rotacionar(v, ORIGEM, graus),
  };
}

/** Distância do ponto a uma linha aberta (a menor até um dos segmentos dela). */
export function distanciaAteALinha(p: Ponto2D, linha: readonly Ponto2D[]): number {
  if (linha.length === 0) return Infinity;
  if (linha.length === 1) return distancia(p, linha[0]!);
  let menor = Infinity;
  for (let i = 1; i < linha.length; i++) {
    menor = Math.min(menor, distancia(p, pontoMaisProximoNoSegmento(p, linha[i - 1]!, linha[i]!)));
  }
  return menor;
}

/**
 * Das duas regiões em que a peça foi dividida, a que se move: a que não tem o
 * meio da linha de fio (assim o fio fica onde está). Se o meio do fio não
 * está em nenhuma, ou está na divisa, move-se a menor.
 */
export function regiaoQueAnda(molde: Molde, regiao0: Contorno, regiao1: Contorno): 0 | 1 {
  const meio = {
    x: (molde.linhaDeFio.inicio.x + molde.linhaDeFio.fim.x) / 2,
    y: (molde.linhaDeFio.inicio.y + molde.linhaDeFio.fim.y) / 2,
  };
  const em0 = pontoDentroDoContorno(meio, regiao0);
  const em1 = pontoDentroDoContorno(meio, regiao1);
  if (em0 !== em1) return em0 ? 1 : 0;
  return area(regiao0) <= area(regiao1) ? 0 : 1;
}

/**
 * A peça com o que está na região levado pelo movimento: furos, linhas
 * internas, marcas e cotas pela posição (dentro da região), e piques e pontos
 * graduados pela borda em que estão (`cadeiaQueAnda`, o trecho do contorno
 * que se move, ou `cadeiaQueFica`). O contorno e a linha de fio não são
 * tocados aqui.
 */
export function levarOQueEstaNaRegiao(
  molde: Molde,
  regiao: Contorno,
  cadeiaQueAnda: readonly Ponto2D[],
  cadeiaQueFica: readonly Ponto2D[],
  movimento: Transformacao,
): Molde {
  const dentro = (p: Ponto2D): boolean => pontoDentroDoContorno(p, regiao);
  const levar = (linha: Contorno): Contorno => linha.map(movimento.ponto);
  const naBordaQueAnda = (p: Ponto2D): boolean => distanciaAteALinha(p, cadeiaQueAnda) < distanciaAteALinha(p, cadeiaQueFica) - 1e-9;
  return {
    ...molde,
    furos: molde.furos.map((f) => (dentro(f[0]!) ? levar(f) : f)),
    linhasInternas: molde.linhasInternas.map((l) => (dentro(l[0]!) ? levar(l) : l)),
    marcas: molde.marcas.map((m) => (dentro(m.posicao) ? { ...m, posicao: movimento.ponto(m.posicao) } : m)),
    piques: molde.piques.map((p) => (naBordaQueAnda(p.posicao) ? { ...p, posicao: movimento.ponto(p.posicao) } : p)),
    ...(molde.graduacao
      ? {
          graduacao: {
            ...molde.graduacao,
            pontos: molde.graduacao.pontos.map((p) =>
              naBordaQueAnda(p.posicao)
                ? { ...p, posicao: movimento.ponto(p.posicao), deslocamentos: p.deslocamentos.map(movimento.vetor) }
                : p,
            ),
          },
        }
      : {}),
    ...(molde.cotas
      ? { cotas: molde.cotas.map((c) => (dentro(ancoraDoRotulo(c)) ? transformarCota(c, movimento.ponto, movimento.vetor) : c)) }
      : {}),
    ...(molde.curvas
      ? {
          curvas: molde.curvas.map((curva) =>
            curva.pontos.every(naBordaQueAnda) ? { ...curva, controles: levar(curva.controles), pontos: levar(curva.pontos) } : curva,
          ),
        }
      : {}),
    // A pence do contorno anda com a borda em que está; a marcada e a interna, com a linha interna delas.
    ...(molde.pences
      ? {
          pences: molde.pences.map((pence) => {
            const anda = pence.tipo === 'recortada' ? pence.pontos.every(naBordaQueAnda) : dentro(pence.pontos[0]!);
            // O pivô é um ponto do contorno: anda se estiver na borda que anda, esteja a pence onde estiver.
            const comPivo = pence.pivo && naBordaQueAnda(pence.pivo) ? { ...pence, pivo: movimento.ponto(pence.pivo) } : pence;
            return anda
              ? { ...comPivo, pontos: levar(pence.pontos), ...(pence.removidos ? { removidos: levar(pence.removidos) } : {}) }
              : comPivo;
          }),
        }
      : {}),
  };
}

/**
 * A mesma volta, começando pelo ponto de menor número do contorno original
 * que continua nela, no mesmo lugar — assim a numeração dos pontos que não
 * saíram do lugar muda o mínimo possível. Se nenhum continua, a volta fica
 * como está.
 */
export function comecarPeloMenorPontoOriginal(volta: readonly Ponto2D[], original: Contorno): Ponto2D[] {
  for (const p of original) {
    const onde = volta.findIndex((q) => distancia(p, q) <= 1e-9);
    if (onde >= 0) return [...volta.slice(onde), ...volta.slice(0, onde)];
  }
  return [...volta];
}

/** Tira os pontos repetidos em seguida (e o último, se repete o primeiro) de uma volta fechada. */
export function semPontosRepetidos(volta: readonly Ponto2D[], toleranciaMm = 1e-6): Ponto2D[] {
  const limpa: Ponto2D[] = [];
  for (const p of volta) {
    if (limpa.length === 0 || distancia(limpa.at(-1)!, p) > toleranciaMm) limpa.push(p);
  }
  if (limpa.length > 1 && distancia(limpa.at(-1)!, limpa[0]!) <= toleranciaMm) limpa.pop();
  return limpa;
}

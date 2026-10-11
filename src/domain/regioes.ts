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
import { comOAlinhamentoLevado, curvaLevada, penceLevada, type Molde } from './molde';

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
 * A peça com o que está na região levado pelo movimento: furos, marcas e
 * cotas pela posição (dentro da região), linhas internas pela região em que
 * está a maior parte delas, e piques e pontos
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
  return levarOQueEstaNasRegioes(molde, [regiao], [cadeiaQueAnda], [cadeiaQueFica], movimento);
}

/**
 * O mesmo, quando o que se move são várias regiões da peça de uma vez (a peça
 * cortada em mais de um trecho da mesma reta): vale estar dentro de qualquer
 * uma delas, e a borda mais próxima entre todos os trechos do contorno que
 * andam e todos os que ficam.
 */
export function levarOQueEstaNasRegioes(
  molde: Molde,
  regioes: readonly Contorno[],
  cadeiasQueAndam: readonly (readonly Ponto2D[])[],
  cadeiasQueFicam: readonly (readonly Ponto2D[])[],
  movimento: Transformacao,
): Molde {
  const dentro = (p: Ponto2D): boolean => regioes.some((regiao) => pontoDentroDoContorno(p, regiao));
  /**
   * A linha vai com a região quando a maior parte dela está lá: conta o meio de
   * cada trecho. As pontas não servem para decidir — a linha que vai de borda a
   * borda tem as duas em cima do contorno, que é a divisa da região, e ali
   * "dentro" tanto pode dar sim como não.
   */
  const linhaDentro = (linha: Contorno): boolean => {
    if (linha.length < 2) return linha.length === 1 && dentro(linha[0]!);
    let trechosDentro = 0;
    for (let i = 1; i < linha.length; i++) {
      if (dentro({ x: (linha[i - 1]!.x + linha[i]!.x) / 2, y: (linha[i - 1]!.y + linha[i]!.y) / 2 })) trechosDentro++;
    }
    return trechosDentro * 2 > linha.length - 1;
  };
  const levar = (linha: Contorno): Contorno => linha.map(movimento.ponto);
  const ate = (p: Ponto2D, cadeias: readonly (readonly Ponto2D[])[]): number => Math.min(...cadeias.map((cadeia) => distanciaAteALinha(p, cadeia)));
  const naBordaQueAnda = (p: Ponto2D): boolean => ate(p, cadeiasQueAndam) < ate(p, cadeiasQueFicam) - 1e-9;
  return {
    ...molde,
    furos: molde.furos.map((f) => (dentro(f[0]!) ? levar(f) : f)),
    linhasInternas: molde.linhasInternas.map((l) => (linhaDentro(l) ? levar(l) : l)),
    ...(molde.elementos ? { elementos: molde.elementos.map((l) => (linhaDentro(l) ? levar(l) : l)) } : {}),
    // O pique interno alinhado leva junto o que anda em cada tamanho, girado como a região.
    marcas: molde.marcas.map((m) => (dentro(m.posicao) ? comOAlinhamentoLevado({ ...m, posicao: movimento.ponto(m.posicao) }, movimento.vetor) : m)),
    piques: molde.piques.map((p) => {
      const levado = naBordaQueAnda(p.posicao) ? { ...p, posicao: movimento.ponto(p.posicao) } : p;
      // A referência da graduação do pique é um ponto do contorno: anda se estiver na borda que anda.
      const referencia = p.graduacao?.referencia;
      return referencia && naBordaQueAnda(referencia) ? { ...levado, graduacao: { ...p.graduacao!, referencia: movimento.ponto(referencia) } } : levado;
    }),
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
            curva.pontos.every(naBordaQueAnda) ? curvaLevada(curva, movimento.ponto) : curva,
          ),
        }
      : {}),
    // A prega registrada: cada ponta anda com a borda em que está, e cada linha, como a linha interna que ela é.
    ...(molde.pregas
      ? {
          pregas: molde.pregas.map((prega) => {
            const ponta = (p: Ponto2D): Ponto2D => (naBordaQueAnda(p) ? movimento.ponto(p) : p);
            return {
              ...prega,
              parada: [ponta(prega.parada[0]), ponta(prega.parada[1])] as const,
              movida: [ponta(prega.movida[0]), ponta(prega.movida[1])] as const,
              linhas: prega.linhas.map((l) => (linhaDentro(l) ? levar(l) : l)),
              // As linhas guardadas estão em cima da borda parada da prega: andam com ela.
              ...(prega.linhasTiradas ? { linhasTiradas: prega.linhasTiradas.map((l) => (naBordaQueAnda(prega.parada[0]) ? levar(l) : l)) } : {}),
            };
          }),
        }
      : {}),
    // A prega em cunha registrada: do mesmo jeito, cada ponta com a borda em que está e cada linha como a linha interna que é.
    ...(molde.cunhas
      ? {
          cunhas: molde.cunhas.map((cunha) => {
            const ponta = (p: Ponto2D): Ponto2D => (naBordaQueAnda(p) ? movimento.ponto(p) : p);
            return {
              ...cunha,
              travessias: cunha.travessias.map((x) => ({ ...x, parada: ponta(x.parada), movida: ponta(x.movida) })),
              linhas: cunha.linhas.map((l) => (linhaDentro(l) ? levar(l) : l)),
            };
          }),
        }
      : {}),
    // A pence do contorno anda com a borda em que está; a marcada e a interna, com a linha interna delas.
    ...(molde.pences
      ? {
          pences: molde.pences.map((pence) => {
            // A marcada tem as pontas em cima do contorno: quem diz onde ela está é a linha das pernas, como a linha interna que é.
            const anda = pence.tipo === 'recortada' ? pence.pontos.every(naBordaQueAnda) : pence.tipo === 'marcada' ? linhaDentro(pence.pontos) : dentro(pence.pontos[0]!);
            // O pivô é um ponto do contorno: anda se estiver na borda que anda, esteja a pence onde estiver.
            const comPivo = pence.pivo && naBordaQueAnda(pence.pivo) ? { ...pence, pivo: movimento.ponto(pence.pivo) } : pence;
            // A pence que anda leva todos os pontos dela; o pivô segue a regra de cima.
            return anda ? { ...penceLevada(pence, movimento.ponto), ...(comPivo.pivo ? { pivo: comPivo.pivo } : {}) } : comPivo;
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

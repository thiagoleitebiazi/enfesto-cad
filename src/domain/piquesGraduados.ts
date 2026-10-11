import {
  andarNoContorno,
  comprimentoDaLinha,
  distancia,
  perimetro,
  trechoDoContorno,
  type Contorno,
  type Ponto2D,
  type PosicaoNoContorno,
} from '../core/geometria';
import { verticesGraduados } from './graduacao';
import { reancorarPiques, type Molde, type Pique } from './molde';

/**
 * A graduação dos piques ("tabela dos piques de contorno"). Sem ela, o pique
 * fica, em cada tamanho, na mesma proporção da aresta em que está. Com ela, o
 * pique fica a uma distância certa de um ponto de referência do contorno,
 * medida sobre o contorno: a que tem no tamanho base mais o "perímetro" de
 * cada tamanho.
 */

const NO_MESMO_LUGAR_MM = 1e-6;

function verticeEm(contorno: Contorno, p: Ponto2D): number {
  return contorno.findIndex((v) => distancia(v, p) <= NO_MESMO_LUGAR_MM);
}

function noPonto(contorno: Contorno, indice: number): PosicaoNoContorno {
  return { indiceAresta: indice, ponto: contorno[indice]! };
}

/**
 * A distância, sobre o contorno, do ponto `referencia` até o pique: positiva
 * andando no sentido da numeração dos pontos, negativa no contrário — pelo
 * caminho mais curto dos dois.
 */
function distanciaDaReferencia(contorno: Contorno, referencia: number, pique: Pique): number {
  const adiante = comprimentoDaLinha(trechoDoContorno(contorno, noPonto(contorno, referencia), { indiceAresta: pique.indiceAresta, ponto: pique.posicao }));
  const paraTras = perimetro(contorno) - adiante;
  return adiante <= paraTras ? adiante : 0 - paraTras;
}

/** O número (a partir de 0) do ponto de referência do pique, se a graduação dele vale nesta peça; senão, `null`. */
export function referenciaDoPique(molde: Molde, pique: Pique): number | null {
  const graduacao = molde.graduacao;
  if (!graduacao || !pique.graduacao || pique.graduacao.perimetros.length !== graduacao.tamanhos.length) return null;
  const indice = verticeEm(molde.contorno, pique.graduacao.referencia);
  return indice >= 0 ? indice : null;
}

/**
 * O ponto de referência que a tabela propõe para um pique: o ponto graduado
 * do contorno mais perto dele, andando sobre o contorno (ou, se a peça não tem
 * ponto graduado, o ponto mais perto).
 */
export function referenciaSugerida(molde: Molde, pique: Pique): number {
  const candidatos = molde.graduacao ? verticesGraduados(molde.graduacao, molde.contorno) : [];
  const todos = candidatos.length > 0 ? candidatos : molde.contorno.map((_, i) => i);
  let melhor = todos[0] ?? 0;
  let menor = Infinity;
  for (const indice of todos) {
    const d = Math.abs(distanciaDaReferencia(molde.contorno, indice, pique));
    if (d < menor) {
      menor = d;
      melhor = indice;
    }
  }
  return melhor;
}

/** Quanto a distância do pique à referência muda em cada tamanho (mm); zeros, se o pique não tem graduação que valha. */
export function perimetrosDoPique(molde: Molde, pique: Pique): number[] {
  const quantos = molde.graduacao?.tamanhos.length ?? 0;
  return referenciaDoPique(molde, pique) === null ? Array.from({ length: quantos }, () => 0) : [...pique.graduacao!.perimetros];
}

/** A que distância o pique está do ponto dado, sobre o contorno (mm, sem sinal). */
export function distanciaAteAReferencia(molde: Molde, pique: Pique, referencia: number): number {
  return Math.abs(distanciaDaReferencia(molde.contorno, referencia, pique));
}

/**
 * Dá ao pique a graduação: o ponto de referência (pelo número, a partir de 0)
 * e o "perímetro" de cada tamanho — quanto a distância dele à referência,
 * sobre o contorno, muda nesse tamanho (no base, zero).
 */
export function definirGraduacaoDoPique(molde: Molde, piqueId: string, indiceDaReferencia: number, perimetros: readonly number[]): Molde {
  const graduacao = molde.graduacao;
  if (!graduacao) throw new Error(`A peça “${molde.nome}” não tem graduação: defina os tamanhos dela antes.`);
  if (!molde.piques.some((q) => q.id === piqueId)) throw new Error('Pique não encontrado na peça.');
  const referencia = molde.contorno[indiceDaReferencia];
  if (!Number.isInteger(indiceDaReferencia) || !referencia) throw new Error(`O ponto de referência precisa ser um ponto do contorno, de 1 a ${molde.contorno.length}.`);
  if (perimetros.length !== graduacao.tamanhos.length) throw new Error('O pique precisa de um valor de perímetro para cada tamanho.');
  if (!perimetros.every((valor) => Number.isFinite(valor))) throw new Error('Os valores de perímetro precisam ser números.');
  // O base é a referência: nele o pique está onde foi posto.
  const valores = perimetros.map((valor, t) => (t === graduacao.base || valor === 0 ? 0 : valor));
  return { ...molde, piques: molde.piques.map((q) => (q.id === piqueId ? { ...q, graduacao: { referencia, perimetros: valores } } : q)) };
}

/** A direção do contorno onde o pique está, no sentido da numeração dos pontos (um vetor de comprimento 1). */
export function direcaoDoContornoNoPique(molde: Molde, pique: Pique): Ponto2D {
  const de = molde.contorno[pique.indiceAresta];
  const ate = molde.contorno[(pique.indiceAresta + 1) % molde.contorno.length];
  const comprimento = de && ate ? distancia(de, ate) : 0;
  if (!de || !ate || comprimento <= NO_MESMO_LUGAR_MM) throw new Error('A aresta do pique não tem comprimento: não dá a direção em que ele anda.');
  return { x: (ate.x - de.x) / comprimento, y: (ate.y - de.y) / comprimento };
}

/**
 * Gradua o pique fazendo-o andar sobre o contorno: `passoMm` no sentido da
 * numeração dos pontos (negativo, no contrário). É o que "Automático" e
 * "Tangente" fazem com um pique. `tamanho` e `incremental` valem como na
 * regra de um ponto: em todos os tamanhos (`tamanho` nulo) ou num só — os
 * outros ficam como estavam; cada tamanho andando o passo a mais que o
 * vizinho do lado do base (incremental), ou o passo a partir do base. Abaixo
 * do base, anda ao contrário. A referência é a que o pique já tem ou, sem
 * graduação, a sugerida (o ponto graduado mais perto).
 */
export function graduarPiqueNoContorno(molde: Molde, piqueId: string, passoMm: number, tamanho: number | null, incremental = true): Molde {
  const graduacao = molde.graduacao;
  if (!graduacao) throw new Error(`A peça “${molde.nome}” não tem graduação: defina os tamanhos dela antes.`);
  const pique = molde.piques.find((q) => q.id === piqueId);
  if (!pique) throw new Error('Pique não encontrado na peça.');
  if (!Number.isFinite(passoMm)) throw new Error('A distância que o pique anda precisa ser um número.');
  const referencia = referenciaDoPique(molde, pique) ?? referenciaSugerida(molde, pique);
  // O "perímetro" conta para longe da referência: andando no sentido da numeração, aumenta se o pique está adiante dela e diminui se está atrás.
  const sentido = distanciaDaReferencia(molde.contorno, referencia, pique) < 0 ? -1 : 1;
  const base = graduacao.base;
  const andados = perimetrosDoPique(molde, pique).map((valor) => valor * sentido);
  if (tamanho === null) {
    graduacao.tamanhos.forEach((_, t) => {
      andados[t] = incremental ? passoMm * (t - base) : passoMm * Math.sign(t - base);
    });
  } else {
    if (!Number.isInteger(tamanho) || tamanho < 0 || tamanho >= graduacao.tamanhos.length) throw new Error('Tamanho fora da graduação.');
    if (tamanho === base) throw new Error('O tamanho base é o do contorno desenhado e não anda: escolha outro tamanho.');
    const sinal = tamanho > base ? 1 : -1;
    andados[tamanho] = incremental ? (andados[tamanho - sinal] ?? 0) + passoMm * sinal : passoMm * sinal;
  }
  // Zero vezes um número negativo dá "-0": fica zero.
  return definirGraduacaoDoPique(molde, piqueId, referencia, andados.map((valor) => (valor * sentido === 0 ? 0 : valor * sentido)));
}

/** Tira a graduação do pique: ele volta a andar na proporção da aresta em que está. */
export function removerGraduacaoDoPique(molde: Molde, piqueId: string): Molde {
  return { ...molde, piques: molde.piques.map((q) => (q.id === piqueId ? semGraduacao(q) : q)) };
}

/** O pique sem o campo da graduação. */
export function semGraduacao(pique: Pique): Pique {
  if (!pique.graduacao) return pique;
  const copia: { -readonly [K in keyof Pique]: Pique[K] } = { ...pique };
  delete copia.graduacao;
  return copia;
}

/**
 * Os piques da peça como ficam num tamanho, dado o contorno desse tamanho
 * (mesmos pontos, na mesma ordem). O pique graduado fica à distância certa da
 * referência; os outros, na mesma proporção da aresta. A referência de cada
 * pique graduado passa a ser o ponto dela nesse tamanho.
 */
export function piquesNoTamanho(molde: Molde, contornoDoTamanho: Contorno, tamanho: number): Pique[] {
  const proporcionais = reancorarPiques(molde.piques, molde.contorno, contornoDoTamanho);
  return molde.piques.map((pique, k) => {
    const referencia = referenciaDoPique(molde, pique);
    if (referencia === null) return proporcionais[k]!;
    const noBase = distanciaDaReferencia(molde.contorno, referencia, pique);
    const sentido = noBase < 0 ? -1 : 1;
    const noTamanho = noBase + sentido * (pique.graduacao!.perimetros[tamanho] ?? 0);
    const onde = andarNoContorno(contornoDoTamanho, noPonto(contornoDoTamanho, referencia), noTamanho);
    return { ...pique, posicao: onde.ponto, indiceAresta: onde.indiceAresta, graduacao: { ...pique.graduacao!, referencia: contornoDoTamanho[referencia]! } };
  });
}

/**
 * Os "perímetros" de um pique depois que a lista de tamanhos (ou o base)
 * mudou: `antigoDe[t]` é a posição, na lista antiga, do tamanho que agora é o
 * `t` (-1 para um tamanho novo, que entra igual ao base).
 */
export function perimetrosNosTamanhosNovos(perimetros: readonly number[], antigoDe: readonly number[], antigoDoBase: number): number[] {
  const doBase = antigoDoBase >= 0 ? (perimetros[antigoDoBase] ?? 0) : 0;
  return antigoDe.map((antigo) => {
    const valor = (antigo >= 0 ? (perimetros[antigo] ?? 0) : doBase) - doBase;
    return valor === 0 ? 0 : valor;
  });
}

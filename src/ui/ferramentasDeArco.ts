import { arcoDaAresta, concordanciaNoCanto, ladosDoCanto, type TipoDeLado } from '../core/arcos';
import { distancia, substituirTrechoDoContorno, type Contorno, type PosicaoNoContorno } from '../core/geometria';
import { cotaDeRaio, type CotaDeRaio } from '../domain/cota';
import { comArcoRegistrado } from '../domain/curvasDaPeca';
import { arredondarCantoDoMolde, piquesQueFicamNoContorno, type Molde } from '../domain/molde';

/**
 * Ferramentas que dependem de reconhecer arcos no contorno (`core/arcos.ts`):
 * os três arcos de concordância num canto — entre duas retas, entre um arco e
 * uma reta, e entre dois arcos — e a cota de raio.
 */
export type FerramentaDeCanto = 'arco-tangente' | 'arco-tangente-arco-reta' | 'arco-tangente-2-arcos';

export function ehFerramentaDeCanto(modo: string): modo is FerramentaDeCanto {
  return modo === 'arco-tangente' || modo === 'arco-tangente-arco-reta' || modo === 'arco-tangente-2-arcos';
}

const NOME: Record<FerramentaDeCanto, string> = {
  'arco-tangente': 'Arco tangente a 2 retas',
  'arco-tangente-arco-reta': 'Arco tangente a arco e reta',
  'arco-tangente-2-arcos': 'Arco tangente a 2 arcos',
};

export function nomeDaFerramentaDeCanto(ferramenta: FerramentaDeCanto): string {
  return NOME[ferramenta];
}

/** Quantos dos dois lados do canto são arcos. */
function arcosNoCanto(lados: readonly [TipoDeLado, TipoDeLado]): 0 | 1 | 2 {
  return ((lados[0] === 'arco' ? 1 : 0) + (lados[1] === 'arco' ? 1 : 0)) as 0 | 1 | 2;
}

const FERRAMENTA_PARA: Record<0 | 1 | 2, FerramentaDeCanto> = {
  0: 'arco-tangente',
  1: 'arco-tangente-arco-reta',
  2: 'arco-tangente-2-arcos',
};
const DESCRICAO: Record<0 | 1 | 2, string> = { 0: 'duas retas', 1: 'um arco e uma reta', 2: 'dois arcos' };

/** A ferramenta de concordância que serve para o canto `indice`: a das duas retas, a do arco e reta ou a dos dois arcos. */
export function ferramentaDoCanto(contorno: Contorno, indice: number): FerramentaDeCanto {
  return FERRAMENTA_PARA[arcosNoCanto(ladosDoCanto(contorno, indice))];
}

/**
 * Por que o canto clicado não serve para a ferramenta, ou `null` se serve.
 * Cada ferramenta vale para um tipo de canto, e a recusa diz qual é a certa.
 */
export function recusaDoCanto(ferramenta: FerramentaDeCanto, contorno: Contorno, indice: number): string | null {
  const n = contorno.length;
  const antes = arcoDaAresta(contorno, (indice - 1 + n) % n);
  const depois = arcoDaAresta(contorno, indice);
  if (antes && depois && (antes.completo || (antes.inicio === depois.inicio && antes.fim === depois.fim))) {
    return 'Esse ponto está no meio de um arco: não é um canto.';
  }
  const quantos = arcosNoCanto([antes ? 'arco' : 'reta', depois ? 'arco' : 'reta']);
  if (FERRAMENTA_PARA[quantos] === ferramenta) return null;
  return `Esse canto fica entre ${DESCRICAO[quantos]}: use “${NOME[FERRAMENTA_PARA[quantos]]}”.`;
}

/**
 * Troca o canto `indice` da peça por um arco de raio dado, tangente aos dois
 * elementos que se encontram nele. Entre duas retas, é o arredondar de sempre
 * (que reduz o raio ao que cabe); com um arco de algum lado, o arco de
 * concordância exato, recusado se o raio não cabe. Com `idDoArco`, o arco
 * fica registrado na peça: dá para mexer no ponto de passagem dele depois.
 */
export function arredondarCanto(molde: Molde, indice: number, raioMm: number, idDoArco?: string): Molde {
  if (ferramentaDoCanto(molde.contorno, indice) === 'arco-tangente') return arredondarCantoDoMolde(molde, indice, raioMm, idDoArco);
  const { de, ate, miolo } = concordanciaNoCanto(molde.contorno, indice, raioMm);
  const contorno = substituirTrechoDoContorno(molde.contorno, de, ate, miolo);
  if (contorno.length < 3) throw new Error(`O contorno da peça "${molde.nome}" ficaria sem área com esse raio.`);
  const arredondada = { ...molde, contorno, piques: piquesQueFicamNoContorno(molde.piques, contorno) };
  return idDoArco === undefined ? arredondada : comArcoRegistrado(arredondada, [de.ponto, ...miolo, ate.ponto], idDoArco);
}

/**
 * A cota de raio do arco que passa pela posição clicada no contorno, ou
 * `null` se ali o contorno é reta. Num canto entre um arco e uma reta, vale o
 * arco.
 */
export function cotaDeRaioEm(contorno: Contorno, posicao: PosicaoNoContorno, id: string): CotaDeRaio | null {
  const n = contorno.length;
  const noVertice = distancia(posicao.ponto, contorno[posicao.indiceAresta]!) < 1e-9;
  const arco = arcoDaAresta(contorno, posicao.indiceAresta) ?? (noVertice ? arcoDaAresta(contorno, (posicao.indiceAresta - 1 + n) % n) : null);
  if (!arco) return null;
  // O ponto da cota fica sobre o círculo, na direção do clique.
  const ateOClique = distancia(arco.centro, posicao.ponto);
  const k = ateOClique > 1e-9 ? arco.raio / ateOClique : 1;
  const noArco = { x: arco.centro.x + (posicao.ponto.x - arco.centro.x) * k, y: arco.centro.y + (posicao.ponto.y - arco.centro.y) * k };
  return cotaDeRaio(id, arco.centro, noArco);
}

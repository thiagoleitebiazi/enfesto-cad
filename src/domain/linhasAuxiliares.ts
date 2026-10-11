import { comprimentoDaLinha, distancia, type Contorno } from '../core/geometria';
import type { Molde } from './molde';

/**
 * Linhas auxiliares e elementos (aba Marcações > Linhas auxiliares).
 *
 * Uma linha interna da peça é uma **linha auxiliar** — faz parte do molde:
 * sai no PDF com ele — ou um **elemento**, só de construção: fica na tela e
 * serve às ferramentas que pedem um elemento (cortar, dobrar, alinhar,
 * múltiplos piques…), mas não sai no PDF.
 *
 * Neste programa toda linha interna nasce fazendo parte do molde. O registro
 * `elementos` guarda as que foram tiradas dele, pelos pontos de cada uma; a
 * linha mexida por outro caminho deixa de casar com o registro e volta a ser
 * linha auxiliar — o lado seguro: ela sai no PDF.
 */
const MESMO_PONTO_MM = 1e-6;

/** As duas linhas são a mesma sequência de pontos, num sentido ou no outro. */
function mesmaLinha(a: Contorno, b: Contorno): boolean {
  if (a.length !== b.length) return false;
  return a.every((p, i) => distancia(p, b[i]!) <= MESMO_PONTO_MM) || a.every((p, i) => distancia(p, b[b.length - 1 - i]!) <= MESMO_PONTO_MM);
}

/** A linha interna de número dado é um elemento (só de construção). */
export function ehElemento(molde: Molde, indiceDaLinha: number): boolean {
  const linha = molde.linhasInternas[indiceDaLinha];
  return linha !== undefined && (molde.elementos ?? []).some((elemento) => mesmaLinha(elemento, linha));
}

/** Os números das linhas internas que são elementos. */
export function elementosDaPeca(molde: Molde): number[] {
  return molde.linhasInternas.map((_, i) => i).filter((i) => ehElemento(molde, i));
}

/** As linhas internas que fazem parte do molde (as auxiliares): as que vão para o PDF. */
export function linhasDoMolde(molde: Molde): Contorno[] {
  return molde.linhasInternas.filter((_, i) => !ehElemento(molde, i));
}

/** O comprimento somado das linhas auxiliares da peça (mm). */
export function comprimentoDasLinhasAuxiliares(molde: Molde): number {
  return linhasDoMolde(molde).reduce((soma, linha) => soma + comprimentoDaLinha(linha), 0);
}

/**
 * O registro só com as linhas que ainda estão na peça — ou na metade dela que
 * a dobra guarda, e que o "Desdobrar" traz de volta —, sem repetição; sem
 * nenhuma, a peça fica sem o campo.
 */
function comRegistro(molde: Molde, elementos: readonly Contorno[]): Molde {
  const linhas = [...molde.linhasInternas, ...(molde.dobraMantida?.linhasInternas ?? [])];
  const validos = elementos.filter((elemento, k) => linhas.some((linha) => mesmaLinha(elemento, linha)) && elementos.findIndex((outro) => mesmaLinha(outro, elemento)) === k);
  const copia: { -readonly [K in keyof Molde]: Molde[K] } = { ...molde };
  if (validos.length > 0) copia.elementos = validos;
  else delete copia.elementos;
  return copia;
}

/**
 * Leva o registro por uma mudança nas linhas internas: `destinos(i)` diz em
 * que números ficou, em `depois`, a linha que em `antes` era a de número `i`.
 * Sem `destinos`, cada linha continua no número que tinha.
 */
export function elementosLevados(antes: Molde, depois: Molde, destinos: (indice: number) => readonly number[] = (i) => [i]): Molde {
  if (!antes.elementos) return depois;
  const levados = elementosDaPeca(antes)
    .flatMap(destinos)
    .map((i) => depois.linhasInternas[i])
    .filter((linha): linha is Contorno => linha !== undefined);
  // O que já estava no registro e continua valendo (as linhas da metade guardada pela dobra) fica.
  return comRegistro(depois, [...levados, ...antes.elementos]);
}

/** "Remover": as linhas auxiliares de número dado voltam a ser elementos, só de construção. */
export function tornarElementos(molde: Molde, indices: readonly number[]): Molde {
  const novas = indices.map((i) => molde.linhasInternas[i]).filter((linha): linha is Contorno => linha !== undefined);
  return comRegistro(molde, [...(molde.elementos ?? []), ...novas]);
}

/** "Adicionar": os elementos de número dado passam a ser linhas auxiliares, parte do molde. */
export function tornarAuxiliares(molde: Molde, indices: readonly number[]): Molde {
  const saem = indices.map((i) => molde.linhasInternas[i]).filter((linha): linha is Contorno => linha !== undefined);
  return comRegistro(
    molde,
    (molde.elementos ?? []).filter((elemento) => !saem.some((linha) => mesmaLinha(elemento, linha))),
  );
}

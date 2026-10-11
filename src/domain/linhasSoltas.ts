import { distancia, distanciaEntreSegmentos, pontoDentroDoContorno, pontoMaisProximoNoContorno, retanguloEnvolvente, type Contorno, type Ponto2D } from '../core/geometria';
import type { Molde } from './molde';

/**
 * Linhas internas soltas: as que estão inteiras do lado de fora da peça, longe
 * do contorno. Não são do molde — são sobra de desenho ou de importação —, e
 * atrapalham sem aparecer: ficam fora do enquadramento da peça, mas continuam
 * sendo linhas dela para as ferramentas e para o registro do PDF.
 *
 * A linha que toca o contorno, que o atravessa, ou que passa perto dele pelo
 * lado de fora não é solta: pode ser um prolongamento ou uma marcação de
 * costura.
 */

/** A mais de quanto (mm) do contorno a linha inteira precisa estar, do lado de fora, para contar como solta. */
export const FOLGA_DA_LINHA_SOLTA_MM = 10;

/** Uma linha interna solta: o número dela na peça e a quanto está do contorno (mm). */
export interface LinhaSolta {
  readonly indice: number;
  readonly distanciaMm: number;
}

/** A menor distância entre a linha (aberta) e o contorno (fechado); 0 se ela o toca ou atravessa. */
function distanciaDaLinhaAoContorno(linha: Contorno, contorno: Contorno): number {
  if (linha.length === 1) return distancia(linha[0]!, pontoMaisProximoNoContorno(linha[0]!, contorno).ponto);
  let menor = Infinity;
  for (let k = 1; k < linha.length; k++) {
    for (let i = 0; i < contorno.length; i++) {
      const d = distanciaEntreSegmentos(linha[k - 1]!, linha[k]!, contorno[i]!, contorno[(i + 1) % contorno.length]!);
      if (d < menor) menor = d;
    }
  }
  return menor;
}

/** As linhas internas soltas da peça: inteiras fora do contorno, a mais de `folgaMm` dele. */
export function linhasSoltas(molde: Molde, folgaMm = FOLGA_DA_LINHA_SOLTA_MM): LinhaSolta[] {
  if (molde.contorno.length < 3) return [];
  const soltas: LinhaSolta[] = [];
  molde.linhasInternas.forEach((linha, indice) => {
    // A linha com um ponto dentro da peça não é solta: é o caso de quase todas, e sai aqui, na primeira conta.
    if (linha.length === 0 || linha.some((p) => pontoDentroDoContorno(p, molde.contorno))) return;
    const distanciaMm = distanciaDaLinhaAoContorno(linha, molde.contorno);
    if (distanciaMm > folgaMm) soltas.push({ indice, distanciaMm });
  });
  return soltas;
}

/** A peça sem as linhas internas de número dado. A mesma peça, se não há nenhuma a tirar. */
function semAsLinhas(molde: Molde, indices: readonly number[]): Molde {
  const saem = new Set(indices);
  return saem.size === 0 ? molde : { ...molde, linhasInternas: molde.linhasInternas.filter((_, i) => !saem.has(i)) };
}

/** A peça sem as linhas internas soltas. A mesma peça, se não há nenhuma. */
export function semLinhasSoltas(molde: Molde, folgaMm = FOLGA_DA_LINHA_SOLTA_MM): Molde {
  return semAsLinhas(
    molde,
    linhasSoltas(molde, folgaMm).map((solta) => solta.indice),
  );
}

/**
 * A mais de quanto (mm) para fora da caixa do contorno um ponto da linha
 * precisa estar para ela contar como linha que sai da peça. É bastante: a
 * linha de construção que passa um pouco da borda não entra.
 */
export const FOLGA_DA_LINHA_QUE_SAI_MM = 100;

/**
 * As linhas internas que saem da peça: têm parte nela (ou junto dela) e vão
 * para bem longe — uma moldura do desenho, o contorno de outra peça que veio
 * junto na importação. A linha solta, que está inteira longe da peça, não
 * entra aqui: é dita por `linhasSoltas`. `distanciaMm` é até onde a linha
 * vai, para fora do contorno.
 *
 * A conta é pela caixa do contorno (o retângulo em volta dele), que é barata
 * e não erra para mais: o ponto a mais de `folgaMm` da caixa está a mais
 * disso do contorno.
 */
export function linhasQueSaem(molde: Molde, folgaMm = FOLGA_DA_LINHA_QUE_SAI_MM): LinhaSolta[] {
  if (molde.contorno.length < 3) return [];
  const caixa = retanguloEnvolvente(molde.contorno);
  const longeDaCaixa = (p: Ponto2D): boolean => p.x < caixa.minX - folgaMm || p.x > caixa.maxX + folgaMm || p.y < caixa.minY - folgaMm || p.y > caixa.maxY + folgaMm;
  const soltas = new Set(linhasSoltas(molde).map((solta) => solta.indice));
  const saem: LinhaSolta[] = [];
  molde.linhasInternas.forEach((linha, indice) => {
    if (soltas.has(indice)) return;
    const longe = linha.filter(longeDaCaixa);
    if (longe.length === 0) return;
    saem.push({ indice, distanciaMm: Math.max(...longe.map((p) => distancia(p, pontoMaisProximoNoContorno(p, molde.contorno).ponto))) });
  });
  return saem;
}

/** A peça sem as linhas internas que saem dela (cada uma sai inteira). A mesma peça, se não há nenhuma. */
export function semLinhasQueSaem(molde: Molde, folgaMm = FOLGA_DA_LINHA_QUE_SAI_MM): Molde {
  return semAsLinhas(
    molde,
    linhasQueSaem(molde, folgaMm).map((linha) => linha.indice),
  );
}

import {
  area,
  distancia,
  pontoDentroDoContorno,
  pontoMaisProximoNoContorno,
  segmentosSeIntersectam,
  trechoDoContorno,
  type Contorno,
  type Ponto2D,
  type PosicaoNoContorno,
} from '../core/geometria';
import { exigirCorteValido } from './corteEUniao';
import { piquesQueFicamNoContorno, type Molde, type Pique } from './molde';
import { comecarPeloMenorPontoOriginal, giroEDeslocamento, levarOQueEstaNasRegioes, semPontosRepetidos } from './regioes';

/**
 * "Cortar intersecções", da pence aberta por pivô: quando a reta da posição
 * da pence até o pivô sai da peça e volta (cruza o contorno em mais de dois
 * pontos), a peça é cortada em todos os trechos da reta que estão dentro
 * dela. O lado sem a linha de fio gira em torno do pivô, todos os pedaços dele
 * juntos, e o espaço aberto em cada trecho vira tecido da peça: o resultado é
 * uma prega em cunha, sem vértice, com as duas bordas de cada trecho
 * desenhadas.
 *
 * O manual da referência diz quando a opção é necessária e que o resultado é
 * uma prega; a conta é a nossa leitura.
 */

/** O ponto do contorno a menos disto (mm) da reta está em cima dela. */
const NA_RETA_MM = 1e-3;
const MESMO_PONTO_MM = 1e-6;
const AREA_MINIMA_MM2 = 1e-6;

/** Um ponto em que a reta atravessa o contorno: onde, e a que distância (mm) da posição da pence, na direção do pivô. */
interface Travessia {
  readonly posicao: PosicaoNoContorno;
  readonly t: number;
}

function ponto(x: number, y: number): Ponto2D {
  return { x, y };
}

/**
 * Os pontos em que a reta de `p` a `q` atravessa o contorno, entre os dois
 * (eles inclusive), na ordem do contorno, e de que lado da reta está cada
 * ponto dele (+1 à esquerda de quem vai de `p` a `q`, -1 à direita, 0 em
 * cima). Lança erro quando a reta só encosta no contorno ou corre por cima
 * de uma borda entre os dois.
 */
function travessiasDaReta(contorno: Contorno, p: Ponto2D, q: Ponto2D): { readonly travessias: Travessia[]; readonly lados: number[] } {
  const comprimento = distancia(p, q);
  const n = contorno.length;
  const u = ponto((q.x - p.x) / comprimento, (q.y - p.y) / comprimento);
  const afastamento = (v: Ponto2D): number => u.x * (v.y - p.y) - u.y * (v.x - p.x);
  const aoLongo = (v: Ponto2D): number => u.x * (v.x - p.x) + u.y * (v.y - p.y);
  const noTrecho = (t: number): boolean => t >= -NA_RETA_MM && t <= comprimento + NA_RETA_MM;
  const d = contorno.map(afastamento);
  const lados = d.map((valor) => (Math.abs(valor) <= NA_RETA_MM ? 0 : valor > 0 ? 1 : -1));
  const travessias: Travessia[] = [];
  for (let i = 0; i < n; i++) {
    if (lados[i] === 0) continue;
    // O próximo ponto que não está em cima da reta, e os que estão, no caminho até ele.
    const emCima: number[] = [];
    let j = (i + 1) % n;
    while (lados[j] === 0 && j !== i) {
      emCima.push(j);
      j = (j + 1) % n;
    }
    if (j === i) break;
    const noCaminho = emCima.filter((k) => noTrecho(aoLongo(contorno[k]!)));
    if (emCima.length > 1 && noCaminho.length > 0) {
      throw new Error('A linha da posição da pence até o pivô corre por cima de uma borda da peça.');
    }
    if (lados[j] === lados[i]) {
      if (noCaminho.length > 0) throw new Error('A linha da posição da pence até o pivô encosta no contorno sem atravessar: escolha outra posição ou outro pivô.');
      continue;
    }
    if (emCima.length === 1) {
      const k = emCima[0]!;
      if (noTrecho(aoLongo(contorno[k]!))) travessias.push({ posicao: { indiceAresta: k, ponto: contorno[k]! }, t: aoLongo(contorno[k]!) });
    } else if (emCima.length === 0) {
      const de = contorno[i]!;
      const ate = contorno[j]!;
      const k = d[i]! / (d[i]! - d[j]!);
      const cruzamento = ponto(de.x + (ate.x - de.x) * k, de.y + (ate.y - de.y) * k);
      if (noTrecho(aoLongo(cruzamento))) travessias.push({ posicao: { indiceAresta: i, ponto: cruzamento }, t: aoLongo(cruzamento) });
    }
  }
  // Na ordem do contorno: pela aresta e, dentro dela, pela distância ao começo.
  travessias.sort(
    (a, b) => a.posicao.indiceAresta - b.posicao.indiceAresta || distancia(contorno[a.posicao.indiceAresta]!, a.posicao.ponto) - distancia(contorno[b.posicao.indiceAresta]!, b.posicao.ponto),
  );
  return { travessias, lados };
}

/** Verdadeiro se a reta da posição ao pivô atravessa o contorno em mais de dois pontos (sai da peça e volta). */
export function cruzaOContornoMaisDeDuasVezes(contorno: Contorno, p: Ponto2D, q: Ponto2D): boolean {
  if (distancia(p, q) < MESMO_PONTO_MM) return false;
  try {
    return travessiasDaReta(contorno, p, q).travessias.length > 2;
  } catch {
    return false;
  }
}

/**
 * O lado da reta em que o trecho do contorno sai da travessia `de` e o lado em
 * que chega à travessia `ate`. Duas travessias nunca estão na mesma aresta
 * (uma aresta reta cruza a reta uma vez só): o trecho passa pelos pontos do
 * contorno que vêm depois da aresta de `de`, até o da aresta de `ate` — sem
 * ele, se `ate` é o próprio ponto.
 */
function ladosDoTrecho(contorno: Contorno, lados: readonly number[], de: PosicaoNoContorno, ate: PosicaoNoContorno): readonly [number, number] {
  const n = contorno.length;
  const chegaNoPonto = distancia(ate.ponto, contorno[ate.indiceAresta]!) <= MESMO_PONTO_MM;
  const percorridos: number[] = [];
  let i = de.indiceAresta;
  for (let passos = 0; passos < n; passos++) {
    i = (i + 1) % n;
    if (i === ate.indiceAresta && chegaNoPonto) break;
    percorridos.push(i);
    if (i === ate.indiceAresta) break;
  }
  const comLado = percorridos.map((k) => lados[k]!).filter((lado) => lado !== 0);
  return [comLado[0] ?? 0, comLado.at(-1) ?? 0];
}

/**
 * A peça aberta pela reta da posição ao pivô, em todos os trechos dela que
 * estão dentro da peça. `null` quando a reta fica toda dentro da peça (aí é a
 * pence aberta de sempre). Lança erro quando não dá.
 */
export function abrirPelasIntersecoes(
  molde: Molde,
  posicao: PosicaoNoContorno,
  pivo: PosicaoNoContorno,
  aberturaMm: number,
  piquesLaterais: boolean,
  novoId: () => string,
): Molde | null {
  const p = posicao.ponto;
  const q = pivo.ponto;
  try {
    exigirCorteValido(molde, p, q);
    return null;
  } catch {
    // A reta não fica toda dentro da peça: segue, para cortar em cada trecho.
  }
  const contorno = molde.contorno;
  const comprimento = distancia(p, q);
  if (molde.furos.some((furo) => furo.some((v, i) => segmentosSeIntersectam(p, q, v, furo[(i + 1) % furo.length]!)))) {
    throw new Error('A linha da posição da pence até o pivô passa por um furo da peça.');
  }
  const { travessias, lados } = travessiasDaReta(contorno, p, q);
  const quantas = travessias.length;
  if (quantas < 4) throw new Error('A linha da posição da pence até o pivô precisa ficar toda dentro da peça.');
  const daPosicao = travessias.findIndex((x) => Math.abs(x.t) <= NA_RETA_MM * 2);
  const doPivo = travessias.findIndex((x) => Math.abs(x.t - comprimento) <= NA_RETA_MM * 2);
  if (quantas % 2 !== 0 || daPosicao < 0 || doPivo < 0) {
    throw new Error('A linha da posição da pence até o pivô precisa atravessar o contorno na posição e no pivô: escolha outra posição ou outro pivô.');
  }
  if (aberturaMm >= comprimento) throw new Error('A abertura é grande demais para a distância até o pivô.');
  // A posição e o pivô ficam exatamente onde foram indicados — ou no ponto do contorno, quando caem em cima de um.
  const noLugar = (x: Travessia, indicado: Ponto2D): PosicaoNoContorno =>
    distancia(x.posicao.ponto, contorno[x.posicao.indiceAresta]!) <= MESMO_PONTO_MM ? x.posicao : { ...x.posicao, ponto: indicado };
  const pontos: PosicaoNoContorno[] = travessias.map((x, i) => (i === daPosicao ? noLugar(x, p) : i === doPivo ? noLugar(x, q) : x.posicao));
  const daPence = pontos[daPosicao]!.ponto;
  const centro = pontos[doPivo]!.ponto;
  // Ao longo da reta, as travessias vêm aos pares: cada par é um trecho dentro da peça.
  const aoLongoDaReta = travessias.map((_, i) => i).sort((a, b) => travessias[a]!.t - travessias[b]!.t);
  const par = new Map<number, number>();
  for (let r = 0; r < quantas; r += 2) {
    const [a, b] = [aoLongoDaReta[r]!, aoLongoDaReta[r + 1]!];
    const meio = ponto((pontos[a]!.ponto.x + pontos[b]!.ponto.x) / 2, (pontos[a]!.ponto.y + pontos[b]!.ponto.y) / 2);
    if (!pontoDentroDoContorno(meio, contorno)) throw new Error('A linha da posição da pence até o pivô não entra na peça onde devia: escolha outra posição ou outro pivô.');
    par.set(a, b);
    par.set(b, a);
  }
  // Os trechos do contorno entre uma travessia e a seguinte, cada um de um lado da reta.
  const trechos = pontos.map((de, i) => {
    const ate = pontos[(i + 1) % quantas]!;
    const [saida, chegada] = ladosDoTrecho(contorno, lados, de, ate);
    if (saida === 0 || saida !== chegada) {
      throw new Error('A peça dá a volta por fora da linha da posição da pence até o pivô: assim ela não pode ser aberta com “Cortar intersecções”.');
    }
    return { cadeia: trechoDoContorno(contorno, de, ate), lado: saida };
  });
  // Cada parte da peça cortada: um trecho do contorno, o corte até o par da travessia, o trecho que sai de lá… até fechar.
  const partes: Array<{ readonly contorno: Ponto2D[]; readonly lado: number }> = [];
  const visto = new Set<number>();
  for (let inicio = 0; inicio < quantas; inicio++) {
    if (visto.has(inicio)) continue;
    const volta: Ponto2D[] = [];
    let i = inicio;
    while (!visto.has(i)) {
      visto.add(i);
      if (trechos[i]!.lado !== trechos[inicio]!.lado) {
        throw new Error('A peça dá a volta por fora da linha da posição da pence até o pivô: assim ela não pode ser aberta com “Cortar intersecções”.');
      }
      volta.push(...trechos[i]!.cadeia);
      i = par.get((i + 1) % quantas)!;
    }
    partes.push({ contorno: semPontosRepetidos(volta), lado: trechos[inicio]!.lado });
  }
  // Fica o lado que tem o meio da linha de fio; se ele não está em parte nenhuma, fica o lado de mais área.
  const meioDoFio = ponto((molde.linhaDeFio.inicio.x + molde.linhaDeFio.fim.x) / 2, (molde.linhaDeFio.inicio.y + molde.linhaDeFio.fim.y) / 2);
  const comOFio = partes.find((parte) => pontoDentroDoContorno(meioDoFio, parte.contorno));
  const areaDoLado = (lado: number): number => partes.filter((parte) => parte.lado === lado).reduce((soma, parte) => soma + area(parte.contorno), 0);
  const ladoQueFica = comOFio ? comOFio.lado : areaDoLado(1) >= areaDoLado(-1) ? 1 : -1;
  const ladoQueAnda = 0 - ladoQueFica;
  // Quem está à esquerda de quem vai da posição ao pivô se afasta girando no sentido horário em torno do pivô.
  const graus = (2 * Math.asin(aberturaMm / (2 * comprimento)) * 180) / Math.PI;
  const movimento = giroEDeslocamento(centro, 0 - ladoQueAnda * graus);
  const volta = trechos.flatMap((trecho) => (trecho.lado === ladoQueAnda ? trecho.cadeia.map(movimento.ponto) : trecho.cadeia));
  const novoContorno = comecarPeloMenorPontoOriginal(semPontosRepetidos(volta), contorno);
  if (novoContorno.length < 3 || !(area(novoContorno) > AREA_MINIMA_MM2)) throw new Error('A peça ficaria sem área abrindo assim.');
  const base = levarOQueEstaNasRegioes(
    molde,
    partes.filter((parte) => parte.lado === ladoQueAnda).map((parte) => parte.contorno),
    trechos.filter((trecho) => trecho.lado === ladoQueAnda).map((trecho) => trecho.cadeia),
    trechos.filter((trecho) => trecho.lado === ladoQueFica).map((trecho) => trecho.cadeia),
    movimento,
  );
  // As duas bordas de cada trecho aberto ficam desenhadas: a que ficou e a que andou.
  const bordas: Ponto2D[][] = [];
  for (let r = 0; r < quantas; r += 2) {
    const [a, b] = [pontos[aoLongoDaReta[r]!]!.ponto, pontos[aoLongoDaReta[r + 1]!]!.ponto];
    bordas.push([a, b], [movimento.ponto(a), movimento.ponto(b)]);
  }
  const piques: Pique[] = piquesLaterais
    ? [daPence, movimento.ponto(daPence)].map((v) => {
        const noContorno = pontoMaisProximoNoContorno(v, novoContorno);
        return { id: novoId(), posicao: noContorno.ponto, indiceAresta: noContorno.indiceAresta };
      })
    : [];
  return {
    ...base,
    contorno: novoContorno,
    linhasInternas: [...base.linhasInternas, ...bordas],
    piques: [...piquesQueFicamNoContorno(base.piques, novoContorno), ...piques],
  };
}

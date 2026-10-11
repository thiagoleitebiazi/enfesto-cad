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
import { piquesQueFicamNoContorno, semCampo, type CunhaDaPeca, type Molde, type Pique } from './molde';
import { comecarPeloMenorPontoOriginal, distanciaAteALinha, giroEDeslocamento, levarOQueEstaNasRegioes, semPontosRepetidos, type Transformacao } from './regioes';

/**
 * "Cortar intersecções", da pence aberta por pivô: quando a reta da posição
 * da pence até o pivô sai da peça e volta (cruza o contorno em mais de dois
 * pontos), a peça é cortada em todos os trechos da reta que estão dentro
 * dela. O lado sem a linha de fio gira em torno do pivô, todos os pedaços dele
 * juntos, e o espaço aberto em cada trecho vira tecido da peça: o resultado é
 * uma prega em cunha, sem vértice, com as duas bordas de cada trecho
 * desenhadas.
 *
 * A prega fica registrada na peça (`cunhas`), pelos pontos em que a reta
 * atravessava o contorno: com o registro, dá para fechá-la (o lado que girou
 * volta) e para mudar a abertura.
 *
 * O manual da referência diz quando a opção é necessária e que o resultado é
 * uma prega; a conta e o registro são a nossa leitura.
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
  const partes = partesPelaReta(trechos, par);
  if (!partes) throw new Error('A peça dá a volta por fora da linha da posição da pence até o pivô: assim ela não pode ser aberta com “Cortar intersecções”.');
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
  const aberta: Molde = {
    ...base,
    contorno: novoContorno,
    linhasInternas: [...base.linhasInternas, ...bordas],
    piques: [...piquesQueFicamNoContorno(base.piques, novoContorno), ...piques],
  };
  // A prega fica registrada: onde a reta atravessava o contorno, de cada lado, para fechar ou mudar a abertura depois.
  const jaEraPonto = (v: Ponto2D): boolean => contorno.some((w) => distancia(w, v) <= MESMO_PONTO_MM);
  const registro: CunhaDaPeca = {
    id: novoId(),
    travessias: pontos.map((x) => ({ parada: x.ponto, movida: movimento.ponto(x.ponto), criada: !jaEraPonto(x.ponto) })),
    posicao: daPosicao,
    pivo: doPivo,
    linhas: bordas,
    ...(piques.length > 0 ? { piques: piques.map((q) => q.id) } : {}),
    comeco: contorno[0]!,
  };
  return { ...aberta, cunhas: [...cunhasDaPeca(aberta), registro] };
}

/** Um trecho do contorno entre duas travessias seguidas da reta, todo de um lado dela. */
interface TrechoEntreTravessias {
  readonly cadeia: readonly Ponto2D[];
  readonly lado: number;
}

/**
 * As partes em que a reta corta a peça: cada uma é um trecho do contorno, o
 * corte até o par da travessia em que ele termina, o trecho que sai de lá… até
 * fechar. `par` diz, para cada travessia (na ordem do contorno), qual é a outra
 * ponta do mesmo trecho da reta dentro da peça. `null` se uma parte juntaria
 * trechos dos dois lados da reta.
 */
function partesPelaReta(trechos: readonly TrechoEntreTravessias[], par: ReadonlyMap<number, number>): Array<{ readonly contorno: Ponto2D[]; readonly lado: number }> | null {
  const quantas = trechos.length;
  const partes: Array<{ readonly contorno: Ponto2D[]; readonly lado: number }> = [];
  const visto = new Set<number>();
  for (let inicio = 0; inicio < quantas; inicio++) {
    if (visto.has(inicio)) continue;
    const volta: Ponto2D[] = [];
    let i = inicio;
    while (!visto.has(i)) {
      visto.add(i);
      if (trechos[i]!.lado !== trechos[inicio]!.lado) return null;
      volta.push(...trechos[i]!.cadeia);
      i = par.get((i + 1) % quantas)!;
    }
    partes.push({ contorno: semPontosRepetidos(volta), lado: trechos[inicio]!.lado });
  }
  return partes;
}

// ---------------------------------------------------------------------------
// As pregas em cunha registradas na peça
// ---------------------------------------------------------------------------

function mesmoLugar(p: Ponto2D, q: Ponto2D): boolean {
  return distancia(p, q) <= MESMO_PONTO_MM;
}

/** A linha é a mesma sequência de pontos, num sentido ou no outro. */
function mesmaLinha(linha: readonly Ponto2D[], pontos: readonly Ponto2D[]): boolean {
  if (linha.length !== pontos.length) return false;
  return linha.every((p, i) => mesmoLugar(p, pontos[i]!)) || linha.every((p, i) => mesmoLugar(p, pontos[pontos.length - 1 - i]!));
}

/** O movimento de volta da prega em cunha: o giro contrário ao que levou a posição da pence da ponta parada à movida, em torno do pivô. */
function voltaDaCunha(cunha: CunhaDaPeca): Transformacao {
  const centro = cunha.travessias[cunha.pivo]!.parada;
  const { parada, movida } = cunha.travessias[cunha.posicao]!;
  const graus = ((Math.atan2(movida.y - centro.y, movida.x - centro.x) - Math.atan2(parada.y - centro.y, parada.x - centro.x)) * 180) / Math.PI;
  return giroEDeslocamento(centro, -graus);
}

/** A prega em cunha como está no contorno de agora. */
interface CunhaNoContorno {
  /** Os trechos do contorno entre uma travessia e a seguinte; lado +1 = o trecho girou, -1 = ficou. */
  readonly trechos: TrechoEntreTravessias[];
  /** Para cada travessia, na ordem do contorno de agora, a outra ponta do mesmo trecho aberto. */
  readonly par: Map<number, number>;
  /** Os trechos abertos, cada um pelas duas travessias dele (os números delas no registro). */
  readonly abertos: ReadonlyArray<readonly [number, number]>;
}

/**
 * Onde a prega em cunha está no contorno: cada travessia com a ponta parada e
 * a movida vizinhas (no pivô, um ponto só), e os trechos do contorno entre
 * elas alternando entre o lado que ficou e o que girou. `null` se o contorno
 * já não é assim.
 */
function cunhaNoContorno(contorno: Contorno, cunha: CunhaDaPeca): CunhaNoContorno | null {
  const n = contorno.length;
  const quantas = cunha.travessias.length;
  if (quantas < 4 || quantas % 2 !== 0 || !cunha.travessias[cunha.posicao] || !cunha.travessias[cunha.pivo]) return null;
  // Cada ponta movida continua sendo a parada girada em torno do pivô: se um lado da peça andou sozinho depois, já não é.
  const volta = voltaDaCunha(cunha);
  if (cunha.travessias.some((x) => !mesmoLugar(volta.ponto(x.movida), x.parada))) return null;
  const indiceDe = (p: Ponto2D): number => contorno.findIndex((v) => mesmoLugar(v, p));
  // Cada travessia: o ponto dela que vem primeiro no contorno, o que vem logo depois, e se esse segundo é o do lado que girou.
  const onde: Array<{ readonly k: number; readonly entra: number; readonly sai: number; readonly saiGirado: boolean | null }> = [];
  for (let k = 0; k < quantas; k++) {
    const [parada, movida] = [indiceDe(cunha.travessias[k]!.parada), indiceDe(cunha.travessias[k]!.movida)];
    if (parada < 0 || movida < 0) return null;
    if (parada === movida) onde.push({ k, entra: parada, sai: parada, saiGirado: null });
    else if (movida === (parada + 1) % n) onde.push({ k, entra: parada, sai: movida, saiGirado: true });
    else if (parada === (movida + 1) % n) onde.push({ k, entra: movida, sai: parada, saiGirado: false });
    else return null;
  }
  onde.sort((a, b) => a.entra - b.entra);
  const trechos: TrechoEntreTravessias[] = [];
  for (let i = 0; i < quantas; i++) {
    const [de, ate] = [onde[i]!, onde[(i + 1) % quantas]!];
    // O trecho girou se sai da ponta movida de uma travessia ou chega à ponta movida da seguinte.
    const chegaGirado = ate.saiGirado === null ? null : !ate.saiGirado;
    if (de.saiGirado !== null && chegaGirado !== null && de.saiGirado !== chegaGirado) return null;
    const girou = de.saiGirado ?? chegaGirado;
    if (girou === null) return null;
    const cadeia: Ponto2D[] = [];
    for (let j = de.sai; ; j = (j + 1) % n) {
      cadeia.push(contorno[j]!);
      if (j === ate.entra) break;
    }
    trechos.push({ cadeia, lado: girou ? 1 : -1 });
  }
  if (trechos.some((trecho, i) => trecho.lado === trechos[(i + 1) % quantas]!.lado)) return null;
  // Ao longo da reta (pelas pontas paradas, que não saíram dela), as travessias vêm aos pares.
  const origem = cunha.travessias[cunha.posicao]!.parada;
  const pivo = cunha.travessias[cunha.pivo]!.parada;
  const aoLongo = (k: number): number => (cunha.travessias[k]!.parada.x - origem.x) * (pivo.x - origem.x) + (cunha.travessias[k]!.parada.y - origem.y) * (pivo.y - origem.y);
  const aoLongoDaReta = onde.map((_, i) => i).sort((a, b) => aoLongo(onde[a]!.k) - aoLongo(onde[b]!.k));
  const par = new Map<number, number>();
  const abertos: Array<readonly [number, number]> = [];
  for (let r = 0; r < quantas; r += 2) {
    const [a, b] = [aoLongoDaReta[r]!, aoLongoDaReta[r + 1]!];
    par.set(a, b);
    par.set(b, a);
    abertos.push([onde[a]!.k, onde[b]!.k]);
  }
  return { trechos, par, abertos };
}

function cunhaEstaNaPeca(molde: Molde, cunha: CunhaDaPeca): boolean {
  if (!cunhaNoContorno(molde.contorno, cunha)) return false;
  // Cada borda desenhada tem a sua linha interna (uma para cada, sem repetir).
  const livres = [...molde.linhasInternas];
  return cunha.linhas.every((linha) => {
    const onde = livres.findIndex((l) => mesmaLinha(l, linha));
    if (onde < 0) return false;
    livres.splice(onde, 1);
    return true;
  });
}

/** As pregas em cunha registradas que continuam na peça como foram abertas. */
export function cunhasDaPeca(molde: Molde): CunhaDaPeca[] {
  return (molde.cunhas ?? []).filter((cunha) => cunhaEstaNaPeca(molde, cunha));
}

/** A peça sem os registros de prega em cunha que deixaram de valer. */
export function comCunhasValidas(molde: Molde): Molde {
  if (!molde.cunhas) return molde;
  const validas = cunhasDaPeca(molde);
  if (validas.length === 0) return semCampo(molde, 'cunhas');
  return validas.length === molde.cunhas.length ? molde : { ...molde, cunhas: validas };
}

/** A abertura (mm) da prega em cunha na posição da pence: de uma ponta à outra, em linha reta. */
export function aberturaDaCunha(cunha: CunhaDaPeca): number {
  const { parada, movida } = cunha.travessias[cunha.posicao]!;
  return distancia(parada, movida);
}

/** O tecido que a prega em cunha abriu: uma faixa para cada trecho aberto — as duas pontas paradas e as duas que giraram, em volta. */
export function faixasDaCunha(molde: Molde, cunha: CunhaDaPeca): Ponto2D[][] {
  const noContorno = cunhaNoContorno(molde.contorno, cunha);
  if (!noContorno) return [];
  return noContorno.abertos.map(([a, b]) => {
    const [de, ate] = [cunha.travessias[a]!, cunha.travessias[b]!];
    return semPontosRepetidos([de.parada, ate.parada, ate.movida, de.movida]);
  });
}

/** A prega em cunha registrada em que o ponto está (dentro de uma faixa dela) ou de que está mais perto, a até `raioMm`. */
export function cunhaPerto(molde: Molde, p: Ponto2D, raioMm: number): CunhaDaPeca | null {
  let melhor: { cunha: CunhaDaPeca; distancia: number } | null = null;
  for (const cunha of cunhasDaPeca(molde)) {
    for (const faixa of faixasDaCunha(molde, cunha)) {
      const d = pontoDentroDoContorno(p, faixa) ? 0 : distanciaAteALinha(p, [...faixa, faixa[0]!]);
      if (d <= raioMm && (!melhor || d < melhor.distancia)) melhor = { cunha, distancia: d };
    }
  }
  return melhor ? melhor.cunha : null;
}

function cunhaRegistrada(molde: Molde, id: string): CunhaDaPeca {
  const cunha = cunhasDaPeca(molde).find((q) => q.id === id);
  if (!cunha) throw new Error('Essa prega foi mexida à mão e já não pode ser mudada pela abertura.');
  return cunha;
}

/**
 * A peça com a prega em cunha fechada: o lado que girou volta em torno do
 * pivô, levando o que está nele, e as bordas desenhadas e os piques da prega
 * saem. As pontas que a abertura tinha posto no contorno saem também.
 */
export function fecharCunha(molde: Molde, id: string): Molde {
  const cunha = cunhaRegistrada(molde, id);
  const contorno = molde.contorno;
  const { trechos, par } = cunhaNoContorno(contorno, cunha)!;
  const partes = partesPelaReta(trechos, par);
  if (!partes) throw new Error('Essa prega foi mexida à mão e já não pode ser fechada.');
  const volta = voltaDaCunha(cunha);

  const piquesDela = new Set(cunha.piques ?? []);
  const linhasInternas = [...molde.linhasInternas];
  for (const linha of cunha.linhas) {
    const qual = linhasInternas.findIndex((l) => mesmaLinha(l, linha));
    if (qual >= 0) linhasInternas.splice(qual, 1);
  }
  const semEla: Molde = {
    ...molde,
    linhasInternas,
    piques: molde.piques.filter((q) => !piquesDela.has(q.id)),
    cunhas: (molde.cunhas ?? []).filter((q) => q.id !== id),
  };
  const base = levarOQueEstaNasRegioes(
    semEla,
    partes.filter((parte) => parte.lado === 1).map((parte) => parte.contorno),
    trechos.filter((trecho) => trecho.lado === 1).map((trecho) => trecho.cadeia),
    trechos.filter((trecho) => trecho.lado === -1).map((trecho) => trecho.cadeia),
    volta,
  );
  // Só sai a ponta que a abertura pôs: um ponto do contorno que já estava lá fica.
  const saem = cunha.travessias.filter((x) => x.criada).map((x) => x.parada);
  const fechado = semPontosRepetidos(trechos.flatMap((trecho) => (trecho.lado === 1 ? trecho.cadeia.map(volta.ponto) : trecho.cadeia))).filter((p) => !saem.some((q) => mesmoLugar(p, q)));
  // A numeração volta a começar onde começava antes de abrir; sem esse ponto, pelo de menor número que não saiu do lugar.
  const comeco = cunha.comeco;
  const doComeco = comeco ? fechado.findIndex((p) => mesmoLugar(p, comeco)) : -1;
  const novoContorno = doComeco >= 0 ? [...fechado.slice(doComeco), ...fechado.slice(0, doComeco)] : comecarPeloMenorPontoOriginal(fechado, contorno);
  if (novoContorno.length < 3 || !(area(novoContorno) > AREA_MINIMA_MM2)) throw new Error('A peça ficaria sem área sem essa prega.');
  return comCunhasValidas({ ...base, contorno: novoContorno, piques: piquesQueFicamNoContorno(base.piques, novoContorno) });
}

/**
 * Muda a abertura de uma prega em cunha já feita: ela é fechada e aberta de
 * novo pela mesma reta, em torno do mesmo pivô. Continua com piques, se tinha.
 */
export function alterarCunha(molde: Molde, id: string, aberturaMm: number, novoId: () => string): Molde {
  const cunha = cunhaRegistrada(molde, id);
  if (!Number.isFinite(aberturaMm) || aberturaMm <= 0) throw new Error('A abertura precisa ser maior que zero.');
  const fechada = fecharCunha(molde, id);
  const noContorno = (p: Ponto2D): PosicaoNoContorno => {
    const perto = pontoMaisProximoNoContorno(p, fechada.contorno);
    return { indiceAresta: perto.indiceAresta, ponto: perto.ponto };
  };
  const aberta = abrirPelasIntersecoes(
    fechada,
    noContorno(cunha.travessias[cunha.posicao]!.parada),
    noContorno(cunha.travessias[cunha.pivo]!.parada),
    aberturaMm,
    (cunha.piques?.length ?? 0) > 0,
    novoId,
  );
  if (!aberta) throw new Error('Fechada, essa prega já não abre pela mesma linha: abra de novo com “Pence no contorno”.');
  return aberta;
}

import { arcoPorTresPontos, circuloPorTresPontos, PASSO_DA_CURVA_MM } from './curvas';
import { distancia, trechoMaisCurto, type Contorno, type Ponto2D, type PosicaoNoContorno } from './geometria';

/**
 * Arcos como elementos. O contorno continua sendo só uma sequência de pontos:
 * um arco não é guardado, é **reconhecido** — pontos seguidos sobre um mesmo
 * círculo, em passos pequenos. Assim valem os arcos feitos aqui, os cantos
 * arredondados e os que vêm prontos de um DXF, e nenhuma edição do contorno
 * deixa um arco "guardado" fora do lugar.
 */
export interface ArcoDoContorno {
  /** O número (a partir de 0) do primeiro e do último ponto do arco no contorno; o arco vai de um ao outro no sentido da numeração. */
  readonly inicio: number;
  readonly fim: number;
  readonly centro: Ponto2D;
  readonly raio: number;
  /** O contorno inteiro é esse círculo. */
  readonly completo: boolean;
}

/** Um arco tem pelo menos esta quantidade de pontos (três trechos). */
export const MINIMO_DE_PONTOS_DE_UM_ARCO = 4;
/** Acima disso (graus) entre um ponto e o seguinte, vistos do centro, é um polígono, não um arco amostrado. */
export const PASSO_MAXIMO_DE_UM_ARCO_GRAUS = 30;

const MESMO_PONTO_MM = 1e-6;

function unitario(de: Ponto2D, ate: Ponto2D): Ponto2D {
  const d = distancia(de, ate);
  return d === 0 ? { x: 0, y: 0 } : { x: (ate.x - de.x) / d, y: (ate.y - de.y) / d };
}

/** Quanto dois círculos podem diferir (no centro e no raio) e ainda ser o mesmo: os pontos de um DXF vêm arredondados. */
function folgaDoCirculo(raio: number): number {
  return Math.max(0.05, raio * 0.005);
}

/** O círculo pelos três pontos, se eles fazem um passo de arco: não alinhados e perto o bastante uns dos outros. */
function passoDeArco(a: Ponto2D, b: Ponto2D, c: Ponto2D): { readonly centro: Ponto2D; readonly raio: number } | null {
  const circulo = circuloPorTresPontos(a, b, c);
  if (!circulo || !Number.isFinite(circulo.raio)) return null;
  const limite = 2 * circulo.raio * Math.sin((PASSO_MAXIMO_DE_UM_ARCO_GRAUS * Math.PI) / 360);
  if (distancia(a, b) > limite + MESMO_PONTO_MM || distancia(b, c) > limite + MESMO_PONTO_MM) return null;
  return circulo;
}

/** Os arcos do contorno, na ordem em que aparecem. */
export function arcosDoContorno(contorno: Contorno): ArcoDoContorno[] {
  const n = contorno.length;
  if (n < MINIMO_DE_PONTOS_DE_UM_ARCO) return [];
  // Para cada ponto, o círculo que passa por ele e pelos dois vizinhos (se fazem um passo de arco).
  const passos = contorno.map((p, i) => passoDeArco(contorno[(i - 1 + n) % n]!, p, contorno[(i + 1) % n]!));
  const mesmo = (i: number, j: number): boolean => {
    const a = passos[i];
    const b = passos[j];
    if (!a || !b) return false;
    const folga = folgaDoCirculo(Math.min(a.raio, b.raio));
    return distancia(a.centro, b.centro) <= folga && Math.abs(a.raio - b.raio) <= folga;
  };
  // O contorno inteiro num círculo só.
  if (passos.every((_, i) => mesmo(i, (i + 1) % n))) {
    const circulo = circuloPorTresPontos(contorno[0]!, contorno[Math.floor(n / 3)]!, contorno[Math.floor((2 * n) / 3)]!);
    return circulo ? [{ inicio: 0, fim: n - 1, centro: circulo.centro, raio: circulo.raio, completo: true }] : [];
  }
  // Começa a varredura num ponto em que um arco não vem de trás, para nenhum arco ficar partido no fim da numeração.
  const partida = passos.findIndex((_, i) => !mesmo((i - 1 + n) % n, i));
  const arcos: ArcoDoContorno[] = [];
  let k = 0;
  while (k < n) {
    const i = (partida + k) % n;
    if (!passos[i]) {
      k++;
      continue;
    }
    // Estende enquanto o ponto seguinte está no mesmo círculo.
    let tamanho = 1;
    while (k + tamanho < n && mesmo((partida + k + tamanho - 1) % n, (partida + k + tamanho) % n)) tamanho++;
    // `tamanho` pontos de dentro do arco: com os dois das pontas, `tamanho + 2` pontos.
    if (tamanho + 2 >= MINIMO_DE_PONTOS_DE_UM_ARCO) {
      const inicio = (i - 1 + n) % n;
      const fim = (i + tamanho) % n;
      const meio = (i + Math.floor(tamanho / 2)) % n;
      const circulo = circuloPorTresPontos(contorno[inicio]!, contorno[meio]!, contorno[fim]!);
      if (circulo) arcos.push({ inicio, fim, centro: circulo.centro, raio: circulo.raio, completo: false });
    }
    k += tamanho;
  }
  return arcos.sort((a, b) => a.inicio - b.inicio);
}

/** Quantas arestas tem o arco (de `inicio` a `fim`, dando a volta se preciso). */
function arestasDoArco(arco: ArcoDoContorno, n: number): number {
  return arco.completo ? n : (arco.fim - arco.inicio + n) % n;
}

/** O arco de que faz parte a aresta `indiceAresta` (do ponto de mesmo número ao seguinte), ou `null` se ela é uma reta. */
export function arcoDaAresta(contorno: Contorno, indiceAresta: number): ArcoDoContorno | null {
  const n = contorno.length;
  return (
    arcosDoContorno(contorno).find((arco) => arco.completo || (indiceAresta - arco.inicio + n) % n < arestasDoArco(arco, n)) ?? null
  );
}

/**
 * A direção em que o contorno anda (no sentido da numeração) junto de uma
 * posição: no elemento que chega a ela (`antes`) ou no que sai dela
 * (`depois`). Numa reta é a direção da aresta; num arco, a tangente ao
 * círculo — exata, e não a do pequeno trecho amostrado.
 */
export function direcaoDoContornoEm(contorno: Contorno, posicao: PosicaoNoContorno, lado: 'antes' | 'depois'): Ponto2D {
  const n = contorno.length;
  const noVertice = distancia(posicao.ponto, contorno[posicao.indiceAresta]!) < MESMO_PONTO_MM;
  const aresta = lado === 'antes' && noVertice ? (posicao.indiceAresta - 1 + n) % n : posicao.indiceAresta;
  const de = contorno[aresta]!;
  const ate = contorno[(aresta + 1) % n]!;
  const daAresta = unitario(de, ate);
  const arco = arcoDaAresta(contorno, aresta);
  if (!arco) return daAresta;
  const raio = unitario(arco.centro, posicao.ponto);
  const tangente = { x: -raio.y, y: raio.x };
  return tangente.x * daAresta.x + tangente.y * daAresta.y >= 0 ? tangente : { x: -tangente.x, y: -tangente.y };
}

/**
 * "Arco tangente à reta ou arco": o arco que sai de `inicio` na direção dada
 * (a do elemento a que ele dá continuidade) e chega em `fim`. Só existe um.
 * Devolve os pontos do arco, com os dois extremos; se `fim` está bem na
 * direção de saída, é uma reta.
 */
export function arcoTangente(inicio: Ponto2D, direcao: Ponto2D, fim: Ponto2D): Ponto2D[] {
  const corda = distancia(inicio, fim);
  if (corda < MESMO_PONTO_MM) throw new Error('O arco precisa de dois pontos diferentes.');
  const comprimento = Math.hypot(direcao.x, direcao.y);
  if (comprimento < MESMO_PONTO_MM) throw new Error('O elemento não tem direção nesse ponto.');
  const d = { x: direcao.x / comprimento, y: direcao.y / comprimento };
  const esquerda = { x: -d.y, y: d.x };
  const paraOLado = (fim.x - inicio.x) * esquerda.x + (fim.y - inicio.y) * esquerda.y;
  const paraAFrente = (fim.x - inicio.x) * d.x + (fim.y - inicio.y) * d.y;
  if (Math.abs(paraOLado) < 1e-7 * corda) {
    if (paraAFrente <= 0) throw new Error('O fim do arco fica para trás do começo, na mesma reta: não há arco tangente que chegue lá.');
    return [inicio, fim];
  }
  // O centro fica na perpendicular à direção, a uma distância (com sinal) que põe `fim` no círculo.
  const raio = (corda * corda) / (2 * paraOLado);
  const centro = { x: inicio.x + esquerda.x * raio, y: inicio.y + esquerda.y * raio };
  const sentido = raio > 0 ? 1 : -1;
  const anguloInicial = Math.atan2(inicio.y - centro.y, inicio.x - centro.x);
  const anguloFinal = Math.atan2(fim.y - centro.y, fim.x - centro.x);
  const volta = 2 * Math.PI;
  const giro = (((anguloFinal - anguloInicial) * sentido) % volta + volta) % volta;
  const trechos = Math.max(4, Math.min(96, Math.ceil((Math.abs(raio) * giro) / PASSO_DA_CURVA_MM)));
  const r = Math.abs(raio);
  return Array.from({ length: trechos + 1 }, (_, i) => {
    if (i === 0) return inicio;
    if (i === trechos) return fim;
    const a = anguloInicial + (sentido * giro * i) / trechos;
    return { x: centro.x + r * Math.cos(a), y: centro.y + r * Math.sin(a) };
  });
}

/**
 * O arco tangente que troca o trecho mais curto do contorno entre `inicio` e
 * `fim`: sai de `inicio` dando continuidade ao elemento que fica do outro
 * lado dele (uma reta ou um arco) e chega em `fim`.
 */
export function linhaDoArcoTangente(contorno: Contorno, inicio: PosicaoNoContorno, fim: PosicaoNoContorno): Ponto2D[] {
  // Se o trecho trocado segue a numeração, o elemento que fica é o que chega a `inicio`; senão, o que sai dele, andado ao contrário.
  const { invertido } = trechoMaisCurto(contorno, inicio, fim);
  const d = direcaoDoContornoEm(contorno, inicio, invertido ? 'depois' : 'antes');
  return arcoTangente(inicio.ponto, invertido ? { x: -d.x, y: -d.y } : d, fim.ponto);
}

/** Um lado do canto: a reta de uma aresta, ou o arco que chega ou sai do canto. */
type LadoDoCanto =
  | { readonly tipo: 'reta'; readonly longe: Ponto2D; readonly canto: Ponto2D }
  | { readonly tipo: 'arco'; readonly arco: ArcoDoContorno; readonly longe: Ponto2D; readonly canto: Ponto2D };

export type TipoDeLado = 'reta' | 'arco';

/** Os pontos a `raio` do lado: as duas paralelas à reta, ou os dois círculos concêntricos ao arco. */
type Lugar =
  | { readonly tipo: 'reta'; readonly ponto: Ponto2D; readonly direcao: Ponto2D }
  | { readonly tipo: 'circulo'; readonly centro: Ponto2D; readonly raio: number };

function lugaresADistancia(lado: LadoDoCanto, raio: number): Lugar[] {
  if (lado.tipo === 'reta') {
    const d = unitario(lado.longe, lado.canto);
    const normal = { x: -d.y, y: d.x };
    return [1, -1].map((s) => ({
      tipo: 'reta' as const,
      ponto: { x: lado.canto.x + normal.x * raio * s, y: lado.canto.y + normal.y * raio * s },
      direcao: d,
    }));
  }
  const lugares: Lugar[] = [{ tipo: 'circulo', centro: lado.arco.centro, raio: lado.arco.raio + raio }];
  if (lado.arco.raio - raio > MESMO_PONTO_MM) lugares.push({ tipo: 'circulo', centro: lado.arco.centro, raio: lado.arco.raio - raio });
  return lugares;
}

function retaComCirculo(reta: Extract<Lugar, { tipo: 'reta' }>, circulo: Extract<Lugar, { tipo: 'circulo' }>): Ponto2D[] {
  const f = { x: reta.ponto.x - circulo.centro.x, y: reta.ponto.y - circulo.centro.y };
  const b = f.x * reta.direcao.x + f.y * reta.direcao.y;
  const c = f.x * f.x + f.y * f.y - circulo.raio * circulo.raio;
  const delta = b * b - c;
  if (delta < 0) return [];
  const raiz = Math.sqrt(delta);
  return [-b - raiz, -b + raiz].map((t) => ({ x: reta.ponto.x + reta.direcao.x * t, y: reta.ponto.y + reta.direcao.y * t }));
}

function encontros(a: Lugar, b: Lugar): Ponto2D[] {
  if (a.tipo === 'reta' && b.tipo === 'reta') {
    const denominador = a.direcao.x * b.direcao.y - a.direcao.y * b.direcao.x;
    if (Math.abs(denominador) < 1e-9) return [];
    const t = ((b.ponto.x - a.ponto.x) * b.direcao.y - (b.ponto.y - a.ponto.y) * b.direcao.x) / denominador;
    return [{ x: a.ponto.x + a.direcao.x * t, y: a.ponto.y + a.direcao.y * t }];
  }
  if (a.tipo === 'reta' && b.tipo === 'circulo') return retaComCirculo(a, b);
  if (a.tipo === 'circulo' && b.tipo === 'reta') return retaComCirculo(b, a);
  if (a.tipo !== 'circulo' || b.tipo !== 'circulo') return [];
  const d = distancia(a.centro, b.centro);
  if (d < MESMO_PONTO_MM || d > a.raio + b.raio || d < Math.abs(a.raio - b.raio)) return [];
  const aoLongo = (a.raio * a.raio - b.raio * b.raio + d * d) / (2 * d);
  const altura = Math.sqrt(Math.max(0, a.raio * a.raio - aoLongo * aoLongo));
  const u = unitario(a.centro, b.centro);
  const pe = { x: a.centro.x + u.x * aoLongo, y: a.centro.y + u.y * aoLongo };
  return [1, -1].map((s) => ({ x: pe.x - u.y * altura * s, y: pe.y + u.x * altura * s }));
}

/** Quanto se anda, em graus com sinal, do ponto `de` ao ponto `ate`, em torno do centro, pelo caminho mais curto. */
function giroEntre(centro: Ponto2D, de: Ponto2D, ate: Ponto2D): number {
  const a = Math.atan2(de.y - centro.y, de.x - centro.x);
  const b = Math.atan2(ate.y - centro.y, ate.x - centro.x);
  let giro = ((b - a) * 180) / Math.PI;
  while (giro > 180) giro -= 360;
  while (giro <= -180) giro += 360;
  return giro;
}

/**
 * Onde o arco de concordância (de centro `centro`) toca o lado, e em que
 * aresta do contorno isso cai; `null` se o toque fica fora do lado. As
 * arestas do lado são as de `primeira` em diante, `quantas` delas.
 */
function toqueNoLado(contorno: Contorno, lado: LadoDoCanto, centro: Ponto2D, primeira: number, quantas: number): PosicaoNoContorno | null {
  const n = contorno.length;
  if (lado.tipo === 'reta') {
    const d = unitario(lado.longe, lado.canto);
    const comprimento = distancia(lado.longe, lado.canto);
    const t = (centro.x - lado.longe.x) * d.x + (centro.y - lado.longe.y) * d.y;
    if (t < -MESMO_PONTO_MM || t > comprimento - MESMO_PONTO_MM) return null;
    return { indiceAresta: primeira, ponto: { x: lado.longe.x + d.x * Math.max(0, t), y: lado.longe.y + d.y * Math.max(0, t) } };
  }
  const { arco } = lado;
  const r = unitario(arco.centro, centro);
  const toque = { x: arco.centro.x + r.x * arco.raio, y: arco.centro.y + r.y * arco.raio };
  // A aresta do arco em cujo setor o toque cai.
  for (let k = 0; k < quantas; k++) {
    const aresta = (primeira + k) % n;
    const de = contorno[aresta]!;
    const ate = contorno[(aresta + 1) % n]!;
    const setor = giroEntre(arco.centro, de, ate);
    const ateOToque = giroEntre(arco.centro, de, toque);
    if (Math.sign(setor) === Math.sign(ateOToque) || Math.abs(ateOToque) < 1e-9) {
      if (Math.abs(ateOToque) <= Math.abs(setor) + 1e-9) return { indiceAresta: aresta, ponto: toque };
    }
  }
  return null;
}

/** O resultado de arredondar um canto: de onde a onde o contorno é trocado, o arco que entra e o que cada lado do canto era. */
export interface ConcordanciaNoCanto {
  readonly de: PosicaoNoContorno;
  readonly ate: PosicaoNoContorno;
  /** Os pontos do arco entre os dois toques (sem eles). */
  readonly miolo: readonly Ponto2D[];
  readonly centro: Ponto2D;
  /** O lado que chega ao canto e o que sai dele. */
  readonly lados: readonly [TipoDeLado, TipoDeLado];
}

/** O que há de cada lado do canto `indice`: uma reta ou um arco. */
export function ladosDoCanto(contorno: Contorno, indice: number): readonly [TipoDeLado, TipoDeLado] {
  const n = contorno.length;
  return [arcoDaAresta(contorno, (indice - 1 + n) % n) ? 'arco' : 'reta', arcoDaAresta(contorno, indice) ? 'arco' : 'reta'];
}

/**
 * O arco de raio dado tangente aos dois elementos que se encontram no canto
 * `indice` — duas retas, um arco e uma reta, ou dois arcos. Dos arcos
 * possíveis, vale o que fica mais junto do canto. Recusa o raio que não cabe
 * nos dois elementos.
 */
export function concordanciaNoCanto(contorno: Contorno, indice: number, raio: number): ConcordanciaNoCanto {
  const n = contorno.length;
  if (!Number.isInteger(indice) || indice < 0 || indice >= n) throw new Error('Ponto fora do contorno da peça.');
  if (!Number.isFinite(raio) || !(raio > 0)) throw new Error('O raio precisa ser maior que zero.');
  const canto = contorno[indice]!;
  const arcoAntes = arcoDaAresta(contorno, (indice - 1 + n) % n);
  const arcoDepois = arcoDaAresta(contorno, indice);
  if (arcoAntes && arcoDepois && (arcoAntes.completo || (arcoAntes.inicio === arcoDepois.inicio && arcoAntes.fim === arcoDepois.fim))) {
    throw new Error('Esse ponto está no meio de um arco: não é um canto.');
  }
  // As arestas de cada lado: as do arco inteiro, ou a única aresta da reta.
  const arestasAntes = arcoAntes ? (indice - arcoAntes.inicio + n) % n : 1;
  const arestasDepois = arcoDepois ? (arcoDepois.fim - indice + n) % n : 1;
  const primeiraAntes = (indice - arestasAntes + n) % n;
  const antes: LadoDoCanto = arcoAntes
    ? { tipo: 'arco', arco: arcoAntes, longe: contorno[primeiraAntes]!, canto }
    : { tipo: 'reta', longe: contorno[primeiraAntes]!, canto };
  const longeDepois = contorno[(indice + arestasDepois) % n]!;
  const depois: LadoDoCanto = arcoDepois
    ? { tipo: 'arco', arco: arcoDepois, longe: longeDepois, canto }
    : { tipo: 'reta', longe: longeDepois, canto };

  let melhor: { readonly de: PosicaoNoContorno; readonly ate: PosicaoNoContorno; readonly centro: Ponto2D; readonly corte: number } | null = null;
  for (const a of lugaresADistancia(antes, raio)) {
    for (const b of lugaresADistancia(depois, raio)) {
      for (const centro of encontros(a, b)) {
        const de = toqueNoLado(contorno, antes, centro, primeiraAntes, arestasAntes);
        const ate = toqueNoLado(contorno, depois, centro, indice, arestasDepois);
        if (!de || !ate) continue;
        if (distancia(de.ponto, canto) < MESMO_PONTO_MM || distancia(ate.ponto, canto) < MESMO_PONTO_MM) continue;
        const corte = distancia(de.ponto, canto) + distancia(ate.ponto, canto);
        if (!melhor || corte < melhor.corte) melhor = { de, ate, centro, corte };
      }
    }
  }
  if (!melhor) throw new Error('Esse raio não cabe nos dois elementos que se encontram nesse canto: diminua o raio.');
  // O arco menor entre os dois toques, passando pelo lado do canto.
  const meioDosToques = { x: (melhor.de.ponto.x + melhor.ate.ponto.x) / 2, y: (melhor.de.ponto.y + melhor.ate.ponto.y) / 2 };
  const paraOMeio = unitario(melhor.centro, meioDosToques);
  const passagem = { x: melhor.centro.x + paraOMeio.x * raio, y: melhor.centro.y + paraOMeio.y * raio };
  const arco = arcoPorTresPontos(melhor.de.ponto, passagem, melhor.ate.ponto);
  return {
    de: melhor.de,
    ate: melhor.ate,
    miolo: arco.slice(1, -1),
    centro: melhor.centro,
    lados: [antes.tipo, depois.tipo],
  };
}

import { BASE_DO_CORPO, FORMAS_DO_CORPO, JUNTAS_DO_CORPO, PESOS_DO_CORPO, PONTOS_DO_CORPO, QUADRADOS_DO_CORPO } from './corpoHumano.dados';
import type { CorpoDoManequim, PublicoDoManequim } from './manequim';

/**
 * O corpo humano do provador (ADR 0229): a malha aberta do MakeHuman (CC0), nas formas feminina, masculina e infantil,
 * ajustada às medidas do manequim. Primeiro as alturas e as voltas do tronco, nível a nível, entre os pontos que a
 * medida fixa (o gancho, o quadril, a cintura, o busto, o ombro, o pescoço); entre eles fica a forma do corpo. Os braços
 * e as pernas seguem os ossos, com os pesos da própria malha, e vão para a pose do manequim.
 */

const bytes = (s: string): Uint8Array => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const emInt16 = (s: string): Int16Array => {
  const b = bytes(s);
  return new Int16Array(b.buffer, b.byteOffset, b.byteLength / 2);
};

type Junta3 = readonly [number, number, number];

interface Niveis {
  readonly gancho: number;
  readonly quadril: number;
  readonly cintura: number;
  readonly busto: number;
  readonly axila: number;
  readonly ombro: number;
  readonly pescoco: number;
  readonly queixo: number;
  readonly topo: number;
}

interface Juntas {
  readonly ombro: Junta3;
  readonly cotovelo: Junta3;
  readonly punho: Junta3;
  readonly quadril: Junta3;
  readonly joelho: Junta3;
  readonly tornozelo: Junta3;
  readonly pescoco: Junta3;
  readonly cabeca: Junta3;
}

interface FormaDoCorpo {
  /** Em mm, com o chão em y = 0. */
  readonly p: Float32Array;
  readonly triangulos: Uint32Array;
  readonly juntas: Juntas;
  readonly niveis: Niveis;
  /** A volta (mm) nos níveis de medida. */
  readonly voltas: { readonly quadril: number; readonly cintura: number; readonly busto: number; readonly pescoco: number; readonly coxa: number; readonly braco: number };
  /** O z do eixo do tronco. */
  readonly zDoTronco: number;
}

let pesos: Uint8Array | null = null;
const pesosDoCorpo = (): Uint8Array => (pesos ??= bytes(PESOS_DO_CORPO));

/** Quanto o ponto pertence a um braço (os grupos 1 a 3 e 7 a 9). */
function pesoNosBracos(i: number): number {
  const w = pesosDoCorpo();
  let s = 0;
  for (let k = 0; k < 3; k++) {
    const g = w[6 * i + k]!;
    if ((g >= 1 && g <= 3) || (g >= 7 && g <= 9)) s += w[6 * i + 3 + k]!;
  }
  return s / 255;
}

let triangulosDoCorpo: Uint32Array | null = null;
function triangulos(): Uint32Array {
  if (triangulosDoCorpo) return triangulosDoCorpo;
  const b = bytes(QUADRADOS_DO_CORPO);
  const q = new Uint16Array(b.buffer, b.byteOffset, b.byteLength / 2);
  const t = new Uint32Array((q.length / 4) * 6);
  for (let f = 0; f < q.length / 4; f++) {
    const [a, c, d, e] = [q[4 * f]!, q[4 * f + 1]!, q[4 * f + 2]!, q[4 * f + 3]!];
    t.set([a, c, d, a, d, e], 6 * f);
  }
  triangulosDoCorpo = t;
  return t;
}

/** O contorno de fita métrica em volta de pontos no plano: o perímetro do fecho convexo. */
export function perimetroDoFecho(pontos: readonly (readonly [number, number])[]): number {
  if (pontos.length < 3) return 0;
  const p = [...pontos].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const lado = (o: readonly [number, number], a: readonly [number, number], b: readonly [number, number]): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const meia = (lista: readonly (readonly [number, number])[]): (readonly [number, number])[] => {
    const h: (readonly [number, number])[] = [];
    for (const q of lista) {
      while (h.length >= 2 && lado(h[h.length - 2]!, h[h.length - 1]!, q) <= 0) h.pop();
      h.push(q);
    }
    h.pop();
    return h;
  };
  const fecho = [...meia(p), ...meia([...p].reverse())];
  let s = 0;
  for (let i = 0; i < fecho.length; i++) {
    const a = fecho[i]!;
    const b = fecho[(i + 1) % fecho.length]!;
    s += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return s;
}

/** Os pontos (x, z) em que a malha corta a altura `y`, fora o que `fica` rejeitar pelos pontos do triângulo. */
export function corteNaAltura(p: ArrayLike<number>, t: ArrayLike<number>, y: number, fica: (a: number, b: number, c: number) => boolean): [number, number][] {
  const r: [number, number][] = [];
  for (let k = 0; k < t.length; k += 3) {
    const a = t[k]!;
    const b = t[k + 1]!;
    const c = t[k + 2]!;
    const ya = p[3 * a + 1]! - y;
    const yb = p[3 * b + 1]! - y;
    const yc = p[3 * c + 1]! - y;
    if ((ya > 0 && yb > 0 && yc > 0) || (ya < 0 && yb < 0 && yc < 0)) continue;
    if (!fica(a, b, c)) continue;
    const aresta = (i: number, j: number, yi: number, yj: number): void => {
      if (yi > 0 === yj > 0) return;
      const f = yi / (yi - yj);
      r.push([p[3 * i]! + (p[3 * j]! - p[3 * i]!) * f, p[3 * i + 2]! + (p[3 * j + 2]! - p[3 * i + 2]!) * f]);
    };
    aresta(a, b, ya, yb);
    aresta(b, c, yb, yc);
    aresta(c, a, yc, ya);
  }
  return r;
}

const formas = new Map<PublicoDoManequim, FormaDoCorpo>();

function formaDoCorpo(publico: PublicoDoManequim): FormaDoCorpo {
  const pronta = formas.get(publico);
  if (pronta) return pronta;
  const base = emInt16(BASE_DO_CORPO);
  const delta = emInt16(FORMAS_DO_CORPO[publico]);
  const p = new Float32Array(PONTOS_DO_CORPO * 3);
  let chao = Infinity;
  for (let i = 0; i < p.length; i++) {
    p[i] = (base[i]! + delta[i]!) / 10;
    if (i % 3 === 1 && p[i]! < chao) chao = p[i]!;
  }
  for (let i = 1; i < p.length; i += 3) p[i] = p[i]! - chao;
  const j0 = JUNTAS_DO_CORPO[publico];
  const noChao = (j: Junta3): Junta3 => [j[0], j[1] - chao, j[2]];
  const juntas: Juntas = {
    ombro: noChao(j0.ombro),
    cotovelo: noChao(j0.cotovelo),
    punho: noChao(j0.punho),
    quadril: noChao(j0.quadril),
    joelho: noChao(j0.joelho),
    tornozelo: noChao(j0.tornozelo),
    pescoco: noChao(j0.pescoco),
    cabeca: noChao(j0.cabeca),
  };
  const t = triangulos();
  let topo = 0;
  for (let i = 1; i < p.length; i += 3) topo = Math.max(topo, p[i]!);

  const semBracos = (a: number, b: number, c: number): boolean => pesoNosBracos(a) + pesoNosBracos(b) + pesoNosBracos(c) < 1.5;
  const volta = (y: number): number => perimetroDoFecho(corteNaAltura(p, t, y, semBracos));
  const maiorEntre = (de: number, ate: number, sinal: 1 | -1): number => {
    let melhor = de;
    let valor = -Infinity;
    for (let y = de; y <= ate; y += 5) {
      const v = sinal * volta(y);
      if (v > valor) {
        valor = v;
        melhor = y;
      }
    }
    return melhor;
  };
  // O gancho: o ponto mais baixo do meio do corpo, acima dos joelhos.
  let gancho = Infinity;
  for (let i = 0; i < PONTOS_DO_CORPO; i++) {
    if (Math.abs(p[3 * i]!) < 4 && p[3 * i + 1]! > juntas.joelho[1] && p[3 * i + 1]! < gancho) gancho = p[3 * i + 1]!;
  }
  // Logo abaixo do gancho a volta pega as duas coxas: o quadril é a maior volta dali para cima.
  const quadril = maiorEntre(gancho + 0.045 * topo, gancho + 0.13 * topo, 1);
  const cintura = maiorEntre(quadril + 0.06 * topo, quadril + 0.2 * topo, -1);
  // O busto: a altura em que o tronco vai mais à frente (no masculino, o peito).
  let busto = cintura;
  let frente = -Infinity;
  for (let i = 0; i < PONTOS_DO_CORPO; i++) {
    const y = p[3 * i + 1]!;
    if (y > cintura + 0.05 * topo && y < juntas.ombro[1] && p[3 * i + 2]! > frente) {
      frente = p[3 * i + 2]!;
      busto = y;
    }
  }
  const axila = juntas.ombro[1] - 0.035 * topo;
  let ombro = 0;
  for (let i = 0; i < PONTOS_DO_CORPO; i++) {
    if (Math.abs(Math.abs(p[3 * i]!) - juntas.ombro[0]) < 12 && p[3 * i + 1]! < juntas.pescoco[1] + 0.02 * topo) ombro = Math.max(ombro, p[3 * i + 1]!);
  }
  const queixo = juntas.cabeca[1] - 0.04 * topo;
  const pescoco = juntas.pescoco[1];
  const niveis: Niveis = { gancho, quadril, cintura, busto: Math.max(busto, cintura + 0.06 * topo), axila, ombro, pescoco, queixo, topo };

  const voltaDaCoxa = (): number => {
    const y = gancho - 0.02 * topo;
    return perimetroDoFecho(corteNaAltura(p, t, y, (a) => p[3 * a]! > 0 && pesoNosBracos(a) < 0.5));
  };
  const voltaDoBraco = (): number => {
    // A meio do braço, na direção perpendicular ao osso: pelos pontos em volta do eixo.
    const [sx, sy, sz] = juntas.ombro;
    const [ex, ey, ez] = juntas.cotovelo;
    const L = Math.hypot(ex - sx, ey - sy, ez - sz);
    const [ux, uy, uz] = [(ex - sx) / L, (ey - sy) / L, (ez - sz) / L];
    let soma = 0;
    let n = 0;
    for (let i = 0; i < PONTOS_DO_CORPO; i++) {
      if (p[3 * i]! <= 0 || pesoNosBracos(i) < 0.9) continue;
      const dx = p[3 * i]! - sx;
      const dy = p[3 * i + 1]! - sy;
      const dz = p[3 * i + 2]! - sz;
      const a = dx * ux + dy * uy + dz * uz;
      if (a < 0.3 * L || a > 0.6 * L) continue;
      soma += Math.hypot(dx - a * ux, dy - a * uy, dz - a * uz);
      n++;
    }
    return n > 0 ? (2 * Math.PI * soma) / n : 280;
  };
  const voltas = {
    quadril: volta(niveis.quadril),
    cintura: volta(niveis.cintura),
    busto: volta(niveis.busto),
    pescoco: volta((pescoco + queixo) / 2),
    coxa: voltaDaCoxa(),
    braco: voltaDoBraco(),
  };
  const centro = (y: number): number => {
    const c = corteNaAltura(p, t, y, semBracos);
    let min = Infinity;
    let max = -Infinity;
    for (const q of c) {
      min = Math.min(min, q[1]);
      max = Math.max(max, q[1]);
    }
    return (min + max) / 2;
  };
  const zDoTronco = (centro(niveis.quadril) + centro(niveis.busto)) / 2;
  const forma: FormaDoCorpo = { p, triangulos: t, juntas, niveis, voltas, zDoTronco };
  formas.set(publico, forma);
  return forma;
}

/** Os dados da forma que as contas do manequim usam: as posições em z das juntas, em relação ao eixo do tronco. */
export function proporcoesDoCorpo(publico: PublicoDoManequim): {
  readonly altura: number;
  readonly z: { readonly ombro: number; readonly cotovelo: number; readonly punho: number; readonly quadril: number; readonly joelho: number; readonly tornozelo: number };
  readonly niveis: Niveis;
  readonly voltas: FormaDoCorpo['voltas'];
} {
  const f = formaDoCorpo(publico);
  const { juntas: j, zDoTronco: z0 } = f;
  return {
    altura: f.niveis.topo,
    z: { ombro: j.ombro[2] - z0, cotovelo: j.cotovelo[2] - z0, punho: j.punho[2] - z0, quadril: j.quadril[2] - z0, joelho: j.joelho[2] - z0, tornozelo: j.tornozelo[2] - z0 },
    niveis: f.niveis,
    voltas: f.voltas,
  };
}

/** Uma curva por nós: suave entre eles (a tangente zera em cada nó), constante fora. */
function curvaPorNos(xs: readonly number[], ys: readonly number[]): (x: number) => number {
  return (x) => {
    if (x <= xs[0]!) return ys[0]!;
    const n = xs.length - 1;
    if (x >= xs[n]!) return ys[n]!;
    let i = 0;
    while (x > xs[i + 1]!) i++;
    const t = (x - xs[i]!) / (xs[i + 1]! - xs[i]!);
    const s = t * t * (3 - 2 * t);
    return ys[i]! + (ys[i + 1]! - ys[i]!) * s;
  };
}

/** Uma curva por nós, reta entre eles e com as quinas arredondadas (para as alturas). */
function retaPorNos(xs: readonly number[], ys: readonly number[], raio: number): (x: number) => number {
  const dura = (x: number): number => {
    const n = xs.length - 1;
    let i = 0;
    while (i < n - 1 && x > xs[i + 1]!) i++;
    return ys[i]! + ((ys[i + 1]! - ys[i]!) * (x - xs[i]!)) / (xs[i + 1]! - xs[i]!);
  };
  // A média em volta do ponto amacia as quinas e não muda as retas.
  return (x) => (dura(x - raio) + dura(x - raio / 2) + dura(x) + dura(x + raio / 2) + dura(x + raio)) / 5;
}

type Matriz = readonly [number, number, number, number, number, number, number, number, number];

/** O giro que leva a direção `a` (unitária) à `b` pelo caminho mais curto. */
function giroEntre(a: Junta3, b: Junta3): Matriz {
  const vx = a[1] * b[2] - a[2] * b[1];
  const vy = a[2] * b[0] - a[0] * b[2];
  const vz = a[0] * b[1] - a[1] * b[0];
  const c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const k = 1 / Math.max(1e-6, 1 + c);
  return [
    c + vx * vx * k, vx * vy * k - vz, vx * vz * k + vy,
    vy * vx * k + vz, c + vy * vy * k, vy * vz * k - vx,
    vz * vx * k - vy, vz * vy * k + vx, c + vz * vz * k,
  ];
}

/** Um osso: leva os pontos em volta de `de → ate` para `para0 → para1`, com o comprimento e a grossura novos. */
interface Osso {
  readonly de: Junta3;
  readonly para: Junta3;
  readonly eixo: Junta3;
  readonly giro: Matriz;
  readonly comprimento: number;
  readonly grossura: number;
}

function osso(de: Junta3, ate: Junta3, para0: Junta3, para1: Junta3, grossura: number, comprimento?: number): Osso {
  const L0 = Math.hypot(ate[0] - de[0], ate[1] - de[1], ate[2] - de[2]) || 1;
  const L1 = Math.hypot(para1[0] - para0[0], para1[1] - para0[1], para1[2] - para0[2]) || 1;
  const eixo: Junta3 = [(ate[0] - de[0]) / L0, (ate[1] - de[1]) / L0, (ate[2] - de[2]) / L0];
  const novo: Junta3 = [(para1[0] - para0[0]) / L1, (para1[1] - para0[1]) / L1, (para1[2] - para0[2]) / L1];
  return { de, para: para0, eixo, giro: giroEntre(eixo, novo), comprimento: comprimento ?? L1 / L0, grossura };
}

function aplicarOsso(o: Osso, p: Float32Array, i: number, s: Float64Array): void {
  const dx = p[3 * i]! - o.de[0];
  const dy = p[3 * i + 1]! - o.de[1];
  const dz = p[3 * i + 2]! - o.de[2];
  const a = dx * o.eixo[0] + dy * o.eixo[1] + dz * o.eixo[2];
  const rx = (dx - a * o.eixo[0]) * o.grossura + a * o.eixo[0] * o.comprimento;
  const ry = (dy - a * o.eixo[1]) * o.grossura + a * o.eixo[1] * o.comprimento;
  const rz = (dz - a * o.eixo[2]) * o.grossura + a * o.eixo[2] * o.comprimento;
  const g = o.giro;
  s[0] = o.para[0] + g[0] * rx + g[1] * ry + g[2] * rz;
  s[1] = o.para[1] + g[3] * rx + g[4] * ry + g[5] * rz;
  s[2] = o.para[2] + g[6] * rx + g[7] * ry + g[8] * rz;
}

export interface MalhaHumana {
  readonly vertices: Float64Array;
  readonly triangulos: Uint32Array;
}

/** A volta do tronco (mm) na altura `y`, medida como a fita, sem os braços. */
export function voltaDoTronco(m: MalhaHumana, y: number): number {
  return perimetroDoFecho(corteNaAltura(m.vertices, m.triangulos, y, (a, b, c) => pesoNosBracos(a) + pesoNosBracos(b) + pesoNosBracos(c) < 1.5));
}

/** A malha do corpo: a forma do público nas medidas e na pose de `corpo`. */
export function malhaHumana(corpo: CorpoDoManequim): MalhaHumana {
  const f = formaDoCorpo(corpo.publico);
  const { p, niveis: n0, juntas: j, voltas: v0 } = f;
  const H = corpo.alturaMm;
  const m = corpo.medidas;
  const n = corpo.niveis;
  const escala = H / n0.topo;
  const zRef = f.zDoTronco;

  // As alturas do tronco.
  const y0 = [n0.gancho, n0.quadril, n0.cintura, n0.busto, n0.axila, n0.ombro, n0.pescoco, n0.queixo, n0.topo];
  const y1 = [n.gancho, n.quadril, n.cintura, n.busto, n.axila, n.ombro, n.pescoco, n.queixoDaMalha, H];
  const altura = retaPorNos([y0[0]! - 400, ...y0], [y1[0]! - 400 * escala, ...y1], 14);

  // As voltas: a mesma forma, na escala que acerta a medida em cada nível.
  const sQuadril = (m.quadrilCm * 10) / v0.quadril;
  const sCintura = (m.cinturaCm * 10) / v0.cintura;
  const sBusto = (m.bustoCm * 10) / v0.busto;
  const sPescoco = (m.pescocoCm * 10) / v0.pescoco;
  const sCabeca = (H - n.queixoDaMalha) / (n0.topo - n0.queixo);
  const ombroAlvo = corpo.bracos.esquerdo.inicio;
  const sOmbro = ombroAlvo.x / j.ombro[0];
  const nos = [n0.gancho - 60, n0.gancho, n0.quadril, n0.cintura, n0.busto, n0.axila, n0.ombro, n0.pescoco, (n0.pescoco + n0.queixo) / 2, n0.queixo + 0.012 * n0.topo];
  const largura = curvaPorNos(nos, [sQuadril, sQuadril, sQuadril, sCintura, sBusto, sBusto * 0.5 + sOmbro * 0.5, sOmbro, sOmbro * 0.5 + sPescoco * 0.5, sPescoco, sCabeca]);
  const fundura = curvaPorNos(nos, [sQuadril, sQuadril, sQuadril, sCintura, sBusto, sBusto, sBusto, sBusto * 0.5 + sPescoco * 0.5, sPescoco, sCabeca]);

  // Os ossos de um lado. O direito é o mesmo, espelhado.
  const pv = (a: { x: number; y: number; z: number }, lado: number): Junta3 => [a.x * lado, a.y, a.z];
  const g1 = (m.bracoCm * 10) / v0.braco;
  const g2 = (m.coxaCm * 10) / v0.coxa;
  const b = corpo.bracos.esquerdo;
  const l = corpo.pernas.esquerda;
  const punhoAlvo = pv(b.fim, 1);
  const dirMao = (): Junta3 => {
    if (b.mao) return [punhoAlvo[0] + b.mao.x * 80, punhoAlvo[1] + b.mao.y * 80, punhoAlvo[2] + b.mao.z * 80];
    const c = pv(b.meio, 1);
    const d = Math.hypot(punhoAlvo[0] - c[0], punhoAlvo[1] - c[1], punhoAlvo[2] - c[2]) || 1;
    return [punhoAlvo[0] + ((punhoAlvo[0] - c[0]) / d) * 80, punhoAlvo[1] + ((punhoAlvo[1] - c[1]) / d) * 80, punhoAlvo[2] + ((punhoAlvo[2] - c[2]) / d) * 80];
  };
  const dirMao0: Junta3 = (() => {
    const d = Math.hypot(j.punho[0] - j.cotovelo[0], j.punho[1] - j.cotovelo[1], j.punho[2] - j.cotovelo[2]) || 1;
    return [j.punho[0] + ((j.punho[0] - j.cotovelo[0]) / d) * 80, j.punho[1] + ((j.punho[1] - j.cotovelo[1]) / d) * 80, j.punho[2] + ((j.punho[2] - j.cotovelo[2]) / d) * 80];
  })();
  const tornozeloAlvo: Junta3 = [l.fim.x, l.fim.y, l.fim.z];
  const pe0: Junta3 = [j.tornozelo[0], j.tornozelo[1] - 60, j.tornozelo[2]];
  const pe1: Junta3 = [tornozeloAlvo[0], tornozeloAlvo[1] - 60 * escala, tornozeloAlvo[2]];
  // A junta do quadril vai para onde o tronco a leva: outra altura faria um degrau na barriga.
  const quadrilAlvo: Junta3 = [j.quadril[0] * sQuadril, altura(j.quadril[1]), (j.quadril[2] - zRef) * sQuadril];
  const ossosEsquerdos: Osso[] = [
    osso(j.ombro, j.cotovelo, pv(b.inicio, 1), pv(b.meio, 1), g1),
    osso(j.cotovelo, j.punho, pv(b.meio, 1), punhoAlvo, (g1 + escala) / 2),
    osso(j.punho, dirMao0, punhoAlvo, dirMao(), escala, escala),
    osso(j.quadril, j.joelho, quadrilAlvo, pv(l.meio, 1), g2),
    osso(j.joelho, j.tornozelo, pv(l.meio, 1), tornozeloAlvo, (g2 + escala) / 2),
    osso(j.tornozelo, pe0, tornozeloAlvo, pe1, escala, escala),
  ];
  const espelho = (q: Junta3): Junta3 => [-q[0], q[1], q[2]];
  const ossosDireitos: Osso[] = ossosEsquerdos.map((o) => {
    const giro = o.giro;
    return {
      ...o,
      de: espelho(o.de),
      para: espelho(o.para),
      eixo: espelho(o.eixo),
      giro: [giro[0], -giro[1], -giro[2], -giro[3], giro[4], giro[5], -giro[6], giro[7], giro[8]],
    };
  });
  const ossos = [...ossosEsquerdos, ...ossosDireitos];

  const pesosDoPonto = pesosDoCorpo();
  const saida = new Float64Array(p.length);
  const s = new Float64Array(3);
  const NP = PONTOS_DO_CORPO;
  for (let i = 0; i < NP; i++) {
    let x = 0;
    let y = 0;
    let z = 0;
    for (let k = 0; k < 3; k++) {
      const peso = pesosDoPonto[6 * i + 3 + k]! / 255;
      if (peso === 0) continue;
      const g = pesosDoPonto[6 * i + k]!;
      if (g === 0) {
        const py = p[3 * i + 1]!;
        s[0] = p[3 * i]! * largura(py);
        s[1] = altura(py);
        s[2] = (p[3 * i + 2]! - zRef) * fundura(py);
      } else aplicarOsso(ossos[g - 1]!, p, i, s);
      x += s[0]! * peso;
      y += s[1]! * peso;
      z += s[2]! * peso;
    }
    saida[3 * i] = x;
    saida[3 * i + 1] = y;
    saida[3 * i + 2] = z;
  }
  alisarOPeito(saida, f.triangulos);
  const { gancho, quadril, cintura, busto, axila } = corpo.niveis;
  acertarVolta(saida, f.triangulos, m.quadrilCm * 10, [gancho - 0.06 * H, quadril, cintura]);
  acertarVolta(saida, f.triangulos, m.bustoCm * 10, [cintura, busto, axila + 0.02 * H]);
  return { vertices: saida, triangulos: f.triangulos };
}

/**
 * A volta num nível, conferida no fim: no quadril os pontos seguem mais as coxas que o tronco, e o peito alisado perde um
 * pouco. O que falta entra aos poucos entre os níveis vizinhos, que já estão certos. `nos`: de baixo, do nível, de cima.
 */
function acertarVolta(v: Float64Array, t: Uint32Array, pedida: number, nos: readonly [number, number, number]): void {
  const medida = perimetroDoFecho(corteNaAltura(v, t, nos[1], (a, b, c) => pesoNosBracos(a) + pesoNosBracos(b) + pesoNosBracos(c) < 1.5));
  if (medida <= 0) return;
  const falta = pedida / medida - 1;
  const peso = curvaPorNos(nos, [0, 1, 0]);
  for (let i = 0; i < PONTOS_DO_CORPO; i++) {
    const k = 1 + falta * peso(v[3 * i + 1]!) * (1 - pesoNosBracos(i));
    v[3 * i] = v[3 * i]! * k;
    v[3 * i + 2] = v[3 * i + 2]! * k;
  }
}

/** Os dois pontos da ponta do peito na malha (as pontas dos ossos do peito, no esqueleto dela). */
const PONTAS_DO_PEITO = [8451, 1779] as const;
const RAIO_DO_PEITO_MM = 42;
const VOLTAS_DE_ALISAR = 18;

/** O peito fica liso, como num manequim de vitrine: a roupa é o assunto, e o bico marcaria o tecido justo. */
function alisarOPeito(v: Float64Array, t: Uint32Array): void {
  const pesoDoPonto = new Map<number, number>();
  for (const ponta of PONTAS_DO_PEITO) {
    for (let i = 0; i < PONTOS_DO_CORPO; i++) {
      const d = Math.hypot(v[3 * i]! - v[3 * ponta]!, v[3 * i + 1]! - v[3 * ponta + 1]!, v[3 * i + 2]! - v[3 * ponta + 2]!) / RAIO_DO_PEITO_MM;
      if (d < 1) pesoDoPonto.set(i, 1 - d * d);
    }
  }
  const vizinhos = new Map<number, Set<number>>();
  const liga = (a: number, b: number): void => {
    if (!pesoDoPonto.has(a)) return;
    if (!vizinhos.has(a)) vizinhos.set(a, new Set());
    vizinhos.get(a)!.add(b);
  };
  for (let k = 0; k < t.length; k += 3) {
    const [a, b, c] = [t[k]!, t[k + 1]!, t[k + 2]!];
    liga(a, b);
    liga(a, c);
    liga(b, a);
    liga(b, c);
    liga(c, a);
    liga(c, b);
  }
  const novo = new Map<number, [number, number, number]>();
  for (let volta = 0; volta < VOLTAS_DE_ALISAR; volta++) {
    for (const [i, lista] of vizinhos) {
      let [x, y, z] = [0, 0, 0];
      for (const j of lista) {
        x += v[3 * j]!;
        y += v[3 * j + 1]!;
        z += v[3 * j + 2]!;
      }
      const n = lista.size;
      const w = 0.7 * pesoDoPonto.get(i)!;
      novo.set(i, [v[3 * i]! + (x / n - v[3 * i]!) * w, v[3 * i + 1]! + (y / n - v[3 * i + 1]!) * w, v[3 * i + 2]! + (z / n - v[3 * i + 2]!) * w]);
    }
    for (const [i, p] of novo) {
      v[3 * i] = p[0];
      v[3 * i + 1] = p[1];
      v[3 * i + 2] = p[2];
    }
  }
}

// ---- O campo de distâncias: o corpo para a colisão com o tecido

export interface CampoDoCorpo {
  readonly ox: number;
  readonly oy: number;
  readonly oz: number;
  readonly passo: number;
  readonly nx: number;
  readonly ny: number;
  readonly nz: number;
  /** A distância com sinal (negativa dentro), em mm, em cada nó da grade. */
  readonly d: Float32Array;
}

const PASSO_DO_CAMPO = 8;
/** A margem da grade em volta do corpo (mm): mais longe que isso, a leitura soma a distância até a borda dela. */
const MARGEM_DO_CAMPO = 56;

/** O ponto mais perto de `p` no triângulo (a, b, c), em `s`. */
function pontoMaisPerto(px: number, py: number, pz: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number, s: Float64Array): void {
  const abx = bx - ax;
  const aby = by - ay;
  const abz = bz - az;
  const acx = cx - ax;
  const acy = cy - ay;
  const acz = cz - az;
  const apx = px - ax;
  const apy = py - ay;
  const apz = pz - az;
  const d1 = abx * apx + aby * apy + abz * apz;
  const d2 = acx * apx + acy * apy + acz * apz;
  let u: number;
  let w: number;
  if (d1 <= 0 && d2 <= 0) {
    u = 0;
    w = 0;
  } else {
    const bpx = px - bx;
    const bpy = py - by;
    const bpz = pz - bz;
    const d3 = abx * bpx + aby * bpy + abz * bpz;
    const d4 = acx * bpx + acy * bpy + acz * bpz;
    const vc = d1 * d4 - d3 * d2;
    if (d3 >= 0 && d4 <= d3) {
      u = 1;
      w = 0;
    } else if (vc <= 0 && d1 >= 0 && d3 <= 0) {
      u = d1 / (d1 - d3);
      w = 0;
    } else {
      const cpx = px - cx;
      const cpy = py - cy;
      const cpz = pz - cz;
      const d5 = abx * cpx + aby * cpy + abz * cpz;
      const d6 = acx * cpx + acy * cpy + acz * cpz;
      const vb = d5 * d2 - d1 * d6;
      const va = d3 * d6 - d5 * d4;
      if (d6 >= 0 && d5 <= d6) {
        u = 0;
        w = 1;
      } else if (vb <= 0 && d2 >= 0 && d6 <= 0) {
        u = 0;
        w = d2 / (d2 - d6);
      } else if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) {
        w = (d4 - d3) / (d4 - d3 + (d5 - d6));
        u = 1 - w;
      } else {
        const den = 1 / (va + vb + vc);
        u = vb * den;
        w = vc * den;
      }
    }
  }
  s[0] = ax + abx * u + acx * w;
  s[1] = ay + aby * u + acy * w;
  s[2] = az + abz * u + acz * w;
}

/**
 * O campo de distâncias da malha numa grade de 8 mm: exato perto da superfície, propagado dali para fora e para dentro.
 * Ler a grade custa o mesmo em qualquer parte do corpo, e o corpo tem de tudo: axila, gancho, mão, queixo.
 */
export function campoDoCorpo(malha: MalhaHumana): CampoDoCorpo {
  const { vertices: v, triangulos: t } = malha;
  let [minX, minY, minZ, maxX, maxY, maxZ] = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (let i = 0; i < v.length; i += 3) {
    minX = Math.min(minX, v[i]!);
    minY = Math.min(minY, v[i + 1]!);
    minZ = Math.min(minZ, v[i + 2]!);
    maxX = Math.max(maxX, v[i]!);
    maxY = Math.max(maxY, v[i + 1]!);
    maxZ = Math.max(maxZ, v[i + 2]!);
  }
  const passo = PASSO_DO_CAMPO;
  const ox = minX - MARGEM_DO_CAMPO;
  const oy = minY - MARGEM_DO_CAMPO;
  const oz = minZ - MARGEM_DO_CAMPO;
  const nx = Math.ceil((maxX - minX + 2 * MARGEM_DO_CAMPO) / passo) + 1;
  const ny = Math.ceil((maxY - minY + 2 * MARGEM_DO_CAMPO) / passo) + 1;
  const nz = Math.ceil((maxZ - minZ + 2 * MARGEM_DO_CAMPO) / passo) + 1;
  const total = nx * ny * nz;
  const d = new Float32Array(total).fill(1e9);
  const sinal = new Int8Array(total);
  const faixa = 1.75 * passo;
  const faixa2 = faixa * faixa;
  const c = new Float64Array(3);
  for (let k = 0; k < t.length; k += 3) {
    const a = t[k]!;
    const b = t[k + 1]!;
    const e = t[k + 2]!;
    const ax = v[3 * a]!;
    const ay = v[3 * a + 1]!;
    const az = v[3 * a + 2]!;
    const bx = v[3 * b]!;
    const by = v[3 * b + 1]!;
    const bz = v[3 * b + 2]!;
    const ex = v[3 * e]!;
    const ey = v[3 * e + 1]!;
    const ez = v[3 * e + 2]!;
    const nfx = (by - ay) * (ez - az) - (bz - az) * (ey - ay);
    const nfy = (bz - az) * (ex - ax) - (bx - ax) * (ez - az);
    const nfz = (bx - ax) * (ey - ay) - (by - ay) * (ex - ax);
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx, ex) - faixa - ox) / passo));
    const i1 = Math.min(nx - 1, Math.ceil((Math.max(ax, bx, ex) + faixa - ox) / passo));
    const j0 = Math.max(0, Math.floor((Math.min(ay, by, ey) - faixa - oy) / passo));
    const j1 = Math.min(ny - 1, Math.ceil((Math.max(ay, by, ey) + faixa - oy) / passo));
    const k0 = Math.max(0, Math.floor((Math.min(az, bz, ez) - faixa - oz) / passo));
    const k1 = Math.min(nz - 1, Math.ceil((Math.max(az, bz, ez) + faixa - oz) / passo));
    for (let kk = k0; kk <= k1; kk++) {
      for (let jj = j0; jj <= j1; jj++) {
        for (let ii = i0; ii <= i1; ii++) {
          const qx = ox + ii * passo;
          const qy = oy + jj * passo;
          const qz = oz + kk * passo;
          pontoMaisPerto(qx, qy, qz, ax, ay, az, bx, by, bz, ex, ey, ez, c);
          const dx = qx - c[0]!;
          const dy = qy - c[1]!;
          const dz = qz - c[2]!;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 > faixa2) continue;
          const g = ii + jj * nx + kk * nx * ny;
          if (d2 < d[g]! * d[g]!) {
            d[g] = Math.sqrt(d2);
            sinal[g] = dx * nfx + dy * nfy + dz * nfz >= 0 ? 1 : -1;
          }
        }
      }
    }
  }
  // Para fora: o que se alcança a partir do canto sem atravessar a faixa da superfície. O resto é dentro.
  const fora = new Uint8Array(total);
  const fila = new Int32Array(total);
  let ini = 0;
  let fim = 0;
  fila[fim++] = 0;
  fora[0] = 1;
  const planoXY = nx * ny;
  while (ini < fim) {
    const g = fila[ini++]!;
    const kk = Math.floor(g / planoXY);
    const jj = Math.floor((g - kk * planoXY) / nx);
    const ii = g - kk * planoXY - jj * nx;
    for (let q = 0; q < 6; q++) {
      let h = -1;
      if (q === 0) h = ii > 0 ? g - 1 : -1;
      else if (q === 1) h = ii < nx - 1 ? g + 1 : -1;
      else if (q === 2) h = jj > 0 ? g - nx : -1;
      else if (q === 3) h = jj < ny - 1 ? g + nx : -1;
      else if (q === 4) h = kk > 0 ? g - planoXY : -1;
      else h = kk < nz - 1 ? g + planoXY : -1;
      if (h >= 0 && fora[h] === 0 && sinal[h] === 0) {
        fora[h] = 1;
        fila[fim++] = h;
      }
    }
  }
  // A propagação da distância: uma varredura de ida e uma de volta, com os vizinhos já vistos. A borda da grade não varre:
  // ela copia a vizinha de dentro no fim.
  const saltos = new Int32Array(13);
  const custos = new Float32Array(13);
  let m = 0;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dz < 0 || (dz === 0 && (dy < 0 || (dy === 0 && dx < 0)))) {
          saltos[m] = dx + dy * nx + dz * planoXY;
          custos[m++] = Math.hypot(dx, dy, dz) * passo;
        }
      }
    }
  }
  const varrer = (sentido: 1 | -1): void => {
    const [ka, kb] = sentido > 0 ? [1, nz - 1] : [nz - 2, 0];
    const [ja, jb] = sentido > 0 ? [1, ny - 1] : [ny - 2, 0];
    const [ia, ib] = sentido > 0 ? [1, nx - 1] : [nx - 2, 0];
    for (let kk = ka; kk !== kb; kk += sentido) {
      for (let jj = ja; jj !== jb; jj += sentido) {
        let g = ia + jj * nx + kk * planoXY;
        for (let ii = ia; ii !== ib; ii += sentido, g += sentido) {
          // Na faixa da superfície a distância já é a exata.
          if (sinal[g] !== 0) continue;
          let melhor = d[g]!;
          for (let q = 0; q < 13; q++) {
            const w = d[g + sentido * saltos[q]!]! + custos[q]!;
            if (w < melhor) melhor = w;
          }
          d[g] = melhor;
        }
      }
    }
  };
  varrer(1);
  varrer(-1);
  for (let kk = 0; kk < nz; kk++) {
    for (let jj = 0; jj < ny; jj++) {
      for (let ii = 0; ii < nx; ii++) {
        if (ii > 0 && jj > 0 && kk > 0 && ii < nx - 1 && jj < ny - 1 && kk < nz - 1) continue;
        d[ii + jj * nx + kk * planoXY] = d[Math.max(1, Math.min(nx - 2, ii)) + Math.max(1, Math.min(ny - 2, jj)) * nx + Math.max(1, Math.min(nz - 2, kk)) * planoXY]! + passo;
      }
    }
  }
  for (let g = 0; g < total; g++) {
    const s = sinal[g] !== 0 ? sinal[g]! : fora[g] ? 1 : -1;
    d[g] = d[g]! * s;
  }
  return { ox, oy, oz, passo, nx, ny, nz, d };
}

/** A distância com sinal e a direção para fora, lidas na grade (em `s`: d, nx, ny, nz). */
export function lerCampo(c: CampoDoCorpo, x: number, y: number, z: number, s: Float64Array): void {
  const fx = Math.max(0, Math.min(c.nx - 1.001, (x - c.ox) / c.passo));
  const fy = Math.max(0, Math.min(c.ny - 1.001, (y - c.oy) / c.passo));
  const fz = Math.max(0, Math.min(c.nz - 1.001, (z - c.oz) / c.passo));
  const i = fx | 0;
  const j = fy | 0;
  const k = fz | 0;
  const a = fx - i;
  const b = fy - j;
  const e = fz - k;
  const sy = c.nx;
  const sz = c.nx * c.ny;
  const g = i + j * sy + k * sz;
  const D = c.d;
  const d000 = D[g]!;
  const d100 = D[g + 1]!;
  const d010 = D[g + sy]!;
  const d110 = D[g + sy + 1]!;
  const d001 = D[g + sz]!;
  const d101 = D[g + sz + 1]!;
  const d011 = D[g + sz + sy]!;
  const d111 = D[g + sz + sy + 1]!;
  const x00 = d000 + (d100 - d000) * a;
  const x10 = d010 + (d110 - d010) * a;
  const x01 = d001 + (d101 - d001) * a;
  const x11 = d011 + (d111 - d011) * a;
  const y0 = x00 + (x10 - x00) * b;
  const y1 = x01 + (x11 - x01) * b;
  let gx = (1 - e) * ((1 - b) * (d100 - d000) + b * (d110 - d010)) + e * ((1 - b) * (d101 - d001) + b * (d111 - d011));
  let gy = (1 - e) * (x10 - x00) + e * (x11 - x01);
  let gz = y1 - y0;
  const l = Math.sqrt(gx * gx + gy * gy + gz * gz);
  if (l > 1e-9) {
    gx /= l;
    gy /= l;
    gz /= l;
  } else {
    gx = 0;
    gy = 0;
    gz = 1;
  }
  // Fora da grade, a distância até ela soma à da borda.
  let fora = 0;
  if (x < c.ox || y < c.oy || z < c.oz || x > c.ox + (c.nx - 1) * c.passo || y > c.oy + (c.ny - 1) * c.passo || z > c.oz + (c.nz - 1) * c.passo) {
    fora = Math.hypot(x - Math.max(c.ox, Math.min(c.ox + (c.nx - 1) * c.passo, x)), y - Math.max(c.oy, Math.min(c.oy + (c.ny - 1) * c.passo, y)), z - Math.max(c.oz, Math.min(c.oz + (c.nz - 1) * c.passo, z)));
  }
  s[0] = y0 + (y1 - y0) * e + fora;
  s[1] = gx;
  s[2] = gy;
  s[3] = gz;
}

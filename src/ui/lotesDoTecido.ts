import { corDaTensao } from './cena3d';
import { ALCANCE_DA_BORDA, type EstampaDoEstudio, type LoteDoEstudio, type MapaDaPeca, type MaterialDoEstudio, type TramaDoTecido } from './estudio3d';
import { normaisSuaves, refinar } from './malhasDoEstudio';

/** A roupa em lotes para o estúdio (ADR 0228): as peças, os zíperes e os botões, em geometria de verdade. */

export interface PecaParaOEstudio {
  readonly chave: string;
  readonly primeiroTriangulo: number;
  readonly quantidade: number;
  /** O primeiro ponto da peça nas listas da simulação. */
  readonly inicio: number;
  /** As coordenadas da face de cada ponto da peça (mm), u e v seguidos. */
  readonly uv: ArrayLike<number>;
  readonly cor: readonly [number, number, number];
  readonly espelhada: boolean;
  readonly estampa?: EstampaDoEstudio;
  /** A borda da peça: a costura, a barra e o pesponto (ADR 0231). */
  readonly mapa?: MapaDaPeca;
}

export interface TecidoParaOEstudio {
  readonly x: ArrayLike<number>;
  readonly triangulos: ArrayLike<number>;
  readonly pecas: readonly PecaParaOEstudio[];
  /** Os dois lados de cada costura: a normal é a mesma, e a emenda não vira uma quina no desenho. */
  readonly costuras?: { readonly a: ArrayLike<number>; readonly b1: ArrayLike<number>; readonly b2: ArrayLike<number> };
  /** Pinta pela tensão (o quanto estica) em vez da cor. */
  readonly tensoes?: ArrayLike<number>;
  /** Os botões (os furos do molde): o triângulo, a posição nele (b1, b2; b0 = 1 − b1 − b2) e o raio (mm). */
  readonly botoes?: readonly { readonly triangulo: number; readonly b1: number; readonly b2: number; readonly raio: number }[];
  /** O brilho e a transparência do tecido, de 0 a 100 (ADR 0131). */
  readonly brilho?: number;
  readonly transparencia?: number;
  readonly trama?: TramaDoTecido;
  /** Os zíperes: os pontos da costura (nos números da simulação) e o comprimento (mm), do alto para baixo (ADR 0132). */
  readonly ziperes?: readonly { readonly pontos: ArrayLike<number>; readonly comprimentoMm: number }[];
}

const PASSO_DO_MAPA_MM = 2;

/**
 * A grade da borda de uma peça (ADR 0231). `contorno`: os pontos na face (u, v seguidos), fechado; `costurado`: 1 em cada
 * lado do contorno que tem costura (o lado `i` vai do ponto `i` ao seguinte).
 */
export function mapaDaPeca(contorno: ArrayLike<number>, costurado: ArrayLike<number>): MapaDaPeca {
  const n = contorno.length / 2;
  let [minU, minV, maxU, maxV] = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < n; i++) {
    minU = Math.min(minU, contorno[2 * i]!);
    maxU = Math.max(maxU, contorno[2 * i]!);
    minV = Math.min(minV, contorno[2 * i + 1]!);
    maxV = Math.max(maxV, contorno[2 * i + 1]!);
  }
  const passo = PASSO_DO_MAPA_MM;
  const ou = minU - 2 * passo;
  const ov = minV - 2 * passo;
  const largura = Math.ceil((maxU - minU) / passo) + 5;
  const altura = Math.ceil((maxV - minV) / passo) + 5;
  const distancia = new Float32Array(largura * altura).fill(Infinity);
  const caminho = new Float32Array(largura * altura);
  const marca = new Uint8Array(largura * altura);
  let andado = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [u0, v0, u1, v1] = [contorno[2 * i]!, contorno[2 * i + 1]!, contorno[2 * j]!, contorno[2 * j + 1]!];
    const du = u1 - u0;
    const dv = v1 - v0;
    const l2 = du * du + dv * dv;
    const l = Math.sqrt(l2);
    const a0 = Math.max(0, Math.floor((Math.min(u0, u1) - ALCANCE_DA_BORDA - ou) / passo));
    const a1 = Math.min(largura - 1, Math.ceil((Math.max(u0, u1) + ALCANCE_DA_BORDA - ou) / passo));
    const b0 = Math.max(0, Math.floor((Math.min(v0, v1) - ALCANCE_DA_BORDA - ov) / passo));
    const b1 = Math.min(altura - 1, Math.ceil((Math.max(v0, v1) + ALCANCE_DA_BORDA - ov) / passo));
    for (let b = b0; b <= b1; b++) {
      for (let a = a0; a <= a1; a++) {
        const pu = ou + a * passo - u0;
        const pv = ov + b * passo - v0;
        const t = l2 > 0 ? Math.min(1, Math.max(0, (pu * du + pv * dv) / l2)) : 0;
        const d = Math.hypot(pu - t * du, pv - t * dv);
        const g = b * largura + a;
        if (d < distancia[g]!) {
          distancia[g] = d;
          caminho[g] = andado + t * l;
          marca[g] = costurado[i]! ? 1 : 0;
        }
      }
    }
    andado += l;
  }
  return { ou, ov, passo, largura, altura, distancia, caminho, costurado: marca };
}

/** As normais de toda a roupa, com os dois lados de cada costura na mesma direção. */
function normaisDaRoupa(t: TecidoParaOEstudio): Float32Array {
  const pontos = t.x.length / 3;
  const n = normaisSuaves(t.x, t.triangulos, pontos);
  const c = t.costuras;
  if (!c) return n;
  const soma = Float32Array.from(n);
  for (let k = 0; k < c.a.length; k++) {
    const a = c.a[k]!;
    const b = c.b1[k]!;
    // As peças de um par têm os triângulos ao contrário: a normal do outro lado entra com o sinal que concorda.
    const s = n[3 * a]! * n[3 * b]! + n[3 * a + 1]! * n[3 * b + 1]! + n[3 * a + 2]! * n[3 * b + 2]! < 0 ? -1 : 1;
    for (let e = 0; e < 3; e++) {
      soma[3 * a + e] = soma[3 * a + e]! + s * n[3 * b + e]!;
      soma[3 * b + e] = soma[3 * b + e]! + s * n[3 * a + e]!;
    }
  }
  for (let i = 0; i < pontos; i++) {
    const l = Math.hypot(soma[3 * i]!, soma[3 * i + 1]!, soma[3 * i + 2]!) || 1;
    soma[3 * i] = soma[3 * i]! / l;
    soma[3 * i + 1] = soma[3 * i + 1]! / l;
    soma[3 * i + 2] = soma[3 * i + 2]! / l;
  }
  return soma;
}

/** O disco de um botão: a borda, o rebaixo e o miolo, com a face voltada para `n`. */
export function loteDoBotao(px: number, py: number, pz: number, nx: number, ny: number, nz: number, raio: number): LoteDoEstudio {
  const lados = 16;
  const ref = Math.abs(ny) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const ux0 = ny * ref[2]! - nz * ref[1]!;
  const uy0 = nz * ref[0]! - nx * ref[2]!;
  const uz0 = nx * ref[1]! - ny * ref[0]!;
  const ul = Math.hypot(ux0, uy0, uz0) || 1;
  const [ux, uy, uz] = [ux0 / ul, uy0 / ul, uz0 / ul];
  const [wx, wy, wz] = [ny * uz - nz * uy, nz * ux - nx * uz, nx * uy - ny * ux];
  const perfil: readonly (readonly [number, number])[] = [
    [1, 0.2],
    [0.98, 1.3],
    [0.86, 1.9],
    [0.72, 1.3],
    [0.62, 1.1],
  ];
  const v: number[] = [];
  const t: number[] = [];
  for (const [r, h] of perfil) {
    for (let i = 0; i < lados; i++) {
      const a = (2 * Math.PI * i) / lados;
      const c = Math.cos(a) * raio * r;
      const s = Math.sin(a) * raio * r;
      v.push(px + c * ux + s * wx + h * nx, py + c * uy + s * wy + h * ny, pz + c * uz + s * wz + h * nz);
    }
  }
  for (let q = 0; q < perfil.length - 1; q++) {
    for (let i = 0; i < lados; i++) {
      const j = (i + 1) % lados;
      const [a, b, c, d] = [q * lados + i, q * lados + j, (q + 1) * lados + i, (q + 1) * lados + j];
      t.push(a, b, d, a, d, c);
    }
  }
  const centro = v.length / 3;
  v.push(px + 1.1 * nx, py + 1.1 * ny, pz + 1.1 * nz);
  const ultimo = (perfil.length - 1) * lados;
  for (let i = 0; i < lados; i++) t.push(ultimo + i, ultimo + (i + 1) % lados, centro);
  const posicoes = Float32Array.from(v);
  const indices = Uint32Array.from(t);
  const normais = normaisSuaves(posicoes, indices);
  // A ordem dos cantos acima deixa a frente para fora só de um lado: a normal aponta sempre para `n`.
  let soma = 0;
  for (let i = 0; i < normais.length; i += 3) soma += normais[i]! * nx + normais[i + 1]! * ny + normais[i + 2]! * nz;
  if (soma < 0) for (let i = 0; i < normais.length; i++) normais[i] = -normais[i]!;
  return { posicoes, normais, uv: new Float32Array((posicoes.length / 3) * 2), indices, material: { acabamento: 'botao', cor: [40, 40, 46] } };
}

/**
 * A fita do zíper ao longo da costura, do alto para baixo: 14 mm de largura sobre o tecido. Em u, a distância ao meio da
 * fita; em v, o caminho andado (é por eles que o estúdio desenha os dentes).
 */
export function loteDoZiper(x: ArrayLike<number>, n: ArrayLike<number>, pontos: ArrayLike<number>, comprimentoMm: number): LoteDoEstudio | null {
  const total = pontos.length;
  if (total < 2) return null;
  const alturaDe = (k: number): number => x[3 * pontos[k]! + 1]!;
  const paraBaixo = alturaDe(0) >= alturaDe(total - 1);
  const ordem = Array.from({ length: total }, (_, k) => pontos[paraBaixo ? k : total - 1 - k]!);
  const centros: number[] = [];
  const normais: number[] = [];
  const andados: number[] = [];
  let andado = 0;
  for (let k = 0; k < total; k++) {
    const i = ordem[k]!;
    const [ax, ay, az] = [x[3 * i]!, x[3 * i + 1]!, x[3 * i + 2]!];
    if (k > 0) {
      const a = ordem[k - 1]!;
      const lado = Math.hypot(ax - x[3 * a]!, ay - x[3 * a + 1]!, az - x[3 * a + 2]!);
      if (lado < 1e-9) continue;
      const falta = comprimentoMm - andado;
      if (lado >= falta) {
        const f = falta / lado;
        centros.push(x[3 * a]! + (ax - x[3 * a]!) * f, x[3 * a + 1]! + (ay - x[3 * a + 1]!) * f, x[3 * a + 2]! + (az - x[3 * a + 2]!) * f);
        normais.push(n[3 * i]!, n[3 * i + 1]!, n[3 * i + 2]!);
        andados.push(comprimentoMm);
        break;
      }
      andado += lado;
    }
    centros.push(ax, ay, az);
    normais.push(n[3 * i]!, n[3 * i + 1]!, n[3 * i + 2]!);
    andados.push(andado);
  }
  const m = andados.length;
  if (m < 2) return null;
  const v = new Float32Array(m * 6);
  const nv = new Float32Array(m * 6);
  const uv = new Float32Array(m * 4);
  const t: number[] = [];
  for (let k = 0; k < m; k++) {
    const a = Math.max(0, k - 1);
    const b = Math.min(m - 1, k + 1);
    const dx = centros[3 * b]! - centros[3 * a]!;
    const dy = centros[3 * b + 1]! - centros[3 * a + 1]!;
    const dz = centros[3 * b + 2]! - centros[3 * a + 2]!;
    const [nx, ny, nz] = [normais[3 * k]!, normais[3 * k + 1]!, normais[3 * k + 2]!];
    const sx = ny * dz - nz * dy;
    const sy = nz * dx - nx * dz;
    const sz = nx * dy - ny * dx;
    const sl = Math.hypot(sx, sy, sz) || 1;
    for (const [q, s] of [[0, -1], [1, 1]] as const) {
      v[6 * k + 3 * q] = centros[3 * k]! + (s * 7 * sx) / sl + 1.2 * nx;
      v[6 * k + 3 * q + 1] = centros[3 * k + 1]! + (s * 7 * sy) / sl + 1.2 * ny;
      v[6 * k + 3 * q + 2] = centros[3 * k + 2]! + (s * 7 * sz) / sl + 1.2 * nz;
      nv[6 * k + 3 * q] = nx;
      nv[6 * k + 3 * q + 1] = ny;
      nv[6 * k + 3 * q + 2] = nz;
      uv[4 * k + 2 * q] = s * 7;
      uv[4 * k + 2 * q + 1] = andados[k]!;
    }
    if (k < m - 1) t.push(2 * k, 2 * k + 1, 2 * k + 3, 2 * k, 2 * k + 3, 2 * k + 2);
  }
  return { posicoes: v, normais: nv, uv, indices: Uint32Array.from(t), material: { acabamento: 'ziper', cor: [47, 47, 51] } };
}

/** A roupa em lotes: um por peça, mais os botões e os zíperes. `refino`: quantas vezes cada triângulo vira quatro. */
export function lotesDoTecido(t: TecidoParaOEstudio, refino: number): LoteDoEstudio[] {
  const normais = normaisDaRoupa(t);
  const lotes: LoteDoEstudio[] = [];
  const brilho = t.tensoes ? 0 : (t.brilho ?? 0) / 100;
  const transparencia = (t.transparencia ?? 0) / 100;
  for (const peca of t.pecas) {
    const pontos = peca.uv.length / 2;
    const posicoes = new Float32Array(pontos * 3);
    const normaisDaPeca = new Float32Array(pontos * 3);
    for (let i = 0; i < pontos * 3; i++) {
      posicoes[i] = t.x[3 * peca.inicio + i]!;
      normaisDaPeca[i] = normais[3 * peca.inicio + i]!;
    }
    const indices = new Uint32Array(peca.quantidade * 3);
    for (let k = 0; k < indices.length; k++) indices[k] = t.triangulos[3 * peca.primeiroTriangulo + k]! - peca.inicio;
    const uv = Float32Array.from(peca.uv);
    const material: MaterialDoEstudio = {
      acabamento: 'tecido',
      cor: peca.cor,
      espelhada: peca.espelhada,
      ...(brilho > 0 ? { brilho } : {}),
      ...(transparencia > 0 ? { transparencia } : {}),
      ...(t.trama && !t.tensoes ? { trama: t.trama } : {}),
      ...(peca.estampa && !t.tensoes ? { estampa: peca.estampa } : {}),
      ...(peca.mapa && !t.tensoes ? { mapa: peca.mapa } : {}),
    };
    if (t.tensoes) {
      const coresDosTriangulos = new Uint8Array(peca.quantidade * 3);
      for (let k = 0; k < peca.quantidade; k++) coresDosTriangulos.set(corDaTensao(t.tensoes[peca.primeiroTriangulo + k]!), 3 * k);
      lotes.push({ posicoes, normais: normaisDaPeca, uv, indices, material, coresDosTriangulos });
      continue;
    }
    const m = refinar({ posicoes, normais: normaisDaPeca, uv, indices }, refino);
    lotes.push({ posicoes: m.posicoes, normais: m.normais, ...(m.uv ? { uv: m.uv } : {}), indices: m.indices, material });
  }
  const X = t.x;
  for (const ziper of t.ziperes ?? []) {
    const lote = loteDoZiper(X, normais, ziper.pontos, ziper.comprimentoMm);
    if (lote) lotes.push(lote);
  }
  for (const b of t.botoes ?? []) {
    const [i, j, k] = [t.triangulos[3 * b.triangulo]!, t.triangulos[3 * b.triangulo + 1]!, t.triangulos[3 * b.triangulo + 2]!];
    const b0 = 1 - b.b1 - b.b2;
    const em = (e: number): number => X[3 * i + e]! * b0 + X[3 * j + e]! * b.b1 + X[3 * k + e]! * b.b2;
    const nx = normais[3 * i]! + normais[3 * j]! + normais[3 * k]!;
    const ny = normais[3 * i + 1]! + normais[3 * j + 1]! + normais[3 * k + 1]!;
    const nz = normais[3 * i + 2]! + normais[3 * j + 2]! + normais[3 * k + 2]!;
    const l = Math.hypot(nx, ny, nz) || 1;
    lotes.push(loteDoBotao(em(0), em(1), em(2), nx / l, ny / l, nz / l, b.raio));
  }
  return lotes;
}

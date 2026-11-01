import type { LoteDoEstudio, MaterialDoEstudio } from './estudio3d';

/** As malhas que vão para o estúdio (ADR 0228): as normais suaves e os triângulos refinados, que tiram as facetas. */

/** A normal de cada ponto: a média das faces em volta, pesada pela área. */
export function normaisSuaves(x: ArrayLike<number>, t: ArrayLike<number>, pontos = x.length / 3): Float32Array {
  const n = new Float32Array(pontos * 3);
  for (let k = 0; k < t.length; k += 3) {
    const a = t[k]!;
    const b = t[k + 1]!;
    const c = t[k + 2]!;
    const e1x = x[3 * b]! - x[3 * a]!;
    const e1y = x[3 * b + 1]! - x[3 * a + 1]!;
    const e1z = x[3 * b + 2]! - x[3 * a + 2]!;
    const e2x = x[3 * c]! - x[3 * a]!;
    const e2y = x[3 * c + 1]! - x[3 * a + 1]!;
    const e2z = x[3 * c + 2]! - x[3 * a + 2]!;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    for (const v of [a, b, c]) {
      n[3 * v] = n[3 * v]! + nx;
      n[3 * v + 1] = n[3 * v + 1]! + ny;
      n[3 * v + 2] = n[3 * v + 2]! + nz;
    }
  }
  for (let i = 0; i < pontos; i++) {
    const l = Math.hypot(n[3 * i]!, n[3 * i + 1]!, n[3 * i + 2]!) || 1;
    n[3 * i] = n[3 * i]! / l;
    n[3 * i + 1] = n[3 * i + 1]! / l;
    n[3 * i + 2] = n[3 * i + 2]! / l;
  }
  return n;
}

export interface MalhaRefinada {
  readonly posicoes: Float32Array;
  readonly normais: Float32Array;
  readonly uv?: Float32Array;
  readonly rugas?: Float32Array;
  readonly indices: Uint32Array;
}

/**
 * Cada triângulo em quatro (`vezes` seguidas), com o ponto novo no meio de cada aresta puxado para a curva que as normais
 * dos dois cantos pedem (a tesselação de Phong). O ponto do meio depende só da aresta: não abre frestas entre vizinhos.
 */
export function refinar(m: MalhaRefinada, vezes: number): MalhaRefinada {
  let atual = m;
  for (let volta = 0; volta < vezes; volta++) {
    const { posicoes: P, normais: N, uv: UV, rugas: RUGAS, indices: I } = atual;
    const nv = P.length / 3;
    const meios = new Map<number, number>();
    const px: number[] = [];
    const nx: number[] = [];
    const uvx: number[] = [];
    const rugasx: number[] = [];
    const meio = (a: number, b: number): number => {
      const [i, j] = a < b ? [a, b] : [b, a];
      const chave = i * nv + j;
      const achado = meios.get(chave);
      if (achado !== undefined) return achado;
      const novo = nv + px.length / 3;
      meios.set(chave, novo);
      const mx = (P[3 * i]! + P[3 * j]!) / 2;
      const my = (P[3 * i + 1]! + P[3 * j + 1]!) / 2;
      const mz = (P[3 * i + 2]! + P[3 * j + 2]!) / 2;
      const di = (mx - P[3 * i]!) * N[3 * i]! + (my - P[3 * i + 1]!) * N[3 * i + 1]! + (mz - P[3 * i + 2]!) * N[3 * i + 2]!;
      const dj = (mx - P[3 * j]!) * N[3 * j]! + (my - P[3 * j + 1]!) * N[3 * j + 1]! + (mz - P[3 * j + 2]!) * N[3 * j + 2]!;
      // A média das projeções nos planos dos dois cantos, a três quartos do caminho (o valor do artigo).
      const k = 0.75 * 0.5;
      px.push(mx - k * (di * N[3 * i]! + dj * N[3 * j]!), my - k * (di * N[3 * i + 1]! + dj * N[3 * j + 1]!), mz - k * (di * N[3 * i + 2]! + dj * N[3 * j + 2]!));
      const ax = N[3 * i]! + N[3 * j]!;
      const ay = N[3 * i + 1]! + N[3 * j + 1]!;
      const az = N[3 * i + 2]! + N[3 * j + 2]!;
      const l = Math.hypot(ax, ay, az) || 1;
      nx.push(ax / l, ay / l, az / l);
      if (UV) uvx.push((UV[2 * i]! + UV[2 * j]!) / 2, (UV[2 * i + 1]! + UV[2 * j + 1]!) / 2);
      if (RUGAS) rugasx.push((RUGAS[2 * i]! + RUGAS[2 * j]!) / 2, (RUGAS[2 * i + 1]! + RUGAS[2 * j + 1]!) / 2);
      return novo;
    };
    const novos = new Uint32Array(I.length * 4);
    for (let k = 0, s = 0; k < I.length; k += 3) {
      const a = I[k]!;
      const b = I[k + 1]!;
      const c = I[k + 2]!;
      const ab = meio(a, b);
      const bc = meio(b, c);
      const ca = meio(c, a);
      novos[s++] = a;
      novos[s++] = ab;
      novos[s++] = ca;
      novos[s++] = ab;
      novos[s++] = b;
      novos[s++] = bc;
      novos[s++] = ca;
      novos[s++] = bc;
      novos[s++] = c;
      novos[s++] = ab;
      novos[s++] = bc;
      novos[s++] = ca;
    }
    const posicoes = new Float32Array(P.length + px.length);
    posicoes.set(P);
    posicoes.set(px, P.length);
    const normais = new Float32Array(N.length + nx.length);
    normais.set(N);
    normais.set(nx, N.length);
    const uv = UV ? new Float32Array(UV.length + uvx.length) : undefined;
    if (uv && UV) {
      uv.set(UV);
      uv.set(uvx, UV.length);
    }
    const rugas = RUGAS ? new Float32Array(RUGAS.length + rugasx.length) : undefined;
    if (rugas && RUGAS) {
      rugas.set(RUGAS);
      rugas.set(rugasx, RUGAS.length);
    }
    atual = { posicoes, normais, ...(uv ? { uv } : {}), ...(rugas ? { rugas } : {}), indices: novos };
  }
  return atual;
}

/** O corpo: os pontos, as normais suaves e o acabamento de manequim de vitrine. */
export function loteDoCorpo(vertices: ArrayLike<number>, triangulos: ArrayLike<number>, cor: readonly [number, number, number], refino: number): LoteDoEstudio {
  const material: MaterialDoEstudio = { acabamento: 'corpo', cor };
  const m = refinar({ posicoes: Float32Array.from(vertices), normais: normaisSuaves(vertices, triangulos), indices: Uint32Array.from(triangulos) }, refino);
  return { posicoes: m.posicoes, normais: m.normais, indices: m.indices, material };
}

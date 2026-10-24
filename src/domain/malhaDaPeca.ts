import type { Contorno, Ponto2D } from '../core/geometria';

/**
 * A malha de uma peça para o provador 3D (ADR 0111): o contorno amostrado de `espacoMm` em `espacoMm` (com todos os
 * pontos do molde), o miolo numa grade triangular e os triângulos por Delaunay, sem os que caem fora da peça. Os
 * pontos ficam nas coordenadas da peça (mm), na ordem do contorno — a costura acha o trecho do contorno pelos
 * números dos pontos do molde.
 */

export interface MalhaDaPeca {
  /** Os pontos da malha (x, y seguidos), nas coordenadas da peça. */
  readonly pontos: Float64Array;
  readonly triangulos: Uint32Array;
  /** A borda, na ordem do contorno: o ponto da malha e a distância ao longo do contorno (mm, desde o ponto 0). */
  readonly borda: readonly { readonly ponto: number; readonly s: number }[];
  /** O perímetro (mm). */
  readonly perimetro: number;
  /** Para cada ponto do contorno do molde, a posição dele em `borda`. */
  readonly bordaDoVertice: readonly number[];
  /** As arestas (pares de pontos, sem repetir). */
  readonly arestas: Uint32Array;
  /** Para a rigidez à flexão: os dois pontos opostos de cada aresta com dois triângulos. */
  readonly dobras: Uint32Array;
  /** A área de cada triângulo (mm²). */
  readonly areas: Float64Array;
}

function dentroDoPoligono(p: Ponto2D, poligono: Contorno): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i]!;
    const b = poligono[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}

function distanciaAoSegmento(p: Ponto2D, a: Ponto2D, b: Ponto2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const L2 = dx * dx + dy * dy;
  const t = L2 > 0 ? Math.min(1, Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0;
  return Math.hypot(p.x - (a.x + dx * t), p.y - (a.y + dy * t));
}

/** A triangulação de Delaunay (Bowyer–Watson) dos pontos; devolve os triângulos (índices). */
export function delaunay(xs: Float64Array): number[] {
  const n = xs.length / 2;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    minX = Math.min(minX, xs[2 * i]!);
    maxX = Math.max(maxX, xs[2 * i]!);
    minY = Math.min(minY, xs[2 * i + 1]!);
    maxY = Math.max(maxY, xs[2 * i + 1]!);
  }
  const d = Math.max(maxX - minX, maxY - minY) * 20 + 1;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  // Os pontos com os três do triângulo de fora no fim.
  const P = new Float64Array(2 * (n + 3));
  P.set(xs);
  P[2 * n] = cx - d;
  P[2 * n + 1] = cy - d;
  P[2 * n + 2] = cx + d;
  P[2 * n + 3] = cy - d;
  P[2 * n + 4] = cx;
  P[2 * n + 5] = cy + d;
  interface Tri {
    a: number;
    b: number;
    c: number;
    ox: number;
    oy: number;
    r2: number;
  }
  const circulo = (a: number, b: number, c: number): Tri => {
    const ax = P[2 * a]!;
    const ay = P[2 * a + 1]!;
    const bx = P[2 * b]!;
    const by = P[2 * b + 1]!;
    const qx = P[2 * c]!;
    const qy = P[2 * c + 1]!;
    const D = 2 * (ax * (by - qy) + bx * (qy - ay) + qx * (ay - by));
    if (Math.abs(D) < 1e-12) return { a, b, c, ox: 0, oy: 0, r2: Infinity };
    const ox = ((ax * ax + ay * ay) * (by - qy) + (bx * bx + by * by) * (qy - ay) + (qx * qx + qy * qy) * (ay - by)) / D;
    const oy = ((ax * ax + ay * ay) * (qx - bx) + (bx * bx + by * by) * (ax - qx) + (qx * qx + qy * qy) * (bx - ax)) / D;
    return { a, b, c, ox, oy, r2: (ax - ox) ** 2 + (ay - oy) ** 2 };
  };
  let tris: Tri[] = [circulo(n, n + 1, n + 2)];
  for (let i = 0; i < n; i++) {
    const px = P[2 * i]!;
    const py = P[2 * i + 1]!;
    const ruins: Tri[] = [];
    const bons: Tri[] = [];
    for (const t of tris) {
      if ((px - t.ox) ** 2 + (py - t.oy) ** 2 < t.r2 * (1 + 1e-12)) ruins.push(t);
      else bons.push(t);
    }
    // A borda do buraco: as arestas dos triângulos ruins que só aparecem uma vez.
    const contagem = new Map<string, [number, number, number]>();
    for (const t of ruins) {
      for (const [u, v] of [
        [t.a, t.b],
        [t.b, t.c],
        [t.c, t.a],
      ] as const) {
        const k = u < v ? `${u},${v}` : `${v},${u}`;
        const atual = contagem.get(k);
        if (atual) atual[2]++;
        else contagem.set(k, [u, v, 1]);
      }
    }
    for (const [u, v, vezes] of contagem.values()) if (vezes === 1) bons.push(circulo(u, v, i));
    tris = bons;
  }
  const saida: number[] = [];
  for (const t of tris) if (t.a < n && t.b < n && t.c < n) saida.push(t.a, t.b, t.c);
  return saida;
}

/** A malha da peça pelo contorno (o do molde, na ordem dele). */
export function malhaDaPeca(contorno: Contorno, espacoMm: number): MalhaDaPeca {
  const h = Math.max(2, espacoMm);
  const n = contorno.length;
  const xs: number[] = [];
  const borda: { ponto: number; s: number }[] = [];
  const bordaDoVertice: number[] = [];
  let s = 0;
  for (let i = 0; i < n; i++) {
    const a = contorno[i]!;
    const b = contorno[(i + 1) % n]!;
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    const partes = Math.max(1, Math.ceil(L / h - 0.15));
    bordaDoVertice.push(borda.length);
    for (let k = 0; k < partes; k++) {
      const f = k / partes;
      // Pontos repetidos (um ponto do contorno sobre o outro) entram uma vez só.
      const x = a.x + (b.x - a.x) * f;
      const y = a.y + (b.y - a.y) * f;
      const ultimo = borda.length > 0 ? borda[borda.length - 1]!.ponto : -1;
      if (ultimo >= 0 && Math.hypot(xs[2 * ultimo]! - x, xs[2 * ultimo + 1]! - y) < 1e-6) {
        if (k === 0) bordaDoVertice[bordaDoVertice.length - 1] = borda.length - 1;
        continue;
      }
      xs.push(x, y);
      borda.push({ ponto: xs.length / 2 - 1, s: s + L * f });
    }
    s += L;
  }
  const perimetro = s;
  // O miolo: grade triangular, a pelo menos meio espaço da borda.
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of contorno) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const passoY = (h * Math.sqrt(3)) / 2;
  let linha = 0;
  for (let y = minY + passoY / 2; y < maxY; y += passoY, linha++) {
    for (let x = minX + (linha % 2 ? h / 2 : h / 4); x < maxX; x += h) {
      const p = { x, y };
      if (!dentroDoPoligono(p, contorno)) continue;
      let perto = Infinity;
      for (let i = 0; i < n && perto >= h * 0.55; i++) perto = Math.min(perto, distanciaAoSegmento(p, contorno[i]!, contorno[(i + 1) % n]!));
      if (perto < h * 0.55) continue;
      xs.push(x, y);
    }
  }
  const pontos = Float64Array.from(xs);
  const todos = delaunay(pontos);
  // Fora: o triângulo cujo centro ou o meio de uma aresta cai fora da peça.
  const tri: number[] = [];
  const ponto = (i: number): Ponto2D => ({ x: pontos[2 * i]!, y: pontos[2 * i + 1]! });
  for (let k = 0; k < todos.length; k += 3) {
    const a = ponto(todos[k]!);
    const b = ponto(todos[k + 1]!);
    const c = ponto(todos[k + 2]!);
    const area = ((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
    if (Math.abs(area) < h * h * 1e-4) continue;
    const meio = (p: Ponto2D, q: Ponto2D): Ponto2D => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
    const centro = { x: (a.x + b.x + c.x) / 3, y: (a.y + b.y + c.y) / 3 };
    if (!dentroDoPoligono(centro, contorno)) continue;
    if (![meio(a, b), meio(b, c), meio(c, a)].every((m) => dentroDoPoligono(m, contorno) || Math.min(...contorno.map((_, i) => distanciaAoSegmento(m, contorno[i]!, contorno[(i + 1) % n]!))) < 1e-6)) continue;
    // Todos no mesmo sentido (anti-horário nas coordenadas da peça).
    if (area > 0) tri.push(todos[k]!, todos[k + 1]!, todos[k + 2]!);
    else tri.push(todos[k]!, todos[k + 2]!, todos[k + 1]!);
  }
  const triangulos = Uint32Array.from(tri);
  // As arestas e as dobras (os dois opostos de cada aresta interna).
  const opostos = new Map<string, number[]>();
  const areas = new Float64Array(triangulos.length / 3);
  for (let k = 0; k < triangulos.length; k += 3) {
    const i = triangulos[k]!;
    const j = triangulos[k + 1]!;
    const l = triangulos[k + 2]!;
    const a = ponto(i);
    const b = ponto(j);
    const c = ponto(l);
    areas[k / 3] = Math.abs((b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)) / 2;
    for (const [u, v, o] of [
      [i, j, l],
      [j, l, i],
      [l, i, j],
    ] as const) {
      const chave = u < v ? `${u},${v}` : `${v},${u}`;
      const lista = opostos.get(chave);
      if (lista) lista.push(o);
      else opostos.set(chave, [o]);
    }
  }
  const arestas: number[] = [];
  const dobras: number[] = [];
  for (const [chave, lista] of opostos) {
    const [u, v] = chave.split(',').map(Number) as [number, number];
    arestas.push(u, v);
    if (lista.length === 2) dobras.push(lista[0]!, lista[1]!);
  }
  return { pontos, triangulos, borda, perimetro, bordaDoVertice, arestas: Uint32Array.from(arestas), dobras: Uint32Array.from(dobras), areas };
}

/**
 * O trecho da borda do ponto `de` ao ponto `ate` do contorno do molde (no sentido do contorno, dando a volta se
 * precisar): os pontos da malha e a fração (0 a 1) de cada um ao longo do trecho, e o comprimento (mm).
 */
export function trechoDaBorda(malha: MalhaDaPeca, de: number, ate: number): { readonly pontos: readonly number[]; readonly fracoes: readonly number[]; readonly comprimento: number } {
  const B = malha.borda.length;
  const i0 = malha.bordaDoVertice[de];
  const i1 = malha.bordaDoVertice[ate];
  if (i0 === undefined || i1 === undefined || B === 0) return { pontos: [], fracoes: [], comprimento: 0 };
  const passos = (i1 - i0 + B) % B;
  const pontos: number[] = [];
  const ss: number[] = [];
  let acumulado = 0;
  for (let k = 0; k <= passos; k++) {
    const idx = (i0 + k) % B;
    if (k > 0) {
      const anterior = (i0 + k - 1) % B;
      let ds = malha.borda[idx]!.s - malha.borda[anterior]!.s;
      if (ds < 0) ds += malha.perimetro;
      acumulado += ds;
    }
    pontos.push(malha.borda[idx]!.ponto);
    ss.push(acumulado);
  }
  const comprimento = acumulado;
  return { pontos, fracoes: ss.map((v) => (comprimento > 0 ? v / comprimento : 0)), comprimento };
}

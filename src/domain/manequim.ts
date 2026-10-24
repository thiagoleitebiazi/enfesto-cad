import type { FichaTecnica } from './fichaTecnica';
import type { RegrasDeCaimento } from './recomendacaoDeTamanho';
import { guiaDeMedidas } from './recomendacaoDeTamanho';

/**
 * O manequim do provador 3D (ADR 0111): um corpo feito pelas medidas — o tronco em seções elípticas empilhadas (do
 * gancho ao pescoço), os braços e as pernas em cones arredondados, a cabeça num elipsoide. Serve para duas coisas:
 * o desenho (a malha de triângulos) e a colisão do tecido (o ponto que entra no corpo é empurrado para fora, pela
 * normal da superfície). Em mm, com o y para cima, o chão em y = 0 e a frente do corpo para +z; o lado direito do
 * manequim fica em −x (quem olha de frente o vê à esquerda).
 */

export interface MedidasDoManequim {
  readonly alturaCm: number;
  readonly bustoCm: number;
  readonly cinturaCm: number;
  readonly quadrilCm: number;
  /** De uma ponta do ombro à outra, pelas costas. */
  readonly ombrosCm: number;
  readonly pescocoCm: number;
  /** A volta do braço (no alto). */
  readonly bracoCm: number;
  /** Do ombro ao punho. */
  readonly comprimentoDoBracoCm: number;
  /** Do gancho ao chão. */
  readonly entrepernaCm: number;
  /** A volta da coxa (no alto). */
  readonly coxaCm: number;
}

export type PublicoDoManequim = 'feminino' | 'masculino' | 'infantil';

export const ROTULO_DO_PUBLICO: Readonly<Record<PublicoDoManequim, string>> = {
  feminino: 'Feminino adulto',
  masculino: 'Masculino adulto',
  infantil: 'Infantil (8 anos)',
};

/** As medidas de partida de cada público (um tamanho médio). */
export const MEDIDAS_DO_PUBLICO: Readonly<Record<PublicoDoManequim, MedidasDoManequim>> = {
  feminino: { alturaCm: 165, bustoCm: 92, cinturaCm: 72, quadrilCm: 100, ombrosCm: 38, pescocoCm: 35, bracoCm: 28, comprimentoDoBracoCm: 58, entrepernaCm: 76, coxaCm: 56 },
  masculino: { alturaCm: 176, bustoCm: 100, cinturaCm: 86, quadrilCm: 100, ombrosCm: 45, pescocoCm: 39, bracoCm: 31, comprimentoDoBracoCm: 62, entrepernaCm: 80, coxaCm: 56 },
  infantil: { alturaCm: 128, bustoCm: 66, cinturaCm: 58, quadrilCm: 70, ombrosCm: 29, pescocoCm: 29, bracoCm: 20, comprimentoDoBracoCm: 42, entrepernaCm: 55, coxaCm: 40 },
};

export const ROTULO_DA_MEDIDA_DO_MANEQUIM: Readonly<Record<keyof MedidasDoManequim, string>> = {
  alturaCm: 'Altura',
  bustoCm: 'Busto (tórax)',
  cinturaCm: 'Cintura',
  quadrilCm: 'Quadril',
  ombrosCm: 'Ombro a ombro',
  pescocoCm: 'Pescoço',
  bracoCm: 'Braço (volta)',
  comprimentoDoBracoCm: 'Comprimento do braço',
  entrepernaCm: 'Entreperna',
  coxaCm: 'Coxa (volta)',
};

/** Os limites de cada medida (cm): fora deles o corpo deixa de ser um corpo. */
export const LIMITES_DA_MEDIDA: Readonly<Record<keyof MedidasDoManequim, readonly [number, number]>> = {
  alturaCm: [80, 210],
  bustoCm: [45, 160],
  cinturaCm: [40, 150],
  quadrilCm: [45, 170],
  ombrosCm: [20, 60],
  pescocoCm: [20, 55],
  bracoCm: [12, 50],
  comprimentoDoBracoCm: [25, 80],
  entrepernaCm: [30, 100],
  coxaCm: [25, 90],
};

/** As medidas dentro dos limites (o que passa fica no limite). */
export function medidasConferidas(m: MedidasDoManequim): MedidasDoManequim {
  const r = { ...m } as Record<keyof MedidasDoManequim, number>;
  for (const k of Object.keys(LIMITES_DA_MEDIDA) as (keyof MedidasDoManequim)[]) {
    const [min, max] = LIMITES_DA_MEDIDA[k];
    const v = Number.isFinite(r[k]) ? r[k] : MEDIDAS_DO_PUBLICO.feminino[k];
    r[k] = Math.min(max, Math.max(min, v));
  }
  // A entreperna não passa de metade da altura e pouco.
  r.entrepernaCm = Math.min(r.entrepernaCm, r.alturaCm * 0.52);
  return r;
}

const semAcento = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Qual medida do manequim um ponto de medida da ficha é (pelo nome); `null`: nenhuma. */
function medidaDoPonto(nome: string): keyof MedidasDoManequim | null {
  const n = semAcento(nome);
  if (/comprimento|manga|altura/.test(n)) return /entreperna/.test(n) ? 'entrepernaCm' : null;
  if (/busto|torax|peito/.test(n)) return 'bustoCm';
  if (/cintura/.test(n)) return 'cinturaCm';
  if (/quadril|bacia/.test(n)) return 'quadrilCm';
  if (/pescoco|colarinho/.test(n)) return 'pescocoCm';
  if (/biceps|braco/.test(n)) return 'bracoCm';
  if (/coxa/.test(n)) return 'coxaCm';
  if (/entreperna/.test(n)) return 'entrepernaCm';
  return null;
}

/**
 * O manequim no tamanho da ficha: as medidas do corpo de cada ponto usado na recomendação (a peça menos a folga,
 * como no guia de medidas) entram por cima das do público. Diz quais medidas vieram da ficha.
 */
export function manequimDoTamanho(
  base: MedidasDoManequim,
  ficha: Pick<FichaTecnica, 'medidas' | 'tamanhos'>,
  regras: RegrasDeCaimento,
  tamanho: string,
): { readonly medidas: MedidasDoManequim; readonly daFicha: readonly string[] } {
  const r = { ...base } as Record<keyof MedidasDoManequim, number>;
  const daFicha: string[] = [];
  for (const faixa of guiaDeMedidas(ficha, regras)) {
    const chave = medidaDoPonto(faixa.nome);
    const valor = faixa.porTamanho[tamanho];
    if (!chave || !valor) continue;
    r[chave] = Math.round(valor.idealCm * 10) / 10;
    daFicha.push(`${ROTULO_DA_MEDIDA_DO_MANEQUIM[chave]} (${faixa.nome})`);
  }
  return { medidas: medidasConferidas(r), daFicha };
}

// ---- O corpo (a geometria)

export interface Ponto3D {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Uma seção do tronco: a elipse na altura `y`, com a meia largura `a` (em x) e a meia profundidade `b` (em z). */
export interface SecaoDoTronco {
  readonly y: number;
  readonly a: number;
  readonly b: number;
}

/** Um cone arredondado (um braço, uma perna): do ponto `p0` (raio `r0`) ao `p1` (raio `r1`). */
export interface Capsula {
  readonly p0: Ponto3D;
  readonly p1: Ponto3D;
  readonly r0: number;
  readonly r1: number;
}

export interface CorpoDoManequim {
  readonly medidas: MedidasDoManequim;
  readonly alturaMm: number;
  /** De baixo para cima, do gancho ao alto do pescoço. */
  readonly tronco: readonly SecaoDoTronco[];
  readonly capsulas: readonly Capsula[];
  readonly cabeca: { readonly centro: Ponto3D; readonly raios: Ponto3D };
  /** As alturas de referência (mm), para pôr as peças. */
  readonly niveis: { readonly gancho: number; readonly quadril: number; readonly cintura: number; readonly busto: number; readonly ombro: number; readonly pescoco: number };
  /** Os braços (o direito em −x): o ombro, o cotovelo e o punho, e o raio no alto. */
  readonly bracos: { readonly direito: BracoOuPerna; readonly esquerdo: BracoOuPerna };
  readonly pernas: { readonly direita: BracoOuPerna; readonly esquerda: BracoOuPerna };
}

export interface BracoOuPerna {
  readonly inicio: Ponto3D;
  readonly meio: Ponto3D;
  readonly fim: Ponto3D;
  readonly raio: number;
}

/** O perímetro de uma elipse (Ramanujan). */
export function perimetroDaElipse(a: number, b: number): number {
  return Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
}

/** A elipse de perímetro `perimetro` e largura `k` vezes a profundidade. */
function elipse(perimetro: number, k: number): { a: number; b: number } {
  const b = perimetro / perimetroDaElipse(k, 1);
  return { a: k * b, b };
}

const p3 = (x: number, y: number, z: number): Ponto3D => ({ x, y, z });

/** Monta o corpo pelas medidas. */
export function corpoDoManequim(medidasDadas: MedidasDoManequim): CorpoDoManequim {
  const m = medidasConferidas(medidasDadas);
  const H = m.alturaCm * 10;
  const gancho = m.entrepernaCm * 10;
  const quadril = gancho + 0.06 * H;
  const cintura = Math.max(quadril + 0.05 * H, 0.625 * H);
  const busto = Math.max(cintura + 0.06 * H, 0.725 * H);
  const axila = busto + 0.03 * H;
  const ombro = axila + 0.06 * H;
  const pescoco = ombro + 0.025 * H;
  const pescocoAlto = pescoco + 0.035 * H;

  const sQuadril = elipse(m.quadrilCm * 10, 1.4);
  const sCintura = elipse(m.cinturaCm * 10, 1.38);
  const sBusto = elipse(m.bustoCm * 10, 1.3);
  const sAxila = elipse(m.bustoCm * 10 * 0.97, 1.45);
  const sPescoco = elipse(m.pescocoCm * 10, 1.1);
  const raioDoBraco = (m.bracoCm * 10) / (2 * Math.PI);
  const meioOmbro = (m.ombrosCm * 10) / 2;
  const aOmbro = Math.max(sAxila.a * 0.85, meioOmbro - raioDoBraco * 0.6);
  const tronco: SecaoDoTronco[] = [
    { y: gancho, a: sQuadril.a * 0.9, b: sQuadril.b * 0.92 },
    { y: quadril, ...sQuadril },
    { y: (quadril + cintura) / 2, a: (sQuadril.a + sCintura.a) / 2 * 1.02, b: (sQuadril.b + sCintura.b) / 2 * 1.02 },
    { y: cintura, ...sCintura },
    { y: (cintura + busto) / 2, a: (sCintura.a + sBusto.a) / 2, b: (sCintura.b + sBusto.b) / 2 },
    { y: busto, ...sBusto },
    { y: axila, ...sAxila },
    { y: ombro - 0.015 * H, a: aOmbro, b: sAxila.b * 0.85 },
    { y: ombro, a: aOmbro * 0.92, b: sAxila.b * 0.7 },
    { y: (ombro + pescoco) / 2, a: (aOmbro * 0.92 + sPescoco.a) / 2, b: (sAxila.b * 0.7 + sPescoco.b) / 2 },
    { y: pescoco, ...sPescoco },
    { y: pescocoAlto, a: sPescoco.a * 0.95, b: sPescoco.b * 0.95 },
  ];

  // Os braços, um pouco abertos (15°), saindo do ombro.
  const abertura = (15 * Math.PI) / 180;
  const braco = (lado: -1 | 1): BracoOuPerna => {
    const inicio = p3(lado * (meioOmbro - raioDoBraco * 0.75), ombro - raioDoBraco * 0.9, 0);
    const d = p3(lado * Math.sin(abertura), -Math.cos(abertura), 0);
    const L = m.comprimentoDoBracoCm * 10;
    const meio = p3(inicio.x + d.x * L * 0.55, inicio.y + d.y * L * 0.55, 0);
    const fim = p3(inicio.x + d.x * L, inicio.y + d.y * L, 0);
    return { inicio, meio, fim, raio: raioDoBraco };
  };
  const raioDaCoxa = (m.coxaCm * 10) / (2 * Math.PI);
  const perna = (lado: -1 | 1): BracoOuPerna => {
    const inicio = p3(lado * raioDaCoxa * 0.98, gancho + raioDaCoxa * 0.5, 0);
    const meio = p3(lado * (raioDaCoxa * 0.98 + 10), 0.285 * H, 0);
    const fim = p3(lado * (raioDaCoxa * 0.98 + 25), 0.045 * H, 0);
    return { inicio, meio, fim, raio: raioDaCoxa };
  };
  const bracos = { direito: braco(-1), esquerdo: braco(1) };
  const pernas = { direita: perna(-1), esquerda: perna(1) };
  const capsulas: Capsula[] = [];
  for (const b of [bracos.direito, bracos.esquerdo]) {
    capsulas.push({ p0: b.inicio, p1: b.meio, r0: b.raio, r1: b.raio * 0.78 });
    capsulas.push({ p0: b.meio, p1: b.fim, r0: b.raio * 0.78, r1: b.raio * 0.55 });
  }
  for (const p of [pernas.direita, pernas.esquerda]) {
    capsulas.push({ p0: p.inicio, p1: p.meio, r0: p.raio, r1: p.raio * 0.62 });
    capsulas.push({ p0: p.meio, p1: p.fim, r0: p.raio * 0.62, r1: p.raio * 0.4 });
  }
  const cabeca = { centro: p3(0, pescocoAlto + 0.06 * H, 0.008 * H), raios: p3(0.046 * H, 0.068 * H, 0.056 * H) };
  return {
    medidas: m,
    alturaMm: H,
    tronco,
    capsulas,
    cabeca,
    niveis: { gancho, quadril, cintura, busto, ombro, pescoco },
    bracos,
    pernas,
  };
}

/** A seção do tronco na altura `y` (por interpolação), com a variação de `a` e `b` por mm de altura; `null` fora do tronco. */
export function secaoNaAltura(corpo: CorpoDoManequim, y: number): { a: number; b: number; da: number; db: number } | null {
  const t = corpo.tronco;
  if (y < t[0]!.y || y > t[t.length - 1]!.y) return null;
  for (let i = 0; i < t.length - 1; i++) {
    const s0 = t[i]!;
    const s1 = t[i + 1]!;
    if (y <= s1.y) {
      const h = s1.y - s0.y;
      const f = h > 0 ? (y - s0.y) / h : 0;
      return { a: s0.a + (s1.a - s0.a) * f, b: s0.b + (s1.b - s0.b) * f, da: h > 0 ? (s1.a - s0.a) / h : 0, db: h > 0 ? (s1.b - s0.b) / h : 0 };
    }
  }
  return null;
}

/** A maior meia largura e a maior meia profundidade do tronco entre duas alturas (o que fica abaixo do gancho não conta). */
export function semiEixosMaximosDoTronco(corpo: CorpoDoManequim, y0: number, y1: number): { readonly a: number; readonly b: number } {
  let a = 0;
  let b = 0;
  const de = Math.max(Math.min(y0, y1), corpo.tronco[0]!.y);
  const ate = Math.min(Math.max(y0, y1), corpo.tronco[corpo.tronco.length - 1]!.y);
  for (let y = de; y <= ate; y += 10) {
    const s = secaoNaAltura(corpo, y);
    if (s) {
      a = Math.max(a, s.a);
      b = Math.max(b, s.b);
    }
  }
  for (const s of corpo.tronco) {
    if (s.y >= de && s.y <= ate) {
      a = Math.max(a, s.a);
      b = Math.max(b, s.b);
    }
  }
  if (a === 0) {
    // Todo abaixo do gancho (uma barra comprida): a seção de baixo do tronco.
    a = corpo.tronco[0]!.a;
    b = corpo.tronco[0]!.b;
  }
  return { a, b };
}

/** O maior raio do tronco (a meia largura ou a meia profundidade) entre duas alturas. */
export function raioMaximoDoTronco(corpo: CorpoDoManequim, y0: number, y1: number): number {
  let r = 0;
  const de = Math.min(y0, y1);
  const ate = Math.max(y0, y1);
  for (let y = de; y <= ate; y += 10) {
    const s = secaoNaAltura(corpo, y);
    if (s) r = Math.max(r, s.a, s.b);
  }
  for (const s of corpo.tronco) if (s.y >= de && s.y <= ate) r = Math.max(r, s.a, s.b);
  return r;
}

/**
 * A distância (aproximada) do ponto à superfície do corpo, com a normal para fora: negativa dentro do corpo. Vale o
 * pedaço do corpo em que o ponto mais entra (o tronco, um braço, uma perna, a cabeça).
 */
export function distanciaAoCorpo(corpo: CorpoDoManequim, x: number, y: number, z: number): { d: number; nx: number; ny: number; nz: number } {
  let melhor = { d: Infinity, nx: 0, ny: 1, nz: 0 };
  // O tronco: a elipse da altura; a normal pelo gradiente de (x/a)² + (z/b)², com a inclinação das seções.
  const s = secaoNaAltura(corpo, y);
  if (s) {
    const r = Math.sqrt((x / s.a) ** 2 + (z / s.b) ** 2);
    const raio = Math.hypot(x, z);
    const d = r > 1e-9 ? raio * (1 - 1 / r) : -Math.min(s.a, s.b);
    let gx = (2 * x) / (s.a * s.a);
    let gz = (2 * z) / (s.b * s.b);
    let gy = (-2 * x * x * s.da) / (s.a * s.a * s.a) - (2 * z * z * s.db) / (s.b * s.b * s.b);
    const g = Math.hypot(gx, gy, gz);
    if (g > 1e-12) {
      gx /= g;
      gy /= g;
      gz /= g;
    } else {
      gx = 0;
      gy = 0;
      gz = 1;
    }
    melhor = { d, nx: gx, ny: gy, nz: gz };
  }
  for (const c of corpo.capsulas) {
    const dx = c.p1.x - c.p0.x;
    const dy = c.p1.y - c.p0.y;
    const dz = c.p1.z - c.p0.z;
    const L2 = dx * dx + dy * dy + dz * dz;
    const t = L2 > 0 ? Math.min(1, Math.max(0, ((x - c.p0.x) * dx + (y - c.p0.y) * dy + (z - c.p0.z) * dz) / L2)) : 0;
    const cx = c.p0.x + dx * t;
    const cy = c.p0.y + dy * t;
    const cz = c.p0.z + dz * t;
    const ex = x - cx;
    const ey = y - cy;
    const ez = z - cz;
    const e = Math.hypot(ex, ey, ez);
    const d = e - (c.r0 + (c.r1 - c.r0) * t);
    if (d < melhor.d) melhor = e > 1e-9 ? { d, nx: ex / e, ny: ey / e, nz: ez / e } : { d, nx: 0, ny: 0, nz: 1 };
  }
  {
    const { centro: c, raios: R } = corpo.cabeca;
    const ex = x - c.x;
    const ey = y - c.y;
    const ez = z - c.z;
    const r = Math.sqrt((ex / R.x) ** 2 + (ey / R.y) ** 2 + (ez / R.z) ** 2);
    const e = Math.hypot(ex, ey, ez);
    const d = r > 1e-9 ? e * (1 - 1 / r) : -R.x;
    if (d < melhor.d) {
      let gx = ex / (R.x * R.x);
      let gy = ey / (R.y * R.y);
      let gz = ez / (R.z * R.z);
      const g = Math.hypot(gx, gy, gz) || 1;
      gx /= g;
      gy /= g;
      gz /= g;
      melhor = { d, nx: gx, ny: gy, nz: gz };
    }
  }
  return melhor;
}

// ---- A malha (para o desenho)

export interface MalhaDoCorpo {
  /** Os vértices em x, y, z seguidos. */
  readonly vertices: Float64Array;
  /** Os triângulos (três índices cada), com a frente para fora. */
  readonly triangulos: Uint32Array;
}

/** A malha de triângulos do corpo, para o desenho (`lados` pontos em cada anel). */
export function malhaDoCorpo(corpo: CorpoDoManequim, lados = 40): MalhaDoCorpo {
  const v: number[] = [];
  const t: number[] = [];
  const anel = (pontos: Ponto3D[]): number => {
    const inicio = v.length / 3;
    for (const p of pontos) v.push(p.x, p.y, p.z);
    return inicio;
  };
  /** Liga dois anéis (de `n` pontos cada) com a frente para fora. */
  const ligar = (a: number, b: number, n: number): void => {
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      t.push(a + i, b + i, b + j, a + i, b + j, a + j);
    }
  };
  /** Fecha um anel num ponto (a tampa). */
  const tampar = (a: number, n: number, centro: Ponto3D, paraCima: boolean): void => {
    const c = anel([centro]);
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      if (paraCima) t.push(a + i, c, a + j);
      else t.push(a + i, a + j, c);
    }
  };
  // O tronco: anéis nas seções e entre elas.
  const ys: number[] = [];
  for (let i = 0; i < corpo.tronco.length - 1; i++) {
    const s0 = corpo.tronco[i]!;
    const s1 = corpo.tronco[i + 1]!;
    const partes = Math.max(3, Math.ceil((s1.y - s0.y) / 22));
    for (let k = 0; k < partes; k++) ys.push(s0.y + ((s1.y - s0.y) * k) / partes);
  }
  ys.push(corpo.tronco[corpo.tronco.length - 1]!.y);
  let anterior = -1;
  let primeiro = -1;
  for (const y of ys) {
    const s = secaoNaAltura(corpo, y)!;
    const pontos: Ponto3D[] = [];
    // Em volta, de +z (a frente) para +x: o sentido que deixa a frente dos triângulos para fora.
    for (let i = 0; i < lados; i++) {
      const f = (2 * Math.PI * i) / lados;
      pontos.push(p3(s.a * Math.sin(f), y, s.b * Math.cos(f)));
    }
    const atual = anel(pontos);
    if (anterior >= 0) ligar(atual, anterior, lados);
    else primeiro = atual;
    anterior = atual;
  }
  tampar(primeiro, lados, p3(0, ys[0]!, 0), true);
  // Os braços e as pernas: tubos com as pontas fechadas.
  const n = Math.max(10, Math.round(lados / 2));
  for (const c of corpo.capsulas) {
    const dx = c.p1.x - c.p0.x;
    const dy = c.p1.y - c.p0.y;
    const dz = c.p1.z - c.p0.z;
    const L = Math.hypot(dx, dy, dz) || 1;
    const d = p3(dx / L, dy / L, dz / L);
    // Dois vetores perpendiculares ao eixo.
    const ref = Math.abs(d.z) < 0.9 ? p3(0, 0, 1) : p3(1, 0, 0);
    let ux = d.y * ref.z - d.z * ref.y;
    let uy = d.z * ref.x - d.x * ref.z;
    let uz = d.x * ref.y - d.y * ref.x;
    const ul = Math.hypot(ux, uy, uz) || 1;
    ux /= ul;
    uy /= ul;
    uz /= ul;
    const wx = d.y * uz - d.z * uy;
    const wy = d.z * ux - d.x * uz;
    const wz = d.x * uy - d.y * ux;
    const roda = (centro: Ponto3D, r: number): Ponto3D[] => {
      const ps: Ponto3D[] = [];
      for (let i = 0; i < n; i++) {
        const f = (2 * Math.PI * i) / n;
        ps.push(p3(centro.x + r * (Math.cos(f) * ux + Math.sin(f) * wx), centro.y + r * (Math.cos(f) * uy + Math.sin(f) * wy), centro.z + r * (Math.cos(f) * uz + Math.sin(f) * wz)));
      }
      return ps;
    };
    const aneis: number[] = [];
    for (let k = 0; k <= 8; k++) {
      const f = k / 8;
      aneis.push(anel(roda(p3(c.p0.x + dx * f, c.p0.y + dy * f, c.p0.z + dz * f), c.r0 + (c.r1 - c.r0) * f)));
    }
    for (let k = 0; k < aneis.length - 1; k++) ligar(aneis[k + 1]!, aneis[k]!, n);
    tampar(aneis[0]!, n, p3(c.p0.x - d.x * c.r0 * 0.6, c.p0.y - d.y * c.r0 * 0.6, c.p0.z - d.z * c.r0 * 0.6), true);
    tampar(aneis[aneis.length - 1]!, n, p3(c.p1.x + d.x * c.r1 * 0.6, c.p1.y + d.y * c.r1 * 0.6, c.p1.z + d.z * c.r1 * 0.6), false);
  }
  // A cabeça: uma esfera achatada.
  {
    const { centro: c, raios: R } = corpo.cabeca;
    const faixas = 14;
    const aneis: number[] = [];
    for (let k = 1; k < faixas; k++) {
      const fi = (Math.PI * k) / faixas;
      const pontos: Ponto3D[] = [];
      for (let i = 0; i < lados; i++) {
        const f = (2 * Math.PI * i) / lados;
        pontos.push(p3(c.x + R.x * Math.sin(fi) * Math.sin(f), c.y + R.y * Math.cos(fi), c.z + R.z * Math.sin(fi) * Math.cos(f)));
      }
      aneis.push(anel(pontos));
    }
    for (let k = 0; k < aneis.length - 1; k++) ligar(aneis[k]!, aneis[k + 1]!, lados);
    tampar(aneis[0]!, lados, p3(c.x, c.y + R.y, c.z), false);
    tampar(aneis[aneis.length - 1]!, lados, p3(c.x, c.y - R.y, c.z), true);
  }
  return { vertices: Float64Array.from(v), triangulos: Uint32Array.from(t) };
}

/*
 * O estúdio do provador 3D (ADR 0228): a imagem calculada ponto a ponto pelo processador, como uma foto de catálogo.
 * O programa abre sem a placa de vídeo no Windows (ADR 0083), então nada aqui depende dela: é TypeScript puro, sem
 * DOM, e roda na janela, num Worker e nos testes.
 *
 * Cada ponto da imagem acha o triângulo mais perto (com o z-buffer) e calcula a luz ali, com a normal suave:
 * - a luz principal, com sombra suave (um mapa de sombra da luz, com a penumbra que cresce com a distância);
 * - a luz de preenchimento e duas de recorte, atrás, que separam a roupa do fundo;
 * - a luz ambiente, escurecida nas dobras (a oclusão, medida na profundidade da própria imagem);
 * - o tecido: fosco de verdade (Oren-Nayar), com a penugem que clareia na borda, o reflexo que estica no fio do cetim, a
 *   luz que atravessa o pano fino, e a trama, que aparece de perto.
 * As cores saem pelo mapa de tons neutro: a cor escolhida para o tecido continua sendo ela.
 */

import type { TramaDoTecido } from '../domain/montagem3d';

export type { TramaDoTecido };

export type Rgb = readonly [number, number, number];

export interface Vetor {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** A imagem da estampa pela face da peça: corrida (repete, com a largura em mm) ou localizada (uma vez). */
export interface EstampaDoEstudio {
  readonly largura: number;
  readonly altura: number;
  readonly rgba: Uint8ClampedArray;
  readonly larguraMm: number;
  readonly modo: 'corrida' | 'localizada';
  /** Na localizada: o centro da imagem na vertical da face (mm). */
  readonly alturaMm: number;
}

export interface MaterialDoEstudio {
  readonly acabamento: 'corpo' | 'tecido' | 'ziper' | 'botao';
  readonly cor: Rgb;
  /** De 0 (fosco) a 1 (cetim). */
  readonly brilho?: number;
  /** De 0 (opaco) a 1: a parte da luz que passa. */
  readonly transparencia?: number;
  readonly trama?: TramaDoTecido;
  readonly estampa?: EstampaDoEstudio;
  /** A peça espelhada (a do par): a face dela fica do outro lado dos triângulos. */
  readonly espelhada?: boolean;
}

export interface LoteDoEstudio {
  readonly posicoes: Float32Array;
  readonly normais: Float32Array;
  /** As coordenadas da face (mm), u e v seguidos. */
  readonly uv?: Float32Array;
  readonly indices: Uint32Array;
  readonly material: MaterialDoEstudio;
  /** A cor de cada triângulo (r, g, b seguidos), no lugar da do material: o mapa de tensão, que não leva brilho. */
  readonly coresDosTriangulos?: Uint8Array;
}

export interface VistaDoEstudio {
  readonly largura: number;
  readonly altura: number;
  readonly posicao: Vetor;
  readonly frente: Vetor;
  readonly direita: Vetor;
  readonly alto: Vetor;
  readonly foco: number;
  /** A altura da cena (mm): é o que a sombra precisa cobrir. */
  readonly alturaDaCena: number;
}

export interface QualidadeDoEstudio {
  /** Quantos pontos por lado em cada pixel: 2 faz a média de quatro. */
  readonly superamostragem: number;
  readonly sombraPx: number;
  readonly amostrasDeSombra: number;
  readonly amostrasDeOclusao: number;
}

export const QUALIDADE_RAPIDA: QualidadeDoEstudio = { superamostragem: 1, sombraPx: 512, amostrasDeSombra: 4, amostrasDeOclusao: 0 };
export const QUALIDADE_FINAL: QualidadeDoEstudio = { superamostragem: 2, sombraPx: 1536, amostrasDeSombra: 12, amostrasDeOclusao: 10 };

export type FundoDoEstudio = 'estudio' | 'branco';

const TAMANHO_DA_LUZ = 0.13;
const OFUSCADO = 1e-6;
const DOIS_PI = 2 * Math.PI;
const AUREO = 2.399963229728653;

export interface LuzDoEstudio {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** A luz que chega numa face de frente para ela (1 é a luz cheia). */
  readonly forca: number;
  readonly cor: Rgb;
}

const normalizado = (x: number, y: number, z: number): [number, number, number] => {
  const l = Math.hypot(x, y, z) || 1;
  return [x / l, y / l, z / l];
};

/** As luzes giram com a câmera, como um manequim numa base giratória dentro do estúdio. */
export function luzesDoEstudio(v: VistaDoEstudio): readonly LuzDoEstudio[] {
  const emVolta = (d: number, a: number, f: number, forca: number, cor: Rgb): LuzDoEstudio => {
    const [x, y, z] = normalizado(
      d * v.direita.x + a * v.alto.x - f * v.frente.x,
      d * v.direita.y + a * v.alto.y - f * v.frente.y,
      d * v.direita.z + a * v.alto.z - f * v.frente.z,
    );
    return { x, y, z, forca, cor };
  };
  return [
    emVolta(0.74, 0.66, 0.5, 1.06, [1, 0.97, 0.93]),
    emVolta(-0.8, 0.1, 0.56, 0.22, [0.92, 0.96, 1]),
    emVolta(0.86, 0.3, -0.52, 0.42, [1, 1, 1]),
    emVolta(-0.86, 0.3, -0.52, 0.42, [1, 1, 1]),
  ];
}

// ---- O ruído do tecido (os fios irregulares): uma tabela fixa, a mesma em toda imagem.

const LADO_DO_RUIDO = 256;
const tabelaDoRuido = ((): Float32Array => {
  const t = new Float32Array(LADO_DO_RUIDO * LADO_DO_RUIDO);
  let s = 0x2f6e2b1;
  for (let i = 0; i < t.length; i++) {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    t[i] = (s >>> 0) / 4294967296;
  }
  return t;
})();

function ruido(x: number, y: number): number {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const M = LADO_DO_RUIDO - 1;
  const x0 = ix & M;
  const y0 = iy & M;
  const x1 = (x0 + 1) & M;
  const y1 = (y0 + 1) & M;
  const a = tabelaDoRuido[y0 * LADO_DO_RUIDO + x0]!;
  const b = tabelaDoRuido[y0 * LADO_DO_RUIDO + x1]!;
  const c = tabelaDoRuido[y1 * LADO_DO_RUIDO + x0]!;
  const d = tabelaDoRuido[y1 * LADO_DO_RUIDO + x1]!;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** O que cada tecido tem de próprio na luz. */
interface LuzDaTrama {
  /** A penugem que clareia na borda (0 a 1) e a largura dela. */
  readonly penugem: number;
  readonly larguraDaPenugem: number;
  /** O reflexo mais estreito na direção do fio (o cetim). */
  readonly anisotropia: number;
  /** A luz de trás que atravessa o pano fino. */
  readonly translucidez: number;
  /** O passo da trama (mm): abaixo dele, ela some na média. */
  readonly passo: number;
}

const LUZ_DA_TRAMA: Readonly<Record<TramaDoTecido, LuzDaTrama>> = {
  plana: { penugem: 0.22, larguraDaPenugem: 0.42, anisotropia: 0, translucidez: 0.22, passo: 0.7 },
  sarja: { penugem: 0.28, larguraDaPenugem: 0.45, anisotropia: 0, translucidez: 0.04, passo: 1.6 },
  malha: { penugem: 0.42, larguraDaPenugem: 0.46, anisotropia: 0, translucidez: 0.16, passo: 1.1 },
  cetim: { penugem: 0.1, larguraDaPenugem: 0.3, anisotropia: 0.75, translucidez: 0.28, passo: 0.45 },
  felpa: { penugem: 0.85, larguraDaPenugem: 0.55, anisotropia: 0, translucidez: 0.03, passo: 1.4 },
  linho: { penugem: 0.2, larguraDaPenugem: 0.4, anisotropia: 0, translucidez: 0.2, passo: 1 },
};

const enfraquece = (passo: number, pe: number): number => {
  const k = 1 - pe / (0.7 * passo);
  return k > 0 ? k : 0;
};

/** A trama: quanto ela inclina a normal na direção u e v, e quanto clareia ou escurece o fio. */
function trama(tipo: TramaDoTecido, u: number, v: number, pe: number, saida: Float64Array): void {
  let mu = 0;
  let mv = 0;
  let fator = 1;
  const passo = LUZ_DA_TRAMA[tipo].passo;
  const forca = enfraquece(passo, pe);
  const k = DOIS_PI / passo;
  switch (tipo) {
    case 'plana':
      fator += 0.03 * (ruido(u / 9, v / 9) - 0.5) + 0.03 * (ruido(u / 1.6, v / 30) - 0.5);
      if (forca > 0) {
        const su = Math.sin(k * u);
        const sv = Math.sin(k * v);
        mu = 0.32 * forca * Math.cos(k * u) * sv;
        mv = 0.32 * forca * su * Math.cos(k * v);
        fator += 0.1 * forca * su * sv;
      }
      break;
    case 'sarja':
      // O jeans: o fio branco da trama aparece em riscos ao longo do fio; a diagonal, de perto.
      fator += 0.2 * (ruido(u / 1.8, v / 70) - 0.5) + 0.1 * (ruido(u / 14, v / 22) - 0.5);
      if (forca > 0) {
        const d = k * (u + v);
        mu = 0.5 * forca * Math.cos(d);
        mv = mu;
        fator += 0.22 * forca * Math.sin(d);
      }
      break;
    case 'malha':
      fator += 0.03 * (ruido(u / 7, v / 7) - 0.5);
      if (forca > 0) {
        const su = Math.sin(k * u);
        const sv = Math.sin(k * v * 0.8 + 1.6 * Math.abs(su));
        mu = 0.42 * forca * Math.cos(k * u);
        mv = 0.3 * forca * Math.cos(k * v * 0.8);
        fator += 0.12 * forca * su * sv;
      }
      break;
    case 'cetim':
      if (forca > 0) mu = 0.08 * forca * Math.sin(k * u);
      fator += 0.012 * (ruido(u / 4, v / 120) - 0.5);
      break;
    case 'felpa':
      fator += 0.05 * (ruido(u / 3, v / 3) - 0.5) + 0.04 * (ruido(u / 16, v / 16) - 0.5);
      if (forca > 0) {
        mu = 0.5 * forca * (ruido(u * 1.3, v * 1.3) - 0.5);
        mv = 0.5 * forca * (ruido(u * 1.3 + 40, v * 1.3 + 90) - 0.5);
      }
      break;
    case 'linho':
      // Os fios grossos e irregulares do linho: riscos curtos nos dois sentidos.
      fator += 0.09 * (ruido(u / 1.4, v / 40) - 0.5) + 0.09 * (ruido(u / 40, v / 1.4) - 0.5) + 0.04 * (ruido(u / 20, v / 20) - 0.5);
      if (forca > 0) {
        const su = Math.sin(k * u + 2 * ruido(u / 30, v / 6));
        const sv = Math.sin(k * v + 2 * ruido(u / 6, v / 30));
        mu = 0.35 * forca * su;
        mv = 0.35 * forca * sv;
        fator += 0.1 * forca * su * sv;
      }
      break;
  }
  saida[0] = mu;
  saida[1] = mv;
  saida[2] = fator;
}

// ---- As cores

const paraLinear = (c: number): number => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};
const LINEAR_DE_8_BITS = Float32Array.from({ length: 256 }, (_, i) => paraLinear(i));
const LADO_DA_CURVA = 4096;
/** Da luz (0 a 1) ao número do pixel, de 0 a 255. */
const CURVA_DE_SAIDA = Float32Array.from({ length: LADO_DA_CURVA + 1 }, (_, i) => {
  const l = i / LADO_DA_CURVA;
  return 255 * (l <= 0.0031308 ? 12.92 * l : 1.055 * l ** (1 / 2.4) - 0.055);
});

/**
 * O mapa de tons neutro (o do Khronos para produtos): a cor do tecido sai como foi escolhida, e só o que passa do
 * branco é comprimido, indo para o branco sem mudar de matiz.
 */
function mapaDeTons(cor: Float64Array): void {
  let r = cor[0]!;
  let g = cor[1]!;
  let b = cor[2]!;
  const inicio = 0.76;
  const x = Math.min(r, g, b);
  const desconto = x < 0.08 ? x - 6.25 * x * x : 0.04;
  r -= desconto;
  g -= desconto;
  b -= desconto;
  const pico = Math.max(r, g, b);
  if (pico > inicio) {
    const d = 1 - inicio;
    const novo = 1 - (d * d) / (pico + d - inicio);
    const k = novo / pico;
    const m = 1 - 1 / (0.15 * (pico - novo) + 1);
    r = r * k * (1 - m) + novo * m;
    g = g * k * (1 - m) + novo * m;
    b = b * k * (1 - m) + novo * m;
  }
  cor[0] = r;
  cor[1] = g;
  cor[2] = b;
}

const paraSaida = (l: number): number => CURVA_DE_SAIDA[l <= 0 ? 0 : l >= 1 ? LADO_DA_CURVA : Math.round(l * LADO_DA_CURVA)]!;

/** A imagem da estampa em escadas de resolução, para não piscar quando vista de longe. */
interface ImagemDaEstampa {
  readonly niveis: readonly { readonly w: number; readonly h: number; readonly d: Float32Array }[];
  readonly mmPorPixel: number;
  readonly corrida: boolean;
  readonly deslocaU: number;
  readonly deslocaV: number;
}

function imagemDaEstampa(e: EstampaDoEstudio): ImagemDaEstampa {
  const base = new Float32Array(e.largura * e.altura * 4);
  for (let i = 0; i < e.largura * e.altura; i++) {
    const a = e.rgba[4 * i + 3]! / 255;
    base[4 * i] = LINEAR_DE_8_BITS[e.rgba[4 * i]!]! * a;
    base[4 * i + 1] = LINEAR_DE_8_BITS[e.rgba[4 * i + 1]!]! * a;
    base[4 * i + 2] = LINEAR_DE_8_BITS[e.rgba[4 * i + 2]!]! * a;
    base[4 * i + 3] = a;
  }
  const niveis = [{ w: e.largura, h: e.altura, d: base }];
  while (niveis[niveis.length - 1]!.w > 1 && niveis[niveis.length - 1]!.h > 1 && niveis.length < 8) {
    const n = niveis[niveis.length - 1]!;
    const w = Math.max(1, n.w >> 1);
    const h = Math.max(1, n.h >> 1);
    const d = new Float32Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (let c = 0; c < 4; c++) {
          const x1 = Math.min(n.w - 1, 2 * x + 1);
          const y1 = Math.min(n.h - 1, 2 * y + 1);
          d[4 * (y * w + x) + c] =
            (n.d[4 * (2 * y * n.w + 2 * x) + c]! + n.d[4 * (2 * y * n.w + x1) + c]! + n.d[4 * (y1 * n.w + 2 * x) + c]! + n.d[4 * (y1 * n.w + x1) + c]!) / 4;
        }
      }
    }
    niveis.push({ w, h, d });
  }
  const s = e.larguraMm / e.largura;
  const corrida = e.modo === 'corrida';
  return { niveis, mmPorPixel: s, corrida, deslocaU: corrida ? 0 : (-s * e.largura) / 2, deslocaV: corrida ? 0 : e.alturaMm + (s * e.altura) / 2 };
}

/** A cor da estampa no ponto (u, v) da face, em `saida` (r, g, b já pesados pelo alfa, e o alfa). */
function corDaEstampa(img: ImagemDaEstampa, u: number, v: number, pe: number, saida: Float64Array): void {
  const nivelReal = Math.log2(Math.max(1, pe / img.mmPorPixel));
  const n = img.niveis[Math.min(img.niveis.length - 1, Math.round(nivelReal))]!;
  const escala = img.niveis[0]!.w / n.w;
  const px = (u - img.deslocaU) / (img.mmPorPixel * escala) - 0.5;
  const py = (img.deslocaV - v) / (img.mmPorPixel * escala) - 0.5;
  let x0 = Math.floor(px);
  let y0 = Math.floor(py);
  const fx = px - x0;
  const fy = py - y0;
  let x1 = x0 + 1;
  let y1 = y0 + 1;
  if (img.corrida) {
    x0 = ((x0 % n.w) + n.w) % n.w;
    y0 = ((y0 % n.h) + n.h) % n.h;
    x1 = ((x1 % n.w) + n.w) % n.w;
    y1 = ((y1 % n.h) + n.h) % n.h;
  } else if (x1 < 0 || y1 < 0 || x0 >= n.w || y0 >= n.h) {
    saida.fill(0);
    return;
  }
  const le = (x: number, y: number, c: number): number => (x < 0 || y < 0 || x >= n.w || y >= n.h ? 0 : n.d[4 * (y * n.w + x) + c]!);
  for (let c = 0; c < 4; c++) {
    const a = le(x0, y0, c);
    const b = le(x1, y0, c);
    const d = le(x0, y1, c);
    const e = le(x1, y1, c);
    saida[c] = a + (b - a) * fx + (d - a) * fy + (a - b - d + e) * fx * fy;
  }
}

// ---- A profundidade: o que cada ponto da imagem vê

interface Vista {
  readonly W: number;
  readonly H: number;
  readonly inversoZ: Float32Array;
  readonly ids: Int32Array;
  readonly l1: Float32Array;
  readonly l2: Float32Array;
}

const vistaVazia = (W: number, H: number): Vista => ({
  W,
  H,
  inversoZ: new Float32Array(W * H),
  ids: new Int32Array(W * H).fill(-1),
  l1: new Float32Array(W * H),
  l2: new Float32Array(W * H),
});

interface CenaAchatada {
  readonly P: Float32Array;
  readonly N: Float32Array;
  readonly UV: Float32Array;
  readonly I: Uint32Array;
  readonly loteDoTriangulo: Uint16Array;
  /** A direção do fio em cada triângulo (a de u), só onde há coordenadas da face. */
  readonly T: Float32Array;
  readonly cores: Uint8Array | null;
}

function achatar(lotes: readonly LoteDoEstudio[]): CenaAchatada {
  let nv = 0;
  let nt = 0;
  let comCores = false;
  for (const l of lotes) {
    nv += l.posicoes.length / 3;
    nt += l.indices.length / 3;
    if (l.coresDosTriangulos) comCores = true;
  }
  const P = new Float32Array(nv * 3);
  const N = new Float32Array(nv * 3);
  const UV = new Float32Array(nv * 2);
  const I = new Uint32Array(nt * 3);
  const loteDoTriangulo = new Uint16Array(nt);
  const T = new Float32Array(nt * 3);
  const cores = comCores ? new Uint8Array(nt * 3) : null;
  let dv = 0;
  let dt = 0;
  lotes.forEach((l, q) => {
    P.set(l.posicoes, dv * 3);
    N.set(l.normais, dv * 3);
    if (l.uv) UV.set(l.uv, dv * 2);
    const n = l.indices.length / 3;
    for (let t = 0; t < n; t++) {
      const a = l.indices[3 * t]! + dv;
      const b = l.indices[3 * t + 1]! + dv;
      const c = l.indices[3 * t + 2]! + dv;
      const k = dt + t;
      I[3 * k] = a;
      I[3 * k + 1] = b;
      I[3 * k + 2] = c;
      loteDoTriangulo[k] = q;
      if (cores && l.coresDosTriangulos) {
        cores[3 * k] = l.coresDosTriangulos[3 * t]!;
        cores[3 * k + 1] = l.coresDosTriangulos[3 * t + 1]!;
        cores[3 * k + 2] = l.coresDosTriangulos[3 * t + 2]!;
      }
      if (l.uv) {
        const e1x = P[3 * b]! - P[3 * a]!;
        const e1y = P[3 * b + 1]! - P[3 * a + 1]!;
        const e1z = P[3 * b + 2]! - P[3 * a + 2]!;
        const e2x = P[3 * c]! - P[3 * a]!;
        const e2y = P[3 * c + 1]! - P[3 * a + 1]!;
        const e2z = P[3 * c + 2]! - P[3 * a + 2]!;
        const dv1 = UV[2 * b + 1]! - UV[2 * a + 1]!;
        const dv2 = UV[2 * c + 1]! - UV[2 * a + 1]!;
        const du1 = UV[2 * b]! - UV[2 * a]!;
        const du2 = UV[2 * c]! - UV[2 * a]!;
        const s = du1 * dv2 - du2 * dv1 < 0 ? -1 : 1;
        const [tx, ty, tz] = normalizado(s * (e1x * dv2 - e2x * dv1), s * (e1y * dv2 - e2y * dv1), s * (e1z * dv2 - e2z * dv1));
        T[3 * k] = tx;
        T[3 * k + 1] = ty;
        T[3 * k + 2] = tz;
      }
    }
    dv += l.posicoes.length / 3;
    dt += n;
  });
  return { P, N, UV, I, loteDoTriangulo, T, cores };
}

/** Marca em `alvo` os triângulos dados, do ponto de vista dado. `atras`: só o que fica atrás destas profundidades. */
function rasterizar(alvo: Vista, sx: Float32Array, sy: Float32Array, iz: Float32Array, I: Uint32Array, entra: (t: number) => boolean, soFrente: (t: number) => boolean, limite: Float32Array | null, atras: Float32Array | null): void {
  const { W, H, inversoZ, ids, l1, l2 } = alvo;
  const nt = I.length / 3;
  for (let t = 0; t < nt; t++) {
    if (!entra(t)) continue;
    const a = I[3 * t]!;
    const b = I[3 * t + 1]!;
    const c = I[3 * t + 2]!;
    const z0 = iz[a]!;
    const z1 = iz[b]!;
    const z2 = iz[c]!;
    if (z0 <= 0 || z1 <= 0 || z2 <= 0) continue;
    const x0 = sx[a]!;
    const y0 = sy[a]!;
    const x1 = sx[b]!;
    const y1 = sy[b]!;
    const x2 = sx[c]!;
    const y2 = sy[c]!;
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < OFUSCADO) continue;
    // Com o y da tela para baixo, a frente de um triângulo aparece com a área negativa.
    if (area > 0 && soFrente(t)) continue;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
    const maxY = Math.min(H - 1, Math.ceil(Math.max(y0, y1, y2)));
    if (minX > maxX || minY > maxY) continue;
    const inv = 1 / area;
    const a1 = (y2 - y0) * inv;
    const b1 = -(x2 - x0) * inv;
    const a2 = -(y1 - y0) * inv;
    const b2 = (x1 - x0) * inv;
    const dz = (z1 - z0) * a1 + (z2 - z0) * a2;
    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5 - y0;
      const px0 = minX + 0.5 - x0;
      let w1 = a1 * px0 + b1 * py;
      let w2 = a2 * px0 + b2 * py;
      let z = z0 + (z1 - z0) * w1 + (z2 - z0) * w2;
      let i = y * W + minX;
      for (let x = minX; x <= maxX; x++) {
        if (w1 >= 0 && w2 >= 0 && w1 + w2 <= 1 && z > inversoZ[i]! && (limite === null || z > limite[i]!) && (atras === null || z < atras[i]! - 1e-7)) {
          inversoZ[i] = z;
          ids[i] = t;
          l1[i] = w1;
          l2[i] = w2;
        }
        w1 += a1;
        w2 += a2;
        z += dz;
        i++;
      }
    }
  }
}

/** O mapa de sombra: o ponto de cada texel mais perto da luz. */
interface MapaDeSombra {
  readonly lado: number;
  readonly d: Float32Array;
  readonly ux: number;
  readonly uy: number;
  readonly uz: number;
  readonly vx: number;
  readonly vy: number;
  readonly vz: number;
  readonly lx: number;
  readonly ly: number;
  readonly lz: number;
  readonly centroU: number;
  readonly centroV: number;
  readonly porMm: number;
}

function mapaDeSombra(c: CenaAchatada, luz: LuzDoEstudio, lado: number, alturaDaCena: number): MapaDeSombra {
  const raio = alturaDaCena * 0.72;
  const [ux, uy, uz] = normalizado(luz.z, 0, -luz.x);
  const vx = luz.y * uz - luz.z * uy;
  const vy = luz.z * ux - luz.x * uz;
  const vz = luz.x * uy - luz.y * ux;
  const cy = alturaDaCena / 2;
  const centroU = cy * uy;
  const centroV = cy * vy;
  const porMm = lado / (2 * raio);
  const d = new Float32Array(lado * lado).fill(-1e9);
  const { P, I } = c;
  const nv = P.length / 3;
  const sx = new Float32Array(nv);
  const sy = new Float32Array(nv);
  const h = new Float32Array(nv);
  for (let i = 0; i < nv; i++) {
    const x = P[3 * i]!;
    const y = P[3 * i + 1]!;
    const z = P[3 * i + 2]!;
    sx[i] = (x * ux + y * uy + z * uz - centroU) * porMm + lado / 2;
    sy[i] = (x * vx + y * vy + z * vz - centroV) * porMm + lado / 2;
    h[i] = x * luz.x + y * luz.y + z * luz.z;
  }
  const nt = I.length / 3;
  for (let t = 0; t < nt; t++) {
    const a = I[3 * t]!;
    const b = I[3 * t + 1]!;
    const e = I[3 * t + 2]!;
    const x0 = sx[a]!;
    const y0 = sy[a]!;
    const x1 = sx[b]!;
    const y1 = sy[b]!;
    const x2 = sx[e]!;
    const y2 = sy[e]!;
    const area = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
    if (Math.abs(area) < OFUSCADO) continue;
    const minX = Math.max(0, Math.floor(Math.min(x0, x1, x2)));
    const maxX = Math.min(lado - 1, Math.ceil(Math.max(x0, x1, x2)));
    const minY = Math.max(0, Math.floor(Math.min(y0, y1, y2)));
    const maxY = Math.min(lado - 1, Math.ceil(Math.max(y0, y1, y2)));
    const inv = 1 / area;
    const a1 = (y2 - y0) * inv;
    const b1 = -(x2 - x0) * inv;
    const a2 = -(y1 - y0) * inv;
    const b2 = (x1 - x0) * inv;
    const h0 = h[a]!;
    const dh1 = h[b]! - h0;
    const dh2 = h[e]! - h0;
    for (let y = minY; y <= maxY; y++) {
      const py = y + 0.5 - y0;
      let i = y * lado + minX;
      for (let x = minX; x <= maxX; x++, i++) {
        const px = x + 0.5 - x0;
        const w1 = a1 * px + b1 * py;
        const w2 = a2 * px + b2 * py;
        if (w1 < 0 || w2 < 0 || w1 + w2 > 1) continue;
        const z = h0 + dh1 * w1 + dh2 * w2;
        if (z > d[i]!) d[i] = z;
      }
    }
  }
  return { lado, d, ux, uy, uz, vx, vy, vz, lx: luz.x, ly: luz.y, lz: luz.z, centroU, centroV, porMm };
}

/** Quanto da luz chega ao ponto (0 a 1): a penumbra cresce com a distância de quem faz a sombra, como numa luz grande. */
function luzQueChega(m: MapaDeSombra, x: number, y: number, z: number, giro: number, amostras: number): number {
  const s = (x * m.ux + y * m.uy + z * m.uz - m.centroU) * m.porMm + m.lado / 2;
  const t = (x * m.vx + y * m.vy + z * m.vz - m.centroV) * m.porMm + m.lado / 2;
  const h = x * m.lx + y * m.ly + z * m.lz;
  const { lado, d } = m;
  const le = (a: number, b: number): number => {
    const i = a | 0;
    const j = b | 0;
    return i < 0 || j < 0 || i >= lado || j >= lado ? -1e9 : d[j * lado + i]!;
  };
  const folga = 2.2;
  const procura = 26 * (lado / 1024);
  let soma = 0;
  let achados = 0;
  const giros = Math.max(4, amostras >> 1);
  for (let k = 0; k < giros; k++) {
    const a = giro + k * AUREO;
    const r = procura * Math.sqrt((k + 0.5) / giros);
    const v = le(s + Math.cos(a) * r, t + Math.sin(a) * r);
    if (v > h + folga) {
      soma += v - h;
      achados++;
    }
  }
  if (achados === 0) return 1;
  const meia = Math.max(1.1, Math.min(48 * (lado / 1024), (soma / achados) * TAMANHO_DA_LUZ * m.porMm));
  let passa = 0;
  for (let k = 0; k < amostras; k++) {
    const a = giro + 1.7 + k * AUREO;
    const r = meia * Math.sqrt((k + 0.5) / amostras);
    if (le(s + Math.cos(a) * r, t + Math.sin(a) * r) <= h + folga) passa++;
  }
  return passa / amostras;
}

/**
 * A claridade do chão (de 0 a 1) em volta dos pés: o que a luz principal deixa de alcançar, mais o escuro de contato, que
 * nasce do que está perto do chão — por isso os pés assentam nele e não flutuam.
 */
interface MapaDoChao {
  readonly lado: number;
  readonly claridade: Float32Array;
  readonly meiaLargura: number;
}

function mapaDoChao(c: CenaAchatada, sombra: MapaDeSombra, alturaDaCena: number, lado: number, amostras: number): MapaDoChao {
  const meiaLargura = alturaDaCena * 0.8;
  const passo = (2 * meiaLargura) / lado;
  // A altura mais baixa da cena sobre cada ponto do chão.
  const baixo = new Float32Array(lado * lado).fill(1e9);
  const { P } = c;
  for (let i = 0; i < P.length; i += 3) {
    const q = Math.floor((P[i]! + meiaLargura) / passo);
    const r = Math.floor((P[i + 2]! + meiaLargura) / passo);
    if (q < 0 || r < 0 || q >= lado || r >= lado) continue;
    if (P[i + 1]! < baixo[r * lado + q]!) baixo[r * lado + q] = P[i + 1]!;
  }
  const perto = new Float32Array(lado * lado);
  const largo = new Float32Array(lado * lado);
  for (let i = 0; i < baixo.length; i++) {
    const h = baixo[i]!;
    if (h > 1e8) continue;
    perto[i] = Math.exp(-h / 70);
    largo[i] = Math.exp(-h / 500);
  }
  const borrar = (m: Float32Array, raio: number): Float32Array => {
    let a = m;
    for (let volta = 0; volta < 3; volta++) {
      const b = new Float32Array(lado * lado);
      const k = 1 / (2 * raio + 1);
      for (let j = 0; j < lado; j++) {
        let s = 0;
        for (let i = -raio; i <= raio; i++) s += a[j * lado + Math.max(0, Math.min(lado - 1, i))]!;
        for (let i = 0; i < lado; i++) {
          b[j * lado + i] = s * k;
          s += a[j * lado + Math.min(lado - 1, i + raio + 1)]! - a[j * lado + Math.max(0, i - raio)]!;
        }
      }
      const e = new Float32Array(lado * lado);
      for (let i = 0; i < lado; i++) {
        let s = 0;
        for (let j = -raio; j <= raio; j++) s += b[Math.max(0, Math.min(lado - 1, j)) * lado + i]!;
        for (let j = 0; j < lado; j++) {
          e[j * lado + i] = s * k;
          s += b[Math.min(lado - 1, j + raio + 1) * lado + i]! - b[Math.max(0, j - raio) * lado + i]!;
        }
      }
      a = e;
    }
    return a;
  };
  const contato = borrar(perto, Math.max(1, Math.round(26 / passo)));
  const macio = borrar(largo, Math.max(2, Math.round(170 / passo)));
  const direta = new Float32Array(lado * lado);
  for (let r = 0; r < lado; r++) {
    for (let q = 0; q < lado; q++) {
      const x = (q + 0.5) * passo - meiaLargura;
      const z = (r + 0.5) * passo - meiaLargura;
      const giro = ((q * 12.9898 + r * 78.233) % 1) * DOIS_PI;
      direta[r * lado + q] = luzQueChega(sombra, x, 0.5, z, giro, amostras);
    }
  }
  // A luz grande não faz borda dura no chão: a sombra sai borrada, e mais fraca que a do corpo sobre ele mesmo.
  const suave = borrar(direta, Math.max(1, Math.round(16 / passo)));
  const claridade = new Float32Array(lado * lado);
  for (let i = 0; i < claridade.length; i++) {
    const ca = Math.min(1, 1.5 * contato[i]!);
    const ma = Math.min(1, 2.4 * macio[i]!);
    claridade[i] = (1 - 0.2 * (1 - suave[i]!)) * (1 - 0.46 * ca) * (1 - 0.26 * ma);
  }
  return { lado, claridade, meiaLargura };
}

function lerChao(m: MapaDoChao, x: number, z: number): number {
  const s = ((x + m.meiaLargura) / (2 * m.meiaLargura)) * m.lado - 0.5;
  const t = ((z + m.meiaLargura) / (2 * m.meiaLargura)) * m.lado - 0.5;
  if (s < 0 || t < 0 || s >= m.lado - 1 || t >= m.lado - 1) return 1;
  const i = s | 0;
  const j = t | 0;
  const fx = s - i;
  const fy = t - j;
  const c = m.claridade;
  const L = m.lado;
  const a = c[j * L + i]!;
  const b = c[j * L + i + 1]!;
  const d = c[(j + 1) * L + i]!;
  const e = c[(j + 1) * L + i + 1]!;
  return a + (b - a) * fx + (d - a) * fy + (a - b - d + e) * fx * fy;
}

const misturaSuave = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// Em cores da tela (0 a 1): o fundo não passa pelas luzes; o branco do fundo branco é branco.
const FUNDO_DA_PAREDE_ALTO = [0.875, 0.878, 0.885];
const FUNDO_DA_PAREDE_BAIXO = [0.792, 0.796, 0.805];
const FUNDO_DO_CHAO = [0.86, 0.862, 0.868];

/**
 * Quanto do pano cobre o que está atrás. Pouca transparência quase não aparece (a seda fina sobre o corpo continua sendo
 * pano); no máximo, guarda 15% da cor (o voal não some).
 */
export const opacidadeDoTecido = (transparencia: number): number => 1 - 0.85 * transparencia ** 1.6;

/** Calcula a imagem, em RGBA, com `v.largura` × `v.altura` pixels. */
export function renderizarEstudio(v: VistaDoEstudio, lotes: readonly LoteDoEstudio[], q: QualidadeDoEstudio, fundo: FundoDoEstudio = 'estudio'): Uint8ClampedArray {
  const ss = Math.max(1, Math.round(q.superamostragem));
  const W = v.largura * ss;
  const H = v.altura * ss;
  const foco = v.foco * ss;
  const cx = W / 2;
  const cy = H / 2;
  const c = achatar(lotes);
  const { P, N, UV, I, T, loteDoTriangulo } = c;
  const nv = P.length / 3;
  const { posicao: O, frente: F, direita: R, alto: U } = v;

  // A projeção de todos os pontos.
  const sx = new Float32Array(nv);
  const sy = new Float32Array(nv);
  const iz = new Float32Array(nv);
  for (let i = 0; i < nv; i++) {
    const dx = P[3 * i]! - O.x;
    const dy = P[3 * i + 1]! - O.y;
    const dz = P[3 * i + 2]! - O.z;
    const z = dx * F.x + dy * F.y + dz * F.z;
    if (z < 10) {
      iz[i] = 0;
      continue;
    }
    const k = foco / z;
    sx[i] = cx + (dx * R.x + dy * R.y + dz * R.z) * k;
    sy[i] = cy - (dx * U.x + dy * U.y + dz * U.z) * k;
    iz[i] = 1 / z;
  }

  const materiais = lotes.map((l) => l.material);
  const transparente = materiais.map((m) => (m.transparencia ?? 0) > 0);
  const temTransparente = transparente.some(Boolean);
  const fechado = materiais.map((m) => m.acabamento === 'corpo');
  const estampas = lotes.map((l) => (l.material.estampa ? imagemDaEstampa(l.material.estampa) : null));
  const albedos = materiais.map((m) => [LINEAR_DE_8_BITS[m.cor[0]]!, LINEAR_DE_8_BITS[m.cor[1]]!, LINEAR_DE_8_BITS[m.cor[2]]!] as const);

  const soFrente = (t: number): boolean => fechado[loteDoTriangulo[t]!]!;
  const opaca = vistaVazia(W, H);
  rasterizar(opaca, sx, sy, iz, I, (t) => !transparente[loteDoTriangulo[t]!], soFrente, null, null);
  // O tecido transparente: as duas camadas de pano mais perto (a da frente e a de trás da roupa), à frente do que é opaco.
  const camada1 = temTransparente ? vistaVazia(W, H) : null;
  const camada2 = temTransparente ? vistaVazia(W, H) : null;
  if (camada1 && camada2) {
    rasterizar(camada1, sx, sy, iz, I, (t) => transparente[loteDoTriangulo[t]!]!, soFrente, opaca.inversoZ, null);
    rasterizar(camada2, sx, sy, iz, I, (t) => transparente[loteDoTriangulo[t]!]!, soFrente, opaca.inversoZ, camada1.inversoZ);
  }

  const luzes = luzesDoEstudio(v);
  const principal = luzes[0]!;
  const sombra = mapaDeSombra(c, principal, q.sombraPx, v.alturaDaCena);
  const chao = mapaDoChao(c, sombra, v.alturaDaCena, q.sombraPx >= 1024 ? 256 : 128, Math.max(8, q.amostrasDeSombra));

  const cor = new Float64Array(3);
  const auxiliar = new Float64Array(4);
  const micro = new Float64Array(3);
  const zBuf = opaca.inversoZ;
  const nOclusao = q.amostrasDeOclusao;

  /** A oclusão no ponto da imagem: quanto da luz ambiente sobra (0 a 1). */
  const oclusao = (xs: number, ys: number, zv: number, xv: number, yv: number, nx: number, ny: number, nz: number, giro: number): number => {
    let soma = 0;
    for (let k = 0; k < nOclusao; k++) {
      const perto = k % 3 === 0;
      const raioMm = perto ? 16 : 90;
      const raio = (raioMm * foco) / zv;
      const a = giro + k * AUREO;
      const r = raio * Math.sqrt((k + 0.5) / nOclusao);
      const qx = (xs + Math.cos(a) * r) | 0;
      const qy = (ys + Math.sin(a) * r) | 0;
      if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
      const izq = zBuf[qy * W + qx]!;
      if (izq <= 0) continue;
      const zq = 1 / izq;
      const dx = ((qx + 0.5 - cx) * zq) / foco - xv;
      const dy = (-(qy + 0.5 - cy) * zq) / foco - yv;
      const dz = zq - zv;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < 1) continue;
      const d = Math.sqrt(d2);
      const coseno = (dx * nx + dy * ny + dz * nz) / d - 0.08;
      if (coseno > 0) soma += coseno / (1 + d2 / (raioMm * raioMm * 0.5));
    }
    return Math.max(0, 1 - (1.9 * soma) / nOclusao);
  };

  /** A luz no ponto (`amostra`, da vista dada) vai para `cor`, em luz linear; devolve a opacidade dele. */
  const sombrear = (vista: Vista, amostra: number, xp: number, yp: number, comOclusao: boolean): number => {
    const t = vista.ids[amostra]!;
    const lote = loteDoTriangulo[t]!;
    const m = materiais[lote]!;
    const a = I[3 * t]!;
    const b = I[3 * t + 1]!;
    const e = I[3 * t + 2]!;
    const w1 = vista.l1[amostra]!;
    const w2 = vista.l2[amostra]!;
    const z0 = iz[a]!;
    const z1 = iz[b]!;
    const z2 = iz[e]!;
    // Pesos com a perspectiva certa.
    const p0 = (1 - w1 - w2) * z0;
    const p1 = w1 * z1;
    const p2 = w2 * z2;
    const zInv = p0 + p1 + p2;
    const q0 = p0 / zInv;
    const q1 = p1 / zInv;
    const q2 = p2 / zInv;
    const px = q0 * P[3 * a]! + q1 * P[3 * b]! + q2 * P[3 * e]!;
    const py = q0 * P[3 * a + 1]! + q1 * P[3 * b + 1]! + q2 * P[3 * e + 1]!;
    const pz = q0 * P[3 * a + 2]! + q1 * P[3 * b + 2]! + q2 * P[3 * e + 2]!;
    let nx = q0 * N[3 * a]! + q1 * N[3 * b]! + q2 * N[3 * e]!;
    let ny = q0 * N[3 * a + 1]! + q1 * N[3 * b + 1]! + q2 * N[3 * e + 1]!;
    let nz = q0 * N[3 * a + 2]! + q1 * N[3 * b + 2]! + q2 * N[3 * e + 2]!;
    const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    let vx = O.x - px;
    let vy = O.y - py;
    let vz = O.z - pz;
    const dist = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1;
    vx /= dist;
    vy /= dist;
    vz /= dist;

    // De que lado do pano se está: pela ordem dos cantos na tela, porque na borda de uma dobra a normal suave engana.
    const ex1 = sx[b]! - sx[a]!;
    const ey1 = sy[b]! - sy[a]!;
    const ex2 = sx[e]! - sx[a]!;
    const ey2 = sy[e]! - sy[a]!;
    const deFrente = ex1 * ey2 - ex2 * ey1 <= 0;
    if (!deFrente) {
      nx = -nx;
      ny = -ny;
      nz = -nz;
    }
    const daFace = deFrente !== (m.espelhada === true);

    let ar = albedos[lote]![0];
    let ag = albedos[lote]![1];
    let ab = albedos[lote]![2];
    let especular = 0.04;
    const pe = dist / foco;
    let u = 0;
    let va = 0;
    let tx = 0;
    let ty = 0;
    let tz = 0;
    const tecido = m.acabamento === 'tecido';
    if (m.acabamento !== 'corpo') {
      u = q0 * UV[2 * a]! + q1 * UV[2 * b]! + q2 * UV[2 * e]!;
      va = q0 * UV[2 * a + 1]! + q1 * UV[2 * b + 1]! + q2 * UV[2 * e + 1]!;
      tx = T[3 * t]!;
      ty = T[3 * t + 1]!;
      tz = T[3 * t + 2]!;
      const dot = tx * nx + ty * ny + tz * nz;
      tx -= dot * nx;
      ty -= dot * ny;
      tz -= dot * nz;
      const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1;
      tx /= tl;
      ty /= tl;
      tz /= tl;
    }
    const pintado = c.cores !== null && lotes[lote]!.coresDosTriangulos !== undefined;
    if (pintado) {
      ar = LINEAR_DE_8_BITS[c.cores![3 * t]!]!;
      ag = LINEAR_DE_8_BITS[c.cores![3 * t + 1]!]!;
      ab = LINEAR_DE_8_BITS[c.cores![3 * t + 2]!]!;
    } else if (tecido) {
      const est = estampas[lote];
      if (est && daFace) {
        corDaEstampa(est, u, va, pe, auxiliar);
        const k = 1 - auxiliar[3]!;
        ar = ar * k + auxiliar[0]!;
        ag = ag * k + auxiliar[1]!;
        ab = ab * k + auxiliar[2]!;
      }
      if (m.trama) {
        trama(m.trama, u, va, pe, micro);
        const bx = ny * tz - nz * ty;
        const by = nz * tx - nx * tz;
        const bz = nx * ty - ny * tx;
        const mu = micro[0]!;
        const mv = micro[1]!;
        nx -= mu * tx + mv * bx;
        ny -= mu * ty + mv * by;
        nz -= mu * tz + mv * bz;
        const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        nx /= l;
        ny /= l;
        nz /= l;
        ar *= micro[2]!;
        ag *= micro[2]!;
        ab *= micro[2]!;
      }
      // O avesso do pano é um pouco mais apagado que a face.
      if (!daFace) {
        ar *= 0.8;
        ag *= 0.8;
        ab *= 0.8;
      }
    } else if (m.acabamento === 'ziper') {
      // A fita fosca dos lados e os dentes de metal no meio, um de cada lado a cada 2,4 mm.
      const dente = Math.abs(u) < 2.6 && (pe > 1.4 || Math.floor(va / 2.4) % 2 === 0);
      if (dente) {
        const f = pe > 1.4 ? 0.45 : 0.72;
        ar = f;
        ag = f;
        ab = f * 0.98;
        especular = 0.5;
      }
    }

    const NV = Math.max(1e-3, nx * vx + ny * vy + nz * vz);
    const brilho = pintado ? 0 : (m.brilho ?? 0);
    const ehCorpo = m.acabamento === 'corpo';
    const luzDaTrama = tecido && m.trama ? LUZ_DA_TRAMA[m.trama] : null;
    const penugem = pintado ? 0 : (luzDaTrama?.penugem ?? (ehCorpo ? 0.08 : 0));
    const alfaPenugem = luzDaTrama?.larguraDaPenugem ?? 0.4;
    const passa = luzDaTrama ? luzDaTrama.translucidez : 0;
    const aniso = luzDaTrama ? luzDaTrama.anisotropia : 0;
    const asperidade = ehCorpo ? 0.58 : m.acabamento === 'botao' ? 0.2 : m.acabamento === 'ziper' ? 0.3 : 0.8 - 0.42 * brilho;
    const alfaBase = asperidade * asperidade;
    const refletividade = tecido ? 0.02 + 0.03 * brilho : ehCorpo ? 0.03 : especular;
    const roughON = ehCorpo ? 0.45 : 0.85;
    const onA = 1 / (1 + 0.4739 * roughON);
    const onB = roughON * onA;
    const envolve = ehCorpo ? 0.1 : 0.14;

    // A sombra: o ponto saindo um pouco do pano, para o próprio pano não se sombrear.
    const ruidoDoPonto = (52.9829189 * ((0.06711056 * xp + 0.00583715 * yp) % 1)) % 1;
    const giro = ruidoDoPonto * DOIS_PI;
    const sombraKey = luzQueChega(sombra, px + nx * 3, py + ny * 3, pz + nz * 3, giro, q.amostrasDeSombra);

    let ao = 1;
    if (comOclusao && nOclusao > 0) {
      const xv = (px - O.x) * R.x + (py - O.y) * R.y + (pz - O.z) * R.z;
      const yv = (px - O.x) * U.x + (py - O.y) * U.y + (pz - O.z) * U.z;
      const zv = (px - O.x) * F.x + (py - O.y) * F.y + (pz - O.z) * F.z;
      ao = oclusao(xp, yp, zv, xv, yv, nx * R.x + ny * R.y + nz * R.z, nx * U.x + ny * U.y + nz * U.z, nx * F.x + ny * F.y + nz * F.z, giro);
    }

    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (let li = 0; li < luzes.length; li++) {
      const L = luzes[li]!;
      const visivel = li === 0 ? sombraKey : 1;
      const NL = nx * L.x + ny * L.y + nz * L.z;
      const forca = L.forca * visivel;
      if (NL > 0) {
        // Fosco de verdade (Oren-Nayar): o pano é chapado e clareia de volta para a luz, sem o degradê de plástico.
        const s = L.x * vx + L.y * vy + L.z * vz - NL * NV;
        const fator = onA + onB * (s > 0 ? s / Math.max(NL, NV) : s);
        const d = (Math.max(0, NL + envolve) / (1 + envolve)) * Math.max(0, fator) * forca;
        sr += ar * d * L.cor[0];
        sg += ag * d * L.cor[1];
        sb += ab * d * L.cor[2];
        // O reflexo: GGX, esticado na direção do fio quando há anisotropia.
        let hx = L.x + vx;
        let hy = L.y + vy;
        let hz = L.z + vz;
        const hl = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
        hx /= hl;
        hy /= hl;
        hz /= hl;
        const NH = Math.max(0, nx * hx + ny * hy + nz * hz);
        const VH = Math.max(0, vx * hx + vy * hy + vz * hz);
        let D: number;
        if (aniso > 0) {
          const at = alfaBase * (1 + 2.2 * aniso);
          const ab2 = alfaBase * (1 - 0.6 * aniso);
          const TH = hx * tx + hy * ty + hz * tz;
          const bx = ny * tz - nz * ty;
          const by = nz * tx - nx * tz;
          const bz = nx * ty - ny * tx;
          const BH = hx * bx + hy * by + hz * bz;
          const den = (TH * TH) / (at * at) + (BH * BH) / (ab2 * ab2) + NH * NH;
          D = 1 / (Math.PI * at * ab2 * den * den);
        } else {
          const a2 = alfaBase * alfaBase;
          const den = NH * NH * (a2 - 1) + 1;
          D = a2 / (Math.PI * den * den);
        }
        const fre = refletividade + (1 - refletividade) * (1 - VH) ** 5;
        const vis = 0.25 / Math.max(0.08, NL * (1 - alfaBase) + alfaBase) / Math.max(0.08, NV * (1 - alfaBase) + alfaBase);
        const reflexo = Math.min(4, D * vis * fre) * NL * forca * Math.PI;
        sr += reflexo;
        sg += reflexo;
        sb += reflexo;
        // A penugem: os fios soltos pegam a luz de lado e a borda clareia.
        if (penugem > 0) {
          const sen2 = Math.max(1e-4, 1 - NH * NH);
          const invA = 1 / alfaPenugem;
          const Dp = ((2 + invA) * sen2 ** (invA / 2)) / DOIS_PI;
          const Vp = 1 / (4 * (NL + NV - NL * NV));
          const p = Math.min(2, Dp * Vp) * NL * forca * penugem * Math.PI;
          sr += p * (0.35 * ar + 0.65 * Math.sqrt(ar) * 0.6 + 0.1);
          sg += p * (0.35 * ag + 0.65 * Math.sqrt(ag) * 0.6 + 0.1);
          sb += p * (0.35 * ab + 0.65 * Math.sqrt(ab) * 0.6 + 0.1);
        }
      } else if (passa > 0) {
        // A luz de trás, que o pano fino deixa passar.
        const k = -NL * passa * forca * ao;
        sr += ar * k;
        sg += ag * k;
        sb += ab * k;
      }
    }

    // A luz ambiente: mais clara de cima, mais fraca de baixo (o que volta do chão).
    const ceu = 0.5 + 0.5 * ny;
    const ambR = (0.17 + 0.17 * ceu) * ao;
    const ambG = (0.165 + 0.175 * ceu) * ao;
    const ambB = (0.16 + 0.185 * ceu) * ao;
    sr += ar * ambR;
    sg += ag * ambG;
    sb += ab * ambB;
    // O reflexo do estúdio em volta, que aparece de lado.
    const rimbo = (1 - NV) ** 4;
    const emVolta = (refletividade + (ehCorpo ? 0.05 : 0.02 + penugem * 0.1 + 0.2 * brilho) * rimbo) * ao * (0.5 + 0.45 * ceu);
    sr += emVolta;
    sg += emVolta;
    sb += emVolta;

    cor[0] = sr;
    cor[1] = sg;
    cor[2] = sb;
    return opacidadeDoTecido(m.transparencia ?? 0);
  };

  // O fundo, por pixel da imagem final: a parede ao longe e o chão, onde a sombra cai.
  const saida = new Uint8ClampedArray(v.largura * v.altura * 4);
  const fundoR = new Float32Array(v.largura * v.altura);
  const fundoG = new Float32Array(v.largura * v.altura);
  const fundoB = new Float32Array(v.largura * v.altura);
  const branco = fundo === 'branco';
  const raioDoPalco = v.alturaDaCena * 1.35;
  const raioDoFim = v.alturaDaCena * 2.8;
  for (let y = 0; y < v.altura; y++) {
    for (let x = 0; x < v.largura; x++) {
      const kx = (x + 0.5 - v.largura / 2) / v.foco;
      const ky = -(y + 0.5 - v.altura / 2) / v.foco;
      const dx = F.x + kx * R.x + ky * U.x;
      const dy = F.y + kx * R.y + ky * U.y;
      const dz = F.z + kx * R.z + ky * U.z;
      const alto = 0.5 + (0.5 * (y + 0.5 - v.altura)) / -v.altura;
      let r = branco ? 1 : FUNDO_DA_PAREDE_BAIXO[0]! + (FUNDO_DA_PAREDE_ALTO[0]! - FUNDO_DA_PAREDE_BAIXO[0]!) * alto;
      let g = branco ? 1 : FUNDO_DA_PAREDE_BAIXO[1]! + (FUNDO_DA_PAREDE_ALTO[1]! - FUNDO_DA_PAREDE_BAIXO[1]!) * alto;
      let b = branco ? 1 : FUNDO_DA_PAREDE_BAIXO[2]! + (FUNDO_DA_PAREDE_ALTO[2]! - FUNDO_DA_PAREDE_BAIXO[2]!) * alto;
      if (dy < -1e-6) {
        const s = -O.y / dy;
        const hx = O.x + dx * s;
        const hz = O.z + dz * s;
        const dist = Math.hypot(hx, hz);
        const m = misturaSuave(raioDoPalco, raioDoFim, dist);
        const claridade = lerChao(chao, hx, hz);
        const chaoR = branco ? 1 : FUNDO_DO_CHAO[0]!;
        const chaoG = branco ? 1 : FUNDO_DO_CHAO[1]!;
        const chaoB = branco ? 1 : FUNDO_DO_CHAO[2]!;
        r = (chaoR + (r - chaoR) * m) * (1 + (claridade - 1) * (1 - m));
        g = (chaoG + (g - chaoG) * m) * (1 + (claridade - 1) * (1 - m));
        b = (chaoB + (b - chaoB) * m) * (1 + (claridade - 1) * (1 - m));
      }
      const i = y * v.largura + x;
      fundoR[i] = r;
      fundoG[i] = g;
      fundoB[i] = b;
    }
  }

  // Cada ponto da imagem, somado no pixel dela.
  const somaR = new Float32Array(v.largura * v.altura);
  const somaG = new Float32Array(v.largura * v.altura);
  const somaB = new Float32Array(v.largura * v.altura);
  const conta = new Uint16Array(v.largura * v.altura);
  const emSaida = (): void => {
    mapaDeTons(cor);
  };
  const compor = (vista: Vista, i: number, x: number, y: number, r: number, g: number, b: number): readonly [number, number, number] => {
    const opacidade = sombrear(vista, i, x, y, false);
    emSaida();
    return [r + (cor[0]! - r) * opacidade, g + (cor[1]! - g) * opacidade, b + (cor[2]! - b) * opacidade];
  };
  for (let y = 0; y < H; y++) {
    const yo = (y / ss) | 0;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const oi = yo * v.largura + ((x / ss) | 0);
      const temOpaca = opaca.ids[i]! >= 0;
      const tem1 = camada1 !== null && camada1.ids[i]! >= 0;
      if (!temOpaca && !tem1) continue;
      let r: number;
      let g: number;
      let b: number;
      if (temOpaca) {
        sombrear(opaca, i, x, y, true);
        emSaida();
        r = cor[0]!;
        g = cor[1]!;
        b = cor[2]!;
      } else {
        // Sobre o fundo, que já está em cores da tela: volta para luz para misturar com o pano.
        r = fundoR[oi]! ** 2.2;
        g = fundoG[oi]! ** 2.2;
        b = fundoB[oi]! ** 2.2;
      }
      if (camada2 && camada2.ids[i]! >= 0) [r, g, b] = compor(camada2, i, x, y, r, g, b);
      if (camada1 && camada1.ids[i]! >= 0) [r, g, b] = compor(camada1, i, x, y, r, g, b);
      somaR[oi] = somaR[oi]! + paraSaida(r);
      somaG[oi] = somaG[oi]! + paraSaida(g);
      somaB[oi] = somaB[oi]! + paraSaida(b);
      conta[oi] = conta[oi]! + 1;
    }
  }
  const porPixel = ss * ss;
  // Um grão fino (±½ nível) tira as faixas do degradê do fundo.
  for (let i = 0; i < v.largura * v.altura; i++) {
    const n = conta[i]!;
    const grao = branco ? 0 : tabelaDoRuido[i & 0xffff]! - 0.5;
    const resto = (porPixel - n) / porPixel;
    saida[4 * i] = somaR[i]! / porPixel + fundoR[i]! * 255 * resto + grao;
    saida[4 * i + 1] = somaG[i]! / porPixel + fundoG[i]! * 255 * resto + grao;
    saida[4 * i + 2] = somaB[i]! / porPixel + fundoB[i]! * 255 * resto + grao;
    saida[4 * i + 3] = 255;
  }
  return saida;
}

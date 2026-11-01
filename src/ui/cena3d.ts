import type { Ponto3D } from '../domain/manequim';
import type { VistaDoEstudio } from './estudio3d';

/** A câmera do provador 3D (ADR 0111): ela gira em volta do manequim. A imagem sai do estúdio (`estudio3d`, ADR 0228). */

export interface Camera3D {
  /** O giro em volta do corpo (rad): 0 olha a frente; π, as costas. */
  readonly guinada: number;
  /** De cima (+) ou de baixo (−) (rad). */
  readonly arfagem: number;
  readonly distancia: number;
  readonly alvo: Ponto3D;
}

/** A distância da vista inteira do corpo, em alturas do corpo. */
const DISTANCIA_DE_FRENTE = 2.6;

export function cameraDeFrente(alturaMm: number): Camera3D {
  return { guinada: 0, arfagem: 0.08, distancia: alturaMm * DISTANCIA_DE_FRENTE, alvo: { x: 0, y: alturaMm * 0.52, z: 0 } };
}

/** A câmera com o alvo levado `dx`, `dy` pixels na imagem: o que está na tela acompanha o arrasto. */
export function cameraMovida(camera: Camera3D, proj: Projecao, dx: number, dy: number): Camera3D {
  const k = camera.distancia / proj.foco;
  return {
    ...camera,
    alvo: {
      x: camera.alvo.x + k * (-dx * proj.direita.x + dy * proj.alto.x),
      y: camera.alvo.y + k * (-dx * proj.direita.y + dy * proj.alto.y),
      z: camera.alvo.z + k * (-dx * proj.direita.z + dy * proj.alto.z),
    },
  };
}

export interface Projecao {
  readonly largura: number;
  readonly altura: number;
  /** Projeta um ponto: x e y na tela, e a profundidade (mm à frente da câmera); `null` atrás dela. */
  readonly projetar: (x: number, y: number, z: number) => { sx: number; sy: number; z: number } | null;
  readonly posicao: Ponto3D;
  /** A direção da luz (para onde ela vai, invertida: aponta para a luz). */
  readonly luz: Ponto3D;
  /** Px por mm à distância da câmera ao alvo. */
  readonly escala: number;
  /** O foco da perspectiva: px = foco × mm ÷ profundidade. */
  readonly foco: number;
  /** As direções da câmera: para onde olha, a direita e o alto da imagem. */
  readonly frente: Ponto3D;
  readonly direita: Ponto3D;
  readonly alto: Ponto3D;
}

export function projecao(camera: Camera3D, largura: number, altura: number): Projecao {
  const cp = Math.cos(camera.arfagem);
  const posicao = {
    x: camera.alvo.x + camera.distancia * Math.sin(camera.guinada) * cp,
    y: camera.alvo.y + camera.distancia * Math.sin(camera.arfagem),
    z: camera.alvo.z + camera.distancia * Math.cos(camera.guinada) * cp,
  };
  // A frente (da câmera para o alvo), a direita e o alto.
  let fx = camera.alvo.x - posicao.x;
  let fy = camera.alvo.y - posicao.y;
  let fz = camera.alvo.z - posicao.z;
  const fl = Math.hypot(fx, fy, fz) || 1;
  fx /= fl;
  fy /= fl;
  fz /= fl;
  // direita = frente × (0, 1, 0)
  let rx = -fz;
  const ry = 0;
  let rz = fx;
  const rl = Math.hypot(rx, rz) || 1;
  rx /= rl;
  rz /= rl;
  // alto = direita × frente
  const ux = ry * fz - rz * fy;
  const uy = rz * fx - rx * fz;
  const uz = rx * fy - ry * fx;
  // O foco não acompanha a distância: chegar perto aumenta o que se vê (ADR 0231).
  const foco = (altura / 1.15) * DISTANCIA_DE_FRENTE;
  const cx = largura / 2;
  const cy = altura / 2;
  const luzBruta = { x: 0.35 * rx + 0.6 * ux - 0.7 * fx, y: 0.35 * ry + 0.6 * uy - 0.7 * fy, z: 0.35 * rz + 0.6 * uz - 0.7 * fz };
  const ll = Math.hypot(luzBruta.x, luzBruta.y, luzBruta.z);
  return {
    largura,
    altura,
    posicao,
    luz: { x: luzBruta.x / ll, y: luzBruta.y / ll, z: luzBruta.z / ll },
    escala: foco / camera.distancia,
    foco,
    frente: { x: fx, y: fy, z: fz },
    direita: { x: rx, y: ry, z: rz },
    alto: { x: ux, y: uy, z: uz },
    projetar: (x, y, z) => {
      const dx = x - posicao.x;
      const dy = y - posicao.y;
      const dz = z - posicao.z;
      const pz = dx * fx + dy * fy + dz * fz;
      if (pz < 1) return null;
      const px = dx * rx + dy * ry + dz * rz;
      const py = dx * ux + dy * uy + dz * uz;
      return { sx: cx + (foco * px) / pz, sy: cy - (foco * py) / pz, z: pz };
    },
  };
}

export interface MalhaParaDesenhar {
  readonly vertices: ArrayLike<number>;
  readonly triangulos: ArrayLike<number>;
}

export const COR_DO_CORPO: readonly [number, number, number] = [216, 211, 204];

/** A cor da tensão: verde até 1%, amarelo em 4%, vermelho de 8% para cima (encolhido: azul-claro). */
export function corDaTensao(t: number): [number, number, number] {
  if (t < -0.02) return [120, 170, 220];
  const f = Math.min(1, Math.max(0, (t - 0.01) / 0.07));
  if (f < 0.5) {
    const g = f / 0.5;
    return [Math.round(70 + (235 - 70) * g), Math.round(170 + (200 - 170) * g), Math.round(90 - 60 * g)];
  }
  const g = (f - 0.5) / 0.5;
  return [Math.round(235 - 15 * g), Math.round(200 - 150 * g), Math.round(30 + 10 * g)];
}

/** A vista da câmera para o estúdio, com a altura da cena. */
export const vistaDaProjecao = (p: Projecao, alturaDaCena: number): VistaDoEstudio => ({
  largura: p.largura,
  altura: p.altura,
  posicao: p.posicao,
  frente: p.frente,
  direita: p.direita,
  alto: p.alto,
  foco: p.foco,
  alturaDaCena,
});

/** A cor em hexadecimal (#rrggbb) como três números. */
export function corRgb(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  return m ? [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)] : [79, 124, 172];
}

/**
 * O ponto do corpo debaixo de um ponto da tela (o desenho no corpo, ADR 0134): o triângulo do corpo que contém o ponto
 * na tela, o mais perto da câmera; o ponto 3D pelos mesmos pesos dos três cantos. `null` fora do corpo.
 */
export function pontoDoCorpoNaTela(proj: Projecao, corpo: MalhaParaDesenhar, sx: number, sy: number): { readonly x: number; readonly y: number; readonly z: number } | null {
  const v = corpo.vertices;
  let melhor: { z: number; x: number; y: number; zz: number } | null = null;
  const T = corpo.triangulos.length / 3;
  for (let t = 0; t < T; t++) {
    const i = [corpo.triangulos[3 * t]!, corpo.triangulos[3 * t + 1]!, corpo.triangulos[3 * t + 2]!];
    const p = i.map((k) => proj.projetar(v[3 * k]!, v[3 * k + 1]!, v[3 * k + 2]!));
    if (!p[0] || !p[1] || !p[2]) continue;
    const [a, b, c] = p as [NonNullable<(typeof p)[0]>, NonNullable<(typeof p)[0]>, NonNullable<(typeof p)[0]>];
    const d = (b.sy - c.sy) * (a.sx - c.sx) + (c.sx - b.sx) * (a.sy - c.sy);
    if (Math.abs(d) < 1e-12) continue;
    const w0 = ((b.sy - c.sy) * (sx - c.sx) + (c.sx - b.sx) * (sy - c.sy)) / d;
    const w1 = ((c.sy - a.sy) * (sx - c.sx) + (a.sx - c.sx) * (sy - c.sy)) / d;
    const w2 = 1 - w0 - w1;
    if (w0 < -1e-9 || w1 < -1e-9 || w2 < -1e-9) continue;
    const z = w0 * a.z + w1 * b.z + w2 * c.z;
    if (melhor && z >= melhor.z) continue;
    const em = (eixo: number): number => w0 * v[3 * i[0]! + eixo]! + w1 * v[3 * i[1]! + eixo]! + w2 * v[3 * i[2]! + eixo]!;
    melhor = { z, x: em(0), y: em(1), zz: em(2) };
  }
  return melhor ? { x: melhor.x, y: melhor.y, z: melhor.zz } : null;
}

/** As guinadas do giro em vídeo (ADR 0139): uma volta inteira em `quadros` passos, a partir da de agora. */
export function guinadasDoGiro(inicio: number, quadros: number): number[] {
  return Array.from({ length: Math.max(1, Math.floor(quadros)) }, (_, k) => inicio + (2 * Math.PI * k) / Math.max(1, Math.floor(quadros)));
}

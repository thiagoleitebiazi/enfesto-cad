import type { Ponto3D } from '../domain/manequim';

/**
 * O desenho do provador 3D (ADR 0111) num canvas comum: a câmera gira em volta do manequim, cada triângulo é
 * projetado em perspectiva, iluminado pela direção dele e pintado de trás para a frente (o mais longe primeiro).
 * O corpo esconde as faces de trás; o tecido mostra os dois lados (o avesso mais escuro). A estampa vai pela
 * face da peça (a imagem corrida ou localizada), por uma transformação afim em cada triângulo.
 */

export interface Camera3D {
  /** O giro em volta do corpo (rad): 0 olha a frente; π, as costas. */
  readonly guinada: number;
  /** De cima (+) ou de baixo (−) (rad). */
  readonly arfagem: number;
  readonly distancia: number;
  readonly alvo: Ponto3D;
}

export function cameraDeFrente(alturaMm: number): Camera3D {
  return { guinada: 0, arfagem: 0.08, distancia: alturaMm * 2.6, alvo: { x: 0, y: alturaMm * 0.52, z: 0 } };
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
}

export function projecao(camera: Camera3D, largura: number, altura: number, alturaDoCorpoMm: number): Projecao {
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
  const foco = (altura / 1.15) * (camera.distancia / Math.max(1, alturaDoCorpoMm));
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

export type ItemDaCena =
  | {
      readonly tipo: 'triangulo';
      /** Os três pontos na tela (x, y seguidos). */
      readonly tela: Float64Array;
      readonly z: number;
      readonly cor: readonly [number, number, number];
      /** A luz que bate (0 a 1). */
      readonly luz: number;
      /** O reflexo do tecido que brilha (0 a 1): a cor vai para o branco (ADR 0131). */
      readonly reflexo?: number;
      /** A opacidade do tecido transparente (de 0,15 a 1): o corpo aparece por trás (ADR 0131). */
      readonly opacidade?: number;
      /** A estampa: a instância e as coordenadas da face (u, v seguidos) dos três pontos. */
      readonly estampa?: { readonly chave: string; readonly uv: Float64Array };
    }
  | { readonly tipo: 'botao'; readonly x: number; readonly y: number; readonly r: number; readonly z: number; readonly cor: readonly [number, number, number] }
  /** Um pedaço do zíper (ADR 0132): da ponta `de` à `ate` na tela, a largura em pixels; o primeiro leva o cursor. */
  | { readonly tipo: 'ziper'; readonly de: readonly [number, number]; readonly ate: readonly [number, number]; readonly z: number; readonly largura: number; readonly cursor: boolean };

export interface MalhaParaDesenhar {
  readonly vertices: ArrayLike<number>;
  readonly triangulos: ArrayLike<number>;
}

export interface TecidoParaDesenhar {
  readonly x: ArrayLike<number>;
  readonly triangulos: ArrayLike<number>;
  /** De cada peça: o primeiro triângulo, quantos, a cor, se é espelhada (a face fica do outro lado), a estampa. */
  readonly pecas: readonly {
    readonly chave: string;
    readonly primeiroTriangulo: number;
    readonly quantidade: number;
    readonly cor: readonly [number, number, number];
    readonly espelhada: boolean;
    /** As coordenadas da face de cada ponto da peça (u, v seguidos), quando há estampa. */
    readonly uv?: Float64Array;
    /** O primeiro ponto da peça (para achar o `uv` de cada ponto). */
    readonly inicio: number;
    /** 1: a peça vai sobre outra (o bolso, ADR 0123) e é pintada por cima dela. */
    readonly camada?: number;
  }[];
  /** Pinta pela tensão (o quanto estica) em vez da cor. */
  readonly tensoes?: ArrayLike<number>;
  /** Os botões (os furos do molde): o triângulo, a posição nele (b1, b2; b0 = 1 − b1 − b2) e o raio (mm). */
  readonly botoes?: readonly { readonly triangulo: number; readonly b1: number; readonly b2: number; readonly raio: number }[];
  /** O brilho e a transparência do tecido, de 0 a 100 (ADR 0131). */
  readonly brilho?: number;
  readonly transparencia?: number;
  /** Os zíperes: os pontos da costura (nos números da simulação) e o comprimento (mm), do alto para baixo (ADR 0132). */
  readonly ziperes?: readonly { readonly pontos: ArrayLike<number>; readonly comprimentoMm: number }[];
}

export const COR_DO_CORPO: readonly [number, number, number] = [212, 205, 196];

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

/** Os itens da cena, já projetados e em ordem (o mais longe primeiro). */
export function montarCena(proj: Projecao, corpo: MalhaParaDesenhar | null, tecido: TecidoParaDesenhar | null): ItemDaCena[] {
  const itens: ItemDaCena[] = [];
  const P = proj.posicao;
  const L = proj.luz;
  const triangulo = (v: ArrayLike<number>, a: number, b: number, c: number): { tela: Float64Array; z: number; readonly nx: number; readonly ny: number; readonly nz: number; readonly olhando: number } | null => {
    const pa = proj.projetar(v[3 * a]!, v[3 * a + 1]!, v[3 * a + 2]!);
    const pb = proj.projetar(v[3 * b]!, v[3 * b + 1]!, v[3 * b + 2]!);
    const pc = proj.projetar(v[3 * c]!, v[3 * c + 1]!, v[3 * c + 2]!);
    if (!pa || !pb || !pc) return null;
    const e1x = v[3 * b]! - v[3 * a]!;
    const e1y = v[3 * b + 1]! - v[3 * a + 1]!;
    const e1z = v[3 * b + 2]! - v[3 * a + 2]!;
    const e2x = v[3 * c]! - v[3 * a]!;
    const e2y = v[3 * c + 1]! - v[3 * a + 1]!;
    const e2z = v[3 * c + 2]! - v[3 * a + 2]!;
    let nx = e1y * e2z - e1z * e2y;
    let ny = e1z * e2x - e1x * e2z;
    let nz = e1x * e2y - e1y * e2x;
    const nl = Math.hypot(nx, ny, nz);
    if (nl < 1e-12) return null;
    nx /= nl;
    ny /= nl;
    nz /= nl;
    const olhando = nx * (P.x - v[3 * a]!) + ny * (P.y - v[3 * a + 1]!) + nz * (P.z - v[3 * a + 2]!);
    return { tela: Float64Array.of(pa.sx, pa.sy, pb.sx, pb.sy, pc.sx, pc.sy), z: (pa.z + pb.z + pc.z) / 3, nx, ny, nz, olhando };
  };
  if (corpo) {
    const T = corpo.triangulos.length / 3;
    for (let t = 0; t < T; t++) {
      const r = triangulo(corpo.vertices, corpo.triangulos[3 * t]!, corpo.triangulos[3 * t + 1]!, corpo.triangulos[3 * t + 2]!);
      if (!r || r.olhando <= 0) continue;
      const luz = 0.35 + 0.65 * Math.max(0, r.nx * L.x + r.ny * L.y + r.nz * L.z);
      itens.push({ tipo: 'triangulo', tela: r.tela, z: r.z, cor: COR_DO_CORPO, luz });
    }
  }
  if (tecido) {
    const brilho = tecido.tensoes ? 0 : (tecido.brilho ?? 0) / 100;
    // Mesmo o mais transparente guarda um pouco da cor (o voal não some).
    const opacidade = 1 - 0.85 * ((tecido.transparencia ?? 0) / 100);
    const vista = { ...(opacidade < 1 ? { opacidade } : {}) };
    for (const peca of tecido.pecas) {
      for (let k = 0; k < peca.quantidade; k++) {
        const t = peca.primeiroTriangulo + k;
        const a = tecido.triangulos[3 * t]!;
        const b = tecido.triangulos[3 * t + 1]!;
        const c = tecido.triangulos[3 * t + 2]!;
        const r = triangulo(tecido.x, a, b, c);
        if (!r) continue;
        // A face da peça: a frente do triângulo (do outro lado na peça espelhada). Vendo o avesso, a luz vem do outro lado.
        const daFace = (r.olhando > 0) !== peca.espelhada;
        const s = r.olhando > 0 ? 1 : -1;
        const luz = (0.35 + 0.65 * Math.max(0, s * (r.nx * L.x + r.ny * L.y + r.nz * L.z))) * (daFace ? 1 : 0.72);
        const cor = tecido.tensoes ? corDaTensao(tecido.tensoes[t]!) : peca.cor;
        const uv = peca.uv && daFace && !tecido.tensoes ? peca.uv : null;
        // O reflexo (Blinn-Phong): o meio do caminho entre a luz e o olho, contra a normal da face que se vê. Quanto
        // mais brilho, mais forte e mais estreito (o cetim tem o risco de luz; o tafetá, uma mancha larga).
        let reflexo = 0;
        if (brilho > 0) {
          let vx = P.x - tecido.x[3 * a]!;
          let vy = P.y - tecido.x[3 * a + 1]!;
          let vz = P.z - tecido.x[3 * a + 2]!;
          const vl = Math.hypot(vx, vy, vz) || 1;
          vx /= vl;
          vy /= vl;
          vz /= vl;
          let hx = L.x + vx;
          let hy = L.y + vy;
          let hz = L.z + vz;
          const hl = Math.hypot(hx, hy, hz) || 1;
          hx /= hl;
          hy /= hl;
          hz /= hl;
          const nh = Math.max(0, s * (r.nx * hx + r.ny * hy + r.nz * hz));
          reflexo = Math.min(0.9, brilho * Math.pow(nh, 8 + 60 * brilho) * 1.3);
        }
        const daVista = { ...vista, ...(reflexo > 0.01 ? { reflexo } : {}) };
        // O tecido fica a poucos milímetros do corpo: na ordem, ele vem um pouco à frente (senão um triângulo grande do
        // corpo, com o meio mais perto da câmera, o cobriria).
        r.z -= 25 + 20 * (peca.camada ?? 0);
        if (uv) {
          const ia = a - peca.inicio;
          const ib = b - peca.inicio;
          const ic = c - peca.inicio;
          itens.push({ tipo: 'triangulo', tela: r.tela, z: r.z, cor, luz, ...daVista, estampa: { chave: peca.chave, uv: Float64Array.of(uv[2 * ia]!, uv[2 * ia + 1]!, uv[2 * ib]!, uv[2 * ib + 1]!, uv[2 * ic]!, uv[2 * ic + 1]!) } });
        } else itens.push({ tipo: 'triangulo', tela: r.tela, z: r.z, cor, luz, ...daVista });
      }
    }
    // O zíper: do alto da costura (a ponta mais alta) para baixo, até o comprimento dele; um item por pedaço, cada um na
    // profundidade dele (o que fica atrás do corpo some atrás dele), um pouco à frente do tecido.
    const X = tecido.x;
    for (const ziper of tecido.ziperes ?? []) {
      const n = ziper.pontos.length;
      if (n < 2) continue;
      const altura = (k: number): number => X[3 * ziper.pontos[k]! + 1]!;
      const ordem = Array.from({ length: n }, (_, k) => (altura(0) >= altura(n - 1) ? k : n - 1 - k));
      let andado = 0;
      for (let k = 1; k < n && andado < ziper.comprimentoMm; k++) {
        const ia = ziper.pontos[ordem[k - 1]!]!;
        const ib = ziper.pontos[ordem[k]!]!;
        const ax = X[3 * ia]!;
        const ay = X[3 * ia + 1]!;
        const az = X[3 * ia + 2]!;
        let bx = X[3 * ib]!;
        let by = X[3 * ib + 1]!;
        let bz = X[3 * ib + 2]!;
        const lado = Math.hypot(bx - ax, by - ay, bz - az);
        if (lado < 1e-9) continue;
        const falta = ziper.comprimentoMm - andado;
        if (lado > falta) {
          const f = falta / lado;
          bx = ax + (bx - ax) * f;
          by = ay + (by - ay) * f;
          bz = az + (bz - az) * f;
        }
        andado += Math.min(lado, falta);
        const pa = proj.projetar(ax, ay, az);
        const pb = proj.projetar(bx, by, bz);
        if (!pa || !pb) continue;
        const pixelsPorMm = Math.hypot(pb.sx - pa.sx, pb.sy - pa.sy) / Math.max(1e-9, Math.min(lado, falta));
        itens.push({
          tipo: 'ziper',
          de: [pa.sx, pa.sy],
          ate: [pb.sx, pb.sy],
          z: (pa.z + pb.z) / 2 - 40,
          // A fita com os dentes tem uns 14 mm; nunca menos de 3 pixels, para se ver o zíper com o corpo inteiro na tela.
          largura: Math.max(3, Math.min(18, 14 * pixelsPorMm)),
          cursor: k === 1,
        });
      }
    }
    for (const botao of tecido.botoes ?? []) {
      const a = tecido.triangulos[3 * botao.triangulo]!;
      const b = tecido.triangulos[3 * botao.triangulo + 1]!;
      const c = tecido.triangulos[3 * botao.triangulo + 2]!;
      const b0 = 1 - botao.b1 - botao.b2;
      const X = tecido.x;
      const px = X[3 * a]! * b0 + X[3 * b]! * botao.b1 + X[3 * c]! * botao.b2;
      const py = X[3 * a + 1]! * b0 + X[3 * b + 1]! * botao.b1 + X[3 * c + 1]! * botao.b2;
      const pz = X[3 * a + 2]! * b0 + X[3 * b + 2]! * botao.b1 + X[3 * c + 2]! * botao.b2;
      const r = triangulo(X, a, b, c);
      const p = proj.projetar(px, py, pz);
      if (!r || !p) continue;
      // Só o botão do lado que se vê (o lado de fora da peça).
      if (r.olhando <= 0) continue;
      itens.push({ tipo: 'botao', x: p.sx, y: p.sy, r: Math.max(1.5, (proj.foco * botao.raio) / p.z), z: p.z - 2, cor: [40, 40, 46] });
    }
  }
  itens.sort((p, q) => q.z - p.z);
  return itens;
}

/** A transformação afim que leva os três pontos `de` (x, y seguidos) aos três `para`: [a, b, c, d, e, f] (como o canvas). */
export function afimDeTresPontos(de: ArrayLike<number>, para: ArrayLike<number>): [number, number, number, number, number, number] | null {
  const [x0, y0, x1, y1, x2, y2] = [de[0]!, de[1]!, de[2]!, de[3]!, de[4]!, de[5]!];
  const det = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0);
  if (Math.abs(det) < 1e-12) return null;
  const [X0, Y0, X1, Y1, X2, Y2] = [para[0]!, para[1]!, para[2]!, para[3]!, para[4]!, para[5]!];
  const a = ((X1 - X0) * (y2 - y0) - (X2 - X0) * (y1 - y0)) / det;
  const c = ((X2 - X0) * (x1 - x0) - (X1 - X0) * (x2 - x0)) / det;
  const b = ((Y1 - Y0) * (y2 - y0) - (Y2 - Y0) * (y1 - y0)) / det;
  const d = ((Y2 - Y0) * (x1 - x0) - (Y1 - Y0) * (x2 - x0)) / det;
  return [a, b, c, d, X0 - a * x0 - c * y0, Y0 - b * x0 - d * y0];
}

/** Os tons da estampa: a mesma imagem, da mais escura (a sombra) à mais clara (a luz em cheio). */
export const TONS_DA_ESTAMPA = 6;
const LUZ_MINIMA = 0.3;

/** O tom (0 a TONS_DA_ESTAMPA − 1) de uma luz. */
export function tomDaLuz(luz: number): number {
  return Math.max(0, Math.min(TONS_DA_ESTAMPA - 1, Math.round(((luz - LUZ_MINIMA) / (1 - LUZ_MINIMA)) * (TONS_DA_ESTAMPA - 1))));
}

/** A luz de cada tom. */
export const luzDoTom = (tom: number): number => LUZ_MINIMA + ((1 - LUZ_MINIMA) * tom) / (TONS_DA_ESTAMPA - 1);

export interface EstampaPronta {
  /** Um padrão por tom (já sombreado), do mais escuro ao mais claro. */
  readonly padroes: readonly CanvasPattern[];
  /** Da imagem (px) para a face da peça (u, v em mm): [a, b, c, d, e, f]. */
  readonly imagemParaFace: readonly [number, number, number, number, number, number];
}

const multiplicar = (m: readonly number[], n: readonly number[]): [number, number, number, number, number, number] => [
  m[0]! * n[0]! + m[2]! * n[1]!,
  m[1]! * n[0]! + m[3]! * n[1]!,
  m[0]! * n[2]! + m[2]! * n[3]!,
  m[1]! * n[2]! + m[3]! * n[3]!,
  m[0]! * n[4]! + m[2]! * n[5]! + m[4]!,
  m[1]! * n[4]! + m[3]! * n[5]! + m[5]!,
];

/** Pinta os itens no canvas (já limpo), na ordem. */
export function desenharCena(ctx: CanvasRenderingContext2D, itens: readonly ItemDaCena[], estampas: ReadonlyMap<string, EstampaPronta>): void {
  ctx.lineJoin = 'round';
  for (const item of itens) {
    if (item.tipo === 'ziper') {
      // A fita escura, os dentes (um tracejado claro) e, no alto, o cursor.
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(item.de[0], item.de[1]);
      ctx.lineTo(item.ate[0], item.ate[1]);
      ctx.strokeStyle = '#2f2f33';
      ctx.lineWidth = item.largura;
      ctx.stroke();
      ctx.setLineDash([Math.max(1, item.largura * 0.25), Math.max(1, item.largura * 0.25)]);
      ctx.strokeStyle = '#c9c9cf';
      ctx.lineWidth = item.largura * 0.5;
      ctx.stroke();
      ctx.setLineDash([]);
      if (item.cursor) {
        const r = item.largura * 0.75;
        ctx.fillStyle = '#9ea2aa';
        ctx.strokeStyle = '#4a4d55';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.rect(item.de[0] - r, item.de[1] - r * 0.6, r * 2, r * 2.4);
        ctx.fill();
        ctx.stroke();
      }
      continue;
    }
    if (item.tipo === 'botao') {
      ctx.beginPath();
      ctx.arc(item.x, item.y, item.r, 0, 2 * Math.PI);
      ctx.fillStyle = `rgb(${item.cor[0]},${item.cor[1]},${item.cor[2]})`;
      ctx.fill();
      continue;
    }
    const t = item.tela;
    ctx.beginPath();
    ctx.moveTo(t[0]!, t[1]!);
    ctx.lineTo(t[2]!, t[3]!);
    ctx.lineTo(t[4]!, t[5]!);
    ctx.closePath();
    const estampa = item.estampa ? estampas.get(item.estampa.chave) : undefined;
    const l = item.luz;
    // O tecido transparente: o corpo por trás aparece; sem o traço, que dobraria a cor nas emendas dos triângulos.
    const transparente = item.opacidade !== undefined && item.opacidade < 1;
    ctx.globalAlpha = item.opacidade ?? 1;
    if (estampa && item.estampa) {
      // A cor de baixo, já com a luz (com o traço, que fecha as frestas entre os triângulos), e a estampa no tom da
      // luz por cima — sem película de sombra, que marcaria as emendas dos triângulos.
      const tom = tomDaLuz(l);
      const lt = luzDoTom(tom);
      ctx.fillStyle = `rgb(${Math.round(item.cor[0] * lt)},${Math.round(item.cor[1] * lt)},${Math.round(item.cor[2] * lt)})`;
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 0.6;
      ctx.fill();
      if (!transparente) ctx.stroke();
      const faceParaTela = afimDeTresPontos(item.estampa.uv, t);
      const padrao = estampa.padroes[tom];
      if (faceParaTela && padrao) {
        const m = multiplicar(faceParaTela, estampa.imagemParaFace);
        padrao.setTransform(new DOMMatrix(m));
        ctx.fillStyle = padrao;
        ctx.strokeStyle = padrao;
        ctx.fill();
        // O traço com a própria estampa fecha as frestas entre os triângulos (sem ele, a cor de baixo aparece em linhas).
        if (!transparente) ctx.stroke();
      }
      if (item.reflexo) {
        ctx.fillStyle = `rgba(255,255,255,${item.reflexo.toFixed(3)})`;
        ctx.fill();
      }
    } else {
      const k = item.reflexo ?? 0;
      const tom = (c: number): number => Math.round(c * l + (255 - c * l) * k);
      const cor = `rgb(${tom(item.cor[0])},${tom(item.cor[1])},${tom(item.cor[2])})`;
      ctx.fillStyle = cor;
      ctx.strokeStyle = cor;
      ctx.lineWidth = 0.6;
      ctx.fill();
      if (!transparente) ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

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

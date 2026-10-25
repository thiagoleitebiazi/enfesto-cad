import type { Ponto2D } from '../core/geometria';
import type { Molde } from './molde';
import { diferencaDasPontas, eixoDaManga, eixosDaFace } from './montagem3d';

/**
 * A estampa no encaixe, para a impressão digital do tecido (ADR 0113): cada molde do encaixe preenchido com a
 * imagem — corrida (repetida pela peça) ou localizada (uma vez, no meio da peça) —, de pé no fio de cada peça, mesmo
 * que o encaixe a tenha girado. Só a área das peças (com uma sangria) é impressa. Fica no projeto
 * (`Projeto.impressaoDigital`).
 */

export type ModoDaEstampaNoEncaixe = 'corrida' | 'localizada';

export interface EstampaNoEncaixe {
  readonly imagemId: string;
  readonly modo: ModoDaEstampaNoEncaixe;
  /** A largura da imagem na peça (mm). */
  readonly larguraMm: number;
  /** Na localizada: quanto o meio da estampa sobe (+) ou desce (−) do meio da peça (mm). */
  readonly alturaMm: number;
}

export interface ImpressaoDigital {
  /** A estampa de todas as peças (`null`: nenhuma). */
  readonly padrao: EstampaNoEncaixe | null;
  /** Por peça (pelo id): outra estampa, ou `null` para a peça ficar sem estampa. Ausente: a de todas. */
  readonly porPeca: Readonly<Record<string, EstampaNoEncaixe | null>>;
  /** Quanto a estampa passa da linha de corte (mm), para o corte não pegar branco. */
  readonly sangriaMm: number;
  /** Imprime a linha de corte (um traço fino), para conferir o corte. */
  readonly linhaDeCorte: boolean;
  /** O giro da estampa de cada peça (graus, no sentido horário), além do automático. Ausente: nenhum. */
  readonly giroPorPeca?: Readonly<Record<string, number>>;
}

export const IMPRESSAO_VAZIA: ImpressaoDigital = { padrao: null, porPeca: {}, sangriaMm: 3, linhaDeCorte: true };
/** O maior trecho de comprimento numa página (mm): o PDF não passa de 14 400 pontos (5,08 m) de lado. */
export const TRECHO_MAXIMO_MM = 5000;

/** A estampa de uma peça: a dela, a de todas, ou nenhuma. */
export function estampaDaPeca(config: ImpressaoDigital, pecaId: string): EstampaNoEncaixe | null {
  return pecaId in config.porPeca ? config.porPeca[pecaId]! : config.padrao;
}

const semAcento = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * Os eixos da peça no encaixe (na tela, o y para cima): o alto e a direita de quem olha a face.
 * - O fio dá a direção. O sentido vem da peça como ela era antes dos giros (o giro acumulado é desfeito, a regra do
 *   alto é aplicada, e o giro volta): a peça que o encaixe virou de cabeça para baixo continua com a estampa de pé.
 * - Quando a forma diz qual ponta é o alto — a mais estreita (o decote e os ombros, a cintura da saia, a cabeça da
 *   manga); numa calça, bermuda ou short, a mais larga —, vale a forma: o arquivo de encaixe traz peças viradas de
 *   qualquer jeito, e muitas sem linha de fio.
 * - Mais o giro pedido para a peça (graus, no sentido horário).
 */
export function eixosDaPecaNoEncaixe(peca: Molde, giroExtraGraus = 0): { readonly cima: Ponto2D; readonly direita: Ponto2D } {
  const t = (peca.anguloDeRotacaoGraus * Math.PI) / 180;
  const girar = (p: Ponto2D, a: number): Ponto2D => ({ x: p.x * Math.cos(a) - p.y * Math.sin(a), y: p.x * Math.sin(a) + p.y * Math.cos(a) });
  // O fio na tela (x = y do mundo, y para cima = −x do mundo), desfeito o giro.
  const fio = { x: peca.linhaDeFio.fim.y - peca.linhaDeFio.inicio.y, y: -(peca.linhaDeFio.fim.x - peca.linhaDeFio.inicio.x) };
  const original = girar(fio, -t);
  // A mesma regra do provador 3D, na peça de origem (pontos de mentira com essa direção, na tela de volta ao mundo).
  const { cima } = eixosDaFace({ inicio: { x: 0, y: 0 }, fim: { x: -original.y, y: original.x } });
  let c = girar(cima, t);
  // A manga (pelo nome): o eixo dela, do meio do punho ao alto da cabeça — vem inclinada ou de lado nos arquivos de encaixe.
  const eixo = /manga/.test(semAcento(peca.nome)) ? eixoDaManga(peca.contorno) : null;
  if (eixo) {
    const dx = eixo.apice.y - eixo.punho.y;
    const dy = -(eixo.apice.x - eixo.punho.x);
    const L = Math.hypot(dx, dy);
    if (L > 0) c = { x: dx / L, y: dy / L };
  }
  // A forma: a largura perto de cada ponta, na peça vista com este alto.
  const u: number[] = [];
  const v: number[] = [];
  for (const p of peca.contorno) {
    const sx = p.y;
    const sy = -p.x;
    u.push(sx * c.y - sy * c.x);
    v.push(sx * c.x + sy * c.y);
  }
  const d = diferencaDasPontas(u, v);
  const largoEmCima = /calca|bermuda|short/.test(semAcento(peca.nome));
  if (!eixo && Math.abs(d) >= 0.08 && d > 0 !== largoEmCima) c = { x: -c.x, y: -c.y };
  const a = (giroExtraGraus * Math.PI) / 180;
  if (a !== 0) c = { x: c.x * Math.cos(a) + c.y * Math.sin(a), y: -c.x * Math.sin(a) + c.y * Math.cos(a) };
  return { cima: c, direita: { x: c.y, y: -c.x } };
}

/** A matriz [a, b, c, d, e, f]: x' = a·x + c·y + e; y' = b·x + d·y + f. */
export type Matriz = readonly [number, number, number, number, number, number];

export interface ColocacaoDaEstampa {
  /** Da imagem (px) para o mundo (mm). */
  readonly imagemParaMundo: Matriz;
  /** Onde cada cópia da imagem começa (em px da imagem): uma na localizada; as que cobrem a peça na corrida. */
  readonly ladrilhos: readonly { readonly x: number; readonly y: number }[];
}

/**
 * Onde a imagem (larguraPx × alturaPx) vai na peça: pela face (a direita e o alto da peça), com a largura pedida; a
 * corrida a partir do canto de cima à esquerda da peça, com as cópias que cobrem a peça e a sangria; a localizada no
 * meio (mais o quanto sobe).
 */
export function colocacaoNaPeca(peca: Molde, estampa: EstampaNoEncaixe, larguraPx: number, alturaPx: number, sangriaMm: number, giroExtraGraus = 0): ColocacaoDaEstampa {
  const { cima, direita } = eixosDaPecaNoEncaixe(peca, giroExtraGraus);
  // A peça na face: u para a direita, v para cima (na tela: sx = y do mundo, sy = −x do mundo).
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (const p of peca.contorno) {
    const sx = p.y;
    const sy = -p.x;
    const u = sx * direita.x + sy * direita.y;
    const v = sx * cima.x + sy * cima.y;
    minU = Math.min(minU, u);
    maxU = Math.max(maxU, u);
    minV = Math.min(minV, v);
    maxV = Math.max(maxV, v);
  }
  const s = estampa.larguraMm / Math.max(1, larguraPx);
  let u0: number;
  let v0: number;
  const ladrilhos: { x: number; y: number }[] = [];
  if (estampa.modo === 'localizada') {
    u0 = (minU + maxU) / 2 - (s * larguraPx) / 2;
    v0 = (minV + maxV) / 2 + estampa.alturaMm + (s * alturaPx) / 2;
    ladrilhos.push({ x: 0, y: 0 });
  } else {
    // A corrida começa no alto à esquerda da peça (com a sangria) e cobre a peça inteira.
    u0 = minU - sangriaMm;
    v0 = maxV + sangriaMm;
    const colunas = Math.ceil((maxU - minU + 2 * sangriaMm) / (s * larguraPx));
    const linhas = Math.ceil((maxV - minV + 2 * sangriaMm) / (s * alturaPx));
    for (let j = 0; j < linhas; j++) for (let i = 0; i < colunas; i++) ladrilhos.push({ x: i * larguraPx, y: j * alturaPx });
  }
  // Imagem (ix, iy) → face (u = s·ix + u0, v = −s·iy + v0) → tela (sx, sy) = u·direita + v·cima → mundo (x = −sy, y = sx).
  return {
    imagemParaMundo: [-s * direita.y, s * direita.x, s * cima.y, -s * cima.x, -(u0 * direita.y + v0 * cima.y), u0 * direita.x + v0 * cima.x],
    ladrilhos,
  };
}

/** Aplica a matriz a um ponto. */
export function aplicar(m: Matriz, p: Ponto2D): Ponto2D {
  return { x: m[0] * p.x + m[2] * p.y + m[4], y: m[1] * p.x + m[3] * p.y + m[5] };
}

/** m ∘ n (primeiro n, depois m). */
export function compor(m: Matriz, n: Matriz): Matriz {
  return [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
}

/** Os trechos do comprimento, um por página (cada um até 5 m). */
export function trechosDoComprimento(comprimentoMm: number): { readonly de: number; readonly ate: number }[] {
  const n = Math.max(1, Math.ceil(comprimentoMm / TRECHO_MAXIMO_MM));
  return Array.from({ length: n }, (_, i) => ({ de: i * TRECHO_MAXIMO_MM, ate: Math.min(comprimentoMm, (i + 1) * TRECHO_MAXIMO_MM) }));
}

// ---- A leitura

const ehObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

function lerEstampa(x: unknown): EstampaNoEncaixe | null {
  if (!ehObjeto(x) || typeof x.imagemId !== 'string') return null;
  const largura = typeof x.larguraMm === 'number' && Number.isFinite(x.larguraMm) ? Math.min(5000, Math.max(5, x.larguraMm)) : 200;
  return { imagemId: x.imagemId, modo: x.modo === 'localizada' ? 'localizada' : 'corrida', larguraMm: largura, alturaMm: typeof x.alturaMm === 'number' && Number.isFinite(x.alturaMm) ? x.alturaMm : 0 };
}

export function lerImpressaoDigital(bruto: unknown): ImpressaoDigital {
  if (!ehObjeto(bruto)) return IMPRESSAO_VAZIA;
  const porPeca: Record<string, EstampaNoEncaixe | null> = {};
  if (ehObjeto(bruto.porPeca)) for (const [id, e] of Object.entries(bruto.porPeca)) porPeca[id] = e === null ? null : lerEstampa(e);
  for (const [id, e] of Object.entries(porPeca)) if (e === null && bruto.porPeca && (bruto.porPeca as Record<string, unknown>)[id] !== null) delete porPeca[id];
  const sangria = typeof bruto.sangriaMm === 'number' && Number.isFinite(bruto.sangriaMm) ? Math.min(30, Math.max(0, bruto.sangriaMm)) : 3;
  const giroPorPeca: Record<string, number> = {};
  if (ehObjeto(bruto.giroPorPeca)) {
    for (const [id, g] of Object.entries(bruto.giroPorPeca)) if (typeof g === 'number' && Number.isFinite(g) && g % 360 !== 0) giroPorPeca[id] = ((g % 360) + 360) % 360;
  }
  const lida: ImpressaoDigital = { padrao: lerEstampa(bruto.padrao), porPeca, sangriaMm: sangria, linhaDeCorte: bruto.linhaDeCorte !== false };
  return Object.keys(giroPorPeca).length > 0 ? { ...lida, giroPorPeca } : lida;
}

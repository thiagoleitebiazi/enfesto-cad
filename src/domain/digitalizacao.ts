import type { Ponto2D } from '../core/geometria';
import { area, perimetro, pontoDentroDoContorno, retanguloEnvolvente, simplificarContorno } from '../core/geometria';

/**
 * A digitalização do molde de papel pela foto (ADR 0109). A foto (os pixels, RGBA) passa por:
 *
 * 1. **a correção da perspectiva**: os quatro cantos de um retângulo de medida conhecida (uma placa de corte, uma
 *    folha A4), clicados na foto, dão a homografia; a foto vira a vista de cima, em escala (mm por pixel);
 * 2. **a separação do molde**: o limiar (Otsu, ou o escolhido) separa o papel do fundo, e o clique dentro do molde
 *    escolhe a região (os pixels ligados a ele);
 * 3. **o contorno**: seguido pelas bordas dos pixels (a medida exata, sem o meio pixel do centro) e simplificado
 *    (Douglas-Peucker, na tolerância pedida);
 * 4. **os furos, o fio e os piques**: os buracos da região "redondos" são furos; o buraco comprido e fino (o traço de
 *    caneta do fio) dá o fio; os entalhes em V no contorno são piques.
 *
 * Tudo aqui é conta sobre os pixels (sem tela): a interface lê a imagem e mostra o resultado para revisar.
 */

export interface ImagemDePixels {
  readonly largura: number;
  readonly altura: number;
  /** RGBA, linha por linha. */
  readonly dados: Uint8ClampedArray;
}

export type Quadrilatero = readonly [Ponto2D, Ponto2D, Ponto2D, Ponto2D];
export type Homografia = readonly [number, number, number, number, number, number, number, number, number];

/** O maior lado da foto corrigida (pixels): acima disso, a escala fica mais grossa. */
export const LADO_MAXIMO_DA_RETIFICADA = 3000;

// ---- A perspectiva

/** A homografia que leva os quatro pontos de `de` aos de `para` (a ordem é a mesma nos dois). */
export function homografia(de: Quadrilatero, para: Quadrilatero): Homografia {
  const a: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = de[i]!;
    const { x: u, y: v } = para[i]!;
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  // Eliminação de Gauss com pivô parcial (8 × 8).
  for (let c = 0; c < 8; c++) {
    let piv = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(a[r]![c]!) > Math.abs(a[piv]![c]!)) piv = r;
    if (Math.abs(a[piv]![c]!) < 1e-12) throw new Error('Os quatro cantos não formam um quadrilátero (três estão em linha, ou dois no mesmo lugar).');
    [a[c], a[piv]] = [a[piv]!, a[c]!];
    [b[c], b[piv]] = [b[piv]!, b[c]!];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = a[r]![c]! / a[c]![c]!;
      if (f === 0) continue;
      for (let k = c; k < 8; k++) a[r]![k] = a[r]![k]! - f * a[c]![k]!;
      b[r] = b[r]! - f * b[c]!;
    }
  }
  const h = a.map((linha, i) => b[i]! / linha[i]!);
  return [h[0]!, h[1]!, h[2]!, h[3]!, h[4]!, h[5]!, h[6]!, h[7]!, 1];
}

export function aplicarHomografia(h: Homografia, p: Ponto2D): Ponto2D {
  const w = h[6] * p.x + h[7] * p.y + h[8];
  return { x: (h[0] * p.x + h[1] * p.y + h[2]) / w, y: (h[3] * p.x + h[4] * p.y + h[5]) / w };
}

/** A escala da foto corrigida: a pedida, ou mais grossa se o lado maior passaria do máximo. */
export function escalaDaRetificada(larguraMm: number, alturaMm: number, mmPorPxPedido: number): number {
  return Math.max(mmPorPxPedido, Math.max(larguraMm, alturaMm) / LADO_MAXIMO_DA_RETIFICADA);
}

/**
 * A foto vista de cima: o retângulo de referência (os cantos na foto: em cima à esquerda, em cima à direita,
 * embaixo à direita, embaixo à esquerda) vira uma imagem de `larguraMm × alturaMm` na escala `mmPorPx`, com cada
 * pixel lido da foto (bilinear). O que cai fora da foto fica branco.
 */
export function retificar(foto: ImagemDePixels, cantos: Quadrilatero, larguraMm: number, alturaMm: number, mmPorPx: number): ImagemDePixels {
  if (!(larguraMm > 0) || !(alturaMm > 0)) throw new Error('A largura e a altura do retângulo de referência precisam ser maiores que zero.');
  const escala = escalaDaRetificada(larguraMm, alturaMm, mmPorPx);
  const h = homografia([{ x: 0, y: 0 }, { x: larguraMm, y: 0 }, { x: larguraMm, y: alturaMm }, { x: 0, y: alturaMm }], cantos);
  const largura = Math.max(1, Math.round(larguraMm / escala));
  const altura = Math.max(1, Math.round(alturaMm / escala));
  const dados = new Uint8ClampedArray(largura * altura * 4);
  const L = foto.largura;
  const A = foto.altura;
  const f = foto.dados;
  for (let j = 0; j < altura; j++) {
    for (let i = 0; i < largura; i++) {
      const p = aplicarHomografia(h, { x: (i + 0.5) * escala, y: (j + 0.5) * escala });
      const x = p.x - 0.5;
      const y = p.y - 0.5;
      const o = (j * largura + i) * 4;
      if (!(x >= -0.5 && y >= -0.5 && x <= L - 0.5 && y <= A - 0.5)) {
        dados[o] = dados[o + 1] = dados[o + 2] = 255;
        dados[o + 3] = 255;
        continue;
      }
      const x0 = Math.max(0, Math.min(L - 1, Math.floor(x)));
      const y0 = Math.max(0, Math.min(A - 1, Math.floor(y)));
      const x1 = Math.min(L - 1, x0 + 1);
      const y1 = Math.min(A - 1, y0 + 1);
      const fx = Math.max(0, Math.min(1, x - x0));
      const fy = Math.max(0, Math.min(1, y - y0));
      for (let c = 0; c < 3; c++) {
        const v00 = f[(y0 * L + x0) * 4 + c]!;
        const v10 = f[(y0 * L + x1) * 4 + c]!;
        const v01 = f[(y1 * L + x0) * 4 + c]!;
        const v11 = f[(y1 * L + x1) * 4 + c]!;
        dados[o + c] = v00 * (1 - fx) * (1 - fy) + v10 * fx * (1 - fy) + v01 * (1 - fx) * fy + v11 * fx * fy;
      }
      dados[o + 3] = 255;
    }
  }
  return { largura, altura, dados };
}

// ---- A separação do molde

/** O brilho de cada pixel (0–255). */
export function tonsDeCinza(imagem: ImagemDePixels): Uint8Array {
  const n = imagem.largura * imagem.altura;
  const cinza = new Uint8Array(n);
  const d = imagem.dados;
  for (let i = 0; i < n; i++) cinza[i] = Math.round(0.299 * d[i * 4]! + 0.587 * d[i * 4 + 1]! + 0.114 * d[i * 4 + 2]!);
  return cinza;
}

/** O limiar que melhor separa os tons em dois grupos (Otsu). */
export function limiarDeOtsu(cinza: Uint8Array): number {
  const hist = new Array<number>(256).fill(0);
  for (const v of cinza) hist[v]!++;
  const total = cinza.length;
  let soma = 0;
  for (let t = 0; t < 256; t++) soma += t * hist[t]!;
  let somaB = 0;
  let pesoB = 0;
  let melhor = 0;
  let limiar = 127;
  for (let t = 0; t < 256; t++) {
    pesoB += hist[t]!;
    if (pesoB === 0) continue;
    const pesoF = total - pesoB;
    if (pesoF === 0) break;
    somaB += t * hist[t]!;
    const mB = somaB / pesoB;
    const mF = (soma - somaB) / pesoF;
    const entre = pesoB * pesoF * (mB - mF) * (mB - mF);
    if (entre > melhor) {
      melhor = entre;
      limiar = t;
    }
  }
  return limiar;
}

/** O molde: os pixels mais claros que o limiar (o papel sobre o fundo escuro), ou os mais escuros. */
export function mascaraDoMolde(cinza: Uint8Array, limiar: number, moldeEscuro: boolean): Uint8Array {
  const m = new Uint8Array(cinza.length);
  for (let i = 0; i < cinza.length; i++) m[i] = (moldeEscuro ? cinza[i]! <= limiar : cinza[i]! > limiar) ? 1 : 0;
  return m;
}

/** A região do molde ligada ao pixel clicado (vizinhos de lado); `null` se o pixel não é do molde. */
export function regiaoNoPonto(mascara: Uint8Array, largura: number, altura: number, x: number, y: number): Uint8Array | null {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  if (xi < 0 || yi < 0 || xi >= largura || yi >= altura || mascara[yi * largura + xi] !== 1) return null;
  const regiao = new Uint8Array(mascara.length);
  const pilha = [yi * largura + xi];
  regiao[yi * largura + xi] = 1;
  while (pilha.length > 0) {
    const i = pilha.pop()!;
    const px = i % largura;
    const py = (i - px) / largura;
    const vizinhos = [px > 0 ? i - 1 : -1, px < largura - 1 ? i + 1 : -1, py > 0 ? i - largura : -1, py < altura - 1 ? i + largura : -1];
    for (const v of vizinhos) {
      if (v >= 0 && mascara[v] === 1 && regiao[v] === 0) {
        regiao[v] = 1;
        pilha.push(v);
      }
    }
  }
  return regiao;
}

/** A região encosta na borda da imagem (é o fundo, ou o molde saiu da foto). */
export function encostaNaBorda(regiao: Uint8Array, largura: number, altura: number): boolean {
  for (let x = 0; x < largura; x++) if (regiao[x] || regiao[(altura - 1) * largura + x]) return true;
  for (let y = 0; y < altura; y++) if (regiao[y * largura] || regiao[y * largura + largura - 1]) return true;
  return false;
}

// ---- Os contornos pelas bordas dos pixels

/**
 * As voltas da borda da região, pelas arestas dos pixels (os cantos dos pixels são os pontos): cada aresta entre um
 * pixel da região e um de fora, no sentido que deixa a região à direita; no cruzamento em diagonal, vira à direita
 * (a região é ligada só pelos lados). A volta de fora é a de maior área; as outras são os buracos.
 */
export function voltasDaRegiao(regiao: Uint8Array, largura: number, altura: number): Ponto2D[][] {
  const dentro = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < largura && y < altura && regiao[y * largura + x] === 1;
  const W = largura + 1;
  // Cada aresta sai de um canto (o índice do canto) numa direção: 0 → +x, 1 → +y, 2 → −x, 3 → −y.
  const saidas = new Map<number, number[]>();
  const marcar = (cx: number, cy: number, d: number): void => {
    const k = cy * W + cx;
    const lista = saidas.get(k);
    if (lista) lista.push(d);
    else saidas.set(k, [d]);
  };
  for (let y = 0; y < altura; y++) {
    for (let x = 0; x < largura; x++) {
      if (regiao[y * largura + x] !== 1) continue;
      if (!dentro(x, y - 1)) marcar(x, y, 0);
      if (!dentro(x + 1, y)) marcar(x + 1, y, 1);
      if (!dentro(x, y + 1)) marcar(x + 1, y + 1, 2);
      if (!dentro(x - 1, y)) marcar(x, y + 1, 3);
    }
  }
  const DX = [1, 0, -1, 0];
  const DY = [0, 1, 0, -1];
  const voltas: Ponto2D[][] = [];
  for (const [inicio, lista] of saidas) {
    while (lista.length > 0) {
      let k = inicio;
      let d = lista.shift()!;
      const volta: Ponto2D[] = [];
      for (let passos = 0; passos < 4 * (largura + 2) * (altura + 2); passos++) {
        const cx = k % W;
        const cy = (k - cx) / W;
        volta.push({ x: cx, y: cy });
        const nx = cx + DX[d]!;
        const ny = cy + DY[d]!;
        k = ny * W + nx;
        const daqui = saidas.get(k);
        if (!daqui || daqui.length === 0) break;
        // Direita, em frente, esquerda (a região à direita, ligada só pelos lados).
        const ordem = [(d + 1) % 4, d, (d + 3) % 4];
        const escolhida = ordem.find((o) => daqui.includes(o));
        if (escolhida === undefined) break;
        daqui.splice(daqui.indexOf(escolhida), 1);
        d = escolhida;
      }
      voltas.push(semPontosEmLinha(volta));
    }
  }
  return voltas;
}

/** Tira os pontos do meio de um trecho reto (as arestas de pixel em sequência na mesma direção). */
function semPontosEmLinha(volta: readonly Ponto2D[]): Ponto2D[] {
  const n = volta.length;
  return volta.filter((p, i) => {
    const a = volta[(i - 1 + n) % n]!;
    const b = volta[(i + 1) % n]!;
    return (p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x) !== 0;
  });
}

// ---- Os furos, o fio e os piques

/** Quão redondo é o contorno (1: um círculo; perto de 0: uma linha). */
export function redondeza(contorno: readonly Ponto2D[]): number {
  const p = perimetro(contorno);
  return p > 0 ? (4 * Math.PI * area(contorno)) / (p * p) : 0;
}

/** O eixo maior de um conjunto de pontos (as pontas extremas na direção principal) e o alongamento. */
export function eixoPrincipal(pontos: readonly Ponto2D[]): { readonly inicio: Ponto2D; readonly fim: Ponto2D; readonly comprimento: number; readonly espessura: number } | null {
  if (pontos.length < 2) return null;
  const n = pontos.length;
  const cx = pontos.reduce((s, p) => s + p.x, 0) / n;
  const cy = pontos.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (const p of pontos) {
    sxx += (p.x - cx) ** 2;
    syy += (p.y - cy) ** 2;
    sxy += (p.x - cx) * (p.y - cy);
  }
  const angulo = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const ux = Math.cos(angulo);
  const uy = Math.sin(angulo);
  let min = Infinity;
  let max = -Infinity;
  let minT = Infinity;
  let maxT = -Infinity;
  for (const p of pontos) {
    const t = (p.x - cx) * ux + (p.y - cy) * uy;
    const s = -(p.x - cx) * uy + (p.y - cy) * ux;
    min = Math.min(min, t);
    max = Math.max(max, t);
    minT = Math.min(minT, s);
    maxT = Math.max(maxT, s);
  }
  return { inicio: { x: cx + ux * min, y: cy + uy * min }, fim: { x: cx + ux * max, y: cy + uy * max }, comprimento: max - min, espessura: maxT - minT };
}

export interface PiqueReconhecido {
  readonly posicao: Ponto2D;
  readonly indiceAresta: number;
}

/**
 * Os entalhes em V do contorno (fechado, em mm): três pontos A, B, C seguidos, com a abertura A–C de até
 * `aberturaMaxMm`, a ponta B de `profundidadeMinMm` a `profundidadeMaxMm` para dentro da peça. Cada um vira um pique
 * no meio de A–C, e a ponta sai do contorno.
 */
export function piquesDoContorno(
  contorno: readonly Ponto2D[],
  opcoes: { readonly aberturaMaxMm: number; readonly profundidadeMinMm: number; readonly profundidadeMaxMm: number },
): { readonly contorno: Ponto2D[]; readonly piques: PiqueReconhecido[] } {
  let pontos = [...contorno];
  const medios: Ponto2D[] = [];
  let achou = true;
  while (achou && pontos.length > 4) {
    achou = false;
    const n = pontos.length;
    for (let i = 0; i < n; i++) {
      const a = pontos[(i - 1 + n) % n]!;
      const b = pontos[i]!;
      const c = pontos[(i + 1) % n]!;
      const abertura = Math.hypot(c.x - a.x, c.y - a.y);
      if (abertura < 1e-9 || abertura > opcoes.aberturaMaxMm) continue;
      const profundidade = Math.abs((c.x - a.x) * (a.y - b.y) - (a.x - b.x) * (c.y - a.y)) / abertura;
      if (profundidade < opcoes.profundidadeMinMm || profundidade > opcoes.profundidadeMaxMm) continue;
      const semPonta = pontos.filter((_, k) => k !== i);
      // Para dentro: a ponta cai dentro da peça sem o entalhe (o entalhe é um corte, não uma saliência).
      if (!pontoDentroDoContorno(b, semPonta)) continue;
      medios.push({ x: (a.x + c.x) / 2, y: (a.y + c.y) / 2 });
      pontos = semPonta;
      achou = true;
      break;
    }
  }
  // O índice da aresta de cada pique no contorno final (a aresta mais perto do meio da abertura).
  const piques = medios.map((m) => {
    let melhor = 0;
    let menor = Infinity;
    for (let i = 0; i < pontos.length; i++) {
      const a = pontos[i]!;
      const b = pontos[(i + 1) % pontos.length]!;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const l2 = dx * dx + dy * dy;
      const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((m.x - a.x) * dx + (m.y - a.y) * dy) / l2));
      const d = Math.hypot(m.x - (a.x + t * dx), m.y - (a.y + t * dy));
      if (d < menor) {
        menor = d;
        melhor = i;
      }
    }
    return { posicao: m, indiceAresta: melhor };
  });
  return { contorno: pontos, piques };
}

// ---- O reconhecimento inteiro

export interface OpcoesDoReconhecimento {
  /** A escala da imagem (mm por pixel). */
  readonly mmPorPx: number;
  readonly limiar: number;
  /** O molde é mais escuro que o fundo (o papel escuro sobre a mesa clara). */
  readonly moldeEscuro: boolean;
  /** A tolerância da simplificação do contorno (mm). */
  readonly toleranciaMm: number;
  readonly procurarFuros: boolean;
  readonly procurarPiques: boolean;
  readonly sugerirFio: boolean;
}

export const OPCOES_PADRAO_DO_RECONHECIMENTO: Omit<OpcoesDoReconhecimento, 'mmPorPx' | 'limiar'> = {
  moldeEscuro: false,
  toleranciaMm: 1,
  procurarFuros: true,
  procurarPiques: true,
  sugerirFio: true,
};

export interface MoldeReconhecido {
  /** Em mm, nas coordenadas da imagem (x para a direita, y para baixo). */
  readonly contorno: Ponto2D[];
  readonly furos: Ponto2D[][];
  readonly piques: PiqueReconhecido[];
  readonly fio: { readonly inicio: Ponto2D; readonly fim: Ponto2D } | null;
  readonly avisos: string[];
}

/** O molde reconhecido a partir do clique dentro dele (no pixel `semente`). */
export function reconhecerMolde(imagem: ImagemDePixels, semente: Ponto2D, opcoes: OpcoesDoReconhecimento): MoldeReconhecido | { readonly erro: string } {
  const { largura, altura } = imagem;
  const cinza = tonsDeCinza(imagem);
  const mascara = mascaraDoMolde(cinza, opcoes.limiar, opcoes.moldeEscuro);
  const regiao = regiaoNoPonto(mascara, largura, altura, semente.x, semente.y);
  if (!regiao) {
    return { erro: `O clique não caiu no molde com este limiar: clique bem dentro do papel, ou mude o limiar ou o "molde ${opcoes.moldeEscuro ? 'mais escuro' : 'mais claro'} que o fundo".` };
  }
  const avisos: string[] = [];
  if (encostaNaBorda(regiao, largura, altura)) {
    avisos.push('A região encosta na borda da imagem: pode ser o fundo (troque "mais claro/mais escuro") ou o molde saiu da foto.');
  }
  const mm = opcoes.mmPorPx;
  const voltas = voltasDaRegiao(regiao, largura, altura).map((v) => v.map((p) => ({ x: p.x * mm, y: p.y * mm })));
  if (voltas.length === 0) return { erro: 'Não foi possível seguir o contorno da região.' };
  const ordenadas = [...voltas].sort((a, b) => area(b) - area(a));
  let contorno: Ponto2D[] = [...simplificarContorno(ordenadas[0]!, opcoes.toleranciaMm)];
  if (contorno.length < 3 || area(contorno) < 100) return { erro: 'A região é pequena demais para um molde (menos de 1 cm²): confira o limiar e a escala.' };
  const buracos = ordenadas.slice(1).filter((v) => v.length >= 4);
  // Os buracos redondos (de 3 mm² para cima) são furos; o maior comprido e fino é o traço do fio.
  const furos = opcoes.procurarFuros
    ? buracos.filter((b) => area(b) >= 3 && redondeza(b) >= 0.45).map((b) => [...simplificarContorno(b, Math.min(opcoes.toleranciaMm, 0.5))])
    : [];
  let fio: MoldeReconhecido['fio'] = null;
  if (opcoes.sugerirFio) {
    const tracos = buracos
      .map((b) => ({ b, eixo: eixoPrincipal(b) }))
      .filter((x) => x.eixo !== null && x.eixo.comprimento >= 30 && x.eixo.comprimento >= 8 * Math.max(x.eixo.espessura, mm))
      .sort((a, b) => b.eixo!.comprimento - a.eixo!.comprimento);
    if (tracos[0]) fio = { inicio: tracos[0].eixo!.inicio, fim: tracos[0].eixo!.fim };
    else avisos.push('O fio não foi achado (um traço reto, comprido e fino dentro do molde): marque-o à mão.');
  }
  let piques: PiqueReconhecido[] = [];
  if (opcoes.procurarPiques) {
    const r = piquesDoContorno(contorno, { aberturaMaxMm: 12, profundidadeMinMm: Math.max(1.5, 2 * opcoes.toleranciaMm), profundidadeMaxMm: 15 });
    contorno = r.contorno;
    piques = r.piques;
  }
  return { contorno, furos, piques, fio, avisos };
}

/** As medidas do contorno (mm e mm²). */
export function medidasDoContorno(contorno: readonly Ponto2D[]): { readonly largura: number; readonly altura: number; readonly perimetro: number; readonly area: number } {
  const caixa = retanguloEnvolvente(contorno);
  return { largura: caixa.largura, altura: caixa.altura, perimetro: perimetro(contorno), area: area(contorno) };
}

/** O molde reconhecido em outra escala (a conferida por uma medida conhecida). */
export function escalarReconhecido(m: MoldeReconhecido, fator: number): MoldeReconhecido {
  const e = (p: Ponto2D): Ponto2D => ({ x: p.x * fator, y: p.y * fator });
  return {
    ...m,
    contorno: m.contorno.map(e),
    furos: m.furos.map((f) => f.map(e)),
    piques: m.piques.map((p) => ({ ...p, posicao: e(p.posicao) })),
    fio: m.fio ? { inicio: e(m.fio.inicio), fim: e(m.fio.fim) } : null,
  };
}

/**
 * O molde reconhecido nas coordenadas do desenho do programa: a tela deita a mesa (o x do mundo é a vertical da tela
 * e o y, a horizontal), então o ponto (x, y) da imagem vira (y, x) — a peça aparece como na foto — e vai para `origem`.
 */
export function paraODesenho(m: MoldeReconhecido, origem: Ponto2D): MoldeReconhecido {
  const caixa = retanguloEnvolvente(m.contorno);
  const t = (p: Ponto2D): Ponto2D => ({ x: Math.round((origem.x + (p.y - caixa.minY)) * 100) / 100, y: Math.round((origem.y + (p.x - caixa.minX)) * 100) / 100 });
  return {
    ...m,
    contorno: m.contorno.map(t),
    furos: m.furos.map((f) => f.map(t)),
    piques: m.piques.map((p) => ({ ...p, posicao: t(p.posicao) })),
    fio: m.fio ? { inicio: t(m.fio.inicio), fim: t(m.fio.fim) } : null,
  };
}

import type { Contorno, Ponto2D } from '../core/geometria';
import type { Molde } from './molde';
import { abrirSimetrias } from './anotacoes';
import { corpoDoManequim, medidasConferidas, MEDIDAS_DO_PUBLICO, perimetroDaElipse, semiEixosMaximosDoTronco, type CorpoDoManequim, type MedidasDoManequim, type PublicoDoManequim } from './manequim';
import { malhaDaPeca, trechoDaBorda, type MalhaDaPeca } from './malhaDaPeca';

/**
 * A montagem do provador 3D (ADR 0111): que peça vai onde no corpo, as costuras, o tecido e a aparência. Fica no
 * projeto (`Projeto.montagem3d`); o que a simulação calcula (as posições do tecido) não. Cada cópia de uma peça é
 * uma "instância" (a manga em par: a direita e a esquerda, espelhada), pela chave `id da peça#cópia`; a peça com
 * linha de simetria entra desdobrada (a peça inteira).
 */

export type PosicaoNoCorpo =
  | 'fora'
  | 'frente'
  | 'costas'
  | 'lado-direito'
  | 'lado-esquerdo'
  | 'manga-direita'
  | 'manga-esquerda'
  | 'perna-direita-frente'
  | 'perna-direita-costas'
  | 'perna-esquerda-frente'
  | 'perna-esquerda-costas';

export const ROTULO_DA_POSICAO: Readonly<Record<PosicaoNoCorpo, string>> = {
  fora: 'Fora (não vai ao corpo)',
  frente: 'Frente do corpo',
  costas: 'Costas',
  'lado-direito': 'Lado direito',
  'lado-esquerdo': 'Lado esquerdo',
  'manga-direita': 'Braço direito (manga)',
  'manga-esquerda': 'Braço esquerdo (manga)',
  'perna-direita-frente': 'Perna direita, frente',
  'perna-direita-costas': 'Perna direita, costas',
  'perna-esquerda-frente': 'Perna esquerda, frente',
  'perna-esquerda-costas': 'Perna esquerda, costas',
};

export type AlturaDoTopo = 'pescoco' | 'ombro' | 'busto' | 'cintura' | 'quadril';

export const ROTULO_DA_ALTURA: Readonly<Record<AlturaDoTopo, string>> = {
  pescoco: 'No pescoço',
  ombro: 'No ombro',
  busto: 'No busto',
  cintura: 'Na cintura',
  quadril: 'No quadril',
};

export type ModoDaEstampa = 'corrida' | 'localizada';

export interface EstampaDaPeca {
  readonly imagemId: string;
  /** Corrida: repete pela peça toda; localizada: uma vez, no meio da peça. */
  readonly modo: ModoDaEstampa;
  /** A largura da imagem na peça (mm). */
  readonly larguraMm: number;
  /** Na localizada: quanto o meio da estampa sobe (+) ou desce (−) do meio da peça (mm). */
  readonly alturaMm: number;
}

export interface ConfiguracaoDaInstancia {
  readonly posicao: PosicaoNoCorpo;
  readonly alturaDoTopo: AlturaDoTopo;
  /** Sobe (+) ou desce (−) o topo da peça (mm). */
  readonly ajusteMm: number;
  /** Desloca a peça em volta do corpo (mm): + para a direita de quem olha a peça. */
  readonly desvioMm: number;
  /** Gira a peça (graus, de 90 em 90) em relação ao fio na vertical. */
  readonly girarGraus: 0 | 90 | 180 | 270;
  readonly cor: string;
  readonly estampa?: EstampaDaPeca;
}

/** Um lado de uma costura: o trecho do contorno da instância, do ponto `de` ao `ate` (no sentido do contorno). */
export interface LadoDaCostura {
  readonly chave: string;
  readonly de: number;
  readonly ate: number;
  /** Como o contorno era quando a costura foi feita (pontos:perímetro), para avisar se o molde mudou. */
  readonly assinatura: string;
}

export interface Costura3D {
  readonly id: string;
  readonly a: LadoDaCostura;
  readonly b: LadoDaCostura;
  /** `false`: o começo de A vai com o começo de B; `true`: com o fim de B. */
  readonly invertida: boolean;
}

export type PresetDeTecido = 'malha' | 'moletom' | 'tricoline' | 'jeans' | 'seda' | 'linho' | 'personalizado';

export interface Tecido3D {
  readonly preset: PresetDeTecido;
  /** Gramatura (g/m²). */
  readonly pesoGm2: number;
  /** De 0 (não estica) a 100 (estica muito). */
  readonly elasticidade: number;
  /** De 0 (mole, cai como seda) a 100 (firme, como o jeans). */
  readonly rigidez: number;
  /** De 0 (escorrega) a 100 (agarra no corpo). */
  readonly atrito: number;
}

export const TECIDOS_PRONTOS: Readonly<Record<Exclude<PresetDeTecido, 'personalizado'>, { readonly nome: string; readonly tecido: Tecido3D }>> = {
  malha: { nome: 'Malha de algodão (meia malha)', tecido: { preset: 'malha', pesoGm2: 160, elasticidade: 70, rigidez: 20, atrito: 50 } },
  moletom: { nome: 'Moletom', tecido: { preset: 'moletom', pesoGm2: 300, elasticidade: 45, rigidez: 55, atrito: 60 } },
  tricoline: { nome: 'Tricoline (algodão plano)', tecido: { preset: 'tricoline', pesoGm2: 120, elasticidade: 10, rigidez: 45, atrito: 40 } },
  jeans: { nome: 'Jeans', tecido: { preset: 'jeans', pesoGm2: 380, elasticidade: 5, rigidez: 85, atrito: 55 } },
  seda: { nome: 'Seda / viscose', tecido: { preset: 'seda', pesoGm2: 90, elasticidade: 15, rigidez: 5, atrito: 20 } },
  linho: { nome: 'Linho', tecido: { preset: 'linho', pesoGm2: 180, elasticidade: 5, rigidez: 65, atrito: 45 } },
};

export interface ManequimDaMontagem {
  readonly publico: PublicoDoManequim;
  readonly medidas: MedidasDoManequim;
  /** O tamanho da ficha usado para as medidas (ausente: as do público, ou digitadas). */
  readonly tamanhoDaFicha?: string;
}

export interface Montagem3D {
  readonly manequim: ManequimDaMontagem;
  readonly pecas: Readonly<Record<string, ConfiguracaoDaInstancia>>;
  readonly costuras: readonly Costura3D[];
  readonly tecido: Tecido3D;
  /** A distância entre os pontos da malha do tecido (mm): menor, mais fino e mais lento. */
  readonly resolucaoMm: number;
}

export const MONTAGEM_VAZIA: Montagem3D = {
  manequim: { publico: 'feminino', medidas: MEDIDAS_DO_PUBLICO.feminino },
  pecas: {},
  costuras: [],
  tecido: TECIDOS_PRONTOS.malha.tecido,
  resolucaoMm: 20,
};

// ---- As instâncias (as cópias das peças, inteiras)

export interface InstanciaDaPeca {
  readonly chave: string;
  readonly peca: Molde;
  readonly copia: number;
  /** A segunda de um par (a esquerda): espelhada. */
  readonly espelhada: boolean;
  readonly nome: string;
  /** O contorno inteiro (a peça de simetria desdobrada). */
  readonly contorno: Contorno;
  readonly assinatura: string;
}

const perimetroDe = (c: Contorno): number => c.reduce((s, p, i) => s + Math.hypot(c[(i + 1) % c.length]!.x - p.x, c[(i + 1) % c.length]!.y - p.y), 0);

export const assinaturaDoContorno = (c: Contorno): string => `${c.length}:${Math.round(perimetroDe(c))}`;

/** As instâncias das peças: cada cópia (até 4 por peça), com a peça de simetria aberta. */
export function instanciasDasPecas(pecas: readonly Molde[]): InstanciaDaPeca[] {
  const lista: InstanciaDaPeca[] = [];
  for (const original of pecas) {
    if (original.contorno.length < 3) continue;
    let peca = original;
    try {
      peca = abrirSimetrias([original], () => original.id)[0]!;
    } catch {
      peca = original;
    }
    const copias = Math.min(4, Math.max(1, Math.round(original.quantidade)));
    for (let c = 0; c < copias; c++) {
      const espelhada = original.emPar === true && c % 2 === 1;
      lista.push({
        chave: `${original.id}#${c}`,
        peca,
        copia: c,
        espelhada,
        nome: copias > 1 ? `${original.nome} (${original.emPar ? (c % 2 === 0 ? 'direita' : 'esquerda') : `${c + 1}ª`})` : original.nome,
        contorno: peca.contorno,
        assinatura: assinaturaDoContorno(peca.contorno),
      });
    }
  }
  return lista;
}

const semAcento = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const contornoComoPontos = (c: Contorno): Float64Array => {
  const a = new Float64Array(c.length * 2);
  c.forEach((p, i) => {
    a[2 * i] = p.x;
    a[2 * i + 1] = p.y;
  });
  return a;
};

/** A cor de partida das peças: a mesma em todas (uma roupa é de um tecido só); cada uma pode mudar depois. */
export const COR_DE_PARTIDA = '#3f7fb5';

/** A configuração de partida de uma instância, pelo nome da peça. */
export function configuracaoSugerida(instancia: InstanciaDaPeca, largura: number): ConfiguracaoDaInstancia {
  const n = semAcento(instancia.peca.nome);
  const baixo = /saia|calca|bermuda|short|cos\b/.test(n);
  const base: ConfiguracaoDaInstancia = { posicao: 'fora', alturaDoTopo: baixo ? 'cintura' : 'ombro', ajusteMm: 0, desvioMm: 0, girarGraus: 0, cor: COR_DE_PARTIDA };
  const par = instancia.copia % 2 === 1;
  const muitas = instancia.peca.quantidade > 1;
  if (/manga/.test(n)) return { ...base, posicao: par ? 'manga-esquerda' : 'manga-direita' };
  if (/calca|bermuda|short/.test(n)) {
    if (/costas|traseir/.test(n)) return { ...base, posicao: par ? 'perna-esquerda-costas' : 'perna-direita-costas' };
    return { ...base, posicao: par ? 'perna-esquerda-frente' : 'perna-direita-frente' };
  }
  if (/costas|traseir/.test(n)) return { ...base, posicao: 'costas', desvioMm: muitas ? (par ? -1 : 1) * (largura / 2) : 0 };
  if (/frente|dianteir/.test(n)) return { ...base, posicao: 'frente', desvioMm: muitas ? (par ? 1 : -1) * (largura / 2) : 0 };
  if (/lateral/.test(n)) return { ...base, posicao: par ? 'lado-esquerdo' : 'lado-direito' };
  return base;
}

// ---- A peça vista pela face: as coordenadas de cima e da direita

/**
 * A peça como aparece na tela (x da tela = y do mundo; y da tela para cima = −x do mundo), girada para o fio ficar
 * na vertical (para cima), mais o giro pedido; espelhada na segunda do par. Devolve, para cada ponto, `u` (para a
 * direita de quem olha a face) e `v` (para cima), sem centrar.
 */
function faceSemCentrar(instancia: InstanciaDaPeca, girarGraus: number, pontos: ArrayLike<number>): { u: Float64Array; v: Float64Array } {
  const { cima, direita } = eixosDaFace(instancia.peca.linhaDeFio, girarGraus);
  const n = pontos.length / 2;
  const u = new Float64Array(n);
  const v = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const sx = pontos[2 * i + 1]!;
    const sy = -pontos[2 * i]!;
    u[i] = (sx * direita.x + sy * direita.y) * (instancia.espelhada ? -1 : 1);
    v[i] = sx * cima.x + sy * cima.y;
  }
  return { u, v };
}

/**
 * Os eixos da peça vista pela face, na tela (o x para a direita, o y para cima): o alto pelo fio — o fio apontando
 * para cima; deitado, para a direita, o alto do desenho de um CAD (o y do arquivo), que entra assim — mais o giro
 * pedido (no sentido horário de quem olha); a direita, a 90° dele. Servem ao provador 3D e à estampa no encaixe.
 */
export function eixosDaFace(fio: { readonly inicio: Ponto2D; readonly fim: Ponto2D }, girarGraus = 0): { readonly cima: Ponto2D; readonly direita: Ponto2D } {
  let fx = fio.fim.y - fio.inicio.y;
  let fy = -(fio.fim.x - fio.inicio.x);
  const L = Math.hypot(fx, fy);
  if (L < 1e-9) {
    fx = 0;
    fy = 1;
  } else {
    fx /= L;
    fy /= L;
  }
  if (fy < -0.3 || (Math.abs(fy) <= 0.3 && fx < 0)) {
    fx = -fx;
    fy = -fy;
  }
  const ang = (girarGraus * Math.PI) / 180;
  const cima = { x: fx * Math.cos(ang) + fy * Math.sin(ang), y: -fx * Math.sin(ang) + fy * Math.cos(ang) };
  return { cima, direita: { x: cima.y, y: -cima.x } };
}

/** O meio, a largura e a altura do contorno da peça vista pela face. */
function caixaDaFace(instancia: InstanciaDaPeca, girarGraus: number): { cu: number; cv: number; largura: number; altura: number } {
  const { u, v } = faceSemCentrar(instancia, girarGraus, contornoComoPontos(instancia.contorno));
  let minU = Infinity;
  let maxU = -Infinity;
  let minV = Infinity;
  let maxV = -Infinity;
  for (let i = 0; i < u.length; i++) {
    minU = Math.min(minU, u[i]!);
    maxU = Math.max(maxU, u[i]!);
    minV = Math.min(minV, v[i]!);
    maxV = Math.max(maxV, v[i]!);
  }
  return { cu: (minU + maxU) / 2, cv: (minV + maxV) / 2, largura: maxU - minU, altura: maxV - minV };
}

/** Os pontos vistos pela face (`u` para a direita, `v` para cima), com o meio do contorno em (0, 0). */
export function coordenadasDaFace(instancia: InstanciaDaPeca, girarGraus: number, pontos: ArrayLike<number>): { u: Float64Array; v: Float64Array; largura: number; altura: number } {
  const caixa = caixaDaFace(instancia, girarGraus);
  const { u, v } = faceSemCentrar(instancia, girarGraus, pontos);
  for (let i = 0; i < u.length; i++) {
    u[i] = u[i]! - caixa.cu;
    v[i] = v[i]! - caixa.cv;
  }
  return { u, v, largura: caixa.largura, altura: caixa.altura };
}

/** A largura da peça (vista pela face, com o fio na vertical). */
export function larguraDaFace(instancia: InstanciaDaPeca, girarGraus = 0): number {
  return caixaDaFace(instancia, girarGraus).largura;
}

// ---- A arrumação em volta do corpo

export function alturaDoNivel(corpo: CorpoDoManequim, nivel: AlturaDoTopo): number {
  switch (nivel) {
    case 'pescoco':
      return corpo.niveis.pescoco + 10;
    case 'ombro':
      return corpo.niveis.ombro + 25;
    case 'busto':
      return corpo.niveis.busto;
    case 'cintura':
      return corpo.niveis.cintura + 15;
    case 'quadril':
      return corpo.niveis.quadril;
  }
}

/**
 * As posições de partida (x, y, z) dos `pontos` (x, y seguidos, nas coordenadas da peça): enrolados num cilindro em
 * volta do tronco, de um braço ou de uma perna, com a face para fora, o topo na altura pedida. `null`: fora.
 */
export function posicoesDeArrumacao(corpo: CorpoDoManequim, instancia: InstanciaDaPeca, config: ConfiguracaoDaInstancia, pontos: ArrayLike<number>): Float64Array | null {
  if (config.posicao === 'fora') return null;
  const face = coordenadasDaFace(instancia, config.girarGraus, pontos);
  const contorno = { largura: face.largura, altura: face.altura };
  const n = pontos.length / 2;
  const topo = alturaDoNivel(corpo, config.alturaDoTopo) + config.ajusteMm;
  const vMax = contorno.altura / 2;
  const W = contorno.largura;
  const saida = new Float64Array(n * 3);
  const p = config.posicao;
  if (p === 'manga-direita' || p === 'manga-esquerda') {
    const lado = p === 'manga-direita' ? -1 : 1;
    const braco = lado < 0 ? corpo.bracos.direito : corpo.bracos.esquerdo;
    const dx = braco.fim.x - braco.inicio.x;
    const dy = braco.fim.y - braco.inicio.y;
    const dz = braco.fim.z - braco.inicio.z;
    const L = Math.hypot(dx, dy, dz) || 1;
    const d = { x: dx / L, y: dy / L, z: dz / L };
    // e1: para fora e para cima, perpendicular ao braço; e2: para a direita de quem olha de fora.
    const e1 = { x: lado * -d.y, y: lado * d.x, z: 0 };
    const e1l = Math.hypot(e1.x, e1.y) || 1;
    e1.x /= e1l;
    e1.y /= e1l;
    const e2 = { x: 0, y: 0, z: -lado };
    const r = Math.max(W / (2 * Math.PI), braco.raio + 25);
    const inicio = -braco.raio * 0.8 + config.ajusteMm * -1;
    for (let i = 0; i < n; i++) {
      const l = inicio + (vMax - face.v[i]!);
      const f = (face.u[i]! + config.desvioMm) / r;
      const c = { x: braco.inicio.x + d.x * l, y: braco.inicio.y + d.y * l, z: braco.inicio.z + d.z * l };
      saida[3 * i] = c.x + r * (Math.cos(f) * e1.x + Math.sin(f) * e2.x);
      saida[3 * i + 1] = c.y + r * (Math.cos(f) * e1.y + Math.sin(f) * e2.y);
      saida[3 * i + 2] = c.z + r * (Math.cos(f) * e1.z + Math.sin(f) * e2.z);
    }
    return saida;
  }
  // Em volta do tronco (ou da perna): uma elipse afastada do corpo, grande o bastante para meia volta caber na peça
  // (a frente e as costas se encontram dos lados); a peça vai por ela medida pelo comprimento, sem esticar.
  let cx = 0;
  let A: number;
  let B: number;
  if (p.startsWith('perna-')) {
    const perna = p.startsWith('perna-direita') ? corpo.pernas.direita : corpo.pernas.esquerda;
    cx = perna.inicio.x;
    A = B = Math.max(W / Math.PI, perna.raio + 30);
  } else {
    const eixos = semiEixosMaximosDoTronco(corpo, topo - contorno.altura, topo);
    A = eixos.a + 30;
    B = eixos.b + 30;
    const meiaVolta = perimetroDaElipse(A, B) / 2;
    if (W > meiaVolta) {
      A *= W / meiaVolta;
      B *= W / meiaVolta;
    }
  }
  const angulo0 =
    p === 'frente' || p.endsWith('-frente') ? 0 : p === 'costas' || p.endsWith('-costas') ? Math.PI : p === 'lado-direito' ? (3 * Math.PI) / 2 : Math.PI / 2;
  const elipse = elipsePeloComprimento(A, B);
  for (let i = 0; i < n; i++) {
    const q = elipse(angulo0, face.u[i]! + config.desvioMm);
    saida[3 * i] = cx + q.x;
    saida[3 * i + 1] = topo - (vMax - face.v[i]!);
    saida[3 * i + 2] = q.z;
  }
  return saida;
}

/**
 * Os pontos de uma elipse (meia largura `A` em x, meia profundidade `B` em z) pela distância ao longo dela: a
 * partir do ângulo `inicio` (0 é a frente, +z; π/2 é +x), andando `s` mm no sentido de +x.
 */
function elipsePeloComprimento(A: number, B: number): (inicio: number, s: number) => { x: number; z: number } {
  const N = 720;
  const acumulado = new Float64Array(N + 1);
  for (let k = 1; k <= N; k++) {
    const f0 = (2 * Math.PI * (k - 1)) / N;
    const f1 = (2 * Math.PI * k) / N;
    acumulado[k] = acumulado[k - 1]! + Math.hypot(A * (Math.sin(f1) - Math.sin(f0)), B * (Math.cos(f1) - Math.cos(f0)));
  }
  const P = acumulado[N]!;
  const comprimentoNoAngulo = (f: number): number => {
    const g = ((f % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const k = Math.min(N - 1, Math.floor((g / (2 * Math.PI)) * N));
    const resto = (g / (2 * Math.PI)) * N - k;
    return acumulado[k]! + (acumulado[k + 1]! - acumulado[k]!) * resto;
  };
  return (inicio, s) => {
    let alvo = (comprimentoNoAngulo(inicio) + s) % P;
    if (alvo < 0) alvo += P;
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (acumulado[m]! <= alvo) lo = m;
      else hi = m;
    }
    const passo = acumulado[lo + 1]! - acumulado[lo]!;
    const f = ((lo + (passo > 0 ? (alvo - acumulado[lo]!) / passo : 0)) * 2 * Math.PI) / N;
    return { x: A * Math.sin(f), z: B * Math.cos(f) };
  };
}

// ---- As costuras sugeridas

interface LadoDoContorno {
  readonly de: number;
  readonly ate: number;
  readonly comprimento: number;
}

/** Os lados do contorno: os trechos entre os cantos (onde a direção muda mais de 35°). */
export function ladosDoContorno(contorno: Contorno): LadoDoContorno[] {
  const n = contorno.length;
  const cantos: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = contorno[(i - 1 + n) % n]!;
    const b = contorno[i]!;
    const c = contorno[(i + 1) % n]!;
    const v1 = { x: b.x - a.x, y: b.y - a.y };
    const v2 = { x: c.x - b.x, y: c.y - b.y };
    const l1 = Math.hypot(v1.x, v1.y);
    const l2 = Math.hypot(v2.x, v2.y);
    if (l1 < 1e-9 || l2 < 1e-9) continue;
    const cos = (v1.x * v2.x + v1.y * v2.y) / (l1 * l2);
    if (cos < Math.cos((35 * Math.PI) / 180)) cantos.push(i);
  }
  if (cantos.length < 2) return [];
  const lados: LadoDoContorno[] = [];
  for (let k = 0; k < cantos.length; k++) {
    const de = cantos[k]!;
    const ate = cantos[(k + 1) % cantos.length]!;
    let comprimento = 0;
    for (let i = de; i !== ate; i = (i + 1) % n) comprimento += Math.hypot(contorno[(i + 1) % n]!.x - contorno[i]!.x, contorno[(i + 1) % n]!.y - contorno[i]!.y);
    lados.push({ de, ate, comprimento });
  }
  return lados;
}

/** O comprimento do trecho do contorno de `de` a `ate` (no sentido do contorno). */
export function comprimentoDoTrecho(contorno: Contorno, de: number, ate: number): number {
  const n = contorno.length;
  let s = 0;
  for (let i = de; i !== ate; i = (i + 1) % n) s += Math.hypot(contorno[(i + 1) % n]!.x - contorno[i]!.x, contorno[(i + 1) % n]!.y - contorno[i]!.y);
  return s;
}

/** O ponto à fração `f` (0 a 1) do trecho de `de` a `ate` do contorno. */
function pontoNoTrecho(contorno: Contorno, de: number, ate: number, f: number): Ponto2D {
  const total = comprimentoDoTrecho(contorno, de, ate);
  const n = contorno.length;
  let alvo = total * f;
  for (let i = de; i !== ate; i = (i + 1) % n) {
    const a = contorno[i]!;
    const b = contorno[(i + 1) % n]!;
    const L = Math.hypot(b.x - a.x, b.y - a.y);
    if (alvo <= L || (i + 1) % n === ate) {
      const t = L > 0 ? Math.min(1, alvo / L) : 0;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
    alvo -= L;
  }
  return contorno[ate]!;
}

/** Onde cada ponto do trecho fica na arrumação (5 pontos, do começo ao fim). */
function trechoArrumado(corpo: CorpoDoManequim, inst: InstanciaDaPeca, config: ConfiguracaoDaInstancia, de: number, ate: number): Float64Array | null {
  const pts: number[] = [];
  for (let k = 0; k <= 4; k++) {
    const p = pontoNoTrecho(inst.contorno, de, ate, k / 4);
    pts.push(p.x, p.y);
  }
  return posicoesDeArrumacao(corpo, inst, config, pts);
}

/**
 * O sentido em que dois trechos arrumados ficam mais perto; as distâncias entre eles (nos 5 pontos, em 3D) e a
 * média sem o z (vistos de frente).
 */
function compararTrechos(a: Float64Array, b: Float64Array): { invertida: boolean; distancias: number[]; media: number; mediaSemZ: number } {
  const distancias = (inv: boolean, semZ: boolean): number[] => {
    const d: number[] = [];
    for (let k = 0; k <= 4; k++) {
      const j = inv ? 4 - k : k;
      d.push(Math.hypot(a[3 * k]! - b[3 * j]!, a[3 * k + 1]! - b[3 * j + 1]!, semZ ? 0 : a[3 * k + 2]! - b[3 * j + 2]!));
    }
    return d;
  };
  const soma = (d: number[]): number => d.reduce((s, x) => s + x, 0);
  const direta = distancias(false, false);
  const inversa = distancias(true, false);
  const invertida = soma(inversa) < soma(direta);
  const d = invertida ? inversa : direta;
  return { invertida, distancias: d, media: soma(d) / 5, mediaSemZ: soma(distancias(invertida, true)) / 5 };
}

/**
 * Os dois trechos correm lado a lado na arrumação: perto de ponta a ponta (até 16 cm, ou 40% do comprimento — numa
 * peça justa a frente e as costas não chegam a se tocar antes da costura), e o meio não mais longe que a média das
 * pontas (a barra da frente e a das costas se tocam nas pontas, mas o meio fica longe).
 */
function ladoALado(d: readonly number[], comprimento: number): boolean {
  const pontas = (d[0]! + d[4]!) / 2;
  return d[2]! <= pontas + 40 && Math.max(...d) <= Math.max(160, comprimento * 0.4);
}

/**
 * As costuras que a arrumação sugere: dois lados de mesmo comprimento (até 3%), em pé, que correm lado a lado em
 * volta do corpo (as laterais, embaixo do braço), ou deitados no alto das duas peças, um sobre o outro visto de
 * frente (os ombros). A cava com a manga, a gola e o que mais houver se escolhem à mão.
 */
export function sugerirCosturas(corpo: CorpoDoManequim, instancias: readonly InstanciaDaPeca[], montagem: Montagem3D, novoId: () => string): Costura3D[] {
  interface Candidato {
    readonly inst: InstanciaDaPeca;
    readonly lado: LadoDoContorno;
    readonly arrumado: Float64Array;
    /** No alto de uma peça de cima e mais deitado que em pé: um ombro. */
    readonly noAlto: boolean;
    /** Mais em pé que deitado, e fora da faixa de cima da peça (onde fica a cava): uma lateral, o embaixo do braço. */
    readonly lateral: boolean;
  }
  const candidatos: Candidato[] = [];
  for (const inst of instancias) {
    const config = montagem.pecas[inst.chave];
    if (!config || config.posicao === 'fora') continue;
    const todos = posicoesDeArrumacao(corpo, inst, config, contornoComoPontos(inst.contorno));
    if (!todos) continue;
    let yMax = -Infinity;
    let yMin = Infinity;
    for (let i = 0; i < inst.contorno.length; i++) {
      yMax = Math.max(yMax, todos[3 * i + 1]!);
      yMin = Math.min(yMin, todos[3 * i + 1]!);
    }
    for (const lado of ladosDoContorno(inst.contorno)) {
      if (lado.comprimento < 30) continue;
      const arrumado = trechoArrumado(corpo, inst, config, lado.de, lado.ate);
      if (!arrumado) continue;
      let yLado = 0;
      for (let k = 0; k <= 4; k++) yLado += arrumado[3 * k + 1]! / 5;
      // O ombro: no alto das peças de cima (as que começam no ombro ou no pescoço; o cós de uma saia não), e mais
      // deitado que em pé (a cava, também no alto, desce).
      const deCima = config.alturaDoTopo === 'ombro' || config.alturaDoTopo === 'pescoco';
      const subida = Math.abs(arrumado[13]! - arrumado[1]!);
      const avanco = Math.hypot(arrumado[12]! - arrumado[0]!, arrumado[14]! - arrumado[2]!);
      const naFaixaDeCima = yLado > yMax - (yMax - yMin) * 0.25;
      candidatos.push({ inst, lado, arrumado, noAlto: deCima && subida < avanco && naFaixaDeCima, lateral: subida >= avanco && !naFaixaDeCima });
    }
  }
  const usados = new Set<string>();
  for (const c of montagem.costuras) {
    usados.add(`${c.a.chave}|${c.a.de}|${c.a.ate}`);
    usados.add(`${c.b.chave}|${c.b.de}|${c.b.ate}`);
  }
  const pares: { a: Candidato; b: Candidato; invertida: boolean; nota: number }[] = [];
  for (let i = 0; i < candidatos.length; i++) {
    for (let j = i + 1; j < candidatos.length; j++) {
      const a = candidatos[i]!;
      const b = candidatos[j]!;
      const maior = Math.max(a.lado.comprimento, b.lado.comprimento);
      if (Math.abs(a.lado.comprimento - b.lado.comprimento) > Math.max(4, maior * 0.03)) continue;
      const c = compararTrechos(a.arrumado, b.arrumado);
      if (a.lateral && b.lateral && ladoALado(c.distancias, maior)) pares.push({ a, b, invertida: c.invertida, nota: c.media });
      else if (a.noAlto && b.noAlto && a.inst.chave !== b.inst.chave && c.mediaSemZ < 60) pares.push({ a, b, invertida: c.invertida, nota: 100 + c.mediaSemZ });
    }
  }
  pares.sort((x, y) => x.nota - y.nota);
  const novas: Costura3D[] = [];
  const chave = (c: Candidato): string => `${c.inst.chave}|${c.lado.de}|${c.lado.ate}`;
  for (const p of pares) {
    if (usados.has(chave(p.a)) || usados.has(chave(p.b))) continue;
    usados.add(chave(p.a));
    usados.add(chave(p.b));
    novas.push({
      id: novoId(),
      a: { chave: p.a.inst.chave, de: p.a.lado.de, ate: p.a.lado.ate, assinatura: p.a.inst.assinatura },
      b: { chave: p.b.inst.chave, de: p.b.lado.de, ate: p.b.lado.ate, assinatura: p.b.inst.assinatura },
      invertida: p.invertida,
    });
  }
  return novas;
}

/** O sentido em que a costura nova fica mais perto na arrumação (`true`: o começo de A com o fim de B). */
export function sentidoSugerido(corpo: CorpoDoManequim, a: { inst: InstanciaDaPeca; config: ConfiguracaoDaInstancia; de: number; ate: number }, b: { inst: InstanciaDaPeca; config: ConfiguracaoDaInstancia; de: number; ate: number }): boolean {
  const ta = trechoArrumado(corpo, a.inst, a.config, a.de, a.ate);
  const tb = trechoArrumado(corpo, b.inst, b.config, b.de, b.ate);
  if (!ta || !tb) return true;
  return compararTrechos(ta, tb).invertida;
}

/** O que está errado com uma costura agora (a peça sumiu, o ponto não existe, o molde mudou); vazio: está boa. */
export function problemasDaCostura(costura: Costura3D, instancias: readonly InstanciaDaPeca[]): string[] {
  const problemas: string[] = [];
  for (const [rotulo, lado] of [
    ['A', costura.a],
    ['B', costura.b],
  ] as const) {
    const inst = instancias.find((i) => i.chave === lado.chave);
    if (!inst) {
      problemas.push(`O lado ${rotulo}: a peça não está mais no projeto.`);
      continue;
    }
    if (lado.de >= inst.contorno.length || lado.ate >= inst.contorno.length || lado.de === lado.ate) problemas.push(`O lado ${rotulo} (${inst.nome}): os pontos ${lado.de}–${lado.ate} não existem mais no contorno.`);
    else if (lado.assinatura !== inst.assinatura) problemas.push(`O lado ${rotulo} (${inst.nome}): o molde mudou depois desta costura — confira os pontos.`);
  }
  return problemas;
}

// ---- A leitura (de dentro do projeto)

const ehObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);
const numero = (x: unknown, padrao: number): number => (typeof x === 'number' && Number.isFinite(x) ? x : padrao);
const POSICOES = Object.keys(ROTULO_DA_POSICAO) as PosicaoNoCorpo[];
const ALTURAS = Object.keys(ROTULO_DA_ALTURA) as AlturaDoTopo[];

function lerLado(x: unknown): LadoDaCostura | null {
  if (!ehObjeto(x) || typeof x.chave !== 'string' || !Number.isInteger(x.de) || !Number.isInteger(x.ate)) return null;
  return { chave: x.chave, de: x.de as number, ate: x.ate as number, assinatura: typeof x.assinatura === 'string' ? x.assinatura : '' };
}

/** A montagem guardada no projeto, conferida (o que não serve volta ao padrão). */
export function lerMontagem3d(bruto: unknown): Montagem3D {
  if (!ehObjeto(bruto)) return MONTAGEM_VAZIA;
  const m = ehObjeto(bruto.manequim) ? bruto.manequim : {};
  const publico: PublicoDoManequim = m.publico === 'masculino' || m.publico === 'infantil' ? m.publico : 'feminino';
  const medidasBrutas = ehObjeto(m.medidas) ? m.medidas : {};
  const base = MEDIDAS_DO_PUBLICO[publico];
  const medidas = medidasConferidas(
    Object.fromEntries((Object.keys(base) as (keyof MedidasDoManequim)[]).map((k) => [k, numero(medidasBrutas[k], base[k])])) as unknown as MedidasDoManequim,
  );
  const manequim: ManequimDaMontagem = typeof m.tamanhoDaFicha === 'string' ? { publico, medidas, tamanhoDaFicha: m.tamanhoDaFicha } : { publico, medidas };
  const pecas: Record<string, ConfiguracaoDaInstancia> = {};
  if (ehObjeto(bruto.pecas)) {
    for (const [chave, c] of Object.entries(bruto.pecas)) {
      if (!ehObjeto(c)) continue;
      const girar = numero(c.girarGraus, 0);
      const config: ConfiguracaoDaInstancia = {
        posicao: POSICOES.includes(c.posicao as PosicaoNoCorpo) ? (c.posicao as PosicaoNoCorpo) : 'fora',
        alturaDoTopo: ALTURAS.includes(c.alturaDoTopo as AlturaDoTopo) ? (c.alturaDoTopo as AlturaDoTopo) : 'ombro',
        ajusteMm: numero(c.ajusteMm, 0),
        desvioMm: numero(c.desvioMm, 0),
        girarGraus: girar === 90 || girar === 180 || girar === 270 ? girar : 0,
        cor: typeof c.cor === 'string' && /^#[0-9a-f]{6}$/i.test(c.cor) ? c.cor : COR_DE_PARTIDA,
      };
      const e = c.estampa;
      pecas[chave] =
        ehObjeto(e) && typeof e.imagemId === 'string'
          ? { ...config, estampa: { imagemId: e.imagemId, modo: e.modo === 'localizada' ? 'localizada' : 'corrida', larguraMm: Math.max(5, numero(e.larguraMm, 100)), alturaMm: numero(e.alturaMm, 0) } }
          : config;
    }
  }
  const costuras: Costura3D[] = [];
  if (Array.isArray(bruto.costuras)) {
    for (const c of bruto.costuras) {
      if (!ehObjeto(c) || typeof c.id !== 'string') continue;
      const a = lerLado(c.a);
      const b = lerLado(c.b);
      if (a && b) costuras.push({ id: c.id, a, b, invertida: c.invertida === true });
    }
  }
  const t = ehObjeto(bruto.tecido) ? bruto.tecido : {};
  const presets = [...Object.keys(TECIDOS_PRONTOS), 'personalizado'];
  const limite = (x: unknown, padrao: number): number => Math.min(100, Math.max(0, numero(x, padrao)));
  const tecido: Tecido3D = {
    preset: presets.includes(t.preset as string) ? (t.preset as PresetDeTecido) : 'malha',
    pesoGm2: Math.min(1000, Math.max(20, numero(t.pesoGm2, 160))),
    elasticidade: limite(t.elasticidade, 70),
    rigidez: limite(t.rigidez, 20),
    atrito: limite(t.atrito, 50),
  };
  const resolucaoMm = [12, 20, 30].includes(bruto.resolucaoMm as number) ? (bruto.resolucaoMm as number) : 20;
  return { manequim, pecas, costuras, tecido, resolucaoMm };
}

/** A configuração de cada instância: a guardada, ou a sugerida. */
export function configuracoesDasInstancias(instancias: readonly InstanciaDaPeca[], montagem: Montagem3D): Record<string, ConfiguracaoDaInstancia> {
  const r: Record<string, ConfiguracaoDaInstancia> = {};
  for (const inst of instancias) r[inst.chave] = montagem.pecas[inst.chave] ?? configuracaoSugerida(inst, larguraDaFace(inst));
  return r;
}

/** O corpo da montagem. */
export const corpoDaMontagem = (montagem: Montagem3D): CorpoDoManequim => corpoDoManequim(montagem.manequim.medidas);

/** A malha de cada instância posta no corpo (as de fora não entram). */
export function malhasDasInstancias(instancias: readonly InstanciaDaPeca[], configuracoes: Readonly<Record<string, ConfiguracaoDaInstancia>>, resolucaoMm: number): Map<string, MalhaDaPeca> {
  const malhas = new Map<string, MalhaDaPeca>();
  const porPeca = new Map<string, MalhaDaPeca>();
  for (const inst of instancias) {
    const config = configuracoes[inst.chave];
    if (!config || config.posicao === 'fora') continue;
    // As cópias da mesma peça usam a mesma malha.
    let malha = porPeca.get(inst.peca.id);
    if (!malha) {
      malha = malhaDaPeca(inst.contorno, resolucaoMm);
      porPeca.set(inst.peca.id, malha);
    }
    malhas.set(inst.chave, malha);
  }
  return malhas;
}

export { trechoDaBorda };

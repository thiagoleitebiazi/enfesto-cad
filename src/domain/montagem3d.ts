import type { Contorno, Ponto2D } from '../core/geometria';
import type { Molde } from './molde';
import { abrirSimetrias } from './anotacoes';
import { corpoDoManequim, medidasConferidas, MEDIDAS_DO_PUBLICO, perimetroDaElipse, ROTULO_DA_POSE, semiEixosMaximosDoTronco, type CorpoDoManequim, type MedidasDoManequim, type PoseDoManequim, type PublicoDoManequim } from './manequim';
import { cantosDoContorno, malhaDaPeca, trechoDaBorda, type MalhaDaPeca } from './malhaDaPeca';

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
  | 'perna-esquerda-costas'
  | 'sobre-outra-peca'
  | 'gola';

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
  'sobre-outra-peca': 'Sobre outra peça (bolso, aplicação)',
  gola: 'Gola (em volta do pescoço)',
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
  /** Gira a peça (graus, no sentido horário de quem olha a face, de 0 a 359) em relação ao fio na vertical. */
  readonly girarGraus: number;
  readonly cor: string;
  readonly estampa?: EstampaDaPeca;
  /** Na posição "sobre outra peça": em qual e onde (ADR 0123). */
  readonly sobre?: SobreOutraPeca;
  /** Na gola: quanto do comprimento dela (de 0 a 1) vai nas costas; o resto vai na frente, que tem o decote maior (ADR 0234). */
  readonly costasDaGola?: number;
}

/**
 * A peça posta sobre outra (ADR 0123): o bolso na frente, a aplicação, a etiqueta. Fica na face da peça de baixo, com
 * o alto a `doAltoMm` do alto dela e o meio a `doMeioMm` do meio dela (+ para a direita de quem olha), costurada nela
 * pela borda — menos o lado de cima, se for a boca do bolso.
 */
export interface SobreOutraPeca {
  /** A instância de baixo. */
  readonly chave: string;
  readonly doAltoMm: number;
  readonly doMeioMm: number;
  /** O lado de cima fica aberto (a boca do bolso); `false`: costurada em volta toda (a aplicação, a etiqueta). */
  readonly bocaEmCima: boolean;
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
  /** O zíper nesta costura (ADR 0132): o comprimento (mm), do alto da costura para baixo. Ausente: sem zíper. */
  readonly ziperMm?: number;
}

export type PresetDeTecido = 'malha' | 'moletom' | 'tricoline' | 'jeans' | 'seda' | 'linho' | 'personalizado';

/** Como os fios se cruzam: é o que se vê de perto e como a luz corre no pano. */
export type TramaDoTecido = 'plana' | 'sarja' | 'malha' | 'cetim' | 'felpa' | 'linho';

export interface Tecido3D {
  readonly preset: PresetDeTecido;
  /** Gramatura (g/m²). */
  readonly pesoGm2: number;
  /** De 0 (não estica) a 100 (estica muito), no sentido do fio (o urdume, no tecido plano; o comprimento, na malha). */
  readonly elasticidade: number;
  /** Atravessado ao fio (a trama; a largura da malha), de 0 a 100 (ADR 0120). Ausente: a mesma do fio. */
  readonly elasticidadeNaTrama?: number;
  /** No viés (a 45° do fio), de 0 a 100: o tecido plano cede mais no viés (ADR 0120). Ausente: a mesma do fio. */
  readonly elasticidadeNoVies?: number;
  /** De 0 (mole, cai como seda) a 100 (firme, como o jeans). */
  readonly rigidez: number;
  /** De 0 (escorrega) a 100 (agarra no corpo). */
  readonly atrito: number;
  /** A trama; ausente: a do tecido pronto (ADR 0230). Só na vista. */
  readonly trama?: TramaDoTecido;
  /** De 0 (fosco, como o algodão) a 100 (brilha, como o cetim): o reflexo da luz no tecido (ADR 0131). Só na vista. */
  readonly brilho?: number;
  /** De 0 (opaco) a 100 (deixa ver o corpo, como o voal): ADR 0131. Só na vista. */
  readonly transparencia?: number;
}

export const TECIDOS_PRONTOS: Readonly<Record<Exclude<PresetDeTecido, 'personalizado'>, { readonly nome: string; readonly tecido: Tecido3D }>> = {
  // A malha estica mais na largura (a trama) que no comprimento; o tecido plano quase não estica no fio nem na trama,
  // mas cede no viés — é o que faz a saia cortada no viés cair diferente (ADR 0120).
  malha: { nome: 'Malha de algodão (meia malha)', tecido: { preset: 'malha', pesoGm2: 160, elasticidade: 70, elasticidadeNaTrama: 80, elasticidadeNoVies: 75, rigidez: 20, atrito: 50 } },
  moletom: { nome: 'Moletom', tecido: { preset: 'moletom', pesoGm2: 300, elasticidade: 45, elasticidadeNaTrama: 55, elasticidadeNoVies: 50, rigidez: 55, atrito: 60 } },
  tricoline: { nome: 'Tricoline (algodão plano)', tecido: { preset: 'tricoline', pesoGm2: 120, elasticidade: 10, elasticidadeNaTrama: 18, elasticidadeNoVies: 78, rigidez: 45, atrito: 40 } },
  jeans: { nome: 'Jeans', tecido: { preset: 'jeans', pesoGm2: 380, elasticidade: 5, elasticidadeNaTrama: 12, elasticidadeNoVies: 70, rigidez: 85, atrito: 55 } },
  seda: { nome: 'Seda / viscose', tecido: { preset: 'seda', pesoGm2: 90, elasticidade: 15, elasticidadeNaTrama: 22, elasticidadeNoVies: 85, rigidez: 5, atrito: 20, brilho: 55, transparencia: 10 } },
  linho: { nome: 'Linho', tecido: { preset: 'linho', pesoGm2: 180, elasticidade: 5, elasticidadeNaTrama: 12, elasticidadeNoVies: 72, rigidez: 65, atrito: 45 } },
};

/** A trama de cada tecido pronto, que o estúdio desenha (ADR 0230). O personalizado fica com a mais comum, a plana. */
export const TRAMA_DO_PRESET: Readonly<Record<PresetDeTecido, TramaDoTecido>> = {
  malha: 'malha',
  moletom: 'felpa',
  tricoline: 'plana',
  jeans: 'sarja',
  seda: 'cetim',
  linho: 'linho',
  personalizado: 'plana',
};

export const tramaDoTecido = (t: Tecido3D): TramaDoTecido => t.trama ?? TRAMA_DO_PRESET[t.preset];

/** A distância entre as rugas finas (mm): de 9 no pano mole a 34 no mais firme (ADR 0232). */
export const distanciaDasRugas = (t: Tecido3D): number => 9 + 0.25 * t.rigidez;

export const ROTULO_DA_TRAMA: Readonly<Record<TramaDoTecido, string>> = {
  plana: 'Plana (tricoline, popeline)',
  sarja: 'Sarja (jeans, gabardine)',
  malha: 'Malha (camiseta)',
  cetim: 'Cetim (seda, charmeuse)',
  felpa: 'Felpa (moletom, veludo)',
  linho: 'Linho (fios irregulares)',
};

export interface ManequimDaMontagem {
  readonly publico: PublicoDoManequim;
  readonly medidas: MedidasDoManequim;
  /** O tamanho da ficha usado para as medidas (ausente: as do público, ou digitadas). */
  readonly tamanhoDaFicha?: string;
  /** A pose (ADR 0138); ausente: a de vestir. */
  readonly pose?: PoseDoManequim;
}

export interface Montagem3D {
  readonly manequim: ManequimDaMontagem;
  readonly pecas: Readonly<Record<string, ConfiguracaoDaInstancia>>;
  readonly costuras: readonly Costura3D[];
  readonly tecido: Tecido3D;
  /** A distância entre os pontos da malha do tecido (mm): menor, mais fino e mais lento. */
  readonly resolucaoMm: number;
  /** O tecido sobre o próprio tecido (ADR 0146): ausente ou `true`, ligado; `false`, desligado (mais rápido). */
  readonly autoColisao?: boolean;
}

export const MONTAGEM_VAZIA: Montagem3D = {
  manequim: { publico: 'feminino', medidas: MEDIDAS_DO_PUBLICO.feminino },
  pecas: {},
  costuras: [],
  tecido: TECIDOS_PRONTOS.malha.tecido,
  resolucaoMm: 12,
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

/** A cor um tom mais escura (a peça de cima na mesma cor da de baixo sumiria nela, ADR 0123). */
export function corMaisEscura(hex: string, fator = 0.72): string {
  const v = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!v) return hex;
  const n = Number.parseInt(v[1]!, 16);
  const canal = (deslocamento: number): string => Math.round(((n >> deslocamento) & 255) * fator).toString(16).padStart(2, '0');
  return `#${canal(16)}${canal(8)}${canal(0)}`;
}

/** A configuração de partida de uma instância, pelo nome da peça. */
export function configuracaoSugerida(instancia: InstanciaDaPeca, largura: number): ConfiguracaoDaInstancia {
  const c = configuracaoPeloNome(instancia, largura);
  if (c.posicao === 'fora') return c;
  const pronta = { ...c, girarGraus: giroPelaForma(instancia, c.girarGraus, c.posicao) };
  return pronta.posicao.startsWith('perna-') ? { ...pronta, posicao: pernaPeloGancho(instancia, pronta) } : pronta;
}

/** A que distância abaixo da ponta se mede o recuo do contorno (mm). */
const RECUO_DO_GANCHO_MM = 100;

/**
 * Qual perna a peça veste, pela forma: o gancho aponta para o meio do corpo. Na frente da perna direita, ele fica à direita
 * da face (o meio do corpo é +x); nas costas, à esquerda. O molde pode vir de uma perna ou da outra: pela cópia só, a peça ia
 * para a perna errada, de avesso, e a calça não fechava.
 */
export function pernaPeloGancho(instancia: InstanciaDaPeca, config: ConfiguracaoDaInstancia): PosicaoNoCorpo {
  const { u, v } = coordenadasDaFace(instancia, config.girarGraus, contornoComoPontos(instancia.contorno));
  // O quadril desce devagar; o gancho é uma ponta, e o contorno volta logo abaixo dele.
  const { direita, esquerda } = ganchoNaFace(u, v);
  const costas = config.posicao.endsWith('-costas');
  const direitaDoCorpo = direita >= esquerda !== costas;
  // Sem gancho nenhum (a perna reta), fica como a cópia mandou.
  if (Math.abs(direita - esquerda) < 8) return config.posicao;
  return `perna-${direitaDoCorpo ? 'direita' : 'esquerda'}-${costas ? 'costas' : 'frente'}` as PosicaoNoCorpo;
}

/** Quanto o contorno recua logo abaixo do ponto mais saliente de cada lado, na metade de cima da peça de pé (mm). */
export function ganchoNaFace(u: ArrayLike<number>, v: ArrayLike<number>): { readonly direita: number; readonly esquerda: number } {
  let vMin = Infinity;
  let vMax = -Infinity;
  for (let i = 0; i < v.length; i++) {
    vMin = Math.min(vMin, v[i]!);
    vMax = Math.max(vMax, v[i]!);
  }
  /** Na metade de cima, o ponto mais saliente de um lado e quanto o contorno recua logo abaixo dele. */
  const recuo = (lado: 1 | -1): number => {
    let extremo = -Infinity;
    let altura = vMax;
    for (let i = 0; i < v.length; i++) {
      if (v[i]! >= vMin + 0.5 * (vMax - vMin) && lado * u[i]! > extremo) {
        extremo = lado * u[i]!;
        altura = v[i]!;
      }
    }
    const abaixo = altura - RECUO_DO_GANCHO_MM;
    let contorno = -Infinity;
    for (let i = 0; i < v.length; i++) {
      const j = (i + 1) % v.length;
      const [v0, v1] = [v[i]!, v[j]!];
      if ((v0 - abaixo) * (v1 - abaixo) > 0 || v0 === v1) continue;
      contorno = Math.max(contorno, lado * (u[i]! + ((u[j]! - u[i]!) * (abaixo - v0)) / (v1 - v0)));
    }
    return contorno === -Infinity ? 0 : extremo - contorno;
  };
  return { direita: recuo(1), esquerda: recuo(-1) };
}

function configuracaoPeloNome(instancia: InstanciaDaPeca, largura: number): ConfiguracaoDaInstancia {
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

// ---- O alto pela forma

/** A largura do contorno (na face) na altura `altura`: do primeiro ao último cruzamento da linha com o contorno. */
function larguraNaAltura(u: ArrayLike<number>, v: ArrayLike<number>, altura: number): number {
  let min = Infinity;
  let max = -Infinity;
  const n = u.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const va = v[i]!;
    const vb = v[j]!;
    if ((va - altura) * (vb - altura) > 0 || va === vb) continue;
    const f = (altura - va) / (vb - va);
    const x = u[i]! + (u[j]! - u[i]!) * f;
    min = Math.min(min, x);
    max = Math.max(max, x);
  }
  return max > min ? max - min : 0;
}

/**
 * As pontas da peça (vista pela face, de pé): a largura perto do alto (a 4% do comprimento, ou 1 cm) menos a perto da
 * barra, sobre a maior — positiva: o alto é mais largo; perto de 0: as duas iguais (não dá para saber pela forma).
 */
export function diferencaDasPontas(u: ArrayLike<number>, v: ArrayLike<number>): number {
  let minV = Infinity;
  let maxV = -Infinity;
  for (let i = 0; i < v.length; i++) {
    minV = Math.min(minV, v[i]!);
    maxV = Math.max(maxV, v[i]!);
  }
  const faixa = Math.max(10, (maxV - minV) * 0.04);
  if (maxV - minV <= 2 * faixa) return 0;
  const alto = larguraNaAltura(u, v, maxV - faixa);
  const barra = larguraNaAltura(u, v, minV + faixa);
  const maior = Math.max(alto, barra);
  return maior > 0 ? (alto - barra) / maior : 0;
}

/**
 * Qual ponta vai em cima, pela posição: na perna, a mais larga (a cintura da calça; a barra afina); no resto, a mais
 * estreita (o decote e os ombros sobre a barra da blusa, a cintura sobre a barra da saia, a cabeça da manga sobre o
 * punho).
 */
export const pontaLargaEmCima = (posicao: PosicaoNoCorpo): boolean => posicao.startsWith('perna-');

/**
 * O giro (de 90 em 90, a partir de `girarGraus`) que deixa a ponta certa em cima, pela forma da peça: o mesmo giro, ou
 * meia volta a mais. As pontas quase iguais (até 8%) não dizem nada: fica o giro dado. O fio continua na vertical: só
 * o sentido muda — o arquivo de encaixe traz peças deitadas e viradas de qualquer jeito, e o sentido do fio no arquivo
 * não diz qual ponta é o alto.
 */
export function giroPelaForma(instancia: InstanciaDaPeca, girarGraus: number, posicao: PosicaoNoCorpo): number {
  // A manga: a cabeça (o lado mais abaulado) para cima, em qualquer ângulo (a manga vem inclinada nos arquivos de encaixe).
  if (posicao === 'manga-direita' || posicao === 'manga-esquerda') {
    const daManga = giroDaMangaPelaForma(instancia);
    if (daManga !== null) return daManga;
  }
  const face = coordenadasDaFace(instancia, girarGraus, contornoComoPontos(instancia.contorno));
  // A gola corre deitada em volta do pescoço.
  if (posicao === 'gola') return face.altura > face.largura ? normalizarGiro(girarGraus + 90) : girarGraus;
  const d = diferencaDasPontas(face.u, face.v);
  if (Math.abs(d) < 0.08) return girarGraus;
  const largoEmCima = d > 0;
  return largoEmCima === pontaLargaEmCima(posicao) ? girarGraus : normalizarGiro(girarGraus + 180);
}

/** O giro entre 0 e 359,9 (graus). */
export function normalizarGiro(graus: number): number {
  if (!Number.isFinite(graus)) return 0;
  const g = ((graus % 360) + 360) % 360;
  return Math.round(g * 10) / 10 === 360 ? 0 : Math.round(g * 10) / 10;
}

/**
 * O bojo de um lado do contorno, na tela (x para a direita, y para cima): o quanto ele se afasta da corda (a reta entre
 * as pontas), sobre o comprimento da corda, e a direção do bojo (de lado da corda para onde ele vai).
 */
function bojoDoLado(contorno: Contorno, de: number, ate: number): { readonly razao: number; readonly direcao: Ponto2D } {
  const n = contorno.length;
  const tela = (p: Ponto2D): Ponto2D => ({ x: p.y, y: -p.x });
  const a = tela(contorno[de]!);
  const b = tela(contorno[ate]!);
  const corda = { x: b.x - a.x, y: b.y - a.y };
  const L = Math.hypot(corda.x, corda.y);
  if (L < 1e-6) return { razao: 0, direcao: { x: 0, y: 1 } };
  const normal = { x: -corda.y / L, y: corda.x / L };
  let maior = 0;
  for (let i = de; i !== ate; i = (i + 1) % n) {
    const p = tela(contorno[i]!);
    const d = (p.x - a.x) * normal.x + (p.y - a.y) * normal.y;
    if (Math.abs(d) > Math.abs(maior)) maior = d;
  }
  const s = maior >= 0 ? 1 : -1;
  return { razao: Math.abs(maior) / L, direcao: { x: normal.x * s, y: normal.y * s } };
}

/**
 * A cabeça de uma manga: o lado mais abaulado do contorno (a curva que vai na cava; o embaixo do braço e o punho são
 * quase retos), se ele se afasta da corda ao menos 12% dela. `null`: nenhum lado assim.
 */
export function cabecaDaManga(contorno: Contorno): { readonly lado: LadoDoContorno; readonly direcao: Ponto2D } | null {
  let melhor: { lado: LadoDoContorno; razao: number; direcao: Ponto2D } | null = null;
  const perimetro = perimetroDe(contorno);
  for (const lado of ladosDoContorno(contorno)) {
    if (lado.comprimento < perimetro * 0.12) continue;
    const b = bojoDoLado(contorno, lado.de, lado.ate);
    if (b.razao >= 0.12 && (!melhor || b.razao > melhor.razao)) melhor = { lado, razao: b.razao, direcao: b.direcao };
  }
  return melhor ? { lado: melhor.lado, direcao: melhor.direcao } : null;
}

/**
 * O eixo da manga: do alto da cabeça (o ponto dela mais longe da corda) ao meio do punho (o meio, pelo contorno, do
 * lado mais longe do alto). A cabeça de uma manga de verdade não é simétrica (a da frente é mais cavada), e a
 * perpendicular à corda sai torta: o punho ia para fora do eixo do braço e a manga se torcia. `null`: sem cabeça clara.
 */
export function eixoDaManga(contorno: Contorno): { readonly apice: Ponto2D; readonly punho: Ponto2D } | null {
  const cabeca = cabecaDaManga(contorno);
  if (!cabeca) return null;
  const n = contorno.length;
  const a = contorno[cabeca.lado.de]!;
  const b = contorno[cabeca.lado.ate]!;
  const L = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  let apice = a;
  let maior = -1;
  for (let i = cabeca.lado.de; i !== cabeca.lado.ate; i = (i + 1) % n) {
    const p = contorno[i]!;
    const d = Math.abs((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / L;
    if (d > maior) {
      maior = d;
      apice = p;
    }
  }
  /** O ponto do meio de um lado, pelo comprimento. */
  const meioDoLado = (de: number, ate: number): Ponto2D => {
    const total = comprimentoDoTrecho(contorno, de, ate);
    let andado = 0;
    for (let i = de; i !== ate; i = (i + 1) % n) {
      const p = contorno[i]!;
      const q = contorno[(i + 1) % n]!;
      const s = Math.hypot(q.x - p.x, q.y - p.y);
      if (andado + s >= total / 2) {
        const f = s > 0 ? (total / 2 - andado) / s : 0;
        return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f };
      }
      andado += s;
    }
    return contorno[ate]!;
  };
  // O punho: dos lados com ao menos 10% do contorno, o mais oposto à cabeça — o mais longe do alto na direção
  // contrária ao bojo (numa manga curta e larga, os cantos e o meio das laterais ficam tão longe do alto quanto o punho).
  const perimetro = perimetroDe(contorno);
  const bojo = { x: -cabeca.direcao.y, y: cabeca.direcao.x };
  let punho: Ponto2D | null = null;
  let maisOposto = Infinity;
  for (const lado of ladosDoContorno(contorno)) {
    if (lado.de === cabeca.lado.de && lado.ate === cabeca.lado.ate) continue;
    if (lado.comprimento < perimetro * 0.1) continue;
    const m = meioDoLado(lado.de, lado.ate);
    const projecao = (m.x - apice.x) * bojo.x + (m.y - apice.y) * bojo.y;
    if (projecao < maisOposto) {
      maisOposto = projecao;
      punho = m;
    }
  }
  return punho ? { apice, punho } : null;
}

/** Na manga, o giro (graus) que põe o eixo dela de pé, com a cabeça em cima; `null`: sem cabeça clara. */
export function giroDaMangaPelaForma(instancia: InstanciaDaPeca): number | null {
  const eixo = eixoDaManga(instancia.contorno);
  if (!eixo) return null;
  const { cima } = eixosDaFace(instancia.peca.linhaDeFio, 0);
  // Na tela (x = y do mundo, y para cima = −x do mundo): do punho ao alto.
  const direcao = { x: eixo.apice.y - eixo.punho.y, y: -(eixo.apice.x - eixo.punho.x) };
  // O giro é no sentido horário: de cima (o do fio) até o eixo.
  const g = (Math.atan2(cima.y, cima.x) - Math.atan2(direcao.y, direcao.x)) * (180 / Math.PI);
  return normalizarGiro(g);
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
  // Fora, ou sobre outra peça (o lugar depende da de baixo já arrumada: é a simulação que põe, ADR 0123).
  if (config.posicao === 'fora' || config.posicao === 'sobre-outra-peca') return null;
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
    const maiorRaio = Math.max(W / (2 * Math.PI), braco.raio + 25);
    // Da linha mais larga para baixo, a manga afina com a peça até o punho, e as bordas se encontram embaixo do braço já na partida.
    // Num tubo reto, perto do punho elas ficavam dos lados do braço e, ao costurar, fechavam através dele: o braço saía pela costura.
    const larguraDaLinha = larguraPorLinha(instancia, config.girarGraus);
    let vMaisLargo = vMax;
    for (let q = -vMax; q <= vMax; q += 20) if (larguraDaLinha(q) > larguraDaLinha(vMaisLargo)) vMaisLargo = q;
    const inicio = -braco.raio * 0.8 + config.ajusteMm * -1;
    // O alto da cabeça vai no alto do braço (e não o meio da caixa da peça, que numa manga torta fica fora do eixo).
    const eixo = eixoDaManga(instancia.contorno);
    const uDoApice = eixo ? coordenadasDaFace(instancia, config.girarGraus, [eixo.apice.x, eixo.apice.y]).u[0]! : 0;
    for (let i = 0; i < n; i++) {
      const l = inicio + (vMax - face.v[i]!);
      // O braço afina para o punho: a manga nunca começa dentro dele.
      const menorRaio = braco.raio * (1 - (ESTREITA_O_BRACO * Math.max(0, Math.min(L, l))) / L) + FOLGA_DA_MANGA_MM;
      const r = face.v[i]! >= vMaisLargo ? maiorRaio : Math.max(menorRaio, Math.min(maiorRaio, larguraDaLinha(face.v[i]!) / (2 * Math.PI)));
      const f = (face.u[i]! - uDoApice + config.desvioMm) / r;
      const c = { x: braco.inicio.x + d.x * l, y: braco.inicio.y + d.y * l, z: braco.inicio.z + d.z * l };
      saida[3 * i] = c.x + r * (Math.cos(f) * e1.x + Math.sin(f) * e2.x);
      saida[3 * i + 1] = c.y + r * (Math.cos(f) * e1.y + Math.sin(f) * e2.y);
      saida[3 * i + 2] = c.z + r * (Math.cos(f) * e1.z + Math.sin(f) * e2.z);
    }
    return saida;
  }
  if (p === 'gola') {
    // Um anel acima dos ombros, que fecha no ombro esquerdo: do começo da peça, vai pelas costas e volta pela frente, com a face para
    // fora. A volta se estreita para cima, como o descanso dela (`encolheDaGola`).
    const base = corpo.niveis.pescoco + 20 + config.ajusteMm;
    const costas = config.costasDaGola ?? 0.5;
    for (let i = 0; i < n; i++) {
      const raio = (W * encolheDaGola(face.v[i]!, contorno.altura)) / (2 * Math.PI);
      // Meia volta nas costas e meia na frente, cada uma com a parte da gola que é dela: dividida ao meio, a gola se torcia ao costurar.
      const t = (face.u[i]! + W / 2 + config.desvioMm) / W;
      const f = Math.PI / 2 + Math.PI * (t <= costas ? t / costas : 1 + (t - costas) / (1 - costas));
      saida[3 * i] = raio * Math.sin(f);
      saida[3 * i + 1] = base + face.v[i]! + contorno.altura / 2;
      saida[3 * i + 2] = raio * Math.cos(f);
    }
    return saida;
  }
  // Em volta do tronco (ou da perna): uma elipse afastada do corpo, grande o bastante para meia volta caber na peça
  // (a frente e as costas se encontram dos lados); a peça vai por ela medida pelo comprimento, sem esticar.
  let cx = 0;
  let A: number;
  let B: number;
  let escalaDaLinha: ((v: number) => number) | null = null;
  if (p.startsWith('perna-')) {
    const perna = p.startsWith('perna-direita') ? corpo.pernas.direita : corpo.pernas.esquerda;
    cx = perna.inicio.x;
    A = B = Math.max(W / Math.PI, perna.raio + 30);
  } else {
    const eixos = semiEixosMaximosDoTronco(corpo, topo - contorno.altura, topo);
    A = eixos.a + 30;
    B = eixos.b + 30;
    // Cada altura da peça vai na elipse da largura dela: a barra de um vestido evasê abre, e o ombro continua perto do corpo.
    const meiaVolta = perimetroDaElipse(A, B) / 2;
    const larguraDaLinha = larguraPorLinha(instancia, config.girarGraus);
    escalaDaLinha = (v) => Math.max(1, larguraDaLinha(v) / meiaVolta);
  }
  const angulo0 =
    p === 'frente' || p.endsWith('-frente') ? 0 : p === 'costas' || p.endsWith('-costas') ? Math.PI : p === 'lado-direito' ? (3 * Math.PI) / 2 : Math.PI / 2;
  // As elipses de cada escala, de 2 em 2%: medir uma pelo comprimento custa.
  const elipses = new Map<number, ReturnType<typeof elipsePeloComprimento>>();
  const elipseNaEscala = (k: number): ReturnType<typeof elipsePeloComprimento> => {
    const chave = Math.round(k * 50);
    let e = elipses.get(chave);
    if (!e) {
      e = elipsePeloComprimento((A * chave) / 50, (B * chave) / 50);
      elipses.set(chave, e);
    }
    return e;
  };
  for (let i = 0; i < n; i++) {
    const q = elipseNaEscala(escalaDaLinha ? escalaDaLinha(face.v[i]!) : 1)(angulo0, face.u[i]! + config.desvioMm);
    saida[3 * i] = cx + q.x;
    saida[3 * i + 1] = topo - (vMax - face.v[i]!);
    saida[3 * i + 2] = q.z;
  }
  return saida;
}

/** O quanto o braço afina do ombro ao punho, e o vão da manga em volta dele na partida (mm). */
const ESTREITA_O_BRACO = 0.4;
const FOLGA_DA_MANGA_MM = 10;

/** O quanto a dobra da gola descansa do comprimento da beira do decote: a ribana só estica na beira costurada. */
const DESCANSO_DA_DOBRA_DA_GOLA = 0.89;

/** Quanto do comprimento descansa à altura `v` da face da gola (de altura `altura`): tudo na beira de baixo, menos na dobra. */
const encolheDaGola = (v: number, altura: number): number => 1 - (1 - DESCANSO_DA_DOBRA_DA_GOLA) * (0.5 + v / altura);

/**
 * Os pontos da gola (x, y seguidos) na forma em que descansam, para os comprimentos da simulação. A beira do decote vai esticada e a
 * dobra aperta o pescoço, mas a peça é um retângulo: desenhada mais curta em cima, a gola não fechava num anel liso, e a emenda
 * quebrava num V (ADR 0234). O comprimento é que encolhe, altura por altura.
 */
export function descansoDaGola(instancia: InstanciaDaPeca, girarGraus: number, pontos: ArrayLike<number>): Float64Array {
  const { u, v, altura } = coordenadasDaFace(instancia, girarGraus, pontos);
  const saida = new Float64Array(pontos.length);
  for (let i = 0; i < u.length; i++) saida.set([u[i]! * encolheDaGola(v[i]!, altura), v[i]!], 2 * i);
  return saida;
}

/** A largura da peça em cada altura da face (mm), lida no contorno e suavizada. */
function larguraPorLinha(instancia: InstanciaDaPeca, girarGraus: number): (v: number) => number {
  const f = coordenadasDaFace(instancia, girarGraus, contornoComoPontos(instancia.contorno));
  const n = f.u.length;
  let vMin = Infinity;
  let vMax = -Infinity;
  for (let i = 0; i < n; i++) {
    vMin = Math.min(vMin, f.v[i]!);
    vMax = Math.max(vMax, f.v[i]!);
  }
  const passo = 20;
  const linhas = Math.ceil((vMax - vMin) / passo) + 1;
  const menor = new Float64Array(linhas).fill(Infinity);
  const maior = new Float64Array(linhas).fill(-Infinity);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const [u0, v0, u1, v1] = [f.u[i]!, f.v[i]!, f.u[j]!, f.v[j]!];
    const pedacos = Math.ceil(Math.abs(v1 - v0) / (passo / 2)) + 1;
    for (let s = 0; s <= pedacos; s++) {
      const t = s / pedacos;
      const b = Math.round((v0 + (v1 - v0) * t - vMin) / passo);
      const u = u0 + (u1 - u0) * t;
      menor[b] = Math.min(menor[b]!, u);
      maior[b] = Math.max(maior[b]!, u);
    }
  }
  let largura = Float64Array.from({ length: linhas }, (_, b) => Math.max(0, maior[b]! - menor[b]!));
  for (let volta = 0; volta < 3; volta++) {
    const atual = largura;
    largura = Float64Array.from({ length: linhas }, (_, b) => (atual[Math.max(0, b - 1)]! + atual[b]! + atual[Math.min(linhas - 1, b + 1)]!) / 3);
  }
  return (v) => {
    const q = Math.max(0, Math.min(linhas - 1, (v - vMin) / passo));
    const b = Math.min(linhas - 2, Math.floor(q));
    return linhas < 2 ? largura[0]! : largura[b]! + (largura[b + 1]! - largura[b]!) * (q - b);
  };
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

/** Os lados do contorno: os trechos entre os cantos. */
export function ladosDoContorno(contorno: Contorno): LadoDoContorno[] {
  const n = contorno.length;
  const cantos = cantosDoContorno(contorno);
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

/** Os lados do contorno (de `n` pontos) no trecho de `de` a `ate`, no sentido do contorno. */
export function trechoDoContorno(n: number, de: number, ate: number): number[] {
  const lados: number[] = [];
  for (let i = de; i !== ate && lados.length < n; i = (i + 1) % n) lados.push(i);
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
  // Na peça evasê, as pontas ficam longe uma da outra só em cima: o meio não pode ir além da ponta mais afastada.
  return d[2]! <= Math.max(d[0]!, d[4]!) + 40 && Math.max(...d) <= Math.max(160, comprimento * 0.4);
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
    /** Em qual perna a peça está, e a altura média do lado (mm). */
    readonly perna: 'direita' | 'esquerda' | null;
    readonly altura: number;
  }
  const candidatos: Candidato[] = [];
  for (const inst of instancias) {
    const config = montagem.pecas[inst.chave];
    // A gola tem as costuras dela, no fim.
    if (!config || config.posicao === 'fora' || config.posicao === 'gola') continue;
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
      const perna = config.posicao.startsWith('perna-direita') ? 'direita' : config.posicao.startsWith('perna-esquerda') ? 'esquerda' : null;
      // Na calça, o alto da peça não tem cava: é o gancho, que fecha de uma perna para a outra.
      candidatos.push({ inst, lado, arrumado, noAlto: deCima && subida < avanco && naFaixaDeCima, lateral: subida >= avanco && (!naFaixaDeCima || perna !== null), perna, altura: yLado });
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
      // Abaixo do gancho, cada perna fecha sozinha: a entreperna de trás de uma fica perto da de trás da outra, mas não se costura nela.
      const pernasDiferentes = a.perna !== null && b.perna !== null && a.perna !== b.perna && Math.max(a.altura, b.altura) < corpo.niveis.gancho;
      if (pernasDiferentes) continue;
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
  novas.push(...costurasDasMangas(corpo, instancias, montagem, candidatos, usados, novoId));
  novas.push(...costurasDaGola(corpo, instancias, montagem, usados, novoId));
  return novas;
}

/** O ponto do trecho do contorno mais perto de `distancia` mm do começo dele. */
function pontoPeloComprimento(contorno: Contorno, de: number, ate: number, distancia: number): number {
  const n = contorno.length;
  let andado = 0;
  let achado = de;
  let melhor = Infinity;
  for (let i = de; ; i = (i + 1) % n) {
    if (Math.abs(andado - distancia) < melhor) {
      melhor = Math.abs(andado - distancia);
      achado = i;
    }
    if (i === ate) return achado;
    andado += Math.hypot(contorno[(i + 1) % n]!.x - contorno[i]!.x, contorno[(i + 1) % n]!.y - contorno[i]!.y);
  }
}

/** O trecho do contorno que é o decote: no quarto de cima da peça, de um lado ao outro do meio dela, e fundo no meio. É um lado só, ou, no V, dois que se encontram no meio. */
export function decoteDaPeca(instancia: InstanciaDaPeca, girarGraus: number): LadoDoContorno | null {
  const { u, v, altura } = coordenadasDaFace(instancia, girarGraus, contornoComoPontos(instancia.contorno));
  const faixa = altura / 4;
  const lados = ladosDoContorno(instancia.contorno);
  const emV = lados.map((a, k) => {
    const b = lados[(k + 1) % lados.length]!;
    return { de: a.de, ate: b.ate, comprimento: a.comprimento + b.comprimento };
  });
  for (const lado of [...lados, ...emV]) {
    if (v[lado.de]! < faixa || v[lado.ate]! < faixa || u[lado.de]! * u[lado.ate]! >= 0) continue;
    let fundo = Infinity;
    for (const i of trechoDoContorno(instancia.contorno.length, lado.de, lado.ate)) fundo = Math.min(fundo, v[i]!);
    if (fundo < Math.min(v[lado.de]!, v[lado.ate]!) - 5) return lado;
  }
  return null;
}

/**
 * A gola com o decote (ADR 0234): a beira de baixo dela vai com o decote das costas e com o da frente, dividida na proporção deles,
 * e as duas pontas se fecham uma na outra, no ombro esquerdo. No meio das costas, a emenda vira uma dobradiça, e o decote a puxa num V.
 */
function costurasDaGola(corpo: CorpoDoManequim, instancias: readonly InstanciaDaPeca[], montagem: Montagem3D, usados: Set<string>, novoId: () => string): Costura3D[] {
  const gola = instancias.find((i) => montagem.pecas[i.chave]?.posicao === 'gola');
  const config = gola && montagem.pecas[gola.chave];
  if (!gola || !config) return [];
  const doDecote = (posicao: PosicaoNoCorpo): { readonly inst: InstanciaDaPeca; readonly lado: LadoDoContorno } | null => {
    const inst = instancias.find((i) => montagem.pecas[i.chave]?.posicao === posicao);
    const lado = inst ? decoteDaPeca(inst, montagem.pecas[inst.chave]!.girarGraus) : null;
    return inst && lado && !usados.has(`${inst.chave}|${lado.de}|${lado.ate}`) ? { inst, lado } : null;
  };
  const costas = doDecote('costas');
  const frente = doDecote('frente');
  if (!costas || !frente) return [];
  const { u, v, altura } = coordenadasDaFace(gola, config.girarGraus, contornoComoPontos(gola.contorno));
  // As pontas da gola, pelas beiras: a dobra é pouco mais curta que a beira do decote, e o canto dela é aberto demais para contar como canto.
  const n = gola.contorno.length;
  const naBeira = (lado: 1 | -1): number[] => Array.from({ length: n }, (_, i) => i).filter((i) => v[i]! * lado > altura / 2 - 1);
  const pontasDa = (lista: readonly number[]): [number, number] => {
    const porU = [...lista].sort((a, b) => u[a]! - u[b]!);
    return [porU[0]!, porU[porU.length - 1]!];
  };
  const [baixoE, baixoD] = pontasDa(naBeira(-1));
  const [altoE, altoD] = pontasDa(naBeira(1));
  if (baixoE === baixoD || altoE === altoD) return [];
  // A beira do decote no sentido do contorno, e o que vem depois dela: uma ponta, a dobra e a outra ponta.
  const seguindo = v[(baixoE + 1) % n]! < -altura / 2 + 1;
  const beira = seguindo ? { de: baixoE, ate: baixoD } : { de: baixoD, ate: baixoE };
  const [alto1, alto2] = seguindo ? [altoD, altoE] : [altoE, altoD];
  // O anel começa (no u menor) pelas costas.
  const [primeiro, segundo] = seguindo ? [costas, frente] : [frente, costas];
  const total = comprimentoDoTrecho(gola.contorno, beira.de, beira.ate);
  const divisao = pontoPeloComprimento(gola.contorno, beira.de, beira.ate, (total * primeiro.lado.comprimento) / (costas.lado.comprimento + frente.lado.comprimento));
  if (divisao === beira.de || divisao === beira.ate) return [];
  usados.add(`${costas.inst.chave}|${costas.lado.de}|${costas.lado.ate}`);
  usados.add(`${frente.inst.chave}|${frente.lado.de}|${frente.lado.ate}`);
  const comODecote = (de: number, ate: number, destino: { readonly inst: InstanciaDaPeca; readonly lado: LadoDoContorno }): Costura3D => {
    const lado = destino.lado;
    return {
      id: novoId(),
      a: { chave: gola.chave, de, ate, assinatura: gola.assinatura },
      b: { chave: destino.inst.chave, de: lado.de, ate: lado.ate, assinatura: destino.inst.assinatura },
      invertida: sentidoSugerido(corpo, { inst: gola, config, de, ate }, { inst: destino.inst, config: montagem.pecas[destino.inst.chave]!, de: lado.de, ate: lado.ate }),
    };
  };
  return [
    comODecote(beira.de, divisao, primeiro),
    comODecote(divisao, beira.ate, segundo),
    {
      id: novoId(),
      a: { chave: gola.chave, de: beira.ate, ate: alto1, assinatura: gola.assinatura },
      b: { chave: gola.chave, de: alto2, ate: beira.de, assinatura: gola.assinatura },
      invertida: sentidoSugerido(corpo, { inst: gola, config, de: beira.ate, ate: alto1 }, { inst: gola, config, de: alto2, ate: beira.de }),
    },
  ];
}

/**
 * A manga com as cavas: em cada manga posta num braço, a cabeça (o lado mais abaulado) vai com a cava da frente e a
 * das costas do mesmo lado do corpo (os lados do alto do tronco mais perto do ombro), se a cabeça tem o comprimento
 * das duas cavas juntas (até 10% a mais ou a menos: a folga da cabeça). A cabeça é dividida no ponto do contorno em
 * que o comprimento da cava da frente acaba; a ponta de baixo de cada metade vai com a ponta de baixo da cava.
 */
function costurasDasMangas(
  corpo: CorpoDoManequim,
  instancias: readonly InstanciaDaPeca[],
  montagem: Montagem3D,
  candidatos: readonly { readonly inst: InstanciaDaPeca; readonly lado: LadoDoContorno; readonly arrumado: Float64Array }[],
  usados: Set<string>,
  novoId: () => string,
): Costura3D[] {
  const novas: Costura3D[] = [];
  for (const manga of instancias) {
    const config = montagem.pecas[manga.chave];
    if (!config || (config.posicao !== 'manga-direita' && config.posicao !== 'manga-esquerda')) continue;
    const cabeca = cabecaDaManga(manga.contorno);
    if (!cabeca || usados.has(`${manga.chave}|${cabeca.lado.de}|${cabeca.lado.ate}`)) continue;
    const lado = config.posicao === 'manga-direita' ? -1 : 1;
    const ombro = config.posicao === 'manga-direita' ? corpo.bracos.direito.inicio : corpo.bracos.esquerdo.inicio;
    // As cavas: os lados ainda livres do tronco, no alto, do lado do braço; a da frente (z > 0) e a das costas, as mais
    // perto do ombro.
    const doTronco = candidatos.filter((c) => {
      const p = montagem.pecas[c.inst.chave]?.posicao;
      if (p !== 'frente' && p !== 'costas' && p !== 'lado-direito' && p !== 'lado-esquerdo') return false;
      if (usados.has(`${c.inst.chave}|${c.lado.de}|${c.lado.ate}`)) return false;
      return c.arrumado[6]! * lado > 0;
    });
    const distanciaAoOmbro = (c: { arrumado: Float64Array }): number => Math.hypot(c.arrumado[6]! - ombro.x, c.arrumado[7]! - ombro.y);
    const perto = doTronco.filter((c) => distanciaAoOmbro(c) < 260).sort((a, b) => distanciaAoOmbro(a) - distanciaAoOmbro(b));
    const frente = perto.find((c) => c.arrumado[8]! > 0);
    const costas = perto.find((c) => c.arrumado[8]! < 0);
    if (!frente || !costas) continue;
    const total = frente.lado.comprimento + costas.lado.comprimento;
    if (Math.abs(cabeca.lado.comprimento - total) > total * 0.1) continue;
    // A ponta da cabeça que vai para a frente: na manga direita, a da direita de quem olha a face (o e2 do braço é +z);
    // na esquerda, a outra.
    const faceDaManga = coordenadasDaFace(manga, config.girarGraus, contornoComoPontos(manga.contorno));
    const deVaiParaFrente = (faceDaManga.u[cabeca.lado.de]! > faceDaManga.u[cabeca.lado.ate]!) === (lado < 0);
    // O ponto de divisão: onde o comprimento da metade que começa em `de` chega ao da cava dela.
    const alvo = (cabeca.lado.comprimento * (deVaiParaFrente ? frente.lado.comprimento : costas.lado.comprimento)) / total;
    const n = manga.contorno.length;
    let andado = 0;
    let divisao = cabeca.lado.de;
    let melhor = Infinity;
    for (let i = cabeca.lado.de; i !== cabeca.lado.ate; i = (i + 1) % n) {
      if (Math.abs(andado - alvo) < melhor) {
        melhor = Math.abs(andado - alvo);
        divisao = i;
      }
      andado += Math.hypot(manga.contorno[(i + 1) % n]!.x - manga.contorno[i]!.x, manga.contorno[(i + 1) % n]!.y - manga.contorno[i]!.y);
    }
    if (divisao === cabeca.lado.de || divisao === cabeca.lado.ate) continue;
    const metades = [
      { de: cabeca.lado.de, ate: divisao, cava: deVaiParaFrente ? frente : costas, comecaEmBaixo: true },
      { de: divisao, ate: cabeca.lado.ate, cava: deVaiParaFrente ? costas : frente, comecaEmBaixo: false },
    ];
    for (const m of metades) {
      // A ponta de baixo da cava: a mais baixa na arrumação.
      const cavaComecaEmBaixo = m.cava.arrumado[1]! < m.cava.arrumado[13]!;
      novas.push({
        id: novoId(),
        a: { chave: manga.chave, de: m.de, ate: m.ate, assinatura: manga.assinatura },
        b: { chave: m.cava.inst.chave, de: m.cava.lado.de, ate: m.cava.lado.ate, assinatura: m.cava.inst.assinatura },
        invertida: m.comecaEmBaixo !== cavaComecaEmBaixo,
      });
      usados.add(`${m.cava.inst.chave}|${m.cava.lado.de}|${m.cava.lado.ate}`);
    }
    usados.add(`${manga.chave}|${cabeca.lado.de}|${cabeca.lado.ate}`);
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
  const pose = typeof m.pose === 'string' && m.pose in ROTULO_DA_POSE && m.pose !== 'padrao' ? (m.pose as PoseDoManequim) : null;
  const manequim: ManequimDaMontagem = {
    publico,
    medidas,
    ...(typeof m.tamanhoDaFicha === 'string' ? { tamanhoDaFicha: m.tamanhoDaFicha } : {}),
    ...(pose ? { pose } : {}),
  };
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
        ...(typeof c.costasDaGola === 'number' && c.costasDaGola > 0 && c.costasDaGola < 1 ? { costasDaGola: c.costasDaGola } : {}),
        girarGraus: normalizarGiro(girar),
        cor: typeof c.cor === 'string' && /^#[0-9a-f]{6}$/i.test(c.cor) ? c.cor : COR_DE_PARTIDA,
      };
      const e = c.estampa;
      const s = c.sobre;
      const comSobre: ConfiguracaoDaInstancia =
        ehObjeto(s) && typeof s.chave === 'string'
          ? { ...config, sobre: { chave: s.chave, doAltoMm: numero(s.doAltoMm, 0), doMeioMm: numero(s.doMeioMm, 0), bocaEmCima: s.bocaEmCima !== false } }
          : config;
      pecas[chave] =
        ehObjeto(e) && typeof e.imagemId === 'string'
          ? { ...comSobre, estampa: { imagemId: e.imagemId, modo: e.modo === 'localizada' ? 'localizada' : 'corrida', larguraMm: Math.max(5, numero(e.larguraMm, 100)), alturaMm: numero(e.alturaMm, 0) } }
          : comSobre;
    }
  }
  const costuras: Costura3D[] = [];
  if (Array.isArray(bruto.costuras)) {
    for (const c of bruto.costuras) {
      if (!ehObjeto(c) || typeof c.id !== 'string') continue;
      const a = lerLado(c.a);
      const b = lerLado(c.b);
      if (a && b) costuras.push({ id: c.id, a, b, invertida: c.invertida === true, ...(typeof c.ziperMm === 'number' && c.ziperMm > 0 ? { ziperMm: Math.min(2000, c.ziperMm) } : {}) });
    }
  }
  const t = ehObjeto(bruto.tecido) ? bruto.tecido : {};
  const presets = [...Object.keys(TECIDOS_PRONTOS), 'personalizado'];
  const limite = (x: unknown, padrao: number): number => Math.min(100, Math.max(0, numero(x, padrao)));
  const tecido: Tecido3D = {
    preset: presets.includes(t.preset as string) ? (t.preset as PresetDeTecido) : 'malha',
    pesoGm2: Math.min(1000, Math.max(20, numero(t.pesoGm2, 160))),
    elasticidade: limite(t.elasticidade, 70),
    ...(typeof t.trama === 'string' && t.trama in ROTULO_DA_TRAMA ? { trama: t.trama as TramaDoTecido } : {}),
    ...(typeof t.elasticidadeNaTrama === 'number' ? { elasticidadeNaTrama: limite(t.elasticidadeNaTrama, 70) } : {}),
    ...(typeof t.elasticidadeNoVies === 'number' ? { elasticidadeNoVies: limite(t.elasticidadeNoVies, 70) } : {}),
    rigidez: limite(t.rigidez, 20),
    atrito: limite(t.atrito, 50),
    ...(typeof t.brilho === 'number' ? { brilho: limite(t.brilho, 0) } : {}),
    ...(typeof t.transparencia === 'number' ? { transparencia: limite(t.transparencia, 0) } : {}),
  };
  const resolucaoMm = [8, 12, 20, 30].includes(bruto.resolucaoMm as number) ? (bruto.resolucaoMm as number) : 12;
  return { manequim, pecas, costuras, tecido, resolucaoMm, ...(bruto.autoColisao === false ? { autoColisao: false } : {}) };
}

/** A configuração de cada instância: a guardada, ou a sugerida (o bolso, sobre a frente ou as costas que houver). */
export function configuracoesDasInstancias(instancias: readonly InstanciaDaPeca[], montagem: Montagem3D): Record<string, ConfiguracaoDaInstancia> {
  const r: Record<string, ConfiguracaoDaInstancia> = {};
  for (const inst of instancias) r[inst.chave] = montagem.pecas[inst.chave] ?? configuracaoSugerida(inst, larguraDaFace(inst));
  for (const inst of instancias) {
    if (montagem.pecas[inst.chave]) continue;
    const sugerida = sobreSugerida(inst, instancias, r);
    if (sugerida) r[inst.chave] = { ...r[inst.chave]!, posicao: 'sobre-outra-peca', sobre: sugerida, cor: corMaisEscura(r[sugerida.chave]!.cor) };
  }
  return r;
}

/**
 * Onde vai a peça de cima pelo nome (ADR 0123): o bolso na frente (ou nas costas, se o nome diz), um quarto da altura
 * abaixo do alto, um quarto da largura para o lado (o par, um de cada lado), com a boca em cima; a aplicação e a
 * etiqueta, costuradas em volta toda. Sem peça de baixo no corpo, nada.
 */
function sobreSugerida(inst: InstanciaDaPeca, instancias: readonly InstanciaDaPeca[], configuracoes: Readonly<Record<string, ConfiguracaoDaInstancia>>): SobreOutraPeca | null {
  const n = semAcento(inst.peca.nome);
  if (!/bolso|aplicac|etiqueta/.test(n)) return null;
  const atras = /costas|traseir/.test(n);
  const baixo = instancias.find((i) => i.chave !== inst.chave && configuracoes[i.chave]?.posicao === (atras ? 'costas' : 'frente'));
  if (!baixo) return null;
  const caixa = caixaDaFace(baixo, configuracoes[baixo.chave]!.girarGraus);
  const lado = inst.copia % 2 === 1 ? -1 : 1;
  return { chave: baixo.chave, doAltoMm: Math.round(caixa.altura * 0.25), doMeioMm: Math.round(lado * caixa.largura * 0.25), bocaEmCima: /bolso/.test(n) };
}

export interface PontoNaPecaDeBaixo {
  /** O triângulo da malha da peça de baixo (o número dele na malha) e os pesos dos seus três pontos. */
  readonly triangulo: number;
  readonly pesos: readonly [number, number, number];
}

/**
 * Onde cada ponto da peça de cima cai na de baixo (ADR 0123), pelas duas faces: o ponto vai à face da de baixo (o meio a
 * `doMeioMm` do meio dela, o alto a `doAltoMm` do alto dela) e fica no triângulo da malha de baixo que o contém, com
 * os pesos (baricêntricos). O que cai fora da peça de baixo fica no triângulo mais perto, na borda dele.
 */
export function pontosNaPecaDeBaixo(
  cima: { readonly inst: InstanciaDaPeca; readonly girarGraus: number; readonly pontos: ArrayLike<number> },
  baixo: { readonly inst: InstanciaDaPeca; readonly girarGraus: number; readonly malha: MalhaDaPeca },
  sobre: SobreOutraPeca,
): PontoNaPecaDeBaixo[] {
  const fc = coordenadasDaFace(cima.inst, cima.girarGraus, cima.pontos);
  const fb = coordenadasDaFace(baixo.inst, baixo.girarGraus, baixo.malha.pontos);
  const tri = baixo.malha.triangulos;
  const saida: PontoNaPecaDeBaixo[] = [];
  for (let i = 0; i < fc.u.length; i++) {
    const U = fc.u[i]! + sobre.doMeioMm;
    const V = fb.altura / 2 - sobre.doAltoMm - (fc.altura / 2 - fc.v[i]!);
    let melhor: PontoNaPecaDeBaixo | null = null;
    let melhorMinimo = -Infinity;
    for (let t = 0; t < tri.length / 3; t++) {
      const a = tri[3 * t]!;
      const b = tri[3 * t + 1]!;
      const c = tri[3 * t + 2]!;
      const x1 = fb.u[a]!;
      const y1 = fb.v[a]!;
      const x2 = fb.u[b]!;
      const y2 = fb.v[b]!;
      const x3 = fb.u[c]!;
      const y3 = fb.v[c]!;
      const det = (y2 - y3) * (x1 - x3) + (x3 - x2) * (y1 - y3);
      if (Math.abs(det) < 1e-12) continue;
      const l1 = ((y2 - y3) * (U - x3) + (x3 - x2) * (V - y3)) / det;
      const l2 = ((y3 - y1) * (U - x3) + (x1 - x3) * (V - y3)) / det;
      const l3 = 1 - l1 - l2;
      const minimo = Math.min(l1, l2, l3);
      if (minimo > melhorMinimo) {
        melhorMinimo = minimo;
        // Fora do triângulo: os pesos negativos vão a zero e o resto se reparte (o ponto vai para a borda).
        const p1 = Math.max(0, l1);
        const p2 = Math.max(0, l2);
        const p3 = Math.max(0, l3);
        const s = p1 + p2 + p3 || 1;
        melhor = { triangulo: t, pesos: [p1 / s, p2 / s, p3 / s] };
      }
      if (minimo >= -1e-9) break;
    }
    saida.push(melhor ?? { triangulo: 0, pesos: [1, 0, 0] });
  }
  return saida;
}

/**
 * Os pontos da borda da malha da peça de cima que são costurados na de baixo (ADR 0123): os de todos os lados do
 * contorno, menos o de cima (o mais alto na face) se ele for a boca. Os cantos da boca são costurados (são dos lados
 * vizinhos).
 */
export function pontosCosturadosDaPecaDeCima(inst: InstanciaDaPeca, girarGraus: number, malha: MalhaDaPeca, bocaEmCima: boolean): number[] {
  const lados = ladosDoContorno(inst.contorno);
  let deCima: LadoDoContorno | null = null;
  if (bocaEmCima) {
    let maior = -Infinity;
    for (const lado of lados) {
      const meio = pontoNoTrecho(inst.contorno, lado.de, lado.ate, 0.5);
      const v = coordenadasDaFace(inst, girarGraus, [meio.x, meio.y]).v[0]!;
      if (v > maior) {
        maior = v;
        deCima = lado;
      }
    }
  }
  const costurados = new Set<number>();
  for (const lado of lados) {
    if (lado === deCima) continue;
    for (const p of trechoDaBorda(malha, lado.de, lado.ate).pontos) costurados.add(p);
  }
  // Os cantos da boca entram pelos lados vizinhos; se a boca for o único lado, nada.
  return [...costurados].sort((a, b) => a - b);
}

/** O corpo da montagem. */
export const corpoDaMontagem = (montagem: Montagem3D): CorpoDoManequim => corpoDoManequim(montagem.manequim.medidas, montagem.manequim.pose, montagem.manequim.publico);

/** A malha de cada instância posta no corpo (as de fora não entram). */
export function malhasDasInstancias(
  instancias: readonly InstanciaDaPeca[],
  configuracoes: Readonly<Record<string, ConfiguracaoDaInstancia>>,
  resolucaoMm: number,
  costuras: readonly Costura3D[] = [],
): Map<string, MalhaDaPeca> {
  // Os pontos do contorno em que as costuras começam e acabam ficam na borda da malha (os outros, só os cantos).
  const pontosDasCosturas = new Map<string, number[]>();
  for (const c of costuras) {
    for (const lado of [c.a, c.b]) {
      const inst = instancias.find((i) => i.chave === lado.chave);
      if (!inst) continue;
      const lista = pontosDasCosturas.get(inst.peca.id) ?? [];
      lista.push(lado.de, lado.ate);
      pontosDasCosturas.set(inst.peca.id, lista);
    }
  }
  const malhas = new Map<string, MalhaDaPeca>();
  const porPeca = new Map<string, MalhaDaPeca>();
  for (const inst of instancias) {
    const config = configuracoes[inst.chave];
    if (!config || config.posicao === 'fora') continue;
    // As cópias da mesma peça usam a mesma malha.
    let malha = porPeca.get(inst.peca.id);
    if (!malha) {
      malha = malhaDaPeca(inst.contorno, resolucaoMm, pontosDasCosturas.get(inst.peca.id) ?? []);
      porPeca.set(inst.peca.id, malha);
    }
    malhas.set(inst.chave, malha);
  }
  return malhas;
}

export { cantosDoContorno, trechoDaBorda };

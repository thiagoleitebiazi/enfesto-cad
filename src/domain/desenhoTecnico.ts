import type { Ponto2D } from '../core/geometria';

/**
 * O desenho técnico do modelo (ADR 0107): o croqui vetorial de frente e costas que vai na ficha técnica. Cada vista
 * é uma folha de 400 × 500 pontos com o eixo do meio em x = 200: o que é marcado "espelhar" aparece também do
 * outro lado (desenha-se um lado, o outro sai). Os elementos são traços (retos ou curvos, abertos ou fechados, no
 * estilo de contorno, costura, pesponto ou detalhe), textos e estampas (uma imagem do projeto, com posição,
 * largura e rotação). As bases técnicas e as formas (bolsos, golas, punhos…) entram prontas para ajustar; o
 * manequim, por baixo, é só a guia.
 */

export const LARGURA_DA_FOLHA = 400;
export const ALTURA_DA_FOLHA = 500;
export const EIXO_DO_DESENHO = LARGURA_DA_FOLHA / 2;
export const VERSAO_DO_DESENHO = 1;

export type VistaDoDesenho = 'frente' | 'costas';
export const ROTULO_DA_VISTA: Readonly<Record<VistaDoDesenho, string>> = { frente: 'Frente', costas: 'Costas' };

export type EstiloDoTraco = 'contorno' | 'costura' | 'pesponto' | 'detalhe';
export const ROTULO_DO_ESTILO: Readonly<Record<EstiloDoTraco, string>> = {
  contorno: 'Contorno',
  costura: 'Costura',
  pesponto: 'Pesponto',
  detalhe: 'Detalhe',
};
/** O tracejado de cada estilo (`null`: contínuo). */
export const TRACEJADO_DO_ESTILO: Readonly<Record<EstiloDoTraco, readonly [number, number] | null>> = {
  contorno: null,
  costura: null,
  pesponto: [4, 3],
  detalhe: null,
};
export const ESPESSURA_DO_ESTILO: Readonly<Record<EstiloDoTraco, number>> = { contorno: 2, costura: 1.2, pesponto: 1, detalhe: 1.2 };

export interface TracoDoDesenho {
  readonly id: string;
  readonly tipo: 'traco';
  readonly vista: VistaDoDesenho;
  readonly pontos: readonly Ponto2D[];
  /** Passa suave pelos pontos (curva), em vez de ligar com retas. */
  readonly curvo: boolean;
  readonly fechado: boolean;
  readonly estilo: EstiloDoTraco;
  readonly cor: string;
  readonly espessura: number;
  /** A cor de dentro (só no fechado); `null`: sem. */
  readonly preenchimento: string | null;
  readonly espelhar: boolean;
}

export interface TextoDoDesenho {
  readonly id: string;
  readonly tipo: 'texto';
  readonly vista: VistaDoDesenho;
  readonly posicao: Ponto2D;
  readonly texto: string;
  readonly tamanho: number;
  readonly cor: string;
}

export interface EstampaDoDesenho {
  readonly id: string;
  readonly tipo: 'estampa';
  readonly vista: VistaDoDesenho;
  /** A imagem do projeto (Modelo › Imagens). */
  readonly imagemId: string;
  readonly centro: Ponto2D;
  /** A largura na folha (a altura sai da proporção da imagem). */
  readonly largura: number;
  readonly rotacaoGraus: number;
  readonly opacidade: number;
  readonly espelhar: boolean;
}

export type ElementoDoDesenho = TracoDoDesenho | TextoDoDesenho | EstampaDoDesenho;

export type Manequim = 'feminino' | 'masculino';
export const ROTULO_DO_MANEQUIM: Readonly<Record<Manequim, string>> = { feminino: 'Feminino', masculino: 'Masculino' };

export interface DesenhoTecnico {
  readonly versaoDoFormato: number;
  readonly elementos: readonly ElementoDoDesenho[];
  /** O manequim de guia, por baixo (não sai no PDF). */
  readonly manequim: Manequim | null;
}

export const DESENHO_VAZIO: DesenhoTecnico = { versaoDoFormato: VERSAO_DO_DESENHO, elementos: [], manequim: 'feminino' };

// ---- A geometria

/** O ponto do outro lado do eixo. */
export const espelharPonto = (p: Ponto2D): Ponto2D => ({ x: 2 * EIXO_DO_DESENHO - p.x, y: p.y });

/** O elemento do outro lado do eixo (o traço com os pontos espelhados; a estampa virada e girada ao contrário). */
export function espelharElemento(e: ElementoDoDesenho): ElementoDoDesenho {
  switch (e.tipo) {
    case 'traco':
      return { ...e, id: `${e.id}~`, pontos: e.pontos.map(espelharPonto) };
    case 'estampa':
      return { ...e, id: `${e.id}~`, centro: espelharPonto(e.centro), rotacaoGraus: -e.rotacaoGraus };
    default:
      return { ...e, id: `${e.id}~`, posicao: espelharPonto(e.posicao) };
  }
}

/** O que vai na folha da vista, na ordem: os elementos e, logo depois de cada um marcado, o espelhado. */
export function elementosDaVista(desenho: DesenhoTecnico, vista: VistaDoDesenho): ElementoDoDesenho[] {
  const lista: ElementoDoDesenho[] = [];
  for (const e of desenho.elementos) {
    if (e.vista !== vista) continue;
    lista.push(e);
    if (e.tipo !== 'texto' && e.espelhar) lista.push(espelharElemento(e));
  }
  return lista;
}

const arredondar = (v: number): number => Math.round(v * 100) / 100;

/**
 * O caminho SVG do traço: retas, ou a curva que passa pelos pontos (Catmull-Rom em Bézier cúbicas), aberto ou
 * fechado. O PDF desenha o mesmo caminho.
 */
export function caminhoDoTraco(pontos: readonly Ponto2D[], curvo: boolean, fechado: boolean): string {
  if (pontos.length === 0) return '';
  const p = (q: Ponto2D): string => `${arredondar(q.x)} ${arredondar(q.y)}`;
  if (!curvo || pontos.length < 3) return `M ${p(pontos[0]!)}${pontos.slice(1).map((q) => ` L ${p(q)}`).join('')}${fechado ? ' Z' : ''}`;
  const n = pontos.length;
  const em = (i: number): Ponto2D => (fechado ? pontos[((i % n) + n) % n]! : pontos[Math.max(0, Math.min(n - 1, i))]!);
  const segmentos = fechado ? n : n - 1;
  let d = `M ${p(pontos[0]!)}`;
  for (let i = 0; i < segmentos; i++) {
    const p0 = em(i - 1);
    const p1 = em(i);
    const p2 = em(i + 1);
    const p3 = em(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${p(c1)} ${p(c2)} ${p(p2)}`;
  }
  return fechado ? `${d} Z` : d;
}

/** Os pontos por onde o traço passa (a curva amostrada), para medir a distância de um clique. */
export function pontosDoTraco(t: Pick<TracoDoDesenho, 'pontos' | 'curvo' | 'fechado'>): Ponto2D[] {
  const { pontos } = t;
  if (!t.curvo || pontos.length < 3) return t.fechado && pontos.length > 2 ? [...pontos, pontos[0]!] : [...pontos];
  const n = pontos.length;
  const em = (i: number): Ponto2D => (t.fechado ? pontos[((i % n) + n) % n]! : pontos[Math.max(0, Math.min(n - 1, i))]!);
  const saida: Ponto2D[] = [pontos[0]!];
  for (let i = 0; i < (t.fechado ? n : n - 1); i++) {
    const [p0, p1, p2, p3] = [em(i - 1), em(i), em(i + 1), em(i + 2)];
    for (let k = 1; k <= 8; k++) {
      const s = k / 8;
      const s2 = s * s;
      const s3 = s2 * s;
      saida.push({
        x: 0.5 * (2 * p1.x + (-p0.x + p2.x) * s + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * s2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * s3),
        y: 0.5 * (2 * p1.y + (-p0.y + p2.y) * s + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * s2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * s3),
      });
    }
  }
  return saida;
}

function distanciaAoSegmento(p: Ponto2D, a: Ponto2D, b: Ponto2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const l2 = dx * dx + dy * dy;
  const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

function dentroDoPoligono(p: Ponto2D, poligono: readonly Ponto2D[]): boolean {
  let dentro = false;
  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const a = poligono[i]!;
    const b = poligono[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}

/** A caixa do texto na folha (a largura estimada pelo número de letras). */
export function caixaDoTexto(t: TextoDoDesenho): { readonly x: number; readonly y: number; readonly largura: number; readonly altura: number } {
  return { x: t.posicao.x, y: t.posicao.y - t.tamanho, largura: Math.max(t.tamanho, t.texto.length * t.tamanho * 0.55), altura: t.tamanho * 1.25 };
}

/** Os quatro cantos da estampa na folha (girada), com a altura pela proporção da imagem. */
export function cantosDaEstampa(e: EstampaDoDesenho, proporcao: number): Ponto2D[] {
  const meiaL = e.largura / 2;
  const meiaA = (e.largura * proporcao) / 2;
  const r = (e.rotacaoGraus * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return [
    [-meiaL, -meiaA],
    [meiaL, -meiaA],
    [meiaL, meiaA],
    [-meiaL, meiaA],
  ].map(([x, y]) => ({ x: e.centro.x + x! * cos - y! * sin, y: e.centro.y + x! * sin + y! * cos }));
}

/** Se o ponto pega o elemento (a até `tolerancia` do traço; dentro do fechado preenchido, do texto ou da estampa). */
export function pontoPegaElemento(e: ElementoDoDesenho, p: Ponto2D, tolerancia: number, proporcaoDaImagem = 1): boolean {
  if (e.tipo === 'texto') {
    const c = caixaDoTexto(e);
    return p.x >= c.x - tolerancia && p.x <= c.x + c.largura + tolerancia && p.y >= c.y - tolerancia && p.y <= c.y + c.altura + tolerancia;
  }
  if (e.tipo === 'estampa') return dentroDoPoligono(p, cantosDaEstampa(e, proporcaoDaImagem));
  const caminho = pontosDoTraco(e);
  for (let i = 1; i < caminho.length; i++) if (distanciaAoSegmento(p, caminho[i - 1]!, caminho[i]!) <= tolerancia) return true;
  if (caminho.length === 1) return Math.hypot(p.x - caminho[0]!.x, p.y - caminho[0]!.y) <= tolerancia;
  return e.fechado && e.preenchimento !== null && dentroDoPoligono(p, caminho);
}

/** O elemento de cima que o ponto pega na vista (o espelhado conta como o original); `null`: nenhum. */
export function elementoNoPonto(desenho: DesenhoTecnico, vista: VistaDoDesenho, p: Ponto2D, tolerancia: number, proporcoes: (imagemId: string) => number = () => 1): string | null {
  const naFolha = elementosDaVista(desenho, vista);
  for (let i = naFolha.length - 1; i >= 0; i--) {
    const e = naFolha[i]!;
    if (pontoPegaElemento(e, p, tolerancia, e.tipo === 'estampa' ? proporcoes(e.imagemId) : 1)) return e.id.replace(/~$/, '');
  }
  return null;
}

// ---- As mudanças

export function adicionarElemento(desenho: DesenhoTecnico, elementos: ElementoDoDesenho | readonly ElementoDoDesenho[]): DesenhoTecnico {
  return { ...desenho, elementos: [...desenho.elementos, ...(Array.isArray(elementos) ? elementos : [elementos as ElementoDoDesenho])] };
}

export function mudarElemento(desenho: DesenhoTecnico, id: string, mudar: (e: ElementoDoDesenho) => ElementoDoDesenho): DesenhoTecnico {
  return { ...desenho, elementos: desenho.elementos.map((e) => (e.id === id ? mudar(e) : e)) };
}

export function removerElemento(desenho: DesenhoTecnico, id: string): DesenhoTecnico {
  return { ...desenho, elementos: desenho.elementos.filter((e) => e.id !== id) };
}

/** O elemento andado (dx, dy) na folha. */
export function moverElemento(e: ElementoDoDesenho, dx: number, dy: number): ElementoDoDesenho {
  const andar = (q: Ponto2D): Ponto2D => ({ x: arredondar(q.x + dx), y: arredondar(q.y + dy) });
  switch (e.tipo) {
    case 'traco':
      return { ...e, pontos: e.pontos.map(andar) };
    case 'estampa':
      return { ...e, centro: andar(e.centro) };
    default:
      return { ...e, posicao: andar(e.posicao) };
  }
}

/** Uma cópia do elemento, um pouco ao lado. */
export function duplicarElemento(e: ElementoDoDesenho, novoId: string): ElementoDoDesenho {
  return { ...moverElemento(e, 12, 12), id: novoId };
}

/** Leva o elemento para a frente (+1: por cima de todos) ou para trás (−1: por baixo de todos). */
export function ordemDoElemento(desenho: DesenhoTecnico, id: string, para: 1 | -1): DesenhoTecnico {
  const e = desenho.elementos.find((x) => x.id === id);
  if (!e) return desenho;
  const resto = desenho.elementos.filter((x) => x.id !== id);
  return { ...desenho, elementos: para === 1 ? [...resto, e] : [e, ...resto] };
}

/** Copia os elementos de uma vista para a outra (o que é igual na frente e nas costas). */
export function copiarParaAOutraVista(e: ElementoDoDesenho, novoId: string): ElementoDoDesenho {
  return { ...e, id: novoId, vista: e.vista === 'frente' ? 'costas' : 'frente' };
}

// ---- As formas e as bases técnicas

/** Um traço novo, com o estilo e as cores padrão. */
export function novoTraco(id: string, vista: VistaDoDesenho, pontos: readonly Ponto2D[], opcoes: Partial<Omit<TracoDoDesenho, 'id' | 'tipo' | 'vista' | 'pontos'>> = {}): TracoDoDesenho {
  const estilo = opcoes.estilo ?? 'contorno';
  return {
    id,
    tipo: 'traco',
    vista,
    pontos,
    curvo: opcoes.curvo ?? false,
    fechado: opcoes.fechado ?? false,
    estilo,
    cor: opcoes.cor ?? '#1f2933',
    espessura: opcoes.espessura ?? ESPESSURA_DO_ESTILO[estilo],
    preenchimento: opcoes.preenchimento ?? null,
    espelhar: opcoes.espelhar ?? false,
  };
}

/** A metade esquerda (do eixo, por fora, de volta ao eixo) e o espelho dela: o contorno inteiro, fechado. */
export function contornoPelaMetade(metade: readonly Ponto2D[]): Ponto2D[] {
  const espelho = [...metade].reverse().map(espelharPonto);
  // Os pontos no eixo não se repetem.
  const semRepetir = espelho.filter((q, i) => !(i === 0 && Math.abs(q.x - EIXO_DO_DESENHO) < 1e-9) && !(i === espelho.length - 1 && Math.abs(q.x - EIXO_DO_DESENHO) < 1e-9));
  return [...metade, ...semRepetir];
}

interface ModeloDeForma {
  readonly nome: string;
  readonly tracos: ReadonlyArray<{ readonly pontos: readonly Ponto2D[]; readonly estilo: EstiloDoTraco; readonly fechado: boolean; readonly curvo?: boolean }>;
}

const pt = (x: number, y: number): Ponto2D => ({ x, y });
const circulo = (cx: number, cy: number, r: number, lados = 12): Ponto2D[] =>
  Array.from({ length: lados }, (_, i) => pt(arredondar(cx + r * Math.cos((2 * Math.PI * i) / lados)), arredondar(cy + r * Math.sin((2 * Math.PI * i) / lados))));

/** As formas da biblioteca, desenhadas a partir de (0, 0); entram no meio da folha (e podem ser movidas). */
export const FORMAS: Readonly<Record<string, ModeloDeForma>> = {
  'bolso-chapa': {
    nome: 'Bolso chapa',
    tracos: [
      { pontos: [pt(0, 0), pt(44, 0), pt(44, 42), pt(22, 50), pt(0, 42)], estilo: 'contorno', fechado: true },
      { pontos: [pt(3, 5), pt(41, 5), pt(41, 40), pt(22, 47), pt(3, 40)], estilo: 'pesponto', fechado: true },
    ],
  },
  'bolso-faca': {
    nome: 'Bolso faca (abertura)',
    tracos: [
      { pontos: [pt(0, 0), pt(26, 38)], estilo: 'costura', fechado: false },
      { pontos: [pt(4, 0), pt(30, 38)], estilo: 'pesponto', fechado: false },
    ],
  },
  'bolso-embutido': {
    nome: 'Bolso embutido (vivo)',
    tracos: [
      { pontos: [pt(0, 0), pt(46, 0), pt(46, 6), pt(0, 6)], estilo: 'contorno', fechado: true },
      { pontos: [pt(0, 3), pt(46, 3)], estilo: 'costura', fechado: false },
    ],
  },
  punho: {
    nome: 'Punho',
    tracos: [
      { pontos: [pt(0, 0), pt(52, 0), pt(52, 16), pt(0, 16)], estilo: 'contorno', fechado: true },
      { pontos: [pt(0, 3), pt(52, 3)], estilo: 'pesponto', fechado: false },
    ],
  },
  cos: {
    nome: 'Cós',
    tracos: [
      { pontos: [pt(0, 0), pt(160, 0), pt(160, 18), pt(0, 18)], estilo: 'contorno', fechado: true },
      { pontos: [pt(0, 3), pt(160, 3)], estilo: 'pesponto', fechado: false },
      { pontos: [pt(0, 15), pt(160, 15)], estilo: 'pesponto', fechado: false },
    ],
  },
  passante: { nome: 'Passante', tracos: [{ pontos: [pt(0, 0), pt(7, 0), pt(7, 22), pt(0, 22)], estilo: 'contorno', fechado: true }] },
  carcela: {
    nome: 'Carcela (vista de botões)',
    tracos: [
      { pontos: [pt(0, 0), pt(18, 0), pt(18, 110), pt(0, 110)], estilo: 'contorno', fechado: true },
      { pontos: [pt(3, 0), pt(3, 110)], estilo: 'pesponto', fechado: false },
      { pontos: [pt(15, 0), pt(15, 110)], estilo: 'pesponto', fechado: false },
    ],
  },
  botao: {
    nome: 'Botão',
    tracos: [
      { pontos: circulo(5, 5, 5), estilo: 'detalhe', fechado: true },
      { pontos: circulo(5, 5, 1.2, 6), estilo: 'detalhe', fechado: true },
    ],
  },
  ziper: {
    nome: 'Zíper',
    tracos: [
      { pontos: [pt(0, 0), pt(0, 120)], estilo: 'costura', fechado: false },
      { pontos: [pt(-3, 0), pt(3, 0), pt(3, 9), pt(-3, 9)], estilo: 'detalhe', fechado: true },
      { pontos: [pt(-6, 0), pt(-6, 124), pt(6, 124), pt(6, 0)], estilo: 'pesponto', fechado: false },
    ],
  },
  'gola-redonda': {
    nome: 'Gola redonda (ribana)',
    tracos: [
      { pontos: [pt(0, 0), pt(20, 16), pt(40, 20), pt(60, 16), pt(80, 0)], estilo: 'contorno', fechado: false, curvo: true },
      { pontos: [pt(-5, 2), pt(18, 24), pt(40, 29), pt(62, 24), pt(85, 2)], estilo: 'costura', fechado: false, curvo: true },
    ],
  },
  'gola-v': {
    nome: 'Gola V',
    tracos: [
      { pontos: [pt(0, 0), pt(30, 42), pt(60, 0)], estilo: 'contorno', fechado: false },
      { pontos: [pt(-6, 2), pt(30, 52), pt(66, 2)], estilo: 'costura', fechado: false },
    ],
  },
  'gola-polo': {
    nome: 'Gola polo',
    tracos: [
      { pontos: [pt(0, 0), pt(-14, 22), pt(18, 30), pt(36, 14)], estilo: 'contorno', fechado: true },
      { pontos: [pt(72, 0), pt(86, 22), pt(54, 30), pt(36, 14)], estilo: 'contorno', fechado: true },
    ],
  },
  etiqueta: { nome: 'Etiqueta', tracos: [{ pontos: [pt(0, 0), pt(24, 0), pt(24, 12), pt(0, 12)], estilo: 'detalhe', fechado: true }] },
};

/** A forma da biblioteca como traços novos, com o meio dela no ponto dado. */
export function tracosDaForma(chave: string, vista: VistaDoDesenho, centro: Ponto2D, novoId: () => string, espelhar = false): TracoDoDesenho[] {
  const forma = FORMAS[chave];
  if (!forma) return [];
  const todos = forma.tracos.flatMap((t) => t.pontos);
  const minX = Math.min(...todos.map((q) => q.x));
  const maxX = Math.max(...todos.map((q) => q.x));
  const minY = Math.min(...todos.map((q) => q.y));
  const maxY = Math.max(...todos.map((q) => q.y));
  const dx = centro.x - (minX + maxX) / 2;
  const dy = centro.y - (minY + maxY) / 2;
  return forma.tracos.map((t) =>
    novoTraco(
      novoId(),
      vista,
      t.pontos.map((q) => pt(arredondar(q.x + dx), arredondar(q.y + dy))),
      { estilo: t.estilo, fechado: t.fechado, curvo: t.curvo ?? false, espelhar },
    ),
  );
}

interface ModeloDeBase {
  readonly nome: string;
  /** A metade esquerda do contorno de cada vista (do eixo, por fora, de volta ao eixo). */
  readonly frente: readonly Ponto2D[];
  readonly costas: readonly Ponto2D[];
  /** Os detalhes da metade esquerda (espelhados): costuras, pespontos, barras. */
  readonly detalhes?: ReadonlyArray<{ readonly vista: VistaDoDesenho; readonly pontos: readonly Ponto2D[]; readonly estilo: EstiloDoTraco; readonly curvo?: boolean }>;
}

/** As bases técnicas: o contorno da peça, de frente e de costas, para começar o desenho. */
export const BASES: Readonly<Record<string, ModeloDeBase>> = {
  camiseta: {
    nome: 'Camiseta',
    frente: [pt(200, 92), pt(184, 88), pt(172, 79), pt(164, 64), pt(110, 76), pt(66, 146), pt(94, 164), pt(117, 134), pt(121, 444), pt(200, 448)],
    costas: [pt(200, 70), pt(182, 69), pt(164, 64), pt(110, 76), pt(66, 146), pt(94, 164), pt(117, 134), pt(121, 444), pt(200, 448)],
    detalhes: [
      { vista: 'frente', pontos: [pt(200, 100), pt(182, 96), pt(168, 85), pt(159, 70)], estilo: 'costura', curvo: true },
      { vista: 'frente', pontos: [pt(121, 434), pt(200, 438)], estilo: 'pesponto' },
      { vista: 'costas', pontos: [pt(121, 434), pt(200, 438)], estilo: 'pesponto' },
    ],
  },
  regata: {
    nome: 'Regata',
    frente: [pt(200, 112), pt(180, 104), pt(166, 88), pt(160, 64), pt(140, 64), pt(132, 108), pt(120, 146), pt(122, 444), pt(200, 448)],
    costas: [pt(200, 84), pt(178, 80), pt(162, 64), pt(140, 64), pt(132, 108), pt(120, 146), pt(122, 444), pt(200, 448)],
    detalhes: [{ vista: 'frente', pontos: [pt(122, 434), pt(200, 438)], estilo: 'pesponto' }],
  },
  calca: {
    nome: 'Calça',
    frente: [pt(200, 56), pt(124, 56), pt(116, 150), pt(110, 454), pt(178, 454), pt(194, 206), pt(200, 196)],
    costas: [pt(200, 50), pt(124, 56), pt(116, 150), pt(110, 454), pt(178, 454), pt(194, 206), pt(200, 196)],
    detalhes: [
      { vista: 'frente', pontos: [pt(124, 74), pt(200, 74)], estilo: 'costura' },
      { vista: 'frente', pontos: [pt(200, 74), pt(200, 160)], estilo: 'pesponto' },
      { vista: 'frente', pontos: [pt(132, 74), pt(150, 112)], estilo: 'costura' },
      { vista: 'costas', pontos: [pt(124, 72), pt(200, 68)], estilo: 'costura' },
      { vista: 'costas', pontos: [pt(132, 108), pt(176, 104), pt(176, 150), pt(154, 160), pt(132, 150), pt(132, 108)], estilo: 'pesponto' },
    ],
  },
  shorts: {
    nome: 'Shorts',
    frente: [pt(200, 56), pt(124, 56), pt(116, 150), pt(112, 250), pt(184, 250), pt(194, 206), pt(200, 196)],
    costas: [pt(200, 50), pt(124, 56), pt(116, 150), pt(112, 250), pt(184, 250), pt(194, 206), pt(200, 196)],
    detalhes: [
      { vista: 'frente', pontos: [pt(124, 74), pt(200, 74)], estilo: 'costura' },
      { vista: 'frente', pontos: [pt(112, 240), pt(185, 240)], estilo: 'pesponto' },
    ],
  },
  saia: {
    nome: 'Saia',
    frente: [pt(200, 60), pt(132, 60), pt(124, 130), pt(104, 380), pt(200, 386)],
    costas: [pt(200, 58), pt(132, 60), pt(124, 130), pt(104, 380), pt(200, 386)],
    detalhes: [
      { vista: 'frente', pontos: [pt(132, 76), pt(200, 76)], estilo: 'costura' },
      { vista: 'costas', pontos: [pt(132, 76), pt(200, 76)], estilo: 'costura' },
      { vista: 'costas', pontos: [pt(200, 76), pt(200, 190)], estilo: 'costura' },
    ],
  },
  vestido: {
    nome: 'Vestido',
    frente: [pt(200, 100), pt(182, 94), pt(170, 82), pt(162, 64), pt(132, 66), pt(128, 116), pt(118, 150), pt(130, 236), pt(98, 454), pt(200, 460)],
    costas: [pt(200, 74), pt(180, 72), pt(162, 64), pt(132, 66), pt(128, 116), pt(118, 150), pt(130, 236), pt(98, 454), pt(200, 460)],
    detalhes: [
      { vista: 'frente', pontos: [pt(130, 236), pt(200, 240)], estilo: 'costura' },
      { vista: 'costas', pontos: [pt(130, 236), pt(200, 240)], estilo: 'costura' },
      { vista: 'costas', pontos: [pt(200, 74), pt(200, 220)], estilo: 'costura' },
    ],
  },
};

/** A base técnica como traços novos: o contorno inteiro de cada vista (fechado) e os detalhes (espelhados). */
export function tracosDaBase(chave: string, novoId: () => string): TracoDoDesenho[] {
  const base = BASES[chave];
  if (!base) return [];
  return [
    novoTraco(novoId(), 'frente', contornoPelaMetade(base.frente), { fechado: true }),
    novoTraco(novoId(), 'costas', contornoPelaMetade(base.costas), { fechado: true }),
    ...(base.detalhes ?? []).map((d) => novoTraco(novoId(), d.vista, d.pontos, { estilo: d.estilo, curvo: d.curvo ?? false, espelhar: true })),
  ];
}

/** O manequim de guia (a metade esquerda do contorno do corpo, e a cabeça), na mesma folha. */
export const MANEQUINS: Readonly<Record<Manequim, { readonly corpo: readonly Ponto2D[]; readonly cabeca: readonly Ponto2D[] }>> = {
  feminino: {
    corpo: [pt(200, 52), pt(190, 52), pt(188, 64), pt(168, 70), pt(132, 78), pt(118, 96), pt(104, 210), pt(92, 286), pt(102, 288), pt(116, 214), pt(126, 140), pt(134, 188), pt(126, 232), pt(118, 292), pt(130, 440), pt(138, 482), pt(162, 484), pt(166, 440), pt(186, 290), pt(200, 280)],
    cabeca: circulo(200, 28, 22, 16).map((q) => pt(q.x, arredondar(28 + (q.y - 28) * 1.18))),
  },
  masculino: {
    corpo: [pt(200, 52), pt(188, 52), pt(186, 66), pt(162, 72), pt(118, 82), pt(104, 102), pt(92, 214), pt(82, 290), pt(94, 292), pt(108, 218), pt(120, 146), pt(126, 200), pt(122, 246), pt(118, 300), pt(128, 440), pt(134, 484), pt(160, 486), pt(166, 440), pt(186, 296), pt(200, 286)],
    cabeca: circulo(200, 28, 22, 16).map((q) => pt(q.x, arredondar(28 + (q.y - 28) * 1.2))),
  },
};

// ---- A leitura (de dentro da ficha)

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const ehPonto = (v: unknown): v is Ponto2D => ehObjeto(v) && typeof v.x === 'number' && typeof v.y === 'number' && Number.isFinite(v.x) && Number.isFinite(v.y);
const ehVista = (v: unknown): v is VistaDoDesenho => v === 'frente' || v === 'costas';

function elementoLido(e: unknown): ElementoDoDesenho | null {
  if (!ehObjeto(e) || typeof e.id !== 'string' || !ehVista(e.vista)) return null;
  if (e.tipo === 'traco' && Array.isArray(e.pontos) && e.pontos.every(ehPonto) && typeof e.estilo === 'string' && e.estilo in ROTULO_DO_ESTILO) return e as unknown as TracoDoDesenho;
  if (e.tipo === 'texto' && ehPonto(e.posicao) && typeof e.texto === 'string' && typeof e.tamanho === 'number') return e as unknown as TextoDoDesenho;
  if (e.tipo === 'estampa' && ehPonto(e.centro) && typeof e.imagemId === 'string' && typeof e.largura === 'number' && typeof e.rotacaoGraus === 'number') return e as unknown as EstampaDoDesenho;
  return null;
}

/** O desenho guardado na ficha, conferido (`null`: não há). O elemento quebrado fica de fora. */
export function lerDesenhoTecnico(bruto: unknown): DesenhoTecnico | null {
  if (!ehObjeto(bruto) || !Array.isArray(bruto.elementos)) return null;
  const elementos = bruto.elementos.map(elementoLido).filter((e): e is ElementoDoDesenho => e !== null);
  const manequim = bruto.manequim === 'feminino' || bruto.manequim === 'masculino' ? bruto.manequim : null;
  return { versaoDoFormato: VERSAO_DO_DESENHO, elementos, manequim };
}

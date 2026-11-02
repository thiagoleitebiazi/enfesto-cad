import type { Ponto2D } from '../core/geometria';
import type { Molde } from './molde';
import {
  cabecaDaManga,
  configuracoesDasInstancias,
  coordenadasDaFace,
  corpoDaMontagem,
  decoteDaPeca,
  eixoDaManga,
  diferencaDasPontas,
  ganchoNaFace,
  giroPelaForma,
  instanciasDasPecas,
  ladosDoContorno,
  pernaPeloGancho,
  ROTULO_DA_POSICAO,
  sugerirCosturas,
  trechoDoContorno,
  type ConfiguracaoDaInstancia,
  type InstanciaDaPeca,
  type Montagem3D,
  type PosicaoNoCorpo,
} from './montagem3d';

/**
 * O que é cada peça, pela forma (ADR 0234). O arquivo de um molde costuma trazer as peças sem nome, e a arrumação pelo nome
 * deixava tudo fora do corpo: quem abria o provador tinha de pôr peça por peça. Só se reconhece o que dá para afirmar: uma peça de
 * tronco, com decote e ombros, e, com ela, as mangas e a gola; sem tronco, as duas peças com gancho de uma calça, ou as duas de uma
 * saia (ADR 0237). O resto fica como estava.
 */
export type FormaDaPeca = 'tronco' | 'manga' | 'gola' | 'perna' | 'saia';

type Contorno = readonly Ponto2D[];

const GIROS_DA_PECA = [0, 90, 180, 270] as const;
/** A gola: um retângulo ao menos 4 vezes mais comprido que largo, nesta faixa (mm). */
const MAIOR_LARGURA_DA_GOLA = 120;
const COMPRIMENTOS_DA_GOLA = { menor: 250, maior: 900 };
/** A folga da barra do punho: as orelhas mais compridas que isto (mm) já são outra coisa. */
const MAIOR_FOLGA_DO_PUNHO = 45;
/** A maior distância entre os pontos da cabeça da manga (mm): a divisão em frente e costas cai num deles. */
const PASSO_DA_CABECA_MM = 6;
/** A peça de perna é ao menos tão alta quanto isto vezes a largura, e o gancho, ao menos isto (mm). */
const PERNA_EM_PE = 0.8;
const MENOR_GANCHO_MM = 25;
/** A peça de saia: a faixa de tamanhos (mm). */
const TAMANHOS_DA_SAIA = { alturaMenor: 250, alturaMaior: 1300, larguraMenor: 150, larguraMaior: 900 };
/** A peça com menos que isto da área da maior é miudeza (o bolso): não muda o que a roupa é. */
const MIUDEZA_NA_AREA = 0.25;
/** A manga até este comprimento (mm) é chamada de curta. */
const MANGA_CURTA_ATE = 400;

const contornoComoPontos = (c: Contorno): Float64Array => {
  const a = new Float64Array(c.length * 2);
  c.forEach((p, i) => a.set([p.x, p.y], 2 * i));
  return a;
};

function areaDe(c: Contorno): number {
  let s = 0;
  for (let i = 0; i < c.length; i++) {
    const p = c[i]!;
    const q = c[(i + 1) % c.length]!;
    s += p.x * q.y - q.x * p.y;
  }
  return s / 2;
}

interface Retangulo {
  /** A direção do comprimento e a da largura, e a origem (o canto de onde as duas saem). */
  readonly e: Ponto2D;
  readonly f: Ponto2D;
  readonly origem: Ponto2D;
  readonly comprimento: number;
  readonly largura: number;
}

/** O menor retângulo em volta do contorno, com um lado na direção de algum dos lados dele (de canto a canto). */
function retanguloDoContorno(c: Contorno): Retangulo | null {
  let melhor: (Retangulo & { readonly area: number }) | null = null;
  for (const lado of ladosDoContorno(c)) {
    const p = c[lado.de]!;
    const q = c[lado.ate]!;
    const L = Math.hypot(q.x - p.x, q.y - p.y);
    if (L < 20) continue;
    const a = { x: (q.x - p.x) / L, y: (q.y - p.y) / L };
    const b = { x: -a.y, y: a.x };
    let [a0, a1, b0, b1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const r of c) {
      const s = r.x * a.x + r.y * a.y;
      const t = r.x * b.x + r.y * b.y;
      a0 = Math.min(a0, s);
      a1 = Math.max(a1, s);
      b0 = Math.min(b0, t);
      b1 = Math.max(b1, t);
    }
    const area = (a1 - a0) * (b1 - b0);
    if (melhor && area >= melhor.area) continue;
    const deitado = a1 - a0 >= b1 - b0;
    melhor = {
      e: deitado ? a : b,
      f: deitado ? b : a,
      origem: { x: a.x * a0 + b.x * b0, y: a.y * a0 + b.y * b0 },
      comprimento: Math.max(a1 - a0, b1 - b0),
      largura: Math.min(a1 - a0, b1 - b0),
      area,
    };
  }
  return melhor;
}

function golaDoContorno(c: Contorno): Retangulo | null {
  const r = retanguloDoContorno(c);
  if (!r || r.comprimento < 4 * r.largura || r.largura > MAIOR_LARGURA_DA_GOLA) return null;
  if (r.comprimento < COMPRIMENTOS_DA_GOLA.menor || r.comprimento > COMPRIMENTOS_DA_GOLA.maior) return null;
  return Math.abs(areaDe(c)) >= 0.85 * r.comprimento * r.largura ? r : null;
}

/** A linha de cima do contorno na coluna `alvo`: o ponto mais alto em que ele a cruza. */
function altoDaColuna(u: ArrayLike<number>, v: ArrayLike<number>, alvo: number): number {
  let alto = -Infinity;
  for (let i = 0; i < u.length; i++) {
    const j = (i + 1) % u.length;
    if ((u[i]! - alvo) * (u[j]! - alvo) > 0 || u[i] === u[j]) continue;
    alto = Math.max(alto, v[i]! + ((v[j]! - v[i]!) * (alvo - u[i]!)) / (u[j]! - u[i]!));
  }
  return alto;
}

/**
 * A profundidade do decote de uma peça vista pela face, de pé: o alto do contorno sobe dos dois lados do meio (os pontos em que o
 * pescoço encontra os ombros) e dali desce para os lados (os ombros). `null`: a peça não tem essa forma.
 */
function decoteNaFace(face: { readonly u: ArrayLike<number>; readonly v: ArrayLike<number>; readonly largura: number; readonly altura: number }): number | null {
  const { u, v, largura, altura } = face;
  if (altura < 0.8 * largura || altura > 4 * largura) return null;
  const colunas = 60;
  let [picoE, picoD, uE, uD] = [-Infinity, -Infinity, 0, 0];
  for (let k = 1; k < colunas; k++) {
    const q = -largura / 2 + (largura * k) / colunas;
    const h = altoDaColuna(u, v, q);
    if (q < 0 && h > picoE) [picoE, uE] = [h, q];
    if (q > 0 && h > picoD) [picoD, uD] = [h, q];
  }
  const entrePicos = uD - uE;
  // Os picos são os pés do pescoço: longe das beiradas, e não colados no meio. Na saia, os picos da cintura ficam nos cantos.
  if (entrePicos < 0.12 * largura || entrePicos > 0.75 * largura || Math.abs(picoE - picoD) > 20) return null;
  // Depois dos picos vêm os ombros, que descem devagar. Na saia evasê, a cintura curva imita um decote, mas dali a lateral despenca.
  const passo = 0.06 * largura;
  if (altoDaColuna(u, v, uE - passo) < picoE - passo || altoDaColuna(u, v, uD + passo) < picoD - passo) return null;
  const fundo = Math.min(picoE, picoD) - altoDaColuna(u, v, 0);
  return fundo >= 10 ? fundo : null;
}

/** O giro que põe o decote da peça em cima e a profundidade dele; `null`: a peça não é de tronco. */
function troncoDaInstancia(inst: InstanciaDaPeca): { readonly giro: number; readonly decote: number } | null {
  const pontos = contornoComoPontos(inst.contorno);
  let melhor: { giro: number; decote: number } | null = null;
  for (const giro of GIROS_DA_PECA) {
    const decote = decoteNaFace(coordenadasDaFace(inst, giro, pontos));
    if (decote !== null && (!melhor || decote > melhor.decote)) melhor = { giro, decote };
  }
  return melhor;
}

/** O giro que põe a peça da perna de pé, com o gancho na metade de cima, e o tamanho dele; `null`: a peça não tem gancho. */
function pernaDaInstancia(inst: InstanciaDaPeca): { readonly giro: number; readonly gancho: number } | null {
  const pontos = contornoComoPontos(inst.contorno);
  let melhor: { giro: number; gancho: number } | null = null;
  for (const giro of GIROS_DA_PECA) {
    const face = coordenadasDaFace(inst, giro, pontos);
    if (face.altura < PERNA_EM_PE * face.largura) continue;
    const { direita, esquerda } = ganchoNaFace(face.u, face.v);
    const gancho = Math.max(direita, esquerda);
    if (gancho >= MENOR_GANCHO_MM && Math.abs(direita - esquerda) >= 15 && (!melhor || gancho > melhor.gancho)) melhor = { giro, gancho };
  }
  return melhor;
}

/** O giro que põe a peça de saia de pé, com a cintura (a ponta mais estreita) em cima; `null`: a peça não tem essa forma. */
function saiaDaInstancia(inst: InstanciaDaPeca): { readonly giro: number } | null {
  const pontos = contornoComoPontos(inst.contorno);
  let melhor: { giro: number; abre: number } | null = null;
  for (const giro of GIROS_DA_PECA) {
    const face = coordenadasDaFace(inst, giro, pontos);
    if (face.altura < TAMANHOS_DA_SAIA.alturaMenor || face.altura > TAMANHOS_DA_SAIA.alturaMaior || face.largura < TAMANHOS_DA_SAIA.larguraMenor || face.largura > TAMANHOS_DA_SAIA.larguraMaior) continue;
    if (face.altura < 0.5 * face.largura || Math.abs(areaDe(inst.contorno)) < 0.7 * face.altura * face.largura) continue;
    // A que mais abre para baixo; reta, a primeira.
    const abre = -diferencaDasPontas(face.u, face.v);
    if (abre >= -0.02 && (!melhor || abre > melhor.abre)) melhor = { giro, abre };
  }
  return melhor;
}

/** Sem tronco: as duas peças com gancho são a calça; duas peças parecidas, a saia. As tiras (o cós) e as miudezas não contam. */
function formasDeBaixo(unicas: readonly InstanciaDaPeca[]): Map<string, FormaDaPeca> {
  const formas = new Map<string, FormaDaPeca>();
  const semTiras = unicas.filter((i) => !golaDoContorno(i.contorno));
  const maiorArea = Math.max(0, ...semTiras.map((i) => Math.abs(areaDe(i.contorno))));
  const grandes = semTiras.filter((i) => Math.abs(areaDe(i.contorno)) >= MIUDEZA_NA_AREA * maiorArea);
  const pernas = grandes.filter((i) => pernaDaInstancia(i) !== null);
  if (pernas.length > 0) {
    if (pernas.length === 2 && grandes.length === 2) for (const i of pernas) formas.set(i.peca.id, 'perna');
    return formas;
  }
  if (!grandes.every((i) => saiaDaInstancia(i) !== null)) return formas;
  const [a, b] = grandes;
  const umaSoRepetida = grandes.length === 1 && a!.peca.quantidade >= 2;
  const parecidas = grandes.length === 2 && Math.abs(areaDe(a!.contorno)) / Math.abs(areaDe(b!.contorno)) > 0.7 && Math.abs(areaDe(a!.contorno)) / Math.abs(areaDe(b!.contorno)) < 1.45;
  if (umaSoRepetida || parecidas) for (const i of grandes) formas.set(i.peca.id, 'saia');
  return formas;
}

/** A cabeça abaulada para fora da peça (o decote e a cava são curvas para dentro), mais estreita que o tronco. */
function pareceManga(c: Contorno, tronco: { readonly area: number; readonly largura: number }): boolean {
  const cabeca = cabecaDaManga(c);
  const eixo = eixoDaManga(c);
  if (!cabeca || !eixo) return false;
  const [a, b] = [c[cabeca.lado.de]!, c[cabeca.lado.ate]!];
  // Abaulada para fora: o alto dela fica mais longe do punho que a corda.
  const meio = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const paraFora = Math.hypot(eixo.apice.x - eixo.punho.x, eixo.apice.y - eixo.punho.y) > Math.hypot(meio.x - eixo.punho.x, meio.y - eixo.punho.y);
  return paraFora && Math.abs(areaDe(c)) < 0.8 * tronco.area && Math.hypot(b.x - a.x, b.y - a.y) < 0.95 * tronco.largura;
}

/** O comprimento da manga: do alto da cabeça ao meio do punho. */
function comprimentoDaManga(c: Contorno): number {
  const eixo = eixoDaManga(c);
  return eixo ? Math.hypot(eixo.punho.x - eixo.apice.x, eixo.punho.y - eixo.apice.y) : 0;
}

/** A forma de cada peça, pelo id dela. */
export function formasDasPecas(instancias: readonly InstanciaDaPeca[]): ReadonlyMap<string, FormaDaPeca> {
  const unicas = [...new Map(instancias.map((i) => [i.peca.id, i])).values()];
  const formas = new Map<string, FormaDaPeca>();
  const troncos = unicas.filter((i) => troncoDaInstancia(i) !== null);
  if (troncos.length === 0) return formasDeBaixo(unicas);
  for (const i of troncos) formas.set(i.peca.id, 'tronco');
  const maior = troncos.reduce((a, b) => (Math.abs(areaDe(a.contorno)) >= Math.abs(areaDe(b.contorno)) ? a : b));
  const caixa = coordenadasDaFace(maior, troncoDaInstancia(maior)!.giro, contornoComoPontos(maior.contorno));
  const referencia = { area: Math.abs(areaDe(maior.contorno)), largura: caixa.largura };
  for (const i of unicas) {
    if (formas.has(i.peca.id)) continue;
    if (golaDoContorno(i.contorno)) formas.set(i.peca.id, 'gola');
    else if (pareceManga(i.contorno, referencia)) formas.set(i.peca.id, 'manga');
  }
  return formas;
}

/**
 * A manga sem a folga da barra do punho: no molde, a folga abre em duas orelhas, para coincidir com a manga quando dobrada para
 * dentro. Costurada ao contrário ela fica de fora, como uma aba no punho; a costura de verdade a esconde, e a manga fica do
 * comprimento acabado. Sem as orelhas, o contorno volta como veio.
 */
function semFolgaDoPunho(c: Contorno): Contorno {
  const cabeca = cabecaDaManga(c);
  if (!cabeca) return c;
  const n = c.length;
  interface Reta {
    readonly de: number;
    ate: number;
    comprimento: number;
    readonly dx: number;
    readonly dy: number;
  }
  const retas: Reta[] = [];
  for (const i of trechoDoContorno(n, cabeca.lado.ate, cabeca.lado.de)) {
    const j = (i + 1) % n;
    const L = Math.hypot(c[j]!.x - c[i]!.x, c[j]!.y - c[i]!.y);
    if (L < 1e-6) continue;
    const [dx, dy] = [(c[j]!.x - c[i]!.x) / L, (c[j]!.y - c[i]!.y) / L];
    const ultima = retas[retas.length - 1];
    if (ultima && ultima.dx * dx + ultima.dy * dy > Math.cos((3 * Math.PI) / 180)) {
      ultima.ate = j;
      ultima.comprimento += L;
    } else retas.push({ de: i, ate: j, comprimento: L, dx, dy });
  }
  if (retas.length !== 5) return c;
  const [lado1, orelha1, punho, orelha2, lado2] = retas as [Reta, Reta, Reta, Reta, Reta];
  if (orelha1.comprimento > MAIOR_FOLGA_DO_PUNHO || orelha2.comprimento > MAIOR_FOLGA_DO_PUNHO || punho.comprimento < 100) return c;
  if (lado1.comprimento < 2 * orelha1.comprimento || lado2.comprimento < 2 * orelha2.comprimento) return c;
  // A folga abre: o punho é mais largo que a linha em que ela dobra. Um chanfro, ao contrário, fecha.
  const distancia = (a: number, b: number): number => Math.hypot(c[a]!.x - c[b]!.x, c[a]!.y - c[b]!.y);
  if (distancia(punho.de, punho.ate) <= distancia(orelha1.de, orelha2.ate)) return c;
  const novo: Ponto2D[] = [];
  for (let i = orelha2.ate; ; i = (i + 1) % n) {
    novo.push(c[i]!);
    if (i === orelha1.de) break;
  }
  return novo;
}

/** A cabeça da manga com pontos mais perto uns dos outros: num arquivo de poucos pontos, a divisão entre frente e costas errava por cm. */
function comCabecaMaisFina(c: Contorno): Contorno {
  const cabeca = cabecaDaManga(c);
  if (!cabeca) return c;
  const naCabeca = new Set(trechoDoContorno(c.length, cabeca.lado.de, cabeca.lado.ate));
  const novo: Ponto2D[] = [];
  c.forEach((p, i) => {
    novo.push(p);
    if (!naCabeca.has(i)) return;
    const q = c[(i + 1) % c.length]!;
    const partes = Math.ceil(Math.hypot(q.x - p.x, q.y - p.y) / PASSO_DA_CABECA_MM);
    for (let k = 1; k < partes; k++) novo.push({ x: p.x + ((q.x - p.x) * k) / partes, y: p.y + ((q.y - p.y) * k) / partes });
  });
  return novo;
}

/**
 * A gola como vai no corpo: dobrada ao meio no comprido (a ribana se corta em dobro), uma camada só na simulação, e esticada até o
 * tamanho do decote, como é costurada. As beiras vão em pontos miúdos: a divisão entre o decote da frente e o das costas cai num deles.
 */
function golaDobrada(peca: Molde, r: Retangulo, comprimento: number): Molde {
  const meia = r.largura / 2;
  const noPlano = (s: number, t: number): Ponto2D => ({ x: r.origem.x + r.e.x * s + r.f.x * t, y: r.origem.y + r.e.y * s + r.f.y * t });
  const contorno: Ponto2D[] = [];
  const partes = Math.ceil(comprimento / 10);
  for (let k = 0; k <= partes; k++) contorno.push(noPlano((comprimento * k) / partes, 0));
  for (let k = partes; k >= 0; k--) contorno.push(noPlano((comprimento * k) / partes, meia));
  return { ...peca, contorno: areaDe(contorno) * areaDe(peca.contorno) < 0 ? contorno.reverse() : contorno };
}

/**
 * As peças do projeto como vão ao provador. O arquivo traz cada peça uma vez: a manga vira um par (a menos que venham duas iguais,
 * a direita e a esquerda), sem a folga do punho, e a gola, dobrada e no tamanho do decote. O projeto não muda.
 */
export function pecasDoProvador(pecas: readonly Molde[]): Molde[] {
  const instancias = instanciasDasPecas(pecas);
  const formas = formasDasPecas(instancias);
  if (formas.size === 0) return [...pecas];
  const dePeca = (id: string): InstanciaDaPeca => instancias.find((i) => i.peca.id === id)!;
  const pecasDaForma = (forma: FormaDaPeca): string[] => [...formas].filter(([, f]) => f === forma).map(([id]) => id);
  const mangas = pecasDaForma('manga');
  const parSeparado = mangas.length === 2 && Math.abs(comprimentoDaManga(dePeca(mangas[0]!).contorno) - comprimentoDaManga(dePeca(mangas[1]!).contorno)) < 20;
  let decote = 0;
  for (const i of instancias) {
    if (formas.get(i.peca.id) !== 'tronco') continue;
    const lado = decoteDaPeca(i, troncoDaInstancia(i)!.giro);
    if (lado) decote += lado.comprimento;
  }
  return pecas.map((p) => {
    const forma = formas.get(p.id);
    if (forma === 'gola') {
      const r = golaDoContorno(dePeca(p.id).contorno);
      return r ? golaDobrada(dePeca(p.id).peca, r, Math.max(r.comprimento, 0.98 * decote)) : p;
    }
    if (forma === 'perna') return p.quantidade === 1 && !p.emPar ? { ...p, quantidade: 2, emPar: true as const } : p;
    if (forma !== 'manga') return p;
    const contorno = comCabecaMaisFina(semFolgaDoPunho(dePeca(p.id).contorno));
    const manga = { ...dePeca(p.id).peca, contorno };
    return p.quantidade === 1 && !p.emPar && !parSeparado ? { ...manga, quantidade: 2, emPar: true as const } : manga;
  });
}

/** Onde cada peça vai, pelo nome e, no que o nome não disse, pela forma; `reconhecidas`: os lugares que vieram da forma. */
export function configuracoesDoProvador(instancias: readonly InstanciaDaPeca[], montagem: Montagem3D): { pecas: Record<string, ConfiguracaoDaInstancia>; reconhecidas: string[] } {
  const pecas = { ...configuracoesDasInstancias(instancias, montagem) };
  const formas = formasDasPecas(instancias);
  const reconhecidas: string[] = [];
  const ocupada = (p: PosicaoNoCorpo): boolean => instancias.some((i) => pecas[i.chave]?.posicao === p);
  const livre = (i: InstanciaDaPeca): boolean => !montagem.pecas[i.chave] && pecas[i.chave]?.posicao === 'fora';
  const colocar = (i: InstanciaDaPeca, posicao: PosicaoNoCorpo, girarGraus: number): void => {
    pecas[i.chave] = { ...pecas[i.chave]!, posicao, girarGraus };
    reconhecidas.push(ROTULO_DA_POSICAO[posicao]);
  };
  // O decote mais fundo é o da frente.
  const troncos = instancias
    .filter((i) => formas.get(i.peca.id) === 'tronco')
    .map((inst) => ({ inst, ...troncoDaInstancia(inst)! }))
    .sort((a, b) => b.decote - a.decote);
  for (const { inst, giro } of troncos) {
    if (!livre(inst)) continue;
    const posicao = !ocupada('frente') ? 'frente' : !ocupada('costas') ? 'costas' : null;
    if (posicao) colocar(inst, posicao, giro);
  }
  // Mangas de comprimentos diferentes são opções do mesmo modelo: fica a mais curta, e a outra se escolhe na aba Peças.
  const opcoes = mangasDoProvador(instancias);
  const vestidas = opcoes[0]?.mesmoPar ? opcoes.flatMap((o) => o.instancias) : (opcoes[0]?.instancias ?? []);
  const lugares = (['manga-direita', 'manga-esquerda'] as const).filter((p) => !ocupada(p));
  vestidas.filter(livre).forEach((inst, k) => {
    const lugar = lugares[k];
    if (lugar) colocar(inst, lugar, giroPelaForma(inst, pecas[inst.chave]!.girarGraus, lugar));
  });
  // A calça: o gancho mais curto é o da frente. A perna sai pela forma da peça, e a cópia espelhada vai para a outra.
  const pernas = instancias
    .filter((i) => formas.get(i.peca.id) === 'perna')
    .map((inst) => ({ inst, ...pernaDaInstancia(inst)! }))
    .sort((a, b) => a.gancho - b.gancho);
  const ganchoDaFrente = pernas[0]?.gancho ?? 0;
  for (const { inst, giro, gancho } of pernas) {
    if (!livre(inst)) continue;
    const frente = gancho === ganchoDaFrente;
    const config = { ...pecas[inst.chave]!, alturaDoTopo: 'cintura' as const, girarGraus: giro, posicao: frente ? ('perna-direita-frente' as const) : ('perna-direita-costas' as const) };
    pecas[inst.chave] = config;
    const posicao = pernaPeloGancho(inst, config);
    colocar(inst, posicao, giro);
  }
  // A saia: não há como saber qual é a frente; fica a primeira do arquivo.
  for (const inst of instancias.filter((i) => formas.get(i.peca.id) === 'saia')) {
    if (!livre(inst)) continue;
    const posicao = !ocupada('frente') ? 'frente' : !ocupada('costas') ? 'costas' : null;
    if (!posicao) continue;
    pecas[inst.chave] = { ...pecas[inst.chave]!, alturaDoTopo: 'cintura' };
    colocar(inst, posicao, saiaDaInstancia(inst)!.giro);
  }
  const gola = instancias.find((i) => formas.get(i.peca.id) === 'gola');
  if (gola && livre(gola) && !ocupada('gola')) {
    colocar(gola, 'gola', giroPelaForma(gola, pecas[gola.chave]!.girarGraus, 'gola'));
    const decoteDa = (posicao: PosicaoNoCorpo): number => {
      const inst = instancias.find((i) => pecas[i.chave]?.posicao === posicao);
      return inst ? (decoteDaPeca(inst, pecas[inst.chave]!.girarGraus)?.comprimento ?? 0) : 0;
    };
    const [costas, frente] = [decoteDa('costas'), decoteDa('frente')];
    if (costas > 0 && frente > 0) pecas[gola.chave] = { ...pecas[gola.chave]!, costasDaGola: costas / (costas + frente) };
  }
  return { pecas, reconhecidas };
}

export interface OpcaoDeManga {
  readonly pecaId: string;
  readonly rotulo: string;
  readonly instancias: readonly InstanciaDaPeca[];
  /** Duas peças iguais: a direita e a esquerda, não duas opções. */
  readonly mesmoPar: boolean;
}

/** As mangas do molde, da mais curta à mais comprida. */
export function mangasDoProvador(instancias: readonly InstanciaDaPeca[]): OpcaoDeManga[] {
  const formas = formasDasPecas(instancias);
  const ids = [...formas].filter(([, f]) => f === 'manga').map(([id]) => id);
  const medidas = ids.map((pecaId) => {
    const dela = instancias.filter((i) => i.peca.id === pecaId);
    return { pecaId, dela, comprimento: comprimentoDaManga(dela[0]!.contorno) };
  });
  medidas.sort((a, b) => a.comprimento - b.comprimento);
  const mesmoPar = medidas.length === 2 && medidas[1]!.comprimento - medidas[0]!.comprimento < 20;
  return medidas.map((m) => ({
    pecaId: m.pecaId,
    rotulo: `Manga ${m.comprimento <= MANGA_CURTA_ATE ? 'curta' : 'comprida'} (${m.dela[0]!.peca.nome})`,
    instancias: m.dela,
    mesmoPar,
  }));
}

/** A montagem de partida: as peças no lugar e, se algum veio da forma e não há costuras guardadas, as costuras prontas. */
export function montagemDoProvador(instancias: readonly InstanciaDaPeca[], guardada: Montagem3D, novoId: () => string): { montagem: Montagem3D; reconhecidas: string[] } {
  const { pecas, reconhecidas } = configuracoesDoProvador(instancias, guardada);
  const montagem = { ...guardada, pecas };
  if (reconhecidas.length === 0 || guardada.costuras.length > 0) return { montagem, reconhecidas };
  return { montagem: { ...montagem, costuras: sugerirCosturas(corpoDaMontagem(montagem), instancias, montagem, novoId) }, reconhecidas };
}

/** A montagem com outra manga do molde nos braços: as costuras da que saiu vão embora, e as da nova são sugeridas. */
export function comAManga(instancias: readonly InstanciaDaPeca[], montagem: Montagem3D, pecaId: string, novoId: () => string): Montagem3D {
  const opcoes = mangasDoProvador(instancias);
  const nova = opcoes.find((o) => o.pecaId === pecaId);
  if (!nova) return montagem;
  const pecas = { ...montagem.pecas };
  const dasMangas = new Set(opcoes.flatMap((o) => o.instancias.map((i) => i.chave)));
  for (const chave of dasMangas) pecas[chave] = { ...pecas[chave]!, posicao: 'fora' };
  nova.instancias.slice(0, 2).forEach((inst, k) => {
    const lugar = k === 0 ? 'manga-direita' : 'manga-esquerda';
    pecas[inst.chave] = { ...pecas[inst.chave]!, posicao: lugar, girarGraus: giroPelaForma(inst, pecas[inst.chave]!.girarGraus, lugar) };
  });
  const costuras = montagem.costuras.filter((c) => !dasMangas.has(c.a.chave) && !dasMangas.has(c.b.chave));
  const semAsDaManga = { ...montagem, pecas, costuras };
  return { ...semAsDaManga, costuras: [...costuras, ...sugerirCosturas(corpoDaMontagem(semAsDaManga), instancias, semAsDaManga, novoId)] };
}



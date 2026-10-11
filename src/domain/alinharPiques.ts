import {
  comprimentoDaLinha,
  distancia,
  pontoDentroDoContorno,
  pontoMaisProximoNoContorno,
  pontoMaisProximoNoSegmento,
  trechoDoContorno,
  type Contorno,
  type Ponto2D,
  type PosicaoNoContorno,
} from '../core/geometria';
import { contornosDosTamanhos } from './graduacao';
import type { Marca, Molde, Pique } from './molde';
import { definirGraduacaoDoPique, piquesNoTamanho, referenciaDoPique, referenciaSugerida } from './piquesGraduados';
import { marcaNosTamanhos } from './tamanhosGraduados';

/**
 * "Alinhar piques" (aba Marcações): na peça graduada, leva o pique de cada
 * tamanho para a mesma linha.
 *
 * - `horizontal` / `vertical`: a linha horizontal (ou vertical) da tela que
 *   passa pelo pique no tamanho base.
 * - `elemento`: uma linha interna da peça, que precisa cruzar o contorno de
 *   todos os tamanhos.
 * - `ponto-horizontal` / `ponto-vertical`: a linha horizontal (ou vertical)
 *   que passa, em cada tamanho, por um ponto de controle do contorno.
 *
 * O manual da referência dá os modos e os cliques, mas não a conta: em cada
 * tamanho, o pique vai para o cruzamento da linha com o contorno desse
 * tamanho que fica mais perto de onde ele estava. É a nossa leitura.
 */
export type ModoDeAlinhar = 'horizontal' | 'vertical' | 'elemento' | 'ponto-horizontal' | 'ponto-vertical';

export interface AlvoDoAlinhamento {
  /** No modo `elemento`: a linha interna (pelo número). */
  readonly linhaInterna?: number;
  /** Nos modos de ponto: o ponto de controle do contorno (pelo número, a partir de 0). */
  readonly ponto?: number;
}

const MESMO_PONTO_MM = 1e-6;

function ponto(x: number, y: number): Ponto2D {
  return { x, y };
}

/** Onde o segmento [a, b] cruza o segmento [c, d], ou `null`. */
function cruzamentoDeSegmentos(a: Ponto2D, b: Ponto2D, c: Ponto2D, d: Ponto2D): Ponto2D | null {
  const r = ponto(b.x - a.x, b.y - a.y);
  const s = ponto(d.x - c.x, d.y - c.y);
  const det = r.x * s.y - r.y * s.x;
  if (Math.abs(det) < 1e-12) return null;
  const t = ((c.x - a.x) * s.y - (c.y - a.y) * s.x) / det;
  const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / det;
  const folga = 1e-9;
  return t >= 0 - folga && t <= 1 + folga && u >= 0 - folga && u <= 1 + folga ? ponto(a.x + r.x * t, a.y + r.y * t) : null;
}

/** Onde a reta que passa por `origem` na direção `d` cruza o contorno. */
function cruzamentosDaReta(contorno: Contorno, origem: Ponto2D, d: Ponto2D): Ponto2D[] {
  const achados: Ponto2D[] = [];
  for (let i = 0; i < contorno.length; i++) {
    const a = contorno[i]!;
    const b = contorno[(i + 1) % contorno.length]!;
    const e = ponto(b.x - a.x, b.y - a.y);
    const det = d.x * e.y - d.y * e.x;
    if (Math.abs(det) < 1e-12) continue;
    const s = ((a.x - origem.x) * d.y - (a.y - origem.y) * d.x) / det;
    if (s >= -1e-9 && s <= 1 + 1e-9) achados.push(ponto(a.x + e.x * s, a.y + e.y * s));
  }
  return achados;
}

/** Onde a linha (aberta) cruza o contorno. */
function cruzamentosDaLinha(contorno: Contorno, linha: readonly Ponto2D[]): Ponto2D[] {
  const achados: Ponto2D[] = [];
  for (let k = 1; k < linha.length; k++) {
    for (let i = 0; i < contorno.length; i++) {
      const cruzamento = cruzamentoDeSegmentos(linha[k - 1]!, linha[k]!, contorno[i]!, contorno[(i + 1) % contorno.length]!);
      if (cruzamento) achados.push(cruzamento);
    }
  }
  return achados;
}

/** A distância, sobre o contorno, do ponto de número `referencia` até `ate`, andando no sentido dado (1 = o da numeração). */
function distanciaNoSentido(contorno: Contorno, referencia: number, ate: PosicaoNoContorno, sentido: 1 | -1): number {
  const doPonto: PosicaoNoContorno = { indiceAresta: referencia, ponto: contorno[referencia]! };
  if (distancia(doPonto.ponto, ate.ponto) <= MESMO_PONTO_MM) return 0;
  return comprimentoDaLinha(sentido === 1 ? trechoDoContorno(contorno, doPonto, ate) : trechoDoContorno(contorno, ate, doPonto));
}

/** O que o "Alinhar" fez: a peça e quanto a distância do pique à referência muda em cada tamanho. */
export interface PiqueAlinhado {
  readonly molde: Molde;
  readonly perimetros: readonly number[];
}

/**
 * Alinha o pique de id dado. Lança erro, sem mudar nada, se a peça não é
 * graduada, se falta o alvo do modo, ou se em algum tamanho a linha não cruza
 * o contorno.
 */
export function alinharPique(molde: Molde, piqueId: string, modo: ModoDeAlinhar, alvo: AlvoDoAlinhamento = {}): PiqueAlinhado {
  const graduacao = molde.graduacao;
  if (!graduacao) throw new Error(`A peça “${molde.nome}” não tem graduação: o alinhamento é entre os tamanhos dela.`);
  const pique = molde.piques.find((q) => q.id === piqueId);
  if (!pique) throw new Error('Pique não encontrado na peça.');
  const contornos = contornosDosTamanhos(graduacao, molde.contorno);
  const horizontal = modo === 'horizontal' || modo === 'ponto-horizontal';
  // Na tela os eixos são trocados: a linha horizontal anda no y do mundo; a vertical, no x.
  const direcao = horizontal ? ponto(0, 1) : ponto(1, 0);
  const doPonto = modo === 'ponto-horizontal' || modo === 'ponto-vertical';
  const linha = modo === 'elemento' ? molde.linhasInternas[alvo.linhaInterna ?? -1] : undefined;
  if (modo === 'elemento' && (!linha || linha.length < 2)) throw new Error('Indique a linha interna que serve de referência.');
  if (doPonto && (alvo.ponto === undefined || !molde.contorno[alvo.ponto])) throw new Error('Indique o ponto do contorno que serve de referência.');

  /** Onde o pique está hoje em cada tamanho. */
  const hoje = contornos.map((contorno, t) => piquesNoTamanho(molde, contorno, t).find((q) => q.id === piqueId)!.posicao);
  const alvoNo = (t: number): PosicaoNoContorno => {
    const contorno = contornos[t]!;
    const doControle = doPonto ? contorno[alvo.ponto!]! : null;
    const candidatos = (linha ? cruzamentosDaLinha(contorno, linha) : cruzamentosDaReta(contorno, doControle ?? pique.posicao, direcao))
      // O próprio ponto de controle está na linha dele: não é para lá que o pique vai.
      .filter((q) => !doControle || distancia(q, doControle) > MESMO_PONTO_MM);
    if (candidatos.length === 0) throw new Error(`No tamanho ${graduacao.tamanhos[t]}, a linha de alinhamento não cruza o contorno.`);
    const escolhido = candidatos.reduce((a, b) => (distancia(a, hoje[t]!) <= distancia(b, hoje[t]!) ? a : b));
    const noContorno = pontoMaisProximoNoContorno(escolhido, contorno);
    return { indiceAresta: noContorno.indiceAresta, ponto: noContorno.ponto };
  };

  // No base, o pique vai para o alvo dele (nos modos horizontal e vertical, é onde já está).
  const noBase = alvoNo(graduacao.base);
  const movido: Pique = { ...pique, posicao: noBase.ponto, indiceAresta: noBase.indiceAresta };
  const comOBase: Molde = { ...molde, piques: molde.piques.map((q) => (q.id === piqueId ? movido : q)) };
  const referencia = referenciaDoPique(comOBase, movido) ?? referenciaSugerida(comOBase, movido);
  // O sentido em que o pique fica da referência: o do caminho mais curto, no base.
  const adiante = distanciaNoSentido(molde.contorno, referencia, noBase, 1);
  const paraTras = distanciaNoSentido(molde.contorno, referencia, noBase, -1);
  const sentido: 1 | -1 = adiante <= paraTras ? 1 : -1;
  const doBase = Math.min(adiante, paraTras);
  // No base a conta dá zero: é dele que as outras distâncias são contadas.
  const perimetros = contornos.map((contorno, t) => {
    const valor = distanciaNoSentido(contorno, referencia, alvoNo(t), sentido) - doBase;
    return Math.abs(valor) < 1e-9 ? 0 : valor;
  });
  return { molde: definirGraduacaoDoPique(comOBase, piqueId, referencia, perimetros), perimetros };
}

/** O que o "Alinhar" fez no pique interno: a peça e quanto ele anda em cada tamanho, contado de onde fica no base. */
export interface PiqueInternoAlinhado {
  readonly molde: Molde;
  readonly deslocamentos: readonly Ponto2D[];
}

/** O ponto da linha (aberta) mais perto de `q`. */
function maisPertoNaLinha(q: Ponto2D, linha: readonly Ponto2D[]): Ponto2D {
  let melhor = linha[0]!;
  for (let k = 1; k < linha.length; k++) {
    const candidato = pontoMaisProximoNoSegmento(q, linha[k - 1]!, linha[k]!);
    if (distancia(candidato, q) < distancia(melhor, q)) melhor = candidato;
  }
  return melhor;
}

/** A até isto (mm) da borda, o pique interno ainda conta como dentro da peça. */
const FOLGA_DA_BORDA_MM = 1e-6;

/** Recusa as posições do pique interno que, em algum tamanho, caem fora do contorno desse tamanho. */
function exigirDentroDeCadaTamanho(tamanhos: readonly string[], contornos: readonly Contorno[], posicoes: readonly Ponto2D[]): void {
  contornos.forEach((contorno, t) => {
    const a = posicoes[t]!;
    if (!pontoDentroDoContorno(a, contorno) && distancia(a, pontoMaisProximoNoContorno(a, contorno).ponto) > FOLGA_DA_BORDA_MM) {
      throw new Error(`No tamanho ${tamanhos[t]}, o pique interno cairia fora da peça.`);
    }
  });
}

/**
 * A tabela do pique interno alinhado, dada à mão: quanto ele anda em cada
 * tamanho, contado de onde está no base. O do base é sempre zero, venha o
 * que vier. Lança erro, sem mudar nada, se a peça não é graduada, se não há
 * um valor por tamanho, ou se em algum tamanho o pique cairia fora da peça.
 */
export function definirAlinhamentoDoPiqueInterno(molde: Molde, marcaId: string, deslocamentos: readonly Ponto2D[]): Molde {
  const graduacao = molde.graduacao;
  if (!graduacao) throw new Error(`A peça “${molde.nome}” não tem graduação: o alinhamento é entre os tamanhos dela.`);
  const marca = molde.marcas.find((m) => m.id === marcaId);
  if (!marca) throw new Error('Pique interno não encontrado na peça.');
  if (deslocamentos.length !== graduacao.tamanhos.length || deslocamentos.some((d) => !Number.isFinite(d.x) || !Number.isFinite(d.y))) {
    throw new Error('Dê um número para cada tamanho da peça.');
  }
  const comOBaseEmZero = deslocamentos.map((d, t) => (t === graduacao.base ? ponto(0, 0) : ponto(d.x, d.y)));
  const contornos = contornosDosTamanhos(graduacao, molde.contorno);
  exigirDentroDeCadaTamanho(
    graduacao.tamanhos,
    contornos,
    comOBaseEmZero.map((d) => ponto(marca.posicao.x + d.x, marca.posicao.y + d.y)),
  );
  const alinhada: Marca = { ...marca, alinhamento: { deslocamentos: comOBaseEmZero } };
  return { ...molde, marcas: molde.marcas.map((m) => (m.id === marcaId ? alinhada : m)) };
}

/**
 * Alinha o pique interno (a marca) de id dado. Em cada tamanho ele vai, de
 * onde estava, para o ponto mais perto da linha de alinhamento:
 *
 * - `horizontal` / `vertical`: a linha horizontal (ou vertical) da tela que
 *   passa por ele no tamanho base — ele só anda ao longo dela;
 * - `elemento`: a linha interna indicada (no base ele também vai para ela);
 * - `ponto-horizontal` / `ponto-vertical`: a linha horizontal (ou vertical)
 *   que passa, em cada tamanho, pelo ponto de controle do contorno.
 *
 * O manual da referência fala do alinhamento dos piques na graduação sem
 * separar os internos, e não dá a conta: esta é a nossa leitura. O resultado
 * fica guardado na marca, como o que ela anda em cada tamanho. Lança erro,
 * sem mudar nada, se a peça não é graduada, se falta o alvo do modo, ou se em
 * algum tamanho o pique cairia fora da peça.
 */
export function alinharPiqueInterno(molde: Molde, marcaId: string, modo: ModoDeAlinhar, alvo: AlvoDoAlinhamento = {}): PiqueInternoAlinhado {
  const graduacao = molde.graduacao;
  if (!graduacao) throw new Error(`A peça “${molde.nome}” não tem graduação: o alinhamento é entre os tamanhos dela.`);
  const marca = molde.marcas.find((m) => m.id === marcaId);
  if (!marca) throw new Error('Pique interno não encontrado na peça.');
  const horizontal = modo === 'horizontal' || modo === 'ponto-horizontal';
  const doPonto = modo === 'ponto-horizontal' || modo === 'ponto-vertical';
  const linha = modo === 'elemento' ? molde.linhasInternas[alvo.linhaInterna ?? -1] : undefined;
  if (modo === 'elemento' && (!linha || linha.length < 2)) throw new Error('Indique a linha interna que serve de referência.');
  if (doPonto && (alvo.ponto === undefined || !molde.contorno[alvo.ponto])) throw new Error('Indique o ponto do contorno que serve de referência.');
  const contornos = contornosDosTamanhos(graduacao, molde.contorno);
  /** Onde o pique está hoje em cada tamanho. */
  const hoje = marcaNosTamanhos(molde, marcaId);
  const alvoNo = (t: number): Ponto2D => {
    const q = hoje[t]!;
    if (linha) return maisPertoNaLinha(q, linha);
    // A linha passa pelo ponto de controle desse tamanho, ou por onde o pique está no base.
    const por = doPonto ? contornos[t]![alvo.ponto!]! : marca.posicao;
    // Na tela os eixos são trocados: na linha horizontal o x do mundo é um só; na vertical, o y.
    return horizontal ? ponto(por.x, q.y) : ponto(q.x, por.y);
  };
  const alvos = contornos.map((_, t) => alvoNo(t));
  exigirDentroDeCadaTamanho(graduacao.tamanhos, contornos, alvos);
  // No base, o pique vai para o alvo dele (nos modos horizontal e vertical, é onde já está); os outros são contados dali.
  const noBase = alvos[graduacao.base]!;
  const deslocamentos = alvos.map((a) => ponto(a.x - noBase.x, a.y - noBase.y));
  const alinhada: Marca = { ...marca, posicao: noBase, alinhamento: { deslocamentos } };
  return { molde: { ...molde, marcas: molde.marcas.map((m) => (m.id === marcaId ? alinhada : m)) }, deslocamentos };
}

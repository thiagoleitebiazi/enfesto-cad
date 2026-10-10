import { distancia, type Contorno, type Ponto2D } from '../core/geometria';

/**
 * Graduação (aba Graduação): a peça desenhada é o tamanho base, e cada
 * tamanho é o mesmo contorno com os pontos deslocados.
 *
 * Só alguns pontos do contorno têm regra própria — os **pontos graduados**,
 * em geral os cantos. Os outros (os pontos de uma curva, por exemplo) andam
 * na proporção: cada um fica entre os dois pontos graduados vizinhos, pela
 * distância percorrida sobre o contorno.
 *
 * Um ponto graduado é guardado pela posição que tem no contorno base, e não
 * pelo número: assim inserir, tirar ou arredondar pontos em outro lugar da
 * peça não troca a regra de ninguém. O ponto graduado que deixa de coincidir
 * com um ponto do contorno simplesmente não conta.
 */
export interface PontoGraduado {
  /** Onde o ponto está, no contorno do tamanho base. */
  readonly posicao: Ponto2D;
  /** O deslocamento do ponto em cada tamanho, em mm, a partir do base — na ordem de `tamanhos`; no base é zero. */
  readonly deslocamentos: readonly Ponto2D[];
}

export interface Graduacao {
  /** Os nomes dos tamanhos, do menor ao maior. */
  readonly tamanhos: readonly string[];
  /** A posição, em `tamanhos`, do tamanho base — o do contorno desenhado. */
  readonly base: number;
  readonly pontos: readonly PontoGraduado[];
}

/** Sobre qual eixo do mundo uma operação age. Na tela os eixos são trocados: DX é o `y` e DY é o `x`. */
export type EixoDaGraduacao = 'ambos' | 'x' | 'y';

export const MAXIMO_DE_TAMANHOS = 20;
/** Um ponto do contorno é um canto quando a direção muda mais que isto (graus); menos, é ponto de curva. */
export const GIRO_DE_UM_CANTO_GRAUS = 20;

/** Um ponto graduado a menos disso (mm) de um ponto do contorno é esse ponto. */
const NO_MESMO_LUGAR_MM = 1e-6;
const ZERO: Ponto2D = { x: 0, y: 0 };

function somar(a: Ponto2D, b: Ponto2D): Ponto2D {
  return { x: a.x + b.x, y: a.y + b.y };
}

function subtrair(a: Ponto2D, b: Ponto2D): Ponto2D {
  return { x: a.x - b.x, y: a.y - b.y };
}

function mesmoNome(a: string, b: string): boolean {
  return a.trim().toLocaleUpperCase('pt-BR') === b.trim().toLocaleUpperCase('pt-BR');
}

/** A posição do tamanho de nome `nome` na lista (sem diferenciar maiúsculas), ou -1. */
export function indiceDoTamanho(tamanhos: readonly string[], nome: string): number {
  return tamanhos.findIndex((t) => mesmoNome(t, nome));
}

/**
 * Os tamanhos digitados numa linha ("P, M, G" ou "36; 38; 40"), na ordem.
 * Recusa menos de dois, mais que o máximo e nome repetido.
 */
export function lerTamanhos(texto: string): string[] {
  const tamanhos = texto
    .split(/[,;]/)
    .map((t) => t.trim())
    .filter((t) => t !== '');
  if (tamanhos.length < 2) throw new Error('Informe pelo menos dois tamanhos, separados por vírgula (por exemplo: P, M, G).');
  if (tamanhos.length > MAXIMO_DE_TAMANHOS) throw new Error(`São aceitos até ${MAXIMO_DE_TAMANHOS} tamanhos.`);
  const repetido = tamanhos.find((t, i) => tamanhos.findIndex((outro) => mesmoNome(outro, t)) !== i);
  if (repetido) throw new Error(`O tamanho “${repetido}” aparece mais de uma vez.`);
  return tamanhos;
}

/** Os pontos do contorno em que a direção muda mais que `GIRO_DE_UM_CANTO_GRAUS`. */
export function cantosDoContorno(contorno: Contorno): number[] {
  const n = contorno.length;
  const cantos: number[] = [];
  for (let i = 0; i < n; i++) {
    const antes = contorno[(i - 1 + n) % n]!;
    const aqui = contorno[i]!;
    const depois = contorno[(i + 1) % n]!;
    const chegada = distancia(antes, aqui);
    const saida = distancia(aqui, depois);
    if (chegada === 0 || saida === 0) {
      cantos.push(i);
      continue;
    }
    const cosseno = ((aqui.x - antes.x) * (depois.x - aqui.x) + (aqui.y - antes.y) * (depois.y - aqui.y)) / (chegada * saida);
    const giro = (Math.acos(Math.max(-1, Math.min(1, cosseno))) * 180) / Math.PI;
    if (giro > GIRO_DE_UM_CANTO_GRAUS) cantos.push(i);
  }
  return cantos;
}

function semDeslocamento(quantos: number): Ponto2D[] {
  return Array.from({ length: quantos }, () => ZERO);
}

/**
 * A graduação de partida de um contorno: os tamanhos dados e, como pontos
 * graduados (ainda sem deslocamento), os cantos do contorno. Os pontos de
 * curva ficam proporcionais.
 */
export function iniciarGraduacao(contorno: Contorno, tamanhos: readonly string[], base: number): Graduacao {
  if (!Number.isInteger(base) || base < 0 || base >= tamanhos.length) throw new Error('O tamanho base precisa ser um dos tamanhos da lista.');
  return {
    tamanhos: [...tamanhos],
    base,
    pontos: cantosDoContorno(contorno).map((i) => ({ posicao: contorno[i]!, deslocamentos: semDeslocamento(tamanhos.length) })),
  };
}

/** O número (a partir de 0) do ponto do contorno que está em `posicao`, ou -1. */
function verticeEm(contorno: Contorno, posicao: Ponto2D): number {
  return contorno.findIndex((p) => distancia(p, posicao) <= NO_MESMO_LUGAR_MM);
}

/** Para cada ponto do contorno que é graduado, o ponto graduado dele. */
function graduadosPorVertice(graduacao: Graduacao, contorno: Contorno): Map<number, PontoGraduado> {
  const mapa = new Map<number, PontoGraduado>();
  for (const ponto of graduacao.pontos) {
    const i = verticeEm(contorno, ponto.posicao);
    if (i >= 0 && !mapa.has(i)) mapa.set(i, ponto);
  }
  return mapa;
}

/** Os números (a partir de 0) dos pontos do contorno que são graduados, em ordem. */
export function verticesGraduados(graduacao: Graduacao, contorno: Contorno): number[] {
  return [...graduadosPorVertice(graduacao, contorno).keys()].sort((a, b) => a - b);
}

/** O ponto graduado que está no ponto `indice` do contorno, ou `null` se ele é proporcional. */
export function pontoGraduadoEm(graduacao: Graduacao, contorno: Contorno, indice: number): PontoGraduado | null {
  return graduadosPorVertice(graduacao, contorno).get(indice) ?? null;
}

/**
 * O deslocamento de cada ponto do contorno em cada tamanho: `[ponto][tamanho]`.
 * Os graduados têm a regra deles; os outros ficam, na proporção da distância
 * andada sobre o contorno, entre o ponto graduado de antes e o de depois. Sem
 * nenhum ponto graduado, ninguém se desloca.
 */
export function deslocamentosDoContorno(graduacao: Graduacao, contorno: Contorno): Ponto2D[][] {
  const n = contorno.length;
  const quantos = graduacao.tamanhos.length;
  const graduados = graduadosPorVertice(graduacao, contorno);
  const indices = [...graduados.keys()].sort((a, b) => a - b);
  if (indices.length === 0) return contorno.map(() => semDeslocamento(quantos));

  // Distância andada sobre o contorno, do ponto 0 até cada ponto.
  const andado: number[] = [0];
  for (let i = 1; i < n; i++) andado.push(andado[i - 1]! + distancia(contorno[i - 1]!, contorno[i]!));
  const perimetro = andado[n - 1]! + distancia(contorno[n - 1]!, contorno[0]!);
  const daquiAte = (de: number, ate: number): number => (andado[ate]! - andado[de]! + perimetro) % perimetro;

  return contorno.map((_, i) => {
    const proprio = graduados.get(i);
    if (proprio) return [...proprio.deslocamentos];
    // O graduado de antes é o último com número menor (ou o último de todos, dando a volta); o de depois, o seguinte.
    const posicaoDoSeguinte = indices.findIndex((g) => g > i);
    const depois = indices[posicaoDoSeguinte < 0 ? 0 : posicaoDoSeguinte]!;
    const antes = indices[(posicaoDoSeguinte < 0 ? indices.length : posicaoDoSeguinte) - 1] ?? indices.at(-1)!;
    const regraDeAntes = graduados.get(antes)!.deslocamentos;
    const regraDeDepois = graduados.get(depois)!.deslocamentos;
    const trecho = antes === depois ? perimetro : daquiAte(antes, depois);
    const k = trecho > 0 ? daquiAte(antes, i) / trecho : 0;
    return Array.from({ length: quantos }, (_, t) => {
      const a = regraDeAntes[t] ?? ZERO;
      const b = regraDeDepois[t] ?? ZERO;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    });
  });
}

/** A regra (o deslocamento em cada tamanho) do ponto `indice` do contorno, seja ele graduado ou proporcional. */
export function regraDoVertice(graduacao: Graduacao, contorno: Contorno, indice: number): Ponto2D[] {
  const regra = deslocamentosDoContorno(graduacao, contorno)[indice];
  if (!regra) throw new Error('Ponto fora do contorno da peça.');
  return regra;
}

/** O contorno do tamanho de posição `tamanho` na lista. */
export function contornoDoTamanho(graduacao: Graduacao, contorno: Contorno, tamanho: number): Ponto2D[] {
  if (!Number.isInteger(tamanho) || tamanho < 0 || tamanho >= graduacao.tamanhos.length) throw new Error('Tamanho fora da graduação.');
  if (tamanho === graduacao.base) return [...contorno];
  return deslocamentosDoContorno(graduacao, contorno).map((regra, i) => somar(contorno[i]!, regra[tamanho] ?? ZERO));
}

/**
 * Quanto anda, num tamanho, um ponto qualquer da peça (um furo, uma marca, a
 * ponta de uma linha interna), dados os deslocamentos dos pontos do contorno
 * nesse tamanho. É a média deles por coordenadas de valor médio: em cima de
 * um ponto do contorno dá o deslocamento dele; sobre uma aresta, a proporção
 * entre as duas pontas; e, se o contorno todo anda, cresce ou encolhe por
 * igual, o ponto de dentro faz exatamente o mesmo.
 */
export function deslocamentoNoPonto(contorno: Contorno, deslocamentos: readonly Ponto2D[], p: Ponto2D): Ponto2D {
  const n = contorno.length;
  if (n === 0) return ZERO;
  const s = contorno.map((v) => ({ x: v.x - p.x, y: v.y - p.y }));
  const r = s.map((v) => Math.hypot(v.x, v.y));
  const meiaArea: number[] = [];
  const escalar: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (r[i]! < NO_MESMO_LUGAR_MM) return deslocamentos[i] ?? ZERO;
    meiaArea.push((s[i]!.x * s[j]!.y - s[i]!.y * s[j]!.x) / 2);
    escalar.push(s[i]!.x * s[j]!.x + s[i]!.y * s[j]!.y);
    // Sobre a aresta: a proporção entre as duas pontas.
    if (Math.abs(meiaArea[i]!) < 1e-9 && escalar[i]! < 0) {
      const a = deslocamentos[i] ?? ZERO;
      const b = deslocamentos[j] ?? ZERO;
      const soma = r[i]! + r[j]!;
      return { x: (r[j]! * a.x + r[i]! * b.x) / soma, y: (r[j]! * a.y + r[i]! * b.y) / soma };
    }
  }
  let x = 0;
  let y = 0;
  let pesos = 0;
  for (let i = 0; i < n; i++) {
    const antes = (i - 1 + n) % n;
    const depois = (i + 1) % n;
    let peso = 0;
    if (Math.abs(meiaArea[antes]!) >= 1e-9) peso += (r[antes]! - escalar[antes]! / r[i]!) / meiaArea[antes]!;
    if (Math.abs(meiaArea[i]!) >= 1e-9) peso += (r[depois]! - escalar[i]! / r[i]!) / meiaArea[i]!;
    const d = deslocamentos[i] ?? ZERO;
    x += peso * d.x;
    y += peso * d.y;
    pesos += peso;
  }
  return Math.abs(pesos) < 1e-12 ? ZERO : { x: x / pesos, y: y / pesos };
}

/** O contorno de cada tamanho, na ordem da lista (o do base é o próprio contorno). */
export function contornosDosTamanhos(graduacao: Graduacao, contorno: Contorno): Ponto2D[][] {
  const deslocamentos = deslocamentosDoContorno(graduacao, contorno);
  return graduacao.tamanhos.map((_, t) =>
    t === graduacao.base ? [...contorno] : deslocamentos.map((regra, i) => somar(contorno[i]!, regra[t] ?? ZERO)),
  );
}

/** Os pontos graduados que ainda estão sobre um ponto do contorno (os outros não contam mais e saem). */
export function semPontosSoltos(graduacao: Graduacao, contorno: Contorno): Graduacao {
  const pontos = graduacao.pontos.filter((p) => verticeEm(contorno, p.posicao) >= 0);
  return pontos.length === graduacao.pontos.length ? graduacao : { ...graduacao, pontos };
}

function regraCompleta(graduacao: Graduacao, deslocamentos: readonly Ponto2D[]): Ponto2D[] {
  if (deslocamentos.length !== graduacao.tamanhos.length) throw new Error('A regra precisa ter um deslocamento para cada tamanho.');
  if (!deslocamentos.every((d) => Number.isFinite(d.x) && Number.isFinite(d.y))) throw new Error('Os deslocamentos precisam ser números.');
  // O base é a referência: nele o ponto está onde foi desenhado.
  return deslocamentos.map((d, t) => (t === graduacao.base ? ZERO : { x: d.x, y: d.y }));
}

/**
 * Dá ao ponto `indice` do contorno a regra `deslocamentos` (um por tamanho).
 * Se ele era proporcional, passa a ser graduado.
 */
export function definirRegra(graduacao: Graduacao, contorno: Contorno, indice: number, deslocamentos: readonly Ponto2D[]): Graduacao {
  const posicao = contorno[indice];
  if (!posicao) throw new Error('Ponto fora do contorno da peça.');
  const regra = regraCompleta(graduacao, deslocamentos);
  const limpa = semPontosSoltos(graduacao, contorno);
  const atual = pontoGraduadoEm(limpa, contorno, indice);
  if (!atual) return { ...limpa, pontos: [...limpa.pontos, { posicao, deslocamentos: regra }] };
  return {
    ...limpa,
    pontos: limpa.pontos.map((p) => (p === atual ? { ...p, deslocamentos: regra } : p)),
  };
}

/** O ponto `indice` deixa de ser graduado e volta a andar na proporção dos vizinhos. */
export function removerPontoGraduado(graduacao: Graduacao, contorno: Contorno, indice: number): Graduacao {
  const atual = pontoGraduadoEm(graduacao, contorno, indice);
  const limpa = semPontosSoltos(graduacao, contorno);
  return atual ? { ...limpa, pontos: limpa.pontos.filter((p) => p !== atual) } : limpa;
}

/**
 * "Graduar curva": o ponto proporcional passa a ser graduado, com a regra que
 * tinha na proporção (nada muda de lugar, mas ele passa a poder ter regra
 * própria); o graduado volta a ser proporcional.
 */
export function alternarPontoGraduado(graduacao: Graduacao, contorno: Contorno, indice: number): Graduacao {
  return pontoGraduadoEm(graduacao, contorno, indice)
    ? removerPontoGraduado(graduacao, contorno, indice)
    : definirRegra(graduacao, contorno, indice, regraDoVertice(graduacao, contorno, indice));
}

/** A regra de passo constante: `passo` a mais em cada tamanho acima do base, e a menos em cada um abaixo. */
export function regraPorPasso(graduacao: Graduacao, passo: Ponto2D): Ponto2D[] {
  // Zero vezes um número negativo dá "-0": fica zero, para não aparecer assim em lugar nenhum.
  const vezes = (valor: number, passos: number): number => (valor * passos === 0 ? 0 : valor * passos);
  return graduacao.tamanhos.map((_, t) => ({ x: vezes(passo.x, t - graduacao.base), y: vezes(passo.y, t - graduacao.base) }));
}

/**
 * A regra de um ponto depois de receber o `passo`:
 * - em todos os tamanhos (`tamanho` nulo) ou num só — os outros ficam com o
 *   que tinham em `atual`;
 * - incremental (cada tamanho anda o passo a mais que o vizinho do lado do
 *   base) ou absoluto (o passo conta a partir do base, em cada tamanho).
 * Abaixo do base o passo vale ao contrário, como em `regraPorPasso`.
 */
export function regraComPasso(graduacao: Graduacao, atual: readonly Ponto2D[], passo: Ponto2D, tamanho: number | null, incremental = true): Ponto2D[] {
  const base = graduacao.base;
  // Zero vezes um número negativo dá "-0": fica zero, para não aparecer assim em lugar nenhum.
  const comSinal = (sinal: number): Ponto2D => ({ x: passo.x * sinal === 0 ? 0 : passo.x * sinal, y: passo.y * sinal === 0 ? 0 : passo.y * sinal });
  if (tamanho === null) {
    return incremental ? regraPorPasso(graduacao, passo) : graduacao.tamanhos.map((_, t) => (t === base ? ZERO : comSinal(t > base ? 1 : -1)));
  }
  if (!Number.isInteger(tamanho) || tamanho < 0 || tamanho >= graduacao.tamanhos.length) throw new Error('Tamanho fora da graduação.');
  if (tamanho === base) throw new Error('O tamanho base é o do contorno desenhado e não anda: escolha outro tamanho.');
  const sinal = tamanho > base ? 1 : -1;
  const regra = regraCompleta(graduacao, atual);
  regra[tamanho] = incremental ? somar(regra[tamanho - sinal]!, comSinal(sinal)) : comSinal(sinal);
  return regra;
}

/**
 * "Tangente": a regra do ponto `indice` andando `distanciaMm` na direção do
 * ponto `indiceDoVizinho` (a aresta que sai dele, ou a que chega).
 * - `usarContornoBase`: a direção é sempre a da aresta no contorno base. Sem
 *   isso (e no incremental), cada tamanho sai do vizinho do lado do base na
 *   direção que a aresta tem nesse vizinho — a tangente acompanha a curva dos
 *   tamanhos.
 * - `tamanho` e `incremental`: como em `regraComPasso`.
 */
export function regraNaTangente(
  graduacao: Graduacao,
  contorno: Contorno,
  indice: number,
  indiceDoVizinho: number,
  distanciaMm: number,
  opcoes: { readonly usarContornoBase: boolean; readonly incremental: boolean; readonly tamanho: number | null },
): Ponto2D[] {
  const ponto = contorno[indice];
  const vizinho = contorno[indiceDoVizinho];
  if (!ponto || !vizinho) throw new Error('Ponto fora do contorno da peça.');
  const atual = regraDoVertice(graduacao, contorno, indice);
  /**
   * A direção da aresta no tamanho `t`, com o ponto onde `regra` o põe nesse
   * tamanho. O vizinho é lido com essa regra já no ponto: se ele é
   * proporcional, anda junto — senão, num contorno de pontos próximos, o
   * ponto passaria por cima dele e a direção se inverteria.
   */
  const direcaoEm = (t: number, regra: readonly Ponto2D[]): Ponto2D => {
    const doVizinho = regraDoVertice(definirRegra(graduacao, contorno, indice, regra), contorno, indiceDoVizinho);
    const de = somar(ponto, regra[t] ?? ZERO);
    const ate = somar(vizinho, doVizinho[t] ?? ZERO);
    const comprimento = distancia(de, ate);
    if (comprimento < NO_MESMO_LUGAR_MM) throw new Error('Essa aresta não tem comprimento: não dá a direção da tangente.');
    return { x: (ate.x - de.x) / comprimento, y: (ate.y - de.y) / comprimento };
  };
  const base = graduacao.base;
  const passoEm = (direcao: Ponto2D): Ponto2D => ({ x: direcao.x * distanciaMm, y: direcao.y * distanciaMm });
  const noBase = direcaoEm(
    base,
    graduacao.tamanhos.map(() => ZERO),
  );
  if (opcoes.usarContornoBase || !opcoes.incremental) return regraComPasso(graduacao, atual, passoEm(noBase), opcoes.tamanho, opcoes.incremental);
  if (opcoes.tamanho !== null) {
    const t = opcoes.tamanho;
    if (!Number.isInteger(t) || t < 0 || t >= graduacao.tamanhos.length) throw new Error('Tamanho fora da graduação.');
    if (t === base) throw new Error('O tamanho base é o do contorno desenhado e não anda: escolha outro tamanho.');
    const sinal = t > base ? 1 : -1;
    const regra = regraCompleta(graduacao, atual);
    const passo = passoEm(direcaoEm(t - sinal, regra));
    regra[t] = somar(regra[t - sinal]!, { x: passo.x * sinal, y: passo.y * sinal });
    return regra;
  }
  const regra: Ponto2D[] = graduacao.tamanhos.map(() => ZERO);
  for (let t = base + 1; t < regra.length; t++) regra[t] = somar(regra[t - 1]!, passoEm(direcaoEm(t - 1, regra)));
  for (let t = base - 1; t >= 0; t--) regra[t] = subtrair(regra[t + 1]!, passoEm(direcaoEm(t + 1, regra)));
  return regra;
}

/** O tamanho da ponta da graduação: o maior, ou o menor quando o base já é o maior. */
export function tamanhoDeReferencia(graduacao: Graduacao): number {
  return graduacao.base < graduacao.tamanhos.length - 1 ? graduacao.tamanhos.length - 1 : 0;
}

/** A regra em que o ponto anda `deslocamento` até o tamanho de referência, por passos iguais. */
export function regraPeloTamanhoDeReferencia(graduacao: Graduacao, deslocamento: Ponto2D): Ponto2D[] {
  const passos = tamanhoDeReferencia(graduacao) - graduacao.base;
  return regraPorPasso(graduacao, { x: deslocamento.x / passos, y: deslocamento.y / passos });
}

/**
 * A regra do modo "Proporcional": o ponto anda `noMenor` no menor tamanho e
 * `noMaior` no maior, e os tamanhos entre o base e cada ponta ficam com a
 * parte proporcional à distância deles ao base. De um lado sem tamanhos (o
 * base é a ponta), o deslocamento desse lado não conta.
 */
export function regraProporcional(graduacao: Graduacao, noMenor: Ponto2D | null, noMaior: Ponto2D | null): Ponto2D[] {
  const ultimo = graduacao.tamanhos.length - 1;
  const parte = (deslocamento: Ponto2D | null, fracao: number): Ponto2D => {
    // Zero vezes um número negativo dá "-0": fica zero.
    const vezes = (valor: number): number => (valor * fracao === 0 ? 0 : valor * fracao);
    return deslocamento ? { x: vezes(deslocamento.x), y: vezes(deslocamento.y) } : ZERO;
  };
  return graduacao.tamanhos.map((_, t) => {
    if (t < graduacao.base) return parte(noMenor, (graduacao.base - t) / graduacao.base);
    if (t > graduacao.base) return parte(noMaior, (t - graduacao.base) / (ultimo - graduacao.base));
    return ZERO;
  });
}

/** A regra `atual` com `nova` no eixo dado: nos dois, só no `x` ou só no `y`. */
export function regraNoEixo(atual: readonly Ponto2D[], nova: readonly Ponto2D[], eixo: EixoDaGraduacao): Ponto2D[] {
  return atual.map((d, t) => {
    const n = nova[t] ?? ZERO;
    return eixo === 'ambos' ? n : eixo === 'x' ? { x: n.x, y: d.y } : { x: d.x, y: n.y };
  });
}

/** A graduação levada por um movimento da peça (`ponto` para posições, `vetor` para deslocamentos). */
export function transformarGraduacao(graduacao: Graduacao, ponto: (p: Ponto2D) => Ponto2D, vetor: (v: Ponto2D) => Ponto2D): Graduacao {
  return {
    ...graduacao,
    pontos: graduacao.pontos.map((p) => ({ ...p, posicao: ponto(p.posicao), deslocamentos: p.deslocamentos.map(vetor) })),
  };
}

/**
 * A graduação depois que pontos do contorno mudaram de lugar (mesma
 * quantidade de pontos, mesma ordem): cada ponto graduado acompanha o ponto do
 * contorno em que estava.
 */
export function graduacaoComOsPontosMovidos(graduacao: Graduacao, contornoAntigo: Contorno, contornoNovo: Contorno): Graduacao {
  if (contornoAntigo === contornoNovo || contornoAntigo.length !== contornoNovo.length) return graduacao;
  return {
    ...graduacao,
    pontos: graduacao.pontos.map((p) => {
      const i = verticeEm(contornoAntigo, p.posicao);
      return i >= 0 ? { ...p, posicao: contornoNovo[i]! } : p;
    }),
  };
}

/**
 * "Deduzir": desconta de todos os pontos a regra do ponto `indice`. Ele passa
 * a não se deslocar em nenhum tamanho — é o ponto em que os tamanhos ficam
 * empilhados — e a forma de cada tamanho continua a mesma.
 */
export function descontarPonto(graduacao: Graduacao, contorno: Contorno, indice: number): Graduacao {
  const regra = regraDoVertice(graduacao, contorno, indice);
  const limpa = semPontosSoltos(graduacao, contorno);
  return { ...limpa, pontos: limpa.pontos.map((p) => ({ ...p, deslocamentos: p.deslocamentos.map((d, t) => subtrair(d, regra[t] ?? ZERO)) })) };
}

/**
 * Apaga a graduação, no eixo dado, do ponto `indice` — que passa a ser um
 * ponto graduado parado nesse eixo — ou, com `indice` nulo, de todos os
 * pontos graduados.
 */
export function apagarRegras(graduacao: Graduacao, contorno: Contorno, indice: number | null, eixo: EixoDaGraduacao): Graduacao {
  const zerada = (regra: readonly Ponto2D[]): Ponto2D[] => regraNoEixo(regra, semDeslocamento(regra.length), eixo);
  if (indice !== null) return definirRegra(graduacao, contorno, indice, zerada(regraDoVertice(graduacao, contorno, indice)));
  const limpa = semPontosSoltos(graduacao, contorno);
  return { ...limpa, pontos: limpa.pontos.map((p) => ({ ...p, deslocamentos: zerada(p.deslocamentos) })) };
}

/**
 * "Agrupar ou desagrupar": organiza os tamanhos a partir do ponto de
 * referência `indice`. No tamanho `tamanho` (ou em todos, com `null`), a
 * peça inteira é levada de modo que o ponto de referência fique a `passo`
 * vezes a distância desse tamanho ao base. Com o passo zero, os tamanhos ficam
 * empilhados no ponto (agrupados); com um passo, cada um fica afastado do
 * vizinho (desagrupados). A forma de cada tamanho não muda.
 */
export function agruparTamanhos(graduacao: Graduacao, contorno: Contorno, indice: number, passo: Ponto2D, tamanho: number | null): Graduacao {
  if (!contorno[indice]) throw new Error('Ponto fora do contorno da peça.');
  if (tamanho !== null && (!Number.isInteger(tamanho) || tamanho < 0 || tamanho >= graduacao.tamanhos.length)) {
    throw new Error('Tamanho fora da graduação.');
  }
  if (tamanho === graduacao.base) throw new Error('O tamanho base é o desenhado e não sai do lugar: escolha outro tamanho, ou todos.');
  const regra = regraDoVertice(graduacao, contorno, indice);
  const alvo = regraPorPasso(graduacao, passo);
  const limpa = semPontosSoltos(graduacao, contorno);
  // O quanto a peça do tamanho `t` anda, inteira, para o ponto de referência chegar ao lugar dele.
  const anda = (t: number): Ponto2D => (t !== graduacao.base && (tamanho === null || tamanho === t) ? subtrair(alvo[t] ?? ZERO, regra[t] ?? ZERO) : ZERO);
  return {
    ...limpa,
    pontos: limpa.pontos.map((p) => ({ ...p, deslocamentos: p.deslocamentos.map((d, t) => somar(d, anda(t))) })),
  };
}

/** A posição de cada ponto a ajustar entre o inicial (0) e o final (1). */
function proporcoesEntre(contorno: Contorno, inicial: number, ajustados: readonly number[], final: number): number[] {
  const n = contorno.length;
  const passos = (de: number, ate: number): number => (ate - de + n) % n;
  // Todos no caminho que vai do inicial ao final seguindo a numeração, ou todos no caminho contrário?
  const sentido = ajustados.every((v) => passos(inicial, v) < passos(inicial, final)) ? 1 : ajustados.every((v) => passos(v, inicial) < passos(final, inicial)) ? -1 : 0;
  if (sentido !== 0) {
    const ate = (v: number): number => {
      let soma = 0;
      for (let i = inicial; i !== v; i = (i + sentido + n) % n) soma += distancia(contorno[i]!, contorno[(i + sentido + n) % n]!);
      return soma;
    };
    const total = ate(final);
    if (total > 1e-9) return ajustados.map((v) => ate(v) / total);
  }
  // Pontos espalhados pelos dois caminhos: vale a projeção de cada um na reta do inicial ao final.
  const de = contorno[inicial]!;
  const para = contorno[final]!;
  const quadrado = (para.x - de.x) ** 2 + (para.y - de.y) ** 2;
  if (quadrado < 1e-12) throw new Error('O ponto inicial e o final estão no mesmo lugar.');
  return ajustados.map((v) => {
    const p = contorno[v]!;
    return Math.min(1, Math.max(0, ((p.x - de.x) * (para.x - de.x) + (p.y - de.y) * (para.y - de.y)) / quadrado));
  });
}

/**
 * "Ajustar": os pontos `ajustados` passam a andar na proporção entre o ponto
 * `inicial` e o `final` — cada um conforme a posição dele entre os dois, ao
 * longo do contorno (ou, se estão espalhados pelos dois lados da peça, pela
 * projeção na reta que liga o inicial ao final). `eixo` limita o ajuste a um
 * eixo; no outro, o ponto fica com o que tinha.
 */
export function ajustarEntre(
  graduacao: Graduacao,
  contorno: Contorno,
  inicial: number,
  ajustados: readonly number[],
  final: number,
  eixo: EixoDaGraduacao,
): Graduacao {
  if (!contorno[inicial] || !contorno[final] || ajustados.some((v) => !contorno[v])) throw new Error('Ponto fora do contorno da peça.');
  if (inicial === final) throw new Error('O ponto final precisa ser outro, diferente do inicial.');
  if (ajustados.length === 0) throw new Error('Indique pelo menos um ponto a ajustar entre o inicial e o final.');
  if (ajustados.includes(inicial) || ajustados.includes(final)) throw new Error('O ponto inicial e o final não entram entre os ajustados.');
  const doInicial = regraDoVertice(graduacao, contorno, inicial);
  const doFinal = regraDoVertice(graduacao, contorno, final);
  const proporcoes = proporcoesEntre(contorno, inicial, ajustados, final);
  return ajustados.reduce((g, v, k) => {
    const t = proporcoes[k]!;
    const naProporcao = doInicial.map((d, tamanho) => {
      const f = doFinal[tamanho] ?? ZERO;
      return { x: d.x + (f.x - d.x) * t, y: d.y + (f.y - d.y) * t };
    });
    return definirRegra(g, contorno, v, regraNoEixo(regraDoVertice(g, contorno, v), naProporcao, eixo));
  }, graduacao);
}

import {
  area,
  areaAssinada,
  comprimentoDaLinha,
  distancia,
  pontoMaisProximoNoContorno,
  segmentosSeIntersectam,
  substituirTrechoDoContorno,
  trechoDoContorno,
  trechoMaisCurto,
  type Ponto2D,
  type PosicaoNoContorno,
} from '../core/geometria';
import { piquesQueFicamNoContorno, type Molde, type Pique } from './molde';

/**
 * "Bainha" (aba Produção): acrescenta a sobra de tecido que se dobra para
 * dentro num trecho do contorno. O trecho é o mais curto dos dois caminhos
 * entre os dois pontos indicados.
 */
export interface OpcoesDeBainha {
  /** Quantas vezes a bainha dobra (1 = bainha simples). */
  readonly dobras: number;
  /** Largura de cada dobra no começo do trecho (mm). */
  readonly larguraMm: number;
  /** Largura de cada dobra no fim do trecho (mm); ausente, vale a do começo. */
  readonly largura2Mm?: number;
  /** Põe um pique em cada ponta de cada linha de dobra. */
  readonly piques: boolean;
}

export const MAXIMO_DE_DOBRAS_DA_BAINHA = 4;

/** Trecho mais curto que isso (mm) não tem direção para a bainha sair. */
const COMPRIMENTO_MINIMO_DO_TRECHO_MM = 1e-6;
/**
 * A lateral da bainha só copia a costura vizinha quando esta entra na peça
 * com pelo menos esta inclinação em relação ao trecho (seno do ângulo): mais
 * deitada que isso, a lateral sai reta, em esquadro.
 */
const INCLINACAO_MINIMA_DA_LATERAL = 0.2;
/** Nos cantos do trecho, a esquadria é limitada a este tanto da largura (evita pontas em cantos muito fechados). */
const LIMITE_DA_ESQUADRIA = 5;

function ponto(x: number, y: number): Ponto2D {
  return { x, y };
}

function unitario(de: Ponto2D, ate: Ponto2D): Ponto2D {
  const comprimento = distancia(de, ate);
  return comprimento === 0 ? ponto(0, 0) : ponto((ate.x - de.x) / comprimento, (ate.y - de.y) / comprimento);
}

/**
 * Quanto a lateral da bainha anda ao longo do trecho para cada milímetro que
 * se afasta dele: a costura vizinha (`vizinho` é o vértice dela além do
 * trecho), espelhada na linha da bainha. Assim, dobrada, a lateral da bainha
 * cai em cima dessa costura.
 */
function desvioDaLateral(extremo: Ponto2D, vizinho: Ponto2D, tangente: Ponto2D, paraFora: Ponto2D): number {
  const costura = unitario(extremo, vizinho);
  const aoLongo = costura.x * tangente.x + costura.y * tangente.y;
  const paraDentro = -(costura.x * paraFora.x + costura.y * paraFora.y);
  return paraDentro >= INCLINACAO_MINIMA_DA_LATERAL ? aoLongo / paraDentro : 0;
}

function linhaSeCruza(linha: readonly Ponto2D[]): boolean {
  for (let i = 0; i + 1 < linha.length; i++) {
    for (let j = i + 2; j + 1 < linha.length; j++) {
      if (segmentosSeIntersectam(linha[i]!, linha[i + 1]!, linha[j]!, linha[j + 1]!)) return true;
    }
  }
  return false;
}

/** Recusa as opções que não dão uma bainha: dobras fora de 1 ao máximo, largura que não é maior que zero. */
export function conferirOpcoesDeBainha(opcoes: OpcoesDeBainha): void {
  const { dobras } = opcoes;
  if (!Number.isInteger(dobras) || dobras < 1 || dobras > MAXIMO_DE_DOBRAS_DA_BAINHA) {
    throw new Error(`O número de dobras precisa ser um inteiro de 1 a ${MAXIMO_DE_DOBRAS_DA_BAINHA}.`);
  }
  if (![opcoes.larguraMm, opcoes.largura2Mm ?? opcoes.larguraMm].every((l) => Number.isFinite(l) && l > 0)) {
    throw new Error('A largura da bainha precisa ser maior que zero.');
  }
}

/** A geometria da bainha, sem tocar na peça: o que entra no contorno e as linhas de dobra. */
export interface GeometriaDaBainha {
  readonly de: PosicaoNoContorno;
  readonly ate: PosicaoNoContorno;
  /** O caminho novo do contorno entre `de` e `ate` (sem os dois). */
  readonly miolo: readonly Ponto2D[];
  /** As linhas de dobra, da linha original da bainha até a penúltima dobra. */
  readonly linhasDeDobra: readonly (readonly Ponto2D[])[];
}

/**
 * Calcula a bainha no trecho mais curto entre `a` e `b`. Cada dobra é uma
 * faixa paralela ao trecho, para fora da peça; com `largura2Mm`, a largura
 * muda por igual de uma ponta à outra. As laterais copiam, espelhadas, as
 * costuras vizinhas — em ziguezague, uma dobra para cada lado.
 */
export function geometriaDaBainha(molde: Molde, a: PosicaoNoContorno, b: PosicaoNoContorno, opcoes: OpcoesDeBainha): GeometriaDaBainha {
  conferirOpcoesDeBainha(opcoes);
  const { dobras } = opcoes;
  const { de, ate, invertido } = trechoMaisCurto(molde.contorno, a, b);
  // A largura 1 é a do primeiro ponto indicado (`a`), esteja ele no começo ou no fim do trecho.
  const larguraDeA = opcoes.larguraMm;
  const larguraDeB = opcoes.largura2Mm ?? opcoes.larguraMm;
  const [larguraMm, largura2Mm] = invertido ? [larguraDeB, larguraDeA] : [larguraDeA, larguraDeB];
  const trecho = trechoDoContorno(molde.contorno, de, ate);
  const total = comprimentoDaLinha(trecho);
  if (trecho.length < 2 || total < COMPRIMENTO_MINIMO_DO_TRECHO_MM) {
    throw new Error('A bainha precisa de dois pontos diferentes do contorno.');
  }

  const n = molde.contorno.length;
  const ultimo = trecho.length - 1;
  // Normal para fora de um segmento que anda no sentido da numeração dos vértices.
  const sinal = areaAssinada(molde.contorno) >= 0 ? 1 : -1;
  const paraForaDe = (t: Ponto2D): Ponto2D => ponto(t.y * sinal, -t.x * sinal);
  const tangentes = trecho.slice(1).map((p, i) => unitario(trecho[i]!, p));
  // Largura de uma dobra em cada ponto do trecho, pela distância andada desde o começo.
  let andado = 0;
  const larguras = trecho.map((p, i) => {
    if (i > 0) andado += distancia(trecho[i - 1]!, p);
    return larguraMm + ((largura2Mm - larguraMm) * andado) / total;
  });

  // Vértices da costura vizinha de cada ponta: o que vem antes de `de` e o que vem depois de `ate`.
  const emCimaDe = (posicao: PosicaoNoContorno, indice: number): boolean => distancia(posicao.ponto, molde.contorno[indice % n]!) < 1e-9;
  const antes = molde.contorno[emCimaDe(de, de.indiceAresta) ? (de.indiceAresta - 1 + n) % n : de.indiceAresta]!;
  const depois = molde.contorno[(ate.indiceAresta + (emCimaDe(ate, ate.indiceAresta + 1) ? 2 : 1)) % n]!;
  const tangenteInicial = tangentes[0]!;
  const tangenteFinal = tangentes[ultimo - 1]!;
  const desvioInicial = desvioDaLateral(trecho[0]!, antes, tangenteInicial, paraForaDe(tangenteInicial));
  const desvioFinal = desvioDaLateral(trecho[ultimo]!, depois, tangenteFinal, paraForaDe(tangenteFinal));

  /** O ponto `i` do trecho levado até a dobra `k` (k = 0 é a linha original da bainha). */
  const naDobra = (i: number, k: number): Ponto2D => {
    const p = trecho[i]!;
    const largura = larguras[i]!;
    if (i === 0 || i === ultimo) {
      const tangente = i === 0 ? tangenteInicial : tangenteFinal;
      const fora = paraForaDe(tangente);
      // Em ziguezague: nas dobras ímpares a lateral está desviada; nas pares, voltou.
      const aoLongo = k % 2 === 1 ? (i === 0 ? desvioInicial : desvioFinal) * largura : 0;
      return ponto(p.x + fora.x * largura * k + tangente.x * aoLongo, p.y + fora.y * largura * k + tangente.y * aoLongo);
    }
    // Canto do trecho: esquadria entre as paralelas dos dois segmentos.
    const n1 = paraForaDe(tangentes[i - 1]!);
    const n2 = paraForaDe(tangentes[i]!);
    const soma = ponto(n1.x + n2.x, n1.y + n2.y);
    const tamanho = Math.hypot(soma.x, soma.y);
    if (tamanho < 1e-9) return ponto(p.x + n1.x * largura * k, p.y + n1.y * largura * k);
    const bissetriz = ponto(soma.x / tamanho, soma.y / tamanho);
    const alongamento = Math.min(1 / Math.max(bissetriz.x * n1.x + bissetriz.y * n1.y, 1e-9), LIMITE_DA_ESQUADRIA);
    return ponto(p.x + bissetriz.x * largura * k * alongamento, p.y + bissetriz.y * largura * k * alongamento);
  };
  const dobra = (k: number): Ponto2D[] => trecho.map((_, i) => naDobra(i, k));

  const subida = Array.from({ length: dobras - 1 }, (_, j) => naDobra(0, j + 1));
  const descida = Array.from({ length: dobras - 1 }, (_, j) => naDobra(ultimo, dobras - 1 - j));
  const miolo = [...subida, ...dobra(dobras), ...descida];
  if (linhaSeCruza([trecho[0]!, ...miolo, trecho[ultimo]!])) {
    throw new Error('A bainha não cabe nesse trecho com essa largura: as laterais se cruzam.');
  }
  return {
    de,
    ate,
    miolo,
    linhasDeDobra: Array.from({ length: dobras }, (_, k) => (k === 0 ? trecho : dobra(k))),
  };
}

/**
 * Aplica a bainha: o contorno ganha a sobra, as linhas de dobra entram como
 * linhas internas e, se pedido, cada ponta de cada linha de dobra ganha um
 * pique. Os piques que estavam no trecho saem, porque ele deixa de ser borda.
 */
export function criarBainha(
  molde: Molde,
  a: PosicaoNoContorno,
  b: PosicaoNoContorno,
  opcoes: OpcoesDeBainha,
  novoId: () => string,
): Molde {
  const { de, ate, miolo, linhasDeDobra } = geometriaDaBainha(molde, a, b, opcoes);
  const contorno = substituirTrechoDoContorno(molde.contorno, de, ate, miolo);
  if (contorno.length < 3 || !(area(contorno) > area(molde.contorno))) {
    throw new Error('A bainha não cabe nesse trecho com essa largura.');
  }
  const novos: Pique[] = opcoes.piques
    ? linhasDeDobra.flatMap((linha) =>
        [linha[0]!, linha.at(-1)!].map((p) => {
          const noContorno = pontoMaisProximoNoContorno(p, contorno);
          return { id: novoId(), posicao: noContorno.ponto, indiceAresta: noContorno.indiceAresta };
        }),
      )
    : [];
  return {
    ...molde,
    contorno,
    linhasInternas: [...molde.linhasInternas, ...linhasDeDobra],
    piques: [...piquesQueFicamNoContorno(molde.piques, contorno), ...novos],
  };
}

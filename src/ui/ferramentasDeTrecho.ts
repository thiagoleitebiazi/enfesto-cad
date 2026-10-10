import {
  comprimentoDaLinha,
  distancia,
  trechoDoContorno,
  trechoMaisCurto,
  type Contorno,
  type Ponto2D,
  type PosicaoNoContorno,
} from '../core/geometria';
import { linhaDoArcoTangente } from '../core/arcos';
import { ajustarCurvaAosExtremos, arcoPorTresPontos, curvaPorPontos, reamostrarLinha } from '../core/curvas';

/**
 * Ferramentas que mexem num trecho do contorno da peça selecionada: o trecho
 * é sempre o mais curto dos dois caminhos entre os dois pontos indicados no
 * contorno. O que muda de uma para outra é a ordem dos cliques e o que entra
 * no lugar do trecho.
 */
export type FerramentaDeTrecho =
  | 'curva'
  | 'arco-2-pontos'
  | 'arco-3-pontos'
  | 'editar-pontos-de-curva'
  | 'cadastrar-curva'
  | 'curva-predefinida'
  | 'arco-tangente-a-elemento';

/** Os extremos do trecho, já presos ao contorno, e os pontos livres clicados (por onde a curva passa). */
export interface TrechoEmEdicao {
  readonly inicio: PosicaoNoContorno | null;
  readonly fim: PosicaoNoContorno | null;
  readonly livres: readonly Ponto2D[];
}

export const SEM_TRECHO: TrechoEmEdicao = { inicio: null, fim: null, livres: [] };

/** Um clique: onde ele cai no contorno da peça selecionada (se cai) e o ponto clicado em si. */
export interface CliqueDeTrecho {
  readonly noContorno: PosicaoNoContorno | null;
  readonly livre: Ponto2D;
}

/** Dois pontos do contorno a menos disso (mm) são o mesmo: não há trecho entre eles. */
const MESMO_PONTO_MM = 1e-6;

function mesmaPosicao(a: PosicaoNoContorno, b: PosicaoNoContorno): boolean {
  return distancia(a.ponto, b.ponto) < MESMO_PONTO_MM;
}

/**
 * Quantos pontos livres a ferramenta usa: a curva, quantos se quiser (pelo
 * menos um); os arcos, um só (o ponto por onde o arco passa); as outras,
 * nenhum.
 */
function livresPedidos(ferramenta: FerramentaDeTrecho): { readonly minimo: number; readonly maximo: number } {
  if (ferramenta === 'curva') return { minimo: 1, maximo: Infinity };
  if (ferramenta === 'arco-2-pontos' || ferramenta === 'arco-3-pontos') return { minimo: 1, maximo: 1 };
  return { minimo: 0, maximo: 0 };
}

/** O trecho está completo: os dois extremos e os pontos livres que a ferramenta pede. */
export function trechoCompleto(ferramenta: FerramentaDeTrecho, estado: TrechoEmEdicao): boolean {
  return estado.inicio !== null && estado.fim !== null && estado.livres.length >= livresPedidos(ferramenta).minimo;
}

/**
 * O estado depois de um clique. Em todas as ferramentas o primeiro clique é
 * um extremo, no contorno. Depois:
 * - "Arco por 2 pontos": o outro extremo e, por último, o ponto do arco;
 * - "Curva" e "Arco por 3 pontos": os pontos de passagem e, por último, o
 *   outro extremo — um clique no contorno, depois de pelo menos um ponto de
 *   passagem, termina;
 * - as demais: só o outro extremo.
 * Um clique que não serve (fora do contorno quando se espera um extremo, o
 * mesmo ponto do início) devolve o mesmo estado.
 */
export function cliqueDeTrecho(ferramenta: FerramentaDeTrecho, estado: TrechoEmEdicao, clique: CliqueDeTrecho): TrechoEmEdicao {
  if (trechoCompleto(ferramenta, estado)) return estado;
  const { minimo, maximo } = livresPedidos(ferramenta);
  if (!estado.inicio) return clique.noContorno ? { ...SEM_TRECHO, inicio: clique.noContorno } : estado;
  const fimValido = clique.noContorno && !mesmaPosicao(clique.noContorno, estado.inicio) ? clique.noContorno : null;

  if (ferramenta === 'arco-2-pontos') {
    if (!estado.fim) return fimValido ? { ...estado, fim: fimValido } : estado;
    return { ...estado, livres: [clique.livre] };
  }
  // O extremo final só vale depois dos pontos de passagem que a ferramenta pede.
  if (fimValido && estado.livres.length >= minimo) return { ...estado, fim: fimValido };
  if (clique.noContorno || maximo === 0) return estado;
  // Um ponto de passagem a mais; no arco, que só tem um, o clique novo troca o anterior.
  const anteriores = estado.livres.length < maximo ? estado.livres : estado.livres.slice(0, -1);
  return { ...estado, livres: [...anteriores, clique.livre] };
}

/** O caminho mais curto sobre o contorno entre dois pontos dele, na ordem do primeiro para o segundo. */
export function caminhoDoTrecho(contorno: Contorno, a: PosicaoNoContorno, b: PosicaoNoContorno): Ponto2D[] {
  const { de, ate, invertido } = trechoMaisCurto(contorno, a, b);
  const caminho = trechoDoContorno(contorno, de, ate);
  return invertido ? caminho.reverse() : caminho;
}

/** O que a ferramenta precisa além dos cliques: a curva escolhida ("Pré-definida") ou a quantidade de pontos. */
export interface OpcoesDoTrecho {
  readonly forma?: readonly Ponto2D[];
  readonly espelhar?: boolean;
  readonly quantidadeDePontos?: number;
}

/**
 * A linha nova, do início ao fim do trecho (com os dois extremos), que a
 * ferramenta põe no lugar dele. `null` se ainda falta algo para calculá-la.
 * "Cadastrar curva" não troca nada: devolve o próprio caminho.
 */
export function linhaNovaDoTrecho(
  ferramenta: FerramentaDeTrecho,
  contorno: Contorno,
  inicio: PosicaoNoContorno,
  fim: Ponto2D,
  livres: readonly Ponto2D[],
  opcoes: OpcoesDoTrecho = {},
  fimNoContorno: PosicaoNoContorno | null = null,
): Ponto2D[] | null {
  if (distancia(inicio.ponto, fim) < MESMO_PONTO_MM) return null;
  if (ferramenta === 'curva') return livres.length > 0 ? curvaPorPontos([inicio.ponto, ...livres, fim]) : null;
  if (ferramenta === 'arco-2-pontos' || ferramenta === 'arco-3-pontos') {
    return livres[0] ? arcoPorTresPontos(inicio.ponto, livres[0], fim) : null;
  }
  if (ferramenta === 'curva-predefinida') {
    return opcoes.forma ? ajustarCurvaAosExtremos(opcoes.forma, inicio.ponto, fim, opcoes.espelhar ?? false) : null;
  }
  if (!fimNoContorno) return null;
  // Sai de `inicio` dando continuidade ao elemento vizinho; lança erro se não há arco que chegue ao fim.
  if (ferramenta === 'arco-tangente-a-elemento') return linhaDoArcoTangente(contorno, inicio, fimNoContorno);
  const caminho = caminhoDoTrecho(contorno, inicio, fimNoContorno);
  if (ferramenta === 'cadastrar-curva') return caminho;
  return opcoes.quantidadeDePontos ? reamostrarLinha(caminho, opcoes.quantidadeDePontos) : null;
}

/** O que o desenho mostra enquanto a ferramenta está em uso. */
export interface PreviaDeTrecho {
  /** A linha que vai entrar no contorno. */
  readonly novo: readonly Ponto2D[] | null;
  /** O trecho do contorno que vai sair (ou que foi indicado). */
  readonly substituido: readonly Ponto2D[] | null;
  /** Os extremos já clicados. */
  readonly marcas: readonly Ponto2D[];
}

/**
 * A prévia com o mouse onde está: os extremos já clicados, o trecho que
 * sairia se o mouse (ou o extremo já clicado) fechasse o trecho, e a linha
 * que entraria no lugar.
 */
export function previaDoTrecho(
  ferramenta: FerramentaDeTrecho,
  contorno: Contorno,
  estado: TrechoEmEdicao,
  mouse: CliqueDeTrecho | null,
  opcoes: OpcoesDoTrecho = {},
): PreviaDeTrecho {
  const marcas = [estado.inicio?.ponto, estado.fim?.ponto].filter((p): p is Ponto2D => p !== undefined);
  if (!estado.inicio) return { novo: null, substituido: null, marcas };
  const fimNoContorno =
    estado.fim ?? (mouse?.noContorno && !mesmaPosicao(mouse.noContorno, estado.inicio) ? mouse.noContorno : null);
  const substituido = fimNoContorno ? caminhoDoTrecho(contorno, estado.inicio, fimNoContorno) : null;
  // No arco por 2 pontos, com os extremos postos, o mouse é o ponto do arco.
  const livres =
    ferramenta === 'arco-2-pontos' && estado.fim && estado.livres.length === 0 && mouse ? [mouse.livre] : estado.livres;
  const fim = fimNoContorno?.ponto ?? mouse?.livre ?? null;
  let novo: Ponto2D[] | null = null;
  try {
    novo = fim ? linhaNovaDoTrecho(ferramenta, contorno, estado.inicio, fim, livres, opcoes, fimNoContorno) : null;
  } catch {
    // Com o mouse ali a linha não existe (um arco tangente impossível, por exemplo): fica sem prévia.
  }
  // Indicar um trecho sem trocá-lo (cadastrar, contar pontos) não tem linha nova a mostrar.
  const soIndica = ferramenta === 'cadastrar-curva' || ferramenta === 'editar-pontos-de-curva';
  return { novo: soIndica ? null : novo, substituido, marcas };
}

/** Quantos pontos o trecho tem hoje, contando os extremos — o valor inicial de "Editar pontos de curva". */
export function pontosDoTrecho(contorno: Contorno, a: PosicaoNoContorno, b: PosicaoNoContorno): number {
  return caminhoDoTrecho(contorno, a, b).length;
}

/** Comprimento do trecho indicado, em mm. */
export function comprimentoDoTrecho(contorno: Contorno, a: PosicaoNoContorno, b: PosicaoNoContorno): number {
  return comprimentoDaLinha(caminhoDoTrecho(contorno, a, b));
}

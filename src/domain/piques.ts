import {
  andarNoContorno,
  distancia,
  pontoDentroDoContorno,
  pontoMaisProximoNoContorno,
  rotacionar,
  type Contorno,
  type Ponto2D,
  type PosicaoNoContorno,
} from '../core/geometria';
import { contornoDeCorte, inserirPontoNoMolde, type FormatoDePique, type Marca, type Molde, type Pique } from './molde';
import { definirGraduacaoDoPique, referenciaSugerida } from './piquesGraduados';

/**
 * Os piques da aba Marcações. Um pique tem um **formato**: o tipo (um desenho
 * num quadro de 1 × 1), a largura, a altura e o ângulo. O pique do contorno
 * nasce na borda e entra na peça; o **pique interno** é a marca da peça com
 * um formato, centrado no ponto em que foi posto — é o que o manual da
 * referência chama, na janela do Substituir, de "marca".
 *
 * O pique sem formato (os de antes desta aba) continua sendo o traço de 6 mm
 * de sempre, e a marca sem formato, o ponto de sempre.
 */
export interface TipoDePique {
  readonly id: string;
  readonly nome: string;
  readonly descricao: string;
  /** Os traços, no quadro de 1 × 1: x de −0,5 a 0,5 ao longo da borda, y de 0 (na borda) a 1 (para dentro). */
  readonly tracos: readonly (readonly Ponto2D[])[];
}

const p = (x: number, y: number): Ponto2D => ({ x, y });
/** Um arco de círculo de raio 0,5 em torno de (0; 0,5), de `de` a `ate` (em voltas de 1/16). */
const arco = (de: number, ate: number): Ponto2D[] =>
  Array.from({ length: ate - de + 1 }, (_, k) => {
    const angulo = ((de + k) * Math.PI) / 8;
    return p(0.5 * Math.cos(angulo), 0.5 - 0.5 * Math.sin(angulo));
  });

/**
 * Os formatos que vêm com o programa. O manual da referência tem a lista de
 * tipos na janela, mas não a descreve: estes são os formatos de pique de uso
 * comum, escolha nossa.
 */
export const TIPOS_DE_PIQUE: readonly TipoDePique[] = [
  { id: 'traco', nome: 'Traço (I)', descricao: 'um corte reto', tracos: [[p(0, 0), p(0, 1)]] },
  { id: 'v', nome: 'V', descricao: 'um bico, com a boca na borda', tracos: [[p(-0.5, 0), p(0, 1), p(0.5, 0)]] },
  { id: 't', nome: 'T', descricao: 'um corte reto com uma barra na ponta', tracos: [[p(0, 0), p(0, 1)], [p(-0.5, 1), p(0.5, 1)]] },
  { id: 'u', nome: 'U', descricao: 'uma boca de fundo redondo', tracos: [[p(-0.5, 0), ...arco(8, 16), p(0.5, 0)]] },
  { id: 'caixa', nome: 'Caixa', descricao: 'uma boca retangular', tracos: [[p(-0.5, 0), p(-0.5, 1), p(0.5, 1), p(0.5, 0)]] },
  { id: 'cruz', nome: 'Cruz', descricao: 'dois traços em cruz', tracos: [[p(0, 0), p(0, 1)], [p(-0.5, 0.5), p(0.5, 0.5)]] },
  { id: 'circulo', nome: 'Círculo', descricao: 'um círculo', tracos: [arco(0, 16)] },
];

export const PIQUE_PADRAO: FormatoDePique = { tipo: 'traco', larguraMm: 4, alturaMm: 6, anguloGraus: 0 };
export const MEDIDA_MINIMA_DO_PIQUE_MM = 0.5;
export const MEDIDA_MAXIMA_DO_PIQUE_MM = 200;

const MESMO_PONTO_MM = 1e-6;
/** O pique sem formato: o traço de sempre, deste tamanho. */
const TRACO_DE_SEMPRE_MM = 6;

/** O tipo do programa com esse id, ou `null`. */
export function tipoDePique(id: string): TipoDePique | null {
  return TIPOS_DE_PIQUE.find((tipo) => tipo.id === id) ?? null;
}

/** O nome do formato para as mensagens: o do tipo do programa, ou o do pique cadastrado. */
export function nomeDoFormato(formato: FormatoDePique | undefined): string {
  if (!formato) return 'Traço (I)';
  return tipoDePique(formato.tipo)?.nome ?? formato.nome ?? formato.tipo;
}

/** Os traços do formato no quadro de 1 × 1: os do tipo do programa, ou os que o pique cadastrado traz. */
function tracosNoQuadro(formato: FormatoDePique): readonly (readonly Ponto2D[])[] {
  return formato.forma ?? tipoDePique(formato.tipo)?.tracos ?? TIPOS_DE_PIQUE[0]!.tracos;
}

/** Recusa o formato que não dá para desenhar. */
export function conferirFormato(formato: FormatoDePique): void {
  if (!formato.forma && !tipoDePique(formato.tipo)) throw new Error('Escolha um tipo de pique da lista.');
  for (const [nome, valor] of [
    ['A largura', formato.larguraMm],
    ['A altura', formato.alturaMm],
  ] as const) {
    if (!Number.isFinite(valor) || valor < MEDIDA_MINIMA_DO_PIQUE_MM || valor > MEDIDA_MAXIMA_DO_PIQUE_MM) {
      throw new Error(`${nome} do pique precisa ficar entre ${MEDIDA_MINIMA_DO_PIQUE_MM} e ${MEDIDA_MAXIMA_DO_PIQUE_MM} mm.`);
    }
  }
  if (!Number.isFinite(formato.anguloGraus) || Math.abs(formato.anguloGraus) > 180) throw new Error('O ângulo do pique precisa ficar entre −180° e 180°.');
}

/** A direção da aresta do pique e a direção em esquadro com ela que entra na peça. */
function eixosNoPique(contorno: Contorno, pique: Pique): { readonly aoLongo: Ponto2D; readonly paraDentro: Ponto2D } {
  const n = contorno.length;
  const a = contorno[pique.indiceAresta % n]!;
  const b = contorno[(pique.indiceAresta + 1) % n]!;
  const comprimento = distancia(a, b) || 1;
  const aoLongo = p((b.x - a.x) / comprimento, (b.y - a.y) / comprimento);
  const normal = p(aoLongo.y, 0 - aoLongo.x);
  // Um passo curto para um lado: se cai dentro da peça, é esse o lado de dentro.
  const umPasso = p(pique.posicao.x + normal.x * 0.05, pique.posicao.y + normal.y * 0.05);
  return { aoLongo, paraDentro: pontoDentroDoContorno(umPasso, contorno) ? normal : p(0 - normal.x, 0 - normal.y) };
}

/** Os traços do formato postos em `base`, com `aoLongo` e `paraDentro` de eixos, girados do ângulo do formato. `centrado`: o meio do quadro fica em `base`. */
function tracosEm(formato: FormatoDePique, base: Ponto2D, aoLongo: Ponto2D, paraDentro: Ponto2D, centrado: boolean): Ponto2D[][] {
  return tracosNoQuadro(formato).map((traco) =>
    traco.map((q) => {
      const u = q.x * formato.larguraMm;
      const w = (centrado ? q.y - 0.5 : q.y) * formato.alturaMm;
      const solto = p(base.x + aoLongo.x * u + paraDentro.x * w, base.y + aoLongo.y * u + paraDentro.y * w);
      return formato.anguloGraus === 0 ? solto : rotacionar(solto, base, formato.anguloGraus);
    }),
  );
}

/**
 * Os traços do pique do contorno, em mm. O ângulo é contado do esquadro com a
 * borda: 0° entra reto na peça; positivo, gira no sentido anti-horário da
 * tela. O pique sem formato é o traço de sempre.
 */
export function tracosDoPique(molde: Molde, pique: Pique): Ponto2D[][] {
  if (!pique.formato) {
    const n = molde.contorno.length;
    const a = molde.contorno[pique.indiceAresta % n]!;
    const b = molde.contorno[(pique.indiceAresta + 1) % n]!;
    const comprimento = distancia(a, b) || 1;
    const normal = p((b.y - a.y) / comprimento, (0 - (b.x - a.x)) / comprimento);
    return [[pique.posicao, p(pique.posicao.x + normal.x * TRACO_DE_SEMPRE_MM, pique.posicao.y + normal.y * TRACO_DE_SEMPRE_MM)]];
  }
  const { aoLongo, paraDentro } = eixosNoPique(molde.contorno, pique);
  return tracosEm(pique.formato, pique.posicao, aoLongo, paraDentro, false);
}

/**
 * Os traços do pique interno (a marca com formato), em mm, centrados na
 * posição dela. Com ângulo 0° o formato fica de pé na tela (a altura na
 * vertical); positivo, gira no sentido anti-horário. `null` na marca sem
 * formato: ela é o ponto de sempre.
 */
export function tracosDaMarca(marca: Marca): Ponto2D[][] | null {
  if (!marca.formato) return null;
  // Na tela os eixos são trocados: a horizontal é o y do mundo, e para cima é o −x.
  return tracosEm(marca.formato, marca.posicao, p(0, 1), p(-1, 0), true);
}

/**
 * Onde o pique do contorno aparece na linha de corte, quando a peça tem margem
 * de costura e o pique diz como vai para lá: `projetado`, no ponto da linha de
 * corte mais perto dele; `estendido`, onde o eixo do pique (com o ângulo
 * dele) encontra a linha de corte. `null` quando não há o que desenhar.
 */
export function tracosNaLinhaDeCorte(molde: Molde, pique: Pique): Ponto2D[][] | null {
  if (!pique.formato || !pique.naCostura || !(molde.margemDeCosturaMm > 0)) return null;
  const corte = contornoDeCorte(molde);
  const { aoLongo, paraDentro } = eixosNoPique(molde.contorno, pique);
  const perto = pontoMaisProximoNoContorno(pique.posicao, corte).ponto;
  let base = perto;
  if (pique.naCostura === 'estendido' && pique.formato.anguloGraus !== 0) {
    // O eixo do pique, para fora: de onde ele está, na direção contrária à que entra na peça.
    const ponta = rotacionar(p(pique.posicao.x - paraDentro.x, pique.posicao.y - paraDentro.y), pique.posicao, pique.formato.anguloGraus);
    const direcao = p(ponta.x - pique.posicao.x, ponta.y - pique.posicao.y);
    base = primeiroEncontro(corte, pique.posicao, direcao) ?? perto;
  }
  return tracosEm(pique.formato, base, aoLongo, paraDentro, false);
}

/** Onde a semirreta que sai de `origem` na direção `d` encontra primeiro o contorno. */
function primeiroEncontro(contorno: Contorno, origem: Ponto2D, d: Ponto2D): Ponto2D | null {
  let melhor: { readonly t: number; readonly ponto: Ponto2D } | null = null;
  for (let i = 0; i < contorno.length; i++) {
    const a = contorno[i]!;
    const b = contorno[(i + 1) % contorno.length]!;
    const e = p(b.x - a.x, b.y - a.y);
    const det = d.x * e.y - d.y * e.x;
    if (Math.abs(det) < 1e-12) continue;
    const t = ((a.x - origem.x) * e.y - (a.y - origem.y) * e.x) / det;
    const s = ((a.x - origem.x) * d.y - (a.y - origem.y) * d.x) / det;
    if (t > MESMO_PONTO_MM && s >= 0 && s <= 1 && (!melhor || t < melhor.t)) melhor = { t, ponto: p(origem.x + d.x * t, origem.y + d.y * t) };
  }
  return melhor ? melhor.ponto : null;
}

/**
 * A posição do pique dada pela referência: o ponto do contorno mais perto do
 * clique (uma das pontas da aresta clicada) e a distância a andar a partir
 * dele, sobre o contorno, para o lado em que o clique foi dado.
 *
 * `lado` é o ponto clicado de verdade. Perto de um canto o clique é preso no
 * canto, e a posição no contorno já não diz de que lado dele se clicou: dos
 * dois lugares possíveis — a distância para um lado e para o outro —, vale o
 * mais perto de `lado`.
 */
export function posicaoPelaReferencia(contorno: Contorno, clique: PosicaoNoContorno, distanciaMm: number, lado: Ponto2D = clique.ponto): PosicaoNoContorno {
  if (!Number.isFinite(distanciaMm) || distanciaMm < 0) throw new Error('A distância do ponto de referência precisa ser zero ou mais.');
  const n = contorno.length;
  const [antes, depois] = [clique.indiceAresta % n, (clique.indiceAresta + 1) % n];
  const referencia = distancia(clique.ponto, contorno[antes]!) <= distancia(clique.ponto, contorno[depois]!) ? antes : depois;
  const doPonto: PosicaoNoContorno = { indiceAresta: referencia, ponto: contorno[referencia]! };
  const [adiante, paraTras] = [andarNoContorno(contorno, doPonto, distanciaMm), andarNoContorno(contorno, doPonto, 0 - distanciaMm)];
  // Com o clique bem em cima do ponto de referência, os dois ficam à mesma distância: vale o do sentido em que a aresta clicada vai.
  const [daFrente, deTras] = [distancia(adiante.ponto, lado), distancia(paraTras.ponto, lado)];
  if (Math.abs(daFrente - deTras) <= MESMO_PONTO_MM) return referencia === antes ? adiante : paraTras;
  return daFrente < deTras ? adiante : paraTras;
}

/** O que o "Inserir" pode fazer a mais ao pôr um pique no contorno. */
export interface ExtrasDoPique {
  readonly codigo?: string;
  readonly naCostura?: 'projetado' | 'estendido';
  /** Põe também um ponto no contorno, onde o pique fica. */
  readonly pontoDeControle?: boolean;
  /** Na peça graduada, o pique fica à mesma distância do ponto de referência em todos os tamanhos. */
  readonly manterDistancia?: boolean;
}

/** Põe um pique com formato no contorno, na posição dada. */
export function inserirPique(molde: Molde, posicao: PosicaoNoContorno, formato: FormatoDePique, id: string, extras: ExtrasDoPique = {}): Molde {
  conferirFormato(formato);
  const noVertice = molde.contorno.some((v) => distancia(v, posicao.ponto) <= MESMO_PONTO_MM);
  const base = extras.pontoDeControle && !noVertice ? inserirPontoNoMolde(molde, posicao.indiceAresta, posicao.ponto) : molde;
  const onde = pontoMaisProximoNoContorno(posicao.ponto, base.contorno);
  // Depois de um ponto posto ali, o pique fica na aresta que começa nele.
  const noPontoNovo = base.contorno.findIndex((v) => distancia(v, posicao.ponto) <= MESMO_PONTO_MM);
  const pique: Pique = {
    id,
    posicao: onde.ponto,
    indiceAresta: noPontoNovo >= 0 ? noPontoNovo : onde.indiceAresta,
    formato,
    ...(extras.codigo ? { codigo: extras.codigo } : {}),
    ...(extras.naCostura ? { naCostura: extras.naCostura } : {}),
  };
  const comPique: Molde = { ...base, piques: [...base.piques, pique] };
  if (!extras.manterDistancia || !comPique.graduacao) return comPique;
  return definirGraduacaoDoPique(comPique, id, referenciaSugerida(comPique, pique), comPique.graduacao.tamanhos.map(() => 0));
}

/** Põe um pique interno (uma marca com formato) no ponto dado, que precisa estar dentro da peça. */
export function inserirPiqueInterno(molde: Molde, posicao: Ponto2D, formato: FormatoDePique, id: string): Molde {
  conferirFormato(formato);
  if (!pontoDentroDoContorno(posicao, molde.contorno)) throw new Error('O pique interno precisa ficar dentro da peça.');
  return { ...molde, marcas: [...molde.marcas, { id, posicao, formato }] };
}

/** O código seguinte na sequência: um a mais que o maior código numérico já usado nos piques do projeto. */
export function proximoCodigo(pecas: readonly Molde[]): string {
  const usados = pecas.flatMap((peca) => peca.piques.map((pique) => Number(pique.codigo))).filter((n) => Number.isInteger(n) && n > 0);
  return String(Math.max(0, ...usados) + 1);
}

/** A marca (o pique interno) a até `raioMm` do ponto: a mais perto. */
export function marcaPerto(molde: Molde, ponto: Ponto2D, raioMm: number): Marca | null {
  let melhor: { readonly marca: Marca; readonly d: number } | null = null;
  for (const marca of molde.marcas) {
    const d = distancia(marca.posicao, ponto);
    if (d <= raioMm && (!melhor || d < melhor.d)) melhor = { marca, d };
  }
  return melhor ? melhor.marca : null;
}

/** A peça sem os piques do contorno, sem os internos (as marcas), ou sem uns e outros. */
export function semOsPiques(molde: Molde, quais: { readonly doContorno: boolean; readonly internos: boolean }): Molde {
  return { ...molde, ...(quais.doContorno ? { piques: [] } : {}), ...(quais.internos ? { marcas: [] } : {}) };
}

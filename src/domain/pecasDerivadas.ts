import {
  areaAssinada,
  deslocarContornoParaFora,
  distancia,
  pontoMaisProximoNoContorno,
  pontoDentroDoContorno,
  retanguloEnvolvente,
  trechoDoContorno,
  trechoMaisCurto,
  type Contorno,
  type Ponto2D,
  type PosicaoNoContorno,
} from '../core/geometria';
import { metadeDoMolde } from './corteEUniao';
import { criarMolde, transladarMolde, type Molde } from './molde';

/**
 * O forro, a entretela e a vista tirados da peça principal (ADR 0124), num comando só:
 *
 * - **a vista** (o revel): a faixa ao longo de um trecho do contorno (o decote, o meio da frente, a cava), com a
 *   largura pedida (ou uma em cada ponta), para dentro da peça; as pontas dela seguem o contorno da peça;
 * - **o forro**: a peça sem essa faixa — encurtada na barra, ou sem a vista;
 * - **a entretela**: a peça inteira recuada em volta (menor que ela, fora da costura), sem a margem de costura.
 *
 * A vista e o forro saem do mesmo corte: a paralela ao trecho, para dentro, levada até o contorno pelas pontas.
 */

export type TipoDePecaDerivada = 'vista' | 'forro' | 'entretela';

export const ROTULO_DA_PECA_DERIVADA: Readonly<Record<TipoDePecaDerivada, string>> = {
  vista: 'Vista',
  forro: 'Forro',
  entretela: 'Entretela',
};

/** O grupo do encaixe de cada uma (ADR 0103): o forro e a entretela vão em outro tecido; a vista, no da peça. */
export const GRUPO_DA_PECA_DERIVADA: Readonly<Record<TipoDePecaDerivada, string | null>> = {
  vista: null,
  forro: 'Forro',
  entretela: 'Entretela',
};

export interface OpcoesDaPecaDerivada {
  readonly tipo: TipoDePecaDerivada;
  /** A vista: a largura no começo do trecho (mm); o forro: quanto a peça encurta no trecho. */
  readonly larguraMm: number;
  /** A vista: a largura no fim do trecho; ausente, a mesma do começo. */
  readonly largura2Mm?: number;
  /** A entretela: o recuo em volta da peça (mm). */
  readonly recuoMm: number;
}

export const OPCOES_PADRAO_DA_PECA_DERIVADA: OpcoesDaPecaDerivada = { tipo: 'vista', larguraMm: 60, recuoMm: 2 };

/** A peça derivada pede o trecho (dois pontos do contorno): a vista e o forro sim; a entretela não. */
export const pedeOTrecho = (tipo: TipoDePecaDerivada): boolean => tipo !== 'entretela';

export function conferirOpcoesDaPecaDerivada(o: OpcoesDaPecaDerivada): void {
  if (pedeOTrecho(o.tipo)) {
    if (!(o.larguraMm > 0)) throw new Error(o.tipo === 'vista' ? 'A largura da vista precisa ser maior que zero.' : 'Quanto o forro encurta precisa ser maior que zero.');
    if (o.largura2Mm !== undefined && !(o.largura2Mm > 0)) throw new Error('A largura do fim da vista precisa ser maior que zero.');
  } else if (!(o.recuoMm >= 0)) throw new Error('O recuo da entretela não pode ser negativo.');
}

const unitario = (de: Ponto2D, para: Ponto2D): Ponto2D => {
  const l = distancia(de, para) || 1;
  return { x: (para.x - de.x) / l, y: (para.y - de.y) / l };
};

/**
 * A paralela ao trecho, para dentro da peça: cada ponto andado para dentro pela largura daquele ponto (de
 * `larguraInicial` a `larguraFinal`, pela distância andada), em esquadria nos cantos.
 */
function paralelaParaDentro(contorno: Contorno, trecho: readonly Ponto2D[], larguraInicial: number, larguraFinal: number): Ponto2D[] {
  // O trecho anda no sentido da numeração dos vértices; para dentro é o lado oposto à normal de fora.
  let assinada = 0;
  for (let i = 0; i < contorno.length; i++) {
    const a = contorno[i]!;
    const b = contorno[(i + 1) % contorno.length]!;
    assinada += a.x * b.y - b.x * a.y;
  }
  const sinal = assinada >= 0 ? 1 : -1;
  const paraDentro = (t: Ponto2D): Ponto2D => ({ x: -t.y * sinal, y: t.x * sinal });
  const tangentes = trecho.slice(1).map((p, i) => unitario(trecho[i]!, p));
  let total = 0;
  for (let i = 1; i < trecho.length; i++) total += distancia(trecho[i - 1]!, trecho[i]!);
  let andado = 0;
  return trecho.map((p, i) => {
    if (i > 0) andado += distancia(trecho[i - 1]!, p);
    const largura = total > 0 ? larguraInicial + ((larguraFinal - larguraInicial) * andado) / total : larguraInicial;
    if (i === 0 || i === trecho.length - 1) {
      const d = paraDentro(tangentes[i === 0 ? 0 : i - 1]!);
      return { x: p.x + d.x * largura, y: p.y + d.y * largura };
    }
    const n1 = paraDentro(tangentes[i - 1]!);
    const n2 = paraDentro(tangentes[i]!);
    const soma = { x: n1.x + n2.x, y: n1.y + n2.y };
    const tamanho = Math.hypot(soma.x, soma.y);
    if (tamanho < 1e-9) return { x: p.x + n1.x * largura, y: p.y + n1.y * largura };
    const bissetriz = { x: soma.x / tamanho, y: soma.y / tamanho };
    const alongamento = Math.min(1 / Math.max(bissetriz.x * n1.x + bissetriz.y * n1.y, 1e-9), 4);
    return { x: p.x + bissetriz.x * largura * alongamento, y: p.y + bissetriz.y * largura * alongamento };
  });
}

/** Onde a semirreta que sai de `p` na direção `d` encontra o contorno primeiro. */
function primeiroEncontro(contorno: Contorno, p: Ponto2D, d: Ponto2D): PosicaoNoContorno | null {
  let melhor: PosicaoNoContorno | null = null;
  let menor = Infinity;
  for (let i = 0; i < contorno.length; i++) {
    const a = contorno[i]!;
    const b = contorno[(i + 1) % contorno.length]!;
    const ex = b.x - a.x;
    const ey = b.y - a.y;
    const den = d.x * ey - d.y * ex;
    if (Math.abs(den) < 1e-12) continue;
    // p + t·d = a + s·e
    const t = ((a.x - p.x) * ey - (a.y - p.y) * ex) / den;
    const s = ((a.x - p.x) * d.y - (a.y - p.y) * d.x) / den;
    // O ponto que já está no contorno (a paralela que começa num canto) é o próprio encontro.
    if (t >= -1e-6 && s >= -1e-9 && s <= 1 + 1e-9 && t < menor) {
      menor = t;
      melhor = { indiceAresta: i, ponto: { x: p.x + d.x * Math.max(0, t), y: p.y + d.y * Math.max(0, t) } };
    }
  }
  return melhor;
}

/**
 * A peça cortada pela paralela ao trecho mais curto entre `a` e `b` (para dentro, na largura dada — `largura2Mm` no
 * outro fim): a parte com o trecho (a vista) e a parte sem ele (o forro). As pontas da paralela vão até o contorno
 * na direção dela.
 */
export function dividirPeloTrecho(
  molde: Molde,
  a: PosicaoNoContorno,
  b: PosicaoNoContorno,
  larguraMm: number,
  largura2Mm: number = larguraMm,
): { readonly comOTrecho: Molde; readonly semOTrecho: Molde } {
  if (distancia(a.ponto, b.ponto) < 1e-6) throw new Error('Indique dois pontos diferentes do contorno.');
  const { de, ate, invertido } = trechoMaisCurto(molde.contorno, a, b);
  // A largura 1 é a do primeiro ponto indicado (`a`), esteja ele no começo ou no fim do trecho.
  const [inicial, final] = invertido ? [largura2Mm, larguraMm] : [larguraMm, largura2Mm];
  const trecho = trechoDoContorno(molde.contorno, de, ate);
  if (trecho.length < 2) throw new Error('Indique dois pontos diferentes do contorno.');
  const linha = paralelaParaDentro(molde.contorno, trecho, inicial, final);
  // Dentro da peça, ou em cima do contorno (a ponta da paralela de um trecho que começa num canto).
  const naPeca = (p: Ponto2D): boolean => pontoDentroDoContorno(p, molde.contorno) || distancia(p, pontoMaisProximoNoContorno(p, molde.contorno).ponto) < 1e-6;
  if (!linha.every(naPeca)) {
    throw new Error('A largura passa da peça nesse trecho: diminua a largura, ou escolha um trecho menor.');
  }
  const inicio = primeiroEncontro(molde.contorno, linha[0]!, unitario(linha[1]!, linha[0]!));
  const fim = primeiroEncontro(molde.contorno, linha.at(-1)!, unitario(linha.at(-2)!, linha.at(-1)!));
  if (!inicio || !fim) throw new Error('A paralela do trecho não encontra o contorno nas pontas: escolha outro trecho.');
  // Um ponto dentro da faixa: o meio entre o trecho e a paralela, no meio do trecho.
  const k = Math.floor(trecho.length / 2);
  const naFaixa =
    trecho.length % 2 === 0 && trecho.length > 2
      ? { x: (trecho[k - 1]!.x + trecho[k]!.x + linha[k - 1]!.x + linha[k]!.x) / 4, y: (trecho[k - 1]!.y + trecho[k]!.y + linha[k - 1]!.y + linha[k]!.y) / 4 }
      : trecho.length === 2
        ? { x: (trecho[0]!.x + trecho[1]!.x + linha[0]!.x + linha[1]!.x) / 4, y: (trecho[0]!.y + trecho[1]!.y + linha[0]!.y + linha[1]!.y) / 4 }
        : { x: (trecho[k]!.x + linha[k]!.x) / 2, y: (trecho[k]!.y + linha[k]!.y) / 2 };
  // A ponta da paralela que já está no contorno é a própria ponta do corte (não se repete no meio dele).
  const miolo = linha.filter((p, i) => !((i === 0 && distancia(p, inicio.ponto) < 1e-6) || (i === linha.length - 1 && distancia(p, fim.ponto) < 1e-6)));
  return {
    comOTrecho: metadeDoMolde(molde, inicio, fim, naFaixa, 'fica', miolo),
    semOTrecho: metadeDoMolde(molde, inicio, fim, naFaixa, 'sai', miolo),
  };
}

/** A entretela: o contorno da peça recuado em volta, sem a costura nem as marcações (vai fundida por dentro). */
export function entretelaDoMolde(molde: Molde, recuoMm: number, novoId: string): Molde {
  const contorno = recuoMm > 0 ? deslocarContornoParaFora(molde.contorno, -recuoMm) : molde.contorno;
  const caixa = retanguloEnvolvente(contorno);
  // Recuado demais, o contorno vira do avesso (o deslocado sai com a área positiva; do avesso, negativa) ou sai da peça.
  const virou = recuoMm > 0 && areaAssinada(contorno) <= 0;
  if (virou || caixa.largura <= 0 || caixa.altura <= 0 || contorno.some((p) => !pontoDentroDoContorno(p, molde.contorno) && recuoMm > 0)) {
    throw new Error('O recuo é grande demais para a peça.');
  }
  const base = criarMolde(
    {
      nome: `${ROTULO_DA_PECA_DERIVADA.entretela} de ${molde.nome}`,
      referencia: molde.referencia,
      tamanho: molde.tamanho,
      quantidade: molde.quantidade,
      contorno,
      linhaDeFio: molde.linhaDeFio,
      margemDeCosturaMm: 0,
      restricaoDeRotacao: molde.restricaoDeRotacao,
    },
    novoId,
  );
  return { ...base, ...(molde.emPar ? { emPar: true as const } : {}), grupoDoEncaixe: GRUPO_DA_PECA_DERIVADA.entretela! };
}

/**
 * A peça nova levada para a direita (o y do mundo) até não ficar em cima de nenhuma das outras: a vista e a entretela
 * da mesma peça, uma depois da outra, não se sobrepõem.
 */
export function aoLadoSemSobrepor(nova: Molde, outras: readonly Molde[], folgaMm = 40): Molde {
  let atual = nova;
  for (let volta = 0; volta < outras.length + 1; volta++) {
    const c = retanguloEnvolvente(atual.contorno);
    const embaixo = outras.filter((o) => {
      const d = retanguloEnvolvente(o.contorno);
      return c.minX < d.maxX && c.maxX > d.minX && c.minY < d.maxY && c.maxY > d.minY;
    });
    if (embaixo.length === 0) return atual;
    const alem = Math.max(...embaixo.map((o) => retanguloEnvolvente(o.contorno).maxY)) + folgaMm;
    atual = transladarMolde(atual, { x: 0, y: alem - c.minY }, atual.id);
  }
  return atual;
}

/**
 * A peça derivada, pronta para entrar no projeto: com o nome ("Vista de Frente"), o grupo do encaixe e posta ao lado
 * da peça principal (para não ficar em cima dela na mesa).
 */
export function pecaDerivada(molde: Molde, opcoes: OpcoesDaPecaDerivada, trecho: { readonly a: PosicaoNoContorno; readonly b: PosicaoNoContorno } | null, novoId: string): Molde {
  conferirOpcoesDaPecaDerivada(opcoes);
  let nova: Molde;
  if (opcoes.tipo === 'entretela') nova = entretelaDoMolde(molde, opcoes.recuoMm, novoId);
  else {
    if (!trecho) throw new Error(`Indique o trecho ${opcoes.tipo === 'vista' ? 'da vista' : 'que o forro encurta'} no contorno da peça.`);
    const partes = dividirPeloTrecho(molde, trecho.a, trecho.b, opcoes.larguraMm, opcoes.tipo === 'vista' ? opcoes.largura2Mm : undefined);
    const parte = opcoes.tipo === 'vista' ? partes.comOTrecho : partes.semOTrecho;
    const grupo = GRUPO_DA_PECA_DERIVADA[opcoes.tipo];
    const semGrupo: Molde = { ...parte };
    if (!grupo) delete (semGrupo as { grupoDoEncaixe?: string }).grupoDoEncaixe;
    nova = { ...semGrupo, id: novoId, nome: `${ROTULO_DA_PECA_DERIVADA[opcoes.tipo]} de ${molde.nome}`, ...(grupo ? { grupoDoEncaixe: grupo } : molde.grupoDoEncaixe ? { grupoDoEncaixe: molde.grupoDoEncaixe } : {}) };
  }
  // Ao lado da peça principal (na tela, à direita: o y do mundo).
  const daPeca = retanguloEnvolvente(molde.contorno);
  const daNova = retanguloEnvolvente(nova.contorno);
  return transladarMolde(nova, { x: daPeca.minX - daNova.minX, y: daPeca.maxY + 40 - daNova.minY }, novoId);
}

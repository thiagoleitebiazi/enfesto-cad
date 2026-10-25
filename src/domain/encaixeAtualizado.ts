import { espelharMolde, rotacionarMolde, transladarMolde, type Molde } from './molde';
import type { PecaColocada } from './nesting';
import { areaAssinada, distancia, rotacionar, somar, subtrair, type Ponto2D } from '../core/geometria';

/**
 * O encaixe ligado ao molde: o encaixe calculado com as peças de um momento, aplicado depois que elas mudaram, põe
 * na mesa as peças de agora, cada uma no lugar e na posição (giro, espelho) em que o encaixe pôs a de então.
 */

/** Dois pontos a menos disso (mm) são o mesmo: a peça que só andou não mudou. */
const MESMO_PONTO_MM = 0.01;

/** Um movimento da peça: o espelho (o x do mundo troca de sinal), o giro, e para onde vai cada ponto. */
export interface MovimentoDaPeca {
  readonly espelhar: boolean;
  readonly anguloGraus: number;
  readonly levar: (p: Ponto2D) => Ponto2D;
}

const espelhoDe = (espelhar: boolean) => (p: Ponto2D): Ponto2D => (espelhar ? { x: -p.x, y: p.y } : p);

/** O movimento que leva `a0` a `b0` e a direção de `a0` a `a1` à de `b0` a `b1`. */
function movimentoPelosPontos(a0: Ponto2D, a1: Ponto2D, b0: Ponto2D, b1: Ponto2D, espelhar: boolean): MovimentoDaPeca {
  const espelho = espelhoDe(espelhar);
  const v = espelho(subtrair(a1, a0));
  const V = subtrair(b1, b0);
  const anguloGraus = ((Math.atan2(V.y, V.x) - Math.atan2(v.y, v.x)) * 180) / Math.PI;
  return { espelhar, anguloGraus, levar: (p) => somar(b0, rotacionar(espelho(subtrair(p, a0)), { x: 0, y: 0 }, anguloGraus)) };
}

/**
 * O movimento que leva uma peça à outra, quando a outra é ela andada, girada ou espelhada. O encaixe (e o Mover, o
 * Girar e o Espelhar do projeto) leva a peça ponto a ponto, sem mudar a ordem dos pontos do contorno: o primeiro ponto
 * e o mais longe dele dão o giro, e todos os pontos conferem. `null` quando o contorno não é o mesmo.
 */
export function movimentoDaPeca(de: Molde, para: Molde): MovimentoDaPeca | null {
  const a = de.contorno;
  const b = para.contorno;
  if (a.length < 3 || a.length !== b.length) return null;
  let longe = 0;
  for (let k = 1; k < a.length; k++) if (distancia(a[k]!, a[0]!) > distancia(a[longe]!, a[0]!)) longe = k;
  if (distancia(a[longe]!, a[0]!) <= MESMO_PONTO_MM) return null;
  let melhor: { readonly movimento: MovimentoDaPeca; readonly erro: number } | null = null;
  for (const espelhar of [false, true]) {
    const movimento = movimentoPelosPontos(a[0]!, a[longe]!, b[0]!, b[longe]!, espelhar);
    const erro = Math.max(...a.map((p, k) => distancia(movimento.levar(p), b[k]!)));
    if (!melhor || erro < melhor.erro) melhor = { movimento, erro };
  }
  return melhor && melhor.erro <= MESMO_PONTO_MM ? melhor.movimento : null;
}

/** A peça levada pelo movimento, com o id dado: o espelho, o giro e o lugar, pelas mesmas contas do encaixe. */
function pecaMovida(m: Molde, movimento: MovimentoDaPeca, id: string): Molde {
  const espelhada = movimento.espelhar ? espelharMolde(m, m.id) : m;
  const girada = Math.abs(movimento.anguloGraus) < 1e-9 ? espelhada : rotacionarMolde(espelhada, movimento.anguloGraus);
  return transladarMolde(girada, subtrair(movimento.levar(m.contorno[0]!), girada.contorno[0]!), id);
}

/**
 * Como a peça de agora está no projeto em relação à de então — para que mover a peça no projeto depois do encaixe não
 * a tire do lugar no encaixe:
 * - o contorno é o mesmo, andado, girado ou espelhado: esse movimento;
 * - o contorno mudou, e a linha de fio só andou ou girou (o tamanho dela é o mesmo): o movimento do fio — o espelho
 *   pelo sentido do contorno, que o Espelhar troca;
 * - o fio também mudou: a peça mudou onde estava (nenhum movimento).
 */
function movimentoNoProjeto(deEntao: Molde, deAgora: Molde): MovimentoDaPeca | null {
  const peloContorno = movimentoDaPeca(deEntao, deAgora);
  if (peloContorno) return peloContorno;
  const fio = (m: Molde): number => distancia(m.linhaDeFio.inicio, m.linhaDeFio.fim);
  if (fio(deEntao) <= MESMO_PONTO_MM || Math.abs(fio(deEntao) - fio(deAgora)) > MESMO_PONTO_MM) return null;
  const espelhar = Math.sign(areaAssinada(deEntao.contorno)) !== Math.sign(areaAssinada(deAgora.contorno));
  return movimentoPelosPontos(deEntao.linhaDeFio.inicio, deEntao.linhaDeFio.fim, deAgora.linhaDeFio.inicio, deAgora.linhaDeFio.fim, espelhar);
}

/** O movimento que desfaz outro. */
function inverso(movimento: MovimentoDaPeca, referencia: Ponto2D): MovimentoDaPeca {
  const b0 = movimento.levar(referencia);
  const b1 = movimento.levar(somar(referencia, { x: 0, y: 100 }));
  return movimentoPelosPontos(b0, b1, referencia, somar(referencia, { x: 0, y: 100 }), movimento.espelhar);
}

/**
 * A peça de agora no encaixe: levada de volta ao lugar da de então no projeto (se andou, girou ou foi espelhada lá) e
 * dali pelo movimento que o encaixe deu à de então. Fica com o id da posta e o giro acumulado dela: a peça de agora
 * fica na mesma posição da posta, e o giro conta para as rotações permitidas e o alto da estampa.
 */
export function pecaLevada(deAgora: Molde, deEntao: Molde, posta: Molde, movimentoDoEncaixe: MovimentoDaPeca): Molde {
  const noProjeto = movimentoNoProjeto(deEntao, deAgora);
  const deVolta = noProjeto ? pecaMovida(deAgora, inverso(noProjeto, deEntao.contorno[0]!), deAgora.id) : deAgora;
  return { ...pecaMovida(deVolta, movimentoDoEncaixe, posta.id), quantidade: 1, anguloDeRotacaoGraus: posta.anguloDeRotacaoGraus };
}

/** Os pontos da peça que andam com ela: se todos ficaram no mesmo lugar (e o nome e a costura são os mesmos), ela não mudou. */
function pontosDaPeca(m: Molde): Ponto2D[] {
  return [
    ...m.contorno,
    ...m.linhasInternas.flat(),
    ...m.furos.flat(),
    ...m.piques.map((p) => p.posicao),
    ...m.marcas.map((k) => k.posicao),
    m.linhaDeFio.inicio,
    m.linhaDeFio.fim,
  ];
}

function mesmaPeca(a: Molde, b: Molde): boolean {
  if (a.nome !== b.nome || a.margemDeCosturaMm !== b.margemDeCosturaMm) return false;
  const pa = pontosDaPeca(a);
  const pb = pontosDaPeca(b);
  return pa.length === pb.length && pa.every((p, k) => distancia(p, pb[k]!) <= MESMO_PONTO_MM);
}

export interface EncaixeComOMoldeDeAgora {
  /** As peças para a mesa: as do encaixe, cada uma com o molde de agora, no lugar e na posição em que o encaixe a pôs. */
  readonly pecas: readonly Molde[];
  /** As peças que entraram com o molde de agora (a forma, os piques, as marcações, o nome ou a costura mudaram). */
  readonly atualizadas: readonly string[];
  /** As peças (ou cópias) do encaixe que saíram do projeto: ficam fora da mesa. */
  readonly foraDoProjeto: readonly string[];
  /** As que ficaram como no encaixe: o nome repetido não diz qual é a de agora, ou o contorno não deu o movimento. */
  readonly comoNoEncaixe: readonly string[];
  /** As do projeto que o encaixe não tem (novas, ou cópias a mais): pedem um encaixe novo. */
  readonly foraDoEncaixe: readonly string[];
  /** As peças novas, como estão no projeto: continuam nele, fora do encaixe. */
  readonly novas: readonly Molde[];
}

/**
 * A peça de agora de cada peça de então: pelo id e, sem ele, pelo nome e o tamanho que só uma tem (`'repetido'`: o
 * nome não diz qual). Com todos os tamanhos, cada tamanho é uma peça de id novo, com o nome da graduada.
 */
function correspondentes(deEntao: readonly Molde[], deAgora: readonly Molde[]): Map<string, Molde | 'repetido'> {
  const porId = new Map(deAgora.map((m) => [m.id, m]));
  const usadas = new Set(deEntao.filter((e) => porId.has(e.id)).map((e) => e.id));
  const chave = (m: Molde): string => `${m.nome} | ${m.tamanho}`;
  const contar = (lista: readonly Molde[], k: string): number => lista.filter((m) => chave(m) === k).length;
  const resultado = new Map<string, Molde | 'repetido'>();
  for (const e of deEntao) {
    const peloId = porId.get(e.id);
    if (peloId) {
      resultado.set(e.id, peloId);
      continue;
    }
    const livres = deAgora.filter((m) => chave(m) === chave(e) && !usadas.has(m.id));
    if (livres.length === 1 && contar(deEntao, chave(e)) === 1) {
      resultado.set(e.id, livres[0]!);
      usadas.add(livres[0]!.id);
    } else if (livres.length > 0) {
      resultado.set(e.id, 'repetido');
    }
  }
  return resultado;
}

/**
 * As peças do encaixe com o molde de agora. `deEntao` são as peças que o encaixe recebeu; `deAgora`, as mesmas
 * preparadas agora (com os tamanhos e as simetrias abertas como no encaixe). A peça que não mudou fica como o
 * encaixe a pôs; a que mudou entra no lugar dela, pelo mesmo movimento — e pode passar da vizinha ou da mesa, o que
 * a validação diz.
 */
export function encaixeComOMoldeDeAgora(
  colocadas: readonly PecaColocada[],
  deEntao: readonly Molde[],
  deAgora: readonly Molde[],
): EncaixeComOMoldeDeAgora {
  const entaoPorId = new Map(deEntao.map((m) => [m.id, m]));
  const agoraDe = correspondentes(deEntao, deAgora);
  const pecas: Molde[] = [];
  const atualizadas = new Set<string>();
  const foraDoProjeto: string[] = [];
  const comoNoEncaixe = new Set<string>();
  for (const posta of colocadas) {
    const entao = entaoPorId.get(posta.idOriginal);
    const agora = agoraDe.get(posta.idOriginal);
    if (!entao || agora === 'repetido') {
      pecas.push(posta.molde);
      if (agora === 'repetido') comoNoEncaixe.add(posta.molde.nome);
      continue;
    }
    if (!agora) {
      foraDoProjeto.push(posta.molde.nome);
      continue;
    }
    if (posta.indiceCopia >= agora.quantidade) {
      foraDoProjeto.push(`${agora.nome} (cópia ${posta.indiceCopia + 1})`);
      continue;
    }
    if (JSON.stringify(entao) === JSON.stringify(agora)) {
      pecas.push(posta.molde);
      continue;
    }
    const movimento = movimentoDaPeca(entao, posta.molde);
    if (!movimento) {
      pecas.push(posta.molde);
      comoNoEncaixe.add(posta.molde.nome);
      continue;
    }
    const levada = pecaLevada(agora, entao, posta.molde, movimento);
    if (mesmaPeca(levada, posta.molde)) {
      // Só andou no projeto depois do encaixe: fica como o encaixe a pôs.
      pecas.push(posta.molde);
    } else {
      pecas.push(levada);
      atualizadas.add(agora.nome);
    }
  }
  const foraDoEncaixe: string[] = [];
  const novas: Molde[] = [];
  for (const agora of deAgora) {
    const entao = deEntao.find((e) => agoraDe.get(e.id) === agora);
    // A de nome repetido não é dada como nova: ficou como no encaixe, e isso já é dito.
    const repetida = deEntao.some((e) => agoraDe.get(e.id) === 'repetido' && e.nome === agora.nome && e.tamanho === agora.tamanho);
    if (!entao) {
      if (!repetida) {
        foraDoEncaixe.push(agora.nome);
        novas.push(agora);
      }
      continue;
    }
    const mais = agora.quantidade - entao.quantidade;
    if (mais > 0) foraDoEncaixe.push(`${agora.nome} (${mais} cópia${mais > 1 ? 's' : ''} a mais)`);
  }
  return { pecas, atualizadas: [...atualizadas], foraDoProjeto, comoNoEncaixe: [...comoNoEncaixe], foraDoEncaixe, novas };
}

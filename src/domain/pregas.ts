import {
  area,
  areaAssinada,
  distancia,
  pontoDentroDoContorno,
  pontoMaisProximoNoContorno,
  trechoDoContorno,
  type Contorno,
  type Ponto2D,
  type PosicaoNoContorno,
} from '../core/geometria';
import { exigirCorteValido } from './corteEUniao';
import { piquesQueFicamNoContorno, semCampo, type Molde, type Pique, type PregaDaPeca } from './molde';
import {
  comecarPeloMenorPontoOriginal,
  distanciaAteALinha,
  giroEDeslocamento,
  levarOQueEstaNaRegiao,
  regiaoQueAnda,
  semPontosRepetidos,
  type Transformacao,
} from './regioes';

/**
 * "Pregas" (aba Produção): a peça é cortada pela linha da prega, de um ponto
 * do contorno a outro, e os dois lados se afastam o tanto de tecido que a
 * prega consome — duas larguras na prega simples, quatro na dupla. O espaço
 * aberto vira tecido da peça, com as linhas de dobra desenhadas.
 */
export type ModoDePrega = 'simples-direita' | 'simples-esquerda' | 'dupla';

export interface OpcoesDePregas {
  readonly modo: ModoDePrega;
  /** Quantas pregas, paralelas. */
  readonly quantidade: number;
  /** Distância entre uma prega e a seguinte, medida na peça antes de abrir (mm). Só conta com mais de uma prega. */
  readonly distanciaMm: number;
  /** Largura da prega (a profundidade da dobra) no primeiro ponto indicado (mm). */
  readonly larguraMm: number;
  /** Largura no segundo ponto (mm); ausente, vale a do primeiro. */
  readonly largura2Mm?: number;
  /** Um pique em cada ponta de cada linha de dobra. */
  readonly piques: boolean;
}

export const MAXIMO_DE_PREGAS = 20;

const MESMO_PONTO_MM = 1e-6;
/** A seta que mostra para onde a prega dobra tem, no máximo, esta ponta (mm). */
const PONTA_DA_SETA_MM = 6;

function ponto(x: number, y: number): Ponto2D {
  return { x, y };
}

function entre(a: Ponto2D, b: Ponto2D, k: number): Ponto2D {
  return ponto(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k);
}

/** Recusa as opções que não dão uma prega. */
export function conferirOpcoesDePregas(opcoes: OpcoesDePregas): void {
  const { quantidade } = opcoes;
  if (!Number.isInteger(quantidade) || quantidade < 1 || quantidade > MAXIMO_DE_PREGAS) {
    throw new Error(`O número de pregas precisa ser um inteiro de 1 a ${MAXIMO_DE_PREGAS}.`);
  }
  if (![opcoes.larguraMm, opcoes.largura2Mm ?? opcoes.larguraMm].every((l) => Number.isFinite(l) && l > 0)) {
    throw new Error('A largura da prega precisa ser maior que zero.');
  }
  if (quantidade > 1 && (!Number.isFinite(opcoes.distanciaMm) || !(opcoes.distanciaMm > 0))) {
    throw new Error('A distância entre as pregas precisa ser maior que zero.');
  }
}

/** Quantas larguras de tecido a prega consome: duas na simples, quatro na dupla. */
function largurasConsumidas(modo: ModoDePrega): number {
  return modo === 'dupla' ? 4 : 2;
}

/**
 * Os dois pontos em que a reta (por `origem`, na direção `direcao`) atravessa
 * o contorno, na ordem da direção. Recusa a reta que não cruza a peça de um
 * lado a outro de uma vez só.
 */
function retaAtravessandoAPeca(contorno: Contorno, origem: Ponto2D, direcao: Ponto2D, numeroDaPrega: number): [Ponto2D, Ponto2D] {
  const ladoDe = (p: Ponto2D): number => direcao.x * (p.y - origem.y) - direcao.y * (p.x - origem.x);
  const cruzamentos: Ponto2D[] = [];
  const acrescentar = (p: Ponto2D): void => {
    if (!cruzamentos.some((c) => distancia(c, p) < MESMO_PONTO_MM)) cruzamentos.push(p);
  };
  contorno.forEach((p, i) => {
    const q = contorno[(i + 1) % contorno.length]!;
    const lp = ladoDe(p);
    const lq = ladoDe(q);
    if (Math.abs(lp) < MESMO_PONTO_MM) acrescentar(p);
    else if (Math.abs(lq) >= MESMO_PONTO_MM && lp > 0 !== lq > 0) acrescentar(entre(p, q, lp / (lp - lq)));
  });
  if (cruzamentos.length !== 2) {
    throw new Error(`A prega ${numeroDaPrega} não atravessa a peça de um lado ao outro de uma vez só: diminua a distância ou o número de pregas.`);
  }
  const aoLongo = (p: Ponto2D): number => (p.x - origem.x) * direcao.x + (p.y - origem.y) * direcao.y;
  const [c0, c1] = cruzamentos as [Ponto2D, Ponto2D];
  return aoLongo(c0) <= aoLongo(c1) ? [c0, c1] : [c1, c0];
}

/** Uma seta desenhada como linha: a haste e as duas farpas da ponta. */
function seta(de: Ponto2D, ate: Ponto2D): Ponto2D[] {
  const comprimento = distancia(de, ate);
  if (comprimento < MESMO_PONTO_MM) return [de, ate];
  const u = ponto((ate.x - de.x) / comprimento, (ate.y - de.y) / comprimento);
  const farpa = Math.min(comprimento / 3, PONTA_DA_SETA_MM);
  const base = ponto(ate.x - u.x * farpa, ate.y - u.y * farpa);
  const lado = ponto((-u.y * farpa) / 2, (u.x * farpa) / 2);
  return [de, ate, ponto(base.x + lado.x, base.y + lado.y), ate, ponto(base.x - lado.x, base.y - lado.y)];
}

function posicaoNoContorno(contorno: Contorno, p: Ponto2D): PosicaoNoContorno {
  const maisProximo = pontoMaisProximoNoContorno(p, contorno);
  if (maisProximo.distancia > 1e-4) throw new Error('A linha da prega precisa começar e terminar no contorno da peça.');
  return { indiceAresta: maisProximo.indiceAresta, ponto: maisProximo.ponto };
}

interface PregaAplicada {
  readonly molde: Molde;
  /** O movimento do lado que andou e a região (na peça de antes) que ele levou. */
  readonly movimento: Transformacao;
  readonly regiao: Contorno;
}

/** Abre uma prega na reta de `a` a `b` (pontos do contorno da peça). */
function abrirUmaPrega(molde: Molde, a: Ponto2D, b: Ponto2D, opcoes: OpcoesDePregas, novoId: () => string): PregaAplicada {
  const contorno = molde.contorno;
  const comprimento = distancia(a, b);
  if (comprimento < MESMO_PONTO_MM) throw new Error('A linha da prega precisa de dois pontos diferentes do contorno.');
  try {
    exigirCorteValido(molde, a, b);
  } catch {
    throw new Error('A linha da prega precisa atravessar a peça por dentro, de um ponto do contorno a outro.');
  }
  const partes = largurasConsumidas(opcoes.modo);
  const aberturaEmA = partes * opcoes.larguraMm;
  const aberturaEmB = partes * (opcoes.largura2Mm ?? opcoes.larguraMm);
  if (Math.abs(aberturaEmB - aberturaEmA) >= comprimento) {
    throw new Error('A diferença entre as duas larguras é grande demais para o comprimento da prega.');
  }
  const d = ponto((b.x - a.x) / comprimento, (b.y - a.y) / comprimento);
  const esquerda = ponto(-d.y, d.x);
  const direita = ponto(d.y, -d.x);

  const posA = posicaoNoContorno(contorno, a);
  const posB = posicaoNoContorno(contorno, b);
  const cadeias = [trechoDoContorno(contorno, posA, posB), trechoDoContorno(contorno, posB, posA)] as const;
  const anda = regiaoQueAnda(molde, cadeias[0], cadeias[1]);
  // Num contorno anti-horário, a região 0 (de `a` a `b`, andando no contorno) fica à direita de quem vai de `a` para `b`.
  const andaParaAEsquerda = (anda === 0) !== areaAssinada(contorno) >= 0;
  const paraFora = andaParaAEsquerda ? esquerda : direita;
  // O lado que anda afasta-se `aberturaEmA` em `a` e gira o que falta para chegar a `aberturaEmB` em `b`.
  const giro = (Math.asin(((aberturaEmB - aberturaEmA) / comprimento) * (andaParaAEsquerda ? 1 : -1)) * 180) / Math.PI;
  const movimento = giroEDeslocamento(a, giro, ponto(paraFora.x * aberturaEmA, paraFora.y * aberturaEmA));
  const a2 = movimento.ponto(a);
  const b2 = movimento.ponto(b);

  const novoContorno = comecarPeloMenorPontoOriginal(
    semPontosRepetidos([...cadeias[1 - anda]!, ...cadeias[anda].map(movimento.ponto)]),
    contorno,
  );
  // Linhas de dobra: as duas bordas da abertura e as que a repartem em larguras iguais.
  const linhas: Contorno[] = Array.from({ length: partes + 1 }, (_, j) => [entre(a, a2, j / partes), entre(b, b2, j / partes)]);
  // Setas no meio da prega: para onde o tecido dobra.
  const meioParado = entre(a, b, 0.5);
  const meioQueAndou = entre(a2, b2, 0.5);
  const noMeio = (k: number): Ponto2D => entre(meioParado, meioQueAndou, k);
  const andouParaADireita = paraFora.x * direita.x + paraFora.y * direita.y > 0;
  const setas: Contorno[] =
    opcoes.modo === 'dupla'
      ? [seta(noMeio(0.125), noMeio(0.375)), seta(noMeio(0.875), noMeio(0.625))]
      : (opcoes.modo === 'simples-direita') === andouParaADireita
        ? [seta(noMeio(0.25), noMeio(0.75))]
        : [seta(noMeio(0.75), noMeio(0.25))];

  const base = levarOQueEstaNaRegiao(molde, cadeias[anda], cadeias[anda], cadeias[1 - anda]!, movimento);
  const novos: Pique[] = opcoes.piques
    ? linhas.flatMap((linha) =>
        linha.map((p) => {
          const noContorno = pontoMaisProximoNoContorno(p, novoContorno);
          return { id: novoId(), posicao: noContorno.ponto, indiceAresta: noContorno.indiceAresta };
        }),
      )
    : [];
  const jaEraPonto = (p: Ponto2D): boolean => contorno.some((v) => distancia(v, p) <= NO_MESMO_LUGAR_MM);
  // A prega fica registrada: as duas bordas da abertura e as linhas que desenhou, para mudar as larguras ou tirá-la depois.
  const registro: PregaDaPeca = {
    id: novoId(),
    modo: opcoes.modo,
    parada: [a, b],
    movida: [a2, b2],
    linhas: [...linhas, ...setas],
    pontasCriadas: [!jaEraPonto(a), !jaEraPonto(b)],
    ...(novos.length > 0 ? { piques: novos.map((q) => q.id) } : {}),
  };
  const aberta: Molde = {
    ...base,
    contorno: novoContorno,
    linhasInternas: [...base.linhasInternas, ...linhas, ...setas],
    piques: [...piquesQueFicamNoContorno(base.piques, novoContorno), ...novos],
  };
  return {
    molde: { ...aberta, pregas: [...pregasDaPeca(aberta), registro] },
    movimento,
    regiao: cadeias[anda],
  };
}

/**
 * Abre as pregas pedidas. A primeira fica na reta de `a` a `b`; as outras,
 * paralelas a ela, a cada `distanciaMm`, do lado do ponto `lado` (só é
 * preciso com mais de uma prega). O lado da peça que tem a linha de fio fica
 * parado, e o outro anda.
 */
export function criarPregas(
  molde: Molde,
  a: PosicaoNoContorno,
  b: PosicaoNoContorno,
  opcoes: OpcoesDePregas,
  lado: Ponto2D | null,
  novoId: () => string,
): Molde {
  conferirOpcoesDePregas(opcoes);
  const comprimento = distancia(a.ponto, b.ponto);
  if (comprimento < MESMO_PONTO_MM) throw new Error('A linha da prega precisa de dois pontos diferentes do contorno.');
  const d = ponto((b.ponto.x - a.ponto.x) / comprimento, (b.ponto.y - a.ponto.y) / comprimento);
  const retas: Array<[Ponto2D, Ponto2D]> = [[a.ponto, b.ponto]];
  if (opcoes.quantidade > 1) {
    if (!lado) throw new Error('Clique do lado em que as outras pregas devem ficar.');
    const paraAEsquerda = -d.y * (lado.x - a.ponto.x) + d.x * (lado.y - a.ponto.y);
    if (Math.abs(paraAEsquerda) < MESMO_PONTO_MM) {
      throw new Error('Clique fora da linha da prega, do lado em que as outras devem ficar.');
    }
    const sinal = paraAEsquerda > 0 ? 1 : -1;
    for (let i = 1; i < opcoes.quantidade; i++) {
      const afastamento = i * opcoes.distanciaMm * sinal;
      const origem = ponto(a.ponto.x - d.y * afastamento, a.ponto.y + d.x * afastamento);
      retas.push(retaAtravessandoAPeca(molde.contorno, origem, d, i + 1));
    }
  }
  let atual = molde;
  for (let i = 0; i < retas.length; i++) {
    const [de, ate] = retas[i]!;
    const aplicada = abrirUmaPrega(atual, de, ate, opcoes, novoId);
    atual = aplicada.molde;
    // As retas seguintes que estão no lado que andou vão junto com ele.
    for (let j = i + 1; j < retas.length; j++) {
      const [p, q] = retas[j]!;
      if (pontoDentroDoContorno(entre(p, q, 0.5), aplicada.regiao)) retas[j] = [aplicada.movimento.ponto(p), aplicada.movimento.ponto(q)];
    }
  }
  return atual;
}

// ---------------------------------------------------------------------------
// As pregas registradas na peça
// ---------------------------------------------------------------------------

const NO_MESMO_LUGAR_MM = 1e-6;
const AREA_MINIMA_MM2 = 1e-6;

function mesmoLugar(p: Ponto2D, q: Ponto2D): boolean {
  return distancia(p, q) <= NO_MESMO_LUGAR_MM;
}

/** A linha é a mesma sequência de pontos, num sentido ou no outro. */
function mesmaLinha(linha: readonly Ponto2D[], pontos: readonly Ponto2D[]): boolean {
  if (linha.length !== pontos.length) return false;
  return linha.every((p, i) => mesmoLugar(p, pontos[i]!)) || linha.every((p, i) => mesmoLugar(p, pontos[pontos.length - 1 - i]!));
}

/**
 * Onde as quatro pontas da prega estão no contorno, e se o lado que andou
 * vem depois da ponta parada na numeração (`adiante`). `null` se as pontas
 * já não estão no contorno como foram postas: cada parada vizinha da movida.
 */
function pontasNoContorno(
  contorno: Contorno,
  prega: PregaDaPeca,
): { readonly a: number; readonly a2: number; readonly b: number; readonly b2: number; readonly adiante: boolean } | null {
  const n = contorno.length;
  const indiceDe = (p: Ponto2D): number => contorno.findIndex((v) => mesmoLugar(v, p));
  const [a, a2, b, b2] = [indiceDe(prega.parada[0]), indiceDe(prega.movida[0]), indiceDe(prega.parada[1]), indiceDe(prega.movida[1])];
  if (a < 0 || a2 < 0 || b < 0 || b2 < 0) return null;
  if (a2 === (a + 1) % n && b === (b2 + 1) % n) return { a, a2, b, b2, adiante: true };
  if (a === (a2 + 1) % n && b2 === (b + 1) % n) return { a, a2, b, b2, adiante: false };
  return null;
}

function pregaEstaNaPeca(molde: Molde, prega: PregaDaPeca): boolean {
  if (!pontasNoContorno(molde.contorno, prega)) return false;
  // Cada linha da prega tem a sua linha interna (uma para cada, sem repetir).
  const livres = [...molde.linhasInternas];
  return prega.linhas.every((linha) => {
    const onde = livres.findIndex((l) => mesmaLinha(l, linha));
    if (onde < 0) return false;
    livres.splice(onde, 1);
    return true;
  });
}

/** As pregas registradas que continuam na peça como foram postas. */
export function pregasDaPeca(molde: Molde): PregaDaPeca[] {
  return (molde.pregas ?? []).filter((prega) => pregaEstaNaPeca(molde, prega));
}

/** A peça sem os registros de prega que deixaram de valer (as bordas ou as linhas deles mudaram). */
export function comPregasValidas(molde: Molde): Molde {
  if (!molde.pregas) return molde;
  const validas = pregasDaPeca(molde);
  if (validas.length === 0) return semCampo(molde, 'pregas');
  return validas.length === molde.pregas.length ? molde : { ...molde, pregas: validas };
}

/** A faixa de tecido que a prega abriu: as duas pontas paradas e as duas que andaram, em volta. */
export function faixaDaPrega(prega: PregaDaPeca): Ponto2D[] {
  return [prega.parada[0], prega.parada[1], prega.movida[1], prega.movida[0]];
}

/** A prega registrada em que o ponto está (dentro da faixa dela) ou de que está mais perto, a até `raioMm`. */
export function pregaPerto(molde: Molde, p: Ponto2D, raioMm: number): PregaDaPeca | null {
  let melhor: { prega: PregaDaPeca; distancia: number } | null = null;
  for (const prega of pregasDaPeca(molde)) {
    const faixa = faixaDaPrega(prega);
    const d = pontoDentroDoContorno(p, faixa) ? 0 : distanciaAteALinha(p, [...faixa, faixa[0]!]);
    if (d <= raioMm && (!melhor || d < melhor.distancia)) melhor = { prega, distancia: d };
  }
  return melhor ? melhor.prega : null;
}

export interface MedidasDaPrega {
  readonly modo: ModoDePrega;
  /** A largura (a profundidade da dobra) na primeira ponta da linha da prega (mm). */
  readonly larguraMm: number;
  /** A largura na segunda ponta (mm). */
  readonly largura2Mm: number;
}

/** As medidas de uma prega registrada, lidas das bordas dela. */
export function medidasDaPrega(prega: PregaDaPeca): MedidasDaPrega {
  const [a, b] = prega.parada;
  const [a2, b2] = prega.movida;
  const partes = largurasConsumidas(prega.modo);
  const comprimento = distancia(a, b);
  // Em `b`, a abertura conta em esquadro com a linha da prega: o lado que andou pode ter girado.
  const emB = comprimento < MESMO_PONTO_MM ? distancia(b, b2) : Math.abs((b.x - a.x) * (b2.y - a.y) - (b.y - a.y) * (b2.x - a.x)) / comprimento;
  return { modo: prega.modo, larguraMm: distancia(a, a2) / partes, largura2Mm: emB / partes };
}

function pregaRegistrada(molde: Molde, id: string): PregaDaPeca {
  const prega = pregasDaPeca(molde).find((q) => q.id === id);
  if (!prega) throw new Error('Essa prega foi mexida à mão e já não pode ser mudada pelas medidas.');
  return prega;
}

/**
 * A peça sem a prega: o lado que andou volta para junto do outro, levando o
 * que está nele, e as linhas de dobra, as setas e os piques da prega saem. As
 * pontas que a prega tinha posto no contorno saem também.
 */
export function removerPrega(molde: Molde, id: string): Molde {
  const prega = pregaRegistrada(molde, id);
  const contorno = molde.contorno;
  const onde = pontasNoContorno(contorno, prega)!;
  const [a, b] = prega.parada;
  const [a2, b2] = prega.movida;
  const no = (indice: number): PosicaoNoContorno => ({ indiceAresta: indice, ponto: contorno[indice]! });
  const queAnda = onde.adiante ? trechoDoContorno(contorno, no(onde.a2), no(onde.b2)) : trechoDoContorno(contorno, no(onde.b2), no(onde.a2));
  const queFica = onde.adiante ? trechoDoContorno(contorno, no(onde.b), no(onde.a)) : trechoDoContorno(contorno, no(onde.a), no(onde.b));
  // O movimento de volta: desfaz o giro em torno da ponta que andou e traz essa ponta para cima da parada.
  const giro = ((Math.atan2(b2.y - a2.y, b2.x - a2.x) - Math.atan2(b.y - a.y, b.x - a.x)) * 180) / Math.PI;
  const volta = giroEDeslocamento(a2, -giro, ponto(a.x - a2.x, a.y - a2.y));

  const piquesDela = new Set(prega.piques ?? []);
  const linhasInternas = [...molde.linhasInternas];
  for (const linha of prega.linhas) {
    const qual = linhasInternas.findIndex((l) => mesmaLinha(l, linha));
    if (qual >= 0) linhasInternas.splice(qual, 1);
  }
  const semEla: Molde = {
    ...molde,
    linhasInternas,
    piques: molde.piques.filter((q) => !piquesDela.has(q.id)),
    pregas: (molde.pregas ?? []).filter((q) => q.id !== id),
  };
  const base = levarOQueEstaNaRegiao(semEla, queAnda, queAnda, queFica, volta);
  const [criouA, criouB] = prega.pontasCriadas;
  const saem = [...(criouA ? [a] : []), ...(criouB ? [b] : [])];
  const fechado = semPontosRepetidos([...queFica, ...queAnda.map(volta.ponto)], 1e-4).filter((p) => !saem.some((q) => distancia(p, q) <= 1e-4));
  const novoContorno = comecarPeloMenorPontoOriginal(fechado, contorno);
  if (novoContorno.length < 3 || !(area(novoContorno) > AREA_MINIMA_MM2)) throw new Error('A peça ficaria sem área sem essa prega.');
  return comPregasValidas({ ...base, contorno: novoContorno, piques: piquesQueFicamNoContorno(base.piques, novoContorno) });
}

/**
 * Muda uma prega já feita: ela é tirada e aberta de novo na mesma linha, com
 * o tipo e as larguras dados. Continua com piques, se tinha.
 */
export function alterarPrega(molde: Molde, id: string, medidas: MedidasDaPrega, novoId: () => string): Molde {
  const prega = pregaRegistrada(molde, id);
  const opcoes: OpcoesDePregas = {
    modo: medidas.modo,
    quantidade: 1,
    distanciaMm: 0,
    larguraMm: medidas.larguraMm,
    largura2Mm: medidas.largura2Mm,
    piques: (prega.piques?.length ?? 0) > 0,
  };
  conferirOpcoesDePregas(opcoes);
  const semEla = removerPrega(molde, id);
  const pontaNoContorno = (p: Ponto2D): Ponto2D => pontoMaisProximoNoContorno(p, semEla.contorno).ponto;
  return abrirUmaPrega(semEla, pontaNoContorno(prega.parada[0]), pontaNoContorno(prega.parada[1]), opcoes, novoId).molde;
}

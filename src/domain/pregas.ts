import {
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
import { piquesQueFicamNoContorno, type Molde, type Pique } from './molde';
import {
  comecarPeloMenorPontoOriginal,
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
  return {
    molde: {
      ...base,
      contorno: novoContorno,
      linhasInternas: [...base.linhasInternas, ...linhas, ...setas],
      piques: [...piquesQueFicamNoContorno(base.piques, novoContorno), ...novos],
    },
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

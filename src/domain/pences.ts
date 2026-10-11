import {
  andarNoContorno,
  area,
  areaAssinada,
  comprimentoDaLinha,
  distancia,
  perimetro,
  pontoDentroDoContorno,
  pontoMaisProximoNoContorno,
  rotacionar,
  segmentosSeIntersectam,
  substituirTrechoDoContorno,
  trechoDoContorno,
  type Contorno,
  type Ponto2D,
  type PosicaoNoContorno,
} from '../core/geometria';
import { exigirCorteValido } from './corteEUniao';
import { piquesQueFicamNoContorno, semCampo, type Marca, type Molde, type PenceDaPeca, type Pique } from './molde';
import { abrirPelasIntersecoes, cruzaOContornoMaisDeDuasVezes } from './penceComIntersecoes';
import {
  comecarPeloMenorPontoOriginal,
  distanciaAteALinha,
  giroEDeslocamento,
  levarOQueEstaNaRegiao,
  regiaoQueAnda,
  semPontosRepetidos,
} from './regioes';

/**
 * Pences (grupo "Pregas e Pences" da aba Produção). A pence do contorno é um
 * "V": duas pernas que saem do contorno e se encontram no vértice, dentro da
 * peça. Recortada, o V sai do contorno; marcada, fica desenhado como linha
 * interna. A pence interna é um losango desenhado no meio da peça.
 *
 * Toda pence feita por estas ferramentas fica registrada na peça
 * (`Molde.pences`), pelos pontos dela: é o que permite mudar as medidas
 * depois e fechar ou transferir sem adivinhar qual canto é a pence.
 */

export type ModoDePence = 'recortar' | 'marcar';

export interface OpcoesDePence {
  /** Distância entre as duas pernas, medida sobre o contorno (mm). */
  readonly aberturaMm: number;
  /** Distância do contorno ao vértice (mm). */
  readonly profundidadeMm: number;
  readonly modo: ModoDePence;
  /** Um pique em cada ponta da pence, no contorno. */
  readonly piquesLaterais: boolean;
  /** Uma marca no vértice (só na pence marcada: na recortada o vértice já é um ponto do contorno). */
  readonly marcaNoVertice: boolean;
}

export const MAXIMO_DE_PENCES = 20;

const MESMO_PONTO_MM = 1e-6;
/** Quanto (mm) a perna da pence é encurtada junto ao contorno, para o teste de cruzamento não acusar a própria ponta. */
const FOLGA_DA_PONTA_MM = 0.01;
/** A reta entre as pontas da pence fica a menos disto (mm) da abertura pedida. */
const FOLGA_DA_ABERTURA_MM = 1e-7;
const AREA_MINIMA_MM2 = 1e-6;
const ORIGEM: Ponto2D = { x: 0, y: 0 };

function ponto(x: number, y: number): Ponto2D {
  return { x, y };
}

function unitario(de: Ponto2D, ate: Ponto2D): Ponto2D {
  const d = distancia(de, ate);
  return d === 0 ? ORIGEM : ponto((ate.x - de.x) / d, (ate.y - de.y) / d);
}

function meioDe(a: Ponto2D, b: Ponto2D): Ponto2D {
  return ponto((a.x + b.x) / 2, (a.y + b.y) / 2);
}

function anguloDe(de: Ponto2D, ate: Ponto2D): number {
  return (Math.atan2(ate.y - de.y, ate.x - de.x) * 180) / Math.PI;
}

function sentidoDe(contorno: Contorno): 1 | -1 {
  return areaAssinada(contorno) >= 0 ? 1 : -1;
}

function arestasDe(contorno: Contorno): Array<readonly [Ponto2D, Ponto2D]> {
  return contorno.map((p, i) => [p, contorno[(i + 1) % contorno.length]!] as const);
}

function estaNaPeca(molde: Molde, p: Ponto2D): boolean {
  return pontoDentroDoContorno(p, molde.contorno) && !molde.furos.some((f) => pontoDentroDoContorno(p, f));
}

/** Verdadeiro se o segmento cruza o contorno ou um furo da peça. */
function cruzaAPeca(molde: Molde, a: Ponto2D, b: Ponto2D): boolean {
  return [molde.contorno, ...molde.furos].some((c) => arestasDe(c).some(([p, q]) => segmentosSeIntersectam(a, b, p, q)));
}

function piquesEm(pontos: readonly Ponto2D[], contorno: Contorno, novoId: () => string): Pique[] {
  return pontos.map((p) => {
    const noContorno = pontoMaisProximoNoContorno(p, contorno);
    return { id: novoId(), posicao: noContorno.ponto, indiceAresta: noContorno.indiceAresta };
  });
}

/** Recusa abertura ou profundidade que não seja um número maior que zero. */
export function conferirMedidasDaPence(aberturaMm: number, profundidadeMm: number): void {
  if (!Number.isFinite(aberturaMm) || !(aberturaMm > 0)) throw new Error('A abertura da pence precisa ser maior que zero.');
  if (!Number.isFinite(profundidadeMm) || !(profundidadeMm > 0)) throw new Error('A profundidade da pence precisa ser maior que zero.');
}

/** As duas pontas da pence, no contorno, e o vértice dela. */
export interface GeometriaDaPence {
  readonly inicio: PosicaoNoContorno;
  readonly fim: PosicaoNoContorno;
  readonly vertice: Ponto2D;
}

/**
 * As duas pontas de uma pence centrada em `posicao`, com `aberturaMm` de uma
 * à outra **em linha reta**: cada uma anda o mesmo tanto sobre o contorno, para
 * um lado e para o outro. Numa borda reta, é meia abertura para cada lado;
 * numa curva ou num canto, um pouco mais, até a reta entre as duas ter a
 * medida pedida — a mesma que o diálogo das medidas lê da pence depois.
 */
function pontasDaPence(contorno: Contorno, posicao: PosicaoNoContorno, aberturaMm: number): { readonly inicio: PosicaoNoContorno; readonly fim: PosicaoNoContorno } {
  const limite = perimetro(contorno) / 4;
  if (aberturaMm / 2 >= limite) throw new Error('A abertura da pence é grande demais para esse contorno.');
  const em = (andado: number) => ({ inicio: andarNoContorno(contorno, posicao, -andado), fim: andarNoContorno(contorno, posicao, andado) });
  const reta = (andado: number): number => {
    const pontas = em(andado);
    return distancia(pontas.inicio.ponto, pontas.fim.ponto);
  };
  let menor = aberturaMm / 2;
  // Na borda reta, andar meia abertura para cada lado já dá a medida.
  if (reta(menor) >= aberturaMm - FOLGA_DA_ABERTURA_MM) return em(menor);
  let maior = menor;
  while (reta(maior) < aberturaMm) {
    if (maior >= limite) throw new Error('A abertura da pence é grande demais para esse contorno.');
    menor = maior;
    maior = Math.min(maior * 1.25, limite);
  }
  for (let passo = 0; passo < 60 && maior - menor > FOLGA_DA_ABERTURA_MM / 10; passo++) {
    const meio = (menor + maior) / 2;
    if (reta(meio) < aberturaMm) menor = meio;
    else maior = meio;
  }
  return em(maior);
}

/**
 * Onde ficam as pontas e o vértice de uma pence centrada em `posicao`: as
 * pontas à abertura pedida uma da outra, em linha reta, igualmente afastadas
 * da posição sobre o contorno, e o vértice à profundidade pedida — em
 * esquadro com a linha que liga as pontas ou, com `apontarPara`, na direção
 * desse ponto.
 */
export function geometriaDaPence(
  molde: Molde,
  posicao: PosicaoNoContorno,
  aberturaMm: number,
  profundidadeMm: number,
  apontarPara?: Ponto2D,
): GeometriaDaPence {
  conferirMedidasDaPence(aberturaMm, profundidadeMm);
  const contorno = molde.contorno;
  const { inicio, fim } = pontasDaPence(contorno, posicao, aberturaMm);
  if (distancia(inicio.ponto, fim.ponto) < MESMO_PONTO_MM) throw new Error('A abertura da pence é pequena demais.');
  const aoLongo = unitario(inicio.ponto, fim.ponto);
  const sentido = sentidoDe(contorno);
  const paraDentro = ponto(-aoLongo.y * sentido, aoLongo.x * sentido);
  const meio = meioDe(inicio.ponto, fim.ponto);
  let eixo = paraDentro;
  if (apontarPara) {
    if (distancia(meio, apontarPara) < MESMO_PONTO_MM) throw new Error('Aponte a pence para um ponto dentro da peça.');
    eixo = unitario(meio, apontarPara);
    if (eixo.x * paraDentro.x + eixo.y * paraDentro.y < 0.05) throw new Error('A pence precisa apontar para dentro da peça.');
  }
  const vertice = ponto(meio.x + eixo.x * profundidadeMm, meio.y + eixo.y * profundidadeMm);
  if (!estaNaPeca(molde, vertice)) {
    throw new Error('O vértice da pence cairia fora da peça: diminua a profundidade ou mude a posição.');
  }
  for (const ponta of [inicio.ponto, fim.ponto]) {
    const perna = distancia(ponta, vertice);
    const k = FOLGA_DA_PONTA_MM / perna;
    const saida = ponto(ponta.x + (vertice.x - ponta.x) * k, ponta.y + (vertice.y - ponta.y) * k);
    if (cruzaAPeca(molde, saida, vertice)) {
      throw new Error('A pence cruzaria o contorno da peça: diminua a profundidade ou mude a posição.');
    }
  }
  return { inicio, fim, vertice };
}

/**
 * "Pence no contorno", recortada ou marcada. Recortada, o contorno passa a
 * entrar pela pence até o vértice (a peça perde o triângulo). Marcada, o
 * contorno não muda e as duas pernas entram como linha interna.
 */
export function criarPence(
  molde: Molde,
  posicao: PosicaoNoContorno,
  opcoes: OpcoesDePence,
  novoId: () => string,
  apontarPara?: Ponto2D,
): Molde {
  const { inicio, fim, vertice } = geometriaDaPence(molde, posicao, opcoes.aberturaMm, opcoes.profundidadeMm, apontarPara);
  const pontas = [inicio.ponto, fim.ponto];
  const pontos = [inicio.ponto, vertice, fim.ponto];
  if (opcoes.modo === 'marcar') {
    const marcas: Marca[] = opcoes.marcaNoVertice ? [{ id: novoId(), posicao: vertice }] : [];
    const piques = opcoes.piquesLaterais ? piquesEm(pontas, molde.contorno, novoId) : [];
    return comPence(
      {
        ...molde,
        linhasInternas: [...molde.linhasInternas, pontos],
        piques: [...molde.piques, ...piques],
        marcas: [...molde.marcas, ...marcas],
      },
      { id: novoId(), tipo: 'marcada', pontos, piques: piques.map((q) => q.id), marcas: marcas.map((m) => m.id) },
    );
  }
  const contorno = substituirTrechoDoContorno(molde.contorno, inicio, fim, [vertice]);
  if (contorno.length < 3 || !(area(contorno) > AREA_MINIMA_MM2)) {
    throw new Error('A pence não cabe nessa peça com essas medidas.');
  }
  const piques = opcoes.piquesLaterais ? piquesEm(pontas, contorno, novoId) : [];
  // O pique no vértice é uma marca nele: vale para a pence recortada como para a marcada.
  const marcas: Marca[] = opcoes.marcaNoVertice ? [{ id: novoId(), posicao: vertice }] : [];
  // O que o recorte tirou do contorno, de uma ponta à outra: volta se a pence for apagada ou mudar de medida.
  const removidos = trechoDoContorno(molde.contorno, inicio, fim).filter((p) => !mesmoLugar(p, inicio.ponto) && !mesmoLugar(p, fim.ponto));
  const jaEraPonto = (p: Ponto2D): boolean => molde.contorno.some((v) => mesmoLugar(v, p));
  return comPence(
    { ...molde, contorno, piques: [...piquesQueFicamNoContorno(molde.piques, contorno), ...piques], marcas: [...molde.marcas, ...marcas] },
    {
      id: novoId(),
      tipo: 'recortada',
      pontos,
      removidos,
      pontasCriadas: [!jaEraPonto(inicio.ponto), !jaEraPonto(fim.ponto)],
      piques: piques.map((q) => q.id),
      ...(marcas.length > 0 ? { marcas: marcas.map((m) => m.id) } : {}),
    },
  );
}

/** Recusa a quantidade, a distância e as medidas que não dão um grupo de pences. */
export function conferirMultiplasPences(quantidade: number, distanciaMm: number, aberturaMm: number, profundidadeMm: number): void {
  if (!Number.isInteger(quantidade) || quantidade < 2 || quantidade > MAXIMO_DE_PENCES) {
    throw new Error(`O número de pences precisa ser um inteiro de 2 a ${MAXIMO_DE_PENCES}.`);
  }
  conferirMedidasDaPence(aberturaMm, profundidadeMm);
  if (!Number.isFinite(distanciaMm) || !(distanciaMm > aberturaMm)) {
    throw new Error('A distância entre as pences precisa ser maior que a abertura de cada uma.');
  }
}

/**
 * "Múltiplas pences": várias pences iguais, em esquadro com o contorno,
 * espaçadas por `distanciaMm` (de centro a centro, sobre o contorno) e
 * repartidas por igual dos dois lados de `posicao`.
 */
export function criarMultiplasPences(
  molde: Molde,
  posicao: PosicaoNoContorno,
  quantidade: number,
  distanciaMm: number,
  opcoes: OpcoesDePence,
  novoId: () => string,
): Molde {
  conferirMultiplasPences(quantidade, distanciaMm, opcoes.aberturaMm, opcoes.profundidadeMm);
  if ((quantidade - 1) * distanciaMm + opcoes.aberturaMm >= perimetro(molde.contorno)) {
    throw new Error('As pences não cabem nesse contorno: diminua a quantidade ou a distância.');
  }
  const centros = Array.from(
    { length: quantidade },
    (_, i) => andarNoContorno(molde.contorno, posicao, (i - (quantidade - 1) / 2) * distanciaMm).ponto,
  );
  // Cada pence muda o contorno: o centro da seguinte é procurado de novo no contorno que ficou.
  return centros.reduce((atual, centro) => {
    const noContorno = pontoMaisProximoNoContorno(centro, atual.contorno);
    return criarPence(atual, { indiceAresta: noContorno.indiceAresta, ponto: noContorno.ponto }, opcoes, novoId);
  }, molde);
}

function exigirLinhaPorDentro(molde: Molde, a: Ponto2D, b: Ponto2D, oQue: string): void {
  try {
    exigirCorteValido(molde, a, b);
  } catch {
    throw new Error(`${oQue} precisa ficar toda dentro da peça.`);
  }
}

/**
 * "Pence no contorno", aberta por pivô: a peça é cortada de `posicao` até o
 * `pivo` (os dois no contorno) e um dos lados gira em torno do pivô até as
 * duas bordas do corte ficarem `aberturaMm` afastadas no contorno. A pence
 * recortada ocupa essa abertura até `profundidadeMm`; dali até o pivô o
 * espaço aberto vira tecido da peça. O lado que gira é o que não tem a linha
 * de fio.
 *
 * Com `cortarIntersecoes`, a linha que sai da peça e volta no caminho até o
 * pivô não é recusada: a peça abre em todos os trechos dela, sem vértice — o
 * resultado é uma prega (`penceComIntersecoes.ts`).
 */
export function abrirPence(
  molde: Molde,
  posicao: PosicaoNoContorno,
  pivo: PosicaoNoContorno,
  aberturaMm: number,
  profundidadeMm: number,
  piquesLaterais: boolean,
  novoId: () => string,
  marcaNoVertice = false,
  acabamento = false,
  cortarIntersecoes = false,
  dobraDoAcabamento: DobraDaPence = 'meio',
): Molde {
  conferirMedidasDaPence(aberturaMm, profundidadeMm);
  const p = posicao.ponto;
  const q = pivo.ponto;
  if (distancia(p, q) < MESMO_PONTO_MM) throw new Error('O pivô precisa ser outro ponto do contorno, do lado oposto ao da pence.');
  if (cortarIntersecoes) {
    const emPrega = abrirPelasIntersecoes(molde, posicao, pivo, aberturaMm, piquesLaterais, novoId);
    if (emPrega) return comPencesValidas(emPrega);
  } else if (cruzaOContornoMaisDeDuasVezes(molde.contorno, p, q)) {
    throw new Error('A linha da posição da pence até o pivô sai da peça no caminho. Com “Cortar intersecções” ligado, a peça é cortada em todos os trechos da linha, e o resultado é uma prega.');
  }
  exigirLinhaPorDentro(molde, p, q, 'A linha da posição da pence até o pivô');
  const ateOPivo = distancia(p, q);
  if (aberturaMm >= ateOPivo) throw new Error('A abertura é grande demais para a distância até o pivô.');
  const graus = (2 * Math.asin(aberturaMm / (2 * ateOPivo)) * 180) / Math.PI;

  const contorno = molde.contorno;
  const cadeias = [trechoDoContorno(contorno, posicao, pivo), trechoDoContorno(contorno, pivo, posicao)] as const;
  const anda = regiaoQueAnda(molde, cadeias[0], cadeias[1]);
  // A região 0 fica à esquerda de quem vai do pivô à posição (num contorno
  // anti-horário): girando para a esquerda, ela se afasta da outra.
  const movimento = giroEDeslocamento(q, (anda === 0 ? 1 : -1) * sentidoDe(contorno) * graus);
  const outraBorda = movimento.ponto(p);
  const meio = meioDe(p, outraBorda);
  const folgaAteOPivo = distancia(meio, q);
  if (profundidadeMm >= folgaAteOPivo - MESMO_PONTO_MM) {
    throw new Error(`A profundidade precisa ser menor que a distância até o pivô (${folgaAteOPivo.toFixed(1).replace('.', ',')} mm).`);
  }
  const eixo = unitario(meio, q);
  const vertice = ponto(meio.x + eixo.x * profundidadeMm, meio.y + eixo.y * profundidadeMm);
  const movida = cadeias[anda].map(movimento.ponto);
  // Na ordem do contorno: o lado parado, a pence e o lado que girou.
  const volta = anda === 0 ? [...cadeias[1], vertice, ...movida] : [...cadeias[0], ...movida, vertice];
  const novoContorno = comecarPeloMenorPontoOriginal(semPontosRepetidos(volta), contorno);
  const base = levarOQueEstaNaRegiao(molde, cadeias[anda], cadeias[anda], cadeias[1 - anda]!, movimento);
  const piques = piquesLaterais ? piquesEm([p, outraBorda], novoContorno, novoId) : [];
  const marcas: Marca[] = marcaNoVertice ? [{ id: novoId(), posicao: vertice }] : [];
  const aberta = {
    ...base,
    contorno: novoContorno,
    piques: [...piquesQueFicamNoContorno(base.piques, novoContorno), ...piques],
    marcas: [...base.marcas, ...marcas],
  };
  const registro = registroDoVertice(novoContorno, vertice, novoId(), piques.map((q) => q.id));
  // Com o pivô guardado, a pence fecha e abre de novo pelo mesmo giro quando as medidas mudam.
  if (!registro) return comPencesValidas(aberta);
  const comRegistro = comPence(aberta, { ...registro, pivo: q, ...(marcas.length > 0 ? { marcas: marcas.map((m) => m.id) } : {}) });
  // "Criar acabamento": a pence aberta não é recortada; fica desenhada, e o contorno ganha o bico dela.
  return acabamento ? comAcabamento(comRegistro, registro.id, dobraDoAcabamento) : comRegistro;
}

export interface OpcoesDePenceInterna {
  /** Do centro até a ponta que aponta no sentido do fio (mm). */
  readonly altura1Mm: number;
  /** Do centro até a outra ponta (mm). */
  readonly altura2Mm: number;
  /** Largura no centro (mm). */
  readonly larguraMm: number;
  /** Giro do eixo da pence em relação à linha de fio (graus, anti-horário). */
  readonly anguloGraus: number;
  /** Desenha também o eixo, de ponta a ponta. */
  readonly linhaAuxiliar: boolean;
  /** Uma marca em cada ponta e em cada lado do centro. */
  readonly marcas: boolean;
}

/** Recusa as medidas que não dão uma pence interna. */
export function conferirOpcoesDePenceInterna(opcoes: OpcoesDePenceInterna): void {
  if (![opcoes.altura1Mm, opcoes.altura2Mm].every((a) => Number.isFinite(a) && a > 0)) {
    throw new Error('As duas alturas da pence interna precisam ser maiores que zero.');
  }
  if (!Number.isFinite(opcoes.larguraMm) || !(opcoes.larguraMm > 0)) throw new Error('A largura da pence interna precisa ser maior que zero.');
  if (!Number.isFinite(opcoes.anguloGraus)) throw new Error('O ângulo da pence interna precisa ser um número.');
}

/** Os quatro cantos do losango da pence interna: ponta 1, um lado, ponta 2 e o outro lado. */
export function losangoDaPenceInterna(molde: Molde, centro: Ponto2D, opcoes: OpcoesDePenceInterna): Ponto2D[] {
  conferirOpcoesDePenceInterna(opcoes);
  const eixo = rotacionar(unitario(molde.linhaDeFio.inicio, molde.linhaDeFio.fim), ORIGEM, opcoes.anguloGraus);
  const lado = ponto(-eixo.y, eixo.x);
  const meiaLargura = opcoes.larguraMm / 2;
  const losango = [
    ponto(centro.x + eixo.x * opcoes.altura1Mm, centro.y + eixo.y * opcoes.altura1Mm),
    ponto(centro.x + lado.x * meiaLargura, centro.y + lado.y * meiaLargura),
    ponto(centro.x - eixo.x * opcoes.altura2Mm, centro.y - eixo.y * opcoes.altura2Mm),
    ponto(centro.x - lado.x * meiaLargura, centro.y - lado.y * meiaLargura),
  ];
  const cabe =
    losango.every((p) => estaNaPeca(molde, p)) && !losango.some((p, i) => cruzaAPeca(molde, p, losango[(i + 1) % losango.length]!));
  if (!cabe) throw new Error('A pence interna precisa caber inteira dentro da peça.');
  return losango;
}

/**
 * "Pence interna": um losango desenhado dentro da peça, com o centro no ponto
 * dado e o eixo no sentido do fio (ou girado dele). É uma pence marcada: entra
 * como linha interna e não muda o contorno.
 */
export function criarPenceInterna(molde: Molde, centro: Ponto2D, opcoes: OpcoesDePenceInterna, novoId: () => string): Molde {
  const losango = losangoDaPenceInterna(molde, centro, opcoes);
  const linhas: Contorno[] = [[...losango, losango[0]!]];
  if (opcoes.linhaAuxiliar) linhas.push([losango[0]!, losango[2]!]);
  const marcas: Marca[] = opcoes.marcas ? losango.map((posicao) => ({ id: novoId(), posicao })) : [];
  return comPence(
    { ...molde, linhasInternas: [...molde.linhasInternas, ...linhas], marcas: [...molde.marcas, ...marcas] },
    { id: novoId(), tipo: 'interna', pontos: losango, comEixo: opcoes.linhaAuxiliar, marcas: marcas.map((m) => m.id) },
  );
}

/**
 * As duas pontas de uma pence recortada indicadas uma a uma, pelo número do
 * ponto no contorno: serve à pence de pernas curvas (ou de vários pontos), em
 * que as pontas não são os vizinhos do vértice.
 */
export interface PontasDaPence {
  readonly inicio: number;
  readonly fim: number;
}

/**
 * A pence recortada cujo vértice é o ponto `indice` do contorno: as duas
 * pontas, o vértice e os pontos do contorno que estão em cada perna, entre a
 * ponta e o vértice (nenhum, na pence de pernas retas).
 */
interface PenceRecortada {
  readonly inicio: PosicaoNoContorno;
  readonly vertice: Ponto2D;
  readonly fim: PosicaoNoContorno;
  readonly pernaDoInicio: readonly Ponto2D[];
  readonly pernaDoFim: readonly Ponto2D[];
}

/** Os pontos do recorte, na ordem do contorno: início, perna, vértice, perna e fim. */
function recorteDa(pence: PenceRecortada): Ponto2D[] {
  return [pence.inicio.ponto, ...pence.pernaDoInicio, pence.vertice, ...pence.pernaDoFim, pence.fim.ponto];
}

/** A pence de pontas indicadas: o vértice fica entre as duas, na ordem do contorno (a que vem antes dele é o início). */
function penceDePontasIndicadas(molde: Molde, indice: number, pontas: PontasDaPence): PenceRecortada {
  const contorno = molde.contorno;
  const n = contorno.length;
  const valido = (i: number): boolean => Number.isInteger(i) && i >= 0 && i < n;
  if (!valido(pontas.inicio) || !valido(pontas.fim)) throw new Error('Ponto fora do contorno da peça.');
  if (pontas.inicio === indice || pontas.fim === indice || pontas.inicio === pontas.fim) {
    throw new Error('O início, o vértice e o fim da pence precisam ser três pontos diferentes do contorno.');
  }
  const passos = (de: number, ate: number): number => (ate - de + n) % n;
  const [a, b] = passos(pontas.inicio, indice) < passos(pontas.inicio, pontas.fim) ? [pontas.inicio, pontas.fim] : [pontas.fim, pontas.inicio];
  const entre = (de: number, ate: number): Ponto2D[] => {
    const pontos: Ponto2D[] = [];
    for (let i = (de + 1) % n; i !== ate; i = (i + 1) % n) pontos.push(contorno[i]!);
    return pontos;
  };
  const pence: PenceRecortada = {
    inicio: { indiceAresta: a, ponto: contorno[a]! },
    vertice: contorno[indice]!,
    fim: { indiceAresta: b, ponto: contorno[b]! },
    pernaDoInicio: entre(a, indice),
    pernaDoFim: entre(indice, b),
  };
  // O recorte entra na peça: os pontos dele dão a volta no sentido contrário ao do contorno.
  if (!(areaAssinada(recorteDa(pence)) * sentidoDe(contorno) < -AREA_MINIMA_MM2)) {
    throw new Error('Esses três pontos não formam uma pence recortada: o vértice precisa ficar para dentro da peça, entre o início e o fim.');
  }
  if (n - pence.pernaDoInicio.length - pence.pernaDoFim.length - 1 < 3) throw new Error('A peça ficaria sem área sem essa pence.');
  return pence;
}

/** Recusa os três pontos que não formam uma pence recortada (o vértice `indice`, com as pontas indicadas). */
export function conferirPontasDaPence(molde: Molde, indice: number, pontas: PontasDaPence): void {
  penceRecortadaEm(molde, indice, pontas);
}

function penceRecortadaEm(molde: Molde, indice: number, pontas?: PontasDaPence): PenceRecortada {
  const contorno = molde.contorno;
  const n = contorno.length;
  if (!Number.isInteger(indice) || indice < 0 || indice >= n) throw new Error('Ponto fora do contorno da peça.');
  if (pontas) return penceDePontasIndicadas(molde, indice, pontas);
  const indiceDoInicio = (indice - 1 + n) % n;
  const indiceDoFim = (indice + 1) % n;
  const a = contorno[indiceDoInicio]!;
  const v = contorno[indice]!;
  const b = contorno[indiceDoFim]!;
  // Num contorno anti-horário, o canto que entra na peça vira para a direita.
  const giro = ((v.x - a.x) * (b.y - v.y) - (v.y - a.y) * (b.x - v.x)) * sentidoDe(contorno);
  if (!(giro < -1e-9)) {
    throw new Error('Esse ponto não é o vértice de uma pence recortada: clique no ponto de dentro do recorte.');
  }
  return { inicio: { indiceAresta: indiceDoInicio, ponto: a }, vertice: v, fim: { indiceAresta: indiceDoFim, ponto: b }, pernaDoInicio: [], pernaDoFim: [] };
}

/** Verdadeiro se o ponto `indice` do contorno é o vértice de uma pence recortada (um canto que entra na peça). */
export function ehVerticeDePence(molde: Molde, indice: number): boolean {
  try {
    penceRecortadaEm(molde, indice);
    return true;
  } catch {
    return false;
  }
}

/**
 * "Transferir pence": a pence recortada de vértice `indice` fecha, e abre-se
 * outra, com o mesmo vértice e o mesmo ângulo, em `novaPosicao`. A peça é
 * cortada do vértice até a nova posição e um dos lados gira em torno do
 * vértice até as pernas da pence antiga se encontrarem. O tecido é o mesmo: a
 * área não muda. Gira o lado que não tem a linha de fio.
 *
 * Com `pontas`, o início e o fim da pence são os pontos indicados (a pence de
 * pernas curvas): o giro é o que leva o fim para a direção do início, vistos
 * do vértice, e os pontos das pernas saem do contorno com a pence antiga.
 */
export function transferirPence(molde: Molde, indice: number, novaPosicao: PosicaoNoContorno, pontas?: PontasDaPence): Molde {
  const antigaNoContorno = penceRecortadaEm(molde, indice, pontas);
  const { inicio, vertice, fim, pernaDoInicio, pernaDoFim } = antigaNoContorno;
  const nova = novaPosicao.ponto;
  if (distanciaAteALinha(nova, recorteDa(antigaNoContorno)) < MESMO_PONTO_MM) {
    throw new Error('Indique a nova posição fora da pence atual.');
  }
  exigirLinhaPorDentro(molde, vertice, nova, 'A linha do vértice da pence até a nova posição');
  const contorno = molde.contorno;
  const depoisDaPence = trechoDoContorno(contorno, fim, novaPosicao);
  const antesDaPence = trechoDoContorno(contorno, novaPosicao, inicio);
  const regioes = [
    [vertice, ...pernaDoFim, ...depoisDaPence],
    [vertice, ...antesDaPence, ...pernaDoInicio],
  ] as const;
  const anda = regiaoQueAnda(molde, regioes[0], regioes[1]);
  // O giro que leva a perna do fim para cima da perna do início.
  const fechar = anguloDe(vertice, inicio.ponto) - anguloDe(vertice, fim.ponto);
  const movimento = giroEDeslocamento(vertice, anda === 0 ? fechar : -fechar);
  const volta =
    anda === 0
      ? [vertice, ...antesDaPence, ...depoisDaPence.map(movimento.ponto)]
      : [vertice, ...antesDaPence.map(movimento.ponto), ...depoisDaPence];
  const novoContorno = comecarPeloMenorPontoOriginal(semPontosRepetidos(volta), contorno);
  const base = levarOQueEstaNaRegiao(
    molde,
    regioes[anda],
    anda === 0 ? depoisDaPence : antesDaPence,
    anda === 0 ? antesDaPence : depoisDaPence,
    movimento,
  );
  const transferida = { ...base, contorno: novoContorno, piques: piquesQueFicamNoContorno(base.piques, novoContorno) };
  // O registro da pence, se havia, passa a ser o da pence nova: o mesmo vértice, entre os vizinhos de agora.
  const antiga = penceNoVertice(molde, indice);
  const registro = antiga ? registroDoVertice(novoContorno, vertice, antiga.id, []) : null;
  if (!antiga || !registro) return comPencesValidas(transferida);
  return comPence({ ...transferida, pences: (transferida.pences ?? []).filter((q) => q.id !== antiga.id) }, registro);
}

/**
 * "Fechar pence": a pence recortada de vértice `indice` deixa de existir.
 * - Com `pivo` (um ponto do contorno): a peça é cortada do vértice até o pivô
 *   e um dos lados gira em torno do pivô até as duas pontas da pence se
 *   alinharem. As bordas do corte se sobrepõem, e o contorno novo é o de
 *   fora; se as pernas vistas do pivô têm comprimentos diferentes, sobra um
 *   pequeno degrau entre as pontas.
 * - Sem pivô ("somente o recorte"): nada gira; o contorno passa reto de uma
 *   ponta à outra e a pence fica marcada, como linha interna.
 */
export function fecharPence(molde: Molde, indice: number, pivo: PosicaoNoContorno | null, pontas?: PontasDaPence): Molde {
  const recortada = penceRecortadaEm(molde, indice, pontas);
  const { inicio, vertice, fim, pernaDoInicio, pernaDoFim } = recortada;
  const contorno = molde.contorno;
  if (!pivo) {
    // Saem do contorno o vértice e os pontos das pernas: os que estão entre o início e o fim.
    const n = contorno.length;
    const doRecorte = new Set<number>();
    for (let i = (inicio.indiceAresta + 1) % n; i !== fim.indiceAresta; i = (i + 1) % n) doRecorte.add(i);
    const semVertice = contorno.filter((_, i) => !doRecorte.has(i));
    if (semVertice.length < 3 || !(area(semVertice) > AREA_MINIMA_MM2)) throw new Error('A peça ficaria sem área sem essa pence.');
    const pontos = recorteDa(recortada);
    // O registro é da pence de pernas retas: a de pernas curvas fica só desenhada.
    const antiga = pernaDoInicio.length + pernaDoFim.length === 0 ? penceNoVertice(molde, indice) : null;
    const marcada: Molde = {
      ...molde,
      contorno: semVertice,
      linhasInternas: [...molde.linhasInternas, pontos],
      piques: piquesQueFicamNoContorno(molde.piques, semVertice),
    };
    // A pence registrada continua registrada, agora como marcada.
    if (!antiga) return comPencesValidas(marcada);
    return comPence(
      { ...marcada, pences: (marcada.pences ?? []).filter((q) => q.id !== antiga.id) },
      { id: antiga.id, tipo: 'marcada', pontos, ...(antiga.piques ? { piques: antiga.piques } : {}) },
    );
  }
  const centro = pivo.ponto;
  if (distanciaAteALinha(centro, recorteDa(recortada)) < MESMO_PONTO_MM) {
    throw new Error('O pivô precisa ficar fora da pence, do outro lado da peça.');
  }
  exigirLinhaPorDentro(molde, vertice, centro, 'A linha do vértice da pence até o pivô');
  const depoisDaPence = trechoDoContorno(contorno, fim, pivo);
  const antesDaPence = trechoDoContorno(contorno, pivo, inicio);
  const regioes = [
    [vertice, ...pernaDoFim, ...depoisDaPence],
    [vertice, ...antesDaPence, ...pernaDoInicio],
  ] as const;
  const anda = regiaoQueAnda(molde, regioes[0], regioes[1]);
  const fechar = anguloDe(centro, inicio.ponto) - anguloDe(centro, fim.ponto);
  const movimento = giroEDeslocamento(centro, anda === 0 ? fechar : -fechar);
  const volta =
    anda === 0 ? [...antesDaPence, ...depoisDaPence.map(movimento.ponto)] : [...antesDaPence.map(movimento.ponto), ...depoisDaPence];
  const novoContorno = comecarPeloMenorPontoOriginal(semPontosRepetidos(volta), contorno);
  if (novoContorno.length < 3 || !(area(novoContorno) > AREA_MINIMA_MM2)) throw new Error('A peça ficaria sem área fechando essa pence.');
  const base = levarOQueEstaNaRegiao(
    molde,
    regioes[anda],
    anda === 0 ? depoisDaPence : antesDaPence,
    anda === 0 ? antesDaPence : depoisDaPence,
    movimento,
  );
  // A pence deixou de existir: o registro dela sai com os pontos que sumiram.
  return comPencesValidas({ ...base, contorno: novoContorno, piques: piquesQueFicamNoContorno(base.piques, novoContorno) });
}

// ---------------------------------------------------------------------------
// As pences registradas na peça
// ---------------------------------------------------------------------------

const NO_MESMO_LUGAR_MM = 1e-6;

function mesmoLugar(a: Ponto2D, b: Ponto2D): boolean {
  return distancia(a, b) <= NO_MESMO_LUGAR_MM;
}

/** A linha é a mesma sequência de pontos, num sentido ou no outro. */
function mesmaLinha(linha: readonly Ponto2D[], pontos: readonly Ponto2D[]): boolean {
  if (linha.length !== pontos.length) return false;
  return linha.every((p, i) => mesmoLugar(p, pontos[i]!)) || linha.every((p, i) => mesmoLugar(p, pontos[pontos.length - 1 - i]!));
}

/** O número (a partir de 0) do ponto do contorno que é o vértice da pence recortada, com as pontas dela de vizinhas; -1 se não está mais lá. */
function verticeNoContorno(contorno: Contorno, pence: PenceDaPeca): number {
  const [a, v, b] = pence.pontos;
  if (!a || !v || !b) return -1;
  const n = contorno.length;
  return contorno.findIndex((p, i) => {
    if (!mesmoLugar(p, v)) return false;
    const antes = contorno[(i - 1 + n) % n]!;
    const depois = contorno[(i + 1) % n]!;
    return (mesmoLugar(antes, a) && mesmoLugar(depois, b)) || (mesmoLugar(antes, b) && mesmoLugar(depois, a));
  });
}

/** O losango da pence interna como é desenhado: os quatro cantos e a volta ao primeiro. */
function voltaDoLosango(pence: PenceDaPeca): Ponto2D[] {
  return [...pence.pontos, pence.pontos[0]!];
}

function penceEstaNaPeca(molde: Molde, pence: PenceDaPeca): boolean {
  if (pence.tipo === 'recortada') return verticeNoContorno(molde.contorno, pence) >= 0;
  const linha = pence.tipo === 'marcada' ? pence.pontos : voltaDoLosango(pence);
  if (!molde.linhasInternas.some((l) => mesmaLinha(l, linha))) return false;
  // A marcada com acabamento vale enquanto os pontos do acabamento são os do contorno entre as duas pontas dela.
  return pence.bico === undefined || capaNoContorno(molde.contorno, pence) !== null;
}

/** Os pontos que o contorno ganhou com o acabamento, da primeira ponta para a segunda: a capa guardada ou, sem ela, só o bico. */
function pontosDoAcabamento(pence: PenceDaPeca): readonly Ponto2D[] {
  return pence.capa ?? (pence.bico ? [pence.bico] : []);
}

/**
 * Os números (a partir de 0) dos pontos do contorno que são o acabamento da
 * pence, da primeira ponta para a segunda, com as pontas dela de vizinhas;
 * `null` se já não estão lá.
 */
function capaNoContorno(contorno: Contorno, pence: PenceDaPeca): number[] | null {
  const [a, , b] = pence.pontos;
  const capa = pontosDoAcabamento(pence);
  if (!a || !b || capa.length === 0) return null;
  const n = contorno.length;
  const fila = [a, ...capa, b];
  if (fila.length > n) return null;
  for (let i = 0; i < n; i++) {
    if (!mesmoLugar(contorno[i]!, a)) continue;
    for (const passo of [1, -1]) {
      const indices = fila.map((_, j) => (((i + passo * j) % n) + n) % n);
      if (indices.every((k, j) => mesmoLugar(contorno[k]!, fila[j]!))) return indices.slice(1, -1);
    }
  }
  return null;
}

/** Até onde a borda é seguida para achar o bico, em vezes a abertura da pence. */
const ALCANCE_DA_CAPA = 4;
/** O ponto do acabamento a menos disto (mm) da reta entre os vizinhos não faz falta: a borda ali é reta. */
const NA_RETA_DA_CAPA_MM = 1e-6;

/**
 * O acabamento da pence recortada (vértice no ponto `i` do contorno) dobrada
 * para um lado — o do ponto anterior ou o do seguinte ao vértice —, pelo
 * traçado de ofício: dobrada, a pence fica por baixo da peça desse lado, e a
 * borda dali passa por cima dela. A borda desse lado é seguida ponto a ponto
 * e espelhada na perna, até cruzar a linha do meio da pence — aí está o bico;
 * a outra metade é o espelho dessa na linha do meio. Numa borda reta, dá um
 * ponto só, o bico. O bico pode ficar para dentro da reta das pontas: é o que
 * a dobra dá quando a borda desse lado se afasta da pence.
 *
 * `null` quando a dobra não alcança a borda: a borda espelhada continua a
 * perna ou passa para o outro lado dela, ou não chega à linha do meio dentro
 * do alcance.
 *
 * Devolve os pontos do ponto anterior ao seguinte (sem os dois) e o bico.
 */
function dobraParaOLado(contorno: Contorno, i: number, lado: 'antes' | 'depois'): { readonly pontos: Ponto2D[]; readonly bico: Ponto2D } | null {
  const n = contorno.length;
  const a = contorno[(i - 1 + n) % n]!;
  const v = contorno[i]!;
  const b = contorno[(i + 1) % n]!;
  const meio = meioDe(a, b);
  const ateOMeio = distancia(v, meio);
  const [ponta, outra] = lado === 'antes' ? [a, b] : [b, a];
  const perna = distancia(ponta, v);
  if (ateOMeio < MESMO_PONTO_MM || perna < MESMO_PONTO_MM) return null;
  const eixo = ponto((meio.x - v.x) / ateOMeio, (meio.y - v.y) / ateOMeio);
  const l = ponto((v.x - ponta.x) / perna, (v.y - ponta.y) / perna);
  const naPerna = (p: Ponto2D): Ponto2D => {
    const aoLongo = (p.x - ponta.x) * l.x + (p.y - ponta.y) * l.y;
    return ponto(2 * (ponta.x + l.x * aoLongo) - p.x, 2 * (ponta.y + l.y * aoLongo) - p.y);
  };
  const noEixo = (p: Ponto2D): Ponto2D => {
    const aoLongo = (p.x - v.x) * eixo.x + (p.y - v.y) * eixo.y;
    return ponto(2 * (v.x + eixo.x * aoLongo) - p.x, 2 * (v.y + eixo.y * aoLongo) - p.y);
  };
  /** A distância do ponto à linha do meio, com o sinal do lado em que ele está. */
  const doEixo = (p: Ponto2D): number => eixo.x * (p.y - v.y) - eixo.y * (p.x - v.x);
  /** A distância do ponto à reta da perna, positiva do lado em que a pence está. */
  const ladoDaPence = Math.sign(l.x * (meio.y - ponta.y) - l.y * (meio.x - ponta.x));
  const daPerna = (p: Ponto2D): number => (l.x * (p.y - ponta.y) - l.y * (p.x - ponta.x)) * ladoDaPence;
  const passo = lado === 'antes' ? -1 : 1;
  const alcance = ALCANCE_DA_CAPA * distancia(a, b);
  const metade: Ponto2D[] = [];
  let anterior = ponta;
  let andado = 0;
  for (let k = 2; k < n - 1; k++) {
    const espelhado = naPerna(contorno[(((i + passo * k) % n) + n) % n]!);
    const [d0, d1] = [doEixo(anterior), doEixo(espelhado)];
    if (d0 * d1 <= 0 && d0 !== d1) {
      const f = d0 / (d0 - d1);
      const bico = ponto(anterior.x + (espelhado.x - anterior.x) * f, anterior.y + (espelhado.y - anterior.y) * f);
      // Atrás do vértice, ou longe demais da pence, não há bico.
      const doVertice = (bico.x - v.x) * eixo.x + (bico.y - v.y) * eixo.y;
      if (doVertice <= MESMO_PONTO_MM || andado + distancia(anterior, bico) > alcance) return null;
      const daPonta = [...metade, bico, ...metade.map(noEixo).reverse()];
      // A borda reta dá pontos em linha: só os que fazem canto ficam (o bico fica sempre).
      const fila = [ponta, ...daPonta, outra];
      const comCanto = daPonta.filter((p, j) => {
        if (p === bico) return true;
        const [antes, depois] = [fila[j]!, fila[j + 2]!];
        const comprimento = distancia(antes, depois);
        return comprimento < MESMO_PONTO_MM || Math.abs(((depois.x - antes.x) * (p.y - antes.y) - (depois.y - antes.y) * (p.x - antes.x)) / comprimento) > NA_RETA_DA_CAPA_MM;
      });
      return { pontos: lado === 'antes' ? comCanto : comCanto.reverse(), bico };
    }
    andado += distancia(anterior, espelhado);
    // A borda espelhada tem de vir por dentro da pence, e por perto dela.
    if (daPerna(espelhado) <= MESMO_PONTO_MM || andado > alcance) return null;
    metade.push(espelhado);
    anterior = espelhado;
  }
  return null;
}

/** O acabamento da pence dobrada para um lado; quando a dobra não alcança a borda, o contorno passa reto pelo meio das pontas. */
function capaDaPence(contorno: Contorno, i: number, lado: 'antes' | 'depois'): { readonly pontos: Ponto2D[]; readonly bico: Ponto2D } {
  const n = contorno.length;
  const meio = meioDe(contorno[(i - 1 + n) % n]!, contorno[(i + 1) % n]!);
  return dobraParaOLado(contorno, i, lado) ?? { pontos: [meio], bico: meio };
}

/**
 * O bico do acabamento sem lado de dobra: na linha do meio da pence, a meio
 * caminho entre os bicos das duas dobras possíveis. Só conta a dobra cujo bico
 * sai para fora da reta das pontas; sem nenhuma (bordas que fogem da pence),
 * o bico é o meio das pontas: a borda passa reta.
 */
function bicoDaPence(contorno: Contorno, i: number): Ponto2D {
  const n = contorno.length;
  const v = contorno[i]!;
  const meio = meioDe(contorno[(i - 1 + n) % n]!, contorno[(i + 1) % n]!);
  const ateOMeio = distancia(v, meio);
  // Os bicos das dobras estão na linha do meio: basta a distância de cada um ao vértice.
  const paraFora = (['antes', 'depois'] as const)
    .flatMap((lado) => {
      const dobra = dobraParaOLado(contorno, i, lado);
      return dobra ? [distancia(v, dobra.bico)] : [];
    })
    .filter((t) => t >= ateOMeio - MESMO_PONTO_MM);
  if (paraFora.length === 0) return meio;
  const t = paraFora.reduce((soma, valor) => soma + valor, 0) / paraFora.length;
  return ponto(v.x + ((meio.x - v.x) / ateOMeio) * t, v.y + ((meio.y - v.y) / ateOMeio) * t);
}

/** Para que lado a pence é dobrada na costura, de quem olha da borda para o vértice; 'meio' = sem lado. */
export type DobraDaPence = 'meio' | 'esquerda' | 'direita';

/** A ponta da pence (0 ou 2, em `pontos`) que fica do lado dado, de quem olha do meio das pontas para o vértice. */
function pontaDoLado(pence: PenceDaPeca, lado: 'esquerda' | 'direita'): 0 | 2 {
  const [a, v, b] = [pence.pontos[0]!, pence.pontos[1]!, pence.pontos[2]!];
  const meio = meioDe(a, b);
  // À esquerda de quem vai do meio ao vértice: o sentido anti-horário, no desenho e na tela.
  const aEsquerda = (v.x - meio.x) * (a.y - meio.y) - (v.y - meio.y) * (a.x - meio.x) > 0 ? 0 : 2;
  return lado === 'esquerda' ? aEsquerda : aEsquerda === 0 ? 2 : 0;
}

/** Para que lado a pence com acabamento foi dobrada, lido do registro ('meio' se ele não diz). */
export function dobraDaPence(pence: PenceDaPeca): DobraDaPence {
  if (pence.dobra === undefined) return 'meio';
  return pontaDoLado(pence, 'esquerda') === pence.dobra ? 'esquerda' : 'direita';
}

/**
 * A pence recortada (registrada) vira uma pence com acabamento: o recorte
 * volta a ser tecido, o contorno passa pelo bico e as pernas ficam desenhadas
 * como linha interna. O registro guarda o bico.
 *
 * `dobra` diz para que lado a pence é dobrada na costura, de quem olha da
 * borda para o vértice; com 'meio' (sem lado), o bico fica entre os dois.
 */
export function comAcabamento(molde: Molde, id: string, dobra: DobraDaPence = 'meio'): Molde {
  const pence = penceRegistrada(molde, id);
  if (pence.tipo !== 'recortada') throw new Error('O acabamento é para a pence recortada do contorno.');
  const i = verticeNoContorno(molde.contorno, pence);
  const n = molde.contorno.length;
  const anterior = molde.contorno[(i - 1 + n) % n]!;
  // A ponta que fica à esquerda de quem olha da borda (o meio das pontas) para o vértice.
  const pontaDaDobra = dobra === 'meio' ? null : pontaDoLado(pence, dobra);
  const lado = pontaDaDobra === null ? null : mesmoLugar(pence.pontos[pontaDaDobra]!, anterior) ? 'antes' : 'depois';
  // Dobrada para um lado, o acabamento acompanha a borda desse lado; sem lado, é o bico de um ponto só.
  const daDobra = lado === null ? null : capaDaPence(molde.contorno, i, lado);
  const bico = daDobra?.bico ?? bicoDaPence(molde.contorno, i);
  const capa = daDobra?.pontos ?? [bico];
  const contorno = molde.contorno.flatMap((p, k) => (k === i ? capa : [p]));
  // No registro, a capa vai da primeira ponta da pence para a segunda.
  const naOrdemDoRegistro = mesmoLugar(pence.pontos[0]!, anterior) ? capa : [...capa].reverse();
  if (!(area(contorno) > AREA_MINIMA_MM2)) throw new Error('A peça ficaria sem área com o acabamento dessa pence.');
  return {
    ...molde,
    contorno,
    linhasInternas: [...molde.linhasInternas, pence.pontos],
    piques: piquesQueFicamNoContorno(molde.piques, contorno),
    pences: (molde.pences ?? []).map((q) =>
      q.id === id
        ? { ...q, tipo: 'marcada' as const, bico, ...(pontaDaDobra === null ? {} : { dobra: pontaDaDobra }), ...(capa.length > 1 ? { capa: naOrdemDoRegistro } : {}) }
        : q,
    ),
  };
}

/** O contrário de `comAcabamento`: a pence com acabamento volta a ser recortada, com o vértice no contorno no lugar do bico. */
export function semAcabamento(molde: Molde, id: string): Molde {
  const pence = penceRegistrada(molde, id);
  const daCapa = pence.bico ? capaNoContorno(molde.contorno, pence) : null;
  if (!daCapa) throw new Error('Essa pence não tem acabamento.');
  // O vértice volta ao contorno no lugar do primeiro ponto do acabamento; os outros saem.
  const contorno = molde.contorno.flatMap((p, k) => (k === daCapa[0] ? [pence.pontos[1]!] : daCapa.includes(k) ? [] : [p]));
  const linhasInternas = [...molde.linhasInternas];
  const daPence = linhasInternas.findIndex((l) => mesmaLinha(l, pence.pontos));
  if (daPence >= 0) linhasInternas.splice(daPence, 1);
  const recortada: { -readonly [K in keyof PenceDaPeca]: PenceDaPeca[K] } = { ...pence, tipo: 'recortada' };
  delete recortada.bico;
  delete recortada.dobra;
  delete recortada.capa;
  return {
    ...molde,
    contorno,
    linhasInternas,
    piques: piquesQueFicamNoContorno(molde.piques, contorno),
    pences: (molde.pences ?? []).map((q) => (q.id === id ? recortada : q)),
  };
}

/** As pences registradas que continuam na peça como foram postas. */
export function pencesDaPeca(molde: Molde): PenceDaPeca[] {
  return (molde.pences ?? []).filter((pence) => penceEstaNaPeca(molde, pence));
}

/** A peça sem os registros de pence que deixaram de valer (o contorno ou a linha deles mudou). */
export function comPencesValidas(molde: Molde): Molde {
  if (!molde.pences) return molde;
  const validas = pencesDaPeca(molde);
  // Sem nenhuma pence, a peça fica sem o campo, como a que nunca teve.
  if (validas.length === 0) return semCampo(molde, 'pences');
  return validas.length === molde.pences.length ? molde : { ...molde, pences: validas };
}

/** A peça com mais uma pence registrada (os registros que já não valem saem). */
function comPence(molde: Molde, pence: PenceDaPeca): Molde {
  return { ...molde, pences: [...pencesDaPeca(molde), pence] };
}

/** O registro da pence recortada cujo vértice é `vertice`, entre os vizinhos dele no contorno; `null` se o ponto não está no contorno. */
function registroDoVertice(contorno: Contorno, vertice: Ponto2D, id: string, piques: readonly string[]): PenceDaPeca | null {
  const n = contorno.length;
  const i = contorno.findIndex((p) => mesmoLugar(p, vertice));
  if (i < 0) return null;
  return {
    id,
    tipo: 'recortada',
    pontos: [contorno[(i - 1 + n) % n]!, contorno[i]!, contorno[(i + 1) % n]!],
    removidos: [],
    ...(piques.length > 0 ? { piques } : {}),
  };
}

/** A que distância do contorno (mm) a ponta de uma linha interna ainda conta como estando nele. */
const PONTA_NO_CONTORNO_MM = 0.5;
/** Com as pernas mais abertas que isto (graus), o canto que entra na peça não é tratado como pence sem registro. */
const ANGULO_MAXIMO_DE_PENCE_GRAUS = 100;
/** A ponta que está, a menos disto (mm), na reta entre os vizinhos dela conta como posta pelo recorte. */
const NA_RETA_MM = 0.01;

/**
 * O pivô de uma pence aberta por pivô, se ele continua sobre o contorno (num
 * ponto ou numa aresta); `null` na pence que não foi aberta assim, ou se o
 * pivô já não está lá.
 */
export function pivoDaPence(molde: Molde, pence: PenceDaPeca): PosicaoNoContorno | null {
  if ((pence.tipo !== 'recortada' && pence.bico === undefined) || !pence.pivo) return null;
  const noContorno = pontoMaisProximoNoContorno(pence.pivo, molde.contorno);
  return noContorno.distancia <= NO_MESMO_LUGAR_MM ? { indiceAresta: noContorno.indiceAresta, ponto: noContorno.ponto } : null;
}

/** Os quatro cantos de uma linha interna fechada de quatro lados, ou `null` se ela não é isso. */
function cantosDoQuadrilatero(linha: readonly Ponto2D[]): readonly Ponto2D[] | null {
  return linha.length === 5 && mesmoLugar(linha[0]!, linha[4]!) ? linha.slice(0, 4) : null;
}

/** As duas voltas passam pelos mesmos quatro cantos, começando de onde for e num sentido ou no outro. */
function mesmaVolta(linha: readonly Ponto2D[], volta: readonly Ponto2D[]): boolean {
  const a = cantosDoQuadrilatero(linha);
  const b = cantosDoQuadrilatero(volta);
  if (!a || !b) return false;
  return [0, 1, 2, 3].some((inicio) => [1, -1].some((passo) => b.every((p, j) => mesmoLugar(a[(((inicio + passo * j) % 4) + 4) % 4]!, p))));
}

/**
 * O que, no desenho da peça, é uma pence e não tem registro — de um projeto
 * antigo, de uma peça importada ou desenhada à mão —, a até `raioMm` do
 * ponto. `do-contorno`: o canto que entra na peça (clicado no vértice, com as
 * pernas a até 100° uma da outra) ou a linha interna de três pontos com as
 * pontas no contorno. `interna`: a linha interna fechada de quatro lados.
 * Devolve o registro que ela passaria a ter, sem mudar a peça.
 */
export function penceSemRegistroPerto(molde: Molde, p: Ponto2D, raioMm: number, qual: 'do-contorno' | 'interna', id: string): PenceDaPeca | null {
  const registradas = pencesDaPeca(molde);
  let melhor: { pence: PenceDaPeca; distancia: number } | null = null;
  const candidata = (pence: PenceDaPeca, d: number): void => {
    if (d <= raioMm && (!melhor || d < melhor.distancia)) melhor = { pence, distancia: d };
  };
  if (qual === 'interna') {
    for (const linha of molde.linhasInternas) {
      const cantos = cantosDoQuadrilatero(linha);
      if (!cantos || registradas.some((q) => q.tipo === 'interna' && mesmaVolta(linha, voltaDoLosango(q)))) continue;
      // As pontas são os cantos da diagonal mais comprida.
      const [c0, c1, c2, c3] = cantos as readonly [Ponto2D, Ponto2D, Ponto2D, Ponto2D];
      const pontos = distancia(c0, c2) >= distancia(c1, c3) ? [c0, c1, c2, c3] : [c1, c2, c3, c0];
      const comEixo = molde.linhasInternas.some((l) => mesmaLinha(l, [pontos[0]!, pontos[2]!]));
      candidata({ id, tipo: 'interna', pontos, comEixo }, distanciaAteALinha(p, linha));
    }
    return melhor ? (melhor as { pence: PenceDaPeca }).pence : null;
  }
  const contorno = molde.contorno;
  const n = contorno.length;
  const naReta = (ponta: Ponto2D, de: Ponto2D, ate: Ponto2D): boolean => distanciaAteALinha(ponta, [de, ate]) <= NA_RETA_MM;
  contorno.forEach((v, i) => {
    if (distancia(p, v) > raioMm || !ehVerticeDePence(molde, i) || penceNoVertice(molde, i)) return;
    const a = contorno[(i - 1 + n) % n]!;
    const b = contorno[(i + 1) % n]!;
    const abertura = Math.abs((((anguloDe(v, a) - anguloDe(v, b)) % 360) + 540) % 360 - 180);
    if (abertura > ANGULO_MAXIMO_DE_PENCE_GRAUS) return;
    // A ponta que está na reta entre o vizinho dela e a outra ponta foi posta pelo recorte: sai com a pence.
    const antesDeA = contorno[(i - 2 + n) % n]!;
    const depoisDeB = contorno[(i + 2) % n]!;
    candidata(
      { id, tipo: 'recortada', pontos: [a, v, b], removidos: [], pontasCriadas: [n > 4 && naReta(a, antesDeA, b), n > 4 && naReta(b, a, depoisDeB)] },
      distancia(p, v),
    );
  });
  for (const linha of molde.linhasInternas) {
    if (linha.length !== 3 || registradas.some((q) => q.tipo === 'marcada' && mesmaLinha(linha, q.pontos))) continue;
    const pontasNoContorno = [linha[0]!, linha[2]!].every((ponta) => pontoMaisProximoNoContorno(ponta, contorno).distancia <= PONTA_NO_CONTORNO_MM);
    if (pontasNoContorno) candidata({ id, tipo: 'marcada', pontos: linha }, distanciaAteALinha(p, linha));
  }
  return melhor ? (melhor as { pence: PenceDaPeca }).pence : null;
}

/**
 * A peça com a pence reconhecida (`penceSemRegistroPerto`) registrada: o
 * desenho não muda, e ela passa a aceitar as medidas, como as feitas por
 * ferramenta.
 */
export function comPenceReconhecida(molde: Molde, pence: PenceDaPeca): Molde {
  if (pence.tipo !== 'interna') return comPence(molde, pence);
  // O losango fica desenhado a partir da ponta 1, como o da ferramenta: é assim que o registro o reconhece.
  const volta = voltaDoLosango(pence);
  const onde = molde.linhasInternas.findIndex((l) => mesmaVolta(l, volta));
  if (onde < 0) return molde;
  return comPence({ ...molde, linhasInternas: molde.linhasInternas.map((l, i) => (i === onde ? volta : l)) }, pence);
}

/** A pence recortada registrada cujo vértice é o ponto `indice` do contorno, ou `null`. */
export function penceNoVertice(molde: Molde, indice: number): PenceDaPeca | null {
  return pencesDaPeca(molde).find((pence) => pence.tipo === 'recortada' && verticeNoContorno(molde.contorno, pence) === indice) ?? null;
}

/** A pence registrada que passa mais perto do ponto, a até `raioMm` dele. */
export function pencePerto(molde: Molde, p: Ponto2D, raioMm: number): PenceDaPeca | null {
  let melhor: { pence: PenceDaPeca; distancia: number } | null = null;
  for (const pence of pencesDaPeca(molde)) {
    const d = distanciaAteALinha(p, pence.tipo === 'interna' ? voltaDoLosango(pence) : pence.pontos);
    if (d <= raioMm && (!melhor || d < melhor.distancia)) melhor = { pence, distancia: d };
  }
  return melhor ? melhor.pence : null;
}

export interface MedidasDaPence {
  /** De uma ponta à outra, em linha reta (mm). */
  readonly aberturaMm: number;
  /** Do meio das pontas até o vértice, em esquadro com a linha que as liga (mm). */
  readonly profundidadeMm: number;
  /** Quanto o vértice está fora do esquadro, para o lado da segunda ponta (mm; negativo, para o da primeira). */
  readonly desvioMm: number;
}

/** O meio das pontas, a direção de uma à outra e a direção em esquadro, para o lado do vértice. */
function eixosDaPence(pence: PenceDaPeca): { readonly meio: Ponto2D; readonly aoLongo: Ponto2D; readonly paraOVertice: Ponto2D } {
  const [a, v, b] = pence.pontos as readonly [Ponto2D, Ponto2D, Ponto2D];
  const meio = meioDe(a, b);
  const aoLongo = unitario(a, b);
  const lado = (v.x - meio.x) * -aoLongo.y + (v.y - meio.y) * aoLongo.x < 0 ? -1 : 1;
  return { meio, aoLongo, paraOVertice: ponto(-aoLongo.y * lado, aoLongo.x * lado) };
}

/** As medidas de uma pence do contorno (recortada ou marcada), lidas dos pontos dela. */
export function medidasDaPence(pence: PenceDaPeca): MedidasDaPence {
  if (pence.tipo === 'interna') throw new Error('A pence interna tem outras medidas: as alturas e a largura.');
  const [a, v, b] = pence.pontos as readonly [Ponto2D, Ponto2D, Ponto2D];
  const { meio, aoLongo, paraOVertice } = eixosDaPence(pence);
  const doMeio = ponto(v.x - meio.x, v.y - meio.y);
  // Zero é zero: a conta pode dar "-0", que não deve aparecer em lugar nenhum.
  const semSinalNoZero = (valor: number): number => (valor === 0 ? 0 : valor);
  return {
    aberturaMm: distancia(a, b),
    profundidadeMm: semSinalNoZero(doMeio.x * paraOVertice.x + doMeio.y * paraOVertice.y),
    desvioMm: semSinalNoZero(doMeio.x * aoLongo.x + doMeio.y * aoLongo.y),
  };
}

/** As medidas de uma pence interna, lidas do losango dela. */
export function medidasDaPenceInterna(pence: PenceDaPeca): { readonly altura1Mm: number; readonly altura2Mm: number; readonly larguraMm: number } {
  if (pence.tipo !== 'interna') throw new Error('Essa pence não é interna.');
  const [ponta1, lado1, ponta2, lado2] = pence.pontos as readonly [Ponto2D, Ponto2D, Ponto2D, Ponto2D];
  const centro = meioDe(lado1, lado2);
  return { altura1Mm: distancia(centro, ponta1), altura2Mm: distancia(centro, ponta2), larguraMm: distancia(lado1, lado2) };
}

function penceRegistrada(molde: Molde, id: string): PenceDaPeca {
  const pence = pencesDaPeca(molde).find((q) => q.id === id);
  if (!pence) throw new Error('Essa pence foi mexida à mão e já não pode ser mudada pelas medidas.');
  return pence;
}

/**
 * A peça sem a pence: recortada, o contorno volta a ser o de antes do recorte;
 * marcada ou interna, as linhas dela saem. Os piques e as marcas que vieram
 * com a pence saem também.
 */
export function removerPence(molde: Molde, id: string): Molde {
  const pence = penceRegistrada(molde, id);
  // A pence com acabamento sai como a recortada que ela seria: o bico vai embora com ela.
  if (pence.bico) return removerPence(semAcabamento(molde, id), id);
  const piquesDela = new Set(pence.piques ?? []);
  const marcasDela = new Set(pence.marcas ?? []);
  const semAcessorios: Molde = {
    ...molde,
    pences: (molde.pences ?? []).filter((q) => q.id !== id),
    piques: molde.piques.filter((q) => !piquesDela.has(q.id)),
    marcas: molde.marcas.filter((m) => !marcasDela.has(m.id)),
  };
  if (pence.tipo === 'recortada') {
    const contorno = molde.contorno;
    const n = contorno.length;
    const i = verticeNoContorno(contorno, pence);
    // A pence aberta por pivô fecha em torno dele: a peça volta a ser a de antes de abrir.
    const pivo = pivoDaPence(molde, pence);
    if (pivo) return fecharPence(semAcessorios, i, pivo);
    // Os pontos que o recorte tinha tirado voltam, na ordem em que o contorno passa pelas pontas.
    const naOrdem = mesmoLugar(contorno[(i - 1 + n) % n]!, pence.pontos[0]!);
    const devolvidos = naOrdem ? [...(pence.removidos ?? [])] : [...(pence.removidos ?? [])].reverse();
    // As pontas que o recorte pôs no contorno saem com ele; as que já eram pontos do contorno ficam.
    const [criouAPrimeira, criouASegunda] = pence.pontasCriadas ?? [false, false];
    const saem = [...(criouAPrimeira ? [pence.pontos[0]!] : []), ...(criouASegunda ? [pence.pontos[2]!] : [])];
    const restaurado = [...contorno.slice(0, i), ...devolvidos, ...contorno.slice(i + 1)].filter((p) => !saem.some((q) => mesmoLugar(p, q)));
    if (restaurado.length < 3 || !(area(restaurado) > AREA_MINIMA_MM2)) throw new Error('A peça ficaria sem área sem essa pence.');
    return comPencesValidas({ ...semAcessorios, contorno: restaurado, piques: piquesQueFicamNoContorno(semAcessorios.piques, restaurado) });
  }
  const linhasDela = pence.tipo === 'marcada' ? [pence.pontos] : [voltaDoLosango(pence), ...(pence.comEixo ? [[pence.pontos[0]!, pence.pontos[2]!]] : [])];
  // Sai uma linha interna para cada linha da pence (a primeira que casa), e só ela.
  const linhasInternas = [...semAcessorios.linhasInternas];
  for (const linha of linhasDela) {
    const onde = linhasInternas.findIndex((l) => mesmaLinha(l, linha));
    if (onde >= 0) linhasInternas.splice(onde, 1);
  }
  return comPencesValidas({ ...semAcessorios, linhasInternas });
}

/**
 * Muda as medidas de uma pence do contorno já feita: ela é tirada e refeita
 * no mesmo lugar, com a abertura, a profundidade e o desvio do vértice dados.
 * Continua recortada ou marcada, com os piques e a marca que tinha.
 */
export function alterarPence(molde: Molde, id: string, medidas: MedidasDaPence, novoId: () => string, dobraNova?: DobraDaPence): Molde {
  const pence = penceRegistrada(molde, id);
  if (pence.tipo === 'interna') throw new Error('A pence interna muda pelas alturas e pela largura.');
  if (pence.bico) {
    // Com acabamento: muda como a recortada que ela seria, e o bico é refeito para as medidas novas.
    const dobra = dobraNova ?? dobraDaPence(pence);
    const mudada = alterarPence(semAcabamento(molde, id), id, medidas, novoId);
    const nova = pencesDaPeca(mudada).at(-1);
    return nova && nova.tipo === 'recortada' ? comAcabamento(mudada, nova.id, dobra) : mudada;
  }
  conferirMedidasDaPence(medidas.aberturaMm, medidas.profundidadeMm);
  if (!Number.isFinite(medidas.desvioMm)) throw new Error('O desvio do vértice precisa ser um número.');
  const pivo = pivoDaPence(molde, pence);
  if (pivo) {
    // Aberta por pivô: fecha em torno dele e abre de novo, com as medidas novas, a partir de onde as pontas se encontraram.
    const fechada = removerPence(molde, id);
    const encontro = [pence.pontos[0]!, pence.pontos[2]!]
      .map((ponta) => pontoMaisProximoNoContorno(ponta, fechada.contorno))
      .sort((a, b) => a.distancia - b.distancia)[0]!;
    const pivoDepois = pontoMaisProximoNoContorno(pivo.ponto, fechada.contorno);
    if (encontro.distancia > PONTA_NO_CONTORNO_MM || pivoDepois.distancia > NO_MESMO_LUGAR_MM) {
      throw new Error('Essa pence já não fecha em torno do pivô em que foi aberta: mude-a pelo recorte, com Fechar pence e Pence no contorno.');
    }
    return abrirPence(
      fechada,
      { indiceAresta: encontro.indiceAresta, ponto: encontro.ponto },
      { indiceAresta: pivoDepois.indiceAresta, ponto: pivoDepois.ponto },
      medidas.aberturaMm,
      medidas.profundidadeMm,
      (pence.piques?.length ?? 0) > 0,
      novoId,
      (pence.marcas?.length ?? 0) > 0,
    );
  }
  const [a, , b] = pence.pontos as readonly [Ponto2D, Ponto2D, Ponto2D];
  const semEla = removerPence(molde, id);
  const contorno = semEla.contorno;
  const noContorno = (p: Ponto2D): PosicaoNoContorno => {
    const perto = pontoMaisProximoNoContorno(p, contorno);
    return { indiceAresta: perto.indiceAresta, ponto: perto.ponto };
  };
  // O centro da pence é o ponto do contorno a meio caminho, sobre ele, entre as duas pontas: é onde ela foi posta.
  const adiante = comprimentoDaLinha(trechoDoContorno(contorno, noContorno(a), noContorno(b)));
  const paraTras = comprimentoDaLinha(trechoDoContorno(contorno, noContorno(b), noContorno(a)));
  const centro = adiante <= paraTras ? andarNoContorno(contorno, noContorno(a), adiante / 2) : andarNoContorno(contorno, noContorno(a), -paraTras / 2);
  // O vértice fica à profundidade e ao desvio pedidos em relação à reta entre as pontas NOVAS: são as medidas que a pence passa a ter.
  const pontas = pontasDaPence(contorno, centro, medidas.aberturaMm);
  const meio = meioDe(pontas.inicio.ponto, pontas.fim.ponto);
  const aoLongo = unitario(pontas.inicio.ponto, pontas.fim.ponto);
  const sentido = sentidoDe(contorno);
  const paraDentro = ponto(-aoLongo.y * sentido, aoLongo.x * sentido);
  const vertice = ponto(
    meio.x + paraDentro.x * medidas.profundidadeMm + aoLongo.x * medidas.desvioMm,
    meio.y + paraDentro.y * medidas.profundidadeMm + aoLongo.y * medidas.desvioMm,
  );
  return criarPence(
    semEla,
    centro,
    {
      aberturaMm: medidas.aberturaMm,
      // A profundidade pedida é em esquadro; com desvio, o vértice fica um pouco mais longe do meio.
      profundidadeMm: Math.hypot(medidas.profundidadeMm, medidas.desvioMm),
      modo: pence.tipo === 'marcada' ? 'marcar' : 'recortar',
      piquesLaterais: (pence.piques?.length ?? 0) > 0,
      marcaNoVertice: (pence.marcas?.length ?? 0) > 0,
    },
    novoId,
    vertice,
  );
}

/** Muda as medidas de uma pence interna já feita: o losango é refeito no mesmo centro e com o mesmo eixo. */
export function alterarPenceInterna(
  molde: Molde,
  id: string,
  medidas: { readonly altura1Mm: number; readonly altura2Mm: number; readonly larguraMm: number },
  novoId: () => string,
): Molde {
  const pence = penceRegistrada(molde, id);
  if (pence.tipo !== 'interna') throw new Error('Essa pence não é interna.');
  const [ponta1, lado1, ponta2, lado2] = pence.pontos as readonly [Ponto2D, Ponto2D, Ponto2D, Ponto2D];
  const centro = meioDe(lado1, lado2);
  // O giro do eixo em relação à linha de fio de agora, para o losango novo ficar na mesma direção.
  const anguloGraus = anguloDe(ponta2, ponta1) - anguloDe(molde.linhaDeFio.inicio, molde.linhaDeFio.fim);
  return criarPenceInterna(
    removerPence(molde, id),
    centro,
    { ...medidas, anguloGraus, linhaAuxiliar: pence.comEixo === true, marcas: (pence.marcas?.length ?? 0) > 0 },
    novoId,
  );
}

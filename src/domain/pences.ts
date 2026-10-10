import {
  andarNoContorno,
  area,
  areaAssinada,
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
import { piquesQueFicamNoContorno, type Marca, type Molde, type Pique } from './molde';
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
 * Onde ficam as pontas e o vértice de uma pence centrada em `posicao`: as
 * pontas a meia abertura de cada lado, andando sobre o contorno, e o vértice
 * à profundidade pedida — em esquadro com a linha que liga as pontas ou, com
 * `apontarPara`, na direção desse ponto.
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
  if (aberturaMm >= perimetro(contorno) / 2) throw new Error('A abertura da pence é grande demais para esse contorno.');
  const inicio = andarNoContorno(contorno, posicao, -aberturaMm / 2);
  const fim = andarNoContorno(contorno, posicao, aberturaMm / 2);
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
  if (opcoes.modo === 'marcar') {
    const marcas: Marca[] = opcoes.marcaNoVertice ? [{ id: novoId(), posicao: vertice }] : [];
    return {
      ...molde,
      linhasInternas: [...molde.linhasInternas, [inicio.ponto, vertice, fim.ponto]],
      piques: [...molde.piques, ...(opcoes.piquesLaterais ? piquesEm(pontas, molde.contorno, novoId) : [])],
      marcas: [...molde.marcas, ...marcas],
    };
  }
  const contorno = substituirTrechoDoContorno(molde.contorno, inicio, fim, [vertice]);
  if (contorno.length < 3 || !(area(contorno) > AREA_MINIMA_MM2)) {
    throw new Error('A pence não cabe nessa peça com essas medidas.');
  }
  return {
    ...molde,
    contorno,
    piques: [
      ...piquesQueFicamNoContorno(molde.piques, contorno),
      ...(opcoes.piquesLaterais ? piquesEm(pontas, contorno, novoId) : []),
    ],
  };
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
 */
export function abrirPence(
  molde: Molde,
  posicao: PosicaoNoContorno,
  pivo: PosicaoNoContorno,
  aberturaMm: number,
  profundidadeMm: number,
  piquesLaterais: boolean,
  novoId: () => string,
): Molde {
  conferirMedidasDaPence(aberturaMm, profundidadeMm);
  const p = posicao.ponto;
  const q = pivo.ponto;
  if (distancia(p, q) < MESMO_PONTO_MM) throw new Error('O pivô precisa ser outro ponto do contorno, do lado oposto ao da pence.');
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
  return {
    ...base,
    contorno: novoContorno,
    piques: [
      ...piquesQueFicamNoContorno(base.piques, novoContorno),
      ...(piquesLaterais ? piquesEm([p, outraBorda], novoContorno, novoId) : []),
    ],
  };
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
  return { ...molde, linhasInternas: [...molde.linhasInternas, ...linhas], marcas: [...molde.marcas, ...marcas] };
}

/** A pence recortada cujo vértice é o ponto `indice` do contorno: as duas pontas (os pontos vizinhos) e o vértice. */
interface PenceRecortada {
  readonly inicio: PosicaoNoContorno;
  readonly vertice: Ponto2D;
  readonly fim: PosicaoNoContorno;
}

function penceRecortadaEm(molde: Molde, indice: number): PenceRecortada {
  const contorno = molde.contorno;
  const n = contorno.length;
  if (!Number.isInteger(indice) || indice < 0 || indice >= n) throw new Error('Ponto fora do contorno da peça.');
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
  return { inicio: { indiceAresta: indiceDoInicio, ponto: a }, vertice: v, fim: { indiceAresta: indiceDoFim, ponto: b } };
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
 */
export function transferirPence(molde: Molde, indice: number, novaPosicao: PosicaoNoContorno): Molde {
  const { inicio, vertice, fim } = penceRecortadaEm(molde, indice);
  const nova = novaPosicao.ponto;
  if (distanciaAteALinha(nova, [inicio.ponto, vertice, fim.ponto]) < MESMO_PONTO_MM) {
    throw new Error('Indique a nova posição fora da pence atual.');
  }
  exigirLinhaPorDentro(molde, vertice, nova, 'A linha do vértice da pence até a nova posição');
  const contorno = molde.contorno;
  const depoisDaPence = trechoDoContorno(contorno, fim, novaPosicao);
  const antesDaPence = trechoDoContorno(contorno, novaPosicao, inicio);
  const regioes = [
    [vertice, ...depoisDaPence],
    [vertice, ...antesDaPence],
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
  return { ...base, contorno: novoContorno, piques: piquesQueFicamNoContorno(base.piques, novoContorno) };
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
export function fecharPence(molde: Molde, indice: number, pivo: PosicaoNoContorno | null): Molde {
  const { inicio, vertice, fim } = penceRecortadaEm(molde, indice);
  const contorno = molde.contorno;
  if (!pivo) {
    const semVertice = contorno.filter((_, i) => i !== indice);
    if (semVertice.length < 3 || !(area(semVertice) > AREA_MINIMA_MM2)) throw new Error('A peça ficaria sem área sem essa pence.');
    return {
      ...molde,
      contorno: semVertice,
      linhasInternas: [...molde.linhasInternas, [inicio.ponto, vertice, fim.ponto]],
      piques: piquesQueFicamNoContorno(molde.piques, semVertice),
    };
  }
  const centro = pivo.ponto;
  if (distanciaAteALinha(centro, [inicio.ponto, vertice, fim.ponto]) < MESMO_PONTO_MM) {
    throw new Error('O pivô precisa ficar fora da pence, do outro lado da peça.');
  }
  exigirLinhaPorDentro(molde, vertice, centro, 'A linha do vértice da pence até o pivô');
  const depoisDaPence = trechoDoContorno(contorno, fim, pivo);
  const antesDaPence = trechoDoContorno(contorno, pivo, inicio);
  const regioes = [
    [vertice, ...depoisDaPence],
    [vertice, ...antesDaPence],
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
  return { ...base, contorno: novoContorno, piques: piquesQueFicamNoContorno(base.piques, novoContorno) };
}

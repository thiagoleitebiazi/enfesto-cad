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
import { piquesQueFicamNoContorno, semCampo, type Marca, type Molde, type PenceDaPeca, type Pique } from './molde';
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
  // O que o recorte tirou do contorno, de uma ponta à outra: volta se a pence for apagada ou mudar de medida.
  const removidos = trechoDoContorno(molde.contorno, inicio, fim).filter((p) => !mesmoLugar(p, inicio.ponto) && !mesmoLugar(p, fim.ponto));
  const jaEraPonto = (p: Ponto2D): boolean => molde.contorno.some((v) => mesmoLugar(v, p));
  return comPence(
    { ...molde, contorno, piques: [...piquesQueFicamNoContorno(molde.piques, contorno), ...piques] },
    {
      id: novoId(),
      tipo: 'recortada',
      pontos,
      removidos,
      pontasCriadas: [!jaEraPonto(inicio.ponto), !jaEraPonto(fim.ponto)],
      piques: piques.map((q) => q.id),
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
  const piques = piquesLaterais ? piquesEm([p, outraBorda], novoContorno, novoId) : [];
  const aberta = { ...base, contorno: novoContorno, piques: [...piquesQueFicamNoContorno(base.piques, novoContorno), ...piques] };
  const registro = registroDoVertice(novoContorno, vertice, novoId(), piques.map((q) => q.id));
  return registro ? comPence(aberta, registro) : comPencesValidas(aberta);
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
export function fecharPence(molde: Molde, indice: number, pivo: PosicaoNoContorno | null): Molde {
  const { inicio, vertice, fim } = penceRecortadaEm(molde, indice);
  const contorno = molde.contorno;
  if (!pivo) {
    const semVertice = contorno.filter((_, i) => i !== indice);
    if (semVertice.length < 3 || !(area(semVertice) > AREA_MINIMA_MM2)) throw new Error('A peça ficaria sem área sem essa pence.');
    const pontos = [inicio.ponto, vertice, fim.ponto];
    const antiga = penceNoVertice(molde, indice);
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
  return molde.linhasInternas.some((l) => mesmaLinha(l, linha));
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
export function alterarPence(molde: Molde, id: string, medidas: MedidasDaPence, novoId: () => string): Molde {
  const pence = penceRegistrada(molde, id);
  if (pence.tipo === 'interna') throw new Error('A pence interna muda pelas alturas e pela largura.');
  conferirMedidasDaPence(medidas.aberturaMm, medidas.profundidadeMm);
  if (!Number.isFinite(medidas.desvioMm)) throw new Error('O desvio do vértice precisa ser um número.');
  const { meio, aoLongo, paraOVertice } = eixosDaPence(pence);
  const vertice = ponto(
    meio.x + paraOVertice.x * medidas.profundidadeMm + aoLongo.x * medidas.desvioMm,
    meio.y + paraOVertice.y * medidas.profundidadeMm + aoLongo.y * medidas.desvioMm,
  );
  const semEla = removerPence(molde, id);
  const centro = pontoMaisProximoNoContorno(meio, semEla.contorno);
  return criarPence(
    semEla,
    { indiceAresta: centro.indiceAresta, ponto: centro.ponto },
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

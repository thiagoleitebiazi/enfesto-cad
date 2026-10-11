import {
  area,
  areaAssinada,
  distancia,
  pontoDentroDoContorno,
  pontoMaisProximoNoContorno,
  retanguloEnvolvente,
  rotacionar,
  segmentosSeIntersectam,
  trechoDoContorno,
  type Contorno,
  type Ponto2D,
  type PosicaoNoContorno,
} from '../core/geometria';
import { ancoraDoRotulo, type Cota } from './cota';
import { contornoDoTamanho, definirRegra, deslocamentosDoContorno, semPontosSoltos, type Graduacao } from './graduacao';
import {
  piquesQueFicamNoContorno,
  rotacionarMolde,
  semCampo,
  transladarMolde,
  type LinhaDeFio,
  type MetadeGuardada,
  type Molde,
  type Pique,
} from './molde';

/**
 * Operações que cortam, dobram e unem moldes inteiros (grupos "Cortar e
 * Unir" e "Complementar moldes" da aba Produção). Trabalham sobre o contorno
 * fechado da peça: o corte é uma reta entre dois pontos do contorno, e a
 * união cola duas peças por uma aresta de cada.
 */

/** Dois pontos a menos disso (mm) são o mesmo. */
const MESMO_PONTO_MM = 1e-6;
/** Quanto (mm) a reta de corte é encurtada em cada ponta para o teste de cruzamento não acusar os próprios extremos. */
const FOLGA_DAS_PONTAS_DO_CORTE_MM = 0.01;
const AREA_MINIMA_DE_UMA_PARTE_MM2 = 1e-6;
/** A seta do fio que não cabe na parte encolhe por este fator, até este número de vezes. */
const FATOR_DE_REDUCAO_DO_FIO = 0.75;
const REDUCOES_DO_FIO = 12;
/** Um vértice a menos disso (mm) da reta de dobra conta como estando sobre ela. */
const TOLERANCIA_DA_DOBRA_MM = 1e-6;
/**
 * Ao procurar onde uma reta cruza o contorno, o ponto dele a menos disso (mm)
 * da reta é o cruzamento: um milésimo de milímetro. Nos moldes reais, a reta
 * "pelo meio" passa a nanômetros de um ponto do contorno sem acertá-lo nas
 * contas; sem essa folga, nascia um ponto novo colado no que já existia.
 */
const VERTICE_NA_RETA_MM = 1e-3;

function ponto(x: number, y: number): Ponto2D {
  return { x, y };
}

function arestas(contorno: Contorno): Array<readonly [Ponto2D, Ponto2D]> {
  return contorno.map((p, i) => [p, contorno[(i + 1) % contorno.length]!] as const);
}

/**
 * Recusa o corte que não é uma linha inteira por dentro da peça, de um ponto
 * do contorno a outro: a reta de `a` a `b` ou, com `miolo`, a linha que passa
 * por esses pontos no caminho (o corte por uma curva ou por vários elementos).
 */
export function exigirCorteValido(molde: Molde, a: Ponto2D, b: Ponto2D, miolo: readonly Ponto2D[] = []): void {
  if (distancia(a, b) < FOLGA_DAS_PONTAS_DO_CORTE_MM * 4) {
    throw new Error('O corte precisa de dois pontos diferentes do contorno.');
  }
  const oQue = miolo.length > 0 ? 'A linha de corte' : 'A reta de corte';
  const linha = [a, ...miolo, b];
  const ultimo = linha.length - 2;
  // Cada trecho da linha; o primeiro e o último, encurtados na ponta que está no contorno.
  const trechos = linha.slice(1).map((ate, i) => {
    const de = linha[i]!;
    const comprimento = distancia(de, ate);
    if (comprimento < FOLGA_DAS_PONTAS_DO_CORTE_MM * 4) throw new Error('A linha de corte tem dois pontos seguidos no mesmo lugar.');
    const k = FOLGA_DAS_PONTAS_DO_CORTE_MM / comprimento;
    return {
      de: i === 0 ? ponto(de.x + (ate.x - de.x) * k, de.y + (ate.y - de.y) * k) : de,
      ate: i === ultimo ? ponto(ate.x + (de.x - ate.x) * k, ate.y + (de.y - ate.y) * k) : ate,
      meio: ponto((de.x + ate.x) / 2, (de.y + ate.y) / 2),
    };
  });
  const cruza = (contorno: Contorno): boolean => trechos.some((t) => arestas(contorno).some(([p, q]) => segmentosSeIntersectam(t.de, t.ate, p, q)));
  if (trechos.some((t) => !pontoDentroDoContorno(t.meio, molde.contorno)) || cruza(molde.contorno)) {
    throw new Error(`${oQue} precisa ficar toda dentro da peça, de um ponto do contorno a outro.`);
  }
  if (molde.furos.some(cruza)) {
    throw new Error(`${oQue} passa por um furo da peça.`);
  }
  // Dois trechos que não são vizinhos não podem se encontrar.
  if (trechos.some((t, i) => trechos.some((u, j) => j > i + 1 && segmentosSeIntersectam(t.de, t.ate, u.de, u.ate)))) {
    throw new Error('A linha de corte cruza a si mesma.');
  }
}

/** Dos contornos dados, o que contém o ponto ou, se nenhum contém, o que passa mais perto dele. */
function contornoMaisProximo(p: Ponto2D, contornos: readonly Contorno[]): number {
  const dentro = contornos.findIndex((c) => pontoDentroDoContorno(p, c));
  if (dentro >= 0) return dentro;
  let melhor = 0;
  let menor = Infinity;
  contornos.forEach((c, i) => {
    const d = pontoMaisProximoNoContorno(p, c).distancia;
    if (d < menor) {
      menor = d;
      melhor = i;
    }
  });
  return melhor;
}

/**
 * A linha de fio da parte: a original, se cabe inteira nela; senão, a mesma
 * seta levada ao meio da parte. Se nem no meio ela cabe (a parte é mais curta
 * que a seta, ou tem uma reentrância ali), a seta encolhe em torno do meio
 * dela, sem mudar de direção, até caber.
 */
export function fioDaParte(fio: LinhaDeFio, contorno: Contorno): LinhaDeFio {
  const cabe = (seta: LinhaDeFio): boolean => pontoDentroDoContorno(seta.inicio, contorno) && pontoDentroDoContorno(seta.fim, contorno);
  if (cabe(fio)) return fio;
  const caixa = retanguloEnvolvente(contorno);
  const meio = ponto((caixa.minX + caixa.maxX) / 2, (caixa.minY + caixa.maxY) / 2);
  const dx = meio.x - (fio.inicio.x + fio.fim.x) / 2;
  const dy = meio.y - (fio.inicio.y + fio.fim.y) / 2;
  const noMeio: LinhaDeFio = { inicio: ponto(fio.inicio.x + dx, fio.inicio.y + dy), fim: ponto(fio.fim.x + dx, fio.fim.y + dy) };
  // Sem o meio dentro da parte não há em torno do que encolher: a seta fica no meio, como sempre.
  if (cabe(noMeio) || !pontoDentroDoContorno(meio, contorno)) return noMeio;
  let fator = 1;
  for (let vez = 0; vez < REDUCOES_DO_FIO; vez++) {
    fator *= FATOR_DE_REDUCAO_DO_FIO;
    const menor: LinhaDeFio = {
      inicio: ponto(meio.x + (noMeio.inicio.x - meio.x) * fator, meio.y + (noMeio.inicio.y - meio.y) * fator),
      fim: ponto(meio.x + (noMeio.fim.x - meio.x) * fator, meio.y + (noMeio.fim.y - meio.y) * fator),
    };
    if (cabe(menor)) return menor;
  }
  return noMeio;
}

/**
 * As duas partes em que a reta de `a` a `b` divide a peça, cada uma com o que
 * é dela: os furos, as linhas internas e as marcas que ficam do lado dela, os
 * piques das arestas que herdou e as cotas mais próximas. A linha de fio vai
 * com cada parte (no lugar, se cabe; senão, no meio dela). Com `miolo`, o
 * corte não é reto: passa por esses pontos, de `a` para `b`.
 */
function partesDoCorte(molde: Molde, a: PosicaoNoContorno, b: PosicaoNoContorno, miolo: readonly Ponto2D[] = []): readonly [Molde, Molde] {
  exigirCorteValido(molde, a.ponto, b.ponto, miolo);
  // Cada parte fecha pela linha do corte: a primeira volta de `b` para `a`; a segunda vai de `a` para `b`.
  const contornos = [
    [...trechoDoContorno(molde.contorno, a, b), ...[...miolo].reverse()],
    [...trechoDoContorno(molde.contorno, b, a), ...miolo],
  ] as const;
  if (contornos.some((c) => c.length < 3 || !(area(c) > AREA_MINIMA_DE_UMA_PARTE_MM2))) {
    throw new Error('O corte deixaria uma das partes sem área.');
  }
  const ladoDe = (p: Ponto2D): number => contornoMaisProximo(p, contornos);
  const partes = contornos.map((contorno, lado): Molde => {
    const cotas = (molde.cotas ?? []).filter((c) => ladoDe(ancoraDoRotulo(c)) === lado);
    return {
      ...molde,
      contorno,
      furos: molde.furos.filter((f) => ladoDe(f[0]!) === lado),
      linhasInternas: molde.linhasInternas.filter((l) => ladoDe(l[0]!) === lado),
      marcas: molde.marcas.filter((m) => ladoDe(m.posicao) === lado),
      piques: piquesQueFicamNoContorno(molde.piques, contorno),
      linhaDeFio: fioDaParte(molde.linhaDeFio, contorno),
      ...(molde.cotas ? { cotas } : {}),
    };
  });
  return [partes[0]!, partes[1]!];
}

/**
 * "Cortar": divide a peça em duas pela reta entre dois pontos do contorno
 * (ou, com `miolo`, pela linha que passa por esses pontos). A parte maior
 * continua sendo a peça (mesmo id e nome); a outra é uma peça nova, com o id
 * dado e o nome seguido de "(2)".
 */
export function cortarMolde(molde: Molde, a: PosicaoNoContorno, b: PosicaoNoContorno, novoId: string, miolo: readonly Ponto2D[] = []): readonly [Molde, Molde] {
  const [p0, p1] = partesDoCorte(molde, a, b, miolo);
  const [maior, menor] = area(p0.contorno) >= area(p1.contorno) ? [p0, p1] : [p1, p0];
  return [maior, { ...menor, id: novoId, nome: `${molde.nome} (2)` }];
}

/**
 * A parte da peça que fica de um lado da reta de corte: a que contém o ponto
 * clicado (`ladoClicado` = 'fica') ou a outra ('sai'). Serve a "Dobrar" (fica
 * o lado clicado) e a "Remover região" (sai o lado clicado). A peça continua
 * sendo ela mesma. Com `miolo`, a linha não é reta: passa por esses pontos.
 */
export function metadeDoMolde(
  molde: Molde,
  a: PosicaoNoContorno,
  b: PosicaoNoContorno,
  pontoDoLado: Ponto2D,
  ladoClicado: 'fica' | 'sai',
  miolo: readonly Ponto2D[] = [],
): Molde {
  const partes = partesDoCorte(molde, a, b, miolo);
  const clicada = partes.findIndex((p) => pontoDentroDoContorno(pontoDoLado, p.contorno));
  if (clicada < 0) {
    throw new Error(
      ladoClicado === 'fica' ? 'Clique dentro da peça, do lado que deve ficar.' : 'Clique dentro da peça, do lado que deve sair.',
    );
  }
  return partes[ladoClicado === 'fica' ? clicada : 1 - clicada]!;
}

/** Onde a reta que passa por `p` e `q` cruza (ou toca) o contorno, na ordem dos pontos dele. */
export function cruzamentosDaReta(contorno: Contorno, p: Ponto2D, q: Ponto2D): PosicaoNoContorno[] {
  const comprimento = distancia(p, q);
  if (comprimento < MESMO_PONTO_MM) return [];
  const n = contorno.length;
  // Distância (com sinal) de cada ponto do contorno à reta.
  const d = contorno.map((v) => ((q.x - p.x) * (v.y - p.y) - (q.y - p.y) * (v.x - p.x)) / comprimento);
  const cruzamentos: PosicaoNoContorno[] = [];
  for (let i = 0; i < n; i++) {
    const d0 = d[i]!;
    const d1 = d[(i + 1) % n]!;
    if (Math.abs(d0) <= VERTICE_NA_RETA_MM) {
      cruzamentos.push({ indiceAresta: i, ponto: contorno[i]! });
    } else if (Math.abs(d1) > VERTICE_NA_RETA_MM && d0 * d1 < 0) {
      const t = d0 / (d0 - d1);
      const a = contorno[i]!;
      const b = contorno[(i + 1) % n]!;
      cruzamentos.push({ indiceAresta: i, ponto: ponto(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t) });
    }
  }
  return cruzamentos;
}

/** As duas pontas da dobra feita pela reta que passa por `p` e `q`; recusa a reta que não cruza o contorno em exatamente dois pontos. */
function pontasDaDobra(contorno: Contorno, p: Ponto2D, q: Ponto2D): readonly [PosicaoNoContorno, PosicaoNoContorno] {
  const cruzamentos = cruzamentosDaReta(contorno, p, q);
  if (cruzamentos.length !== 2) {
    throw new Error(
      cruzamentos.length < 2
        ? 'Essa linha não atravessa a peça: não serve de linha de dobra.'
        : 'Essa linha cruza o contorno em mais de dois pontos: use o modo “Dois pontos do contorno” e indique a dobra.',
    );
  }
  return [cruzamentos[0]!, cruzamentos[1]!];
}

/**
 * A linha de dobra pelo meio da peça, como a tela a mostra: `horizontal` é a
 * linha deitada (o X do mundo constante) e `vertical`, a linha em pé (o Y
 * constante), as duas pelo centro do retângulo que envolve a peça.
 */
export function dobraPeloMeio(molde: Molde, sentido: 'horizontal' | 'vertical'): readonly [PosicaoNoContorno, PosicaoNoContorno] {
  const caixa = retanguloEnvolvente(molde.contorno);
  const meioX = (caixa.minX + caixa.maxX) / 2;
  const meioY = (caixa.minY + caixa.maxY) / 2;
  return sentido === 'horizontal'
    ? pontasDaDobra(molde.contorno, ponto(meioX, caixa.minY), ponto(meioX, caixa.maxY))
    : pontasDaDobra(molde.contorno, ponto(caixa.minX, meioY), ponto(caixa.maxX, meioY));
}

/** A linha de dobra dada por uma linha interna reta da peça (o "elemento" indicado): vale a reta inteira dela, de borda a borda. */
export function dobraPelaLinhaInterna(molde: Molde, indiceDaLinha: number): readonly [PosicaoNoContorno, PosicaoNoContorno] {
  const linha = molde.linhasInternas[indiceDaLinha];
  if (!linha || linha.length < 2) throw new Error('Linha interna não encontrada na peça.');
  const de = linha[0]!;
  const ate = linha.at(-1)!;
  if (distancia(de, ate) < MESMO_PONTO_MM) throw new Error('Essa linha interna é fechada: não serve de linha de dobra.');
  if (!estaNaReta(linha, de, ate)) throw new Error('A linha interna precisa ser reta para servir de linha de dobra.');
  return pontasDaDobra(molde.contorno, de, ate);
}

/** Todos os pontos da linha estão sobre a reta que passa por `a` e `b`. */
function estaNaReta(linha: Contorno, a: Ponto2D, b: Ponto2D): boolean {
  const comprimento = distancia(a, b);
  return linha.every((p) => Math.abs(((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / comprimento) <= TOLERANCIA_DA_DOBRA_MM);
}

/** A linha de fio levada, sem girar, até o meio do retângulo que envolve a peça. */
export function fioNoCentro(fio: LinhaDeFio, contorno: Contorno): LinhaDeFio {
  const caixa = retanguloEnvolvente(contorno);
  const dx = (caixa.minX + caixa.maxX) / 2 - (fio.inicio.x + fio.fim.x) / 2;
  const dy = (caixa.minY + caixa.maxY) / 2 - (fio.inicio.y + fio.fim.y) / 2;
  return { inicio: ponto(fio.inicio.x + dx, fio.inicio.y + dy), fim: ponto(fio.fim.x + dx, fio.fim.y + dy) };
}

export interface OpcoesDeDobra {
  /** "Manter dobra do molde": a metade que sai fica guardada, e o "Desdobrar" a traz de volta como era. */
  readonly manter: boolean;
  /** "Fio no centro do molde": a linha de fio vai para o meio da peça que fica. */
  readonly fioNoCentro: boolean;
}

/**
 * "Dobrar": fica só a metade da peça do lado de `pontoDoLado`, e a reta de
 * `a` a `b` passa a ser uma aresta dela — a linha de dobra. A linha interna
 * que estava em cima da dobra sai (virou a aresta). Com `manter`, a outra
 * metade fica guardada na peça.
 */
export function dobrarMolde(molde: Molde, a: PosicaoNoContorno, b: PosicaoNoContorno, pontoDoLado: Ponto2D, opcoes: OpcoesDeDobra): Molde {
  const semALinhaDaDobra: Molde = {
    ...semCampo(molde, 'dobraMantida'),
    linhasInternas: molde.linhasInternas.filter((l) => !estaNaReta(l, a.ponto, b.ponto)),
  };
  const fica = metadeDoMolde(semALinhaDaDobra, a, b, pontoDoLado, 'fica');
  const dobrada = opcoes.fioNoCentro ? { ...fica, linhaDeFio: fioNoCentro(fica.linhaDeFio, fica.contorno) } : fica;
  if (!opcoes.manter) return dobrada;
  const sai = metadeDoMolde(semALinhaDaDobra, a, b, pontoDoLado, 'sai');
  const dobraMantida: MetadeGuardada = {
    de: a.ponto,
    ate: b.ponto,
    contorno: sai.contorno,
    furos: sai.furos,
    linhasInternas: sai.linhasInternas,
    marcas: sai.marcas,
    piques: sai.piques,
  };
  return { ...dobrada, dobraMantida };
}

function espelharNaReta(p: Ponto2D, a: Ponto2D, b: Ponto2D): Ponto2D {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy);
  const pe = ponto(a.x + dx * t, a.y + dy * t);
  return ponto(2 * pe.x - p.x, 2 * pe.y - p.y);
}

/**
 * "Desdobrar": a aresta indicada é a linha de dobra; a peça ganha a outra
 * metade, espelhada nela, e a dobra passa a ser uma linha interna (a linha de
 * centro). Furos, linhas internas, marcas e piques ganham a cópia espelhada;
 * os piques da própria dobra saem, porque ela deixa de ser borda. Quando a
 * dobra é feita de várias arestas seguidas na mesma reta, vale a dobra
 * inteira. Recusa a peça que passa para os dois lados da reta da dobra, ou
 * que volta a encostar nela.
 *
 * Se a peça guarda a outra metade dessa dobra ("Manter dobra do molde"), é
 * ela que volta, como era, no lugar do espelho. `fioNoCentro` leva a linha
 * de fio para o meio da peça inteira.
 */
export function desdobrarMolde(molde: Molde, indiceAresta: number, novoId: () => string, opcoes: { readonly fioNoCentro?: boolean } = {}): Molde {
  const inteira = desdobrada(molde, indiceAresta, novoId);
  return opcoes.fioNoCentro ? { ...inteira, linhaDeFio: fioNoCentro(inteira.linhaDeFio, inteira.contorno) } : inteira;
}

/** A metade guardada encaixa na dobra que vai de `pontaInicial` a `pontaFinal`? Devolve o miolo dela, de uma ponta à outra. */
function mioloDaMetadeGuardada(guardada: MetadeGuardada, pontaInicial: Ponto2D, pontaFinal: Ponto2D): Ponto2D[] | null {
  const mesmo = (p: Ponto2D, q: Ponto2D): boolean => distancia(p, q) <= TOLERANCIA_DA_DOBRA_MM;
  const casa = (mesmo(guardada.de, pontaInicial) && mesmo(guardada.ate, pontaFinal)) || (mesmo(guardada.de, pontaFinal) && mesmo(guardada.ate, pontaInicial));
  if (!casa) return null;
  const g = guardada.contorno;
  const m = g.length;
  const noInicio = g.findIndex((p) => mesmo(p, pontaInicial));
  const noFim = g.findIndex((p) => mesmo(p, pontaFinal));
  if (noInicio < 0 || noFim < 0) return null;
  // A dobra é uma aresta da metade guardada; o miolo é o resto dela, de uma ponta à outra.
  if ((noFim + 1) % m === noInicio) return Array.from({ length: m - 2 }, (_, j) => g[(noInicio + 1 + j) % m]!);
  if ((noInicio + 1) % m === noFim) return Array.from({ length: m - 2 }, (_, j) => g[(noFim + 1 + j) % m]!).reverse();
  return null;
}

/** A dobra inteira a que a aresta pertence: as arestas vizinhas na mesma reta entram nela. */
function dobraInteira(molde: Molde, indiceAresta: number): {
  readonly inicio: number;
  readonly fim: number;
  readonly lado: (p: Ponto2D) => number;
  readonly a: Ponto2D;
  readonly b: Ponto2D;
} {
  const n = molde.contorno.length;
  if (!Number.isInteger(indiceAresta) || indiceAresta < 0 || indiceAresta >= n) {
    throw new Error('Aresta fora do contorno da peça.');
  }
  const a = molde.contorno[indiceAresta]!;
  const b = molde.contorno[(indiceAresta + 1) % n]!;
  const comprimento = distancia(a, b);
  if (comprimento < MESMO_PONTO_MM) throw new Error('Essa aresta não tem comprimento: não serve de linha de dobra.');
  // Distância (com sinal) de cada vértice à reta da dobra.
  const lado = (p: Ponto2D): number => ((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x)) / comprimento;
  const naReta = (i: number): boolean => Math.abs(lado(molde.contorno[((i % n) + n) % n]!)) <= TOLERANCIA_DA_DOBRA_MM;
  // A dobra inteira: as arestas vizinhas que continuam na mesma reta entram nela.
  let inicio = indiceAresta;
  let fim = indiceAresta + 1;
  while (fim - inicio < n - 1 && naReta(inicio - 1)) inicio--;
  while (fim - inicio < n - 1 && naReta(fim + 1)) fim++;
  return { inicio, fim, lado, a, b };
}

/** "Desdobrar" na aresta indicada traz de volta a metade guardada (em vez de espelhar a que ficou)? */
export function desdobraComAMetadeGuardada(molde: Molde, indiceAresta: number): boolean {
  if (!molde.dobraMantida) return false;
  const n = molde.contorno.length;
  const { inicio, fim } = dobraInteira(molde, indiceAresta);
  return mioloDaMetadeGuardada(molde.dobraMantida, molde.contorno[((inicio % n) + n) % n]!, molde.contorno[fim % n]!) !== null;
}

function desdobrada(molde: Molde, indiceAresta: number, novoId: () => string): Molde {
  const n = molde.contorno.length;
  const { inicio, fim, lado, a, b } = dobraInteira(molde, indiceAresta);
  const foraDaDobra = Array.from({ length: n - (fim - inicio + 1) }, (_, j) => molde.contorno[(fim + 1 + j) % n]!);
  const lados = foraDaDobra.map(lado);
  if (lados.length === 0) throw new Error('A peça não tem área fora dessa aresta.');

  const guardada = molde.dobraMantida;
  const miolo = guardada ? mioloDaMetadeGuardada(guardada, molde.contorno[((inicio % n) + n) % n]!, molde.contorno[fim % n]!) : null;
  if (guardada && miolo) {
    const pontaInicial = molde.contorno[((inicio % n) + n) % n]!;
    const pontaFinal = molde.contorno[fim % n]!;
    // Uma volta: da ponta final da dobra, a metade que ficou até a ponta inicial; dali, a metade guardada, como era.
    const volta = [
      { ponto: pontaFinal, original: fim % n },
      ...foraDaDobra.map((p, j) => ({ ponto: p, original: (fim + 1 + j) % n })),
      { ponto: pontaInicial, original: ((inicio % n) + n) % n },
      ...miolo.map((p) => ({ ponto: p, original: n })),
    ];
    const comeco = volta.reduce((menor, v, i) => (v.original < volta[menor]!.original ? i : menor), 0);
    const contorno = [...volta.slice(comeco), ...volta.slice(0, comeco)].map((v) => v.ponto);
    if (!(area(contorno) > AREA_MINIMA_DE_UMA_PARTE_MM2)) throw new Error('A metade guardada não fecha uma peça com a que ficou.');
    return {
      ...semCampo(molde, 'dobraMantida'),
      contorno,
      furos: [...molde.furos, ...guardada.furos],
      linhasInternas: [...molde.linhasInternas, ...guardada.linhasInternas, [pontaInicial, pontaFinal]],
      marcas: [...molde.marcas, ...guardada.marcas],
      piques: piquesQueFicamNoContorno([...molde.piques, ...guardada.piques], contorno),
    };
  }

  if (lados.some((d) => d > TOLERANCIA_DA_DOBRA_MM) && lados.some((d) => d < -TOLERANCIA_DA_DOBRA_MM)) {
    throw new Error('A peça passa para os dois lados dessa aresta: não dá para desdobrar nela.');
  }
  if (lados.some((d) => Math.abs(d) <= TOLERANCIA_DA_DOBRA_MM)) {
    throw new Error('A peça volta a encostar na reta dessa aresta: não dá para desdobrar nela.');
  }

  const pontaInicial = molde.contorno[((inicio % n) + n) % n]!;
  const pontaFinal = molde.contorno[fim % n]!;
  const espelhar = (p: Ponto2D): Ponto2D => espelharNaReta(p, a, b);
  const origemEspelhada = espelhar(ponto(0, 0));
  const espelharVetor = (v: Ponto2D): Ponto2D => {
    const e = espelhar(v);
    return ponto(e.x - origemEspelhada.x, e.y - origemEspelhada.y);
  };
  // Uma volta: da ponta final da dobra, a metade que existia até a ponta
  // inicial; dali, a metade espelhada, de trás para a frente.
  const volta = [
    { ponto: pontaFinal, original: fim % n },
    ...foraDaDobra.map((p, j) => ({ ponto: p, original: (fim + 1 + j) % n })),
    { ponto: pontaInicial, original: ((inicio % n) + n) % n },
    ...[...foraDaDobra].reverse().map((p) => ({ ponto: espelhar(p), original: n })),
  ];
  // O contorno novo começa pelo vértice de menor número que continua nele.
  const comeco = volta.reduce((menor, v, i) => (v.original < volta[menor]!.original ? i : menor), 0);
  const contorno = [...volta.slice(comeco), ...volta.slice(0, comeco)].map((v) => v.ponto);

  // O pique que está sobre a dobra é a própria imagem no espelho: não se repete.
  const piquesEspelhados = molde.piques
    .filter((p) => Math.abs(lado(p.posicao)) > TOLERANCIA_DA_DOBRA_MM)
    .map((p) => ({ ...p, id: novoId(), posicao: espelhar(p.posicao) }));
  return {
    ...molde,
    contorno,
    furos: [...molde.furos, ...molde.furos.map((f) => f.map(espelhar))],
    linhasInternas: [...molde.linhasInternas, ...molde.linhasInternas.map((l) => l.map(espelhar)), [pontaInicial, pontaFinal]],
    marcas: [...molde.marcas, ...molde.marcas.map((m) => ({ ...m, id: novoId(), posicao: espelhar(m.posicao) }))],
    piques: piquesQueFicamNoContorno([...molde.piques, ...piquesEspelhados], contorno),
    // Os pontos graduados da metade que existia ganham o par espelhado, com a regra espelhada.
    ...(molde.graduacao
      ? {
          graduacao: {
            ...molde.graduacao,
            pontos: [
              ...molde.graduacao.pontos,
              ...molde.graduacao.pontos
                .filter((p) => Math.abs(lado(p.posicao)) > TOLERANCIA_DA_DOBRA_MM)
                .map((p) => ({ ...p, posicao: espelhar(p.posicao), deslocamentos: p.deslocamentos.map(espelharVetor) })),
            ],
          },
        }
      : {}),
  };
}

function anguloDe(de: Ponto2D, ate: Ponto2D): number {
  return (Math.atan2(ate.y - de.y, ate.x - de.x) * 180) / Math.PI;
}

/**
 * A segunda peça levada até a primeira: girada e movida de modo que a aresta
 * `arestaB` dela fique sobre a aresta `arestaA` da primeira, meio com meio,
 * com as peças de lados opostos da aresta.
 */
export function encostarMolde(moldeA: Molde, arestaA: number, moldeB: Molde, arestaB: number): Molde {
  const nA = moldeA.contorno.length;
  const nB = moldeB.contorno.length;
  const dentro = (i: number, n: number): boolean => Number.isInteger(i) && i >= 0 && i < n;
  if (!dentro(arestaA, nA) || !dentro(arestaB, nB)) throw new Error('Aresta fora do contorno da peça.');
  const a0 = moldeA.contorno[arestaA]!;
  const a1 = moldeA.contorno[(arestaA + 1) % nA]!;
  const b0 = moldeB.contorno[arestaB]!;
  const b1 = moldeB.contorno[(arestaB + 1) % nB]!;
  if (distancia(a0, a1) < MESMO_PONTO_MM || distancia(b0, b1) < MESMO_PONTO_MM) {
    throw new Error('Uma das arestas não tem comprimento: não dá para unir por ela.');
  }
  // Com os dois contornos no mesmo sentido de giro, as peças ficam de lados
  // opostos quando as arestas correm em sentidos contrários.
  const mesmoSentido = Math.sign(areaAssinada(moldeA.contorno)) === Math.sign(areaAssinada(moldeB.contorno));
  const direcaoAlvo = mesmoSentido ? anguloDe(a1, a0) : anguloDe(a0, a1);
  const girada = rotacionarMolde(moldeB, direcaoAlvo - anguloDe(b0, b1));
  const g0 = girada.contorno[arestaB]!;
  const g1 = girada.contorno[(arestaB + 1) % nB]!;
  return transladarMolde(
    girada,
    ponto((a0.x + a1.x) / 2 - (g0.x + g1.x) / 2, (a0.y + a1.y) / 2 - (g0.y + g1.y) / 2),
    moldeB.id,
  );
}

/** O que o "Unir moldes" faz com a graduação das duas peças. */
export interface OpcoesDeUniao {
  /** "Unir tamanhos": a peça unida fica com a graduação das duas (precisam ter os mesmos tamanhos e o mesmo base). Sem isso, só com a da primeira. */
  readonly unirTamanhos: boolean;
  /** "Giro tamanho": 'base' gira todos os tamanhos da segunda peça como o base; 'tamanho' encosta cada tamanho dela no mesmo tamanho da primeira. */
  readonly giro: 'base' | 'tamanho';
}

export const UNIAO_PADRAO: OpcoesDeUniao = { unirTamanhos: true, giro: 'base' };

/** O movimento rígido que leva a aresta de `b0` a `b1` para cima da de `a0` a `a1`, meio com meio, com as peças de lados opostos. */
function movimentoDeEncosto(a0: Ponto2D, a1: Ponto2D, b0: Ponto2D, b1: Ponto2D, mesmoSentido: boolean): (p: Ponto2D) => Ponto2D {
  const giro = (mesmoSentido ? anguloDe(a1, a0) : anguloDe(a0, a1)) - anguloDe(b0, b1);
  const meioDeB = ponto((b0.x + b1.x) / 2, (b0.y + b1.y) / 2);
  const meioDeA = ponto((a0.x + a1.x) / 2, (a0.y + a1.y) / 2);
  return (p) => {
    const girado = rotacionar(p, meioDeB, giro);
    return ponto(girado.x + meioDeA.x - meioDeB.x, girado.y + meioDeA.y - meioDeB.y);
  };
}

/**
 * Os pontos graduados da segunda peça depois da união com o giro "igual
 * tamanho": em cada tamanho, a peça dela é encostada na aresta que a primeira
 * tem nesse tamanho, e o deslocamento do ponto é a diferença para onde ele
 * ficou no base.
 */
function pontosGraduadosEncostandoCadaTamanho(moldeA: Molde, arestaA: number, moldeB: Molde, arestaB: number, graduacaoEncostada: Graduacao): Graduacao['pontos'] {
  const gA = moldeA.graduacao!;
  const gB = semPontosSoltos(moldeB.graduacao!, moldeB.contorno);
  const nA = moldeA.contorno.length;
  const nB = moldeB.contorno.length;
  const mesmoSentido = Math.sign(areaAssinada(moldeA.contorno)) === Math.sign(areaAssinada(moldeB.contorno));
  const encosto = (contornoA: Contorno, contornoB: Contorno): ((p: Ponto2D) => Ponto2D) =>
    movimentoDeEncosto(contornoA[arestaA]!, contornoA[(arestaA + 1) % nA]!, contornoB[arestaB]!, contornoB[(arestaB + 1) % nB]!, mesmoSentido);
  const noBase = encosto(moldeA.contorno, moldeB.contorno);
  const porTamanho = gA.tamanhos.map((_, t) => encosto(contornoDoTamanho(gA, moldeA.contorno, t), contornoDoTamanho(gB, moldeB.contorno, t)));
  // A graduação já encostada tem os mesmos pontos, na mesma ordem, no lugar em que ficaram no contorno unido.
  const encostados = semPontosSoltos({ ...graduacaoEncostada, pontos: graduacaoEncostada.pontos }, graduacaoEncostada.pontos.map((p) => p.posicao));
  return gB.pontos.map((p, k) => {
    const noLugar = noBase(p.posicao);
    return {
      posicao: encostados.pontos[k]?.posicao ?? noLugar,
      deslocamentos: gA.tamanhos.map((_, t) => {
        if (t === gA.base) return ponto(0, 0);
        const d = p.deslocamentos[t] ?? ponto(0, 0);
        const noTamanho = porTamanho[t]!(ponto(p.posicao.x + d.x, p.posicao.y + d.y));
        return ponto(noTamanho.x - noLugar.x, noTamanho.y - noLugar.y);
      }),
    };
  });
}

/**
 * "Unir": as duas peças viram uma só, coladas pela aresta `arestaA` da
 * primeira e `arestaB` da segunda (que é girada e movida até encostar). A
 * peça unida é a primeira — id, nome, linha de fio, costura e quantidade — com
 * os furos, linhas internas, marcas, piques e cotas das duas. Arestas de
 * comprimentos diferentes são centralizadas uma na outra, e a sobra fica como
 * degrau no contorno.
 */
export function unirMoldes(moldeA: Molde, arestaA: number, moldeB: Molde, arestaB: number, opcoes: OpcoesDeUniao = UNIAO_PADRAO): Molde {
  const b = encostarMolde(moldeA, arestaA, moldeB, arestaB);
  const nA = moldeA.contorno.length;
  const nB = b.contorno.length;
  const mesmoSentido = Math.sign(areaAssinada(moldeA.contorno)) === Math.sign(areaAssinada(b.contorno));
  // A primeira peça inteira, da ponta final da aresta até a inicial; depois a
  // segunda, a partir da ponta que encostou nessa, no sentido que mantém o
  // contorno unido girando para o mesmo lado.
  const daA = Array.from({ length: nA }, (_, j) => moldeA.contorno[(arestaA + 1 + j) % nA]!);
  const daB = mesmoSentido
    ? Array.from({ length: nB }, (_, j) => b.contorno[(arestaB + 1 + j) % nB]!)
    : Array.from({ length: nB }, (_, j) => b.contorno[(arestaB - j + nB) % nB]!);
  const contorno: Ponto2D[] = [];
  for (const p of [...daA, ...daB]) {
    if (contorno.length === 0 || distancia(contorno.at(-1)!, p) > MESMO_PONTO_MM) contorno.push(p);
  }
  if (contorno.length > 1 && distancia(contorno.at(-1)!, contorno[0]!) <= MESMO_PONTO_MM) contorno.pop();
  const cotas: readonly Cota[] = [...(moldeA.cotas ?? []), ...(b.cotas ?? [])];
  // A graduação da segunda peça só entra se for nos mesmos tamanhos, com o mesmo base.
  const gA = moldeA.graduacao;
  const gB = b.graduacao;
  const mesmosTamanhos =
    gA !== undefined && gB !== undefined && gA.base === gB.base && gA.tamanhos.length === gB.tamanhos.length && gA.tamanhos.every((t, i) => t === gB.tamanhos[i]);
  // "Unir tamanhos": a graduação da segunda peça entra na unida. No giro "igual base", os tamanhos dela giram
  // todos como o base girou (o que o movimento da peça já fez); no "igual tamanho", cada tamanho dela é encostado
  // no mesmo tamanho da primeira, aresta com aresta.
  const pontosDeB =
    gA && gB && mesmosTamanhos && opcoes.unirTamanhos
      ? opcoes.giro === 'tamanho'
        ? pontosGraduadosEncostandoCadaTamanho(moldeA, arestaA, moldeB, arestaB, gB)
        : gB.pontos
      : null;
  return {
    ...moldeA,
    ...(gA && pontosDeB ? { graduacao: { ...gA, pontos: [...gA.pontos, ...pontosDeB] } } : {}),
    contorno,
    furos: [...moldeA.furos, ...b.furos],
    linhasInternas: [...moldeA.linhasInternas, ...b.linhasInternas],
    marcas: [...moldeA.marcas, ...b.marcas],
    piques: piquesQueFicamNoContorno([...moldeA.piques, ...b.piques], contorno),
    ...(cotas.length > 0 ? { cotas } : {}),
  };
}

// ---------------------------------------------------------------------------
// Cortar com costura, e remover uma faixa unindo o que sobra
// ---------------------------------------------------------------------------

/** O que o "Cortar" pergunta além da reta. */
export interface OpcoesDeCorte {
  /** Costura acrescentada ao contorno, na borda do corte (mm); 0 = sem costura. */
  readonly costuraMm: number;
  /** A costura entra nas duas partes; sem isso, só na parte nova (a menor). */
  readonly costuraNasDuas: boolean;
  /** Um pique em cada ponta da linha do corte, nas partes que ganharam costura. */
  readonly piques: boolean;
  /** Como a costura acaba nas pontas: seguindo as arestas vizinhas ('tangente') ou em esquadro com o corte ('reta'). */
  readonly modo: 'tangente' | 'reta';
  /**
   * "Manter distâncias": na peça graduada, as duas pontas do corte ficam com a
   * regra que tinham na peça inteira (a proporção entre os pontos vizinhos da
   * aresta), e a linha do corte fica no mesmo lugar de cada tamanho nas duas
   * partes. Sem isso, as pontas andam na proporção do contorno de cada parte.
   */
  readonly manterDistancias: boolean;
}

export const CORTE_SEM_COSTURA: OpcoesDeCorte = { costuraMm: 0, costuraNasDuas: false, piques: false, modo: 'tangente', manterDistancias: true };

/** O que o ponto do contorno anda em cada tamanho, na peça inteira: num ponto do contorno, a regra dele; no meio de uma aresta, a proporção entre as duas pontas dela. */
function regraNaPosicao(graduacao: Graduacao, contorno: Contorno, posicao: PosicaoNoContorno): Ponto2D[] {
  const deslocamentos = deslocamentosDoContorno(graduacao, contorno);
  const i = posicao.indiceAresta;
  const j = (i + 1) % contorno.length;
  const comprimento = distancia(contorno[i]!, contorno[j]!);
  const k = comprimento < MESMO_PONTO_MM ? 0 : Math.min(1, distancia(contorno[i]!, posicao.ponto) / comprimento);
  return graduacao.tamanhos.map((_, t) => {
    const de = deslocamentos[i]?.[t] ?? ponto(0, 0);
    const ate = deslocamentos[j]?.[t] ?? ponto(0, 0);
    return ponto(de.x + (ate.x - de.x) * k, de.y + (ate.y - de.y) * k);
  });
}

/** A parte com a regra dada no ponto dela que está em `p` (se há graduação e o ponto é um ponto do contorno). */
function comRegraEm(parte: Molde, p: Ponto2D, regra: readonly Ponto2D[]): Molde {
  const i = parte.contorno.findIndex((v) => distancia(v, p) <= NO_CONTORNO_DA_PARTE_MM);
  return parte.graduacao && i >= 0 ? { ...parte, graduacao: definirRegra(parte.graduacao, parte.contorno, i, regra) } : parte;
}

/** No modo tangente, a aresta vizinha é estendida no máximo este tanto de vezes a costura; além disso, a ponta acaba em esquadro. */
const LIMITE_DA_PONTA_DA_COSTURA = 4;
/** Um ponto a menos disso (mm) do contorno de uma parte conta como estando nele. */
const NO_CONTORNO_DA_PARTE_MM = 1e-4;

/** Recusa a costura que não é um número de zero para cima. */
export function conferirOpcoesDeCorte(opcoes: OpcoesDeCorte): void {
  if (!Number.isFinite(opcoes.costuraMm) || opcoes.costuraMm < 0) throw new Error('A costura do corte precisa ser zero ou maior.');
}

/** A aresta do contorno que liga os dois pontos, num sentido ou no outro; -1 se não há. */
function arestaEntre(contorno: Contorno, p: Ponto2D, q: Ponto2D): number {
  const n = contorno.length;
  const igual = (a: Ponto2D, b: Ponto2D): boolean => distancia(a, b) <= NO_CONTORNO_DA_PARTE_MM;
  return contorno.findIndex((v, i) => {
    const w = contorno[(i + 1) % n]!;
    return (igual(v, p) && igual(w, q)) || (igual(v, q) && igual(w, p));
  });
}

/**
 * Onde a linha do corte está no contorno da parte: o número de cada ponto
 * dela, na ordem em que o contorno passa por eles (a linha pode estar num
 * sentido ou no outro); `null` se não está.
 */
function linhaNoContorno(contorno: Contorno, linha: readonly Ponto2D[]): number[] | null {
  const n = contorno.length;
  if (linha.length < 2 || linha.length > n) return null;
  const igual = (a: Ponto2D, b: Ponto2D): boolean => distancia(a, b) <= NO_CONTORNO_DA_PARTE_MM;
  for (let i = 0; i < n; i++) {
    if (!igual(contorno[i]!, linha[0]!)) continue;
    const adiante = linha.map((_, j) => (i + j) % n);
    if (adiante.every((k, j) => igual(contorno[k]!, linha[j]!))) return adiante;
    const paraTras = linha.map((_, j) => (((i - j) % n) + n) % n);
    if (paraTras.every((k, j) => igual(contorno[k]!, linha[j]!))) return paraTras.reverse();
  }
  return null;
}

/** Verdadeiro se duas arestas do contorno que não são vizinhas se encontram. */
function contornoSeCruza(contorno: Contorno): boolean {
  const n = contorno.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue;
      if (segmentosSeIntersectam(contorno[i]!, contorno[(i + 1) % n]!, contorno[j]!, contorno[(j + 1) % n]!)) return true;
    }
  }
  return false;
}

/** A peça sem as linhas internas que estão em cima da reta: elas viram a borda do corte (ou a linha da prega). */
export function semAsLinhasDaReta(molde: Molde, a: Ponto2D, b: Ponto2D): Molde {
  const linhasInternas = molde.linhasInternas.filter((l) => !estaNaReta(l, a, b));
  return linhasInternas.length === molde.linhasInternas.length ? molde : { ...molde, linhasInternas };
}

/**
 * A parte com a costura acrescentada na borda do corte (`linha`: as duas
 * pontas e, no corte que não é reto, os pontos do caminho): a borda anda
 * `costuraMm` para fora. Nas pontas, a costura segue as arestas vizinhas
 * (tangente) ou sai em esquadro com o corte (reta). Nos pontos do caminho, os
 * dois trechos deslocados se encontram no canto — ou, num canto fechado
 * demais, cada um acaba no seu ponto.
 */
function comCosturaNoCorte(parte: Molde, linha: readonly Ponto2D[], opcoes: OpcoesDeCorte, novoId: () => string): Molde {
  const c = parte.contorno;
  const n = c.length;
  const onde = linhaNoContorno(c, linha);
  if (!onde || !(opcoes.costuraMm > 0)) return parte;
  const borda = onde.map((k) => c[k]!);
  const ultimo = borda.length - 1;
  const de = borda[0]!;
  const ate = borda[ultimo]!;
  // Num contorno anti-horário, o lado de fora fica à direita de quem anda por ele.
  const sentido = areaAssinada(c) >= 0 ? 1 : -1;
  /** Para cada trecho da borda, a direção que aponta para fora da parte. */
  const foras = borda.slice(1).map((v, j) => {
    const anterior = borda[j]!;
    const comprimento = distancia(anterior, v);
    return ponto(((v.y - anterior.y) / comprimento) * sentido, ((anterior.x - v.x) / comprimento) * sentido);
  });
  const paraFora = (v: Ponto2D, fora: Ponto2D): Ponto2D => ponto(v.x + fora.x * opcoes.costuraMm, v.y + fora.y * opcoes.costuraMm);
  /** A aresta vizinha (que chega a `ponta` vindo de `vizinho`) estendida até a borda nova, se ela chega lá sem ir longe demais. */
  const estendida = (vizinho: Ponto2D, ponta: Ponto2D, fora: Ponto2D): Ponto2D | null => {
    const d = distancia(vizinho, ponta);
    if (d < MESMO_PONTO_MM) return null;
    const w = ponto((ponta.x - vizinho.x) / d, (ponta.y - vizinho.y) / d);
    const paraForaPorMm = w.x * fora.x + w.y * fora.y;
    if (!(paraForaPorMm > 1 / LIMITE_DA_PONTA_DA_COSTURA)) return null;
    const andar = opcoes.costuraMm / paraForaPorMm;
    return ponto(ponta.x + w.x * andar, ponta.y + w.y * andar);
  };
  /** No ponto `j` do caminho, onde os dois trechos deslocados se encontram. */
  const noCanto = (j: number): Ponto2D[] => {
    const v = borda[j]!;
    const antes = foras[j - 1]!;
    const depois = foras[j]!;
    const abertura = 1 + antes.x * depois.x + antes.y * depois.y;
    // O canto fica a costura / cos(meio ângulo) do ponto: além do limite, cada trecho acaba no seu ponto.
    if (abertura < 2 / LIMITE_DA_PONTA_DA_COSTURA ** 2) return [paraFora(v, antes), paraFora(v, depois)];
    return [ponto(v.x + ((antes.x + depois.x) * opcoes.costuraMm) / abertura, v.y + ((antes.y + depois.y) * opcoes.costuraMm) / abertura)];
  };
  const tangente = opcoes.modo === 'tangente';
  const pontaDe = tangente ? estendida(c[(onde[0]! - 1 + n) % n]!, de, foras[0]!) : null;
  const pontaAte = tangente ? estendida(c[(onde[ultimo]! + 1) % n]!, ate, foras[ultimo - 1]!) : null;
  // O que cada ponto da borda do corte passa a ser, pelo número dele no contorno.
  const trocados = new Map<number, Ponto2D[]>();
  trocados.set(onde[0]!, pontaDe ? [pontaDe] : [de, paraFora(de, foras[0]!)]);
  for (let j = 1; j < ultimo; j++) trocados.set(onde[j]!, noCanto(j));
  trocados.set(onde[ultimo]!, pontaAte ? [pontaAte] : [paraFora(ate, foras[ultimo - 1]!), ate]);
  const novo = c.flatMap((v, k) => trocados.get(k) ?? [v]);
  if (ultimo > 1 && contornoSeCruza(novo)) {
    throw new Error('A costura não cabe nessa linha de corte: com essa medida, a borda nova cruza a si mesma. Diminua a costura, ou corte sem ela e acrescente a costura depois.');
  }
  const piques: Pique[] = opcoes.piques
    ? [de, ate].map((v) => {
        const noContorno = pontoMaisProximoNoContorno(v, novo);
        return { id: novoId(), posicao: noContorno.ponto, indiceAresta: noContorno.indiceAresta };
      })
    : [];
  // No modo tangente a ponta do corte dá lugar à ponta estendida: o ponto graduado que estava nela vai junto.
  const levar = (p: Ponto2D): Ponto2D => (pontaDe && distancia(p, de) <= NO_CONTORNO_DA_PARTE_MM ? pontaDe : pontaAte && distancia(p, ate) <= NO_CONTORNO_DA_PARTE_MM ? pontaAte : p);
  return {
    ...parte,
    contorno: novo,
    piques: [...piquesQueFicamNoContorno(parte.piques, novo), ...piques],
    ...(parte.graduacao ? { graduacao: { ...parte.graduacao, pontos: parte.graduacao.pontos.map((q) => ({ ...q, posicao: levar(q.posicao) })) } } : {}),
  };
}

/**
 * "Cortar", com o que a janela pergunta: a peça é dividida pela reta, as
 * linhas internas que estavam em cima dela saem (viraram a borda), e a borda
 * do corte ganha a costura pedida — na parte nova ou nas duas. Com `miolo`, o
 * corte passa por esses pontos (uma curva, vários elementos): quem chama já
 * tirou da peça os elementos que viraram a borda.
 */
export function cortarMoldeComOpcoes(
  molde: Molde,
  a: PosicaoNoContorno,
  b: PosicaoNoContorno,
  novoId: () => string,
  opcoes: OpcoesDeCorte = CORTE_SEM_COSTURA,
  miolo: readonly Ponto2D[] = [],
): readonly [Molde, Molde] {
  conferirOpcoesDeCorte(opcoes);
  const cortadas = cortarMolde(miolo.length > 0 ? molde : semAsLinhasDaReta(molde, a.ponto, b.ponto), a, b, novoId(), miolo);
  // "Manter distâncias": as pontas do corte levam, para as duas partes, a regra que tinham na peça inteira.
  const g = molde.graduacao;
  const [maior, menor] =
    g && opcoes.manterDistancias
      ? (cortadas.map((parte) => comRegraEm(comRegraEm(parte, a.ponto, regraNaPosicao(g, molde.contorno, a)), b.ponto, regraNaPosicao(g, molde.contorno, b))) as [Molde, Molde])
      : cortadas;
  if (!(opcoes.costuraMm > 0)) return [maior, menor];
  const linha = [a.ponto, ...miolo, b.ponto];
  return [opcoes.costuraNasDuas ? comCosturaNoCorte(maior, linha, opcoes, novoId) : maior, comCosturaNoCorte(menor, linha, opcoes, novoId)];
}

/**
 * "Remover região" com as duas partes: a peça sem a região do lado clicado, e
 * a região tirada como peça própria (para o "Manter região do molde"). Com
 * `miolo`, a linha que separa a região passa por esses pontos (uma curva,
 * vários elementos): quem chama já tirou da peça os elementos que viraram a
 * borda.
 */
export function separarRegiaoDoMolde(
  molde: Molde,
  a: PosicaoNoContorno,
  b: PosicaoNoContorno,
  pontoDoLado: Ponto2D,
  novoId: string,
  miolo: readonly Ponto2D[] = [],
): { readonly peca: Molde; readonly regiao: Molde } {
  const semLinhas = miolo.length > 0 ? molde : semAsLinhasDaReta(molde, a.ponto, b.ponto);
  const peca = metadeDoMolde(semLinhas, a, b, pontoDoLado, 'sai', miolo);
  const regiao = metadeDoMolde(semLinhas, a, b, pontoDoLado, 'fica', miolo);
  return { peca, regiao: { ...regiao, id: novoId, nome: `${molde.nome} (2)` } };
}

/**
 * "Remover região" com "Unir moldes": a faixa entre duas retas sai, e as duas
 * partes que sobram são unidas pelas bordas do corte — a que não tem a linha
 * de fio gira e anda até encostar na outra. Bordas de comprimentos diferentes
 * ficam centralizadas uma na outra, e sobra um degrau (`degrauMm`).
 * A segunda reta é dada pelos dois pontos dela no contorno da peça.
 */
export function removerFaixaDoMolde(
  molde: Molde,
  a1: PosicaoNoContorno,
  b1: PosicaoNoContorno,
  a2: Ponto2D,
  b2: Ponto2D,
  novoId: string,
): { readonly peca: Molde; readonly faixa: Molde; readonly degrauMm: number } {
  const semLinhas = semAsLinhasDaReta(semAsLinhasDaReta(molde, a1.ponto, b1.ponto), a2, b2);
  const primeiras = partesDoCorte(semLinhas, a1, b1);
  const noContornoDe = (parte: Molde, p: Ponto2D): PosicaoNoContorno | null => {
    const perto = pontoMaisProximoNoContorno(p, parte.contorno);
    return perto.distancia <= NO_CONTORNO_DA_PARTE_MM ? { indiceAresta: perto.indiceAresta, ponto: perto.ponto } : null;
  };
  // A segunda reta fica inteira numa das partes; a outra é a parte de perto, que encosta na primeira reta.
  const meioDaSegunda = ponto((a2.x + b2.x) / 2, (a2.y + b2.y) / 2);
  const comASegunda = primeiras.findIndex((parte) => noContornoDe(parte, a2) && noContornoDe(parte, b2) && pontoDentroDoContorno(meioDaSegunda, parte.contorno));
  if (comASegunda < 0) {
    throw new Error('A segunda reta precisa ficar toda de um lado da primeira, de um ponto do contorno a outro, sem cruzar com ela.');
  }
  const dePerto = primeiras[1 - comASegunda]!;
  const resto = primeiras[comASegunda]!;
  const segundas = partesDoCorte(resto, noContornoDe(resto, a2)!, noContornoDe(resto, b2)!);
  // Das duas partes do resto, a faixa é a que tem a primeira reta como aresta.
  const qualEAFaixa = segundas.findIndex((parte) => arestaEntre(parte.contorno, a1.ponto, b1.ponto) >= 0);
  if (qualEAFaixa < 0) throw new Error('As duas retas precisam delimitar uma faixa da peça, de borda a borda.');
  const faixa = segundas[qualEAFaixa]!;
  const deLonge = segundas[1 - qualEAFaixa]!;
  const arestaDePerto = arestaEntre(dePerto.contorno, a1.ponto, b1.ponto);
  const arestaDeLonge = arestaEntre(deLonge.contorno, a2, b2);
  if (arestaDePerto < 0 || arestaDeLonge < 0) throw new Error('As duas retas precisam delimitar uma faixa da peça, de borda a borda.');
  // Fica parada a parte que tem o meio da linha de fio; a outra vai até ela.
  const meioDoFio = ponto((molde.linhaDeFio.inicio.x + molde.linhaDeFio.fim.x) / 2, (molde.linhaDeFio.inicio.y + molde.linhaDeFio.fim.y) / 2);
  const fioNaDeLonge = pontoDentroDoContorno(meioDoFio, deLonge.contorno) && !pontoDentroDoContorno(meioDoFio, dePerto.contorno);
  const unida = fioNaDeLonge
    ? unirMoldes({ ...deLonge, linhaDeFio: molde.linhaDeFio }, arestaDeLonge, { ...dePerto, id: `${molde.id}-parte` }, arestaDePerto)
    : unirMoldes(dePerto, arestaDePerto, { ...deLonge, id: `${molde.id}-parte` }, arestaDeLonge);
  if (!(area(unida.contorno) > AREA_MINIMA_DE_UMA_PARTE_MM2)) throw new Error('A peça ficaria sem área sem essa faixa.');
  return {
    // A parte que tem a linha de fio não saiu do lugar: a seta original fica onde estava se ainda cabe na peça unida;
    // senão, vai para o meio dela (e encolhe, se a peça ficou mais curta que a seta).
    peca: { ...unida, linhaDeFio: fioDaParte(molde.linhaDeFio, unida.contorno) },
    faixa: { ...faixa, id: novoId, nome: `${molde.nome} (2)` },
    degrauMm: Math.abs(distancia(a1.ponto, b1.ponto) - distancia(a2, b2)),
  };
}

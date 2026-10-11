import {
  distancia,
  ondeOSegmentoCruza,
  pontoDentroDoContorno,
  pontoMaisProximoNoContorno,
  pontoMaisProximoNoSegmento,
  trechosLongeDaBorda,
  type Contorno,
  type Ponto2D,
} from '../core/geometria';
import { elementosLevados } from './linhasAuxiliares';
import { contornoDeCorte, type Molde } from './molde';

/**
 * Linhas internas que não são da peça: as que estão fora dela, no todo ou em
 * parte. São sobra de desenho ou de importação — uma moldura, o contorno de
 * outra peça —, e atrapalham sem aparecer: ficam fora do enquadramento da
 * peça, mas continuam sendo linhas dela para as ferramentas e para o PDF.
 *
 * "Fora da peça" é para lá da linha de corte (o contorno, ou o contorno mais
 * a margem de costura), a mais de uma folga pequena; "dentro" é para cá dela,
 * a mais da mesma folga. O que fica entre uma coisa e outra está na borda.
 * A linha **solta** tem parte fora e nenhuma dentro — está inteira fora, ou
 * corre pela borda e sai; a que **sai** tem parte dentro e parte fora.
 * Na peça graduada, a conta é no tamanho base.
 */

/**
 * Quanto (mm) uma linha pode passar da borda da peça sem contar como fora
 * dela: o que sobra de um traço que acaba na borda.
 */
export const FOLGA_FORA_DA_PECA_MM = 1;

/** A menos disto (mm) da borda, o ponto conta como em cima dela — e a borda é da peça. */
const NA_BORDA_MM = 1e-6;

/** Com que precisão (mm) se diz até onde a linha vai, para fora da borda. */
const PRECISAO_DA_DISTANCIA_MM = 0.01;

/** Uma linha interna com parte fora da peça: o número dela e até onde vai, para fora da borda (mm). */
export interface LinhaDeFora {
  readonly indice: number;
  readonly distanciaMm: number;
}

/** Um pedaço de um lado da linha, entre dois cruzamentos com a borda da peça. */
interface Pedaco {
  readonly de: Ponto2D;
  readonly ate: Ponto2D;
  /** Acaba num ponto da própria linha, e não num cruzamento com a borda. */
  readonly acabaNumPontoDaLinha: boolean;
  readonly dentro: boolean;
  /** De fora, e com algum trecho a mais da folga da borda. */
  readonly longe: boolean;
}

/** O ponto está na peça: dentro da borda, ou em cima dela. */
function naPeca(p: Ponto2D, borda: Contorno): boolean {
  return pontoDentroDoContorno(p, borda) || pontoMaisProximoNoContorno(p, borda).distancia <= NA_BORDA_MM;
}

/** Os pedaços da linha, na ordem: cada lado dela partido nos cruzamentos com a borda. */
function pedacosDaLinha(linha: Contorno, borda: Contorno, folgaMm: number): Pedaco[] {
  const pedacos: Pedaco[] = [];
  for (let k = 1; k < linha.length; k++) {
    const [p, q] = [linha[k - 1]!, linha[k]!];
    const comprimento = distancia(p, q);
    if (comprimento === 0) continue;
    const cortes = [0, 1];
    for (let i = 0; i < borda.length; i++) {
      const t = ondeOSegmentoCruza(p, q, borda[i]!, borda[(i + 1) % borda.length]!);
      if (t !== null) cortes.push(t);
    }
    cortes.sort((a, b) => a - b);
    const em = (t: number): Ponto2D => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
    let longes: [number, number][] | null = null;
    for (let c = 1; c < cortes.length; c++) {
      const [t0, t1] = [cortes[c - 1]!, cortes[c]!];
      if ((t1 - t0) * comprimento <= NA_BORDA_MM) continue;
      const noComeco = t0 * comprimento <= NA_BORDA_MM;
      const noFim = (1 - t1) * comprimento <= NA_BORDA_MM;
      const dentro = naPeca(em((t0 + t1) / 2), borda);
      // Só o pedaço de fora pede a conta de até onde o lado vai.
      if (!dentro) longes ??= trechosLongeDaBorda(p, q, borda, folgaMm);
      const longe = !dentro && longes!.some(([de, ate]) => de < t1 && ate > t0);
      pedacos.push({ de: noComeco ? p : em(t0), ate: noFim ? q : em(t1), acabaNumPontoDaLinha: noFim, dentro, longe });
    }
  }
  return pedacos;
}

/**
 * Pedaço a pedaço, o que sai da linha: cada trecho de fora (os pedaços de
 * fora seguidos, de uma saída pela borda até a volta) em que algum pedaço
 * vai longe. O trecho de fora que fica junto da borda não sai.
 */
function oQueSai(pedacos: readonly Pedaco[], fechada: boolean): boolean[] {
  const trechos: number[][] = [];
  for (let i = 0; i < pedacos.length; i++) {
    if (pedacos[i]!.dentro) continue;
    if (i > 0 && !pedacos[i - 1]!.dentro) trechos[trechos.length - 1]!.push(i);
    else trechos.push([i]);
  }
  // Na linha fechada, o trecho de fora do fim continua no do começo.
  if (fechada && trechos.length > 1 && !pedacos[0]!.dentro && !pedacos[pedacos.length - 1]!.dentro) trechos[0] = [...trechos.pop()!, ...trechos[0]!];
  const sai = pedacos.map(() => false);
  for (const trecho of trechos) {
    if (trecho.some((i) => pedacos[i]!.longe)) for (const i of trecho) sai[i] = true;
  }
  return sai;
}

/**
 * A parte entra na peça: algum trecho dela está dentro, a mais da folga da
 * borda. A que só corre pela borda (ou junto dela) não entra: não é coisa de
 * dentro da peça.
 */
function entraNaPeca(parte: Contorno, borda: Contorno, folgaMm: number): boolean {
  for (let k = 1; k < parte.length; k++) {
    const [p, q] = [parte[k - 1]!, parte[k]!];
    for (const [de, ate] of trechosLongeDaBorda(p, q, borda, folgaMm)) {
      const meio = (de + ate) / 2;
      if (pontoDentroDoContorno({ x: p.x + (q.x - p.x) * meio, y: p.y + (q.y - p.y) * meio }, borda)) return true;
    }
  }
  return false;
}

/**
 * O que fica da linha, tirado o que sai: as partes dela, cada uma uma linha,
 * cortadas na borda. Só fica a parte que entra na peça; a que sobraria
 * correndo pela borda sai junto.
 */
function partesQueFicam(pedacos: readonly Pedaco[], sai: readonly boolean[], fechada: boolean, borda: Contorno, folgaMm: number): Contorno[] {
  const partes: { ponto: Ponto2D; daLinha: boolean }[][] = [];
  for (let i = 0; i < pedacos.length; i++) {
    if (sai[i]) continue;
    const pedaco = pedacos[i]!;
    if (i === 0 || sai[i - 1]) partes.push([{ ponto: pedaco.de, daLinha: true }]);
    partes[partes.length - 1]!.push({ ponto: pedaco.ate, daLinha: pedaco.acabaNumPontoDaLinha });
  }
  // Na linha fechada, a parte do fim continua na do começo.
  if (fechada && !sai[0] && !sai[sai.length - 1]) partes[0] = [...partes.pop()!, ...partes[0]!.slice(1)];
  return (
    partes
      // O cruzamento com a borda só vira ponto onde a linha foi cortada: no meio de uma parte, ela segue reta.
      .map((parte) => parte.filter((item, i) => i === 0 || i === parte.length - 1 || item.daLinha).map((item) => item.ponto))
      .filter((parte) => entraNaPeca(parte, borda, folgaMm))
  );
}

/** A maior distância (mm) de um ponto dos trechos até a borda. Os trechos estão do lado de fora. */
function maiorDistanciaAteABorda(trechos: readonly (readonly [Ponto2D, Ponto2D])[], borda: Contorno): number {
  let maior = 0;
  const pilha: (readonly [Ponto2D, Ponto2D])[] = [];
  for (const trecho of trechos) {
    maior = Math.max(maior, pontoMaisProximoNoContorno(trecho[0], borda).distancia, pontoMaisProximoNoContorno(trecho[1], borda).distancia);
    pilha.push(trecho);
  }
  while (pilha.length > 0) {
    const [de, para] = pilha.pop()!;
    const meio = { x: (de.x + para.x) / 2, y: (de.y + para.y) / 2 };
    const perto = pontoMaisProximoNoContorno(meio, borda);
    if (perto.distancia > maior) maior = perto.distancia;
    // No trecho inteiro, a distância à borda não passa da distância a este lado dela — que é maior numa das pontas.
    const [c, d] = [borda[perto.indiceAresta]!, borda[(perto.indiceAresta + 1) % borda.length]!];
    const teto = Math.max(distancia(de, pontoMaisProximoNoSegmento(de, c, d)), distancia(para, pontoMaisProximoNoSegmento(para, c, d)));
    // E o trecho mais curto que a precisão não tem mais o que dizer.
    if (teto <= maior + PRECISAO_DA_DISTANCIA_MM || distancia(de, para) <= PRECISAO_DA_DISTANCIA_MM) continue;
    pilha.push([de, meio], [meio, para]);
  }
  return maior;
}

/** O que uma linha tem de fora: até onde vai, e as partes dela que ficam se o de fora for tirado. */
interface Analise {
  readonly distanciaMm: number;
  readonly partes: readonly Contorno[];
}

/** A conta de uma linha; `null` se ela não tem nada fora da peça, para lá da folga. */
function analisar(linha: Contorno, borda: Contorno, folgaMm: number): Analise | null {
  if (linha.length === 0) return null;
  const pedacos = pedacosDaLinha(linha, borda, folgaMm);
  if (pedacos.length === 0) {
    // Um ponto só (ou vários no mesmo lugar): está fora se está do lado de fora, a mais da folga da borda.
    const distanciaMm = pontoMaisProximoNoContorno(linha[0]!, borda).distancia;
    return !pontoDentroDoContorno(linha[0]!, borda) && distanciaMm > folgaMm ? { distanciaMm, partes: [] } : null;
  }
  const fechada = linha.length > 2 && distancia(linha[0]!, linha[linha.length - 1]!) <= NA_BORDA_MM;
  const sai = oQueSai(pedacos, fechada);
  const tirados = pedacos.filter((_, i) => sai[i]);
  if (tirados.length === 0) return null;
  return {
    distanciaMm: maiorDistanciaAteABorda(
      tirados.map((pedaco) => [pedaco.de, pedaco.ate] as const),
      borda,
    ),
    partes: partesQueFicam(pedacos, sai, fechada, borda, folgaMm),
  };
}

/**
 * A conta de cada peça fica guardada: a peça não muda (cada mudança faz
 * outra), e a validação pergunta por ela a cada passo do trabalho.
 */
const contasGuardadas = new WeakMap<Molde, Map<number, readonly (Analise | null)[]>>();

function analisesDaPeca(molde: Molde, folgaMm: number): readonly (Analise | null)[] {
  let daPeca = contasGuardadas.get(molde);
  if (!daPeca) {
    daPeca = new Map();
    contasGuardadas.set(molde, daPeca);
  }
  let analises = daPeca.get(folgaMm);
  if (!analises) {
    const borda = molde.contorno.length < 3 ? null : contornoDeCorte(molde);
    analises = molde.linhasInternas.map((linha) => (borda ? analisar(linha, borda, folgaMm) : null));
    daPeca.set(folgaMm, analises);
  }
  return analises;
}

function linhasDeFora(molde: Molde, folgaMm: number, soltas: boolean): LinhaDeFora[] {
  return analisesDaPeca(molde, folgaMm).flatMap((analise, indice) => (analise && (analise.partes.length === 0) === soltas ? [{ indice, distanciaMm: analise.distanciaMm }] : []));
}

/** As linhas internas soltas: com parte fora da peça, para lá da folga, e sem parte nenhuma dentro dela. */
export function linhasSoltas(molde: Molde, folgaMm = FOLGA_FORA_DA_PECA_MM): LinhaDeFora[] {
  return linhasDeFora(molde, folgaMm, true);
}

/** As linhas internas que saem da peça: têm parte dentro dela e parte fora, para lá da folga. */
export function linhasQueSaem(molde: Molde, folgaMm = FOLGA_FORA_DA_PECA_MM): LinhaDeFora[] {
  return linhasDeFora(molde, folgaMm, false);
}

/**
 * A peça com cada linha interna trocada pelo que `troca` dá para ela: nada
 * (a linha sai), outras linhas (ficam no lugar dela), ou `null` (fica como
 * está). A linha só de construção continua de construção, e as partes dela
 * também. A mesma peça, se nada mudou.
 */
function comAsLinhasTrocadas(molde: Molde, troca: (indice: number) => readonly Contorno[] | null): Molde {
  const linhasInternas: Contorno[] = [];
  const destinos: number[][] = [];
  let mudou = false;
  molde.linhasInternas.forEach((linha, indice) => {
    const novas = troca(indice);
    if (novas !== null) mudou = true;
    const ficam = novas ?? [linha];
    destinos.push(ficam.map((_, k) => linhasInternas.length + k));
    linhasInternas.push(...ficam);
  });
  return mudou ? elementosLevados(molde, { ...molde, linhasInternas }, (indice) => destinos[indice] ?? []) : molde;
}

/** A peça sem as linhas internas soltas. A mesma peça, se não há nenhuma. */
export function semLinhasSoltas(molde: Molde, folgaMm = FOLGA_FORA_DA_PECA_MM): Molde {
  const analises = analisesDaPeca(molde, folgaMm);
  return comAsLinhasTrocadas(molde, (indice) => (analises[indice]?.partes.length === 0 ? [] : null));
}

/** A peça sem as linhas internas que saem dela (cada uma sai inteira). A mesma peça, se não há nenhuma. */
export function semLinhasQueSaem(molde: Molde, folgaMm = FOLGA_FORA_DA_PECA_MM): Molde {
  const analises = analisesDaPeca(molde, folgaMm);
  return comAsLinhasTrocadas(molde, (indice) => ((analises[indice]?.partes.length ?? 0) > 0 ? [] : null));
}

/**
 * A peça com as linhas internas que saem dela cortadas na borda: o trecho de
 * fora sai, e o que está dentro fica — uma linha para cada parte que sobrou.
 * A mesma peça, se nenhuma linha sai.
 */
export function semOQueSaiDasLinhas(molde: Molde, folgaMm = FOLGA_FORA_DA_PECA_MM): Molde {
  const analises = analisesDaPeca(molde, folgaMm);
  return comAsLinhasTrocadas(molde, (indice) => {
    const partes = analises[indice]?.partes ?? [];
    return partes.length > 0 ? partes : null;
  });
}

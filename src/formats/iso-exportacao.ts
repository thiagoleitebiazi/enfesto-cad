import type { Ponto2D } from '../core/geometria';
import { ponto, retanguloEnvolvente } from '../core/geometria';
import { linhaDeCorteDaPeca, type Molde } from '../domain/molde';
import { linhasDoMolde } from '../domain/linhasAuxiliares';
import { corteDoPique, mundoParaDxf } from './dxf-exportacao';
import { textoParaPlotter } from './plt-exportacao';

/**
 * O arquivo para a mesa de corte automático (ADR 0140): o encaixe como está na mesa, em ISO (G-code, ISO 6983), em
 * milímetros e coordenadas absolutas — o comprimento do encaixe no X (o avanço da mesa) e a largura no Y, como no PLT.
 *
 * As ferramentas, pelo número (a mesa liga cada número à sua):
 * - T1, a faca: a linha de corte e os furos;
 * - T2, o piqueteador: os piques, um golpe no ponto da linha de corte, na direção dele;
 * - T3, a caneta: as linhas internas e o fio, riscados no tecido (opcional);
 * - T4, o furador: as marcas (botões, casas), um furo em cada.
 *
 * A ordem: as peças pelo comprimento (a mesa avança num sentido só); em cada peça, primeiro o que fica dentro (a
 * caneta, os furos de broca, os piques, os furos) e por último o contorno — cortado o contorno, a peça se solta e o
 * que estiver dentro dela sairia fora do lugar. A ferramenta sobe (Z5) antes de andar sem cortar (G0) e desce (Z0)
 * para cortar (G1, na velocidade pedida).
 *
 * Não foi testado numa mesa de corte (não há uma aqui): a saída usa só os comandos básicos da norma (G0, G1, G21, G90,
 * Z, T, M30) e comentários entre parênteses. Os comandos próprios de cada fabricante (os do piqueteador, por exemplo)
 * ficam para o pós-processador da mesa. Confira no primeiro corte, numa folha de papel.
 *
 * A faca tangencial (ADR 0148), opcional: o eixo C acompanha o rumo do corte. Nas viradas pequenas a faca gira cortando;
 * acima do ângulo pedido, ela sobe, gira e desce — girar dentro do tecido rasgaria a ponta.
 */

export interface OpcoesDoIso {
  /** A largura útil da mesa (mm): o Y é contado da borda dela. Sem ela, da maior largura das peças. */
  readonly larguraDaMesaMm?: number;
  /** A velocidade de corte (mm/min). */
  readonly velocidadeMmMin?: number;
  /** Risca as linhas internas e o fio com a caneta (T3). */
  readonly comCaneta?: boolean;
  /** A faca tangencial: o eixo C acompanha o rumo do corte. */
  readonly facaTangencial?: boolean;
  /** A virada (graus) acima da qual a faca tangencial sobe para girar. */
  readonly anguloDeLevantarGraus?: number;
  /** A distância da ponta da lâmina ao eixo que gira (mm): o eixo anda adiantada dela no rumo do corte (ADR 0153). */
  readonly compensacaoDaLaminaMm?: number;
  /** Os furos das marcas pelos comandos M43 (desce) e M44 (sobe) do furador, e não pelo eixo Z (ADR 0173). */
  readonly furadorM43?: boolean;
}

export const VELOCIDADE_PADRAO_MM_MIN = 12000;
export const ANGULO_DE_LEVANTAR_PADRAO = 30;
const ALTURA_DE_ANDAR = 5;

const n = (v: number): string => (Math.round(v * 100) / 100).toFixed(2);

/** O rumo de `novo` (graus) na volta mais perto de `atual`: a faca não dá a volta inteira ao passar de 180°. */
export function rumoContinuo(atual: number, novo: number): number {
  let r = novo;
  while (r - atual > 180) r -= 360;
  while (r - atual < -180) r += 360;
  return r;
}

const rumo = (a: Ponto2D, b: Ponto2D): number => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

/**
 * Os trechos do contorno que a faca corta, pelos pontos CAM da peça (ADR 0173): sem eles, a volta inteira; completo, a
 * volta a partir da entrada; semi-corte, de entrada a saída pelos dois lados, cada um num sentido.
 */
export function trechosDoCorte(peca: Molde, corte: readonly Ponto2D[]): ReadonlyArray<{ readonly pontos: readonly Ponto2D[]; readonly fechado: boolean }> {
  const cam = peca.corteNaMesa;
  const n = corte.length;
  if (!cam || !peca.contorno[cam.entrada]) return [{ pontos: corte, fechado: true }];
  const maisPerto = (p: Ponto2D): number => corte.reduce((m, q, i) => (Math.hypot(q.x - p.x, q.y - p.y) < Math.hypot(corte[m]!.x - p.x, corte[m]!.y - p.y) ? i : m), 0);
  const entrada = maisPerto(peca.contorno[cam.entrada]!);
  if (cam.tipo === 'completo' || cam.saida === undefined || !peca.contorno[cam.saida]) return [{ pontos: [...corte.slice(entrada), ...corte.slice(0, entrada)], fechado: true }];
  const saida = maisPerto(peca.contorno[cam.saida]!);
  if (saida === entrada) return [{ pontos: [...corte.slice(entrada), ...corte.slice(0, entrada)], fechado: true }];
  const andar = (passo: 1 | -1): Ponto2D[] => {
    const pontos = [corte[entrada]!];
    for (let i = entrada; i !== saida; ) {
      i = (i + passo + n) % n;
      pontos.push(corte[i]!);
    }
    return pontos;
  };
  return [
    { pontos: andar(1), fechado: false },
    { pontos: andar(-1), fechado: false },
  ];
}

export function gerarIso(pecas: readonly Molde[], opcoes: OpcoesDoIso = {}): string {
  const todos = pecas.flatMap((p) => [...linhaDeCorteDaPeca(p), ...p.contorno]);
  const altura = todos.reduce((maior, p) => Math.max(maior, p.x), opcoes.larguraDaMesaMm ?? 0);
  const naMesa = (p: Ponto2D): Ponto2D => mundoParaDxf(p, altura);
  const f = Math.round(opcoes.velocidadeMmMin ?? VELOCIDADE_PADRAO_MM_MIN);
  const linhas: string[] = ['%', '(ENFESTO CAD - CORTE AUTOMATICO, ISO 6983)', '(T1 FACA, T2 PIQUETEADOR, T3 CANETA, T4 FURADOR)', 'G21', 'G90', `G0 Z${n(ALTURA_DE_ANDAR)}`];
  let ferramenta = 0;
  const usar = (t: number): void => {
    if (t === ferramenta) return;
    linhas.push(`G0 Z${n(ALTURA_DE_ANDAR)}`, `T${t}`);
    ferramenta = t;
  };
  /** O corte com a faca tangencial: o C no rumo de cada trecho; nas viradas grandes, sobe, gira e desce. */
  const corteTangencial = (caminho: readonly Ponto2D[]): void => {
    const t = caminho.filter((q, i) => i === 0 || Math.hypot(q.x - caminho[i - 1]!.x, q.y - caminho[i - 1]!.y) > 1e-6);
    if (t.length < 2) return;
    const limite = opcoes.anguloDeLevantarGraus ?? ANGULO_DE_LEVANTAR_PADRAO;
    const lamina = opcoes.compensacaoDaLaminaMm ?? 0;
    /** Onde o eixo fica para a ponta estar em `q`, no rumo `graus`. */
    const eixo = (q: Ponto2D, graus: number): Ponto2D => ponto(q.x + lamina * Math.cos((graus * Math.PI) / 180), q.y + lamina * Math.sin((graus * Math.PI) / 180));
    let c = rumo(t[0]!, t[1]!);
    const comeco = eixo(t[0]!, c);
    linhas.push(`G0 Z${n(ALTURA_DE_ANDAR)}`, `G0 X${n(comeco.x)} Y${n(comeco.y)} C${n(c)}`, 'G1 Z0.00');
    for (let i = 1; i < t.length; i++) {
      const novo = rumoContinuo(c, rumo(t[i - 1]!, t[i]!));
      if (Math.abs(novo - c) > limite) {
        const volta = eixo(t[i - 1]!, novo);
        linhas.push(`G0 Z${n(ALTURA_DE_ANDAR)}`, lamina === 0 ? `G0 C${n(novo)}` : `G0 X${n(volta.x)} Y${n(volta.y)} C${n(novo)}`, 'G1 Z0.00');
      }
      c = novo;
      const q = eixo(t[i]!, c);
      linhas.push(`G1 X${n(q.x)} Y${n(q.y)} C${n(c)}${i === 1 ? ` F${f}` : ''}`);
    }
    linhas.push(`G0 Z${n(ALTURA_DE_ANDAR)}`);
  };
  /** Uma passada: sobe, anda até o começo, desce e segue os pontos (fechada: volta ao começo); sobe no fim. */
  const passada = (pontos: readonly Ponto2D[], fechada: boolean, faca = false): void => {
    if (pontos.length < 2) return;
    const p = pontos.map(naMesa);
    const caminho = fechada ? [...p, p[0]!] : p;
    if (faca && opcoes.facaTangencial) {
      corteTangencial(caminho);
      return;
    }
    linhas.push(`G0 Z${n(ALTURA_DE_ANDAR)}`, `G0 X${n(caminho[0]!.x)} Y${n(caminho[0]!.y)}`, 'G1 Z0.00');
    caminho.slice(1).forEach((q, i) => linhas.push(i === 0 ? `G1 X${n(q.x)} Y${n(q.y)} F${f}` : `G1 X${n(q.x)} Y${n(q.y)}`));
    linhas.push(`G0 Z${n(ALTURA_DE_ANDAR)}`);
  };
  /** Um golpe num ponto (o furador): anda até ele, desce e sobe. */
  const golpe = (p: Ponto2D): void => {
    const q = naMesa(p);
    if (opcoes.furadorM43) linhas.push(`G0 X${n(q.x)} Y${n(q.y)}`, 'M43', 'M44');
    else linhas.push(`G0 X${n(q.x)} Y${n(q.y)}`, 'G1 Z0.00', `G0 Z${n(ALTURA_DE_ANDAR)}`);
  };
  // Pelo comprimento do encaixe (o y do mundo), de onde a peça começa.
  const naOrdem = [...pecas].sort((a, b) => retanguloEnvolvente(linhaDeCorteDaPeca(a)).minY - retanguloEnvolvente(linhaDeCorteDaPeca(b)).minY);
  for (const peca of naOrdem) {
    const corte = linhaDeCorteDaPeca(peca);
    linhas.push(`(${textoParaPlotter(`${peca.nome} ${peca.tamanho}`.trim()).replace(/[()]/g, '')})`);
    if (opcoes.comCaneta) {
      usar(3);
      for (const interna of linhasDoMolde(peca)) passada(interna, false);
      passada([peca.linhaDeFio.inicio, peca.linhaDeFio.fim], false);
    }
    if (peca.marcas.length > 0) {
      usar(4);
      for (const m of peca.marcas) golpe(m.posicao);
    }
    if (peca.piques.length > 0) {
      usar(2);
      for (const pique of peca.piques) passada(corteDoPique(peca, corte, pique), false);
    }
    usar(1);
    for (const furo of peca.furos) passada(furo, true, true);
    for (const t of trechosDoCorte(peca, corte)) passada(t.pontos, t.fechado, true);
  }
  linhas.push(`G0 Z${n(ALTURA_DE_ANDAR)}`, 'G0 X0.00 Y0.00', 'M30', '%');
  return linhas.join('\n') + '\n';
}

/** O resumo do corte, para dizer depois de salvar: as peças e o caminho cortado (m). */
export function resumoDoIso(pecas: readonly Molde[]): { readonly pecas: number; readonly corteM: number; readonly piques: number } {
  const perimetro = (c: readonly Ponto2D[]): number => c.reduce((s, p, i) => s + Math.hypot(c[(i + 1) % c.length]!.x - p.x, c[(i + 1) % c.length]!.y - p.y), 0);
  return {
    pecas: pecas.length,
    corteM: pecas.reduce((s, p) => s + perimetro(linhaDeCorteDaPeca(p)) + p.furos.reduce((t, furo) => t + perimetro(furo), 0), 0) / 1000,
    piques: pecas.reduce((s, p) => s + p.piques.length, 0),
  };
}

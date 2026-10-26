import type { Ponto2D } from '../core/geometria';
import { retanguloEnvolvente } from '../core/geometria';
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
 * Z, T, M30) e comentários entre parênteses. Os dialetos de cada fabricante (a faca tangencial no eixo C, os comandos
 * próprios do piqueteador) ficam para o pós-processador da mesa. Confira no primeiro corte, numa folha de papel.
 */

export interface OpcoesDoIso {
  /** A largura útil da mesa (mm): o Y é contado da borda dela. Sem ela, da maior largura das peças. */
  readonly larguraDaMesaMm?: number;
  /** A velocidade de corte (mm/min). */
  readonly velocidadeMmMin?: number;
  /** Risca as linhas internas e o fio com a caneta (T3). */
  readonly comCaneta?: boolean;
}

export const VELOCIDADE_PADRAO_MM_MIN = 12000;
const ALTURA_DE_ANDAR = 5;

const n = (v: number): string => (Math.round(v * 100) / 100).toFixed(2);

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
  /** Uma passada: sobe, anda até o começo, desce e segue os pontos (fechada: volta ao começo); sobe no fim. */
  const passada = (pontos: readonly Ponto2D[], fechada: boolean): void => {
    if (pontos.length < 2) return;
    const p = pontos.map(naMesa);
    const caminho = fechada ? [...p, p[0]!] : p;
    linhas.push(`G0 Z${n(ALTURA_DE_ANDAR)}`, `G0 X${n(caminho[0]!.x)} Y${n(caminho[0]!.y)}`, 'G1 Z0.00');
    caminho.slice(1).forEach((q, i) => linhas.push(i === 0 ? `G1 X${n(q.x)} Y${n(q.y)} F${f}` : `G1 X${n(q.x)} Y${n(q.y)}`));
    linhas.push(`G0 Z${n(ALTURA_DE_ANDAR)}`);
  };
  /** Um golpe num ponto (o furador): anda até ele, desce e sobe. */
  const golpe = (p: Ponto2D): void => {
    const q = naMesa(p);
    linhas.push(`G0 X${n(q.x)} Y${n(q.y)}`, 'G1 Z0.00', `G0 Z${n(ALTURA_DE_ANDAR)}`);
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
    for (const furo of peca.furos) passada(furo, true);
    passada(corte, true);
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

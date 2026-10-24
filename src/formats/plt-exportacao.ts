import type { Ponto2D } from '../core/geometria';
import { ponto, retanguloEnvolvente } from '../core/geometria';
import type { Molde } from '../domain/molde';
import { linhaDeCorteDaPeca } from '../domain/molde';
import { arestaDeSimetria } from '../domain/anotacoes';
import { linhasDoMolde } from '../domain/linhasAuxiliares';
import { corteDoPique, mundoParaDxf } from './dxf-exportacao';

/**
 * Exportação para plotter (ADR 0101): o encaixe como está na mesa, em escala 1:1, em HPGL (arquivo .plt) — a
 * linguagem que os plotters de papel de risco e muitas mesas de corte aceitam. 40 unidades de plotter por mm
 * (0,025 mm cada), o comprimento do encaixe no eixo x (o avanço do papel) e a largura no y, como na tela.
 *
 * O que vai: a linha de corte de cada peça, a costura, os furos, as linhas internas do molde, o fio, os piques (o
 * corte reto na linha de corte), a aresta de simetria, o nome da peça e o contorno da mesa. Tudo com a caneta 1.
 *
 * Não foi testado num plotter físico (não há um aqui): a saída segue a especificação do HPGL (IN, SP, PU, PD, DT,
 * SI, LB), sem comandos próprios de nenhum fabricante. Confira a escala no primeiro risco impresso.
 */

export const UNIDADES_POR_MM = 40;

export interface OpcoesDoPlt {
  /** A mesa (largura útil e comprimento): com ela, o contorno da mesa sai no risco e o y é contado da borda. */
  readonly larguraDaMesaMm?: number;
  readonly comprimentoDaMesaMm?: number;
}

const u = (mm: number): number => Math.round(mm * UNIDADES_POR_MM);

/** O texto que o plotter escreve: sem acentos (o HPGL básico é ASCII) e sem o terminador do rótulo. */
export function textoParaPlotter(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[—–]/g, '-')
    .replace(/[^\x20-\x7e]/g, '?');
}

export function gerarPlt(pecas: readonly Molde[], opcoes: OpcoesDoPlt = {}): string {
  const todos = pecas.flatMap((p) => [...linhaDeCorteDaPeca(p), ...p.contorno]);
  const altura = todos.reduce((maior, p) => Math.max(maior, p.x), opcoes.larguraDaMesaMm ?? 0);
  const noPapel = (p: Ponto2D): Ponto2D => mundoParaDxf(p, altura);
  const comandos: string[] = ['IN', 'SP1', `DT${String.fromCharCode(3)}`];

  /** Uma linha: levanta a caneta até o começo e desce desenhando os pontos (fechada: volta ao começo). */
  const linha = (pontos: readonly Ponto2D[], fechada: boolean): void => {
    if (pontos.length < 2) return;
    const noP = pontos.map(noPapel);
    const resto = fechada ? [...noP.slice(1), noP[0]!] : noP.slice(1);
    comandos.push(`PU${u(noP[0]!.x)},${u(noP[0]!.y)}`);
    comandos.push(`PD${resto.map((p) => `${u(p.x)},${u(p.y)}`).join(',')}`);
  };

  if (opcoes.comprimentoDaMesaMm !== undefined && opcoes.larguraDaMesaMm !== undefined) {
    linha([ponto(0, 0), ponto(opcoes.larguraDaMesaMm, 0), ponto(opcoes.larguraDaMesaMm, opcoes.comprimentoDaMesaMm), ponto(0, opcoes.comprimentoDaMesaMm)], true);
  }
  for (const peca of pecas) {
    const corte = linhaDeCorteDaPeca(peca);
    linha(corte, true);
    if (corte !== peca.contorno) linha(peca.contorno, true);
    for (const furo of peca.furos) linha(furo, true);
    for (const interna of linhasDoMolde(peca)) linha(interna, false);
    linha([peca.linhaDeFio.inicio, peca.linhaDeFio.fim], false);
    for (const pique of peca.piques) linha(corteDoPique(peca, corte, pique), false);
    const simetria = arestaDeSimetria(peca);
    if (simetria !== null) linha([peca.contorno[simetria]!, peca.contorno[(simetria + 1) % peca.contorno.length]!], false);
    // O nome, a partir do canto de baixo da caixa da peça (no papel), em letras de 5 mm.
    const caixa = retanguloEnvolvente(peca.contorno);
    const inicio = noPapel(ponto(caixa.maxX - 10, caixa.minY + 10));
    comandos.push(`PU${u(inicio.x)},${u(inicio.y)}`, 'SI0.35,0.5', `LB${textoParaPlotter(`${peca.nome} ${peca.tamanho}`.trim())}${String.fromCharCode(3)}`);
  }
  comandos.push('PU0,0', 'SP0');
  return comandos.join(';') + ';\n';
}

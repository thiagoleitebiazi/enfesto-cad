import { tracosDoTexto } from './fonteDeTracos';
import type { Ponto2D } from '../core/geometria';
import { area, ponto, retanguloEnvolvente } from '../core/geometria';
import type { Molde } from '../domain/molde';
import { linhaDeCorteDaPeca } from '../domain/molde';
import { arestaDeSimetria } from '../domain/anotacoes';
import { linhasDoMolde } from '../domain/linhasAuxiliares';
import { blocosNaMesa, divisasEntreOsBlocos, nomeDoBloco } from '../domain/gruposDoEncaixe';
import { corteDoPique, mundoParaDxf } from './dxf-exportacao';

/**
 * Exportação para plotter (ADR 0101): o encaixe como está na mesa, em escala 1:1, em HPGL (arquivo .plt) — a
 * linguagem que os plotters de papel de risco e muitas mesas de corte aceitam. 40 unidades de plotter por mm
 * (0,025 mm cada), o comprimento do encaixe no eixo x (o avanço do papel) e a largura no y, como na tela.
 *
 * O que vai: a linha de corte de cada peça, a costura, os furos, as linhas internas do molde, o fio, os piques (o
 * corte reto na linha de corte), a aresta de simetria, o nome da peça, a divisa dos grupos do encaixe e o contorno da
 * mesa. Com uma caneta (o padrão), tudo com a 1; com duas, a linha de corte com a 1 e o risco (o resto e os textos) com a
 * 2 — no plotter de uma caneta só, as linhas da 2 não sairiam, por isso duas é escolha (menu Opções).
 *
 * Não foi testado num plotter físico (não há um aqui): a saída segue a especificação do HPGL (IN, SP, PU, PD, DT,
 * SI, LB), sem comandos próprios de nenhum fabricante. Confira a escala no primeiro risco impresso.
 *
 * Por partes (ADR 0158): o "X inicial" retoma o risco de onde o papel acabou (o que vem antes não sai, e o comprimento
 * recomeça do zero); a largura do papel divide um risco mais largo que ele em faixas, e sai só a pedida. O corte é
 * feito pelo próprio plotter (IW, a janela de recorte do HPGL).
 */

export const UNIDADES_POR_MM = 40;

export type ElementoDoPlotter = 'corte' | 'costura' | 'furos' | 'internas' | 'fio' | 'piques' | 'textos';

export const ROTULO_DO_ELEMENTO: Readonly<Record<ElementoDoPlotter, string>> = {
  corte: 'Linha de corte',
  costura: 'Linha de costura',
  furos: 'Furos',
  internas: 'Linhas internas',
  fio: 'Fio',
  piques: 'Piques',
  textos: 'Nomes e textos',
};

export interface OpcoesDoPlt {
  /** A mesa (largura útil e comprimento): com ela, o contorno da mesa sai no risco e o y é contado da borda. */
  readonly larguraDaMesaMm?: number;
  readonly comprimentoDaMesaMm?: number;
  /** 1 (o padrão): tudo com a caneta 1. 2: a linha de corte com a 1, o resto com a 2. */
  readonly canetas?: 1 | 2;
  /** Onde o risco recomeça, no comprimento (mm): o papel acabou ali. */
  readonly xInicialMm?: number;
  /** A largura do papel (mm), quando o risco não cabe nela: sai a `faixa` pedida. */
  readonly larguraDoPapelMm?: number;
  /** A faixa (1, 2…), contada da borda de baixo do papel. */
  readonly faixa?: number;
  /** Os pontos de emenda: uma linha na largura toda e a palavra, em cada um (ADR 0188). */
  readonly emendas?: readonly number[];
  /** Os textos desenhados em traços, para o plotter sem letreiro (ADR 0184). */
  readonly textoComoLinha?: boolean;
  /** As linhas que identificam o risco, escritas logo depois da última peça (ADR 0162). */
  readonly cabecalho?: readonly string[];
  /** A caneta de cada elemento (ADR 0174): a aba Ferramentas do manual da referência. Quem não está aqui usa a regra de `canetas`. */
  readonly ferramentas?: Readonly<Partial<Record<ElementoDoPlotter, number>>>;
  /** Os textos livres, no lugar deles na mesa (ADR 0165). */
  readonly textos?: readonly { readonly x: number; readonly y: number; readonly texto: string }[];
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

/** O que identifica o risco no papel: o modelo, a data, as medidas e o aproveitamento (ADR 0162). */
export function cabecalhoDoRisco(d: { readonly nome: string; readonly codigo: string; readonly pecas: readonly Molde[]; readonly larguraMm: number | null; readonly dataIso: string }): string[] {
  const linhas = [`${d.nome} (${d.codigo}) - ${d.dataIso.slice(8, 10)}/${d.dataIso.slice(5, 7)}/${d.dataIso.slice(0, 4)}`];
  const cortes = d.pecas.map((p) => linhaDeCorteDaPeca(p));
  if (cortes.length === 0) return linhas;
  const caixa = retanguloEnvolvente(cortes.flat());
  const comprimento = caixa.maxY - caixa.minY;
  const cm = (mm: number): string => (mm / 10).toFixed(1).replace('.', ',');
  const largura = d.larguraMm ?? caixa.maxX - caixa.minX;
  const aproveitamento = (cortes.reduce((s, c) => s + area(c), 0) / (largura * comprimento)) * 100;
  linhas.push(`Largura ${cm(largura)} cm - Comprimento ${cm(comprimento)} cm - Aproveitamento ${aproveitamento.toFixed(1).replace('.', ',')}% - ${d.pecas.length} pecas`);
  const meias = [...new Set(d.pecas.filter((p) => p.meiaCamada).map((p) => p.nome))];
  if (meias.length > 0) linhas.push(`1/2 camada: ${meias.join(', ')}`);
  return linhas;
}

export function gerarPlt(pecas: readonly Molde[], opcoes: OpcoesDoPlt = {}): string {
  const todos = pecas.flatMap((p) => [...linhaDeCorteDaPeca(p), ...p.contorno]);
  const altura = todos.reduce((maior, p) => Math.max(maior, p.x), opcoes.larguraDaMesaMm ?? 0);
  const xInicial = opcoes.xInicialMm ?? 0;
  const baseDaFaixa = opcoes.larguraDoPapelMm !== undefined ? (Math.max(1, opcoes.faixa ?? 1) - 1) * opcoes.larguraDoPapelMm : 0;
  const noPapel = (p: Ponto2D): Ponto2D => {
    const q = mundoParaDxf(p, altura);
    return ponto(q.x - xInicial, q.y - baseDaFaixa);
  };
  const comandos: string[] = ['IN', 'SP1', `DT${String.fromCharCode(3)}`];
  if (xInicial > 0 || opcoes.larguraDoPapelMm !== undefined) {
    const comprimento = pecas.flatMap((p) => linhaDeCorteDaPeca(p)).reduce((maior, p) => Math.max(maior, p.y), opcoes.comprimentoDaMesaMm ?? 0);
    comandos.push(`IW0,0,${u(Math.max(1, comprimento - xInicial))},${u(opcoes.larguraDoPapelMm ?? altura)}`);
  }

  /** Uma linha: levanta a caneta até o começo e desce desenhando os pontos (fechada: volta ao começo). */
  const linha = (pontos: readonly Ponto2D[], fechada: boolean): void => {
    if (pontos.length < 2) return;
    const noP = pontos.map(noPapel);
    const resto = fechada ? [...noP.slice(1), noP[0]!] : noP.slice(1);
    comandos.push(`PU${u(noP[0]!.x)},${u(noP[0]!.y)}`);
    comandos.push(`PD${resto.map((p) => `${u(p.x)},${u(p.y)}`).join(',')}`);
  };

  /** Um texto, a partir de um ponto do papel: no letreiro do plotter ou em traços. */
  const rotulo = (onde: Ponto2D, texto: string, larguraCm: number, alturaCm: number): void => {
    if (!opcoes.textoComoLinha) {
      comandos.push(`PU${u(onde.x)},${u(onde.y)}`, `SI${larguraCm},${alturaCm}`, `LB${textoParaPlotter(texto)}${String.fromCharCode(3)}`);
      return;
    }
    for (const traco of tracosDoTexto(texto, alturaCm * 10)) {
      const [primeiro, ...resto] = traco.map((p) => ({ x: onde.x + p.x, y: onde.y + p.y }));
      comandos.push(`PU${u(primeiro!.x)},${u(primeiro!.y)}`, `PD${resto.map((p) => `${u(p.x)},${u(p.y)}`).join(',')}`);
    }
  };

  let canetaAtual = 1;
  /** Troca de caneta, se pediu duas (com uma, tudo fica na 1); a do elemento, se ele tem uma. */
  const caneta = (n: 1 | 2, elemento?: ElementoDoPlotter): void => {
    const pedida = (elemento && opcoes.ferramentas?.[elemento]) || (opcoes.canetas === 2 ? n : 1);
    if (pedida === canetaAtual) return;
    comandos.push(`SP${pedida}`);
    canetaAtual = pedida;
  };

  if (opcoes.comprimentoDaMesaMm !== undefined && opcoes.larguraDaMesaMm !== undefined) {
    caneta(2);
    linha([ponto(0, 0), ponto(opcoes.larguraDaMesaMm, 0), ponto(opcoes.larguraDaMesaMm, opcoes.comprimentoDaMesaMm), ponto(0, opcoes.comprimentoDaMesaMm)], true);
  }
  // Os grupos do encaixe: a divisa atravessando a mesa e o nome no começo de cada trecho.
  const blocos = blocosNaMesa(pecas);
  if (blocos.length > 0) {
    caneta(2);
    const largura = opcoes.larguraDaMesaMm ?? altura;
    for (const divisa of divisasEntreOsBlocos(blocos)) linha([ponto(0, divisa), ponto(largura, divisa)], false);
    for (const bloco of blocos) {
      const onde = noPapel(ponto(-8, bloco.inicioMm));
      rotulo(onde, nomeDoBloco(bloco), 0.35, 0.5);
    }
  }
  for (const peca of pecas) {
    const corte = linhaDeCorteDaPeca(peca);
    caneta(1, 'corte');
    linha(corte, true);
    caneta(2, 'costura');
    if (corte !== peca.contorno) linha(peca.contorno, true);
    caneta(2, 'furos');
    for (const furo of peca.furos) linha(furo, true);
    caneta(2, 'internas');
    for (const interna of linhasDoMolde(peca)) linha(interna, false);
    caneta(2, 'fio');
    linha([peca.linhaDeFio.inicio, peca.linhaDeFio.fim], false);
    caneta(2, 'piques');
    for (const pique of peca.piques) linha(corteDoPique(peca, corte, pique), false);
    const simetria = arestaDeSimetria(peca);
    if (simetria !== null) linha([peca.contorno[simetria]!, peca.contorno[(simetria + 1) % peca.contorno.length]!], false);
    // O nome, a partir do canto de baixo da caixa da peça (no papel), em letras de 5 mm.
    caneta(2, 'textos');
    const caixa = retanguloEnvolvente(peca.contorno);
    const inicio = noPapel(ponto(caixa.maxX - 10, caixa.minY + 10));
    rotulo(inicio, `${peca.nome} ${peca.tamanho}`.trim(), 0.35, 0.5);
  }
  for (const e of opcoes.emendas ?? []) {
    caneta(2);
    linha([ponto(0, e), ponto(opcoes.larguraDaMesaMm ?? altura, e)], false);
    rotulo(noPapel(ponto(-8, e)), 'EMENDA', 0.25, 0.35);
  }
  for (const t of opcoes.textos ?? []) {
    caneta(2);
    const onde = noPapel(ponto(t.x, t.y));
    rotulo(onde, t.texto, 0.25, 0.35);
  }
  if ((opcoes.cabecalho ?? []).length > 0 && pecas.length > 0) {
    caneta(2);
    // Depois da última peça sempre há papel: a largura da mesa pode não ter folga, o comprimento tem.
    const fim = retanguloEnvolvente(pecas.flatMap((p) => linhaDeCorteDaPeca(p))).maxY;
    opcoes.cabecalho!.forEach((texto, i) => {
      const onde = noPapel(ponto(10 + i * 8, fim + 20));
      rotulo(onde, texto, 0.25, 0.35);
    });
  }
  comandos.push('PU0,0', 'SP0');
  return comandos.join(';') + ';\n';
}

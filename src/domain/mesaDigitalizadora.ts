import { ponto, type Ponto2D } from '../core/geometria';

/**
 * A mesa digitalizadora (o quadro de captura, ADR 0144): o molde de papel preso na mesa, e o cursor tocado em cada
 * ponto. A mesa manda, pela porta serial, uma linha de texto por toque — as coordenadas em "linhas" (a resolução da
 * mesa, em linhas por polegada) e o botão do cursor apertado —, no formato ASCII que as mesas de modelagem usam
 * ("XXXXX,YYYYY,B": os números separados por vírgula, espaço ou ponto e vírgula; algumas mandam o botão primeiro).
 *
 * Cada botão faz uma coisa (`BOTOES_DA_MESA`): ponto de canto, ponto de curva, pique, fio, fechar a peça, desfazer.
 * Fechar transforma os pontos numa peça: as curvas passam pelos pontos de curva, os piques ficam nos pontos marcados e
 * o fio é o dos dois toques (sem ele, horizontal pelo meio da peça).
 *
 * Não foi testado numa mesa de verdade (não há uma aqui): o formato segue o das mesas de modelagem mais comuns, e a
 * resolução, a ordem dos campos e a velocidade da porta ficam na tela, para acertar com o manual da mesa.
 */

export interface ConfiguracaoDaMesa {
  /** A resolução da mesa: quantas linhas (a unidade das coordenadas) por polegada. */
  readonly linhasPorPolegada: number;
  /** O botão vem antes das coordenadas ("B,XXXXX,YYYYY"). */
  readonly botaoNoComeco: boolean;
}

export const CONFIGURACAO_PADRAO_DA_MESA: ConfiguracaoDaMesa = { linhasPorPolegada: 1000, botaoNoComeco: false };

export interface RegistroDaMesa {
  /** Em linhas da mesa: x para a direita, y para cima. */
  readonly x: number;
  readonly y: number;
  readonly botao: number;
}

export type AcaoDoBotao = 'canto' | 'curva' | 'pique' | 'fio' | 'fechar' | 'desfazer';

export const BOTOES_DA_MESA: ReadonlyArray<{ readonly botao: number; readonly acao: AcaoDoBotao; readonly rotulo: string }> = [
  { botao: 1, acao: 'canto', rotulo: 'Ponto de canto do contorno' },
  { botao: 2, acao: 'curva', rotulo: 'Ponto de curva do contorno' },
  { botao: 3, acao: 'pique', rotulo: 'Pique (também é ponto do contorno)' },
  { botao: 4, acao: 'fio', rotulo: 'Fio: o começo e o fim (dois toques)' },
  { botao: 5, acao: 'fechar', rotulo: 'Fechar a peça' },
  { botao: 6, acao: 'desfazer', rotulo: 'Desfazer o último ponto' },
];

const INTEIRO = /^[+-]?\d+$/;

/** Uma linha da mesa; `null` se ela não é um toque (o cabeçalho, uma linha quebrada). */
export function lerRegistro(linha: string, config: ConfiguracaoDaMesa = CONFIGURACAO_PADRAO_DA_MESA): RegistroDaMesa | null {
  const partes = linha.trim().split(/[\s,;]+/).filter((p) => p !== '');
  if (partes.length < 3) return null;
  const [b, x, y] = config.botaoNoComeco ? [partes[0]!, partes[1]!, partes[2]!] : [partes[2]!, partes[0]!, partes[1]!];
  if (!INTEIRO.test(x) || !INTEIRO.test(y)) return null;
  const botao = /^\d{1,2}$/.test(b) ? Number(b) : /^[A-Fa-f]$/.test(b) ? parseInt(b, 16) : NaN;
  if (!Number.isFinite(botao)) return null;
  return { x: Number(x), y: Number(y), botao };
}

/** As linhas de um registro colado (ou guardado por um programa de terminal): os toques, e quantas ficaram de fora. */
export function lerRegistros(texto: string, config: ConfiguracaoDaMesa = CONFIGURACAO_PADRAO_DA_MESA): { readonly registros: RegistroDaMesa[]; readonly ignoradas: number } {
  const linhas = texto.split(/[\r\n]+/).filter((l) => l.trim() !== '');
  const registros = linhas.map((l) => lerRegistro(l, config)).filter((r): r is RegistroDaMesa => r !== null);
  return { registros, ignoradas: linhas.length - registros.length };
}

/** O toque em milímetros, nos eixos do desenho (x para baixo, y para a direita). */
export function pontoDaMesa(r: RegistroDaMesa, config: ConfiguracaoDaMesa): Ponto2D {
  // Ao milésimo de milímetro (bem abaixo da precisão de qualquer mesa): sem os restos da conta das polegadas.
  const mm = (linhas: number): number => Math.round((linhas * 25.4 * 1000) / config.linhasPorPolegada) / 1000 + 0;
  return ponto(mm(-r.y), mm(r.x));
}

export interface PontoNaMesa {
  readonly p: Ponto2D;
  readonly curva: boolean;
  readonly pique: boolean;
}

export interface EstadoDaMesa {
  readonly pontos: readonly PontoNaMesa[];
  readonly fio: readonly Ponto2D[];
}

export const MESA_VAZIA: EstadoDaMesa = { pontos: [], fio: [] };

export interface PecaDaMesa {
  readonly contorno: Ponto2D[];
  readonly linhaDeFio: { readonly inicio: Ponto2D; readonly fim: Ponto2D };
  readonly piques: ReadonlyArray<{ readonly posicao: Ponto2D; readonly indiceAresta: number }>;
}

/** Os pontos de cada trecho de curva (Catmull-Rom), entre o ponto `i` e o seguinte. */
const PASSOS_DA_CURVA = 8;

function catmullRom(p0: Ponto2D, p1: Ponto2D, p2: Ponto2D, p3: Ponto2D, t: number): Ponto2D {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a: number, b: number, c: number, d: number): number => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return ponto(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y));
}

/**
 * A peça dos pontos tocados: os trechos que tocam um ponto de curva viram curva (passando pelos pontos), os de canto
 * ficam retos; os piques ficam nos seus pontos; o fio é o dos dois toques, ou horizontal pelo meio. A peça sai com o
 * canto de cima à esquerda no zero.
 */
export function pecaDosPontos(estado: EstadoDaMesa): PecaDaMesa | { readonly erro: string } {
  const pts = estado.pontos;
  if (pts.length < 3) return { erro: `A peça precisa de ao menos 3 pontos no contorno (tem ${pts.length}).` };
  const n = pts.length;
  const contorno: Ponto2D[] = [];
  const indiceNovo: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i]!;
    const b = pts[(i + 1) % n]!;
    indiceNovo.push(contorno.length);
    contorno.push(a.p);
    if (a.curva || b.curva) {
      const antes = pts[(i - 1 + n) % n]!.p;
      const depois = pts[(i + 2) % n]!.p;
      for (let k = 1; k < PASSOS_DA_CURVA; k++) contorno.push(catmullRom(antes, a.p, b.p, depois, k / PASSOS_DA_CURVA));
    }
  }
  const minX = Math.min(...contorno.map((p) => p.x));
  const minY = Math.min(...contorno.map((p) => p.y));
  const maxX = Math.max(...contorno.map((p) => p.x));
  const maxY = Math.max(...contorno.map((p) => p.y));
  if (maxX - minX < 1 || maxY - minY < 1) return { erro: 'Os pontos estão todos numa linha: a peça não tem área.' };
  const mover = (p: Ponto2D): Ponto2D => ponto(p.x - minX, p.y - minY);
  const linhaDeFio =
    estado.fio.length >= 2
      ? { inicio: mover(estado.fio[0]!), fim: mover(estado.fio[1]!) }
      : { inicio: ponto((maxX - minX) / 2, (maxY - minY) * 0.2), fim: ponto((maxX - minX) / 2, (maxY - minY) * 0.8) };
  return {
    contorno: contorno.map(mover),
    linhaDeFio,
    piques: pts.flatMap((pt, i) => (pt.pique ? [{ posicao: mover(pt.p), indiceAresta: indiceNovo[i]! }] : [])),
  };
}

export interface ResultadoDoToque {
  readonly estado: EstadoDaMesa;
  readonly recado: string;
  /** Ao fechar: a peça pronta (e a mesa volta a ficar vazia para a próxima). */
  readonly peca?: PecaDaMesa;
}

/** Um toque do cursor: o que o botão faz com os pontos de agora. */
export function tocar(estado: EstadoDaMesa, registro: RegistroDaMesa, config: ConfiguracaoDaMesa = CONFIGURACAO_PADRAO_DA_MESA): ResultadoDoToque {
  const acao = BOTOES_DA_MESA.find((b) => b.botao === registro.botao)?.acao;
  const p = pontoDaMesa(registro, config);
  switch (acao) {
    case 'canto':
    case 'curva':
    case 'pique': {
      const novo = { pontos: [...estado.pontos, { p, curva: acao === 'curva', pique: acao === 'pique' }], fio: estado.fio };
      return { estado: novo, recado: `${novo.pontos.length}º ponto (${acao === 'canto' ? 'canto' : acao === 'curva' ? 'curva' : 'pique'}).` };
    }
    case 'fio': {
      const fio = estado.fio.length >= 2 ? [p] : [...estado.fio, p];
      return { estado: { ...estado, fio }, recado: fio.length === 1 ? 'Começo do fio marcado: toque o fim.' : 'Fio marcado.' };
    }
    case 'desfazer':
      if (estado.pontos.length === 0) return { estado, recado: 'Não há ponto para desfazer.' };
      return { estado: { ...estado, pontos: estado.pontos.slice(0, -1) }, recado: `Último ponto desfeito (ficaram ${estado.pontos.length - 1}).` };
    case 'fechar': {
      const peca = pecaDosPontos(estado);
      if ('erro' in peca) return { estado, recado: peca.erro };
      return { estado: MESA_VAZIA, recado: `Peça fechada com ${estado.pontos.length} pontos${peca.piques.length > 0 ? ` e ${peca.piques.length} pique(s)` : ''}.`, peca };
    }
    default:
      return { estado, recado: `Botão ${registro.botao}: sem uso (veja a tabela dos botões).` };
  }
}

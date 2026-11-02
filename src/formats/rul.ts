import type { Ponto2D } from '../core/geometria';
import { cantosDoContorno, regraDoVertice } from '../domain/graduacao';
import type { Molde } from '../domain/molde';

/**
 * O arquivo de regras de graduação (.RUL) da norma ASTM D6673 (ADR 0207): um texto com o cabeçalho (unidades, tamanhos,
 * tamanho base) e, em cada "RULE: DELTA n", o crescimento X,Y do ponto em cada tamanho, a partir da base, nos eixos do
 * DXF. O ponto se liga à regra por um texto "# n" em cima dele, no bloco da peça.
 */

export interface TabelaDeRegras {
  readonly nome: string;
  readonly tamanhos: readonly string[];
  readonly tamanhoBase: string;
  /** Unidades do arquivo por mm: os valores daqui já estão em unidades do desenho. */
  readonly ingles: boolean;
  readonly regras: ReadonlyMap<string, readonly Ponto2D[]>;
}

const PAR = /(-?\d*\.?\d+)\s*,\s*(-?\d*\.?\d+)/g;

/** Lê a tabela; recusa, dizendo o motivo, o que não tem tamanhos ou tem regra com outra contagem de valores. */
export function lerRul(texto: string): TabelaDeRegras {
  const linhas = texto.split(/\r?\n/);
  const campo = (chave: string): string => {
    const achada = linhas.find((l) => l.replace(/\s+/g, ' ').trim().toUpperCase().startsWith(`${chave}:`));
    return achada ? achada.slice(achada.indexOf(':') + 1).trim() : '';
  };
  const tamanhos = campo('SIZE LIST').split(/\s+/).filter((t) => t !== '');
  if (tamanhos.length === 0) throw new Error('O arquivo de regras não tem a lista de tamanhos (SIZE LIST).');
  const regras = new Map<string, Ponto2D[]>();
  let atual: Ponto2D[] | null = null;
  for (const linha of linhas) {
    const inicio = /^\s*RULE\s*:\s*(\S+)\s+(\S+)/i.exec(linha);
    if (inicio) {
      atual = [];
      regras.set(inicio[2]!, atual);
      continue;
    }
    if (!atual) continue;
    for (const m of linha.matchAll(PAR)) atual.push({ x: Number(m[1]), y: Number(m[2]) });
  }
  for (const [id, valores] of regras) {
    if (valores.length !== tamanhos.length) throw new Error(`A regra ${id} tem ${valores.length} valores, para ${tamanhos.length} tamanhos.`);
  }
  return { nome: campo('GRADE RULE TABLE'), tamanhos, tamanhoBase: campo('SAMPLE SIZE'), ingles: campo('UNITS').toUpperCase() === 'ENGLISH', regras };
}

const n = (v: number): string => (Object.is(v, -0) ? 0 : v).toFixed(2);
const VALORES_POR_LINHA = 4;

export interface RegrasDoEstilo {
  /** O texto do .RUL. */
  readonly rul: string;
  /** Para cada peça (pelo id) e vértice do contorno, o número da regra. */
  readonly idDoPonto: ReadonlyMap<string, ReadonlyMap<number, string>>;
  /** As peças de fora: têm outros tamanhos que a primeira. */
  readonly deFora: readonly string[];
}

/**
 * A tabela das peças graduadas do projeto. Só os cantos ganham regra: os outros pontos a norma leva na proporção. Uma
 * tabela tem uma lista de tamanhos só; a peça com outra grade fica de fora, e o programa avisa.
 */
export function gerarRul(pecas: readonly Molde[], estilo: string, agora: Date): RegrasDoEstilo {
  const graduadas = pecas.filter((p) => p.graduacao);
  const g = graduadas[0]?.graduacao;
  if (!g) throw new Error('Nenhuma peça graduada: não há o que escrever na tabela de regras.');
  const mesma = (p: Molde): boolean => p.graduacao!.tamanhos.join('|') === g.tamanhos.join('|');
  const dd = String(agora.getDate()).padStart(2, '0');
  const mm = String(agora.getMonth() + 1).padStart(2, '0');
  const cabecalho = [
    'ASTM/D13 PROPOSAL 1 VERSION: D 6673-10',
    'AUTHOR: ENFESTO',
    `CREATION DATE: ${dd}-${mm}-${agora.getFullYear()}`,
    `CREATION TIME: ${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`,
    'UNITS: METRIC',
    `GRADE RULE TABLE: ${estilo}`,
    `NUMBER OF SIZES: ${g.tamanhos.length}`,
    `SIZE LIST: ${g.tamanhos.join(' ')}`,
    `SAMPLE SIZE: ${g.tamanhos[g.base]!}`,
  ];
  const corpo: string[] = [];
  const idDoPonto = new Map<string, Map<number, string>>();
  let proximo = 1;
  for (const peca of graduadas.filter(mesma)) {
    const daPeca = new Map<number, string>();
    idDoPonto.set(peca.id, daPeca);
    for (const i of cantosDoContorno(peca.contorno)) {
      const id = String(proximo++);
      daPeca.set(i, id);
      corpo.push(`RULE: DELTA ${id}`);
      const valores = regraDoVertice(peca.graduacao!, peca.contorno, i).map((d) => `${n(d.y)},${n(-d.x)}`);
      for (let k = 0; k < valores.length; k += VALORES_POR_LINHA) corpo.push(valores.slice(k, k + VALORES_POR_LINHA).join('  '));
    }
  }
  return { rul: `${[...cabecalho, ...corpo].join('\r\n')}\r\n`, idDoPonto, deFora: graduadas.filter((p) => !mesma(p)).map((p) => p.nome) };
}

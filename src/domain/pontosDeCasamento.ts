import { pontoDentroDoContorno, type Ponto2D } from '../core/geometria';
import type { Marca, Molde, RelacaoDoCasamento } from './molde';
import { grupoDaMarcaDeCasamento, ROTULO_DO_PONTO_DE_CASAMENTO } from './risco';

/**
 * Os pontos de casamento na peça (ADR 0130): a marca que o risco usa para casar listras e xadrez (ADR 0089, 0129) —
 * o ponto principal ("casamento"), que cai na linha do desenho, e o de cada grupo ("casamento: manga"), que cai na
 * mesma listra que o do mesmo grupo nas outras peças. Um de cada grupo por peça.
 */

/** O nome do grupo como o risco lê (sem espaços nas pontas, em minúsculas); '' é o ponto principal. */
export const grupoLimpo = (grupo: string): string => grupo.trim().toLocaleLowerCase('pt-BR');

/** O rótulo da marca do grupo: "casamento" (o principal) ou "casamento: manga". */
export function rotuloDoPontoDeCasamento(grupo: string): string {
  const g = grupoLimpo(grupo);
  return g === '' ? ROTULO_DO_PONTO_DE_CASAMENTO : `${ROTULO_DO_PONTO_DE_CASAMENTO}: ${g}`;
}

/** Como o ponto é dito na tela: "o ponto de casamento principal" ou "o ponto “casamento: manga”". */
export function nomeDoPontoDeCasamento(grupo: string): string {
  const g = grupoLimpo(grupo);
  return g === '' ? 'o ponto de casamento principal' : `o ponto “${rotuloDoPontoDeCasamento(g)}”`;
}

/**
 * Põe o ponto de casamento do grupo na peça, onde foi clicado (dentro dela). Se a peça já tinha o ponto desse grupo,
 * ele anda para o lugar novo (\`movido\`). Recusa o ponto fora da peça.
 */
function comRelacao(m: Marca, relacao: RelacaoDoCasamento | undefined): Marca {
  const { relacaoDoCasamento, ...resto } = m;
  if (relacao) return { ...resto, relacaoDoCasamento: relacao };
  return relacaoDoCasamento ? resto : m;
}

export function comPontoDeCasamento(molde: Molde, grupo: string, posicao: Ponto2D, novoId: string, relacao?: RelacaoDoCasamento): { readonly molde: Molde; readonly movido: boolean } {
  if (!pontoDentroDoContorno(posicao, molde.contorno)) throw new Error('Clique dentro da peça, no ponto em que passa a linha do desenho (a listra).');
  const g = grupoLimpo(grupo);
  if (/[:\-–—]/.test(g)) throw new Error('O nome do grupo não pode ter dois-pontos nem traço (eles separam o nome no rótulo).');
  const existente = molde.marcas.find((m) => grupoDaMarcaDeCasamento(m.rotulo) === g);
  if (existente) return { molde: { ...molde, marcas: molde.marcas.map((m) => (m === existente ? comRelacao({ ...m, posicao }, relacao) : m)) }, movido: true };
  return { molde: { ...molde, marcas: [...molde.marcas, comRelacao({ id: novoId, posicao, rotulo: rotuloDoPontoDeCasamento(g) }, relacao)] }, movido: false };
}

/** Os grupos de casamento que a peça tem ('' é o principal), na ordem das marcas. */
export function gruposDeCasamentoDaPeca(molde: Molde): string[] {
  return molde.marcas.map((m) => grupoDaMarcaDeCasamento(m.rotulo)).filter((g): g is string => g !== null);
}

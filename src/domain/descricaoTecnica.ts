import { tamanhosDasPecas } from './fichaTecnica';
import type { Molde } from './molde';
import { tecidosDoModelo } from './tecidosDoModelo';

const lista = (itens: readonly string[]): string => (itens.length > 1 ? `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}` : (itens[0] ?? ''));

/** A descrição técnica preliminar (ADR 0223): o que os moldes já dizem, para a ficha não começar em branco. */
export function descricaoTecnicaDosMoldes(pecas: readonly Molde[]): string {
  const moldes = pecas.filter((p) => !p.naoUsar);
  if (moldes.length === 0) return '';
  const pecasEscritas = moldes.map((p) => `${p.nome} (${p.quantidade}${p.emPar ? ', em par' : ''})`);
  const frases = [`Modelo com ${moldes.length} ${moldes.length === 1 ? 'molde' : 'moldes'}: ${lista(pecasEscritas)}.`];
  const tamanhos = tamanhosDasPecas(moldes);
  if (tamanhos.length > 0) frases.push(`Tamanhos: ${lista([...tamanhos])}.`);
  const tecidos = tecidosDoModelo(moldes);
  if (tecidos.length > 1) frases.push(`Tecidos: ${lista(tecidos)}.`);
  const costuras = [...new Set(moldes.map((p) => p.margemDeCosturaMm).filter((m) => m > 0))].sort((a, b) => a - b);
  if (costuras.length > 0) frases.push(`Costura de ${lista(costuras.map((m) => `${m} mm`))}.`);
  const piques = moldes.reduce((s, p) => s + p.piques.length, 0);
  if (piques > 0) frases.push(`${piques} ${piques === 1 ? 'pique' : 'piques'} de montagem.`);
  return frases.join(' ');
}

import type { Ponto2D } from '../core/geometria';
import { contornoDoTamanho, indiceDoTamanho } from './graduacao';
import type { Molde } from './molde';
import { definirTamanhosDoMolde } from './tamanhosGraduados';

/**
 * O tamanho intermediário (ADR 0168): o manual da referência cria um tamanho entre dois da grade. Um novo tamanho entra
 * depois de `depoisDe`, com as regras no meio do caminho entre os dois vizinhos: os pontos, os piques graduados e os
 * piques internos alinhados.
 */
const meio = (a: Ponto2D, b: Ponto2D): Ponto2D => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

export function comTamanhoIntermediario(molde: Molde, nome: string, depoisDe: string): Molde {
  const g = molde.graduacao;
  const limpo = nome.trim();
  if (!g) throw new Error('A peça não tem tamanhos: gradue-a antes.');
  if (limpo === '') throw new Error('Dê um nome ao tamanho novo.');
  if (indiceDoTamanho(g.tamanhos, limpo) >= 0) throw new Error(`Já há o tamanho “${limpo}”.`);
  const i = indiceDoTamanho(g.tamanhos, depoisDe);
  if (i < 0 || i >= g.tamanhos.length - 1) throw new Error(`Não há tamanho depois de “${depoisDe}”: o intermediário fica entre dois tamanhos.`);
  const tamanhos = [...g.tamanhos.slice(0, i + 1), limpo, ...g.tamanhos.slice(i + 1)];
  const novo = definirTamanhosDoMolde(molde, tamanhos, g.tamanhos[g.base]!);
  const k = i + 1;
  const comOMeio = (lista: readonly Ponto2D[]): Ponto2D[] => lista.map((d, t) => (t === k ? meio(lista[k - 1]!, lista[k + 1]!) : d));
  return {
    ...novo,
    graduacao: { ...novo.graduacao!, pontos: novo.graduacao!.pontos.map((p) => ({ ...p, deslocamentos: comOMeio(p.deslocamentos) })) },
    piques: novo.piques.map((q) => {
      const p = q.graduacao?.perimetros;
      if (!p || p.length !== tamanhos.length) return q;
      return { ...q, graduacao: { ...q.graduacao!, perimetros: p.map((v, t) => (t === k ? (p[k - 1]! + p[k + 1]!) / 2 : v)) } };
    }),
    marcas: novo.marcas.map((m) => {
      const d = m.alinhamento?.deslocamentos;
      return d && d.length === tamanhos.length ? { ...m, alinhamento: { deslocamentos: comOMeio(d) } } : m;
    }),
  };
}

/** "Manter diferença" (ADR 0190): o tamanho novo entra depois do último, com a distância média da regra da grade. */
export function comTamanhoManterDiferenca(molde: Molde, nome: string): Molde {
  const g = molde.graduacao;
  const limpo = nome.trim();
  if (!g || g.tamanhos.length < 2) throw new Error('A peça precisa de ao menos dois tamanhos.');
  if (limpo === '') throw new Error('Dê um nome ao tamanho novo.');
  if (indiceDoTamanho(g.tamanhos, limpo) >= 0) throw new Error(`Já há o tamanho “${limpo}”.`);
  const tamanhos = [...g.tamanhos, limpo];
  const novo = definirTamanhosDoMolde(molde, tamanhos, g.tamanhos[g.base]!);
  const k = tamanhos.length - 1;
  const comADiferenca = (lista: readonly Ponto2D[]): Ponto2D[] => {
    const [primeiro, ultimo] = [lista[0]!, lista[k - 1]!];
    const v = { x: ultimo.x + (ultimo.x - primeiro.x) / (k - 1), y: ultimo.y + (ultimo.y - primeiro.y) / (k - 1) };
    return lista.map((d, t) => (t === k ? v : d));
  };
  return {
    ...novo,
    graduacao: { ...novo.graduacao!, pontos: novo.graduacao!.pontos.map((p) => ({ ...p, deslocamentos: comADiferenca(p.deslocamentos) })) },
    piques: novo.piques.map((q) => {
      const p = q.graduacao?.perimetros;
      if (!p || p.length !== tamanhos.length) return q;
      return { ...q, graduacao: { ...q.graduacao!, perimetros: p.map((v, t) => (t === k ? p[k - 1]! + (p[k - 1]! - p[0]!) / (k - 1) : v)) } };
    }),
    marcas: novo.marcas.map((m) => {
      const d = m.alinhamento?.deslocamentos;
      return d && d.length === tamanhos.length ? { ...m, alinhamento: { deslocamentos: comADiferenca(d) } } : m;
    }),
  };
}

/** O contorno da peça no tamanho de nome `nome`. */
export function contornoNoTamanho(molde: Molde, nome: string): Ponto2D[] {
  return contornoDoTamanho(molde.graduacao!, molde.contorno, indiceDoTamanho(molde.graduacao!.tamanhos, nome));
}

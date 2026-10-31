import type { Ponto2D } from '../core/geometria';
import type { PontoDeMedida } from './fichaTecnica';
import { indiceDoTamanho } from './graduacao';
import type { Molde } from './molde';
import { definirTamanhosDoMolde } from './tamanhosGraduados';

/**
 * O tamanho sob medida (ADR 0179): as medidas que a peça pronta deve ter dizem onde ela cai na grade (por exemplo, 1,4:
 * entre o segundo e o terceiro tamanho), e a peça ganha um tamanho nessa posição, com as regras tiradas dos vizinhos. A
 * posição é uma só, a média das medidas informadas: a peça cresce por inteiro, não medida por medida.
 */

/** Até onde se vai além da grade (em passos de tamanho): mais que isso, a regra da grade não vale. */
export const ALEM_DA_GRADE = 1;

/** A posição do valor na grade (0 é o primeiro tamanho), com passos que podem ser desiguais; além das pontas, continua o último passo. */
export function posicaoNaGrade(valores: readonly number[], alvo: number): number {
  if (valores.length < 2) throw new Error('A medida precisa de ao menos dois tamanhos.');
  let i = valores.findIndex((_, k) => k < valores.length - 1 && alvo <= valores[k + 1]!);
  if (i < 0) i = valores.length - 2;
  const passo = valores[i + 1]! - valores[i]!;
  if (passo === 0) throw new Error('A medida é igual em dois tamanhos vizinhos: ela não diz o tamanho.');
  return i + (alvo - valores[i]!) / passo;
}

export interface PosicaoDaPessoa {
  readonly posicao: number;
  readonly porMedida: ReadonlyArray<{ readonly nome: string; readonly posicao: number }>;
}

/** A média das posições das medidas informadas (cm, pelo id do ponto de medida). As medidas sem valor em todos os tamanhos ficam de fora. */
export function posicaoDasMedidas(medidas: readonly PontoDeMedida[], tamanhos: readonly string[], informadas: Readonly<Record<string, number>>): PosicaoDaPessoa {
  const porMedida = medidas.flatMap((m) => {
    const alvo = informadas[m.id];
    const valores = tamanhos.map((t) => m.valoresCm[t]);
    if (alvo === undefined || !valores.every((v): v is number => v !== undefined)) return [];
    return [{ nome: m.nome, posicao: posicaoNaGrade(valores, alvo) }];
  });
  if (porMedida.length === 0) throw new Error('Informe ao menos uma medida que tenha valor em todos os tamanhos.');
  return { posicao: porMedida.reduce((s, m) => s + m.posicao, 0) / porMedida.length, porMedida };
}

export function comTamanhoSobMedida(molde: Molde, nome: string, posicao: number): Molde {
  const g = molde.graduacao;
  const limpo = nome.trim();
  if (!g) throw new Error('A peça não tem tamanhos: gradue-a antes.');
  if (limpo === '') throw new Error('Dê um nome ao tamanho sob medida.');
  if (indiceDoTamanho(g.tamanhos, limpo) >= 0) throw new Error(`Já há o tamanho “${limpo}”.`);
  const ultimo = g.tamanhos.length - 1;
  if (ultimo < 1) throw new Error('A peça precisa de ao menos dois tamanhos.');
  if (posicao < -ALEM_DA_GRADE || posicao > ultimo + ALEM_DA_GRADE) throw new Error('As medidas ficam longe demais da grade: a regra dela não vale ali.');
  const de = Math.min(ultimo - 1, Math.max(0, Math.floor(posicao)));
  const fracao = posicao - de;
  const lugar = posicao < 0 ? 0 : posicao > ultimo ? ultimo + 1 : de + 1;
  const tamanhos = [...g.tamanhos.slice(0, lugar), limpo, ...g.tamanhos.slice(lugar)];
  const novo = definirTamanhosDoMolde(molde, tamanhos, g.tamanhos[g.base]!);
  const k = lugar;
  // Os vizinhos na lista antiga: depois de inserido, os que vinham de `lugar` em diante andaram uma casa.
  const antigo = (i: number): number => (i >= lugar ? i + 1 : i);
  const naPosicao = (lista: readonly Ponto2D[]): Ponto2D[] => {
    const a = lista[antigo(de)]!;
    const b = lista[antigo(de + 1)]!;
    const v = { x: a.x + (b.x - a.x) * fracao, y: a.y + (b.y - a.y) * fracao };
    return lista.map((d, t) => (t === k ? v : d));
  };
  return {
    ...novo,
    graduacao: { ...novo.graduacao!, pontos: novo.graduacao!.pontos.map((p) => ({ ...p, deslocamentos: naPosicao(p.deslocamentos) })) },
    marcas: novo.marcas.map((m) => {
      const d = m.alinhamento?.deslocamentos;
      return d && d.length === tamanhos.length ? { ...m, alinhamento: { deslocamentos: naPosicao(d) } } : m;
    }),
  };
}

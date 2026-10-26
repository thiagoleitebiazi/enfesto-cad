import { fichaEditavel, lerFichaTecnica, mudarFicha } from './fichaTecnica';
import type { Material } from './materiais';
import { definirFichaTecnica, type Projeto } from './projeto';

/**
 * Trocar um material em todos os modelos de uma vez (ADR 0137): o mix da coleção muda junto — o tecido que saiu de
 * linha, o botão de outro fornecedor. Cada item da ficha com o material de agora passa a ser o novo, com o mesmo
 * consumo e a mesma aplicação. A ficha aprovada (ou em aprovação) não muda: ela só muda abrindo nova versão.
 */

export interface TrocaNosModelos {
  /** Os projetos que mudaram (só eles: para gravar). */
  readonly mudados: readonly Projeto[];
  /** Os modelos trocados e quantos itens de cada um. */
  readonly trocados: ReadonlyArray<{ readonly nome: string; readonly codigo: string; readonly itens: number }>;
  /** Os modelos com o material de agora e a ficha fechada para mudança (aprovada, em aprovação). */
  readonly fechados: ReadonlyArray<{ readonly nome: string; readonly codigo: string }>;
}

export function trocarMaterialNosModelos(projetos: readonly Projeto[], de: Material, para: Material, agoraIso: string): TrocaNosModelos {
  if (de.id === para.id) throw new Error('Escolha outro material para entrar no lugar.');
  if (de.unidade !== para.unidade) throw new Error(`Os dois materiais precisam ter a mesma unidade (${de.unidade} e ${para.unidade}): o consumo de cada ficha é nessa unidade.`);
  const mudados: Projeto[] = [];
  const trocados: { nome: string; codigo: string; itens: number }[] = [];
  const fechados: { nome: string; codigo: string }[] = [];
  for (const projeto of projetos) {
    const ficha = lerFichaTecnica(projeto.fichaTecnica);
    if (!ficha) continue;
    const itens = ficha.materiais.filter((i) => i.materialId === de.id).length;
    if (itens === 0) continue;
    if (!fichaEditavel(ficha)) {
      fechados.push({ nome: projeto.nome, codigo: projeto.codigo });
      continue;
    }
    const nova = mudarFicha(
      ficha,
      { materiais: ficha.materiais.map((i) => (i.materialId === de.id ? { ...i, materialId: para.id, descricao: para.descricao, unidade: para.unidade } : i)) },
      agoraIso,
    );
    mudados.push(definirFichaTecnica(projeto, nova, agoraIso));
    trocados.push({ nome: projeto.nome, codigo: projeto.codigo, itens });
  }
  return { mudados, trocados, fechados };
}

/** O que dizer da troca. */
export function recadoDaTroca(t: TrocaNosModelos, de: Material, para: Material): string {
  const partes: string[] = [];
  partes.push(
    t.trocados.length === 0
      ? `Nenhum modelo com a ficha aberta usa “${de.descricao}”.`
      : `“${de.descricao}” trocado por “${para.descricao}” em ${t.trocados.length} modelo(s): ${t.trocados.map((m) => `${m.nome} (${m.codigo})`).join(', ')}.`,
  );
  if (t.fechados.length > 0) {
    partes.push(`Com a ficha aprovada ou em aprovação, ficaram como estavam: ${t.fechados.map((m) => `${m.nome} (${m.codigo})`).join(', ')} — abra uma nova versão da ficha para trocar.`);
  }
  return partes.join(' ');
}

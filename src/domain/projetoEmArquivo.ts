import { lerProjeto, type Projeto } from './projeto';

/**
 * O projeto num arquivo (ADR 0156): para levar um modelo a outro computador, mandar a outra pessoa ou guardar uma cópia
 * fora do programa. O arquivo traz o projeto inteiro (as peças, o encaixe, a ficha, o histórico, as imagens).
 */

export const EXTENSAO_DO_PROJETO = 'enfesto';

export const textoDoProjeto = (projeto: Projeto): string => JSON.stringify(projeto);

export function nomeDoArquivoDoProjeto(projeto: Projeto): string {
  const nome = projeto.nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${nome || 'projeto'}.${EXTENSAO_DO_PROJETO}`;
}

/**
 * O projeto lido do arquivo. Se a biblioteca já tem um de mesmo id, ele entra como outro projeto (id e código novos, o
 * nome com "(importado)"): importar nunca troca o que está na biblioteca.
 */
export function projetoDoArquivo(
  texto: string,
  existentes: readonly Projeto[],
  novo: { readonly id: () => string; readonly codigo: () => string },
): { readonly projeto: Projeto } | { readonly erro: string } {
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto);
  } catch {
    return { erro: 'O arquivo não é um projeto do Enfesto CAD (não dá para ler).' };
  }
  const lido = lerProjeto(bruto);
  if (!lido.ok) return { erro: lido.erro };
  if (lido.maisNovo) return { erro: 'O projeto foi gravado por uma versão mais nova do programa: atualize o programa para abri-lo.' };
  if (!existentes.some((p) => p.id === lido.projeto.id)) return { projeto: lido.projeto };
  return { projeto: { ...lido.projeto, id: novo.id(), codigo: novo.codigo(), nome: `${lido.projeto.nome} (importado)` } };
}

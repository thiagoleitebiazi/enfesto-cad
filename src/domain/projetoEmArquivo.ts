import { lerProjeto, type Projeto } from './projeto';

/**
 * O projeto num arquivo (ADR 0156): para levar um modelo a outro computador, mandar a outra pessoa ou guardar uma cópia
 * fora do programa. O arquivo traz o projeto inteiro (as peças, o encaixe, a ficha, o histórico, as imagens).
 */

export const EXTENSAO_DO_PROJETO = 'enfesto';

/**
 * A senha do arquivo (ADR 0169): o manual da referência protege o modelo com senha. O projeto vai cifrado (AES-GCM, com
 * a chave tirada da senha por PBKDF2). Quem perde a senha perde o arquivo: não há como recuperar.
 */
const FORMATO_CIFRADO = 'enfesto-cifrado';
const VOLTAS_DA_CHAVE = 200_000;

const emBase64 = (b: Uint8Array): string => btoa(Array.from(b, (c) => String.fromCharCode(c)).join(''));
const deBase64 = (t: string): Uint8Array<ArrayBuffer> => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));

async function chaveDaSenha(senha: string, sal: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: sal, iterations: VOLTAS_DA_CHAVE, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function cifrarProjeto(texto: string, senha: string): Promise<string> {
  const sal = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const dados = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await chaveDaSenha(senha, sal), new TextEncoder().encode(texto));
  return JSON.stringify({ formato: FORMATO_CIFRADO, sal: emBase64(sal), iv: emBase64(iv), dados: emBase64(new Uint8Array(dados)) });
}

export function ehProjetoCifrado(texto: string): boolean {
  try {
    return (JSON.parse(texto) as { formato?: unknown }).formato === FORMATO_CIFRADO;
  } catch {
    return false;
  }
}

/** O texto do projeto; lança se a senha não for a certa (ou se o arquivo foi mexido). */
export async function decifrarProjeto(texto: string, senha: string): Promise<string> {
  const c = JSON.parse(texto) as { sal: string; iv: string; dados: string };
  try {
    const claro = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: deBase64(c.iv) }, await chaveDaSenha(senha, deBase64(c.sal)), deBase64(c.dados));
    return new TextDecoder().decode(claro);
  } catch {
    throw new Error('A senha não é esta (ou o arquivo foi alterado).');
  }
}

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

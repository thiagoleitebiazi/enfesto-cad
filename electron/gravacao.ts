import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { copiaJaFeita, motivoDaCopiaDeSeguranca, nomeDaCopiaDeSeguranca } from '../src/domain/copiaDeSeguranca';

/**
 * Gravação de arquivo que não deixa o arquivo pela metade. O conteúdo vai
 * primeiro para um arquivo temporário ao lado, e só então toma o lugar do
 * antigo: se o programa cai, ou falta luz, no meio da gravação, fica o
 * arquivo anterior inteiro (antes, ficava um JSON cortado, que a biblioteca
 * deixava de listar — o projeto "sumia").
 *
 * No Windows a troca pode falhar por um instante quando outro programa está
 * com o arquivo aberto (o antivírus conferindo, a própria biblioteca lendo):
 * tenta de novo algumas vezes antes de desistir.
 */
export async function gravarSemCorromper(
  destino: string,
  conteudo: string,
  opcoes: { readonly tentativas?: number; readonly esperaMs?: number; readonly trocar?: typeof rename } = {},
): Promise<void> {
  const tentativas = opcoes.tentativas ?? 6;
  const esperaMs = opcoes.esperaMs ?? 80;
  const trocar = opcoes.trocar ?? rename;
  const temporario = `${destino}.${process.pid}.${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.tmp`;
  try {
    await writeFile(temporario, conteudo, 'utf-8');
    for (let i = 1; ; i++) {
      try {
        await trocar(temporario, destino);
        return;
      } catch (e) {
        const codigo = (e as NodeJS.ErrnoException).code;
        const passageiro = codigo === 'EPERM' || codigo === 'EACCES' || codigo === 'EBUSY';
        if (!passageiro || i >= tentativas) throw e;
        await new Promise((r) => setTimeout(r, esperaMs * i));
      }
    }
  } finally {
    // Se a troca deu certo, o temporário já não existe; se não deu, não fica lixo na pasta.
    await rm(temporario, { force: true });
  }
}

/**
 * Uma gravação de cada vez por chave (o id do projeto): o salvamento
 * automático e o Ctrl+S podem chegar juntos, e o que foi pedido por último
 * tem de ser o que fica no disco.
 */
export function criarFilaDeGravacao(): <T>(chave: string, tarefa: () => Promise<T>) => Promise<T> {
  const ultimas = new Map<string, Promise<unknown>>();
  return <T>(chave: string, tarefa: () => Promise<T>): Promise<T> => {
    const anterior = ultimas.get(chave) ?? Promise.resolve();
    const esta = anterior.catch(() => undefined).then(tarefa);
    ultimas.set(chave, esta);
    const limpar = (): void => {
      if (ultimas.get(chave) === esta) ultimas.delete(chave);
    };
    esta.then(limpar, limpar);
    return esta;
  };
}

/** O id de um projeto vira nome de arquivo: só letras, números, hífen e sublinhado (nada de "..\"). */
export function idDeProjetoValido(id: unknown): id is string {
  return typeof id === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(id);
}

/**
 * Grava o projeto, fazendo antes a cópia de segurança do arquivo que estava no disco quando ele é de uma versão
 * mais antiga do formato, ou ilegível (ver `copiaDeSeguranca.ts`). A cópia vai para `pastaDasCopias` e nunca é
 * apagada. Devolve o caminho da cópia feita, ou `null`. Se a cópia falha, nada é gravado (o erro sobe).
 */
export async function gravarProjetoComCopia(
  destino: string,
  conteudo: string,
  dados: { readonly idDoProjeto: string; readonly versaoNova: number; readonly pastaDasCopias: string; readonly agoraIso: string },
): Promise<string | null> {
  let noDisco: string | null = null;
  try {
    noDisco = await readFile(destino, 'utf-8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  const motivo = motivoDaCopiaDeSeguranca(noDisco, dados.versaoNova);
  let copia: string | null = null;
  if (motivo !== null && noDisco !== null) {
    await mkdir(dados.pastaDasCopias, { recursive: true });
    if (!copiaJaFeita(dados.idDoProjeto, motivo, await readdir(dados.pastaDasCopias))) {
      copia = path.join(dados.pastaDasCopias, nomeDaCopiaDeSeguranca(dados.idDoProjeto, motivo, dados.agoraIso));
      await gravarSemCorromper(copia, noDisco);
    }
  }
  await gravarSemCorromper(destino, conteudo);
  return copia;
}

/**
 * Grava guardando a versão anterior ao lado (`<destino>.anterior`), além das cópias de segurança de versão antiga
 * ou de arquivo ilegível (`gravarProjetoComCopia`). Se a gravação for interrompida, o arquivo continua o de antes
 * (a troca é atômica); se o arquivo se perder ou quebrar depois, `lerComRecuperacao` volta para a versão anterior.
 */
export async function gravarComAnterior(
  destino: string,
  conteudo: string,
  dados: { readonly idDoArquivo: string; readonly versaoNova: number; readonly pastaDasCopias: string; readonly agoraIso: string },
): Promise<void> {
  try {
    const atual = await readFile(destino, 'utf-8');
    JSON.parse(atual);
    await gravarSemCorromper(`${destino}.anterior`, atual);
  } catch {
    // Sem arquivo ainda, ou ilegível (este vai para as cópias de segurança abaixo, e a versão anterior boa fica).
  }
  await gravarProjetoComCopia(destino, conteudo, { idDoProjeto: dados.idDoArquivo, versaoNova: dados.versaoNova, pastaDasCopias: dados.pastaDasCopias, agoraIso: dados.agoraIso });
}

export type ArquivoLido =
  | { readonly situacao: 'ausente' }
  | { readonly situacao: 'lido'; readonly conteudo: unknown }
  | { readonly situacao: 'recuperado'; readonly conteudo: unknown; readonly motivo: 'ausente' | 'ilegivel' }
  | { readonly situacao: 'ilegivel' };

/** Lê o arquivo; se ele sumiu ou quebrou e há a versão anterior boa, devolve ela (dizendo que foi recuperada). */
export async function lerComRecuperacao(destino: string): Promise<ArquivoLido> {
  let motivo: 'ausente' | 'ilegivel';
  try {
    return { situacao: 'lido', conteudo: JSON.parse(await readFile(destino, 'utf-8')) as unknown };
  } catch (e) {
    motivo = (e as NodeJS.ErrnoException).code === 'ENOENT' ? 'ausente' : 'ilegivel';
  }
  try {
    return { situacao: 'recuperado', conteudo: JSON.parse(await readFile(`${destino}.anterior`, 'utf-8')) as unknown, motivo };
  } catch {
    return motivo === 'ausente' ? { situacao: 'ausente' } : { situacao: 'ilegivel' };
  }
}

/** Uma cópia do conteúdo, uma vez por conteúdo (o nome leva uma marca dele), na pasta das cópias. */
export async function copiaUnica(pasta: string, prefixo: string, conteudo: string): Promise<string> {
  let h = 0x811c9dc5;
  for (let i = 0; i < conteudo.length; i++) {
    h ^= conteudo.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const destino = path.join(pasta, `${prefixo}.${h.toString(16).padStart(8, '0')}.json`);
  await mkdir(pasta, { recursive: true });
  try {
    await readFile(destino);
  } catch {
    await gravarSemCorromper(destino, conteudo);
  }
  return destino;
}

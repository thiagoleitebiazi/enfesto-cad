import { rename, rm, writeFile } from 'node:fs/promises';

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

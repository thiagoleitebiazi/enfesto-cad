import type { PiqueCadastrado } from './ferramentasDeMarcacao';

/**
 * O cadastro de piques no Ctrl+Z.
 *
 * O cadastro fica neste computador, fora do projeto, e o histórico do
 * desfazer é o das peças. Para o Ctrl+Z valer também para ele, cada mudança
 * do cadastro entra no histórico como um passo — com as peças novas, se
 * também mudaram, ou com as mesmas — e fica guardado aqui como o cadastro
 * estava antes desse passo e como ficou. Ao desfazer ou refazer o passo, o
 * cadastro volta ou avança — mas só se ainda está como o passo o deixou: o
 * que foi mudado por outro caminho depois (noutra janela do programa, por
 * exemplo) fica como está.
 *
 * O "passo" é a lista de peças que ele deixou no projeto: é ela que o
 * histórico guarda e devolve.
 */
interface MudancaDoCadastro {
  readonly antes: readonly PiqueCadastrado[];
  readonly depois: readonly PiqueCadastrado[];
}

const MUDANCAS = new WeakMap<object, MudancaDoCadastro>();

/** Guarda que o passo dado mudou o cadastro de `antes` para `depois`. */
export function registrarMudancaDoCadastro(passo: object, antes: readonly PiqueCadastrado[], depois: readonly PiqueCadastrado[]): void {
  MUDANCAS.set(passo, { antes, depois });
}

function mesmoCadastro(a: readonly PiqueCadastrado[], b: readonly PiqueCadastrado[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * O cadastro a pôr de volta ao desfazer o passo (o que o projeto tem agora),
 * ou `null` se o passo não mexeu no cadastro, ou se o cadastro não está mais
 * como o passo o deixou.
 */
export function cadastroAoDesfazer(atual: readonly PiqueCadastrado[], passo: object): readonly PiqueCadastrado[] | null {
  const mudanca = MUDANCAS.get(passo);
  return mudanca && mesmoCadastro(atual, mudanca.depois) ? mudanca.antes : null;
}

/**
 * O cadastro a pôr ao refazer o passo (o que o projeto vai voltar a ter), ou
 * `null` se o passo não mexeu no cadastro, ou se o cadastro não está mais
 * como estava antes dele.
 */
export function cadastroAoRefazer(atual: readonly PiqueCadastrado[], passo: object): readonly PiqueCadastrado[] | null {
  const mudanca = MUDANCAS.get(passo);
  return mudanca && mesmoCadastro(atual, mudanca.antes) ? mudanca.depois : null;
}

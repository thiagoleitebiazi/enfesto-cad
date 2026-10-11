import { describe, it, expect } from 'vitest';
import { ponto } from '../core/geometria';
import type { PiqueCadastrado } from './ferramentasDeMarcacao';
import { cadastroAoDesfazer, cadastroAoRefazer, registrarMudancaDoCadastro } from './historicoDoCadastro';

const SETA: PiqueCadastrado = { id: 'c1', nome: 'Seta', descricao: '', forma: [[ponto(-0.5, 0), ponto(0, 1), ponto(0.5, 0)]] };
const BARRA: PiqueCadastrado = { id: 'c2', nome: 'Barra', descricao: '', forma: [[ponto(-0.5, 0), ponto(0.5, 0)]] };
const ANTES = [SETA];
const DEPOIS = [SETA, BARRA];
/** Um passo do histórico (a lista de peças que ele deixou) que pôs a Barra no cadastro. */
const passoQuePosABarra = (): object => {
  const passo: object = [];
  registrarMudancaDoCadastro(passo, ANTES, DEPOIS);
  return passo;
};

describe('o cadastro de piques no Ctrl+Z', () => {
  it('desfazer o passo devolve o cadastro de antes; refazer, o de depois', () => {
    const passo = passoQuePosABarra();

    expect(cadastroAoDesfazer(DEPOIS, passo)).toBe(ANTES);
    expect(cadastroAoRefazer(ANTES, passo)).toBe(DEPOIS);
  });

  it('o passo que não mexeu no cadastro não tem o que devolver', () => {
    passoQuePosABarra();
    const outroPasso: object = [];

    expect(cadastroAoDesfazer(DEPOIS, outroPasso)).toBeNull();
    expect(cadastroAoRefazer(ANTES, outroPasso)).toBeNull();
  });

  it('vale o conteúdo, não o objeto: o cadastro relido do computador é o mesmo', () => {
    const passo = passoQuePosABarra();
    const relido = (cadastro: readonly PiqueCadastrado[]) => JSON.parse(JSON.stringify(cadastro)) as PiqueCadastrado[];

    expect(cadastroAoDesfazer(relido(DEPOIS), passo)).toBe(ANTES);
    expect(cadastroAoRefazer(relido(ANTES), passo)).toBe(DEPOIS);
  });

  it('o cadastro mudado por outro caminho depois do passo fica como está', () => {
    const passo = passoQuePosABarra();

    expect(cadastroAoDesfazer([SETA, { ...BARRA, nome: 'Barra larga' }], passo)).toBeNull();
    expect(cadastroAoDesfazer(ANTES, passo)).toBeNull();
    expect(cadastroAoRefazer(DEPOIS, passo)).toBeNull();
    expect(cadastroAoRefazer([], passo)).toBeNull();
  });
});

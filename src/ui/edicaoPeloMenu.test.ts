import { describe, expect, it } from 'vitest';
import { ACOES_DE_EDICAO, COMANDO_NO_TEXTO, destinoDaAcaoDoMenu, ehAcaoDeEdicao } from './edicaoPeloMenu';

describe('o menu Editar do Mac', () => {
  it('cada ação tem o comando de texto dela', () => {
    expect(ACOES_DE_EDICAO.map((a) => COMANDO_NO_TEXTO[a])).toEqual(['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll']);
  });

  it('só as ações conhecidas passam (o que vem pelo canal entre os processos é conferido)', () => {
    expect(ehAcaoDeEdicao('copiar')).toBe(true);
    expect(ehAcaoDeEdicao('selecionar-tudo')).toBe(true);
    expect(ehAcaoDeEdicao('apagar-tudo')).toBe(false);
    expect(ehAcaoDeEdicao(3)).toBe(false);
    expect(ehAcaoDeEdicao(undefined)).toBe(false);
  });

  it('no campo de texto, é do texto; fora dele, do programa; com uma janela aberta e sem campo, de ninguém', () => {
    expect(destinoDaAcaoDoMenu(true, false)).toBe('texto');
    expect(destinoDaAcaoDoMenu(true, true)).toBe('texto');
    expect(destinoDaAcaoDoMenu(false, false)).toBe('programa');
    expect(destinoDaAcaoDoMenu(false, true)).toBe('nenhum');
  });
});

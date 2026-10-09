import { describe, expect, it } from 'vitest';
import {
  ATRIBUTO_GRUPO_COMPACTO,
  ATRIBUTO_ROTULOS_EM_DUAS_LINHAS,
  ajustarCompactacao,
} from './compactacaoDaFita';

function montarFita(quantidadeDeGrupos: number): { conteudo: HTMLElement; grupos: HTMLElement[] } {
  const conteudo = document.createElement('div');
  const grupos = Array.from({ length: quantidadeDeGrupos }, () => conteudo.appendChild(document.createElement('div')));
  return { conteudo, grupos };
}

const compactos = (grupos: readonly HTMLElement[]): boolean[] => grupos.map((g) => g.hasAttribute(ATRIBUTO_GRUPO_COMPACTO));

describe('ajustarCompactacao', () => {
  it('fica no nível 0, sem marcar nada, quando a fita já cabe', () => {
    const { conteudo, grupos } = montarFita(4);
    expect(ajustarCompactacao(conteudo, grupos, () => true)).toBe(0);
    expect(conteudo.hasAttribute(ATRIBUTO_ROTULOS_EM_DUAS_LINHAS)).toBe(false);
    expect(compactos(grupos)).toEqual([false, false, false, false]);
  });

  it('primeiro só quebra os rótulos grandes em duas linhas', () => {
    const { conteudo, grupos } = montarFita(4);
    const nivel = ajustarCompactacao(conteudo, grupos, () => conteudo.hasAttribute(ATRIBUTO_ROTULOS_EM_DUAS_LINHAS));
    expect(nivel).toBe(1);
    expect(compactos(grupos)).toEqual([false, false, false, false]);
  });

  it('depois compacta os grupos da direita para a esquerda, só até caber', () => {
    const { conteudo, grupos } = montarFita(4);
    const nivel = ajustarCompactacao(conteudo, grupos, () => compactos(grupos).filter(Boolean).length >= 2);
    expect(nivel).toBe(3);
    expect(conteudo.hasAttribute(ATRIBUTO_ROTULOS_EM_DUAS_LINHAS)).toBe(true);
    expect(compactos(grupos)).toEqual([false, false, true, true]);
  });

  it('sem nenhum nível que caiba, fica no mais compacto (a fita rola)', () => {
    const { conteudo, grupos } = montarFita(3);
    expect(ajustarCompactacao(conteudo, grupos, () => false)).toBe(4);
    expect(conteudo.hasAttribute(ATRIBUTO_ROTULOS_EM_DUAS_LINHAS)).toBe(true);
    expect(compactos(grupos)).toEqual([true, true, true]);
  });

  it('com a janela larga de novo, desfaz a compactação', () => {
    const { conteudo, grupos } = montarFita(3);
    ajustarCompactacao(conteudo, grupos, () => false);
    expect(ajustarCompactacao(conteudo, grupos, () => true)).toBe(0);
    expect(conteudo.hasAttribute(ATRIBUTO_ROTULOS_EM_DUAS_LINHAS)).toBe(false);
    expect(compactos(grupos)).toEqual([false, false, false]);
  });
});

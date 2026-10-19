import { describe, expect, it } from 'vitest';
import { cadastrarMalha, gravarMalhas, lerMalhas, MAXIMO_DE_MALHAS, removerMalha, type MalhaCadastrada } from './malhasCadastradas';

function armazenamento(inicial: Record<string, string> = {}) {
  const dados = new Map(Object.entries(inicial));
  return {
    getItem: (k: string) => dados.get(k) ?? null,
    setItem: (k: string, v: string) => {
      dados.set(k, v);
    },
    dados,
  };
}

const ALGODAO: MalhaCadastrada = { id: 'm1', descricao: 'Malha algodão 30/1', gramaturaGm2: 310, rendimentoMmPorG: 4, larguraUtilMm: 1600, tubular: false, sentidoUnico: false };

describe('o cadastro de malhas', () => {
  it('grava e lê de volta', () => {
    const a = armazenamento();
    expect(gravarMalhas(a, [ALGODAO])).toBe(true);
    expect(lerMalhas(a)).toEqual([ALGODAO]);
  });

  it('o que não dá para ler fica de fora, sem impedir o resto', () => {
    expect(lerMalhas(armazenamento({ 'enfesto-cad:malhas': 'isto não é json' }))).toEqual([]);
    const mistura = JSON.stringify([ALGODAO, { id: 'x', descricao: 'sem largura', tubular: false, sentidoUnico: false }, { ...ALGODAO, id: 'm2', gramaturaGm2: -3 }]);
    expect(lerMalhas(armazenamento({ 'enfesto-cad:malhas': mistura }))).toEqual([ALGODAO]);
  });

  it('sem gravar (armazenamento bloqueado), devolve false', () => {
    expect(gravarMalhas({ setItem: () => { throw new Error('cheio'); } }, [ALGODAO])).toBe(false);
  });

  it('cadastrar não troca uma malha existente: a mesma descrição é recusada', () => {
    const lista = cadastrarMalha([], ALGODAO);
    expect(() => cadastrarMalha(lista, { ...ALGODAO, id: 'm2', descricao: ' malha ALGODÃO 30/1 ' })).toThrow(/Já há uma malha/);
    expect(cadastrarMalha(lista, { ...ALGODAO, id: 'm2', descricao: 'Moletom' })).toHaveLength(2);
  });

  it('descrição vazia, largura zero e o limite do cadastro são recusados', () => {
    expect(() => cadastrarMalha([], { ...ALGODAO, descricao: '  ' })).toThrow(/Dê uma descrição/);
    expect(() => cadastrarMalha([], { ...ALGODAO, larguraUtilMm: 0 })).toThrow(/largura útil/);
    const cheia = Array.from({ length: MAXIMO_DE_MALHAS }, (_, i) => ({ ...ALGODAO, id: `m${i}`, descricao: `M${i}` }));
    expect(() => cadastrarMalha(cheia, { ...ALGODAO, id: 'n', descricao: 'Nova' })).toThrow(/até 100 malhas/);
  });

  it('remover tira só a escolhida', () => {
    const lista = cadastrarMalha(cadastrarMalha([], ALGODAO), { ...ALGODAO, id: 'm2', descricao: 'Moletom' });
    expect(removerMalha(lista, 'm1').map((m) => m.id)).toEqual(['m2']);
  });
});

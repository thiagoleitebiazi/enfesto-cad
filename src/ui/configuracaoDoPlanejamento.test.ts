import { describe, expect, it } from 'vitest';
import { CONFIGURACAO_PADRAO_DO_PLANEJAMENTO } from '../domain/planoDeEnfesto';
import { gravarConfiguracaoDoPlanejamento, lerConfiguracaoDoPlanejamento } from './configuracaoDoPlanejamento';

function armazenamento(inicial: Record<string, string> = {}) {
  const dados = new Map(Object.entries(inicial));
  return { getItem: (k: string) => dados.get(k) ?? null, setItem: (k: string, v: string) => void dados.set(k, v) };
}

describe('configuração do planejamento neste computador', () => {
  it('sem nada guardado, a padrão', () => {
    expect(lerConfiguracaoDoPlanejamento(armazenamento())).toEqual(CONFIGURACAO_PADRAO_DO_PLANEJAMENTO);
  });

  it('a guardada volta; a inválida não é guardada', () => {
    const a = armazenamento();
    const nova = { ...CONFIGURACAO_PADRAO_DO_PLANEJAMENTO, folhasPorEnfestoMax: 60, larguraDaMesaMm: 1800 };
    expect(gravarConfiguracaoDoPlanejamento(a, nova)).toBe(true);
    expect(lerConfiguracaoDoPlanejamento(a)).toEqual(nova);
    expect(gravarConfiguracaoDoPlanejamento(a, { ...nova, folhasPorEnfestoMax: 0 })).toBe(false);
    expect(lerConfiguracaoDoPlanejamento(a)).toEqual(nova);
  });

  it('a da primeira versão do planejamento continua valendo nos campos que ela tinha', () => {
    const antiga = armazenamento({
      'enfesto-cad:configuracao-do-plano-de-corte': JSON.stringify({ margemInicialDaMesaMm: 50, margemFinalDaMesaMm: 70, sobraPorCamadaMm: 15, folhasPorEnfestoMax: 80, toleranciaDeRendimentoPercentual: 3 }),
    });
    expect(lerConfiguracaoDoPlanejamento(antiga)).toEqual({
      ...CONFIGURACAO_PADRAO_DO_PLANEJAMENTO,
      margemInicialDaMesaMm: 50,
      margemFinalDaMesaMm: 70,
      sobraPorCamadaMm: 15,
      folhasPorEnfestoMax: 80,
      toleranciaDeRendimentoPercentual: 3,
    });
  });

  it('o que não dá para ler vale como a padrão', () => {
    expect(lerConfiguracaoDoPlanejamento(armazenamento({ 'enfesto-cad:configuracao-do-planejamento': '{quebrado' }))).toEqual(CONFIGURACAO_PADRAO_DO_PLANEJAMENTO);
  });
});

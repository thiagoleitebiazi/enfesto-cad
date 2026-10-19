import { describe, expect, it } from 'vitest';
import { CONFIGURACAO_PADRAO_DO_PLANO } from '../domain/planoDeCorte';
import { gravarConfiguracaoDoPlano, lerConfiguracaoDoPlano } from './configuracaoDoPlano';

function armazenamento() {
  const dados = new Map<string, string>();
  return { getItem: (k: string) => dados.get(k) ?? null, setItem: (k: string, v: string) => void dados.set(k, v), dados };
}

describe('a configuração do planejamento de corte', () => {
  it('sem nada guardado, a padrão (que diz que é do sistema)', () => {
    expect(lerConfiguracaoDoPlano(armazenamento())).toEqual(CONFIGURACAO_PADRAO_DO_PLANO);
  });

  it('grava e lê de volta', () => {
    const a = armazenamento();
    const minha = { ...CONFIGURACAO_PADRAO_DO_PLANO, folhasPorEnfestoMax: 80, sobraPorCamadaMm: 15 };
    expect(gravarConfiguracaoDoPlano(a, minha)).toBe(true);
    expect(lerConfiguracaoDoPlano(a)).toEqual(minha);
  });

  it('a inválida não é gravada, e a estragada vale como a padrão', () => {
    const a = armazenamento();
    expect(gravarConfiguracaoDoPlano(a, { ...CONFIGURACAO_PADRAO_DO_PLANO, folhasPorEnfestoMax: 0 })).toBe(false);
    a.setItem('enfesto-cad:configuracao-do-plano-de-corte', '{"margemInicialDaMesaMm": -5}');
    expect(lerConfiguracaoDoPlano(a)).toEqual(CONFIGURACAO_PADRAO_DO_PLANO);
    a.setItem('enfesto-cad:configuracao-do-plano-de-corte', 'não é json');
    expect(lerConfiguracaoDoPlano(a)).toEqual(CONFIGURACAO_PADRAO_DO_PLANO);
  });
});

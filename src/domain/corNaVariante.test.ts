import { describe, expect, it } from 'vitest';
import { corNaVariante, DESENHO_VAZIO, type DesenhoTecnico, type VarianteDeCor } from './desenhoTecnico';

const DESENHO: DesenhoTecnico = { ...DESENHO_VAZIO, elementos: [{ tipo: 'traco', preenchimento: '#112233' } as never, { tipo: 'traco', preenchimento: '#445566' } as never] };
const MARINHO: VarianteDeCor = { id: 'v', nome: 'Marinho', trocas: { '#112233': '#000080', '#445566': '#ffffff' } };

describe('a cor da peça na variante (ADR 0152)', () => {
  it('a troca da própria cor, sem diferença de maiúsculas; sem variante ou sem troca, a mesma', () => {
    expect(corNaVariante('#445566', DESENHO, MARINHO)).toBe('#ffffff');
    expect(corNaVariante('#112233', DESENHO, null)).toBe('#112233');
    expect(corNaVariante('#ABCDEF', DESENHO, MARINHO)).toBe('#ABCDEF');
  });

  it('a peça na cor de partida toma a troca da cor principal do desenho', () => {
    expect(corNaVariante('#3F7FB5', DESENHO, MARINHO, '#3f7fb5')).toBe('#000080');
    expect(corNaVariante('#3f7fb5', DESENHO, { ...MARINHO, trocas: {} }, '#3f7fb5')).toBe('#3f7fb5');
    expect(corNaVariante('#3f7fb5', DESENHO_VAZIO, MARINHO, '#3f7fb5')).toBe('#3f7fb5');
  });
});

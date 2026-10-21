import { describe, expect, it } from 'vitest';
import { fatorDoEncolhimento, fatoresDeCompensacao, medidasCompensadas, riscoCompensado } from './encolhimento';
import type { RiscoDoPlanejamento } from './planoDeEnfesto';

describe('compensação de encolhimento', () => {
  it('o fator é 1 / (1 − e): 3% → 1,0309; 0 ou ausente → 1; fora de 0–50% é recusado', () => {
    expect(fatorDoEncolhimento(3)).toBeCloseTo(1.030927835, 9);
    expect(fatorDoEncolhimento(0)).toBe(1);
    expect(fatorDoEncolhimento(undefined)).toBe(1);
    expect(() => fatorDoEncolhimento(50)).toThrow('O encolhimento de 50% não vale');
    expect(() => fatorDoEncolhimento(-2)).toThrow('precisa ficar entre 0 e 50%');
    expect(() => fatorDoEncolhimento(Number.NaN)).toThrow();
  });

  it('a peça de 1000 mm, com 3% no comprimento e 2% na largura, é cortada com 1030,9 × 1020,4 mm — e encolhe de volta a 1000', () => {
    const f = fatoresDeCompensacao({ encolhimentoComprimentoPercentual: 3, encolhimentoLarguraPercentual: 2, encolhimentoCompensadoNoMolde: false });
    if ('erro' in f) throw new Error(f.erro);
    const depois = medidasCompensadas(1000, 1000, f);
    expect(depois.comprimentoMm).toBeCloseTo(1030.93, 2);
    expect(depois.larguraMm).toBeCloseTo(1020.41, 2);
    expect(depois.comprimentoMm * (1 - 0.03)).toBeCloseTo(1000, 9);
    expect(depois.larguraMm * (1 - 0.02)).toBeCloseTo(1000, 9);
  });

  it('só numa direção: a outra fica igual', () => {
    const f = fatoresDeCompensacao({ encolhimentoComprimentoPercentual: 5, encolhimentoCompensadoNoMolde: false });
    if ('erro' in f) throw new Error(f.erro);
    expect(f.largura).toBe(1);
    expect(f.comprimento).toBeCloseTo(1 / 0.95, 12);
  });

  it('nunca duas vezes: com o molde já compensado, recusa; sem encolhimento, não há o que compensar', () => {
    expect(fatoresDeCompensacao({ encolhimentoComprimentoPercentual: 3, encolhimentoCompensadoNoMolde: true })).toEqual({
      erro: 'O encolhimento desta malha já está compensado no molde (cadastro da malha): compensar no risco também o aplicaria duas vezes.',
    });
    expect(fatoresDeCompensacao({ encolhimentoCompensadoNoMolde: false })).toEqual({ erro: 'A malha não tem encolhimento informado: não há o que compensar.' });
    expect(fatoresDeCompensacao({ encolhimentoLarguraPercentual: 60, encolhimentoCompensadoNoMolde: false })).toEqual({ erro: 'O encolhimento de 60% não vale: ele precisa ficar entre 0 e 50%.' });
  });

  it('o risco compensado: as peças, o comprimento, a largura ocupada e a área aumentam pelos fatores; a eficiência é refeita', () => {
    const risco: RiscoDoPlanejamento = {
      chave: 'M:1',
      grade: { M: 1 },
      origem: 'gerado',
      comprimentoMm: 1000,
      larguraMm: 400,
      larguraDoRiscoMm: 1568,
      areaDasPecasMm2: 400_000,
      eficienciaPercentual: 25.5,
      pecas: [{ pecaId: 'a', nome: 'A', tamanho: 'M', contorno: [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 1000 }, { x: 0, y: 1000 }], fio: { inicio: { x: 200, y: 10 }, fim: { x: 200, y: 990 } }, anguloGraus: 0, espelhada: false }],
    };
    const f = { comprimento: 1.25, largura: 1.02, encolhimentoComprimentoPercentual: 20, encolhimentoLarguraPercentual: 1.96 };
    const r = riscoCompensado(risco, f, 1600);
    expect([r.comprimentoMm, r.larguraMm, r.larguraDoRiscoMm, r.areaDasPecasMm2]).toEqual([1250, 408, 1600, 400_000 * 1.25 * 1.02]);
    expect(r.pecas[0]!.contorno[2]).toEqual({ x: 408, y: 1250 });
    expect(r.eficienciaPercentual).toBeCloseTo((510_000 / (1250 * 1600)) * 100, 9);
  });
});

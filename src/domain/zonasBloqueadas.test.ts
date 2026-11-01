import { describe, expect, it } from 'vitest';
import { contornosSeSobrepoem, ponto } from '../core/geometria';
import { contornoDaZona, criarConfiguracaoDeEnfesto, lerZonasBloqueadas, textoDasZonas, type ConfiguracaoDeEnfesto, type ZonaBloqueada } from './enfesto';
import { criarMolde, linhaDeCorteDaPeca } from './molde';
import { executarNestingAutomatico, executarNestingPorPontosDeCanto } from './nesting';
import { validarProjeto } from './validacao';

const ZONA: ZonaBloqueada = { minX: 0, maxX: 500, minY: 0, maxY: 600 };
const enfesto = (zonasBloqueadas?: readonly ZonaBloqueada[]): ConfiguracaoDeEnfesto =>
  criarConfiguracaoDeEnfesto({ tipo: 'impar', larguraUtilMm: 1000, comprimentoMm: 3000, quantidadeDeCamadas: 1, margemLateralMm: 0, margemDeExtremidadeMm: 0, distanciaMinimaEntrePecasMm: 5, ...(zonasBloqueadas ? { zonasBloqueadas } : {}) } as ConfiguracaoDeEnfesto);
const peca = (id: string) =>
  criarMolde({ nome: id, referencia: '', tamanho: 'M', quantidade: 3, contorno: [ponto(0, 0), ponto(300, 0), ponto(300, 400), ponto(0, 400)], linhaDeFio: { inicio: ponto(150, 50), fim: ponto(150, 350) } }, id);

describe('as áreas bloqueadas da mesa (ADR 0160)', () => {
  it('o formulário: ida e volta, e a linha que não serve diz qual é', () => {
    expect(lerZonasBloqueadas('0 600 0 500\n\n 1000,5 1200 0 100 ')).toEqual([ZONA, { minY: 1000.5, maxY: 1200, minX: 0, maxX: 100 }]);
    expect(lerZonasBloqueadas(textoDasZonas([ZONA]))).toEqual([ZONA]);
    expect(() => lerZonasBloqueadas('10 5 0 100')).toThrow(/Área bloqueada "10 5 0 100"/);
    expect(() => lerZonasBloqueadas('1 2 3')).toThrow(/comprimento de/);
  });

  it.each([
    ['grade', executarNestingAutomatico],
    ['pontos de canto', executarNestingPorPontosDeCanto],
  ] as const)('o encaixe automático (%s) não põe peça na área bloqueada, e todas entram', (_nome, executar) => {
    const r = executar([peca('a')], enfesto([ZONA]));
    expect(r.pecasNaoColocadas).toEqual([]);
    expect(r.pecasColocadas).toHaveLength(3);
    for (const p of r.pecasColocadas) expect(contornosSeSobrepoem(linhaDeCorteDaPeca(p.molde), contornoDaZona(ZONA))).toBe(false);
  });

  it('a validação acusa a peça posta à mão sobre a área', () => {
    const problemas = validarProjeto([{ ...peca('a'), quantidade: 1 }], enfesto([ZONA]));
    expect(problemas.some((p) => p.mensagem.includes('área bloqueada'))).toBe(true);
    expect(validarProjeto([{ ...peca('a'), quantidade: 1 }], enfesto()).some((p) => p.mensagem.includes('área bloqueada'))).toBe(false);
  });
});

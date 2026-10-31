import { describe, expect, it } from 'vitest';
import { ponto, retanguloEnvolvente } from '../core/geometria';
import { compactarEncaixe, compactarResultado } from './encaixeManual';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from './enfesto';
import { criarMolde, INCLINACAO_MAXIMA_GRAUS, transladarMolde, type Molde } from './molde';
import type { ResultadoDeNesting } from './nesting';
import { pecaNaDobraDoTecido } from './encaixeManual';
import { pecaDerivada } from './pecasDerivadas';
import { prepararDobra } from './pecasNaDobra';
import {
  comEspelhamentoPermitido,
  comUmTrechoPorTecido,
  enfestoComFixas,
  juntarAoEncaixe,
  separarParaOEncaixe,
  tecidoDaPeca,
  tecidosDoModelo,
} from './tecidosDoModelo';
import { validarProjeto } from './validacao';

const enfesto = (tipo: 'par' | 'impar' = 'impar', extra: Partial<ConfiguracaoDeEnfesto> = {}): ConfiguracaoDeEnfesto =>
  ({ ...criarConfiguracaoDeEnfesto({ tipo, larguraUtilMm: 1000, comprimentoMm: 3000, quantidadeDeCamadas: 2, margemLateralMm: 0, margemDeExtremidadeMm: 0, distanciaMinimaEntrePecasMm: 0 }), ...extra }) as ConfiguracaoDeEnfesto;

const peca = (id: string, x = 100, y = 100, tecido?: string): Molde => ({
  ...transladarMolde(
    criarMolde({ nome: id, referencia: '', tamanho: 'M', quantidade: 1, contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 100), ponto(0, 100)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(50, 10), fim: ponto(50, 90) }, restricaoDeRotacao: { permite180: false, permite90e270: false } }, id),
    { x, y },
    id,
  ),
  ...(tecido ? { tecidoDoMolde: tecido } : {}),
});

describe('os tecidos do modelo (ADR 0194)', () => {
  it('sem tecido, a peça é do principal, que vem na frente da lista', () => {
    expect(tecidoDaPeca(peca('a'))).toBe('Principal');
    expect(tecidosDoModelo([peca('a', 0, 0, 'Forro'), peca('b'), peca('c', 0, 0, 'Forro')])).toEqual(['Principal', 'Forro']);
  });

  it('o forro e a entretela gerados já dizem o tecido; a vista é do principal', () => {
    const base = peca('a');
    expect(pecaDerivada(base, { tipo: 'entretela', larguraMm: 10, recuoMm: 3, costuraMm: 0 } as Parameters<typeof pecaDerivada>[1], null, 'n').tecidoDoMolde).toBe('Entretela');
  });

  it('separa o tecido pedido, e as outras peças ficam para sair da mesa', () => {
    const s = separarParaOEncaixe([peca('a'), peca('b', 0, 0, 'Forro')], { tecido: 'Forro' }, enfesto());
    expect(s.paraEncaixar.map((p) => p.id)).toEqual(['b']);
    expect(s.foraDoEncaixe.map((p) => p.id)).toEqual(['a']);
    expect(s.fixas).toEqual([]);
  });

  it('as peças mantidas não entram, e o lugar delas fica bloqueado', () => {
    const s = separarParaOEncaixe([peca('a', 200, 300), peca('b')], { idsFixos: new Set(['a']) }, enfesto());
    expect(s.paraEncaixar.map((p) => p.id)).toEqual(['b']);
    expect(enfestoComFixas(enfesto(), s.fixas).zonasBloqueadas).toEqual([{ minX: 200, maxX: 300, minY: 300, maxY: 400 }]);
  });

  it('"somente peças encaixadas": a que foi para fora da mesa não entra', () => {
    const s = separarParaOEncaixe([peca('a'), peca('b', 0, 3200)], { somenteNaMesa: true }, enfesto());
    expect(s.paraEncaixar.map((p) => p.id)).toEqual(['a']);
    expect(s.foraDoEncaixe.map((p) => p.id)).toEqual(['b']);
  });

  it('ao juntar, as fixas ficam e as de fora vão para depois da mesa', () => {
    const r = juntarAoEncaixe([peca('n')], [peca('f', 300, 300)], [peca('o', 500, 500)], enfesto());
    expect(r.map((p) => p.id)).toEqual(['n', 'f', 'o']);
    expect(retanguloEnvolvente(r[1]!.contorno).minY).toBe(300);
    expect(retanguloEnvolvente(r[2]!.contorno).minY).toBeGreaterThan(3000);
  });

  it('um trecho por tecido: o tecido vira o grupo do encaixe', () => {
    expect(comUmTrechoPorTecido([peca('a', 0, 0, 'Forro')])[0]!.grupoDoEncaixe).toBe('Forro');
  });

  it('o espelhamento fica permitido nas peças do encaixe', () => {
    expect(comEspelhamentoPermitido([peca('a')])[0]!.restricaoDeRotacao.permiteEspelhamento).toBe(true);
  });
});

describe('compactar (ADR 0195)', () => {
  it('as peças andam para o começo e para cima, e o comprimento diminui', () => {
    const r = compactarEncaixe([peca('a', 300, 500), peca('b', 300, 900)], enfesto());
    const [a, b] = r.map((p) => retanguloEnvolvente(p.contorno));
    expect(a!.minY).toBeCloseTo(4, 1);
    expect(a!.minX).toBeCloseTo(4, 1);
    expect(b!.minY).toBeLessThan(150);
  });

  it('não atravessa as áreas bloqueadas nem as emendas', () => {
    const r = compactarEncaixe([peca('a', 300, 500)], enfesto('impar', { emendasMm: [300] }));
    expect(retanguloEnvolvente(r[0]!.contorno).minY).toBeGreaterThanOrEqual(300);
  });

  it('com grupos, não mexe: os trechos não podem misturar', () => {
    const p = { ...peca('a', 300, 500), grupoDoEncaixe: 'x' };
    expect(compactarEncaixe([p], enfesto())[0]).toBe(p);
  });

  it('refaz as contas do resultado', () => {
    const resultado = { pecasColocadas: [{ idOriginal: 'a', indiceCopia: 0, molde: peca('a', 300, 500) }], pecasNaoColocadas: [], comprimentoUtilizadoMm: 600, areaOcupadaMm2: 10000, aproveitamentoPercentual: 1, tempoDeProcessamentoMs: 0, interrompido: false, paradaPorTempoLimite: false, paradaPorMetaDeAproveitamento: false } as unknown as ResultadoDeNesting;
    expect(compactarResultado(resultado, enfesto()).comprimentoUtilizadoMm).toBeCloseTo(104, 0);
  });
});

describe('a dobra inferior (ADR 0195)', () => {
  const meia = (): Molde => ({
    ...peca('a'),
    contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 400), ponto(0, 400)],
    linhaDeSimetria: { de: ponto(200, 0), ate: ponto(200, 400) },
    restricaoDeRotacao: { permite180: true, permite90e270: false },
  });

  it('a peça vai encostada na borda de baixo, e a validação aceita', () => {
    const e = enfesto('par', { dobraInferior: true });
    const d = prepararDobra([meia()], e);
    expect(retanguloEnvolvente(d.fixas[0]!.molde.contorno).maxX).toBe(1000);
    expect(validarProjeto([d.fixas[0]!.molde], e).some((p) => p.tipo === 'fora-dos-limites')).toBe(false);
    expect(retanguloEnvolvente(pecaNaDobraDoTecido(meia(), 'horizontal', e).contorno).maxX).toBe(1000);
  });
});

describe('a tolerância de giro', () => {
  it('vai até 10 graus, como no manual', () => {
    expect(INCLINACAO_MAXIMA_GRAUS).toBe(10);
  });
});

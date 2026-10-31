import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { gerarPlt } from '../formats/plt-exportacao';
import { areaNaUnidade, pesoNaUnidade, ROTULO_DA_UNIDADE_DE_AREA, unidadeDeAreaGuardada, unidadeDePesoGuardada } from '../ui/preferencias';
import { criarConfiguracaoDeEnfesto, enfestoComEmendas, lerPontosDeEmenda } from './enfesto';
import { criarMolde, transladarMolde, type Molde } from './molde';
import { expandirComGrade, definirTamanhosDoMolde } from './tamanhosGraduados';
import { validarProjeto } from './validacao';

const peca = (y = 100): Molde =>
  transladarMolde(
    criarMolde(
      { nome: 'a', referencia: '', tamanho: 'M', quantidade: 2, contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 200), ponto(0, 200)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 180) }, restricaoDeRotacao: { permite180: false, permite90e270: false } },
      'a',
    ),
    { x: 100, y },
    'a',
  );

const enfesto = criarConfiguracaoDeEnfesto({ tipo: 'impar', larguraUtilMm: 1000, comprimentoMm: 3000, quantidadeDeCamadas: 1, margemLateralMm: 0, margemDeExtremidadeMm: 0, distanciaMinimaEntrePecasMm: 0 });

describe('a grade de corte (ADR 0186)', () => {
  let n = 0;
  const novoId = (): string => `n${n++}`;

  it('cada tamanho entra quantas vezes a grade diz, e zero tira', () => {
    const g = definirTamanhosDoMolde(peca(), ['P', 'M', 'G'], 'M');
    const r = expandirComGrade([g], novoId, { P: 1, M: 2, G: 0 });
    expect(r.map((p) => p.quantidade)).toEqual([2, 4]);
  });

  it('o tamanho fora da grade fica com uma vez, e a peça sem graduação não muda', () => {
    const g = definirTamanhosDoMolde(peca(), ['P', 'M'], 'M');
    const semGrade = peca();
    const r = expandirComGrade([g, semGrade], novoId, { M: 3 });
    expect(r.map((p) => p.quantidade)).toEqual([2, 6, 2]);
    expect(r[2]).toBe(semGrade);
  });
});

describe('os pontos de emenda (ADR 0188)', () => {
  it('lê os pontos com espaço ou vírgula decimal, em ordem, sem os inválidos', () => {
    expect(lerPontosDeEmenda('2400 1200,5 x -3')).toEqual([1200.5, 2400]);
    expect(lerPontosDeEmenda('')).toEqual([]);
  });

  it('a emenda vira uma faixa bloqueada para o encaixe, na largura toda', () => {
    expect(enfestoComEmendas({ ...enfesto, emendasMm: [1200] }).zonasBloqueadas).toEqual([{ minX: 0, maxX: 1000, minY: 1199, maxY: 1201 }]);
    expect(enfestoComEmendas(enfesto)).toBe(enfesto);
  });

  it('a validação avisa da peça que atravessa a emenda, e só dela', () => {
    const com = { ...enfesto, emendasMm: [200] };
    expect(validarProjeto([peca(100)], com).find((p) => p.tipo === 'peca-na-emenda')?.severidade).toBe('aviso');
    expect(validarProjeto([peca(500)], com).some((p) => p.tipo === 'peca-na-emenda')).toBe(false);
  });

  it('sai no plotter, com a marca escrita', () => {
    const plt = gerarPlt([peca()], { emendas: [1200], larguraDaMesaMm: 1000 });
    expect(plt).toContain('LBEMENDA');
  });
});

describe('as unidades de área e de peso (ADR 0189)', () => {
  it('converte para a unidade escolhida', () => {
    expect(areaNaUnidade(1_000_000, 'm2')).toBe(1);
    expect(areaNaUnidade(1_000_000, 'cm2')).toBe(10_000);
    expect(areaNaUnidade(645.16, 'pol2')).toBeCloseTo(1, 6);
    expect(pesoNaUnidade(2, 'g')).toBe(2000);
    expect(pesoNaUnidade(0.45359237, 'lb')).toBeCloseTo(1, 6);
    expect(ROTULO_DA_UNIDADE_DE_AREA.m2).toBe('m²');
  });

  it('sem nada guardado, ficam as de sempre; valor estranho é ignorado', () => {
    expect(unidadeDeAreaGuardada({ getItem: () => null })).toBe('cm2');
    expect(unidadeDePesoGuardada({ getItem: () => 'tonelada' })).toBe('kg');
    expect(unidadeDePesoGuardada({ getItem: () => 'lb' })).toBe('lb');
  });
});

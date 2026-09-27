import { describe, it, expect } from 'vitest';
import {
  criarConfiguracaoDeEnfesto,
  espessurasFisicasPorCamada,
  orientacaoDaCamada,
  enfestoInverteFaceEmAlgumaCamada,
  ROTULO_DO_TIPO,
  type ConfiguracaoDeEnfesto,
} from './enfesto';

function base(tipo: ConfiguracaoDeEnfesto['tipo']): ConfiguracaoDeEnfesto {
  return {
    larguraUtilMm: 1500,
    comprimentoMm: 3000,
    quantidadeDeCamadas: 10,
    margemLateralMm: 10,
    margemDeExtremidadeMm: 20,
    tipo,
    // Campos extras exigidos por Tubular/Ramado — inofensivos para os
    // demais tipos, que simplesmente os ignoram; sobrescritos nos testes
    // específicos de Tubular/Ramado quando necessário.
    larguraDoTuboMm: 1500,
    alinhamentoDasBordas: 'alinhado',
    sentidoDeAlimentacao: 'unico',
  } as ConfiguracaoDeEnfesto;
}

describe('criarConfiguracaoDeEnfesto — validação comum', () => {
  it('aceita uma configuração Par válida', () => {
    const config = criarConfiguracaoDeEnfesto(base('par'));
    expect(config.tipo).toBe('par');
  });

  it('rejeita largura útil <= 0', () => {
    expect(() => criarConfiguracaoDeEnfesto({ ...base('impar'), larguraUtilMm: 0 })).toThrow(/largura útil/);
  });

  it('rejeita comprimento <= 0', () => {
    expect(() => criarConfiguracaoDeEnfesto({ ...base('impar'), comprimentoMm: -1 })).toThrow(/comprimento/);
  });

  it('rejeita quantidade de camadas não inteira ou < 1', () => {
    expect(() => criarConfiguracaoDeEnfesto({ ...base('impar'), quantidadeDeCamadas: 0 })).toThrow(/camadas/);
    expect(() => criarConfiguracaoDeEnfesto({ ...base('impar'), quantidadeDeCamadas: 2.5 })).toThrow(/camadas/);
  });

  it('rejeita margens negativas', () => {
    expect(() => criarConfiguracaoDeEnfesto({ ...base('impar'), margemLateralMm: -1 })).toThrow(/margem lateral/);
    expect(() => criarConfiguracaoDeEnfesto({ ...base('impar'), margemDeExtremidadeMm: -1 })).toThrow(
      /margem de extremidade/,
    );
  });
});

describe('criarConfiguracaoDeEnfesto — Tubular (parâmetro próprio)', () => {
  it('aceita largura do tubo >= largura útil', () => {
    const config = criarConfiguracaoDeEnfesto({ ...base('tubular'), larguraDoTuboMm: 1500 } as ConfiguracaoDeEnfesto);
    expect(config.tipo).toBe('tubular');
  });

  it('rejeita largura do tubo <= 0', () => {
    expect(() =>
      criarConfiguracaoDeEnfesto({ ...base('tubular'), larguraDoTuboMm: 0 } as ConfiguracaoDeEnfesto),
    ).toThrow(/largura do tubo/);
  });

  it('rejeita largura do tubo menor que a largura útil declarada', () => {
    expect(() =>
      criarConfiguracaoDeEnfesto({
        ...base('tubular'),
        larguraUtilMm: 1500,
        larguraDoTuboMm: 1000,
      } as ConfiguracaoDeEnfesto),
    ).toThrow(/não pode ser menor/);
  });
});

describe('criarConfiguracaoDeEnfesto — Ramado (modalidade independente)', () => {
  it('aceita alinhamentoDasBordas e sentidoDeAlimentacao próprios', () => {
    const config = criarConfiguracaoDeEnfesto({
      ...base('ramado'),
      alinhamentoDasBordas: 'escalonado',
      sentidoDeAlimentacao: 'alternado',
    } as ConfiguracaoDeEnfesto);
    expect(config.tipo).toBe('ramado');
    if (config.tipo === 'ramado') {
      expect(config.alinhamentoDasBordas).toBe('escalonado');
      expect(config.sentidoDeAlimentacao).toBe('alternado');
    }
  });
});

describe('todos os 5 tipos têm rótulo próprio', () => {
  it('rótulos não se repetem e cobrem os 5 tipos do escopo', () => {
    const rotulos = Object.values(ROTULO_DO_TIPO);
    expect(new Set(rotulos).size).toBe(5);
    expect(ROTULO_DO_TIPO.ramado).not.toBe(ROTULO_DO_TIPO.tubular);
  });
});

describe('espessurasFisicasPorCamada', () => {
  it('Par e Tubular dobram o tecido (2 espessuras por camada)', () => {
    expect(espessurasFisicasPorCamada('par')).toBe(2);
    expect(espessurasFisicasPorCamada('tubular')).toBe(2);
  });

  it('Ímpar, Zigue-zague e Ramado são enfesto aberto (1 espessura por camada)', () => {
    expect(espessurasFisicasPorCamada('impar')).toBe(1);
    expect(espessurasFisicasPorCamada('zigue-zague')).toBe(1);
    expect(espessurasFisicasPorCamada('ramado')).toBe(1);
  });
});

describe('orientacaoDaCamada / enfestoInverteFaceEmAlgumaCamada', () => {
  it('zigue-zague alterna a orientação a cada camada', () => {
    expect(orientacaoDaCamada('zigue-zague', 0)).toBe('normal');
    expect(orientacaoDaCamada('zigue-zague', 1)).toBe('invertida');
    expect(orientacaoDaCamada('zigue-zague', 2)).toBe('normal');
  });

  it('os demais tipos nunca invertem a face', () => {
    for (const tipo of ['par', 'impar', 'tubular', 'ramado'] as const) {
      expect(orientacaoDaCamada(tipo, 0)).toBe('normal');
      expect(orientacaoDaCamada(tipo, 1)).toBe('normal');
      expect(orientacaoDaCamada(tipo, 7)).toBe('normal');
    }
  });

  it('enfestoInverteFaceEmAlgumaCamada é verdadeiro só para zigue-zague com camadas >= 2', () => {
    expect(enfestoInverteFaceEmAlgumaCamada(criarConfiguracaoDeEnfesto(base('zigue-zague')))).toBe(true);
    expect(
      enfestoInverteFaceEmAlgumaCamada(
        criarConfiguracaoDeEnfesto({ ...base('zigue-zague'), quantidadeDeCamadas: 1 }),
      ),
    ).toBe(false);
    expect(enfestoInverteFaceEmAlgumaCamada(criarConfiguracaoDeEnfesto(base('impar')))).toBe(false);
  });
});

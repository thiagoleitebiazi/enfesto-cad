import { describe, it, expect } from 'vitest';
import { ponto } from '../core/geometria';
import {
  criarMolde,
  dimensoesDoMolde,
  anguloDaLinhaDeFio,
  rotacoesPermitidas,
  rotacaoEhPermitida,
  RESTRICAO_PADRAO,
  type DadosDeNovoMolde,
} from './molde';

function dadosBase(sobrescrever: Partial<DadosDeNovoMolde> = {}): DadosDeNovoMolde {
  return {
    nome: 'Frente',
    referencia: 'REF-001',
    tamanho: 'M',
    contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)],
    linhaDeFio: { inicio: ponto(100, 50), fim: ponto(100, 250) },
    ...sobrescrever,
  };
}

describe('criarMolde', () => {
  it('cria um molde válido', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    expect(molde.id).toBe('m1');
    expect(molde.quantidade).toBe(1);
    expect(molde.restricaoDeRotacao).toEqual(RESTRICAO_PADRAO);
  });

  it('rejeita contorno com menos de 3 pontos', () => {
    expect(() => criarMolde(dadosBase({ contorno: [ponto(0, 0), ponto(1, 1)] }), 'm2')).toThrow(/3 pontos/);
  });

  it('rejeita contorno degenerado (área zero)', () => {
    const linha = [ponto(0, 0), ponto(10, 0), ponto(20, 0)];
    expect(() => criarMolde(dadosBase({ contorno: linha }), 'm3')).toThrow(/degenerado/);
  });

  it('rejeita quantidade menor que 1', () => {
    expect(() => criarMolde(dadosBase({ quantidade: 0 }), 'm4')).toThrow(/quantidade/);
  });
});

describe('dimensoesDoMolde', () => {
  it('calcula largura, altura e área reais em mm', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    const dim = dimensoesDoMolde(molde);
    expect(dim.larguraMm).toBe(200);
    expect(dim.alturaMm).toBe(300);
    expect(dim.areaMm2).toBe(60000);
  });
});

describe('linha de fio', () => {
  it('ângulo de uma linha vertical (para cima) é 90°', () => {
    const angulo = anguloDaLinhaDeFio({ inicio: ponto(0, 0), fim: ponto(0, 100) });
    expect(angulo).toBeCloseTo(90, 6);
  });

  it('ângulo de uma linha horizontal (para a direita) é 0°', () => {
    const angulo = anguloDaLinhaDeFio({ inicio: ponto(0, 0), fim: ponto(100, 0) });
    expect(angulo).toBeCloseTo(0, 6);
  });
});

describe('restrição de rotação — regra crítica do sentido do fio', () => {
  it('por padrão só permite 0° (nenhuma rotação)', () => {
    expect(rotacoesPermitidas(RESTRICAO_PADRAO)).toEqual([0]);
    expect(rotacaoEhPermitida(RESTRICAO_PADRAO, 90)).toBe(false);
    expect(rotacaoEhPermitida(RESTRICAO_PADRAO, 180)).toBe(false);
    expect(rotacaoEhPermitida(RESTRICAO_PADRAO, 270)).toBe(false);
  });

  it('permite180 libera exatamente 0° e 180°, não 90/270', () => {
    const restricao = { permite180: true, permite90e270: false };
    expect(rotacoesPermitidas(restricao)).toEqual([0, 180]);
    expect(rotacaoEhPermitida(restricao, 180)).toBe(true);
    expect(rotacaoEhPermitida(restricao, 90)).toBe(false);
  });

  it('permite90e270 libera 0°, 90° e 270°, mas não 180° sozinho', () => {
    const restricao = { permite180: false, permite90e270: true };
    expect(rotacoesPermitidas(restricao)).toEqual([0, 90, 270]);
    expect(rotacaoEhPermitida(restricao, 180)).toBe(false);
    expect(rotacaoEhPermitida(restricao, 90)).toBe(true);
    expect(rotacaoEhPermitida(restricao, 270)).toBe(true);
  });

  it('normaliza ângulos fora de [0, 360) antes de comparar', () => {
    const restricao = { permite180: true, permite90e270: false };
    expect(rotacaoEhPermitida(restricao, -180)).toBe(true);
    expect(rotacaoEhPermitida(restricao, 540)).toBe(true);
  });

  it('nunca permite rotação alguma automaticamente só para caber melhor no tecido (não há flag de "auto-otimizar orientação")', () => {
    // Documenta a regra da seção 5: não existe, em lugar nenhum do domínio,
    // uma opção que ignore restricaoDeRotacao para melhorar aproveitamento.
    const restricaoTotalmenteFechada = { permite180: false, permite90e270: false };
    for (let angulo = -720; angulo <= 720; angulo += 15) {
      if (angulo % 360 === 0) continue;
      expect(rotacaoEhPermitida(restricaoTotalmenteFechada, angulo)).toBe(false);
    }
  });
});

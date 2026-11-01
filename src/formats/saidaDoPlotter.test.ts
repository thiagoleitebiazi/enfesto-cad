import { describe, expect, it } from 'vitest';
import { ponto, retanguloEnvolvente } from '../core/geometria';
import { criarMolde, transladarMolde, type Molde } from '../domain/molde';
import { ESCALA_REAL, fatoresDaImpressao, pecasNaEscala } from './escalaDaImpressao';
import { tracosDoTexto } from './fonteDeTracos';
import { gerarPlt } from './plt-exportacao';

const peca = (nome: string, x = 0, y = 0): Molde =>
  transladarMolde(
    criarMolde(
      { nome, referencia: '', tamanho: 'M', quantidade: 1, contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 200), ponto(0, 200)], margemDeCosturaMm: 10, linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 180) }, restricaoDeRotacao: { permite180: false, permite90e270: false } },
      nome,
    ),
    { x, y },
    nome,
  );

describe('o texto como linha (ADR 0184)', () => {
  it('as letras saem em traços, na altura pedida', () => {
    const t = tracosDoTexto('A', 6);
    expect(t.length).toBeGreaterThan(0);
    expect(Math.max(...t.flat().map((p) => p.y))).toBe(6);
  });

  it('cada letra anda para a frente; o espaço e o desconhecido só ocupam lugar', () => {
    const a = retanguloEnvolvente(tracosDoTexto('A', 6).flat());
    const ba = tracosDoTexto(' A', 6).flat();
    expect(retanguloEnvolvente(ba).minX).toBeCloseTo(a.minX + 5.5, 6);
    expect(tracosDoTexto('§', 6)).toEqual([]);
  });

  it('no PLT, sai sem o letreiro do plotter', () => {
    const com = gerarPlt([peca('FRENTE')], { textoComoLinha: true, cabecalho: ['RISCO 1'], textos: [{ x: 10, y: 10, texto: 'EMENDA' }] });
    const sem = gerarPlt([peca('FRENTE')], { cabecalho: ['RISCO 1'], textos: [{ x: 10, y: 10, texto: 'EMENDA' }] });
    expect(sem).toContain('LBFRENTE');
    expect(com).not.toContain('LB');
    expect(com).not.toContain('SI0');
    expect(com.length).toBeGreaterThan(sem.length);
  });
});

describe('a proporção da impressão (ADR 0185)', () => {
  const desenho = { larguraMm: 1000, comprimentoMm: 3000 };
  const folha = { largura: 277, altura: 190 };

  it('escala real, porcentagem e fatores', () => {
    expect(fatoresDaImpressao(ESCALA_REAL, desenho, folha)).toEqual({ horizontal: 1, vertical: 1 });
    expect(fatoresDaImpressao({ ...ESCALA_REAL, proporcao: 'porcentagem', porcentagem: 50 }, desenho, folha)).toEqual({ horizontal: 0.5, vertical: 0.5 });
    expect(fatoresDaImpressao({ ...ESCALA_REAL, proporcao: 'fatores', fatorXPorcento: 25, fatorYPorcento: 75 }, desenho, folha)).toEqual({ horizontal: 0.25, vertical: 0.75 });
  });

  it('do tamanho da folha: o lado que mais aperta manda, e tudo cabe numa folha', () => {
    const f = fatoresDaImpressao({ ...ESCALA_REAL, proporcao: 'folha' }, desenho, folha);
    expect(f.horizontal).toBe(f.vertical);
    expect(desenho.comprimentoMm * f.horizontal).toBeLessThanOrEqual(folha.largura);
    expect(desenho.larguraMm * f.vertical).toBeLessThanOrEqual(folha.altura);
  });

  it('as peças mudam de tamanho e o lugar na mesa acompanha', () => {
    const r = pecasNaEscala([peca('a', 100, 400)], { horizontal: 0.5, vertical: 0.25 });
    const c = retanguloEnvolvente(r[0]!.contorno);
    expect(c.minX).toBeCloseTo(25, 6);
    expect(c.minY).toBeCloseTo(200, 6);
    expect(c.maxX).toBeCloseTo(50, 6);
    expect(c.maxY).toBeCloseTo(300, 6);
    expect(r[0]!.margemDeCosturaMm).toBeCloseTo(2.5, 6);
  });

  it('em escala real, as peças são as mesmas', () => {
    const pecas = [peca('a')];
    expect(pecasNaEscala(pecas, { horizontal: 1, vertical: 1 })).toBe(pecas);
  });
});

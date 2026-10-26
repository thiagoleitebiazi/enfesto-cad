import { describe, expect, it } from 'vitest';
import { area, comprimentoDaLinha, distancia, pontoMaisProximoNoContorno, retanguloEnvolvente, type Ponto2D } from '../core/geometria';
import { criarMolde } from './molde';
import { COMPONENTES, componente, componenteNoProjeto, larguraDaManga, medidasDoComponente, type TipoDeComponente } from './componentes';

const ids = (): (() => string) => {
  let n = 0;
  return () => `c${++n}`;
};

describe('os componentes prontos (ADR 0133)', () => {
  it('cada um sai uma peça válida, com o fio dentro, e os piques em cima da borda', () => {
    for (const tipo of Object.keys(COMPONENTES) as TipoDeComponente[]) {
      const p = componente(tipo, {}, ids());
      expect(p.nome).toBe(COMPONENTES[tipo].nome);
      expect(area(p.contorno)).toBeGreaterThan(0);
      expect(p.margemDeCosturaMm).toBe(10);
      for (const q of p.piques) {
        expect(pontoMaisProximoNoContorno(q.posicao, p.contorno).distancia).toBeLessThan(1e-6);
        const a = p.contorno[q.indiceAresta]!;
        const b = p.contorno[(q.indiceAresta + 1) % p.contorno.length]!;
        // O pique está na aresta que o registro diz.
        expect(Math.abs(distancia(a, q.posicao) + distancia(q.posicao, b) - distancia(a, b))).toBeLessThan(1e-6);
      }
    }
  });

  it('o bolso: a largura, a altura e o bico; sem bico, o retângulo', () => {
    const b = componente('bolso-chapa', { largura: 150, altura: 170, bico: 30 }, ids());
    const caixa = retanguloEnvolvente(b.contorno);
    expect([caixa.maxX - caixa.minX, caixa.maxY - caixa.minY]).toEqual([170, 150]);
    expect(area(b.contorno)).toBeCloseTo(150 * 140 + (150 * 30) / 2, 6);
    expect(componente('bolso-chapa', { bico: 0 }, ids()).contorno).toHaveLength(4);
    expect(() => componente('bolso-chapa', { altura: 30, bico: 40 }, ids())).toThrow('o bico precisa ser menor');
  });

  it('o cós e o punho: a volta mais o transpasse, o dobro da altura, a dobra no meio e os piques', () => {
    const c = componente('cos', { cintura: 700, transpasse: 30, altura: 40 }, ids());
    const caixa = retanguloEnvolvente(c.contorno);
    expect([caixa.maxY - caixa.minY, caixa.maxX - caixa.minX]).toEqual([730, 80]);
    expect(c.linhasInternas).toEqual([[{ x: 40, y: 0 }, { x: 40, y: 730 }]]);
    // O transpasse (em cima e embaixo) e o meio da cintura (30 + 350).
    expect(c.piques.map((p) => p.posicao.y)).toEqual([30, 30, 380, 380]);
    expect(componente('punho', { transpasse: 0 }, ids()).piques).toHaveLength(2);
  });

  it('a gola padre: a borda de baixo tem o decote e sobe na frente', () => {
    const g = componente('gola-padre', { decote: 400, altura: 35, subida: 15 }, ids());
    const baixo = g.contorno.slice(25);
    expect(baixo[0]).toEqual({ x: 20, y: 0 });
    expect(baixo[12]).toEqual({ x: 35, y: 200 });
    expect(comprimentoDaLinha(baixo)).toBeGreaterThan(400);
    expect(comprimentoDaLinha(baixo)).toBeLessThan(403);
  });

  it('a manga: a cabeça mede a cava mais a folga; a boca e o comprimento', () => {
    const m = componente('manga', { cava: 440, folga: 15, comprimento: 600, boca: 260, cabeca: 140 }, ids());
    const cabeca: Ponto2D[] = m.contorno.slice(0, 33);
    expect(comprimentoDaLinha(cabeca)).toBeCloseTo(455, 3);
    const caixa = retanguloEnvolvente(m.contorno);
    expect(caixa.maxX - caixa.minX).toBeCloseTo(600, 6);
    expect(distancia(m.contorno[33]!, m.contorno[34]!)).toBeCloseTo(260, 6);
    // Mais cava, manga mais larga.
    expect(larguraDaManga(500, 140)).toBeGreaterThan(larguraDaManga(455, 140));
    expect(() => componente('manga', { boca: 500 }, ids())).toThrow('a boca');
    expect(() => componente('manga', { comprimento: 150, cabeca: 140 }, ids())).toThrow('o comprimento precisa passar');
  });

  it('as medidas: o padrão no que falta; abaixo do mínimo, não', () => {
    expect(medidasDoComponente('punho', {})).toEqual({ volta: 230, transpasse: 20, altura: 60 });
    expect(() => medidasDoComponente('punho', { altura: 5 })).toThrow('Punho: altura acabada de 10 mm para cima.');
  });

  it('no projeto: depois das peças da mesa, alinhado pelo alto', () => {
    const outra = criarMolde({ nome: 'Frente', referencia: '', tamanho: 'M', contorno: [{ x: 50, y: 0 }, { x: 50, y: 300 }, { x: 400, y: 300 }, { x: 400, y: 0 }], linhaDeFio: { inicio: { x: 100, y: 150 }, fim: { x: 350, y: 150 } } }, 'f');
    const posto = componenteNoProjeto(componente('bolso-chapa', {}, ids()), [outra]);
    const caixa = retanguloEnvolvente(posto.contorno);
    expect([caixa.minX, caixa.minY]).toEqual([50, 340]);
    expect(componenteNoProjeto(componente('bolso-chapa', {}, ids()), []).contorno[0]).toEqual({ x: 0, y: 0 });
  });
});

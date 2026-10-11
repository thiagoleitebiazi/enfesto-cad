import { describe, it, expect } from 'vitest';
import { ponto, type Ponto2D } from '../core/geometria';
import { alinharPique } from './alinharPiques';
import { contornosDosTamanhos, definirRegra } from './graduacao';
import { criarMolde, type Molde } from './molde';
import { definirGraduacaoDoPique, piquesNoTamanho } from './piquesGraduados';
import { definirTamanhosDoMolde } from './tamanhosGraduados';

const ZERO = ponto(0, 0);
const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
const base = (contorno: readonly Ponto2D[], extra: Partial<Molde> = {}): Molde => ({
  ...criarMolde({ nome: 'Frente', referencia: 'R', tamanho: 'M', contorno, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) } }, 'm1'),
  ...extra,
});

/** P, M (base) e G; o canto (200, 300) anda (10, 20) no G e (−10, −20) no P. O pique está no meio da aresta 1, em (200, 150). */
function comCantoGraduado(extra: Partial<Molde> = {}): Molde {
  const peca = definirTamanhosDoMolde(base(RETANGULO, extra), ['P', 'M', 'G'], 'M');
  const graduada = { ...peca, graduacao: definirRegra(peca.graduacao!, RETANGULO, 2, [ponto(-10, -20), ZERO, ponto(10, 20)]) };
  return { ...graduada, piques: [{ id: 'p', posicao: ponto(200, 150), indiceAresta: 1 }] };
}

/** Onde o pique fica em cada tamanho. */
function emCadaTamanho(peca: Molde): Ponto2D[] {
  return contornosDosTamanhos(peca.graduacao!, peca.contorno).map((contorno, t) => piquesNoTamanho(peca, contorno, t)[0]!.posicao);
}

describe('alinhar piques entre os tamanhos', () => {
  it('antes de alinhar, o pique fica na proporção da aresta: em cada tamanho numa altura diferente', () => {
    const [noP, noM, noG] = emCadaTamanho(comCantoGraduado());

    expect(noM).toEqual(ponto(200, 150));
    expect(noP!.y).toBeCloseTo(140, 6);
    expect(noG!.y).toBeCloseTo(160, 6);
  });

  it('vertical: em todos os tamanhos o pique fica na linha vertical da tela que passa por ele no base (o mesmo y do mundo)', () => {
    const { molde, perimetros } = alinharPique(comCantoGraduado(), 'p', 'vertical');
    const [noP, noM, noG] = emCadaTamanho(molde);

    expect(noM).toEqual(ponto(200, 150));
    expect(noP!.y).toBeCloseTo(150, 9);
    expect(noG!.y).toBeCloseTo(150, 9);
    // Cada um sobre a aresta do seu tamanho: no G ela vai de (200, 0) a (210, 320); no P, a (190, 280).
    expect(noG!.x).toBeCloseTo(200 + (10 * 150) / 320, 9);
    expect(noP!.x).toBeCloseTo(200 - (10 * 150) / 280, 9);
    // O ponto de referência é o canto (200, 0); a distância dele ao pique cresce um pouco nos dois tamanhos (a aresta inclina).
    expect(molde.piques[0]!.graduacao!.referencia).toEqual(ponto(200, 0));
    expect(perimetros[1]).toBe(0);
    expect(perimetros[2]).toBeCloseTo(Math.hypot((10 * 150) / 320, 150) - 150, 9);
    expect(perimetros[0]).toBeCloseTo(Math.hypot((10 * 150) / 280, 150) - 150, 9);
  });

  it('horizontal: a linha é a horizontal da tela (o mesmo x do mundo)', () => {
    // O pique na aresta de cima do desenho (y = 300 no mundo), em (100, 300): no G essa aresta vai de (210, 320) a (0, 300).
    const peca = { ...comCantoGraduado(), piques: [{ id: 'p', posicao: ponto(100, 300), indiceAresta: 2 }] };
    const { molde } = alinharPique(peca, 'p', 'horizontal');
    const [noP, noM, noG] = emCadaTamanho(molde);

    expect(noM).toEqual(ponto(100, 300));
    expect(noP!.x).toBeCloseTo(100, 9);
    expect(noG!.x).toBeCloseTo(100, 9);
    expect(noG!.y).toBeCloseTo(300 + (20 * 100) / 210, 9);
    expect(noP!.y).toBeCloseTo(300 - (20 * 100) / 190, 9);
  });

  it('elemento: o pique de cada tamanho vai para onde a linha interna cruza o contorno desse tamanho — o do base também', () => {
    // A linha vai de (−50, 100) a (250, 130): cruza a aresta do base em (200, 125).
    const LINHA = [ponto(-50, 100), ponto(250, 130)];
    const { molde } = alinharPique(comCantoGraduado({ linhasInternas: [LINHA] }), 'p', 'elemento', { linhaInterna: 0 });
    const naLinha = (q: Ponto2D): number => Math.abs((LINHA[1]!.x - LINHA[0]!.x) * (q.y - LINHA[0]!.y) - (LINHA[1]!.y - LINHA[0]!.y) * (q.x - LINHA[0]!.x)) / Math.hypot(300, 30);
    const [noP, noM, noG] = emCadaTamanho(molde);

    expect(noM!.x).toBeCloseTo(200, 9);
    expect(noM!.y).toBeCloseTo(125, 9);
    for (const q of [noP!, noM!, noG!]) expect(naLinha(q)).toBeLessThan(1e-6);
    // Cada um do lado do contorno em que o pique estava: perto de x = 200, e não na outra borda.
    expect(noP!.x).toBeGreaterThan(190);
    expect(noG!.x).toBeGreaterThan(200);
  });

  it('ponto vertical: a linha de cada tamanho passa pelo ponto de controle nesse tamanho', () => {
    // Um ponto no meio do lado x = 200, que anda 10 mm no y por tamanho; o pique está do outro lado, em (0, 140).
    const COM_PONTO = [ponto(0, 0), ponto(200, 0), ponto(200, 150), ponto(200, 300), ponto(0, 300)];
    const peca = definirTamanhosDoMolde(base(COM_PONTO), ['P', 'M', 'G'], 'M');
    const graduada: Molde = {
      ...peca,
      graduacao: definirRegra(peca.graduacao!, COM_PONTO, 2, [ponto(0, -10), ZERO, ponto(0, 10)]),
      piques: [{ id: 'p', posicao: ponto(0, 140), indiceAresta: 4 }],
    };
    const { molde, perimetros } = alinharPique(graduada, 'p', 'ponto-vertical', { ponto: 2 });
    const [noP, noM, noG] = emCadaTamanho(molde);

    // No base o ponto está em y = 150: o pique vai para (0, 150); no G, para (0, 160); no P, para (0, 140).
    expect(noM).toEqual(ponto(0, 150));
    expect(noG!.y).toBeCloseTo(160, 9);
    expect(noP!.y).toBeCloseTo(140, 9);
    expect(noG!.x).toBeCloseTo(0, 9);
    expect(perimetros).toEqual([-10, 0, 10]);
  });

  it('recusa quando a linha não cruza o contorno de algum tamanho, quando falta o alvo e quando a peça não é graduada', () => {
    // A vertical do canto (0, 300): no P, a aresta do outro lado só chega a y = 280.
    expect(() => alinharPique(comCantoGraduado(), 'p', 'ponto-vertical', { ponto: 3 })).toThrow('No tamanho P, a linha de alinhamento não cruza o contorno.');
    expect(() => alinharPique(comCantoGraduado(), 'p', 'elemento')).toThrow('Indique a linha interna que serve de referência.');
    expect(() => alinharPique(comCantoGraduado(), 'p', 'ponto-horizontal')).toThrow('Indique o ponto do contorno que serve de referência.');
    expect(() => alinharPique(comCantoGraduado(), 'x', 'vertical')).toThrow('Pique não encontrado na peça.');
    const semTamanhos = base(RETANGULO, { piques: [{ id: 'p', posicao: ponto(200, 150), indiceAresta: 1 }] });
    expect(() => alinharPique(semTamanhos, 'p', 'vertical')).toThrow('A peça “Frente” não tem graduação: o alinhamento é entre os tamanhos dela.');
  });

  it('alinhar de novo não muda nada, e o pique que já tinha referência continua com ela', () => {
    const uma = alinharPique(comCantoGraduado(), 'p', 'vertical');
    const duas = alinharPique(uma.molde, 'p', 'vertical');

    expect(duas.molde.piques[0]!.graduacao!.referencia).toEqual(uma.molde.piques[0]!.graduacao!.referencia);
    duas.perimetros.forEach((valor, t) => expect(valor).toBeCloseTo(uma.perimetros[t]!, 9));
    // O pique que já contava a distância do canto (200, 300) — e não do que seria sugerido, o (200, 0) — continua contando dele.
    const doOutroCanto = definirGraduacaoDoPique(comCantoGraduado(), 'p', 2, [0, 0, 0]);
    const alinhado = alinharPique(doOutroCanto, 'p', 'vertical');
    expect(alinhado.molde.piques[0]!.graduacao!.referencia).toEqual(ponto(200, 300));
    const [noP, , noG] = emCadaTamanho(alinhado.molde);
    expect(noP!.y).toBeCloseTo(150, 9);
    expect(noG!.y).toBeCloseTo(150, 9);
    // Desse canto, que sobe no G e desce no P, a distância muda bastante: no G ele está em (210, 320).
    expect(alinhado.perimetros[2]).toBeCloseTo(Math.hypot(210 - (200 + (10 * 150) / 320), 320 - 150) - 150, 9);
  });
});

import { describe, it, expect } from 'vitest';
import { ponto, type Ponto2D } from '../core/geometria';
import { alinharPique, alinharPiqueInterno } from './alinharPiques';
import { contornosDosTamanhos, definirRegra } from './graduacao';
import { desdobrarMolde } from './corteEUniao';
import { criarMolde, dimensionarMolde, espelharMolde, rotacionarMolde, transladarMolde, type Molde } from './molde';
import { definirGraduacaoDoPique, piquesNoTamanho } from './piquesGraduados';
import { giroEDeslocamento, levarOQueEstaNasRegioes } from './regioes';
import { definirTamanhosDoMolde, marcaNosTamanhos, moldeDoTamanho } from './tamanhosGraduados';

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

describe('alinhar o pique interno entre os tamanhos', () => {
  /**
   * P, M (base) e G, com a peça inteira crescendo na proporção: no G cada ponto vai a (1,1·x; 1,2·y), e no P a
   * (0,9·x; 0,8·y). O pique interno está em (100, 150): sem alinhar, fica em (90, 120) no P e em (110, 180) no G.
   */
  function proporcional(extra: Partial<Molde> = {}): Molde {
    const peca = definirTamanhosDoMolde(base(RETANGULO, { marcas: [{ id: 'i', posicao: ponto(100, 150) }], ...extra }), ['P', 'M', 'G'], 'M');
    let graduacao = peca.graduacao!;
    RETANGULO.forEach((q, n) => {
      graduacao = definirRegra(graduacao, RETANGULO, n, [ponto(0 - q.x * 0.1, 0 - q.y * 0.2), ZERO, ponto(q.x * 0.1, q.y * 0.2)]);
    });
    return { ...peca, graduacao };
  }
  const perto = (achados: readonly Ponto2D[], esperados: readonly Ponto2D[]): void => {
    expect(achados).toHaveLength(esperados.length);
    achados.forEach((q, i) => {
      expect(q.x).toBeCloseTo(esperados[i]!.x, 6);
      expect(q.y).toBeCloseTo(esperados[i]!.y, 6);
    });
  };

  it('sem alinhar, acompanha a peça na proporção', () => {
    perto(marcaNosTamanhos(proporcional(), 'i'), [ponto(90, 120), ponto(100, 150), ponto(110, 180)]);
  });

  it('horizontal: fica na linha horizontal da tela que passa por ele no base (o mesmo x do mundo), e só anda ao longo dela', () => {
    const feito = alinharPiqueInterno(proporcional(), 'i', 'horizontal');

    perto(marcaNosTamanhos(feito.molde, 'i'), [ponto(100, 120), ponto(100, 150), ponto(100, 180)]);
    perto(feito.deslocamentos, [ponto(0, -30), ZERO, ponto(0, 30)]);
    expect(feito.deslocamentos[1]).toEqual(ZERO);
    expect(feito.molde.marcas[0]!.alinhamento).toEqual({ deslocamentos: feito.deslocamentos });
  });

  it('vertical: o mesmo y do mundo; e alinhado nas duas, fica no mesmo lugar em todos os tamanhos', () => {
    const vertical = alinharPiqueInterno(proporcional(), 'i', 'vertical');
    perto(marcaNosTamanhos(vertical.molde, 'i'), [ponto(90, 150), ponto(100, 150), ponto(110, 150)]);

    // O segundo alinhamento parte de onde o pique está hoje em cada tamanho.
    const nasDuas = alinharPiqueInterno(vertical.molde, 'i', 'horizontal');
    perto(marcaNosTamanhos(nasDuas.molde, 'i'), [ponto(100, 150), ponto(100, 150), ponto(100, 150)]);
    expect(nasDuas.deslocamentos).toEqual([ZERO, ZERO, ZERO]);
  });

  it('elemento: em cada tamanho vai para o ponto da linha mais perto de onde estava — o do base também', () => {
    // A diagonal de (50, 100) a (150, 200) passa por (100, 150). Um pique fora dela, em (100, 130), vai no base para (90, 140).
    const naLinha = alinharPiqueInterno(proporcional({ linhasInternas: [[ponto(50, 100), ponto(150, 200)]] }), 'i', 'elemento', { linhaInterna: 0 });
    perto(marcaNosTamanhos(naLinha.molde, 'i'), [ponto(80, 130), ponto(100, 150), ponto(120, 170)]);

    const fora = alinharPiqueInterno(proporcional({ linhasInternas: [[ponto(50, 100), ponto(150, 200)]], marcas: [{ id: 'i', posicao: ponto(100, 130) }] }), 'i', 'elemento', { linhaInterna: 0 });
    expect(fora.molde.marcas[0]!.posicao.x).toBeCloseTo(90, 6);
    expect(fora.molde.marcas[0]!.posicao.y).toBeCloseTo(140, 6);
    // A linha de mais de um trecho: vale o trecho mais perto.
    const emL = alinharPiqueInterno(proporcional({ linhasInternas: [[ponto(20, 20), ponto(20, 150), ponto(180, 150)]] }), 'i', 'elemento', { linhaInterna: 0 });
    perto(marcaNosTamanhos(emL.molde, 'i'), [ponto(90, 150), ponto(100, 150), ponto(110, 150)]);
    // Perto do primeiro trecho (o que sobe em x = 20), é para ele que o pique vai.
    const noPrimeiro = alinharPiqueInterno(proporcional({ linhasInternas: [[ponto(20, 20), ponto(20, 150), ponto(180, 150)]], marcas: [{ id: 'i', posicao: ponto(30, 60) }] }), 'i', 'elemento', { linhaInterna: 0 });
    perto([noPrimeiro.molde.marcas[0]!.posicao], [ponto(20, 60)]);
  });

  it('ponto horizontal e ponto vertical: a linha de cada tamanho passa pelo ponto de controle nesse tamanho', () => {
    // O ponto 3 é o canto (200, 300): (180, 240) no P e (220, 360) no G.
    const horizontal = alinharPiqueInterno(proporcional(), 'i', 'ponto-horizontal', { ponto: 2 });
    perto(marcaNosTamanhos(horizontal.molde, 'i'), [ponto(180, 120), ponto(200, 150), ponto(220, 180)]);

    const vertical = alinharPiqueInterno(proporcional(), 'i', 'ponto-vertical', { ponto: 2 });
    perto(marcaNosTamanhos(vertical.molde, 'i'), [ponto(90, 240), ponto(100, 300), ponto(110, 360)]);
    perto(vertical.deslocamentos, [ponto(-10, -60), ZERO, ponto(10, 60)]);
  });

  it('recusa, sem mudar nada, o que não dá: fora da peça, sem alvo, sem graduação, sem o pique', () => {
    const peca = proporcional({ linhasInternas: [[ponto(250, 0), ponto(250, 300)], [ponto(10, 10)]] });

    expect(() => alinharPiqueInterno(peca, 'i', 'elemento', { linhaInterna: 0 })).toThrow('No tamanho P, o pique interno cairia fora da peça.');
    expect(() => alinharPiqueInterno(peca, 'i', 'elemento')).toThrow('Indique a linha interna que serve de referência.');
    expect(() => alinharPiqueInterno(peca, 'i', 'elemento', { linhaInterna: 1 })).toThrow('Indique a linha interna que serve de referência.');
    expect(() => alinharPiqueInterno(peca, 'i', 'ponto-vertical')).toThrow('Indique o ponto do contorno que serve de referência.');
    expect(() => alinharPiqueInterno(peca, 'i', 'ponto-vertical', { ponto: 9 })).toThrow('Indique o ponto do contorno que serve de referência.');
    expect(() => alinharPiqueInterno(peca, 'x', 'vertical')).toThrow('Pique interno não encontrado na peça.');
    expect(() => alinharPiqueInterno(base(RETANGULO, { marcas: [{ id: 'i', posicao: ponto(100, 150) }] }), 'i', 'vertical')).toThrow('A peça “Frente” não tem graduação: o alinhamento é entre os tamanhos dela.');
    // Em cima da borda ainda é dentro: a linha do ponto 3 passa pela borda de cada tamanho.
    expect(() => alinharPiqueInterno(peca, 'i', 'ponto-horizontal', { ponto: 2 })).not.toThrow();
  });

  it('a peça de um tamanho, solta da graduação, leva o pique para onde o alinhamento manda e fica sem o registro', () => {
    const alinhada = alinharPiqueInterno(proporcional(), 'i', 'horizontal').molde;
    const noG = moldeDoTamanho(alinhada, 2, 'g');

    perto([noG.marcas[0]!.posicao], [ponto(100, 180)]);
    expect('alinhamento' in noG.marcas[0]!).toBe(false);
    // A marca sem alinhamento continua igual ao soltar.
    perto([moldeDoTamanho(proporcional(), 2, 'g').marcas[0]!.posicao], [ponto(110, 180)]);
  });

  it('o registro que não tem um deslocamento por tamanho não vale: o pique volta à proporção', () => {
    const peca = proporcional({ marcas: [{ id: 'i', posicao: ponto(100, 150), alinhamento: { deslocamentos: [ZERO, ZERO] } }] });
    perto(marcaNosTamanhos(peca, 'i'), [ponto(90, 120), ponto(100, 150), ponto(110, 180)]);
    // E fica como está quando os tamanhos mudam.
    expect(definirTamanhosDoMolde(peca, ['P', 'M', 'G'], 'G').marcas[0]!.alinhamento).toEqual({ deslocamentos: [ZERO, ZERO] });
  });

  it('mudando os tamanhos, o que o pique anda passa a ser contado do base novo, nos tamanhos novos', () => {
    const alinhada = alinharPiqueInterno(proporcional(), 'i', 'horizontal').molde;

    // O G passa a ser o base: o pique vai para onde ficava no G, e os outros são contados dali.
    const comOG = definirTamanhosDoMolde(alinhada, ['P', 'M', 'G'], 'G');
    perto([comOG.marcas[0]!.posicao], [ponto(100, 180)]);
    perto(comOG.marcas[0]!.alinhamento!.deslocamentos, [ponto(0, -60), ponto(0, -30), ZERO]);
    perto(marcaNosTamanhos(comOG, 'i'), [ponto(100, 120), ponto(100, 150), ponto(100, 180)]);
    // Um tamanho novo entra igual ao base; um que sai leva o deslocamento dele.
    const comGG = definirTamanhosDoMolde(alinhada, ['M', 'G', 'GG'], 'M');
    perto(comGG.marcas[0]!.alinhamento!.deslocamentos, [ZERO, ponto(0, 30), ZERO]);
    // Tamanho novo e base novo de uma vez: o novo fica igual ao base de agora.
    const comOsDois = definirTamanhosDoMolde(alinhada, ['P', 'M', 'G', 'GG'], 'G');
    perto(comOsDois.marcas[0]!.alinhamento!.deslocamentos, [ponto(0, -60), ponto(0, -30), ZERO, ZERO]);
    // A marca sem alinhamento não ganha um.
    expect('alinhamento' in definirTamanhosDoMolde(proporcional(), ['P', 'M', 'G'], 'G').marcas[0]!).toBe(false);
  });

  it('girar, espelhar e dimensionar a peça levam junto o que o pique anda em cada tamanho; mover não muda', () => {
    const comRegistro = base(RETANGULO, { marcas: [{ id: 'i', posicao: ponto(100, 150), alinhamento: { deslocamentos: [ponto(-10, 0), ZERO, ponto(10, 5)] } }] });
    const doRegistro = (peca: Molde): readonly Ponto2D[] => peca.marcas[0]!.alinhamento!.deslocamentos;

    perto(doRegistro(rotacionarMolde(comRegistro, 90)), [ponto(0, -10), ZERO, ponto(-5, 10)]);
    perto(doRegistro(espelharMolde(comRegistro, 'm2')), [ponto(10, 0), ZERO, ponto(-10, 5)]);
    perto(doRegistro(dimensionarMolde(comRegistro, 2, 3)), [ponto(-20, 0), ZERO, ponto(20, 15)]);
    expect(doRegistro(transladarMolde(comRegistro, ponto(30, 40), 'm3'))).toEqual(doRegistro(comRegistro));
    // A marca sem alinhamento continua sem.
    expect('alinhamento' in rotacionarMolde(base(RETANGULO, { marcas: [{ id: 'i', posicao: ponto(100, 150) }] }), 90).marcas[0]!).toBe(false);
  });

  it('a parte da peça que gira (numa pence) e a cópia do desdobrar levam o registro girado e espelhado', () => {
    const comRegistro = base(RETANGULO, { marcas: [{ id: 'i', posicao: ponto(100, 250), alinhamento: { deslocamentos: [ponto(-10, 0), ZERO, ponto(10, 5)] } }, { id: 'j', posicao: ponto(100, 50), alinhamento: { deslocamentos: [ponto(1, 2)] } }] });

    // A metade de cima (y > 150) gira 90° em torno de (100, 150): a marca de cima vai junto; a de baixo fica.
    const girada = levarOQueEstaNasRegioes(comRegistro, [[ponto(0, 150), ponto(200, 150), ponto(200, 300), ponto(0, 300)]], [[ponto(200, 300), ponto(0, 300)]], [[ponto(0, 0), ponto(200, 0)]], giroEDeslocamento(ponto(100, 150), 90));
    perto(girada.marcas[0]!.alinhamento!.deslocamentos, [ponto(0, -10), ZERO, ponto(-5, 10)]);
    expect(girada.marcas[1]).toBe(comRegistro.marcas[1]);
    // Desdobrada pela aresta 0 (y = 0): a cópia tem o y do registro trocado de sinal.
    let n = 0;
    const inteira = desdobrarMolde(comRegistro, 0, () => 'n' + ++n);
    const copia = inteira.marcas.find((m) => Math.abs(m.posicao.y + 250) < 1e-9)!;
    perto(copia.alinhamento!.deslocamentos, [ponto(-10, 0), ZERO, ponto(10, -5)]);
  });
});

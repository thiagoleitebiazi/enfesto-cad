import { describe, it, expect } from 'vitest';
import { ponto } from '../core/geometria';
import { definirRegra, regraPorPasso } from './graduacao';
import { adicionarPique, criarMolde, moverPontoDoMolde, transladarMolde, type Molde } from './molde';
import {
  definirGraduacaoDoPique,
  direcaoDoContornoNoPique,
  distanciaAteAReferencia,
  graduarPiqueNoContorno,
  perimetrosDoPique,
  perimetrosNosTamanhosNovos,
  piquesNoTamanho,
  referenciaDoPique,
  referenciaSugerida,
  removerGraduacaoDoPique,
} from './piquesGraduados';
import { definirTamanhosDoMolde, moldeDoTamanho } from './tamanhosGraduados';

// Retângulo de 200 × 300 mm com um pique na aresta de baixo, a 50 mm do canto (0, 0).
const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];

/** P, M (base) e G; o canto (200, 0) anda 20 mm por tamanho: a aresta de baixo mede 180, 200 e 220. */
function peca(): Molde {
  const base = criarMolde({ nome: 'Frente', referencia: 'REF', tamanho: 'M', contorno: RETANGULO, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) } }, 'm1');
  const comPique = adicionarPique(base, ponto(50, 0), 'pique');
  const graduada = definirTamanhosDoMolde(comPique, ['P', 'M', 'G'], 'M');
  return { ...graduada, graduacao: definirRegra(graduada.graduacao!, graduada.contorno, 1, regraPorPasso(graduada.graduacao!, ponto(20, 0))) };
}

const oPique = (molde: Molde) => molde.piques[0]!;
/** Onde o pique fica no tamanho `t`, sem o ruído das contas (centésimos de milésimo de milímetro). */
const noTamanho = (molde: Molde, t: number) => {
  const p = oPique(moldeDoTamanho(molde, t, 'solta')).posicao;
  const limpo = (valor: number): number => (Math.round(valor * 1e6) / 1e6 === 0 ? 0 : Math.round(valor * 1e6) / 1e6);
  return ponto(limpo(p.x), limpo(p.y));
};

describe('pique sem graduação', () => {
  it('fica na mesma proporção da aresta em cada tamanho', () => {
    expect(noTamanho(peca(), 2)).toEqual(ponto(55, 0));
    expect(noTamanho(peca(), 0)).toEqual(ponto(45, 0));
    expect(referenciaDoPique(peca(), oPique(peca()))).toBeNull();
    expect(perimetrosDoPique(peca(), oPique(peca()))).toEqual([0, 0, 0]);
  });

  it('a referência sugerida é o ponto graduado mais perto dele, sobre o contorno', () => {
    expect(referenciaSugerida(peca(), oPique(peca()))).toBe(0);
    expect(distanciaAteAReferencia(peca(), oPique(peca()), 0)).toBeCloseTo(50, 9);
    expect(distanciaAteAReferencia(peca(), oPique(peca()), 1)).toBeCloseTo(150, 9);
    const perto = adicionarPique(peca(), ponto(180, 0), 'outro');
    expect(referenciaSugerida(perto, perto.piques[1]!)).toBe(1);
  });
});

describe('a referência sugerida é um ponto graduado', () => {
  // Um ponto a mais na aresta de baixo, em (40, 0): está em linha com os cantos, não é canto e não entra como graduado.
  const COM_PONTO = [ponto(0, 0), ponto(40, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
  const base = (): Molde => adicionarPique(criarMolde({ nome: 'F', referencia: 'R', tamanho: 'M', contorno: COM_PONTO, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) } }, 'x'), ponto(50, 0), 'pique');

  it('o ponto mais perto do pique que não é graduado não serve de referência: vale o graduado mais perto', () => {
    const graduada = definirTamanhosDoMolde(base(), ['P', 'M', 'G'], 'M');
    // O ponto (40, 0) está a 10 mm do pique; o graduado mais perto é o canto (0, 0), a 50.
    expect(referenciaSugerida(graduada, oPique(graduada))).toBe(0);
  });

  it('na peça sem ponto graduado nenhum, vale o ponto do contorno mais perto', () => {
    expect(referenciaSugerida(base(), oPique(base()))).toBe(1);
  });
});

describe('pique graduado', () => {
  it('com perímetro zero, fica à mesma distância da referência em todos os tamanhos', () => {
    const graduado = definirGraduacaoDoPique(peca(), 'pique', 0, [0, 0, 0]);

    expect(referenciaDoPique(graduado, oPique(graduado))).toBe(0);
    expect(noTamanho(graduado, 2)).toEqual(ponto(50, 0));
    expect(noTamanho(graduado, 0)).toEqual(ponto(50, 0));
  });

  it('o perímetro de cada tamanho soma à distância que o pique tem no base', () => {
    const graduado = definirGraduacaoDoPique(peca(), 'pique', 0, [-5, 0, 10]);

    expect(noTamanho(graduado, 2)).toEqual(ponto(60, 0));
    expect(noTamanho(graduado, 0)).toEqual(ponto(45, 0));
    expect(perimetrosDoPique(graduado, oPique(graduado))).toEqual([-5, 0, 10]);
  });

  it('com a referência do outro lado, a distância é contada de lá, para trás na numeração', () => {
    // Do ponto 2, (200, 0), o pique está a 150 mm. No G esse ponto vai para (220, 0): a 150 mm dele é (70, 0); com +10, (60, 0).
    const semMudar = definirGraduacaoDoPique(peca(), 'pique', 1, [0, 0, 0]);
    expect(noTamanho(semMudar, 2)).toEqual(ponto(70, 0));
    const mais = definirGraduacaoDoPique(peca(), 'pique', 1, [0, 0, 10]);
    expect(noTamanho(mais, 2)).toEqual(ponto(60, 0));
  });

  it('o valor do base é sempre zero, e a peça solta de um tamanho não leva a tabela', () => {
    const graduado = definirGraduacaoDoPique(peca(), 'pique', 0, [-5, 99, 10]);

    expect(oPique(graduado).graduacao!.perimetros).toEqual([-5, 0, 10]);
    expect('graduacao' in oPique(moldeDoTamanho(graduado, 2, 'solta'))).toBe(false);
  });

  it('piquesNoTamanho leva a referência para o ponto dela nesse tamanho', () => {
    const graduado = definirGraduacaoDoPique(peca(), 'pique', 1, [0, 0, 10]);
    const contornoG = [ponto(0, 0), ponto(220, 0), ponto(200, 300), ponto(0, 300)];

    expect(piquesNoTamanho(graduado, contornoG, 2)[0]!.graduacao!.referencia).toEqual(ponto(220, 0));
    expect(piquesNoTamanho(graduado, contornoG, 2)[0]!.indiceAresta).toBe(0);
  });

  it('tirada a graduação, o pique volta a andar na proporção', () => {
    const sem = removerGraduacaoDoPique(definirGraduacaoDoPique(peca(), 'pique', 0, [-5, 0, 10]), 'pique');

    expect('graduacao' in oPique(sem)).toBe(false);
    expect(noTamanho(sem, 2)).toEqual(ponto(55, 0));
  });

  it('recusa o que não serve', () => {
    const semTamanhos = adicionarPique(criarMolde({ nome: 'F', referencia: 'R', tamanho: 'M', contorno: RETANGULO, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) } }, 'x'), ponto(50, 0), 'pique');
    expect(() => definirGraduacaoDoPique(semTamanhos, 'pique', 0, [0])).toThrow('não tem graduação');
    expect(() => definirGraduacaoDoPique(peca(), 'outro', 0, [0, 0, 0])).toThrow('Pique não encontrado');
    expect(() => definirGraduacaoDoPique(peca(), 'pique', 9, [0, 0, 0])).toThrow('de 1 a 4');
    expect(() => definirGraduacaoDoPique(peca(), 'pique', 0.5, [0, 0, 0])).toThrow('de 1 a 4');
    expect(() => definirGraduacaoDoPique(peca(), 'pique', 0, [0, 0])).toThrow('para cada tamanho');
    expect(() => definirGraduacaoDoPique(peca(), 'pique', 0, [Number.NaN, 0, 0])).toThrow('precisam ser números');
  });
});

describe('o pique que anda sobre o contorno (“Automático” e “Tangente”)', () => {
  // Cinco tamanhos, sem ponto graduado: a referência sugerida é o canto (0, 0), 50 mm atrás do pique.
  const emCinco = (): Molde => {
    const base = criarMolde({ nome: 'Frente', referencia: 'REF', tamanho: 'M', contorno: RETANGULO, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) } }, 'm1');
    return definirTamanhosDoMolde(adicionarPique(base, ponto(50, 0), 'pique'), ['PP', 'P', 'M', 'G', 'GG'], 'M');
  };
  const perimetros = (molde: Molde) => perimetrosDoPique(molde, oPique(molde));

  it('a direção do contorno no pique é a da aresta em que ele está, no sentido da numeração', () => {
    expect(direcaoDoContornoNoPique(peca(), oPique(peca()))).toEqual(ponto(1, 0));
  });

  it('em todos os tamanhos, cada um anda o passo a mais que o vizinho; negativo, anda para o outro lado', () => {
    const nova = graduarPiqueNoContorno(emCinco(), 'pique', 10, null);

    expect(referenciaDoPique(nova, oPique(nova))).toBe(0);
    expect(perimetros(nova)).toEqual([-20, -10, 0, 10, 20]);
    expect(oPique(moldeDoTamanho(nova, 4, 'solta')).posicao.x).toBeCloseTo(70, 6);
    expect(oPique(moldeDoTamanho(nova, 0, 'solta')).posicao.x).toBeCloseTo(30, 6);
    expect(perimetros(graduarPiqueNoContorno(emCinco(), 'pique', -10, null))).toEqual([20, 10, 0, -10, -20]);
  });

  it('a partir do base (sem o incremental), todos os tamanhos de cada lado andam o mesmo', () => {
    expect(perimetros(graduarPiqueNoContorno(emCinco(), 'pique', 10, null, false))).toEqual([-10, -10, 0, 10, 10]);
  });

  it('num tamanho só, só ele muda: o passo a mais que o vizinho do lado do base, ou o passo a partir do base', () => {
    const noGG = graduarPiqueNoContorno(emCinco(), 'pique', 10, 4);
    expect(perimetros(noGG)).toEqual([0, 0, 0, 0, 10]);
    // Com o G já andando 10, o GG incremental fica 10 depois dele.
    const noG = graduarPiqueNoContorno(noGG, 'pique', 10, 3);
    expect(perimetros(noG)).toEqual([0, 0, 0, 10, 10]);
    expect(perimetros(graduarPiqueNoContorno(noG, 'pique', 10, 4))).toEqual([0, 0, 0, 10, 20]);
    // Abaixo do base anda ao contrário; sem o incremental, conta do base.
    expect(perimetros(graduarPiqueNoContorno(noG, 'pique', 10, 0))).toEqual([-10, 0, 0, 10, 10]);
    expect(perimetros(graduarPiqueNoContorno(noG, 'pique', 4, 4, false))).toEqual([0, 0, 0, 10, 4]);
  });

  it('com a referência adiante do pique, andar no sentido da numeração diminui a distância até ela', () => {
    // Um pique a 20 mm do canto (200, 0), que anda 20 mm por tamanho: a referência sugerida é esse canto, adiante dele.
    const comOutro = adicionarPique(peca(), ponto(180, 0), 'perto-do-canto');
    const nova = graduarPiqueNoContorno(comOutro, 'perto-do-canto', 10, null);
    const oOutro = (molde: Molde) => molde.piques.find((q) => q.id === 'perto-do-canto')!;

    expect(referenciaDoPique(nova, oOutro(nova))).toBe(1);
    expect(perimetrosDoPique(nova, oOutro(nova))).toEqual([10, 0, -10]);
    // No G o canto está em x = 220, e o pique, 10 mm antes dele; no P, em 180, e o pique 30 mm antes.
    expect(oOutro(moldeDoTamanho(nova, 2, 'solta')).posicao.x).toBeCloseTo(210, 6);
    expect(oOutro(moldeDoTamanho(nova, 0, 'solta')).posicao.x).toBeCloseTo(150, 6);
    // O outro pique, perto do canto (0, 0), tem a referência atrás: andar para a frente aumenta a distância.
    const doPrimeiro = graduarPiqueNoContorno(peca(), 'pique', 10, null);
    expect(referenciaDoPique(doPrimeiro, oPique(doPrimeiro))).toBe(0);
    expect(perimetros(doPrimeiro)).toEqual([-10, 0, 10]);
    expect(noTamanho(doPrimeiro, 2)).toEqual(ponto(60, 0));
  });

  it('o pique que já tem graduação continua com a referência dele', () => {
    // A referência dele é o canto (200, 0), que não é o ponto graduado mais perto: o pique está 150 mm antes dela.
    const comTabela = definirGraduacaoDoPique(peca(), 'pique', 1, [-3, 0, 3]);
    const nova = graduarPiqueNoContorno(comTabela, 'pique', 10, 2);

    expect(referenciaDoPique(nova, oPique(nova))).toBe(1);
    // Andar 10 mm para a frente, no G, diminui em 10 a distância até a referência; o P fica como estava.
    expect(perimetros(nova)).toEqual([-3, 0, -10]);
  });

  it('recusa o que não serve', () => {
    expect(() => graduarPiqueNoContorno(emCinco(), 'pique', 10, 2)).toThrow(/tamanho base/);
    expect(() => graduarPiqueNoContorno(emCinco(), 'pique', 10, 9)).toThrow(/Tamanho fora da graduação/);
    expect(() => graduarPiqueNoContorno(emCinco(), 'pique', Number.NaN, null)).toThrow(/precisa ser um número/);
    expect(() => graduarPiqueNoContorno(emCinco(), 'outro', 10, null)).toThrow(/Pique não encontrado/);
    const semTamanhos = criarMolde({ nome: 'Frente', referencia: 'REF', tamanho: 'M', contorno: RETANGULO, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) } }, 'm1');
    expect(() => graduarPiqueNoContorno(adicionarPique(semTamanhos, ponto(50, 0), 'pique'), 'pique', 10, null)).toThrow(/não tem graduação/);
  });
});

describe('a graduação do pique acompanha a peça', () => {
  const graduado = (): Molde => definirGraduacaoDoPique(peca(), 'pique', 1, [-5, 0, 10]);

  it('a referência vai com a peça movida, e com o ponto do contorno quando ele muda de lugar', () => {
    const levada = transladarMolde(graduado(), ponto(10, 20), 'outra');
    expect(oPique(levada).graduacao!.referencia).toEqual(ponto(210, 20));
    expect(referenciaDoPique(levada, oPique(levada))).toBe(1);

    const comPontoMovido = moverPontoDoMolde(graduado(), 1, ponto(210, -10));
    expect(oPique(comPontoMovido).graduacao!.referencia).toEqual(ponto(210, -10));
    expect(referenciaDoPique(comPontoMovido, oPique(comPontoMovido))).toBe(1);
  });

  it('se a referência deixa de ser um ponto do contorno, a tabela é ignorada, sem erro', () => {
    const semOPonto = { ...graduado(), piques: graduado().piques.map((q) => ({ ...q, graduacao: { ...q.graduacao!, referencia: ponto(150, 0) } })) };

    expect(referenciaDoPique(semOPonto, oPique(semOPonto))).toBeNull();
    expect(noTamanho(semOPonto, 2)).toEqual(ponto(55, 0));
  });

  it('com um tamanho a mais, ele entra igual ao base; trocado o base, os valores passam a contar dele', () => {
    const comGG = definirTamanhosDoMolde(graduado(), ['P', 'M', 'G', 'GG'], 'M');
    expect(oPique(comGG).graduacao!.perimetros).toEqual([-5, 0, 10, 0]);

    const baseG = definirTamanhosDoMolde(graduado(), ['P', 'M', 'G'], 'G');
    // No G, o pique está a 150 + 10 mm do ponto (220, 0): em (60, 0).
    expect(oPique(baseG).posicao).toEqual(ponto(60, 0));
    expect(oPique(baseG).graduacao!.perimetros).toEqual([-15, -10, 0]);
    expect(oPique(baseG).graduacao!.referencia).toEqual(ponto(220, 0));
    // E o M, visto do G, é o de antes.
    expect(noTamanho(baseG, 1)).toEqual(ponto(50, 0));
  });

  it('perimetrosNosTamanhosNovos: os que continuam ficam, contados do base novo; o novo entra igual ao base', () => {
    expect(perimetrosNosTamanhosNovos([-5, 0, 10], [0, 1, 2], 1)).toEqual([-5, 0, 10]);
    expect(perimetrosNosTamanhosNovos([-5, 0, 10], [0, 1, 2], 2)).toEqual([-15, -10, 0]);
    expect(perimetrosNosTamanhosNovos([-5, 0, 10], [1, 2, -1], 1)).toEqual([0, 10, 0]);
  });
});

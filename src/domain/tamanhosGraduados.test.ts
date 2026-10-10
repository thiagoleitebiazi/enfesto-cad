import { describe, it, expect } from 'vitest';
import { area, distancia, ponto, retanguloEnvolvente, type Ponto2D } from '../core/geometria';
import { desdobrarMolde } from './corteEUniao';
import { contornoDoTamanho, definirRegra, pontoGraduadoEm, verticesGraduados, type Graduacao } from './graduacao';
import {
  adicionarPique,
  criarMolde,
  dimensionarMolde,
  espelharMolde,
  inserirPontoNoMolde,
  moverPontoDoMolde,
  rotacionarMolde,
  semGraduacao,
  transladarMolde,
  type DadosDeNovoMolde,
  type Molde,
} from './molde';
import { criarPregas } from './pregas';
import { definirTamanhosDoMolde, expandirTamanhos, moldeDoTamanho, separarTamanhos, unirTamanhos } from './tamanhosGraduados';

// Retângulo de 200 × 300 mm. Tamanhos P, M e G, com o M de base.
const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
const ZERO = ponto(0, 0);
const G = 2;
const regra = (dx: number, dy: number): Ponto2D[] => [ponto(0 - dx, 0 - dy), ZERO, ponto(dx, dy)];

function molde(sobrescrever: Partial<DadosDeNovoMolde> = {}, id = 'm1'): Molde {
  return criarMolde(
    {
      nome: 'Frente',
      referencia: 'REF-001',
      tamanho: 'M',
      contorno: RETANGULO,
      linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) },
      ...sobrescrever,
    },
    id,
  );
}

/** A peça graduada em P, M e G, com o canto (200, 300) andando (10, 20) por tamanho. */
function graduada(): Molde {
  const comTamanhos = definirTamanhosDoMolde(molde(), ['P', 'M', 'G'], 'M');
  return { ...comTamanhos, graduacao: definirRegra(comTamanhos.graduacao!, RETANGULO, 2, regra(10, 20)) };
}

function ids(): () => string {
  let n = 0;
  return () => `novo-${++n}`;
}

function esperarPontos(obtido: readonly Ponto2D[], esperado: readonly Ponto2D[], casas = 6): void {
  expect(obtido).toHaveLength(esperado.length);
  obtido.forEach((p, i) => {
    expect(p.x).toBeCloseTo(esperado[i]!.x, casas);
    expect(p.y).toBeCloseTo(esperado[i]!.y, casas);
  });
}

const doG = (m: Molde): Ponto2D[] => contornoDoTamanho(m.graduacao!, m.contorno, m.graduacao!.tamanhos.indexOf('G'));

describe('definirTamanhosDoMolde', () => {
  it('na peça sem graduação: os cantos entram como pontos graduados e o tamanho da peça passa a ser o base', () => {
    const comTamanhos = definirTamanhosDoMolde(molde({ tamanho: '' }), ['P', 'M', 'G'], 'm');
    expect(comTamanhos.tamanho).toBe('M');
    expect(comTamanhos.graduacao).toMatchObject({ tamanhos: ['P', 'M', 'G'], base: 1 });
    expect(verticesGraduados(comTamanhos.graduacao!, comTamanhos.contorno)).toEqual([0, 1, 2, 3]);
    expect(comTamanhos.contorno).toEqual(RETANGULO);
  });

  it('recusa o base que não está na lista', () => {
    expect(() => definirTamanhosDoMolde(molde(), ['P', 'M', 'G'], 'GG')).toThrow(/tamanho base/);
  });

  it('acrescentando tamanhos, as regras dos que já existiam ficam, e os novos entram iguais ao base', () => {
    const maior = definirTamanhosDoMolde(graduada(), ['PP', 'P', 'M', 'G', 'GG'], 'M');
    expect(maior.graduacao!.base).toBe(2);
    expect(pontoGraduadoEm(maior.graduacao!, maior.contorno, 2)!.deslocamentos).toEqual([ZERO, ponto(-10, -20), ZERO, ponto(10, 20), ZERO]);
    expect(maior.contorno).toEqual(RETANGULO);
  });

  it('tirando um tamanho, a regra dele sai', () => {
    const menor = definirTamanhosDoMolde(graduada(), ['M', 'G'], 'M');
    expect(menor.graduacao).toMatchObject({ tamanhos: ['M', 'G'], base: 0 });
    expect(pontoGraduadoEm(menor.graduacao!, menor.contorno, 2)!.deslocamentos).toEqual([ZERO, ponto(10, 20)]);
  });

  it('trocando o base, o contorno desenhado passa a ser o desse tamanho, e as regras contam a partir dele', () => {
    const baseNoG = definirTamanhosDoMolde(graduada(), ['P', 'M', 'G'], 'G');
    expect(baseNoG.tamanho).toBe('G');
    expect(baseNoG.graduacao!.base).toBe(2);
    expect(baseNoG.contorno).toEqual([ponto(0, 0), ponto(200, 0), ponto(210, 320), ponto(0, 300)]);
    expect(pontoGraduadoEm(baseNoG.graduacao!, baseNoG.contorno, 2)!.deslocamentos).toEqual([ponto(-20, -40), ponto(-10, -20), ZERO]);
    // O tamanho M continua sendo o retângulo de antes.
    esperarPontos(contornoDoTamanho(baseNoG.graduacao!, baseNoG.contorno, 1), RETANGULO);
  });

  it('trocando o base, o que está dentro da peça passa a ter a forma desse tamanho também', () => {
    const comMarca = { ...graduada(), marcas: [{ id: 'botao', posicao: ponto(200, 300) }, { id: 'centro', posicao: ponto(0, 0) }] };
    const baseNoG = definirTamanhosDoMolde(comMarca, ['P', 'M', 'G'], 'G');
    // A marca em cima do canto graduado vai com ele; a do canto parado fica.
    esperarPontos([baseNoG.marcas[0]!.posicao, baseNoG.marcas[1]!.posicao], [ponto(210, 320), ponto(0, 0)]);
  });

  it('trocando o base, os piques acompanham as arestas', () => {
    const comPique = adicionarPique(graduada(), ponto(200, 150), 'lateral');
    const baseNoG = definirTamanhosDoMolde(comPique, ['P', 'M', 'G'], 'G');
    // A lateral vai de (200, 0) a (210, 320): o pique continua no meio dela.
    esperarPontos([baseNoG.piques[0]!.posicao], [ponto(205, 160)]);
  });
});

describe('moldeDoTamanho', () => {
  it('é uma peça comum, com o contorno e o nome do tamanho, sem graduação', () => {
    const solta = moldeDoTamanho(graduada(), G, 'm-g');
    expect(solta.id).toBe('m-g');
    expect(solta.tamanho).toBe('G');
    expect(solta.nome).toBe('Frente');
    expect(solta.contorno).toEqual([ponto(0, 0), ponto(200, 0), ponto(210, 320), ponto(0, 300)]);
    expect('graduacao' in solta).toBe(false);
    // Quadrilátero (0,0), (200,0), (210,320), (0,300).
    expect(area(solta.contorno)).toBeCloseTo(63500, 6);
  });

  it('os piques ficam na mesma proporção da aresta', () => {
    const original = adicionarPique(graduada(), ponto(200, 150), 'lateral');
    const solta = moldeDoTamanho(original, G, 'm-g');
    esperarPontos([solta.piques[0]!.posicao], [ponto(205, 160)]);
  });

  it('a linha de fio anda inteira, sem mudar de direção nem de comprimento', () => {
    const original = graduada();
    const { inicio, fim } = moldeDoTamanho(original, G, 'm-g').linhaDeFio;
    // O meio do fio, (50, 150), está a um quarto da largura e a meia altura: anda 1/8 do que anda o canto.
    esperarPontos([inicio, fim], [ponto(51.25, 52.5), ponto(51.25, 252.5)]);
  });

  it('o que está dentro acompanha na proporção: um furo, uma linha interna e uma marca', () => {
    // A peça inteira cresce 10% em x e 20% em y a partir de (0, 0): cada canto anda (0,1·x; 0,2·y) no G.
    const comTamanhos = definirTamanhosDoMolde(
      molde({ furos: [[ponto(50, 50), ponto(100, 50), ponto(100, 100)]], linhasInternas: [[ponto(20, 150), ponto(180, 150)]] }),
      ['M', 'G'],
      'M',
    );
    let g = comTamanhos.graduacao!;
    RETANGULO.forEach((p, i) => {
      g = definirRegra(g, RETANGULO, i, [ZERO, ponto(p.x * 0.1, p.y * 0.2)]);
    });
    const comMarca = { ...comTamanhos, graduacao: g, marcas: [{ id: 'botao', posicao: ponto(150, 250) }] };
    const solta = moldeDoTamanho(comMarca, 1, 'm-g');
    esperarPontos(solta.contorno, [ponto(0, 0), ponto(220, 0), ponto(220, 360), ponto(0, 360)]);
    esperarPontos(solta.furos[0]!, [ponto(55, 60), ponto(110, 60), ponto(110, 120)]);
    esperarPontos(solta.linhasInternas[0]!, [ponto(22, 180), ponto(198, 180)]);
    esperarPontos([solta.marcas[0]!.posicao], [ponto(165, 300)]);
    // O furo cresceu na mesma proporção da peça: 1,1 × 1,2.
    expect(area(solta.furos[0]!)).toBeCloseTo(1250 * 1.32, 6);
  });

  it('se o tamanho só muda a peça de lugar, tudo vai junto, sem deformar', () => {
    const comTamanhos = definirTamanhosDoMolde(molde({ furos: [[ponto(50, 50), ponto(100, 50), ponto(100, 100)]] }), ['M', 'G'], 'M');
    let g = comTamanhos.graduacao!;
    RETANGULO.forEach((_, i) => {
      g = definirRegra(g, RETANGULO, i, [ZERO, ponto(7, -3)]);
    });
    const solta = moldeDoTamanho({ ...comTamanhos, graduacao: g }, 1, 'm-g');
    esperarPontos(solta.furos[0]!, [ponto(57, 47), ponto(107, 47), ponto(107, 97)]);
    esperarPontos([solta.linhaDeFio.inicio, solta.linhaDeFio.fim], [ponto(57, 47), ponto(57, 247)]);
  });

  it('recusa a peça sem graduação e o tamanho que ficaria sem área', () => {
    expect(() => moldeDoTamanho(molde(), 0, 'x')).toThrow(/não tem graduação/);
    // Todos os pontos indo para o mesmo lugar no P.
    const base = definirTamanhosDoMolde(molde(), ['P', 'M'], 'M');
    let g: Graduacao = base.graduacao!;
    RETANGULO.forEach((p, i) => {
      g = definirRegra(g, RETANGULO, i, [ponto(0 - p.x, 0 - p.y), ZERO]);
    });
    expect(() => moldeDoTamanho({ ...base, graduacao: g }, 0, 'x')).toThrow(/ficaria sem área/);
  });
});

describe('expandirTamanhos', () => {
  it('cada peça graduada vira uma peça comum por tamanho; a do base continua sendo ela', () => {
    const comum = molde({ nome: 'Bolso' }, 'b');
    const expandidas = expandirTamanhos([graduada(), comum], ids());
    expect(expandidas.map((p) => [p.id, p.nome, p.tamanho])).toEqual([
      ['novo-1', 'Frente', 'P'],
      ['m1', 'Frente', 'M'],
      ['novo-2', 'Frente', 'G'],
      ['b', 'Bolso', 'M'],
    ]);
    expect(expandidas.every((p) => !('graduacao' in p))).toBe(true);
    expect(expandidas[3]).toBe(comum);
    expect(area(expandidas[2]!.contorno)).toBeCloseTo(63500, 6);
    expect(expandidas[1]!.contorno).toEqual(RETANGULO);
  });

  it('sem peças graduadas, devolve as mesmas peças', () => {
    const pecas = [molde(), molde({ nome: 'Bolso' }, 'b')];
    expect(expandirTamanhos(pecas, ids())).toEqual(pecas);
  });
});

describe('separarTamanhos: depois das outras peças', () => {
  it('a fila começa depois do ponto dado, quando ele fica além da peça graduada', () => {
    const [solta] = separarTamanhos(graduada(), [2], ids(), 900);
    expect(retanguloEnvolvente(solta!.contorno).minY).toBeCloseTo(920, 6);
    // Um ponto aquém da peça graduada não conta: a fila começa depois dela.
    const [aoLado] = separarTamanhos(graduada(), [2], ids(), 100);
    expect(retanguloEnvolvente(aoLado!.contorno).minY).toBeCloseTo(320, 6);
  });
});

describe('separarTamanhos: alinhamento', () => {
  it('o tamanho que cresce para o lado de x menor não passa da borda da peça graduada', () => {
    // O canto (0, 0) anda (−30, 0) no G: sem alinhar, a peça do G começaria em x = −30.
    const comTamanhos = definirTamanhosDoMolde(molde(), ['M', 'G'], 'M');
    const graduadaParaCima = { ...comTamanhos, graduacao: definirRegra(comTamanhos.graduacao!, RETANGULO, 0, [ZERO, ponto(-30, 0)]) };
    const [solta] = separarTamanhos(graduadaParaCima, [1], ids());
    expect(retanguloEnvolvente(solta!.contorno).minX).toBeCloseTo(0, 6);
    expect(retanguloEnvolvente(solta!.contorno).maxX).toBeCloseTo(230, 6);
  });
});

describe('separarTamanhos', () => {
  it('cria uma peça por tamanho pedido, em fila ao lado da peça graduada', () => {
    const original = graduada();
    const soltas = separarTamanhos(original, [0, 2], ids());
    expect(soltas.map((p) => [p.id, p.tamanho])).toEqual([
      ['novo-1', 'P'],
      ['novo-2', 'G'],
    ]);
    // A graduada vai até y = 300: a primeira começa em 320, e a segunda 20 mm depois do fim da primeira.
    const caixaP = retanguloEnvolvente(soltas[0]!.contorno);
    const caixaG = retanguloEnvolvente(soltas[1]!.contorno);
    expect(caixaP.minY).toBeCloseTo(320, 6);
    expect(caixaG.minY).toBeCloseTo(caixaP.maxY + 20, 6);
    // E ficam alinhadas com ela pela outra borda.
    expect(caixaP.minX).toBeCloseTo(0, 6);
    expect(caixaG.minX).toBeCloseTo(0, 6);
    // As formas são as dos tamanhos: o P tem o canto em (190, 280).
    expect(area(soltas[0]!.contorno)).toBeCloseTo(area(contornoDoTamanho(original.graduacao!, RETANGULO, 0)), 6);
    expect(area(soltas[1]!.contorno)).toBeCloseTo(63500, 6);
  });

  it('pede pelo menos um tamanho', () => {
    expect(() => separarTamanhos(graduada(), [], ids())).toThrow(/pelo menos um tamanho/);
  });
});

describe('unirTamanhos', () => {
  // Três retângulos em lugares diferentes da mesa: 180 × 280 (P), 200 × 300 (M) e 220 × 320 (G).
  const retangulo = (x0: number, y0: number, largura: number, altura: number): Ponto2D[] => [
    ponto(x0, y0),
    ponto(x0 + largura, y0),
    ponto(x0 + largura, y0 + altura),
    ponto(x0, y0 + altura),
  ];
  // A linha de fio de cada um começa no meio da largura, a 50 mm da base.
  const peca = (id: string, tamanho: string, x0: number, y0: number, largura: number, altura: number): Molde =>
    molde(
      {
        tamanho,
        contorno: retangulo(x0, y0, largura, altura),
        linhaDeFio: { inicio: ponto(x0 + largura / 2, y0 + 50), fim: ponto(x0 + largura / 2, y0 + altura - 50) },
      },
      id,
    );
  const m = (): Molde => peca('m', 'M', 0, 0, 200, 300);
  const p = (): Molde => peca('p', 'P', 500, 40, 180, 280);
  const g = (): Molde => peca('g', 'G', 900, -30, 220, 320);

  it('a base vira a peça graduada, com os tamanhos em ordem de área', () => {
    const unida = unirTamanhos(m(), [g(), p()]);
    expect(unida.id).toBe('m');
    expect(unida.contorno).toEqual(m().contorno);
    expect(unida.graduacao).toMatchObject({ tamanhos: ['P', 'M', 'G'], base: 1 });
    expect(verticesGraduados(unida.graduacao!, unida.contorno)).toEqual([0, 1, 2, 3]);
  });

  it('os deslocamentos são medidos com o início das linhas de fio no mesmo lugar', () => {
    const unida = unirTamanhos(m(), [g(), p()]);
    // Do início do fio: o M tem os cantos a ±100 e a −50 / +250; o G, a ±110 e a −50 / +270.
    expect(pontoGraduadoEm(unida.graduacao!, unida.contorno, 0)!.deslocamentos).toEqual([ponto(10, 0), ZERO, ponto(-10, 0)]);
    expect(pontoGraduadoEm(unida.graduacao!, unida.contorno, 2)!.deslocamentos).toEqual([ponto(-10, -20), ZERO, ponto(10, 20)]);
  });

  it('separando de novo, cada tamanho tem a forma da peça que entrou', () => {
    const unida = unirTamanhos(m(), [g(), p()]);
    const [soltaP, soltaG] = separarTamanhos(unida, [0, 2], ids());
    const lados = (c: readonly Ponto2D[]): number[] => c.map((q, i) => distancia(q, c[(i + 1) % c.length]!));
    expect(lados(soltaP!.contorno)).toEqual([180, 280, 180, 280]);
    expect(lados(soltaG!.contorno)).toEqual([220, 320, 220, 320]);
  });

  it('recusa sem outras peças, peça sem tamanho, tamanho repetido e número de pontos diferente', () => {
    expect(() => unirTamanhos(m(), [])).toThrow(/Marque na lista/);
    expect(() => unirTamanhos(m(), [peca('x', ' ', 500, 0, 220, 320)])).toThrow(/Dê um tamanho/);
    expect(() => unirTamanhos(m(), [peca('x', 'm', 500, 0, 220, 320)])).toThrow(/mais de uma peça com o tamanho/);
    const triangulo = molde({ tamanho: 'G', contorno: [ponto(500, 0), ponto(700, 0), ponto(600, 300)] }, 't');
    expect(() => unirTamanhos(m(), [triangulo])).toThrow(/tem 3 pontos no contorno e “Frente” \(M\) tem 4/);
  });
});

describe('a graduação acompanha as edições da peça', () => {
  it('mover a peça leva os pontos graduados; os tamanhos vão junto', () => {
    const movida = transladarMolde(graduada(), ponto(30, 40), 'm1');
    expect(verticesGraduados(movida.graduacao!, movida.contorno)).toEqual([0, 1, 2, 3]);
    expect(doG(movida)).toEqual([ponto(30, 40), ponto(230, 40), ponto(240, 360), ponto(30, 340)]);
  });

  it('girar a peça gira também as regras', () => {
    const girada = rotacionarMolde(graduada(), 90);
    expect(verticesGraduados(girada.graduacao!, girada.contorno)).toEqual([0, 1, 2, 3]);
    // (10, 20) girado 90° no sentido anti-horário é (−20, 10).
    esperarPontos([pontoGraduadoEm(girada.graduacao!, girada.contorno, 2)!.deslocamentos[G]!], [ponto(-20, 10)]);
    expect(area(doG(girada))).toBeCloseTo(63500, 6);
  });

  it('espelhar e dimensionar também', () => {
    const espelhada = espelharMolde(graduada(), 'm1');
    expect(pontoGraduadoEm(espelhada.graduacao!, espelhada.contorno, 2)!.deslocamentos[G]).toEqual(ponto(-10, 20));
    expect(area(doG(espelhada))).toBeCloseTo(63500, 6);
    const dobrada = dimensionarMolde(graduada(), 2, 1);
    expect(pontoGraduadoEm(dobrada.graduacao!, dobrada.contorno, 2)!.deslocamentos[G]).toEqual(ponto(20, 20));
  });

  it('mover um ponto graduado leva a regra com ele', () => {
    const comCantoMovido = moverPontoDoMolde(graduada(), 2, ponto(230, 310));
    expect(pontoGraduadoEm(comCantoMovido.graduacao!, comCantoMovido.contorno, 2)!.deslocamentos).toEqual(regra(10, 20));
    expect(doG(comCantoMovido)[2]).toEqual(ponto(240, 330));
  });

  it('inserir um ponto noutro lugar não troca a regra de ninguém; o ponto novo anda na proporção', () => {
    const comMaisUm = inserirPontoNoMolde(graduada(), 1, ponto(200, 150));
    expect(comMaisUm.contorno).toHaveLength(5);
    expect(verticesGraduados(comMaisUm.graduacao!, comMaisUm.contorno)).toEqual([0, 1, 3, 4]);
    esperarPontos(doG(comMaisUm), [ponto(0, 0), ponto(200, 0), ponto(205, 160), ponto(210, 320), ponto(0, 300)]);
  });

  it('desdobrar espelha os pontos graduados e as regras deles', () => {
    // Dobra na lateral esquerda (x = 0): o canto (200, 300) ganha o par (−200, 300), com a regra (−10, 20).
    const inteira = desdobrarMolde(graduada(), 3, ids());
    const espelhado = inteira.contorno.findIndex((q) => distancia(q, ponto(-200, 300)) < 1e-6);
    esperarPontos([pontoGraduadoEm(inteira.graduacao!, inteira.contorno, espelhado)!.deslocamentos[G]!], [ponto(-10, 20)]);
    const tamanhoG = doG(inteira);
    expect(Math.min(...tamanhoG.map((q) => q.x))).toBeCloseTo(-210, 6);
    expect(Math.max(...tamanhoG.map((q) => q.x))).toBeCloseTo(210, 6);
  });

  it('abrir uma prega leva os pontos graduados do lado que anda', () => {
    const comPrega = criarPregas(
      graduada(),
      { indiceAresta: 0, ponto: ponto(100, 0) },
      { indiceAresta: 2, ponto: ponto(100, 300) },
      { modo: 'simples-direita', quantidade: 1, distanciaMm: 0, larguraMm: 20, piques: false },
      null,
      ids(),
    );
    // O canto (200, 300) foi para (240, 300) e continua graduado, com a mesma regra.
    const canto = comPrega.contorno.findIndex((q) => distancia(q, ponto(240, 300)) < 1e-6);
    expect(pontoGraduadoEm(comPrega.graduacao!, comPrega.contorno, canto)!.deslocamentos).toEqual(regra(10, 20));
  });

  it('semGraduacao devolve a peça comum, só com o tamanho base', () => {
    const comum = semGraduacao(graduada());
    expect('graduacao' in comum).toBe(false);
    expect(comum.contorno).toEqual(RETANGULO);
    expect(graduada().graduacao).toBeDefined();
  });
});

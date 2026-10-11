import { describe, it, expect } from 'vitest';
import { circulo, espiral } from '../core/curvas';
import { area, distancia, ponto, type Ponto2D } from '../core/geometria';
import { alterarCirculo, alterarEspiral, comFiguraRegistrada, comFiguraValida, contornoDaFigura, figuraDaEspiral, figuraDaPeca, figuraDoCirculo } from './figuras';
import {
  adicionarMarca,
  adicionarPique,
  criarMolde,
  dimensionarMolde,
  espelharMolde,
  moverPontoDoMolde,
  rotacionarMolde,
  transladarMolde,
  type Molde,
} from './molde';

const CENTRO = ponto(300, 200);
// O círculo de raio 50 feito com o clique da borda em (330, 240): começa nesse ponto, e não no eixo.
const NA_BORDA = ponto(330, 240);

function pecaCirculo(): Molde {
  const peca = criarMolde(
    { nome: 'Tampa', referencia: 'REF', tamanho: 'M', contorno: circulo(CENTRO, NA_BORDA), linhaDeFio: { inicio: ponto(300, 180), fim: ponto(300, 220) } },
    'c1',
  );
  return comFiguraRegistrada(peca, figuraDoCirculo(CENTRO, NA_BORDA));
}

function pecaEspiral(): Molde {
  const contorno = espiral(CENTRO, 60, 1000);
  // A linha de fio dentro da tira: do primeiro ponto da borda de dentro para fora, no meio da largura.
  const peca = criarMolde({ nome: 'Babado', referencia: 'REF', tamanho: 'M', contorno, linhaDeFio: { inicio: ponto(370, 200), fim: ponto(410, 200) } }, 'e1');
  return comFiguraRegistrada(peca, figuraDaEspiral(CENTRO, 60, 1000));
}

const raios = (peca: Molde, centro: Ponto2D): number[] => peca.contorno.map((p) => distancia(p, centro));

describe('o círculo e a espiral ficam registrados', () => {
  it('o registro do círculo guarda o raio e bate com o contorno que a ferramenta desenha', () => {
    const peca = pecaCirculo();
    const figura = figuraDaPeca(peca)!;

    expect(figura).toMatchObject({ tipo: 'circulo', centro: CENTRO });
    expect(figura.tipo === 'circulo' && figura.raioMm).toBeCloseTo(50, 9);
    const refeito = contornoDaFigura(figura);
    expect(refeito).toHaveLength(peca.contorno.length);
    refeito.forEach((p, i) => expect(distancia(p, peca.contorno[i]!)).toBeLessThan(1e-9));
  });

  it('o registro da espiral guarda a largura e o perímetro', () => {
    const figura = figuraDaPeca(pecaEspiral())!;
    expect(figura).toMatchObject({ tipo: 'espiral', larguraMm: 60, perimetroMm: 1000, centro: CENTRO });
  });

  it('o registro que não é o do contorno não entra', () => {
    const quadrado = criarMolde(
      { nome: 'Q', referencia: 'R', tamanho: 'M', contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 100), ponto(0, 100)], linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 80) } },
      'q',
    );
    expect(comFiguraRegistrada(quadrado, figuraDoCirculo(ponto(50, 50), ponto(100, 50))).figura).toBeUndefined();
    // O círculo de outro raio, no mesmo centro, também não.
    const peca = pecaCirculo();
    expect(comFiguraRegistrada(peca, figuraDoCirculo(CENTRO, ponto(360, 200))).figura).toBeUndefined();
    expect(() => figuraDoCirculo(CENTRO, CENTRO)).toThrow(/raio maior que zero/);
  });
});

describe('o registro acompanha a peça inteira', () => {
  it('movida, girada e espelhada, a peça continua sendo a figura — no lugar novo', () => {
    for (const peca of [pecaCirculo(), pecaEspiral()]) {
      const movida = transladarMolde(peca, ponto(40, -30), peca.id);
      expect(figuraDaPeca(movida)!.centro).toEqual(ponto(340, 170));
      expect(figuraDaPeca(rotacionarMolde(peca, 37))).not.toBeNull();
      expect(figuraDaPeca(espelharMolde(peca, peca.id))).not.toBeNull();
      expect(figuraDaPeca(espelharMolde(rotacionarMolde(movida, -120), peca.id))).not.toBeNull();
    }
  });

  it('o círculo dimensionado por igual nos dois sentidos continua sendo um círculo, com o raio novo e os lados que tinha', () => {
    const peca = pecaCirculo();
    const maior = dimensionarMolde(peca, 2, 2);
    const figura = figuraDaPeca(maior)!;

    expect(figura).toMatchObject({ tipo: 'circulo', raioMm: 100, lados: peca.contorno.length });
    // O dimensionar cresce a partir do canto da caixa da peça: o centro foi junto.
    for (const r of raios(maior, figura.centro)) expect(r).toBeCloseTo(100, 9);
    expect(maior.contorno).toHaveLength(peca.contorno.length);
    // Um círculo de raio 100 feito agora teria mais lados: o dimensionado ficou com os dele.
    expect(circulo(CENTRO, ponto(CENTRO.x + 100, CENTRO.y)).length).toBeGreaterThan(peca.contorno.length);
    // Encolhido, também; e dimensionado duas vezes.
    expect(figuraDaPeca(dimensionarMolde(peca, 0.5, 0.5))).toMatchObject({ tipo: 'circulo', raioMm: 25 });
    expect(figuraDaPeca(dimensionarMolde(maior, 1.5, 1.5))).toMatchObject({ tipo: 'circulo', raioMm: 150, lados: peca.contorno.length });
    // Depois de dimensionado, continua acompanhando a peça movida, girada e espelhada.
    expect(figuraDaPeca(espelharMolde(rotacionarMolde(transladarMolde(maior, ponto(10, 20), 'c1'), 50), 'c1'))).toMatchObject({ tipo: 'circulo', raioMm: 100 });
  });

  it('mudado o raio do círculo dimensionado, ele é refeito com os lados que o raio novo pede', () => {
    const maior = dimensionarMolde(pecaCirculo(), 2, 2);
    const centro = figuraDaPeca(maior)!.centro;
    const refeito = alterarCirculo(maior, 80);
    const figura = figuraDaPeca(refeito)!;

    expect(figura).toMatchObject({ tipo: 'circulo', raioMm: 80, centro });
    expect('lados' in figura).toBe(false);
    expect(refeito.contorno).toHaveLength(circulo(centro, ponto(centro.x + 80, centro.y)).length);
    for (const r of raios(refeito, centro)) expect(r).toBeCloseTo(80, 9);
  });

  it('dimensionada com fatores diferentes (ou a espiral, mesmo por igual), ou com um ponto mexido à mão, a peça deixa de ser a figura — sem erro', () => {
    expect(figuraDaPeca(dimensionarMolde(pecaEspiral(), 2, 2))).toBeNull();
    for (const peca of [pecaCirculo(), pecaEspiral()]) {
      expect(figuraDaPeca(dimensionarMolde(peca, 1, 1.5))).toBeNull();
      const p0 = peca.contorno[0]!;
      const mexida = moverPontoDoMolde(peca, 0, ponto(p0.x + 3, p0.y));
      expect(figuraDaPeca(mexida)).toBeNull();
      expect(comFiguraValida(mexida).figura).toBeUndefined();
      expect(comFiguraValida(peca)).toBe(peca);
    }
  });

  it('o registro estragado (medidas que não dão figura) não derruba nada', () => {
    const peca = pecaEspiral();
    expect(figuraDaPeca({ ...peca, figura: { ...peca.figura!, tipo: 'espiral', larguraMm: -1, perimetroMm: 1000 } })).toBeNull();
  });
});

describe('alterarCirculo', () => {
  it('o círculo é refeito com o raio novo, no mesmo centro, e continua registrado', () => {
    const maior = alterarCirculo(pecaCirculo(), 80);

    for (const r of raios(maior, CENTRO)) expect(r).toBeCloseTo(80, 9);
    expect(figuraDaPeca(maior)).toMatchObject({ tipo: 'circulo', raioMm: 80, centro: CENTRO });
    // O círculo maior tem mais lados: a volta de 503 mm pede mais pontos que a de 314.
    expect(maior.contorno.length).toBeGreaterThan(pecaCirculo().contorno.length);
    expect(maior.id).toBe('c1');
    // O primeiro ponto continua na direção em que a borda foi clicada.
    expect(maior.contorno[0]!.x).toBeCloseTo(300 + 80 * 0.6, 9);
    expect(maior.contorno[0]!.y).toBeCloseTo(200 + 80 * 0.8, 9);
  });

  it('o que está na peça cresce junto, na mesma proporção, em torno do centro', () => {
    let peca = adicionarMarca(pecaCirculo(), ponto(320, 210), 'marca');
    peca = adicionarPique(peca, NA_BORDA, 'pique');
    const maior = alterarCirculo(peca, 100);

    expect(maior.marcas[0]!.posicao.x).toBeCloseTo(340, 9);
    expect(maior.marcas[0]!.posicao.y).toBeCloseTo(220, 9);
    expect(maior.linhaDeFio.inicio.y).toBeCloseTo(160, 9);
    expect(maior.linhaDeFio.fim.y).toBeCloseTo(240, 9);
    expect(maior.linhaDeFio.inicio.x).toBeCloseTo(300, 9);
    // O pique continua na borda, na mesma direção.
    expect(distancia(maior.piques[0]!.posicao, ponto(360, 280))).toBeLessThan(1e-6);
  });

  it('o pique do meio de um lado vai para a borda do círculo novo, que tem mais lados', () => {
    const peca = pecaCirculo();
    const [v0, v1] = [peca.contorno[0]!, peca.contorno[1]!];
    const comPique = adicionarPique(peca, ponto((v0.x + v1.x) / 2, (v0.y + v1.y) / 2), 'pique');
    const maior = alterarCirculo(comPique, 120);
    const pique = maior.piques[0]!;
    const [de, ate] = [maior.contorno[pique.indiceAresta]!, maior.contorno[(pique.indiceAresta + 1) % maior.contorno.length]!];
    // O pique está em cima do lado em que diz estar: a distância às duas pontas soma o comprimento do lado.
    expect(distancia(de, pique.posicao) + distancia(pique.posicao, ate)).toBeCloseTo(distancia(de, ate), 9);
  });

  it('a peça com o contorno guardado no outro sentido continua sendo a figura', () => {
    for (const peca of [pecaCirculo(), pecaEspiral()]) {
      expect(figuraDaPeca({ ...peca, contorno: [...peca.contorno].reverse() })).not.toBeNull();
      // Começando por outro ponto, também.
      expect(figuraDaPeca({ ...peca, contorno: [...peca.contorno.slice(7), ...peca.contorno.slice(0, 7)] })).not.toBeNull();
    }
  });

  it('de volta ao raio de antes, é o mesmo círculo', () => {
    const peca = pecaCirculo();
    const deVolta = alterarCirculo(alterarCirculo(peca, 120), 50);
    expect(deVolta.contorno).toHaveLength(peca.contorno.length);
    deVolta.contorno.forEach((p, i) => expect(distancia(p, peca.contorno[i]!)).toBeLessThan(1e-6));
  });

  it('vale também na peça que foi girada e espelhada', () => {
    const virada = espelharMolde(rotacionarMolde(pecaCirculo(), 50), 'c1');
    const centro = figuraDaPeca(virada)!.centro;
    const menor = alterarCirculo(virada, 20);
    for (const r of raios(menor, centro)) expect(r).toBeCloseTo(20, 9);
  });

  it('recusa o raio que não serve, a espiral e a peça mexida', () => {
    expect(() => alterarCirculo(pecaCirculo(), 0)).toThrow(/raio precisa ser maior que zero/);
    expect(() => alterarCirculo(pecaCirculo(), Number.NaN)).toThrow(/raio precisa ser maior que zero/);
    expect(() => alterarCirculo(pecaEspiral(), 50)).toThrow(/não é um círculo feito pelo “Por raio”/);
    expect(() => alterarCirculo(dimensionarMolde(pecaCirculo(), 2, 1), 50)).toThrow(/ou foi mexida depois/);
  });
});

describe('alterarEspiral', () => {
  it('a espiral é refeita com a largura e o perímetro novos, no mesmo centro', () => {
    const nova = alterarEspiral(pecaEspiral(), 40, 600);
    const esperado = espiral(CENTRO, 40, 600);

    expect(nova.contorno).toHaveLength(esperado.length);
    nova.contorno.forEach((p, i) => expect(distancia(p, esperado[i]!)).toBeLessThan(1e-9));
    expect(figuraDaPeca(nova)).toMatchObject({ tipo: 'espiral', larguraMm: 40, perimetroMm: 600 });
    expect(area(nova.contorno)).toBeLessThan(area(pecaEspiral().contorno));
  });

  it('a linha de fio que ficaria fora da tira é levada para dentro; o pique vai para a borda nova', () => {
    const peca = adicionarPique(pecaEspiral(), pecaEspiral().contorno[0]!, 'pique');
    const estreita = alterarEspiral(peca, 20, 400);
    const naBorda = (p: Ponto2D): number => Math.min(...estreita.contorno.map((v) => distancia(v, p)));

    expect(naBorda(estreita.piques[0]!.posicao)).toBeLessThan(10);
    // A linha de fio de antes ia de 70 a 110 mm do centro: fora da tira de 20 mm que começa a 20 do centro.
    expect(estreita.linhaDeFio).not.toEqual(peca.linhaDeFio);
  });

  it('recusa as medidas que não dão espiral, o círculo e a peça mexida', () => {
    expect(() => alterarEspiral(pecaEspiral(), 0, 1000)).toThrow(/largura da espiral precisa ser maior que zero/);
    expect(() => alterarEspiral(pecaEspiral(), 60, -5)).toThrow(/perímetro da espiral precisa ser maior que zero/);
    expect(() => alterarEspiral(pecaCirculo(), 60, 1000)).toThrow(/não é uma espiral feita pela ferramenta “Espiral”/);
    expect(() => alterarEspiral(dimensionarMolde(pecaEspiral(), 2, 2), 60, 1000)).toThrow(/ou foi mexida depois/);
  });
});

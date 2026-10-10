import { describe, it, expect } from 'vitest';
import { area, areaAssinada, ponto, retanguloEnvolvente, type Ponto2D, type PosicaoNoContorno } from '../core/geometria';
import { cotaDeDistancia } from './cota';
import { definirRegra } from './graduacao';
import { definirTamanhosDoMolde, moldeDoTamanho } from './tamanhosGraduados';
import {
  conferirOpcoesDeCorte,
  cortarMolde,
  cortarMoldeComOpcoes,
  cruzamentosDaReta,
  desdobraComAMetadeGuardada,
  desdobrarMolde,
  dobraPelaLinhaInterna,
  dobraPeloMeio,
  dobrarMolde,
  encostarMolde,
  fioDaParte,
  fioNoCentro,
  metadeDoMolde,
  removerFaixaDoMolde,
  separarRegiaoDoMolde,
  unirMoldes,
  type OpcoesDeCorte,
} from './corteEUniao';
import {
  adicionarCota,
  adicionarMarca,
  adicionarPique,
  criarMolde,
  dimensionarMolde,
  espelharMolde,
  rotacionarMolde,
  transladarMolde,
  type DadosDeNovoMolde,
  type Molde,
} from './molde';

// Retângulo de 200 × 300 mm, no sentido anti-horário: arestas 0 (y = 0), 1 (x = 200), 2 (y = 300) e 3 (x = 0).
const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
// Um "L": 200 × 100 embaixo e 100 × 200 em cima, à esquerda.
const EM_L = [ponto(0, 0), ponto(200, 0), ponto(200, 100), ponto(100, 100), ponto(100, 300), ponto(0, 300)];

function molde(sobrescrever: Partial<DadosDeNovoMolde> = {}, id = 'm1'): Molde {
  return criarMolde(
    {
      nome: 'Frente',
      referencia: 'REF-001',
      tamanho: 'M',
      contorno: RETANGULO,
      linhaDeFio: { inicio: ponto(100, 50), fim: ponto(100, 250) },
      ...sobrescrever,
    },
    id,
  );
}

function na(indiceAresta: number, x: number, y: number): PosicaoNoContorno {
  return { indiceAresta, ponto: ponto(x, y) };
}

function ids(): () => string {
  let n = 0;
  return () => `novo-${++n}`;
}

function esperarPontos(obtido: readonly Ponto2D[], esperado: readonly Ponto2D[]): void {
  expect(obtido).toHaveLength(esperado.length);
  obtido.forEach((p, i) => {
    expect(p.x).toBeCloseTo(esperado[i]!.x, 6);
    expect(p.y).toBeCloseTo(esperado[i]!.y, 6);
  });
}

describe('cortarMolde', () => {
  it('divide a peça em duas pela reta entre os dois pontos; as áreas somam a original', () => {
    const [maior, menor] = cortarMolde(molde(), na(0, 50, 0), na(2, 50, 300), 'm2');
    // 150 × 300 de um lado e 50 × 300 do outro.
    expect(area(maior.contorno)).toBeCloseTo(45000, 6);
    expect(area(menor.contorno)).toBeCloseTo(15000, 6);
    expect(maior.contorno).toEqual([ponto(50, 0), ponto(200, 0), ponto(200, 300), ponto(50, 300)]);
    expect(menor.contorno).toEqual([ponto(50, 300), ponto(0, 300), ponto(0, 0), ponto(50, 0)]);
  });

  it('a parte maior continua sendo a peça; a outra é uma peça nova, com "(2)" no nome', () => {
    const [maior, menor] = cortarMolde(molde(), na(0, 50, 0), na(2, 50, 300), 'm2');
    expect(maior).toMatchObject({ id: 'm1', nome: 'Frente' });
    expect(menor).toMatchObject({ id: 'm2', nome: 'Frente (2)', referencia: 'REF-001', tamanho: 'M' });
  });

  it('a ordem dos dois pontos não muda quem é a peça que continua', () => {
    const [maior, menor] = cortarMolde(molde(), na(2, 50, 300), na(0, 50, 0), 'm2');
    expect(maior.id).toBe('m1');
    expect(area(maior.contorno)).toBeCloseTo(45000, 6);
    expect(area(menor.contorno)).toBeCloseTo(15000, 6);
  });

  it('corta de vértice a vértice, em diagonal', () => {
    const [p0, p1] = cortarMolde(molde(), na(0, 0, 0), na(2, 200, 300), 'm2');
    expect(p0.contorno).toHaveLength(3);
    expect(p1.contorno).toHaveLength(3);
    expect(area(p0.contorno)).toBeCloseTo(30000, 6);
    expect(area(p1.contorno)).toBeCloseTo(30000, 6);
  });

  it('as duas partes giram para o mesmo lado que a peça original', () => {
    const [p0, p1] = cortarMolde(molde(), na(0, 50, 0), na(2, 50, 300), 'm2');
    expect(areaAssinada(p0.contorno)).toBeGreaterThan(0);
    expect(areaAssinada(p1.contorno)).toBeGreaterThan(0);
  });

  it('a linha de fio fica onde está na parte em que cabe, e vai para o meio da outra', () => {
    const [maior, menor] = cortarMolde(molde(), na(0, 50, 0), na(2, 50, 300), 'm2');
    expect(maior.linhaDeFio).toEqual({ inicio: ponto(100, 50), fim: ponto(100, 250) });
    // A parte de 50 × 300 tem o meio em (25, 150); a seta continua com 200 mm, na mesma direção.
    expect(menor.linhaDeFio).toEqual({ inicio: ponto(25, 50), fim: ponto(25, 250) });
  });

  it('furos, linhas internas e marcas vão para a parte em que estão', () => {
    const furoEsquerdo = [ponto(10, 10), ponto(30, 10), ponto(30, 30)];
    const furoDireito = [ponto(110, 10), ponto(130, 10), ponto(130, 30)];
    const linhaEsquerda = [ponto(10, 200), ponto(40, 200)];
    const linhaDireita = [ponto(60, 200), ponto(190, 200)];
    const original = adicionarMarca(
      adicionarMarca(molde({ furos: [furoEsquerdo, furoDireito], linhasInternas: [linhaEsquerda, linhaDireita] }), ponto(20, 100), 'me'),
      ponto(150, 100),
      'md',
    );
    const [maior, menor] = cortarMolde(original, na(0, 50, 0), na(2, 50, 300), 'm2');
    expect(maior.furos).toEqual([furoDireito]);
    expect(menor.furos).toEqual([furoEsquerdo]);
    expect(maior.linhasInternas).toEqual([linhaDireita]);
    expect(menor.linhasInternas).toEqual([linhaEsquerda]);
    expect(maior.marcas.map((m) => m.id)).toEqual(['md']);
    expect(menor.marcas.map((m) => m.id)).toEqual(['me']);
  });

  it('cada pique fica na parte que herdou a aresta dele, com o índice da aresta acertado', () => {
    const original = adicionarPique(adicionarPique(molde(), ponto(200, 150), 'direito'), ponto(0, 150), 'esquerdo');
    const [maior, menor] = cortarMolde(original, na(0, 50, 0), na(2, 50, 300), 'm2');
    // Na parte maior, (200, 0)→(200, 300) é a aresta 1; na menor, (0, 300)→(0, 0) também é a 1.
    expect(maior.piques).toEqual([{ id: 'direito', posicao: ponto(200, 150), indiceAresta: 1 }]);
    expect(menor.piques).toEqual([{ id: 'esquerdo', posicao: ponto(0, 150), indiceAresta: 1 }]);
  });

  it('cada cota vai para a parte em que está o número dela', () => {
    const cota = cotaDeDistancia('c1', ponto(100, 0), ponto(200, 0), ponto(150, 40));
    const [maior, menor] = cortarMolde(adicionarCota(molde(), cota), na(0, 50, 0), na(2, 50, 300), 'm2');
    expect(maior.cotas?.map((c) => c.id)).toEqual(['c1']);
    expect(menor.cotas).toEqual([]);
  });

  it('recusa dois pontos iguais', () => {
    expect(() => cortarMolde(molde(), na(0, 50, 0), na(0, 50, 0), 'm2')).toThrow(/dois pontos diferentes/);
  });

  it('recusa o corte em cima de uma aresta', () => {
    expect(() => cortarMolde(molde(), na(0, 50, 0), na(0, 150, 0), 'm2')).toThrow(/dentro da peça/);
    expect(() => cortarMolde(molde(), na(0, 0, 0), na(1, 200, 0), 'm2')).toThrow(/dentro da peça/);
  });

  it('recusa a reta que sai da peça no caminho', () => {
    // De (200, 50) a (50, 300), a reta passa por fora do "L" (em x = 150, y ≈ 133).
    expect(() => cortarMolde(molde({ contorno: EM_L, linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 80) } }), na(1, 200, 50), na(4, 50, 300), 'm2')).toThrow(
      /dentro da peça/,
    );
  });

  it('recusa a reta que passa por um furo', () => {
    const comFuro = molde({ furos: [[ponto(40, 100), ponto(60, 100), ponto(60, 120), ponto(40, 120)]] });
    expect(() => cortarMolde(comFuro, na(0, 50, 0), na(2, 50, 300), 'm2')).toThrow(/furo/);
  });

  it('não muda a peça original', () => {
    const original = molde();
    cortarMolde(original, na(0, 50, 0), na(2, 50, 300), 'm2');
    expect(original.contorno).toEqual(RETANGULO);
  });
});

describe('metadeDoMolde', () => {
  it('"fica": sobra o lado clicado, e a peça continua sendo ela mesma', () => {
    const metade = metadeDoMolde(molde(), na(0, 100, 0), na(2, 100, 300), ponto(150, 150), 'fica');
    expect(metade.id).toBe('m1');
    expect(metade.nome).toBe('Frente');
    expect(metade.contorno).toEqual([ponto(100, 0), ponto(200, 0), ponto(200, 300), ponto(100, 300)]);
  });

  it('"sai": sobra o outro lado', () => {
    const metade = metadeDoMolde(molde(), na(0, 100, 0), na(2, 100, 300), ponto(150, 150), 'sai');
    expect(metade.contorno).toEqual([ponto(100, 300), ponto(0, 300), ponto(0, 0), ponto(100, 0)]);
  });

  it('funciona com a região menor num canto', () => {
    // Tira o canto de 50 × 50 em (200, 300) por uma diagonal: sai um triângulo de 1250 mm².
    const semCanto = metadeDoMolde(molde(), na(1, 200, 250), na(2, 150, 300), ponto(190, 290), 'sai');
    expect(area(semCanto.contorno)).toBeCloseTo(60000 - 1250, 6);
    expect(semCanto.contorno).toHaveLength(5);
  });

  it('recusa o clique fora da peça', () => {
    expect(() => metadeDoMolde(molde(), na(0, 100, 0), na(2, 100, 300), ponto(500, 500), 'fica')).toThrow(/lado que deve ficar/);
    expect(() => metadeDoMolde(molde(), na(0, 100, 0), na(2, 100, 300), ponto(500, 500), 'sai')).toThrow(/lado que deve sair/);
  });
});

describe('desdobrarMolde', () => {
  it('a peça ganha a outra metade, espelhada na aresta: a área dobra', () => {
    const inteiro = desdobrarMolde(molde(), 3, ids());
    // Dobra em x = 0: o retângulo de 200 × 300 vira um de 400 × 300.
    esperarPontos(inteiro.contorno, [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300), ponto(-200, 300), ponto(-200, 0)]);
    expect(area(inteiro.contorno)).toBeCloseTo(120000, 6);
    expect(areaAssinada(inteiro.contorno)).toBeGreaterThan(0);
  });

  it('funciona em qualquer aresta, e o contorno continua começando pelo ponto 1 da peça', () => {
    const inteiro = desdobrarMolde(molde(), 0, ids());
    esperarPontos(inteiro.contorno, [ponto(0, 0), ponto(0, -300), ponto(200, -300), ponto(200, 0), ponto(200, 300), ponto(0, 300)]);
    expect(area(inteiro.contorno)).toBeCloseTo(120000, 6);
  });

  it('espelha numa aresta inclinada', () => {
    // Triângulo retângulo de catetos 100: desdobrado na hipotenusa, vira o quadrado de 100 × 100.
    const triangulo = molde({ contorno: [ponto(0, 0), ponto(100, 0), ponto(0, 100)], linhaDeFio: { inicio: ponto(20, 20), fim: ponto(40, 20) } });
    const quadrado = desdobrarMolde(triangulo, 1, ids());
    esperarPontos(quadrado.contorno, [ponto(0, 0), ponto(100, 0), ponto(100, 100), ponto(0, 100)]);
  });

  it('a dobra vira uma linha interna, e a linha de fio não muda', () => {
    const original = molde();
    const inteiro = desdobrarMolde(original, 3, ids());
    expect(inteiro.linhasInternas).toEqual([[ponto(0, 300), ponto(0, 0)]]);
    expect(inteiro.linhaDeFio).toEqual(original.linhaDeFio);
    expect(inteiro.id).toBe('m1');
  });

  it('a dobra feita de várias arestas seguidas na mesma reta vale inteira', () => {
    const comPontoNaDobra = molde({ contorno: [ponto(0, 0), ponto(100, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)] });
    for (const aresta of [0, 1]) {
      const inteiro = desdobrarMolde(comPontoNaDobra, aresta, ids());
      esperarPontos(inteiro.contorno, [ponto(0, 0), ponto(0, -300), ponto(200, -300), ponto(200, 0), ponto(200, 300), ponto(0, 300)]);
      expect(inteiro.linhasInternas).toEqual([[ponto(0, 0), ponto(200, 0)]]);
    }
  });

  it('furos, linhas internas e marcas ganham a cópia espelhada, com ids novos', () => {
    const furo = [ponto(50, 50), ponto(80, 50), ponto(80, 80)];
    const linha = [ponto(20, 200), ponto(180, 200)];
    const original = adicionarMarca(molde({ furos: [furo], linhasInternas: [linha] }), ponto(150, 100), 'marca', 'botão');
    const inteiro = desdobrarMolde(original, 3, ids());
    expect(inteiro.furos).toHaveLength(2);
    expect(inteiro.furos[0]).toEqual(furo);
    esperarPontos(inteiro.furos[1]!, [ponto(-50, 50), ponto(-80, 50), ponto(-80, 80)]);
    expect(inteiro.linhasInternas).toHaveLength(3);
    expect(inteiro.linhasInternas[0]).toEqual(linha);
    esperarPontos(inteiro.linhasInternas[1]!, [ponto(-20, 200), ponto(-180, 200)]);
    expect(inteiro.linhasInternas[2]).toEqual([ponto(0, 300), ponto(0, 0)]);
    expect(inteiro.marcas).toHaveLength(2);
    esperarPontos([inteiro.marcas[1]!.posicao], [ponto(-150, 100)]);
    expect(inteiro.marcas[1]!.rotulo).toBe('botão');
    expect(inteiro.marcas[1]!.id).not.toBe('marca');
  });

  it('os piques das outras arestas são copiados para o outro lado; os da dobra saem', () => {
    const original = adicionarPique(adicionarPique(molde(), ponto(200, 150), 'lateral'), ponto(0, 150), 'na-dobra');
    const inteiro = desdobrarMolde(original, 3, ids());
    expect(inteiro.piques).toHaveLength(2);
    // Contorno novo: (200, 0)→(200, 300) é a aresta 1 e (−200, 300)→(−200, 0) é a 4.
    expect(inteiro.piques[0]).toEqual({ id: 'lateral', posicao: ponto(200, 150), indiceAresta: 1 });
    expect(inteiro.piques[1]).toMatchObject({ indiceAresta: 4 });
    esperarPontos([inteiro.piques[1]!.posicao], [ponto(-200, 150)]);
    expect(inteiro.piques[1]!.id).not.toBe('lateral');
  });

  it('o pique na ponta da dobra não é duplicado', () => {
    const original = molde({ piques: [{ id: 'ponta', posicao: ponto(0, 0), indiceAresta: 0 }] });
    expect(desdobrarMolde(original, 3, ids()).piques.map((p) => p.id)).toEqual(['ponta']);
  });

  it('recusa a peça que passa para os dois lados da reta da aresta', () => {
    const emL = molde({ contorno: EM_L, linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 80) } });
    // Aresta 2: (200, 100)→(100, 100); a peça tem pontos com y = 0 e com y = 300.
    expect(() => desdobrarMolde(emL, 2, ids())).toThrow(/dois lados/);
  });

  it('recusa a peça que volta a encostar na reta da dobra', () => {
    const comDente = molde({
      contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 50), ponto(200, 50), ponto(200, 0), ponto(300, 0), ponto(300, 200), ponto(0, 200)],
    });
    expect(() => desdobrarMolde(comDente, 0, ids())).toThrow(/volta a encostar/);
  });

  it('recusa a aresta que não existe', () => {
    expect(() => desdobrarMolde(molde(), 4, ids())).toThrow(/fora do contorno/);
    expect(() => desdobrarMolde(molde(), -1, ids())).toThrow(/fora do contorno/);
  });
});

describe('encostarMolde', () => {
  // Segunda peça: 100 × 300, afastada, no mesmo sentido de giro.
  const SEGUNDA = [ponto(500, 0), ponto(600, 0), ponto(600, 300), ponto(500, 300)];
  const segunda = (sobrescrever: Partial<DadosDeNovoMolde> = {}): Molde =>
    molde({ nome: 'Lateral', contorno: SEGUNDA, linhaDeFio: { inicio: ponto(550, 50), fim: ponto(550, 250) }, ...sobrescrever }, 'm2');

  it('leva a aresta da segunda peça para cima da aresta da primeira, sem girar quando já estão alinhadas', () => {
    const encostada = encostarMolde(molde(), 1, segunda(), 3);
    esperarPontos(encostada.contorno, [ponto(200, 0), ponto(300, 0), ponto(300, 300), ponto(200, 300)]);
    expect(encostada.id).toBe('m2');
    expect(encostada.anguloDeRotacaoGraus).toBeCloseTo(0, 9);
    expect(encostada.linhaDeFio.inicio.x).toBeCloseTo(250, 6);
  });

  it('gira a segunda peça quando é preciso, e conta o giro', () => {
    // Deitada: 300 × 100. A aresta de baixo (0) tem de ficar em pé, com a peça à direita.
    const deitada = segunda({ contorno: [ponto(500, 0), ponto(800, 0), ponto(800, 100), ponto(500, 100)], linhaDeFio: { inicio: ponto(520, 50), fim: ponto(780, 50) } });
    const encostada = encostarMolde(molde(), 1, deitada, 0);
    const caixa = retanguloEnvolvente(encostada.contorno);
    expect(caixa.minX).toBeCloseTo(200, 6);
    expect(caixa.maxX).toBeCloseTo(300, 6);
    expect(caixa.minY).toBeCloseTo(0, 6);
    expect(caixa.maxY).toBeCloseTo(300, 6);
    expect(encostada.anguloDeRotacaoGraus).toBeCloseTo(270, 6);
    expect(area(encostada.contorno)).toBeCloseTo(30000, 6);
  });

  it('arestas de comprimentos diferentes ficam centralizadas uma na outra', () => {
    const quadrado = segunda({ contorno: [ponto(500, 0), ponto(600, 0), ponto(600, 100), ponto(500, 100)], linhaDeFio: { inicio: ponto(550, 20), fim: ponto(550, 80) } });
    const encostada = encostarMolde(molde(), 1, quadrado, 3);
    esperarPontos(encostada.contorno, [ponto(200, 100), ponto(300, 100), ponto(300, 200), ponto(200, 200)]);
  });

  it('com a segunda peça no sentido de giro contrário, ela também fica do lado de fora', () => {
    const horaria = segunda({ contorno: [ponto(500, 0), ponto(500, 300), ponto(600, 300), ponto(600, 0)] });
    const encostada = encostarMolde(molde(), 1, horaria, 0);
    const caixa = retanguloEnvolvente(encostada.contorno);
    expect(caixa.minX).toBeCloseTo(200, 6);
    expect(caixa.maxX).toBeCloseTo(300, 6);
  });

  it('recusa a aresta que não existe', () => {
    expect(() => encostarMolde(molde(), 9, segunda(), 0)).toThrow(/fora do contorno/);
    expect(() => encostarMolde(molde(), 0, segunda(), 9)).toThrow(/fora do contorno/);
  });
});

describe('unirMoldes', () => {
  const SEGUNDA = [ponto(500, 0), ponto(600, 0), ponto(600, 300), ponto(500, 300)];
  const segunda = (sobrescrever: Partial<DadosDeNovoMolde> = {}): Molde =>
    molde({ nome: 'Lateral', contorno: SEGUNDA, linhaDeFio: { inicio: ponto(550, 50), fim: ponto(550, 250) }, ...sobrescrever }, 'm2');

  it('as duas peças viram uma, coladas pelas arestas: a área é a soma', () => {
    const unida = unirMoldes(molde(), 1, segunda(), 3);
    // 200 × 300 + 100 × 300 = 300 × 300.
    esperarPontos(unida.contorno, [ponto(200, 300), ponto(0, 300), ponto(0, 0), ponto(200, 0), ponto(300, 0), ponto(300, 300)]);
    expect(area(unida.contorno)).toBeCloseTo(90000, 6);
    expect(areaAssinada(unida.contorno)).toBeGreaterThan(0);
  });

  it('a peça unida é a primeira: id, nome e linha de fio', () => {
    const primeira = molde();
    const unida = unirMoldes(primeira, 1, segunda(), 3);
    expect(unida).toMatchObject({ id: 'm1', nome: 'Frente' });
    expect(unida.linhaDeFio).toEqual(primeira.linhaDeFio);
    expect(unida.anguloDeRotacaoGraus).toBe(0);
  });

  it('une com a segunda peça girada', () => {
    const deitada = segunda({ contorno: [ponto(500, 0), ponto(800, 0), ponto(800, 100), ponto(500, 100)], linhaDeFio: { inicio: ponto(520, 50), fim: ponto(780, 50) } });
    const unida = unirMoldes(molde(), 1, deitada, 0);
    expect(area(unida.contorno)).toBeCloseTo(90000, 6);
    const caixa = retanguloEnvolvente(unida.contorno);
    expect(caixa.largura).toBeCloseTo(300, 6);
    expect(caixa.altura).toBeCloseTo(300, 6);
    expect(unida.contorno).toHaveLength(6);
  });

  it('une com a segunda peça no sentido de giro contrário', () => {
    const horaria = segunda({ contorno: [ponto(500, 0), ponto(500, 300), ponto(600, 300), ponto(600, 0)] });
    const unida = unirMoldes(molde(), 1, horaria, 0);
    esperarPontos(unida.contorno, [ponto(200, 300), ponto(0, 300), ponto(0, 0), ponto(200, 0), ponto(300, 0), ponto(300, 300)]);
    expect(areaAssinada(unida.contorno)).toBeGreaterThan(0);
  });

  it('com arestas de comprimentos diferentes, a sobra fica como degrau no contorno', () => {
    const quadrado = segunda({ contorno: [ponto(500, 0), ponto(600, 0), ponto(600, 100), ponto(500, 100)], linhaDeFio: { inicio: ponto(550, 20), fim: ponto(550, 80) } });
    const unida = unirMoldes(molde(), 1, quadrado, 3);
    esperarPontos(unida.contorno, [
      ponto(200, 300),
      ponto(0, 300),
      ponto(0, 0),
      ponto(200, 0),
      ponto(200, 100),
      ponto(300, 100),
      ponto(300, 200),
      ponto(200, 200),
    ]);
    expect(area(unida.contorno)).toBeCloseTo(70000, 6);
  });

  it('junta furos, linhas internas, marcas e cotas das duas, com os da segunda no lugar novo', () => {
    const furo = [ponto(520, 20), ponto(540, 20), ponto(540, 40)];
    const comExtras = adicionarCota(
      adicionarMarca(segunda({ furos: [furo], linhasInternas: [[ponto(510, 150), ponto(590, 150)]] }), ponto(550, 100), 'marca-b'),
      cotaDeDistancia('cota-b', ponto(500, 0), ponto(600, 0), ponto(550, 40)),
    );
    const unida = unirMoldes(adicionarMarca(molde(), ponto(50, 50), 'marca-a'), 1, comExtras, 3);
    // A segunda andou 300 mm para a esquerda.
    esperarPontos(unida.furos[0]!, [ponto(220, 20), ponto(240, 20), ponto(240, 40)]);
    esperarPontos(unida.linhasInternas[0]!, [ponto(210, 150), ponto(290, 150)]);
    expect(unida.marcas.map((m) => m.id)).toEqual(['marca-a', 'marca-b']);
    expect(unida.marcas[1]!.posicao.x).toBeCloseTo(250, 6);
    expect(unida.cotas?.map((c) => c.id)).toEqual(['cota-b']);
  });

  it('os piques das arestas coladas saem; os outros ficam, na aresta certa do contorno unido', () => {
    const primeira = adicionarPique(adicionarPique(molde(), ponto(200, 150), 'colado-a'), ponto(0, 150), 'fora-a');
    const outra = adicionarPique(adicionarPique(segunda(), ponto(500, 150), 'colado-b'), ponto(600, 150), 'fora-b');
    const unida = unirMoldes(primeira, 1, outra, 3);
    expect(unida.piques.map((p) => p.id)).toEqual(['fora-a', 'fora-b']);
    // Contorno unido: (0, 300)→(0, 0) é a aresta 1 e (300, 0)→(300, 300) é a 4.
    expect(unida.piques[0]).toMatchObject({ indiceAresta: 1 });
    expect(unida.piques[1]).toMatchObject({ indiceAresta: 4 });
    expect(unida.piques[1]!.posicao.x).toBeCloseTo(300, 6);
  });
});

describe('a linha de dobra', () => {
  it('cruzamentosDaReta: onde a reta atravessa o contorno, na ordem dos pontos dele', () => {
    expect(cruzamentosDaReta(RETANGULO, ponto(100, -50), ponto(100, 900))).toEqual([na(0, 100, 0), na(2, 100, 300)]);
    // Pela diagonal: os dois cantos, cada um pelo número do ponto.
    expect(cruzamentosDaReta(RETANGULO, ponto(0, 0), ponto(200, 300))).toEqual([na(0, 0, 0), na(2, 200, 300)]);
    // Fora da peça, não cruza nada.
    expect(cruzamentosDaReta(RETANGULO, ponto(500, 0), ponto(500, 300))).toEqual([]);
    expect(cruzamentosDaReta(RETANGULO, ponto(5, 5), ponto(5, 5))).toEqual([]);
  });

  it('dobraPeloMeio: horizontal é a linha deitada na tela (o X do mundo constante); vertical, a em pé', () => {
    expect(dobraPeloMeio(molde(), 'horizontal')).toEqual([na(0, 100, 0), na(2, 100, 300)]);
    expect(dobraPeloMeio(molde(), 'vertical')).toEqual([na(1, 200, 150), na(3, 0, 150)]);
  });

  it('recusa a linha do meio que passa por cima de uma aresta, ou que cruza o contorno mais de duas vezes', () => {
    expect(() => dobraPeloMeio(molde({ contorno: EM_L }), 'horizontal')).toThrow('mais de dois pontos');
    // Em pé, pelo meio do "L" (y = 150): cruza a aresta de baixo? Não: só as duas laterais da perna de cima.
    expect(dobraPeloMeio(molde({ contorno: EM_L }), 'vertical').map((p) => p.ponto)).toEqual([ponto(100, 150), ponto(0, 150)]);
  });

  it('dobraPelaLinhaInterna: vale a reta inteira da linha, de borda a borda', () => {
    const comLinha = molde({ linhasInternas: [[ponto(50, 100), ponto(150, 100)], [ponto(10, 10), ponto(60, 30), ponto(110, 10)], [ponto(20, 20), ponto(20, 20)]] });

    expect(dobraPelaLinhaInterna(comLinha, 0)).toEqual([na(1, 200, 100), na(3, 0, 100)]);
    expect(() => dobraPelaLinhaInterna(comLinha, 1)).toThrow('precisa ser reta');
    expect(() => dobraPelaLinhaInterna(comLinha, 2)).toThrow('é fechada');
    expect(() => dobraPelaLinhaInterna(comLinha, 9)).toThrow('não encontrada');
  });

  it('fioNoCentro leva a seta, sem girar, para o meio da peça', () => {
    expect(fioNoCentro({ inicio: ponto(10, 20), fim: ponto(10, 120) }, RETANGULO)).toEqual({ inicio: ponto(100, 100), fim: ponto(100, 200) });
  });
});

describe('dobrarMolde', () => {
  const [a, b] = [na(0, 100, 0), na(2, 100, 300)];
  const SIMPLES = { manter: false, fioNoCentro: false };
  const MANTENDO = { manter: true, fioNoCentro: false };

  it('fica a metade do lado clicado; a linha interna que estava em cima da dobra sai', () => {
    const peca = molde({ linhasInternas: [[ponto(100, 0), ponto(100, 300)], [ponto(150, 50), ponto(150, 250)], [ponto(40, 50), ponto(40, 250)]] });
    const dobrada = dobrarMolde(peca, a, b, ponto(150, 150), SIMPLES);

    expect(area(dobrada.contorno)).toBeCloseTo(30000, 6);
    expect(dobrada.linhasInternas).toEqual([[ponto(150, 50), ponto(150, 250)]]);
    expect(dobrada.dobraMantida).toBeUndefined();
    expect(dobrada).toMatchObject({ id: 'm1', nome: 'Frente' });
  });

  it('mantendo a dobra, a outra metade fica guardada com o que é dela', () => {
    const peca = adicionarMarca(molde({ linhasInternas: [[ponto(40, 50), ponto(40, 250)]], furos: [[ponto(20, 20), ponto(30, 20), ponto(30, 30)]] }), ponto(60, 60), 'marca');
    const dobrada = dobrarMolde(peca, a, b, ponto(150, 150), MANTENDO);

    const guardada = dobrada.dobraMantida!;
    expect(area(guardada.contorno)).toBeCloseTo(30000, 6);
    expect([guardada.de, guardada.ate]).toEqual([ponto(100, 0), ponto(100, 300)]);
    expect(guardada.linhasInternas).toEqual([[ponto(40, 50), ponto(40, 250)]]);
    expect(guardada.furos).toHaveLength(1);
    expect(guardada.marcas.map((m) => m.posicao)).toEqual([ponto(60, 60)]);
    // O que foi guardado não está mais na peça que ficou.
    expect(dobrada.linhasInternas).toEqual([]);
    expect(dobrada.furos).toEqual([]);
    expect(dobrada.marcas).toEqual([]);
  });

  it('dobrar de novo, sem manter, esquece a metade que estava guardada', () => {
    const dobrada = dobrarMolde(molde(), a, b, ponto(150, 150), MANTENDO);
    const deNovo = dobrarMolde(dobrada, na(3, 100, 150), na(1, 200, 150), ponto(150, 50), SIMPLES);

    expect('dobraMantida' in deNovo).toBe(false);
    expect(area(deNovo.contorno)).toBeCloseTo(15000, 6);
  });
});

describe('a metade guardada nos outros tamanhos da graduação', () => {
  // Trapézio dobrado em x = 100, mantendo a dobra: fica o lado direito, e o esquerdo fica guardado.
  const TRAPEZIO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 200)];
  const dobrada = (): Molde => dobrarMolde(molde({ contorno: TRAPEZIO }), na(0, 100, 0), na(2, 100, 250), ponto(150, 100), { manter: true, fioNoCentro: false });
  const arestaDaDobra = (peca: Molde): number => {
    const n = peca.contorno.length;
    return peca.contorno.findIndex((p, i) => Math.abs(p.x - 100) < 1e-9 && Math.abs(peca.contorno[(i + 1) % n]!.x - 100) < 1e-9);
  };
  const graduada = (): Molde => {
    const comTamanhos = definirTamanhosDoMolde(dobrada(), ['M', 'G'], 'M');
    const canto = (x: number, y: number): number => comTamanhos.contorno.findIndex((p) => Math.abs(p.x - x) < 1e-9 && Math.abs(p.y - y) < 1e-9);
    // No G, o lado direito sai 10 mm para fora, e a ponta de cima da dobra sobe 20 mm.
    let graduacao = definirRegra(comTamanhos.graduacao!, comTamanhos.contorno, canto(200, 0), [ponto(0, 0), ponto(10, 0)]);
    graduacao = definirRegra(graduacao, comTamanhos.contorno, canto(200, 300), [ponto(0, 0), ponto(10, 0)]);
    graduacao = definirRegra(graduacao, comTamanhos.contorno, canto(100, 250), [ponto(0, 0), ponto(0, 20)]);
    return { ...comTamanhos, graduacao };
  };

  it('a metade guardada vai para o tamanho: a dobra dela cai sobre a dobra do tamanho, e o resto anda como o lado desenhado, espelhado', () => {
    const g = moldeDoTamanho(graduada(), 1, 'g');
    const guardada = g.dobraMantida!;

    expect([guardada.de, guardada.ate]).toContainEqual(ponto(100, 0));
    expect([guardada.de, guardada.ate]).toContainEqual(ponto(100, 270));
    expect(guardada.contorno).toContainEqual(ponto(100, 270));
    // O canto (0, 0) da metade guardada é o espelho do (200, 0), que no G foi para (210, 0).
    const cantoDeBaixo = guardada.contorno.find((p) => Math.abs(p.y) < 1e-6 && p.x < 50)!;
    expect(cantoDeBaixo.x).toBeCloseTo(-10, 6);
    // No tamanho base, nada muda.
    expect(moldeDoTamanho(graduada(), 0, 'm').dobraMantida).toEqual(dobrada().dobraMantida);
  });

  it('o “Desdobrar” do tamanho traz a metade guardada de volta, em vez de espelhar a desenhada', () => {
    const g = moldeDoTamanho(graduada(), 1, 'g');
    expect(desdobraComAMetadeGuardada(g, arestaDaDobra(g))).toBe(true);

    const inteira = desdobrarMolde(g, arestaDaDobra(g), ids());
    expect(area(inteira.contorno)).toBeCloseTo(area(g.contorno) + area(g.dobraMantida!.contorno), 6);
    // Espelhando a metade desenhada, a peça teria o dobro da área dela: não é o caso, as duas metades são diferentes.
    expect(area(inteira.contorno)).not.toBeCloseTo(2 * area(g.contorno), 0);
    expect('dobraMantida' in inteira).toBe(false);
  });
});

describe('desdobrarMolde com a metade guardada', () => {
  // Trapézio: o lado esquerdo tem 200 mm e o direito, 300.
  const TRAPEZIO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 200)];
  const dobrada = (): Molde => dobrarMolde(molde({ contorno: TRAPEZIO }), na(0, 100, 0), na(2, 100, 250), ponto(150, 100), { manter: true, fioNoCentro: false });
  const arestaDaDobra = (peca: Molde, x = 100): number => {
    const n = peca.contorno.length;
    return peca.contorno.findIndex((p, i) => Math.abs(p.x - x) < 1e-9 && Math.abs(peca.contorno[(i + 1) % n]!.x - x) < 1e-9);
  };

  it('a metade guardada volta como era, e a peça é a de antes de dobrar', () => {
    const peca = dobrada();
    expect(area(peca.contorno)).toBeCloseTo(27500, 6);
    expect(desdobraComAMetadeGuardada(peca, arestaDaDobra(peca))).toBe(true);

    const inteira = desdobrarMolde(peca, arestaDaDobra(peca), ids());
    expect(area(inteira.contorno)).toBeCloseTo(50000, 6);
    expect(inteira.contorno).toHaveLength(6);
    for (const canto of TRAPEZIO) expect(inteira.contorno).toContainEqual(canto);
    expect(inteira.linhasInternas).toEqual([[ponto(100, 250), ponto(100, 0)]]);
    expect('dobraMantida' in inteira).toBe(false);
    // O contorno continua girando para o mesmo lado.
    expect(Math.sign(areaAssinada(inteira.contorno))).toBe(Math.sign(areaAssinada(TRAPEZIO)));
  });

  it('o que foi mudado na metade que ficou vale; a guardada volta sem mudança', () => {
    const peca = dobrada();
    const mudada: Molde = { ...peca, contorno: peca.contorno.map((p) => (p.x === 200 && p.y === 300 ? ponto(200, 280) : p)) };

    const inteira = desdobrarMolde(mudada, arestaDaDobra(mudada), ids());
    // A metade que ficou perdeu um triângulo de 100 × 20 / 2; a guardada continua com 225 cm².
    expect(area(inteira.contorno)).toBeCloseTo(50000 - 1000, 6);
    expect(inteira.contorno).toContainEqual(ponto(0, 200));
  });

  it('a metade guardada acompanha a peça movida, girada, espelhada e dimensionada', () => {
    const movida = transladarMolde(dobrada(), ponto(40, 500), 'm1');
    expect(area(desdobrarMolde(movida, arestaDaDobra(movida, 140), ids()).contorno)).toBeCloseTo(50000, 6);

    for (const transformada of [rotacionarMolde(dobrada(), 90), espelharMolde(dobrada(), 'm1'), dimensionarMolde(dobrada(), 2, 1)]) {
      const aresta = transformada.contorno.findIndex((_, i) => desdobraComAMetadeGuardada(transformada, i));
      expect(aresta).toBeGreaterThanOrEqual(0);
      // Dimensionada, a peça muda de área: a inteira muda na mesma proporção.
      const fator = area(transformada.contorno) / 27500;
      expect(area(desdobrarMolde(transformada, aresta, ids()).contorno)).toBeCloseTo(50000 * fator, 4);
    }
  });

  it('a metade guardada encaixa mesmo com o contorno da peça guardado no outro sentido', () => {
    const peca = dobrada();
    const invertida: Molde = { ...peca, contorno: [...peca.contorno].reverse() };

    const inteira = desdobrarMolde(invertida, arestaDaDobra(invertida), ids());
    expect(area(inteira.contorno)).toBeCloseTo(50000, 6);
    for (const canto of TRAPEZIO) expect(inteira.contorno).toContainEqual(canto);
    // O contorno inteiro segue o sentido da peça que ficou.
    expect(Math.sign(areaAssinada(inteira.contorno))).toBe(Math.sign(areaAssinada(invertida.contorno)));
  });

  it('noutra aresta, ou com a dobra mexida, vale o espelho — e a metade guardada continua guardada', () => {
    const peca = dobrada();
    const outra = (arestaDaDobra(peca) + 2) % peca.contorno.length;
    expect(desdobraComAMetadeGuardada(peca, outra)).toBe(false);
    expect(desdobrarMolde(peca, outra, ids()).dobraMantida).toBeDefined();

    const mexida: Molde = { ...peca, contorno: peca.contorno.map((p) => (p.x === 100 && p.y === 0 ? ponto(100, 10) : p)) };
    expect(desdobraComAMetadeGuardada(mexida, arestaDaDobra(mexida))).toBe(false);
    // Espelhada na dobra, a peça fica com o dobro da metade que ficou.
    expect(area(desdobrarMolde(mexida, arestaDaDobra(mexida), ids()).contorno)).toBeCloseTo(2 * area(mexida.contorno), 6);
  });

  it('a peça sem metade guardada desdobra como sempre', () => {
    expect(desdobraComAMetadeGuardada(molde(), 3)).toBe(false);
    expect(area(desdobrarMolde(molde(), 3, ids()).contorno)).toBeCloseTo(120000, 6);
  });

  it('fioNoCentro, ao desdobrar, leva a seta para o meio da peça inteira', () => {
    const inteira = desdobrarMolde(molde(), 3, ids(), { fioNoCentro: true });

    expect(inteira.linhaDeFio).toEqual({ inicio: ponto(0, 50), fim: ponto(0, 250) });
  });
});

describe('fioDaParte', () => {
  const FIO_COMPRIDO = { inicio: ponto(100, 20), fim: ponto(100, 280) };

  it('a seta que cabe fica onde está; a que não cabe ali vai para o meio da parte', () => {
    expect(fioDaParte(FIO_COMPRIDO, RETANGULO)).toBe(FIO_COMPRIDO);
    const deslocada = fioDaParte({ inicio: ponto(300, 20), fim: ponto(300, 280) }, RETANGULO);
    expect(deslocada).toEqual(FIO_COMPRIDO);
  });

  it('a seta mais comprida que a parte encolhe em torno do meio até caber, sem mudar de direção', () => {
    // A parte tem 100 mm de altura; a seta, 260.
    const baixa = [ponto(0, 0), ponto(200, 0), ponto(200, 100), ponto(0, 100)];
    const curta = fioDaParte(FIO_COMPRIDO, baixa);

    expect(curta.inicio.x).toBeCloseTo(100, 9);
    expect(curta.fim.x).toBeCloseTo(100, 9);
    expect((curta.inicio.y + curta.fim.y) / 2).toBeCloseTo(50, 9);
    expect(curta.fim.y - curta.inicio.y).toBeGreaterThan(0);
    expect(curta.fim.y - curta.inicio.y).toBeLessThan(100);
    // A maior das reduções que cabe: 260 × 0,75⁴ ≈ 82 mm.
    expect(curta.fim.y - curta.inicio.y).toBeCloseTo(260 * 0.75 ** 4, 6);
  });

  it('se o meio da parte está fora dela (um "L"), a seta fica no meio como sempre', () => {
    const noMeio = fioDaParte({ inicio: ponto(900, 20), fim: ponto(900, 280) }, EM_L);
    expect(noMeio.fim.y - noMeio.inicio.y).toBeCloseTo(260, 9);
  });

  it('num "U", com o meio no vão, a seta não encolhe até ficar atravessada no vão com as pontas nas pernas', () => {
    // Pernas de x = 0 a 50 e de 150 a 200; o vão entre elas vai de y = 100 para cima. O meio da caixa, (100, 150), está no vão.
    const emU = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(150, 300), ponto(150, 100), ponto(50, 100), ponto(50, 300), ponto(0, 300)];
    const seta = fioDaParte({ inicio: ponto(-50, 900), fim: ponto(250, 900) }, emU);

    // Encolhida a 168,75 mm, as pontas cairiam dentro das pernas; mas o meio dela ficaria no ar: fica como sempre, no meio e inteira.
    expect(seta.fim.x - seta.inicio.x).toBeCloseTo(300, 9);
    expect(seta.inicio.y).toBeCloseTo(150, 9);
  });
});

describe('cruzamentosDaReta nos moldes reais', () => {
  it('o ponto do contorno a nanômetros da reta é o cruzamento: não nasce um ponto novo colado nele', () => {
    // O canto (200, 150) está a 0,00002 mm da reta em pé que passa por y = 150,00002.
    const comPonto = [ponto(0, 0), ponto(200, 0), ponto(200, 150), ponto(200, 300), ponto(0, 300)];
    const cruzamentos = cruzamentosDaReta(comPonto, ponto(0, 150.00002), ponto(200, 150.00002));

    expect(cruzamentos).toHaveLength(2);
    expect(cruzamentos.map((c) => c.ponto)).toContainEqual(ponto(200, 150));
    // A dois milésimos de milímetro, já é outro ponto: o cruzamento cai na aresta.
    const longe = cruzamentosDaReta(comPonto, ponto(0, 150.002), ponto(200, 150.002));
    expect(longe.map((c) => c.ponto)).not.toContainEqual(ponto(200, 150));
    expect(longe).toHaveLength(2);
  });
});

describe('cortarMoldeComOpcoes', () => {
  // O corte em pé, em x = 50: a parte maior vai de x = 50 a 200, e a nova, de 0 a 50.
  const [a, b] = [na(0, 50, 0), na(2, 50, 300)];
  const COSTURA: OpcoesDeCorte = { costuraMm: 10, costuraNasDuas: false, piques: false, modo: 'reta' };
  const contem = (contorno: readonly Ponto2D[], x: number, y: number): boolean => contorno.some((p) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6);

  it('sem costura, é o corte de sempre — e a linha interna que estava em cima da reta sai', () => {
    const peca = molde({ linhasInternas: [[ponto(50, 0), ponto(50, 300)], [ponto(120, 50), ponto(120, 250)]] });
    const [maior, menor] = cortarMoldeComOpcoes(peca, a, b, ids());

    expect(area(maior.contorno)).toBeCloseTo(45000, 6);
    expect(area(menor.contorno)).toBeCloseTo(15000, 6);
    expect(maior.linhasInternas).toEqual([[ponto(120, 50), ponto(120, 250)]]);
    expect(menor.linhasInternas).toEqual([]);
    expect(maior.id).toBe('m1');
    expect(menor.id).toBe('novo-1');
  });

  it('modo reta: a borda do corte da peça nova anda a costura para fora, em esquadro', () => {
    const [maior, menor] = cortarMoldeComOpcoes(molde(), a, b, ids(), COSTURA);

    expect(area(menor.contorno)).toBeCloseTo(15000 + 10 * 300, 6);
    expect(menor.contorno).toHaveLength(6);
    for (const [x, y] of [[50, 0], [60, 0], [60, 300], [50, 300]] as const) expect(contem(menor.contorno, x, y)).toBe(true);
    // Sem "2 moldes", a parte maior fica como o corte a deixou.
    expect(area(maior.contorno)).toBeCloseTo(45000, 6);
  });

  it('com “2 moldes”, as duas partes ganham a costura, cada uma para o seu lado de fora', () => {
    const [maior, menor] = cortarMoldeComOpcoes(molde(), a, b, ids(), { ...COSTURA, costuraNasDuas: true });

    expect(area(maior.contorno)).toBeCloseTo(45000 + 3000, 6);
    expect(contem(maior.contorno, 40, 0)).toBe(true);
    expect(contem(maior.contorno, 40, 300)).toBe(true);
    expect(area(menor.contorno)).toBeCloseTo(18000, 6);
  });

  it('modo tangente: as arestas vizinhas são estendidas até a borda nova', () => {
    // No retângulo, as vizinhas já estão em esquadro com o corte: a parte nova fica um retângulo maior, sem pontos a mais.
    const [, menor] = cortarMoldeComOpcoes(molde(), a, b, ids(), { ...COSTURA, modo: 'tangente' });
    expect(menor.contorno).toHaveLength(4);
    expect(area(menor.contorno)).toBeCloseTo(18000, 6);

    // Cortando o canto (200, 0) em diagonal, as vizinhas chegam ao corte a 45°: cada uma anda 10 × √2 a mais.
    const [, canto] = cortarMoldeComOpcoes(molde(), na(0, 100, 0), na(1, 200, 100), ids(), { ...COSTURA, modo: 'tangente' });
    expect(canto.contorno).toHaveLength(3);
    expect(contem(canto.contorno, 100 - 10 * Math.SQRT2, 0)).toBe(true);
    expect(contem(canto.contorno, 200, 100 + 10 * Math.SQRT2)).toBe(true);
    // Em esquadro, o mesmo canto ganha um retângulo sobre a diagonal.
    const [, emEsquadro] = cortarMoldeComOpcoes(molde(), na(0, 100, 0), na(1, 200, 100), ids(), COSTURA);
    expect(emEsquadro.contorno).toHaveLength(5);
    expect(area(emEsquadro.contorno)).toBeCloseTo(5000 + 10 * 100 * Math.SQRT2, 6);
  });

  it('modo tangente: a vizinha que corre junto do corte não chega à borda nova, e essa ponta acaba em esquadro', () => {
    // Um degrau: o corte sobe do canto de dentro (100, 100) até (100, 300); a aresta que chega a esse canto é paralela ao corte.
    const degrau = molde({ contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 100), ponto(200, 100), ponto(200, 300), ponto(0, 300)], linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) } });
    const [maior] = cortarMoldeComOpcoes(degrau, na(2, 100, 100), na(4, 100, 300), ids(), { ...COSTURA, costuraNasDuas: true, modo: 'tangente' });

    expect(area(maior.contorno)).toBeCloseTo(30000 + 10 * 200, 6);
    // Em baixo, em esquadro: o canto fica, e nasce o ponto (110, 100). Em cima, a aresta do alto foi estendida.
    expect(contem(maior.contorno, 100, 100)).toBe(true);
    expect(contem(maior.contorno, 110, 100)).toBe(true);
    expect(contem(maior.contorno, 110, 300)).toBe(true);
    expect(contem(maior.contorno, 100, 300)).toBe(false);
  });

  it('com pique, cada parte que ganhou costura fica com um em cada ponta da linha do corte', () => {
    const [maior, menor] = cortarMoldeComOpcoes(molde(), a, b, ids(), { ...COSTURA, piques: true, modo: 'tangente' });

    expect(maior.piques).toHaveLength(0);
    expect(menor.piques.map((q) => q.posicao)).toEqual([ponto(50, 0), ponto(50, 300)]);
  });

  it('recusa a costura negativa', () => {
    expect(() => cortarMoldeComOpcoes(molde(), a, b, ids(), { ...COSTURA, costuraMm: -1 })).toThrow('zero ou maior');
    expect(() => conferirOpcoesDeCorte({ ...COSTURA, costuraMm: Number.NaN })).toThrow('zero ou maior');
  });
});

describe('remover região: manter a região e unir o que sobra', () => {
  const FIO_A_ESQUERDA = { inicio: ponto(50, 50), fim: ponto(50, 250) };

  it('separarRegiaoDoMolde: a peça sem a região, e a região como peça própria', () => {
    const { peca, regiao } = separarRegiaoDoMolde(molde(), na(0, 150, 0), na(2, 150, 300), ponto(180, 150), 'nova');

    expect(area(peca.contorno)).toBeCloseTo(45000, 6);
    expect(area(regiao.contorno)).toBeCloseTo(15000, 6);
    expect(peca.id).toBe('m1');
    expect(regiao).toMatchObject({ id: 'nova', nome: 'Frente (2)' });
  });

  it('removerFaixaDoMolde: a faixa entre as duas retas sai, e o lado sem a linha de fio vem encostar no outro', () => {
    const peca = adicionarMarca(molde({ linhaDeFio: FIO_A_ESQUERDA }), ponto(180, 150), 'marca');
    const { peca: unida, faixa, degrauMm } = removerFaixaDoMolde(peca, na(0, 100, 0), na(2, 100, 300), ponto(140, 0), ponto(140, 300), 'faixa');

    expect(area(unida.contorno)).toBeCloseTo(60000 - 40 * 300, 6);
    expect(area(faixa.contorno)).toBeCloseTo(12000, 6);
    expect(degrauMm).toBeCloseTo(0, 9);
    expect(unida.id).toBe('m1');
    expect(unida.linhaDeFio).toEqual(FIO_A_ESQUERDA);
    // O que estava do lado de lá andou os 40 mm da faixa.
    expect(unida.marcas[0]!.posicao.x).toBeCloseTo(140, 6);
    expect(unida.marcas[0]!.posicao.y).toBeCloseTo(150, 6);
    const xs = unida.contorno.map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(0, 6);
    expect(Math.max(...xs)).toBeCloseTo(160, 6);
    expect(faixa).toMatchObject({ id: 'faixa', nome: 'Frente (2)' });
  });

  it('com a linha de fio do lado de lá, é o lado de cá que anda', () => {
    const peca = molde({ linhaDeFio: { inicio: ponto(180, 50), fim: ponto(180, 250) } });
    const { peca: unida } = removerFaixaDoMolde(peca, na(0, 100, 0), na(2, 100, 300), ponto(140, 0), ponto(140, 300), 'faixa');

    expect(unida.linhaDeFio).toEqual({ inicio: ponto(180, 50), fim: ponto(180, 250) });
    const xs = unida.contorno.map((p) => p.x);
    expect(Math.min(...xs)).toBeCloseTo(40, 6);
    expect(Math.max(...xs)).toBeCloseTo(200, 6);
    expect(area(unida.contorno)).toBeCloseTo(48000, 6);
  });

  it('a linha de fio que não cabe mais na peça unida vai para o meio dela', () => {
    // O fio atravessa a peça de lado a lado, por cima das duas retas: tirada a faixa, ele sobra para fora.
    const peca = molde({ linhaDeFio: { inicio: ponto(10, 150), fim: ponto(190, 150) } });
    const { peca: unida } = removerFaixaDoMolde(peca, na(0, 100, 0), na(2, 100, 300), ponto(140, 0), ponto(140, 300), 'faixa');
    const xs = unida.contorno.map((p) => p.x);
    const [minX, maxX] = [Math.min(...xs), Math.max(...xs)];

    expect(maxX - minX).toBeCloseTo(160, 6);
    // Na mesma direção e centrada na peça que ficou; como a peça (160 mm) ficou mais curta que a seta (180), ela encolheu uma vez: 135 mm.
    expect(unida.linhaDeFio.fim.x - unida.linhaDeFio.inicio.x).toBeCloseTo(180 * 0.75, 6);
    expect((unida.linhaDeFio.inicio.x + unida.linhaDeFio.fim.x) / 2).toBeCloseTo((minX + maxX) / 2, 6);
    expect(unida.linhaDeFio.inicio.y).toBeCloseTo(150, 6);
  });

  it('retas de comprimentos diferentes deixam um degrau, que é dito', () => {
    const { degrauMm, peca: unida } = removerFaixaDoMolde(molde({ linhaDeFio: FIO_A_ESQUERDA }), na(0, 100, 0), na(2, 100, 300), ponto(140, 0), ponto(170, 300), 'faixa');

    expect(degrauMm).toBeCloseTo(Math.hypot(30, 300) - 300, 9);
    expect(area(unida.contorno)).toBeGreaterThan(0);
  });

  it('a linha interna que estava em cima de uma das retas sai', () => {
    const peca = molde({ linhaDeFio: FIO_A_ESQUERDA, linhasInternas: [[ponto(100, 0), ponto(100, 300)], [ponto(140, 0), ponto(140, 300)], [ponto(20, 20), ponto(30, 30)]] });
    const { peca: unida } = removerFaixaDoMolde(peca, na(0, 100, 0), na(2, 100, 300), ponto(140, 0), ponto(140, 300), 'faixa');

    expect(unida.linhasInternas).toEqual([[ponto(20, 20), ponto(30, 30)]]);
  });

  it('recusa a segunda reta que cruza a primeira ou que não está no contorno', () => {
    const peca = molde({ linhaDeFio: FIO_A_ESQUERDA });
    expect(() => removerFaixaDoMolde(peca, na(0, 100, 0), na(2, 100, 300), ponto(50, 0), ponto(150, 300), 'faixa')).toThrow('de um lado da primeira');
    expect(() => removerFaixaDoMolde(peca, na(0, 100, 0), na(2, 100, 300), ponto(140, 10), ponto(140, 290), 'faixa')).toThrow('de um lado da primeira');
  });
});

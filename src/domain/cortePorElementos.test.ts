import { describe, it, expect } from 'vitest';
import { area, ponto, type Ponto2D } from '../core/geometria';
import { definirRegra, regraDoVertice } from './graduacao';
import { definirTamanhosDoMolde, moldeDoTamanho } from './tamanhosGraduados';
import { cortarMoldeComOpcoes, exigirCorteValido, type OpcoesDeCorte } from './corteEUniao';
import { cortarMoldePelosElementos, linhaDeCortePelosElementos } from './cortePorElementos';
import { criarMolde, type DadosDeNovoMolde, type Molde } from './molde';

// Retângulo de 200 × 300 mm, no sentido anti-horário: arestas 0 (y = 0), 1 (x = 200), 2 (y = 300) e 3 (x = 0).
const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
// Um "L": 200 × 100 embaixo e 100 × 200 em cima, à esquerda.
const EM_L = [ponto(0, 0), ponto(200, 0), ponto(200, 100), ponto(100, 100), ponto(100, 300), ponto(0, 300)];
// A linha quebrada de borda a borda: sobe de (0, 100) a (100, 150) e desce a (200, 100).
const QUEBRADA = [ponto(0, 100), ponto(100, 150), ponto(200, 100)];

function molde(sobrescrever: Partial<DadosDeNovoMolde> = {}): Molde {
  return criarMolde(
    { nome: 'Frente', referencia: 'REF-001', tamanho: 'M', contorno: RETANGULO, linhaDeFio: { inicio: ponto(100, 200), fim: ponto(100, 280) }, ...sobrescrever },
    'm1',
  );
}

function ids(): () => string {
  let n = 0;
  return () => `novo-${++n}`;
}

const contem = (contorno: readonly Ponto2D[], x: number, y: number): boolean => contorno.some((p) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6);
const em = (peca: Molde, x: number, y: number): number => peca.contorno.findIndex((p) => Math.abs(p.x - x) < 1e-6 && Math.abs(p.y - y) < 1e-6);

describe('linhaDeCortePelosElementos', () => {
  it('o elemento de borda a borda dá as duas pontas no contorno e os pontos do caminho', () => {
    const { a, b, miolo } = linhaDeCortePelosElementos(molde({ linhasInternas: [QUEBRADA] }), [0]);

    expect(a).toEqual({ indiceAresta: 3, ponto: ponto(0, 100) });
    expect(b).toEqual({ indiceAresta: 1, ponto: ponto(200, 100) });
    expect(miolo).toEqual([ponto(100, 150)]);
  });

  it('a ponta que para dentro da peça é prolongada em linha reta, na direção em que acaba', () => {
    // De (50, 100) para trás, na direção de quem vem de (100, 150): chega à borda em (0, 50). A outra ponta, em (200, 50).
    const { a, b, miolo } = linhaDeCortePelosElementos(molde({ linhasInternas: [[ponto(50, 100), ponto(100, 150), ponto(150, 100)]] }), [0]);

    expect(a.indiceAresta).toBe(3);
    expect(a.ponto.x).toBeCloseTo(0, 9);
    expect(a.ponto.y).toBeCloseTo(50, 9);
    expect(b.indiceAresta).toBe(1);
    expect(b.ponto.x).toBeCloseTo(200, 9);
    expect(b.ponto.y).toBeCloseTo(50, 9);
    // As pontas antigas ficaram no meio de uma reta: não entram no caminho.
    expect(miolo).toEqual([ponto(100, 150)]);
  });

  it('a ponta que passa do contorno é aparada onde a linha entra na peça', () => {
    const { a, b, miolo } = linhaDeCortePelosElementos(molde({ linhasInternas: [[ponto(-50, 100), ponto(100, 150), ponto(250, 100)]] }), [0]);

    expect(a.indiceAresta).toBe(3);
    expect(a.ponto.x).toBeCloseTo(0, 9);
    expect(a.ponto.y).toBeCloseTo(100 + 50 / 3, 9);
    expect(b.indiceAresta).toBe(1);
    expect(b.ponto.x).toBeCloseTo(200, 9);
    expect(b.ponto.y).toBeCloseTo(100 + 50 / 3, 9);
    expect(miolo).toEqual([ponto(100, 150)]);
  });

  it('de fora, vale onde a linha entra na peça — não para onde o primeiro trecho aponta', () => {
    // O primeiro trecho, todo fora, aponta para (0, 100) e para antes; é o segundo que entra na peça, mais acima.
    const { a, miolo } = linhaDeCortePelosElementos(molde({ linhasInternas: [[ponto(-100, 100), ponto(-50, 100), ponto(100, 150), ponto(200, 100)]] }), [0]);

    expect(a.ponto.x).toBeCloseTo(0, 9);
    expect(a.ponto.y).toBeCloseTo(100 + 50 / 3, 9);
    expect(miolo).toEqual([ponto(100, 150)]);
  });

  it('o ponto do caminho colado na ponta sai; a ponta fica onde está', () => {
    const { a, b, miolo } = linhaDeCortePelosElementos(molde({ linhasInternas: [[ponto(0, 100), ponto(100, 150), ponto(199.98, 100.01), ponto(200, 100)]] }), [0]);

    expect(a.ponto).toEqual(ponto(0, 100));
    expect(b.ponto).toEqual(ponto(200, 100));
    expect(miolo).toEqual([ponto(100, 150)]);
  });

  it('a ponta a menos de 1 mm do contorno é levada até ele, de dentro ou de fora', () => {
    const { a, b } = linhaDeCortePelosElementos(molde({ linhasInternas: [[ponto(0.6, 100), ponto(100, 150), ponto(200.5, 100)]] }), [0]);

    expect(a).toEqual({ indiceAresta: 3, ponto: ponto(0, 100) });
    expect(b).toEqual({ indiceAresta: 1, ponto: ponto(200, 100) });
  });

  it('a ponta que cai num ponto do contorno fica nele, e não num ponto novo colado', () => {
    // A linha acaba apontando para o canto (0, 0), a 2 mm dele; a outra ponta, no canto (200, 300).
    const { a, b } = linhaDeCortePelosElementos(molde({ linhasInternas: [[ponto(2, 2), ponto(100, 100), ponto(200, 300)]] }), [0]);

    expect(a).toEqual({ indiceAresta: 0, ponto: ponto(0, 0) });
    expect(b).toEqual({ indiceAresta: 2, ponto: ponto(200, 300) });
  });

  it('vários elementos se emendam ponta com ponta, em qualquer ordem e em qualquer sentido', () => {
    const esquerda = [ponto(100, 150), ponto(0, 100)];
    const direita = [ponto(100.6, 150), ponto(200, 100)];
    const peca = molde({ linhasInternas: [esquerda, [ponto(20, 20), ponto(40, 20)], direita] });

    for (const ordem of [[0, 2], [2, 0]]) {
      const { a, b, miolo } = linhaDeCortePelosElementos(peca, ordem);
      const pontas = [a.ponto, b.ponto].sort((p, q) => p.x - q.x);
      expect(pontas).toEqual([ponto(0, 100), ponto(200, 100)]);
      expect(miolo).toHaveLength(1);
      expect(miolo[0]!.y).toBe(150);
    }
  });

  it('a emenda serve com o elemento em qualquer sentido, no começo ou no fim da linha', () => {
    const [esquerda, direita] = [[ponto(0, 100), ponto(100, 150)], [ponto(100, 150), ponto(200, 100)]];
    const aoContrario = (linha: readonly Ponto2D[]): Ponto2D[] => [...linha].reverse();
    // Cada par: o primeiro elemento indicado e o segundo, que emenda nele.
    const casos = [
      [esquerda, direita],
      [esquerda, aoContrario(direita)],
      [direita, esquerda],
      [direita, aoContrario(esquerda)],
      [aoContrario(esquerda), direita],
      [aoContrario(direita), aoContrario(esquerda)],
    ];
    for (const linhas of casos) {
      const { a, b, miolo } = linhaDeCortePelosElementos(molde({ linhasInternas: linhas }), [0, 1]);
      expect([a.ponto, b.ponto].sort((p, q) => p.x - q.x)).toEqual([ponto(0, 100), ponto(200, 100)]);
      expect(miolo).toEqual([ponto(100, 150)]);
    }
  });

  it('três elementos em fila: o do meio pode ser indicado por último', () => {
    const peca = molde({ linhasInternas: [[ponto(0, 100), ponto(60, 120)], [ponto(140, 120), ponto(200, 100)], [ponto(60, 120), ponto(140, 120)]] });
    // Indicados o primeiro e o terceiro, o do meio ainda não emenda os dois…
    expect(() => linhaDeCortePelosElementos(peca, [0, 1])).toThrow(/não se emendam/);
    // …e com ele a linha fecha.
    expect(linhaDeCortePelosElementos(peca, [0, 1, 2]).miolo).toEqual([ponto(60, 120), ponto(140, 120)]);
  });

  it('a linha reta de vários pontos não deixa pontos no caminho', () => {
    const { miolo } = linhaDeCortePelosElementos(molde({ linhasInternas: [[ponto(0, 100), ponto(50, 100), ponto(120, 100), ponto(200, 100)]] }), [0]);
    expect(miolo).toEqual([]);
  });

  it('a curva suave, de pontos bem juntos, continua curva', () => {
    // Um arco de raio 5000 mm, com um ponto a cada 0,1 mm de corda: cada ponto sai menos de um milionésimo de milímetro da reta dos vizinhos.
    const arco = Array.from({ length: 2001 }, (_, i) => {
      const x = i * 0.1;
      return ponto(x, 150 - (x - 100) ** 2 / 10000);
    });
    const { miolo } = linhaDeCortePelosElementos(molde({ linhasInternas: [arco] }), [0]);
    const maisAlto = Math.max(...miolo.map((p) => p.y));

    expect(miolo.length).toBeGreaterThan(2);
    expect(maisAlto).toBeGreaterThan(149.99);
  });

  it('recusa o que não dá uma linha de borda a borda', () => {
    const peca = molde({
      linhasInternas: [
        [ponto(0, 100), ponto(100, 150)],
        [ponto(100, 200), ponto(200, 100)],
        [ponto(50, 50), ponto(150, 50), ponto(100, 120), ponto(50, 50)],
        [ponto(300, 50), ponto(400, 80)],
      ],
    });

    expect(() => linhaDeCortePelosElementos(peca, [])).toThrow(/ao menos um elemento/);
    expect(() => linhaDeCortePelosElementos(peca, [9])).toThrow(/não encontrado/);
    expect(() => linhaDeCortePelosElementos(peca, [0, 0])).toThrow(/não encontrado/);
    expect(() => linhaDeCortePelosElementos(peca, [0, 1])).toThrow(/não se emendam/);
    expect(() => linhaDeCortePelosElementos(peca, [2])).toThrow(/fecham uma volta/);
    expect(() => linhaDeCortePelosElementos(peca, [3])).toThrow(/não passa pela peça/);
  });
});

describe('cortarMoldePelosElementos', () => {
  it('divide a peça pela linha quebrada, e o elemento sai dela: virou a borda das duas partes', () => {
    const outra = [ponto(20, 20), ponto(60, 20)];
    const [maior, menor] = cortarMoldePelosElementos(molde({ linhasInternas: [outra, QUEBRADA] }), [1], ids());

    // Embaixo: 200 × 100 mais o triângulo de base 200 e altura 50.
    expect(area(menor.contorno)).toBeCloseTo(25000, 6);
    expect(area(maior.contorno)).toBeCloseTo(35000, 6);
    for (const parte of [maior, menor]) {
      expect(contem(parte.contorno, 100, 150)).toBe(true);
      expect(contem(parte.contorno, 0, 100)).toBe(true);
      expect(contem(parte.contorno, 200, 100)).toBe(true);
    }
    expect(maior.linhasInternas).toEqual([]);
    expect(menor.linhasInternas).toEqual([outra]);
    expect(maior.id).toBe('m1');
    expect(menor.id).toBe('novo-1');
  });

  it('prolongada, aparada ou por vários elementos, a conta é a da linha que ficou', () => {
    const prolongada = cortarMoldePelosElementos(molde({ linhasInternas: [[ponto(50, 100), ponto(100, 150), ponto(150, 100)]] }), [0], ids());
    // Embaixo: 200 × 50 mais o triângulo de base 200 e altura 100.
    expect(area(prolongada[1].contorno)).toBeCloseTo(20000, 6);

    const aparada = cortarMoldePelosElementos(molde({ linhasInternas: [[ponto(-50, 100), ponto(100, 150), ponto(250, 100)]] }), [0], ids());
    expect(area(aparada[1].contorno)).toBeCloseTo(200 * (100 + 50 / 3) + (200 * (50 - 50 / 3)) / 2, 6);

    const varios = cortarMoldePelosElementos(molde({ linhasInternas: [[ponto(100, 150), ponto(0, 100)], [ponto(100, 150), ponto(200, 100)]] }), [1, 0], ids());
    expect(area(varios[1].contorno)).toBeCloseTo(25000, 6);
    expect(varios[0].linhasInternas).toEqual([]);
    expect(varios[1].linhasInternas).toEqual([]);
  });

  it('com mais de um ponto no caminho, cada parte fecha pela linha na ordem certa', () => {
    // A linha sobe de (0, 100) a (60, 120), segue reta até (140, 120) e desce a (200, 100).
    const [maior, menor] = cortarMoldePelosElementos(molde({ linhasInternas: [[ponto(0, 100), ponto(60, 120), ponto(140, 120), ponto(200, 100)]] }), [0], ids());

    // Embaixo: 200 × 100 mais o trapézio de bases 200 e 80 e altura 20.
    expect(area(menor.contorno)).toBeCloseTo(20000 + 2800, 6);
    expect(area(maior.contorno)).toBeCloseTo(60000 - 22800, 6);
  });

  it('a linha interna que está na reta entre as duas pontas do corte fica: só os elementos indicados viram borda', () => {
    const naCorda = [ponto(50, 100), ponto(150, 100)];
    const [maior, menor] = cortarMoldePelosElementos(molde({ linhasInternas: [QUEBRADA, naCorda] }), [0], ids());

    expect(menor.linhasInternas).toEqual([naCorda]);
    expect(maior.linhasInternas).toEqual([]);
  });

  it('recusa a linha que sai da peça no caminho', () => {
    // No "L", a linha vai do braço de cima ao de baixo passando por fora, pelo canto que entra.
    const peca = molde({ contorno: EM_L, linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 80) }, linhasInternas: [[ponto(50, 250), ponto(150, 150), ponto(150, 50)]] });
    expect(() => cortarMoldePelosElementos(peca, [0], ids())).toThrow(/A linha de corte precisa ficar toda dentro da peça/);
  });

  it('recusa a linha que cruza a si mesma', () => {
    const peca = molde({ linhasInternas: [[ponto(0, 100), ponto(150, 200), ponto(150, 100), ponto(50, 200), ponto(200, 250)]] });
    expect(() => cortarMoldePelosElementos(peca, [0], ids())).toThrow(/cruza a si mesma/);
  });

  it('recusa a linha que passa por um furo', () => {
    const furo = [ponto(90, 110), ponto(110, 110), ponto(110, 140), ponto(90, 140)];
    const peca = molde({ furos: [furo], linhasInternas: [[ponto(0, 100), ponto(100, 130), ponto(200, 100)]] });
    expect(() => cortarMoldePelosElementos(peca, [0], ids())).toThrow(/A linha de corte passa por um furo/);
  });
});

describe('exigirCorteValido, com pontos no caminho', () => {
  it('aceita a linha por dentro e recusa a que tem dois pontos seguidos no mesmo lugar', () => {
    expect(() => exigirCorteValido(molde(), ponto(0, 100), ponto(200, 100), [ponto(100, 150)])).not.toThrow();
    expect(() => exigirCorteValido(molde(), ponto(0, 100), ponto(200, 100), [ponto(100, 150), ponto(100, 150.01)])).toThrow(/dois pontos seguidos no mesmo lugar/);
  });

  it('o ponto do caminho em cima do contorno é recusado: a linha tocaria a borda no meio', () => {
    expect(() => exigirCorteValido(molde(), ponto(0, 100), ponto(200, 100), [ponto(100, 300)])).toThrow(/toda dentro da peça/);
  });

  it('a reta que liga duas bordas por fora da peça, sem cruzar aresta nenhuma, é recusada pelo meio dela', () => {
    // No "L", de uma borda do canto que entra à outra: a reta fica toda no vazio.
    expect(() => exigirCorteValido(molde({ contorno: EM_L }), ponto(150, 100), ponto(100, 150))).toThrow(/A reta de corte precisa ficar toda dentro/);
    expect(() => exigirCorteValido(molde({ contorno: EM_L }), ponto(150, 100), ponto(100, 150), [ponto(140, 140)])).toThrow(/A linha de corte precisa ficar toda dentro/);
  });

  it('a reta continua com a mensagem dela', () => {
    expect(() => exigirCorteValido(molde({ contorno: EM_L }), ponto(50, 300), ponto(200, 50))).toThrow(/A reta de corte precisa ficar toda dentro/);
  });
});

describe('costura no corte que não é reto', () => {
  const COSTURA: OpcoesDeCorte = { costuraMm: 10, costuraNasDuas: true, piques: false, modo: 'reta', manterDistancias: true };
  // O canto da linha, deslocado: a costura dividida pelo cosseno de meio ângulo (aqui, 10 × √5 / 2).
  const NO_CANTO = (10 * Math.sqrt(5)) / 2;

  it('a borda do corte anda a costura para fora nas duas partes, e os dois trechos se encontram no canto', () => {
    const [maior, menor] = cortarMoldePelosElementos(molde({ linhasInternas: [QUEBRADA] }), [0], ids(), COSTURA);

    // Embaixo o canto é saliente: a faixa de 10 mm ao longo dos dois trechos mais o que falta no canto (10² × tan de meio ângulo = 50).
    const faixa = 2 * 10 * Math.hypot(100, 50);
    expect(area(menor.contorno)).toBeCloseTo(25000 + faixa + 50, 6);
    expect(contem(menor.contorno, 100, 150 + NO_CANTO)).toBe(true);
    // Em cima o canto entra na peça: a faixa menos a sobreposição.
    expect(area(maior.contorno)).toBeCloseTo(35000 + faixa - 50, 6);
    expect(contem(maior.contorno, 100, 150 - NO_CANTO)).toBe(true);
    // O ponto da linha do corte deu lugar ao canto deslocado.
    expect(contem(menor.contorno, 100, 150)).toBe(false);
    expect(contem(maior.contorno, 100, 150)).toBe(false);
  });

  it('num canto que não é simétrico, o ponto novo fica a uma costura de cada um dos dois trechos', () => {
    // A linha sobe de (0, 100) a (100, 150) e segue deitada até (200, 150).
    const [, menor] = cortarMoldePelosElementos(molde({ linhasInternas: [[ponto(0, 100), ponto(100, 150), ponto(200, 150)]] }), [0], ids(), { ...COSTURA, costuraNasDuas: false });
    const canto = menor.contorno.reduce((melhor, p) => (Math.hypot(p.x - 100, p.y - 160) < Math.hypot(melhor.x - 100, melhor.y - 160) ? p : melhor));
    // Distância à reta deitada (y = 150) e à reta inclinada, que passa por (0, 100) com a direção (2, 1) / √5.
    const daDeitada = canto.y - 150;
    const daInclinada = ((canto.y - 100) * 2 - canto.x) / Math.sqrt(5);

    expect(daDeitada).toBeCloseTo(10, 9);
    expect(daInclinada).toBeCloseTo(10, 9);
    expect(contem(menor.contorno, 100, 150)).toBe(false);
  });

  it('no modo reta as pontas saem em esquadro com o trecho que chega nelas', () => {
    const [, menor] = cortarMoldePelosElementos(molde({ linhasInternas: [QUEBRADA] }), [0], ids(), { ...COSTURA, costuraNasDuas: false });
    // O trecho de (200, 100) a (100, 150) tem o lado de fora, na parte de baixo, em (1, 2) / √5.
    const fora = ponto(10 / Math.sqrt(5), 20 / Math.sqrt(5));

    expect(contem(menor.contorno, 200, 100)).toBe(true);
    expect(contem(menor.contorno, 200 + fora.x, 100 + fora.y)).toBe(true);
    expect(contem(menor.contorno, 0 - fora.x, 100 + fora.y)).toBe(true);
    expect(contem(menor.contorno, 0, 100)).toBe(true);
  });

  it('no modo tangente a ponta segue a aresta vizinha até a borda nova', () => {
    const [, menor] = cortarMoldePelosElementos(molde({ linhasInternas: [QUEBRADA] }), [0], ids(), { ...COSTURA, costuraNasDuas: false, modo: 'tangente' });
    // A aresta em pé (x = 200) sobe até encontrar a borda deslocada: 10 / cos do ângulo entre a aresta e o lado de fora (2 / √5).
    const subida = (10 * Math.sqrt(5)) / 2;

    expect(contem(menor.contorno, 200, 100 + subida)).toBe(true);
    expect(contem(menor.contorno, 0, 100 + subida)).toBe(true);
    expect(contem(menor.contorno, 200, 100)).toBe(false);
  });

  it('com pique, um em cada ponta da linha do corte', () => {
    const [maior, menor] = cortarMoldePelosElementos(molde({ linhasInternas: [QUEBRADA] }), [0], ids(), { ...COSTURA, costuraNasDuas: false, piques: true });

    expect(maior.piques).toHaveLength(0);
    expect(menor.piques.map((p) => p.posicao)).toEqual([ponto(200, 100), ponto(0, 100)]);
  });

  it('num bico fino, cada lado acaba no seu ponto em vez de um canto que iria longe', () => {
    // Um bico de 20 mm de base e 100 de altura no meio da linha do corte.
    const bico = [ponto(0, 100), ponto(90, 100), ponto(100, 200), ponto(110, 100), ponto(200, 100)];
    const [, menor] = cortarMoldePelosElementos(molde({ linhasInternas: [bico] }), [0], ids(), { ...COSTURA, costuraNasDuas: false, costuraMm: 15 });
    const maisAlto = Math.max(...menor.contorno.map((p) => p.y));

    // O canto inteiro ficaria a 15 / sen(meio ângulo do bico) ≈ 150 mm da ponta; cortado, a borda não passa de 15 mm dela.
    expect(maisAlto).toBeLessThan(200 + 15);
    expect(maisAlto).toBeGreaterThan(200);
    expect(menor.contorno.filter((p) => p.y > 190)).toHaveLength(2);
  });

  it('recusa a costura que não cabe: a borda nova cruzaria a si mesma', () => {
    // O mesmo bico: na parte de cima ele é uma fenda de 20 mm, e 15 mm de costura de cada lado não cabem nela.
    const bico = [ponto(0, 100), ponto(90, 100), ponto(100, 200), ponto(110, 100), ponto(200, 100)];
    const peca = molde({ linhasInternas: [bico] });

    expect(() => cortarMoldePelosElementos(peca, [0], ids(), { ...COSTURA, costuraMm: 15 })).toThrow(/A costura não cabe nessa linha de corte/);
    expect(() => cortarMoldePelosElementos(peca, [0], ids(), { ...COSTURA, costuraMm: 15, costuraNasDuas: false })).not.toThrow();
  });
});

describe('graduação no corte que não é reto', () => {
  /** A peça com dois tamanhos (M, o base, e G) e, no G, o canto (200, 0) 20 mm para a direita. */
  const graduada = (): Molde => {
    const peca = definirTamanhosDoMolde(molde({ linhasInternas: [[ponto(50, 0), ponto(100, 150), ponto(50, 300)]] }), ['M', 'G'], 'M');
    return { ...peca, graduacao: definirRegra(peca.graduacao!, peca.contorno, em(peca, 200, 0), [ponto(0, 0), ponto(20, 0)]) };
  };
  const SEM_COSTURA: OpcoesDeCorte = { costuraMm: 0, costuraNasDuas: false, piques: false, modo: 'tangente', manterDistancias: true };

  it('com “Manter distâncias”, as pontas levam a regra da aresta inteira e a linha do corte cai no mesmo lugar nas duas partes', () => {
    const [maior, menor] = cortarMoldePelosElementos(graduada(), [0], ids(), SEM_COSTURA);

    for (const parte of [maior, menor]) {
      // O ponto (50, 0), a um quarto da aresta de baixo, vai 5 mm; o de cima não anda.
      expect(regraDoVertice(parte.graduacao!, parte.contorno, em(parte, 50, 0))[1]).toEqual(ponto(5, 0));
      expect(regraDoVertice(parte.graduacao!, parte.contorno, em(parte, 50, 300))[1]).toEqual(ponto(0, 0));
    }
    // O ponto do caminho anda entre uma ponta e a outra, igual nas duas partes.
    const noMaior = regraDoVertice(maior.graduacao!, maior.contorno, em(maior, 100, 150))[1]!;
    const noMenor = regraDoVertice(menor.graduacao!, menor.contorno, em(menor, 100, 150))[1]!;
    expect(noMaior.x).toBeCloseTo(2.5, 9);
    expect(noMenor.x).toBeCloseTo(2.5, 9);
    expect(noMaior.y).toBeCloseTo(0, 9);
    // E no tamanho G as duas partes continuam encaixando pela linha do corte: juntas, têm a área da peça inteira no G (60000 mais o triângulo de 20 × 300).
    const [maiorNoG, menorNoG] = [moldeDoTamanho(maior, 1, 'g1'), moldeDoTamanho(menor, 1, 'g2')];
    expect(area(moldeDoTamanho(graduada(), 1, 'g0').contorno)).toBeCloseTo(63000, 6);
    expect(area(maiorNoG.contorno) + area(menorNoG.contorno)).toBeCloseTo(63000, 6);
  });

  it('o corte reto continua tirando só as linhas que estão em cima da reta', () => {
    const peca = molde({ linhasInternas: [[ponto(50, 0), ponto(50, 300)], [ponto(50, 0), ponto(100, 150), ponto(50, 300)]] });
    const [maior, menor] = cortarMoldeComOpcoes(peca, { indiceAresta: 0, ponto: ponto(50, 0) }, { indiceAresta: 2, ponto: ponto(50, 300) }, ids());

    expect(maior.linhasInternas).toHaveLength(1);
    expect(menor.linhasInternas).toHaveLength(0);
  });
});

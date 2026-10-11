import { describe, it, expect } from 'vitest';
import { area, distancia, ponto, rotacionar, type Ponto2D, type PosicaoNoContorno } from '../core/geometria';
import { definirRegra, regraDoVertice } from './graduacao';
import { adicionarMarca, adicionarPique, criarMolde, type DadosDeNovoMolde, type Molde } from './molde';
import { abrirPelasIntersecoes, cruzaOContornoMaisDeDuasVezes } from './penceComIntersecoes';
import { abrirPence, pencesDaPeca } from './pences';
import { definirTamanhosDoMolde } from './tamanhosGraduados';

// Um "C" de 200 × 300 mm, anti-horário, com um recorte de 100 × 100 entrando pela direita, a meia altura.
// A haste é x de 0 a 100; os dois braços vão até x = 200 (o de baixo, y de 0 a 100; o de cima, de 200 a 300).
const EM_C = [ponto(0, 0), ponto(200, 0), ponto(200, 100), ponto(100, 100), ponto(100, 200), ponto(200, 200), ponto(200, 300), ponto(0, 300)];
// Um "E" de 200 × 500 mm: a haste e três braços de 100 × 100, com dois recortes entre eles.
const EM_E = [
  ponto(0, 0), ponto(200, 0), ponto(200, 100), ponto(100, 100), ponto(100, 200), ponto(200, 200),
  ponto(200, 300), ponto(100, 300), ponto(100, 400), ponto(200, 400), ponto(200, 500), ponto(0, 500),
];
// A linha em pé em x = 150: entra pelo braço de cima, sai, atravessa o recorte por fora e entra no braço de baixo.
const POSICAO: PosicaoNoContorno = { indiceAresta: 6, ponto: ponto(150, 300) };
const PIVO: PosicaoNoContorno = { indiceAresta: 0, ponto: ponto(150, 0) };
// O giro que abre 30 mm a 300 mm do pivô.
const GRAUS = (2 * Math.asin(30 / 600) * 180) / Math.PI;
const SENO = Math.sin((GRAUS * Math.PI) / 180);

function molde(sobrescrever: Partial<DadosDeNovoMolde> = {}): Molde {
  return criarMolde(
    // A linha de fio na haste: ela fica, e as pontas dos braços giram.
    { nome: 'Gola', referencia: 'REF-001', tamanho: 'M', contorno: EM_C, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) }, ...sobrescrever },
    'm1',
  );
}

function ids(): () => string {
  let n = 0;
  return () => `novo-${++n}`;
}

const perto = (a: Ponto2D, b: Ponto2D): boolean => distancia(a, b) < 1e-6;
const contem = (linha: readonly Ponto2D[], p: Ponto2D): boolean => linha.some((v) => perto(v, p));
/** O ponto depois do giro das pontas dos braços: horário, em torno do pivô. */
const girado = (p: Ponto2D): Ponto2D => rotacionar(p, PIVO.ponto, -GRAUS);

describe('cruzaOContornoMaisDeDuasVezes', () => {
  it('reconhece a linha que sai da peça e volta', () => {
    expect(cruzaOContornoMaisDeDuasVezes(EM_C, ponto(150, 300), ponto(150, 0))).toBe(true);
    // Pela haste, a linha fica toda dentro: cruza só nas duas pontas.
    expect(cruzaOContornoMaisDeDuasVezes(EM_C, ponto(50, 300), ponto(50, 0))).toBe(false);
    expect(cruzaOContornoMaisDeDuasVezes(EM_C, ponto(150, 300), ponto(150, 300))).toBe(false);
    // A linha em cima da borda do recorte não conta como cruzamento a mais.
    expect(cruzaOContornoMaisDeDuasVezes(EM_C, ponto(100, 300), ponto(100, 0))).toBe(false);
  });
});

describe('abrirPelasIntersecoes', () => {
  it('a linha toda dentro da peça não é disso: quem abre é a pence de sempre', () => {
    expect(abrirPelasIntersecoes(molde(), { indiceAresta: 6, ponto: ponto(50, 300) }, { indiceAresta: 0, ponto: ponto(50, 0) }, 30, false, ids())).toBeNull();
  });

  it('corta em todos os trechos da linha, gira o lado sem a linha de fio e enche de tecido o que abriu', () => {
    const aberta = abrirPelasIntersecoes(molde(), POSICAO, PIVO, 30, false, ids())!;

    // A posição abriu a medida pedida, em linha reta.
    expect(contem(aberta.contorno, ponto(150, 300))).toBe(true);
    expect(contem(aberta.contorno, girado(ponto(150, 300)))).toBe(true);
    expect(distancia(ponto(150, 300), girado(ponto(150, 300)))).toBeCloseTo(30, 9);
    // As pontas dos dois braços giraram juntas; a haste ficou.
    for (const p of [ponto(200, 0), ponto(200, 100), ponto(200, 200), ponto(200, 300)]) {
      expect(contem(aberta.contorno, girado(p))).toBe(true);
      expect(contem(aberta.contorno, p)).toBe(false);
    }
    for (const p of [ponto(0, 0), ponto(0, 300), ponto(100, 100), ponto(100, 200)]) expect(contem(aberta.contorno, p)).toBe(true);
    // Em cada travessia do meio, a borda que ficou e a que andou: o contorno fecha o que abriu entre elas.
    for (const p of [ponto(150, 100), ponto(150, 200)]) {
      expect(contem(aberta.contorno, p)).toBe(true);
      expect(contem(aberta.contorno, girado(p))).toBe(true);
    }
    // O pivô não saiu do lugar, e não ficou repetido.
    expect(aberta.contorno.filter((p) => perto(p, ponto(150, 0)))).toHaveLength(1);
    expect(aberta.contorno).toHaveLength(15);
    // O tecido novo: a cunha de cada trecho — meio seno do giro vezes (300² − 200²) em cima e 100² embaixo.
    expect(area(aberta.contorno)).toBeCloseTo(50000 + (SENO / 2) * (300 ** 2 - 200 ** 2 + 100 ** 2), 6);
  });

  it('as duas bordas de cada trecho ficam desenhadas; não há vértice nem registro de pence', () => {
    const aberta = abrirPence(molde(), POSICAO, PIVO, 30, 80, false, ids(), true, true, true);

    expect(aberta.linhasInternas).toHaveLength(4);
    expect(aberta.linhasInternas[0]).toEqual([ponto(150, 300), ponto(150, 200)]);
    expect(perto(aberta.linhasInternas[1]![0]!, girado(ponto(150, 300)))).toBe(true);
    expect(perto(aberta.linhasInternas[1]![1]!, girado(ponto(150, 200)))).toBe(true);
    expect(aberta.linhasInternas[2]).toEqual([ponto(150, 100), ponto(150, 0)]);
    expect(perto(aberta.linhasInternas[3]![0]!, girado(ponto(150, 100)))).toBe(true);
    expect(perto(aberta.linhasInternas[3]![1]!, ponto(150, 0))).toBe(true);
    // A profundidade, a marca no vértice e o acabamento não contam aqui.
    expect(aberta.marcas).toHaveLength(0);
    expect(pencesDaPeca(aberta)).toHaveLength(0);
    expect(aberta.piques).toHaveLength(0);
  });

  it('com piques laterais, um em cada borda da abertura, na posição', () => {
    const aberta = abrirPelasIntersecoes(molde(), POSICAO, PIVO, 30, true, ids())!;

    expect(aberta.piques).toHaveLength(2);
    expect(perto(aberta.piques[0]!.posicao, ponto(150, 300))).toBe(true);
    expect(perto(aberta.piques[1]!.posicao, girado(ponto(150, 300)))).toBe(true);
  });

  it('o que está nas pontas dos braços gira com elas; o que está na haste fica', () => {
    let peca = adicionarMarca(molde(), ponto(180, 250), 'no-braco-de-cima');
    peca = adicionarMarca(peca, ponto(180, 50), 'no-braco-de-baixo');
    peca = adicionarMarca(peca, ponto(50, 150), 'na-haste');
    peca = adicionarPique(peca, ponto(200, 250), 'pique-do-braco');
    peca = adicionarPique(peca, ponto(0, 150), 'pique-da-haste');
    const aberta = abrirPelasIntersecoes({ ...peca, linhasInternas: [[ponto(160, 220), ponto(190, 280)], [ponto(20, 20), ponto(80, 20)]] }, POSICAO, PIVO, 30, false, ids())!;
    const marca = (id: string): Ponto2D => aberta.marcas.find((m) => m.id === id)!.posicao;
    const pique = (id: string): Ponto2D => aberta.piques.find((q) => q.id === id)!.posicao;

    expect(perto(marca('no-braco-de-cima'), girado(ponto(180, 250)))).toBe(true);
    expect(perto(marca('no-braco-de-baixo'), girado(ponto(180, 50)))).toBe(true);
    expect(marca('na-haste')).toEqual(ponto(50, 150));
    expect(perto(pique('pique-do-braco'), girado(ponto(200, 250)))).toBe(true);
    expect(pique('pique-da-haste')).toEqual(ponto(0, 150));
    expect(perto(aberta.linhasInternas[0]![0]!, girado(ponto(160, 220)))).toBe(true);
    expect(aberta.linhasInternas[1]).toEqual([ponto(20, 20), ponto(80, 20)]);
  });

  it('com a linha de fio num braço, quem fica são as pontas dos braços, e a haste gira para o outro lado', () => {
    const aberta = abrirPelasIntersecoes(molde({ linhaDeFio: { inicio: ponto(175, 220), fim: ponto(175, 280) } }), POSICAO, PIVO, 30, false, ids())!;
    const paraOOutroLado = (p: Ponto2D): Ponto2D => rotacionar(p, PIVO.ponto, GRAUS);

    for (const p of [ponto(200, 0), ponto(200, 100), ponto(200, 200), ponto(200, 300)]) expect(contem(aberta.contorno, p)).toBe(true);
    for (const p of [ponto(0, 0), ponto(0, 300), ponto(100, 100), ponto(100, 200)]) expect(contem(aberta.contorno, paraOOutroLado(p))).toBe(true);
    expect(area(aberta.contorno)).toBeCloseTo(50000 + (SENO / 2) * (300 ** 2 - 200 ** 2 + 100 ** 2), 6);
  });

  it('com a linha de fio fora de todas as partes, fica o lado de mais área', () => {
    // O meio da linha de fio cai no recorte, fora da peça: a haste (400 cm²) fica, e as pontas dos braços (100 cm²) giram.
    const aberta = abrirPelasIntersecoes(molde({ linhaDeFio: { inicio: ponto(150, 120), fim: ponto(150, 180) } }), POSICAO, PIVO, 30, false, ids())!;

    for (const p of [ponto(0, 0), ponto(0, 300), ponto(100, 100), ponto(100, 200)]) expect(contem(aberta.contorno, p)).toBe(true);
    for (const p of [ponto(200, 0), ponto(200, 300)]) expect(contem(aberta.contorno, girado(p))).toBe(true);
  });

  it('na peça graduada, os pontos que giram levam a regra girada', () => {
    const graduada = definirTamanhosDoMolde(molde(), ['M', 'G'], 'M');
    const peca = { ...graduada, graduacao: definirRegra(graduada.graduacao!, graduada.contorno, 6, [ponto(0, 0), ponto(0, 10)]) };
    const aberta = abrirPelasIntersecoes(peca, POSICAO, PIVO, 30, false, ids())!;
    const indice = aberta.contorno.findIndex((p) => perto(p, girado(ponto(200, 300))));
    const regra = regraDoVertice(aberta.graduacao!, aberta.contorno, indice)[1]!;

    // (0, 10) girado no sentido horário: vai um pouco para a direita.
    expect(regra.x).toBeCloseTo(10 * SENO, 9);
    expect(regra.y).toBeCloseTo(10 * Math.cos((GRAUS * Math.PI) / 180), 9);
  });

  it('num "E", a linha atravessa os três braços: abre nos três trechos, e as três pontas giram juntas', () => {
    const pivo: PosicaoNoContorno = { indiceAresta: 0, ponto: ponto(150, 0) };
    const aberta = abrirPelasIntersecoes(molde({ contorno: EM_E }), { indiceAresta: 10, ponto: ponto(150, 500) }, pivo, 30, false, ids())!;
    const graus = (2 * Math.asin(30 / 1000) * 180) / Math.PI;
    const seno = Math.sin((graus * Math.PI) / 180);

    for (const p of [ponto(200, 0), ponto(200, 100), ponto(200, 200), ponto(200, 300), ponto(200, 400), ponto(200, 500)]) {
      expect(contem(aberta.contorno, rotacionar(p, pivo.ponto, -graus))).toBe(true);
    }
    expect(aberta.linhasInternas).toHaveLength(6);
    expect(area(aberta.contorno)).toBeCloseTo(80000 + (seno / 2) * (500 ** 2 - 400 ** 2 + 300 ** 2 - 200 ** 2 + 100 ** 2), 6);
  });

  it('recusa o que não dá para abrir assim', () => {
    const abrir = (posicao: PosicaoNoContorno, pivo: PosicaoNoContorno, abertura = 30, peca = molde()): unknown => abrirPelasIntersecoes(peca, posicao, pivo, abertura, false, ids());

    // O pivô na borda de dentro do recorte: a linha sai da peça e não volta a entrar antes dele.
    expect(() => abrir(POSICAO, { indiceAresta: 2, ponto: ponto(150, 100) })).toThrow(/precisa ficar toda dentro da peça/);
    // Num "E", o pivô na borda de dentro do terceiro braço: a linha chega nele por fora da peça.
    expect(() => abrir({ indiceAresta: 10, ponto: ponto(150, 500) }, { indiceAresta: 2, ponto: ponto(150, 100) }, 30, molde({ contorno: EM_E }))).toThrow(/precisa atravessar o contorno na posição e no pivô/);
    // A linha em cima da borda do recorte.
    expect(() => abrir({ indiceAresta: 6, ponto: ponto(100, 300) }, { indiceAresta: 0, ponto: ponto(100, 0) })).toThrow(/corre por cima de uma borda/);
    // A abertura maior que a distância até o pivô.
    expect(() => abrir(POSICAO, PIVO, 300)).toThrow(/abertura é grande demais/);
    // Um furo no caminho.
    const comFuro = molde({ furos: [[ponto(140, 240), ponto(160, 240), ponto(160, 260), ponto(140, 260)]] });
    expect(() => abrir(POSICAO, PIVO, 30, comFuro)).toThrow(/passa por um furo/);
    // A linha que só sai da peça, sem voltar a entrar: dois pontos na mesma borda de fora, por fora.
    const convexa = molde({ contorno: [ponto(0, 0), ponto(200, 0), ponto(100, 300)], linhaDeFio: { inicio: ponto(100, 50), fim: ponto(100, 150) } });
    expect(() => abrir({ indiceAresta: 0, ponto: ponto(50, 0) }, { indiceAresta: 0, ponto: ponto(150, 0) }, 30, convexa)).toThrow();
  });

  it('a peça que dá a volta por fora da ponta da linha (em caracol) é recusada: os dois lados da linha são o mesmo pedaço de tecido', () => {
    // O "C" com um braço a mais, que sai do alto da haste, passa por cima da posição da pence, desce pela direita e volta para dentro do vão,
    // atravessando a linha entre os dois braços. O trecho do contorno que sai da posição pela esquerda chega à travessia seguinte pela direita.
    const emCaracol = [
      ponto(0, 0), ponto(200, 0), ponto(200, 100), ponto(100, 100), ponto(100, 200), ponto(200, 200), ponto(200, 300), ponto(100, 300),
      ponto(100, 350), ponto(250, 350), ponto(250, 170), ponto(120, 170), ponto(120, 130), ponto(300, 130), ponto(300, 400), ponto(0, 400),
    ];
    const peca = molde({ contorno: emCaracol });
    // A linha entra e sai da peça três vezes entre a posição e o pivô.
    expect(cruzaOContornoMaisDeDuasVezes(emCaracol, ponto(150, 300), ponto(150, 0))).toBe(true);

    expect(() => abrirPelasIntersecoes(peca, { indiceAresta: 6, ponto: ponto(150, 300) }, PIVO, 30, false, ids())).toThrow(/dá a volta por fora da linha/);
    // Sem o braço a mais, a mesma linha abre a peça.
    expect(abrirPelasIntersecoes(molde(), POSICAO, PIVO, 30, false, ids())).not.toBeNull();
  });

  it('a linha que encosta num canto do contorno sem atravessar é recusada', () => {
    // Um bico que desce do braço de cima até tocar a linha em (150, 250)… por dentro não há como: o toque é num canto de um recorte.
    const comToque = [ponto(0, 0), ponto(200, 0), ponto(200, 100), ponto(100, 100), ponto(100, 200), ponto(200, 200), ponto(200, 240), ponto(150, 250), ponto(200, 260), ponto(200, 300), ponto(0, 300)];
    const peca = molde({ contorno: comToque });
    expect(() => abrirPelasIntersecoes(peca, { indiceAresta: 9, ponto: ponto(150, 300) }, PIVO, 30, false, ids())).toThrow(/encosta no contorno sem atravessar/);
  });
});

describe('abrirPence com “Cortar intersecções”', () => {
  it('sem a opção, a linha que sai da peça é recusada, e a mensagem aponta a opção', () => {
    expect(() => abrirPence(molde(), POSICAO, PIVO, 30, 80, false, ids())).toThrow(/sai da peça no caminho\. Com “Cortar intersecções” ligado/);
  });

  it('com a opção e a linha toda dentro da peça, é a pence aberta de sempre, com vértice e registro', () => {
    const aberta = abrirPence(molde(), { indiceAresta: 6, ponto: ponto(50, 300) }, { indiceAresta: 0, ponto: ponto(50, 0) }, 30, 80, false, ids(), false, false, true);

    expect(pencesDaPeca(aberta)).toHaveLength(1);
    expect(pencesDaPeca(aberta)[0]!.pivo).toEqual(ponto(50, 0));
    expect(aberta.linhasInternas).toHaveLength(0);
  });

  it('a linha que sai da peça por outro motivo continua com a mensagem de sempre', () => {
    // Do braço de cima à borda de dentro do braço de baixo, em diagonal, passando pelo recorte: só duas travessias contam, mas a reta sai da peça.
    const convexa = molde({ contorno: [ponto(0, 0), ponto(200, 0), ponto(100, 300)], linhaDeFio: { inicio: ponto(100, 50), fim: ponto(100, 150) } });
    expect(() => abrirPence(convexa, { indiceAresta: 0, ponto: ponto(50, 0) }, { indiceAresta: 0, ponto: ponto(150, 0) }, 30, 80, false, ids())).toThrow(/precisa ficar toda dentro da peça/);
  });
});

import { describe, it, expect } from 'vitest';
import { area, distancia, ponto, type Ponto2D, type PosicaoNoContorno } from '../core/geometria';
import { adicionarMarca, adicionarPique, criarMolde, type DadosDeNovoMolde, type Molde } from './molde';
import {
  abrirPence,
  criarMultiplasPences,
  criarPence,
  criarPenceInterna,
  ehVerticeDePence,
  fecharPence,
  geometriaDaPence,
  transferirPence,
  type OpcoesDePence,
  type OpcoesDePenceInterna,
} from './pences';

// Retângulo de 200 × 300 mm, anti-horário: arestas 0 (y = 0), 1 (x = 200), 2 (y = 300, de x = 200 a x = 0) e 3 (x = 0).
const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
// O mesmo retângulo com uma pence recortada em cima: abertura 40, profundidade 100, vértice em (100, 200) (o ponto 5).
const COM_PENCE = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(120, 300), ponto(100, 200), ponto(80, 300), ponto(0, 300)];
const VERTICE = 4;
// A peça com a pence e com uma mordida retangular na lateral direita (x de 150 a 200, y de 100 a 150).
const COM_PENCE_E_MORDIDA = [
  ponto(0, 0),
  ponto(200, 0),
  ponto(200, 100),
  ponto(150, 100),
  ponto(150, 150),
  ponto(200, 150),
  ponto(200, 300),
  ponto(120, 300),
  ponto(100, 200),
  ponto(80, 300),
  ponto(0, 300),
];
const VERTICE_COM_MORDIDA = 8;

/** Linha de fio à esquerda (x = 50): o lado esquerdo da peça é o que fica parado quando ela abre ou gira. */
function molde(sobrescrever: Partial<DadosDeNovoMolde> = {}): Molde {
  return criarMolde(
    {
      nome: 'Frente',
      referencia: 'REF-001',
      tamanho: 'M',
      contorno: RETANGULO,
      linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) },
      ...sobrescrever,
    },
    'm1',
  );
}

function na(indiceAresta: number, x: number, y: number): PosicaoNoContorno {
  return { indiceAresta, ponto: ponto(x, y) };
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

const RECORTAR: OpcoesDePence = { aberturaMm: 40, profundidadeMm: 100, modo: 'recortar', piquesLaterais: false, marcaNoVertice: false };
const MARCAR: OpcoesDePence = { ...RECORTAR, modo: 'marcar' };
const NO_ALTO = na(2, 100, 300);

describe('criarPence, recortada', () => {
  it('o contorno entra pela pence até o vértice; a peça perde o triângulo', () => {
    const comPence = criarPence(molde(), NO_ALTO, RECORTAR, ids());
    esperarPontos(comPence.contorno, COM_PENCE);
    // Triângulo de base 40 e altura 100.
    expect(area(comPence.contorno)).toBeCloseTo(60000 - 2000, 6);
  });

  it('as pontas ficam a meia abertura de cada lado, e o vértice em esquadro, à profundidade pedida', () => {
    const { inicio, fim, vertice } = geometriaDaPence(molde(), NO_ALTO, 40, 100);
    expect(inicio.ponto).toEqual(ponto(120, 300));
    expect(fim.ponto).toEqual(ponto(80, 300));
    esperarPontos([vertice], [ponto(100, 200)]);
  });

  it('com um ponto para apontar, o vértice vai na direção dele, à profundidade pedida', () => {
    const { vertice } = geometriaDaPence(molde(), NO_ALTO, 40, 100, ponto(160, 220));
    // De (100, 300) para (160, 220): direção (0,6; −0,8).
    esperarPontos([vertice], [ponto(160, 220)]);
    expect(distancia(vertice, ponto(100, 300))).toBeCloseTo(100, 6);
  });

  it('com piques laterais, cada ponta da pence ganha um; os piques que estavam na abertura saem', () => {
    const original = adicionarPique(adicionarPique(molde(), ponto(100, 300), 'na-abertura'), ponto(0, 150), 'lateral');
    const comPence = criarPence(original, NO_ALTO, { ...RECORTAR, piquesLaterais: true }, ids());
    expect(comPence.piques.map((p) => p.id)).toEqual(['lateral', 'novo-1', 'novo-2']);
    expect(comPence.piques.slice(1).map((p) => p.posicao)).toEqual([ponto(120, 300), ponto(80, 300)]);
  });

  it('numa peça desenhada no sentido horário, a pence também entra na peça', () => {
    const horaria = molde({ contorno: [ponto(0, 0), ponto(0, 300), ponto(200, 300), ponto(200, 0)] });
    const comPence = criarPence(horaria, na(1, 100, 300), RECORTAR, ids());
    expect(area(comPence.contorno)).toBeCloseTo(58000, 6);
    expect(comPence.contorno.some((p) => Math.abs(p.x - 100) < 1e-6 && Math.abs(p.y - 200) < 1e-6)).toBe(true);
  });

  it('a pence num canto abre meia abertura para cada aresta', () => {
    const { inicio, fim } = geometriaDaPence(molde(), na(2, 200, 300), 40, 50);
    expect(inicio.ponto).toEqual(ponto(200, 280));
    expect(fim.ponto).toEqual(ponto(180, 300));
  });

  it('recusa abertura ou profundidade que não seja maior que zero', () => {
    expect(() => criarPence(molde(), NO_ALTO, { ...RECORTAR, aberturaMm: 0 }, ids())).toThrow(/abertura/);
    expect(() => criarPence(molde(), NO_ALTO, { ...RECORTAR, profundidadeMm: -5 }, ids())).toThrow(/profundidade/);
    expect(() => criarPence(molde(), NO_ALTO, { ...RECORTAR, aberturaMm: Number.NaN }, ids())).toThrow(/abertura/);
  });

  it('recusa a pence cujo vértice cairia fora da peça, ou dentro de um furo', () => {
    expect(() => criarPence(molde(), NO_ALTO, { ...RECORTAR, profundidadeMm: 400 }, ids())).toThrow(/fora da peça/);
    const comFuro = molde({ furos: [[ponto(80, 180), ponto(120, 180), ponto(120, 220), ponto(80, 220)]] });
    expect(() => criarPence(comFuro, NO_ALTO, RECORTAR, ids())).toThrow(/fora da peça/);
  });

  it('recusa a pence que aponta para fora, e a que cruza o contorno no caminho', () => {
    expect(() => geometriaDaPence(molde(), NO_ALTO, 40, 100, ponto(100, 400))).toThrow(/para dentro/);
    // Um "L": a pence sai de cima do braço e aponta para o outro braço, passando por fora.
    const emL = molde({
      contorno: [ponto(0, 0), ponto(300, 0), ponto(300, 100), ponto(100, 100), ponto(100, 300), ponto(0, 300)],
      linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 80) },
    });
    expect(() => geometriaDaPence(emL, na(4, 50, 300), 40, 320, ponto(280, 50))).toThrow(/cruzaria o contorno/);
  });

  it('recusa a abertura do tamanho de metade do perímetro', () => {
    expect(() => geometriaDaPence(molde(), NO_ALTO, 500, 50)).toThrow(/grande demais/);
  });
});

describe('criarPence, marcada', () => {
  it('o contorno não muda; as duas pernas entram como uma linha interna', () => {
    const comPence = criarPence(molde(), NO_ALTO, MARCAR, ids());
    expect(comPence.contorno).toEqual(RETANGULO);
    expect(comPence.linhasInternas).toHaveLength(1);
    esperarPontos(comPence.linhasInternas[0]!, [ponto(120, 300), ponto(100, 200), ponto(80, 300)]);
    expect(comPence.piques).toEqual([]);
    expect(comPence.marcas).toEqual([]);
  });

  it('com piques laterais e marca no vértice', () => {
    const comPence = criarPence(molde(), NO_ALTO, { ...MARCAR, piquesLaterais: true, marcaNoVertice: true }, ids());
    expect(comPence.piques.map((p) => [p.posicao, p.indiceAresta])).toEqual([
      [ponto(120, 300), 2],
      [ponto(80, 300), 2],
    ]);
    expect(comPence.marcas).toHaveLength(1);
    esperarPontos([comPence.marcas[0]!.posicao], [ponto(100, 200)]);
    expect(new Set([...comPence.piques.map((p) => p.id), comPence.marcas[0]!.id]).size).toBe(3);
  });
});

describe('criarMultiplasPences', () => {
  it('reparte as pences por igual dos dois lados da posição', () => {
    const opcoes = { ...RECORTAR, aberturaMm: 20, profundidadeMm: 60 };
    const comPences = criarMultiplasPences(molde(), NO_ALTO, 3, 50, opcoes, ids());
    // Três triângulos de base 20 e altura 60.
    expect(area(comPences.contorno)).toBeCloseTo(60000 - 3 * 600, 6);
    expect(comPences.contorno).toHaveLength(4 + 3 * 3);
    const vertices = comPences.contorno.filter((p) => Math.abs(p.y - 240) < 1e-6).map((p) => Math.round(p.x));
    expect(vertices.sort((x, y) => x - y)).toEqual([50, 100, 150]);
  });

  it('com número par, a posição fica no meio de duas pences', () => {
    const comPences = criarMultiplasPences(molde(), NO_ALTO, 2, 60, { ...MARCAR, aberturaMm: 20, profundidadeMm: 60 }, ids());
    expect(comPences.linhasInternas).toHaveLength(2);
    esperarPontos(comPences.linhasInternas[0]!, [ponto(140, 300), ponto(130, 240), ponto(120, 300)]);
    esperarPontos(comPences.linhasInternas[1]!, [ponto(80, 300), ponto(70, 240), ponto(60, 300)]);
  });

  it('recusa quantidade fora de 2 a 20, e distância que não passa da abertura', () => {
    for (const quantidade of [1, 0, 2.5, 21]) {
      expect(() => criarMultiplasPences(molde(), NO_ALTO, quantidade, 50, RECORTAR, ids())).toThrow(/número de pences/);
    }
    expect(() => criarMultiplasPences(molde(), NO_ALTO, 3, 40, RECORTAR, ids())).toThrow(/maior que a abertura/);
  });

  it('recusa as pences que não cabem no contorno', () => {
    expect(() => criarMultiplasPences(molde(), NO_ALTO, 20, 60, RECORTAR, ids())).toThrow(/não cabem/);
  });
});

describe('abrirPence', () => {
  // Corte de (100, 300) até o pivô (100, 0): 300 mm. Abertura de 60 mm: o giro é 2·asen(60 / 600).
  const GIRO = 2 * Math.asin(0.1);
  const posicao = na(2, 100, 300);
  const pivo = na(0, 100, 0);

  it('o lado sem a linha de fio gira em torno do pivô até abrir a medida pedida no contorno', () => {
    const aberta = abrirPence(molde(), posicao, pivo, 60, 100, false, ids());
    // O lado esquerdo (com o fio) não se mexe.
    for (const p of [ponto(0, 0), ponto(100, 0), ponto(0, 300), ponto(100, 300)]) {
      expect(aberta.contorno.some((q) => distancia(p, q) < 1e-9)).toBe(true);
    }
    // A outra borda do corte: (100, 300) girado para a direita em torno de (100, 0).
    const outraBorda = ponto(100 + 300 * Math.sin(GIRO), 300 * Math.cos(GIRO));
    expect(aberta.contorno.some((q) => distancia(outraBorda, q) < 1e-6)).toBe(true);
    expect(distancia(ponto(100, 300), outraBorda)).toBeCloseTo(60, 6);
  });

  it('a peça ganha a cunha aberta, menos o triângulo da pence', () => {
    const aberta = abrirPence(molde(), posicao, pivo, 60, 100, false, ids());
    const cunha = (300 * 300 * Math.sin(GIRO)) / 2;
    expect(area(aberta.contorno)).toBeCloseTo(60000 + cunha - (60 * 100) / 2, 4);
    // 4 cantos + o pivô + as duas bordas + o vértice da pence.
    expect(aberta.contorno).toHaveLength(8);
    expect(aberta.contorno[0]).toEqual(ponto(0, 0));
  });

  it('o vértice fica no meio da abertura, à profundidade pedida, apontando para o pivô', () => {
    const aberta = abrirPence(molde(), posicao, pivo, 60, 100, false, ids());
    const outraBorda = ponto(100 + 300 * Math.sin(GIRO), 300 * Math.cos(GIRO));
    const meio = ponto((100 + outraBorda.x) / 2, (300 + outraBorda.y) / 2);
    const vertice = aberta.contorno.find((p) => Math.abs(distancia(p, meio) - 100) < 1e-6 && p.y < 290);
    expect(vertice).toBeDefined();
    // Alinhado com o meio da abertura e o pivô.
    const alinhado = (vertice!.x - meio.x) * (0 - meio.y) - (vertice!.y - meio.y) * (100 - meio.x);
    expect(alinhado).toBeCloseTo(0, 6);
  });

  it('o que está no lado que gira vai junto; o resto e a linha de fio ficam', () => {
    const original = adicionarMarca(adicionarMarca(molde(), ponto(150, 150), 'direita'), ponto(30, 150), 'esquerda');
    const aberta = abrirPence(original, posicao, pivo, 60, 100, false, ids());
    expect(aberta.linhaDeFio).toEqual(original.linhaDeFio);
    expect(aberta.marcas.find((m) => m.id === 'esquerda')!.posicao).toEqual(ponto(30, 150));
    const girada = aberta.marcas.find((m) => m.id === 'direita')!.posicao;
    expect(distancia(girada, ponto(100, 0))).toBeCloseTo(distancia(ponto(150, 150), ponto(100, 0)), 6);
    expect(girada.x).toBeGreaterThan(150);
  });

  it('com piques laterais, as duas bordas da abertura ganham um', () => {
    const aberta = abrirPence(molde(), posicao, pivo, 60, 100, true, ids());
    expect(aberta.piques).toHaveLength(2);
    expect(distancia(aberta.piques[0]!.posicao, ponto(100, 300))).toBeLessThan(1e-9);
    expect(distancia(aberta.piques[1]!.posicao, ponto(100, 300))).toBeCloseTo(60, 6);
  });

  it('recusa o pivô igual à posição, a linha por fora da peça e as medidas que não cabem', () => {
    expect(() => abrirPence(molde(), posicao, posicao, 60, 100, false, ids())).toThrow(/outro ponto do contorno/);
    expect(() => abrirPence(molde(), posicao, na(2, 30, 300), 20, 10, false, ids())).toThrow(/toda dentro da peça/);
    expect(() => abrirPence(molde(), posicao, pivo, 300, 100, false, ids())).toThrow(/abertura é grande demais/);
    expect(() => abrirPence(molde(), posicao, pivo, 60, 299, false, ids())).toThrow(/menor que a distância até o pivô/);
  });
});

describe('criarPenceInterna', () => {
  const OPCOES: OpcoesDePenceInterna = { altura1Mm: 60, altura2Mm: 80, larguraMm: 30, anguloGraus: 0, linhaAuxiliar: false, marcas: false };
  const CENTRO = ponto(100, 150);

  it('desenha o losango com o eixo no sentido do fio: altura 1 para onde a seta aponta', () => {
    const comPence = criarPenceInterna(molde(), CENTRO, OPCOES, ids());
    expect(comPence.contorno).toEqual(RETANGULO);
    expect(comPence.linhasInternas).toHaveLength(1);
    // O fio aponta para +y: ponta 1 em y = 210, ponta 2 em y = 70, e 15 mm para cada lado no centro.
    esperarPontos(comPence.linhasInternas[0]!, [ponto(100, 210), ponto(85, 150), ponto(100, 70), ponto(115, 150), ponto(100, 210)]);
  });

  it('com ângulo, o eixo gira em relação ao fio', () => {
    const comPence = criarPenceInterna(molde(), CENTRO, { ...OPCOES, anguloGraus: 90 }, ids());
    esperarPontos(comPence.linhasInternas[0]!, [ponto(40, 150), ponto(100, 135), ponto(180, 150), ponto(100, 165), ponto(40, 150)]);
  });

  it('com linha auxiliar, desenha também o eixo; com marcas, uma em cada canto do losango', () => {
    const comPence = criarPenceInterna(molde(), CENTRO, { ...OPCOES, linhaAuxiliar: true, marcas: true }, ids());
    expect(comPence.linhasInternas).toHaveLength(2);
    esperarPontos(comPence.linhasInternas[1]!, [ponto(100, 210), ponto(100, 70)]);
    expect(comPence.marcas).toHaveLength(4);
    expect(new Set(comPence.marcas.map((m) => m.id)).size).toBe(4);
  });

  it('recusa a pence que não cabe inteira na peça, e as medidas que não são maiores que zero', () => {
    expect(() => criarPenceInterna(molde(), ponto(100, 260), OPCOES, ids())).toThrow(/caber inteira/);
    expect(() => criarPenceInterna(molde(), ponto(500, 500), OPCOES, ids())).toThrow(/caber inteira/);
    expect(() => criarPenceInterna(molde(), CENTRO, { ...OPCOES, altura1Mm: 0 }, ids())).toThrow(/alturas/);
    expect(() => criarPenceInterna(molde(), CENTRO, { ...OPCOES, larguraMm: -1 }, ids())).toThrow(/largura/);
    expect(() => criarPenceInterna(molde(), CENTRO, { ...OPCOES, anguloGraus: Number.NaN }, ids())).toThrow(/ângulo/);
  });
});

describe('transferirPence', () => {
  const comPence = (): Molde => molde({ contorno: COM_PENCE });

  it('reconhece o vértice de uma pence recortada, e só ele', () => {
    expect(ehVerticeDePence(comPence(), VERTICE)).toBe(true);
    for (const outro of [0, 1, 2, 3, 5, 6, 99]) expect(ehVerticeDePence(comPence(), outro)).toBe(false);
  });

  it('a pence fecha no lugar antigo e abre no novo, com o mesmo vértice; a área não muda', () => {
    // Nova posição: (200, 200), na lateral direita. Gira o canto de cima à direita (o lado sem a linha de fio).
    const transferida = transferirPence(comPence(), VERTICE, na(1, 200, 200));
    expect(area(transferida.contorno)).toBeCloseTo(58000, 6);
    // Giro de 2·atan(20 / 100): cosseno 12/13 e seno 5/13.
    esperarPontos(transferida.contorno, [
      ponto(0, 0),
      ponto(200, 0),
      ponto(200, 200),
      ponto(100, 200),
      ponto(100 + 1200 / 13, 200 + 500 / 13),
      ponto(100 + 700 / 13, 200 + 1700 / 13),
      ponto(80, 300),
      ponto(0, 300),
    ]);
  });

  it('a pence nova tem o mesmo ângulo da antiga', () => {
    const transferida = transferirPence(comPence(), VERTICE, na(1, 200, 200));
    const v = ponto(100, 200);
    const borda1 = ponto(200, 200);
    const borda2 = ponto(100 + 1200 / 13, 200 + 500 / 13);
    expect(distancia(v, borda2)).toBeCloseTo(distancia(v, borda1), 6);
    // Abertura = 2 · 100 · sen(metade do ângulo), com tan(metade) = 20 / 100.
    expect(distancia(borda1, borda2)).toBeCloseTo(2 * 100 * Math.sin(Math.atan(0.2)), 6);
    expect(ehVerticeDePence(transferida, 3)).toBe(true);
  });

  it('com a linha de fio do outro lado, gira o outro lado; a forma é a mesma', () => {
    const fioADireita = molde({ contorno: COM_PENCE, linhaDeFio: { inicio: ponto(170, 220), fim: ponto(170, 280) } });
    const transferida = transferirPence(fioADireita, VERTICE, na(1, 200, 200));
    expect(area(transferida.contorno)).toBeCloseTo(58000, 6);
    // O canto de cima à direita ficou parado.
    expect(transferida.contorno.some((p) => distancia(p, ponto(200, 300)) < 1e-9)).toBe(true);
    expect(transferida.contorno.some((p) => distancia(p, ponto(0, 0)) < 1e-9)).toBe(false);
    expect(transferida.linhaDeFio).toEqual(fioADireita.linhaDeFio);
  });

  it('o que está no lado que gira vai junto', () => {
    const original = adicionarMarca(comPence(), ponto(180, 280), 'no-canto');
    const transferida = transferirPence(original, VERTICE, na(1, 200, 200));
    const girada = transferida.marcas[0]!.posicao;
    expect(distancia(girada, ponto(100, 200))).toBeCloseTo(distancia(ponto(180, 280), ponto(100, 200)), 6);
    expect(girada).not.toEqual(ponto(180, 280));
  });

  it('recusa o ponto que não é vértice de pence, a posição na própria pence e a linha por fora da peça', () => {
    expect(() => transferirPence(comPence(), 1, na(0, 100, 0))).toThrow(/não é o vértice de uma pence recortada/);
    expect(() => transferirPence(comPence(), VERTICE, na(3, 110, 250))).toThrow(/fora da pence atual/);
    expect(() => transferirPence(comPence(), VERTICE, na(3, 120, 300))).toThrow(/fora da pence atual/);
    expect(() => transferirPence(comPence(), 99, na(0, 100, 0))).toThrow(/fora do contorno/);
    // De (100, 200) a (200, 50), a linha passa pela mordida da lateral.
    const comMordida = molde({ contorno: COM_PENCE_E_MORDIDA });
    expect(() => transferirPence(comMordida, VERTICE_COM_MORDIDA, na(1, 200, 50))).toThrow(/toda dentro da peça/);
  });
});

describe('fecharPence', () => {
  const comPence = (): Molde => molde({ contorno: COM_PENCE });

  it('somente o recorte: o contorno passa reto de uma ponta à outra, e a pence fica marcada', () => {
    const fechada = fecharPence(comPence(), VERTICE, null);
    expect(fechada.contorno).toEqual([ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(120, 300), ponto(80, 300), ponto(0, 300)]);
    expect(area(fechada.contorno)).toBeCloseTo(60000, 6);
    expect(fechada.linhasInternas).toEqual([[ponto(120, 300), ponto(100, 200), ponto(80, 300)]]);
  });

  it('com pivô: um lado gira em torno do pivô até as pontas da pence se encontrarem', () => {
    // Pivô em (100, 0). As pontas (120, 300) e (80, 300) estão à mesma distância dele: encontram-se em (80, 300).
    const fechada = fecharPence(comPence(), VERTICE, na(0, 100, 0));
    // Cosseno 224/226 e seno 30/226 do ângulo entre as duas pontas, visto do pivô.
    const cos = 89600 / 90400;
    const sen = 12000 / 90400;
    esperarPontos(fechada.contorno, [
      ponto(0, 0),
      ponto(100, 0),
      ponto(100 + 100 * cos, 100 * sen),
      ponto(100 + 100 * cos - 300 * sen, 100 * sen + 300 * cos),
      ponto(80, 300),
      ponto(0, 300),
    ]);
  });

  it('com pivô: a área que sobra é a das duas metades, cada uma medida até a ponta da pence', () => {
    const fechada = fecharPence(comPence(), VERTICE, na(0, 100, 0));
    // Cada metade — (100,0), (200,0), (200,300), (120,300) e o espelho dela — tem 27000 mm².
    expect(area(fechada.contorno)).toBeCloseTo(54000, 6);
  });

  it('os piques das pernas da pence saem com ela; os outros ficam', () => {
    const original = molde({
      contorno: COM_PENCE,
      piques: [
        { id: 'na-perna', posicao: ponto(110, 250), indiceAresta: 3 },
        { id: 'embaixo', posicao: ponto(50, 0), indiceAresta: 0 },
      ],
    });
    expect(fecharPence(original, VERTICE, null).piques.map((p) => p.id)).toEqual(['embaixo']);
    expect(fecharPence(original, VERTICE, na(0, 100, 0)).piques.map((p) => p.id)).toEqual(['embaixo']);
  });

  it('recusa o ponto que não é vértice de pence, o pivô na própria pence e a linha por fora da peça', () => {
    expect(() => fecharPence(comPence(), 0, null)).toThrow(/não é o vértice de uma pence recortada/);
    expect(() => fecharPence(comPence(), VERTICE, na(5, 80, 300))).toThrow(/fora da pence/);
    const comMordida = molde({ contorno: COM_PENCE_E_MORDIDA });
    expect(() => fecharPence(comMordida, VERTICE_COM_MORDIDA, na(1, 200, 50))).toThrow(/toda dentro da peça/);
  });
});

describe('ida e volta', () => {
  it('recortar uma pence e fechar só o recorte devolve a área da peça', () => {
    const comPence = criarPence(molde(), NO_ALTO, RECORTAR, ids());
    const vertice = comPence.contorno.findIndex((p) => Math.abs(p.y - 200) < 1e-6);
    expect(area(fecharPence(comPence, vertice, null).contorno)).toBeCloseTo(60000, 6);
  });

  it('transferir a pence e transferir de volta devolve a mesma forma', () => {
    const original = molde({ contorno: COM_PENCE });
    const ida = transferirPence(original, VERTICE, na(1, 200, 200));
    const vertice = ida.contorno.findIndex((p) => distancia(p, ponto(100, 200)) < 1e-9);
    // De volta para o alto: a posição antiga, (80, 300), é hoje um ponto do contorno.
    const pontaAntiga = ida.contorno.findIndex((p) => distancia(p, ponto(80, 300)) < 1e-9);
    const volta = transferirPence(ida, vertice, { indiceAresta: pontaAntiga, ponto: ponto(80, 300) });
    expect(area(volta.contorno)).toBeCloseTo(58000, 6);
    for (const p of COM_PENCE) expect(volta.contorno.some((q) => distancia(p, q) < 1e-6)).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { area, distancia, ponto, type Ponto2D, type PosicaoNoContorno } from '../core/geometria';
import { definirRegra } from './graduacao';
import { adicionarMarca, adicionarPique, criarMolde, transladarMolde, type DadosDeNovoMolde, type Molde } from './molde';
import {
  alterarPrega,
  comPregasValidas,
  criarPregas,
  faixaDaPrega,
  MAXIMO_DE_PREGAS,
  medidasDaPrega,
  pregaPerto,
  pregasDaPeca,
  removerPrega,
  type OpcoesDePregas,
} from './pregas';
import { definirTamanhosDoMolde, moldeDoTamanho } from './tamanhosGraduados';

// Retângulo de 200 × 300 mm, anti-horário, com a linha de fio à esquerda (x = 50): o lado esquerdo fica parado.
const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];

function molde(sobrescrever: Partial<DadosDeNovoMolde> = {}): Molde {
  return criarMolde(
    {
      nome: 'Saia',
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
  return () => `pique-${++n}`;
}

function esperarPontos(obtido: readonly Ponto2D[], esperado: readonly Ponto2D[], casas = 6): void {
  expect(obtido).toHaveLength(esperado.length);
  obtido.forEach((p, i) => {
    expect(p.x).toBeCloseTo(esperado[i]!.x, casas);
    expect(p.y).toBeCloseTo(esperado[i]!.y, casas);
  });
}

// A linha da prega: em pé, de (100, 0) a (100, 300).
const EMBAIXO = na(0, 100, 0);
const EM_CIMA = na(2, 100, 300);
const SIMPLES: OpcoesDePregas = { modo: 'simples-direita', quantidade: 1, distanciaMm: 0, larguraMm: 20, piques: false };

/** As linhas de dobra (as de dois pontos) e as setas (as de cinco). */
const dobrasDe = (m: Molde) => m.linhasInternas.filter((l) => l.length === 2);
const setasDe = (m: Molde) => m.linhasInternas.filter((l) => l.length === 5);

describe('criarPregas, uma prega', () => {
  it('a peça abre na linha: o lado sem a linha de fio anda duas larguras', () => {
    const comPrega = criarPregas(molde(), EMBAIXO, EM_CIMA, SIMPLES, null, ids());
    esperarPontos(comPrega.contorno, [
      ponto(0, 0),
      ponto(100, 0),
      ponto(140, 0),
      ponto(240, 0),
      ponto(240, 300),
      ponto(140, 300),
      ponto(100, 300),
      ponto(0, 300),
    ]);
    // 40 mm a mais em 300 mm de comprimento.
    expect(area(comPrega.contorno)).toBeCloseTo(60000 + 40 * 300, 6);
  });

  it('desenha as três linhas de dobra: as duas bordas da abertura e a do meio', () => {
    const comPrega = criarPregas(molde(), EMBAIXO, EM_CIMA, SIMPLES, null, ids());
    const dobras = dobrasDe(comPrega);
    expect(dobras).toHaveLength(3);
    esperarPontos(dobras[0]!, [ponto(100, 0), ponto(100, 300)]);
    esperarPontos(dobras[1]!, [ponto(120, 0), ponto(120, 300)]);
    esperarPontos(dobras[2]!, [ponto(140, 0), ponto(140, 300)]);
  });

  it('a seta mostra para onde a prega dobra: à direita ou à esquerda de quem vai do primeiro ponto ao segundo', () => {
    // Indo de (100, 0) para (100, 300), a direita é x maior.
    const paraADireita = setasDe(criarPregas(molde(), EMBAIXO, EM_CIMA, SIMPLES, null, ids()));
    expect(paraADireita).toHaveLength(1);
    esperarPontos(paraADireita[0]!.slice(0, 2), [ponto(110, 150), ponto(130, 150)]);
    const paraAEsquerda = setasDe(criarPregas(molde(), EMBAIXO, EM_CIMA, { ...SIMPLES, modo: 'simples-esquerda' }, null, ids()));
    esperarPontos(paraAEsquerda[0]!.slice(0, 2), [ponto(130, 150), ponto(110, 150)]);
  });

  it('indicada no sentido contrário, a direita e a esquerda trocam', () => {
    const setas = setasDe(criarPregas(molde(), EM_CIMA, EMBAIXO, SIMPLES, null, ids()));
    // Indo de (100, 300) para (100, 0), a direita é x menor.
    esperarPontos(setas[0]!.slice(0, 2), [ponto(130, 150), ponto(110, 150)]);
  });

  it('a prega dupla consome quatro larguras e tem duas setas, uma de cada lado, apontando para o meio', () => {
    const comPrega = criarPregas(molde(), EMBAIXO, EM_CIMA, { ...SIMPLES, modo: 'dupla' }, null, ids());
    expect(area(comPrega.contorno)).toBeCloseTo(60000 + 80 * 300, 6);
    expect(dobrasDe(comPrega).map((l) => Math.round(l[0]!.x))).toEqual([100, 120, 140, 160, 180]);
    const setas = setasDe(comPrega);
    expect(setas).toHaveLength(2);
    esperarPontos(setas[0]!.slice(0, 2), [ponto(110, 150), ponto(130, 150)]);
    esperarPontos(setas[1]!.slice(0, 2), [ponto(170, 150), ponto(150, 150)]);
  });

  it('com piques, cada ponta de cada linha de dobra ganha um', () => {
    const comPrega = criarPregas(molde(), EMBAIXO, EM_CIMA, { ...SIMPLES, piques: true }, null, ids());
    expect(comPrega.piques).toHaveLength(6);
    esperarPontos(
      comPrega.piques.map((p) => p.posicao),
      [ponto(100, 0), ponto(100, 300), ponto(120, 0), ponto(120, 300), ponto(140, 0), ponto(140, 300)],
    );
    expect(new Set(comPrega.piques.map((p) => p.id)).size).toBe(6);
  });

  it('com Largura 2, a prega abre mais numa ponta que na outra', () => {
    // 20 mm em (100, 0) e 40 mm em (100, 300): abre 40 e 80 mm.
    const comPrega = criarPregas(molde(), EMBAIXO, EM_CIMA, { ...SIMPLES, largura2Mm: 40 }, null, ids());
    const altura = 300 * Math.sqrt(1 - (40 / 300) ** 2);
    const bordaDeBaixo = comPrega.contorno.find((p) => distancia(p, ponto(140, 0)) < 1e-6);
    const bordaDeCima = comPrega.contorno.find((p) => distancia(p, ponto(180, altura)) < 1e-6);
    expect(bordaDeBaixo).toBeDefined();
    expect(bordaDeCima).toBeDefined();
    // A abertura é o quadrilátero (100,0), (140,0), (180, altura), (100,300).
    const abertura = area([ponto(100, 0), ponto(140, 0), ponto(180, altura), ponto(100, 300)]);
    expect(area(comPrega.contorno)).toBeCloseTo(60000 + abertura, 4);
  });

  it('o que está no lado que anda vai junto; a linha de fio e o outro lado ficam', () => {
    const original = adicionarPique(
      adicionarMarca(adicionarMarca(molde(), ponto(150, 150), 'direita'), ponto(30, 150), 'esquerda'),
      ponto(200, 100),
      'lateral',
    );
    const comPrega = criarPregas(original, EMBAIXO, EM_CIMA, SIMPLES, null, ids());
    expect(comPrega.linhaDeFio).toEqual(original.linhaDeFio);
    expect(comPrega.marcas.find((m) => m.id === 'esquerda')!.posicao).toEqual(ponto(30, 150));
    esperarPontos([comPrega.marcas.find((m) => m.id === 'direita')!.posicao], [ponto(190, 150)]);
    esperarPontos([comPrega.piques[0]!.posicao], [ponto(240, 100)]);
  });

  it('com a linha de fio do outro lado, é o outro lado que anda', () => {
    const fioADireita = molde({ linhaDeFio: { inicio: ponto(150, 50), fim: ponto(150, 250) } });
    const comPrega = criarPregas(fioADireita, EMBAIXO, EM_CIMA, SIMPLES, null, ids());
    expect(Math.min(...comPrega.contorno.map((p) => p.x))).toBeCloseTo(-40, 6);
    expect(Math.max(...comPrega.contorno.map((p) => p.x))).toBeCloseTo(200, 6);
    // A seta continua apontando para a direita de quem vai de (100, 0) a (100, 300).
    const [cauda, ponta] = setasDe(comPrega)[0]!;
    expect(ponta!.x).toBeGreaterThan(cauda!.x);
  });

  it('funciona numa peça desenhada no sentido horário', () => {
    const horaria = molde({ contorno: [ponto(0, 0), ponto(0, 300), ponto(200, 300), ponto(200, 0)] });
    const comPrega = criarPregas(horaria, na(3, 100, 0), na(1, 100, 300), SIMPLES, null, ids());
    expect(area(comPrega.contorno)).toBeCloseTo(72000, 6);
    expect(Math.max(...comPrega.contorno.map((p) => p.x))).toBeCloseTo(240, 6);
  });
});

describe('criarPregas, várias pregas', () => {
  const TRES: OpcoesDePregas = { ...SIMPLES, quantidade: 3, distanciaMm: 40 };

  it('as outras pregas ficam paralelas, do lado clicado, à distância pedida entre uma e outra', () => {
    const comPregas = criarPregas(molde(), EMBAIXO, EM_CIMA, TRES, ponto(150, 150), ids());
    // Três aberturas de 40 mm.
    expect(area(comPregas.contorno)).toBeCloseTo(60000 + 3 * 40 * 300, 6);
    expect(Math.max(...comPregas.contorno.map((p) => p.x))).toBeCloseTo(320, 6);
    // Na peça aberta, cada prega começa 40 mm (a distância) depois de a anterior terminar.
    expect(dobrasDe(comPregas).map((l) => Math.round(l[0]!.x))).toEqual([100, 120, 140, 180, 200, 220, 260, 280, 300]);
    expect(setasDe(comPregas)).toHaveLength(3);
  });

  it('do outro lado da primeira prega', () => {
    // A linha de fio à direita: o lado esquerdo é o que anda.
    const fioADireita = molde({ linhaDeFio: { inicio: ponto(190, 50), fim: ponto(190, 250) } });
    const comPregas = criarPregas(fioADireita, na(0, 150, 0), na(2, 150, 300), { ...TRES, quantidade: 2 }, ponto(20, 150), ids());
    expect(area(comPregas.contorno)).toBeCloseTo(60000 + 2 * 40 * 300, 6);
    expect(Math.min(...comPregas.contorno.map((p) => p.x))).toBeCloseTo(-80, 6);
    expect(dobrasDe(comPregas).map((l) => Math.round(l[0]!.x))).toEqual([150, 130, 110, 70, 50, 30]);
  });

  it('pede o lado das outras pregas', () => {
    expect(() => criarPregas(molde(), EMBAIXO, EM_CIMA, TRES, null, ids())).toThrow(/do lado em que as outras pregas/);
    expect(() => criarPregas(molde(), EMBAIXO, EM_CIMA, TRES, ponto(100, 150), ids())).toThrow(/fora da linha da prega/);
  });

  it('recusa as pregas que saem da peça', () => {
    // A terceira ficaria em x = 260, fora do retângulo de 200.
    expect(() => criarPregas(molde(), EMBAIXO, EM_CIMA, { ...TRES, distanciaMm: 80 }, ponto(150, 150), ids())).toThrow(
      /prega 3 não atravessa a peça/,
    );
  });
});

describe('criarPregas, o que é recusado', () => {
  it('quantidade que não seja inteiro de 1 ao máximo', () => {
    for (const quantidade of [0, -1, 1.5, MAXIMO_DE_PREGAS + 1]) {
      expect(() => criarPregas(molde(), EMBAIXO, EM_CIMA, { ...SIMPLES, quantidade }, null, ids())).toThrow(/número de pregas/);
    }
  });

  it('largura que não é maior que zero, e distância zero com mais de uma prega', () => {
    expect(() => criarPregas(molde(), EMBAIXO, EM_CIMA, { ...SIMPLES, larguraMm: 0 }, null, ids())).toThrow(/largura/);
    expect(() => criarPregas(molde(), EMBAIXO, EM_CIMA, { ...SIMPLES, largura2Mm: -3 }, null, ids())).toThrow(/largura/);
    expect(() => criarPregas(molde(), EMBAIXO, EM_CIMA, { ...SIMPLES, quantidade: 2 }, ponto(150, 150), ids())).toThrow(/distância/);
  });

  it('a linha que não atravessa a peça por dentro', () => {
    expect(() => criarPregas(molde(), na(0, 50, 0), na(0, 150, 0), SIMPLES, null, ids())).toThrow(/atravessar a peça por dentro/);
    expect(() => criarPregas(molde(), EMBAIXO, EMBAIXO, SIMPLES, null, ids())).toThrow(/dois pontos diferentes/);
  });

  it('larguras diferentes demais para o comprimento da prega', () => {
    // Abre 2 × 5 numa ponta e 2 × 200 na outra: 390 mm de diferença em 300 de comprimento.
    expect(() => criarPregas(molde(), EMBAIXO, EM_CIMA, { ...SIMPLES, larguraMm: 5, largura2Mm: 200 }, null, ids())).toThrow(
      /diferença entre as duas larguras/,
    );
  });
});

describe('a prega feita por ferramenta fica registrada', () => {
  const comPrega = (opcoes: OpcoesDePregas = SIMPLES, base: Molde = molde()): Molde => criarPregas(base, EMBAIXO, EM_CIMA, opcoes, null, ids());
  const aPrega = (peca: Molde) => pregasDaPeca(peca)[0]!;

  it('guarda as duas bordas da abertura, as linhas que desenhou e as medidas', () => {
    const peca = comPrega();

    expect(pregasDaPeca(peca)).toHaveLength(1);
    expect(aPrega(peca)).toMatchObject({ modo: 'simples-direita', pontasCriadas: [true, true] });
    esperarPontos([...aPrega(peca).parada, ...aPrega(peca).movida], [ponto(100, 0), ponto(100, 300), ponto(140, 0), ponto(140, 300)]);
    // Três linhas de dobra e uma seta.
    expect(aPrega(peca).linhas).toHaveLength(4);
    expect(aPrega(peca).piques).toBeUndefined();
    expect(medidasDaPrega(aPrega(peca))).toEqual({ modo: 'simples-direita', larguraMm: 20, largura2Mm: 20 });
    esperarPontos(faixaDaPrega(aPrega(peca)), [ponto(100, 0), ponto(100, 300), ponto(140, 300), ponto(140, 0)]);
  });

  it('tirada a prega, a peça fecha de volta e o que estava no lado que andou volta junto', () => {
    const base = adicionarMarca(molde({ linhasInternas: [[ponto(150, 50), ponto(150, 250)]] }), ponto(160, 100), 'marca');
    const peca = comPrega(SIMPLES, base);
    expect(peca.marcas[0]!.posicao).toEqual(ponto(200, 100));

    const sem = removerPrega(peca, aPrega(peca).id);
    esperarPontos(sem.contorno, RETANGULO);
    expect(area(sem.contorno)).toBeCloseTo(60000, 6);
    expect(sem.linhasInternas).toHaveLength(1);
    esperarPontos(sem.linhasInternas[0]!, [ponto(150, 50), ponto(150, 250)]);
    expect(sem.marcas[0]!.posicao.x).toBeCloseTo(160, 6);
    expect('pregas' in sem).toBe(false);
  });

  it('com larguras diferentes nas duas pontas, as medidas são lidas certas e a peça fecha de volta', () => {
    const peca = comPrega({ ...SIMPLES, largura2Mm: 30 });
    const medidas = medidasDaPrega(aPrega(peca));

    expect(medidas.larguraMm).toBeCloseTo(20, 6);
    expect(medidas.largura2Mm).toBeCloseTo(30, 6);
    esperarPontos(removerPrega(peca, aPrega(peca).id).contorno, RETANGULO);
  });

  it('as pontas que já eram pontos do contorno ficam nele; os piques da prega saem com ela', () => {
    const comPontos = molde({ contorno: [ponto(0, 0), ponto(100, 0), ponto(200, 0), ponto(200, 300), ponto(100, 300), ponto(0, 300)] });
    const peca = criarPregas(comPontos, na(1, 100, 0), na(4, 100, 300), { ...SIMPLES, piques: true }, null, ids());

    expect(aPrega(peca).pontasCriadas).toEqual([false, false]);
    expect(aPrega(peca).piques).toHaveLength(6);
    const sem = removerPrega(peca, aPrega(peca).id);
    expect(sem.contorno).toHaveLength(6);
    expect(sem.piques).toHaveLength(0);
    expect(area(sem.contorno)).toBeCloseTo(60000, 6);
  });

  it('vale também no contorno que corre no outro sentido', () => {
    const aoContrario = molde({ contorno: [...RETANGULO].reverse() });
    const peca = criarPregas(aoContrario, na(2, 100, 0), na(0, 100, 300), SIMPLES, null, ids());

    expect(pregasDaPeca(peca)).toHaveLength(1);
    const sem = removerPrega(peca, aPrega(peca).id);
    expect(sem.contorno).toHaveLength(4);
    expect(Math.abs(area(sem.contorno))).toBeCloseTo(60000, 6);
    for (const canto of RETANGULO) expect(sem.contorno.some((q) => distancia(q, canto) < 1e-6)).toBe(true);
  });

  it('mudada, a prega é aberta de novo na mesma linha, com o modo e as larguras novos, e continua com piques', () => {
    const peca = comPrega({ ...SIMPLES, piques: true });
    const mudada = alterarPrega(peca, aPrega(peca).id, { modo: 'dupla', larguraMm: 10, largura2Mm: 10 }, ids());

    expect(pregasDaPeca(mudada)).toHaveLength(1);
    expect(medidasDaPrega(aPrega(mudada))).toEqual({ modo: 'dupla', larguraMm: 10, largura2Mm: 10 });
    // A dupla consome quatro larguras: 40 mm em 300 de altura.
    expect(area(mudada.contorno)).toBeCloseTo(60000 + 40 * 300, 6);
    // Cinco linhas de dobra e duas setas; um pique em cada ponta de cada linha de dobra.
    expect(dobrasDe(mudada)).toHaveLength(5);
    expect(setasDe(mudada)).toHaveLength(2);
    expect(mudada.piques).toHaveLength(10);
    expect(() => alterarPrega(peca, aPrega(peca).id, { modo: 'dupla', larguraMm: 0, largura2Mm: 10 }, ids())).toThrow(/largura/);
    expect(() => alterarPrega(peca, 'outra', { modo: 'dupla', larguraMm: 10, largura2Mm: 10 }, ids())).toThrow('mexida à mão');
  });

  it('várias pregas: cada uma tem o seu registro, e tirar a do meio leva as seguintes junto', () => {
    const tres = criarPregas(molde(), EMBAIXO, EM_CIMA, { ...SIMPLES, quantidade: 3, distanciaMm: 30 }, ponto(150, 150), ids());
    expect(pregasDaPeca(tres)).toHaveLength(3);
    expect(area(tres.contorno)).toBeCloseTo(60000 + 3 * 40 * 300, 6);

    const duas = removerPrega(tres, pregasDaPeca(tres)[1]!.id);
    expect(pregasDaPeca(duas)).toHaveLength(2);
    expect(area(duas.contorno)).toBeCloseTo(60000 + 2 * 40 * 300, 6);
    // As duas que ficaram ainda fecham: sobra o retângulo.
    const uma = removerPrega(duas, pregasDaPeca(duas)[1]!.id);
    const nenhuma = removerPrega(uma, pregasDaPeca(uma)[0]!.id);
    esperarPontos(nenhuma.contorno, RETANGULO);
    expect(nenhuma.linhasInternas).toHaveLength(0);
  });

  it('o registro deixa de valer se uma linha da prega é apagada ou uma borda é mexida', () => {
    const peca = comPrega();
    const semUmaLinha = { ...peca, linhasInternas: peca.linhasInternas.slice(1) };
    expect(pregasDaPeca(semUmaLinha)).toHaveLength(0);
    expect('pregas' in comPregasValidas(semUmaLinha)).toBe(false);
    expect(() => removerPrega(semUmaLinha, aPrega(peca).id)).toThrow('mexida à mão');

    const bordaMexida = { ...peca, contorno: peca.contorno.map((p) => (distancia(p, ponto(140, 0)) < 1e-6 ? ponto(140, -5) : p)) };
    expect(pregasDaPeca(bordaMexida)).toHaveLength(0);
    expect(comPregasValidas(peca)).toBe(peca);
  });

  it('a prega acompanha a peça movida e o tamanho da graduação', () => {
    const levada = transladarMolde(comPrega(), ponto(10, 20), 'outra');
    expect(pregasDaPeca(levada)).toHaveLength(1);
    esperarPontos([...aPrega(levada).parada], [ponto(110, 20), ponto(110, 320)]);
    expect(area(removerPrega(levada, aPrega(levada).id).contorno)).toBeCloseTo(60000, 6);

    // No G, o canto de baixo do lado que andou sai 24 mm: as pontas da prega nessa aresta andam na proporção, e o registro vai junto.
    let graduada = definirTamanhosDoMolde(comPrega(), ['M', 'G'], 'M');
    const canto = graduada.contorno.findIndex((p) => distancia(p, ponto(240, 0)) < 1e-6);
    graduada = { ...graduada, graduacao: definirRegra(graduada.graduacao!, graduada.contorno, canto, [ponto(0, 0), ponto(24, 0)]) };
    const g = moldeDoTamanho(graduada, 1, 'g');
    expect(pregasDaPeca(g)).toHaveLength(1);
    expect(aPrega(g).parada[0].x).toBeCloseTo(110, 6);
    expect(aPrega(g).movida[0].x).toBeCloseTo(154, 6);
  });

  it('pregaPerto acha a prega em cuja faixa o ponto está', () => {
    const peca = comPrega();

    expect(pregaPerto(peca, ponto(120, 150), 0)?.id).toBe(aPrega(peca).id);
    expect(pregaPerto(peca, ponto(50, 150), 0)).toBeNull();
    expect(pregaPerto(peca, ponto(95, 150), 6)?.id).toBe(aPrega(peca).id);
    expect(pregaPerto(peca, ponto(95, 150), 2)).toBeNull();
  });
});

import { describe, it, expect } from 'vitest';
import { area, distancia, ponto, type Ponto2D, type PosicaoNoContorno } from '../core/geometria';
import { adicionarMarca, adicionarPique, criarMolde, type DadosDeNovoMolde, type Molde } from './molde';
import { criarPregas, MAXIMO_DE_PREGAS, type OpcoesDePregas } from './pregas';

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

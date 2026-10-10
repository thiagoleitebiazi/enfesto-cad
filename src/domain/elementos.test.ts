import { describe, it, expect } from 'vitest';
import { arcoPorTresPontos } from '../core/curvas';
import { area, distancia, ponto, type Ponto2D } from '../core/geometria';
import {
  ancoraDoElemento,
  contornoComoLinhaInterna,
  copiarElemento,
  criarRetaPorAngulo,
  direcaoDoAngulo,
  dividirLinha,
  elementoPerto,
  encontroDasRetas,
  estenderAteElemento,
  estenderDuasRetas,
  estenderReta,
  extrairMolde,
  linhaInternaPerto,
  moverElemento,
  pontoNoCentroDoArco,
  pontoNoPerimetro,
  pontoPorDistancia,
  pontoPorIntersecao,
  regiaoDaPeca,
  removerElemento,
  segmentoPerto,
} from './elementos';
import { criarMolde, type DadosDeNovoMolde, type Molde } from './molde';

// Retângulo de 200 × 300 mm: arestas 0 (y = 0), 1 (x = 200), 2 (y = 300) e 3 (x = 0).
const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];

function molde(sobrescrever: Partial<DadosDeNovoMolde> = {}, id = 'm1'): Molde {
  return criarMolde(
    { nome: 'Frente', referencia: 'REF', tamanho: 'M', contorno: RETANGULO, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) }, ...sobrescrever },
    id,
  );
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

// Uma linha em pé, de (100, 50) a (100, 150), e outra deitada, de (20, 200) a (60, 200).
const EM_PE = [ponto(100, 50), ponto(100, 150)];
const DEITADA = [ponto(20, 200), ponto(60, 200)];
const comLinhas = (): Molde => molde({ linhasInternas: [EM_PE, DEITADA] });

describe('retas', () => {
  it('o ângulo é o da tela: 0° para a direita (o y do mundo), 90° para cima (x menor)', () => {
    esperarPontos([direcaoDoAngulo(0)], [ponto(0, 1)]);
    esperarPontos([direcaoDoAngulo(90)], [ponto(-1, 0)]);
    esperarPontos([direcaoDoAngulo(180)], [ponto(0, -1)]);
    esperarPontos([direcaoDoAngulo(-90)], [ponto(1, 0)]);
  });

  it('"Por ângulo": uma linha interna nova, com o comprimento e o ângulo dados', () => {
    const comReta = criarRetaPorAngulo(molde(), ponto(100, 100), 0, 80);
    expect(comReta.linhasInternas).toHaveLength(1);
    esperarPontos(comReta.linhasInternas[0]!, [ponto(100, 100), ponto(100, 180)]);
    const a45 = criarRetaPorAngulo(molde(), ponto(100, 100), 45, 100).linhasInternas[0]!;
    expect(distancia(a45[0]!, a45[1]!)).toBeCloseTo(100, 6);
    expect(() => criarRetaPorAngulo(molde(), ponto(0, 0), 0, 0)).toThrow(/maior que zero/);
    expect(() => criarRetaPorAngulo(molde(), ponto(0, 0), Number.NaN, 10)).toThrow(/ângulo/);
  });

  it('acha a linha interna perto do ponto, e a ponta dela mais próxima', () => {
    expect(linhaInternaPerto(comLinhas(), ponto(102, 140), 5)).toEqual({ linha: 0, ponta: 'fim' });
    expect(linhaInternaPerto(comLinhas(), ponto(98, 60), 5)).toEqual({ linha: 0, ponta: 'inicio' });
    expect(linhaInternaPerto(comLinhas(), ponto(25, 201), 5)).toEqual({ linha: 1, ponta: 'inicio' });
    expect(linhaInternaPerto(comLinhas(), ponto(150, 150), 5)).toBeNull();
  });

  it('"Estender reta": a ponta anda a medida, na direção em que a linha já ia', () => {
    esperarPontos(estenderReta(comLinhas(), 0, 'fim', 30).linhasInternas[0]!, [ponto(100, 50), ponto(100, 180)]);
    esperarPontos(estenderReta(comLinhas(), 0, 'inicio', 30).linhasInternas[0]!, [ponto(100, 20), ponto(100, 150)]);
    expect(estenderReta(comLinhas(), 0, 'fim', 30).linhasInternas[1]).toBe(DEITADA);
    expect(() => estenderReta(comLinhas(), 0, 'fim', 0)).toThrow(/maior que zero/);
    expect(() => estenderReta(comLinhas(), 7, 'fim', 10)).toThrow(/não encontrada/);
  });

  it('"Estender até elemento": até o contorno', () => {
    esperarPontos(estenderAteElemento(comLinhas(), 0, 'fim').linhasInternas[0]!, [ponto(100, 50), ponto(100, 300)]);
    esperarPontos(estenderAteElemento(comLinhas(), 0, 'inicio').linhasInternas[0]!, [ponto(100, 0), ponto(100, 150)]);
  });

  it('"Estender até elemento": para na primeira linha interna que encontra, ou num furo', () => {
    // A deitada, pela ponta do fim, anda para a direita e encontra a linha em pé esticada até y = 250.
    const peca = molde({ linhasInternas: [[ponto(100, 50), ponto(100, 250)], DEITADA] });
    esperarPontos(estenderAteElemento(peca, 1, 'fim').linhasInternas[1]!, [ponto(20, 200), ponto(100, 200)]);
    const comFuro = molde({ linhasInternas: [EM_PE], furos: [[ponto(80, 200), ponto(120, 200), ponto(120, 240), ponto(80, 240)]] });
    esperarPontos(estenderAteElemento(comFuro, 0, 'fim').linhasInternas[0]!, [ponto(100, 50), ponto(100, 200)]);
  });

  it('"Estender duas retas": as duas pontas vão para o encontro das duas retas', () => {
    const unidas = estenderDuasRetas(comLinhas(), 0, 'fim', 1, 'fim');
    esperarPontos(unidas.linhasInternas[0]!, [ponto(100, 50), ponto(100, 200)]);
    esperarPontos(unidas.linhasInternas[1]!, [ponto(20, 200), ponto(100, 200)]);
  });

  it('"Estender duas retas" recusa retas paralelas e a mesma linha duas vezes', () => {
    const paralelas = molde({ linhasInternas: [EM_PE, [ponto(150, 50), ponto(150, 150)]] });
    expect(() => estenderDuasRetas(paralelas, 0, 'fim', 1, 'fim')).toThrow(/paralelas/);
    expect(() => estenderDuasRetas(comLinhas(), 0, 'fim', 0, 'inicio')).toThrow(/duas linhas diferentes/);
  });
});

describe('pontos', () => {
  it('acha o trecho reto perto do ponto: uma aresta do contorno ou um segmento de linha interna', () => {
    expect(segmentoPerto(comLinhas(), ponto(203, 100), 5)).toEqual({ de: ponto(200, 0), ate: ponto(200, 300) });
    expect(segmentoPerto(comLinhas(), ponto(101, 100), 5)).toEqual({ de: ponto(100, 50), ate: ponto(100, 150) });
    expect(segmentoPerto(comLinhas(), ponto(150, 150), 5)).toBeNull();
  });

  it('o encontro de duas retas, prolongadas; paralelas não se encontram', () => {
    esperarPontos([encontroDasRetas({ de: ponto(100, 50), ate: ponto(100, 150) }, { de: ponto(20, 200), ate: ponto(60, 200) })!], [ponto(100, 200)]);
    expect(encontroDasRetas({ de: ponto(0, 0), ate: ponto(10, 0) }, { de: ponto(0, 5), ate: ponto(10, 5) })).toBeNull();
  });

  it('"Por interseção": uma marca no encontro', () => {
    const comPonto = pontoPorIntersecao(comLinhas(), { de: EM_PE[0]!, ate: EM_PE[1]! }, { de: DEITADA[0]!, ate: DEITADA[1]! }, 'p1');
    expect(comPonto.marcas).toHaveLength(1);
    esperarPontos([comPonto.marcas[0]!.posicao], [ponto(100, 200)]);
    expect(() => pontoPorIntersecao(comLinhas(), { de: ponto(0, 0), ate: ponto(200, 0) }, { de: ponto(0, 300), ate: ponto(200, 300) }, 'p1')).toThrow(/paralelos/);
  });

  it('"No centro do arco": uma marca no centro do arco clicado; numa reta, recusa', () => {
    // O lado de cima em arco: centro (100, 195), raio 145.
    const comArco = molde({ contorno: [ponto(0, 0), ponto(200, 0), ...arcoPorTresPontos(ponto(200, 300), ponto(100, 340), ponto(0, 300))] });
    const comPonto = pontoNoCentroDoArco(comArco, { indiceAresta: 8, ponto: comArco.contorno[8]! }, 'p1');
    esperarPontos([comPonto.marcas[0]!.posicao], [ponto(100, 195)]);
    expect(() => pontoNoCentroDoArco(comArco, { indiceAresta: 0, ponto: ponto(100, 0) }, 'p1')).toThrow(/é uma reta/);
  });

  it('"No perímetro": uma marca sobre o contorno, à distância dada do ponto clicado', () => {
    const adiante = pontoNoPerimetro(molde(), { indiceAresta: 0, ponto: ponto(150, 0) }, 120, 'p1');
    esperarPontos([adiante.marcas[0]!.posicao], [ponto(200, 70)]);
    const paraTras = pontoNoPerimetro(molde(), { indiceAresta: 0, ponto: ponto(150, 0) }, -100, 'p1');
    esperarPontos([paraTras.marcas[0]!.posicao], [ponto(50, 0)]);
    expect(() => pontoNoPerimetro(molde(), { indiceAresta: 0, ponto: ponto(150, 0) }, 5000, 'p1')).toThrow(/maior que o perímetro/);
  });

  it('"Por distância": uma marca a partir do primeiro ponto, na direção do segundo', () => {
    const comPonto = pontoPorDistancia(molde(), ponto(0, 0), ponto(30, 40), 100, 'p1');
    esperarPontos([comPonto.marcas[0]!.posicao], [ponto(60, 80)]);
    expect(() => pontoPorDistancia(molde(), ponto(0, 0), ponto(0, 0), 100, 'p1')).toThrow(/segundo ponto diferente/);
    expect(() => pontoPorDistancia(molde(), ponto(0, 0), ponto(30, 40), 0, 'p1')).toThrow(/maior que zero/);
  });
});

describe('extrair molde', () => {
  // Uma linha de borda a borda, deitada em y = 100: divide a peça em 200 × 100 e 200 × 200.
  const DIVISA = [ponto(0, 100), ponto(200, 100)];
  const dividida = (): Molde => molde({ linhasInternas: [DIVISA] });

  it('a região é o lado da linha em que está o clique', () => {
    expect(area(regiaoDaPeca(dividida(), ponto(100, 50))!)).toBeCloseTo(20000, 6);
    expect(area(regiaoDaPeca(dividida(), ponto(100, 250))!)).toBeCloseTo(40000, 6);
  });

  it('sem linha que divida, não há região a extrair', () => {
    expect(regiaoDaPeca(molde(), ponto(100, 50))).toBeNull();
    // Uma linha que não chega às bordas não divide nada.
    expect(regiaoDaPeca(comLinhas(), ponto(100, 20))).toBeNull();
    expect(() => regiaoDaPeca(molde(), ponto(900, 900))).toThrow(/dentro da peça/);
  });

  it('duas linhas cruzando a peça: o clique escolhe um dos quatro cantos', () => {
    const emCruz = molde({ linhasInternas: [DIVISA, [ponto(80, 0), ponto(80, 300)]] });
    // Canto x < 80, y < 100.
    expect(area(regiaoDaPeca(emCruz, ponto(40, 50))!)).toBeCloseTo(8000, 6);
    // Canto x > 80, y > 100.
    expect(area(regiaoDaPeca(emCruz, ponto(150, 250))!)).toBeCloseTo(120 * 200, 6);
  });

  it('uma linha quebrada, de borda a borda, também divide', () => {
    const comDegrau = molde({ linhasInternas: [[ponto(0, 100), ponto(100, 100), ponto(100, 200), ponto(200, 200)]] });
    // De baixo: 200 × 100 mais o degrau de 100 × 100.
    expect(area(regiaoDaPeca(comDegrau, ponto(150, 150))!)).toBeCloseTo(30000, 6);
    expect(area(regiaoDaPeca(comDegrau, ponto(50, 250))!)).toBeCloseTo(30000, 6);
  });

  it('um laço fechado é uma região: o que está dentro dele', () => {
    const laco = [ponto(50, 50), ponto(150, 50), ponto(150, 150), ponto(50, 150), ponto(50, 50)];
    const comLaco = molde({ linhasInternas: [laco] });
    expect(area(regiaoDaPeca(comLaco, ponto(100, 100))!)).toBeCloseTo(10000, 6);
    expect(regiaoDaPeca(comLaco, ponto(180, 250))).toBeNull();
  });

  it('a peça extraída leva o que está inteiro dentro dela; a de origem não muda', () => {
    const origem = molde({
      linhasInternas: [DIVISA, [ponto(20, 20), ponto(60, 20)], [ponto(20, 200), ponto(60, 200)]],
      furos: [[ponto(100, 30), ponto(120, 30), ponto(120, 50)]],
      marcas: [{ id: 'baixo', posicao: ponto(150, 50) }, { id: 'cima', posicao: ponto(150, 250) }],
      piques: [{ id: 'pique', posicao: ponto(100, 0), indiceAresta: 0 }],
    });
    const extraida = extrairMolde(origem, ponto(100, 50), ids(), 'Frente (2)');
    expect(extraida.nome).toBe('Frente (2)');
    expect(extraida.id).toBe('novo-1');
    expect(area(extraida.contorno)).toBeCloseTo(20000, 6);
    expect(extraida.furos).toHaveLength(1);
    expect(extraida.linhasInternas).toEqual([[ponto(20, 20), ponto(60, 20)]]);
    expect(extraida.marcas.map((m) => m.posicao)).toEqual([ponto(150, 50)]);
    expect(extraida.marcas[0]!.id).not.toBe('baixo');
    expect(extraida.piques).toHaveLength(1);
    // A linha de fio da origem, de y = 50 a y = 250, não cabe na região (100 mm de altura): vai para o meio dela
    // e encolhe até caber — 200 × 0,75³ ≈ 84 mm, de y ≈ 7,8 a y ≈ 92,2 —, em vez de sobrar para fora da peça.
    expect(extraida.linhaDeFio.inicio.y).toBeCloseTo(50 - (200 * 0.75 ** 3) / 2, 6);
    expect(extraida.linhaDeFio.fim.y).toBeCloseTo(50 + (200 * 0.75 ** 3) / 2, 6);
    expect(origem.linhasInternas).toHaveLength(3);
  });

  it('sem região delimitada, explica como delimitar', () => {
    expect(() => extrairMolde(molde(), ponto(100, 50), ids(), 'X')).toThrow(/Nenhuma linha interna delimita/);
  });
});

describe('escolher, mover, apagar, dividir e copiar elementos', () => {
  const comMarca = (): Molde => ({ ...comLinhas(), marcas: [{ id: 'm', posicao: ponto(100, 100) }] });

  it('o elemento perto do ponto: a marca tem a preferência sobre a linha', () => {
    // (100, 100) está sobre a linha em pé e em cima da marca.
    expect(elementoPerto(comMarca(), ponto(101, 101), 5)).toEqual({ tipo: 'marca', id: 'm' });
    expect(elementoPerto(comMarca(), ponto(101, 130), 5)).toEqual({ tipo: 'linha', indice: 0 });
    expect(elementoPerto(comMarca(), ponto(150, 250), 5)).toBeNull();
    expect(ancoraDoElemento(comMarca(), { tipo: 'marca', id: 'm' })).toEqual(ponto(100, 100));
    expect(ancoraDoElemento(comMarca(), { tipo: 'linha', indice: 1 })).toEqual(ponto(20, 200));
  });

  it('move a linha inteira ou a marca', () => {
    esperarPontos(moverElemento(comMarca(), { tipo: 'linha', indice: 0 }, ponto(10, -5)).linhasInternas[0]!, [ponto(110, 45), ponto(110, 145)]);
    expect(moverElemento(comMarca(), { tipo: 'marca', id: 'm' }, ponto(10, -5)).marcas[0]!.posicao).toEqual(ponto(110, 95));
    expect(() => moverElemento(comMarca(), { tipo: 'marca', id: 'x' }, ponto(1, 1))).toThrow(/não encontrado/);
  });

  it('apaga a linha ou a marca', () => {
    expect(removerElemento(comMarca(), { tipo: 'linha', indice: 0 }).linhasInternas).toEqual([DEITADA]);
    expect(removerElemento(comMarca(), { tipo: 'marca', id: 'm' }).marcas).toEqual([]);
  });

  it('"Dividir elementos": a linha vira duas, no ponto dela mais próximo do clique', () => {
    const divididas = dividirLinha(comLinhas(), 0, ponto(103, 90)).linhasInternas;
    expect(divididas).toHaveLength(3);
    esperarPontos(divididas[0]!, [ponto(100, 50), ponto(100, 90)]);
    esperarPontos(divididas[1]!, [ponto(100, 90), ponto(100, 150)]);
    expect(divididas[2]).toBe(DEITADA);
    expect(() => dividirLinha(comLinhas(), 0, ponto(100, 40))).toThrow(/no meio da linha/);
  });

  it('"Transformar em elementos": o contorno de outra peça entra como linha interna fechada', () => {
    const bolso = molde({ nome: 'Bolso', contorno: [ponto(50, 50), ponto(150, 50), ponto(150, 150), ponto(50, 150)] }, 'b');
    const comBolso = contornoComoLinhaInterna(molde(), bolso);
    expect(comBolso.linhasInternas).toEqual([[ponto(50, 50), ponto(150, 50), ponto(150, 150), ponto(50, 150), ponto(50, 50)]]);
    // E essa linha fechada delimita uma região que dá para extrair.
    expect(area(regiaoDaPeca(comBolso, ponto(100, 100))!)).toBeCloseTo(10000, 6);
    expect(() => contornoComoLinhaInterna(molde(), molde())).toThrow(/outra peça/);
  });

  it('"Copiar elemento": a linha ou a marca de outra peça ganha uma cópia na peça de destino', () => {
    const origem = { ...comMarca(), id: 'origem' };
    const comLinha = copiarElemento(molde(), origem, { tipo: 'linha', indice: 1 }, ids());
    expect(comLinha.linhasInternas).toEqual([DEITADA]);
    const comAMarca = copiarElemento(molde(), origem, { tipo: 'marca', id: 'm' }, ids());
    expect(comAMarca.marcas).toEqual([{ id: 'novo-1', posicao: ponto(100, 100) }]);
    expect(origem.marcas).toHaveLength(1);
  });
});

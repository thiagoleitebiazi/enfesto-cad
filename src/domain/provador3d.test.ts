import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde, type Molde } from './molde';
import { corpoDoManequim, distanciaAoCorpo, malhaDoCorpo, manequimDoTamanho, MEDIDAS_DO_PUBLICO, medidasConferidas, perimetroDaElipse, secaoNaAltura } from './manequim';
import { delaunay, malhaDaPeca, trechoDaBorda } from './malhaDaPeca';
import {
  configuracoesDasInstancias,
  coordenadasDaFace,
  instanciasDasPecas,
  lerMontagem3d,
  malhasDasInstancias,
  MONTAGEM_VAZIA,
  posicoesDeArrumacao,
  problemasDaCostura,
  sugerirCosturas,
  TECIDOS_PRONTOS,
  type Montagem3D,
} from './montagem3d';
import { aberturaDasCosturas, assentou, avancar, maiorPenetracao, montarSimulacao, tensoes } from './simulacaoDoTecido';

const FEMININO = corpoDoManequim(MEDIDAS_DO_PUBLICO.feminino);

/** Uma peça de saia em pé na tela: a cintura (400 mm) em cima, a barra (560 mm) embaixo, 550 mm de altura. */
function pecaDeSaia(id: string, nome: string): Molde {
  return criarMolde(
    {
      nome,
      referencia: 'SAIA',
      tamanho: 'M',
      // Na tela o x do mundo é a vertical (para baixo) e o y, a horizontal.
      contorno: [ponto(0, 80), ponto(0, 480), ponto(550, 560), ponto(550, 0)],
      linhaDeFio: { inicio: ponto(50, 280), fim: ponto(500, 280) },
    },
    id,
  );
}

describe('o manequim', () => {
  it('as voltas do corpo batem com as medidas (busto, cintura, quadril)', () => {
    const volta = (y: number): number => {
      const s = secaoNaAltura(FEMININO, y)!;
      return perimetroDaElipse(s.a, s.b);
    };
    expect(volta(FEMININO.niveis.busto)).toBeCloseTo(920, -1);
    expect(volta(FEMININO.niveis.cintura)).toBeCloseTo(720, -1);
    expect(volta(FEMININO.niveis.quadril)).toBeCloseTo(1000, -1);
    expect(FEMININO.alturaMm).toBe(1650);
    expect(FEMININO.cabeca.centro.y + FEMININO.cabeca.raios.y).toBeGreaterThan(1580);
    expect(FEMININO.cabeca.centro.y + FEMININO.cabeca.raios.y).toBeLessThan(1700);
  });

  it('a distância ao corpo: dentro é negativa, fora positiva, e a normal aponta para fora', () => {
    const y = FEMININO.niveis.cintura;
    const s = secaoNaAltura(FEMININO, y)!;
    const dentro = distanciaAoCorpo(FEMININO, 0, y, s.b - 10);
    expect(dentro.d).toBeCloseTo(-10, 0);
    expect(dentro.nz).toBeGreaterThan(0.95);
    const fora = distanciaAoCorpo(FEMININO, 0, y, s.b + 20);
    expect(fora.d).toBeCloseTo(20, 0);
    // No ombro inclinado a normal sobe.
    const ombro = distanciaAoCorpo(FEMININO, 110, FEMININO.niveis.ombro + 10, 0);
    expect(ombro.ny).toBeGreaterThan(0.2);
    // No meio do braço.
    const b = FEMININO.bracos.direito;
    expect(distanciaAoCorpo(FEMININO, b.meio.x, b.meio.y, b.meio.z).d).toBeLessThan(-30);
  });

  it('a malha do corpo: os triângulos com a frente para fora', () => {
    const m = malhaDoCorpo(FEMININO);
    expect(m.triangulos.length / 3).toBeGreaterThan(1500);
    let paraFora = 0;
    const T = m.triangulos.length / 3;
    const v = m.vertices;
    for (let t = 0; t < T; t++) {
      const [a, b, c] = [m.triangulos[3 * t]!, m.triangulos[3 * t + 1]!, m.triangulos[3 * t + 2]!];
      const e1 = [v[3 * b]! - v[3 * a]!, v[3 * b + 1]! - v[3 * a + 1]!, v[3 * b + 2]! - v[3 * a + 2]!];
      const e2 = [v[3 * c]! - v[3 * a]!, v[3 * c + 1]! - v[3 * a + 1]!, v[3 * c + 2]! - v[3 * a + 2]!];
      const n = [e1[1]! * e2[2]! - e1[2]! * e2[1]!, e1[2]! * e2[0]! - e1[0]! * e2[2]!, e1[0]! * e2[1]! - e1[1]! * e2[0]!];
      const L = Math.hypot(n[0]!, n[1]!, n[2]!) || 1;
      const centro = [(v[3 * a]! + v[3 * b]! + v[3 * c]!) / 3, (v[3 * a + 1]! + v[3 * b + 1]! + v[3 * c + 1]!) / 3, (v[3 * a + 2]! + v[3 * b + 2]! + v[3 * c + 2]!) / 3];
      const fora = distanciaAoCorpo(FEMININO, centro[0]! + (n[0]! / L) * 8, centro[1]! + (n[1]! / L) * 8, centro[2]! + (n[2]! / L) * 8).d;
      const dentro = distanciaAoCorpo(FEMININO, centro[0]! - (n[0]! / L) * 8, centro[1]! - (n[1]! / L) * 8, centro[2]! - (n[2]! / L) * 8).d;
      if (fora > dentro) paraFora++;
    }
    // Onde o braço e a perna entram no tronco, a superfície de um fica dentro do outro.
    expect(paraFora / T).toBeGreaterThan(0.95);
  });

  it('as medidas fora dos limites ficam no limite; o manequim no tamanho da ficha', () => {
    expect(medidasConferidas({ ...MEDIDAS_DO_PUBLICO.feminino, alturaCm: 400, bustoCm: Number.NaN }).alturaCm).toBe(210);
    expect(medidasConferidas({ ...MEDIDAS_DO_PUBLICO.feminino, bustoCm: Number.NaN }).bustoCm).toBe(92);
    const ficha = {
      tamanhos: ['P', 'M', 'G'],
      medidas: [
        { id: 'b', nome: 'Busto', comoMedir: '', toleranciaCm: 1, valoresCm: { P: 96, M: 100, G: 104 } },
        { id: 'c', nome: 'Comprimento', comoMedir: '', toleranciaCm: 1, valoresCm: { P: 60, M: 62, G: 64 } },
      ],
    };
    const r = manequimDoTamanho(MEDIDAS_DO_PUBLICO.feminino, ficha, { b: { usar: true, tipo: 'circunferencia', folgaCm: 8, peso: 2 }, c: { usar: true, tipo: 'comprimento', folgaCm: 0, peso: 1 } }, 'G');
    expect(r.medidas.bustoCm).toBe(96);
    expect(r.daFicha).toEqual(['Busto (tórax) (Busto)']);
  });
});

describe('a malha da peça', () => {
  it('Delaunay de um quadrado com o meio: 4 triângulos', () => {
    expect(delaunay(Float64Array.from([0, 0, 10, 0, 10, 10, 0, 10, 5, 5])).length / 3).toBe(4);
  });

  it('cobre a peça (a soma das áreas é a área), passa por todos os pontos do contorno e acha os trechos', () => {
    const contorno = [ponto(0, 0), ponto(300, 0), ponto(300, 200), ponto(150, 120), ponto(0, 200)];
    const m = malhaDaPeca(contorno, 20);
    const areaDoContorno = 300 * 200 - (300 * 80) / 2;
    const soma = m.areas.reduce((s, a) => s + a, 0);
    expect(soma).toBeCloseTo(areaDoContorno, -2);
    expect(Math.abs(soma - areaDoContorno) / areaDoContorno).toBeLessThan(0.01);
    contorno.forEach((p, i) => {
      const k = m.borda[m.bordaDoVertice[i]!]!.ponto;
      expect([m.pontos[2 * k], m.pontos[2 * k + 1]]).toEqual([p.x, p.y]);
    });
    const t = trechoDaBorda(m, 1, 2);
    expect(t.comprimento).toBeCloseTo(200, 6);
    expect(t.fracoes[0]).toBe(0);
    expect(t.fracoes.at(-1)).toBe(1);
    // Dando a volta: do ponto 4 ao 0.
    expect(trechoDaBorda(m, 4, 0).comprimento).toBeCloseTo(200, 6);
    expect(m.dobras.length).toBeGreaterThan(0);
  });
});

describe('a montagem em volta do corpo', () => {
  const frente = pecaDeSaia('f', 'Frente da saia');
  const costas = pecaDeSaia('c', 'Costas da saia');
  const instancias = instanciasDasPecas([frente, costas]);

  it('a peça vista pela face: o fio para cima, a cintura em cima', () => {
    const inst = instancias[0]!;
    const pts = Float64Array.from(inst.contorno.flatMap((p) => [p.x, p.y]));
    const f = coordenadasDaFace(inst, 0, pts);
    expect(f.largura).toBeCloseTo(560, 6);
    expect(f.altura).toBeCloseTo(550, 6);
    // O ponto 0 (cintura, à esquerda) fica em cima à esquerda.
    expect(f.u[0]).toBeCloseTo(-200, 6);
    expect(f.v[0]).toBeCloseTo(275, 6);
    // Girada 180°: em baixo à direita.
    const g = coordenadasDaFace(inst, 180, pts);
    expect(g.u[0]).toBeCloseTo(200, 6);
    expect(g.v[0]).toBeCloseTo(-275, 6);
  });

  it('a peça que veio de um CAD (o y do arquivo para cima, o fio deitado na tela): o alto do arquivo fica em cima', () => {
    // Como a importação deixa: o arquivo como está (a cintura em y = 550), o fio ao longo do y do mundo.
    const doCad = criarMolde({ nome: 'saia-1', referencia: '', tamanho: '', contorno: [ponto(80, 550), ponto(480, 550), ponto(560, 0), ponto(0, 0)], linhaDeFio: { inicio: ponto(280, 50), fim: ponto(280, 500) } }, 'cad');
    const inst = instanciasDasPecas([doCad])[0]!;
    const f = coordenadasDaFace(inst, 0, Float64Array.from(inst.contorno.flatMap((p) => [p.x, p.y])));
    // A cintura (os pontos 0 e 1) em cima; a barra (2 e 3) embaixo.
    expect(f.v[0]).toBeGreaterThan(0);
    expect(f.v[1]).toBeGreaterThan(0);
    expect(f.v[2]).toBeLessThan(0);
    expect(f.v[3]).toBeLessThan(0);
  });

  it('a configuração sugerida pelo nome; a frente na frente (z > 0), as costas atrás, o topo na cintura', () => {
    const configs = configuracoesDasInstancias(instancias, MONTAGEM_VAZIA);
    expect(configs['f#0']).toMatchObject({ posicao: 'frente', alturaDoTopo: 'cintura' });
    expect(configs['c#0']).toMatchObject({ posicao: 'costas', alturaDoTopo: 'cintura' });
    const pts = Float64Array.from(instancias[0]!.contorno.flatMap((p) => [p.x, p.y]));
    const naFrente = posicoesDeArrumacao(FEMININO, instancias[0]!, configs['f#0']!, pts)!;
    const atras = posicoesDeArrumacao(FEMININO, instancias[1]!, configs['c#0']!, pts)!;
    expect(naFrente[2]).toBeGreaterThan(0);
    expect(atras[2]).toBeLessThan(0);
    expect(naFrente[1]).toBeCloseTo(FEMININO.niveis.cintura + 15, 6);
    // O ponto 0 da frente (à esquerda de quem olha) fica em −x; o das costas, visto de trás, em +x.
    expect(naFrente[0]).toBeLessThan(0);
    expect(atras[0]).toBeGreaterThan(0);
  });

  it('sugere as duas laterais (e não o cós nem a barra), no sentido que junta', () => {
    const montagem: Montagem3D = { ...MONTAGEM_VAZIA, pecas: configuracoesDasInstancias(instancias, MONTAGEM_VAZIA) };
    let n = 0;
    const costuras = sugerirCosturas(FEMININO, instancias, montagem, () => `c${++n}`);
    expect(costuras.map((c) => [c.a.chave, c.a.de, c.a.ate, c.b.chave, c.b.de, c.b.ate, c.invertida])).toEqual(
      expect.arrayContaining([
        ['f#0', 1, 2, 'c#0', 3, 0, true],
        ['f#0', 3, 0, 'c#0', 1, 2, true],
      ]),
    );
    expect(costuras).toHaveLength(2);
    expect(problemasDaCostura(costuras[0]!, instancias)).toEqual([]);
    // O molde mudou: a costura avisa.
    const mudada = instanciasDasPecas([{ ...frente, contorno: [...frente.contorno.slice(0, 3), ponto(560, 0)] }, costas]);
    expect(problemasDaCostura(costuras.find((c) => c.a.chave === 'f#0')!, mudada)[0]).toMatch(/o molde mudou/);
  });

  it('a leitura da montagem guardada (o que não serve volta ao padrão)', () => {
    const lida = lerMontagem3d({
      manequim: { publico: 'masculino', medidas: { alturaCm: 180, bustoCm: 'x' } },
      pecas: { 'f#0': { posicao: 'frente', alturaDoTopo: 'cintura', cor: '#112233', girarGraus: 45, estampa: { imagemId: 'i', modo: 'localizada', larguraMm: 80 } }, ruim: 3 },
      costuras: [{ id: 'k', a: { chave: 'f#0', de: 1, ate: 2 }, b: { chave: 'c#0', de: 3, ate: 0 }, invertida: true }, { id: 'quebrada' }],
      tecido: { preset: 'jeans', pesoGm2: 5000, elasticidade: -3 },
      resolucaoMm: 7,
    });
    expect(lida.manequim).toEqual({ publico: 'masculino', medidas: { ...MEDIDAS_DO_PUBLICO.masculino, alturaCm: 180 } });
    expect(lida.pecas['f#0']).toEqual({ posicao: 'frente', alturaDoTopo: 'cintura', ajusteMm: 0, desvioMm: 0, girarGraus: 0, cor: '#112233', estampa: { imagemId: 'i', modo: 'localizada', larguraMm: 80, alturaMm: 0 } });
    expect(Object.keys(lida.pecas)).toEqual(['f#0']);
    expect(lida.costuras).toHaveLength(1);
    expect(lida.tecido).toMatchObject({ preset: 'jeans', pesoGm2: 1000, elasticidade: 0 });
    expect(lida.resolucaoMm).toBe(20);
    expect(lerMontagem3d(null)).toBe(MONTAGEM_VAZIA);
  });
});

/**
 * Uma regata em pé na tela, vista pela face (x para a direita, y para cima): o decote (que sai em esquadro do ombro),
 * os ombros caídos, as cavas (que chegam deitadas na lateral), as laterais e a barra; 500 mm de largura e 650 de
 * altura. O decote desce `decote` mm no meio. Os pontos: 0–6 o decote, 6→7 e 16→0 os ombros, 7→10 e 13→16 as
 * cavas, 10→11 e 12→13 as laterais, 11→12 a barra.
 */
function pecaDeRegata(id: string, nome: string, decote: number): Molde {
  const naFace: [number, number][] = [
    [-80, 0],
    [-60, -decote * 0.6],
    [-30, -decote * 0.9],
    [0, -decote],
    [30, -decote * 0.9],
    [60, -decote * 0.6],
    [80, 0],
    [200, -40],
    [205, -120],
    [220, -175],
    [250, -200],
    [250, -650],
    [-250, -650],
    [-250, -200],
    [-220, -175],
    [-205, -120],
    [-200, -40],
  ];
  // Da face para o mundo: o y do mundo é o x da tela; o x do mundo, a altura para baixo.
  return criarMolde({ nome, referencia: 'REGATA', tamanho: 'M', contorno: naFace.map(([x, y]) => ponto(-y, x + 250)), linhaDeFio: { inicio: ponto(100, 250), fim: ponto(550, 250) } }, id);
}

describe('a regata: os ombros', () => {
  const instancias = instanciasDasPecas([pecaDeRegata('f', 'Frente da regata', 80), pecaDeRegata('c', 'Costas da regata', 25)]);
  const configuracoes = configuracoesDasInstancias(instancias, MONTAGEM_VAZIA);
  const montagem: Montagem3D = { ...MONTAGEM_VAZIA, pecas: configuracoes };

  it('sugere as laterais e os ombros — não as cavas, nem o decote, nem a barra', () => {
    let n = 0;
    const costuras = sugerirCosturas(FEMININO, instancias, montagem, () => `c${++n}`);
    const pares = costuras.map((c) => [c.a.de, c.a.ate, c.b.de, c.b.ate].join(','));
    // O ombro direito da frente (+x) com o esquerdo das costas (que, visto de trás, fica em +x); as laterais também.
    expect(pares.sort()).toEqual(['10,11,12,13', '12,13,10,11', '16,0,6,7', '6,7,16,0']);
  });

  it('pendurada pelos ombros: as costuras fecham, nada atravessa, o alto fica no ombro', () => {
    let n = 0;
    const costuras = sugerirCosturas(FEMININO, instancias, montagem, () => `c${++n}`);
    const tecido = TECIDOS_PRONTOS.malha.tecido;
    const sim = montarSimulacao({ corpo: FEMININO, instancias, configuracoes, malhas: malhasDasInstancias(instancias, configuracoes, 25), costuras, tecido });
    for (let t = 0; t < 5 * 60 && !(t > 60 && assentou(sim)); t++) avancar(sim, 1 / 60, 8);
    let yMax = -Infinity;
    for (let i = 0; i < sim.w.length; i++) yMax = Math.max(yMax, sim.x[3 * i + 1]!);
    expect(aberturaDasCosturas(sim)).toBeLessThan(6);
    expect(maiorPenetracao(sim)).toBeLessThan(4);
    expect(yMax).toBeGreaterThan(FEMININO.niveis.ombro - 30);
    expect(yMax).toBeLessThan(FEMININO.niveis.pescoco + 40);
  });
});

describe('a simulação do caimento', () => {
  function simularSaia(tecido = TECIDOS_PRONTOS.malha.tecido, segundos = 4) {
    const frente = pecaDeSaia('f', 'Frente da saia');
    const costas = pecaDeSaia('c', 'Costas da saia');
    const instancias = instanciasDasPecas([frente, costas]);
    const configuracoes = configuracoesDasInstancias(instancias, MONTAGEM_VAZIA);
    const montagem: Montagem3D = { ...MONTAGEM_VAZIA, pecas: configuracoes, tecido };
    let n = 0;
    const costuras = sugerirCosturas(FEMININO, instancias, montagem, () => `c${++n}`);
    const sim = montarSimulacao({ corpo: FEMININO, instancias, configuracoes, malhas: malhasDasInstancias(instancias, configuracoes, 25), costuras, tecido });
    for (let t = 0; t < segundos * 60 && !(t > 60 && assentou(sim)); t++) avancar(sim, 1 / 60, 8);
    return sim;
  }

  it('a saia costurada fica no corpo: as laterais fecham, nada atravessa, para entre a cintura e o quadril', () => {
    const sim = simularSaia();
    let yMax = -Infinity;
    for (let i = 0; i < sim.w.length; i++) yMax = Math.max(yMax, sim.x[3 * i + 1]!);
    expect(aberturaDasCosturas(sim)).toBeLessThan(6);
    expect(maiorPenetracao(sim)).toBeLessThan(4);
    // O cós (800 mm de volta) não passa do quadril (1000 mm): a saia não cai no chão.
    expect(yMax).toBeGreaterThan(FEMININO.niveis.quadril);
    expect(yMax).toBeLessThan(FEMININO.niveis.cintura + 60);
    // O tecido estica pouco no geral (a malha estica mais que o plano).
    const t = tensoes(sim);
    const media = t.reduce((s, v) => s + Math.max(0, v), 0) / t.length;
    expect(media).toBeLessThan(0.08);
  });

  it('o mesmo tecido, mais elástico, estica mais', () => {
    const elastico = tensoes(simularSaia({ ...TECIDOS_PRONTOS.malha.tecido, elasticidade: 90 }, 3));
    const firme = tensoes(simularSaia({ ...TECIDOS_PRONTOS.malha.tecido, elasticidade: 0 }, 3));
    const media = (t: Float32Array): number => t.reduce((s, v) => s + Math.max(0, v), 0) / t.length;
    expect(media(firme)).toBeLessThan(media(elastico));
  });
});

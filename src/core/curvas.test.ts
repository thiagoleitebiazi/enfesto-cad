import { describe, it, expect } from 'vitest';
import { area, comprimentoDaLinha, distancia, perimetro, ponto, contornosSeSobrepoem } from './geometria';
import {
  ajustarCurvaAosExtremos,
  arcoPorTresPontos,
  circulo,
  circuloPorTresPontos,
  curvaPorPontos,
  direcaoServeDeTangente,
  espiral,
  FOLGA_ENTRE_VOLTAS_DA_ESPIRAL_MM,
  MAXIMO_DE_PONTOS_DO_TRECHO,
  normalizarCurva,
  PASSO_DA_CURVA_MM,
  reamostrarLinha,
} from './curvas';

describe('curvaPorPontos', () => {
  it('passa exatamente por todos os pontos dados, na ordem', () => {
    const pontos = [ponto(0, 0), ponto(40, 30), ponto(100, 20), ponto(160, 60)];
    const curva = curvaPorPontos(pontos);
    expect(curva[0]).toEqual(pontos[0]);
    expect(curva.at(-1)).toEqual(pontos.at(-1));
    for (const p of pontos) expect(curva.some((c) => c.x === p.x && c.y === p.y)).toBe(true);
    // Ordem: os índices dos pontos dados crescem ao longo da curva.
    const indices = pontos.map((p) => curva.findIndex((c) => c.x === p.x && c.y === p.y));
    expect([...indices].sort((a, b) => a - b)).toEqual(indices);
  });

  it('entre os pontos é suave: nenhum passo passa muito do tamanho do passo da curva', () => {
    const curva = curvaPorPontos([ponto(0, 0), ponto(60, 40), ponto(120, 0)]);
    expect(curva.length).toBeGreaterThan(10);
    for (let i = 1; i < curva.length; i++) expect(distancia(curva[i - 1]!, curva[i]!)).toBeLessThan(PASSO_DA_CURVA_MM * 2.5);
  });

  it('com o ponto do meio fora da reta, a curva sai da reta para o lado dele', () => {
    const curva = curvaPorPontos([ponto(0, 0), ponto(50, 30), ponto(100, 0)]);
    expect(Math.max(...curva.map((p) => p.y))).toBeGreaterThanOrEqual(30);
    expect(Math.min(...curva.map((p) => p.y))).toBeGreaterThan(-1);
    expect(comprimentoDaLinha(curva)).toBeGreaterThan(100);
  });

  it('dois pontos dão a reta entre eles; pontos repetidos não contam', () => {
    expect(curvaPorPontos([ponto(0, 0), ponto(10, 0)])).toEqual([ponto(0, 0), ponto(10, 0)]);
    expect(curvaPorPontos([ponto(0, 0), ponto(0, 0), ponto(10, 0)])).toEqual([ponto(0, 0), ponto(10, 0)]);
  });
});

describe('circuloPorTresPontos e arcoPorTresPontos', () => {
  it('acha o centro e o raio do círculo', () => {
    const circuloAchado = circuloPorTresPontos(ponto(100, 0), ponto(0, 100), ponto(-100, 0));
    expect(circuloAchado!.centro.x).toBeCloseTo(0, 9);
    expect(circuloAchado!.centro.y).toBeCloseTo(0, 9);
    expect(circuloAchado!.raio).toBeCloseTo(100, 9);
  });

  it('três pontos em linha reta não formam círculo', () => {
    expect(circuloPorTresPontos(ponto(0, 0), ponto(50, 0), ponto(100, 0))).toBeNull();
    expect(arcoPorTresPontos(ponto(0, 0), ponto(50, 0), ponto(100, 0))).toEqual([ponto(0, 0), ponto(100, 0)]);
  });

  it('o arco vai do início ao fim passando pelo ponto do meio, sempre sobre o círculo', () => {
    // Meia volta de raio 100, por cima.
    const arco = arcoPorTresPontos(ponto(100, 0), ponto(0, 100), ponto(-100, 0));
    expect(arco[0]).toEqual(ponto(100, 0));
    expect(arco.at(-1)).toEqual(ponto(-100, 0));
    for (const p of arco) expect(Math.hypot(p.x, p.y)).toBeCloseTo(100, 6);
    expect(Math.min(...arco.map((p) => p.y))).toBeGreaterThanOrEqual(0);
    expect(comprimentoDaLinha(arco)).toBeCloseTo(Math.PI * 100, 0);
  });

  it('o ponto do meio escolhe o lado: por baixo, o arco passa por baixo', () => {
    const arco = arcoPorTresPontos(ponto(100, 0), ponto(0, -100), ponto(-100, 0));
    expect(Math.max(...arco.map((p) => p.y))).toBeLessThanOrEqual(1e-9);
  });

  it('um ponto do meio perto de uma ponta dá o arco maior, de mais de meia volta', () => {
    // Quase uma volta inteira: de (100,0) a (0,100) passando por (0,-100).
    const arco = arcoPorTresPontos(ponto(100, 0), ponto(0, -100), ponto(0, 100));
    expect(comprimentoDaLinha(arco)).toBeCloseTo(1.5 * Math.PI * 100, 0);
  });
});

describe('circulo', () => {
  it('é um contorno fechado com o raio pedido, começando no ponto clicado', () => {
    const contorno = circulo(ponto(50, 50), ponto(150, 50));
    expect(contorno[0]).toEqual(ponto(150, 50));
    for (const p of contorno) expect(distancia(p, ponto(50, 50))).toBeCloseTo(100, 6);
    // Polígono inscrito: área e perímetro um pouco abaixo dos do círculo.
    expect(area(contorno)).toBeGreaterThan(Math.PI * 100 * 100 * 0.995);
    expect(area(contorno)).toBeLessThan(Math.PI * 100 * 100);
    expect(perimetro(contorno)).toBeCloseTo(2 * Math.PI * 100, 0);
  });

  it('recusa raio zero', () => {
    expect(() => circulo(ponto(5, 5), ponto(5, 5))).toThrow('raio maior que zero');
  });
});

describe('espiral', () => {
  it('a borda de dentro mede o perímetro pedido e a tira tem a largura pedida', () => {
    const contorno = espiral(ponto(0, 0), 60, 1500);
    const metade = contorno.length / 2;
    const dentro = contorno.slice(0, metade);
    const fora = contorno.slice(metade).reverse();
    expect(comprimentoDaLinha(dentro)).toBeCloseTo(1500, 0);
    // Cada ponto de fora fica a uma largura do ponto de dentro de mesmo ângulo.
    dentro.forEach((p, i) => expect(distancia(p, fora[i]!)).toBeCloseTo(60, 6));
    expect(distancia(ponto(0, 0), dentro[0]!)).toBeCloseTo(60, 6);
  });

  it('as voltas não se encostam: a tira é um contorno simples, com a área de uma tira', () => {
    const contorno = espiral(ponto(0, 0), 40, 2000);
    const metade = contorno.length / 2;
    const dentro = contorno.slice(0, metade);
    // De uma volta para a seguinte, o raio cresce a largura mais a folga.
    const raios = dentro.map((p) => Math.hypot(p.x, p.y));
    expect(raios.every((r, i) => i === 0 || r > raios[i - 1]!)).toBe(true);
    // Área de uma tira: perto da largura vezes o comprimento do meio dela.
    const meioDaTira = (comprimentoDaLinha(dentro) + comprimentoDaLinha(contorno.slice(metade))) / 2;
    expect(area(contorno) / (40 * meioDaTira)).toBeCloseTo(1, 1);
    expect(FOLGA_ENTRE_VOLTAS_DA_ESPIRAL_MM).toBeGreaterThan(0);
    // Não se sobrepõe a uma cópia afastada (o teste de sobreposição aceita o contorno).
    expect(contornosSeSobrepoem(contorno, contorno.map((p) => ponto(p.x + 5000, p.y)))).toBe(false);
  });

  it('recusa largura ou perímetro que não são maiores que zero', () => {
    expect(() => espiral(ponto(0, 0), 0, 1000)).toThrow('largura');
    expect(() => espiral(ponto(0, 0), 50, -1)).toThrow('perímetro');
    expect(() => espiral(ponto(0, 0), Number.NaN, 1000)).toThrow('largura');
  });
});

describe('reamostrarLinha', () => {
  const linha = [ponto(0, 0), ponto(100, 0), ponto(100, 100)];

  it('devolve a quantidade pedida, com as pontas no lugar e os pontos igualmente espaçados', () => {
    const cinco = reamostrarLinha(linha, 5);
    expect(cinco).toEqual([ponto(0, 0), ponto(50, 0), ponto(100, 0), ponto(100, 50), ponto(100, 100)]);
  });

  it('com menos pontos a forma simplifica; com dois, sobra a reta entre as pontas', () => {
    expect(reamostrarLinha(linha, 2)).toEqual([ponto(0, 0), ponto(100, 100)]);
    const tres = reamostrarLinha(linha, 3);
    expect(tres[1]).toEqual(ponto(100, 0));
  });

  it('recusa menos de dois pontos', () => {
    expect(() => reamostrarLinha(linha, 1)).toThrow('pelo menos 2 pontos');
    expect(() => reamostrarLinha(linha, 2.5)).toThrow('pelo menos 2 pontos');
    expect(() => reamostrarLinha([ponto(0, 0)], 3)).toThrow('pelo menos dois pontos');
  });
});

describe('normalizarCurva e ajustarCurvaAosExtremos', () => {
  const curva = [ponto(10, 20), ponto(40, 50), ponto(90, 60), ponto(110, 20)];

  it('normalizada, a curva começa em (0,0) e termina em (1,0)', () => {
    const forma = normalizarCurva(curva);
    expect(forma[0]).toEqual(ponto(0, 0));
    expect(forma.at(-1)).toEqual(ponto(1, 0));
    expect(forma).toHaveLength(curva.length);
  });

  it('ajustada de volta aos mesmos extremos, é a curva original', () => {
    const devolvida = ajustarCurvaAosExtremos(normalizarCurva(curva), curva[0]!, curva.at(-1)!);
    devolvida.forEach((p, i) => {
      expect(p.x).toBeCloseTo(curva[i]!.x, 9);
      expect(p.y).toBeCloseTo(curva[i]!.y, 9);
    });
  });

  it('entre outros extremos, estica por igual e gira, mantendo a forma', () => {
    const forma = normalizarCurva(curva);
    // Corda duas vezes maior e virada 90°.
    const ajustada = ajustarCurvaAosExtremos(forma, ponto(0, 0), ponto(0, 200));
    expect(ajustada[0]).toEqual(ponto(0, 0));
    expect(ajustada.at(-1)).toEqual(ponto(0, 200));
    expect(comprimentoDaLinha(ajustada)).toBeCloseTo(comprimentoDaLinha(curva) * 2, 6);
  });

  it('espelhada, a curva vai para o outro lado da reta entre os extremos', () => {
    const forma = normalizarCurva(curva);
    const normal = ajustarCurvaAosExtremos(forma, ponto(0, 0), ponto(100, 0));
    const espelhada = ajustarCurvaAosExtremos(forma, ponto(0, 0), ponto(100, 0), true);
    normal.forEach((p, i) => {
      expect(espelhada[i]!.x).toBeCloseTo(p.x, 9);
      expect(espelhada[i]!.y).toBeCloseTo(-p.y, 9);
    });
  });

  it('recusa curva cujas pontas coincidem', () => {
    expect(() => normalizarCurva([ponto(5, 5), ponto(20, 30), ponto(5, 5)])).toThrow('não tem direção');
    expect(() => normalizarCurva([ponto(5, 5)])).toThrow('pelo menos dois pontos');
  });
});

describe('curvaPorPontos com a direção pedida nas pontas', () => {
  const PONTOS = [ponto(0, 0), ponto(40, 150), ponto(0, 300)];
  const graus = (de: { x: number; y: number }, ate: { x: number; y: number }): number => (Math.atan2(ate.y - de.y, ate.x - de.x) * 180) / Math.PI;
  type P = { x: number; y: number };
  /** A direção (graus) em que a linha sai do primeiro ponto: a tangente estimada pelos três primeiros pontos da amostra. */
  const saida = (linha: readonly P[]): number => {
    const [a, b, c] = [linha[0]!, linha[1]!, linha[2]!];
    return (Math.atan2(-3 * a.y + 4 * b.y - c.y, -3 * a.x + 4 * b.x - c.x) * 180) / Math.PI;
  };
  /** A direção em que a linha chega ao último ponto. */
  const chegada = (linha: readonly P[]): number => {
    const [a, b, c] = [linha.at(-1)!, linha.at(-2)!, linha.at(-3)!];
    return (Math.atan2(3 * a.y - 4 * b.y + c.y, 3 * a.x - 4 * b.x + c.x) * 180) / Math.PI;
  };
  const DA_CORDA = graus(ponto(0, 0), ponto(40, 150));

  it('sem direção, a curva sai de cada ponta na direção do ponto vizinho', () => {
    const curva = curvaPorPontos(PONTOS);
    expect(Math.abs(saida(curva) - DA_CORDA)).toBeLessThan(0.3);
  });

  it('com a direção, a curva sai da primeira ponta nela — e continua passando por todos os pontos', () => {
    // A reta até o vizinho sobe a 75°; a direção pedida, a 30°.
    const curva = curvaPorPontos(PONTOS, { inicio: ponto(Math.cos(Math.PI / 6), Math.sin(Math.PI / 6)) });

    expect(Math.abs(saida(curva) - 30)).toBeLessThan(0.3);
    expect(curva[0]).toEqual(PONTOS[0]);
    expect(curva.at(-1)).toEqual(PONTOS[2]);
    expect(curva.some((p) => Math.hypot(p.x - 40, p.y - 150) < 1e-9)).toBe(true);
    // O comprimento do vetor não conta: só a direção.
    expect(curvaPorPontos(PONTOS, { inicio: ponto(500 * Math.cos(Math.PI / 6), 500 * Math.sin(Math.PI / 6)) })).toEqual(curva);
  });

  it('na ponta final, a direção aponta de volta para a curva: ela chega vindo de lá', () => {
    // A direção pedida aponta para a direita e para baixo (-30°): a curva chega à ponta final vindo desse lado, a 150°.
    const curva = curvaPorPontos(PONTOS, { fim: ponto(Math.cos(-Math.PI / 6), Math.sin(-Math.PI / 6)) });

    expect(Math.abs(chegada(curva) - 150)).toBeLessThan(0.3);
    // A outra ponta não mudou.
    expect(Math.abs(saida(curva) - DA_CORDA)).toBeLessThan(0.3);
  });

  it('a direção a mais de 85° da reta até o vizinho não serve, e a curva fica como sem ela', () => {
    const paraTras = ponto(0, -1);
    expect(direcaoServeDeTangente(PONTOS[0]!, PONTOS[1]!, paraTras)).toBe(false);
    expect(curvaPorPontos(PONTOS, { inicio: paraTras })).toEqual(curvaPorPontos(PONTOS));
    // O limite é 85° para cada lado da reta até o vizinho.
    const a = (desvio: number): { x: number; y: number } => ponto(Math.cos(((DA_CORDA + desvio) * Math.PI) / 180), Math.sin(((DA_CORDA + desvio) * Math.PI) / 180));
    for (const desvio of [84, -84, 0]) expect(direcaoServeDeTangente(PONTOS[0]!, PONTOS[1]!, a(desvio))).toBe(true);
    for (const desvio of [86, -86, 180]) expect(direcaoServeDeTangente(PONTOS[0]!, PONTOS[1]!, a(desvio))).toBe(false);
    expect(direcaoServeDeTangente(PONTOS[0]!, PONTOS[1]!, ponto(0, 0))).toBe(false);
    expect(direcaoServeDeTangente(PONTOS[0]!, PONTOS[0]!, ponto(1, 0))).toBe(false);
  });
});

describe('reamostrarLinha — o limite de pontos', () => {
  it('aceita até o máximo e recusa acima dele, sem tentar montar a linha', () => {
    const linha = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    expect(reamostrarLinha(linha, MAXIMO_DE_PONTOS_DO_TRECHO)).toHaveLength(MAXIMO_DE_PONTOS_DO_TRECHO);
    expect(() => reamostrarLinha(linha, MAXIMO_DE_PONTOS_DO_TRECHO + 1)).toThrow(/até 2000 pontos/);
    expect(() => reamostrarLinha(linha, 1e9)).toThrow(/até 2000 pontos/);
  });
});

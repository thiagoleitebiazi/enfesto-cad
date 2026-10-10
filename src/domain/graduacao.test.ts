import { describe, it, expect } from 'vitest';
import { ponto, type Ponto2D } from '../core/geometria';
import {
  deslocamentoNoPonto,
  agruparTamanhos,
  ajustarEntre,
  alternarPontoGraduado,
  apagarRegras,
  cantosDoContorno,
  contornoDoTamanho,
  definirRegra,
  descontarPonto,
  deslocamentosDoContorno,
  graduacaoComOsPontosMovidos,
  indiceDoTamanho,
  iniciarGraduacao,
  lerTamanhos,
  MAXIMO_DE_TAMANHOS,
  pontoGraduadoEm,
  regraDoVertice,
  regraNoEixo,
  regraPeloTamanhoDeReferencia,
  regraPorPasso,
  removerPontoGraduado,
  semPontosSoltos,
  tamanhoDeReferencia,
  transformarGraduacao,
  verticesGraduados,
  type Graduacao,
} from './graduacao';

// Retângulo de 200 × 300 mm: os cantos são os pontos 1 a 4 (índices 0 a 3). Tamanhos P, M e G, com o M de base.
const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
const TAMANHOS = ['P', 'M', 'G'];
const ZERO = ponto(0, 0);
const P = 0;
const G = 2;
/** A regra em que o ponto anda (dx, dy) no G e o contrário no P. */
const regra = (dx: number, dy: number): Ponto2D[] => [ponto(0 - dx, 0 - dy), ZERO, ponto(dx, dy)];

function nova(contorno = RETANGULO): Graduacao {
  return iniciarGraduacao(contorno, TAMANHOS, 1);
}

function esperarPontos(obtido: readonly Ponto2D[], esperado: readonly Ponto2D[]): void {
  expect(obtido).toHaveLength(esperado.length);
  obtido.forEach((p, i) => {
    expect(p.x).toBeCloseTo(esperado[i]!.x, 9);
    expect(p.y).toBeCloseTo(esperado[i]!.y, 9);
  });
}

describe('tamanhos', () => {
  it('lê os tamanhos de uma linha, separados por vírgula ou ponto e vírgula', () => {
    expect(lerTamanhos('P, M, G')).toEqual(['P', 'M', 'G']);
    expect(lerTamanhos(' 36;38 ; 40,, ')).toEqual(['36', '38', '40']);
  });

  it('recusa menos de dois, mais que o máximo e nome repetido (sem diferenciar maiúsculas)', () => {
    expect(() => lerTamanhos('M')).toThrow(/pelo menos dois tamanhos/);
    expect(() => lerTamanhos('  ')).toThrow(/pelo menos dois tamanhos/);
    expect(() => lerTamanhos(Array.from({ length: MAXIMO_DE_TAMANHOS + 1 }, (_, i) => String(i)).join(','))).toThrow(/até 20 tamanhos/);
    expect(() => lerTamanhos('P, M, p')).toThrow(/“p” aparece mais de uma vez/);
  });

  it('acha o tamanho pelo nome, sem diferenciar maiúsculas nem espaços', () => {
    expect(indiceDoTamanho(TAMANHOS, 'g ')).toBe(2);
    expect(indiceDoTamanho(TAMANHOS, 'GG')).toBe(-1);
  });
});

describe('cantosDoContorno', () => {
  it('os quatro cantos do retângulo; um ponto no meio de uma aresta não é canto', () => {
    expect(cantosDoContorno(RETANGULO)).toEqual([0, 1, 2, 3]);
    expect(cantosDoContorno([ponto(0, 0), ponto(100, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)])).toEqual([0, 2, 3, 4]);
  });

  it('os pontos de uma curva (giro pequeno) não são cantos; os de um octógono (45°) são', () => {
    const poligono = (lados: number): Ponto2D[] =>
      Array.from({ length: lados }, (_, i) => ponto(100 * Math.cos((2 * Math.PI * i) / lados), 100 * Math.sin((2 * Math.PI * i) / lados)));
    expect(cantosDoContorno(poligono(36))).toEqual([]);
    expect(cantosDoContorno(poligono(8))).toHaveLength(8);
  });
});

describe('iniciarGraduacao', () => {
  it('os cantos entram como pontos graduados, sem deslocamento em nenhum tamanho', () => {
    const g = nova();
    expect(g.tamanhos).toEqual(TAMANHOS);
    expect(g.base).toBe(1);
    expect(g.pontos.map((p) => p.posicao)).toEqual(RETANGULO);
    expect(g.pontos.every((p) => p.deslocamentos.length === 3 && p.deslocamentos.every((d) => d.x === 0 && d.y === 0))).toBe(true);
    expect(verticesGraduados(g, RETANGULO)).toEqual([0, 1, 2, 3]);
  });

  it('recusa o base que não está na lista', () => {
    expect(() => iniciarGraduacao(RETANGULO, TAMANHOS, 3)).toThrow(/tamanho base/);
    expect(() => iniciarGraduacao(RETANGULO, TAMANHOS, -1)).toThrow(/tamanho base/);
  });
});

describe('deslocamentosDoContorno', () => {
  it('sem pontos graduados, ninguém se desloca', () => {
    const vazia: Graduacao = { tamanhos: TAMANHOS, base: 1, pontos: [] };
    expect(deslocamentosDoContorno(vazia, RETANGULO)).toEqual(RETANGULO.map(() => [ZERO, ZERO, ZERO]));
  });

  it('o ponto graduado tem a regra dele', () => {
    const g = definirRegra(nova(), RETANGULO, 2, regra(10, 20));
    const d = deslocamentosDoContorno(g, RETANGULO);
    expect(d[2]).toEqual(regra(10, 20));
    expect(d[0]).toEqual([ZERO, ZERO, ZERO]);
  });

  it('o ponto entre dois graduados anda na proporção da distância sobre o contorno', () => {
    // Um ponto a mais na lateral direita, a um quarto do caminho do canto (200, 0) ao canto (200, 300).
    const contorno = [ponto(0, 0), ponto(200, 0), ponto(200, 75), ponto(200, 300), ponto(0, 300)];
    const g = definirRegra(nova(contorno), contorno, 3, regra(10, 20));
    expect(verticesGraduados(g, contorno)).toEqual([0, 1, 3, 4]);
    esperarPontos(regraDoVertice(g, contorno, 2), regra(2.5, 5));
  });

  it('a proporção conta pela distância, passando por outros pontos proporcionais', () => {
    // Dois pontos soltos na lateral: a 100 e a 250 dos 300 mm.
    const contorno = [ponto(0, 0), ponto(200, 0), ponto(200, 100), ponto(200, 250), ponto(200, 300), ponto(0, 300)];
    const g = definirRegra(nova(contorno), contorno, 4, regra(30, 60));
    esperarPontos(regraDoVertice(g, contorno, 2), regra(10, 20));
    esperarPontos(regraDoVertice(g, contorno, 3), regra(25, 50));
  });

  it('dá a volta pelo fim da numeração: o ponto depois do último graduado fica entre ele e o primeiro', () => {
    // O ponto 5 está no meio da lateral esquerda, entre o canto (0, 300) e o canto (0, 0).
    const contorno = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300), ponto(0, 150)];
    let g = definirRegra(nova(contorno), contorno, 3, regra(0, 30));
    g = definirRegra(g, contorno, 0, regra(0, -10));
    esperarPontos(regraDoVertice(g, contorno, 4), regra(0, 10));
  });

  it('com um único ponto graduado, todos andam com ele', () => {
    const so: Graduacao = { tamanhos: TAMANHOS, base: 1, pontos: [{ posicao: ponto(200, 300), deslocamentos: regra(10, 20) }] };
    for (const d of deslocamentosDoContorno(so, RETANGULO)) esperarPontos(d, regra(10, 20));
  });

  it('o ponto graduado que não está mais sobre o contorno não conta', () => {
    const solta: Graduacao = { ...nova(), pontos: [...nova().pontos, { posicao: ponto(999, 999), deslocamentos: regra(50, 50) }] };
    expect(deslocamentosDoContorno(solta, RETANGULO)).toEqual(RETANGULO.map(() => [ZERO, ZERO, ZERO]));
    expect(semPontosSoltos(solta, RETANGULO).pontos).toHaveLength(4);
    expect(semPontosSoltos(nova(), RETANGULO)).toEqual(nova());
  });
});

describe('deslocamentoNoPonto: o que anda um ponto de dentro da peça', () => {
  // Só o canto (200, 300) anda, (10, 20).
  const SO_UM_CANTO = [ZERO, ZERO, ponto(10, 20), ZERO];

  it('em cima de um ponto do contorno, é o deslocamento dele', () => {
    expect(deslocamentoNoPonto(RETANGULO, SO_UM_CANTO, ponto(200, 300))).toEqual(ponto(10, 20));
    expect(deslocamentoNoPonto(RETANGULO, SO_UM_CANTO, ponto(0, 0))).toEqual(ZERO);
  });

  it('sobre uma aresta, é a proporção entre as duas pontas', () => {
    esperarPontos([deslocamentoNoPonto(RETANGULO, SO_UM_CANTO, ponto(200, 150))], [ponto(5, 10)]);
    esperarPontos([deslocamentoNoPonto(RETANGULO, SO_UM_CANTO, ponto(50, 300))], [ponto(2.5, 5)]);
    esperarPontos([deslocamentoNoPonto(RETANGULO, SO_UM_CANTO, ponto(100, 0))], [ZERO]);
  });

  it('dentro, fica entre os valores das bordas: mais perto do canto que anda, anda mais', () => {
    const perto = deslocamentoNoPonto(RETANGULO, SO_UM_CANTO, ponto(180, 270));
    const longe = deslocamentoNoPonto(RETANGULO, SO_UM_CANTO, ponto(20, 30));
    expect(perto.x).toBeGreaterThan(longe.x);
    expect(perto.x).toBeLessThan(10);
    expect(longe.x).toBeGreaterThan(0);
    // A direção é a do canto: y anda o dobro de x.
    expect(perto.y).toBeCloseTo(perto.x * 2, 9);
  });

  it('se o contorno todo anda igual, o ponto de dentro anda igual', () => {
    const todos = RETANGULO.map(() => ponto(7, -3));
    esperarPontos([deslocamentoNoPonto(RETANGULO, todos, ponto(63, 141))], [ponto(7, -3)]);
  });

  it('se o contorno cresce por igual, o ponto de dentro cresce na mesma proporção', () => {
    // 10% em x e 20% em y, a partir de (0, 0).
    const crescendo = RETANGULO.map((p) => ponto(p.x * 0.1, p.y * 0.2));
    esperarPontos([deslocamentoNoPonto(RETANGULO, crescendo, ponto(63, 141))], [ponto(6.3, 28.2)]);
    // Também num contorno que não é convexo.
    const emL = [ponto(0, 0), ponto(300, 0), ponto(300, 100), ponto(100, 100), ponto(100, 300), ponto(0, 300)];
    const doL = emL.map((p) => ponto(p.x * 0.1, p.y * 0.2));
    esperarPontos([deslocamentoNoPonto(emL, doL, ponto(50, 250))], [ponto(5, 50)]);
    esperarPontos([deslocamentoNoPonto(emL, doL, ponto(250, 50))], [ponto(25, 10)]);
  });
});

describe('contornoDoTamanho', () => {
  const g = definirRegra(nova(), RETANGULO, 2, regra(10, 20));

  it('o base é o contorno desenhado', () => {
    expect(contornoDoTamanho(g, RETANGULO, 1)).toEqual(RETANGULO);
  });

  it('nos outros tamanhos, cada ponto anda o que a regra manda', () => {
    expect(contornoDoTamanho(g, RETANGULO, G)).toEqual([ponto(0, 0), ponto(200, 0), ponto(210, 320), ponto(0, 300)]);
    expect(contornoDoTamanho(g, RETANGULO, P)).toEqual([ponto(0, 0), ponto(200, 0), ponto(190, 280), ponto(0, 300)]);
  });

  it('recusa o tamanho que não existe', () => {
    expect(() => contornoDoTamanho(g, RETANGULO, 3)).toThrow(/fora da graduação/);
  });
});

describe('definirRegra', () => {
  it('o ponto proporcional passa a ser graduado', () => {
    const contorno = [ponto(0, 0), ponto(200, 0), ponto(200, 150), ponto(200, 300), ponto(0, 300)];
    const g = definirRegra(nova(contorno), contorno, 2, regra(7, 0));
    expect(verticesGraduados(g, contorno)).toEqual([0, 1, 2, 3, 4]);
    expect(pontoGraduadoEm(g, contorno, 2)!.deslocamentos).toEqual(regra(7, 0));
  });

  it('no tamanho base o deslocamento é sempre zero', () => {
    const g = definirRegra(nova(), RETANGULO, 2, [ponto(-1, -1), ponto(99, 99), ponto(1, 1)]);
    expect(pontoGraduadoEm(g, RETANGULO, 2)!.deslocamentos).toEqual([ponto(-1, -1), ZERO, ponto(1, 1)]);
  });

  it('recusa a regra sem um deslocamento por tamanho, com valor que não é número, e o ponto fora do contorno', () => {
    expect(() => definirRegra(nova(), RETANGULO, 2, [ZERO, ZERO])).toThrow(/um deslocamento para cada tamanho/);
    expect(() => definirRegra(nova(), RETANGULO, 2, [ZERO, ZERO, ponto(Number.NaN, 0)])).toThrow(/precisam ser números/);
    expect(() => definirRegra(nova(), RETANGULO, 9, regra(1, 1))).toThrow(/fora do contorno/);
  });

  it('não muda a graduação recebida', () => {
    const original = nova();
    definirRegra(original, RETANGULO, 2, regra(10, 20));
    expect(original).toEqual(nova());
  });
});

describe('graduar curva: pôr e tirar um ponto graduado', () => {
  const contorno = [ponto(0, 0), ponto(200, 0), ponto(200, 150), ponto(200, 300), ponto(0, 300)];
  const g = definirRegra(nova(contorno), contorno, 3, regra(10, 20));

  it('o proporcional vira graduado com a regra que tinha: nenhum tamanho muda de forma', () => {
    const comOPonto = alternarPontoGraduado(g, contorno, 2);
    expect(verticesGraduados(comOPonto, contorno)).toContain(2);
    esperarPontos(pontoGraduadoEm(comOPonto, contorno, 2)!.deslocamentos, regra(5, 10));
    esperarPontos(contornoDoTamanho(comOPonto, contorno, G), contornoDoTamanho(g, contorno, G));
  });

  it('o graduado volta a ser proporcional', () => {
    const semOPonto = alternarPontoGraduado(alternarPontoGraduado(g, contorno, 2), contorno, 2);
    expect(verticesGraduados(semOPonto, contorno)).toEqual([0, 1, 3, 4]);
    expect(removerPontoGraduado(g, contorno, 2)).toEqual(g);
  });

  it('tirar um canto graduado muda a forma dos tamanhos: ele passa a andar entre os vizinhos', () => {
    // Sem o canto (200, 0) graduado, ele fica entre (0, 0), parado, e (200, 300), que anda (10, 20): a 200 de 500 mm.
    const semCanto = removerPontoGraduado(definirRegra(nova(), RETANGULO, 2, regra(10, 20)), RETANGULO, 1);
    esperarPontos(regraDoVertice(semCanto, RETANGULO, 1), regra(4, 8));
  });
});

describe('regras prontas', () => {
  it('passo constante: a mais em cada tamanho acima do base, a menos em cada um abaixo', () => {
    expect(regraPorPasso(nova(), ponto(2, 3))).toEqual([ponto(-2, -3), ZERO, ponto(2, 3)]);
    const cinco = iniciarGraduacao(RETANGULO, ['PP', 'P', 'M', 'G', 'GG'], 2);
    expect(regraPorPasso(cinco, ponto(5, 0)).map((d) => d.x)).toEqual([-10, -5, 0, 5, 10]);
  });

  it('o tamanho de referência é o maior, ou o menor quando o base é o maior', () => {
    expect(tamanhoDeReferencia(nova())).toBe(2);
    expect(tamanhoDeReferencia(iniciarGraduacao(RETANGULO, TAMANHOS, 2))).toBe(0);
  });

  it('pelo tamanho de referência: o deslocamento dado é o dele, e os outros vão por passos iguais', () => {
    expect(regraPeloTamanhoDeReferencia(nova(), ponto(10, 20))).toEqual(regra(10, 20));
    const cinco = iniciarGraduacao(RETANGULO, ['PP', 'P', 'M', 'G', 'GG'], 2);
    expect(regraPeloTamanhoDeReferencia(cinco, ponto(10, 20))).toEqual([ponto(-10, -20), ponto(-5, -10), ZERO, ponto(5, 10), ponto(10, 20)]);
    // Com o base no maior, a referência é o menor.
    const baseNoG = iniciarGraduacao(RETANGULO, TAMANHOS, 2);
    expect(regraPeloTamanhoDeReferencia(baseNoG, ponto(-10, -20))).toEqual([ponto(-10, -20), ponto(-5, -10), ZERO]);
  });

  it('regra só num eixo', () => {
    expect(regraNoEixo(regra(10, 20), regra(1, 2), 'ambos')).toEqual(regra(1, 2));
    expect(regraNoEixo(regra(10, 20), regra(1, 2), 'x')).toEqual(regra(1, 20));
    expect(regraNoEixo(regra(10, 20), regra(1, 2), 'y')).toEqual(regra(10, 2));
  });
});

describe('a graduação acompanha a peça', () => {
  const g = definirRegra(nova(), RETANGULO, 2, regra(10, 20));

  it('num movimento, as posições vão com os pontos e os deslocamentos com as direções', () => {
    const movida = transformarGraduacao(
      g,
      (p) => ponto(p.x + 5, p.y + 7),
      (v) => ponto(-v.y, v.x),
    );
    expect(movida.pontos[2]!.posicao).toEqual(ponto(205, 307));
    expect(movida.pontos[2]!.deslocamentos[G]).toEqual(ponto(-20, 10));
    expect(movida.tamanhos).toEqual(TAMANHOS);
  });

  it('quando um ponto do contorno muda de lugar, o ponto graduado vai com ele', () => {
    const novoContorno = [ponto(0, 0), ponto(200, 0), ponto(230, 310), ponto(0, 300)];
    const acompanhada = graduacaoComOsPontosMovidos(g, RETANGULO, novoContorno);
    expect(pontoGraduadoEm(acompanhada, novoContorno, 2)!.deslocamentos).toEqual(regra(10, 20));
    expect(verticesGraduados(acompanhada, novoContorno)).toEqual([0, 1, 2, 3]);
  });

  it('com outra quantidade de pontos, fica como está: vale a posição de cada um', () => {
    const comMaisUm = [ponto(0, 0), ponto(100, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
    expect(graduacaoComOsPontosMovidos(g, RETANGULO, comMaisUm)).toBe(g);
    // O canto (200, 300) agora é o ponto 4, e continua com a regra dele.
    expect(pontoGraduadoEm(g, comMaisUm, 3)!.deslocamentos).toEqual(regra(10, 20));
    expect(pontoGraduadoEm(g, comMaisUm, 1)).toBeNull();
  });
});

describe('deduzir: descontarPonto', () => {
  it('o ponto escolhido para de se deslocar, e a forma de cada tamanho continua a mesma', () => {
    const g = definirRegra(nova(), RETANGULO, 2, regra(10, 20));
    const empilhada = descontarPonto(g, RETANGULO, 2);
    expect(pontoGraduadoEm(empilhada, RETANGULO, 2)!.deslocamentos).toEqual([ZERO, ZERO, ZERO]);
    // O tamanho G inteiro andou (−10, −20): a mesma forma, noutro lugar.
    const antes = contornoDoTamanho(g, RETANGULO, G);
    esperarPontos(
      contornoDoTamanho(empilhada, RETANGULO, G),
      antes.map((p) => ponto(p.x - 10, p.y - 20)),
    );
  });

  it('vale para um ponto proporcional: desconta a regra que ele tem na proporção', () => {
    const contorno = [ponto(0, 0), ponto(200, 0), ponto(200, 150), ponto(200, 300), ponto(0, 300)];
    const g = definirRegra(nova(contorno), contorno, 3, regra(10, 20));
    const empilhada = descontarPonto(g, contorno, 2);
    esperarPontos(regraDoVertice(empilhada, contorno, 2), [ZERO, ZERO, ZERO]);
    esperarPontos(pontoGraduadoEm(empilhada, contorno, 0)!.deslocamentos, regra(-5, -10));
  });
});

describe('apagarRegras', () => {
  const g = definirRegra(definirRegra(nova(), RETANGULO, 2, regra(10, 20)), RETANGULO, 1, regra(4, 0));

  it('de um ponto, nos dois eixos ou só num', () => {
    expect(pontoGraduadoEm(apagarRegras(g, RETANGULO, 2, 'ambos'), RETANGULO, 2)!.deslocamentos).toEqual([ZERO, ZERO, ZERO]);
    expect(pontoGraduadoEm(apagarRegras(g, RETANGULO, 2, 'x'), RETANGULO, 2)!.deslocamentos).toEqual(regra(0, 20));
    expect(pontoGraduadoEm(apagarRegras(g, RETANGULO, 2, 'y'), RETANGULO, 2)!.deslocamentos).toEqual(regra(10, 0));
    // Os outros pontos não mudam.
    expect(pontoGraduadoEm(apagarRegras(g, RETANGULO, 2, 'ambos'), RETANGULO, 1)!.deslocamentos).toEqual(regra(4, 0));
  });

  it('de todos os pontos', () => {
    const apagada = apagarRegras(g, RETANGULO, null, 'x');
    expect(pontoGraduadoEm(apagada, RETANGULO, 2)!.deslocamentos).toEqual(regra(0, 20));
    expect(pontoGraduadoEm(apagada, RETANGULO, 1)!.deslocamentos).toEqual(regra(0, 0));
    expect(apagada.pontos).toHaveLength(4);
  });

  it('num ponto proporcional: ele passa a ser um ponto graduado parado', () => {
    const contorno = [ponto(0, 0), ponto(200, 0), ponto(200, 150), ponto(200, 300), ponto(0, 300)];
    const comRegra = definirRegra(nova(contorno), contorno, 3, regra(10, 20));
    const apagada = apagarRegras(comRegra, contorno, 2, 'ambos');
    expect(pontoGraduadoEm(apagada, contorno, 2)!.deslocamentos).toEqual([ZERO, ZERO, ZERO]);
  });
});

describe('agruparTamanhos', () => {
  // O canto 3 anda (10, 20) no G; o canto 2, (0, 5).
  const g = definirRegra(definirRegra(nova(), RETANGULO, 2, regra(10, 20)), RETANGULO, 1, regra(0, 5));

  it('com o passo zero, os tamanhos ficam empilhados no ponto de referência, e a forma de cada um não muda', () => {
    const agrupada = agruparTamanhos(g, RETANGULO, 2, ZERO, null);

    expect(regraDoVertice(agrupada, RETANGULO, 2)).toEqual([ZERO, ZERO, ZERO]);
    // A distância entre dois pontos do mesmo tamanho é a de antes: a peça só andou inteira.
    const lado = (graduacao: Graduacao, tamanho: number): Ponto2D => {
      const c = contornoDoTamanho(graduacao, RETANGULO, tamanho);
      return ponto(c[2]!.x - c[1]!.x, c[2]!.y - c[1]!.y);
    };
    expect(lado(agrupada, G)).toEqual(lado(g, G));
    expect(lado(agrupada, P)).toEqual(lado(g, P));
    expect(regraDoVertice(agrupada, RETANGULO, 1)).toEqual(regra(-10, -15));
  });

  it('com um passo, cada tamanho fica afastado do vizinho essa distância, a partir do base', () => {
    const afastada = agruparTamanhos(g, RETANGULO, 2, ponto(0, 50), null);

    expect(regraDoVertice(afastada, RETANGULO, 2)).toEqual([ponto(0, -50), ZERO, ponto(0, 50)]);
    expect(regraDoVertice(afastada, RETANGULO, 1)).toEqual([ponto(10, -35), ZERO, ponto(-10, 35)]);
  });

  it('num tamanho só, os outros ficam onde estavam', () => {
    const soOG = agruparTamanhos(g, RETANGULO, 2, ZERO, G);

    expect(regraDoVertice(soOG, RETANGULO, 2)).toEqual([ponto(-10, -20), ZERO, ZERO]);
    expect(regraDoVertice(soOG, RETANGULO, 1)[P]).toEqual(ponto(0, -5));
  });

  it('o ponto de referência pode ser um ponto proporcional', () => {
    const contorno = [ponto(0, 0), ponto(200, 0), ponto(200, 150), ponto(200, 300), ponto(0, 300)];
    const comRegra = definirRegra(nova(contorno), contorno, 3, regra(0, 20));
    const agrupada = agruparTamanhos(comRegra, contorno, 2, ZERO, null);

    expect(regraDoVertice(agrupada, contorno, 2)[G]!.y).toBeCloseTo(0, 9);
    expect(regraDoVertice(agrupada, contorno, 3)[G]!.y).toBeCloseTo(10, 9);
  });

  it('recusa o tamanho base, um tamanho que não existe e um ponto fora do contorno', () => {
    expect(() => agruparTamanhos(g, RETANGULO, 2, ZERO, 1)).toThrow('O tamanho base');
    expect(() => agruparTamanhos(g, RETANGULO, 2, ZERO, 7)).toThrow('Tamanho fora da graduação.');
    expect(() => agruparTamanhos(g, RETANGULO, 9, ZERO, null)).toThrow('Ponto fora do contorno');
  });
});

describe('ajustarEntre', () => {
  // Lado de 300 mm com dois pontos no meio, a 100 e a 250 mm do canto de cima. Os cantos são 1 e 4 (índices 1 e 4).
  const contorno = [ponto(0, 0), ponto(200, 0), ponto(200, 100), ponto(200, 250), ponto(200, 300), ponto(0, 300)];
  const g = definirRegra(definirRegra(nova(contorno), contorno, 1, regra(0, 0)), contorno, 4, regra(30, 60));

  it('os pontos do meio passam a andar na proporção da posição deles no contorno, entre o inicial e o final', () => {
    const ajustada = ajustarEntre(g, contorno, 1, [2, 3], 4, 'ambos');

    expect(regraDoVertice(ajustada, contorno, 2)[G]).toEqual(ponto(10, 20));
    expect(regraDoVertice(ajustada, contorno, 3)[G]).toEqual(ponto(25, 50));
    expect(regraDoVertice(ajustada, contorno, 3)[P]).toEqual(ponto(-25, -50));
    expect(pontoGraduadoEm(ajustada, contorno, 2)).not.toBeNull();
  });

  it('vale também indo contra a numeração dos pontos', () => {
    const ajustada = ajustarEntre(g, contorno, 4, [3], 1, 'ambos');

    // A 50 mm do inicial (o canto de baixo), num caminho de 300: fica com 5/6 da regra dele.
    expect(regraDoVertice(ajustada, contorno, 3)[G]!.x).toBeCloseTo(25, 9);
    expect(regraDoVertice(ajustada, contorno, 3)[G]!.y).toBeCloseTo(50, 9);
  });

  it('só num eixo, o outro fica com o que o ponto tinha', () => {
    const comRegraPropria = definirRegra(g, contorno, 2, regra(7, 7));

    expect(regraDoVertice(ajustarEntre(comRegraPropria, contorno, 1, [2], 4, 'x'), contorno, 2)[G]).toEqual(ponto(10, 7));
    expect(regraDoVertice(ajustarEntre(comRegraPropria, contorno, 1, [2], 4, 'y'), contorno, 2)[G]).toEqual(ponto(7, 20));
  });

  it('pontos espalhados pelos dois lados da peça: vale a projeção na reta do inicial ao final', () => {
    // Do canto 1 (200, 0) ao canto 4 (200, 300): o ponto 2 fica a 1/3; o canto 5 (0, 300), do outro lado, no fim.
    const ajustada = ajustarEntre(g, contorno, 1, [2, 5], 4, 'ambos');

    expect(regraDoVertice(ajustada, contorno, 2)[G]!.x).toBeCloseTo(10, 9);
    expect(regraDoVertice(ajustada, contorno, 5)[G]).toEqual(ponto(30, 60));
  });

  it('recusa sem pontos a ajustar, com o final igual ao inicial e com um extremo entre os ajustados', () => {
    expect(() => ajustarEntre(g, contorno, 1, [], 4, 'ambos')).toThrow('pelo menos um ponto a ajustar');
    expect(() => ajustarEntre(g, contorno, 1, [2], 1, 'ambos')).toThrow('diferente do inicial');
    expect(() => ajustarEntre(g, contorno, 1, [1, 2], 4, 'ambos')).toThrow('não entram entre os ajustados');
    expect(() => ajustarEntre(g, contorno, 1, [9], 4, 'ambos')).toThrow('Ponto fora do contorno');
  });
});

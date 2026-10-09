import { describe, it, expect } from 'vitest';
import { ponto, area } from '../core/geometria';
import {
  criarMolde,
  dimensoesDoMolde,
  anguloDaLinhaDeFio,
  rotacoesPermitidas,
  rotacaoEhPermitida,
  adicionarPique,
  removerPique,
  adicionarMarca,
  removerMarca,
  contornoDeCorte,
  transladarMolde,
  rotacionarMolde,
  espelharMolde,
  moverPontoDoMolde,
  moverVariosPontosDoMolde,
  modificarPontosDoMolde,
  redefinirComprimentoDaAresta,
  inserirPontoNoMolde,
  removerPontoDoMolde,
  chanfrarCantoDoMolde,
  arredondarCantoDoMolde,
  dimensionarMolde,
  RESTRICAO_PADRAO,
  type DadosDeNovoMolde,
} from './molde';

function dadosBase(sobrescrever: Partial<DadosDeNovoMolde> = {}): DadosDeNovoMolde {
  return {
    nome: 'Frente',
    referencia: 'REF-001',
    tamanho: 'M',
    contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)],
    linhaDeFio: { inicio: ponto(100, 50), fim: ponto(100, 250) },
    ...sobrescrever,
  };
}

describe('criarMolde', () => {
  it('cria um molde válido', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    expect(molde.id).toBe('m1');
    expect(molde.quantidade).toBe(1);
    expect(molde.restricaoDeRotacao).toEqual(RESTRICAO_PADRAO);
  });

  it('rejeita contorno com menos de 3 pontos', () => {
    expect(() => criarMolde(dadosBase({ contorno: [ponto(0, 0), ponto(1, 1)] }), 'm2')).toThrow(/3 pontos/);
  });

  it('rejeita contorno degenerado (área zero)', () => {
    const linha = [ponto(0, 0), ponto(10, 0), ponto(20, 0)];
    expect(() => criarMolde(dadosBase({ contorno: linha }), 'm3')).toThrow(/degenerado/);
  });

  it('rejeita quantidade menor que 1', () => {
    expect(() => criarMolde(dadosBase({ quantidade: 0 }), 'm4')).toThrow(/quantidade/);
  });

  it('rejeita furo com contorno degenerado', () => {
    const furoDegenerado = [ponto(50, 50), ponto(60, 50)];
    expect(() => criarMolde(dadosBase({ furos: [furoDegenerado] }), 'm5')).toThrow(/furo/);
  });

  it('rejeita margem de costura negativa', () => {
    expect(() => criarMolde(dadosBase({ margemDeCosturaMm: -1 }), 'm6')).toThrow(/margem/);
  });

  it('aceita furos, piques, marcas e margem de costura válidos', () => {
    const molde = criarMolde(
      dadosBase({
        furos: [[ponto(50, 50), ponto(70, 50), ponto(70, 70), ponto(50, 70)]],
        piques: [{ id: 'p1', posicao: ponto(0, 100), indiceAresta: 3 }],
        marcas: [{ id: 'm1', posicao: ponto(100, 150), rotulo: 'dobra' }],
        margemDeCosturaMm: 10,
      }),
      'm7',
    );
    expect(molde.furos).toHaveLength(1);
    expect(molde.piques).toHaveLength(1);
    expect(molde.marcas[0]?.rotulo).toBe('dobra');
    expect(molde.margemDeCosturaMm).toBe(10);
  });
});

describe('dimensoesDoMolde', () => {
  it('calcula largura, altura e área reais em mm', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    const dim = dimensoesDoMolde(molde);
    expect(dim.larguraMm).toBe(200);
    expect(dim.alturaMm).toBe(300);
    expect(dim.areaMm2).toBe(60000);
  });
});

describe('linha de fio', () => {
  it('ângulo de uma linha vertical (para cima) é 90°', () => {
    const angulo = anguloDaLinhaDeFio({ inicio: ponto(0, 0), fim: ponto(0, 100) });
    expect(angulo).toBeCloseTo(90, 6);
  });

  it('ângulo de uma linha horizontal (para a direita) é 0°', () => {
    const angulo = anguloDaLinhaDeFio({ inicio: ponto(0, 0), fim: ponto(100, 0) });
    expect(angulo).toBeCloseTo(0, 6);
  });
});

describe('restrição de rotação — regra crítica do sentido do fio', () => {
  it('por padrão só permite 0° (nenhuma rotação)', () => {
    expect(rotacoesPermitidas(RESTRICAO_PADRAO)).toEqual([0]);
    expect(rotacaoEhPermitida(RESTRICAO_PADRAO, 90)).toBe(false);
    expect(rotacaoEhPermitida(RESTRICAO_PADRAO, 180)).toBe(false);
    expect(rotacaoEhPermitida(RESTRICAO_PADRAO, 270)).toBe(false);
  });

  it('permite180 libera exatamente 0° e 180°, não 90/270', () => {
    const restricao = { permite180: true, permite90e270: false };
    expect(rotacoesPermitidas(restricao)).toEqual([0, 180]);
    expect(rotacaoEhPermitida(restricao, 180)).toBe(true);
    expect(rotacaoEhPermitida(restricao, 90)).toBe(false);
  });

  it('permite90e270 libera 0°, 90° e 270°, mas não 180° sozinho', () => {
    const restricao = { permite180: false, permite90e270: true };
    expect(rotacoesPermitidas(restricao)).toEqual([0, 90, 270]);
    expect(rotacaoEhPermitida(restricao, 180)).toBe(false);
    expect(rotacaoEhPermitida(restricao, 90)).toBe(true);
    expect(rotacaoEhPermitida(restricao, 270)).toBe(true);
  });

  it('normaliza ângulos fora de [0, 360) antes de comparar', () => {
    const restricao = { permite180: true, permite90e270: false };
    expect(rotacaoEhPermitida(restricao, -180)).toBe(true);
    expect(rotacaoEhPermitida(restricao, 540)).toBe(true);
  });

  it('nunca permite rotação alguma automaticamente só para caber melhor no tecido (não há flag de "auto-otimizar orientação")', () => {
    // Documenta a regra da seção 5: não existe, em lugar nenhum do domínio,
    // uma opção que ignore restricaoDeRotacao para melhorar aproveitamento.
    const restricaoTotalmenteFechada = { permite180: false, permite90e270: false };
    for (let angulo = -720; angulo <= 720; angulo += 15) {
      if (angulo % 360 === 0) continue;
      expect(rotacaoEhPermitida(restricaoTotalmenteFechada, angulo)).toBe(false);
    }
  });
});

describe('piques', () => {
  it('adiciona um pique na aresta mais próxima do clique', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    // dadosBase: contorno 200x300 com origem em (0,0); clicar perto de (0,150)
    // deve cair na aresta esquerda (índice 3: de (0,300) a (0,0)).
    const comPique = adicionarPique(molde, ponto(-5, 150), 'pique-1');
    expect(comPique.piques).toHaveLength(1);
    expect(comPique.piques[0]?.posicao).toEqual({ x: 0, y: 150 });
  });

  it('remove um pique pelo id', () => {
    const molde = adicionarPique(criarMolde(dadosBase(), 'm1'), ponto(-5, 150), 'pique-1');
    const semPique = removerPique(molde, 'pique-1');
    expect(semPique.piques).toHaveLength(0);
  });
});

describe('marcas', () => {
  it('adiciona uma marca com rótulo opcional', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    const comMarca = adicionarMarca(molde, ponto(100, 150), 'marca-1', 'centro');
    expect(comMarca.marcas[0]).toEqual({ id: 'marca-1', posicao: { x: 100, y: 150 }, rotulo: 'centro' });
  });

  it('remove uma marca pelo id', () => {
    const molde = adicionarMarca(criarMolde(dadosBase(), 'm1'), ponto(100, 150), 'marca-1');
    const semMarca = removerMarca(molde, 'marca-1');
    expect(semMarca.marcas).toHaveLength(0);
  });
});

describe('contornoDeCorte (margem de costura)', () => {
  it('sem margem, a linha de corte é igual ao contorno original', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    expect(contornoDeCorte(molde)).toBe(molde.contorno);
  });

  it('com margem, a linha de corte é maior que o contorno original', () => {
    const molde = criarMolde(dadosBase({ margemDeCosturaMm: 10 }), 'm1');
    expect(area(contornoDeCorte(molde))).toBeGreaterThan(area(molde.contorno));
  });
});

describe('transladarMolde', () => {
  it('translada contorno, furos, piques, marcas e linha de fio de forma consistente', () => {
    const original = adicionarMarca(
      adicionarPique(
        criarMolde(
          dadosBase({ furos: [[ponto(50, 50), ponto(70, 50), ponto(70, 70), ponto(50, 70)]] }),
          'm1',
        ),
        ponto(-5, 150),
        'pique-1',
      ),
      ponto(100, 150),
      'marca-1',
    );
    const deslocamento = ponto(30, -20);
    const copia = transladarMolde(original, deslocamento, 'm2');

    expect(copia.id).toBe('m2');
    expect(copia.contorno[0]).toEqual(ponto(30, -20));
    expect(copia.furos[0]?.[0]).toEqual(ponto(80, 30));
    expect(copia.piques[0]?.posicao).toEqual(ponto(30, 130));
    expect(copia.marcas[0]?.posicao).toEqual(ponto(130, 130));
    expect(copia.linhaDeFio.inicio).toEqual(somarPontos(original.linhaDeFio.inicio, deslocamento));
  });
});

function somarPontos(a: { x: number; y: number }, b: { x: number; y: number }) {
  return { x: a.x + b.x, y: a.y + b.y };
}

describe('rotacionarMolde', () => {
  it('novo molde começa com anguloDeRotacaoGraus = 0', () => {
    expect(criarMolde(dadosBase(), 'm1').anguloDeRotacaoGraus).toBe(0);
  });

  it('acumula o ângulo de rotação e normaliza em [0, 360)', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    const rotacionado90 = rotacionarMolde(molde, 90);
    expect(rotacionado90.anguloDeRotacaoGraus).toBe(90);
    const rotacionadoDeNovo = rotacionarMolde(rotacionado90, 300);
    expect(rotacionadoDeNovo.anguloDeRotacaoGraus).toBe(30);
  });

  it('preserva a área do contorno (rotação rígida)', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    const rotacionado = rotacionarMolde(molde, 37);
    expect(area(rotacionado.contorno)).toBeCloseTo(area(molde.contorno), 6);
  });

  it('rotaciona a linha de fio junto com o contorno (mesmo pivô)', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    const rotacionado = rotacionarMolde(molde, 90);
    // fio original vertical (100,50)-(100,250); após 90° deve ficar horizontal.
    const dx = rotacionado.linhaDeFio.fim.x - rotacionado.linhaDeFio.inicio.x;
    const dy = rotacionado.linhaDeFio.fim.y - rotacionado.linhaDeFio.inicio.y;
    expect(Math.abs(dy)).toBeLessThan(1e-6);
    expect(Math.abs(dx)).toBeGreaterThan(0);
  });

  it('rotaciona furos, piques e marcas junto com o contorno', () => {
    const comExtras = adicionarMarca(
      adicionarPique(
        criarMolde(dadosBase({ furos: [[ponto(90, 140), ponto(110, 140), ponto(110, 160), ponto(90, 160)]] }), 'm1'),
        ponto(-5, 150),
        'p1',
      ),
      ponto(60, 90),
      'ma1',
    );
    const posicaoOriginalDoPique = comExtras.piques[0]!.posicao;
    const rotacionado = rotacionarMolde(comExtras, 180);
    expect(rotacionado.piques[0]!.posicao).not.toEqual(posicaoOriginalDoPique);
    expect(rotacionado.furos[0]).not.toEqual(comExtras.furos[0]);
    expect(rotacionado.marcas[0]!.posicao).not.toEqual(comExtras.marcas[0]!.posicao);
  });

  it('rotação de 360° (ou 0°) mantém a peça geometricamente equivalente', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    const rotacionado = rotacionarMolde(molde, 360);
    expect(rotacionado.anguloDeRotacaoGraus).toBe(0);
    for (let i = 0; i < molde.contorno.length; i++) {
      expect(rotacionado.contorno[i]!.x).toBeCloseTo(molde.contorno[i]!.x, 6);
      expect(rotacionado.contorno[i]!.y).toBeCloseTo(molde.contorno[i]!.y, 6);
    }
  });
});

describe('permiteEspelhamento — regra crítica do sentido do fio (mesma família da rotação)', () => {
  it('RESTRICAO_PADRAO não permite espelhamento', () => {
    expect(RESTRICAO_PADRAO.permiteEspelhamento).toBe(false);
  });

  it('novo molde sem restrição explícita herda permiteEspelhamento: false', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    expect(molde.restricaoDeRotacao.permiteEspelhamento).toBe(false);
  });
});

describe('espelharMolde', () => {
  it('preserva a área do contorno (espelhamento é uma isometria)', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    const espelhado = espelharMolde(molde, 'm1-esp');
    expect(area(espelhado.contorno)).toBeCloseTo(area(molde.contorno), 6);
  });

  it('inverte X preservando Y, em torno do centro do retângulo envolvente', () => {
    // Contorno 200x300 com origem em (0,0): centro X = 100.
    const molde = criarMolde(dadosBase(), 'm1');
    const espelhado = espelharMolde(molde, 'm1-esp');
    // Ponto (0,0) -> (200,0); ponto (200,300) -> (0,300).
    expect(espelhado.contorno).toContainEqual(ponto(200, 0));
    expect(espelhado.contorno).toContainEqual(ponto(0, 300));
    for (const p of espelhado.contorno) {
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(300);
    }
  });

  it('espelha a linha de fio junto (inverte X, Y igual)', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    const espelhado = espelharMolde(molde, 'm1-esp');
    // Fio original vertical em x=100 (centro) -> permanece em x=100 (ponto fixo do próprio eixo de espelhamento).
    expect(espelhado.linhaDeFio.inicio.x).toBeCloseTo(100, 6);
    expect(espelhado.linhaDeFio.inicio.y).toBeCloseTo(molde.linhaDeFio.inicio.y, 6);
  });

  it('espelha furos, piques e marcas junto com o contorno', () => {
    const comExtras = adicionarMarca(
      adicionarPique(
        criarMolde(dadosBase({ furos: [[ponto(20, 140), ponto(40, 140), ponto(40, 160), ponto(20, 160)]] }), 'm1'),
        ponto(-5, 150),
        'p1',
      ),
      ponto(60, 90),
      'ma1',
    );
    const espelhado = espelharMolde(comExtras, 'm1-esp');
    expect(espelhado.furos[0]).not.toEqual(comExtras.furos[0]);
    expect(espelhado.piques[0]!.posicao.x).not.toBeCloseTo(comExtras.piques[0]!.posicao.x, 3);
    expect(espelhado.marcas[0]!.posicao.x).not.toBeCloseTo(comExtras.marcas[0]!.posicao.x, 3);
  });

  it('espelhar duas vezes restaura a peça original (é sua própria inversa)', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    const duasVezes = espelharMolde(espelharMolde(molde, 'm1-esp1'), 'm1-esp2');
    for (let i = 0; i < molde.contorno.length; i++) {
      expect(duasVezes.contorno[i]!.x).toBeCloseTo(molde.contorno[i]!.x, 6);
      expect(duasVezes.contorno[i]!.y).toBeCloseTo(molde.contorno[i]!.y, 6);
    }
  });
});

describe('moverPontoDoMolde', () => {
  it('move só o vértice indicado, resto do molde intacto', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    const movido = moverPontoDoMolde(molde, 1, ponto(210, 10));
    expect(movido.contorno[1]).toEqual(ponto(210, 10));
    expect(movido.contorno[0]).toEqual(molde.contorno[0]);
    expect(movido.linhaDeFio).toEqual(molde.linhaDeFio);
  });

  it('pique da aresta que mudou continua sobre ela, na mesma proporção; pique de aresta intacta não muda', () => {
    let molde = criarMolde(dadosBase(), 'm1'); // (0,0),(200,0),(200,300),(0,300)
    molde = adicionarPique(molde, ponto(100, 300), 'meio'); // aresta 2, a 50 %
    molde = adicionarPique(molde, ponto(50, 0), 'fixo'); // aresta 0, não tocada
    const movido = moverPontoDoMolde(molde, 2, ponto(200, 400)); // aresta 2 vira (200,400)→(0,300)
    const meio = movido.piques.find((p) => p.id === 'meio')!;
    expect(meio.indiceAresta).toBe(2);
    expect(meio.posicao.x).toBeCloseTo(100, 9);
    expect(meio.posicao.y).toBeCloseTo(350, 9);
    expect(movido.piques.find((p) => p.id === 'fixo')).toBe(molde.piques.find((p) => p.id === 'fixo'));
  });
});

describe('moverVariosPontosDoMolde', () => {
  it('pique de aresta com as duas pontas movidas acompanha o deslocamento', () => {
    let molde = criarMolde(dadosBase(), 'm1');
    molde = adicionarPique(molde, ponto(100, 300), 'p1'); // aresta 2: (200,300)→(0,300)
    const movido = moverVariosPontosDoMolde(molde, [2, 3], ponto(0, 100));
    expect(movido.piques[0]!.posicao.x).toBeCloseTo(100, 9);
    expect(movido.piques[0]!.posicao.y).toBeCloseTo(400, 9);
  });

  it('move só os vértices indicados pelo mesmo deslocamento, resto intacto', () => {
    const molde = criarMolde(dadosBase(), 'm1'); // (0,0),(200,0),(200,300),(0,300)
    const movido = moverVariosPontosDoMolde(molde, [0, 1], ponto(10, -5));
    expect(movido.contorno[0]).toEqual(ponto(10, -5));
    expect(movido.contorno[1]).toEqual(ponto(210, -5));
    expect(movido.contorno[2]).toEqual(molde.contorno[2]);
    expect(movido.contorno[3]).toEqual(molde.contorno[3]);
  });

  it('lista vazia de índices não muda nada', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    const movido = moverVariosPontosDoMolde(molde, [], ponto(100, 100));
    expect(movido.contorno).toEqual(molde.contorno);
  });
});

describe('modificarPontosDoMolde', () => {
  it('desloca só os pontos indicados pela medida digitada', () => {
    const molde = criarMolde(dadosBase(), 'm1'); // (0,0),(200,0),(200,300),(0,300)
    const modificado = modificarPontosDoMolde(molde, [2], ponto(15, -2.5));
    expect(modificado.contorno).toEqual([ponto(0, 0), ponto(200, 0), ponto(215, 297.5), ponto(0, 300)]);
  });

  it('recusa o deslocamento que deixaria o contorno sem área', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    // Os pontos 3 e 4 descem até os pontos 1 e 2: o contorno vira uma linha.
    expect(() => modificarPontosDoMolde(molde, [2, 3], ponto(0, -300))).toThrow(/"Frente" ficaria sem área/);
  });

  it('recusa nenhum ponto, ponto fora do contorno e medida que não é número', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    expect(() => modificarPontosDoMolde(molde, [], ponto(1, 0))).toThrow(/pelo menos um ponto/);
    expect(() => modificarPontosDoMolde(molde, [4], ponto(1, 0))).toThrow(/fora do contorno/);
    expect(() => modificarPontosDoMolde(molde, [0], ponto(Number.NaN, 0))).toThrow(/inválido/);
  });
});

describe('redefinirComprimentoDaAresta', () => {
  // dadosBase: (0,0),(200,0),(200,300),(0,300). Aresta 0 = (0,0)→(200,0), 200 mm.
  it('uni-direcional pelo fim: só o vértice do fim anda, na mesma direção', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    const redefinido = redefinirComprimentoDaAresta(molde, 0, 250, 'fim');
    expect(redefinido.contorno).toEqual([ponto(0, 0), ponto(250, 0), ponto(200, 300), ponto(0, 300)]);
  });

  it('uni-direcional pelo início: só o vértice do início anda', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    const redefinido = redefinirComprimentoDaAresta(molde, 0, 250, 'inicio');
    expect(redefinido.contorno).toEqual([ponto(-50, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)]);
  });

  it('bi-direcional: as duas pontas andam metade cada e o meio da aresta fica no lugar', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    const redefinido = redefinirComprimentoDaAresta(molde, 0, 250, 'ambas');
    expect(redefinido.contorno).toEqual([ponto(-25, 0), ponto(225, 0), ponto(200, 300), ponto(0, 300)]);
  });

  it('encolhe a aresta e funciona na última aresta, que fecha o contorno', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    // Aresta 3 = (0,300)→(0,0): o fim dela é o vértice 0.
    const redefinido = redefinirComprimentoDaAresta(molde, 3, 120, 'fim');
    expect(redefinido.contorno[0]!.x).toBeCloseTo(0, 9);
    expect(redefinido.contorno[0]!.y).toBeCloseTo(180, 9);
    expect(redefinido.contorno.slice(1)).toEqual(molde.contorno.slice(1));
  });

  it('a aresta passa a medir o valor pedido mesmo inclinada', () => {
    const molde = criarMolde(dadosBase({ contorno: [ponto(0, 0), ponto(30, 40), ponto(0, 80)] }), 'm1');
    const redefinido = redefinirComprimentoDaAresta(molde, 0, 75, 'fim'); // de 50 para 75 mm
    expect(redefinido.contorno[1]!.x).toBeCloseTo(45, 9);
    expect(redefinido.contorno[1]!.y).toBeCloseTo(60, 9);
  });

  it('pique da aresta fica onde estava; pique da aresta vizinha acompanha na mesma proporção', () => {
    let molde = criarMolde(dadosBase(), 'm1');
    molde = adicionarPique(molde, ponto(50, 0), 'na-aresta'); // aresta 0, a 50 mm do ponto parado
    molde = adicionarPique(molde, ponto(200, 150), 'vizinho'); // aresta 1, no meio
    const redefinido = redefinirComprimentoDaAresta(molde, 0, 250, 'fim');
    expect(redefinido.piques.find((p) => p.id === 'na-aresta')!.posicao).toEqual(ponto(50, 0));
    const vizinho = redefinido.piques.find((p) => p.id === 'vizinho')!;
    // Aresta 1 passou a ir de (250,0) a (200,300): o meio dela é (225,150).
    expect(vizinho.posicao.x).toBeCloseTo(225, 9);
    expect(vizinho.posicao.y).toBeCloseTo(150, 9);
  });

  it('recusa encolher a aresta a ponto de deixar um pique dela para fora', () => {
    const molde = adicionarPique(criarMolde(dadosBase(), 'm1'), ponto(150, 0), 'p1');
    expect(() => redefinirComprimentoDaAresta(molde, 0, 100, 'fim')).toThrow(/pique/);
    // Encolhendo pela outra ponta, o pique continua sobre a aresta.
    expect(redefinirComprimentoDaAresta(molde, 0, 100, 'inicio').piques[0]!.posicao).toEqual(ponto(150, 0));
  });

  it('recusa comprimento zero, negativo ou que não é número', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    expect(() => redefinirComprimentoDaAresta(molde, 0, 0, 'fim')).toThrow(/maior que zero/);
    expect(() => redefinirComprimentoDaAresta(molde, 0, -5, 'fim')).toThrow(/maior que zero/);
    expect(() => redefinirComprimentoDaAresta(molde, 0, Number.NaN, 'fim')).toThrow(/maior que zero/);
  });

  it('recusa aresta que não existe e aresta sem comprimento', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    expect(() => redefinirComprimentoDaAresta(molde, 4, 100, 'fim')).toThrow(/fora do contorno/);
    const comPontoRepetido = criarMolde(
      dadosBase({ contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)] }),
      'm2',
    );
    expect(() => redefinirComprimentoDaAresta(comPontoRepetido, 1, 100, 'fim')).toThrow(/não tem comprimento/);
  });

  it('recusa o comprimento que deixaria o contorno sem área', () => {
    // Contorno que já se cruza (aceito, porque tem área); com a aresta 0 em
    // 20 mm as duas metades se anulam e a área vai a zero.
    const molde = criarMolde(dadosBase({ contorno: [ponto(0, 0), ponto(50, 0), ponto(10, 10), ponto(30, 10)] }), 'm1');
    expect(() => redefinirComprimentoDaAresta(molde, 0, 20, 'fim')).toThrow(/ficaria sem área/);
  });
});

describe('inserirPontoNoMolde', () => {
  it('insere o vértice e ajusta índice de pique em aresta depois do ponto de inserção', () => {
    // pique na aresta 2 (de contorno[2]=(200,300) para contorno[3]=(0,300))
    const comPique = adicionarPique(criarMolde(dadosBase(), 'm1'), ponto(100, 300), 'p1');
    expect(comPique.piques[0]!.indiceAresta).toBe(2);
    const editado = inserirPontoNoMolde(comPique, 0, ponto(100, 0)); // insere na aresta 0
    expect(editado.contorno.length).toBe(5);
    expect(editado.piques[0]!.indiceAresta).toBe(3); // deslocado +1
  });

  it('não desloca pique em aresta antes do ponto de inserção', () => {
    const comPique = adicionarPique(criarMolde(dadosBase(), 'm1'), ponto(0, 150), 'p1'); // aresta 3
    const editado = inserirPontoNoMolde(comPique, 3, ponto(0, 100));
    // pique estava exatamente na aresta editada (3): não é > 3, então mantém o índice
    expect(editado.piques[0]!.indiceAresta).toBe(3);
  });
});

describe('removerPontoDoMolde', () => {
  it('lança erro se o contorno ficaria com menos de 3 pontos', () => {
    const triangulo = criarMolde(dadosBase({ contorno: [ponto(0, 0), ponto(10, 0), ponto(5, 10)] }), 'm1');
    expect(() => removerPontoDoMolde(triangulo, 0)).toThrow();
  });

  it('remove o vértice e ajusta índice de pique em aresta distante', () => {
    const pentagono = criarMolde(
      dadosBase({ contorno: [ponto(0, 0), ponto(10, 0), ponto(15, 5), ponto(10, 10), ponto(0, 10)] }),
      'm1',
    );
    const comPique = adicionarPique(pentagono, ponto(0, 5), 'p1'); // aresta 4 (de (0,10) a (0,0))
    expect(comPique.piques[0]!.indiceAresta).toBe(4);
    const editado = removerPontoDoMolde(comPique, 2); // remove o vértice do meio, longe do pique
    expect(editado.contorno.length).toBe(4);
    expect(editado.piques[0]!.indiceAresta).toBe(3); // deslocado -1 (estava depois do índice removido)
  });

  it('descarta pique cuja aresta foi diretamente afetada pela remoção', () => {
    const pentagono = criarMolde(
      dadosBase({ contorno: [ponto(0, 0), ponto(10, 0), ponto(15, 5), ponto(10, 10), ponto(0, 10)] }),
      'm1',
    );
    const comPique = adicionarPique(pentagono, ponto(12, 2), 'p1'); // aresta 1 (de (10,0) a (15,5))
    expect(comPique.piques[0]!.indiceAresta).toBe(1);
    const editado = removerPontoDoMolde(comPique, 2); // remove (15,5): funde arestas 1 e 2
    expect(editado.piques).toHaveLength(0);
  });
});

describe('chanfrarCantoDoMolde / arredondarCantoDoMolde', () => {
  it('chanfrar substitui o vértice por dois pontos, preservando piques distantes', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    const comPique = adicionarPique(molde, ponto(0, 150), 'p1'); // aresta 3
    const chanfrado = chanfrarCantoDoMolde(comPique, 1, 20); // chanfra o vértice (200,0)
    expect(chanfrado.contorno.length).toBe(5);
    expect(chanfrado.piques[0]!.indiceAresta).toBe(4); // deslocado +1
  });

  it('arredondar substitui o vértice por um arco, preservando piques distantes', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    const comPique = adicionarPique(molde, ponto(0, 150), 'p1'); // aresta 3
    const arredondado = arredondarCantoDoMolde(comPique, 1, 20); // arredonda o vértice (200,0)
    expect(arredondado.contorno.length).toBeGreaterThan(molde.contorno.length);
    expect(area(arredondado.contorno)).toBeLessThan(area(molde.contorno));
    expect(arredondado.piques[0]!.indiceAresta).toBeGreaterThan(comPique.piques[0]!.indiceAresta);
  });
});

describe('dimensionarMolde', () => {
  it('escala o contorno mantendo o canto superior esquerdo do retângulo envolvente fixo', () => {
    const molde = criarMolde(dadosBase(), 'm1'); // bbox: (0,0)-(200,300)
    const escalado = dimensionarMolde(molde, 0.5, 2);
    expect(escalado.contorno).toEqual([ponto(0, 0), ponto(100, 0), ponto(100, 600), ponto(0, 600)]);
  });

  it('escala a linha de fio e mantém quantidade/restrições intactas', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    const escalado = dimensionarMolde(molde, 2, 1);
    expect(escalado.linhaDeFio.inicio.x).toBeCloseTo(200, 9);
    expect(escalado.quantidade).toBe(molde.quantidade);
    expect(escalado.restricaoDeRotacao).toEqual(molde.restricaoDeRotacao);
  });

  it('rejeita fatores zero ou negativos', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    expect(() => dimensionarMolde(molde, 0, 1)).toThrow();
    expect(() => dimensionarMolde(molde, 1, -1)).toThrow();
  });
});

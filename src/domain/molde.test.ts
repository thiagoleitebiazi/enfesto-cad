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

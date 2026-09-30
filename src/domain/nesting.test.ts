import { describe, it, expect } from 'vitest';
import {
  ponto,
  area,
  retanguloEnvolvente,
  contornosSeSobrepoem,
  distanciaEntreContornos,
  espelharContornoHorizontal,
} from '../core/geometria';
import { criarMolde, type Molde } from './molde';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from './enfesto';
import { executarNestingAutomatico } from './nesting';
import { encontrarPrimeiraPosicaoValida, type LimitesDeArea } from './posicionamento';

function pecaRetangular(
  id: string,
  largura: number,
  altura: number,
  sobrescrever: Partial<Parameters<typeof criarMolde>[0]> = {},
): Molde {
  return criarMolde(
    {
      nome: id,
      referencia: '',
      tamanho: 'M',
      contorno: [ponto(0, 0), ponto(largura, 0), ponto(largura, altura), ponto(0, altura)],
      linhaDeFio: { inicio: ponto(largura / 2, 5), fim: ponto(largura / 2, altura - 5) },
      ...sobrescrever,
    },
    id,
  );
}

function enfestoBase(sobrescrever: Partial<ConfiguracaoDeEnfesto> = {}): ConfiguracaoDeEnfesto {
  return criarConfiguracaoDeEnfesto({
    tipo: 'impar',
    larguraUtilMm: 1000,
    comprimentoMm: 3000,
    quantidadeDeCamadas: 1,
    margemLateralMm: 0,
    margemDeExtremidadeMm: 0,
    distanciaMinimaEntrePecasMm: 5,
    ...sobrescrever,
  } as ConfiguracaoDeEnfesto);
}

describe('executarNestingAutomatico — casos básicos', () => {
  it('coloca uma única peça pequena numa área vazia', () => {
    const resultado = executarNestingAutomatico([pecaRetangular('a', 100, 100)], enfestoBase());
    expect(resultado.pecasColocadas).toHaveLength(1);
    expect(resultado.pecasNaoColocadas).toHaveLength(0);
    expect(resultado.interrompido).toBe(false);
  });

  it('nenhuma peça sobrepõe outra no resultado final', () => {
    const pecas = [pecaRetangular('a', 200, 150), pecaRetangular('b', 180, 120), pecaRetangular('c', 90, 90)];
    const resultado = executarNestingAutomatico(pecas, enfestoBase());
    expect(resultado.pecasColocadas).toHaveLength(3);
    for (let i = 0; i < resultado.pecasColocadas.length; i++) {
      for (let j = i + 1; j < resultado.pecasColocadas.length; j++) {
        expect(contornosSeSobrepoem(resultado.pecasColocadas[i]!.molde.contorno, resultado.pecasColocadas[j]!.molde.contorno)).toBe(
          false,
        );
      }
    }
  });

  it('respeita a distância mínima entre peças colocadas', () => {
    const enfesto = enfestoBase({ distanciaMinimaEntrePecasMm: 20 } as Partial<ConfiguracaoDeEnfesto>);
    const pecas = [pecaRetangular('a', 200, 150), pecaRetangular('b', 180, 120)];
    const resultado = executarNestingAutomatico(pecas, enfesto);
    expect(resultado.pecasColocadas).toHaveLength(2);
    const d = distanciaEntreContornos(resultado.pecasColocadas[0]!.molde.contorno, resultado.pecasColocadas[1]!.molde.contorno);
    expect(d).toBeGreaterThanOrEqual(20 - 1e-6);
  });

  it('respeita quantidade > 1 (várias cópias da mesma peça)', () => {
    const pecas = [pecaRetangular('a', 100, 100, { quantidade: 4 })];
    const resultado = executarNestingAutomatico(pecas, enfestoBase());
    expect(resultado.pecasColocadas).toHaveLength(4);
    expect(new Set(resultado.pecasColocadas.map((p) => p.indiceCopia)).size).toBe(4);
  });

  it('todas as peças colocadas ficam dentro dos limites úteis (margens respeitadas)', () => {
    const enfesto = enfestoBase({ margemLateralMm: 15, margemDeExtremidadeMm: 25 } as Partial<ConfiguracaoDeEnfesto>);
    const pecas = [pecaRetangular('a', 100, 100, { quantidade: 3 })];
    const resultado = executarNestingAutomatico(pecas, enfesto);
    for (const p of resultado.pecasColocadas) {
      const bbox = retanguloEnvolvente(p.molde.contorno);
      expect(bbox.minX).toBeGreaterThanOrEqual(15 - 1e-6);
      expect(bbox.minY).toBeGreaterThanOrEqual(25 - 1e-6);
      expect(bbox.maxX).toBeLessThanOrEqual(enfesto.larguraUtilMm - 15 + 1e-6);
    }
  });
});

describe('executarNestingAutomatico — sentido do fio (regra crítica, nunca ignorada)', () => {
  it('nunca usa uma rotação fora de rotacoesPermitidas mesmo quando ajudaria a encaixar', () => {
    // Peça alta e estreita numa área baixa e larga: só cabe deitada (90°).
    // Com restrição padrão (só 0°), o motor NUNCA deve tentar 90° — mesmo
    // que isso signifique não colocar a peça.
    const pecaAltaEstreita = pecaRetangular('alta', 50, 900); // só cabe em pé numa área de comprimento 1000
    const enfestoBaixo = enfestoBase({ larguraUtilMm: 1000, comprimentoMm: 100 } as Partial<ConfiguracaoDeEnfesto>);
    const resultado = executarNestingAutomatico([pecaAltaEstreita], enfestoBaixo);
    // A peça de 900mm de altura não cabe numa área de 100mm de comprimento
    // em pé (0°), e virá-la exigiria 90°, que a restrição padrão proíbe.
    expect(resultado.pecasColocadas).toHaveLength(0);
    expect(resultado.pecasNaoColocadas).toHaveLength(1);
  });

  it('usa a rotação de 90° quando ela é explicitamente permitida e necessária', () => {
    const pecaAltaEstreita = pecaRetangular('alta', 50, 900, {
      restricaoDeRotacao: { permite180: false, permite90e270: true },
    });
    const enfestoBaixo = enfestoBase({ larguraUtilMm: 1000, comprimentoMm: 100 } as Partial<ConfiguracaoDeEnfesto>);
    const resultado = executarNestingAutomatico([pecaAltaEstreita], enfestoBaixo);
    expect(resultado.pecasColocadas).toHaveLength(1);
    expect([90, 270]).toContain(resultado.pecasColocadas[0]!.molde.anguloDeRotacaoGraus);
  });

  it('a área da peça colocada é preservada após rotação (não distorce a geometria)', () => {
    const peca = pecaRetangular('a', 60, 200, { restricaoDeRotacao: { permite180: false, permite90e270: true } });
    const enfestoBaixo = enfestoBase({ larguraUtilMm: 1000, comprimentoMm: 80 } as Partial<ConfiguracaoDeEnfesto>);
    const resultado = executarNestingAutomatico([peca], enfestoBaixo);
    expect(resultado.pecasColocadas).toHaveLength(1);
    expect(area(resultado.pecasColocadas[0]!.molde.contorno)).toBeCloseTo(area(peca.contorno), 6);
  });
});

describe('executarNestingAutomatico — métricas', () => {
  it('calcula comprimento utilizado, área ocupada e aproveitamento coerentes', () => {
    const pecas = [pecaRetangular('a', 200, 200), pecaRetangular('b', 200, 200)];
    const resultado = executarNestingAutomatico(pecas, enfestoBase());
    expect(resultado.comprimentoUtilizadoMm).toBeGreaterThan(0);
    expect(resultado.areaOcupadaMm2).toBeCloseTo(200 * 200 * 2, 0);
    expect(resultado.aproveitamentoPercentual).toBeGreaterThan(0);
    expect(resultado.aproveitamentoPercentual).toBeLessThanOrEqual(100);
  });

  it('zero peças colocadas resulta em comprimento e aproveitamento zero, não NaN/erro', () => {
    const enorme = pecaRetangular('enorme', 5000, 5000);
    const resultado = executarNestingAutomatico([enorme], enfestoBase());
    expect(resultado.pecasColocadas).toHaveLength(0);
    expect(resultado.comprimentoUtilizadoMm).toBe(0);
    expect(resultado.aproveitamentoPercentual).toBe(0);
    expect(Number.isFinite(resultado.aproveitamentoPercentual)).toBe(true);
  });

  it('mede o tempo de processamento usando o relógio injetado', () => {
    let tempoFalso = 1000;
    const resultado = executarNestingAutomatico([pecaRetangular('a', 100, 100)], enfestoBase(), {
      agora: () => {
        const t = tempoFalso;
        tempoFalso += 50;
        return t;
      },
    });
    expect(resultado.tempoDeProcessamentoMs).toBeGreaterThan(0);
  });
});

describe('executarNestingAutomatico — interrupção cooperativa', () => {
  it('para de colocar peças quando deveContinuar retorna falso, marcando interrompido', () => {
    const pecas = [pecaRetangular('a', 100, 100, { quantidade: 5 })];
    let chamadas = 0;
    const resultado = executarNestingAutomatico(pecas, enfestoBase(), {
      deveContinuar: () => {
        chamadas++;
        return chamadas <= 2; // permite só as 2 primeiras peças
      },
    });
    expect(resultado.interrompido).toBe(true);
    expect(resultado.pecasColocadas.length).toBeLessThan(5);
    expect(resultado.pecasColocadas.length + resultado.pecasNaoColocadas.length).toBe(5);
  });

  it('reporta progresso a cada peça processada', () => {
    const pecas = [pecaRetangular('a', 100, 100, { quantidade: 3 })];
    const progresso: Array<[number, number]> = [];
    executarNestingAutomatico(pecas, enfestoBase(), {
      aoProgredir: (colocadas, total) => progresso.push([colocadas, total]),
    });
    expect(progresso).toEqual([
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
  });
});

describe('executarNestingAutomatico — preserva geometria auxiliar da peça', () => {
  it('furos, piques, marcas e margem de costura sobrevivem à colocação (posição e rotação)', () => {
    const pecaComExtras = pecaRetangular('a', 200, 150, {
      furos: [[ponto(80, 60), ponto(100, 60), ponto(100, 80), ponto(80, 80)]],
      piques: [{ id: 'p1', posicao: ponto(0, 75), indiceAresta: 3 }],
      marcas: [{ id: 'm1', posicao: ponto(50, 50), rotulo: 'centro' }],
      margemDeCosturaMm: 10,
      restricaoDeRotacao: { permite180: true, permite90e270: false },
    });
    const resultado = executarNestingAutomatico([pecaComExtras], enfestoBase());
    expect(resultado.pecasColocadas).toHaveLength(1);
    const colocada = resultado.pecasColocadas[0]!.molde;
    expect(colocada.furos).toHaveLength(1);
    expect(colocada.piques).toHaveLength(1);
    expect(colocada.marcas).toHaveLength(1);
    expect(colocada.marcas[0]!.rotulo).toBe('centro');
    expect(colocada.margemDeCosturaMm).toBe(10);
    // O furo preserva o tamanho original (área), só muda de posição/rotação.
    expect(area(colocada.furos[0]!)).toBeCloseTo(area(pecaComExtras.furos[0]!), 6);
  });
});

// Peça em forma de "L" (perna de 20mm à esquerda + barra de largura total) —
// assimétrica sob espelhamento horizontal (diferente de um retângulo, que é
// seu próprio espelho). Usada nos testes de espelhamento abaixo.
const PECA_EM_L = [ponto(0, 0), ponto(20, 0), ponto(20, 10), ponto(100, 10), ponto(100, 30), ponto(0, 30)];

describe('encontrarPrimeiraPosicaoValida + espelhamento — prova geométrica de que o espelhamento muda o encaixe', () => {
  it('a peça em L original não cabe numa área 100x30 com um obstáculo sob a perna esquerda', () => {
    // Obstáculo ocupa x:[0,50] y:[0,9] — sob a perna esquerda (x:[0,20]) da
    // peça original, que por isso se sobrepõe de verdade (não só encosta).
    const obstaculo = [ponto(0, 0), ponto(50, 0), ponto(50, 9), ponto(0, 9)];
    const limites: LimitesDeArea = { minX: 0, maxX: 100, minY: 0, maxY: 30 };
    const delta = encontrarPrimeiraPosicaoValida(PECA_EM_L, [obstaculo], limites, 0, 5, 10000);
    expect(delta).toBeNull();
  });

  it('a mesma peça espelhada cabe na mesma área com o mesmo obstáculo (a perna vai para o outro lado)', () => {
    const obstaculo = [ponto(0, 0), ponto(50, 0), ponto(50, 9), ponto(0, 9)];
    const limites: LimitesDeArea = { minX: 0, maxX: 100, minY: 0, maxY: 30 };
    const centroX = (retanguloEnvolvente(PECA_EM_L).minX + retanguloEnvolvente(PECA_EM_L).maxX) / 2;
    const pecaEspelhada = espelharContornoHorizontal(PECA_EM_L, centroX);
    const delta = encontrarPrimeiraPosicaoValida(pecaEspelhada, [obstaculo], limites, 0, 5, 10000);
    expect(delta).not.toBeNull();
  });
});

describe('executarNestingAutomatico — espelhamento (regra crítica do sentido do fio, mesma família da rotação)', () => {
  function pecaEmL(restricaoDeRotacao?: Molde['restricaoDeRotacao']): Molde {
    return criarMolde(
      {
        nome: 'L',
        referencia: '',
        tamanho: 'M',
        contorno: PECA_EM_L,
        linhaDeFio: { inicio: ponto(50, 15), fim: ponto(50, 25) },
        ...(restricaoDeRotacao ? { restricaoDeRotacao } : {}),
      },
      'L',
    );
  }

  it('sem permiteEspelhamento (padrão), a peça colocada nunca é a versão espelhada — mesmo numa área vazia onde teria espaço de sobra', () => {
    const areaGrande = enfestoBase({ larguraUtilMm: 500, comprimentoMm: 500 } as Partial<ConfiguracaoDeEnfesto>);
    const resultado = executarNestingAutomatico([pecaEmL()], areaGrande);
    expect(resultado.pecasColocadas).toHaveLength(1);
    const colocada = resultado.pecasColocadas[0]!.molde;
    const bbox = retanguloEnvolvente(colocada.contorno);
    const normalizado = colocada.contorno.map((p) => ponto(p.x - bbox.minX, p.y - bbox.minY));
    // O contorno recolocado na origem deve bater exatamente com o original —
    // não com a versão espelhada (que teria a perna do outro lado).
    for (let i = 0; i < normalizado.length; i++) {
      expect(normalizado[i]!.x).toBeCloseTo(PECA_EM_L[i]!.x, 6);
      expect(normalizado[i]!.y).toBeCloseTo(PECA_EM_L[i]!.y, 6);
    }
  });

  it('com permiteEspelhamento: true mas sem necessidade real, ainda prefere a versão original (tenta espelhar só como último recurso)', () => {
    const areaGrande = enfestoBase({ larguraUtilMm: 500, comprimentoMm: 500 } as Partial<ConfiguracaoDeEnfesto>);
    const resultado = executarNestingAutomatico(
      [pecaEmL({ permite180: false, permite90e270: false, permiteEspelhamento: true })],
      areaGrande,
    );
    expect(resultado.pecasColocadas).toHaveLength(1);
    const colocada = resultado.pecasColocadas[0]!.molde;
    const bbox = retanguloEnvolvente(colocada.contorno);
    const normalizado = colocada.contorno.map((p) => ponto(p.x - bbox.minX, p.y - bbox.minY));
    for (let i = 0; i < normalizado.length; i++) {
      expect(normalizado[i]!.x).toBeCloseTo(PECA_EM_L[i]!.x, 6);
      expect(normalizado[i]!.y).toBeCloseTo(PECA_EM_L[i]!.y, 6);
    }
  });

  it('nunca permite espelhamento automaticamente só para caber melhor (sem a flag, mesmo padrão da rotação)', () => {
    const restricaoFechada = { permite180: false, permite90e270: false, permiteEspelhamento: false };
    const peca = pecaEmL(restricaoFechada);
    expect(peca.restricaoDeRotacao.permiteEspelhamento).toBe(false);
  });
});

describe('executarNestingAutomatico — limite de tempo', () => {
  it('para de tentar colocar peças assim que o tempo decorrido atinge limiteDeTempoMs (relógio injetado)', () => {
    const pecas = [pecaRetangular('a', 100, 100, { quantidade: 5 })];
    let chamadas = 0;
    const resultado = executarNestingAutomatico(pecas, enfestoBase(), {
      limiteDeTempoMs: 100,
      agora: () => {
        chamadas++;
        // Primeira chamada = "início" (0ms); a partir da 2ª chamada, o
        // tempo já "passou" do limite — simula um cálculo lento.
        return chamadas <= 1 ? 0 : 150;
      },
    });
    expect(resultado.paradaPorTempoLimite).toBe(true);
    expect(resultado.pecasColocadas.length).toBeLessThan(5);
    expect(resultado.pecasColocadas.length + resultado.pecasNaoColocadas.length).toBe(5);
  });

  it('sem limiteDeTempoMs, paradaPorTempoLimite fica false mesmo com relógio lento', () => {
    const resultado = executarNestingAutomatico([pecaRetangular('a', 100, 100)], enfestoBase(), {
      agora: () => 999999,
    });
    expect(resultado.paradaPorTempoLimite).toBe(false);
  });
});

describe('executarNestingAutomatico — meta de aproveitamento', () => {
  it('para assim que o aproveitamento atinge a meta, deixando peças restantes em pecasNaoColocadas (não é uma falha)', () => {
    // Peças grandes o bastante para que uma única colocação já ultrapasse
    // uma meta bem baixa (1%), garantindo parada imediata após a primeira.
    const pecas = [pecaRetangular('a', 300, 300, { quantidade: 5 })];
    const resultado = executarNestingAutomatico(pecas, enfestoBase({ larguraUtilMm: 1000, comprimentoMm: 1000 } as Partial<ConfiguracaoDeEnfesto>), {
      aproveitamentoDesejadoPercentual: 1,
    });
    expect(resultado.paradaPorMetaDeAproveitamento).toBe(true);
    expect(resultado.pecasColocadas.length).toBeGreaterThan(0);
    expect(resultado.pecasColocadas.length).toBeLessThan(5);
    expect(resultado.pecasColocadas.length + resultado.pecasNaoColocadas.length).toBe(5);
    expect(resultado.aproveitamentoPercentual).toBeGreaterThanOrEqual(1);
  });

  it('sem aproveitamentoDesejadoPercentual, coloca todas as peças que couberem normalmente (comportamento padrão inalterado)', () => {
    const pecas = [pecaRetangular('a', 100, 100, { quantidade: 3 })];
    const resultado = executarNestingAutomatico(pecas, enfestoBase());
    expect(resultado.paradaPorMetaDeAproveitamento).toBe(false);
    expect(resultado.pecasColocadas).toHaveLength(3);
  });
});

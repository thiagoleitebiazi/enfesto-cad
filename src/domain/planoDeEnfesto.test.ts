import { describe, expect, it } from 'vitest';
import type { MalhaDoCadastro, RoloDeEstoque } from './cadastroDeProducao';
import { RESTRICAO_PADRAO } from './molde';
import { riscoCompensado } from './encolhimento';
import {
  calcularPlanejamento,
  camadasDeUmRisco,
  CONFIGURACAO_PADRAO_DO_PLANEJAMENTO,
  escolherAlternativas,
  larguraNaMesa,
  repartir,
  type CalculoDoPlanejamento,
  type ConfiguracaoDoPlanejamento,
  type EntradaDoPlanejamento,
  type RiscoDoPlanejamento,
} from './planoDeEnfesto';

// Malha de 1,60 m de largura útil, 4 m/kg informado (sem gramatura: sem divergência a conferir).
const MALHA: MalhaDoCadastro = {
  id: 'm1',
  descricao: 'Malha algodão 30/1',
  larguraUtilMm: 1600,
  rendimentoMmPorG: 4,
  tubular: false,
  sentidoUnico: false,
  padrao: 'liso',
  encolhimentoCompensadoNoMolde: false,
};
// Um risco de 3 m com 1 P, 2 M e 1 G por folha, 1,55 m de largura ocupada.
const RISCO: RiscoDoPlanejamento = {
  chave: 'P:1|M:2|G:1',
  grade: { P: 1, M: 2, G: 1 },
  origem: 'gerado',
  comprimentoMm: 3000,
  larguraMm: 1550,
  larguraDoRiscoMm: 1600,
  areaDasPecasMm2: 3_600_000,
  eficienciaPercentual: 75,
  pecas: [],
};
const PECA = { id: 'f', nome: 'Frente', tamanhos: ['P', 'M', 'G'], quantidadePorRoupa: 1, emPar: false, restricao: RESTRICAO_PADRAO, areaMm2: 900_000 };

function entrada(extras: Partial<EntradaDoPlanejamento> = {}): EntradaDoPlanejamento {
  return {
    molde: { projetoId: 'p1', codigo: 'ENF-1', nome: 'Camiseta', revisao: 1, impressaoDigital: 'abc', pecas: [PECA] },
    ordem: { codigo: 'OP-17', quantidadesPorTamanho: { P: 40, M: 80, G: 40 } },
    malha: MALHA,
    rolos: null,
    pesoDisponivelG: 200_000,
    rendimentoPrincipal: 'informado',
    misturarGrupos: false,
    aceitarPadraoSemCasamento: false,
    tipoDeEnfesto: 'impar',
    larguraDoRiscoMm: 1600,
    ...extras,
  };
}

const CONFIG: ConfiguracaoDoPlanejamento = CONFIGURACAO_PADRAO_DO_PLANEJAMENTO;

function ok(c: CalculoDoPlanejamento) {
  if (!c.ok) throw new Error('não calculou: ' + c.erros.join(' | '));
  return c;
}
const erros = (c: CalculoDoPlanejamento): readonly string[] => (c.ok ? [] : c.erros);
const textos = (c: CalculoDoPlanejamento): string => c.alertas.map((a) => a.texto).join(' | ');

function rolo(id: string, extras: Partial<RoloDeEstoque> = {}): RoloDeEstoque {
  return { id, malhaId: 'm1', identificacao: id, lote: 'L1', tonalidade: 'A', defeitos: [], unidadeDoPeso: 'kg', unidadeDoComprimento: 'm', indisponivel: false, ...extras };
}

describe('calcularPlanejamento — um risco, o material em peso', () => {
  const c = ok(calcularPlanejamento(entrada(), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], CONFIG));
  const r = c.resultado;

  it('40 camadas de 3,02 m (o risco mais 2 cm de pontas): 120,8 m e 30,2 kg', () => {
    expect(r.camadas).toBe(40);
    expect(r.folhas).toBe(40);
    expect(r.riscos[0]!.consumoPorCamadaMm).toBe(3020);
    expect(r.consumoMm).toBe(120_800);
    expect(r.consumoG).toBe(30_200);
    expect(r.pontasMm).toBe(800);
  });

  it('o material: 200 kg × 4 m/kg = 800 m, estimado; sobram 679,2 m', () => {
    expect(r.disponivelMm).toBe(800_000);
    expect(r.comprimentoEstimado).toBe(true);
    expect(r.sobraMm).toBe(679_200);
    expect(r.sobraG).toBe(169_800);
    expect(r.materialSuficiente).toBe(true);
  });

  it('a mesa: o risco mais 10 + 10 cm, na largura da malha; a área é a do tecido na mesa', () => {
    expect(r.mesa.comprimentoSugeridoMm).toBe(3200);
    expect(r.mesa.larguraDoTecidoMm).toBe(1600);
    expect(r.mesa.areaDoTecidoMm2).toBe(3200 * 1600);
    expect(r.mesa.areaDaMesaMm2).toBeNull();
    expect(r.mesa.formula).toBe('3,00 m (risco mais comprido) + 0,100 m + 0,100 m (margens) = 3,20 m; área do tecido na mesa = 3,20 m × 1,60 m (largura da malha na mesa) = 5,12 m²');
  });

  it('um enfesto de 40 camadas; a ordem fecha, sem excedente', () => {
    expect(r.enfestos.map((e) => e.camadas)).toEqual([40]);
    expect(r.producaoPorTamanho).toEqual({ P: 40, M: 80, G: 40 });
    expect(r.excedentePorTamanho).toEqual({ P: 0, M: 0, G: 0 });
    expect(r.atendeAOrdem).toBe(true);
    expect(r.eficienciaMediaPercentual).toBeCloseTo((3_600_000 / (3000 * 1600)) * 100, 9);
  });

  it('as camadas de um risco só fecham a ordem pelo tamanho que mais pede', () => {
    expect(camadasDeUmRisco(RISCO, entrada())).toEqual([{ chave: RISCO.chave, camadas: 40 }]);
    expect(camadasDeUmRisco(RISCO, entrada({ tipoDeEnfesto: 'par' }))).toEqual([{ chave: RISCO.chave, camadas: 20 }]);
  });
});

describe('calcularPlanejamento — enfesto par e tubular', () => {
  it('no par, a malha aberta vai dobrada: o risco cabe em metade da largura, e cada camada tem 2 folhas', () => {
    expect(larguraNaMesa(1600, 'par', false)).toBe(800);
    expect(larguraNaMesa(1600, 'par', true)).toBe(1600);
    expect(larguraNaMesa(1600, 'impar', false)).toBe(1600);
    expect(erros(calcularPlanejamento(entrada({ tipoDeEnfesto: 'par' }), [RISCO], [{ chave: RISCO.chave, camadas: 20 }], CONFIG))).toEqual([
      'O risco 1 P + 2 M + 1 G (1,55 m de largura) é mais largo que a malha na mesa (0,80 m).',
    ]);
    const estreito = { ...RISCO, larguraMm: 780, larguraDoRiscoMm: 800 };
    const r = ok(calcularPlanejamento(entrada({ tipoDeEnfesto: 'par', larguraDoRiscoMm: 800 }), [estreito], [{ chave: RISCO.chave, camadas: 20 }], CONFIG)).resultado;
    expect([r.camadas, r.folhas, r.consumoMm]).toEqual([20, 40, 60_400]);
    expect(r.producaoPorTamanho).toEqual({ P: 40, M: 80, G: 40 });
  });

  it('malha tubular com enfesto aberto (e o contrário) é avisada', () => {
    const tubular = calcularPlanejamento(entrada({ malha: { ...MALHA, tubular: true } }), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], CONFIG);
    expect(textos(tubular)).toContain('A malha é tubular, e o enfesto é ímpar');
    const aberta = calcularPlanejamento(entrada({ tipoDeEnfesto: 'tubular' }), [RISCO], [{ chave: RISCO.chave, camadas: 20 }], CONFIG);
    expect(textos(aberta)).toContain('O enfesto é tubular, e a malha está cadastrada como aberta');
    const certa = calcularPlanejamento(entrada({ malha: { ...MALHA, tubular: true }, tipoDeEnfesto: 'tubular' }), [RISCO], [{ chave: RISCO.chave, camadas: 20 }], CONFIG);
    expect(textos(certa)).not.toContain('tubular');
  });
});

describe('calcularPlanejamento — rolos', () => {
  const config = { ...CONFIG, perdaPorRoloMm: 1000 };

  it('cada rolo dá camadas inteiras, depois da perda e dos defeitos; o que falta vira déficit, sem mudar a ordem', () => {
    // R1: 50 m medidos − 1 m = 49 m → 16 camadas de 3,02 m. R2: 10 kg × 4 = 40 m (estimado) − 1 m → 12.
    // R3: 35 m − 1 m − 2 m de defeito = 32 m → 10. Ao todo, 38 das 40 camadas.
    const rolos = [rolo('R1', { comprimentoMedidoMm: 50_000 }), rolo('R2', { pesoLiquidoG: 10_000 }), rolo('R3', { comprimentoMedidoMm: 35_000, defeitos: [{ descricao: 'furo', perdaMm: 2000 }] })];
    // O defeito de R3 não tem posição: sem a decisão, o plano não sai.
    expect(erros(calcularPlanejamento(entrada({ rolos }), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], config))[0]).toContain('Os rolos R3 têm defeito sem a posição');
    const c = ok(calcularPlanejamento(entrada({ rolos, aceitarDefeitosSemPosicao: true }), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], config));
    expect(textos(c)).toContain('Defeitos sem posição (rolos R3)');
    const r = c.resultado;
    expect(r.rolos!.map((x) => [x.identificacao, x.camadasPorRisco[RISCO.chave], x.origemDoComprimento])).toEqual([
      ['R1', 16, 'medido'],
      ['R2', 12, 'pelo peso'],
      ['R3', 10, 'medido'],
    ]);
    expect(r.rolos![0]!.sobraMm).toBeCloseTo(49_000 - 16 * 3020, 6);
    expect(r.disponivelMm).toBe(125_000);
    expect([r.perdaDosRolosMm, r.defeitosMm]).toEqual([3000, 2000]);
    expect(r.deficitMm).toBe(2 * 3020);
    expect(r.materialSuficiente).toBe(false);
    expect(r.possivelPorTamanho).toEqual({ P: 38, M: 76, G: 38 });
    // O plano continua com as 40 camadas que fecham a ordem: a ordem não foi mudada.
    expect(r.producaoPorTamanho).toEqual({ P: 40, M: 80, G: 40 });
    expect(r.comprimentoEstimado).toBe(true);
    expect(textos(c)).toContain('O material não dá o plano inteiro: faltam 6,04 m (1,51 kg) de camadas. Com o que há: 38 do P, 76 do M, 38 do G. A ordem não foi mudada.');
  });

  it('lotes ou tonalidades diferentes: só com a decisão de misturar; o enfesto que junta lotes é marcado', () => {
    const rolos = [rolo('R1', { comprimentoMedidoMm: 70_000 }), rolo('R2', { comprimentoMedidoMm: 70_000, lote: 'L2' })];
    expect(erros(calcularPlanejamento(entrada({ rolos }), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], CONFIG))[0]).toBe(
      'Os rolos escolhidos são de 2 lotes/tonalidades diferentes (L1 · A; L2 · A): eles não são equivalentes. Escolha rolos de um grupo só (e faça outro plano para os outros), ou marque que os lotes serão misturados neste plano.',
    );
    const misturados = calcularPlanejamento(entrada({ rolos, misturarGrupos: true }), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], CONFIG);
    expect(ok(misturados).resultado.enfestos[0]!.grupos).toEqual(['L1 · A', 'L2 · A']);
    expect(textos(misturados)).toContain('O enfesto 1 junta camadas de lotes/tonalidades diferentes (L1 · A; L2 · A).');
  });

  it('o rolo mais estreito que todos os riscos não serve (é preciso tirá-lo); o que serve só a alguns é avisado', () => {
    const estreito = rolo('R9', { comprimentoMedidoMm: 200_000, larguraUtilMedidaMm: 1500 });
    expect(erros(calcularPlanejamento(entrada({ rolos: [estreito] }), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], CONFIG))).toEqual([
      'O rolo “R9” tem 1,50 m de largura na mesa, menos que o risco mais estreito do plano (1,55 m): ele não serve. Tire-o da seleção, ou faça os riscos na largura dele.',
    ]);
    const outro: RiscoDoPlanejamento = { ...RISCO, chave: 'M:1', grade: { M: 1 }, larguraMm: 1400, comprimentoMm: 1000 };
    const c = calcularPlanejamento(entrada({ rolos: [estreito] }), [RISCO, outro], [{ chave: RISCO.chave, camadas: 40 }, { chave: 'M:1', camadas: 5 }], CONFIG);
    expect(textos(c)).toContain('O rolo “R9” (1,50 m de largura na mesa) serve só para 1 dos 2 riscos');
    expect(ok(c).resultado.rolos![0]!.camadasPorRisco).toEqual({ 'M:1': 5 });
  });

  it('o rolo só com o peso, sem rendimento nenhum, não calcula', () => {
    const semRendimento = { ...MALHA, rendimentoMmPorG: undefined } as unknown as MalhaDoCadastro;
    expect(erros(calcularPlanejamento(entrada({ malha: semRendimento, rolos: [rolo('R1', { pesoLiquidoG: 10_000 })] }), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], CONFIG))).toEqual([
      'O rolo “R1” tem só o peso, e não há rendimento (informado ou pela gramatura) para saber o comprimento.',
    ]);
  });
});

describe('calcularPlanejamento — capacidade do enfesto e mesa', () => {
  it('o limite de folhas, a altura (com a espessura da folha) e o peso: vale o menor', () => {
    const porFolhas = ok(calcularPlanejamento(entrada(), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], { ...CONFIG, folhasPorEnfestoMax: 30 })).resultado;
    expect(porFolhas.enfestos.map((e) => e.camadas)).toEqual([20, 20]);
    // 2 mm por folha e 50 mm de altura: 25 camadas.
    const porAltura = ok(
      calcularPlanejamento(entrada({ malha: { ...MALHA, espessuraDaFolhaMm: 2 } }), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], { ...CONFIG, folhasPorEnfestoMax: 30, alturaMaximaDoEnfestoMm: 50 }),
    ).resultado;
    expect(porAltura.riscos[0]!.camadasPorEnfestoMax).toBe(25);
    expect(porAltura.enfestos.map((e) => e.alturaMm)).toEqual([40, 40]);
    // Uma camada de 3,02 m a 4 m/kg pesa 755 g: 15 kg dão 19 camadas — 40 em 3 enfestos.
    const porPeso = ok(calcularPlanejamento(entrada(), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], { ...CONFIG, pesoMaximoDoEnfestoG: 15_000 })).resultado;
    expect(porPeso.enfestos.map((e) => e.camadas)).toEqual([14, 13, 13]);
    expect(porPeso.enfestos[0]!.pesoG).toBe(14 * 755);
  });

  it('a altura máxima sem a espessura da folha não é aplicada, e isso é dito', () => {
    const c = calcularPlanejamento(entrada(), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], { ...CONFIG, alturaMaximaDoEnfestoMm: 50 });
    expect(textos(c)).toContain('A altura máxima do enfesto não foi aplicada: falta a espessura da folha');
  });

  it('o risco que não cabe na mesa configurada; a mesa ajustada menor que o risco; a maior passa, com aviso', () => {
    expect(erros(calcularPlanejamento(entrada(), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], { ...CONFIG, comprimentoMaximoDaMesaMm: 3000 }))).toEqual([
      'O risco mais comprido, com as margens, pede 3,20 m de mesa — mais que a mesa configurada (3,00 m).',
    ]);
    expect(erros(calcularPlanejamento(entrada(), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], CONFIG, { comprimentoDaMesaMm: 3100 }))[0]).toContain('A mesa ajustada precisa ter pelo menos 3,20 m');
    const maior = calcularPlanejamento(entrada(), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], CONFIG, { comprimentoDaMesaMm: 4000 });
    expect(ok(maior).resultado.mesa.comprimentoMm).toBe(4000);
    expect(textos(maior)).toContain('A mesa ajustada (4,00 m) é maior que a sugerida (3,20 m).');
  });

  it('com a largura da mesa, a área da mesa física aparece; a malha mais larga que a mesa é recusada', () => {
    const r = ok(calcularPlanejamento(entrada(), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], { ...CONFIG, larguraDaMesaMm: 1800 })).resultado;
    expect(r.mesa.areaDaMesaMm2).toBe(3200 * 1800);
    expect(erros(calcularPlanejamento(entrada(), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], { ...CONFIG, larguraDaMesaMm: 1500 }))).toEqual(['A malha (1,60 m) é mais larga que a mesa (1,50 m).']);
  });
});

describe('calcularPlanejamento — ordem, ajustes e avisos da malha', () => {
  it('tamanho da ordem que o molde não tem é erro, com o que conferir', () => {
    const c = calcularPlanejamento(entrada({ ordem: { codigo: 'OP-1', quantidadesPorTamanho: { P: 10, XG: 5 } } }), [RISCO], [{ chave: RISCO.chave, camadas: 10 }], CONFIG);
    expect(erros(c)).toEqual(['A ordem pede tamanho(s) que o molde não tem: XG. Confira os tamanhos da ordem (ou gradue o molde).']);
  });

  it('camadas ajustadas a menos: a falta por tamanho; a mais: o excedente', () => {
    const menos = calcularPlanejamento(entrada(), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], CONFIG, { camadasPorRisco: { [RISCO.chave]: 30 } });
    expect(ok(menos).resultado.faltaPorTamanho).toEqual({ P: 10, M: 20, G: 10 });
    expect(textos(menos)).toContain('Com as camadas do plano, a ordem não fecha: faltam 10 do P, 20 do M, 10 do G.');
    const mais = calcularPlanejamento(entrada(), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], CONFIG, { camadasPorRisco: { [RISCO.chave]: 41 } });
    expect(ok(mais).resultado.excedentePorTamanho).toEqual({ P: 1, M: 2, G: 1 });
    expect(textos(mais)).toContain('O plano produz a mais: 1 do P, 2 do M, 1 do G. A ordem não foi mudada.');
  });

  it('a divergência de rendimento mostra os dois; o principal escolhido vale', () => {
    // 1 000 / (1,6 m × 310 g/m²) = 2,016 m/kg, contra 4 m/kg informado.
    const comGramatura = { ...MALHA, gramaturaGm2: 310 };
    const c = ok(calcularPlanejamento(entrada({ malha: comGramatura, rendimentoPrincipal: 'calculado' }), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], CONFIG));
    expect(c.resultado.rendimentoUsadoMmPorG).toBeCloseTo(2.016129, 5);
    expect(c.resultado.origemDoRendimento).toBe('calculado');
    expect(textos(c)).toContain('O rendimento informado (4,00 m/kg) e o calculado pela largura e gramatura (2,02 m/kg) diferem 98,4%');
  });

  it('listrado ou xadrez sem o casamento conferido no risco: só planeja com a decisão marcada, e avisa; com ele, sai', () => {
    const listrada = { ...MALHA, padrao: 'listrado' as const };
    expect(erros(calcularPlanejamento(entrada({ malha: listrada }), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], CONFIG))[0]).toContain('o risco não tem o casamento automático das listras conferido');
    const casado = { ...RISCO, casamento: { rapportComprimentoMm: 100, faseComprimentoMm: 0, faseLarguraMm: 0, conferido: true } };
    expect(textos(ok(calcularPlanejamento(entrada({ malha: listrada }), [casado], [{ chave: RISCO.chave, camadas: 40 }], CONFIG)))).toContain('Casamento automático das listras, conferido em todas as peças');
    const naoConferido = { ...casado, casamento: { ...casado.casamento, conferido: false } };
    expect(calcularPlanejamento(entrada({ malha: listrada }), [naoConferido], [{ chave: RISCO.chave, camadas: 40 }], CONFIG).ok).toBe(false);
    const aceita = calcularPlanejamento(entrada({ malha: listrada, aceitarPadraoSemCasamento: true }), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], CONFIG);
    expect(textos(aceita)).toContain('O risco precisa ser conferido (ou feito) à mão antes do corte.');
  });

  it('o encolhimento: compensado no molde (só informado) ou não (aviso de que vai encolher); nunca aplicado', () => {
    const compensado = calcularPlanejamento(entrada({ malha: { ...MALHA, encolhimentoComprimentoPercentual: 3, encolhimentoCompensadoNoMolde: true } }), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], CONFIG);
    expect(compensado.alertas).toContainEqual({ nivel: 'info', texto: 'Encolhimento da malha: 3,0% no comprimento — já compensado no molde (cadastro da malha). O plano não aplica nada a mais.' });
    const nao = calcularPlanejamento(entrada({ malha: { ...MALHA, encolhimentoLarguraPercentual: 2 } }), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], CONFIG);
    expect(nao.alertas).toContainEqual({ nivel: 'aviso', texto: 'Encolhimento da malha: 2,0% na largura — NÃO compensado no molde, e o plano não o aplica (a compensação no risco não foi pedida). As peças cortadas vão encolher.' });
    expect(ok(nao).resultado.consumoMm).toBe(120_800);
  });

  it('sentido único com zigue-zague é avisado', () => {
    const c = calcularPlanejamento(entrada({ malha: { ...MALHA, sentidoUnico: true }, tipoDeEnfesto: 'zigue-zague' }), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], CONFIG);
    expect(textos(c)).toContain('o enfesto zigue-zague vira o tecido a cada camada');
  });
});

describe('vários riscos', () => {
  it('cada risco com as camadas dele; a mesa é a do risco mais comprido; a produção soma', () => {
    const curto: RiscoDoPlanejamento = { ...RISCO, chave: 'P:1', grade: { P: 1 }, comprimentoMm: 1200, larguraMm: 700, areaDasPecasMm2: 600_000 };
    const r = ok(calcularPlanejamento(entrada(), [RISCO, curto], [{ chave: RISCO.chave, camadas: 30 }, { chave: 'P:1', camadas: 10 }], CONFIG)).resultado;
    expect(r.riscos.map((x) => [x.chave, x.camadas, x.consumoMm])).toEqual([
      [RISCO.chave, 30, 30 * 3020],
      ['P:1', 10, 10 * 1220],
    ]);
    expect(r.mesa.comprimentoSugeridoMm).toBe(3200);
    expect(r.producaoPorTamanho).toEqual({ P: 40, M: 60, G: 30 });
    expect(r.enfestos.map((e) => [e.numero, e.chave, e.camadas])).toEqual([
      [1, RISCO.chave, 30],
      [2, 'P:1', 10],
    ]);
    // A eficiência média pondera pelas camadas.
    expect(r.eficienciaMediaPercentual).toBeCloseTo(((30 * 3_600_000 + 10 * 600_000) / (30 * 3000 * 1600 + 10 * 1200 * 1600)) * 100, 9);
  });
});

describe('escolherAlternativas e repartir', () => {
  it('menor consumo, menos enfestos e a equilibrada, com os desempates escritos', () => {
    const avaliadas = [
      { consumoMm: 100_000, enfestos: 4 },
      { consumoMm: 120_000, enfestos: 1 },
      { consumoMm: 103_000, enfestos: 2 },
    ];
    expect(escolherAlternativas(avaliadas)).toEqual({ 'menor-consumo': 0, 'menos-enfestos': 1, equilibrada: 1 });
    // Empate no consumo: a de menos enfestos.
    expect(escolherAlternativas([{ consumoMm: 1, enfestos: 3 }, { consumoMm: 1, enfestos: 2 }])!['menor-consumo']).toBe(1);
    expect(escolherAlternativas([])).toBeNull();
  });

  it('reparte por igual, os primeiros com uma a mais', () => {
    expect(repartir(130, 3)).toEqual([44, 43, 43]);
    expect(repartir(0, 2)).toEqual([]);
  });
});

describe('calcularPlanejamento — os limites contam folhas (no par, 2 por camada)', () => {
  const estreito = { ...RISCO, larguraMm: 780, larguraDoRiscoMm: 800 };
  const par = entrada({ tipoDeEnfesto: 'par', larguraDoRiscoMm: 800 });

  it('30 folhas por enfesto no par são 15 camadas: 26 camadas em 2 enfestos', () => {
    const r = ok(calcularPlanejamento(par, [estreito], [{ chave: RISCO.chave, camadas: 26 }], { ...CONFIG, folhasPorEnfestoMax: 30 })).resultado;
    expect(r.riscos[0]!.camadasPorEnfestoMax).toBe(15);
    expect(r.enfestos.map((e) => [e.camadas, e.folhas])).toEqual([
      [13, 26],
      [13, 26],
    ]);
  });

  it('a altura também conta as 2 folhas: 50 mm com 2 mm por folha são 12 camadas no par', () => {
    const grossa = entrada({ tipoDeEnfesto: 'par', larguraDoRiscoMm: 800, malha: { ...MALHA, espessuraDaFolhaMm: 2 } });
    const r = ok(calcularPlanejamento(grossa, [estreito], [{ chave: RISCO.chave, camadas: 26 }], { ...CONFIG, alturaMaximaDoEnfestoMm: 50 })).resultado;
    expect(r.riscos[0]!.camadasPorEnfestoMax).toBe(12);
    expect(r.enfestos.map((e) => e.camadas)).toEqual([9, 9, 8]);
    expect(r.enfestos[0]!.alturaMm).toBe(36);
  });

  it('as camadas por enfesto ajustadas: até o limite passa; uma a mais, não', () => {
    expect(calcularPlanejamento(entrada(), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], CONFIG, { camadasPorEnfesto: 100 }).ok).toBe(true);
    expect(erros(calcularPlanejamento(entrada(), [RISCO], [{ chave: RISCO.chave, camadas: 40 }], CONFIG, { camadasPorEnfesto: 101 }))).toEqual([
      'O limite é de 100 camadas por enfesto no risco 1 P + 2 M + 1 G: as 101 ajustadas passam dele.',
    ]);
  });
});

describe('calcularPlanejamento — defeitos com posição, emendas e o que já foi usado', () => {
  it('o defeito com posição é evitado: as camadas começam depois dele, e o pulo é dito', () => {
    // 3,02 m por camada no rolo de 9,2 m: sem defeito, 3 camadas (até 9,06 m). Com o defeito de 3,02 a 3,5 m, a 2ª
    // camada começa em 3,5 m, e a 3ª iria até 9,54 m — não cabe: 2 camadas.
    expect(ok(calcularPlanejamento(entrada({ rolos: [rolo('R1', { comprimentoMedidoMm: 9200 })] }), [RISCO], [{ chave: RISCO.chave, camadas: 3 }], CONFIG)).resultado.materialSuficiente).toBe(true);
    const r = ok(
      calcularPlanejamento(entrada({ rolos: [rolo('R1', { comprimentoMedidoMm: 9200, defeitos: [{ descricao: 'mancha', perdaMm: 480, posicaoMm: 3020, tipo: 'mancha' }] })] }), [RISCO], [{ chave: RISCO.chave, camadas: 3 }], CONFIG),
    ).resultado;
    expect(r.rolos![0]).toMatchObject({ perdaPorDefeitoMm: 480, camadasPorRisco: { [RISCO.chave]: 2 } });
    expect(r.perdaPorDefeitosMm).toBe(480);
    expect(r.materialSuficiente).toBe(false);
  });

  it('com emenda permitida, o rolo que acaba no meio da camada continua no seguinte, na linha do risco sem peça cortada', () => {
    // Risco de 3 m com duas peças (0–1,4 m e 1,5–3 m): a linha de emenda fica a 1,4 m do começo do risco.
    const comPecas: RiscoDoPlanejamento = {
      ...RISCO,
      pecas: [
        { pecaId: 'a', nome: 'A', tamanho: 'M', contorno: [{ x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: 1400 }, { x: 0, y: 1400 }], fio: { inicio: { x: 1, y: 1 }, fim: { x: 1, y: 2 } }, anguloGraus: 0, espelhada: false },
        { pecaId: 'b', nome: 'B', tamanho: 'M', contorno: [{ x: 0, y: 1500 }, { x: 500, y: 1500 }, { x: 500, y: 3000 }, { x: 0, y: 3000 }], fio: { inicio: { x: 1, y: 1 }, fim: { x: 1, y: 2 } }, anguloGraus: 0, espelhada: false },
      ],
    };
    const rolos = [rolo('A', { comprimentoMedidoMm: 7500 }), rolo('B', { comprimentoMedidoMm: 3000 })];
    const sem = ok(calcularPlanejamento(entrada({ rolos }), [comPecas], [{ chave: RISCO.chave, camadas: 3 }], CONFIG)).resultado;
    expect(sem.possivelPorTamanho).toEqual({ P: 2, M: 4, G: 2 });
    const com = calcularPlanejamento(entrada({ rolos }), [comPecas], [{ chave: RISCO.chave, camadas: 3 }], { ...CONFIG, permitirEmendas: true, sobreposicaoDaEmendaMm: 100 });
    const r = ok(com).resultado;
    expect(r.materialSuficiente).toBe(true);
    expect(r.emendas).toEqual([{ chave: RISCO.chave, roloDe: 'A', roloPara: 'B', posicaoNoRiscoMm: 1400, sobreposicaoMm: 100 }]);
    expect(r.sobreposicoesMm).toBe(100);
    expect(r.rolos!.map((x) => [x.identificacao, x.usadoMm, x.emendas])).toEqual([
      ['A', 2 * 3020 + 1410, 1],
      ['B', 3020 - 1410 + 100, 0],
    ]);
    expect(textos(com)).toContain('1 camada(s) com emenda');
  });

  it('o que já foi consumido ou reservado por outros planos sai do começo do rolo; o rolo todo usado é recusado', () => {
    const r = ok(calcularPlanejamento(entrada({ rolos: [rolo('R1', { comprimentoMedidoMm: 10_000 })], usoAnteriorDosRolosMm: { R1: 4000 } }), [RISCO], [{ chave: RISCO.chave, camadas: 3 }], CONFIG)).resultado;
    expect(r.rolos![0]).toMatchObject({ jaUsadoMm: 4000, camadasPorRisco: { [RISCO.chave]: 1 } });
    expect(r.disponivelMm).toBe(6000);
    expect(erros(calcularPlanejamento(entrada({ rolos: [rolo('R1', { comprimentoMedidoMm: 10_000 })], usoAnteriorDosRolosMm: { R1: 10_000 } }), [RISCO], [{ chave: RISCO.chave, camadas: 3 }], CONFIG))).toEqual([
      'O rolo “R1” já está todo consumido ou reservado por outros planos: tire-o da seleção.',
    ]);
  });
});

describe('calcularPlanejamento — compensação de encolhimento', () => {
  const comEncolhimento = { ...MALHA, encolhimentoComprimentoPercentual: 3, encolhimentoLarguraPercentual: 2, fonteDoEncolhimento: 'ensaio-de-lavagem' as const };
  const fatores = { comprimento: 1 / 0.97, largura: 1 / 0.98, encolhimentoComprimentoPercentual: 3, encolhimentoLarguraPercentual: 2 };
  const base = { ...RISCO, larguraMm: 1500 };
  const compensado = riscoCompensado(base, fatores, 1600);

  it('com a decisão e o risco compensado: o consumo cresce pelo fator do comprimento, e o plano diz os fatores e a fonte', () => {
    const c = ok(calcularPlanejamento(entrada({ malha: comEncolhimento, compensarEncolhimento: true }), [compensado], [{ chave: RISCO.chave, camadas: 40 }], CONFIG));
    expect(c.resultado.riscos[0]!.comprimentoMm).toBeCloseTo(3000 / 0.97, 1);
    expect(c.resultado.consumoMm).toBeCloseTo(40 * (3000 / 0.97 + 20), 0);
    expect(textos(c)).toContain('Encolhimento compensado no risco, por decisão de quem planeja (valor: ensaio de lavagem): comprimento × 1,0309 (3,0%), largura × 1,0204 (2,0%)');
    expect(textos(c)).not.toContain('NÃO compensado');
  });

  it('nunca duas vezes, nem num risco informado, nem com o risco que não foi compensado', () => {
    expect(erros(calcularPlanejamento(entrada({ malha: { ...comEncolhimento, encolhimentoCompensadoNoMolde: true }, compensarEncolhimento: true }), [compensado], [{ chave: RISCO.chave, camadas: 40 }], CONFIG))).toContain(
      'O encolhimento desta malha já está compensado no molde (cadastro da malha): compensar no risco também o aplicaria duas vezes.',
    );
    expect(erros(calcularPlanejamento(entrada({ malha: comEncolhimento, compensarEncolhimento: true }), [{ ...base, origem: 'informado' }], [{ chave: RISCO.chave, camadas: 40 }], CONFIG))[0]).toContain('O risco informado à mão já é a medida do corte');
    expect(erros(calcularPlanejamento(entrada({ malha: comEncolhimento, compensarEncolhimento: true }), [base], [{ chave: RISCO.chave, camadas: 40 }], CONFIG))).toEqual([
      'Os riscos não foram compensados com o encolhimento da malha: calcule as alternativas de novo.',
    ]);
    expect(erros(calcularPlanejamento(entrada({ malha: comEncolhimento }), [compensado], [{ chave: RISCO.chave, camadas: 40 }], CONFIG))).toEqual([
      'Os riscos foram compensados, e o plano não pede a compensação: calcule as alternativas de novo.',
    ]);
  });
});

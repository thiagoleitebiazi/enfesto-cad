import { describe, expect, it } from 'vitest';
import { ponto, retanguloEnvolvente } from '../core/geometria';
import { importarDxf } from '../formats/dxf-importacao';
import { moldesDoDxf } from '../formats/importacaoDireta';
import type { MalhaDoCadastro, RoloDeEstoque } from './cadastroDeProducao';
import { escreverReais, estimarCustoDoTecido, roupasPorTamanho, type RoupaDoTamanho } from './custoDoTecido';
import { definirRegra } from './graduacao';
import { criarMolde, RESTRICAO_PADRAO, type Molde } from './molde';
import { modeloDoPlano, quantidadesPorRoupa } from './modeloDoPlano';
import {
  calcularPlanejamento,
  CONFIGURACAO_PADRAO_DO_PLANEJAMENTO,
  type EntradaDoPlanejamento,
  type ResultadoDoPlanejamento,
  type RiscoDoPlanejamento,
} from './planoDeEnfesto';
import { definirTamanhosDoMolde } from './tamanhosGraduados';

// Malha aberta de 1,60 m de largura útil, 4 m/kg, R$ 32,00 o metro.
const MALHA: MalhaDoCadastro = {
  id: 'm1',
  descricao: 'Malha algodão 30/1',
  larguraUtilMm: 1600,
  rendimentoMmPorG: 4,
  tubular: false,
  tipoDeTecido: 'ramado',
  custo: { valor: 32, unidade: 'metro-linear', moeda: 'BRL' },
  sentidoUnico: false,
  padrao: 'liso',
  encolhimentoCompensadoNoMolde: false,
};
// Um risco de 3 m na largura toda, com 1 P, 2 M e 1 G por folha.
const RISCO: RiscoDoPlanejamento = {
  chave: 'P:1|M:2|G:1',
  grade: { P: 1, M: 2, G: 1 },
  origem: 'gerado',
  comprimentoMm: 3000,
  larguraMm: 1550,
  larguraDoRiscoMm: 1600,
  areaDasPecasMm2: 2_400_000,
  eficienciaPercentual: 50,
  pecas: [],
};
const PECA = { id: 'f', nome: 'Frente', tamanhos: ['P', 'M', 'G'], quantidadePorRoupa: 1, emPar: false, restricao: RESTRICAO_PADRAO, areaMm2: 500_000 };
// Uma roupa de 0,5 m² no P, 0,6 m² no M e 0,7 m² no G.
const roupa = (tamanho: string, areaMm2: number): RoupaDoTamanho => ({ tamanho, areaMm2, pecas: [{ pecaId: 'f', nome: 'Frente', areaMm2, quantidadePorRoupa: 1, emPar: false }] });
const ROUPAS: RoupaDoTamanho[] = [roupa('P', 500_000), roupa('M', 600_000), roupa('G', 700_000)];

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

function plano(e: EntradaDoPlanejamento, risco: RiscoDoPlanejamento = RISCO, camadas = 40): ResultadoDoPlanejamento {
  const c = calcularPlanejamento(e, [risco], [{ chave: risco.chave, camadas }], CONFIGURACAO_PADRAO_DO_PLANEJAMENTO);
  if (!c.ok) throw new Error('o plano não calculou: ' + c.erros.join(' | '));
  return c.resultado;
}

const estimar = (e: EntradaDoPlanejamento, r: ResultadoDoPlanejamento = plano(e), riscos: readonly RiscoDoPlanejamento[] = [RISCO], roupas: readonly RoupaDoTamanho[] = ROUPAS) =>
  estimarCustoDoTecido({ entrada: e, resultado: r, riscos, roupas });

const m2 = (mm2: number | null | undefined): number | null => (mm2 === null || mm2 === undefined ? null : mm2 / 1_000_000);

/** A malha sem um dos campos opcionais (como as gravadas antes dele, ou sem o dado). */
function sem(campo: 'rendimentoMmPorG' | 'tipoDeTecido' | 'custo'): MalhaDoCadastro {
  const copia: { -readonly [K in keyof MalhaDoCadastro]: MalhaDoCadastro[K] } = { ...MALHA };
  delete copia[campo];
  return copia;
}

describe('estimarCustoDoTecido — malha aberta, custo por metro linear', () => {
  // 40 camadas de 3,02 m (o risco e 2 cm de pontas) = 120,8 m de malha; 40 P, 80 M e 40 G = 160 roupas.
  const e = estimar(entrada());

  it('o custo por m² é o do metro ÷ a largura útil: R$ 32,00 ÷ 1,6 m = R$ 20,00', () => {
    expect(e.faltas).toEqual([]);
    expect(e.larguraDeMalhaPorMetroMm).toBe(1600);
    expect(e.custoPorMetroLinear).toBe(32);
    expect(e.custoPorM2).toBeCloseTo(20, 10);
    expect(e.comprimentoMm).toBe(120_800);
  });

  it('o custo direto por unidade é a área real da roupa × o custo por m², tamanho a tamanho', () => {
    expect(e.porTamanho.map((t) => [t.tamanho, t.unidadesProduzidas, m2(t.areaPorUnidadeMm2)])).toEqual([
      ['P', 40, 0.5],
      ['M', 80, 0.6],
      ['G', 40, 0.7],
    ]);
    expect(e.porTamanho.map((t) => t.custoDiretoPorUnidade)).toEqual([expect.closeTo(10, 9), expect.closeTo(12, 9), expect.closeTo(14, 9)]);
  });

  it('a malha do enfesto, as peças e a área não aproveitada: 193,28 = 96 + 97,28 m², sem contar nada duas vezes', () => {
    expect(m2(e.areaTotalMm2)).toBeCloseTo(193.28, 9);
    expect(m2(e.areaDasPecasMm2)).toBeCloseTo(96, 9);
    expect(m2(e.naoAproveitada!.totalMm2)).toBeCloseTo(97.28, 9);
    expect(e.custoTotal).toBeCloseTo(3865.6, 9); // 120,8 m × R$ 32,00
    expect(e.custoDiretoTotal).toBeCloseTo(1920, 9);
    expect(e.custoNaoAproveitado).toBeCloseTo(1945.6, 9);
    expect(e.custoDiretoTotal! + e.custoNaoAproveitado!).toBeCloseTo(e.custoTotal!, 9);
  });

  it('a área não aproveitada é discriminada: as pontas (0,8 m × 1,6 m) e os espaços entre as peças; as partes somam o total', () => {
    expect(e.naoAproveitada!.partes.map((p) => [p.rotulo, m2(p.areaMm2)])).toEqual([
      ['Pontas das camadas (o que passa do risco no começo e no fim)', expect.closeTo(1.28, 9)],
      ['Espaços entre as peças, dentro do risco', expect.closeTo(96, 9)],
    ]);
    expect(e.naoAproveitada!.partes.reduce((s, p) => s + p.areaMm2, 0)).toBeCloseTo(e.naoAproveitada!.totalMm2, 3);
    expect(e.naoAproveitada!.partes.reduce((s, p) => s + p.custo!, 0)).toBeCloseTo(e.custoNaoAproveitado!, 9);
  });

  it('o rateio: o custo médio é o total ÷ as unidades; por tamanho, a perda vai na proporção da área — os dois somam o custo total', () => {
    expect(e.unidadesProduzidas).toBe(160);
    expect(e.custoMedioPorUnidade).toBeCloseTo(24.16, 9);
    const comPerda = e.porTamanho.map((t) => t.custoPorUnidadeComPerda!);
    expect(comPerda[0]).toBeCloseTo(10 * (3865.6 / 1920), 9);
    expect(e.porTamanho.reduce((s, t, i) => s + t.unidadesProduzidas * comPerda[i]!, 0)).toBeCloseTo(e.custoTotal!, 6);
    expect(e.premissas.join(' ')).toContain('a perda não é contada duas vezes');
  });

  it('diz o que é: só o tecido, uma estimativa, não sobra reaproveitável, consumo planejado e não medido', () => {
    const texto = e.premissas.join(' ');
    expect(texto).toContain('Estimativa só do tecido');
    expect(texto).toContain('não é sobra reaproveitável');
    expect(texto).toContain('não um consumo medido');
    expect(texto).toContain('não o retângulo em volta dela');
  });

  it('a faixa da largura fora do risco é uma parte própria (risco de 1,5 m numa malha de 1,6 m)', () => {
    const estreito = { ...RISCO, larguraMm: 1450, larguraDoRiscoMm: 1500 };
    const e2 = entrada({ larguraDoRiscoMm: 1500 });
    const x = estimar(e2, plano(e2, estreito), [estreito]);
    expect(x.naoAproveitada!.partes.map((p) => [p.rotulo, m2(p.areaMm2)])).toEqual([
      ['Pontas das camadas (o que passa do risco no começo e no fim)', expect.closeTo(1.28, 9)],
      ['Faixa da largura da malha fora do risco', expect.closeTo(12, 9)], // 120 m × 0,1 m
      ['Espaços entre as peças, dentro do risco', expect.closeTo(84, 9)],
    ]);
    expect(x.custoTotal).toBeCloseTo(3865.6, 9);
  });
});

describe('estimarCustoDoTecido — custo por quilo', () => {
  it('R$ 40,00/kg ÷ 4 m/kg (o rendimento do plano) = R$ 10,00 o metro; ÷ 1,6 m = R$ 6,25 o m²', () => {
    const e = estimar(entrada({ malha: { ...MALHA, custo: { valor: 40, unidade: 'kg', moeda: 'BRL' } } }));
    expect(e.faltas).toEqual([]);
    expect(e.rendimentoMmPorG).toBe(4);
    expect(e.origemDoRendimento).toBe('informado');
    expect(e.custoPorMetroLinear).toBeCloseTo(10, 9);
    expect(e.custoPorM2).toBeCloseTo(6.25, 9);
    expect(e.custoTotal).toBeCloseTo(1208, 9);
    expect(e.premissas.join(' ')).toContain('R$ 40,00 ÷ 4,00 m/kg');
  });

  it('sem rendimento nem gramatura (rolos medidos em metros), o custo por quilo não vira metro: diz o que falta', () => {
    const semRendimento = sem('rendimentoMmPorG');
    const rolo: RoloDeEstoque = { id: 'r1', malhaId: 'm1', identificacao: 'R1', lote: 'L1', tonalidade: 'A', defeitos: [], comprimentoMedidoMm: 200_000, unidadeDoPeso: 'kg', unidadeDoComprimento: 'm', indisponivel: false };
    const e = estimar(entrada({ malha: { ...semRendimento, custo: { valor: 40, unidade: 'kg', moeda: 'BRL' } }, rolos: [rolo] }));
    expect(e.faltas.join(' ')).toContain('falta o rendimento (m/kg)');
    expect([e.custoPorMetroLinear, e.custoPorM2, e.custoTotal, e.custoMedioPorUnidade]).toEqual([null, null, null, null]);
    expect(e.porTamanho.every((t) => t.custoDiretoPorUnidade === null)).toBe(true);
  });

  it('malha tubular com o rendimento tirado da gramatura: não converte (a gramatura é de uma folha, o tubo tem duas)', () => {
    const semRendimento = sem('rendimentoMmPorG');
    const malha: MalhaDoCadastro = { ...semRendimento, larguraUtilMm: 900, tubular: true, tipoDeTecido: 'tubular', gramaturaGm2: 180, custo: { valor: 40, unidade: 'kg', moeda: 'BRL' } };
    const risco = { ...RISCO, larguraMm: 880, larguraDoRiscoMm: 900 };
    const e2 = entrada({ malha, tipoDeEnfesto: 'tubular', larguraDoRiscoMm: 900 });
    const e = estimar(e2, plano(e2, risco), [risco]);
    expect(e.origemDoRendimento).toBe('calculado');
    expect(e.faltas.join(' ')).toContain('Informe o rendimento medido (m/kg)');
    expect(e.custoTotal).toBeNull();
  });
});

describe('estimarCustoDoTecido — ramado, tubular e o tipo não informado', () => {
  it('tubular no enfesto tubular: um metro de tubo dá 2 folhas do tubo achatado (a regra do plano), sem presumir a largura aberta', () => {
    const malha: MalhaDoCadastro = { ...MALHA, larguraUtilMm: 900, tubular: true, tipoDeTecido: 'tubular', custo: { valor: 18, unidade: 'metro-linear', moeda: 'BRL' } };
    const risco = { ...RISCO, larguraMm: 880, larguraDoRiscoMm: 900 };
    const e2 = entrada({ malha, tipoDeEnfesto: 'tubular', larguraDoRiscoMm: 900 });
    const e = estimar(e2, plano(e2, risco), [risco]);
    expect(e.faltas).toEqual([]);
    expect(e.tipoDeTecido).toBe('tubular');
    expect(e.folhasPorCamada).toBe(2);
    expect(e.larguraDeMalhaPorMetroMm).toBe(1800);
    expect(e.custoPorM2).toBeCloseTo(10, 9); // R$ 18,00 ÷ 1,8 m² por metro
    expect(e.custoTotal).toBeCloseTo(120.8 * 18, 9);
    expect(e.unidadesProduzidas).toBe(320); // 2 folhas por camada
    const texto = e.premissas.join(' ');
    expect(texto).toContain('2 folhas de 0,90 m (o tubo achatado');
    expect(texto).toContain('A largura da malha aberta (ramada) não é presumida');
  });

  it('ramado no enfesto par: a malha dobrada dá 2 folhas de meia largura — a largura útil inteira por metro', () => {
    const risco = { ...RISCO, larguraMm: 780, larguraDoRiscoMm: 800 };
    const e2 = entrada({ tipoDeEnfesto: 'par', larguraDoRiscoMm: 800 });
    const e = estimar(e2, plano(e2, risco), [risco]);
    expect(e.faltas).toEqual([]);
    expect(e.larguraNaMesaMm).toBe(800);
    expect(e.larguraDeMalhaPorMetroMm).toBe(1600);
    expect(e.custoPorM2).toBeCloseTo(20, 9);
  });

  it('tubular num enfesto aberto: não calcula o custo, e diz por quê (nada de dobrar a largura por conta própria)', () => {
    const malha: MalhaDoCadastro = { ...MALHA, tubular: true, tipoDeTecido: 'tubular' };
    const e = estimar(entrada({ malha }));
    expect(e.faltas.join(' ')).toContain('O tecido é tubular, e o enfesto é ímpar');
    expect([e.larguraDeMalhaPorMetroMm, e.custoPorM2, e.custoTotal, e.areaTotalMm2, e.naoAproveitada]).toEqual([null, null, null, null, null]);
    // As áreas das roupas continuam (são da geometria), e nenhum custo aparece como zero.
    expect(m2(e.porTamanho[0]!.areaPorUnidadeMm2)).toBe(0.5);
    expect(e.porTamanho.every((t) => t.custoDiretoPorUnidade === null)).toBe(true);
  });

  it('ramado no enfesto tubular, e o tipo não informado no enfesto tubular: não calcula, e pede o dado', () => {
    const ramado = estimar(entrada({ tipoDeEnfesto: 'tubular' }));
    expect(ramado.faltas.join(' ')).toContain('O tecido é ramado (aberto), e o enfesto é tubular');
    const semTipo = sem('tipoDeTecido');
    const naoInformado = estimar(entrada({ malha: semTipo, tipoDeEnfesto: 'tubular' }));
    expect(naoInformado.tipoDeTecido).toBeNull();
    expect(naoInformado.faltas.join(' ')).toContain('O tipo de tecido não foi informado, e o enfesto é tubular');
    expect(naoInformado.custoTotal).toBeNull();
  });

  it('o tipo não informado num enfesto aberto: calcula como antes (malha aberta), e diz que presumiu', () => {
    const semTipo = sem('tipoDeTecido');
    const e = estimar(entrada({ malha: semTipo }));
    expect(e.tipoDeTecido).toBeNull();
    expect(e.faltas).toEqual([]);
    expect(e.custoTotal).toBeCloseTo(3865.6, 9);
    expect(e.premissas.join(' ')).toContain('Tipo de tecido não informado: a largura útil é tratada como a da malha aberta');
  });

  it('a malha de antes, marcada como tubular e sem o tipo, conta como tubular', () => {
    const semTipo = sem('tipoDeTecido');
    const e = estimar(entrada({ malha: { ...semTipo, tubular: true } }));
    expect(e.tipoDeTecido).toBe('tubular');
    expect(e.faltas.join(' ')).toContain('O tecido é tubular');
  });
});

describe('estimarCustoDoTecido — o que falta, e o que não é calculado', () => {
  it('sem custo informado: o plano é o mesmo, as áreas saem, e nenhum custo aparece (nem como zero)', () => {
    const semCusto = sem('custo');
    const e = estimar(entrada({ malha: semCusto }));
    expect(e.custoInformado).toBeNull();
    expect(e.faltas).toEqual([expect.stringContaining('O custo do tecido não foi informado')]);
    expect([e.custoPorMetroLinear, e.custoPorM2, e.custoTotal, e.custoDiretoTotal, e.custoNaoAproveitado, e.custoMedioPorUnidade]).toEqual([null, null, null, null, null, null]);
    expect(e.porTamanho.every((t) => t.custoDiretoPorUnidade === null && t.custoPorUnidadeComPerda === null)).toBe(true);
    expect(e.naoAproveitada!.partes.every((p) => p.custo === null)).toBe(true);
    expect(m2(e.naoAproveitada!.totalMm2)).toBeCloseTo(97.28, 9);
  });

  it('custo zero informado é zero (foi informado), e não "não informado"', () => {
    const e = estimar(entrada({ malha: { ...MALHA, custo: { valor: 0, unidade: 'metro-linear', moeda: 'BRL' } } }));
    expect(e.faltas).toEqual([]);
    expect(e.custoTotal).toBe(0);
    expect(e.custoMedioPorUnidade).toBe(0);
  });

  it('sem a geometria de um tamanho produzido: a área das peças e o rateio não saem; o custo do enfesto (só da malha) sai', () => {
    const e = estimar(entrada(), undefined, undefined, ROUPAS.slice(0, 2));
    expect(e.faltas.join(' ')).toContain('Falta a geometria das peças do(s) tamanho(s) G');
    expect(e.areaDasPecasMm2).toBeNull();
    expect(e.naoAproveitada).toBeNull();
    expect(e.custoDiretoTotal).toBeNull();
    expect(e.porTamanho.find((t) => t.tamanho === 'G')!.custoDiretoPorUnidade).toBeNull();
    expect(e.porTamanho.every((t) => t.custoPorUnidadeComPerda === null)).toBe(true);
    expect(e.custoTotal).toBeCloseTo(3865.6, 9);
  });

  it('sem nenhuma roupa produzida: não divide por zero', () => {
    const r = plano(entrada());
    const e = estimar(entrada(), { ...r, producaoPorTamanho: { P: 0, M: 0, G: 0 } });
    expect(e.faltas.join(' ')).toContain('O plano não produz nenhuma roupa');
    expect(e.unidadesProduzidas).toBe(0);
    expect(e.custoMedioPorUnidade).toBeNull();
    expect(e.areaDasPecasMm2).toBeNull();
  });

  it('as peças passando a área de malha dos riscos (um risco informado curto demais): avisa, e não rateia a perda', () => {
    const e = estimar(entrada(), undefined, undefined, [roupa('P', 5_000_000), roupa('M', 600_000), roupa('G', 700_000)]);
    expect(e.avisos.join(' ')).toContain('passa a área de malha dos riscos');
    expect(e.naoAproveitada).toBeNull();
    expect(e.custoNaoAproveitado).toBeNull();
    expect(e.porTamanho.every((t) => t.custoPorUnidadeComPerda === null)).toBe(true);
    expect(e.custoTotal).toBeCloseTo(3865.6, 9);
  });

  it('o material que não dá o plano inteiro é avisado (a estimativa é do plano como planejado)', () => {
    const r = plano(entrada());
    const e = estimar(entrada(), { ...r, materialSuficiente: false });
    expect(e.avisos).toContain('O material não dá o plano inteiro: a estimativa é do plano como foi planejado (todas as camadas).');
  });
});

describe('estimarCustoDoTecido — encolhimento compensado e perdas fora do enfesto', () => {
  it('com o encolhimento compensado no risco, a peça cortada é maior: a área é a do molde × o fator', () => {
    const compensado = { ...RISCO, compensado: { comprimento: 1.05, largura: 1.02 } };
    const e = estimar(entrada({ compensarEncolhimento: true }), plano(entrada()), [compensado]);
    expect(e.fatorDeArea).toBeCloseTo(1.071, 12);
    expect(m2(e.porTamanho[0]!.areaPorUnidadeMm2)).toBeCloseTo(0.5 * 1.071, 12);
    expect(e.premissas.join(' ')).toContain('Encolhimento compensado no risco');
  });

  it('a perda dos rolos e as emendas aparecem à parte, com o custo, sem entrar no custo do enfesto', () => {
    const r = plano(entrada());
    const e = estimar(entrada(), { ...r, perdaDosRolosMm: 5000, sobreposicoesMm: 200 });
    expect(e.foraDoEnfesto.map((p) => [p.rotulo, p.comprimentoMm, p.custo])).toEqual([
      ['Perda dos rolos (começo e fim de cada rolo, da configuração)', 5000, expect.closeTo(160, 9)],
      ['Sobreposição das emendas', 200, expect.closeTo(6.4, 9)],
    ]);
    expect(e.custoTotal).toBeCloseTo(3865.6, 9);
  });
});

function peca(id: string, nome: string, largura: number, comprimento: number, extras: Partial<Parameters<typeof criarMolde>[0]> = {}): Molde {
  return criarMolde(
    {
      nome,
      referencia: '',
      tamanho: '',
      contorno: [ponto(0, 0), ponto(largura, 0), ponto(largura, comprimento), ponto(0, comprimento)],
      linhaDeFio: { inicio: ponto(largura / 2, 10), fim: ponto(largura / 2, comprimento - 10) },
      ...extras,
    },
    id,
  );
}

describe('roupasPorTamanho — a área real de cada peça, por tamanho', () => {
  // Frente graduada em P, M e G: o canto de cima, à direita, anda 10 mm por tamanho (no P, a peça deixa de ser um
  // retângulo). Manga em par (2 por roupa), etiqueta sem tamanho (em todos), e dois bolsos iguais só no M.
  const frente = (() => {
    const g = definirTamanhosDoMolde(peca('f', 'Frente', 400, 600), ['P', 'M', 'G'], 'M');
    return { ...g, graduacao: definirRegra(g.graduacao!, g.contorno, 2, [ponto(-10, -10), ponto(0, 0), ponto(10, 10)]) };
  })();
  const manga: Molde = { ...peca('m', 'Manga', 100, 200, { quantidade: 2 }), emPar: true };
  const etiqueta = peca('e', 'Etiqueta', 40, 60);
  const bolso1 = peca('b1', 'Bolso', 150, 150, { tamanho: 'M' });
  const bolso2 = peca('b2', 'Bolso', 150, 150, { tamanho: 'M' });
  const modelo = modeloDoPlano([frente, manga, etiqueta, bolso1, bolso2]);
  const quantidades = quantidadesPorRoupa(modelo, {}).quantidades;
  const roupas = roupasPorTamanho(modelo, quantidades);
  const doTamanho = (t: string) => roupas.find((r) => r.tamanho === t)!;

  it('a área é a do contorno, não a do retângulo em volta (a frente P: 0,2350 m², a caixa dela 0,2400 m²)', () => {
    const frenteP = doTamanho('P').pecas.find((p) => p.nome === 'Frente')!;
    expect(frenteP.areaMm2).toBeCloseTo(235_000, 6);
    const caixa = retanguloEnvolvente(modelo.pecasPorTamanho.P!.find((p) => p.pecaId === 'f')!.molde.contorno);
    expect(caixa.largura * caixa.altura).toBe(240_000);
    expect(doTamanho('M').pecas.find((p) => p.nome === 'Frente')!.areaMm2).toBeCloseTo(240_000, 6);
    expect(doTamanho('G').pecas.find((p) => p.nome === 'Frente')!.areaMm2).toBeCloseTo(245_000, 6);
  });

  it('o par conta as duas peças, a peça repetida conta cada vez, e cada tamanho tem a sua roupa', () => {
    expect(doTamanho('P').pecas.find((p) => p.nome === 'Manga')).toMatchObject({ quantidadePorRoupa: 2, emPar: true, areaMm2: 20_000 });
    expect(doTamanho('M').pecas.filter((p) => p.nome === 'Bolso').map((p) => p.areaMm2)).toEqual([22_500, 22_500]);
    expect(doTamanho('P').pecas.some((p) => p.nome === 'Bolso')).toBe(false);
    // P: 235.000 + 2 × 20.000 + 2.400; M: 240.000 + 40.000 + 2.400 + 2 × 22.500; G: 245.000 + 40.000 + 2.400.
    expect(roupas.map((r) => [r.tamanho, Math.round(r.areaMm2)])).toEqual([
      ['P', 277_400],
      ['M', 327_400],
      ['G', 287_400],
    ]);
  });

  it('a peça com 0 por roupa fica fora da roupa', () => {
    const semEtiqueta = roupasPorTamanho(modelo, { ...quantidades, e: 0 });
    expect(semEtiqueta.every((r) => !r.pecas.some((p) => p.nome === 'Etiqueta'))).toBe(true);
    expect(Math.round(semEtiqueta[0]!.areaMm2)).toBe(275_000);
  });

  it('a mesma peça desenhada em mm, em cm e em polegadas dá a mesma área em m² (a importação passa tudo para mm)', () => {
    const dxf = (insunits: number, pontos: readonly [number, number][]): string =>
      [
        ['0', 'SECTION'], ['2', 'HEADER'], ['9', '$INSUNITS'], ['70', String(insunits)], ['0', 'ENDSEC'],
        ['0', 'SECTION'], ['2', 'ENTITIES'], ['0', 'LWPOLYLINE'], ['8', 'C'], ['90', String(pontos.length)], ['70', '1'],
        ...pontos.flatMap(([x, y]) => [['10', String(x)], ['20', String(y)]]),
        ['0', 'ENDSEC'], ['0', 'EOF'],
      ].map(([c, v]) => `${c}\n${v}`).join('\n');
    let n = 0;
    const areaDaRoupa = (texto: string): number => {
      const { moldes } = moldesDoDxf(importarDxf(texto, 'peca'), () => `id-${++n}`);
      const m = modeloDoPlano(moldes);
      return roupasPorTamanho(m, quantidadesPorRoupa(m, {}).quantidades)[0]!.areaMm2 / 1_000_000;
    };
    expect(areaDaRoupa(dxf(4, [[0, 0], [200, 0], [200, 300], [0, 300]]))).toBeCloseTo(0.06, 9); // mm
    expect(areaDaRoupa(dxf(5, [[0, 0], [20, 0], [20, 30], [0, 30]]))).toBeCloseTo(0.06, 9); // cm
    expect(areaDaRoupa(dxf(1, [[0, 0], [10, 0], [10, 10], [0, 10]]))).toBeCloseTo(0.064516, 9); // polegadas: 254 × 254 mm
  });
});

describe('escreverReais', () => {
  it('reais com centavos, ponto no milhar e vírgula nos centavos', () => {
    expect(escreverReais(0)).toBe('R$ 0,00');
    expect(escreverReais(1234.5)).toBe('R$ 1.234,50');
    expect(escreverReais(1_234_567.891)).toBe('R$ 1.234.567,89');
    expect(escreverReais(24.16)).toBe('R$ 24,16');
  });
});

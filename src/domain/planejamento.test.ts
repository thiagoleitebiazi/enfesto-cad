import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde, RESTRICAO_PADRAO, type Molde } from './molde';
import { adicionarPlanoDeCorte, criarProjeto } from './projeto';
import { modeloDoPlano } from './modeloDoPlano';
import { calcularPlanoDeCorte, VERSAO_DO_CALCULO, type PlanoDeCorte } from './planoDeCorte';
import { calcularPlanejamento, CONFIGURACAO_PADRAO_DO_PLANEJAMENTO, type EntradaDoPlanejamento, type RiscoDoPlanejamento } from './planoDeEnfesto';
import { chaveDaGrade, type GradeDoRisco } from './risco';
import {
  ajustesRegistrados,
  confirmarPlano,
  copiaComoRascunho,
  ehPlanoV2,
  guardarRascunho,
  montarAlternativas,
  prepararBusca,
  removerRascunho,
  type PlanoDeCorteV2,
} from './planejamento';
import type { Composicao } from './composicaoDeRiscos';

const ESTADO = { pecas: [], tecido: null, enfesto: null };
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
const ENTRADA: EntradaDoPlanejamento = {
  molde: { projetoId: 'p1', codigo: 'ENF-1', nome: 'Camiseta', revisao: 1, impressaoDigital: 'abc', pecas: [{ id: 'f', nome: 'Frente', tamanhos: ['P', 'M', 'G'], quantidadePorRoupa: 1, emPar: false, restricao: RESTRICAO_PADRAO, areaMm2: 1 }] },
  ordem: { codigo: 'OP-17', quantidadesPorTamanho: { P: 40, M: 80, G: 40 } },
  malha: { id: 'm1', descricao: 'Malha', larguraUtilMm: 1600, rendimentoMmPorG: 4, tubular: false, sentidoUnico: false, padrao: 'liso', encolhimentoCompensadoNoMolde: false },
  rolos: null,
  pesoDisponivelG: 200_000,
  rendimentoPrincipal: 'informado',
  misturarGrupos: false,
  aceitarPadraoSemCasamento: false,
  tipoDeEnfesto: 'impar',
  larguraDoRiscoMm: 1600,
};

function plano(id: string, extras: Partial<PlanoDeCorteV2> = {}): PlanoDeCorteV2 {
  const calculo = calcularPlanejamento(ENTRADA, [RISCO], [{ chave: RISCO.chave, camadas: 40 }], CONFIGURACAO_PADRAO_DO_PLANEJAMENTO);
  if (!calculo.ok) throw new Error(calculo.erros.join(' '));
  return {
    versaoDoCalculo: 2,
    id,
    criadoEmIso: '2026-10-20T10:00:00.000Z',
    atualizadoEmIso: '2026-10-20T10:00:00.000Z',
    situacao: 'rascunho',
    responsavel: 'Ana',
    entrada: ENTRADA,
    configuracao: CONFIGURACAO_PADRAO_DO_PLANEJAMENTO,
    estrategia: 'menor-consumo',
    criterio: 'x',
    origemDaComposicao: 'grade proporcional à ordem',
    riscos: [RISCO],
    composicaoSugerida: [{ chave: RISCO.chave, camadas: 40 }],
    ajustes: {},
    ajustesFeitos: [],
    resultado: calculo.resultado,
    alertas: calculo.alertas,
    premissas: calculo.premissas,
    busca: null,
    ...extras,
  };
}

describe('o plano no projeto: rascunho, confirmação e cópia', () => {
  const base = criarProjeto('Camiseta', 'p1', 'ENF-1', '2026-10-20T09:00:00.000Z', ESTADO);

  it('o rascunho entra, e é trocado quando guardado de novo', () => {
    const um = guardarRascunho(base, plano('a'), '2026-10-20T10:01:00.000Z');
    const dois = guardarRascunho(um, plano('a', { responsavel: 'Bruno' }), '2026-10-20T10:02:00.000Z');
    expect(dois.planosDeCorte).toHaveLength(1);
    expect(dois.planosDeCorte![0]).toMatchObject({ responsavel: 'Bruno', atualizadoEmIso: '2026-10-20T10:02:00.000Z', situacao: 'rascunho' });
  });

  it('confirmado, o plano não muda nem sai; um novo da mesma ordem diz qual substitui, e o anterior fica', () => {
    const rascunho = guardarRascunho(base, plano('a'), '2026-10-20T10:01:00.000Z');
    const conf = confirmarPlano(rascunho, plano('a'), '2026-10-20T10:05:00.000Z');
    expect(conf.planosDeCorte).toHaveLength(1);
    expect(conf.planosDeCorte![0]).toMatchObject({ situacao: 'confirmado', confirmadoEmIso: '2026-10-20T10:05:00.000Z' });
    expect(() => guardarRascunho(conf, plano('a'), '2026-10-20T10:06:00.000Z')).toThrow('já foi confirmado');
    expect(() => confirmarPlano(conf, plano('a'), '2026-10-20T10:06:00.000Z')).toThrow('já foi confirmado');
    expect(() => removerRascunho(conf, 'a', '2026-10-20T10:06:00.000Z')).toThrow('Plano confirmado não é apagado');
    const segundo = confirmarPlano(conf, plano('b', { entrada: { ...ENTRADA, ordem: { ...ENTRADA.ordem, codigo: ' op-17 ' } } }), '2026-10-20T11:00:00.000Z');
    expect(segundo.planosDeCorte!.map((p) => [p.id, ehPlanoV2(p) && p.substituiPlanoId])).toEqual([
      ['a', undefined],
      ['b', 'a'],
    ]);
  });

  it('sem responsável não confirma; o rascunho sai do projeto', () => {
    expect(() => confirmarPlano(base, plano('a', { responsavel: '  ' }), '2026-10-20T10:05:00.000Z')).toThrow('Informe o responsável');
    const comRascunho = guardarRascunho(base, plano('a'), '2026-10-20T10:01:00.000Z');
    expect(removerRascunho(comRascunho, 'a', '2026-10-20T10:02:00.000Z').planosDeCorte).toEqual([]);
  });

  it('a cópia é um rascunho novo, que lembra de onde veio, sem a confirmação do original', () => {
    const conf = confirmarPlano(base, plano('a'), '2026-10-20T10:05:00.000Z').planosDeCorte![0] as PlanoDeCorteV2;
    const copia = copiaComoRascunho(conf, 'c', '2026-10-21T08:00:00.000Z');
    expect(copia).toMatchObject({ id: 'c', situacao: 'rascunho', copiaDePlanoId: 'a', criadoEmIso: '2026-10-21T08:00:00.000Z' });
    expect('confirmadoEmIso' in copia).toBe(false);
  });

  it('os planos da primeira versão do cálculo continuam no projeto, e contam como confirmados', () => {
    const v1Calculo = calcularPlanoDeCorte({
      molde: { projetoId: 'p1', codigo: 'ENF-1', nome: 'Camiseta', revisao: 1, impressaoDigital: 'abc' },
      ordem: { codigo: 'OP-17', quantidadesPorTamanho: { M: 10 } },
      malha: { descricao: 'Malha', larguraUtilMm: 1600, rendimentoMmPorG: 4, pesoDisponivelG: 100_000, tubular: false, sentidoUnico: false },
      rendimentoPrincipal: 'informado',
      risco: { origem: 'informado', comprimentoMm: 1000, larguraMm: 1500, gradePorTamanho: { M: 1 } },
      tipoDeEnfesto: 'impar',
    });
    if (!v1Calculo.ok) throw new Error('v1');
    const v1: PlanoDeCorte = {
      id: 'v1',
      criadoEmIso: '2026-10-19T10:00:00.000Z',
      responsavel: 'Ana',
      versaoDoCalculo: VERSAO_DO_CALCULO,
      entrada: {
        molde: { projetoId: 'p1', codigo: 'ENF-1', nome: 'Camiseta', revisao: 1, impressaoDigital: 'abc' },
        ordem: { codigo: 'OP-17', quantidadesPorTamanho: { M: 10 } },
        malha: { descricao: 'Malha', larguraUtilMm: 1600, rendimentoMmPorG: 4, pesoDisponivelG: 100_000, tubular: false, sentidoUnico: false },
        rendimentoPrincipal: 'informado',
        risco: { origem: 'informado', comprimentoMm: 1000, larguraMm: 1500, gradePorTamanho: { M: 1 } },
        tipoDeEnfesto: 'impar',
      },
      configuracao: { margemInicialDaMesaMm: 100, margemFinalDaMesaMm: 100, sobraPorCamadaMm: 20, folhasPorEnfestoMax: 100, toleranciaDeRendimentoPercentual: 5 },
      ajustes: [],
      resultado: v1Calculo.resultado,
      alertas: v1Calculo.alertas,
      premissas: v1Calculo.premissas,
    };
    const comV1 = adicionarPlanoDeCorte(base, v1, '2026-10-19T10:00:00.000Z');
    expect(ehPlanoV2(comV1.planosDeCorte![0]!)).toBe(false);
    const depois = confirmarPlano(comV1, plano('n'), '2026-10-20T10:00:00.000Z');
    expect(depois.planosDeCorte!.map((p) => p.id)).toEqual(['v1', 'n']);
    expect((depois.planosDeCorte![1] as PlanoDeCorteV2).substituiPlanoId).toBe('v1');
  });
});

describe('prepararBusca e montarAlternativas', () => {
  const peca = (id: string, nome: string, tamanho: string, extras: Partial<Parameters<typeof criarMolde>[0]> = {}): Molde =>
    criarMolde({ nome, referencia: '', tamanho, contorno: [ponto(0, 0), ponto(300, 0), ponto(300, 500), ponto(0, 500)], linhaDeFio: { inicio: ponto(150, 20), fim: ponto(150, 480) }, ...extras }, id);
  const modelo = modeloDoPlano([peca('fp', 'Frente', 'P'), peca('fm', 'Frente', 'M'), peca('fg', 'Frente', 'G'), { ...peca('mm', 'Manga', 'M', { quantidade: 2 }), emPar: true }]);

  it('as grades a fazer: a proporcional primeiro; cada uma com as cópias das peças de cada tamanho', () => {
    const { composicoes, pedidos } = prepararBusca(modelo, { fp: 1, fm: 1, fg: 1, mm: 2 }, { P: 40, M: 80, G: 40 }, 'impar', 6);
    expect(composicoes[0]!.origem).toBe('grade proporcional à ordem');
    expect(pedidos[0]!.grade).toEqual({ P: 1, M: 2, G: 1 });
    // 1 Frente P + 2 × (Frente M + 2 Mangas) + 1 Frente G = 8 peças; das mangas, metade espelhada.
    expect(pedidos[0]!.pecas.map((p) => p.pecaId + (p.espelhada ? '*' : ''))).toEqual(['fp', 'fm', 'fm', 'mm', 'mm*', 'mm', 'mm*', 'fg']);
  });

  it('cada composição avaliada com os riscos feitos; a de risco que não saiu fica de fora, com o motivo', () => {
    const grades: GradeDoRisco[] = [
      { P: 1, M: 2, G: 1 },
      { M: 1 },
      { P: 1 },
      { G: 1 },
    ];
    const tamanhos = ['P', 'M', 'G'];
    // Risco de 1 m por roupa, mais 0,2 m: as grades maiores rendem mais por roupa.
    const feitos = new Map<string, RiscoDoPlanejamento>(
      grades.map((g) => {
        const chave = chaveDaGrade(g, tamanhos);
        const roupas = Object.values(g).reduce((s, n) => s + n, 0);
        return [chave, { ...RISCO, chave, grade: g, comprimentoMm: 1000 * roupas + 200 }];
      }),
    );
    const composicoes: Composicao[] = [
      { origem: 'grande', riscos: [{ chave: chaveDaGrade(grades[0]!, tamanhos), grade: grades[0]!, camadas: 40 }] },
      {
        origem: 'por tamanho',
        riscos: [
          { chave: chaveDaGrade(grades[1]!, tamanhos), grade: grades[1]!, camadas: 80 },
          { chave: chaveDaGrade(grades[2]!, tamanhos), grade: grades[2]!, camadas: 40 },
          { chave: chaveDaGrade(grades[3]!, tamanhos), grade: grades[3]!, camadas: 40 },
        ],
      },
      { origem: 'sem risco', riscos: [{ chave: 'P:2|M:0|G:0', grade: { P: 2 }, camadas: 20 }] },
    ];
    const naoSairam = new Map([['P:2|M:0|G:0', 'não coube na mesa.']]);
    const montadas = montarAlternativas(ENTRADA, composicoes, feitos, naoSairam, CONFIGURACAO_PADRAO_DO_PLANEJAMENTO);
    expect(montadas.avaliadas).toBe(2);
    expect(montadas.descartadas).toEqual([{ origem: 'sem risco', motivo: 'não coube na mesa.' }]);
    // A grande: 40 × 4,22 m = 168,8 m, 1 enfesto. Por tamanho: 160 × 1,22 m = 195,2 m, 3 enfestos. A grande ganha nos três.
    expect(montadas.alternativas.map((a) => [a.composicao.origem, a.criterios])).toEqual([['grande', ['menor-consumo', 'menos-enfestos', 'equilibrada']]]);
    expect(montadas.alternativas[0]!.calculo.resultado.consumoMm).toBe(40 * 4220);
  });

  it('quando nenhuma composição calcula pelo mesmo motivo, esse motivo vem como erro comum', () => {
    const feitos = new Map([[RISCO.chave, RISCO]]);
    const semMaterial = { ...ENTRADA, pesoDisponivelG: 0 };
    const montadas = montarAlternativas(semMaterial, [{ origem: 'a', riscos: [{ chave: RISCO.chave, grade: RISCO.grade, camadas: 40 }] }], feitos, new Map(), CONFIGURACAO_PADRAO_DO_PLANEJAMENTO);
    expect(montadas.alternativas).toEqual([]);
    expect(montadas.errosComuns).toEqual(['Falta o material: escolha os rolos, ou informe o peso disponível da malha (kg).']);
  });
});

describe('ajustesRegistrados', () => {
  it('só o que mudou da sugestão, com o sugerido e o escolhido', () => {
    const calculo = calcularPlanejamento(ENTRADA, [RISCO], [{ chave: RISCO.chave, camadas: 40 }], CONFIGURACAO_PADRAO_DO_PLANEJAMENTO);
    if (!calculo.ok) throw new Error('x');
    expect(
      ajustesRegistrados({
        sugerido: calculo.resultado,
        ajustes: { camadasPorRisco: { [RISCO.chave]: 30 }, camadasPorEnfesto: 100, comprimentoDaMesaMm: 3500 },
        quantidades: [
          { nome: 'Manga', sugerida: 4, escolhida: 2 },
          { nome: 'Frente', sugerida: 1, escolhida: 1 },
        ],
        larguraDoRisco: { sugerida: 1600, escolhida: 1550 },
      }),
    ).toEqual([
      { campo: 'quantidade por roupa: Manga', sugerido: 4, escolhido: 2 },
      { campo: 'largura do risco (mm)', sugerido: 1600, escolhido: 1550 },
      { campo: 'camadas do risco P:1|M:2|G:1', sugerido: 40, escolhido: 30 },
      { campo: 'comprimento da mesa (mm)', sugerido: 3200, escolhido: 3500 },
    ]);
  });
});

describe('o plano no projeto — o que é substituído', () => {
  const base = criarProjeto('Camiseta', 'p1', 'ENF-1', '2026-10-20T09:00:00.000Z', ESTADO);

  it('um rascunho da mesma ordem não conta como plano substituído: só o confirmado', () => {
    const comRascunho = guardarRascunho(base, plano('r'), '2026-10-20T10:00:00.000Z');
    const conf = confirmarPlano(comRascunho, plano('c'), '2026-10-20T10:05:00.000Z');
    expect((conf.planosDeCorte!.find((p) => p.id === 'c') as PlanoDeCorteV2).substituiPlanoId).toBeUndefined();
  });

  it('o erro de uma composição não vira erro comum quando outra calcula', () => {
    const largo: RiscoDoPlanejamento = { ...RISCO, chave: 'M:1', grade: { M: 1 }, larguraMm: 1700 };
    const feitos = new Map([
      [RISCO.chave, RISCO],
      ['M:1', largo],
    ]);
    const montadas = montarAlternativas(
      ENTRADA,
      [
        { origem: 'boa', riscos: [{ chave: RISCO.chave, grade: RISCO.grade, camadas: 40 }] },
        { origem: 'larga demais', riscos: [{ chave: 'M:1', grade: { M: 1 }, camadas: 80 }] },
      ],
      feitos,
      new Map(),
      CONFIGURACAO_PADRAO_DO_PLANEJAMENTO,
    );
    expect(montadas.alternativas).toHaveLength(1);
    expect(montadas.errosComuns).toEqual([]);
    expect(montadas.descartadas[0]!.motivo).toContain('é mais largo que a malha na mesa');
  });
});

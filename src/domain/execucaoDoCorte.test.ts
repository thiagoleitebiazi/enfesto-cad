import { describe, expect, it } from 'vitest';
import {
  CADASTRO_VAZIO,
  darBaixaDoPlano,
  estadoDoRolo,
  lerCadastroDeProducao,
  movimentosDoPlano,
  reservarPlano,
  salvarMalha,
  salvarRolo,
  type CadastroDeProducao,
  type ExecucaoDoCorte,
  type MalhaDoCadastro,
  type RoloDeEstoque,
} from './cadastroDeProducao';
import {
  cancelarAExecucao,
  comparativoDaExecucao,
  concluirOCorte,
  execucaoAtualDoPlano,
  execucoesDoPlano,
  iniciarOCorte,
  liberarParaOCorte,
  type PlanoParaExecutar,
} from './execucaoDoCorte';

const MALHA: MalhaDoCadastro = {
  id: 'm1',
  descricao: 'Malha algodão 30/1',
  larguraUtilMm: 1700,
  rendimentoMmPorG: 3.6,
  tubular: false,
  sentidoUnico: false,
  padrao: 'liso',
  encolhimentoCompensadoNoMolde: false,
};

const rolo = (id: string, identificacao: string, metros: number): RoloDeEstoque => ({
  id,
  malhaId: 'm1',
  identificacao,
  comprimentoMedidoMm: metros * 1000,
  lote: 'L1',
  tonalidade: 'A',
  defeitos: [],
  unidadeDoPeso: 'kg',
  unidadeDoComprimento: 'm',
  indisponivel: false,
});

const BASE: CadastroDeProducao = salvarRolo(salvarRolo(salvarMalha(CADASTRO_VAZIO, MALHA), rolo('r1', 'R-001', 100)), rolo('r2', 'R-002', 50));

// O plano usa 60 m do R-001 e 20 m do R-002: 80 m em 20 camadas.
const PLANO: PlanoParaExecutar = {
  planoId: 'p1',
  projetoId: 'proj',
  ordem: 'OP-17',
  camadas: 20,
  consumoMm: 80_000,
  usos: [
    { roloId: 'r1', comprimentoMm: 60_000 },
    { roloId: 'r2', comprimentoMm: 20_000 },
  ],
};

let contador = 0;
const novoId = (): string => `id-${++contador}`;
const quem = { responsavel: 'Ana', agoraIso: '2026-10-24T08:00:00.000Z', novoId };

/** O plano liberado e com o corte começado às 8h30. */
function emCorte(cadastro: CadastroDeProducao = BASE): { cadastro: CadastroDeProducao; id: string } {
  const liberado = liberarParaOCorte(cadastro, PLANO, quem);
  const id = execucaoAtualDoPlano(liberado, 'p1')!.id;
  return { cadastro: iniciarOCorte(liberado, id, { operador: 'Bruno', agoraIso: '2026-10-24T08:30:00.000Z' }), id };
}

const concluir = (cadastro: CadastroDeProducao, id: string, r1: number, r2: number, extras: { retalhoR1?: boolean; camadas?: number } = {}) =>
  concluirOCorte(cadastro, id, PLANO, {
    responsavel: 'Bruno',
    agoraIso: '2026-10-24T10:15:00.000Z',
    camadasRealizadas: extras.camadas ?? 20,
    consumoPorRolo: [
      { roloId: 'r1', realMm: r1, sobraViraRetalho: extras.retalhoR1 ?? false },
      { roloId: 'r2', realMm: r2, sobraViraRetalho: false },
    ],
    novoId,
  });

describe('execução do corte — liberar, iniciar e cancelar', () => {
  it('liberar guarda quem liberou e quando; o mesmo plano não é liberado duas vezes', () => {
    const liberado = liberarParaOCorte(BASE, PLANO, quem);
    const e = execucaoAtualDoPlano(liberado, 'p1')!;
    expect(e).toMatchObject({ situacao: 'liberada', liberadaPor: 'Ana', liberadaEmIso: quem.agoraIso, ordem: 'OP-17', camadasPlanejadas: 20, consumoPlanejadoMm: 80_000 });
    expect(() => liberarParaOCorte(liberado, PLANO, quem)).toThrow('Este plano já está "liberada para o corte".');
    expect(() => liberarParaOCorte(BASE, PLANO, { ...quem, responsavel: '  ' })).toThrow('Informe quem está liberando');
  });

  it('o corte começa só depois de liberado, com quem corta', () => {
    const liberado = liberarParaOCorte(BASE, PLANO, quem);
    const id = execucaoAtualDoPlano(liberado, 'p1')!.id;
    expect(() => iniciarOCorte(liberado, id, { operador: '', agoraIso: quem.agoraIso })).toThrow('Informe quem está cortando.');
    const { cadastro } = emCorte();
    const e = execucaoAtualDoPlano(cadastro, 'p1')!;
    expect(e).toMatchObject({ situacao: 'em-corte', operador: 'Bruno', iniciadaEmIso: '2026-10-24T08:30:00.000Z' });
    expect(() => iniciarOCorte(cadastro, e.id, { operador: 'Bruno', agoraIso: quem.agoraIso })).toThrow('Só um plano liberado começa o corte');
  });

  it('cancelar pede o motivo, fica no registro e deixa liberar de novo; o concluído não se cancela', () => {
    const { cadastro, id } = emCorte();
    expect(() => cancelarAExecucao(cadastro, id, { responsavel: 'Ana', motivo: ' ', agoraIso: quem.agoraIso })).toThrow('Diga o motivo do cancelamento.');
    const cancelado = cancelarAExecucao(cadastro, id, { responsavel: 'Ana', motivo: 'Faca quebrada', agoraIso: '2026-10-24T09:00:00.000Z' });
    expect(execucaoAtualDoPlano(cancelado, 'p1')).toBeNull();
    expect(execucoesDoPlano(cancelado, 'p1')[0]).toMatchObject({ situacao: 'cancelada', motivoDoCancelamento: 'Faca quebrada', canceladaPor: 'Ana' });
    const deNovo = liberarParaOCorte(cancelado, PLANO, quem);
    expect(execucoesDoPlano(deNovo, 'p1').map((e) => e.situacao)).toEqual(['cancelada', 'liberada']);

    const concluido = concluir(cadastro, id, 60_000, 20_000).cadastro;
    expect(() => cancelarAExecucao(concluido, id, { responsavel: 'Ana', motivo: 'x', agoraIso: quem.agoraIso })).toThrow('Um corte concluído não se cancela');
  });
});

describe('execução do corte — concluir com o consumo real', () => {
  it('a baixa do estoque é a do consumo real; a sobra vira retalho; o rolo não usado perde a reserva', () => {
    const reservado = reservarPlano(BASE, PLANO.usos, { planoId: 'p1', projetoId: 'proj', responsavel: 'Ana', agoraIso: quem.agoraIso, novoId }).cadastro;
    const { cadastro, id } = emCorte(reservado);
    // O R-001 deu 62 m (as pontas foram maiores), e o R-002 não foi usado.
    const r = concluir(cadastro, id, 62_000, 0, { retalhoR1: true });
    const e = execucaoAtualDoPlano(r.cadastro, 'p1')!;
    expect(e).toMatchObject({ situacao: 'concluida', concluidaPor: 'Bruno', camadasRealizadas: 20, consumoRealMm: 62_000 });
    const r1 = r.cadastro.rolos.find((x) => x.id === 'r1')!;
    const r2 = r.cadastro.rolos.find((x) => x.id === 'r2')!;
    expect(estadoDoRolo(r.cadastro, r1)).toMatchObject({ consumidoMm: 62_000, saldoFisicoMm: 38_000, reservadoMm: 0 });
    expect(estadoDoRolo(r.cadastro, r2)).toMatchObject({ consumidoMm: 0, reservadoMm: 0, disponivelMm: 50_000 });
    expect(r1.retalho).toBe(true);
    expect(r2.retalho).toBeUndefined();
    expect(r.mensagens).toEqual(['Baixa do consumo real: R-001.', 'A reserva de 1 rolo(s) não usado(s) no corte foi estornada.', 'Sobra guardada como retalho: R-001.']);
  });

  it('a baixa planejada já dada é estornada (com o motivo) e trocada pela real — nada é apagado', () => {
    const comBaixa = darBaixaDoPlano(BASE, PLANO.usos, { planoId: 'p1', projetoId: 'proj', responsavel: 'Ana', agoraIso: quem.agoraIso, novoId }).cadastro;
    const { cadastro, id } = emCorte(comBaixa);
    const r = concluir(cadastro, id, 61_000, 21_000);
    const movimentos = movimentosDoPlano(r.cadastro, 'p1');
    expect(movimentos.map((m) => [m.tipo, m.comprimentoMm, m.ativo || m.tipo === 'estorno'])).toEqual([
      ['baixa', 60_000, false],
      ['baixa', 20_000, false],
      ['estorno', 60_000, true],
      ['estorno', 20_000, true],
      ['baixa', 61_000, true],
      ['baixa', 21_000, true],
    ]);
    expect(movimentos.filter((m) => m.tipo === 'estorno').every((m) => m.motivo === 'Trocada pela baixa do consumo real (execução do corte).')).toBe(true);
    expect(estadoDoRolo(r.cadastro, r.cadastro.rolos.find((x) => x.id === 'r1')!).consumidoMm).toBe(61_000);
    expect(r.mensagens[0]).toBe('A baixa planejada (2 rolo(s)) foi estornada e trocada pela do consumo real.');
  });

  it('tudo ou nada: consumo maior que o saldo do rolo, dado inválido ou camadas erradas não mudam nada', () => {
    const { cadastro, id } = emCorte();
    expect(() => concluir(cadastro, id, 120_000, 20_000)).toThrow('O rolo R-001 tem 100,00 m de saldo, menos que os 120,00 m do plano.');
    expect(() => concluir(cadastro, id, Number.NaN, 20_000)).toThrow('O consumo real do rolo R-001 precisa ser um número de 0 para cima.');
    expect(() => concluir(cadastro, id, 60_000, 20_000, { camadas: 0 })).toThrow('As camadas enfestadas precisam ser um número inteiro de 1 para cima');
    expect(() => concluir(cadastro, id, 60_000, 20_000, { camadas: 2.5 })).toThrow('As camadas enfestadas');
    expect(() => concluirOCorte(cadastro, id, PLANO, { responsavel: 'Bruno', agoraIso: quem.agoraIso, camadasRealizadas: 20, consumoPorRolo: [{ roloId: 'r1', realMm: 1, sobraViraRetalho: false }], novoId })).toThrow(
      'Falta o consumo real do rolo R-002.',
    );
    expect(execucaoAtualDoPlano(cadastro, 'p1')!.situacao).toBe('em-corte');
    expect(cadastro.movimentos).toEqual([]);
  });

  it('o plano por peso, sem rolos: pede o consumo real total e não mexe no estoque', () => {
    const porPeso: PlanoParaExecutar = { ...PLANO, usos: [] };
    const liberado = liberarParaOCorte(BASE, porPeso, quem);
    const id = execucaoAtualDoPlano(liberado, 'p1')!.id;
    const cortando = iniciarOCorte(liberado, id, { operador: 'Bruno', agoraIso: quem.agoraIso });
    const conclusao = { responsavel: 'Bruno', agoraIso: quem.agoraIso, camadasRealizadas: 20, novoId };
    expect(() => concluirOCorte(cortando, id, porPeso, conclusao)).toThrow('Informe o consumo real de malha (maior que zero).');
    const r = concluirOCorte(cortando, id, porPeso, { ...conclusao, consumoRealMm: 79_500, observacoes: '  sem perdas  ' });
    expect(execucaoAtualDoPlano(r.cadastro, 'p1')).toMatchObject({ situacao: 'concluida', consumoRealMm: 79_500, observacoes: 'sem perdas' });
    expect(r.cadastro.movimentos).toEqual([]);
  });

  it('o comparativo: o planejado, o real, a diferença, o consumo por camada e o tempo do corte', () => {
    const { cadastro, id } = emCorte();
    const e = execucaoAtualDoPlano(concluir(cadastro, id, 62_000, 20_000, { camadas: 19 }).cadastro, 'p1')!;
    const c = comparativoDaExecucao(e);
    expect(c).toMatchObject({ camadasPlanejadas: 20, camadasRealizadas: 19, consumoPlanejadoMm: 80_000, consumoRealMm: 82_000, diferencaMm: 2000 });
    expect(c.diferencaPercentual).toBeCloseTo(2.5, 9);
    expect(c.consumoPorCamadaPlanejadoMm).toBe(4000);
    expect(c.consumoPorCamadaRealMm).toBeCloseTo(82_000 / 19, 9);
    expect(c.duracaoMin).toBe(105); // 8h30 → 10h15
    // Antes de concluir, o real fica em branco.
    expect(comparativoDaExecucao(execucaoAtualDoPlano(cadastro, 'p1')!)).toMatchObject({ consumoRealMm: null, diferencaMm: null, duracaoMin: null });
  });
});

describe('execução do corte — no arquivo do cadastro', () => {
  it('o arquivo da versão 2 abre sem execuções; as execuções e o retalho voltam do disco como foram gravados', () => {
    const v2 = JSON.parse(JSON.stringify({ versaoDoFormato: 2, malhas: [MALHA], rolos: [rolo('r1', 'R-001', 100)], ordens: [], movimentos: [] }));
    const lidoV2 = lerCadastroDeProducao(v2);
    expect(lidoV2.cadastro.execucoes).toEqual([]);
    expect(lidoV2.descartados).toEqual([]);
    expect(lidoV2.maisNovo).toBe(false);

    const { cadastro, id } = emCorte();
    const concluido = concluir(cadastro, id, 62_000, 20_000, { retalhoR1: true }).cadastro;
    const deVolta = lerCadastroDeProducao(JSON.parse(JSON.stringify(concluido)));
    expect(deVolta.descartados).toEqual([]);
    expect(deVolta.cadastro.execucoes).toEqual(concluido.execucoes);
    expect(deVolta.cadastro.rolos.find((r) => r.id === 'r1')!.retalho).toBe(true);
  });

  it('a execução com dados que não conferem fica de fora, com o motivo (a concluída sem o consumo real, por exemplo)', () => {
    const ruim: Partial<ExecucaoDoCorte> = {
      id: 'e',
      planoId: 'p',
      projetoId: 'x',
      ordem: 'OP',
      situacao: 'concluida',
      camadasPlanejadas: 2,
      consumoPlanejadoMm: 10,
      liberadaEmIso: 'x',
      liberadaPor: 'a',
      iniciadaEmIso: 'x',
      operador: 'b',
      concluidaEmIso: 'x',
      concluidaPor: 'b',
      camadasRealizadas: 2,
    };
    const lido = lerCadastroDeProducao({ versaoDoFormato: 3, execucoes: [ruim] });
    expect(lido.cadastro.execucoes).toEqual([]);
    expect(lido.descartados).toEqual(['1 registro(s) de execuções do corte com dados inválidos ficaram de fora.']);
  });
});

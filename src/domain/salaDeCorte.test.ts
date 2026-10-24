import { describe, expect, it } from 'vitest';
import { CADASTRO_VAZIO, salvarMalha, salvarRolo, type CadastroDeProducao, type MalhaDoCadastro, type RoloDeEstoque } from './cadastroDeProducao';
import { concluirOCorte, execucaoAtualDoPlano, iniciarOCorte, liberarParaOCorte, planoDaExecucao, type PlanoParaExecutar } from './execucaoDoCorte';
import {
  consumoPorMalha,
  csvDasExecucoes,
  csvDoConsumoPorMalha,
  indicadoresDaSalaDeCorte,
  malhaDaExecucao,
  OPCOES_PADRAO_DAS_SUGESTOES,
  retalhosEmEstoque,
  sugestoesDeCorrecao,
} from './salaDeCorte';

const MALHA: MalhaDoCadastro = { id: 'm1', descricao: 'Malha algodão', larguraUtilMm: 1700, rendimentoMmPorG: 4, tubular: false, sentidoUnico: false, padrao: 'liso', encolhimentoCompensadoNoMolde: false };
const rolo = (id: string, metros: number): RoloDeEstoque => ({
  id,
  malhaId: 'm1',
  identificacao: id.toUpperCase(),
  comprimentoMedidoMm: metros * 1000,
  lote: 'L1',
  tonalidade: 'A',
  defeitos: [],
  unidadeDoPeso: 'kg',
  unidadeDoComprimento: 'm',
  indisponivel: false,
});
const BASE = salvarRolo(salvarRolo(salvarRolo(salvarMalha(CADASTRO_VAZIO, MALHA), rolo('r1', 200)), rolo('r2', 200)), rolo('r3', 200));

let contador = 0;
const novoId = (): string => `id-${++contador}`;

/** Um plano liberado às 8h, começado às 9h por `operador` e concluído às 10h com o consumo real (o plano: 10 camadas de 4 m). */
function cortar(cadastro: CadastroDeProducao, planoId: string, roloId: string, realMm: number, operador = 'Bruno', camadas = 10, dia = '2026-10-20'): CadastroDeProducao {
  const plano: PlanoParaExecutar = { planoId, projetoId: 'proj', ordem: `OP-${planoId}`, camadas: 10, consumoMm: 40_000, usos: [{ roloId, comprimentoMm: 40_000 }], malha: 'Malha algodão' };
  let c = liberarParaOCorte(cadastro, plano, { responsavel: 'Ana', agoraIso: `${dia}T08:00:00.000Z`, novoId });
  const id = execucaoAtualDoPlano(c, planoId)!.id;
  c = iniciarOCorte(c, id, { operador, agoraIso: `${dia}T09:00:00.000Z` });
  return concluirOCorte(c, id, planoDaExecucao(execucaoAtualDoPlano(c, planoId)!), {
    responsavel: operador,
    agoraIso: `${dia}T10:00:00.000Z`,
    camadasRealizadas: camadas,
    consumoPorRolo: [{ roloId, realMm, sobraViraRetalho: realMm > 30_000 }],
    novoId,
  }).cadastro;
}

const AGORA = '2026-10-24T12:00:00.000Z';

describe('a execução guarda o plano ao liberar (a sala de corte conclui sem abrir o projeto)', () => {
  it('os rolos e a malha do plano ficam na execução; planoDaExecucao os devolve', () => {
    const plano: PlanoParaExecutar = { planoId: 'p', projetoId: 'proj', ordem: 'OP', camadas: 10, consumoMm: 40_000, usos: [{ roloId: 'r1', comprimentoMm: 40_000 }], malha: 'Malha algodão' };
    const e = execucaoAtualDoPlano(liberarParaOCorte(BASE, plano, { responsavel: 'Ana', agoraIso: AGORA, novoId }), 'p')!;
    expect(e.usosPlanejados).toEqual([{ roloId: 'r1', comprimentoMm: 40_000 }]);
    expect(e.malha).toBe('Malha algodão');
    expect(planoDaExecucao(e)).toEqual(plano);
  });
});

describe('indicadores da sala de corte', () => {
  it('o consumo, o desvio, as camadas, o tempo e os metros por hora, no total e por operador; o período filtra pela conclusão', () => {
    let c = cortar(BASE, 'p1', 'r1', 42_000, 'Bruno');
    c = cortar(c, 'p2', 'r2', 40_000, 'Carla');
    c = cortar(c, 'p3', 'r3', 41_000, 'Bruno', 10, '2026-09-01');
    const tudo = indicadoresDaSalaDeCorte(c);
    expect(tudo).toMatchObject({ cortesConcluidos: 3, consumoPlanejadoMm: 120_000, consumoRealMm: 123_000, camadasPlanejadas: 30, camadasRealizadas: 30, tempoTotalMin: 180, tempoMedioMin: 60 });
    expect(tudo.desvioPercentual).toBeCloseTo(2.5, 9);
    expect(tudo.metrosPorHora).toBeCloseTo(41, 9);
    expect(tudo.porOperador.map((o) => [o.operador, o.cortes, o.metrosReais])).toEqual([
      ['Bruno', 2, 83],
      ['Carla', 1, 40],
    ]);
    expect(tudo.porOperador[0]!.desvioPercentual).toBeCloseTo(3.75, 9);
    // Os últimos 30 dias deixam o corte de setembro de fora.
    expect(indicadoresDaSalaDeCorte(c, '2026-09-24T12:00:00.000Z').cortesConcluidos).toBe(2);
  });

  it('as ordens abertas contam à parte', () => {
    const plano: PlanoParaExecutar = { planoId: 'aberta', projetoId: 'proj', ordem: 'OP-X', camadas: 1, consumoMm: 1000, usos: [] };
    const c = liberarParaOCorte(BASE, plano, { responsavel: 'Ana', agoraIso: AGORA, novoId });
    expect(indicadoresDaSalaDeCorte(c).abertas).toEqual({ liberadas: 1, emCorte: 0 });
    expect(indicadoresDaSalaDeCorte(c).desvioPercentual).toBeNull();
  });
});

describe('sugestões de correção', () => {
  const opcoes = { ...OPCOES_PADRAO_DAS_SUGESTOES, agoraIso: AGORA };

  it('consumo por camada acima da tolerância: sugere aumentar as pontas pela média do que cada camada gastou a mais', () => {
    let c = cortar(BASE, 'p1', 'r1', 42_000);
    c = cortar(c, 'p2', 'r2', 42_000);
    c = cortar(c, 'p3', 'r3', 42_000);
    // Cada camada: 4,2 m contra 4 m planejados = +0,200 m (+5%).
    expect(sugestoesDeCorrecao(c, opcoes)).toEqual([
      {
        nivel: 'aviso',
        texto:
          'Nos 3 cortes concluídos, cada camada gastou em média 0,200 m a mais que o planejado (+5,0%, acima da tolerância de 3,0%). Aumente as pontas por camada na configuração do plano em cerca de 0,200 m, ou confira o comprimento do risco na mesa.',
      },
    ]);
  });

  it('dentro da tolerância, nada; abaixo dela, a informação de que as pontas podem diminuir; com poucos cortes, ainda sem média', () => {
    let c = cortar(BASE, 'p1', 'r1', 40_400);
    c = cortar(c, 'p2', 'r2', 40_000);
    c = cortar(c, 'p3', 'r3', 40_800);
    expect(sugestoesDeCorrecao(c, opcoes)).toEqual([]);
    let menos = cortar(BASE, 'p1', 'r1', 36_000);
    menos = cortar(menos, 'p2', 'r2', 36_000);
    menos = cortar(menos, 'p3', 'r3', 36_000);
    expect(sugestoesDeCorrecao(menos, opcoes)[0]!.texto).toContain('cada camada gastou em média 0,400 m a menos que o planejado (-10,0%)');
    expect(sugestoesDeCorrecao(cortar(BASE, 'p1', 'r1', 40_000), opcoes)[0]!.texto).toBe('Com menos de 3 cortes concluídos no período, ainda não há média para sugerir correção do consumo.');
  });

  it('camadas a menos, ordens liberadas paradas e cortes começados há muito tempo', () => {
    let c = cortar(BASE, 'p1', 'r1', 36_000, 'Bruno', 9);
    c = liberarParaOCorte(c, { planoId: 'parada', projetoId: 'proj', ordem: 'OP-PARADA', camadas: 1, consumoMm: 1000, usos: [] }, { responsavel: 'Ana', agoraIso: '2026-10-21T08:00:00.000Z', novoId });
    c = liberarParaOCorte(c, { planoId: 'longa', projetoId: 'proj', ordem: 'OP-LONGA', camadas: 1, consumoMm: 1000, usos: [] }, { responsavel: 'Ana', agoraIso: '2026-10-23T08:00:00.000Z', novoId });
    c = iniciarOCorte(c, execucaoAtualDoPlano(c, 'longa')!.id, { operador: 'Bruno', agoraIso: '2026-10-23T09:00:00.000Z' });
    const textos = sugestoesDeCorrecao(c, opcoes).map((s) => s.texto);
    expect(textos).toContain('1 corte(s) com menos camadas que o planejado (OP-p1: 9 de 10): a ordem pode não ter fechado — confira a produção e se faltou malha.');
    expect(textos).toContain('1 ordem(ns) liberada(s) há mais de 2 dias sem começar o corte: OP-PARADA.');
    expect(textos).toContain('1 corte(s) começado(s) há mais de 12 h e não concluído(s): OP-LONGA — conclua (com o consumo real) ou cancele.');
  });
});

describe('retalhos, consumo por malha e os relatórios em CSV', () => {
  it('os retalhos no estoque, do maior saldo ao menor; o usado (indisponível) sai da lista', () => {
    let c = cortar(BASE, 'p1', 'r1', 42_000);
    c = cortar(c, 'p2', 'r2', 31_000);
    const retalhos = retalhosEmEstoque(c);
    expect(retalhos.map((r) => [r.rolo.identificacao, r.saldoMm, r.malha])).toEqual([
      ['R2', 169_000, 'Malha algodão'],
      ['R1', 158_000, 'Malha algodão'],
    ]);
    const usado = salvarRolo(c, { ...c.rolos.find((r) => r.id === 'r1')!, indisponivel: true });
    expect(retalhosEmEstoque(usado).map((r) => r.rolo.id)).toEqual(['r2']);
  });

  it('o consumo real por malha, com o peso pelo rendimento; a malha da execução é a guardada ao liberar', () => {
    let c = cortar(BASE, 'p1', 'r1', 42_000);
    c = cortar(c, 'p2', 'r2', 40_000);
    expect(malhaDaExecucao(c, c.execucoes[0]!)).toBe('Malha algodão');
    expect(consumoPorMalha(c)).toEqual([{ malha: 'Malha algodão', cortes: 2, planejadoMm: 80_000, realMm: 82_000, realG: 82_000 / 4 }]);
    expect(csvDoConsumoPorMalha(consumoPorMalha(c))).toBe('Malha;Cortes;Consumo planejado (m);Consumo real (m);Consumo real (kg)\r\nMalha algodão;2;80,000;82,000;20,50\r\n');
  });

  it('o histórico em CSV: uma linha por execução, ponto e vírgula, vírgula decimal, o texto com ponto e vírgula entre aspas', () => {
    const c = cortar(BASE, 'p1', 'r1', 42_000);
    const comObs = { ...c, execucoes: c.execucoes.map((e) => ({ ...e, observacoes: 'faca; trocada' })) };
    const linhas = csvDasExecucoes(comObs, (id) => (id === 'proj' ? 'Camiseta (ENF-1)' : '?')).split('\r\n');
    expect(linhas[0]).toBe(
      'Ordem;Projeto;Malha;Situação;Liberada em;Liberada por;Começada em;Operador;Concluída em;Concluída por;Camadas planejadas;Camadas realizadas;Consumo planejado (m);Consumo real (m);Diferença (%);Tempo do corte (min);Cancelada em;Motivo do cancelamento;Observações',
    );
    const campos = linhas[1]!.split(';');
    expect(campos.slice(0, 4)).toEqual(['OP-p1', 'Camiseta (ENF-1)', 'Malha algodão', 'Concluída']);
    expect(campos.slice(10, 16)).toEqual(['10', '10', '40,000', '42,000', '5,0', '60']);
    expect(linhas[1]!.endsWith(';"faca; trocada"')).toBe(true);
  });
});

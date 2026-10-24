import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde } from './molde';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from './enfesto';
import { executarNestingAutomatico, type ResultadoDeNesting } from './nesting';
import {
  adicionarTrabalho,
  cancelarTrabalho,
  concluidosSemAplicar,
  concluirTrabalho,
  contagemDaFila,
  csvDaFila,
  descricaoDasOpcoes,
  FILA_VAZIA,
  falharTrabalho,
  iniciarTrabalho,
  lerFilaDeEncaixes,
  marcarAplicado,
  MAXIMO_DE_TRABALHOS,
  melhoresPorProjeto,
  moverNaFila,
  mudarPrioridade,
  pausarAFila,
  pausarTrabalho,
  podeMover,
  posicaoNaFila,
  proximoTrabalho,
  recuperarInterrompidos,
  reenfileirarTrabalho,
  relatorioDaFila,
  removerTerminados,
  removerTrabalho,
  retomarTrabalho,
  trabalhosNaOrdem,
  type DadosDoTrabalho,
  type FilaDeEncaixes,
  type PrioridadeNaFila,
} from './filaDeEncaixes';

const ENFESTO: ConfiguracaoDeEnfesto = criarConfiguracaoDeEnfesto({
  tipo: 'impar',
  larguraUtilMm: 1000,
  comprimentoMm: 3000,
  quantidadeDeCamadas: 1,
  margemLateralMm: 0,
  margemDeExtremidadeMm: 0,
  distanciaMinimaEntrePecasMm: 5,
} as ConfiguracaoDeEnfesto);

const PECA = criarMolde(
  {
    nome: 'Frente',
    referencia: '',
    tamanho: 'M',
    quantidade: 2,
    contorno: [ponto(0, 0), ponto(300, 0), ponto(300, 400), ponto(0, 400)],
    linhaDeFio: { inicio: ponto(150, 50), fim: ponto(150, 350) },
  },
  'frente',
);

const dados = (projetoId = 'p1', prioridade: PrioridadeNaFila = 'normal'): DadosDoTrabalho => ({
  projetoId,
  projetoNome: `Projeto ${projetoId}`,
  projetoCodigo: `C-${projetoId}`,
  impressaoDasPecas: 'abc',
  prioridade,
  pecas: [PECA],
  enfesto: ENFESTO,
  opcoes: { metodo: 'grade' },
});

const AGORA = '2026-10-24T10:00:00.000Z';

/** A fila com os trabalhos `t1`, `t2`… nas prioridades dadas, na ordem em que entraram. */
function filaCom(...prioridades: PrioridadeNaFila[]): FilaDeEncaixes {
  return prioridades.reduce((f, p, i) => adicionarTrabalho(f, dados('p1', p), `t${i + 1}`, AGORA), FILA_VAZIA);
}

const resultado = (aproveitamento: number, deFora = 0, comprimento = 1000): ResultadoDeNesting => ({
  pecasColocadas: [{ idOriginal: 'frente', indiceCopia: 0, molde: PECA }],
  pecasNaoColocadas: Array.from({ length: deFora }, (_, i) => ({ idOriginal: 'frente', indiceCopia: i + 1, nome: 'Frente' })),
  comprimentoUtilizadoMm: comprimento,
  areaOcupadaMm2: 120_000,
  aproveitamentoPercentual: aproveitamento,
  tempoDeProcessamentoMs: 2500,
  interrompido: false,
  paradaPorTempoLimite: false,
  paradaPorMetaDeAproveitamento: false,
});

/** Calcula e conclui o trabalho `id` com o resultado dado. */
const concluir = (f: FilaDeEncaixes, id: string, r: ResultadoDeNesting): FilaDeEncaixes => concluirTrabalho(iniciarTrabalho(f, id, AGORA), id, r, '2026-10-24T10:05:00.000Z');

describe('a fila de encaixes — a vez de cada um', () => {
  it('entra no fim da fila, aguardando; o próximo é o primeiro da prioridade mais alta', () => {
    const f = filaCom('normal', 'baixa', 'alta', 'normal');
    expect(f.trabalhos.map((t) => t.situacao)).toEqual(['aguardando', 'aguardando', 'aguardando', 'aguardando']);
    expect(proximoTrabalho(f)?.id).toBe('t3');
    expect(trabalhosNaOrdem(f).map((t) => t.id)).toEqual(['t3', 't1', 't4', 't2']);
    expect(posicaoNaFila(f, 't3')).toBe(1);
    expect(posicaoNaFila(f, 't2')).toBe(4);
  });

  it('um de cada vez: com um calculando, não há próximo; com a fila pausada, também não', () => {
    let f = filaCom('normal', 'normal');
    f = iniciarTrabalho(f, 't1', AGORA);
    expect(f.trabalhos[0]!.situacao).toBe('executando');
    expect(f.trabalhos[0]!.iniciadoEmIso).toBe(AGORA);
    expect(proximoTrabalho(f)).toBeNull();
    f = concluir(filaCom('normal', 'normal'), 't1', resultado(80));
    expect(proximoTrabalho(f)?.id).toBe('t2');
    expect(proximoTrabalho(pausarAFila(f, true))).toBeNull();
    expect(proximoTrabalho(pausarAFila(pausarAFila(f, true), false))?.id).toBe('t2');
  });

  it('não entra sem peças, nem com a fila cheia', () => {
    expect(() => adicionarTrabalho(FILA_VAZIA, { ...dados(), pecas: [] }, 'x', AGORA)).toThrow(/peças/);
    const cheia: FilaDeEncaixes = { ...FILA_VAZIA, trabalhos: Array.from({ length: MAXIMO_DE_TRABALHOS }, (_, i) => ({ ...filaCom('normal').trabalhos[0]!, id: `t${i}` })) };
    expect(() => adicionarTrabalho(cheia, dados(), 'x', AGORA)).toThrow(/Limpar os terminados/);
  });

  it('subir e descer trocam a vez com o vizinho da mesma prioridade; no topo ou no fim, nada muda', () => {
    const f = filaCom('normal', 'normal', 'normal', 'alta');
    const desceu = moverNaFila(f, 't1', 1);
    expect(trabalhosNaOrdem(desceu).map((t) => t.id)).toEqual(['t4', 't2', 't1', 't3']);
    expect(moverNaFila(f, 't1', -1)).toBe(f);
    expect(moverNaFila(f, 't4', -1)).toBe(f); // sozinho na prioridade alta
    expect(podeMover(f, 't3', 1)).toBe(false);
    expect(podeMover(f, 't3', -1)).toBe(true);
  });

  it('a prioridade muda a vez; só dos que ainda não começaram', () => {
    let f = filaCom('normal', 'normal');
    f = mudarPrioridade(f, 't2', 'alta');
    expect(proximoTrabalho(f)?.id).toBe('t2');
    f = iniciarTrabalho(f, 't2', AGORA);
    expect(mudarPrioridade(f, 't2', 'baixa')).toBe(f);
  });
});

describe('a fila de encaixes — pausar, cancelar, recomeçar', () => {
  it('pausar o que aguarda o tira da vez; retomar o devolve', () => {
    let f = pausarTrabalho(filaCom('normal', 'normal'), 't1');
    expect(f.trabalhos[0]!.situacao).toBe('pausado');
    expect(proximoTrabalho(f)?.id).toBe('t2');
    f = retomarTrabalho(f, 't1');
    expect(proximoTrabalho(f)?.id).toBe('t1');
  });

  it('pausar o que está calculando: volta a pausado, sem a hora do começo, e conta um recomeço', () => {
    const f = pausarTrabalho(iniciarTrabalho(filaCom('normal'), 't1', AGORA), 't1');
    expect(f.trabalhos[0]!.situacao).toBe('pausado');
    expect(f.trabalhos[0]!.iniciadoEmIso).toBeUndefined();
    expect(f.trabalhos[0]!.recomecos).toBe(1);
  });

  it('cancelar e pôr de novo na fila (no fim); um terminado não se pausa nem se cancela', () => {
    let f = cancelarTrabalho(filaCom('normal', 'normal'), 't1', AGORA);
    expect(f.trabalhos[0]!.situacao).toBe('cancelado');
    expect(proximoTrabalho(f)?.id).toBe('t2');
    expect(pausarTrabalho(f, 't1')).toBe(f);
    expect(cancelarTrabalho(f, 't1', AGORA)).toBe(f);
    f = reenfileirarTrabalho(f, 't1');
    expect(f.trabalhos[0]!.situacao).toBe('aguardando');
    expect(f.trabalhos[0]!.terminadoEmIso).toBeUndefined();
    expect(trabalhosNaOrdem(f).map((t) => t.id)).toEqual(['t2', 't1']);
  });

  it('falhar guarda o erro; o que falhou pode voltar para a fila', () => {
    let f = falharTrabalho(iniciarTrabalho(filaCom('normal'), 't1', AGORA), 't1', 'sem memória', AGORA);
    expect(f.trabalhos[0]).toMatchObject({ situacao: 'falhou', erro: 'sem memória' });
    f = reenfileirarTrabalho(f, 't1');
    expect(f.trabalhos[0]!.erro).toBeUndefined();
    expect(proximoTrabalho(f)?.id).toBe('t1');
  });

  it('o programa fechado no meio do cálculo: ao abrir, o trabalho volta a aguardar e recomeça', () => {
    const f = recuperarInterrompidos(iniciarTrabalho(filaCom('normal', 'normal'), 't1', AGORA));
    expect(f.trabalhos[0]).toMatchObject({ situacao: 'aguardando', recomecos: 1 });
    expect(proximoTrabalho(f)?.id).toBe('t1');
    const semNada = filaCom('normal');
    expect(recuperarInterrompidos(semNada)).toBe(semNada);
  });

  it('remover: não o que está calculando; limpar tira só os terminados', () => {
    let f = iniciarTrabalho(filaCom('normal', 'normal', 'normal'), 't1', AGORA);
    expect(removerTrabalho(f, 't1')).toBe(f);
    expect(removerTrabalho(f, 't2').trabalhos.map((t) => t.id)).toEqual(['t1', 't3']);
    f = cancelarTrabalho(concluirTrabalho(f, 't1', resultado(70), AGORA), 't3', AGORA);
    expect(removerTerminados(f).trabalhos.map((t) => t.id)).toEqual(['t2']);
  });
});

describe('a fila de encaixes — resultados e relatório', () => {
  it('concluir guarda o resultado; aplicar marca a hora; a contagem e os concluídos por aplicar', () => {
    let f = concluir(filaCom('normal', 'normal'), 't1', resultado(82.5));
    expect(f.trabalhos[0]).toMatchObject({ situacao: 'concluido', terminadoEmIso: '2026-10-24T10:05:00.000Z' });
    expect(concluidosSemAplicar(f)).toBe(1);
    f = marcarAplicado(f, 't1', AGORA);
    expect(f.trabalhos[0]!.aplicadoEmIso).toBe(AGORA);
    expect(concluidosSemAplicar(f)).toBe(0);
    expect(contagemDaFila(f)).toMatchObject({ concluido: 1, aguardando: 1, executando: 0 });
  });

  it('o melhor de cada projeto: todas as peças postas antes do aproveitamento; o mais curto no empate', () => {
    let f = [dados('p1'), dados('p1'), dados('p1'), dados('p2')].reduce((x, d, i) => adicionarTrabalho(x, d, `t${i + 1}`, AGORA), FILA_VAZIA);
    f = concluir(f, 't1', resultado(90, 1));
    f = concluir(f, 't2', resultado(80, 0, 1200));
    f = concluir(f, 't3', resultado(80, 0, 1100));
    f = concluir(f, 't4', resultado(70));
    // p2 só tem um concluído: nada a comparar.
    expect([...melhoresPorProjeto(f)]).toEqual(['t3']);
  });

  it('o relatório: concluídos, média e melhor aproveitamento, comprimento e tempo', () => {
    let f = filaCom('normal', 'normal', 'normal');
    f = concluir(f, 't1', resultado(80, 0, 1000));
    f = concluir(f, 't2', resultado(70, 2, 1500));
    f = falharTrabalho(iniciarTrabalho(f, 't3', AGORA), 't3', 'erro', AGORA);
    expect(relatorioDaFila(f)).toEqual({
      concluidos: 2,
      comPecasDeFora: 1,
      falharam: 1,
      aproveitamentoMedio: 75,
      melhorAproveitamento: 80,
      comprimentoTotalMm: 2500,
      tempoTotalMs: 5000,
      tempoMedioMs: 2500,
    });
    expect(relatorioDaFila(FILA_VAZIA).aproveitamentoMedio).toBeNull();
  });

  it('as opções em palavras', () => {
    expect(descricaoDasOpcoes({ metodo: 'grade' })).toBe('Busca em grade');
    expect(descricaoDasOpcoes({ metodo: 'pontos-de-canto', limiteDeTempoMs: 90_000, aproveitamentoDesejadoPercentual: 85, todosOsTamanhos: true, abrirSimetrias: true, tecidoDeSentidoUnico: true })).toBe(
      'Pontos de canto · até 1,5 min · meta de 85,0% · todos os tamanhos · simetrias abertas · tecido de sentido único',
    );
  });

  it('o CSV: ponto e vírgula, vírgula decimal, uma linha por trabalho', () => {
    const f = concluir(filaCom('alta', 'normal'), 't1', resultado(81.25, 1, 1234.6));
    const linhas = csvDaFila(f).trim().split('\r\n');
    expect(linhas).toHaveLength(3);
    expect(linhas[0]!.startsWith('Projeto;Código;Situação;Prioridade;Opções;Cópias de peça;Peças colocadas;Peças de fora;Comprimento (m);Aproveitamento (%)')).toBe(true);
    // O concluído vem depois do que aguarda (os terminados ficam por último).
    expect(linhas[1]!.split(';').slice(0, 4)).toEqual(['Projeto p1', 'C-p1', 'Aguardando', 'Normal']);
    expect(linhas[2]!.split(';').slice(0, 11)).toEqual(['Projeto p1', 'C-p1', 'Concluído', 'Alta', 'Busca em grade', '2', '1', '1', '1,235', '81,3', '2,5']);
  });
});

describe('a fila de encaixes — o arquivo', () => {
  it('sem arquivo, a fila vazia; o que não é fila, vazia com o aviso', () => {
    expect(lerFilaDeEncaixes(null)).toEqual({ fila: FILA_VAZIA, descartados: [], maisNovo: false });
    expect(lerFilaDeEncaixes({ versaoDoFormato: 2, trabalhos: [] }).maisNovo).toBe(true);
    expect(lerFilaDeEncaixes({ arquivoIlegivel: 'x' }).descartados).toHaveLength(1);
  });

  it('ida e volta pelo JSON; o trabalho quebrado fica de fora com o motivo', () => {
    const f = pausarAFila(concluir(filaCom('normal', 'baixa'), 't1', resultado(75)), true);
    const bruto = JSON.parse(JSON.stringify(f)) as { trabalhos: unknown[] };
    bruto.trabalhos.push({ id: 'x', situacao: 'inventada' }, 'texto');
    const lida = lerFilaDeEncaixes(bruto);
    expect(lida.fila).toEqual(f);
    expect(lida.descartados).toEqual([
      'O encaixe 3 da fila ficou de fora: sem projetoId, projetoNome, projetoCodigo, impressaoDasPecas, criadoEmIso.',
      'O encaixe 4 da fila ficou de fora: não é um trabalho.',
    ]);
  });

  it('um concluído sem o resultado, ou com o resultado quebrado, não entra', () => {
    const f = concluir(filaCom('normal', 'normal'), 't1', resultado(75));
    const semResultado = { ...f, trabalhos: [{ ...f.trabalhos[0]!, resultado: undefined }, { ...f.trabalhos[1]!, resultado: { pecasColocadas: 3 } }] };
    expect(lerFilaDeEncaixes(JSON.parse(JSON.stringify(semResultado))).descartados).toEqual([
      'O encaixe 1 da fila ficou de fora: concluído sem o resultado.',
      'O encaixe 2 da fila ficou de fora: com o resultado quebrado.',
    ]);
  });

  it('o trabalho guardado calcula o mesmo encaixe que as peças de origem', () => {
    const f = lerFilaDeEncaixes(JSON.parse(JSON.stringify(filaCom('normal')))).fila;
    const t = f.trabalhos[0]!;
    const daFila = executarNestingAutomatico(t.pecas, t.enfesto, { agora: () => 0 });
    const direto = executarNestingAutomatico([PECA], ENFESTO, { agora: () => 0 });
    expect(daFila).toEqual(direto);
    expect(daFila.pecasColocadas).toHaveLength(2);
  });
});

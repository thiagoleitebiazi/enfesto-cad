import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ponto } from '../core/geometria';
import { criarMolde } from '../domain/molde';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from '../domain/enfesto';
import type { ResultadoDeNesting } from '../domain/nesting';
import { adicionarTrabalho, cancelarTrabalho, FILA_VAZIA, iniciarTrabalho, pausarAFila, pausarTrabalho, type DadosDoTrabalho, type FilaDeEncaixes } from '../domain/filaDeEncaixes';
import type { MensagemParaWorker } from '../nesting.worker';
import { useFilaDeEncaixes, type ApiDaFila, type WorkerDoEncaixe } from './useFilaDeEncaixes';

const ENFESTO = criarConfiguracaoDeEnfesto({
  tipo: 'impar',
  larguraUtilMm: 1000,
  comprimentoMm: 3000,
  quantidadeDeCamadas: 1,
  margemLateralMm: 0,
  margemDeExtremidadeMm: 0,
  distanciaMinimaEntrePecasMm: 5,
} as ConfiguracaoDeEnfesto);
const PECA = criarMolde({ nome: 'Costas', referencia: '', tamanho: 'G', quantidade: 3, contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)], linhaDeFio: { inicio: ponto(100, 20), fim: ponto(100, 280) } }, 'costas');

const dados = (projetoId: string, extras: Partial<DadosDoTrabalho> = {}): DadosDoTrabalho => ({
  projetoId,
  projetoNome: projetoId,
  projetoCodigo: projetoId,
  impressaoDasPecas: 'x',
  prioridade: 'normal',
  pecas: [PECA],
  enfesto: ENFESTO,
  opcoes: { metodo: 'grade' },
  ...extras,
});

const RESULTADO: ResultadoDeNesting = {
  pecasColocadas: [],
  pecasNaoColocadas: [],
  comprimentoUtilizadoMm: 900,
  areaOcupadaMm2: 180_000,
  aproveitamentoPercentual: 66.7,
  tempoDeProcessamentoMs: 40,
  interrompido: false,
  paradaPorTempoLimite: false,
  paradaPorMetaDeAproveitamento: false,
};

/** Um Worker de mentira: guarda o que recebeu e responde quando o teste manda. */
class WorkerFalso implements WorkerDoEncaixe {
  onmessage: ((evento: MessageEvent) => void) | null = null;
  onerror: ((evento: ErrorEvent) => void) | null = null;
  readonly recebidas: MensagemParaWorker[] = [];
  terminado = false;
  postMessage(mensagem: MensagemParaWorker): void {
    this.recebidas.push(mensagem);
  }
  terminate(): void {
    this.terminado = true;
  }
  responder(dados: unknown): void {
    act(() => this.onmessage?.({ data: dados } as MessageEvent));
  }
}

function montar(inicial: unknown) {
  const workers: WorkerFalso[] = [];
  const gravadas: FilaDeEncaixes[] = [];
  const api: ApiDaFila = {
    lerFilaDeEncaixes: vi.fn(async () => inicial),
    gravarFilaDeEncaixes: vi.fn(async (f: unknown) => {
      gravadas.push(f as FilaDeEncaixes);
      return true;
    }),
  };
  const criarWorker = (): WorkerDoEncaixe => {
    const w = new WorkerFalso();
    workers.push(w);
    return w;
  };
  const agora = (): string => '2026-10-24T12:00:00.000Z';
  const hook = renderHook(() => useFilaDeEncaixes(api, criarWorker, agora));
  return { hook, workers, gravadas, api };
}

const comDois = (): FilaDeEncaixes => adicionarTrabalho(adicionarTrabalho(FILA_VAZIA, dados('A'), 'a', 'x'), dados('B', { opcoes: { metodo: 'pontos-de-canto', limiteDeTempoMs: 60_000 } }), 'b', 'x');

describe('useFilaDeEncaixes — quem roda a fila', () => {
  it('lê a fila do disco e começa o primeiro da vez, mandando as peças, a mesa e as opções ao Worker', async () => {
    const { hook, workers } = montar(JSON.parse(JSON.stringify(comDois())));
    await waitFor(() => expect(hook.result.current.carregada).toBe(true));
    expect(workers).toHaveLength(1);
    expect(workers[0]!.recebidas[0]).toMatchObject({ tipo: 'iniciar', enfesto: ENFESTO });
    expect(workers[0]!.recebidas[0]).not.toHaveProperty('metodo');
    expect(hook.result.current.fila.trabalhos.find((t) => t.id === 'a')!.situacao).toBe('executando');
    expect(hook.result.current.progresso).toEqual({ id: 'a', colocadas: 0, total: 3 });
    workers[0]!.responder({ tipo: 'progresso', colocadas: 2, total: 3 });
    expect(hook.result.current.progresso).toEqual({ id: 'a', colocadas: 2, total: 3 });
  });

  it('concluído: guarda o resultado, grava, fecha o Worker e começa o próximo (com o método e o tempo dele)', async () => {
    const { hook, workers, gravadas } = montar(JSON.parse(JSON.stringify(comDois())));
    await waitFor(() => expect(workers).toHaveLength(1));
    workers[0]!.responder({ tipo: 'concluido', resultado: RESULTADO });
    expect(workers[0]!.terminado).toBe(true);
    const a = hook.result.current.fila.trabalhos.find((t) => t.id === 'a')!;
    expect(a).toMatchObject({ situacao: 'concluido', resultado: RESULTADO, terminadoEmIso: '2026-10-24T12:00:00.000Z' });
    expect(workers).toHaveLength(2);
    expect(workers[1]!.recebidas[0]).toMatchObject({ tipo: 'iniciar', metodo: 'pontos-de-canto', limiteDeTempoMs: 60_000 });
    expect(gravadas.some((f) => f.trabalhos.find((t) => t.id === 'a')?.situacao === 'concluido')).toBe(true);
  });

  it('o erro do cálculo marca "falhou" com o motivo, e a fila segue', async () => {
    const { hook, workers } = montar(JSON.parse(JSON.stringify(comDois())));
    await waitFor(() => expect(workers).toHaveLength(1));
    workers[0]!.responder({ tipo: 'erro', mensagem: 'peça inválida' });
    expect(hook.result.current.fila.trabalhos.find((t) => t.id === 'a')).toMatchObject({ situacao: 'falhou', erro: 'peça inválida' });
    expect(workers).toHaveLength(2);
  });

  it('pausar o que calcula fecha o Worker e passa ao próximo; a resposta atrasada do Worker fechado não conta', async () => {
    const { hook, workers } = montar(JSON.parse(JSON.stringify(comDois())));
    await waitFor(() => expect(workers).toHaveLength(1));
    act(() => hook.result.current.mudar((f) => pausarTrabalho(f, 'a')));
    expect(workers[0]!.terminado).toBe(true);
    expect(workers).toHaveLength(2);
    workers[0]!.responder({ tipo: 'concluido', resultado: RESULTADO });
    expect(hook.result.current.fila.trabalhos.find((t) => t.id === 'a')!.situacao).toBe('pausado');
    // Cancelar o segundo: nada mais a calcular.
    act(() => hook.result.current.mudar((f) => cancelarTrabalho(f, 'b', 'agora')));
    expect(workers[1]!.terminado).toBe(true);
    expect(workers).toHaveLength(2);
  });

  it('a fila pausada não começa nada; retomada, começa', async () => {
    const { hook, workers } = montar(JSON.parse(JSON.stringify(pausarAFila(comDois(), true))));
    await waitFor(() => expect(hook.result.current.carregada).toBe(true));
    expect(workers).toHaveLength(0);
    act(() => hook.result.current.mudar((f) => pausarAFila(f, false)));
    expect(workers).toHaveLength(1);
  });

  it('o que calculava quando o programa fechou recomeça ao abrir (e a fila corrigida é gravada)', async () => {
    const { hook, workers, gravadas } = montar(JSON.parse(JSON.stringify(pausarAFila(iniciarTrabalho(comDois(), 'b', 'x'), true))));
    await waitFor(() => expect(hook.result.current.carregada).toBe(true));
    expect(hook.result.current.fila.trabalhos.find((t) => t.id === 'b')).toMatchObject({ situacao: 'aguardando', recomecos: 1 });
    expect(gravadas).toHaveLength(1);
    expect(workers).toHaveLength(0);
  });

  it('o arquivo quebrado: a fila vazia com o aviso; o de versão mais nova aparece e não é gravado', async () => {
    const quebrado = montar({ arquivoIlegivel: 'fila-de-encaixes.json' });
    await waitFor(() => expect(quebrado.hook.result.current.carregada).toBe(true));
    expect(quebrado.hook.result.current.avisos[0]).toMatch(/está quebrado/);
    expect(quebrado.hook.result.current.fila.trabalhos).toHaveLength(0);

    const novo = montar({ ...JSON.parse(JSON.stringify(pausarAFila(comDois(), true))), versaoDoFormato: 9 });
    await waitFor(() => expect(novo.hook.result.current.carregada).toBe(true));
    expect(novo.hook.result.current.somenteLeitura).toBe(true);
    act(() => novo.hook.result.current.mudar((f) => pausarAFila(f, false)));
    expect(novo.gravadas).toHaveLength(0);
  });

  it('a recusa da mudança chega a quem pediu; antes de ler o disco, nenhuma mudança', async () => {
    const { hook } = montar(null);
    expect(() => hook.result.current.mudar((f) => f)).toThrow(/sendo lida/);
    await waitFor(() => expect(hook.result.current.carregada).toBe(true));
    expect(() =>
      act(() =>
        hook.result.current.mudar((f) => adicionarTrabalho(f, dados('A', { pecas: [] }), 'z', 'x')),
      ),
    ).toThrow(/Não há peças/);
  });
});

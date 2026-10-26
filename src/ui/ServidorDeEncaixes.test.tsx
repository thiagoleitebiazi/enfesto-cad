import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ponto } from '../core/geometria';
import { criarMolde } from '../domain/molde';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from '../domain/enfesto';
import type { ResultadoDeNesting } from '../domain/nesting';
import { adicionarTrabalho, FILA_VAZIA } from '../domain/filaDeEncaixes';
import { pedidoDoTrabalho } from '../domain/filaNaRede';
import type { AcessoAPasta } from '../domain/pastaCompartilhada';
import type { WorkerDoEncaixe } from './useFilaDeEncaixes';
import { ServidorDeEncaixes, type ApiDoServidor } from './ServidorDeEncaixes';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const PECA = criarMolde(
  { nome: 'Frente', referencia: '', tamanho: 'M', contorno: [ponto(0, 0), ponto(300, 0), ponto(300, 400), ponto(0, 400)], linhaDeFio: { inicio: ponto(150, 50), fim: ponto(150, 350) } },
  'frente',
);
const ENFESTO: ConfiguracaoDeEnfesto = criarConfiguracaoDeEnfesto({
  tipo: 'impar',
  larguraUtilMm: 1000,
  comprimentoMm: 3000,
  quantidadeDeCamadas: 1,
  margemLateralMm: 0,
  margemDeExtremidadeMm: 0,
  distanciaMinimaEntrePecasMm: 5,
} as ConfiguracaoDeEnfesto);
const RESULTADO: ResultadoDeNesting = {
  pecasColocadas: [{ idOriginal: 'frente', indiceCopia: 0, molde: PECA }],
  pecasNaoColocadas: [],
  comprimentoUtilizadoMm: 400,
  areaOcupadaMm2: 120_000,
  aproveitamentoPercentual: 30,
  tempoDeProcessamentoMs: 100,
  interrompido: false,
  paradaPorTempoLimite: false,
  paradaPorMetaDeAproveitamento: false,
};

/** O cálculo de mentira: conclui logo depois de começar. */
function workerDeMentira(): WorkerDoEncaixe {
  const w: WorkerDoEncaixe = {
    onmessage: null,
    onerror: null,
    postMessage: () => setTimeout(() => w.onmessage?.({ data: { tipo: 'concluido', resultado: RESULTADO } } as MessageEvent), 5),
    terminate: () => {},
  };
  return w;
}

function pastaComUmPedido(): AcessoAPasta & { readonly pastas: Map<string, Map<string, string>> } {
  const pastas = new Map<string, Map<string, string>>(['pedidos', 'calculando', 'prontos'].map((s) => [s, new Map()]));
  const trabalho = adicionarTrabalho(FILA_VAZIA, { projetoId: 'p1', projetoNome: 'Saia', projetoCodigo: 'C-1', impressaoDasPecas: 'x', prioridade: 'normal', pecas: [PECA], enfesto: ENFESTO, opcoes: { metodo: 'grade' } }, 't1', '2026-10-26T10:00:00.000Z').trabalhos[0]!;
  pastas.get('pedidos')!.set('t1.json', JSON.stringify(pedidoDoTrabalho(trabalho, 'Estação 1', '2026-10-26T10:00:00.000Z')));
  return {
    pastas,
    onde: async () => 'Z:\\fila',
    escolher: async () => 'Z:\\fila',
    esquecer: async () => true,
    listar: async (sub) => [...pastas.get(sub)!.keys()].map((nome) => ({ nome })),
    ler: async (sub, nome) => pastas.get(sub)!.get(nome) ?? null,
    gravar: async (sub, nome, texto) => {
      pastas.get(sub)!.set(nome, texto);
      return true;
    },
    mover: async (de, nome, para, novoNome) => {
      const texto = pastas.get(de)!.get(nome);
      if (texto === undefined || pastas.get(para)!.has(novoNome)) return false;
      pastas.get(de)!.delete(nome);
      pastas.get(para)!.set(novoNome, texto);
      return true;
    },
    criarSeNaoExiste: async () => false,
    apagar: async (sub, nome) => pastas.get(sub)!.delete(nome),
  };
}

function apiDeMentira(): ApiDoServidor & { gravada: unknown } {
  let aoLigar = false;
  const api = {
    gravada: null as unknown,
    lerFilaDoServidor: async () => null,
    gravarFilaDoServidor: async (f: unknown) => {
      api.gravada = f;
      return true;
    },
    servidorAoLigar: async () => aoLigar,
    mudarServidorAoLigar: vi.fn(async (ligar: boolean) => {
      aoLigar = ligar;
      return aoLigar;
    }),
  };
  return api;
}

describe('o servidor de encaixes (ADR 0147)', () => {
  it('atende sempre: pega o pedido da pasta, calcula na fila dele, devolve o resultado e conta', async () => {
    const pasta = pastaComUmPedido();
    const api = apiDeMentira();
    render(<ServidorDeEncaixes api={api} pasta={pasta} criarWorker={workerDeMentira} intervaloMs={20} />);
    expect(await screen.findByText('Atendendo a fila da rede')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Nome desta estação'), { target: { value: 'Servidor do corte' } });
    await waitFor(() => expect(pasta.pastas.get('prontos')!.size).toBe(1), { timeout: 3000 });
    const pronto = JSON.parse(pasta.pastas.get('prontos')!.get('t1.json')!);
    expect(pronto).toMatchObject({ id: 't1', calculadoPor: 'Servidor do corte' });
    expect(pronto.resultado.pecasColocadas).toHaveLength(1);
    await waitFor(() => expect(screen.getByText('Calculados desde que abriu').nextElementSibling).toHaveTextContent('1'));
    expect(pasta.pastas.get('pedidos')!.size + pasta.pastas.get('calculando')!.size).toBe(0);
    // A fila dele fica num arquivo à parte, e sai vazia (o pedido devolvido sai dela).
    await waitFor(() => expect((api.gravada as { trabalhos: unknown[] }).trabalhos).toEqual([]));
    expect(screen.getByText(/Devolvido a Estação 1: “Saia” \(calculado\)/)).toBeInTheDocument();
  });

  it('abrir ao entrar no Windows: a caixa mostra o que o sistema diz e muda pelo programa', async () => {
    const api = apiDeMentira();
    render(<ServidorDeEncaixes api={api} pasta={null} criarWorker={workerDeMentira} intervaloMs={20} />);
    expect(screen.getByRole('status')).toHaveTextContent('Sem a pasta da fila: escolha a pasta');
    const caixa = await screen.findByLabelText('Abrir este servidor ao entrar no Windows');
    expect(caixa).not.toBeChecked();
    fireEvent.click(caixa);
    await waitFor(() => expect(caixa).toBeChecked());
    expect(api.mudarServidorAoLigar).toHaveBeenCalledWith(true);
  });

  it('num sistema que não deixa (null), a caixa não aparece', async () => {
    const api = { ...apiDeMentira(), servidorAoLigar: async () => null };
    render(<ServidorDeEncaixes api={api} pasta={null} criarWorker={workerDeMentira} intervaloMs={20} />);
    await waitFor(() => expect(screen.getByText('Servidor de encaixes')).toBeInTheDocument());
    expect(screen.queryByLabelText('Abrir este servidor ao entrar no Windows')).toBeNull();
  });
});

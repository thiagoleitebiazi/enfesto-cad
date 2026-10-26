import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { ponto } from '../core/geometria';
import { criarMolde } from '../domain/molde';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from '../domain/enfesto';
import type { ResultadoDeNesting } from '../domain/nesting';
import { adicionarTrabalho, concluirTrabalho, FILA_VAZIA, iniciarTrabalho, pausarAFila, type FilaDeEncaixes } from '../domain/filaDeEncaixes';
import type { AcessoAPasta } from '../domain/pastaCompartilhada';
import type { FilaNaTela } from './useFilaDeEncaixes';
import { useFilaNaRede } from './useFilaNaRede';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

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
  { nome: 'Frente', referencia: '', tamanho: 'M', contorno: [ponto(0, 0), ponto(300, 0), ponto(300, 400), ponto(0, 400)], linhaDeFio: { inicio: ponto(150, 50), fim: ponto(150, 350) } },
  'frente',
);
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
const AGORA = '2026-10-26T10:00:00.000Z';

/** Uma pasta da rede na memória, já escolhida, que as duas estações usam. */
function pastaNaMemoria(): AcessoAPasta & { readonly pastas: Map<string, Map<string, string>> } {
  const pastas = new Map<string, Map<string, string>>(['pedidos', 'calculando', 'prontos'].map((s) => [s, new Map()]));
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

/** Uma estação: a fila dela (sem quem calcula: o teste conclui à mão) e o vigia da rede. */
function useEstacao(pasta: AcessoAPasta, inicial: FilaDeEncaixes) {
  const [fila, setFila] = useState(inicial);
  const ref = useRef(inicial);
  const naTela: FilaNaTela = {
    fila,
    carregada: true,
    progresso: null,
    avisos: [],
    somenteLeitura: false,
    mudar: (mudanca) => {
      ref.current = mudanca(ref.current);
      setFila(ref.current);
    },
  };
  const rede = useFilaNaRede(pasta, naTela, 20, () => AGORA);
  return { fila, mudar: naTela.mudar, rede };
}

describe('a fila na rede entre duas estações (ADR 0143)', () => {
  it('a estação 1 manda; a 2, atendendo, pega, calcula e devolve; o encaixe termina na fila da 1, com quem calculou', async () => {
    const pasta = pastaNaMemoria();
    // A fila da 1 pausada: o encaixe espera a vez, e vai para a rede antes de ser calculado aqui.
    const um = renderHook(() => useEstacao(pasta, pausarAFila(adicionarTrabalho(FILA_VAZIA, { projetoId: 'p1', projetoNome: 'Saia', projetoCodigo: 'C-1', impressaoDasPecas: 'x', prioridade: 'normal', pecas: [PECA], enfesto: ENFESTO, opcoes: { metodo: 'grade' } }, 't1', AGORA), true)));
    const dois = renderHook(() => useEstacao(pasta, FILA_VAZIA));
    await waitFor(() => expect(um.result.current.rede.onde).toBe('Z:\\fila'));

    // Sem nome, não manda.
    await act(() => um.result.current.rede.mandar('t1'));
    expect(um.result.current.rede.mensagem).toMatch(/nome desta estação/);
    act(() => um.result.current.rede.mudarQuem('Estação 1'));
    await act(() => um.result.current.rede.mandar('t1'));
    expect(um.result.current.fila.trabalhos[0]!.situacao).toBe('na-rede');
    expect([...pasta.pastas.get('pedidos')!.keys()]).toEqual(['t1.json']);

    // A 2 passa a atender: o pedido entra na fila dela.
    act(() => {
      dois.result.current.rede.mudarQuem('Estação 2');
      dois.result.current.rede.mudarAtender(true);
    });
    await waitFor(() => expect(dois.result.current.fila.trabalhos.map((t) => t.id)).toEqual(['rede-t1']));
    expect(dois.result.current.fila.trabalhos[0]!.pedidoDaRede).toEqual({ id: 't1', pedidoPor: 'Estação 1' });
    expect([...pasta.pastas.get('calculando')!.keys()]).toEqual(['t1.json']);

    // A 2 calcula (aqui, à mão): o resultado volta para a pasta e o trabalho sai da fila dela.
    act(() => dois.result.current.mudar((f) => concluirTrabalho(iniciarTrabalho(f, 'rede-t1', AGORA), 'rede-t1', RESULTADO, AGORA)));
    await waitFor(() => expect(dois.result.current.fila.trabalhos).toEqual([]));

    // A 1 recebe: concluído, com o encaixe e quem calculou; a pasta fica vazia.
    await waitFor(() => expect(um.result.current.fila.trabalhos[0]!.situacao).toBe('concluido'));
    expect(um.result.current.fila.trabalhos[0]).toMatchObject({ calculadoPor: 'Estação 2', resultado: RESULTADO });
    expect([...pasta.pastas.values()].every((m) => m.size === 0)).toBe(true);
  });

  it('trazer de volta antes de alguém levar: o pedido sai da pasta, e o encaixe espera a vez aqui', async () => {
    const pasta = pastaNaMemoria();
    window.localStorage.setItem('enfesto-cad:nome-na-rede', 'Estação 1');
    const um = renderHook(() => useEstacao(pasta, pausarAFila(adicionarTrabalho(FILA_VAZIA, { projetoId: 'p1', projetoNome: 'Saia', projetoCodigo: 'C-1', impressaoDasPecas: 'x', prioridade: 'normal', pecas: [PECA], enfesto: ENFESTO, opcoes: { metodo: 'grade' } }, 't1', AGORA), true)));
    await waitFor(() => expect(um.result.current.rede.onde).toBe('Z:\\fila'));
    await act(() => um.result.current.rede.mandar('t1'));
    await act(() => um.result.current.rede.trazerDeVolta('t1'));
    expect(um.result.current.fila.trabalhos[0]!.situacao).toBe('aguardando');
    expect(pasta.pastas.get('pedidos')!.size).toBe(0);
    expect(um.result.current.rede.mensagem).toMatch(/o pedido saiu da pasta/);
  });
});

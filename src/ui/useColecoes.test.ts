import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { COLECOES_VAZIAS, novaColecao, salvarColecao } from '../domain/colecoes';
import { useColecoes, type ApiDasColecoes } from './useColecoes';

const COM_UMA = salvarColecao(COLECOES_VAZIAS, novaColecao({ nome: 'Verão 27', estacao: 'primavera-verao', ano: 2027 }, 'c1', '2026-10-24T10:00:00.000Z'));

function api(lido: unknown, gravar: ApiDasColecoes['gravarColecoes'] = vi.fn(async () => true)): ApiDasColecoes {
  return { lerColecoes: vi.fn(async () => lido), gravarColecoes: gravar };
}

describe('useColecoes', () => {
  it('lê do disco ao abrir; grava a mudança e passa a mostrá-la', async () => {
    const gravar = vi.fn(async () => true);
    const a = api(JSON.parse(JSON.stringify(COM_UMA)), gravar);
    const { result } = renderHook(() => useColecoes(a));
    await waitFor(() => expect(result.current.carregadas).toBe(true));
    expect(result.current.arquivo).toEqual(COM_UMA);
    let erro: string | null = 'x';
    await act(async () => {
      erro = await result.current.mudar(COLECOES_VAZIAS);
    });
    expect(erro).toBeNull();
    expect(gravar).toHaveBeenCalledWith(COLECOES_VAZIAS);
    expect(result.current.arquivo).toEqual(COLECOES_VAZIAS);
  });

  it('a gravação que falha devolve o motivo e não muda a tela', async () => {
    const a = api(null, vi.fn(async () => Promise.reject(new Error('disco cheio'))));
    const { result } = renderHook(() => useColecoes(a));
    await waitFor(() => expect(result.current.carregadas).toBe(true));
    let erro: string | null = null;
    await act(async () => {
      erro = await result.current.mudar(COM_UMA);
    });
    expect(erro).toBe('As coleções não foram gravadas: disco cheio');
    expect(result.current.arquivo).toEqual(COLECOES_VAZIAS);
  });

  it('o arquivo quebrado: vazio com o aviso; o recuperado: o conteúdo com o aviso; o de versão mais nova não grava', async () => {
    const apiQuebrada = api({ arquivoIlegivel: 'colecoes.json' });
    const quebrado = renderHook(() => useColecoes(apiQuebrada));
    await waitFor(() => expect(quebrado.result.current.carregadas).toBe(true));
    expect(quebrado.result.current.avisos[0]).toMatch(/está quebrado/);
    const apiRecuperada = api({ recuperadoDaVersaoAnterior: 'ilegivel', conteudo: JSON.parse(JSON.stringify(COM_UMA)) });
    const recuperado = renderHook(() => useColecoes(apiRecuperada));
    await waitFor(() => expect(recuperado.result.current.carregadas).toBe(true));
    expect(recuperado.result.current.arquivo.colecoes).toHaveLength(1);
    expect(recuperado.result.current.avisos[0]).toMatch(/versão anterior/);
    const gravar = vi.fn(async () => true);
    const apiNova = api({ versaoDoFormato: 9, colecoes: [] }, gravar);
    const novo = renderHook(() => useColecoes(apiNova));
    await waitFor(() => expect(novo.result.current.carregadas).toBe(true));
    let erro: string | null = null;
    await act(async () => {
      erro = await novo.result.current.mudar(COM_UMA);
    });
    expect(erro).toMatch(/versão mais nova/);
    expect(gravar).not.toHaveBeenCalled();
  });
});

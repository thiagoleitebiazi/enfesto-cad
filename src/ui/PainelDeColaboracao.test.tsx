import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PedidoAoServidor, ProjetoCompartilhado } from '../domain/colaboracao';
import { PainelDeColaboracao, type ApiDaColaboracao, type EstadoDaColaboracao } from './PainelDeColaboracao';

afterEach(cleanup);

const projeto: ProjetoCompartilhado = { id: 'p1', nome: 'Camisa', codigo: 'C1', estado: { pecas: [], tecido: null, enfesto: null } };

const LIGADO: EstadoDaColaboracao = { url: 'http://servidor:8931', nome: 'Ana', conectado: true, servidor: null };

const pedirBasico: PedidoAoServidor = async (metodo, caminho) => {
  if (caminho === '/projetos') return { status: 200, corpo: { projetos: [{ id: 'p1', nome: 'Camisa', codigo: 'C1', versao: 3, autor: 'Bia', aprovacao: null }] } };
  if (metodo === 'GET') return { status: 200, corpo: { versao: 3, projeto, comentarios: [{ id: 1, autor: 'Bia', texto: 'Subir a cava' }], aprovacao: { situacao: 'aprovado', autor: 'Chefe', nota: 'ok' }, presentes: ['Bia'] } };
  return { status: 200, corpo: { versao: 4 } };
};

const abrir = (estado: EstadoDaColaboracao, pedir: PedidoAoServidor = pedirBasico, api: Partial<ApiDaColaboracao> = {}) => {
  const acoes = { onVersao: vi.fn(), onEstado: vi.fn(), onBaixar: vi.fn(), onFechar: vi.fn() };
  const completa: ApiDaColaboracao = { estado: async () => estado, conectar: async () => null, pedir, servir: async () => null, ...api };
  render(<PainelDeColaboracao api={completa} projeto={projeto} versaoBase={3} {...acoes} />);
  return acoes;
};

describe('o painel de colaboração (ADR 0214)', () => {
  it('sem conexão, pede o endereço e a chave, e não mostra os projetos', async () => {
    const conectar = vi.fn(async () => 'O endereço não vale.');
    abrir({ url: '', nome: '', conectado: false, servidor: null }, pedirBasico, { conectar });
    fireEvent.change(screen.getByLabelText('Endereço'), { target: { value: 'x' } });
    fireEvent.click(screen.getByRole('button', { name: 'Ligar' }));
    await screen.findByText('O endereço não vale.');
    expect(conectar).toHaveBeenCalledWith('x', '', '');
    expect(screen.queryByText('Projetos no servidor')).toBeNull();
  });

  it('ligado, mostra a versão, quem está aqui, a aprovação e os comentários', async () => {
    abrir(LIGADO);
    await screen.findByText(/versão 3 no servidor/);
    expect(screen.getByText('Neste projeto agora: Bia')).toBeTruthy();
    expect(screen.getByText('Aprovado por Chefe: ok')).toBeTruthy();
    expect(screen.getByText('Subir a cava')).toBeTruthy();
  });

  it('enviar grava a versão nova', async () => {
    const acoes = abrir(LIGADO);
    await screen.findByText(/versão 3 no servidor/);
    fireEvent.click(screen.getByRole('button', { name: 'Enviar este projeto' }));
    await screen.findByText('Versão 4 enviada.');
    expect(acoes.onVersao).toHaveBeenCalledWith('p1', 4);
    expect(acoes.onEstado).toHaveBeenCalled();
  });

  it('o que mudou dos dois lados é dito', async () => {
    const acoes = abrir(LIGADO, async (metodo, caminho) => {
      if (metodo === 'PUT') return { status: 200, corpo: { versao: 4 } };
      return pedirBasico(metodo, caminho);
    });
    await screen.findByText(/versão 3 no servidor/);
    fireEvent.click(screen.getByRole('button', { name: 'Atualizar com o servidor' }));
    await screen.findByText('Atualizado com a versão 3.');
    expect(acoes.onVersao).toHaveBeenCalledWith('p1', 3);
  });

  it('baixar leva o projeto para a biblioteca', async () => {
    const acoes = abrir(LIGADO);
    fireEvent.click(await screen.findByRole('button', { name: 'Baixar Camisa' }));
    await waitFor(() => expect(acoes.onBaixar).toHaveBeenCalled());
    expect(acoes.onBaixar.mock.calls[0]![0]).toMatchObject({ id: 'p1', nome: 'Camisa' });
    expect(acoes.onBaixar.mock.calls[0]![1]).toBe(3);
  });

  it('comentar e aprovar vão com o nome de quem está', async () => {
    const pedir = vi.fn(pedirBasico);
    abrir(LIGADO, pedir);
    await screen.findByText(/versão 3 no servidor/);
    fireEvent.change(screen.getByLabelText('Novo comentário'), { target: { value: 'Feito' } });
    fireEvent.click(screen.getByRole('button', { name: 'Comentar' }));
    await waitFor(() => expect(pedir).toHaveBeenCalledWith('POST', '/projetos/p1/comentarios', { autor: 'Ana', texto: 'Feito' }));
    fireEvent.click(screen.getByRole('button', { name: 'Reprovar' }));
    await waitFor(() => expect(pedir).toHaveBeenCalledWith('POST', '/projetos/p1/aprovacao', { autor: 'Ana', situacao: 'reprovado', nota: '' }));
  });

  it('a chave errada é dita', async () => {
    abrir(LIGADO, async () => ({ status: 401, corpo: {} }));
    await screen.findByText('O servidor não aceitou a chave.');
  });

  it('o servidor fora do ar é dito', async () => {
    abrir(LIGADO, async () => {
      throw new Error('fetch failed');
    });
    await screen.findByText('fetch failed');
  });

  it('liga o servidor neste computador, e mostra o endereço e a chave', async () => {
    let estado: EstadoDaColaboracao = { url: '', nome: '', conectado: false, servidor: null };
    const servir = vi.fn(async () => {
      const servidor = { porta: 8931, chave: 'abc', enderecos: ['http://192.168.0.5:8931'] };
      estado = { ...estado, servidor };
      return servidor;
    });
    abrir(estado, pedirBasico, { servir, estado: async () => estado });
    fireEvent.click(await screen.findByRole('button', { name: 'Ligar o servidor' }));
    await screen.findByText('abc');
    expect(servir).toHaveBeenCalledWith(8931);
    expect(screen.getByText('Endereços: http://192.168.0.5:8931')).toBeTruthy();
  });
});

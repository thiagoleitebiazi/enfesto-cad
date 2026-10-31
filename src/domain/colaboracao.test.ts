import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { atualizarDoServidor, enviarProjeto, fundirEstados, type PedidoAoServidor, type ProjetoCompartilhado } from './colaboracao';
import { criarMolde, type Molde } from './molde';
import type { EstadoDoProjeto } from './projeto';

const peca = (id: string, quantidade = 1): Molde => criarMolde({ nome: id, referencia: '', tamanho: 'M', quantidade, contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 200)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 180) }, restricaoDeRotacao: { permite180: true, permite90e270: false } }, id);

const estado = (...pecas: Molde[]): EstadoDoProjeto => ({ pecas, tecido: null, enfesto: null });
const ids = (e: EstadoDoProjeto): string[] => e.pecas.map((p) => `${p.id}${p.quantidade}`);

describe('juntar o que duas pessoas mudaram (ADR 0214)', () => {
  const base = estado(peca('a'), peca('b'));

  it('cada uma mudou uma peça: ficam as duas mudanças', () => {
    const r = fundirEstados(base, estado(peca('a', 2), peca('b')), estado(peca('a'), peca('b', 3)));
    expect(ids(r.estado)).toEqual(['a2', 'b3']);
    expect(r.conflitos).toEqual([]);
  });

  it('as duas mudaram a mesma peça do mesmo jeito: sem conflito', () => {
    const r = fundirEstados(base, estado(peca('a', 2), peca('b')), estado(peca('a', 2), peca('b')));
    expect(r.conflitos).toEqual([]);
  });

  it('as duas mudaram a mesma peça de jeitos diferentes: fica a do servidor, e diz', () => {
    const r = fundirEstados(base, estado(peca('a', 2), peca('b')), estado(peca('a', 3), peca('b')));
    expect(ids(r.estado)).toEqual(['a2', 'b1']);
    expect(r.conflitos).toEqual(['a']);
  });

  it('peças novas dos dois lados ficam', () => {
    const r = fundirEstados(base, estado(peca('a'), peca('b'), peca('c')), estado(peca('a'), peca('b'), peca('d')));
    expect(ids(r.estado)).toEqual(['a1', 'b1', 'c1', 'd1']);
  });

  it('a peça apagada de um lado sai, se o outro não mexeu', () => {
    expect(ids(fundirEstados(base, estado(peca('a')), base).estado)).toEqual(['a1']);
    expect(ids(fundirEstados(base, base, estado(peca('a'))).estado)).toEqual(['a1']);
  });

  it('apagada de um lado e mudada do outro: a peça fica, e diz', () => {
    expect(fundirEstados(base, estado(peca('a'), peca('b', 2)), estado(peca('a'))).conflitos).toEqual(['b']);
    const r = fundirEstados(base, estado(peca('a')), estado(peca('a'), peca('b', 2)));
    expect(ids(r.estado)).toEqual(['a1', 'b2']);
    expect(r.conflitos).toEqual(['b']);
  });

  it('o tecido segue a mesma regra', () => {
    const t1 = { id: 't1' } as unknown as EstadoDoProjeto['tecido'];
    const t2 = { id: 't2' } as unknown as EstadoDoProjeto['tecido'];
    expect(fundirEstados(base, base, { ...base, tecido: t1 }).estado.tecido).toBe(t1);
    expect(fundirEstados(base, { ...base, tecido: t1 }, base).estado.tecido).toBe(t1);
    const r = fundirEstados(base, { ...base, tecido: t1 }, { ...base, tecido: t2 });
    expect(r.estado.tecido).toBe(t1);
    expect(r.conflitos).toEqual(['o tecido']);
  });
});

describe('enviar ao servidor (ADR 0214)', () => {
  const projeto = (e: EstadoDoProjeto): ProjetoCompartilhado => ({ id: 'p', nome: 'P', codigo: 'C', estado: e });

  it('na versão certa, grava', async () => {
    const pedir: PedidoAoServidor = async () => ({ status: 200, corpo: { versao: 4 } });
    expect((await enviarProjeto(pedir, projeto(estado(peca('a'))), 3, 'Ana')).versao).toBe(4);
  });

  it('se o servidor andou, busca a base, junta e envia de novo', async () => {
    const base = estado(peca('a'), peca('b'));
    const enviados: { base: number; projeto: ProjetoCompartilhado }[] = [];
    const pedir: PedidoAoServidor = async (metodo, caminho, corpo) => {
      if (metodo === 'GET') {
        expect(caminho).toBe('/projetos/p/versoes/1');
        return { status: 200, corpo: { projeto: projeto(base) } };
      }
      enviados.push(corpo as { base: number; projeto: ProjetoCompartilhado });
      return enviados.length === 1 ? { status: 409, corpo: { versao: 2, projeto: projeto(estado(peca('a', 5), peca('b'))) } } : { status: 200, corpo: { versao: 3 } };
    };
    const r = await enviarProjeto(pedir, projeto(estado(peca('a'), peca('b', 7))), 1, 'Ana');
    expect(ids(r.estado)).toEqual(['a5', 'b7']);
    expect(enviados[1]!.base).toBe(2);
    expect(r.versao).toBe(3);
  });

  it('se o servidor não para de mudar, desiste e avisa', async () => {
    const pedir: PedidoAoServidor = async (metodo) => (metodo === 'PUT' ? { status: 409, corpo: { versao: 9, projeto: projeto(estado(peca('a', 2))) } } : { status: 404, corpo: {} });
    await expect(enviarProjeto(pedir, projeto(estado(peca('a'))), 1, 'Ana')).rejects.toThrow('tente de novo');
  });

  it('a base que já não existe: o que difere fica como no servidor, e diz', async () => {
    let enviou = 0;
    const pedir: PedidoAoServidor = async (metodo) => {
      if (metodo === 'GET') return { status: 404, corpo: {} };
      enviou += 1;
      return enviou === 1 ? { status: 409, corpo: { versao: 9, projeto: projeto(estado(peca('a', 2))) } } : { status: 200, corpo: { versao: 10 } };
    };
    const r = await enviarProjeto(pedir, projeto(estado(peca('a'), peca('n'))), 1, 'Ana');
    expect(ids(r.estado)).toEqual(['a2', 'n1']);
    expect(r.conflitos).toEqual(['a']);
  });

  it('o erro do servidor chega a quem enviou', async () => {
    const pedir: PedidoAoServidor = async () => ({ status: 401, corpo: { erro: 'Chave errada.' } });
    await expect(enviarProjeto(pedir, projeto(estado()), 0, 'Ana')).rejects.toThrow('Chave errada.');
  });

  it('atualizar traz o que há de novo, sem perder o que mudou aqui', async () => {
    const base = estado(peca('a'), peca('b'));
    const pedir: PedidoAoServidor = async (_m, caminho) => ({ status: 200, corpo: caminho.includes('versoes') ? { projeto: projeto(base) } : { versao: 8, projeto: projeto(estado(peca('a', 2), peca('b'))) } });
    const r = await atualizarDoServidor(pedir, projeto(estado(peca('a'), peca('b', 3))), 7);
    expect(ids(r.estado)).toEqual(['a2', 'b3']);
    expect(r.versao).toBe(8);
  });
});

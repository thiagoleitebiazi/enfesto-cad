// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { caminhoDoServidorValido, pedirAoServidor, urlDoServidorValida } from './conexaoDeColaboracao';
import { criarServidorDeColaboracao } from './servidorDeColaboracao';

const CHAVE = 'chave-de-teste';
let pasta: string;
let servidor: Server;
let url: string;
let agora: number;

interface Resposta {
  readonly versao: number;
  readonly projeto: { readonly nome: string };
  readonly projetos: readonly unknown[];
  readonly comentarios: readonly { readonly id: number; readonly autor: string; readonly pecaId?: string }[];
  readonly aprovacao: unknown;
  readonly presentes: readonly string[];
}

const pedir = async (metodo: string, caminho: string, corpo?: unknown, chave = CHAVE): Promise<{ status: number; corpo: Resposta }> => {
  const r = await fetch(`${url}${caminho}`, { method: metodo, headers: { Authorization: `Bearer ${chave}` }, ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}) });
  return { status: r.status, corpo: (await r.json()) as Resposta };
};

const projeto = (nome = 'Camisa') => ({ id: 'p1', nome, codigo: 'C1', estado: { pecas: [], tecido: null, enfesto: null } });

beforeEach(async () => {
  pasta = mkdtempSync(path.join(os.tmpdir(), 'colaboracao-'));
  agora = Date.parse('2026-10-31T12:00:00Z');
  servidor = criarServidorDeColaboracao({ pasta, chave: CHAVE, agora: () => new Date(agora) });
  await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

afterEach(async () => {
  await new Promise((r) => servidor.close(r));
  rmSync(pasta, { recursive: true, force: true });
});

describe('o servidor de colaboração (ADR 0214)', () => {
  it('sem a chave certa, nada', async () => {
    expect((await pedir('GET', '/projetos', undefined, 'errada')).status).toBe(401);
    const semChave = await fetch(`${url}/projetos`);
    expect(semChave.status).toBe(401);
  });

  it('guarda o projeto, e a versão sobe', async () => {
    expect((await pedir('PUT', '/projetos/p1', { base: 0, autor: 'Ana', projeto: projeto() })).corpo.versao).toBe(1);
    expect((await pedir('PUT', '/projetos/p1', { base: 1, autor: 'Bia', projeto: projeto('Camisa 2') })).corpo.versao).toBe(2);
    const lista = (await pedir('GET', '/projetos')).corpo.projetos;
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ id: 'p1', nome: 'Camisa 2', versao: 2, autor: 'Bia' });
    const r = await pedir('GET', '/projetos/p1');
    expect(r.corpo.projeto.nome).toBe('Camisa 2');
    expect((await pedir('GET', '/projetos/p1/versoes/1')).corpo.projeto.nome).toBe('Camisa');
  });

  it('quem envia de uma versão velha recebe a última, e nada se perde', async () => {
    await pedir('PUT', '/projetos/p1', { base: 0, autor: 'Ana', projeto: projeto() });
    await pedir('PUT', '/projetos/p1', { base: 1, autor: 'Bia', projeto: projeto('Da Bia') });
    const r = await pedir('PUT', '/projetos/p1', { base: 1, autor: 'Ana', projeto: projeto('Da Ana') });
    expect(r.status).toBe(409);
    expect(r.corpo).toMatchObject({ versao: 2, projeto: { nome: 'Da Bia' } });
    expect((await pedir('GET', '/projetos/p1')).corpo.versao).toBe(2);
  });

  it('dois envios ao mesmo tempo: um grava, o outro é avisado', async () => {
    await pedir('PUT', '/projetos/p1', { base: 0, autor: 'Ana', projeto: projeto() });
    const r = await Promise.all([pedir('PUT', '/projetos/p1', { base: 1, autor: 'Ana', projeto: projeto('A') }), pedir('PUT', '/projetos/p1', { base: 1, autor: 'Bia', projeto: projeto('B') })]);
    expect(r.map((x) => x.status).sort()).toEqual([200, 409]);
  });

  it('comentários, com a peça', async () => {
    await pedir('PUT', '/projetos/p1', { base: 0, autor: 'Ana', projeto: projeto() });
    expect((await pedir('POST', '/projetos/p1/comentarios', { autor: 'Bia', texto: 'Subir a cava', pecaId: 'frente' })).status).toBe(201);
    await pedir('POST', '/projetos/p1/comentarios', { autor: 'Ana', texto: 'Feito' });
    const { comentarios } = (await pedir('GET', '/projetos/p1')).corpo;
    expect(comentarios.map((c) => [c.id, c.autor])).toEqual([[1, 'Bia'], [2, 'Ana']]);
    expect(comentarios[0]!.pecaId).toBe('frente');
  });

  it('a aprovação vale até o molde mudar', async () => {
    await pedir('PUT', '/projetos/p1', { base: 0, autor: 'Ana', projeto: projeto() });
    await pedir('POST', '/projetos/p1/aprovacao', { autor: 'Chefe', situacao: 'aprovado', nota: 'ok' });
    expect((await pedir('GET', '/projetos/p1')).corpo.aprovacao).toMatchObject({ situacao: 'aprovado', autor: 'Chefe' });
    await pedir('PUT', '/projetos/p1', { base: 1, autor: 'Ana', projeto: projeto() });
    expect((await pedir('GET', '/projetos/p1')).corpo.aprovacao).toBeNull();
    expect((await pedir('POST', '/projetos/p1/aprovacao', { autor: 'Chefe', situacao: 'talvez' })).status).toBe(400);
  });

  it('quem está no projeto some depois de um minuto sem sinal', async () => {
    await pedir('PUT', '/projetos/p1', { base: 0, autor: 'Ana', projeto: projeto() });
    await pedir('POST', '/projetos/p1/presenca', { autor: 'Bia' });
    expect((await pedir('GET', '/projetos/p1')).corpo.presentes).toEqual(['Bia']);
    agora += 61_000;
    expect((await pedir('GET', '/projetos/p1')).corpo.presentes).toEqual([]);
  });

  it('recusa o que não é projeto, e o código com caminho', async () => {
    expect((await pedir('PUT', '/projetos/p1', { base: 0, autor: 'Ana' })).status).toBe(400);
    expect((await pedir('PUT', '/projetos/p1', { base: 0, projeto: projeto() })).status).toBe(400);
    expect((await pedir('GET', '/projetos/..%2F..%2Fetc')).status).toBe(400);
    expect((await pedir('GET', '/outra-coisa')).status).toBe(404);
    expect((await pedir('GET', '/projetos/nao-existe')).status).toBe(404);
    const quebrado = await fetch(`${url}/projetos/p1`, { method: 'PUT', headers: { Authorization: `Bearer ${CHAVE}` }, body: '{quebrado' });
    expect(quebrado.status).toBe(400);
  });

  it('as versões antigas saem, e a base que sumiu é avisada', async () => {
    for (let i = 0; i < 51; i++) await pedir('PUT', '/projetos/p1', { base: i, autor: 'Ana', projeto: projeto() });
    expect((await pedir('GET', '/projetos/p1/versoes/1')).status).toBe(404);
    expect((await pedir('GET', '/projetos/p1/versoes/2')).status).toBe(200);
  });
});

describe('a conexão com o servidor (ADR 0214)', () => {
  it('só http e https, sem senha no endereço', () => {
    expect(urlDoServidorValida('http://192.168.0.5:8931/')).toBe('http://192.168.0.5:8931');
    expect(urlDoServidorValida('https://exemplo.com.br/colab/')).toBe('https://exemplo.com.br/colab');
    expect(urlDoServidorValida('ftp://x')).toBeNull();
    expect(urlDoServidorValida('file:///c:/x')).toBeNull();
    expect(urlDoServidorValida('http://a:b@x')).toBeNull();
    expect(urlDoServidorValida('não é endereço')).toBeNull();
    expect(urlDoServidorValida(5)).toBeNull();
  });

  it('só os caminhos do servidor', () => {
    expect(caminhoDoServidorValido('/projetos')).toBe(true);
    expect(caminhoDoServidorValido('/projetos/p1/versoes/3')).toBe(true);
    expect(caminhoDoServidorValido('/projetos/p1/comentarios')).toBe(true);
    expect(caminhoDoServidorValido('/projetos/../outra')).toBe(false);
    expect(caminhoDoServidorValido('//exemplo.com')).toBe(false);
    expect(caminhoDoServidorValido('/outra')).toBe(false);
  });

  it('o pedido do programa chega ao servidor de verdade, com a chave', async () => {
    const r = await pedirAoServidor(fetch, url, CHAVE, 'PUT', '/projetos/p1', { base: 0, autor: 'Ana', projeto: projeto() });
    expect(r).toEqual({ status: 200, corpo: { versao: 1 } });
    expect((await pedirAoServidor(fetch, url, 'errada', 'GET', '/projetos')).status).toBe(401);
  });

  it('o método ou o caminho errado nem saem', async () => {
    await expect(pedirAoServidor(fetch, url, CHAVE, 'DELETE', '/projetos')).rejects.toThrow();
    await expect(pedirAoServidor(fetch, url, CHAVE, 'GET', '/outra')).rejects.toThrow();
  });
});

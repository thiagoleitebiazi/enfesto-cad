// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { conferirChave, guardarChave, type Buscar, type CofreDoSistema } from './chaveDaIa';
import { MODELO_PADRAO } from '../src/domain/servicoDeIa';

const cofre: CofreDoSistema = { disponivel: () => true, cifrar: (t) => Buffer.from(t), decifrar: (b) => b.toString() };
const CHAVE = `sk-${'a'.repeat(40)}`;
let pasta: string;
let arquivo: string;

const resposta = (status: number): Buscar => async () => ({ status, json: async () => ({}) });

beforeEach(() => {
  pasta = mkdtempSync(path.join(os.tmpdir(), 'chave-'));
  arquivo = path.join(pasta, 'ia.json');
});

afterEach(() => rmSync(pasta, { recursive: true, force: true }));

describe('conferir a chave, sem gastar crédito (ADR 0222)', () => {
  it('sem chave guardada, nem chama o serviço', async () => {
    const buscar = vi.fn(resposta(200));
    expect((await conferirChave(arquivo, cofre, buscar)).ok).toBe(false);
    expect(buscar).not.toHaveBeenCalled();
  });

  it('pergunta a lista de modelos, com a chave, e não pede imagem', async () => {
    expect(await guardarChave(arquivo, cofre, CHAVE, MODELO_PADRAO, '2026-11-01T00:00:00.000Z')).toBeNull();
    const buscar = vi.fn(resposta(200));
    expect(await conferirChave(arquivo, cofre, buscar)).toEqual({ ok: true });
    const [url, init] = buscar.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/models');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${CHAVE}`);
  });

  it('cada recusa é explicada', async () => {
    await guardarChave(arquivo, cofre, CHAVE, MODELO_PADRAO, '2026-11-01T00:00:00.000Z');
    expect((await conferirChave(arquivo, cofre, resposta(401))).erro).toContain('recusou a chave');
    expect((await conferirChave(arquivo, cofre, resposta(429))).erro).toContain('limite');
    expect((await conferirChave(arquivo, cofre, resposta(500))).erro).toContain('500');
  });

  it('sem internet, diz isso', async () => {
    await guardarChave(arquivo, cofre, CHAVE, MODELO_PADRAO, '2026-11-01T00:00:00.000Z');
    const r = await conferirChave(arquivo, cofre, async () => {
      throw new Error('sem rede');
    });
    expect(r.erro).toContain('não respondeu');
  });
});

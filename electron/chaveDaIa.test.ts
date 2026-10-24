// @vitest-environment node
import { mkdtempSync, readFileSync, rmSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { esquecerChave, estadoDaIa, gerarImagens, guardarChave, mudarModelo, type Buscar, type CofreDoSistema } from './chaveDaIa';

let pasta = '';
let arquivo = '';
beforeEach(() => {
  pasta = mkdtempSync(path.join(os.tmpdir(), 'enfesto-ia-'));
  arquivo = path.join(pasta, 'servico-de-ia.json');
});
afterEach(() => {
  rmSync(pasta, { recursive: true, force: true });
});

/** Um cofre de mentira: "cifra" invertendo os bytes e somando 1 (o bastante para a chave não aparecer no arquivo). */
const cofre = (disponivel = true): CofreDoSistema => ({
  disponivel: () => disponivel,
  cifrar: (t) => Buffer.from([...Buffer.from(t, 'utf-8')].reverse().map((b) => (b + 1) % 256)),
  decifrar: (c) => Buffer.from([...c].map((b) => (b + 255) % 256).reverse()).toString('utf-8'),
});
const CHAVE = 'sk-proj-chave-de-teste-1234567890';
const AGORA = '2026-10-24T20:00:00.000Z';

describe('a chave do serviço de IA', () => {
  it('sem chave: não configurado; guardada: configurado, e a chave não fica em texto aberto no arquivo', async () => {
    expect(await estadoDaIa(arquivo, cofre())).toMatchObject({ configurado: false, modelo: 'gpt-image-2.5-flare', cofreDisponivel: true });
    expect(await guardarChave(arquivo, cofre(), ` ${CHAVE} `, 'gpt-image-2.5-sunburst', AGORA)).toBeNull();
    expect(await estadoDaIa(arquivo, cofre())).toEqual({ configurado: true, servico: 'OpenAI (imagens)', modelo: 'gpt-image-2.5-sunburst', cofreDisponivel: true, guardadaEmIso: AGORA, chaveIlegivel: false });
    const noDisco = readFileSync(arquivo, 'utf-8');
    expect(noDisco).not.toContain('chave-de-teste');
    expect(noDisco).not.toContain(Buffer.from(CHAVE).toString('base64'));
    expect(await mudarModelo(arquivo, 'gpt-image-2')).toBeNull();
    expect((await estadoDaIa(arquivo, cofre())).modelo).toBe('gpt-image-2');
    await esquecerChave(arquivo);
    expect(existsSync(arquivo)).toBe(false);
    expect((await estadoDaIa(arquivo, cofre())).configurado).toBe(false);
  });

  it('sem o cofre do sistema, a chave não é guardada; a chave estranha e o modelo estranho são recusados', async () => {
    expect(await guardarChave(arquivo, cofre(false), CHAVE, 'gpt-image-2', AGORA)).toMatch(/não tem o cofre de senhas/);
    expect(existsSync(arquivo)).toBe(false);
    expect(await guardarChave(arquivo, cofre(), 'abc', 'gpt-image-2', AGORA)).toMatch(/não parece uma chave/);
    expect(await guardarChave(arquivo, cofre(), CHAVE, '../../x', AGORA)).toBe('Escolha um modelo de imagem.');
  });

  it('a chave que não abre (outro computador): ilegível, e é preciso pôr de novo', async () => {
    await guardarChave(arquivo, cofre(), CHAVE, 'gpt-image-2', AGORA);
    const outro: CofreDoSistema = { ...cofre(), decifrar: () => { throw new Error('não abre'); } };
    expect(await estadoDaIa(arquivo, outro)).toMatchObject({ configurado: false, chaveIlegivel: true });
  });
});

describe('o pedido ao serviço', () => {
  const pedido = { pedido: 'Uma saia evasê azul-marinho', quantidade: 2, formato: 'retrato', referencias: [] };

  it('sem configurar, nada sai do computador', async () => {
    const buscar = vi.fn<Buscar>();
    expect(await gerarImagens(arquivo, cofre(), pedido, buscar, 1000)).toEqual({ ok: false, erro: 'O serviço de IA não está configurado: ponha a sua chave em Configurar.' });
    expect(buscar).not.toHaveBeenCalled();
  });

  it('configurado: manda com a chave no cabeçalho e devolve as imagens e o modelo', async () => {
    await guardarChave(arquivo, cofre(), CHAVE, 'gpt-image-2.5-flare', AGORA);
    const buscar = vi.fn<Buscar>(async () => ({ status: 200, json: async () => ({ data: [{ b64_json: 'AAA' }, { b64_json: 'BBB' }] }) }));
    expect(await gerarImagens(arquivo, cofre(), pedido, buscar, 1000)).toEqual({ ok: true, imagens: ['AAA', 'BBB'], modelo: 'gpt-image-2.5-flare' });
    const [url, init] = buscar.mock.calls[0]!;
    expect(url).toBe('https://api.openai.com/v1/images/generations');
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${CHAVE}`);
    expect(JSON.parse(init.body as string)).toEqual({ model: 'gpt-image-2.5-flare', prompt: 'Uma saia evasê azul-marinho', n: 2, size: '1024x1536' });
  });

  it('o pedido estranho não sai; a falta de rede e a demora são ditas', async () => {
    await guardarChave(arquivo, cofre(), CHAVE, 'gpt-image-2.5-flare', AGORA);
    const buscar = vi.fn<Buscar>();
    expect(await gerarImagens(arquivo, cofre(), { pedido: 'x', quantidade: 9 }, buscar, 1000)).toMatchObject({ ok: false, erro: expect.stringMatching(/Escreva o pedido/) });
    expect(await gerarImagens(arquivo, cofre(), 'nada', buscar, 1000)).toEqual({ ok: false, erro: 'O pedido veio incompleto.' });
    expect(buscar).not.toHaveBeenCalled();
    const semRede: Buscar = async () => Promise.reject(new Error('getaddrinfo ENOTFOUND api.openai.com'));
    expect(await gerarImagens(arquivo, cofre(), pedido, semRede, 1000)).toMatchObject({ ok: false, erro: expect.stringMatching(/^Não foi possível falar com o serviço .*ENOTFOUND/) });
    const demora: Buscar = (_u, init) => new Promise((_ok, falha) => init.signal!.addEventListener('abort', () => falha(new Error('abortado'))));
    expect(await gerarImagens(arquivo, cofre(), pedido, demora, 20)).toEqual({ ok: false, erro: 'O serviço não respondeu em 0 s: tente de novo (ou peça menos imagens).' });
  });
});

// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  apagarNaPasta,
  caminhoNaPasta,
  criarSeNaoExiste,
  gravarNaPasta,
  guardarPastaEscolhida,
  lerNaPasta,
  lerPastasEscolhidas,
  listarNaPasta,
  moverNaPasta,
  nomeDeArquivoValido,
  prepararPasta,
} from './pastasCompartilhadas';

let raiz: string;
beforeEach(() => {
  raiz = mkdtempSync(path.join(os.tmpdir(), 'pastas-compartilhadas-'));
});
afterEach(() => rmSync(raiz, { recursive: true, force: true }));

describe('as pastas compartilhadas (ADR 0141)', () => {
  it('o nome do arquivo não sai da pasta: sem barra, sem "..", sem o que o Windows recusa', () => {
    for (const ruim of ['', '..', '.', '../x.csv', 'a/b.csv', 'a\\b.csv', 'C:x', ' x.csv', 'x.csv ', 'x.', 'a?b', 'a\u0000b', 'x'.repeat(201), 3, null]) {
      expect(nomeDeArquivoValido(ruim), String(ruim)).toBe(false);
    }
    expect(nomeDeArquivoValido('MOL-01_ordens 2026.csv')).toBe(true);
    expect(caminhoNaPasta(raiz, 'erp', 'entrada', 'a.csv')).toBe(path.join(raiz, 'entrada', 'a.csv'));
    // Só as subpastas do tipo, e só os tipos conhecidos.
    expect(caminhoNaPasta(raiz, 'erp', '..', 'a.csv')).toBeNull();
    expect(caminhoNaPasta(raiz, 'erp', 'projetos', 'a.csv')).toBeNull();
    expect(caminhoNaPasta(raiz, 'outro', 'entrada', 'a.csv')).toBeNull();
    expect(caminhoNaPasta(raiz, 'erp', 'entrada', '../../segredo')).toBeNull();
  });

  it('prepara, grava, lista (sem os ocultos e temporários), lê e apaga', async () => {
    await prepararPasta(raiz, 'erp');
    expect(readdirSync(raiz).sort()).toEqual(['com-erro', 'entrada', 'processados', 'saida']);
    expect(await gravarNaPasta(raiz, 'erp', 'saida', 'ordens.csv', 'a;b\r\n')).toBe(true);
    writeFileSync(path.join(raiz, 'saida', '.oculto'), 'x');
    writeFileSync(path.join(raiz, 'saida', 'meio.csv.123.tmp'), 'x');
    const lista = await listarNaPasta(raiz, 'erp', 'saida');
    expect(lista?.map((a) => a.nome)).toEqual(['ordens.csv']);
    expect(lista?.[0]?.tamanho).toBe(5);
    expect(await lerNaPasta(raiz, 'erp', 'saida', 'ordens.csv')).toBe('a;b\r\n');
    expect(await lerNaPasta(raiz, 'erp', 'saida', 'nao-existe.csv')).toBeNull();
    expect(await gravarNaPasta(raiz, 'erp', 'saida', '../fora.csv', 'x')).toBe(false);
    expect(await apagarNaPasta(raiz, 'erp', 'saida', 'ordens.csv')).toBe(true);
    expect(await listarNaPasta(raiz, 'erp', 'saida')).toEqual([]);
    expect(await listarNaPasta(raiz, 'erp', 'nada')).toBeNull();
  });

  it('mover não substitui o que já está no destino, nem move o que outra estação já levou', async () => {
    await prepararPasta(raiz, 'erp');
    writeFileSync(path.join(raiz, 'entrada', 'a.csv'), '1');
    expect(await moverNaPasta(raiz, 'erp', 'entrada', 'a.csv', 'processados', '2026_a.csv')).toBe(true);
    expect(readFileSync(path.join(raiz, 'processados', '2026_a.csv'), 'utf-8')).toBe('1');
    expect(await moverNaPasta(raiz, 'erp', 'entrada', 'a.csv', 'processados')).toBe(false);
    writeFileSync(path.join(raiz, 'entrada', 'a.csv'), '2');
    expect(await moverNaPasta(raiz, 'erp', 'entrada', 'a.csv', 'processados', '2026_a.csv')).toBe(false);
    expect(readFileSync(path.join(raiz, 'processados', '2026_a.csv'), 'utf-8')).toBe('1');
  });

  it('criar só se não existe: o segundo pedido perde', async () => {
    expect(await criarSeNaoExiste(raiz, 'erp', 'saida', 'trava', 'A')).toBe(true);
    expect(await criarSeNaoExiste(raiz, 'erp', 'saida', 'trava', 'B')).toBe(false);
    expect(readFileSync(path.join(raiz, 'saida', 'trava'), 'utf-8')).toBe('A');
  });

  it('a pasta escolhida fica guardada por tipo; o que não é caminho absoluto é ignorado', async () => {
    const arquivo = path.join(raiz, 'config', 'pastas-compartilhadas.json');
    expect(await lerPastasEscolhidas(arquivo)).toEqual({});
    await guardarPastaEscolhida(arquivo, 'erp', path.join(raiz, 'troca'));
    expect(await lerPastasEscolhidas(arquivo)).toEqual({ erp: path.join(raiz, 'troca') });
    writeFileSync(arquivo, JSON.stringify({ erp: 'relativo', outro: raiz }));
    expect(await lerPastasEscolhidas(arquivo)).toEqual({});
    await guardarPastaEscolhida(arquivo, 'erp', null);
    expect(await lerPastasEscolhidas(arquivo)).toEqual({});
  });
});

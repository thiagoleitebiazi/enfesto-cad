// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { criarFilaDeGravacao, gravarSemCorromper, idDeProjetoValido } from './gravacao';

let pasta = '';
beforeEach(() => {
  pasta = mkdtempSync(path.join(os.tmpdir(), 'enfesto-gravacao-'));
});
afterEach(() => {
  rmSync(pasta, { recursive: true, force: true });
});

function erroDeCodigo(code: string): NodeJS.ErrnoException {
  return Object.assign(new Error(code), { code });
}

describe('gravarSemCorromper', () => {
  it('grava o conteúdo e não deixa o temporário na pasta', async () => {
    const destino = path.join(pasta, 'p.json');
    await gravarSemCorromper(destino, '{"a":1}');
    expect(readFileSync(destino, 'utf-8')).toBe('{"a":1}');
    expect(readdirSync(pasta)).toEqual(['p.json']);
  });

  it('troca o arquivo que já existia', async () => {
    const destino = path.join(pasta, 'p.json');
    writeFileSync(destino, 'antigo');
    await gravarSemCorromper(destino, 'novo');
    expect(readFileSync(destino, 'utf-8')).toBe('novo');
  });

  it('se a troca falha, o arquivo anterior fica inteiro e o temporário some', async () => {
    const destino = path.join(pasta, 'p.json');
    writeFileSync(destino, 'antigo inteiro');
    await expect(
      gravarSemCorromper(destino, 'novo', { trocar: async () => Promise.reject(erroDeCodigo('ENOSPC')) }),
    ).rejects.toThrow('ENOSPC');
    expect(readFileSync(destino, 'utf-8')).toBe('antigo inteiro');
    expect(readdirSync(pasta)).toEqual(['p.json']);
  });

  it('tenta de novo quando o arquivo está preso por um instante (EPERM, EBUSY)', async () => {
    const destino = path.join(pasta, 'p.json');
    let vezes = 0;
    await gravarSemCorromper(destino, 'novo', {
      esperaMs: 1,
      trocar: async (de, para) => {
        vezes++;
        if (vezes < 3) throw erroDeCodigo(vezes === 1 ? 'EPERM' : 'EBUSY');
        await rename(de, para);
      },
    });
    expect(vezes).toBe(3);
    expect(readFileSync(destino, 'utf-8')).toBe('novo');
  });

  it('o erro que não é passageiro (disco cheio) não é tentado de novo', async () => {
    const destino = path.join(pasta, 'p.json');
    let vezes = 0;
    await expect(
      gravarSemCorromper(destino, 'novo', {
        esperaMs: 1,
        trocar: async () => {
          vezes++;
          throw erroDeCodigo('ENOSPC');
        },
      }),
    ).rejects.toThrow('ENOSPC');
    expect(vezes).toBe(1);
  });

  it('desiste depois das tentativas, sem lixo na pasta', async () => {
    const destino = path.join(pasta, 'p.json');
    let vezes = 0;
    await expect(
      gravarSemCorromper(destino, 'novo', {
        tentativas: 4,
        esperaMs: 1,
        trocar: async () => {
          vezes++;
          throw erroDeCodigo('EACCES');
        },
      }),
    ).rejects.toThrow('EACCES');
    expect(vezes).toBe(4);
    expect(readdirSync(pasta)).toEqual([]);
  });
});

describe('criarFilaDeGravacao', () => {
  it('grava um de cada vez por chave, na ordem pedida', async () => {
    const fila = criarFilaDeGravacao();
    const ordem: string[] = [];
    const devagar = (nome: string, ms: number) => async () => {
      ordem.push(`começa ${nome}`);
      await new Promise((r) => setTimeout(r, ms));
      ordem.push(`termina ${nome}`);
      return nome;
    };
    const [a, b] = await Promise.all([fila('p1', devagar('a', 30)), fila('p1', devagar('b', 1))]);
    expect([a, b]).toEqual(['a', 'b']);
    expect(ordem).toEqual(['começa a', 'termina a', 'começa b', 'termina b']);
  });

  it('um erro numa gravação não trava as seguintes', async () => {
    const fila = criarFilaDeGravacao();
    const falha = fila('p1', async () => {
      throw new Error('disco cheio');
    });
    const depois = fila('p1', async () => 'ok');
    await expect(falha).rejects.toThrow('disco cheio');
    await expect(depois).resolves.toBe('ok');
  });

  it('chaves diferentes não esperam umas pelas outras', async () => {
    const fila = criarFilaDeGravacao();
    const ordem: string[] = [];
    await Promise.all([
      fila('p1', async () => {
        await new Promise((r) => setTimeout(r, 30));
        ordem.push('p1');
      }),
      fila('p2', async () => {
        ordem.push('p2');
      }),
    ]);
    expect(ordem).toEqual(['p2', 'p1']);
  });
});

describe('idDeProjetoValido', () => {
  it('aceita os ids que o programa cria e recusa caminhos', () => {
    expect(idDeProjetoValido('projeto-muvyao9i-04cbfl')).toBe(true);
    expect(idDeProjetoValido('..\\..\\Windows\\x')).toBe(false);
    expect(idDeProjetoValido('../x')).toBe(false);
    expect(idDeProjetoValido('a/b')).toBe(false);
    expect(idDeProjetoValido('')).toBe(false);
    expect(idDeProjetoValido(42)).toBe(false);
    expect(idDeProjetoValido(undefined)).toBe(false);
  });
});

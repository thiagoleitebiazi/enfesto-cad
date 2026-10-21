// @vitest-environment node
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { rename } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copiaUnica, criarFilaDeGravacao, gravarComAnterior, gravarProjetoComCopia, gravarSemCorromper, idDeProjetoValido, lerComRecuperacao } from './gravacao';

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

describe('gravarProjetoComCopia', () => {
  const dados = (agoraIso = '2026-10-20T10:00:00.000Z') => ({ idDoProjeto: 'p1', versaoNova: 2, pastaDasCopias: path.join(pasta, 'copias-de-seguranca'), agoraIso });

  it('projeto novo: grava, sem cópia', async () => {
    const destino = path.join(pasta, 'p1.json');
    expect(await gravarProjetoComCopia(destino, '{"versaoDoFormato":2}', dados())).toBeNull();
    expect(readdirSync(pasta)).toEqual(['p1.json']);
  });

  it('o arquivo antigo é copiado inteiro antes da primeira gravação no formato novo, e uma vez só', async () => {
    const destino = path.join(pasta, 'p1.json');
    writeFileSync(destino, '{"id":"p1","antigo":true}');
    const copia = await gravarProjetoComCopia(destino, '{"id":"p1","versaoDoFormato":2}', dados());
    expect(copia).toBe(path.join(pasta, 'copias-de-seguranca', 'p1.v1.2026-10-20T10-00-00-000Z.json'));
    expect(readFileSync(copia!, 'utf-8')).toBe('{"id":"p1","antigo":true}');
    expect(readFileSync(destino, 'utf-8')).toBe('{"id":"p1","versaoDoFormato":2}');
    // Já no formato novo: as próximas gravações não copiam.
    expect(await gravarProjetoComCopia(destino, '{"id":"p1","versaoDoFormato":2,"x":1}', dados('2026-10-20T11:00:00.000Z'))).toBeNull();
    expect(readdirSync(path.join(pasta, 'copias-de-seguranca'))).toHaveLength(1);
  });

  it('o arquivo ilegível é copiado antes de ser trocado', async () => {
    const destino = path.join(pasta, 'p1.json');
    writeFileSync(destino, '{ cortado');
    const copia = await gravarProjetoComCopia(destino, '{}', dados());
    expect(readFileSync(copia!, 'utf-8')).toBe('{ cortado');
  });
});

describe('gravarComAnterior e lerComRecuperacao (o cadastro de produção)', () => {
  const dados = { idDoArquivo: 'cadastro', versaoNova: 2, pastaDasCopias: '', agoraIso: '2026-10-21T10:00:00.000Z' };
  const com = () => ({ ...dados, pastaDasCopias: path.join(pasta, 'copias') });

  it('cada gravação guarda a versão anterior ao lado', async () => {
    const destino = path.join(pasta, 'cadastro.json');
    await gravarComAnterior(destino, '{"versaoDoFormato":2,"n":1}', com());
    await gravarComAnterior(destino, '{"versaoDoFormato":2,"n":2}', com());
    expect(readFileSync(destino, 'utf-8')).toBe('{"versaoDoFormato":2,"n":2}');
    expect(readFileSync(destino + '.anterior', 'utf-8')).toBe('{"versaoDoFormato":2,"n":1}');
  });

  it('gravação interrompida (a troca falha): o arquivo continua o de antes, inteiro, e é lido assim', async () => {
    const destino = path.join(pasta, 'cadastro.json');
    await gravarComAnterior(destino, '{"versaoDoFormato":2,"n":1}', com());
    await expect(gravarSemCorromper(destino, '{"versaoDoFormato":2,"n":2}', { trocar: async () => Promise.reject(erroDeCodigo('ENOSPC')) })).rejects.toThrow('ENOSPC');
    expect(await lerComRecuperacao(destino)).toEqual({ situacao: 'lido', conteudo: { versaoDoFormato: 2, n: 1 } });
  });

  it('o arquivo quebrado (ou apagado) volta da versão anterior, dizendo que foi recuperado; sem anterior, é dito', async () => {
    const destino = path.join(pasta, 'cadastro.json');
    await gravarComAnterior(destino, '{"versaoDoFormato":2,"n":1}', com());
    await gravarComAnterior(destino, '{"versaoDoFormato":2,"n":2}', com());
    writeFileSync(destino, '{ cortado');
    expect(await lerComRecuperacao(destino)).toEqual({ situacao: 'recuperado', motivo: 'ilegivel', conteudo: { versaoDoFormato: 2, n: 1 } });
    rmSync(destino);
    expect(await lerComRecuperacao(destino)).toEqual({ situacao: 'recuperado', motivo: 'ausente', conteudo: { versaoDoFormato: 2, n: 1 } });
    rmSync(destino + '.anterior');
    expect(await lerComRecuperacao(destino)).toEqual({ situacao: 'ausente' });
    writeFileSync(destino, '{ cortado');
    expect(await lerComRecuperacao(destino)).toEqual({ situacao: 'ilegivel' });
  });

  it('gravar por cima do quebrado copia o quebrado antes, e a versão anterior boa não é trocada por ele', async () => {
    const destino = path.join(pasta, 'cadastro.json');
    await gravarComAnterior(destino, '{"versaoDoFormato":2,"n":1}', com());
    await gravarComAnterior(destino, '{"versaoDoFormato":2,"n":2}', com());
    writeFileSync(destino, '{ cortado');
    await gravarComAnterior(destino, '{"versaoDoFormato":2,"n":3}', com());
    expect(readFileSync(destino + '.anterior', 'utf-8')).toBe('{"versaoDoFormato":2,"n":1}');
    const copias = readdirSync(path.join(pasta, 'copias'));
    expect(copias.some((n) => n.startsWith('cadastro.ilegivel.') && readFileSync(path.join(pasta, 'copias', n), 'utf-8') === '{ cortado')).toBe(true);
  });

  it('a cópia única: o mesmo conteúdo, uma cópia só', async () => {
    const a = await copiaUnica(path.join(pasta, 'copias'), 'cadastro.descartados', 'x');
    const b = await copiaUnica(path.join(pasta, 'copias'), 'cadastro.descartados', 'x');
    const c = await copiaUnica(path.join(pasta, 'copias'), 'cadastro.descartados', 'y');
    expect(a).toBe(b);
    expect(c).not.toBe(a);
    expect(readdirSync(path.join(pasta, 'copias'))).toHaveLength(2);
  });
});

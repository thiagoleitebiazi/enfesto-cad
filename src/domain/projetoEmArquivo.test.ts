import { describe, expect, it } from 'vitest';
import { criarProjeto } from './projeto';
import { cifrarProjeto, decifrarProjeto, ehProjetoCifrado, nomeDoArquivoDoProjeto, projetoDoArquivo, textoDoProjeto } from './projetoEmArquivo';

const PROJETO = criarProjeto('Saia Évasê', 'p1', 'ENF-1', '2026-10-31T10:00:00.000Z', { pecas: [], tecido: null, enfesto: null });
const novo = { id: () => 'p-novo', codigo: () => 'ENF-9' };

describe('a senha do arquivo (ADR 0169)', () => {
  it('cifrado, o conteúdo não aparece; a senha certa devolve o projeto, a errada não', async () => {
    const cifrado = await cifrarProjeto(textoDoProjeto(PROJETO), 'segredo');
    expect(ehProjetoCifrado(cifrado)).toBe(true);
    expect(ehProjetoCifrado(textoDoProjeto(PROJETO))).toBe(false);
    expect(ehProjetoCifrado('{quebrado')).toBe(false);
    expect(cifrado).not.toContain('Saia');
    expect(projetoDoArquivo(await decifrarProjeto(cifrado, 'segredo'), [], novo)).toEqual({ projeto: PROJETO });
    await expect(decifrarProjeto(cifrado, 'outra')).rejects.toThrow(/senha não é esta/);
  });
});

describe('o projeto num arquivo (ADR 0156)', () => {
  it('o nome do arquivo, sem acento nem espaço', () => {
    expect(nomeDoArquivoDoProjeto(PROJETO)).toBe('Saia-Evase.enfesto');
    expect(nomeDoArquivoDoProjeto({ ...PROJETO, nome: '///' })).toBe('projeto.enfesto');
  });

  it('volta igual; se a biblioteca já tem o mesmo id, entra como outro, sem trocar o que está lá', () => {
    expect(projetoDoArquivo(textoDoProjeto(PROJETO), [], novo)).toEqual({ projeto: PROJETO });
    const r = projetoDoArquivo(textoDoProjeto(PROJETO), [PROJETO], novo);
    expect(r).toEqual({ projeto: { ...PROJETO, id: 'p-novo', codigo: 'ENF-9', nome: 'Saia Évasê (importado)' } });
  });

  it('o que não é projeto, ou é de uma versão mais nova, é recusado com o motivo', () => {
    expect(projetoDoArquivo('{quebrado', [], novo)).toEqual({ erro: expect.stringMatching(/não dá para ler/) });
    expect(projetoDoArquivo('{"nome":"x"}', [], novo)).toEqual({ erro: expect.stringMatching(/não tem/) });
    expect(projetoDoArquivo(JSON.stringify({ ...PROJETO, versaoDoFormato: 9999 }), [], novo)).toEqual({ erro: expect.stringMatching(/versão mais nova/) });
  });
});

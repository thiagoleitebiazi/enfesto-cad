import { describe, expect, it } from 'vitest';
import type { PastaDeArquivos } from './pastaCompartilhada';
import { criarProjeto, type Projeto } from './projeto';
import {
  arquivoDaTrava,
  descricaoDaTrava,
  devolverARede,
  lerBibliotecaNaRede,
  lerTrava,
  liberarTrava,
  pegarParaEditar,
  publicarNaRede,
  situacaoNaRede,
  travaVencida,
} from './bibliotecaNaRede';

/** Uma pasta na memória: subpasta → nome → texto. */
function pastaNaMemoria(): PastaDeArquivos & { readonly pastas: Map<string, Map<string, string>> } {
  const pastas = new Map<string, Map<string, string>>([
    ['projetos', new Map()],
    ['travas', new Map()],
  ]);
  return {
    pastas,
    listar: async (sub) => [...pastas.get(sub)!.keys()].map((nome) => ({ nome })),
    ler: async (sub, nome) => pastas.get(sub)!.get(nome) ?? null,
    gravar: async (sub, nome, texto) => {
      pastas.get(sub)!.set(nome, texto);
      return true;
    },
    mover: async () => false,
    criarSeNaoExiste: async (sub, nome, texto) => {
      if (pastas.get(sub)!.has(nome)) return false;
      pastas.get(sub)!.set(nome, texto);
      return true;
    },
    apagar: async (sub, nome) => pastas.get(sub)!.delete(nome),
  };
}

const projeto = (id: string, nome: string, modificadoEmIso = '2026-10-20T09:00:00.000Z'): Projeto => ({
  ...criarProjeto(nome, id, `ENF-${id}`, '2026-10-20T09:00:00.000Z', { pecas: [], tecido: null, enfesto: null }),
  modificadoEmIso,
});

const AGORA = '2026-10-26T10:00:00.000Z';

describe('a biblioteca na rede (ADR 0142)', () => {
  it('a trava: lida com tolerância, vencida depois de 12 h, descrita com o nome e a hora', () => {
    expect(lerTrava(null)).toBeNull();
    expect(lerTrava('{quebrado')).toBeNull();
    expect(lerTrava('{"quem":3}')).toBeNull();
    const trava = lerTrava('{"quem":"Ana","desdeIso":"2026-10-26T00:00:00.000Z"}')!;
    expect(trava).toEqual({ quem: 'Ana', desdeIso: '2026-10-26T00:00:00.000Z', nomeDoProjeto: '' });
    expect(travaVencida(trava, '2026-10-26T11:59:00.000Z')).toBe(false);
    expect(travaVencida(trava, '2026-10-26T12:00:00.000Z')).toBe(true);
    expect(descricaoDaTrava(trava)).toMatch(/^Em edição por Ana desde /);
  });

  it('a situação da cópia da rede diante da deste computador', () => {
    const rede = projeto('a', 'Saia', '2026-10-21T00:00:00.000Z');
    expect(situacaoNaRede(undefined, rede)).toBe('so-na-rede');
    expect(situacaoNaRede(rede, rede)).toBe('igual');
    expect(situacaoNaRede(projeto('a', 'Saia', '2026-10-20T00:00:00.000Z'), rede)).toBe('rede-mais-nova');
    expect(situacaoNaRede(projeto('a', 'Saia', '2026-10-22T00:00:00.000Z'), rede)).toBe('local-mais-nova');
  });

  it('publicar, ler a lista (com as travas e os avisos do que não é modelo) e não publicar duas vezes', async () => {
    const pasta = pastaNaMemoria();
    expect(await publicarNaRede(pasta, projeto('b', 'Vestido'))).toBeNull();
    expect(await publicarNaRede(pasta, projeto('a', 'Saia'))).toBeNull();
    expect(await publicarNaRede(pasta, projeto('a', 'Saia'))).toMatch(/já está na rede/);
    pasta.pastas.get('projetos')!.set('lixo.json', '{"x":1}');
    pasta.pastas.get('travas')!.set(arquivoDaTrava('b'), JSON.stringify({ quem: 'Ana', desdeIso: AGORA, nomeDoProjeto: 'Vestido' }));
    const lida = (await lerBibliotecaNaRede(pasta))!;
    expect(lida.projetos.map((p) => [p.projeto.nome, p.trava?.quem ?? null])).toEqual([
      ['Saia', null],
      ['Vestido', 'Ana'],
    ]);
    expect(lida.avisos).toHaveLength(1);
    expect(lida.avisos[0]).toMatch(/^lixo.json: /);
  });

  it('pegar para editar: quem chega primeiro trava; o outro ouve quem está editando; pegar de novo não atrapalha', async () => {
    const pasta = pastaNaMemoria();
    await publicarNaRede(pasta, projeto('a', 'Saia'));
    expect(await pegarParaEditar(pasta, 'a', ' ', AGORA)).toEqual({ erro: expect.stringMatching(/seu nome/) });
    const ana = await pegarParaEditar(pasta, 'a', 'Ana', AGORA);
    expect('projeto' in ana && ana.projeto.nome).toBe('Saia');
    expect(JSON.parse(pasta.pastas.get('travas')!.get(arquivoDaTrava('a'))!)).toEqual({ quem: 'Ana', desdeIso: AGORA, nomeDoProjeto: 'Saia' });
    const bruno = await pegarParaEditar(pasta, 'a', 'Bruno', AGORA);
    expect('erro' in bruno && bruno.erro).toMatch(/^Em edição por Ana desde .*só ela pode devolver/);
    expect('projeto' in (await pegarParaEditar(pasta, 'a', 'ana ', AGORA))).toBe(true);
    expect(await pegarParaEditar(pasta, 'x', 'Ana', AGORA)).toEqual({ erro: expect.stringMatching(/não está mais na rede/) });
  });

  it('devolver: só quem está com a trava; grava o modelo e tira a trava', async () => {
    const pasta = pastaNaMemoria();
    await publicarNaRede(pasta, projeto('a', 'Saia'));
    const mudado = projeto('a', 'Saia longa', '2026-10-26T11:00:00.000Z');
    expect(await devolverARede(pasta, mudado, 'Ana')).toMatch(/ninguém está com a trava/);
    await pegarParaEditar(pasta, 'a', 'Ana', AGORA);
    expect(await devolverARede(pasta, mudado, 'Bruno')).toMatch(/^Em edição por Ana/);
    expect(await devolverARede(pasta, mudado, 'Ana')).toBeNull();
    expect(pasta.pastas.get('travas')!.size).toBe(0);
    expect(JSON.parse(pasta.pastas.get('projetos')!.get('a.json')!).nome).toBe('Saia longa');
  });

  it('liberar sem devolver: a própria trava sempre; a de outra pessoa só vencida', async () => {
    const pasta = pastaNaMemoria();
    await publicarNaRede(pasta, projeto('a', 'Saia'));
    expect(await liberarTrava(pasta, 'a', 'Ana', AGORA)).toBeNull();
    await pegarParaEditar(pasta, 'a', 'Ana', AGORA);
    expect(await liberarTrava(pasta, 'a', 'Bruno', '2026-10-26T20:00:00.000Z')).toMatch(/depois de 12 horas/);
    expect(pasta.pastas.get('travas')!.size).toBe(1);
    expect(await liberarTrava(pasta, 'a', 'Bruno', '2026-10-26T22:00:00.000Z')).toBeNull();
    expect(pasta.pastas.get('travas')!.size).toBe(0);
    await pegarParaEditar(pasta, 'a', 'Ana', AGORA);
    expect(await liberarTrava(pasta, 'a', 'Ana', AGORA)).toBeNull();
    expect(pasta.pastas.get('travas')!.size).toBe(0);
  });
});

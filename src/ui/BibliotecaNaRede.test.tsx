import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { AcessoAPasta } from '../domain/pastaCompartilhada';
import { criarProjeto, type Projeto } from '../domain/projeto';
import { BibliotecaNaRede } from './BibliotecaNaRede';

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

const projeto = (id: string, nome: string, modificadoEmIso = '2026-10-20T09:00:00.000Z'): Projeto => ({
  ...criarProjeto(nome, id, `ENF-${id}`, '2026-10-20T09:00:00.000Z', { pecas: [], tecido: null, enfesto: null }),
  modificadoEmIso,
});

/** Uma pasta na memória, já escolhida. */
function pastaNaMemoria(): AcessoAPasta & { readonly pastas: Map<string, Map<string, string>> } {
  const pastas = new Map<string, Map<string, string>>([
    ['projetos', new Map()],
    ['travas', new Map()],
  ]);
  let onde: string | null = 'Z:\\modelos';
  return {
    pastas,
    onde: async () => onde,
    escolher: async () => (onde = 'Z:\\modelos'),
    esquecer: async () => {
      onde = null;
      return true;
    },
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

function abrir(pasta: AcessoAPasta, projetos: readonly Projeto[]) {
  const onTrazer = vi.fn<(p: Projeto) => string | null>(() => null);
  render(
    <BibliotecaNaRede
      pasta={pasta}
      projetos={projetos}
      projetoParaEnviar={(id) => projetos.find((p) => p.id === id) ?? null}
      onTrazer={onTrazer}
      agoraIso={() => '2026-10-26T10:00:00.000Z'}
    />,
  );
  return onTrazer;
}

const botao = (nome: string) => screen.getByRole('button', { name: nome });
const linha = (nome: string) => screen.getByRole('row', { name: new RegExp(nome) });

describe('a biblioteca na rede na tela (ADR 0142)', () => {
  it('publica um modelo deste computador; pega para editar (a trava com o nome); devolve (a trava sai)', async () => {
    const pasta = pastaNaMemoria();
    const saia = projeto('a', 'Saia');
    abrir(pasta, [saia]);
    expect(await screen.findByText('Z:\\modelos')).toBeInTheDocument();
    expect(screen.getByText('Nenhum modelo na pasta da rede ainda.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Publicar um modelo deste computador'), { target: { value: 'a' } });
    fireEvent.click(botao('Publicar na rede'));
    expect(await screen.findByText('“Saia” está na rede.')).toBeInTheDocument();
    expect(within(linha('Saia')).getByText('Livre')).toBeInTheDocument();
    expect(within(linha('Saia')).getByText('Igual à deste computador')).toBeInTheDocument();

    // Sem nome, não trava.
    fireEvent.click(within(linha('Saia')).getByRole('button', { name: 'Pegar para editar' }));
    expect(await screen.findByText(/Escreva o seu nome/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Seu nome (aparece na trava)'), { target: { value: 'Ana' } });
    fireEvent.click(within(linha('Saia')).getByRole('button', { name: 'Pegar para editar' }));
    expect(await screen.findByText(/“Saia” é seu até devolver/)).toBeInTheDocument();
    expect(within(linha('Saia')).getByText('Com você')).toBeInTheDocument();
    expect(JSON.parse(pasta.pastas.get('travas')!.get('a.trava.json')!).quem).toBe('Ana');

    fireEvent.click(within(linha('Saia')).getByRole('button', { name: 'Devolver à rede' }));
    expect(await screen.findByText('“Saia” foi devolvido à rede; a trava saiu.')).toBeInTheDocument();
    expect(pasta.pastas.get('travas')!.size).toBe(0);
    // O nome fica guardado para a próxima vez.
    expect(window.localStorage.getItem('enfesto-cad:nome-na-rede')).toBe('Ana');
  });

  it('o modelo travado por outra pessoa: diz quem, não deixa pegar, e deixa trazer uma cópia', async () => {
    const pasta = pastaNaMemoria();
    const vestido = projeto('v', 'Vestido', '2026-10-25T09:00:00.000Z');
    pasta.pastas.get('projetos')!.set('v.json', JSON.stringify(vestido));
    pasta.pastas.get('travas')!.set('v.trava.json', JSON.stringify({ quem: 'Maria', desdeIso: '2026-10-26T08:00:00.000Z', nomeDoProjeto: 'Vestido' }));
    const onTrazer = abrir(pasta, []);
    await waitFor(() => expect(within(linha('Vestido')).getByText(/^Em edição por Maria desde /)).toBeInTheDocument());
    expect(within(linha('Vestido')).queryByRole('button', { name: 'Pegar para editar' })).toBeNull();
    // A trava tem 2 horas: ainda não venceu.
    expect(within(linha('Vestido')).queryByRole('button', { name: 'Liberar a trava esquecida' })).toBeNull();
    expect(within(linha('Vestido')).getByText('Só na rede')).toBeInTheDocument();
    fireEvent.click(within(linha('Vestido')).getByRole('button', { name: 'Trazer uma cópia' }));
    await waitFor(() => expect(onTrazer).toHaveBeenCalledTimes(1));
    expect(onTrazer.mock.calls[0]![0].nome).toBe('Vestido');
    expect(await screen.findByText(/quem devolve é quem está com a trava/)).toBeInTheDocument();
  });

  it('a cópia deste computador mais nova não é trocada pela da rede', async () => {
    const pasta = pastaNaMemoria();
    pasta.pastas.get('projetos')!.set('a.json', JSON.stringify(projeto('a', 'Saia', '2026-10-20T09:00:00.000Z')));
    const onTrazer = abrir(pasta, [projeto('a', 'Saia', '2026-10-24T09:00:00.000Z')]);
    await waitFor(() => expect(within(linha('Saia')).getByText('A deste computador é mais nova')).toBeInTheDocument());
    fireEvent.click(within(linha('Saia')).getByRole('button', { name: 'Trazer uma cópia' }));
    expect(await screen.findByText(/é mais nova que a da rede: nada foi trazido/)).toBeInTheDocument();
    expect(onTrazer).not.toHaveBeenCalled();
  });
});

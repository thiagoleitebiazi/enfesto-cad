import { describe, expect, it, vi } from 'vitest';
import { CADASTRO_VAZIO, salvarMalha, type MalhaDoCadastro } from '../domain/cadastroDeProducao';
import { carregarCadastro, gravarCadastro } from './cadastroNoDisco';

const MALHA: MalhaDoCadastro = { id: 'm1', descricao: 'Ribana', larguraUtilMm: 900, tubular: true, sentidoUnico: false, padrao: 'liso', encolhimentoCompensadoNoMolde: false };

function armazenamento(inicial: Record<string, string> = {}) {
  const dados = new Map(Object.entries(inicial));
  return { getItem: (k: string) => dados.get(k) ?? null, setItem: (k: string, v: string) => void dados.set(k, v), dados };
}

describe('cadastro no disco', () => {
  it('pelo processo principal: lê e grava pelo api', async () => {
    const gravado = salvarMalha(CADASTRO_VAZIO, MALHA);
    const api = { lerCadastroDeProducao: vi.fn(async () => JSON.parse(JSON.stringify(gravado))), gravarCadastroDeProducao: vi.fn(async () => true) };
    const lido = await carregarCadastro(api, null);
    expect(lido).toEqual({ cadastro: gravado, avisos: [], somenteLeitura: false });
    expect(await gravarCadastro(api, null, gravado)).toBeNull();
    expect(api.gravarCadastroDeProducao).toHaveBeenCalledWith(gravado);
  });

  it('sem arquivo ainda: as malhas do cadastro antigo entram (e o antigo fica onde estava)', async () => {
    const antigo = armazenamento({ 'enfesto-cad:malhas': JSON.stringify([{ id: 'a1', descricao: 'Malha antiga', larguraUtilMm: 1600, tubular: false, sentidoUnico: false }]) });
    const lido = await carregarCadastro({ lerCadastroDeProducao: async () => null, gravarCadastroDeProducao: async () => true }, antigo);
    expect(lido.cadastro.malhas.map((m) => m.descricao)).toEqual(['Malha antiga']);
    expect(antigo.dados.has('enfesto-cad:malhas')).toBe(true);
  });

  it('o arquivo quebrado é dito, e começa vazio; o de versão mais nova fica só para ler', async () => {
    const quebrado = await carregarCadastro({ lerCadastroDeProducao: async () => ({ arquivoIlegivel: 'cadastro-de-producao.json' }), gravarCadastroDeProducao: async () => true }, null);
    expect(quebrado.cadastro).toEqual(CADASTRO_VAZIO);
    expect(quebrado.avisos[0]).toContain('(cadastro-de-producao.json) está quebrado');
    const novo = await carregarCadastro({ lerCadastroDeProducao: async () => ({ versaoDoFormato: 9, malhas: [MALHA] }), gravarCadastroDeProducao: async () => true }, null);
    expect(novo.somenteLeitura).toBe(true);
    expect(novo.cadastro.malhas).toHaveLength(1);
  });

  it('num navegador comum, no armazenamento dele; o erro ao gravar volta como mensagem', async () => {
    const local = armazenamento();
    const cadastro = salvarMalha(CADASTRO_VAZIO, MALHA);
    expect(await gravarCadastro(undefined, local, cadastro)).toBeNull();
    expect((await carregarCadastro(undefined, local)).cadastro).toEqual(cadastro);
    const falha = { lerCadastroDeProducao: async () => null, gravarCadastroDeProducao: async () => Promise.reject(new Error('disco cheio')) };
    expect(await gravarCadastro(falha, null, cadastro)).toBe('O cadastro não foi gravado: disco cheio');
  });
});

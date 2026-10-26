import { describe, expect, it } from 'vitest';
import { lerColecoes, type Colecao, type ModeloDaColecao } from './colecoes';
import { coresEmComum, guardarLook, htmlDaPrancha, looksDaColecao, tirarLook, validarLook, type LookDaColecao } from './looks';

const modelo = (id: string, nome: string, cores: string[]): ModeloDaColecao => ({
  id,
  nome,
  referencia: `REF-${id}`,
  categoria: '',
  cores,
  tecido: 'Viscose',
  projetoId: null,
  etapa: 'criacao',
  responsavel: '',
  prazo: '',
  alteracoesDaPiloto: 0,
  tarefas: [],
  comentarios: [],
  historico: [],
});

const COLECAO: Colecao = {
  id: 'c1',
  nome: 'Verão 27',
  estacao: 'alto-verao',
  ano: 2027,
  lancamento: '',
  descricao: '',
  responsavel: '',
  marcos: [],
  modelos: [modelo('b', 'Blusa', ['Azul', 'Branco']), modelo('s', 'Saia', ['azul', 'Preto']), modelo('c', 'Casaco', ['Azul', 'branco'])],
  arquivada: false,
  criadaEmIso: '2026-10-26T10:00:00.000Z',
};

const look = (extras: Partial<LookDaColecao> = {}): LookDaColecao => ({ id: 'l1', nome: 'Praia', modeloIds: ['b', 's'], nota: '', ...extras });

describe('os looks da coleção (ADR 0145)', () => {
  it('de 2 a 4 modelos da coleção, sem repetir, com um nome único', () => {
    expect(validarLook(look(), COLECAO)).toEqual([]);
    expect(validarLook(look({ nome: ' ' }), COLECAO)).toEqual(['Dê um nome ao look.']);
    expect(validarLook(look({ modeloIds: ['b'] }), COLECAO)[0]).toMatch(/de 2 a 4 modelos \(este tem 1\)/);
    expect(validarLook(look({ modeloIds: ['b', 'b', 's'] }), COLECAO)).toContain('Um modelo entrou duas vezes no look.');
    expect(validarLook(look({ modeloIds: ['b', 'x'] }), COLECAO)).toContain('Um dos modelos não está nesta coleção.');
    const comUm = guardarLook(COLECAO, look());
    expect(validarLook(look({ id: 'l2', nome: 'praia ' }), comUm)).toEqual(['Já há um look “praia” nesta coleção.']);
    expect(() => guardarLook(COLECAO, look({ modeloIds: [] }))).toThrow(/de 2 a 4/);
  });

  it('guardar, trocar, tirar; o modelo que sai da coleção sai do look (e o look com menos de 2 some da lista)', () => {
    let c = guardarLook(COLECAO, look({ nome: ' Praia ', nota: ' sol ' }));
    expect(c.looks).toEqual([{ id: 'l1', nome: 'Praia', modeloIds: ['b', 's'], nota: 'sol' }]);
    c = guardarLook(c, look({ modeloIds: ['b', 's', 'c'] }));
    expect(c.looks).toHaveLength(1);
    expect(looksDaColecao({ ...c, modelos: c.modelos.filter((m) => m.id !== 'c') })[0]!.modeloIds).toEqual(['b', 's']);
    expect(looksDaColecao({ ...c, modelos: c.modelos.filter((m) => m.id === 'b') })).toEqual([]);
    expect(tirarLook(c, 'l1').looks).toEqual([]);
  });

  it('as cores em comum, sem diferença de maiúsculas', () => {
    expect(coresEmComum(COLECAO.modelos)).toEqual(['Azul']);
    expect(coresEmComum([COLECAO.modelos[0]!, COLECAO.modelos[2]!])).toEqual(['Azul', 'Branco']);
    expect(coresEmComum([])).toEqual([]);
  });

  it('os looks gravados voltam na leitura das coleções; o que não é look fica de fora', () => {
    const gravado = JSON.parse(JSON.stringify({ versaoDoFormato: 1, colecoes: [{ ...guardarLook(COLECAO, look()), looks: [look(), { nome: 'sem id' }] }] }));
    expect(lerColecoes(gravado).arquivo.colecoes[0]!.looks).toEqual([look()]);
    expect(lerColecoes(JSON.parse(JSON.stringify({ versaoDoFormato: 1, colecoes: [COLECAO] }))).arquivo.colecoes[0]!.looks).toBeUndefined();
  });

  it('a prancha: o nome do look, a coleção, as cores em comum, um cartão por modelo, o texto escapado', () => {
    const html = htmlDaPrancha('Verão <27>', look({ nota: 'para o catálogo' }), [
      { nome: 'Blusa', referencia: 'REF-b', cores: ['Azul'], tecido: 'Viscose', croquiSvg: '<svg id="b"></svg>' },
      { nome: 'Saia & cia', referencia: '', cores: [], tecido: '', croquiSvg: null },
    ], ['Azul']);
    expect(html).toContain('<title>Praia — Verão &lt;27&gt;</title>');
    expect(html).toContain('cores em comum: Azul · para o catálogo');
    expect(html.match(/<figure>/g)).toHaveLength(2);
    expect(html).toContain('<svg id="b"></svg>');
    expect(html).toContain('Saia &amp; cia');
    expect(html).toContain('sem croqui');
  });
});

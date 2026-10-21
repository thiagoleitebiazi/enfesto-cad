import { describe, expect, it } from 'vitest';
import { importarOrdensCsv, lerCsv, ordensDasLinhas, type ContextoDaImportacao } from './importacaoDeOrdens';

let n = 0;
const CONTEXTO: ContextoDaImportacao = {
  tamanhosDoMolde: ['P', 'M', 'G', 'GG'],
  projetoId: 'p1',
  codigoDoMolde: 'ENF-1',
  revisoes: [1, 2],
  revisaoAtual: 2,
  existentes: [{ id: 'o0', codigo: 'OP-1', quantidadesPorTamanho: { P: 1 }, criadaEmIso: 'x', atualizadaEmIso: 'x' }],
  agoraIso: '2026-10-21T10:00:00.000Z',
  novoId: () => `ordem-${++n}`,
};

describe('importarOrdensCsv — o formato documentado', () => {
  it('ponto e vírgula, cabeçalho com acentos e maiúsculas, prazo nos dois formatos, a revisão atual quando a linha não diz', () => {
    const csv = ['Código;Produto;Cor;Prazo;Observações;P;M;G;GG', 'OP-100;Camiseta básica;Azul;2026-11-30;;10;20;20;10', 'OP-101;"Camiseta; manga longa";Preta;05/12/2026;urgente;0;5;5;'].join('\r\n');
    const r = importarOrdensCsv('\uFEFF' + csv, CONTEXTO);
    expect(r.erros).toEqual([]);
    expect(r.ordens.map((o) => [o.codigo, o.produto, o.cor, o.prazo, o.observacoes, o.quantidadesPorTamanho, o.revisaoDoMolde, o.codigoDoMolde])).toEqual([
      ['OP-100', 'Camiseta básica', 'Azul', '2026-11-30', undefined, { P: 10, M: 20, G: 20, GG: 10 }, 2, 'ENF-1'],
      ['OP-101', 'Camiseta; manga longa', 'Preta', '2026-12-05', 'urgente', { P: 0, M: 5, G: 5 }, 2, 'ENF-1'],
    ]);
  });

  it('vírgula e tabulação também valem; a revisão dita na linha vale', () => {
    expect(importarOrdensCsv('codigo,revisao,M\nOP-7,1,3', CONTEXTO).ordens[0]).toMatchObject({ codigo: 'OP-7', revisaoDoMolde: 1, quantidadesPorTamanho: { M: 3 } });
    expect(importarOrdensCsv('codigo\tP\nOP-8\t4', CONTEXTO).ordens[0]).toMatchObject({ codigo: 'OP-8', quantidadesPorTamanho: { P: 4 } });
  });

  it('tudo ou nada: cada erro diz a linha e o que fazer, e nenhuma ordem entra', () => {
    const csv = [
      'codigo;molde;revisao;prazo;P;M;XG',
      'OP-200;;;;10;2,5;',
      'OP-201;ENF-9;;;1;;',
      'OP-202;;7;31-12-2026;1;;',
      'OP-1;;;;1;;',
      ';;;;1;;',
      'OP-203;;;;0;0;3',
      'OP-200;;;;1;;',
    ].join('\n');
    const r = importarOrdensCsv(csv, CONTEXTO);
    expect(r.ordens).toEqual([]);
    expect(r.erros).toEqual([
      'Linha 2: a quantidade do tamanho M ("2,5") não é um número inteiro.',
      'Linha 3: a ordem OP-201 é do molde ENF-9, e o projeto aberto é o ENF-1: abra o projeto dela para importá-la.',
      'Linha 4: a revisão 7 não está registrada neste molde (há: 1, 2).',
      'Linha 4: o prazo "31-12-2026" não é uma data (use AAAA-MM-DD ou DD/MM/AAAA).',
      'Linha 5: a ordem OP-1 já está no cadastro (para mudar uma ordem que existe, use a tela).',
      'Linha 6: falta o código da ordem.',
      'Linha 7: o tamanho XG não existe no molde (tamanhos: P, M, G, GG).',
      'Linha 7: a ordem OP-203 não tem quantidade em nenhum tamanho.',
      'Linha 8: a ordem OP-200 aparece duas vezes no arquivo.',
    ]);
  });

  it('arquivo vazio, sem a coluna do código, com linha a mais de colunas', () => {
    expect(importarOrdensCsv('  \n', CONTEXTO).erros).toEqual(['O arquivo está vazio.']);
    expect(importarOrdensCsv('produto;P\nCamiseta;1', CONTEXTO).erros).toEqual(['O cabeçalho não tem a coluna "codigo".']);
    expect(importarOrdensCsv('codigo;P\nOP-9;1;2', CONTEXTO).erros).toEqual(['Linha 2: tem 3 colunas, e o cabeçalho, 2.']);
    expect(importarOrdensCsv('codigo;P', CONTEXTO).erros).toEqual(['O arquivo não tem nenhuma ordem (só o cabeçalho).']);
    expect(lerCsv('codigo;codigo\nA;B').erros).toEqual(['O cabeçalho tem coluna repetida: codigo.']);
  });

  it('uma fonte externa (ERP) passa pela mesma conferência', () => {
    const r = ordensDasLinhas([{ numero: 1, valores: { codigo: 'ERP-1', P: '2', M: 'x' } }], CONTEXTO);
    expect(r.erros).toEqual(['Linha 1: a quantidade do tamanho M ("x") não é um número inteiro.']);
  });
});

import { describe, expect, it } from 'vitest';
import type { MalhaDoCadastro } from './cadastroDeProducao';
import {
  BIBLIOTECA_VAZIA,
  csvDosMateriais,
  lerBibliotecaDeMateriais,
  materiaisNaOrdem,
  PADROES_DE_CUSTO_INICIAIS,
  precoEscrito,
  problemaDosPadroes,
  procurarMateriais,
  removerMaterial,
  salvarMaterial,
  salvarPadroesDeCusto,
  trazerMalhasDoCadastro,
  validarMaterial,
  type Material,
} from './materiais';

const material = (extras: Partial<Material> = {}): Material => ({
  id: 'm1',
  codigo: 'BOT-12',
  descricao: 'Botão de pressão 12 mm',
  categoria: 'aviamento',
  unidade: 'un',
  precoPorUnidade: 0.35,
  atualizadoEmIso: '2026-10-01T10:00:00.000Z',
  ...extras,
});

describe('a biblioteca de materiais', () => {
  it('guarda o material novo e o mudado; o preço trocado vai para os anteriores, com a hora', () => {
    let b = salvarMaterial(BIBLIOTECA_VAZIA, material(), '2026-10-01T10:00:00.000Z');
    expect(b.materiais).toHaveLength(1);
    b = salvarMaterial(b, { ...material(), precoPorUnidade: 0.4 }, '2026-10-20T09:00:00.000Z');
    expect(b.materiais[0]).toMatchObject({ precoPorUnidade: 0.4, atualizadoEmIso: '2026-10-20T09:00:00.000Z', precosAnteriores: [{ precoPorUnidade: 0.35, ateIso: '2026-10-20T09:00:00.000Z' }] });
    b = salvarMaterial(b, { ...b.materiais[0]!, cor: 'Preto' }, '2026-10-21T09:00:00.000Z');
    expect(b.materiais[0]!.precosAnteriores).toHaveLength(1);
    b = salvarMaterial(b, { ...b.materiais[0]!, precoPorUnidade: null }, '2026-10-22T09:00:00.000Z');
    expect(b.materiais[0]!.precosAnteriores!.map((p) => p.precoPorUnidade)).toEqual([0.4, 0.35]);
  });

  it('recusa sem descrição, com o código de outro, com preço negativo, largura ou gramatura zero', () => {
    const b = salvarMaterial(BIBLIOTECA_VAZIA, material(), 'x');
    expect(validarMaterial({ ...material({ id: 'm2', descricao: '  ' }) }, b.materiais)).toContain('A descrição do material é obrigatória.');
    expect(() => salvarMaterial(b, material({ id: 'm2', codigo: ' bot-12 ' }), 'x')).toThrow(/O código bot-12 já é de outro material/);
    expect(() => salvarMaterial(b, material({ id: 'm2', codigo: '', precoPorUnidade: -1 }), 'x')).toThrow(/preço/);
    expect(validarMaterial(material({ categoria: 'tecido', unidade: 'm', larguraMm: 0, gramaturaGm2: 0 }), [])).toEqual(['A largura precisa ser maior que zero.', 'A gramatura precisa ser maior que zero.']);
    // Dois sem código não brigam.
    expect(validarMaterial(material({ id: 'm3', codigo: '' }), [material({ id: 'm4', codigo: '' })])).toEqual([]);
  });

  it('a ordem por categoria e descrição; a busca sem acento e sem maiúscula', () => {
    const lista = [
      material({ id: 'a', descricao: 'Zíper invisível', codigo: 'Z1' }),
      material({ id: 'b', descricao: 'Malha algodão', categoria: 'tecido', unidade: 'kg', codigo: 'T1', composicao: '100% algodão' }),
      material({ id: 'c', descricao: 'Caixa', categoria: 'embalagem', codigo: 'E1' }),
      material({ id: 'd', descricao: 'Botão', codigo: 'B1', fornecedor: 'Aviamentos São João' }),
    ];
    expect(materiaisNaOrdem(lista).map((m) => m.id)).toEqual(['b', 'd', 'a', 'c']);
    expect(procurarMateriais(lista, 'ALGODAO').map((m) => m.id)).toEqual(['b']);
    expect(procurarMateriais(lista, 'sao joao').map((m) => m.id)).toEqual(['d']);
    expect(procurarMateriais(lista, '').map((m) => m.id)).toEqual(['b', 'd', 'a', 'c']);
  });

  it('remover; o preço escrito', () => {
    const b = salvarMaterial(BIBLIOTECA_VAZIA, material(), 'x');
    expect(removerMaterial(b, 'm1').materiais).toEqual([]);
    expect(precoEscrito(material())).toBe('R$ 0,35/un');
    expect(precoEscrito(material({ unidade: 'm2', precoPorUnidade: 12 }))).toBe('R$ 12,00/m²');
    expect(precoEscrito(material({ precoPorUnidade: null }))).toBe('sem preço');
  });

  it('os padrões de custo: números de 0 para cima; impostos + comissão + margem abaixo de 100%', () => {
    expect(problemaDosPadroes(PADROES_DE_CUSTO_INICIAIS)).toBeNull();
    expect(problemaDosPadroes({ ...PADROES_DE_CUSTO_INICIAIS, custoDoMinuto: -1 })).toMatch(/custo do minuto/);
    expect(problemaDosPadroes({ ...PADROES_DE_CUSTO_INICIAIS, impostosPercentual: 20, comissaoPercentual: 5, margemPercentual: 75 })).toMatch(/abaixo de 100%/);
    const b = salvarPadroesDeCusto(BIBLIOTECA_VAZIA, { custoDoMinuto: 0.45, indiretosPercentual: 15, impostosPercentual: 12, comissaoPercentual: 3, margemPercentual: 20 });
    expect(b.padroesDeCusto.custoDoMinuto).toBe(0.45);
    expect(() => salvarPadroesDeCusto(b, { ...b.padroesDeCusto, margemPercentual: -2 })).toThrow(/margem/);
  });

  it('as malhas do cadastro de produção entram como tecidos, uma vez só', () => {
    const malhas: MalhaDoCadastro[] = [
      { id: 'k1', descricao: 'Malha PV', composicao: '67% poliéster 33% viscose', larguraUtilMm: 1700, gramaturaGm2: 180, tubular: false, sentidoUnico: false, padrao: 'liso', encolhimentoCompensadoNoMolde: false, custo: { valor: 38.9, unidade: 'kg', moeda: 'BRL' } },
      { id: 'k2', descricao: 'Ribana', larguraUtilMm: 900, tubular: true, sentidoUnico: false, padrao: 'liso', encolhimentoCompensadoNoMolde: false, custo: { valor: 12.5, unidade: 'metro-linear', moeda: 'BRL' } },
      { id: 'k3', descricao: 'Moletom', larguraUtilMm: 1800, tubular: false, sentidoUnico: false, padrao: 'liso', encolhimentoCompensadoNoMolde: false },
    ];
    let n = 0;
    const primeira = trazerMalhasDoCadastro(BIBLIOTECA_VAZIA, malhas, () => `t${++n}`, 'x');
    expect(primeira.trazidas).toBe(3);
    expect(primeira.biblioteca.materiais.map((m) => [m.descricao, m.unidade, m.precoPorUnidade, m.larguraMm, m.gramaturaGm2 ?? null])).toEqual([
      ['Malha PV', 'kg', 38.9, 1700, 180],
      ['Ribana', 'm', 12.5, 900, null],
      ['Moletom', 'm', null, 1800, null],
    ]);
    expect(trazerMalhasDoCadastro(primeira.biblioteca, malhas, () => `t${++n}`, 'x').trazidas).toBe(0);
  });

  it('o CSV: ponto e vírgula, vírgula decimal, na ordem', () => {
    const b = salvarMaterial(salvarMaterial(BIBLIOTECA_VAZIA, material(), 'x'), material({ id: 'm2', codigo: 'T1', descricao: 'Tricoline', categoria: 'tecido', unidade: 'm', precoPorUnidade: 18.9, larguraMm: 1480 }), 'x');
    const linhas = csvDosMateriais(b.materiais).trim().split('\r\n');
    expect(linhas[0]).toBe('Código;Descrição;Categoria;Unidade;Preço (R$);Fornecedor;Cor;Composição;Largura (mm);Gramatura (g/m²);Atualizado em;Observações');
    expect(linhas[1]!.split(';').slice(0, 9)).toEqual(['T1', 'Tricoline', 'Tecido', 'm', '18,90', '', '', '', '1480']);
    expect(linhas[2]!.split(';').slice(0, 5)).toEqual(['BOT-12', 'Botão de pressão 12 mm', 'Aviamento', 'un', '0,35']);
  });

  it('o arquivo: ida e volta; o material quebrado fica de fora com o motivo; a versão mais nova', () => {
    const b = salvarPadroesDeCusto(salvarMaterial(BIBLIOTECA_VAZIA, material(), 'x'), { ...PADROES_DE_CUSTO_INICIAIS, custoDoMinuto: 0.5 });
    const bruto = JSON.parse(JSON.stringify(b)) as { materiais: unknown[] };
    bruto.materiais.push({ id: 'z' }, { ...material({ id: 'y', codigo: 'BOT-12' }) });
    const lida = lerBibliotecaDeMateriais(bruto);
    expect(lida.biblioteca).toEqual(b);
    expect(lida.descartados).toEqual([
      'O material 2 da biblioteca ficou de fora: faltam o código, a descrição ou a data.',
      'O material 3 da biblioteca (Botão de pressão 12 mm) ficou de fora: O código BOT-12 já é de outro material.',
    ]);
    expect(lerBibliotecaDeMateriais(null)).toEqual({ biblioteca: BIBLIOTECA_VAZIA, descartados: [], maisNova: false });
    expect(lerBibliotecaDeMateriais({ versaoDoFormato: 5, materiais: [] }).maisNova).toBe(true);
    // Padrões que não fecham voltam aos iniciais.
    expect(lerBibliotecaDeMateriais({ materiais: [], padroesDeCusto: { margemPercentual: 150 } }).biblioteca.padroesDeCusto).toEqual(PADROES_DE_CUSTO_INICIAIS);
  });
});

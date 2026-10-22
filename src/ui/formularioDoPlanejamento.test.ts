import { describe, expect, it } from 'vitest';
import { CONFIGURACAO_PADRAO_DO_PLANEJAMENTO } from '../domain/planoDeEnfesto';
import {
  configuracaoDoFormulario,
  configuracaoNoFormulario,
  MALHA_VAZIA,
  malhaDoFormulario,
  malhaDoTecido,
  malhaNoFormulario,
  ORDEM_VAZIA,
  ordemDoFormulario,
  ROLO_VAZIO,
  roloDoFormulario,
} from './formularioDoPlanejamento';
import { criarTecido } from '../domain/tecido';

describe('formulários do planejamento', () => {
  it('a malha: m e vírgula na tela, mm no cálculo; o que falta é dito pelo nome do campo, com a unidade', () => {
    const { malha, erros } = malhaDoFormulario({ ...MALHA_VAZIA, descricao: 'Malha', larguraUtil: '1,6', larguraNominal: '1,72', gramatura: '310', rendimento: '2,5', encolhimentoComprimento: '0' }, 'm1');
    expect(erros).toEqual([]);
    expect(malha).toEqual({
      id: 'm1',
      descricao: 'Malha',
      larguraUtilMm: 1600,
      larguraNominalMm: 1720,
      gramaturaGm2: 310,
      rendimentoMmPorG: 2.5,
      encolhimentoComprimentoPercentual: 0,
      tubular: false,
      sentidoUnico: false,
      padrao: 'liso',
      encolhimentoCompensadoNoMolde: false,
    });
    expect(malhaNoFormulario(malha!)).toMatchObject({ larguraUtil: '1,6', larguraNominal: '1,72', rendimento: '2,5' });
    expect(malhaDoFormulario({ ...MALHA_VAZIA, larguraUtil: 'x', gramatura: '-3' }, 'm').erros).toEqual([
      'Preencha "Descrição da malha".',
      '"Largura útil (m)" precisa ser um número.',
      '"Gramatura (g/m²)" precisa ser maior que zero.',
    ]);
  });

  it('a malha a partir do tecido do projeto: largura, gramatura, sentido e padrão', () => {
    const tecido = criarTecido({ nome: 'Moletom', referencia: 'R1', larguraTotalMm: 1800, larguraUtilMm: 1700, gramaturaGm2: 320, temPelo: true, padrao: 'listrado' }, 't1');
    expect(malhaDoTecido(tecido)).toMatchObject({ descricao: 'Moletom', larguraUtil: '1,7', larguraNominal: '1,8', gramatura: '320', sentidoUnico: true, padrao: 'listrado', rendimento: '' });
    // Sem o tipo e o custo no tecido, eles ficam sem informar na malha do plano.
    expect(malhaDoTecido(tecido)).toMatchObject({ tipoDeTecido: '', custo: '', unidadeDoCusto: '' });
  });

  it('o tecido do projeto com o tipo, o custo e o rendimento leva os três para a malha do plano', () => {
    const tecido = criarTecido(
      { nome: 'Ribana', referencia: 'R2', larguraTotalMm: 950, larguraUtilMm: 900, tipoDeTecido: 'tubular', custo: { valor: 41.9, unidade: 'kg', moeda: 'BRL' }, rendimentoMmPorG: 3.2 },
      't2',
    );
    const formulario = malhaDoTecido(tecido);
    expect(formulario).toMatchObject({ tipoDeTecido: 'tubular', custo: '41,9', unidadeDoCusto: 'kg', rendimento: '3,2' });
    expect(malhaDoFormulario(formulario, 'malha-do-plano').malha).toMatchObject({ tubular: true, tipoDeTecido: 'tubular', custo: { valor: 41.9, unidade: 'kg', moeda: 'BRL' }, rendimentoMmPorG: 3.2 });
  });

  it('a malha: o tipo de tecido e o custo vão e voltam; vazios, ficam sem informar (e a malha é aberta, como antes)', () => {
    const base = { ...MALHA_VAZIA, descricao: 'Malha', larguraUtil: '1,6' };
    const vazia = malhaDoFormulario(base, 'm1');
    expect(vazia.erros).toEqual([]);
    expect(vazia.malha).not.toHaveProperty('tipoDeTecido');
    expect(vazia.malha).not.toHaveProperty('custo');
    expect(vazia.malha!.tubular).toBe(false);

    const cheia = malhaDoFormulario({ ...base, tipoDeTecido: 'ramado', custo: '32,50', unidadeDoCusto: 'metro-linear' }, 'm1');
    expect(cheia.malha).toMatchObject({ tubular: false, tipoDeTecido: 'ramado', custo: { valor: 32.5, unidade: 'metro-linear', moeda: 'BRL' } });
    expect(malhaNoFormulario(cheia.malha!)).toMatchObject({ tipoDeTecido: 'ramado', custo: '32,5', unidadeDoCusto: 'metro-linear' });

    const tubular = malhaDoFormulario({ ...base, tipoDeTecido: 'tubular' }, 'm1');
    expect(tubular.malha).toMatchObject({ tubular: true, tipoDeTecido: 'tubular' });
  });

  it('a malha de antes (só "tubular", sem o tipo) aparece como tubular; a não marcada, como não informado', () => {
    const antiga = malhaDoFormulario({ ...MALHA_VAZIA, descricao: 'Malha', larguraUtil: '1,6' }, 'm1').malha!;
    expect(malhaNoFormulario(antiga).tipoDeTecido).toBe('');
    expect(malhaNoFormulario({ ...antiga, tubular: true }).tipoDeTecido).toBe('tubular');
  });

  it('a malha: o custo inválido ou sem a unidade é dito, e a malha não sai', () => {
    const base = { ...MALHA_VAZIA, descricao: 'Malha', larguraUtil: '1,6' };
    expect(malhaDoFormulario({ ...base, custo: '-3', unidadeDoCusto: 'kg' }, 'm1')).toEqual({ malha: null, erros: ['O custo do tecido não pode ser negativo.'] });
    expect(malhaDoFormulario({ ...base, custo: '3,333', unidadeDoCusto: 'kg' }, 'm1').erros).toEqual(['O custo do tecido pode ter no máximo 2 casas decimais (os centavos).']);
    expect(malhaDoFormulario({ ...base, custo: '30' }, 'm1').erros).toEqual(['Diga se o custo do tecido é por metro linear ou por quilo.']);
    expect(malhaDoFormulario({ ...base, custo: 'R$ 30', unidadeDoCusto: 'kg' }, 'm1').erros[0]).toContain('precisa ser um número');
  });

  it('o rolo: kg e m na tela; precisa do peso ou do comprimento; o defeito precisa da perda', () => {
    const { rolo } = roloDoFormulario({ ...ROLO_VAZIO, identificacao: 'R-1', peso: '24,5', largura: '1,58', lote: 'L7', defeito: 'mancha', perdaDoDefeito: '0,8', data: '2026-10-20' }, 'r1', 'm1');
    expect(rolo).toMatchObject({ pesoLiquidoG: 24_500, larguraUtilMedidaMm: 1580, lote: 'L7', defeitos: [{ descricao: 'mancha', perdaMm: 800 }], dataDaMedicao: '2026-10-20', unidadeDoPeso: 'kg' });
    expect(roloDoFormulario({ ...ROLO_VAZIO, identificacao: 'R-2' }, 'r', 'm').erros).toEqual(['Informe o peso líquido (kg) ou o comprimento medido (m) do rolo.']);
    expect(roloDoFormulario({ ...ROLO_VAZIO, identificacao: 'R-2', peso: '10', defeito: 'furo' }, 'r', 'm').erros).toEqual(['Informe a extensão do defeito no comprimento do rolo (m).']);
    const comPosicao = roloDoFormulario({ ...ROLO_VAZIO, identificacao: 'R-3', peso: '10', defeito: 'furo', perdaDoDefeito: '0,3', posicaoDoDefeito: '12,5', larguraDoDefeito: '4', tipoDoDefeito: 'furo' }, 'r', 'm').rolo;
    expect(comPosicao?.defeitos).toEqual([{ descricao: 'furo', perdaMm: 300, posicaoMm: 12_500, larguraAfetadaMm: 40, tipo: 'furo' }]);
  });

  it('a malha: a fonte do encolhimento e a repetição e a fase do desenho (cm na tela, mm no cálculo)', () => {
    const { malha } = malhaDoFormulario({ ...MALHA_VAZIA, descricao: 'Listrada', larguraUtil: '1,6', fonteDoEncolhimento: 'fornecedor', rapportComprimento: '12,5', faseComprimento: '3', rapportLargura: '', faseLargura: '0' }, 'm');
    expect(malha).toMatchObject({ fonteDoEncolhimento: 'fornecedor', rapportComprimentoMm: 125, faseComprimentoMm: 30, faseLarguraMm: 0 });
    expect(malha && 'rapportLarguraMm' in malha).toBe(false);
    expect(malhaNoFormulario(malha!)).toMatchObject({ rapportComprimento: '12,5', faseComprimento: '3', fonteDoEncolhimento: 'fornecedor' });
  });

  it('a ordem: quantidades inteiras; ao menos um tamanho', () => {
    expect(ordemDoFormulario({ ...ORDEM_VAZIA, codigo: ' OP-9 ', cor: 'Azul', quantidades: { P: '10', M: '', G: '0' } })).toEqual({ ordem: { codigo: 'OP-9', cor: 'Azul', quantidadesPorTamanho: { P: 10, G: 0 } }, erros: [] });
    expect(ordemDoFormulario({ ...ORDEM_VAZIA, codigo: 'OP', quantidades: { P: '2,5' } }).erros).toEqual(['"Quantidade do P" precisa ser um número inteiro.']);
    expect(ordemDoFormulario({ ...ORDEM_VAZIA, codigo: 'OP', quantidades: { P: '0' } }).erros).toEqual(['Informe a quantidade de pelo menos um tamanho.']);
  });

  it('a configuração vai e volta (cm, m, kg na tela)', () => {
    const com = { ...CONFIGURACAO_PADRAO_DO_PLANEJAMENTO, alturaMaximaDoEnfestoMm: 150, pesoMaximoDoEnfestoG: 40_000, larguraDaMesaMm: 1800 };
    const f = configuracaoNoFormulario(com);
    expect(f).toMatchObject({ margemInicial: '10', sobra: '2', alturaMaxima: '15', pesoMaximo: '40', comprimentoDaMesa: '12', larguraDaMesa: '1,8' });
    expect(configuracaoDoFormulario(f)).toEqual({ configuracao: com, erros: [] });
    expect(configuracaoDoFormulario({ ...f, folhas: '2,5', comprimentoDaMesa: '' }).erros).toEqual(['"Folhas por enfesto (máximo)" precisa ser um número inteiro.', 'Preencha "Comprimento da mesa (m)".']);
  });
});

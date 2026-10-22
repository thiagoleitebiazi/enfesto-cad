import { describe, it, expect } from 'vitest';
import {
  criarTecido,
  ehCustoDoTecido,
  lerCustoDoTecido,
  problemaDoCusto,
  sentidoUnicoDoTecido,
  tecidoExigeRespeitoDeOrientacao,
  type DadosDeNovoTecido,
} from './tecido';

describe('lerCustoDoTecido — o custo digitado', () => {
  it('vazio é "não informado": sem custo e sem erro, qualquer que seja a unidade', () => {
    expect(lerCustoDoTecido('', '')).toEqual({});
    expect(lerCustoDoTecido('   ', 'kg')).toEqual({});
  });

  it('com vírgula ou ponto nos centavos, em reais, na unidade escolhida', () => {
    expect(lerCustoDoTecido('32,50', 'metro-linear')).toEqual({ custo: { valor: 32.5, unidade: 'metro-linear', moeda: 'BRL' } });
    expect(lerCustoDoTecido('41.9', 'kg')).toEqual({ custo: { valor: 41.9, unidade: 'kg', moeda: 'BRL' } });
    expect(lerCustoDoTecido(' 12 ', 'kg')).toEqual({ custo: { valor: 12, unidade: 'kg', moeda: 'BRL' } });
    expect(lerCustoDoTecido('0', 'metro-linear')).toEqual({ custo: { valor: 0, unidade: 'metro-linear', moeda: 'BRL' } });
  });

  it('negativo, com mais de 2 casas, ou o que não é um número simples: erro com o motivo, nada convertido', () => {
    expect(lerCustoDoTecido('-5', 'kg').erro).toBe('O custo do tecido não pode ser negativo.');
    expect(lerCustoDoTecido('12,345', 'kg').erro).toBe('O custo do tecido pode ter no máximo 2 casas decimais (os centavos).');
    // "1.234" pode ser mil duzentos e trinta e quatro (ponto de milhar) ou 1,234: com 3 casas, é recusado.
    expect(lerCustoDoTecido('1.234', 'kg').erro).toContain('no máximo 2 casas decimais');
    for (const texto of ['R$ 12', '1.234,56', 'doze', '12,', 'Infinity', 'NaN', '1e3', '12 reais']) {
      expect(lerCustoDoTecido(texto, 'kg').erro, texto).toContain('precisa ser um número');
    }
  });

  it('com valor e sem a unidade, não presume a unidade', () => {
    expect(lerCustoDoTecido('32,50', '').erro).toBe('Diga se o custo do tecido é por metro linear ou por quilo.');
  });
});

describe('problemaDoCusto — o custo guardado', () => {
  it('aceita só número finito, de 0 para cima, com até 2 casas, com a unidade e em reais', () => {
    expect(problemaDoCusto({ valor: 10.25, unidade: 'kg', moeda: 'BRL' })).toBeNull();
    expect(problemaDoCusto({ valor: -1, unidade: 'kg', moeda: 'BRL' })).toBe('O custo do tecido não pode ser negativo.');
    expect(problemaDoCusto({ valor: Number.NaN, unidade: 'kg', moeda: 'BRL' })).toBe('O custo do tecido precisa ser um número.');
    expect(problemaDoCusto({ valor: Number.POSITIVE_INFINITY, unidade: 'kg', moeda: 'BRL' })).toBe('O custo do tecido precisa ser um número.');
    expect(problemaDoCusto({ valor: '10', unidade: 'kg', moeda: 'BRL' })).toBe('O custo do tecido precisa ser um número.');
    expect(problemaDoCusto({ valor: 1.005, unidade: 'kg', moeda: 'BRL' })).toContain('no máximo 2 casas decimais');
    expect(problemaDoCusto({ valor: 10, unidade: 'm2', moeda: 'BRL' })).toBe('Diga se o custo do tecido é por metro linear ou por quilo.');
    expect(problemaDoCusto({ valor: 10, unidade: 'kg', moeda: 'USD' })).toBe('O custo do tecido precisa estar em reais (R$).');
    expect(problemaDoCusto(null)).toBe('O custo do tecido não pôde ser lido.');
    expect(ehCustoDoTecido({ valor: 0.1 + 0.2, unidade: 'kg', moeda: 'BRL' })).toBe(true); // 0,30 com o erro do ponto flutuante
  });
});

describe('criarTecido — o tipo, o custo e o rendimento (opcionais)', () => {
  const base: DadosDeNovoTecido = { nome: 'Malha', referencia: 'M1', larguraTotalMm: 1600, larguraUtilMm: 1500 };

  it('sem eles, o tecido é como antes (nenhum campo novo aparece)', () => {
    const tecido = criarTecido(base, 't');
    expect('tipoDeTecido' in tecido || 'custo' in tecido || 'rendimentoMmPorG' in tecido).toBe(false);
  });

  it('com eles, guarda como foram informados', () => {
    const tecido = criarTecido({ ...base, tipoDeTecido: 'tubular', custo: { valor: 41.9, unidade: 'kg', moeda: 'BRL' }, rendimentoMmPorG: 3.2 }, 't');
    expect(tecido).toMatchObject({ tipoDeTecido: 'tubular', custo: { valor: 41.9, unidade: 'kg', moeda: 'BRL' }, rendimentoMmPorG: 3.2 });
  });

  it('recusa o custo inválido, o rendimento zero ou negativo e o tipo desconhecido, dizendo o motivo', () => {
    expect(() => criarTecido({ ...base, custo: { valor: -2, unidade: 'kg', moeda: 'BRL' } }, 't')).toThrow('O custo do tecido não pode ser negativo.');
    expect(() => criarTecido({ ...base, custo: { valor: 2.345, unidade: 'kg', moeda: 'BRL' } }, 't')).toThrow('no máximo 2 casas decimais');
    expect(() => criarTecido({ ...base, rendimentoMmPorG: 0 }, 't')).toThrow('o rendimento precisa ser > 0');
    expect(() => criarTecido({ ...base, rendimentoMmPorG: Number.NaN }, 't')).toThrow('o rendimento precisa ser > 0');
    expect(() => criarTecido({ ...base, tipoDeTecido: 'aberto' as never }, 't')).toThrow('ramado ou tubular');
  });
});

function dadosBase(sobrescrever: Partial<DadosDeNovoTecido> = {}): DadosDeNovoTecido {
  return {
    nome: 'Malha algodão',
    referencia: 'TEC-001',
    larguraTotalMm: 1600,
    larguraUtilMm: 1500,
    ...sobrescrever,
  };
}

describe('criarTecido', () => {
  it('cria um tecido válido com valores padrão', () => {
    const tecido = criarTecido(dadosBase(), 't1');
    expect(tecido.direcional).toBe(false);
    expect(tecido.temPelo).toBe(false);
    expect(tecido.padrao).toBe('liso');
    expect(tecido.composicao).toBeUndefined();
  });

  it('aceita composição, observações e padrão explícitos', () => {
    const tecido = criarTecido(
      dadosBase({ composicao: '100% algodão', observacoes: 'lote 42', padrao: 'listrado', direcional: true }),
      't2',
    );
    expect(tecido.composicao).toBe('100% algodão');
    expect(tecido.observacoes).toBe('lote 42');
    expect(tecido.padrao).toBe('listrado');
    expect(tecido.direcional).toBe(true);
  });

  it('rejeita largura total <= 0', () => {
    expect(() => criarTecido(dadosBase({ larguraTotalMm: 0 }), 't3')).toThrow(/largura total/);
  });

  it('rejeita largura útil <= 0', () => {
    expect(() => criarTecido(dadosBase({ larguraUtilMm: -10 }), 't4')).toThrow(/largura útil/);
  });

  it('rejeita largura útil maior que a largura total', () => {
    expect(() => criarTecido(dadosBase({ larguraTotalMm: 1000, larguraUtilMm: 1200 }), 't5')).toThrow(
      /maior que a largura total/,
    );
  });

  it('gramatura e quantidade em estoque são opcionais (undefined por padrão)', () => {
    const tecido = criarTecido(dadosBase(), 't6');
    expect(tecido.gramaturaGm2).toBeUndefined();
    expect(tecido.quantidadeDisponivelKg).toBeUndefined();
  });

  it('aceita gramatura e quantidade em estoque válidas', () => {
    const tecido = criarTecido(dadosBase({ gramaturaGm2: 180, quantidadeDisponivelKg: 50 }), 't7');
    expect(tecido.gramaturaGm2).toBe(180);
    expect(tecido.quantidadeDisponivelKg).toBe(50);
  });

  it('rejeita gramatura <= 0 quando informada', () => {
    expect(() => criarTecido(dadosBase({ gramaturaGm2: 0 }), 't8')).toThrow(/gramatura/);
    expect(() => criarTecido(dadosBase({ gramaturaGm2: -5 }), 't9')).toThrow(/gramatura/);
  });

  it('rejeita quantidade em estoque <= 0 quando informada', () => {
    expect(() => criarTecido(dadosBase({ quantidadeDisponivelKg: 0 }), 't10')).toThrow(/estoque/);
    expect(() => criarTecido(dadosBase({ quantidadeDisponivelKg: -1 }), 't11')).toThrow(/estoque/);
  });
});

describe('tecidoExigeRespeitoDeOrientacao', () => {
  it('falso para tecido liso, sem pelo, não direcional', () => {
    expect(tecidoExigeRespeitoDeOrientacao(criarTecido(dadosBase(), 't1'))).toBe(false);
  });

  it('verdadeiro quando direcional', () => {
    expect(tecidoExigeRespeitoDeOrientacao(criarTecido(dadosBase({ direcional: true }), 't2'))).toBe(true);
  });

  it('verdadeiro quando tem pelo', () => {
    expect(tecidoExigeRespeitoDeOrientacao(criarTecido(dadosBase({ temPelo: true }), 't3'))).toBe(true);
  });

  it('verdadeiro quando padrão é listrado ou xadrez', () => {
    expect(tecidoExigeRespeitoDeOrientacao(criarTecido(dadosBase({ padrao: 'listrado' }), 't4'))).toBe(true);
    expect(tecidoExigeRespeitoDeOrientacao(criarTecido(dadosBase({ padrao: 'xadrez' }), 't5'))).toBe(true);
  });
});

describe('sentidoUnicoDoTecido', () => {
  const base: DadosDeNovoTecido = { nome: 'T', referencia: '', larguraTotalMm: 1500, larguraUtilMm: 1500 };
  it('diz o que dá sentido ao tecido, ou nada', () => {
    expect(sentidoUnicoDoTecido(null)).toBeNull();
    expect(sentidoUnicoDoTecido(criarTecido(base, 't'))).toBeNull();
    expect(sentidoUnicoDoTecido(criarTecido({ ...base, temPelo: true }, 't'))).toBe('tem pelo');
    expect(sentidoUnicoDoTecido(criarTecido({ ...base, direcional: true }, 't'))).toBe('tem estampa direcional');
    expect(sentidoUnicoDoTecido(criarTecido({ ...base, direcional: true, temPelo: true }, 't'))).toBe('tem pelo e estampa direcional');
  });
});

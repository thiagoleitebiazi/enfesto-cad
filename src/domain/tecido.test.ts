import { describe, it, expect } from 'vitest';
import { criarTecido, tecidoExigeRespeitoDeOrientacao, type DadosDeNovoTecido } from './tecido';

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

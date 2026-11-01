import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { comEmendaClicada, comLinhaClicada, criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from './enfesto';
import { criarMolde, type Molde } from './molde';
import { comAjusteDoTecido, comLarguraDoTecido, comPecasMudadas, enfestoDoTecido, juntarAoEncaixe, pecasDoRisco, pecasDoTecido, separarParaOEncaixe } from './tecidosDoModelo';

const enfesto = (): ConfiguracaoDeEnfesto => criarConfiguracaoDeEnfesto({ tipo: 'impar', larguraUtilMm: 1000, comprimentoMm: 3000, quantidadeDeCamadas: 1, margemLateralMm: 0, margemDeExtremidadeMm: 0, distanciaMinimaEntrePecasMm: 0 });

const peca = (id: string, tecidoDoMolde?: string): Molde => ({
  ...criarMolde({ nome: id, referencia: '', tamanho: 'M', quantidade: 1, contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 200), ponto(0, 200)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 180) }, restricaoDeRotacao: { permite180: true, permite90e270: false } }, id),
  ...(tecidoDoMolde ? { tecidoDoMolde } : {}),
});

describe('o tecido ativo (ADR 0209)', () => {
  it('a mesa mostra só as peças dele; em branco, todas', () => {
    const pecas = [peca('a'), peca('b', 'Forro')];
    expect(pecasDoTecido(pecas, 'Forro').map((p) => p.id)).toEqual(['b']);
    expect(pecasDoTecido(pecas, 'Principal').map((p) => p.id)).toEqual(['a']);
    expect(pecasDoTecido(pecas, '')).toBe(pecas);
  });

  it('cada tecido pode ter a sua largura, e o resto do enfesto é o mesmo', () => {
    const e = comLarguraDoTecido(enfesto(), 'Forro', 1400);
    expect(enfestoDoTecido(e, 'Forro')).toMatchObject({ larguraUtilMm: 1400, comprimentoMm: 3000 });
    expect(enfestoDoTecido(e, 'Principal').larguraUtilMm).toBe(1000);
    expect(enfestoDoTecido(e, '').larguraUtilMm).toBe(1000);
  });

  it('as peças mudadas voltam para a lista inteira, sem mexer nas outras', () => {
    const [a, b] = [peca('a'), peca('b', 'Forro')];
    const nova = { ...b, quantidade: 7 };
    expect(comPecasMudadas([a, b], [nova])).toEqual([a, nova]);
  });

  it('no encaixe do tecido ativo, os outros tecidos ficam onde estão', () => {
    const [a, b, c] = [peca('a'), peca('b', 'Forro'), { ...peca('c', 'Forro'), naoUsar: true as const }];
    const s = separarParaOEncaixe([a, b, c], { tecido: 'Forro', manterOutrosTecidos: true }, enfesto());
    expect(s.paraEncaixar.map((p) => p.id)).toEqual(['b']);
    expect(s.deOutrosTecidos.map((p) => p.id)).toEqual(['a']);
    expect(s.foraDoEncaixe.map((p) => p.id)).toEqual(['c']);
    const juntas = juntarAoEncaixe(s.paraEncaixar, [...s.fixas, ...s.deOutrosTecidos], s.foraDoEncaixe, enfesto());
    expect(juntas.find((p) => p.id === 'a')!.contorno).toEqual(a.contorno);
  });

  it('sem o tecido ativo, a escolha de um tecido segue tirando os outros da mesa', () => {
    const s = separarParaOEncaixe([peca('a'), peca('b', 'Forro')], { tecido: 'Forro' }, enfesto());
    expect(s.foraDoEncaixe.map((p) => p.id)).toEqual(['a']);
    expect(s.deOutrosTecidos).toEqual([]);
  });
});

describe('o que vai para o risco (ADR 0218)', () => {
  it('a peça depois do fim da mesa não sai', () => {
    const fora = { ...peca('b'), contorno: peca('b').contorno.map((p) => ponto(p.x, p.y + 4000)) };
    expect(pecasDoRisco([peca('a'), fora], enfesto()).map((p) => p.id)).toEqual(['a']);
  });

  it('sem enfesto, não há mesa: todas saem', () => {
    const lista = [peca('a')];
    expect(pecasDoRisco(lista, null)).toBe(lista);
  });
});

describe('a emenda clicada na mesa (ADR 0220)', () => {
  it('entra na ordem, e arredondada', () => {
    const r = comEmendaClicada(comEmendaClicada(enfesto(), 2000.4), 1000);
    expect(r.emendasMm).toEqual([1000, 2000]);
  });

  it('o clique perto de uma emenda tira ela', () => {
    expect(comEmendaClicada({ ...enfesto(), emendasMm: [1000, 2000] }, 1010).emendasMm).toEqual([2000]);
  });

  it('o clique fora da mesa não muda nada', () => {
    const e = enfesto();
    expect(comEmendaClicada(e, 3500)).toBe(e);
    expect(comEmendaClicada(e, -5)).toBe(e);
  });
});

describe('cada tecido com a sua mesa (ADR 0221)', () => {
  it('o comprimento, as emendas e os textos valem só nele', () => {
    const e = comAjusteDoTecido(enfesto(), 'Forro', { comprimentoMm: 1500, emendasMm: [700] });
    expect(enfestoDoTecido(e, 'Forro')).toMatchObject({ comprimentoMm: 1500, emendasMm: [700] });
    expect(enfestoDoTecido(e, 'Principal').comprimentoMm).toBe(3000);
    expect(enfestoDoTecido(e, 'Principal').emendasMm).toBeUndefined();
  });

  it('sem tecido ativo, grava na mesa do projeto', () => {
    expect(comAjusteDoTecido(enfesto(), '', { emendasMm: [500] }).emendasMm).toEqual([500]);
  });

  it('um ajuste não apaga o outro', () => {
    const e = comAjusteDoTecido(comAjusteDoTecido(enfesto(), 'Forro', { comprimentoMm: 1500 }), 'Forro', { emendasMm: [700] });
    expect(enfestoDoTecido(e, 'Forro')).toMatchObject({ comprimentoMm: 1500, emendasMm: [700] });
  });
});

describe('a linha de referência clicada na mesa (ADR 0221)', () => {
  const modelo = { nome: 'Corte', referencia: 'esquerda' as const, evitarSobreposicao: true };

  it('na largura, vale o comprimento do clique; ao longo, a largura dele', () => {
    expect(comLinhaClicada(enfesto(), { x: 200, y: 1200.4 }, modelo).linhasDeReferencia).toEqual([{ nome: 'Corte', distanciaMm: 1200, referencia: 'esquerda', evitarSobreposicao: true }]);
    expect(comLinhaClicada(enfesto(), { x: 200, y: 1200 }, { ...modelo, referencia: 'superior', evitarSobreposicao: false }).linhasDeReferencia).toEqual([{ nome: 'Corte', distanciaMm: 200, referencia: 'superior' }]);
  });

  it('fora da mesa, nada muda', () => {
    const e = enfesto();
    expect(comLinhaClicada(e, { x: 200, y: 3500 }, modelo)).toBe(e);
  });
});

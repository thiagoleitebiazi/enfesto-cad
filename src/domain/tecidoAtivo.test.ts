import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from './enfesto';
import { criarMolde, type Molde } from './molde';
import { comLarguraDoTecido, comPecasMudadas, enfestoDoTecido, juntarAoEncaixe, pecasDoTecido, separarParaOEncaixe } from './tecidosDoModelo';

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

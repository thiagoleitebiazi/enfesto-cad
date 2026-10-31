import { describe, expect, it } from 'vitest';
import { contornosSeSobrepoem, distanciaEntreContornos, ponto, retanguloEnvolvente } from '../core/geometria';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from './enfesto';
import { criarMolde, linhaDeCorteDaPeca, rotacionarMolde, transladarMolde, type Molde } from './molde';
import { executarNestingAutomatico } from './nesting';
import { comBlocos, comOcupacao, contornoComMargens, entradaDoEncaixe, fechoConvexo, lerBlocos, ocupacaoDaPeca, semOcupacao } from './ocupacaoNoEncaixe';
import { validarProjeto } from './validacao';

const enfesto = (extra: Partial<ConfiguracaoDeEnfesto> = {}): ConfiguracaoDeEnfesto =>
  ({ ...criarConfiguracaoDeEnfesto({ tipo: 'impar', larguraUtilMm: 1000, comprimentoMm: 3000, quantidadeDeCamadas: 1, margemLateralMm: 0, margemDeExtremidadeMm: 0, distanciaMinimaEntrePecasMm: 0 }), ...extra }) as ConfiguracaoDeEnfesto;

const peca = (id: string, l = 100, c = 200, extra: Partial<Molde> = {}): Molde => ({
  ...criarMolde({ nome: id, referencia: '', tamanho: 'M', quantidade: 1, contorno: [ponto(0, 0), ponto(l, 0), ponto(l, c), ponto(0, c)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(l / 2, 10), fim: ponto(l / 2, c - 10) }, restricaoDeRotacao: { permite180: true, permite90e270: true } }, id),
  ...extra,
});

/** O encaixe inteiro, como o cálculo em segundo plano faz. */
const encaixar = (pecas: readonly Molde[], e: ConfiguracaoDeEnfesto) => {
  const entrada = entradaDoEncaixe(pecas, e, false);
  return entrada.fechar(executarNestingAutomatico(entrada.dobra.resto, entrada.dobra.enfesto));
};

describe('o que a peça ocupa (ADR 0208)', () => {
  it('a envolvente pelo contorno afasta; a retangular faz a caixa', () => {
    expect(retanguloEnvolvente(ocupacaoDaPeca(peca('a', 100, 200, { envolvente: { margemMm: 10, tipo: 'contorno' } }))).maxX).toBeCloseTo(110, 6);
    const triangulo: Molde = { ...peca('t'), contorno: [ponto(0, 0), ponto(100, 0), ponto(0, 200)], envolvente: { margemMm: 5, tipo: 'retangular' } };
    expect(ocupacaoDaPeca(triangulo)).toHaveLength(4);
    expect(retanguloEnvolvente(ocupacaoDaPeca(triangulo))).toMatchObject({ minX: -5, maxX: 105, minY: -5, maxY: 205 });
  });

  it('a margem por ponto afasta só a aresta que começa nele', () => {
    const c = contornoComMargens(peca('a').contorno, { 1: 10 });
    const caixa = retanguloEnvolvente(c);
    // A aresta do ponto 1 vai de (0,0) a (100,0): ela anda para y negativo.
    expect(caixa.minY).toBeCloseTo(-10, 6);
    expect(caixa.maxY).toBeCloseTo(200, 6);
    expect(caixa.maxX).toBeCloseTo(100, 6);
  });

  it('o fecho convexo dá a volta nos pontos', () => {
    const f = fechoConvexo([ponto(0, 0), ponto(10, 0), ponto(5, 5), ponto(10, 10), ponto(0, 10)]);
    expect(f).toHaveLength(4);
  });

  it('as peças de verdade voltam para onde a de mentira ficou, giradas junto', () => {
    const a = transladarMolde(peca('a', 100, 200), { x: 0, y: 0 }, 'a');
    const b = transladarMolde(peca('b', 50, 60), { x: 120, y: 30 }, 'b');
    const juntas = [{ ...a, conjuntoRigido: 'g' }, { ...b, conjuntoRigido: 'g' }];
    const o = comOcupacao(juntas);
    expect(o.pecas).toHaveLength(1);
    const v = o.pecas[0]!;
    const girada = transladarMolde(rotacionarMolde(v, 90), { x: 500, y: 700 }, v.id);
    const r = semOcupacao({ pecasColocadas: [{ idOriginal: v.id, indiceCopia: 0, molde: girada }], pecasNaoColocadas: [], comprimentoUtilizadoMm: 0, areaOcupadaMm2: 0, aproveitamentoPercentual: 0, tempoDeProcessamentoMs: 0, interrompido: false, paradaPorTempoLimite: false, paradaPorMetaDeAproveitamento: false } as never, o.virtuais, enfesto());
    expect(r.pecasColocadas.map((p) => p.idOriginal)).toEqual(['a', 'b']);
    // A distância entre os centros das duas peças não muda: o grupo é rígido.
    const centro = (m: Molde) => {
      const c = retanguloEnvolvente(m.contorno);
      return { x: (c.minX + c.maxX) / 2, y: (c.minY + c.maxY) / 2 };
    };
    const [ca, cb] = [centro(r.pecasColocadas[0]!.molde), centro(r.pecasColocadas[1]!.molde)];
    const antes = Math.hypot(50 - 145, 100 - 60);
    expect(Math.hypot(ca.x - cb.x, ca.y - cb.y)).toBeCloseTo(antes, 6);
    expect(r.pecasColocadas[0]!.molde.anguloDeRotacaoGraus).toBe(90);
  });
});

describe('o encaixe com a ocupação, do começo ao fim (ADR 0208)', () => {
  it('a envolvente afasta as vizinhas, e a peça volta sem ela', () => {
    const r = encaixar([peca('a', 100, 200, { quantidade: 2, envolvente: { margemMm: 30, tipo: 'contorno' } })], enfesto());
    expect(r.pecasColocadas).toHaveLength(2);
    const [a, b] = r.pecasColocadas.map((p) => p.molde);
    expect(distanciaEntreContornos(linhaDeCorteDaPeca(a!), linhaDeCorteDaPeca(b!))).toBeGreaterThanOrEqual(59);
    expect(a!.margemDeCosturaMm).toBe(0);
    expect(a!.contorno).toHaveLength(4);
  });

  it('o grupo rígido fica junto, sem sobrepor', () => {
    const a = { ...peca('a', 100, 200), conjuntoRigido: 'g' };
    const b = { ...transladarMolde(peca('b', 80, 80), { x: 120, y: 0 }, 'b'), conjuntoRigido: 'g' };
    const r = encaixar([a, b, peca('c', 300, 300)], enfesto());
    expect(r.pecasColocadas).toHaveLength(3);
    const ma = r.pecasColocadas.find((p) => p.idOriginal === 'a')!.molde;
    const mb = r.pecasColocadas.find((p) => p.idOriginal === 'b')!.molde;
    expect(contornosSeSobrepoem(ma.contorno, mb.contorno)).toBe(false);
    const ca = retanguloEnvolvente(ma.contorno);
    const cb = retanguloEnvolvente(mb.contorno);
    expect(Math.abs(cb.minX - ca.minX)).toBeCloseTo(120, 3);
  });

  it('sem usar a envolvente, ela não vale', () => {
    const r = encaixar([peca('a', 100, 200, { quantidade: 2, envolvente: { margemMm: 30, tipo: 'contorno' } })], enfesto({ semEnvolvente: true }));
    const [a, b] = r.pecasColocadas.map((p) => p.molde);
    expect(distanciaEntreContornos(linhaDeCorteDaPeca(a!), linhaDeCorteDaPeca(b!))).toBeLessThan(30);
  });

  it('a peça que não coube é dita pelo nome da de verdade', () => {
    const r = encaixar([peca('a', 4000, 4000, { envolvente: { margemMm: 1, tipo: 'retangular' } })], enfesto());
    expect(r.pecasNaoColocadas[0]?.idOriginal).toBe('a');
  });
});

describe('os blocos (ADR 0208)', () => {
  const de = (t: string): Molde => ({ ...peca(`p${t}`), tamanho: t });

  it('separação completa: um bloco por tamanho, em ordem crescente', () => {
    const r = comBlocos([de('G'), de('P'), de('M')], { separacaoCompleta: true, blocos: [], vertical: false });
    expect(r.map((p) => [p.tamanho, p.grupoDoEncaixe])).toEqual([
      ['P', 'Bloco 1'],
      ['M', 'Bloco 2'],
      ['G', 'Bloco 3'],
    ]);
  });

  it('os blocos definidos; o tamanho de fora vai para o fim', () => {
    const r = comBlocos([de('P'), de('M'), de('G')], { separacaoCompleta: false, blocos: [['P', 'M']], vertical: false });
    expect(r.map((p) => p.grupoDoEncaixe)).toEqual(['Bloco 1', 'Bloco 1', 'Sem bloco']);
  });

  it('lê os blocos do campo', () => {
    expect(lerBlocos('P M; G GG\n38, 40')).toEqual([['P', 'M'], ['G', 'GG'], ['38', '40']]);
  });

  it('na horizontal, um bloco depois do outro no comprimento', () => {
    const r = encaixar(comBlocos([de('P'), de('M')], { separacaoCompleta: true, blocos: [], vertical: false }), enfesto());
    const [p, m] = ['P', 'M'].map((t) => retanguloEnvolvente(r.pecasColocadas.find((c) => c.molde.tamanho === t)!.molde.contorno));
    expect(m!.minY).toBeGreaterThanOrEqual(p!.maxY);
  });

  it('na vertical, um bloco abaixo do outro na largura, dentro da mesa e sem girar', () => {
    const e = enfesto({ blocosVerticais: true });
    const pecas = comBlocos([{ ...de('P'), quantidade: 2 }, { ...de('M'), quantidade: 2 }], { separacaoCompleta: true, blocos: [], vertical: true });
    const r = encaixar(pecas, e);
    expect(r.pecasColocadas).toHaveLength(4);
    const faixa = (t: string) => retanguloEnvolvente(r.pecasColocadas.filter((c) => c.molde.tamanho === t).flatMap((c) => [...c.molde.contorno]));
    expect(faixa('M').minX).toBeGreaterThanOrEqual(faixa('P').maxX - 1e-6);
    for (const c of r.pecasColocadas) {
      const b = retanguloEnvolvente(c.molde.contorno);
      expect(b.minY).toBeGreaterThanOrEqual(0);
      expect(b.maxX).toBeLessThanOrEqual(1000);
      expect(b.maxY - b.minY).toBeCloseTo(200, 6);
      expect(c.molde.grupoDoEncaixe).toBeUndefined();
    }
    expect(r.blocosDosGrupos).toBeUndefined();
    expect(validarProjeto(r.pecasColocadas.map((c) => c.molde), e).filter((p) => p.tipo === 'sobreposicao' || p.tipo === 'fora-dos-limites')).toEqual([]);
  });
});

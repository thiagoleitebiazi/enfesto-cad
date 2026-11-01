import { describe, expect, it } from 'vitest';
import { ponto, retanguloEnvolvente } from '../core/geometria';
import { gerarPlt } from '../formats/plt-exportacao';
import { compactarEncaixe } from './encaixeManual';
import { criarConfiguracaoDeEnfesto, enfestoComEmendas, lerLinhasDeReferencia, segmentoDaLinha, textoDasLinhasDeReferencia, type ConfiguracaoDeEnfesto } from './enfesto';
import { criarMolde, transladarMolde, type Molde } from './molde';
import { consumoComPerdasMm, emendasAutomaticas, emendasPorEspaco, statusDoEncaixe } from './statusDoEncaixe';
import { validarProjeto } from './validacao';

const enfesto = (extra: Partial<ConfiguracaoDeEnfesto> = {}, tipo: 'par' | 'impar' = 'impar'): ConfiguracaoDeEnfesto =>
  ({ ...criarConfiguracaoDeEnfesto({ tipo, larguraUtilMm: 1000, comprimentoMm: 3000, quantidadeDeCamadas: 2, margemLateralMm: 0, margemDeExtremidadeMm: 0, distanciaMinimaEntrePecasMm: 0 }), ...extra }) as ConfiguracaoDeEnfesto;

const peca = (nome: string, y = 100, tamanho = 'M', id = `${nome}-${y}-${tamanho}`, x = 100): Molde =>
  transladarMolde(
    criarMolde({ nome, referencia: '', tamanho, quantidade: 1, contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 200), ponto(0, 200)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(50, 10), fim: ponto(50, 190) }, restricaoDeRotacao: { permite180: false, permite90e270: false } }, id),
    { x, y },
    id,
  );

describe('o status do encaixe (ADR 0198)', () => {
  it('conta só o que está na mesa, por tamanho e por molde', () => {
    const s = statusDoEncaixe([peca('Frente', 0), peca('Costas', 200), peca('Frente', 400), peca('Frente', 3200)], enfesto());
    expect(s.encaixados).toBe(3);
    expect(s.foraDaMesa).toBe(1);
    expect(s.comprimentoMm).toBe(600);
    expect(s.porTamanho).toEqual([{ tamanho: 'M', completos: 1, encaixados: 3 }]);
    expect(s.porMolde.map(({ nome, encaixados }) => ({ nome, encaixados }))).toEqual([
      { nome: 'Frente', encaixados: 2 },
      { nome: 'Costas', encaixados: 1 },
    ]);
  });

  it('o aproveitamento e o rendimento', () => {
    const s = statusDoEncaixe([peca('Frente', 0), peca('Frente', 200)], enfesto(), 200);
    expect(s.aproveitamentoPercentual).toBeCloseTo(10, 6);
    expect(s.rendimentoConsumoM).toBeCloseTo(0.2, 6);
    expect(s.rendimentoPesoKg).toBeCloseTo(0.04, 6);
    expect(statusDoEncaixe([peca('Frente', 0)], enfesto()).rendimentoPesoKg).toBeNull();
  });

  it('as perdas somam ao consumo: a porcentagem e o comprimento', () => {
    expect(consumoComPerdasMm(1000, { perdaPercentual: 3, perdaMm: 50 })).toBe(1080);
    expect(consumoComPerdasMm(1000, {})).toBe(1000);
    expect(consumoComPerdasMm(0, { perdaMm: 50 })).toBe(0);
  });

  it('sem peça nenhuma, não quebra', () => {
    const s = statusDoEncaixe([], enfesto());
    expect(s.comprimentoMm).toBe(0);
    expect(s.rendimentoConsumoM).toBeNull();
  });
});

describe('os pontos de emenda automáticos (ADR 0197)', () => {
  it('Método 1: acha o vão entre as peças, sem transpasse', () => {
    const pecas = [peca('a', 0), peca('b', 300), peca('c', 700)];
    const r = emendasAutomaticas(pecas, 900, { minimaMm: 150, maximaMm: 350, margemMm: 0 });
    expect(r.every((p) => p.transpasseMm === 0)).toBe(true);
    expect(r[0]!.posicaoMm).toBeGreaterThanOrEqual(150);
    expect(r[0]!.posicaoMm).toBeLessThanOrEqual(350);
  });

  it('sem vão, diz o transpasse', () => {
    const r = emendasAutomaticas([peca('a', 0), peca('b', 150, 'M', 'b', 500)], 1000, { minimaMm: 100, maximaMm: 120, margemMm: 0 });
    expect(r[0]!.transpasseMm).toBeGreaterThan(0);
  });

  it('Método 1 recusa a faixa errada', () => {
    expect(() => emendasAutomaticas([], 900, { minimaMm: 200, maximaMm: 100, margemMm: 0 })).toThrow(/mínima/);
  });

  it('Método 2: de espaço em espaço, nos dois sentidos', () => {
    expect(emendasPorEspaco([], 1000, 300, 'ida').map((p) => p.posicaoMm)).toEqual([300, 600, 900]);
    expect(emendasPorEspaco([], 1000, 300, 'volta').map((p) => p.posicaoMm)).toEqual([100, 400, 700]);
  });
});

describe('as linhas de referência (ADR 0196)', () => {
  it('lê e escreve no campo do formulário', () => {
    const l = lerLinhasDeReferencia('Meio 500 superior evitar valor\nFim 2500 esquerda limite');
    expect(l).toEqual([
      { nome: 'Meio', distanciaMm: 500, referencia: 'superior', evitarSobreposicao: true, mostrarValor: true },
      { nome: 'Fim', distanciaMm: 2500, referencia: 'esquerda', limiteDeSecao: true },
    ]);
    expect(lerLinhasDeReferencia(textoDasLinhasDeReferencia(l))).toEqual(l);
  });

  it('diz a linha que não serve', () => {
    expect(() => lerLinhasDeReferencia('Meio x superior')).toThrow(/Meio x superior/);
    expect(() => lerLinhasDeReferencia('Meio 10 lado')).toThrow(/Meio 10 lado/);
  });

  it('a posição sai da borda de referência', () => {
    const e = enfesto();
    expect(segmentoDaLinha({ nome: 'a', distanciaMm: 100, referencia: 'esquerda' }, e)).toEqual([ponto(0, 100), ponto(1000, 100)]);
    expect(segmentoDaLinha({ nome: 'a', distanciaMm: 100, referencia: 'direita' }, e)).toEqual([ponto(0, 2900), ponto(1000, 2900)]);
    expect(segmentoDaLinha({ nome: 'a', distanciaMm: 100, referencia: 'superior' }, e)).toEqual([ponto(100, 0), ponto(100, 3000)]);
    expect(segmentoDaLinha({ nome: 'a', distanciaMm: 100, referencia: 'inferior' }, e)).toEqual([ponto(900, 0), ponto(900, 3000)]);
  });

  it('"Evitar sobreposição" bloqueia a faixa, e "Limite de seção" fecha o resto da mesa', () => {
    const e = enfesto({ linhasDeReferencia: [{ nome: 'a', distanciaMm: 500, referencia: 'superior', evitarSobreposicao: true }, { nome: 'b', distanciaMm: 2000, referencia: 'esquerda', limiteDeSecao: true }] });
    expect(enfestoComEmendas(e).zonasBloqueadas).toEqual([
      { minX: 499, maxX: 501, minY: 0, maxY: 3000 },
      { minX: 0, maxX: 1000, minY: 2000, maxY: 3000 },
    ]);
  });

  it('a linha comum não bloqueia nada, e a validação avisa só na que evita', () => {
    const comum = enfesto({ linhasDeReferencia: [{ nome: 'a', distanciaMm: 150, referencia: 'superior' }] });
    expect(enfestoComEmendas(comum)).toBe(comum);
    expect(validarProjeto([peca('x')], comum).some((p) => p.tipo === 'peca-na-linha')).toBe(false);
    const evita = enfesto({ linhasDeReferencia: [{ nome: 'a', distanciaMm: 150, referencia: 'superior', evitarSobreposicao: true }] });
    expect(validarProjeto([peca('x')], evita).find((p) => p.tipo === 'peca-na-linha')?.severidade).toBe('aviso');
  });

  it('o compactar respeita a linha', () => {
    const e = enfesto({ linhasDeReferencia: [{ nome: 'a', distanciaMm: 300, referencia: 'esquerda', evitarSobreposicao: true }] });
    const r = compactarEncaixe([peca('x', 500)], e);
    expect(retanguloEnvolvente(r[0]!.contorno).minY).toBeGreaterThanOrEqual(301);
  });

  it('sai no plotter, com o nome', () => {
    const plt = gerarPlt([peca('x')], { larguraDaMesaMm: 1000, linhas: [{ de: ponto(100, 0), ate: ponto(100, 3000), nome: 'MEIO' }] });
    expect(plt).toContain('LBMEIO');
  });
});

describe('a verificação (ADR 0196)', () => {
  const meia = (x: number): Molde => {
    const p = peca('m', 100, 'M', 'm', 0);
    const c = retanguloEnvolvente(p.contorno);
    return { ...transladarMolde(p, { x, y: 0 }, 'm'), linhaDeSimetria: { de: ponto(c.minX + x, c.minY), ate: ponto(c.minX + x, c.maxY) } };
  };

  it('no tecido dobrado, avisa da peça de simetria longe da dobra', () => {
    expect(validarProjeto([meia(300)], enfesto({}, 'par')).some((p) => p.tipo === 'dobrada-fora-da-dobra')).toBe(true);
    expect(validarProjeto([meia(0)], enfesto({}, 'par')).some((p) => p.tipo === 'dobrada-fora-da-dobra')).toBe(false);
  });

  it('a peça marcada para ficar fora da dobra não dá aviso', () => {
    expect(validarProjeto([{ ...meia(300), foraDaDobra: true }], enfesto({}, 'par')).some((p) => p.tipo === 'dobrada-fora-da-dobra')).toBe(false);
  });

  it('duas peças de ½ camada podem se sobrepor no tecido dobrado: estão em camadas diferentes', () => {
    const a: Molde = { ...peca('a', 100, 'M', 'a'), meiaCamada: true };
    const b: Molde = { ...peca('b', 150, 'M', 'b'), meiaCamada: true };
    expect(validarProjeto([a, b], enfesto({}, 'par')).some((p) => p.tipo === 'sobreposicao')).toBe(false);
    expect(validarProjeto([a, b], enfesto()).some((p) => p.tipo === 'sobreposicao')).toBe(true);
    expect(validarProjeto([a, { ...b, meiaCamada: undefined } as unknown as Molde], enfesto({}, 'par')).some((p) => p.tipo === 'sobreposicao')).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { contornosSeSobrepoem, ponto, retanguloEnvolvente } from '../core/geometria';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from './enfesto';
import { criarMolde, linhaDeCorteDaPeca, type Molde } from './molde';
import { executarNestingAutomatico } from './nesting';
import { juntarDobra, prepararDobra } from './pecasNaDobra';
import { validarProjeto } from './validacao';

const enfesto = (tipo: 'par' | 'impar', comprimentoMm = 3000): ConfiguracaoDeEnfesto =>
  criarConfiguracaoDeEnfesto({ tipo, larguraUtilMm: 1000, comprimentoMm, quantidadeDeCamadas: 2, margemLateralMm: 0, margemDeExtremidadeMm: 0, distanciaMinimaEntrePecasMm: 5 } as ConfiguracaoDeEnfesto);

/** Meia peça, com a dobra no lado do alto da largura (x = 0) ou no de baixo (x = 200). */
const meia = (id: string, quantidade = 2, restricaoDeRotacao = { permite180: true, permite90e270: false }, dobraEm: 0 | 200 = 0): Molde => ({
  ...criarMolde({ nome: id, referencia: '', tamanho: 'M', quantidade, contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 400), ponto(0, 400)], linhaDeFio: { inicio: ponto(100, 50), fim: ponto(100, 350) } }, id),
  linhaDeSimetria: { de: ponto(dobraEm, 0), ate: ponto(dobraEm, 400) },
  restricaoDeRotacao,
});
const comum = (id: string): Molde =>
  criarMolde({ nome: id, referencia: '', tamanho: 'M', quantidade: 2, contorno: [ponto(0, 0), ponto(300, 0), ponto(300, 300), ponto(0, 300)], linhaDeFio: { inicio: ponto(150, 50), fim: ponto(150, 250) } }, id);

describe('o molde dobrado na dobra do tecido (ADR 0172)', () => {
  it('no enfesto par, as cópias da meia peça ficam com a simetria na borda, uma depois da outra; a comum segue para o encaixe', () => {
    const d = prepararDobra([meia('a'), comum('b')], enfesto('par'));
    expect(d.fixas.map((f) => [f.idOriginal, f.indiceCopia])).toEqual([
      ['a', 0],
      ['a', 1],
    ]);
    const [c1, c2] = d.fixas.map((f) => retanguloEnvolvente(f.molde.contorno));
    // Encostada na dobra (x = 0), sem a margem de segurança; no comprimento, a margem continua.
    expect([c1!.minX, c1!.minY]).toEqual([0, 4]);
    expect([c2!.minX, c2!.minY]).toEqual([0, 409]);
    expect(d.resto.map((p) => p.id)).toEqual(['b']);
    expect(d.enfesto.zonasBloqueadas).toHaveLength(2);
  });

  it('o resultado junta tudo, sem sobrepor, e refaz as contas', () => {
    const e = enfesto('par');
    const d = prepararDobra([meia('a'), comum('b')], e);
    const r = juntarDobra(executarNestingAutomatico(d.resto, d.enfesto), d, e);
    expect(r.pecasColocadas).toHaveLength(4);
    expect(r.pecasNaoColocadas).toEqual([]);
    const cortes = r.pecasColocadas.map((p) => linhaDeCorteDaPeca(p.molde));
    for (let i = 0; i < cortes.length; i++) for (let j = i + 1; j < cortes.length; j++) expect(contornosSeSobrepoem(cortes[i]!, cortes[j]!)).toBe(false);
    expect(r.comprimentoUtilizadoMm).toBeGreaterThanOrEqual(809);
    expect(r.aproveitamentoPercentual).toBeGreaterThan(0);
  });

  it('a peça que a rotação não deixa, a que não cabe e o enfesto aberto seguem como antes', () => {
    // Com a dobra do outro lado: girada 180° ela vai para a borda; sem esse giro, não dá.
    const girada = prepararDobra([meia('a', 1, { permite180: true, permite90e270: false }, 200)], enfesto('par'));
    expect(girada.fixas).toHaveLength(1);
    expect(retanguloEnvolvente(girada.fixas[0]!.molde.contorno).minX).toBe(0);
    const presa = prepararDobra([meia('a', 1, { permite180: false, permite90e270: false }, 200)], enfesto('par'));
    expect(presa.fixas).toEqual([]);
    expect(presa.resto).toHaveLength(1);
    const d = prepararDobra([meia('a', 3)], enfesto('par', 900));
    expect(d.fixas).toHaveLength(2);
    expect(d.resto[0]!.quantidade).toBe(1);
    const aberto = enfesto('impar');
    expect(prepararDobra([meia('a')], aberto)).toEqual({ fixas: [], resto: [meia('a')], enfesto: aberto });
  });

  it('a validação aceita a peça encostada na dobra, e só ela', () => {
    const e = enfesto('par');
    const d = prepararDobra([meia('a', 1)], e);
    const naDobra = d.fixas[0]!.molde;
    const fora = (pecas: readonly Molde[], em: ConfiguracaoDeEnfesto) => validarProjeto(pecas, em).some((p) => p.tipo === 'fora-dos-limites');
    expect(fora([naDobra], e)).toBe(false);
    expect(fora([naDobra], enfesto('impar'))).toBe(true);
    expect(fora([{ ...naDobra, linhaDeSimetria: undefined } as unknown as Molde], e)).toBe(true);
  });

  it('a área bloqueada na borda é pulada', () => {
    const e = { ...enfesto('par'), zonasBloqueadas: [{ minX: 0, maxX: 300, minY: 0, maxY: 500 }] };
    expect(retanguloEnvolvente(prepararDobra([meia('a', 1)], e).fixas[0]!.molde.contorno).minY).toBe(505);
  });
});

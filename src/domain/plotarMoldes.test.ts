import { describe, expect, it } from 'vitest';
import { ponto, retanguloEnvolvente } from '../core/geometria';
import { criarMolde } from './molde';
import { moldesParaPlotar, moldeVizinho, organizarPecas } from './plotarMoldes';
import { comTamanhoIntermediario, contornoNoTamanho } from './tamanhoIntermediario';
import { definirTamanhosDoMolde } from './tamanhosGraduados';
import { definirRegra, cantosDoContorno } from './graduacao';

const peca = (id: string, a = 400, c = 300) =>
  criarMolde({ nome: id, referencia: '', tamanho: 'M', contorno: [ponto(500, 900), ponto(500 + a, 900), ponto(500 + a, 900 + c), ponto(500, 900 + c)], linhaDeFio: { inicio: ponto(510, 910), fim: ponto(510, 990) } }, id);
let k = 0;
const novoId = (): string => `n${++k}`;
const caixa = (p: ReturnType<typeof peca>) => retanguloEnvolvente(p.contorno);

describe('plotar os moldes (ADR 0167)', () => {
  it('reorganiza em colunas na largura do papel, a partir do zero', () => {
    const r = organizarPecas([peca('a'), peca('b'), peca('c')], 1000, 20);
    expect([caixa(r[0]!).minX, caixa(r[0]!).minY]).toEqual([0, 0]);
    expect([caixa(r[1]!).minX, caixa(r[1]!).minY]).toEqual([420, 0]);
    // A terceira não cabe na largura: coluna nova, depois do comprimento da primeira.
    expect([caixa(r[2]!).minX, caixa(r[2]!).minY]).toEqual([0, 320]);
  });

  it('só as selecionadas, cada tamanho separado e girada 90°', () => {
    const graduada = definirTamanhosDoMolde(peca('a'), ['P', 'M', 'G'], 'M');
    const r = moldesParaPlotar([graduada, peca('b')], { ids: new Set(['a']), tamanhosSeparados: true, larguraDoPapelMm: 5000 }, novoId);
    expect(r.map((p) => p.tamanho)).toEqual(['P', 'M', 'G']);
    const g = moldesParaPlotar([peca('a')], { girar90: true, larguraDoPapelMm: 1000 }, novoId)[0]!;
    expect(caixa(g).maxX - caixa(g).minX).toBeCloseTo(300);
    expect(caixa(g).maxY - caixa(g).minY).toBeCloseTo(400);
  });

  it('o molde vizinho dá a volta; sem seleção, a primeira', () => {
    const l = [peca('a'), peca('b')];
    expect(moldeVizinho(l, 'b', 1)?.id).toBe('a');
    expect(moldeVizinho(l, 'a', -1)?.id).toBe('b');
    expect(moldeVizinho(l, null, 1)?.id).toBe('a');
    expect(moldeVizinho([], null, 1)).toBeNull();
  });
});

describe('o tamanho intermediário (ADR 0168)', () => {
  const graduada = () => {
    const base = definirTamanhosDoMolde(peca('a'), ['40', '44', '48'], '44');
    const i = cantosDoContorno(base.contorno)[1]!;
    return { ...base, graduacao: definirRegra(base.graduacao!, base.contorno, i, [ponto(-20, 0), ponto(0, 0), ponto(20, 0)]) };
  };

  it('entra entre os dois, no meio deles; o base e os outros não mudam', () => {
    const m = comTamanhoIntermediario(graduada(), '42', '40');
    expect(m.graduacao!.tamanhos).toEqual(['40', '42', '44', '48']);
    expect(m.graduacao!.tamanhos[m.graduacao!.base]).toBe('44');
    expect(contornoNoTamanho(m, '42')[1]!.x).toBeCloseTo(890);
    expect(contornoNoTamanho(m, '40')[1]!.x).toBeCloseTo(880);
    expect(contornoNoTamanho(m, '44')[1]!.x).toBeCloseTo(900);
  });

  it('também entre o base e o seguinte; recusa o nome repetido, e o último não tem seguinte', () => {
    expect(contornoNoTamanho(comTamanhoIntermediario(graduada(), '46', '44'), '46')[1]!.x).toBeCloseTo(910);
    expect(() => comTamanhoIntermediario(graduada(), '44', '40')).toThrow(/Já há o tamanho/);
    expect(() => comTamanhoIntermediario(graduada(), '50', '48')).toThrow(/depois de/);
  });
});

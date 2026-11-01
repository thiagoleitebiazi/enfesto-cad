import { describe, expect, it } from 'vitest';
import { area, ponto, retanguloEnvolvente } from '../core/geometria';
import { gerarPlt } from '../formats/plt-exportacao';
import { aplicarConjunto, comConjunto, conjuntosGuardados, guardarConjuntos, lerQuantidades, textoDasQuantidades } from '../ui/visaoDasPecas';
import { acaoDaTeclaDoEncaixe, comConjuntoRigido, comFolgaNoEncaixe, compactarEncaixe, fecharEncaixe, semEnvolvente, semFolgaNoEncaixe, voltarAoOriginal } from './encaixeManual';
import { criarConfiguracaoDeEnfesto } from './enfesto';
import { criarMolde, espelharMolde, linhaDeCorteDaPeca, rotacionarMolde, transladarMolde, type Molde } from './molde';
import type { ResultadoDeNesting } from './nesting';
import { fundirPiques } from './piques';
import { comSentidoAlternado } from './tecidosDoModelo';
import { definirTamanhosDoMolde, expandirComGrade, expandirTamanhos } from './tamanhosGraduados';

const quadrado = (extra: Partial<Molde> = {}): Molde => ({
  ...criarMolde({ nome: 'a', referencia: '', tamanho: 'M', quantidade: 3, contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 200), ponto(0, 200)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 180) }, restricaoDeRotacao: { permite180: false, permite90e270: false } }, 'a'),
  ...extra,
});

const pique = (id: string, x: number, y: number, indiceAresta: number, tipo = 'v'): Molde['piques'][number] => ({ id, posicao: ponto(x, y), indiceAresta, formato: { tipo, larguraMm: 4, alturaMm: 6, anguloGraus: 0 } });

let n = 0;
const novoId = (): string => `n${n++}`;

describe('fundir o pique ao contorno (ADR 0202)', () => {
  it('o recorte entra no contorno, para dentro da peça', () => {
    const r = fundirPiques(quadrado({ piques: [pique('p', 50, 0, 0)] }), () => true);
    expect(r.piques).toEqual([]);
    expect(r.contorno).toHaveLength(7);
    expect(r.contorno[2]).toEqual(ponto(50, 6));
    expect(area(r.contorno)).toBeCloseTo(100 * 200 - 12, 6);
  });

  it('funciona nos dois lados, sempre para dentro', () => {
    const r = fundirPiques(quadrado({ piques: [pique('p', 50, 200, 2)] }), () => true);
    expect(r.contorno.some((q) => q.x === 50 && q.y === 194)).toBe(true);
  });

  it('dois piques na mesma aresta entram em ordem, e o que não foi escolhido fica', () => {
    const r = fundirPiques(quadrado({ piques: [pique('p', 80, 0, 0), pique('q', 20, 0, 0), pique('r', 50, 200, 2, 'traco')] }), (p) => p.formato?.tipo === 'v');
    expect(r.contorno.filter((q) => q.y === 6).map((q) => q.x)).toEqual([20, 80]);
    expect(r.piques.map((p) => p.id)).toEqual(['r']);
    expect(r.contorno[r.piques[0]!.indiceAresta]!.x).toBeGreaterThanOrEqual(50);
  });

  it('sem pique escolhido, nada muda', () => {
    const p = quadrado();
    expect(fundirPiques(p, () => true)).toBe(p);
  });
});

describe('a folga em volta da peça no encaixe (ADR 0202)', () => {
  it('a peça ocupa mais no cálculo, e volta como era', () => {
    const p = quadrado({ margemDeCosturaMm: 5, folgaNoEncaixeMm: 10 });
    const com = comFolgaNoEncaixe(p);
    expect(retanguloEnvolvente(linhaDeCorteDaPeca(com)).maxX).toBeCloseTo(115, 6);
    expect(semFolgaNoEncaixe(com).margemDeCosturaMm).toBe(5);
  });

  it('sem folga, a peça é a mesma', () => {
    const p = quadrado();
    expect(comFolgaNoEncaixe(p)).toBe(p);
    expect(semFolgaNoEncaixe(p)).toBe(p);
  });

  it('o fim do encaixe tira a folga das peças', () => {
    const e = criarConfiguracaoDeEnfesto({ tipo: 'impar', larguraUtilMm: 1000, comprimentoMm: 3000, quantidadeDeCamadas: 1, margemLateralMm: 0, margemDeExtremidadeMm: 0, distanciaMinimaEntrePecasMm: 0 });
    const resultado = { pecasColocadas: [{ idOriginal: 'a', indiceCopia: 0, molde: comFolgaNoEncaixe(quadrado({ folgaNoEncaixeMm: 10 })) }], pecasNaoColocadas: [], comprimentoUtilizadoMm: 1, areaOcupadaMm2: 1, aproveitamentoPercentual: 1, tempoDeProcessamentoMs: 0, interrompido: false, paradaPorTempoLimite: false, paradaPorMetaDeAproveitamento: false } as unknown as ResultadoDeNesting;
    const r = fecharEncaixe(resultado, { fixas: [], resto: [], enfesto: e }, e);
    expect(r.pecasColocadas[0]!.molde.margemDeCosturaMm).toBe(0);
    expect(r.comprimentoUtilizadoMm).toBe(200);
  });
});

describe('o sentido por tamanho e por pacote (ADR 0202)', () => {
  const de = (tamanho: string, quantidade = 1): Molde => quadrado({ id: `p-${tamanho}`, tamanho, quantidade, contorno: [ponto(0, 0), ponto(100, 0), ponto(0, 200)] });

  it('por tamanho: os tamanhos alternam, e cada um fica todo num sentido', () => {
    const r = comSentidoAlternado([de('P'), de('M'), de('P')], 'por-tamanho', novoId);
    expect(r[0]!.contorno[1]).toEqual(ponto(100, 0));
    expect(r[1]!.contorno[1]).not.toEqual(ponto(100, 0));
    expect(r[2]!.contorno[1]).toEqual(ponto(100, 0));
  });

  it('por pacote: metade das cópias vai ao contrário', () => {
    const r = comSentidoAlternado([de('M', 5)], 'por-pacote', novoId);
    expect(r.map((p) => p.quantidade)).toEqual([3, 2]);
    expect(r[1]!.id).not.toBe(r[0]!.id);
  });

  it('a peça virada guarda o ângulo de antes: a validação não acusa', () => {
    expect(comSentidoAlternado([de('P'), de('M')], 'por-tamanho', novoId)[1]!.anguloDeRotacaoGraus).toBe(0);
  });
});

describe('a quantidade por tamanho (ADR 0202)', () => {
  const g = (q: Record<string, number>): Molde => ({ ...definirTamanhosDoMolde(quadrado({ quantidade: 2 }), ['P', 'M', 'G'], 'M'), quantidadePorTamanho: q });

  it('vale sobre a quantidade da peça, e zero tira o tamanho', () => {
    expect(expandirTamanhos([g({ P: 5, G: 0 })], novoId).map((p) => p.quantidade)).toEqual([5, 2]);
  });

  it('a grade multiplica a quantidade do tamanho', () => {
    expect(expandirComGrade([g({ P: 5 })], novoId, { P: 2, M: 1, G: 1 }).map((p) => p.quantidade)).toEqual([10, 2, 2]);
  });

  it('lê e escreve o campo, sem o que não é número', () => {
    expect(lerQuantidades('P:2 M:1  G:x')).toEqual({ P: 2, M: 1 });
    expect(textoDasQuantidades({ P: 2, M: 1 })).toBe('P:2 M:1');
  });
});

describe('o tamanho do texto da peça no plotter (ADR 0202)', () => {
  it('vale no nome', () => {
    expect(gerarPlt([quadrado({ alturaDoTextoMm: 20 })])).toContain('SI1.4,2');
    expect(gerarPlt([quadrado()])).toContain('SI0.35,0.5');
  });
});

describe('as propriedades de encaixe guardadas (ADR 0202)', () => {
  const memoria = (): { getItem(k: string): string | null; setItem(k: string, v: string): void } => {
    const m = new Map<string, string>();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
  };
  const conjunto = { nome: 'Malha', restricao: { permite180: true, permite90e270: false }, quantidade: 2, tecidoDoMolde: 'Forro' };

  it('o conjunto do mesmo nome é trocado, e fica lembrado', () => {
    const a = memoria();
    guardarConjuntos(a, comConjunto(comConjunto([], conjunto), { ...conjunto, quantidade: 4 }));
    expect(conjuntosGuardados(a).map((c) => c.quantidade)).toEqual([4]);
  });

  it('aplicar leva o giro, a quantidade e o tecido à peça', () => {
    const r = aplicarConjunto(quadrado(), conjunto);
    expect(r.restricaoDeRotacao.permite180).toBe(true);
    expect(r.quantidade).toBe(2);
    expect(r.tecidoDoMolde).toBe('Forro');
  });
});

describe('o grupo e a envolvente na peça (ADR 0208)', () => {
  it('entra e sai do grupo', () => {
    const p = comConjuntoRigido(quadrado(), 'Grupo 1');
    expect(p.conjuntoRigido).toBe('Grupo 1');
    expect(comConjuntoRigido(p, '').conjuntoRigido).toBeUndefined();
  });

  it('eliminar tira a envolvente, as margens e o grupo', () => {
    const r = semEnvolvente(quadrado({ envolvente: { margemMm: 5, tipo: 'contorno' }, margensDoContorno: { 1: 3 }, conjuntoRigido: 'g' }));
    expect(r.envolvente).toBeUndefined();
    expect(r.margensDoContorno).toBeUndefined();
    expect(r.conjuntoRigido).toBeUndefined();
    const p = quadrado();
    expect(semEnvolvente(p)).toBe(p);
  });
});

describe('Ctrl+Shift+D', () => {
  it('liga e desliga a distância entre moldes', () => {
    expect(acaoDaTeclaDoEncaixe({ key: 'D', ctrlKey: true, metaKey: false, altKey: false, shiftKey: true })).toEqual({ tipo: 'usar-distancia' });
  });
});

describe('a peça lembra que foi espelhada (ADR 0218)', () => {
  const lados = quadrado({ contorno: [ponto(0, 0), ponto(100, 0), ponto(0, 200)] });

  it('espelhar duas vezes volta a ser como era', () => {
    const uma = espelharMolde(lados, 'a');
    expect(uma.espelhada).toBe(true);
    expect(espelharMolde(uma, 'a').espelhada).toBeUndefined();
  });

  it('voltar ao original desfaz o espelho e o giro', () => {
    const mexida = rotacionarMolde(espelharMolde(lados, 'a'), 180);
    const volta = voltarAoOriginal(mexida);
    expect(volta.espelhada).toBeUndefined();
    expect(volta.anguloDeRotacaoGraus).toBe(0);
    expect(area(volta.contorno)).toBeCloseTo(area(lados.contorno), 6);
    volta.contorno.forEach((p, i) => {
      expect(p.x).toBeCloseTo(lados.contorno[i]!.x, 6);
      expect(p.y).toBeCloseTo(lados.contorno[i]!.y, 6);
    });
  });

  it('a cópia espelhada de um par continua espelhada', () => {
    const par = espelharMolde({ ...lados, emPar: true }, 'a');
    expect(voltarAoOriginal(par).espelhada).toBe(true);
  });
});

describe('compactar com grupos (ADR 0220)', () => {
  const e = criarConfiguracaoDeEnfesto({ tipo: 'impar', larguraUtilMm: 1000, comprimentoMm: 3000, quantidadeDeCamadas: 1, margemLateralMm: 0, margemDeExtremidadeMm: 0, distanciaMinimaEntrePecasMm: 0 });
  const em = (id: string, y: number, grupoDoEncaixe: string): Molde => ({ ...transladarMolde(quadrado({ quantidade: 1 }), { x: 100, y }, id), grupoDoEncaixe });

  it('a folga dentro de um trecho fecha, e ninguém entra no trecho do outro', () => {
    const r = compactarEncaixe([em('a', 0, 'A'), em('b', 500, 'A'), em('c', 1000, 'B'), em('d', 1600, 'B')], e);
    const inicio = (id: string): number => retanguloEnvolvente(r.find((p) => p.id === id)!.contorno).minY;
    expect(inicio('b')).toBeCloseTo(200, 1);
    expect(inicio('c')).toBeCloseTo(1000, 1);
    expect(inicio('d')).toBeCloseTo(1200, 1);
  });
});

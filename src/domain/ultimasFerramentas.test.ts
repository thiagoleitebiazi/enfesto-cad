import { describe, expect, it } from 'vitest';
import { ponto, retanguloEnvolvente } from '../core/geometria';
import { extrairMolde, partesDentro } from './elementos';
import { criarMolde, fioNaDirecao, fioNoAngulo, transladarMolde, type Molde } from './molde';
import { comCosturaInvertida } from './modificarElemento';
import { comPontoDeCasamento } from './pontosDeCasamento';
import { fazerRisco, type PecaDoRisco } from './risco';
import { comTamanhoManterDiferenca } from './tamanhoIntermediario';
import { definirTamanhosDoMolde } from './tamanhosGraduados';

const quadrado = (lado = 200, margem = 0): Molde =>
  criarMolde(
    { nome: 'a', referencia: '', tamanho: 'M', quantidade: 1, contorno: [ponto(0, 0), ponto(lado, 0), ponto(lado, lado), ponto(0, lado)], margemDeCosturaMm: margem, linhaDeFio: { inicio: ponto(lado / 2, 50), fim: ponto(lado / 2, 150) }, restricaoDeRotacao: { permite180: false, permite90e270: false } },
    'a',
  );

let n = 0;
const novoId = (): string => `n${n++}`;

describe('o extrair molde por intersecção (ADR 0190)', () => {
  // A linha do meio divide a peça; a outra linha corta a metade de cima e passa para a de baixo.
  const peca: Molde = { ...quadrado(), linhasInternas: [[ponto(100, 0), ponto(100, 200)], [ponto(50, 50), ponto(150, 50)]] };

  it('por padrão, leva só as linhas inteiras dentro da região', () => {
    expect(extrairMolde(peca, ponto(50, 100), novoId, 'b').linhasInternas).toEqual([]);
  });

  it('"Quebrar linhas auxiliares": leva a parte da linha que fica dentro', () => {
    const r = extrairMolde(peca, ponto(50, 100), novoId, 'b', { detectarGraduacao: false, detectarPiques: true, detectarLinhas: true, comporContornos: false, quebrarLinhas: true });
    const dentro = r.linhasInternas.find((l) => l.some((p) => p.x === 50));
    expect(dentro?.map((p) => p.x)).toEqual([50, 100]);
  });

  it('"Compor contornos": só o contorno, sem o interior', () => {
    const comLinha: Molde = { ...peca, linhasInternas: [...peca.linhasInternas, [ponto(20, 20), ponto(40, 40)]] };
    const opcoes = { detectarGraduacao: false, detectarPiques: true, detectarLinhas: true, comporContornos: false, quebrarLinhas: false };
    expect(extrairMolde(comLinha, ponto(50, 100), novoId, 'b', opcoes).linhasInternas).toHaveLength(1);
    expect(extrairMolde(comLinha, ponto(50, 100), novoId, 'b', { ...opcoes, comporContornos: true }).linhasInternas).toEqual([]);
  });

  it('"Detectar graduações": a regra dos cantos que ficam vem junto', () => {
    const graduada = definirTamanhosDoMolde(peca, ['P', 'M'], 'M');
    const comRegra: Molde = { ...graduada, graduacao: { ...graduada.graduacao!, pontos: [{ posicao: ponto(0, 0), deslocamentos: [ponto(-5, 0), ponto(0, 0)] }] } };
    const opcoes = { detectarGraduacao: true, detectarPiques: true, detectarLinhas: true, comporContornos: false, quebrarLinhas: false };
    expect(extrairMolde(comRegra, ponto(50, 100), novoId, 'b', opcoes).graduacao?.pontos).toHaveLength(1);
    expect(extrairMolde(comRegra, ponto(50, 100), novoId, 'b').graduacao).toBeUndefined();
  });

  it('as partes de uma linha dentro de uma região', () => {
    const regiao = [ponto(0, 0), ponto(10, 0), ponto(10, 10), ponto(0, 10)];
    expect(partesDentro([ponto(5, -5), ponto(5, 5)], regiao)).toEqual([[ponto(5, 0), ponto(5, 5)]]);
    expect(partesDentro([ponto(20, 20), ponto(30, 30)], regiao)).toEqual([]);
  });
});

describe('o sentido do fio (ADR 0190)', () => {
  it('no ângulo pedido, com o mesmo meio e o mesmo comprimento', () => {
    const { inicio, fim } = fioNoAngulo(quadrado(), 90).linhaDeFio;
    expect(inicio.x).toBeCloseTo(150, 6);
    expect(fim.x).toBeCloseTo(50, 6);
    expect(inicio.y).toBeCloseTo(100, 6);
    expect(fim.y).toBeCloseTo(100, 6);
  });

  it('na direção de um elemento, e recusa a direção vazia', () => {
    const f = fioNaDirecao(quadrado(), { x: 3, y: 0 }).linhaDeFio;
    expect(f.fim.x - f.inicio.x).toBeCloseTo(100, 6);
    expect(() => fioNaDirecao(quadrado(), { x: 0, y: 0 })).toThrow();
  });
});

describe('inverter a costura (ADR 0190)', () => {
  it('a linha de corte vira o contorno, e a costura fica por dentro, como linha', () => {
    const r = comCosturaInvertida(quadrado(200, 10));
    expect(r.margemDeCosturaMm).toBe(0);
    expect(retanguloEnvolvente(r.contorno).maxX).toBeCloseTo(210, 6);
    expect(r.linhasInternas).toHaveLength(1);
    expect(retanguloEnvolvente(r.linhasInternas[0]!).maxX).toBe(200);
  });

  it('sem costura, nada muda', () => {
    const p = quadrado();
    expect(comCosturaInvertida(p)).toBe(p);
  });
});

describe('manter diferença (ADR 0190)', () => {
  it('o tamanho novo entra depois do último, com a distância média da grade', () => {
    const g = definirTamanhosDoMolde(quadrado(), ['P', 'M', 'G'], 'M');
    const comRegra: Molde = { ...g, graduacao: { ...g.graduacao!, pontos: [{ posicao: ponto(0, 0), deslocamentos: [ponto(-10, 0), ponto(0, 0), ponto(4, 0)] }] } };
    const r = comTamanhoManterDiferenca(comRegra, 'GG');
    expect(r.graduacao!.tamanhos).toEqual(['P', 'M', 'G', 'GG']);
    expect(r.graduacao!.pontos[0]!.deslocamentos[3]!.x).toBeCloseTo(11, 6);
  });

  it('recusa a peça com um tamanho só e o nome repetido', () => {
    expect(() => comTamanhoManterDiferenca(quadrado(), 'GG')).toThrow(/tamanhos/);
    expect(() => comTamanhoManterDiferenca(definirTamanhosDoMolde(quadrado(), ['P', 'M'], 'M'), 'P')).toThrow(/Já há/);
  });
});

describe('o relacionamento dos piques (ADR 0191)', () => {
  const noRisco = (relacao?: 'horizontal' | 'vertical' | 'centralizado'): Molde => {
    const base = transladarMolde(quadrado(100), { x: 0, y: 0 }, 'a');
    return comPontoDeCasamento(base, '', ponto(20, 30), 'm', relacao).molde;
  };
  const posto = (m: Molde): { readonly x: number; readonly y: number } => {
    const copia: PecaDoRisco = { pecaId: m.id, nome: m.nome, tamanho: m.tamanho, molde: m, espelhada: false };
    const r = fazerRisco([copia], { M: 1 }, { larguraMm: 1000, comprimentoMaximoMm: 3000, distanciaMm: 0, sentidoUnico: false, casamento: { rapportLarguraMm: 70, rapportComprimentoMm: 90, faseLarguraMm: 0, faseComprimentoMm: 0 } });
    if (!r.ok) throw new Error(r.motivo);
    const c = retanguloEnvolvente(r.pecas[0]!.contorno);
    return { x: c.minX + 20, y: c.minY + 30 };
  };
  const nasLinhas = (v: number, rapport: number): boolean => Math.abs(v / rapport - Math.round(v / rapport)) < 1e-6;

  it('sem relação, o ponto cai na linha do desenho nos dois sentidos', () => {
    const p = posto(noRisco());
    expect(nasLinhas(p.x, 70)).toBe(true);
    expect(nasLinhas(p.y, 90)).toBe(true);
  });

  it('só na horizontal, a largura fica livre', () => {
    const p = posto(noRisco('horizontal'));
    expect(nasLinhas(p.y, 90)).toBe(true);
    expect(p.x).toBe(20);
  });

  it('só na vertical, o comprimento fica livre', () => {
    const p = posto(noRisco('vertical'));
    expect(nasLinhas(p.x, 70)).toBe(true);
    expect(p.y).toBe(30);
  });

  it('centralizado, o ponto cai no meio do desenho', () => {
    const p = posto(noRisco('centralizado'));
    expect(nasLinhas(p.x - 35, 70)).toBe(true);
    expect(nasLinhas(p.y - 45, 90)).toBe(true);
  });

  it('mudar a relação de um ponto que já existe vale, e tirar também', () => {
    const m = noRisco('vertical');
    const de = comPontoDeCasamento(m, '', ponto(25, 30), 'x', 'horizontal').molde;
    expect(de.marcas[0]!.relacaoDoCasamento).toBe('horizontal');
    expect(comPontoDeCasamento(de, '', ponto(25, 30), 'x').molde.marcas[0]!.relacaoDoCasamento).toBeUndefined();
  });
});

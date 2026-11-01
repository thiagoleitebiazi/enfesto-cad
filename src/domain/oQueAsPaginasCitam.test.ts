import { describe, expect, it } from 'vitest';
import { ponto, retanguloEnvolvente } from '../core/geometria';
import { csvDaSequenciaDeEnfestos } from '../formats/fichaDaEnfestadeira';
import { descricaoTecnicaDosMoldes } from './descricaoTecnica';
import { criarConfiguracaoDeEnfesto } from './enfesto';
import { criarMolde, type Molde } from './molde';
import type { ResultadoDoPlanejamento } from './planoDeEnfesto';
import { statusDoEncaixe } from './statusDoEncaixe';
import { definirTamanhosDoMolde, pecasNoTamanho } from './tamanhosGraduados';

const peca = (id: string, l: number, c: number, extra: Partial<Molde> = {}): Molde => ({
  ...criarMolde({ nome: id, referencia: '', tamanho: 'M', quantidade: 1, contorno: [ponto(10, 10), ponto(10 + l, 10), ponto(10 + l, 10 + c), ponto(10, 10 + c)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 180) }, restricaoDeRotacao: { permite180: true, permite90e270: false } }, id),
  ...extra,
});

describe('o consumo de cada molde (ADR 0223)', () => {
  it('reparte o consumo pela área, e a soma dá o todo', () => {
    const e = criarConfiguracaoDeEnfesto({ tipo: 'impar', larguraUtilMm: 1000, comprimentoMm: 3000, quantidadeDeCamadas: 1, margemLateralMm: 0, margemDeExtremidadeMm: 0, distanciaMinimaEntrePecasMm: 0 });
    const s = statusDoEncaixe([peca('Frente', 300, 400), peca('Bolso', 100, 400)], e);
    const [frente, bolso] = s.porMolde;
    expect(frente!.parteDoConsumoPercentual).toBeCloseTo(75, 6);
    expect(bolso!.parteDoConsumoPercentual).toBeCloseTo(25, 6);
    expect(frente!.consumoMm + bolso!.consumoMm).toBeCloseTo(s.consumoMm, 6);
  });
});

describe('provar outro tamanho (ADR 0223)', () => {
  const graduada = definirTamanhosDoMolde(peca('Frente', 300, 400), ['P', 'M', 'G'], 'M');
  const comRegra: Molde = { ...graduada, graduacao: { ...graduada.graduacao!, pontos: graduada.contorno.map((posicao, i) => ({ posicao, deslocamentos: [{ x: i === 1 || i === 2 ? -20 : 0, y: 0 }, { x: 0, y: 0 }, { x: i === 1 || i === 2 ? 20 : 0, y: 0 }] })) } as NonNullable<Molde['graduacao']> };

  it('a peça muda de medida e continua a mesma peça', () => {
    const [g] = pecasNoTamanho([comRegra], 'G');
    expect(g!.id).toBe(comRegra.id);
    expect(g!.tamanho).toBe('G');
    const largura = (m: Molde): number => {
      const c = retanguloEnvolvente(m.contorno);
      return c.maxX - c.minX;
    };
    expect(largura(g!)).toBeGreaterThan(largura(comRegra));
  });

  it('o tamanho de base, o vazio e o que a peça não tem deixam tudo como está', () => {
    const lista = [comRegra];
    expect(pecasNoTamanho(lista, '')).toBe(lista);
    expect(pecasNoTamanho(lista, 'M')[0]).toBe(comRegra);
    expect(pecasNoTamanho(lista, 'XG')[0]).toBe(comRegra);
  });
});

describe('a descrição técnica preliminar (ADR 0223)', () => {
  it('diz o que os moldes têm', () => {
    const texto = descricaoTecnicaDosMoldes([peca('Frente', 100, 100, { quantidade: 2, margemDeCosturaMm: 10 }), peca('Manga', 100, 100, { quantidade: 2, emPar: true, margemDeCosturaMm: 15 }), peca('Rascunho', 10, 10, { naoUsar: true })]);
    expect(texto).toContain('Modelo com 2 moldes: Frente (2) e Manga (2, em par).');
    expect(texto).toContain('Costura de 10 mm e 15 mm.');
    expect(texto).not.toContain('Rascunho');
  });

  it('sem moldes, não inventa nada', () => {
    expect(descricaoTecnicaDosMoldes([])).toBe('');
  });
});

describe('a sequência de enfestos (ADR 0223)', () => {
  it('um por linha, na ordem, com o comprimento do risco de cada um', () => {
    const resultado = {
      riscos: [{ chave: 'r1', grade: { P: 1, M: 2 }, comprimentoMm: 3200, larguraMm: 1500 }, { chave: 'r2', grade: { G: 2 }, comprimentoMm: 2100, larguraMm: 1500 }],
      enfestos: [{ numero: 1, chave: 'r1', camadas: 40, folhas: 40, grupos: ['Lote A'] }, { numero: 2, chave: 'r2', camadas: 18, folhas: 18, grupos: ['Lote A', 'Lote B'] }],
    } as unknown as Pick<ResultadoDoPlanejamento, 'riscos' | 'enfestos'>;
    const linhas = csvDaSequenciaDeEnfestos(resultado).trim().split('\r\n');
    expect(linhas).toHaveLength(3);
    expect(linhas[1]).toBe('1;1 P + 2 M;3200,0;1500,0;40;40;Lote A');
    expect(linhas[2]).toBe('2;2 G;2100,0;1500,0;18;18;Lote A + Lote B');
  });
});

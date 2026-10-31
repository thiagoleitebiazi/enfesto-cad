import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { cantosDoContorno, definirRegra } from './graduacao';
import { criarMolde } from './molde';
import { comTamanhoSobMedida, posicaoDasMedidas, posicaoNaGrade } from './sobMedida';
import { contornoNoTamanho } from './tamanhoIntermediario';
import { definirTamanhosDoMolde } from './tamanhosGraduados';

const graduada = () => {
  const m = criarMolde({ nome: 'a', referencia: '', tamanho: 'M', contorno: [ponto(0, 0), ponto(400, 0), ponto(400, 300), ponto(0, 300)], linhaDeFio: { inicio: ponto(10, 10), fim: ponto(10, 90) } }, 'a');
  const base = definirTamanhosDoMolde(m, ['P', 'M', 'G'], 'M');
  const i = cantosDoContorno(base.contorno)[1]!;
  return { ...base, graduacao: definirRegra(base.graduacao!, base.contorno, i, [ponto(-20, 0), ponto(0, 0), ponto(20, 0)]) };
};

describe('o tamanho sob medida (ADR 0179)', () => {
  it('a posição na grade: dentro, com passos desiguais, e além das pontas', () => {
    expect(posicaoNaGrade([90, 96, 102], 96)).toBe(1);
    expect(posicaoNaGrade([90, 96, 102], 99)).toBe(1.5);
    expect(posicaoNaGrade([90, 94, 102], 92)).toBe(0.5);
    expect(posicaoNaGrade([90, 96, 102], 87)).toBe(-0.5);
    expect(posicaoNaGrade([90, 96, 102], 105)).toBe(2.5);
    expect(() => posicaoNaGrade([90, 90], 91)).toThrow(/não diz o tamanho/);
  });

  it('a média das medidas informadas; a medida sem valor em todos os tamanhos fica de fora', () => {
    const medidas = [
      { id: 'b', nome: 'Busto', comoMedir: '', toleranciaCm: 1, valoresCm: { P: 90, M: 96, G: 102 } },
      { id: 'q', nome: 'Quadril', comoMedir: '', toleranciaCm: 1, valoresCm: { P: 98, M: 104, G: 110 } },
      { id: 'x', nome: 'Sem G', comoMedir: '', toleranciaCm: 1, valoresCm: { P: 1, M: 2 } },
    ];
    const r = posicaoDasMedidas(medidas, ['P', 'M', 'G'], { b: 99, q: 104, x: 50 });
    expect(r.posicao).toBe(1.25);
    expect(r.porMedida.map((m) => m.nome)).toEqual(['Busto', 'Quadril']);
    expect(() => posicaoDasMedidas(medidas, ['P', 'M', 'G'], {})).toThrow(/ao menos uma medida/);
  });

  it('o tamanho novo fica na posição: as regras tiradas dos vizinhos, e os outros tamanhos não mudam', () => {
    const m = comTamanhoSobMedida(graduada(), 'Ana', 1.5);
    expect(m.graduacao!.tamanhos).toEqual(['P', 'M', 'Ana', 'G']);
    expect(contornoNoTamanho(m, 'Ana')[1]!.x).toBeCloseTo(410);
    expect(contornoNoTamanho(m, 'G')[1]!.x).toBeCloseTo(420);
    expect(contornoNoTamanho(m, 'M')[1]!.x).toBeCloseTo(400);
  });

  it('além das pontas, até um tamanho, seguindo o último passo; mais longe, recusa', () => {
    const maior = comTamanhoSobMedida(graduada(), 'Ana', 2.5);
    expect(maior.graduacao!.tamanhos).toEqual(['P', 'M', 'G', 'Ana']);
    expect(contornoNoTamanho(maior, 'Ana')[1]!.x).toBeCloseTo(430);
    const menor = comTamanhoSobMedida(graduada(), 'Bia', -0.5);
    expect(menor.graduacao!.tamanhos).toEqual(['Bia', 'P', 'M', 'G']);
    expect(contornoNoTamanho(menor, 'Bia')[1]!.x).toBeCloseTo(370);
    expect(() => comTamanhoSobMedida(graduada(), 'Ana', 3.5)).toThrow(/longe demais/);
    expect(() => comTamanhoSobMedida(graduada(), 'M', 1)).toThrow(/Já há/);
  });
});

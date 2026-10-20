import { describe, expect, it } from 'vitest';
import { camadasParaFechar, gerarComposicoes, gradesDasComposicoes, producaoDaComposicao, type Composicao } from './composicaoDeRiscos';

const TAMANHOS = ['P', 'M', 'G', 'GG'];
const resumo = (c: Composicao) => c.riscos.map((r) => `${TAMANHOS.map((t) => r.grade[t] ?? 0).join('/')}×${r.camadas}`);

describe('camadasParaFechar', () => {
  it('em cada tamanho, o pedido ÷ (roupas × folhas), para cima; vale o maior', () => {
    // 40 P ÷ 1, 80 M ÷ 2, 40 G ÷ 1 = 40 camadas.
    expect(camadasParaFechar({ P: 1, M: 2, G: 1 }, { P: 40, M: 80, G: 40 }, 1)).toBe(40);
    // 81 M com 2 por folha: 40,5 → 41.
    expect(camadasParaFechar({ M: 2 }, { M: 81 }, 1)).toBe(41);
    // No enfesto par (2 folhas por camada), metade: 81 ÷ 4 → 21.
    expect(camadasParaFechar({ M: 2 }, { M: 81 }, 2)).toBe(21);
    // Tamanho fora da grade não conta (o plano avisa à parte).
    expect(camadasParaFechar({ M: 1 }, { M: 10, G: 50 }, 1)).toBe(10);
  });
});

describe('gerarComposicoes', () => {
  it('a ordem proporcional (40/80/40) fecha num risco só, 1 P + 2 M + 1 G em 40 camadas, sem excedente', () => {
    const lista = gerarComposicoes({ P: 40, M: 80, G: 40 }, TAMANHOS, 1, 6);
    expect(lista[0]!.origem).toBe('grade proporcional à ordem');
    expect(resumo(lista[0]!)).toEqual(['1/2/1/0×40']);
  });

  it('com até 1 roupa por risco, um risco por tamanho, cada um com as camadas do pedido', () => {
    const uma = gerarComposicoes({ P: 40, M: 80, G: 40 }, TAMANHOS, 1, 6).find((c) => c.origem === 'gulosa até 1 roupa(s) por risco')!;
    expect(resumo(uma).sort()).toEqual(['0/0/1/0×40', '0/1/0/0×80', '1/0/0/0×40']);
  });

  it('nenhuma composição produz menos que a ordem, nem passa do limite de roupas por risco', () => {
    const pedido = { P: 37, M: 81, G: 42, GG: 19 };
    for (const folhas of [1, 2]) {
      const lista = gerarComposicoes(pedido, TAMANHOS, folhas, 5);
      expect(lista.length).toBeGreaterThan(1);
      for (const c of lista) {
        const producao = producaoDaComposicao(c.riscos, TAMANHOS, folhas);
        for (const t of TAMANHOS) expect(producao[t]).toBeGreaterThanOrEqual(pedido[t as keyof typeof pedido]);
        for (const r of c.riscos) expect(Object.values(r.grade).reduce((s, n) => s + n, 0)).toBeLessThanOrEqual(5);
      }
    }
  });

  it('quantidades ímpares no enfesto par: o excedente é o mínimo (1 a mais em cada tamanho que sobrou)', () => {
    // 5 P e 3 M, 2 folhas por camada, até 2 roupas por risco.
    const gulosa = gerarComposicoes({ P: 5, M: 3 }, TAMANHOS, 2, 2).find((c) => c.origem === 'gulosa até 2 roupa(s) por risco')!;
    expect(resumo(gulosa)).toEqual(['1/1/0/0×2', '1/0/0/0×1']);
    expect(producaoDaComposicao(gulosa.riscos, TAMANHOS, 2)).toEqual({ P: 6, M: 4, G: 0, GG: 0 });
  });

  it('sem repetir composição igual; as grades a fazer saem uma vez cada', () => {
    const lista = gerarComposicoes({ P: 40, M: 80, G: 40 }, TAMANHOS, 1, 6);
    const chaves = lista.map((c) => resumo(c).sort().join(';'));
    expect(new Set(chaves).size).toBe(chaves.length);
    const grades = gradesDasComposicoes(lista);
    expect(new Set(grades.map((g) => g.chave)).size).toBe(grades.length);
  });
});

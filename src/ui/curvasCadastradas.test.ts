import { describe, it, expect } from 'vitest';
import { ponto } from '../core/geometria';
import {
  curvaDoTrecho,
  CURVAS_DE_FABRICA,
  gravarCurvasCadastradas,
  lerCurvasCadastradas,
  type CurvaCadastrada,
} from './curvasCadastradas';

function armazenamentoEmMemoria(inicial: Record<string, string> = {}) {
  const dados = new Map(Object.entries(inicial));
  return {
    getItem: (chave: string) => dados.get(chave) ?? null,
    setItem: (chave: string, valor: string) => void dados.set(chave, valor),
    dados,
  };
}

describe('CURVAS_DE_FABRICA', () => {
  it('são arcos normalizados, com a flecha que o nome diz', () => {
    for (const curva of CURVAS_DE_FABRICA) {
      expect(curva.deFabrica).toBe(true);
      expect(curva.forma[0]).toEqual(ponto(0, 0));
      expect(curva.forma.at(-1)).toEqual(ponto(1, 0));
      expect(curva.forma.length).toBeGreaterThan(20);
    }
    const flecha = (c: CurvaCadastrada) => Math.max(...c.forma.map((p) => Math.abs(p.y)));
    expect(flecha(CURVAS_DE_FABRICA[0]!)).toBeCloseTo(0.1, 2);
    expect(flecha(CURVAS_DE_FABRICA[1]!)).toBeCloseTo(0.25, 2);
    expect(flecha(CURVAS_DE_FABRICA[2]!)).toBeCloseTo(0.5, 2);
  });
});

describe('curvaDoTrecho', () => {
  it('guarda só a forma, normalizada, e o nome sem espaços nas pontas', () => {
    const curva = curvaDoTrecho('c1', '  Cava da frente ', [ponto(100, 100), ponto(150, 180), ponto(100, 300)]);
    expect(curva.nome).toBe('Cava da frente');
    expect(curva.forma[0]).toEqual(ponto(0, 0));
    expect(curva.forma.at(-1)).toEqual(ponto(1, 0));
    expect(curva.deFabrica).toBeUndefined();
  });

  it('recusa nome vazio e trecho cujas pontas coincidem', () => {
    expect(() => curvaDoTrecho('c1', '   ', [ponto(0, 0), ponto(10, 10)])).toThrow('Dê um nome');
    expect(() => curvaDoTrecho('c1', 'Volta', [ponto(0, 0), ponto(10, 10), ponto(0, 0)])).toThrow('não tem direção');
  });
});

describe('ler e gravar curvas cadastradas', () => {
  const minha = curvaDoTrecho('c1', 'Cava', [ponto(0, 0), ponto(50, 20), ponto(100, 0)]);

  it('o que se grava é o que se lê de volta', () => {
    const armazenamento = armazenamentoEmMemoria();
    expect(gravarCurvasCadastradas(armazenamento, [minha])).toBe(true);
    expect(lerCurvasCadastradas(armazenamento)).toEqual([minha]);
  });

  it('as curvas de fábrica não são gravadas', () => {
    const armazenamento = armazenamentoEmMemoria();
    gravarCurvasCadastradas(armazenamento, [...CURVAS_DE_FABRICA, minha]);
    expect(lerCurvasCadastradas(armazenamento).map((c) => c.id)).toEqual(['c1']);
  });

  it('sem nada guardado, a lista é vazia', () => {
    expect(lerCurvasCadastradas(armazenamentoEmMemoria())).toEqual([]);
  });

  it('conteúdo ilegível ou de formato estranho vale como lista vazia, e itens ruins são descartados', () => {
    const chave = 'enfesto-cad:curvas-cadastradas';
    expect(lerCurvasCadastradas(armazenamentoEmMemoria({ [chave]: 'isto não é JSON' }))).toEqual([]);
    expect(lerCurvasCadastradas(armazenamentoEmMemoria({ [chave]: '{"id":"x"}' }))).toEqual([]);
    const misturado = JSON.stringify([minha, { id: 'ruim', nome: 'Sem forma' }, { id: 'r2', nome: 'Um ponto', forma: [{ x: 0, y: 0 }] }, null]);
    expect(lerCurvasCadastradas(armazenamentoEmMemoria({ [chave]: misturado }))).toEqual([minha]);
  });

  it('se o armazenamento recusar a gravação, avisa com false em vez de lançar erro', () => {
    const cheio = {
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    };
    expect(gravarCurvasCadastradas(cheio, [minha])).toBe(false);
  });
});

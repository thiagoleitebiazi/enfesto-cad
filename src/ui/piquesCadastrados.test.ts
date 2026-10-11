import { describe, it, expect } from 'vitest';
import { ponto } from '../core/geometria';
import type { PiqueCadastrado } from './ferramentasDeMarcacao';
import { gravarPiquesCadastrados, lerPiquesCadastrados } from './piquesCadastrados';

const SETA: PiqueCadastrado = { id: 'c1', nome: 'Seta', descricao: 'ponta fina', forma: [[ponto(-0.5, 0), ponto(0, 1), ponto(0.5, 0)]] };

function armazenamento(inicial: Record<string, string> = {}) {
  const dados = { ...inicial };
  return {
    dados,
    getItem: (chave: string): string | null => dados[chave] ?? null,
    setItem: (chave: string, valor: string): void => {
      dados[chave] = valor;
    },
  };
}

describe('o cadastro de formatos de pique deste computador', () => {
  it('grava e lê de volta os formatos', () => {
    const guardado = armazenamento();

    expect(lerPiquesCadastrados(guardado)).toEqual([]);
    expect(gravarPiquesCadastrados(guardado, [SETA])).toBe(true);
    expect(Object.keys(guardado.dados)).toEqual(['enfesto-cad:piques-cadastrados']);
    expect(lerPiquesCadastrados(guardado)).toEqual([SETA]);
  });

  it('o que não dá para ler vale como lista vazia, e o item estragado é deixado de fora', () => {
    const CHAVE = 'enfesto-cad:piques-cadastrados';

    expect(lerPiquesCadastrados(armazenamento({ [CHAVE]: 'isto não é JSON' }))).toEqual([]);
    expect(lerPiquesCadastrados(armazenamento({ [CHAVE]: '{"nao":"é lista"}' }))).toEqual([]);
    const misturado = JSON.stringify([SETA, { id: 'c2', nome: '', descricao: '', forma: SETA.forma }, { id: 'c3', nome: 'Sem forma', descricao: '', forma: [] }, { id: 'c4', nome: 'Traço curto', descricao: '', forma: [[{ x: 0, y: 0 }]] }, null, 7]);
    expect(lerPiquesCadastrados(armazenamento({ [CHAVE]: misturado }))).toEqual([SETA]);
  });

  it('se o armazenamento recusa a gravação, avisa com falso', () => {
    const cheio = {
      setItem: (): void => {
        throw new Error('cheio');
      },
    };
    expect(gravarPiquesCadastrados(cheio, [SETA])).toBe(false);
  });
});

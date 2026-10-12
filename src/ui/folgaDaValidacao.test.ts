import { describe, it, expect } from 'vitest';
import { FOLGA_FORA_DA_PECA_MM } from '../domain/linhasSoltas';
import { FOLGA_MAXIMA_MM, folgaDigitada, folgaEscrita, gravarFolgaForaDaPeca, lerFolgaForaDaPeca } from './folgaDaValidacao';

const CHAVE = 'enfesto-cad:folga-fora-da-peca';

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

describe('a folga das linhas internas, como é escrita no campo', () => {
  it('aceita o número com vírgula ou com ponto, de 0 a 100 mm', () => {
    expect(folgaDigitada('1')).toBe(1);
    expect(folgaDigitada('0,5')).toBe(0.5);
    expect(folgaDigitada(' 2.5 ')).toBe(2.5);
    expect(folgaDigitada('0')).toBe(0);
    expect(folgaDigitada('100')).toBe(100);
    expect(FOLGA_MAXIMA_MM).toBe(100);
  });

  it('o que não é um número assim não vale', () => {
    for (const texto of ['', '   ', 'abc', '-1', '100,1', '1,2,3', '1e2', ',5', '5,', '1 2']) {
      expect(folgaDigitada(texto)).toBeNull();
    }
  });

  it('aparece no campo com vírgula', () => {
    expect(folgaEscrita(1)).toBe('1');
    expect(folgaEscrita(0.5)).toBe('0,5');
    expect(folgaDigitada(folgaEscrita(12.25))).toBe(12.25);
  });
});

describe('a folga das linhas internas guardada neste computador', () => {
  it('sem nada guardado, vale a folga padrão; gravada, é lida de volta', () => {
    const guardado = armazenamento();

    expect(lerFolgaForaDaPeca(guardado)).toBe(FOLGA_FORA_DA_PECA_MM);
    expect(gravarFolgaForaDaPeca(guardado, 2.5)).toBe(true);
    expect(guardado.dados).toEqual({ [CHAVE]: '2.5' });
    expect(lerFolgaForaDaPeca(guardado)).toBe(2.5);
    expect(gravarFolgaForaDaPeca(guardado, 0)).toBe(true);
    expect(lerFolgaForaDaPeca(guardado)).toBe(0);
  });

  it('o que não dá para ler, ou está fora do que o campo aceita, vale como a folga padrão', () => {
    for (const estragado of ['{{{', '"dois"', '-3', '100.5', 'null', '[1]', 'true']) {
      expect(lerFolgaForaDaPeca(armazenamento({ [CHAVE]: estragado }))).toBe(FOLGA_FORA_DA_PECA_MM);
    }
    expect(lerFolgaForaDaPeca(armazenamento({ [CHAVE]: '100' }))).toBe(100);
    const semAcesso = {
      getItem: (): string | null => {
        throw new Error('armazenamento bloqueado');
      },
    };
    expect(lerFolgaForaDaPeca(semAcesso)).toBe(FOLGA_FORA_DA_PECA_MM);
  });

  it('se o armazenamento recusa a gravação, avisa com falso', () => {
    const cheio = {
      setItem: (): void => {
        throw new Error('sem espaço');
      },
    };
    expect(gravarFolgaForaDaPeca(cheio, 3)).toBe(false);
  });
});

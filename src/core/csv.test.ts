import { describe, expect, it } from 'vitest';
import { lerCsv, textoCsv } from './csv';

describe('a leitura de um CSV (ADR 0115)', () => {
  it('o ponto e vírgula, as aspas (com o separador, a aspa e a quebra de linha dentro), a marca do início e as linhas vazias', () => {
    const texto = '﻿Código;Descrição;Preço\r\nB1;"Botão; 12 mm";0,35\r\n\r\nB2;"Fita ""cetim""\nlarga";1,20\r\n';
    expect(lerCsv(texto)).toEqual([
      ['Código', 'Descrição', 'Preço'],
      ['B1', 'Botão; 12 mm', '0,35'],
      ['B2', 'Fita "cetim"\nlarga', '1,20'],
    ]);
  });

  it('o colado do Excel (tabulação) e a volta do que o programa escreve', () => {
    expect(lerCsv('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    const linhas = [
      ['x', 'y;z'],
      ['"q"', ''],
    ];
    expect(lerCsv(textoCsv(linhas))).toEqual(linhas);
  });

  it('o CSV com vírgula (o de programa em inglês), com o número entre aspas', () => {
    expect(lerCsv('Code,Description,Price\nB1,Button,"1,50"')).toEqual([
      ['Code', 'Description', 'Price'],
      ['B1', 'Button', '1,50'],
    ]);
  });
});

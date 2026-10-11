import { describe, it, expect } from 'vitest';
import { ponto } from '../core/geometria';
import { iniciarGraduacao } from '../domain/graduacao';
import {
  criarConjuntoDeRegras,
  gravarConjuntosDeRegras,
  gravarRegrasCadastradas,
  lerConjuntosDeRegras,
  lerRegrasCadastradas,
  regraDaVez,
  regraDoPonto,
  regraParaAGraduacao,
  regrasDoConjunto,
  type RegraCadastrada,
} from './regrasDeGraduacao';
import { paraAbsoluto, paraATela, paraIncremental, paraOCampo, paraOMundo } from './tabelaDeGraduacao';

const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
const ZERO = ponto(0, 0);
const OMBRO: RegraCadastrada = { id: 'r1', nome: 'Ombro', tamanhos: ['P', 'M', 'G'], base: 'M', deslocamentos: [ponto(-3, -6), ZERO, ponto(3, 6)] };

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

describe('cadastro de regras', () => {
  it('grava e lê de volta', () => {
    const a = armazenamento();
    expect(gravarRegrasCadastradas(a, [OMBRO])).toBe(true);
    expect(lerRegrasCadastradas(a)).toEqual([OMBRO]);
  });

  it('sem nada guardado, a lista é vazia', () => {
    expect(lerRegrasCadastradas(armazenamento())).toEqual([]);
  });

  it('o conteúdo que não dá para ler vale como lista vazia; as regras malformadas são ignoradas', () => {
    const chave = 'enfesto-cad:regras-de-graduacao';
    expect(lerRegrasCadastradas(armazenamento({ [chave]: '{não é json' }))).toEqual([]);
    expect(lerRegrasCadastradas(armazenamento({ [chave]: '"texto"' }))).toEqual([]);
    const misturado = JSON.stringify([
      OMBRO,
      { id: 'x', nome: 'Sem deslocamentos', tamanhos: ['P', 'M'], base: 'M' },
      { id: 'y', nome: 'Tamanhos a mais', tamanhos: ['P', 'M', 'G'], base: 'M', deslocamentos: [ZERO, ZERO] },
      { id: 'z', nome: 'Um tamanho só', tamanhos: ['M'], base: 'M', deslocamentos: [ZERO] },
      null,
    ]);
    expect(lerRegrasCadastradas(armazenamento({ [chave]: misturado }))).toEqual([OMBRO]);
  });

  it('avisa quando não deu para gravar', () => {
    const cheio = {
      setItem: (): void => {
        throw new Error('sem espaço');
      },
    };
    expect(gravarRegrasCadastradas(cheio, [OMBRO])).toBe(false);
  });
});

describe('regraDoPonto', () => {
  const graduacao = iniciarGraduacao(RETANGULO, ['P', 'M', 'G'], 1);

  it('guarda os tamanhos, o base e os deslocamentos, com o nome sem espaços nas pontas', () => {
    expect(regraDoPonto('r1', '  Ombro ', graduacao, OMBRO.deslocamentos)).toEqual(OMBRO);
  });

  it('pede um nome', () => {
    expect(() => regraDoPonto('r1', '   ', graduacao, OMBRO.deslocamentos)).toThrow('Dê um nome à regra.');
  });
});

describe('regraParaAGraduacao', () => {
  it('vale pelo nome de cada tamanho, mesmo em outra ordem ou com tamanhos a menos na peça', () => {
    const soDois = iniciarGraduacao(RETANGULO, ['m', 'g'], 0);
    expect(regraParaAGraduacao(OMBRO, soDois)).toEqual([ZERO, ponto(3, 6)]);
  });

  it('é contada a partir do base da peça, mesmo que seja outro', () => {
    // Na peça, o base é o G: o M fica (−3, −6) e o P, (−6, −12).
    const baseNoG = iniciarGraduacao(RETANGULO, ['P', 'M', 'G'], 2);
    expect(regraParaAGraduacao(OMBRO, baseNoG)).toEqual([ponto(-6, -12), ponto(-3, -6), ZERO]);
  });

  it('recusa a peça que tem um tamanho que a regra não tem', () => {
    const comGG = iniciarGraduacao(RETANGULO, ['P', 'M', 'G', 'GG'], 1);
    expect(() => regraParaAGraduacao(OMBRO, comGG)).toThrow('A regra “Ombro” não tem o tamanho GG: ela foi criada para P, M, G.');
    const outros = iniciarGraduacao(RETANGULO, ['36', '38', 'M'], 2);
    expect(() => regraParaAGraduacao(OMBRO, outros)).toThrow(/não tem os tamanhos 36, 38/);
  });
});

describe('tabela: tela e mundo, absoluto e incremental', () => {
  it('DX é a horizontal da tela (o y do mundo) e DY é a vertical (o x)', () => {
    expect(paraATela(ponto(10, 20))).toEqual({ dx: 20, dy: 10 });
    expect(paraOMundo({ dx: 20, dy: 10 })).toEqual(ponto(10, 20));
  });

  it('incremental: a diferença de cada tamanho para o vizinho do lado do base', () => {
    // PP, P, M (base), G, GG andando −20, −10, 0, 10, 25.
    expect(paraIncremental([-20, -10, 0, 10, 25], 2)).toEqual([-10, -10, 0, 10, 15]);
    expect(paraIncremental([0, 10, 20], 0)).toEqual([0, 10, 10]);
    expect(paraIncremental([-20, -10, 0], 2)).toEqual([-10, -10, 0]);
  });

  it('absoluto é o caminho de volta', () => {
    expect(paraAbsoluto([-10, -10, 0, 10, 15], 2)).toEqual([-20, -10, 0, 10, 25]);
    for (const [valores, base] of [
      [[-7, -3, 0, 4, 9], 2],
      [[0, 5, 11, 18], 0],
      [[-9, -4, -1, 0], 3],
    ] as const) {
      expect(paraAbsoluto(paraIncremental(valores, base), base)).toEqual([...valores]);
    }
  });

  it('o número vai para o campo com vírgula, sem ruído de conta e sem zero negativo', () => {
    expect(paraOCampo(12.5)).toBe('12,5');
    expect(paraOCampo(10)).toBe('10');
    expect(paraOCampo(0.1 + 0.2)).toBe('0,3');
    expect(paraOCampo(-0)).toBe('0');
    expect(paraOCampo(-0.0001)).toBe('0');
    expect(paraOCampo(-3.25)).toBe('-3,25');
  });
});

describe('código da regra e conjuntos de regras', () => {
  const CAVA: RegraCadastrada = { id: 'r2', nome: 'Cava', tamanhos: ['P', 'M', 'G'], base: 'M', deslocamentos: [ponto(0, -4), ZERO, ponto(0, 4)] };
  const graduacao = iniciarGraduacao(RETANGULO, ['P', 'M', 'G'], 1);

  it('a regra guarda o código, sem espaços sobrando; sem código, não guarda nada', () => {
    expect(regraDoPonto('r9', 'Gola', graduacao, OMBRO.deslocamentos, '  G-7 ').codigo).toBe('G-7');
    expect('codigo' in regraDoPonto('r9', 'Gola', graduacao, OMBRO.deslocamentos)).toBe(false);
    expect('codigo' in regraDoPonto('r9', 'Gola', graduacao, OMBRO.deslocamentos, '   ')).toBe(false);
  });

  it('o código vai e volta do cadastro; o de antes, sem código, continua lido', () => {
    const a = armazenamento();
    gravarRegrasCadastradas(a, [{ ...OMBRO, codigo: 'A12' }, CAVA]);
    const lidas = lerRegrasCadastradas(a);

    expect(lidas[0]!.codigo).toBe('A12');
    expect('codigo' in lidas[1]!).toBe(false);
  });

  it('um conjunto pede nome e pelo menos duas regras, e guarda a ordem', () => {
    expect(criarConjuntoDeRegras('c1', ' Blusa ', ['r2', 'r1'])).toEqual({ id: 'c1', nome: 'Blusa', regras: ['r2', 'r1'] });
    expect(() => criarConjuntoDeRegras('c1', '  ', ['r1', 'r2'])).toThrow('Dê um nome ao conjunto');
    expect(() => criarConjuntoDeRegras('c1', 'Blusa', ['r1'])).toThrow('pelo menos duas regras');
    expect(() => criarConjuntoDeRegras('c1', 'Blusa', Array.from({ length: 41 }, (_, i) => 'r' + i))).toThrow('no máximo, 40 regras');
  });

  it('os conjuntos vão e voltam do cadastro, numa chave própria; o que não dá para ler vale como lista vazia', () => {
    const a = armazenamento();
    expect(gravarConjuntosDeRegras(a, [criarConjuntoDeRegras('c1', 'Blusa', ['r2', 'r1'])])).toBe(true);
    expect(lerConjuntosDeRegras(a)).toEqual([{ id: 'c1', nome: 'Blusa', regras: ['r2', 'r1'] }]);
    // As regras continuam onde estavam.
    expect(lerRegrasCadastradas(a)).toEqual([]);
    expect(lerConjuntosDeRegras(armazenamento({ 'enfesto-cad:conjuntos-de-regras': 'isto não é JSON' }))).toEqual([]);
    expect(lerConjuntosDeRegras(armazenamento({ 'enfesto-cad:conjuntos-de-regras': '[{"id":"c1","nome":"X","regras":[1]}]' }))).toEqual([]);
  });

  it('as regras do conjunto saem na ordem dele, sem as que já foram apagadas do cadastro', () => {
    const conjunto = criarConjuntoDeRegras('c1', 'Blusa', ['r2', 'apagada', 'r1']);

    expect(regrasDoConjunto(conjunto, [OMBRO, CAVA]).map((r) => r.nome)).toEqual(['Cava', 'Ombro']);
    expect(regrasDoConjunto(conjunto, [])).toEqual([]);
  });

  it('a regra da vez segue a ordem e dá a volta quando o conjunto acaba', () => {
    const conjunto = criarConjuntoDeRegras('c1', 'Blusa', ['r2', 'r1']);

    expect(regraDaVez(conjunto, [OMBRO, CAVA], 0)).toEqual({ regra: CAVA, numero: 1, total: 2 });
    expect(regraDaVez(conjunto, [OMBRO, CAVA], 1)).toEqual({ regra: OMBRO, numero: 2, total: 2 });
    expect(regraDaVez(conjunto, [OMBRO, CAVA], 2)!.regra).toBe(CAVA);
    expect(regraDaVez(conjunto, [], 0)).toBeNull();
  });
});

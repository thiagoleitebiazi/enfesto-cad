import { describe, it, expect } from 'vitest';
import { ponto } from '../core/geometria';
import { iniciarGraduacao } from '../domain/graduacao';
import { regraDoPonto, regraParaAGraduacao } from './regrasDeGraduacao';
import {
  comIncremental,
  comOBaseNa,
  comOMesmoPasso,
  comTamanhoNovo,
  regraDaTabela,
  semOTamanho,
  tabelaDaRegra,
  valoresDaTabela,
  type TabelaDaRegra,
} from './tabelaDaRegra';

const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
const ZERO = ponto(0, 0);
// P, M (base) e G; o ponto anda, no mundo, (3, 6) no G e (-3, -6) no P: na tela, DX é o y do mundo (6) e DY é o x (3).
const TAMANHOS = ['P', 'M', 'G'];
const DO_PONTO = [ponto(-3, -6), ZERO, ponto(3, 6)];
const graduacao = iniciarGraduacao(RETANGULO, TAMANHOS, 1);

const aberta = (): TabelaDaRegra => tabelaDaRegra(TAMANHOS, 1, DO_PONTO);
const celulas = (tabela: TabelaDaRegra): string[][] => tabela.linhas.map((l) => [l.tamanho, l.dx, l.dy]);
/** A tabela com outro texto num campo. */
const com = (tabela: TabelaDaRegra, linha: number, campo: 'tamanho' | 'dx' | 'dy', texto: string): TabelaDaRegra => ({
  ...tabela,
  linhas: tabela.linhas.map((l, t) => (t === linha ? { ...l, [campo]: texto } : l)),
});

describe('a tabela do “Criar regra”', () => {
  it('abre com uma linha por tamanho: o nome, e o DX e o DY do ponto contados do base', () => {
    expect(aberta()).toEqual({
      linhas: [
        { tamanho: 'P', dx: '-6', dy: '-3' },
        { tamanho: 'M', dx: '0', dy: '0' },
        { tamanho: 'G', dx: '6', dy: '3' },
      ],
      base: 1,
      incremental: false,
    });
    // O ponto sem regra abre com zeros; as casas vêm com vírgula.
    expect(celulas(tabelaDaRegra(TAMANHOS, 1, []))).toEqual([['P', '0', '0'], ['M', '0', '0'], ['G', '0', '0']]);
    expect(tabelaDaRegra(TAMANHOS, 1, [ponto(-1.25, -7.5), ZERO, ponto(1.25, 7.5)]).linhas[2]).toEqual({ tamanho: 'G', dx: '7,5', dy: '1,25' });
  });

  it('sem mexer na tabela, a regra é a do ponto', () => {
    expect(regraDaTabela('r1', ' Ombro ', ' A1 ', aberta())).toEqual({ id: 'r1', nome: 'Ombro', codigo: 'A1', tamanhos: ['P', 'M', 'G'], base: 'M', deslocamentos: DO_PONTO });
    expect(regraDaTabela('r1', 'Ombro', 'A1', aberta())).toEqual(regraDoPonto('r1', 'Ombro', graduacao, DO_PONTO, 'A1'));
    expect('codigo' in regraDaTabela('r1', 'Ombro', '  ', aberta())).toBe(false);
  });

  it('os números podem ser mudados: com vírgula ou ponto nas casas, e com espaços', () => {
    const mudada = com(com(com(aberta(), 0, 'dx', ' -7,5 '), 2, 'dx', '7.5'), 2, 'dy', '1');
    // DX é o y do mundo; DY é o x.
    expect(regraDaTabela('r1', 'Ombro', '', mudada).deslocamentos).toEqual([ponto(-3, -7.5), ZERO, ponto(1, 7.5)]);
    // O que estiver escrito na linha do base não conta: ela é sempre zero.
    expect(regraDaTabela('r1', 'Ombro', '', com(aberta(), 1, 'dx', '99')).deslocamentos).toEqual(DO_PONTO);
    expect(valoresDaTabela(com(aberta(), 1, 'dy', 'x'))).toEqual({ dx: [-6, 0, 6], dy: [-3, 0, 3] });
  });

  it('o campo que não é número é recusado pelo nome do tamanho — e o campo vazio não vale zero', () => {
    expect(() => valoresDaTabela(com(aberta(), 2, 'dx', 'seis'))).toThrow('O DX do tamanho G precisa ser um número em mm.');
    expect(() => valoresDaTabela(com(aberta(), 0, 'dy', ''))).toThrow('O DY do tamanho P precisa ser um número em mm.');
    expect(() => valoresDaTabela(com(com(aberta(), 0, 'tamanho', ' '), 0, 'dx', '  '))).toThrow('O DX da linha 1 precisa ser um número em mm.');
  });
});

describe('“Incremental”', () => {
  // PP, P, M (base), G, GG, com o DX andando 6, 6, –, 6 e 8 de vizinho em vizinho.
  const cinco = (): TabelaDaRegra => tabelaDaRegra(['PP', 'P', 'M', 'G', 'GG'], 2, [ponto(0, -12), ponto(0, -6), ZERO, ponto(0, 6), ponto(0, 14)]);

  it('mostra a diferença de cada tamanho para o vizinho do lado do base; a regra é a mesma', () => {
    const ligada = comIncremental(cinco(), true);

    expect(ligada.incremental).toBe(true);
    expect(ligada.linhas.map((l) => l.dx)).toEqual(['-6', '-6', '0', '6', '8']);
    expect(valoresDaTabela(ligada)).toEqual(valoresDaTabela(cinco()));
    // Desligada de novo, volta ao que era; ligar o que já está ligado não muda nada.
    expect(comIncremental(ligada, false)).toEqual(cinco());
    expect(comIncremental(ligada, true)).toBe(ligada);
  });

  it('os números digitados no incremental são somados a partir do base', () => {
    const digitada = com(com(comIncremental(cinco(), true), 4, 'dx', '10'), 0, 'dx', '-4');
    expect(valoresDaTabela(digitada).dx).toEqual([-10, -6, 0, 6, 16]);
    expect(regraDaTabela('r1', 'Ombro', '', digitada).deslocamentos.map((d) => d.y)).toEqual([-10, -6, 0, 6, 16]);
  });

  it('com um campo que não é número, não muda: a mensagem diz qual', () => {
    expect(() => comIncremental(com(cinco(), 3, 'dx', '?'), true)).toThrow('O DX do tamanho G precisa ser um número em mm.');
  });
});

describe('definir outro tamanho como base', () => {
  it('os números passam a ser contados dele, e a regra continua a mesma', () => {
    const noP = comOBaseNa(aberta(), 0);

    expect(noP.base).toBe(0);
    expect(celulas(noP)).toEqual([['P', '0', '0'], ['M', '6', '3'], ['G', '12', '6']]);
    const regra = regraDaTabela('r1', 'Ombro', '', noP);
    expect(regra.base).toBe('P');
    expect(regra.deslocamentos).toEqual([ZERO, ponto(3, 6), ponto(6, 12)]);
    // Aplicada numa peça de base M, dá o mesmo que a regra de antes.
    expect(regraParaAGraduacao(regra, graduacao)).toEqual(DO_PONTO);
    expect(comOBaseNa(aberta(), 1)).toEqual(aberta());
  });

  it('no incremental, as diferenças para o vizinho passam a apontar para o base novo', () => {
    const noG = comOBaseNa(comIncremental(aberta(), true), 2);
    // Do G para trás: o M está 6 antes do G, e o P, 6 antes do M.
    expect(celulas(noG)).toEqual([['P', '-6', '-3'], ['M', '-6', '-3'], ['G', '0', '0']]);
    expect(valoresDaTabela(noG)).toEqual({ dx: [-12, -6, 0], dy: [-6, -3, 0] });
  });
});

describe('criar um tamanho', () => {
  it('abaixo da última linha: sem nome, continuando o passo de quem está na ponta', () => {
    const comMais = comTamanhoNovo(aberta(), 2, 'abaixo');

    expect(celulas(comMais)).toEqual([['P', '-6', '-3'], ['M', '0', '0'], ['G', '6', '3'], ['', '12', '6']]);
    expect(comMais.base).toBe(1);
    // Com o nome dado, a regra serve para a peça que tem esse tamanho.
    const regra = regraDaTabela('r1', 'Ombro', '', com(comMais, 3, 'tamanho', 'GG'));
    expect(regra.tamanhos).toEqual(['P', 'M', 'G', 'GG']);
    expect(regraParaAGraduacao(regra, iniciarGraduacao(RETANGULO, ['M', 'G', 'GG'], 0))).toEqual([ZERO, ponto(3, 6), ponto(6, 12)]);
  });

  it('acima da primeira linha: continua o passo para o outro lado, e o base desce uma linha', () => {
    const comMais = comTamanhoNovo(aberta(), 0, 'acima');

    expect(celulas(comMais)).toEqual([['', '-12', '-6'], ['P', '-6', '-3'], ['M', '0', '0'], ['G', '6', '3']]);
    expect(comMais.base).toBe(2);
  });

  it('entre dois tamanhos: no meio dos dois, sem mudar os números dos outros', () => {
    expect(celulas(comTamanhoNovo(aberta(), 2, 'acima'))).toEqual([['P', '-6', '-3'], ['M', '0', '0'], ['', '3', '1,5'], ['G', '6', '3']]);
    // Acima do base e abaixo do P é o mesmo lugar.
    expect(comTamanhoNovo(aberta(), 1, 'acima')).toEqual(comTamanhoNovo(aberta(), 0, 'abaixo'));
    expect(celulas(comTamanhoNovo(aberta(), 1, 'acima'))).toEqual([['P', '-6', '-3'], ['', '-3', '-1,5'], ['M', '0', '0'], ['G', '6', '3']]);
    expect(comTamanhoNovo(aberta(), 1, 'acima').base).toBe(2);
  });

  it('no incremental, os outros tamanhos continuam onde estavam', () => {
    const antes = comIncremental(aberta(), true);
    const comMais = comTamanhoNovo(antes, 2, 'acima');

    // O novo está a 3 do M, e o G passa a estar a 3 do novo: continua a 6 do base.
    expect(celulas(comMais)).toEqual([['P', '-6', '-3'], ['M', '0', '0'], ['', '3', '1,5'], ['G', '3', '1,5']]);
    expect(valoresDaTabela(comMais).dx).toEqual([-6, 0, 3, 6]);
  });

  it('recusa passar do máximo de tamanhos, e a tabela com um campo que não é número', () => {
    const vinte = tabelaDaRegra(Array.from({ length: 20 }, (_, t) => `T${t}`), 0, []);
    expect(() => comTamanhoNovo(vinte, 19, 'abaixo')).toThrow('São aceitos até 20 tamanhos.');
    expect(() => comTamanhoNovo(com(aberta(), 0, 'dx', ''), 2, 'abaixo')).toThrow('O DX do tamanho P precisa ser um número em mm.');
  });
});

describe('excluir um tamanho', () => {
  it('a linha sai, e os números dos outros não mudam', () => {
    const quatro = com(comTamanhoNovo(aberta(), 2, 'abaixo'), 3, 'tamanho', 'GG');

    expect(celulas(semOTamanho(quatro, 2))).toEqual([['P', '-6', '-3'], ['M', '0', '0'], ['GG', '12', '6']]);
    // Acima do base: o base sobe uma linha.
    const semP = semOTamanho(quatro, 0);
    expect(celulas(semP)).toEqual([['M', '0', '0'], ['G', '6', '3'], ['GG', '12', '6']]);
    expect(semP.base).toBe(0);
  });

  it('no incremental, quem vinha depois da linha que sai continua onde estava', () => {
    const quatro = comIncremental(com(comTamanhoNovo(aberta(), 2, 'abaixo'), 3, 'tamanho', 'GG'), true);
    const semG = semOTamanho(quatro, 2);

    expect(celulas(semG)).toEqual([['P', '-6', '-3'], ['M', '0', '0'], ['GG', '12', '6']]);
    expect(valoresDaTabela(semG).dx).toEqual([-6, 0, 12]);
  });

  it('o que está digitado na linha que sai não precisa ser número', () => {
    const quatro = com(comTamanhoNovo(aberta(), 2, 'abaixo'), 3, 'dx', 'doze');
    expect(celulas(semOTamanho(quatro, 3))).toEqual(celulas(aberta()));
    // Mas o das outras, sim.
    expect(() => semOTamanho(quatro, 0)).toThrow('O DX da linha 4 precisa ser um número em mm.');
  });

  it('o base não sai, e a regra não fica com menos de dois tamanhos', () => {
    expect(() => semOTamanho(aberta(), 1)).toThrow('O tamanho base não pode ser excluído: defina outro como base antes.');
    expect(() => semOTamanho(semOTamanho(aberta(), 0), 1)).toThrow('A regra precisa de pelo menos dois tamanhos: o base e mais um.');
  });
});

describe('“Mesmo passo em todos”', () => {
  // PP, P, M (base), G, GG: o DX do GG é 20, e os outros estão fora do passo.
  const cinco = (): TabelaDaRegra => tabelaDaRegra(['PP', 'P', 'M', 'G', 'GG'], 2, [ponto(-1, -3), ponto(0, -7), ZERO, ponto(2, 4), ponto(8, 20)]);

  it('o que a linha escolhida anda por tamanho passa a valer para todos: os maiores para esse lado, os menores para o outro', () => {
    const igualada = comOMesmoPasso(cinco(), 4);

    // O GG está a dois tamanhos do base: o passo é 10 no DX e 4 no DY. A linha escolhida fica como está.
    expect(celulas(igualada)).toEqual([
      ['PP', '-20', '-8'],
      ['P', '-10', '-4'],
      ['M', '0', '0'],
      ['G', '10', '4'],
      ['GG', '20', '8'],
    ]);
    // Por um tamanho menor que o base: o passo é o dele, para o outro lado.
    expect(comOMesmoPasso(cinco(), 1).linhas.map((l) => l.dx)).toEqual(['-14', '-7', '0', '7', '14']);
  });

  it('no incremental, o passo é o número que a linha mostra', () => {
    const incremental = comIncremental(cinco(), true);
    // O GG mostra 16 no DX (de 4 para 20) e 6 no DY.
    expect(incremental.linhas[4]).toEqual({ tamanho: 'GG', dx: '16', dy: '6' });
    const igualada = comOMesmoPasso(incremental, 4);

    expect(igualada.linhas.map((l) => l.dx)).toEqual(['-16', '-16', '0', '16', '16']);
    expect(valoresDaTabela(igualada).dx).toEqual([-32, -16, 0, 16, 32]);
    // Por um menor que o base: o PP mostra 4 (de −7 para −3). Ele fica como está, e os maiores que o base vão para o outro lado.
    expect(incremental.linhas[0]!.dx).toBe('4');
    const peloPP = comOMesmoPasso(incremental, 0);
    expect(peloPP.linhas[0]!.dx).toBe('4');
    expect(valoresDaTabela(peloPP).dx).toEqual([8, 4, 0, -4, -8]);
  });

  it('a linha do base não serve de passo', () => {
    expect(() => comOMesmoPasso(cinco(), 2)).toThrow('Escolha a linha de um tamanho que não seja o base: é o DX e o DY dela que viram o passo de todos.');
  });
});

describe('o que a regra exige da tabela', () => {
  it('recusa a tabela que não serve, dizendo o que falta', () => {
    expect(() => regraDaTabela('r1', '  ', '', aberta())).toThrow('Dê um nome à regra.');
    expect(() => regraDaTabela('r1', 'Ombro', '', comTamanhoNovo(aberta(), 2, 'abaixo'))).toThrow('Dê um nome ao tamanho da linha 4.');
    expect(() => regraDaTabela('r1', 'Ombro', '', com(aberta(), 2, 'tamanho', ' p '))).toThrow('O tamanho “p” aparece mais de uma vez.');
    expect(() => regraDaTabela('r1', 'Ombro', '', com(aberta(), 2, 'tamanho', 'G, GG'))).toThrow('O nome do tamanho “G, GG” não pode ter vírgula nem ponto e vírgula.');
    expect(() => regraDaTabela('r1', 'Ombro', '', com(aberta(), 2, 'dy', 'x'))).toThrow('O DY do tamanho G precisa ser um número em mm.');
    expect(() => regraDaTabela('r1', 'Ombro', '', { linhas: [{ tamanho: 'M', dx: '0', dy: '0' }], base: 0, incremental: false })).toThrow(
      'A regra precisa de pelo menos dois tamanhos: o base e mais um.',
    );
  });

  it('os nomes dos tamanhos vão sem os espaços das pontas, e o zero negativo não vai para o cadastro', () => {
    const regra = regraDaTabela('r1', 'Ombro', '', com(com(aberta(), 2, 'tamanho', ' GG '), 2, 'dx', '-0'));
    expect(regra.tamanhos).toEqual(['P', 'M', 'GG']);
    expect(Object.is(regra.deslocamentos[2]!.y, 0)).toBe(true);
  });
});

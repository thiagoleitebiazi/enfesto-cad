import { describe, it, expect } from 'vitest';
import { ponto } from '../core/geometria';
import { adicionarPique, criarMolde, type Molde } from '../domain/molde';
import { definirGraduacaoDoPique, referenciaDoPique } from '../domain/piquesGraduados';
import { definirTamanhosDoMolde } from '../domain/tamanhosGraduados';
import { cliqueDeGraduacao, instrucaoDaGraduacao, OPCOES_INICIAIS_DA_GRADUACAO } from './ferramentasDeGraduacao';
import { SEM_TRECHO } from './ferramentasDeTrecho';
import { aplicarDialogoDoPique, dialogoDoPique } from './graduacaoDePiques';

const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];

/** Uma peça com P, M (base) e G, um pique a 50 mm do canto (0, 0) e outro a 20 mm do canto (200, 0). */
function peca(): Molde {
  const base = criarMolde({ nome: 'Frente', referencia: 'REF', tamanho: 'M', contorno: RETANGULO, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) } }, 'f');
  return definirTamanhosDoMolde(adicionarPique(adicionarPique(base, ponto(50, 0), 'p1'), ponto(180, 0), 'p2'), ['P', 'M', 'G'], 'M');
}

const VALORES = { referencia: 1, 'perimetro-0': -5, 'perimetro-2': 10, incremental: false, inverter: false, todos: false, remover: false };
const perimetros = (molde: Molde, id: string) => molde.piques.find((q) => q.id === id)!.graduacao?.perimetros;

describe('a janela da graduação do pique', () => {
  it('propõe o ponto graduado mais perto como referência e traz um campo por tamanho, menos o base', () => {
    const dialogo = dialogoDoPique(peca(), 'p1')!;

    expect(dialogo.titulo).toBe('Graduação do pique');
    expect(dialogo.resumo).toEqual([
      ['Peça', 'Frente'],
      ['Pique', 'a 50,0 mm do ponto 1, sobre o contorno — proporcional à aresta'],
    ]);
    expect(dialogo.campos.map((c) => [c.id, c.inicial])).toEqual([
      ['referencia', '1'],
      ['perimetro-0', '0'],
      ['perimetro-2', '0'],
      ['incremental', false],
      ['inverter', false],
      ['todos', false],
      ['remover', false],
    ]);
  });

  it('no pique já graduado, mostra a referência e os valores dele', () => {
    const graduada = definirGraduacaoDoPique(peca(), 'p1', 1, [-5, 0, 10]);
    const dialogo = dialogoDoPique(graduada, 'p1')!;

    expect(dialogo.resumo[1]![1]).toBe('a 150,0 mm do ponto 2, sobre o contorno — graduado');
    expect(dialogo.campos.slice(0, 3).map((c) => c.inicial)).toEqual(['2', '-5', '10']);
  });

  it('não abre sem graduação na peça, nem para um pique que não é dela', () => {
    const semTamanhos = adicionarPique(criarMolde({ nome: 'F', referencia: 'R', tamanho: 'M', contorno: RETANGULO, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) } }, 'x'), ponto(50, 0), 'p1');
    expect(dialogoDoPique(semTamanhos, 'p1')).toBeNull();
    expect(dialogoDoPique(peca(), 'outro')).toBeNull();
  });
});

describe('aplicar a janela do pique', () => {
  it('gradua o pique a partir do ponto de referência digitado, e a mensagem diz', () => {
    const resultado = aplicarDialogoDoPique([peca()], peca(), 'p1', VALORES);
    const nova = resultado.pecas[0]!;

    expect(perimetros(nova, 'p1')).toEqual([-5, 0, 10]);
    expect(referenciaDoPique(nova, nova.piques[0]!)).toBe(0);
    expect(perimetros(nova, 'p2')).toBeUndefined();
    expect(resultado.recado).toBe('Pique de “Frente” graduado a partir do ponto 1: no tamanho G, o perímetro muda 10,0 mm.');
  });

  it('“Incremental” lê os valores como a diferença para o tamanho vizinho; “Inverter sinal” troca o sinal', () => {
    // Em quatro tamanhos, incremental 4 e 6 acima do base dá 4 e 10.
    const quatro = definirTamanhosDoMolde(peca(), ['P', 'M', 'G', 'GG'], 'M');
    const incremental = aplicarDialogoDoPique([quatro], quatro, 'p1', { ...VALORES, 'perimetro-0': -3, 'perimetro-2': 4, 'perimetro-3': 6, incremental: true });
    expect(perimetros(incremental.pecas[0]!, 'p1')).toEqual([-3, 0, 4, 10]);

    const invertido = aplicarDialogoDoPique([peca()], peca(), 'p1', { ...VALORES, inverter: true });
    expect(perimetros(invertido.pecas[0]!, 'p1')).toEqual([5, 0, -10]);
  });

  it('“= Perímetro” leva os mesmos valores a todos os piques, cada um a partir do ponto graduado mais perto dele', () => {
    const resultado = aplicarDialogoDoPique([peca()], peca(), 'p1', { ...VALORES, todos: true });
    const nova = resultado.pecas[0]!;

    expect(perimetros(nova, 'p2')).toEqual([-5, 0, 10]);
    // O segundo pique está a 20 mm do ponto 2: é dele que a distância é contada.
    expect(referenciaDoPique(nova, nova.piques[1]!)).toBe(1);
    expect(resultado.recado).toMatch(/O outro pique levou os mesmos valores, cada um a partir do ponto graduado mais perto dele\.$/);
  });

  it('“Tirar a graduação” devolve o pique à proporção da aresta', () => {
    const graduada = definirGraduacaoDoPique(peca(), 'p1', 0, [-5, 0, 10]);
    const resultado = aplicarDialogoDoPique([graduada], graduada, 'p1', { ...VALORES, remover: true });

    expect(perimetros(resultado.pecas[0]!, 'p1')).toBeUndefined();
    expect(resultado.recado).toBe('Graduação tirada do pique de “Frente”: ele volta a andar na proporção da aresta.');
  });

  it('recusa a referência fora do contorno e o valor que não é número', () => {
    expect(() => aplicarDialogoDoPique([peca()], peca(), 'p1', { ...VALORES, referencia: 9 })).toThrow(/de 1 a 4/);
    expect(() => aplicarDialogoDoPique([peca()], peca(), 'p1', { ...VALORES, 'perimetro-2': 'x' })).toThrow(/precisam ser números/);
  });
});

describe('a Tabela e os piques', () => {
  const O = OPCOES_INICIAIS_DA_GRADUACAO;

  it('o clique num pique, fora de um ponto do contorno, pede a tabela dele', () => {
    const clique = { noContorno: { indiceAresta: 0, ponto: ponto(51, 0) }, livre: ponto(51, 1) };
    const resultado = cliqueDeGraduacao('graduar-tabela', O, [peca()], peca(), SEM_TRECHO, clique, { regra: null, raioMm: 6 });

    expect(resultado.abrir).toEqual({ tipo: 'tabela-do-pique', id: 'p1' });
    expect(resultado.pecas).toBeUndefined();
  });

  it('num ponto do contorno, a tabela é a do ponto; longe de tudo, o clique é recusado como antes', () => {
    const noPonto = { noContorno: { indiceAresta: 1, ponto: ponto(200, 0) }, livre: ponto(200, 0) };
    expect(cliqueDeGraduacao('graduar-tabela', O, [peca()], peca(), SEM_TRECHO, noPonto, { regra: null, raioMm: 6 }).abrir).toEqual({ tipo: 'tabela', indice: 1 });

    const longe = { noContorno: null, livre: ponto(100, 150) };
    expect(cliqueDeGraduacao('graduar-tabela', O, [peca()], peca(), SEM_TRECHO, longe, { regra: null, raioMm: 6 }).abrir).toBeUndefined();
    // As outras ferramentas não abrem a tabela do pique.
    const noPique = { noContorno: { indiceAresta: 0, ponto: ponto(50, 0) }, livre: ponto(50, 0) };
    expect(cliqueDeGraduacao('graduar-automatico', O, [peca()], peca(), SEM_TRECHO, noPique, { regra: null, raioMm: 6 }).abrir).toBeUndefined();
    // Sem o raio, não há como saber que o clique foi num pique.
    expect(cliqueDeGraduacao('graduar-tabela', O, [peca()], peca(), SEM_TRECHO, noPique, { regra: null }).abrir).toBeUndefined();
  });

  it('a instrução da Tabela fala dos piques', () => {
    expect(instrucaoDaGraduacao('graduar-tabela', O, SEM_TRECHO, null)).toMatch(/ou num pique, para a tabela dele\. Esc sai\.$/);
  });
});

import { describe, it, expect } from 'vitest';
import { ponto } from '../core/geometria';
import { adicionarPique, criarMolde, type Molde } from '../domain/molde';
import { definirGraduacaoDoPique, referenciaDoPique } from '../domain/piquesGraduados';
import { definirTamanhosDoMolde } from '../domain/tamanhosGraduados';
import { cliqueDeGraduacao, dialogoDaGraduacao, instrucaoDaGraduacao, OPCOES_INICIAIS_DA_GRADUACAO, type OpcoesDaGraduacao } from './ferramentasDeGraduacao';
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
      ['copiar', false],
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

describe('copiar a graduação de um pique e colar em outro', () => {
  const copiando = { ...VALORES, copiar: true };

  it('“Copiar” aplica os valores no pique e entrega a graduação dele para ser guardada; a mensagem diz', () => {
    const resultado = aplicarDialogoDoPique([peca()], peca(), 'p1', copiando);

    expect(perimetros(resultado.pecas[0]!, 'p1')).toEqual([-5, 0, 10]);
    expect(resultado.copiada).toEqual({ tamanhos: ['P', 'M', 'G'], base: 1, perimetros: [-5, 0, 10] });
    expect(resultado.recado).toMatch(/ A graduação dele foi copiada: abra a janela de outro pique e marque “Colar”\.$/);
    // Sem “Copiar”, nada é entregue.
    expect('copiada' in aplicarDialogoDoPique([peca()], peca(), 'p1', VALORES)).toBe(false);
    // Com “Incremental” e “Inverter”, o que se copia é o que ficou no pique.
    const invertida = aplicarDialogoDoPique([peca()], peca(), 'p1', { ...copiando, incremental: true, inverter: true });
    expect(invertida.copiada!.perimetros).toEqual(perimetros(invertida.pecas[0]!, 'p1'));
  });

  it('com uma graduação copiada que serve, a janela de outro pique oferece “Colar”, e mostra os valores', () => {
    const copiada = aplicarDialogoDoPique([peca()], peca(), 'p1', copiando).copiada!;
    const dialogo = dialogoDoPique(peca(), 'p2', copiada)!;

    expect(dialogo.campos.map((c) => c.id)).toEqual(['referencia', 'perimetro-0', 'perimetro-2', 'incremental', 'inverter', 'todos', 'copiar', 'colar', 'remover']);
    expect(dialogo.campos.find((c) => c.id === 'colar')!.rotulo).toBe('Colar: aplicar a graduação copiada (P: -5; G: 10) no lugar dos valores acima');
    expect(dialogo.nota).toMatch(/“Copiar” guarda a graduação aplicada neste pique; .* “Colar” aplica nele os valores guardados/);
    // Sem nada copiado, ou com outros tamanhos (ou outro base), não há o que colar.
    expect(dialogoDoPique(peca(), 'p2')!.campos.map((c) => c.id)).not.toContain('colar');
    expect(dialogoDoPique(peca(), 'p2', { ...copiada, tamanhos: ['PP', 'M', 'G'] })!.campos.map((c) => c.id)).not.toContain('colar');
    expect(dialogoDoPique(peca(), 'p2', { ...copiada, base: 0 })!.campos.map((c) => c.id)).not.toContain('colar');
    expect(dialogoDoPique(peca(), 'p2', { tamanhos: ['P', 'M'], base: 1, perimetros: [-5, 0] })!.campos.map((c) => c.id)).not.toContain('colar');
  });

  it('“Colar” aplica no pique os valores copiados, no lugar dos digitados, a partir da referência dele', () => {
    const copiada = aplicarDialogoDoPique([peca()], peca(), 'p1', copiando).copiada!;
    const colado = aplicarDialogoDoPique([peca()], peca(), 'p2', { referencia: 2, 'perimetro-0': 99, 'perimetro-2': 99, incremental: true, inverter: false, todos: false, remover: false, colar: true }, copiada);

    expect(perimetros(colado.pecas[0]!, 'p2')).toEqual([-5, 0, 10]);
    expect(referenciaDoPique(colado.pecas[0]!, colado.pecas[0]!.piques.find((q) => q.id === 'p2')!)).toBe(1);
    expect(colado.recado).toMatch(/^Pique de “Frente” graduado a partir do ponto 2, com a graduação colada: no tamanho G, o perímetro muda 10,0 mm\.$/);
    // Colando com o sinal invertido (o pique do outro lado da peça).
    const aoContrario = aplicarDialogoDoPique([peca()], peca(), 'p2', { ...VALORES, referencia: 2, inverter: true, colar: true }, copiada);
    expect(perimetros(aoContrario.pecas[0]!, 'p2')).toEqual([5, 0, -10]);
    // Os campos em branco não atrapalham: quem vale são os copiados.
    const emBranco = aplicarDialogoDoPique([peca()], peca(), 'p2', { ...VALORES, referencia: 2, 'perimetro-0': 'x', colar: true }, copiada);
    expect(perimetros(emBranco.pecas[0]!, 'p2')).toEqual([-5, 0, 10]);
  });

  it('“Colar” sem nada copiado que sirva é recusado, sem mudar nada', () => {
    expect(() => aplicarDialogoDoPique([peca()], peca(), 'p2', { ...VALORES, colar: true })).toThrow(/Não há graduação de pique copiada que sirva/);
    expect(() => aplicarDialogoDoPique([peca()], peca(), 'p2', { ...VALORES, colar: true }, { tamanhos: ['PP', 'M', 'G'], base: 1, perimetros: [-5, 0, 10] })).toThrow(/Não há graduação de pique copiada que sirva/);
  });
});

describe('“Automático” e “Tangente” também graduam piques', () => {
  const O = OPCOES_INICIAIS_DA_GRADUACAO;
  const com = (parte: Partial<OpcoesDaGraduacao>): OpcoesDaGraduacao => ({ ...O, ...parte });
  // O clique em cima do pique p1, a 50 mm do canto (0, 0): no contorno, mas fora de um ponto dele.
  const NO_P1 = { noContorno: { indiceAresta: 0, ponto: ponto(50, 0) }, livre: ponto(50, 0) };
  const NO_P2 = { noContorno: { indiceAresta: 0, ponto: ponto(180, 0) }, livre: ponto(180, 0) };
  const clicar = (modo: 'graduar-automatico' | 'graduar-tangente' | 'graduar-mouse', opcoes: OpcoesDaGraduacao, clique = NO_P1) =>
    cliqueDeGraduacao(modo, opcoes, [peca()], peca(), SEM_TRECHO, clique, { regra: null, raioMm: 6 });

  it('Tangente: o pique anda a distância por tamanho sobre o contorno, contada da referência; a mensagem diz', () => {
    const feito = clicar('graduar-tangente', O);

    expect(perimetros(feito.pecas![0]!, 'p1')).toEqual([-5, 0, 5]);
    expect(feito.recado).toBe('Pique graduado na tangente: anda 5,0 mm por tamanho sobre o contorno, no sentido do ponto 2. A distância é contada do ponto 1, a referência dele.');
    expect(feito.estado).toBe(SEM_TRECHO);
    // Invertendo, anda para o ponto anterior.
    const aoContrario = clicar('graduar-tangente', com({ tangente: { ...O.tangente, inverter: true } }));
    expect(perimetros(aoContrario.pecas![0]!, 'p1')).toEqual([5, 0, -5]);
    expect(aoContrario.recado).toMatch(/no sentido do ponto 1\. A distância é contada do ponto 1/);
    // O pique perto do outro canto tem a referência adiante: andar para ela diminui a distância.
    const doOutro = clicar('graduar-tangente', O, NO_P2);
    expect(perimetros(doOutro.pecas![0]!, 'p2')).toEqual([5, 0, -5]);
    expect(doOutro.recado).toMatch(/A distância é contada do ponto 2, a referência dele\.$/);
  });

  it('Tangente num tamanho só, e a partir do base', () => {
    const noG = clicar('graduar-tangente', com({ tangente: { ...O.tangente, tamanho: 'G' } }));
    expect(perimetros(noG.pecas![0]!, 'p1')).toEqual([0, 0, 5]);
    expect(noG.recado).toMatch(/^Pique graduado na tangente, no tamanho G: anda 5,0 mm a partir do tamanho vizinho sobre o contorno/);
    const doBase = clicar('graduar-tangente', com({ tangente: { ...O.tangente, incremental: false } }));
    expect(doBase.recado).toMatch(/anda 5,0 mm a partir do base sobre o contorno/);
    expect(clicar('graduar-tangente', com({ tangente: { ...O.tangente, tamanho: 'GG' } })).recado).toMatch(/A peça não tem o tamanho “GG”/);
    expect(clicar('graduar-tangente', com({ tangente: { ...O.tangente, tamanho: 'M' } })).recado).toMatch(/tamanho base/);
  });

  it('Tangente a partir do base, com cinco tamanhos: os de cada lado andam o mesmo', () => {
    const base = criarMolde({ nome: 'Frente', referencia: 'REF', tamanho: 'M', contorno: RETANGULO, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) } }, 'f');
    const emCinco = definirTamanhosDoMolde(adicionarPique(base, ponto(50, 0), 'p1'), ['PP', 'P', 'M', 'G', 'GG'], 'M');
    const clicarNela = (opcoes: OpcoesDaGraduacao) => cliqueDeGraduacao('graduar-tangente', opcoes, [emCinco], emCinco, SEM_TRECHO, NO_P1, { regra: null, raioMm: 6 });

    expect(perimetros(clicarNela(com({ tangente: { ...O.tangente, incremental: false } })).pecas![0]!, 'p1')).toEqual([-5, -5, 0, 5, 5]);
    expect(perimetros(clicarNela(O).pecas![0]!, 'p1')).toEqual([-10, -5, 0, 5, 10]);
  });

  it('Automático: do DX e do DY, vale a parte na direção da borda onde o pique está', () => {
    // A aresta de baixo corre no X do mundo, que na tela é a vertical: quem anda nela é o DY.
    const comDy = clicar('graduar-automatico', com({ automatico: { dxMm: 0, dyMm: 10, tamanho: 'todos' } }));
    expect(perimetros(comDy.pecas![0]!, 'p1')).toEqual([-10, 0, 10]);
    expect(comDy.recado).toBe('Pique graduado: anda 10,0 mm por tamanho sobre o contorno, no sentido do ponto 2 — a parte de DX 0,0 mm e DY 10,0 mm na direção da borda. A distância é contada do ponto 1, a referência dele.');
    // Com o sinal trocado, anda para o ponto anterior.
    const paraTras = clicar('graduar-automatico', com({ automatico: { dxMm: 7, dyMm: -10, tamanho: 'todos' } }));
    expect(perimetros(paraTras.pecas![0]!, 'p1')).toEqual([10, 0, -10]);
    expect(paraTras.recado).toMatch(/anda 10,0 mm por tamanho sobre o contorno, no sentido do ponto 1 /);
    // Só DX (em esquadro com a borda): o pique não tem para onde andar.
    const soDx = clicar('graduar-automatico', O);
    expect(soDx.pecas).toBeUndefined();
    expect(soDx.recado).toMatch(/O pique só anda sobre o contorno, e DX 10,0 mm e DY 0,0 mm não têm parte na direção da borda/);
    // Num tamanho só.
    const noG = clicar('graduar-automatico', com({ automatico: { dxMm: 0, dyMm: 10, tamanho: 'G' } }));
    expect(perimetros(noG.pecas![0]!, 'p1')).toEqual([0, 0, 10]);
    expect(noG.recado).toMatch(/^Pique graduado, no tamanho G: anda 10,0 mm em relação ao tamanho vizinho/);
  });

  it('longe de um pique, ou com outra ferramenta, o clique fora de um ponto continua recusado', () => {
    const longe = { noContorno: { indiceAresta: 0, ponto: ponto(110, 0) }, livre: ponto(110, 0) };
    expect(clicar('graduar-tangente', O, longe).pecas).toBeUndefined();
    expect(clicar('graduar-tangente', O, longe).recado).toMatch(/Clique em cima de um ponto do contorno/);
    expect(clicar('graduar-mouse', O).pecas).toBeUndefined();
    expect(clicar('graduar-mouse', O).recado).toMatch(/Clique em cima de um ponto do contorno/);
    // Sem o raio do clique (quem chama não sabe o zoom), os piques não são procurados.
    expect(cliqueDeGraduacao('graduar-tangente', O, [peca()], peca(), SEM_TRECHO, NO_P1, { regra: null }).pecas).toBeUndefined();
  });

  it('as instruções e as janelas falam dos piques', () => {
    expect(instrucaoDaGraduacao('graduar-automatico', O, SEM_TRECHO, null)).toMatch(/— ou num pique, que anda sobre o contorno a parte disso na direção da borda\. Esc sai\.$/);
    expect(instrucaoDaGraduacao('graduar-tangente', O, SEM_TRECHO, null)).toMatch(/— ou num pique, que anda essa distância sobre o contorno\. Esc sai\.$/);
    expect(dialogoDaGraduacao('graduar-automatico', O, peca())!.nota).toMatch(/O clique num pique gradua o pique: ele só anda sobre o contorno/);
    expect(dialogoDaGraduacao('graduar-tangente', O, peca())!.nota).toMatch(/O clique num pique gradua o pique: ele anda essa distância sobre o contorno/);
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

import { describe, it, expect } from 'vitest';
import { area, ponto, type Ponto2D, type PosicaoNoContorno } from '../core/geometria';
import { definirRegra, regraDoVertice, verticesGraduados } from '../domain/graduacao';
import { criarMolde, type DadosDeNovoMolde, type Molde } from '../domain/molde';
import { definirTamanhosDoMolde } from '../domain/tamanhosGraduados';
import {
  aplicarRemoverDoMolde,
  aplicarSeparar,
  aplicarTamanhos,
  aplicarUnir,
  cliqueDeGraduacao,
  dialogoDaGraduacao,
  dialogoDeTamanhos,
  ehModoDeGraduacao,
  instrucaoDaGraduacao,
  lerDialogoDaGraduacao,
  mesmosTamanhos,
  OPCOES_INICIAIS_DA_GRADUACAO,
  previaDaGraduacao,
  type CliqueDeGraduacao,
  type FerramentaDeGraduacao,
  type ModoDeGraduacao,
  type OpcoesDaGraduacao,
} from './ferramentasDeGraduacao';
import { SEM_TRECHO, type CliqueDeTrecho, type TrechoEmEdicao } from './ferramentasDeTrecho';
import type { RegraCadastrada } from './regrasDeGraduacao';

// Retângulo de 200 × 300 mm, graduado em P, M e G (base M). Na tela, DX é o y do mundo e DY é o x.
const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
const ZERO = ponto(0, 0);
const G = 2;
const regra = (x: number, y: number): Ponto2D[] => [ponto(0 - x, 0 - y), ZERO, ponto(x, y)];

function molde(sobrescrever: Partial<DadosDeNovoMolde> = {}, id = 'f'): Molde {
  return criarMolde(
    { nome: 'Frente', referencia: 'REF', tamanho: 'M', contorno: RETANGULO, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) }, ...sobrescrever },
    id,
  );
}

function graduada(tamanhos = ['P', 'M', 'G']): Molde {
  return definirTamanhosDoMolde(molde(), tamanhos, 'M');
}

/** A peça graduada com o canto (200, 300) — o ponto 3 — andando (10, 20) no G. */
function comRegraNoCanto(): Molde {
  const peca = graduada();
  return { ...peca, graduacao: definirRegra(peca.graduacao!, RETANGULO, 2, regra(10, 20)) };
}

const O = OPCOES_INICIAIS_DA_GRADUACAO;
const com = (parte: Partial<OpcoesDaGraduacao>): OpcoesDaGraduacao => ({ ...O, ...parte });
const noPonto = (i: number): CliqueDeTrecho => {
  const posicao: PosicaoNoContorno = { indiceAresta: i, ponto: RETANGULO[i]! };
  return { noContorno: posicao, livre: posicao.ponto };
};
const solto = (x: number, y: number): CliqueDeTrecho => ({ noContorno: null, livre: ponto(x, y) });
const contexto = (regraEscolhida: RegraCadastrada | null = null) => ({ regra: regraEscolhida });

function clicar(modo: ModoDeGraduacao, opcoes: OpcoesDaGraduacao, peca: Molde, clique: CliqueDeTrecho, estado: TrechoEmEdicao = SEM_TRECHO): CliqueDeGraduacao {
  return cliqueDeGraduacao(modo, opcoes, [peca], peca, estado, clique, contexto());
}

const regraDo = (resultado: CliqueDeGraduacao, i: number): readonly Ponto2D[] => {
  const peca = resultado.pecas![0]!;
  return regraDoVertice(peca.graduacao!, peca.contorno, i);
};

const MODOS: readonly ModoDeGraduacao[] = [
  'graduar-tabela',
  'graduar-automatico',
  'graduar-mouse',
  'graduar-tangente',
  'graduar-regras',
  'criar-regra',
  'remover-graduacao',
  'agrupar-graduacao',
  'deduzir-graduacao',
  'copiar-graduacao',
  'ajustar-graduacao',
  'graduar-curva',
];

describe('quais ferramentas ficam ligadas à espera de cliques', () => {
  it('doze são modos; Separar e Unir agem na hora', () => {
    for (const modo of MODOS) expect(ehModoDeGraduacao(modo)).toBe(true);
    for (const outra of ['separar-tamanhos', 'unir-tamanhos', 'selecionar', 'pregas']) expect(ehModoDeGraduacao(outra)).toBe(false);
  });
});

describe('tamanhos', () => {
  it('na peça sem graduação, o diálogo sugere P, M, G, com o tamanho da peça de base quando é um deles', () => {
    const campos = dialogoDeTamanhos(molde({ tamanho: 'G' })).campos;
    expect(campos.find((c) => c.id === 'tamanhos')!.inicial).toBe('P, M, G');
    expect(campos.find((c) => c.id === 'base')!.inicial).toBe('G');
    expect(dialogoDeTamanhos(molde({ tamanho: '42' })).campos.find((c) => c.id === 'base')!.inicial).toBe('M');
    expect(dialogoDeTamanhos(molde()).nota).toMatch(/Os cantos da peça entram como pontos graduados/);
  });

  it('na peça graduada, o diálogo mostra os tamanhos e o base dela', () => {
    const campos = dialogoDeTamanhos(graduada(['36', '38', 'M', '42'])).campos;
    expect(campos.find((c) => c.id === 'tamanhos')!.inicial).toBe('36, 38, M, 42');
    expect(campos.find((c) => c.id === 'base')!.inicial).toBe('M');
  });

  it('aplica os tamanhos do diálogo, e sabe quando nada mudou', () => {
    const nova = aplicarTamanhos(molde(), { tamanhos: 'P, M, G', base: 'm' });
    expect(nova.graduacao).toMatchObject({ tamanhos: ['P', 'M', 'G'], base: 1 });
    expect(mesmosTamanhos(molde(), nova)).toBe(false);
    expect(mesmosTamanhos(nova, aplicarTamanhos(nova, { tamanhos: 'P,M,G', base: 'M' }))).toBe(true);
    expect(mesmosTamanhos(nova, aplicarTamanhos(nova, { tamanhos: 'P, M, G, GG', base: 'M' }))).toBe(false);
  });

  it('recusa a lista que não serve, com a mensagem para o diálogo', () => {
    expect(() => aplicarTamanhos(molde(), { tamanhos: 'M', base: 'M' })).toThrow(/pelo menos dois tamanhos/);
    expect(() => aplicarTamanhos(molde(), { tamanhos: 'P, M', base: 'G' })).toThrow(/tamanho base/);
  });
});

describe('cliques: o que vale para todas', () => {
  it('na peça sem tamanhos, o clique só avisa', () => {
    const resultado = clicar('graduar-automatico', O, molde(), noPonto(2));
    expect(resultado).toEqual({ estado: SEM_TRECHO, recado: 'Defina os tamanhos primeiro, em “Tabela”.' });
  });

  it('fora de um ponto do contorno, o clique só avisa onde clicar', () => {
    for (const modo of MODOS) {
      const resultado = clicar(modo, O, graduada(), solto(100, 150));
      expect(resultado.pecas).toBeUndefined();
      expect(resultado.recado).toMatch(/em cima de um ponto do contorno/);
    }
    // No meio de uma aresta também não é um ponto.
    const naAresta = clicar('graduar-curva', O, graduada(), { noContorno: { indiceAresta: 0, ponto: ponto(100, 0) }, livre: ponto(100, 0) });
    expect(naAresta.pecas).toBeUndefined();
  });

  it('só troca a peça clicada', () => {
    const outra = molde({ nome: 'Costas' }, 'c');
    const peca = graduada();
    const resultado = cliqueDeGraduacao('graduar-automatico', O, [outra, peca], peca, SEM_TRECHO, noPonto(2), contexto());
    expect(resultado.pecas![0]).toBe(outra);
    expect(resultado.pecas![1]!.id).toBe('f');
  });
});

describe('Tabela e Criar regra: o clique pede o diálogo do ponto', () => {
  it('Tabela abre a tabela do ponto clicado', () => {
    expect(clicar('graduar-tabela', O, graduada(), noPonto(2))).toEqual({ estado: SEM_TRECHO, recado: null, abrir: { tipo: 'tabela', indice: 2 } });
  });

  it('Criar regra pede o nome', () => {
    expect(clicar('criar-regra', O, graduada(), noPonto(1)).abrir).toEqual({ tipo: 'nome-da-regra', indice: 1 });
  });
});

describe('Automático e Ajustar', () => {
  it('Automático: o ponto anda a diferença dada por tamanho — DX na horizontal da tela (o y do mundo)', () => {
    const resultado = clicar('graduar-automatico', com({ automatico: { dxMm: 10, dyMm: 4, tamanho: 'todos' } }), graduada(), noPonto(2));
    expect(regraDo(resultado, 2)).toEqual(regra(4, 10));
    expect(resultado.recado).toBe('Ponto 3 graduado: DX 10,0 mm e DY 4,0 mm por tamanho.');
  });

  it('Automático troca a regra que o ponto tinha', () => {
    const resultado = clicar('graduar-automatico', com({ automatico: { dxMm: 1, dyMm: 0, tamanho: 'todos' } }), comRegraNoCanto(), noPonto(2));
    expect(regraDo(resultado, 2)).toEqual(regra(0, 1));
  });

  it('com cinco tamanhos, cada tamanho anda um passo a mais', () => {
    const resultado = clicar('graduar-automatico', com({ automatico: { dxMm: 5, dyMm: 0, tamanho: 'todos' } }), graduada(['PP', 'P', 'M', 'G', 'GG']), noPonto(2));
    expect(regraDo(resultado, 2).map((d) => d.y)).toEqual([-10, -5, 0, 5, 10]);
  });

  it('Automático num tamanho só: só ele muda, em relação ao vizinho do lado do base', () => {
    const cinco = graduada(['PP', 'P', 'M', 'G', 'GG']);
    const noGG = clicar('graduar-automatico', com({ automatico: { dxMm: 8, dyMm: 0, tamanho: 'GG' } }), cinco, noPonto(2));
    expect(regraDo(noGG, 2).map((d) => d.y)).toEqual([0, 0, 0, 0, 8]);
    expect(noGG.recado).toBe('Ponto 3 graduado no tamanho GG: DX 8,0 mm e DY 0,0 mm em relação ao G; os outros tamanhos ficaram como estavam.');

    const noPP = clicar('graduar-automatico', com({ automatico: { dxMm: 8, dyMm: 0, tamanho: 'PP' } }), cinco, noPonto(2));
    expect(regraDo(noPP, 2).map((d) => d.y)).toEqual([-8, 0, 0, 0, 0]);
    expect(noPP.recado).toMatch(/em relação ao P;/);
    // O tamanho que a peça não tem, ou o base, é recusado sem mudar nada.
    const semEsse = clicar('graduar-automatico', com({ automatico: { dxMm: 8, dyMm: 0, tamanho: 'XG' } }), cinco, noPonto(2));
    expect(semEsse.pecas).toBeUndefined();
    expect(semEsse.recado).toMatch(/A peça não tem o tamanho “XG”/);
    const noBase = clicar('graduar-automatico', com({ automatico: { dxMm: 8, dyMm: 0, tamanho: 'M' } }), cinco, noPonto(2));
    expect(noBase.pecas).toBeUndefined();
    expect(noBase.recado).toMatch(/O tamanho base/);
  });

  it('Ajustar: ponto inicial, pontos a ajustar, ponto final; o segundo clique no final confirma', () => {
    const peca = comRegraNoCanto();
    const inicial = clicar('ajustar-graduacao', O, peca, noPonto(0));
    expect(inicial.pecas).toBeUndefined();
    expect(inicial.estado.inicio!.indiceAresta).toBe(0);

    const meio = clicar('ajustar-graduacao', O, peca, noPonto(1), inicial.estado);
    const final = clicar('ajustar-graduacao', O, peca, noPonto(2), meio.estado);
    expect(final.pecas).toBeUndefined();
    expect(final.estado.livres).toEqual([RETANGULO[1], RETANGULO[2]]);

    // Do ponto 1 ao 3 pelo contorno são 200 + 300 mm: o ponto 2 fica a 2/5 do caminho.
    const confirmado = clicar('ajustar-graduacao', O, peca, noPonto(2), final.estado);
    expect(regraDo(confirmado, 1)).toEqual(regra(4, 8));
    expect(regraDo(confirmado, 2)).toEqual(regra(10, 20));
    expect(confirmado.estado).toBe(SEM_TRECHO);
    expect(confirmado.recado).toBe('O ponto 2 foi ajustado entre o ponto 1 e o ponto 3 (DX e DY): andam na proporção da posição deles entre os dois.');
  });

  it('Ajustar só no DX: o DY do ponto fica como estava', () => {
    const peca = comRegraNoCanto();
    let estado = clicar('ajustar-graduacao', O, peca, noPonto(0)).estado;
    for (const i of [1, 2]) estado = clicar('ajustar-graduacao', com({ ajustar: { eixo: 'dx' } }), peca, noPonto(i), estado).estado;
    const confirmado = clicar('ajustar-graduacao', com({ ajustar: { eixo: 'dx' } }), peca, noPonto(2), estado);

    // DX é o y do mundo: só ele recebe os 2/5 de 20.
    expect(regraDo(confirmado, 1)).toEqual(regra(0, 8));
  });

  it('Ajustar: clicar de novo num ponto do meio tira-o da fila; no inicial, só avisa; sem ponto do meio, não confirma', () => {
    const peca = comRegraNoCanto();
    const inicial = clicar('ajustar-graduacao', O, peca, noPonto(0));
    expect(clicar('ajustar-graduacao', O, peca, noPonto(0), inicial.estado).recado).toMatch(/O ponto 1 é o inicial/);

    let estado = inicial.estado;
    for (const i of [1, 2, 3]) estado = clicar('ajustar-graduacao', O, peca, noPonto(i), estado).estado;
    estado = clicar('ajustar-graduacao', O, peca, noPonto(1), estado).estado;
    expect(estado.livres).toEqual([RETANGULO[2], RETANGULO[3]]);

    const soOFinal = clicar('ajustar-graduacao', O, peca, noPonto(1), inicial.estado);
    const semMeio = clicar('ajustar-graduacao', O, peca, noPonto(1), soOFinal.estado);
    expect(semMeio.pecas).toBeUndefined();
    expect(semMeio.recado).toMatch(/pelo menos um ponto a ajustar/);
  });
});

describe('Mouse', () => {
  const cinco = (): Molde => graduada(['PP', 'P', 'M', 'G', 'GG']);

  it('o primeiro clique indica o ponto; o segundo, onde ele fica', () => {
    const primeiro = clicar('graduar-mouse', O, cinco(), noPonto(2));
    expect(primeiro.pecas).toBeUndefined();
    expect(primeiro.estado.inicio).toEqual({ indiceAresta: 2, ponto: ponto(200, 300) });
    const segundo = clicar('graduar-mouse', O, cinco(), solto(230, 340), primeiro.estado);
    expect(segundo.estado).toBe(SEM_TRECHO);
    // Absoluto: (30, 40) é o que o ponto anda no GG; o G fica na metade.
    expect(regraDo(segundo, 2)).toEqual([ponto(-30, -40), ponto(-15, -20), ZERO, ponto(15, 20), ponto(30, 40)]);
    expect(segundo.recado).toBe('Ponto 3 graduado pelo mouse: no tamanho GG, DX 40,0 mm e DY 30,0 mm.');
  });

  it('incremental: o clique é o tamanho seguinte ao base, e cada tamanho anda o mesmo tanto', () => {
    const opcoes = com({ mouse: { modo: 'incremental' } });
    const primeiro = clicar('graduar-mouse', opcoes, cinco(), noPonto(2));
    const segundo = clicar('graduar-mouse', opcoes, cinco(), solto(230, 340), primeiro.estado);
    expect(regraDo(segundo, 2)).toEqual([ponto(-60, -80), ponto(-30, -40), ZERO, ponto(30, 40), ponto(60, 80)]);
  });

  it('o segundo clique em cima do próprio ponto não faz nada', () => {
    const primeiro = clicar('graduar-mouse', O, cinco(), noPonto(2));
    const segundo = clicar('graduar-mouse', O, cinco(), solto(200, 300), primeiro.estado);
    expect(segundo.pecas).toBeUndefined();
    expect(segundo.estado).toBe(primeiro.estado);
  });

  it('a prévia mostra o tamanho da ponta com o ponto onde o mouse está', () => {
    const peca = cinco();
    const noCanto: TrechoEmEdicao = { ...SEM_TRECHO, inicio: { indiceAresta: 2, ponto: ponto(200, 300) } };
    const previa = previaDaGraduacao('graduar-mouse', O, peca, noCanto, ponto(230, 340));
    expect(previa.novoFechado).toBe(true);
    expect(previa.novo).toEqual([ponto(0, 0), ponto(200, 0), ponto(230, 340), ponto(0, 300)]);
    expect(previaDaGraduacao('graduar-mouse', O, peca, noCanto, null).novo).toBeUndefined();
    expect(previaDaGraduacao('graduar-mouse', O, peca, SEM_TRECHO, ponto(230, 340)).novo).toBeUndefined();
  });
});

describe('Mouse, modo Proporcional', () => {
  const PROPORCIONAL = com({ mouse: { modo: 'proporcional' } });
  const cinco = (): Molde => graduada(['PP', 'P', 'M', 'G', 'GG']);

  it('dois cliques: onde o ponto fica no menor tamanho e onde fica no maior; os do meio levam a parte proporcional', () => {
    const peca = cinco();
    const ponto3 = clicar('graduar-mouse', PROPORCIONAL, peca, noPonto(2));
    // No PP, o ponto 3 (200, 300) vai para (180, 260); o clique fica guardado, à espera do maior.
    const menor = clicar('graduar-mouse', PROPORCIONAL, peca, solto(180, 260), ponto3.estado);
    expect(menor.pecas).toBeUndefined();
    expect(menor.estado.livres).toEqual([ponto(180, 260)]);

    const maior = clicar('graduar-mouse', PROPORCIONAL, peca, solto(230, 360), menor.estado);
    expect(regraDo(maior, 2)).toEqual([ponto(-20, -40), ponto(-10, -20), ZERO, ponto(15, 30), ponto(30, 60)]);
    expect(maior.estado).toBe(SEM_TRECHO);
    expect(maior.recado).toBe('Ponto 3 graduado pelo mouse, na proporção: no tamanho GG, DX 60,0 mm e DY 30,0 mm; no tamanho PP, DX -40,0 mm e DY -20,0 mm.');
  });

  it('com o base na ponta de baixo, um clique só: o do maior tamanho', () => {
    const peca = definirTamanhosDoMolde(molde(), ['M', 'G', 'GG'], 'M');
    const ponto3 = clicar('graduar-mouse', PROPORCIONAL, peca, noPonto(2));
    const resultado = clicar('graduar-mouse', PROPORCIONAL, peca, solto(220, 340), ponto3.estado);

    expect(regraDo(resultado, 2)).toEqual([ZERO, ponto(10, 20), ponto(20, 40)]);
  });

  it('com o base na ponta de cima, um clique só: o do menor tamanho', () => {
    const peca = definirTamanhosDoMolde(molde(), ['PP', 'P', 'M'], 'M');
    const ponto3 = clicar('graduar-mouse', PROPORCIONAL, peca, noPonto(2));
    const resultado = clicar('graduar-mouse', PROPORCIONAL, peca, solto(180, 260), ponto3.estado);

    expect(regraDo(resultado, 2)).toEqual([ponto(-20, -40), ponto(-10, -20), ZERO]);
  });

  it('a prévia mostra o menor tamanho no primeiro clique e o maior no segundo', () => {
    const peca = cinco();
    const ponto3: TrechoEmEdicao = { ...SEM_TRECHO, inicio: { indiceAresta: 2, ponto: RETANGULO[2]! } };

    expect(previaDaGraduacao('graduar-mouse', PROPORCIONAL, peca, ponto3, ponto(180, 260)).novo![2]).toEqual(ponto(180, 260));
    const comOMenor = { ...ponto3, livres: [ponto(180, 260)] };
    expect(previaDaGraduacao('graduar-mouse', PROPORCIONAL, peca, comOMenor, ponto(230, 360)).novo![2]).toEqual(ponto(230, 360));
    expect(instrucaoDaGraduacao('graduar-mouse', PROPORCIONAL, ponto3, null)).toMatch(/no menor tamanho/);
    expect(instrucaoDaGraduacao('graduar-mouse', PROPORCIONAL, comOMenor, null)).toMatch(/agora clique onde o ponto 3 deve ficar no maior tamanho/);
  });
});

describe('Tangente', () => {
  it('o ponto anda a distância por tamanho na direção da aresta que sai dele', () => {
    // Do ponto 3, (200, 300), a aresta vai para o ponto 4, (0, 300): direção −x.
    const resultado = clicar('graduar-tangente', com({ tangente: { distanciaMm: 5, inverter: false, usarContornoBase: true, tamanho: 'todos', incremental: true } }), graduada(), noPonto(2));
    expect(regraDo(resultado, 2)[G]).toEqual(ponto(-5, 0));
    expect(resultado.recado).toBe('Ponto 3 graduado na tangente: 5,0 mm por tamanho, na direção do ponto 4.');
  });

  it('invertendo, anda na direção da aresta que chega', () => {
    // A aresta que chega ao ponto 3 vem do ponto 2, (200, 0): direção −y.
    const resultado = clicar('graduar-tangente', com({ tangente: { distanciaMm: 5, inverter: true, usarContornoBase: true, tamanho: 'todos', incremental: true } }), graduada(), noPonto(2));
    expect(regraDo(resultado, 2)[G]).toEqual(ponto(0, -5));
    expect(resultado.recado).toMatch(/na direção do ponto 2\.$/);
  });
});

describe('Tangente: aplicar no tamanho, incremental e contorno base', () => {
  const TANGENTE = { distanciaMm: 5, inverter: false, usarContornoBase: true, tamanho: 'todos', incremental: true };
  const cinco = (): Molde => graduada(['PP', 'P', 'M', 'G', 'GG']);

  it('num tamanho só, só ele anda, e a mensagem diz', () => {
    const resultado = clicar('graduar-tangente', com({ tangente: { ...TANGENTE, tamanho: 'GG' } }), cinco(), noPonto(2));

    expect(regraDo(resultado, 2)).toEqual([ZERO, ZERO, ZERO, ZERO, ponto(-5, 0)]);
    expect(resultado.recado).toBe('Ponto 3 graduado na tangente, no tamanho GG: 5,0 mm a partir do tamanho vizinho, na direção do ponto 4.');
    const semEsse = clicar('graduar-tangente', com({ tangente: { ...TANGENTE, tamanho: 'XG' } }), cinco(), noPonto(2));
    expect(semEsse.recado).toMatch(/A peça não tem o tamanho “XG”/);
  });

  it('sem incremental, a distância conta a partir do base', () => {
    const resultado = clicar('graduar-tangente', com({ tangente: { ...TANGENTE, incremental: false } }), cinco(), noPonto(2));

    expect(regraDo(resultado, 2)).toEqual([ponto(5, 0), ponto(5, 0), ZERO, ponto(-5, 0), ponto(-5, 0)]);
    expect(resultado.recado).toBe('Ponto 3 graduado na tangente: 5,0 mm a partir do base, na direção do ponto 4.');
  });

  it('sem o contorno base, cada tamanho segue a aresta do tamanho vizinho', () => {
    // O ponto 4, o vizinho, sobe na tela 40 mm por tamanho: a aresta vira de um tamanho para o outro.
    const peca = cinco();
    const comVizinho = { ...peca, graduacao: definirRegra(peca.graduacao!, peca.contorno, 3, [ponto(0, -80), ponto(0, -40), ZERO, ponto(0, 40), ponto(0, 80)]) };
    const peloBase = clicar('graduar-tangente', com({ tangente: TANGENTE }), comVizinho, noPonto(2));
    const seguindo = clicar('graduar-tangente', com({ tangente: { ...TANGENTE, usarContornoBase: false } }), comVizinho, noPonto(2));

    expect(regraDo(peloBase, 2)[4]).toEqual(ponto(-10, 0));
    expect(regraDo(seguindo, 2)[3]).toEqual(ponto(-5, 0));
    expect(regraDo(seguindo, 2)[4]!.y).toBeGreaterThan(0.5);
    expect(seguindo.recado).toMatch(/na direção do ponto 4, seguindo a aresta de cada tamanho\.$/);
  });

  it('o diálogo tem as três opções novas, e o tamanho que a peça não tem volta a “Todos”', () => {
    const dialogo = dialogoDaGraduacao('graduar-tangente', com({ tangente: { ...TANGENTE, tamanho: 'XG' } }), cinco())!;

    expect(dialogo.campos.map((c) => [c.id, c.inicial])).toEqual([
      ['distancia', '5'],
      ['inverter', false],
      ['usarContornoBase', true],
      ['tamanho', 'todos'],
      ['incremental', true],
    ]);
    expect(dialogoDaGraduacao('graduar-automatico', com({ automatico: { dxMm: 1, dyMm: 2, tamanho: 'G' } }), cinco())!.campos.map((c) => [c.id, c.inicial])).toEqual([
      ['dx', '1'],
      ['dy', '2'],
      ['tamanho', 'G'],
    ]);
    expect(lerDialogoDaGraduacao('graduar-tangente', O, { distancia: 7, inverter: false, usarContornoBase: false, tamanho: 'G', incremental: false }).tangente).toEqual({
      distanciaMm: 7,
      inverter: false,
      usarContornoBase: false,
      tamanho: 'G',
      incremental: false,
    });
    expect(lerDialogoDaGraduacao('graduar-automatico', O, { dx: 8, dy: -2, tamanho: 'G' }).automatico).toEqual({ dxMm: 8, dyMm: -2, tamanho: 'G' });
    expect(instrucaoDaGraduacao('graduar-tangente', com({ tangente: { ...TANGENTE, tamanho: 'G' } }), SEM_TRECHO, null)).toMatch(/5,0 mm no tamanho G,/);
    expect(instrucaoDaGraduacao('graduar-tangente', com({ tangente: { ...TANGENTE, incremental: false } }), SEM_TRECHO, null)).toMatch(/5,0 mm a partir do base,/);
    expect(instrucaoDaGraduacao('graduar-tangente', com({ tangente: TANGENTE }), SEM_TRECHO, null)).toMatch(/5,0 mm por tamanho,/);
    expect(instrucaoDaGraduacao('graduar-automatico', com({ automatico: { dxMm: 7, dyMm: 0, tamanho: 'G' } }), SEM_TRECHO, null)).toMatch(/DY 0,0 mm no tamanho G\./);
  });
});

describe('Regras', () => {
  const guardada: RegraCadastrada = { id: 'r1', nome: 'Ombro', tamanhos: ['P', 'M', 'G'], base: 'M', deslocamentos: regra(3, 6) };

  it('sem regra escolhida, o clique avisa', () => {
    expect(clicar('graduar-regras', O, graduada(), noPonto(2)).recado).toMatch(/Escolha antes uma regra/);
  });

  it('com a regra escolhida, o ponto clicado a recebe', () => {
    const peca = graduada();
    const resultado = cliqueDeGraduacao('graduar-regras', O, [peca], peca, SEM_TRECHO, noPonto(2), contexto(guardada));
    expect(regraDo(resultado, 2)).toEqual(regra(3, 6));
    expect(resultado.recado).toBe('Regra “Ombro” aplicada ao ponto 3: no tamanho G, DX 6,0 mm e DY 3,0 mm.');
  });

  it('a regra que não tem um tamanho da peça é recusada, com a explicação', () => {
    const peca = graduada(['P', 'M', 'G', 'GG']);
    const resultado = cliqueDeGraduacao('graduar-regras', O, [peca], peca, SEM_TRECHO, noPonto(2), contexto(guardada));
    expect(resultado.pecas).toBeUndefined();
    expect(resultado.recado).toMatch(/A regra “Ombro” não tem o tamanho GG/);
  });
});

describe('Remover, Deduzir e Graduar curva', () => {
  it('Remover apaga o eixo pedido do ponto clicado', () => {
    const tudo = clicar('remover-graduacao', O, comRegraNoCanto(), noPonto(2));
    expect(regraDo(tudo, 2)).toEqual([ZERO, ZERO, ZERO]);
    expect(tudo.recado).toBe('DX e DY apagado do ponto 3: ele fica parado nisso, em todos os tamanhos.');
    // Apenas DX: zera o y do mundo e deixa o x.
    const soDx = clicar('remover-graduacao', com({ remover: { onde: 'pontos', eixo: 'dx' } }), comRegraNoCanto(), noPonto(2));
    expect(regraDo(soDx, 2)).toEqual(regra(10, 0));
    const soDy = clicar('remover-graduacao', com({ remover: { onde: 'pontos', eixo: 'dy' } }), comRegraNoCanto(), noPonto(2));
    expect(regraDo(soDy, 2)).toEqual(regra(0, 20));
  });

  it('Deduzir faz do ponto clicado o ponto fixo', () => {
    const resultado = clicar('deduzir-graduacao', O, comRegraNoCanto(), noPonto(2));
    expect(regraDo(resultado, 2)).toEqual([ZERO, ZERO, ZERO]);
    expect(regraDo(resultado, 0)).toEqual(regra(-10, -20));
    expect(resultado.recado).toMatch(/^Ponto 3 é agora o ponto fixo/);
  });

  it('Graduar curva: o ponto graduado volta a proporcional, e o proporcional vira graduado', () => {
    const tirou = clicar('graduar-curva', O, comRegraNoCanto(), noPonto(1));
    expect(verticesGraduados(tirou.pecas![0]!.graduacao!, RETANGULO)).toEqual([0, 2, 3]);
    expect(tirou.recado).toMatch(/^Ponto 2 voltou a ser proporcional/);
    const pos = clicar('graduar-curva', O, tirou.pecas![0]!, noPonto(1));
    expect(verticesGraduados(pos.pecas![0]!.graduacao!, RETANGULO)).toEqual([0, 1, 2, 3]);
    expect(pos.recado).toMatch(/^Ponto 2 agora é um ponto graduado/);
  });
});

describe('Agrupar ou desagrupar', () => {
  it('com DX e DY em zero, um clique empilha os tamanhos no ponto de referência', () => {
    const resultado = clicar('agrupar-graduacao', O, comRegraNoCanto(), noPonto(2));

    expect(regraDo(resultado, 2)).toEqual([ZERO, ZERO, ZERO]);
    expect(regraDo(resultado, 0)).toEqual(regra(-10, -20));
    expect(resultado.recado).toBe('Os tamanhos ficaram empilhados no ponto 3 (agrupados): ele não anda mais de um tamanho para o outro.');
  });

  it('com uma distância, cada tamanho fica afastado do vizinho — DX na horizontal da tela (o y do mundo)', () => {
    const resultado = clicar('agrupar-graduacao', com({ agrupar: { dxMm: 50, dyMm: 0, tamanho: 'todos' } }), comRegraNoCanto(), noPonto(2));

    expect(regraDo(resultado, 2)).toEqual(regra(0, 50));
    expect(resultado.recado).toBe('Os tamanhos ficaram afastados a partir do ponto 3 (desagrupados): DX 50,0 mm e DY 0,0 mm de um tamanho ao vizinho.');
  });

  it('num tamanho só, os outros não saem do lugar; um tamanho que a peça não tem só avisa', () => {
    const soOG = clicar('agrupar-graduacao', com({ agrupar: { dxMm: 0, dyMm: 0, tamanho: 'G' } }), comRegraNoCanto(), noPonto(2));
    expect(regraDo(soOG, 2)).toEqual([ponto(-10, -20), ZERO, ZERO]);
    expect(soOG.recado).toMatch(/^O tamanho G ficou empilhado no ponto 3/);

    const semEsse = clicar('agrupar-graduacao', com({ agrupar: { dxMm: 0, dyMm: 0, tamanho: 'XG' } }), comRegraNoCanto(), noPonto(2));
    expect(semEsse.pecas).toBeUndefined();
    expect(semEsse.recado).toMatch(/não tem o tamanho “XG”/);
  });
});

describe('Copiar graduação', () => {
  const origem = (): TrechoEmEdicao => clicar('copiar-graduacao', O, comRegraNoCanto(), noPonto(2)).estado;

  it('o primeiro clique é a origem; cada clique seguinte recebe a regra', () => {
    expect(origem().inicio!.indiceAresta).toBe(2);
    const resultado = clicar('copiar-graduacao', O, comRegraNoCanto(), noPonto(1), origem());
    expect(regraDo(resultado, 1)).toEqual(regra(10, 20));
    expect(resultado.estado.inicio!.indiceAresta).toBe(2);
    expect(resultado.recado).toBe('DX e DY do ponto 3 copiado para o ponto 2.');
  });

  it('apenas DX ou apenas DY: o outro eixo do destino fica como estava', () => {
    const soDx = com({ copiar: { ...O.copiar, eixo: 'dx' } });
    expect(regraDo(clicar('copiar-graduacao', soDx, comRegraNoCanto(), noPonto(1), origem()), 1)).toEqual(regra(0, 20));
    const soDy = com({ copiar: { ...O.copiar, eixo: 'dy' } });
    expect(regraDo(clicar('copiar-graduacao', soDy, comRegraNoCanto(), noPonto(1), origem()), 1)).toEqual(regra(10, 0));
  });

  it('invertendo, a regra chega com o sinal trocado nesse eixo', () => {
    const invertendoDx = com({ copiar: { ...O.copiar, inverterDx: true } });
    expect(regraDo(clicar('copiar-graduacao', invertendoDx, comRegraNoCanto(), noPonto(1), origem()), 1)).toEqual(regra(10, -20));
    const invertendoDy = com({ copiar: { ...O.copiar, inverterDy: true } });
    expect(regraDo(clicar('copiar-graduacao', invertendoDy, comRegraNoCanto(), noPonto(1), origem()), 1)).toEqual(regra(-10, 20));
  });

  it('para todos: o clique na origem já copia para os outros pontos graduados', () => {
    const paraTodos = com({ copiar: { ...O.copiar, destino: 'todos' } });
    const resultado = clicar('copiar-graduacao', paraTodos, comRegraNoCanto(), noPonto(2));
    for (const i of [0, 1, 3]) expect(regraDo(resultado, i)).toEqual(regra(10, 20));
    expect(resultado.estado).toBe(SEM_TRECHO);
    expect(resultado.recado).toBe('DX e DY do ponto 3 copiado para os outros 3 pontos graduados.');
  });

  it('clicar de novo na origem só avisa', () => {
    const resultado = clicar('copiar-graduacao', O, comRegraNoCanto(), noPonto(2), origem());
    expect(resultado.pecas).toBeUndefined();
    expect(resultado.recado).toMatch(/Clique noutro ponto/);
  });
});

describe('o que age na hora', () => {
  const ids = (): (() => string) => {
    let n = 0;
    return () => `novo-${++n}`;
  };

  it('Separar todos: uma peça por tamanho que não é o base, depois das que já existem', () => {
    const peca = comRegraNoCanto();
    const resultado = aplicarSeparar(O, [peca], peca, ids());
    expect(resultado.pecas.map((p) => [p.id, p.tamanho])).toEqual([
      ['f', 'M'],
      ['novo-1', 'P'],
      ['novo-2', 'G'],
    ]);
    expect(resultado.pecas[0]).toBe(peca);
    expect(resultado.pecas[2]!.graduacao).toBeUndefined();
    expect(area(resultado.pecas[2]!.contorno)).toBeCloseTo(63500, 6);
    expect(resultado.recado).toBe(
      '2 peças criadas a partir de “Frente”, nos tamanhos P e G: estão em fila depois das que já estavam na mesa, prontas para o encaixe.',
    );
  });

  it('Separar põe as peças novas depois de todas as que já estão na mesa, e não só depois da graduada', () => {
    const peca = comRegraNoCanto();
    // Outra peça do projeto, logo ao lado da graduada: de y = 350 a y = 650.
    const vizinha = molde(
      { nome: 'Costas', contorno: [ponto(0, 350), ponto(200, 350), ponto(200, 650), ponto(0, 650)], linhaDeFio: { inicio: ponto(50, 400), fim: ponto(50, 600) } },
      'c',
    );
    const resultado = aplicarSeparar(com({ separar: { tamanho: 'G' } }), [peca, vizinha], peca, ids());
    expect(Math.min(...resultado.pecas[2]!.contorno.map((p) => p.y))).toBeCloseTo(670, 6);
  });

  it('Separar um tamanho só', () => {
    const peca = comRegraNoCanto();
    const resultado = aplicarSeparar(com({ separar: { tamanho: 'G' } }), [peca], peca, ids());
    expect(resultado.pecas).toHaveLength(2);
    expect(resultado.recado).toBe('Tamanho G de “Frente” separado: é uma peça própria, posta depois das que já estavam na mesa, pronta para o encaixe.');
  });

  it('Separar recusa o base e a peça sem graduação', () => {
    const peca = comRegraNoCanto();
    expect(() => aplicarSeparar(com({ separar: { tamanho: 'M' } }), [peca], peca, ids())).toThrow(/diferente do base/);
    expect(() => aplicarSeparar(O, [molde()], molde(), ids())).toThrow(/Defina os tamanhos primeiro/);
  });

  it('Unir: as peças marcadas na lista viram tamanhos da selecionada e saem do projeto', () => {
    const m = molde();
    const g = molde({ tamanho: 'G', contorno: [ponto(500, 0), ponto(720, 0), ponto(720, 320), ponto(500, 320)], linhaDeFio: { inicio: ponto(555, 50), fim: ponto(555, 270) } }, 'g');
    const outra = molde({ nome: 'Costas' }, 'c');
    const resultado = aplicarUnir([m, g, outra], m, new Set(['g', 'f']));
    expect(resultado.pecas.map((p) => p.id)).toEqual(['f', 'c']);
    expect(resultado.pecas[0]!.graduacao).toMatchObject({ tamanhos: ['M', 'G'], base: 0 });
    expect(resultado.recado).toBe('“Frente” agora é graduada nos tamanhos M e G, com o M de base. A peça do outro tamanho foi reunida nela.');
  });

  it('Unir sem “Ajustar curvas”: só os cantos ficam graduados, e a mensagem diz', () => {
    // Um ponto no meio do lado direito, que não é canto: com a opção, fica graduado; sem ela, anda na proporção.
    const comMeio = (id: string, tamanho: string, largura: number, x0: number): Molde =>
      molde(
        {
          tamanho,
          contorno: [ponto(x0, 0), ponto(x0 + largura, 0), ponto(x0 + largura, 150), ponto(x0 + largura, 300), ponto(x0, 300)],
          linhaDeFio: { inicio: ponto(x0 + 50, 50), fim: ponto(x0 + 50, 250) },
        },
        id,
      );
    const m = comMeio('f', 'M', 200, 0);
    const g = comMeio('g', 'G', 240, 500);

    const exata = aplicarUnir([m, g], m, new Set(['g']));
    expect(exata.pecas[0]!.graduacao!.pontos).toHaveLength(5);
    expect(exata.recado).not.toMatch(/cantos/);

    const simples = aplicarUnir([m, g], m, new Set(['g']), false);
    expect(simples.pecas[0]!.graduacao!.pontos).toHaveLength(4);
    expect(simples.recado).toMatch(/Só os 4 cantos ficaram graduados; os pontos de curva andam na proporção\.$/);
    // O ponto do meio continua no lugar certo: anda na proporção dos cantos vizinhos.
    expect(regraDoVertice(simples.pecas[0]!.graduacao!, simples.pecas[0]!.contorno, 2)[1]).toEqual(ponto(40, 0));
  });

  it('Unir sem peças marcadas explica o que falta', () => {
    expect(() => aplicarUnir([molde()], molde(), new Set())).toThrow(/Marque na lista/);
  });

  it('Remover do molde inteiro: com DX e DY a peça deixa de ser graduada; com um eixo, ele é zerado em todos os pontos', () => {
    const peca = comRegraNoCanto();
    const semNada = aplicarRemoverDoMolde(com({ remover: { onde: 'molde', eixo: 'dx-dy' } }), [peca], peca);
    expect('graduacao' in semNada.pecas[0]!).toBe(false);
    expect(semNada.recado).toBe('Graduação removida de “Frente”: ficou só o tamanho M.');
    const semDx = aplicarRemoverDoMolde(com({ remover: { onde: 'molde', eixo: 'dx' } }), [peca], peca);
    expect(regraDoVertice(semDx.pecas[0]!.graduacao!, RETANGULO, 2)).toEqual(regra(10, 0));
    expect(semDx.recado).toBe('DX apagado de todos os pontos graduados de “Frente”.');
    expect(() => aplicarRemoverDoMolde(O, [molde()], molde())).toThrow(/não tem graduação/);
  });
});

describe('diálogos das ferramentas', () => {
  const COM_DIALOGO: readonly FerramentaDeGraduacao[] = [
    'graduar-automatico',
    'ajustar-graduacao',
    'agrupar-graduacao',
    'graduar-mouse',
    'graduar-tangente',
    'remover-graduacao',
    'copiar-graduacao',
    'separar-tamanhos',
    'unir-tamanhos',
  ];

  it('nove ferramentas perguntam antes; as outras ligam direto', () => {
    for (const ferramenta of COM_DIALOGO) {
      const dialogo = dialogoDaGraduacao(ferramenta, O, graduada())!;
      expect(dialogo.titulo.length).toBeGreaterThan(5);
      expect(dialogo.campos.length).toBeGreaterThan(0);
      expect(new Set(dialogo.campos.map((c) => c.id)).size).toBe(dialogo.campos.length);
    }
    for (const ferramenta of ['graduar-tabela', 'graduar-regras', 'criar-regra', 'deduzir-graduacao', 'graduar-curva'] as const) {
      expect(dialogoDaGraduacao(ferramenta, O, graduada())).toBeNull();
    }
  });

  it('Separar oferece todos e cada tamanho que não é o base', () => {
    const dialogo = dialogoDaGraduacao('separar-tamanhos', O, graduada())!;
    const campo = dialogo.campos[0]!;
    expect(campo.tipo === 'escolha' && campo.opcoes.map((o) => o.valor)).toEqual(['todos', 'P', 'G']);
    expect(dialogo.rotuloDoBotao).toBe('Separar');
    expect(dialogoDaGraduacao('separar-tamanhos', O, molde())).toBeNull();
  });

  it('Agrupar oferece todos e cada tamanho que não é o base', () => {
    const campo = dialogoDaGraduacao('agrupar-graduacao', O, graduada())!.campos[2]!;
    expect(campo.tipo === 'escolha' && campo.opcoes.map((o) => o.valor)).toEqual(['todos', 'P', 'G']);
    expect(dialogoDaGraduacao('agrupar-graduacao', O, molde())).toBeNull();
  });

  it('onde o manual dá os passos mas não a conta, o diálogo diz o que é leitura nossa', () => {
    expect(dialogoDaGraduacao('ajustar-graduacao', O, graduada())!.nota).toMatch(/dá esses passos, mas não a conta; a proporção é a nossa leitura/);
    expect(dialogoDaGraduacao('graduar-mouse', O, graduada())!.nota).toMatch(/no Proporcional, dois: onde o ponto fica no menor tamanho e onde fica no maior/);
    // "Unir" pergunta mesmo na peça que ainda não tem graduação: é unindo que ela passa a ter.
    expect(dialogoDaGraduacao('unir-tamanhos', O, molde())!.campos.map((c) => c.id)).toEqual(['ajustarCurvas']);
  });

  it('lê as opções de cada diálogo', () => {
    expect(lerDialogoDaGraduacao('graduar-automatico', O, { dx: 8, dy: -2 }).automatico).toEqual({ dxMm: 8, dyMm: -2, tamanho: 'todos' });
    expect(lerDialogoDaGraduacao('ajustar-graduacao', O, { eixo: 'dy' }).ajustar).toEqual({ eixo: 'dy' });
    expect(lerDialogoDaGraduacao('agrupar-graduacao', O, { dx: 40, dy: 0, tamanho: 'G' }).agrupar).toEqual({ dxMm: 40, dyMm: 0, tamanho: 'G' });
    expect(lerDialogoDaGraduacao('graduar-mouse', O, { modo: 'incremental' }).mouse).toEqual({ modo: 'incremental' });
    expect(lerDialogoDaGraduacao('graduar-mouse', O, { modo: 'proporcional' }).mouse).toEqual({ modo: 'proporcional' });
    expect(lerDialogoDaGraduacao('graduar-mouse', O, { modo: 'outro' }).mouse).toEqual({ modo: 'absoluto' });
    expect(lerDialogoDaGraduacao('unir-tamanhos', O, { ajustarCurvas: false }).unir).toEqual({ ajustarCurvas: false });
    expect(lerDialogoDaGraduacao('graduar-tangente', O, { distancia: 7, inverter: true }).tangente).toEqual({ distanciaMm: 7, inverter: true, usarContornoBase: true, tamanho: 'todos', incremental: true });
    expect(lerDialogoDaGraduacao('remover-graduacao', O, { onde: 'molde', eixo: 'dy' }).remover).toEqual({ onde: 'molde', eixo: 'dy' });
    expect(lerDialogoDaGraduacao('copiar-graduacao', O, { eixo: 'dx', inverterDx: true, inverterDy: false, destino: 'todos' }).copiar).toEqual({
      eixo: 'dx',
      inverterDx: true,
      inverterDy: false,
      destino: 'todos',
    });
    expect(lerDialogoDaGraduacao('separar-tamanhos', O, { tamanho: 'G' }).separar).toEqual({ tamanho: 'G' });
    expect(lerDialogoDaGraduacao('graduar-curva', O, {})).toBe(O);
  });

  it('recusa a tangente que não mudaria nada', () => {
    expect(() => lerDialogoDaGraduacao('graduar-tangente', O, { distancia: 0, inverter: false })).toThrow(/diferente de zero/);
  });
});

describe('prévia e instruções', () => {
  it('Ajustar: a prévia destaca os pontos clicados e, com o final indicado, mostra o tamanho da ponta ajustado', () => {
    const peca = comRegraNoCanto();
    const doInicio: TrechoEmEdicao = { ...SEM_TRECHO, inicio: { indiceAresta: 0, ponto: RETANGULO[0]! }, livres: [RETANGULO[1]!] };
    expect(previaDaGraduacao('ajustar-graduacao', O, peca, doInicio, null)).toEqual({ marcas: RETANGULO, substituido: [RETANGULO[0], RETANGULO[1]] });

    const comFinal = previaDaGraduacao('ajustar-graduacao', O, peca, { ...doInicio, livres: [RETANGULO[1]!, RETANGULO[2]!] }, null);
    // No G, o ponto 2 anda 2/5 do que o ponto 3 anda: de (200, 0) para (204, 8).
    expect(comFinal.novo![1]).toEqual(ponto(204, 8));
    expect(comFinal.novoFechado).toBe(true);
  });

  it('a prévia marca os pontos graduados da peça', () => {
    expect(previaDaGraduacao('graduar-tabela', O, graduada(), SEM_TRECHO, null)).toEqual({ marcas: RETANGULO });
    expect(previaDaGraduacao('graduar-tabela', O, molde(), SEM_TRECHO, null)).toEqual({});
  });

  it('cada ferramenta diz o próximo clique e termina com "Esc sai."', () => {
    for (const modo of MODOS) {
      const texto = instrucaoDaGraduacao(modo, O, SEM_TRECHO, null);
      expect(texto.endsWith(' Esc sai.')).toBe(true);
      expect(texto.length).toBeGreaterThan(30);
    }
  });

  it('a instrução muda com o que já foi clicado e com as opções', () => {
    const noCanto: TrechoEmEdicao = { ...SEM_TRECHO, inicio: { indiceAresta: 2, ponto: ponto(200, 300) } };
    expect(instrucaoDaGraduacao('graduar-mouse', O, noCanto, null)).toMatch(/onde o ponto 3 deve ficar no tamanho da ponta/);
    expect(instrucaoDaGraduacao('agrupar-graduacao', O, SEM_TRECHO, null)).toMatch(/^Agrupar: clique no ponto de referência — os tamanhos ficam empilhados nele/);
    expect(instrucaoDaGraduacao('agrupar-graduacao', com({ agrupar: { dxMm: 30, dyMm: 0, tamanho: 'todos' } }), SEM_TRECHO, null)).toMatch(/^Desagrupar: .* DX 30,0 mm e DY 0,0 mm do vizinho/);
    expect(instrucaoDaGraduacao('ajustar-graduacao', O, noCanto, null)).toMatch(/a partir do ponto 3, clique nos pontos a ajustar/);
    expect(instrucaoDaGraduacao('ajustar-graduacao', O, { ...noCanto, livres: [ponto(0, 0), ponto(200, 0)] }, null)).toMatch(/com 1 ponto\(s\) ajustado\(s\)/);
    expect(instrucaoDaGraduacao('copiar-graduacao', O, noCanto, null)).toMatch(/a regra do ponto 3/);
    expect(instrucaoDaGraduacao('graduar-automatico', com({ automatico: { dxMm: 7, dyMm: 0, tamanho: 'todos' } }), SEM_TRECHO, null)).toMatch(/DX 7,0 mm e DY 0,0 mm/);
    const guardada: RegraCadastrada = { id: 'r', nome: 'Ombro', tamanhos: ['P', 'M', 'G'], base: 'M', deslocamentos: regra(1, 1) };
    expect(instrucaoDaGraduacao('graduar-regras', O, SEM_TRECHO, guardada)).toMatch(/Regras \(“Ombro”\)/);
  });
});

describe('Copiar graduação para outra peça', () => {
  // A outra peça fica 400 mm à direita, com os mesmos tamanhos.
  const outra = (tamanhos = ['P', 'M', 'G']): Molde => definirTamanhosDoMolde(molde({ contorno: RETANGULO.map((p) => ponto(p.x, p.y + 400)), linhaDeFio: { inicio: ponto(50, 450), fim: ponto(50, 650) } }, 'o'), tamanhos, 'M');
  const COPIAR = com({ copiar: { eixo: 'dx-dy', inverterDx: false, inverterDy: false, destino: 'cliques' } });
  const comOrigem = (): TrechoEmEdicao => ({ ...SEM_TRECHO, inicio: { indiceAresta: 2, ponto: RETANGULO[2]! } });

  it('com a origem indicada, o clique num ponto de outra peça graduada copia a regra para ele', () => {
    const peca = comRegraNoCanto();
    const destino = outra();
    const resultado = cliqueDeGraduacao('copiar-graduacao', COPIAR, [peca, destino], peca, comOrigem(), solto(201, 699), { regra: null, raioMm: 6 });

    // O ponto 3 da outra peça é (200, 700): fica com a regra do ponto 3 desta.
    const copiada = resultado.pecas!.find((p) => p.id === 'o')!;
    expect(regraDoVertice(copiada.graduacao!, copiada.contorno, 2)).toEqual(regraDoVertice(peca.graduacao!, peca.contorno, 2));
    expect(resultado.pecas!.find((p) => p.id === 'f')).toBe(peca);
    expect(resultado.recado).toBe('DX e DY do ponto 3 de “Frente” copiado para o ponto 3 de “Frente”.');
    // A origem continua indicada: dá para copiar para mais pontos.
    expect(resultado.estado.inicio).not.toBeNull();
  });

  it('a outra peça precisa ter tamanhos, e todos os desta', () => {
    const peca = comRegraNoCanto();
    const semTamanhos = molde({ contorno: RETANGULO.map((p) => ponto(p.x, p.y + 400)) }, 'o');
    const sem = cliqueDeGraduacao('copiar-graduacao', COPIAR, [peca, semTamanhos], peca, comOrigem(), solto(200, 700), { regra: null, raioMm: 6 });
    expect(sem.pecas).toBeUndefined();
    expect(sem.recado).toMatch(/ainda não tem tamanhos/);

    const comOutros = cliqueDeGraduacao('copiar-graduacao', COPIAR, [peca, outra(['P', 'M', 'G', 'GG'])], peca, comOrigem(), solto(200, 700), { regra: null, raioMm: 6 });
    expect(comOutros.pecas).toBeUndefined();
    expect(comOutros.recado).toMatch(/não tem o tamanho GG/);
  });

  it('longe de qualquer ponto, ou sem o raio, o clique fora da peça é recusado como antes', () => {
    const peca = comRegraNoCanto();
    const longe = cliqueDeGraduacao('copiar-graduacao', COPIAR, [peca, outra()], peca, comOrigem(), solto(100, 550), { regra: null, raioMm: 6 });
    expect(longe.pecas).toBeUndefined();
    const semRaio = cliqueDeGraduacao('copiar-graduacao', COPIAR, [peca, outra()], peca, comOrigem(), solto(200, 700), { regra: null });
    expect(semRaio.pecas).toBeUndefined();
    // Antes da origem, o clique na outra peça não escolhe nada.
    const semOrigem = cliqueDeGraduacao('copiar-graduacao', COPIAR, [peca, outra()], peca, SEM_TRECHO, solto(200, 700), { regra: null, raioMm: 6 });
    expect(semOrigem.pecas).toBeUndefined();
    expect(semOrigem.estado).toBe(SEM_TRECHO);
    // É a recusa de sempre para o clique fora do contorno da peça selecionada, e não um erro de conta.
    expect(semOrigem.recado).toBe(longe.recado);
  });

  it('com um conjunto de regras em uso, a instrução diz qual é a regra da vez', () => {
    const regraDaVez: RegraCadastrada = { id: 'r1', nome: 'Ombro', tamanhos: ['P', 'M', 'G'], base: 'M', deslocamentos: regra(3, 6) };
    expect(instrucaoDaGraduacao('graduar-regras', O, SEM_TRECHO, regraDaVez, { nome: 'Blusa', numero: 2, total: 5 })).toMatch(
      /^Regras \(conjunto “Blusa”, regra 2 de 5: “Ombro”\): clique no ponto que deve receber essa regra — o clique seguinte aplica a próxima\. Esc sai\.$/,
    );
    expect(instrucaoDaGraduacao('graduar-regras', O, SEM_TRECHO, regraDaVez)).toMatch(/^Regras \(“Ombro”\): clique nos pontos/);
  });
});

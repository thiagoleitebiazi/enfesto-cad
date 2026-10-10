import { describe, it, expect } from 'vitest';
import { area, ponto, type PosicaoNoContorno } from '../core/geometria';
import { criarMolde, type DadosDeNovoMolde, type Molde } from '../domain/molde';
import {
  cliqueDeDobrar,
  dialogoDeDobrar,
  instrucaoDeDobrar,
  lerDialogoDeDobrar,
  OPCOES_INICIAIS_DE_DOBRAR,
  previaDeDobrar,
  type CliqueDeDobra,
  type ModoDeDobra,
  type OpcoesDeDobrar,
} from './ferramentasDeDobra';
import { aplicarDesdobrar } from './ferramentasDeMolde';
import { SEM_TRECHO, type TrechoEmEdicao } from './ferramentasDeTrecho';

// Frente: 200 × 300 mm. Na tela a horizontal é o Y do mundo: a dobra "horizontal" (deitada) fica em x = 100.
const FRENTE = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
// Um "L": a linha do meio, deitada, passa por cima de uma aresta dele.
const EM_L = [ponto(0, 0), ponto(200, 0), ponto(200, 100), ponto(100, 100), ponto(100, 300), ponto(0, 300)];

function molde(contorno = FRENTE, extra: Partial<DadosDeNovoMolde> = {}): Molde {
  return criarMolde({ nome: 'Frente', referencia: 'REF', tamanho: 'M', contorno, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) }, ...extra }, 'f');
}

const O = OPCOES_INICIAIS_DE_DOBRAR;
const com = (parte: Partial<OpcoesDeDobrar>): OpcoesDeDobrar => ({ ...O, ...parte });
const dentro = (x: number, y: number, linhaInterna: number | null = null): CliqueDeDobra => ({ noContorno: null, livre: ponto(x, y), linhaInterna });
const noContorno = (posicao: PosicaoNoContorno): CliqueDeDobra => ({ noContorno: posicao, livre: posicao.ponto, linhaInterna: null });
const ids = (): (() => string) => {
  let n = 0;
  return () => `novo-${++n}`;
};
const clicar = (opcoes: OpcoesDeDobrar, peca: Molde, clique: CliqueDeDobra, estado: TrechoEmEdicao = SEM_TRECHO) =>
  cliqueDeDobrar(opcoes, [peca], peca, estado, clique, ids());

describe('a janela do Dobrar', () => {
  it('pergunta o modo e as duas opções do manual, e lê o que foi escolhido', () => {
    const { campos, nota } = dialogoDeDobrar(O);

    expect(campos.map((c) => c.id)).toEqual(['modo', 'manter', 'fioNoCentro']);
    expect(campos[0]!.tipo === 'escolha' && campos[0]!.opcoes.map((o) => o.valor)).toEqual(['horizontal', 'vertical', 'elemento', 'dois-pontos']);
    expect(nota).toMatch(/não diz por onde passa a linha nos modos Horizontal e Vertical; aqui, pelo meio da peça/);
    expect(lerDialogoDeDobrar({ modo: 'elemento', manter: true, fioNoCentro: false })).toEqual({ modo: 'elemento', manter: true, fioNoCentro: false });
    expect(lerDialogoDeDobrar({ modo: 'qualquer coisa', manter: false, fioNoCentro: true })).toEqual({ modo: 'horizontal', manter: false, fioNoCentro: true });
  });
});

describe('cliqueDeDobrar', () => {
  it('horizontal: um clique dentro da peça dobra pelo meio e fica o lado clicado', () => {
    const resultado = clicar(O, molde(), dentro(150, 150));

    const dobrada = resultado.pecas![0]!;
    expect(dobrada.contorno).toEqual([ponto(100, 0), ponto(200, 0), ponto(200, 300), ponto(100, 300)]);
    expect(dobrada.dobraMantida).toBeUndefined();
    expect(resultado.estado).toBe(SEM_TRECHO);
    expect(resultado.recado).toMatch(/“Desdobrar”, nessa aresta, devolve a outra metade espelhada\.$/);
  });

  it('vertical: a linha de dobra fica em pé, pelo meio', () => {
    const dobrada = clicar(com({ modo: 'vertical' }), molde(), dentro(100, 50)).pecas![0]!;

    expect(area(dobrada.contorno)).toBeCloseTo(200 * 150, 6);
    expect(Math.max(...dobrada.contorno.map((p) => p.y))).toBe(150);
  });

  it('com “Manter dobra do molde”, a outra metade fica guardada na peça', () => {
    const resultado = clicar(com({ manter: true }), molde(), dentro(150, 150));

    const guardada = resultado.pecas![0]!.dobraMantida!;
    expect(area(guardada.contorno)).toBeCloseTo(100 * 300, 6);
    expect([guardada.de, guardada.ate]).toEqual([ponto(100, 0), ponto(100, 300)]);
    expect(resultado.recado).toMatch(/A outra metade ficou guardada: “Desdobrar”, nessa aresta, traz ela de volta como era\.$/);
  });

  it('com “Fio no centro do molde”, a linha de fio vai para o meio da metade que fica', () => {
    const dobrada = clicar(com({ fioNoCentro: true }), molde(), dentro(150, 150)).pecas![0]!;

    expect(dobrada.linhaDeFio).toEqual({ inicio: ponto(150, 50), fim: ponto(150, 250) });
  });

  it('elemento: o primeiro clique escolhe a linha interna reta; o segundo, o lado — e a linha vira a aresta', () => {
    const peca = molde(FRENTE, { linhasInternas: [[ponto(50, 100), ponto(150, 100)], [ponto(20, 20), ponto(40, 20)]] });

    const semLinha = clicar(com({ modo: 'elemento' }), peca, dentro(100, 200));
    expect(semLinha.pecas).toBeUndefined();
    expect(semLinha.recado).toMatch(/Clique em cima de uma linha interna reta/);

    const escolhida = clicar(com({ modo: 'elemento' }), peca, dentro(100, 100, 0));
    expect(escolhida.pecas).toBeUndefined();
    expect([escolhida.estado.inicio!.ponto, escolhida.estado.fim!.ponto]).toEqual([ponto(200, 100), ponto(0, 100)]);

    const dobrada = clicar(com({ modo: 'elemento' }), peca, dentro(100, 50), escolhida.estado).pecas![0]!;
    expect(area(dobrada.contorno)).toBeCloseTo(200 * 100, 6);
    // A linha da dobra saiu das linhas internas; a outra, que está do lado que ficou, continua.
    expect(dobrada.linhasInternas).toEqual([[ponto(20, 20), ponto(40, 20)]]);
  });

  it('elemento: uma linha interna que não é reta é recusada, e a ferramenta volta ao começo', () => {
    const peca = molde(FRENTE, { linhasInternas: [[ponto(50, 100), ponto(100, 120), ponto(150, 100)]] });

    const resultado = clicar(com({ modo: 'elemento' }), peca, dentro(100, 120, 0));
    expect(resultado.recado).toBe('A linha interna precisa ser reta para servir de linha de dobra.');
    expect(resultado.estado).toBe(SEM_TRECHO);
  });

  it('dois pontos: as duas pontas no contorno e, por último, o lado', () => {
    const opcoes = com({ modo: 'dois-pontos' });
    const primeira = clicar(opcoes, molde(), noContorno({ indiceAresta: 0, ponto: ponto(60, 0) }));
    const segunda = clicar(opcoes, molde(), noContorno({ indiceAresta: 2, ponto: ponto(60, 300) }), primeira.estado);
    expect(segunda.pecas).toBeUndefined();
    // Um clique fora do contorno, antes da segunda ponta, não conta.
    expect(clicar(opcoes, molde(), dentro(100, 100), primeira.estado).estado).toBe(primeira.estado);

    const dobrada = clicar(opcoes, molde(), dentro(30, 150), segunda.estado).pecas![0]!;
    expect(area(dobrada.contorno)).toBeCloseTo(60 * 300, 6);
  });

  it('a linha do meio que cruza o contorno em mais de dois pontos é recusada, com a saída', () => {
    const resultado = clicar(O, molde(EM_L), dentro(50, 50));

    expect(resultado.pecas).toBeUndefined();
    expect(resultado.recado).toBe('Essa linha cruza o contorno em mais de dois pontos: use o modo “Dois pontos do contorno” e indique a dobra.');
  });

  it('um clique fora da peça não escolhe lado nenhum', () => {
    const resultado = clicar(O, molde(), dentro(900, 900));

    expect(resultado.pecas).toBeUndefined();
    expect(resultado.recado).toBe('Clique dentro da peça, do lado que deve ficar.');
  });
});

describe('previaDeDobrar e instrucaoDeDobrar', () => {
  it('horizontal: a linha do meio e, com o mouse dentro da peça, o outro lado em destaque', () => {
    expect(previaDeDobrar(O, molde(), SEM_TRECHO, null)).toEqual({ novo: [ponto(100, 0), ponto(100, 300)], marcas: [] });

    const previa = previaDeDobrar(O, molde(), SEM_TRECHO, dentro(150, 150));
    expect(previa.novo).toEqual([ponto(100, 0), ponto(100, 300)]);
    // O mouse está do lado direito: sai o esquerdo, fechado.
    expect(area(previa.substituido!.slice(0, -1))).toBeCloseTo(100 * 300, 6);
    expect(Math.max(...previa.substituido!.map((p) => p.x))).toBe(100);
  });

  it('elemento: antes de escolher, a linha interna sob o mouse fica em destaque', () => {
    const linha = [ponto(50, 100), ponto(150, 100)];
    const peca = molde(FRENTE, { linhasInternas: [linha] });

    expect(previaDeDobrar(com({ modo: 'elemento' }), peca, SEM_TRECHO, dentro(100, 100, 0))).toEqual({ substituido: linha });
    expect(previaDeDobrar(com({ modo: 'elemento' }), peca, SEM_TRECHO, dentro(100, 200))).toEqual({});
  });

  it('a linha que não serve não derruba a prévia', () => {
    expect(previaDeDobrar(O, molde(EM_L), SEM_TRECHO, dentro(50, 50))).toEqual({ marcas: [] });
  });

  it('cada modo diz o próximo clique e termina com "Esc sai."', () => {
    for (const modo of ['horizontal', 'vertical', 'elemento', 'dois-pontos'] as readonly ModoDeDobra[]) {
      const texto = instrucaoDeDobrar(com({ modo }), SEM_TRECHO);
      expect(texto.endsWith(' Esc sai.'), modo).toBe(true);
      expect(texto.startsWith('Dobrar'), modo).toBe(true);
    }
    expect(instrucaoDeDobrar(com({ modo: 'elemento' }), SEM_TRECHO)).toMatch(/clique na linha interna reta/);
    expect(instrucaoDeDobrar(com({ manter: true }), SEM_TRECHO)).toMatch(/o lado em destaque é o que fica guardado/);
    expect(instrucaoDeDobrar(O, SEM_TRECHO)).toMatch(/o lado em destaque é o que sai/);
  });
});

describe('Desdobrar depois de Dobrar', () => {
  // Trapézio: o lado esquerdo tem 200 mm e o direito, 300. Não é simétrico na dobra do meio.
  const TRAPEZIO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 200)];
  const arestaDaDobra = (peca: Molde): number =>
    peca.contorno.findIndex((p, i) => p.x === 100 && peca.contorno[(i + 1) % peca.contorno.length]!.x === 100);

  it('sem “Manter dobra”, a outra metade entra espelhada: a peça fica simétrica', () => {
    const dobrada = clicar(O, molde(TRAPEZIO), dentro(150, 100)).pecas![0]!;
    const resultado = aplicarDesdobrar([dobrada], dobrada, arestaDaDobra(dobrada), ids());

    // A metade que ficou tem 275 cm²: espelhada, dá 550 — e não os 500 do trapézio.
    expect(area(resultado.pecas[0]!.contorno)).toBeCloseTo(55000, 6);
    expect(resultado.recado).toBe('“Frente” desdobrada: a outra metade entrou espelhada. Agora tem 550,0 cm², e a dobra ficou como linha interna.');
  });

  it('com “Manter dobra”, a metade guardada volta como era: a peça é o trapézio de antes', () => {
    const dobrada = clicar(com({ manter: true }), molde(TRAPEZIO), dentro(150, 100)).pecas![0]!;
    const resultado = aplicarDesdobrar([dobrada], dobrada, arestaDaDobra(dobrada), ids());

    const inteira = resultado.pecas[0]!;
    expect(area(inteira.contorno)).toBeCloseTo(50000, 6);
    expect(inteira.dobraMantida).toBeUndefined();
    for (const canto of TRAPEZIO) expect(inteira.contorno).toContainEqual(canto);
    expect(resultado.recado).toBe('“Frente” desdobrada: a metade que estava guardada voltou como era. Agora tem 500,0 cm², e a dobra ficou como linha interna.');
  });

  it('com “Fio no centro”, o desdobrar leva a linha de fio para o meio da peça inteira', () => {
    const dobrada = clicar(O, molde(), dentro(150, 150)).pecas![0]!;
    const inteira = aplicarDesdobrar([dobrada], dobrada, arestaDaDobra(dobrada), ids(), true).pecas[0]!;

    expect(inteira.linhaDeFio).toEqual({ inicio: ponto(100, 50), fim: ponto(100, 250) });
  });

  it('se a dobra foi mexida, a metade guardada não encaixa: entra o espelho, e o recado diz por quê', () => {
    const dobrada = clicar(com({ manter: true }), molde(TRAPEZIO), dentro(150, 100)).pecas![0]!;
    const mexida: Molde = { ...dobrada, contorno: dobrada.contorno.map((p) => (p.x === 100 && p.y === 0 ? ponto(100, 10) : p)) };

    const resultado = aplicarDesdobrar([mexida], mexida, arestaDaDobra(mexida), ids());
    expect(resultado.recado).toMatch(/a outra metade entrou espelhada — a metade guardada é de outra aresta, ou a dobra foi mexida e ela já não encaixa/);
  });
});

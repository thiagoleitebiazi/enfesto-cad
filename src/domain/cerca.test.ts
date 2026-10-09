import { describe, it, expect } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde, adicionarPique, adicionarMarca, type DadosDeNovoMolde } from './molde';
import {
  cercaEntre,
  pontoDentroDaCerca,
  transladarCerca,
  contarDentroDaCerca,
  cercaAfetaMolde,
  moverDentroDaCerca,
  pecasAlvoDaCerca,
  pontosMoveisNaCerca,
  TODAS_AS_OPCOES_DA_CERCA,
  type OpcoesDeMoverCerca,
} from './cerca';

function dadosBase(sobrescrever: Partial<DadosDeNovoMolde> = {}): DadosDeNovoMolde {
  return {
    nome: 'Frente',
    referencia: 'REF-001',
    tamanho: 'M',
    contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)],
    linhaDeFio: { inicio: ponto(100, 50), fim: ponto(100, 250) },
    ...sobrescrever,
  };
}

const TUDO: OpcoesDeMoverCerca = { pontosDoContorno: true, furos: true, linhasInternas: true, marcas: true, linhaDeFio: true };
const SO_CONTORNO: OpcoesDeMoverCerca = { pontosDoContorno: true, furos: false, linhasInternas: false, marcas: false, linhaDeFio: false };

describe('cercaEntre / pontoDentroDaCerca / transladarCerca', () => {
  it('normaliza os cantos, em qualquer ordem', () => {
    expect(cercaEntre(ponto(50, 10), ponto(-5, 80))).toEqual({ minX: -5, minY: 10, maxX: 50, maxY: 80 });
  });

  it('inclui as bordas', () => {
    const cerca = cercaEntre(ponto(0, 0), ponto(10, 10));
    expect(pontoDentroDaCerca(ponto(10, 5), cerca)).toBe(true);
    expect(pontoDentroDaCerca(ponto(0, 0), cerca)).toBe(true);
    expect(pontoDentroDaCerca(ponto(10.001, 5), cerca)).toBe(false);
  });

  it('transladar move os quatro limites pelo mesmo deslocamento', () => {
    expect(transladarCerca(cercaEntre(ponto(0, 0), ponto(10, 20)), ponto(5, -3))).toEqual({ minX: 5, minY: -3, maxX: 15, maxY: 17 });
  });
});

describe('contarDentroDaCerca', () => {
  it('conta por categoria; a linha de fio só conta se as duas pontas estiverem dentro', () => {
    let molde = criarMolde(
      dadosBase({
        furos: [[ponto(20, 260), ponto(40, 260), ponto(40, 280), ponto(20, 280)]],
        linhasInternas: [[ponto(10, 150), ponto(190, 150)]],
      }),
      'm1',
    );
    molde = adicionarMarca(molde, ponto(100, 270), 'mk1');
    const cerca = cercaEntre(ponto(-10, 200), ponto(210, 310)); // faixa de baixo: y 200..310
    expect(contarDentroDaCerca(molde, cerca)).toEqual({
      pontosDoContorno: 2,
      furos: 4,
      linhasInternas: 0,
      marcas: 1,
      linhaDeFio: 0, // só a ponta (100,250) está dentro
    });
  });
});

describe('pecasAlvoDaCerca / pontosMoveisNaCerca', () => {
  const frente = criarMolde(dadosBase(), 'p1');
  const costas = criarMolde(dadosBase({ nome: 'Costas' }), 'p2');
  const manga = criarMolde(dadosBase({ nome: 'Manga' }), 'p3');
  const pecas = [frente, costas, manga];

  it('alvo: a seleção em lote, senão a peça selecionada, senão todas', () => {
    expect(pecasAlvoDaCerca(pecas, new Set(['p1', 'p3']), 'p2')).toEqual([frente, manga]);
    expect(pecasAlvoDaCerca(pecas, new Set(), 'p2')).toEqual([costas]);
    expect(pecasAlvoDaCerca(pecas, new Set(), null)).toBe(pecas);
  });

  it('pontos destacados: o que a cerca pode mover, com a linha de fio só quando inteira dentro', () => {
    let molde = criarMolde(
      dadosBase({
        furos: [[ponto(20, 260), ponto(40, 260), ponto(40, 280), ponto(20, 280)]],
        linhasInternas: [[ponto(10, 150), ponto(190, 150)]],
      }),
      'm1',
    );
    molde = adicionarMarca(molde, ponto(100, 270), 'mk1');

    const faixaDeBaixo = cercaEntre(ponto(-10, 200), ponto(210, 310));
    expect(pontosMoveisNaCerca(molde, faixaDeBaixo)).toEqual([
      ponto(200, 300),
      ponto(0, 300),
      ponto(20, 260),
      ponto(40, 260),
      ponto(40, 280),
      ponto(20, 280),
      ponto(100, 270),
    ]);

    const pecaInteira = cercaEntre(ponto(-10, -10), ponto(210, 310));
    expect(pontosMoveisNaCerca(molde, pecaInteira)).toHaveLength(4 + 4 + 2 + 1 + 2);
  });

  it('pontos destacados seguem as opções marcadas no diálogo', () => {
    let molde = criarMolde(
      dadosBase({ furos: [[ponto(20, 260), ponto(40, 260), ponto(40, 280), ponto(20, 280)]] }),
      'm1',
    );
    molde = adicionarMarca(molde, ponto(100, 270), 'mk1');
    const pecaInteira = cercaEntre(ponto(-10, -10), ponto(210, 310));

    const soFurosEMarcas = { ...TODAS_AS_OPCOES_DA_CERCA, pontosDoContorno: false, linhaDeFio: false };
    expect(pontosMoveisNaCerca(molde, pecaInteira, soFurosEMarcas)).toEqual([
      ponto(20, 260),
      ponto(40, 260),
      ponto(40, 280),
      ponto(20, 280),
      ponto(100, 270),
    ]);

    const nada = { pontosDoContorno: false, furos: false, linhasInternas: false, marcas: false, linhaDeFio: false };
    expect(pontosMoveisNaCerca(molde, pecaInteira, nada)).toEqual([]);
  });
});

describe('moverDentroDaCerca', () => {
  it('move só os pontos do contorno dentro da cerca; os de fora não mudam', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    const cerca = cercaEntre(ponto(-10, 290), ponto(210, 310)); // pega (200,300) e (0,300)
    const movido = moverDentroDaCerca(molde, cerca, ponto(0, 50), SO_CONTORNO);
    expect(movido.contorno).toEqual([ponto(0, 0), ponto(200, 0), ponto(200, 350), ponto(0, 350)]);
    expect(movido.linhaDeFio).toBe(molde.linhaDeFio);
  });

  it('respeita as opções: furo, linha interna e marca só se movem quando marcados', () => {
    let molde = criarMolde(
      dadosBase({
        furos: [[ponto(20, 260), ponto(40, 260), ponto(40, 280), ponto(20, 280)]],
        linhasInternas: [[ponto(10, 270), ponto(190, 270)]],
      }),
      'm1',
    );
    molde = adicionarMarca(molde, ponto(100, 270), 'mk1');
    const cerca = cercaEntre(ponto(-10, 255), ponto(210, 310));

    const soContorno = moverDentroDaCerca(molde, cerca, ponto(0, 10), SO_CONTORNO);
    expect(soContorno.furos).toBe(molde.furos);
    expect(soContorno.linhasInternas).toBe(molde.linhasInternas);
    expect(soContorno.marcas).toBe(molde.marcas);

    const tudo = moverDentroDaCerca(molde, cerca, ponto(0, 10), TUDO);
    expect(tudo.furos[0]).toEqual([ponto(20, 270), ponto(40, 270), ponto(40, 290), ponto(20, 290)]);
    expect(tudo.linhasInternas[0]).toEqual([ponto(10, 280), ponto(190, 280)]);
    expect(tudo.marcas[0]!.posicao).toEqual(ponto(100, 280));
  });

  it('linha de fio: move inteira quando as duas pontas estão dentro; nunca só uma ponta', () => {
    const molde = criarMolde(dadosBase(), 'm1'); // fio (100,50)→(100,250)
    const soUmaPonta = moverDentroDaCerca(molde, cercaEntre(ponto(-10, 200), ponto(210, 310)), ponto(0, 30), TUDO);
    expect(soUmaPonta.linhaDeFio).toBe(molde.linhaDeFio);

    const pecaInteira = moverDentroDaCerca(molde, cercaEntre(ponto(-10, -10), ponto(210, 310)), ponto(5, 30), TUDO);
    expect(pecaInteira.linhaDeFio).toEqual({ inicio: ponto(105, 80), fim: ponto(105, 280) });
    expect(pecaInteira.contorno).toEqual([ponto(5, 30), ponto(205, 30), ponto(205, 330), ponto(5, 330)]);
  });

  it('pique fica sobre a aresta, na mesma proporção, mesmo com só uma ponta da aresta movida', () => {
    let molde = criarMolde(dadosBase(), 'm1');
    molde = adicionarPique(molde, ponto(200, 150), 'p1'); // aresta 1: (200,0)→(200,300), a 50 %
    const cerca = cercaEntre(ponto(190, 290), ponto(210, 310)); // só o vértice (200,300)
    const movido = moverDentroDaCerca(molde, cerca, ponto(100, 0), SO_CONTORNO); // (200,300)→(300,300)
    expect(movido.piques[0]!.indiceAresta).toBe(1);
    expect(movido.piques[0]!.posicao.x).toBeCloseTo(250, 9);
    expect(movido.piques[0]!.posicao.y).toBeCloseTo(150, 9);
  });

  it('recusa movimento que deixaria o contorno sem área, sem alterar a peça', () => {
    const molde = criarMolde(dadosBase(), 'm1');
    const ladoDeBaixo = cercaEntre(ponto(-10, 290), ponto(210, 310));
    expect(() => moverDentroDaCerca(molde, ladoDeBaixo, ponto(0, -300), SO_CONTORNO)).toThrow(/sem área/);
    expect(molde.contorno).toEqual(dadosBase().contorno);
  });

  it('cercaAfetaMolde considera só as categorias marcadas', () => {
    const molde = adicionarMarca(criarMolde(dadosBase(), 'm1'), ponto(100, 150), 'mk1');
    const cercaNoMeio = cercaEntre(ponto(90, 140), ponto(110, 160)); // só a marca
    expect(cercaAfetaMolde(molde, cercaNoMeio, SO_CONTORNO)).toBe(false);
    expect(cercaAfetaMolde(molde, cercaNoMeio, TUDO)).toBe(true);
  });
});

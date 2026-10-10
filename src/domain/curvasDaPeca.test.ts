import { describe, it, expect } from 'vitest';
import { arcoPorTresPontos, curvaPorPontos } from '../core/curvas';
import { area, distancia, ponto, type Ponto2D, type PosicaoNoContorno } from '../core/geometria';
import { comCurvaRegistrada, comCurvasValidas, controlePerto, curvasDaPeca, gerarCurva, moverControle } from './curvasDaPeca';
import { definirRegra } from './graduacao';
import {
  criarMolde,
  dimensionarMolde,
  espelharMolde,
  moverPontoDoMolde,
  rotacionarMolde,
  substituirTrechoDoMolde,
  transladarMolde,
  type Molde,
} from './molde';
import { abrirPence } from './pences';
import { definirTamanhosDoMolde, moldeDoTamanho } from './tamanhosGraduados';

// Retângulo de 200 × 300 mm. A aresta 1 é o lado direito (x = 200), de (200, 0) a (200, 300).
const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
const DE: PosicaoNoContorno = { indiceAresta: 1, ponto: ponto(200, 0) };
const ATE: PosicaoNoContorno = { indiceAresta: 2, ponto: ponto(200, 300) };

function molde(): Molde {
  return criarMolde({ nome: 'Frente', referencia: 'REF', tamanho: 'M', contorno: RETANGULO, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) } }, 'm1');
}

/** A peça com o lado direito trocado por uma curva que passa pelos pontos dados, registrada como a ferramenta faz. */
function comCurva(passagem: readonly Ponto2D[] = [ponto(240, 150)], tipo: 'curva' | 'arco' = 'curva'): Molde {
  const controles = [DE.ponto, ...passagem, ATE.ponto];
  const linha = gerarCurva(tipo, controles);
  return comCurvaRegistrada(substituirTrechoDoMolde(molde(), DE, ATE, linha.slice(1, -1)), tipo, controles, linha, 'c1');
}

const aCurva = (peca: Molde) => curvasDaPeca(peca)[0]!;

describe('a curva feita por ferramenta fica registrada', () => {
  it('guarda os pontos por onde passa e os pontos do contorno que gerou', () => {
    const peca = comCurva();

    expect(peca.curvas).toHaveLength(1);
    expect(aCurva(peca)).toMatchObject({ id: 'c1', tipo: 'curva', controles: [ponto(200, 0), ponto(240, 150), ponto(200, 300)] });
    expect(aCurva(peca).pontos).toEqual(curvaPorPontos([ponto(200, 0), ponto(240, 150), ponto(200, 300)]));
    expect(aCurva(peca).pontos.length).toBeGreaterThan(10);
    // Todos os pontos da curva são pontos do contorno.
    for (const p of aCurva(peca).pontos) expect(peca.contorno).toContainEqual(p);
  });

  it('o arco por três pontos também', () => {
    const peca = comCurva([ponto(230, 150)], 'arco');

    expect(aCurva(peca).tipo).toBe('arco');
    expect(aCurva(peca).pontos).toEqual(arcoPorTresPontos(ponto(200, 0), ponto(230, 150), ponto(200, 300)));
  });

  it('sem ponto de passagem (uma reta) não há o que registrar', () => {
    const reta = comCurvaRegistrada(molde(), 'curva', [DE.ponto, ATE.ponto], [DE.ponto, ATE.ponto], 'c1');

    expect('curvas' in reta).toBe(false);
    expect(() => gerarCurva('arco', [DE.ponto, ATE.ponto])).toThrow('três pontos');
  });
});

describe('mexer num ponto de passagem', () => {
  it('controlePerto acha o ponto de passagem, e nunca as pontas', () => {
    const peca = comCurva([ponto(240, 100), ponto(250, 200)]);

    expect(controlePerto(peca, ponto(243, 102), 6)).toMatchObject({ indice: 1 });
    expect(controlePerto(peca, ponto(249, 203), 6)).toMatchObject({ indice: 2 });
    expect(controlePerto(peca, ponto(200, 0), 6)).toBeNull();
    expect(controlePerto(peca, ponto(200, 300), 6)).toBeNull();
    expect(controlePerto(peca, ponto(100, 150), 6)).toBeNull();
    expect(controlePerto(molde(), ponto(240, 100), 60)).toBeNull();
  });

  it('a curva é refeita pelo ponto novo e entra no contorno no lugar da antiga', () => {
    const peca = comCurva();
    const movida = moverControle(peca, 'c1', 1, ponto(280, 120));

    expect(aCurva(movida).controles).toEqual([ponto(200, 0), ponto(280, 120), ponto(200, 300)]);
    expect(aCurva(movida).pontos).toEqual(curvaPorPontos([ponto(200, 0), ponto(280, 120), ponto(200, 300)]));
    expect(movida.contorno).toContainEqual(ponto(280, 120));
    expect(movida.contorno).not.toContainEqual(ponto(240, 150));
    // O resto do contorno é o de antes: os quatro cantos continuam lá.
    for (const canto of RETANGULO) expect(movida.contorno).toContainEqual(canto);
    expect(area(movida.contorno)).toBeGreaterThan(area(peca.contorno));
  });

  it('funciona com o contorno guardado no outro sentido', () => {
    const peca = comCurva();
    const invertida: Molde = { ...peca, contorno: [...peca.contorno].reverse() };

    expect(curvasDaPeca(invertida)).toHaveLength(1);
    const movida = moverControle(invertida, 'c1', 1, ponto(280, 120));
    expect(movida.contorno).toContainEqual(ponto(280, 120));
    expect(curvasDaPeca(movida)).toHaveLength(1);
    expect(area(movida.contorno)).toBeCloseTo(area(moverControle(peca, 'c1', 1, ponto(280, 120)).contorno), 6);
  });

  it('o arco é refeito como arco: todos os pontos à mesma distância do centro', () => {
    const movida = moverControle(comCurva([ponto(230, 150)], 'arco'), 'c1', 1, ponto(260, 150));

    // Pelos três pontos (200, 0), (260, 150) e (200, 300): centro em x = 200 + (60² − 150²) / (2 × 60) = 42,5.
    for (const p of aCurva(movida).pontos) expect(distancia(p, ponto(42.5, 150))).toBeCloseTo(217.5, 6);
  });

  it('recusa as pontas, o ponto que deixa a peça sem área e a curva sem registro', () => {
    const peca = comCurva();

    expect(() => moverControle(peca, 'c1', 0, ponto(210, 10))).toThrow('pontas da curva');
    expect(() => moverControle(peca, 'c1', 2, ponto(210, 290))).toThrow('pontas da curva');
    expect(() => moverControle(peca, 'outra', 1, ponto(240, 150))).toThrow('mexida à mão');
  });
});

describe('o registro só vale enquanto os pontos da curva estão no contorno', () => {
  it('um ponto da curva mexido à mão invalida o registro; os outros pontos da peça, não', () => {
    const peca = comCurva();
    const naCurva = peca.contorno.findIndex((p) => p.x > 200);

    expect(curvasDaPeca(moverPontoDoMolde(peca, naCurva, ponto(300, 300)))).toEqual([]);
    expect('curvas' in comCurvasValidas(moverPontoDoMolde(peca, naCurva, ponto(300, 300)))).toBe(false);
    // O canto (0, 300) não é da curva.
    const canto = peca.contorno.findIndex((p) => p.x === 0 && p.y === 300);
    expect(curvasDaPeca(moverPontoDoMolde(peca, canto, ponto(-10, 310)))).toHaveLength(1);
    expect(comCurvasValidas(peca)).toBe(peca);
  });

  it('a curva acompanha a peça movida, girada, espelhada e dimensionada — e continua editável', () => {
    const transformadas = [
      transladarMolde(comCurva(), ponto(30, 40), 'm1'),
      rotacionarMolde(comCurva(), 90),
      espelharMolde(comCurva(), 'm1'),
      dimensionarMolde(comCurva(), 2, 1),
    ];
    for (const peca of transformadas) {
      expect(curvasDaPeca(peca)).toHaveLength(1);
      const passagem = aCurva(peca).controles[1]!;
      const movida = moverControle(peca, 'c1', 1, ponto(passagem.x + 5, passagem.y + 5));
      expect(curvasDaPeca(movida)).toHaveLength(1);
    }
    expect(aCurva(transformadas[0]!).controles[1]).toEqual(ponto(270, 190));
  });

  it('a curva que está no lado da peça que gira (ao abrir uma pence) vai junto, e continua registrada', () => {
    const peca = comCurva();
    // A linha de fio está à esquerda: o lado direito, onde está a curva, é o que gira.
    const embaixo = { indiceAresta: 0, ponto: ponto(100, 0) };
    const emCima = { indiceAresta: peca.contorno.length - 2, ponto: ponto(100, 300) };
    const aberta = abrirPence(peca, embaixo, emCima, 20, 80, false, () => 'novo');

    expect(curvasDaPeca(aberta)).toHaveLength(1);
    expect(aCurva(aberta).controles[1]).not.toEqual(ponto(240, 150));
    expect(curvasDaPeca(moverControle(aberta, 'c1', 1, ponto(250, 150)))).toHaveLength(1);
  });

  it('em cada tamanho da graduação, a curva continua registrada', () => {
    let graduada = definirTamanhosDoMolde(comCurva(), ['P', 'M', 'G'], 'M');
    const canto = graduada.contorno.findIndex((p) => p.x === 200 && p.y === 300);
    graduada = { ...graduada, graduacao: definirRegra(graduada.graduacao!, graduada.contorno, canto, [ponto(0, -20), ponto(0, 0), ponto(0, 20)]) };

    const g = moldeDoTamanho(graduada, 2, 'g');
    expect(curvasDaPeca(g)).toHaveLength(1);
    expect(aCurva(g).controles.at(-1)).toEqual(ponto(200, 320));
  });
});

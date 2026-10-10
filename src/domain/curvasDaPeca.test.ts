import { describe, it, expect } from 'vitest';
import { ajustarCurvaAosExtremos, arcoPorTresPontos, curvaPorPontos, normalizarCurva } from '../core/curvas';
import { area, distancia, ponto, type Ponto2D, type PosicaoNoContorno } from '../core/geometria';
import { moverDentroDaCerca } from './cerca';
import {
  acrescentarControle,
  comArcoRegistrado,
  comCurvaRegistrada,
  comCurvasValidas,
  controlePerto,
  curvaPerto,
  curvasDaPeca,
  gerarCurva,
  moverControle,
  removerControle,
  tornarTrechoCurva,
} from './curvasDaPeca';
import { distanciaAteALinha } from './regioes';
import { definirRegra } from './graduacao';
import {
  arredondarCantoDoMolde,
  criarMolde,
  dimensionarMolde,
  espelharMolde,
  moverPontoDoMolde,
  moverVariosPontosDoMolde,
  redefinirComprimentoDaAresta,
  rotacionarMolde,
  semCampo,
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

describe('a curva acompanha as pontas', () => {
  const indiceDe = (peca: Molde, p: Ponto2D): number => peca.contorno.findIndex((q) => distancia(p, q) < 1e-9);

  it('movida uma ponta, a curva é refeita entre as pontas de agora, pelos mesmos pontos de passagem', () => {
    const peca = comCurva();
    const movida = moverPontoDoMolde(peca, indiceDe(peca, DE.ponto), ponto(220, -10));

    expect(curvasDaPeca(movida)).toHaveLength(1);
    expect(aCurva(movida).controles).toEqual([ponto(220, -10), ponto(240, 150), ponto(200, 300)]);
    expect(aCurva(movida).pontos).toEqual(curvaPorPontos([ponto(220, -10), ponto(240, 150), ponto(200, 300)]));
    for (const p of aCurva(movida).pontos) expect(movida.contorno).toContainEqual(p);
    // O resto do contorno não mudou, e a curva antiga saiu inteira: são os dois cantos da esquerda mais a curva nova.
    expect(movida.contorno).toHaveLength(aCurva(movida).pontos.length + 2);
    expect(movida.contorno).toContainEqual(ponto(0, 0));
    expect(movida.contorno).toContainEqual(ponto(0, 300));
  });

  it('vale também no contorno que corre no outro sentido', () => {
    const peca = comCurva();
    const aoContrario = { ...peca, contorno: [...peca.contorno].reverse() };
    const movida = moverPontoDoMolde(aoContrario, indiceDe(aoContrario, ATE.ponto), ponto(210, 320));

    expect(curvasDaPeca(movida)).toHaveLength(1);
    expect(aCurva(movida).controles).toEqual([ponto(200, 0), ponto(240, 150), ponto(210, 320)]);
    for (const p of aCurva(movida).pontos) expect(movida.contorno).toContainEqual(p);
    expect(movida.contorno).toHaveLength(aCurva(movida).pontos.length + 2);
    expect(Math.abs(area(movida.contorno))).toBeGreaterThan(60000);
  });

  it('duas curvas que dividem a ponta movida são refeitas as duas', () => {
    const peca = comCurva();
    const emCima = [ATE.ponto, ponto(100, 330), ponto(0, 300)];
    const linha = gerarCurva('curva', emCima);
    const n = peca.contorno.length;
    const duas = comCurvaRegistrada(
      substituirTrechoDoMolde(peca, { indiceAresta: n - 2, ponto: ATE.ponto }, { indiceAresta: n - 1, ponto: ponto(0, 300) }, linha.slice(1, -1)),
      'curva',
      emCima,
      linha,
      'c2',
    );
    expect(curvasDaPeca(duas)).toHaveLength(2);

    const movida = moverPontoDoMolde(duas, indiceDe(duas, ATE.ponto), ponto(215, 310));
    const [primeira, segunda] = curvasDaPeca(movida);
    expect(primeira!.controles.at(-1)).toEqual(ponto(215, 310));
    expect(segunda!.controles[0]).toEqual(ponto(215, 310));
    expect(segunda!.controles[1]).toEqual(ponto(100, 330));
    // O contorno é: (0, 0), a primeira curva, e a segunda (que divide a ponta com a primeira e acaba em (0, 300)).
    expect(movida.contorno).toHaveLength(1 + primeira!.pontos.length + segunda!.pontos.length - 1);
  });

  it('a curva que anda inteira, pelo mesmo tanto, anda junto com os pontos de passagem', () => {
    const peca = comCurva();
    const daCurva = aCurva(peca).pontos.map((p) => indiceDe(peca, p));
    const movida = moverVariosPontosDoMolde(peca, daCurva, ponto(30, 0));

    expect(curvasDaPeca(movida)).toHaveLength(1);
    expect(aCurva(movida).controles).toEqual([ponto(230, 0), ponto(270, 150), ponto(230, 300)]);
    expect(movida.contorno).toHaveLength(peca.contorno.length);
  });

  it('mexido um ponto do meio, o registro deixa de valer, como antes', () => {
    const peca = comCurva();
    const doMeio = indiceDe(peca, aCurva(peca).pontos[5]!);
    const movida = moverPontoDoMolde(peca, doMeio, ponto(300, 100));

    expect(curvasDaPeca(movida)).toHaveLength(0);
    expect(movida.contorno).toHaveLength(peca.contorno.length);
  });

  it('“Redefinir perímetro” na aresta vizinha leva a ponta, e a curva vai atrás', () => {
    const peca = comCurva();
    // A aresta 0 vai de (0, 0) a (200, 0): com 250 mm, a ponta da curva passa a ser (250, 0).
    const maior = redefinirComprimentoDaAresta(peca, 0, 250, 'fim');

    expect(curvasDaPeca(maior)).toHaveLength(1);
    expect(aCurva(maior).controles[0]).toEqual(ponto(250, 0));
    expect(aCurva(maior).pontos).toEqual(curvaPorPontos([ponto(250, 0), ponto(240, 150), ponto(200, 300)]));
  });

  it('a cerca que leva a curva inteira leva o registro junto', () => {
    const peca = comCurva();
    const cerca = { minX: 190, minY: -10, maxX: 260, maxY: 310 };
    const movida = moverDentroDaCerca(peca, cerca, ponto(15, 0), { pontosDoContorno: true, furos: true, linhasInternas: true, marcas: true, linhaDeFio: true });

    expect(curvasDaPeca(movida)).toHaveLength(1);
    expect(aCurva(movida).controles[1]).toEqual(ponto(255, 150));
  });
});

describe('acrescentar e tirar pontos de passagem', () => {
  it('o ponto novo entra sobre a curva, na ordem, e a forma quase não muda', () => {
    const peca = comCurva();
    const antes = aCurva(peca).pontos;
    const maisUm = acrescentarControle(peca, 'c1', ponto(232, 70));

    const controles = aCurva(maisUm).controles;
    expect(controles).toHaveLength(4);
    expect(controles[0]).toEqual(ponto(200, 0));
    expect(controles[2]).toEqual(ponto(240, 150));
    // O ponto novo está sobre a curva de antes, perto de onde foi pedido.
    expect(distanciaAteALinha(controles[1]!, antes)).toBeLessThan(1e-9);
    expect(distancia(controles[1]!, ponto(232, 70))).toBeLessThan(10);
    for (const p of aCurva(maisUm).pontos) expect(distanciaAteALinha(p, antes)).toBeLessThan(3);
    for (const p of aCurva(maisUm).pontos) expect(maisUm.contorno).toContainEqual(p);
  });

  it('depois do ponto de passagem que já havia, o novo entra depois dele', () => {
    const maisUm = acrescentarControle(comCurva(), 'c1', ponto(232, 230));

    expect(aCurva(maisUm).controles[1]).toEqual(ponto(240, 150));
    expect(aCurva(maisUm).controles[2]!.y).toBeGreaterThan(150);
  });

  it('recusa o ponto em cima de outro, e o arco, que só tem três pontos', () => {
    expect(() => acrescentarControle(comCurva(), 'c1', ponto(240, 150))).toThrow('Já há um ponto de passagem aí');
    expect(() => acrescentarControle(comCurva(), 'c1', ponto(200, 0))).toThrow('Já há um ponto de passagem aí');
    expect(() => acrescentarControle(comCurva([ponto(230, 150)], 'arco'), 'c1', ponto(225, 70))).toThrow('três pontos só');
    expect(() => acrescentarControle(comCurva(), 'outra', ponto(232, 70))).toThrow('mexida à mão');
  });

  it('tirado um ponto de passagem, a curva é refeita pelos que ficam', () => {
    const peca = comCurva([ponto(230, 100), ponto(240, 200)]);
    const menos = removerControle(peca, 'c1', 1);

    expect(aCurva(menos).controles).toEqual([ponto(200, 0), ponto(240, 200), ponto(200, 300)]);
    expect(aCurva(menos).pontos).toEqual(curvaPorPontos([ponto(200, 0), ponto(240, 200), ponto(200, 300)]));
  });

  it('tirado o último, o trecho fica reto e o registro sai', () => {
    const reta = removerControle(comCurva(), 'c1', 1);

    expect('curvas' in reta).toBe(false);
    expect(reta.contorno).toHaveLength(4);
    for (const canto of RETANGULO) expect(reta.contorno).toContainEqual(canto);
    expect(() => removerControle(comCurva(), 'c1', 0)).toThrow('As pontas da curva não saem por aqui');
    expect(() => removerControle(comCurva(), 'c1', 2)).toThrow('As pontas da curva não saem por aqui');
  });

  it('curvaPerto acha a curva que passa perto do ponto', () => {
    const peca = comCurva();
    expect(curvaPerto(peca, ponto(238, 150), 6)?.id).toBe('c1');
    expect(curvaPerto(peca, ponto(100, 150), 6)).toBeNull();
  });
});

describe('tornar um trecho uma curva editável', () => {
  it('a curva sem registro ganha pontos de passagem igualmente espaçados, e a forma muda pouco', () => {
    const semRegistro = semCampo(comCurva(), 'curvas');
    const n = semRegistro.contorno.length;
    const { molde: editavel, desvioMm } = tornarTrechoCurva(semRegistro, DE, { indiceAresta: n - 2, ponto: ATE.ponto }, 3, 'c2');

    expect(curvasDaPeca(editavel)).toHaveLength(1);
    expect(aCurva(editavel)).toMatchObject({ id: 'c2', tipo: 'curva' });
    expect(aCurva(editavel).controles).toHaveLength(5);
    expect(aCurva(editavel).controles[0]).toEqual(ponto(200, 0));
    expect(aCurva(editavel).controles.at(-1)).toEqual(ponto(200, 300));
    expect(desvioMm).toBeGreaterThan(0);
    expect(desvioMm).toBeLessThan(2);
    // Com o registro, os pontos de passagem movem-se como os da curva feita por ferramenta.
    expect(curvasDaPeca(moverControle(editavel, 'c2', 2, ponto(260, 150)))).toHaveLength(1);
  });

  it('numa aresta reta, a forma não muda: os pontos de passagem ficam sobre ela, à espera de serem movidos', () => {
    const { molde: editavel, desvioMm } = tornarTrechoCurva(molde(), DE, ATE, 1, 'c2');

    expect(desvioMm).toBeLessThan(1e-9);
    expect(aCurva(editavel).controles).toEqual([ponto(200, 0), ponto(200, 150), ponto(200, 300)]);
    expect(area(editavel.contorno)).toBeCloseTo(60000, 6);
  });

  it('recusa a quantidade que não serve e o trecho sem comprimento', () => {
    expect(() => tornarTrechoCurva(molde(), DE, ATE, 0, 'c2')).toThrow('inteiro de 1 a 20');
    expect(() => tornarTrechoCurva(molde(), DE, ATE, 21, 'c2')).toThrow('inteiro de 1 a 20');
    expect(() => tornarTrechoCurva(molde(), DE, ATE, 1.5, 'c2')).toThrow('inteiro de 1 a 20');
    expect(() => tornarTrechoCurva(molde(), DE, { indiceAresta: 1, ponto: ponto(200, 1) }, 1, 'c2')).toThrow('curto demais');
  });
});

describe('arcos tangentes e curva pré-definida registrados', () => {
  it('o canto arredondado fica registrado como arco, com o ponto do meio de passagem', () => {
    const redonda = arredondarCantoDoMolde(molde(), 1, 50, 'a1');

    expect(curvasDaPeca(redonda)).toHaveLength(1);
    const arco = aCurva(redonda);
    expect(arco.tipo).toBe('arco');
    expect(arco.controles[0]).toEqual(ponto(150, 0));
    expect(arco.controles[2]!.x).toBeCloseTo(200, 9);
    expect(arco.controles[2]!.y).toBeCloseTo(50, 9);
    // Todos os pontos do arco estão a 50 mm do centro (150, 50).
    for (const p of arco.pontos) expect(distancia(p, ponto(150, 50))).toBeCloseTo(50, 9);
    // Movido o ponto de passagem, é outro arco de círculo pelos três pontos.
    const movida = moverControle(redonda, 'a1', 1, ponto(190, 10));
    expect(aCurva(movida).pontos).toEqual(arcoPorTresPontos(arco.controles[0]!, ponto(190, 10), arco.controles[2]!));
  });

  it('sem o id, o canto arredondado não é registrado; e o arco de dois pontos não tem o que registrar', () => {
    expect('curvas' in arredondarCantoDoMolde(molde(), 1, 50)).toBe(false);
    expect('curvas' in comArcoRegistrado(molde(), [ponto(200, 0), ponto(200, 300)], 'a1')).toBe(false);
  });

  it('a curva pré-definida fica registrada pela forma e acompanha as pontas', () => {
    const forma = normalizarCurva(curvaPorPontos([ponto(0, 0), ponto(50, 30), ponto(100, 0)]));
    const linha = ajustarCurvaAosExtremos(forma, DE.ponto, ATE.ponto);
    const peca = comCurvaRegistrada(substituirTrechoDoMolde(molde(), DE, ATE, linha.slice(1, -1)), 'forma', [DE.ponto, ATE.ponto], linha, 'f1', {
      pontos: forma,
      espelhar: false,
    });

    expect(curvasDaPeca(peca)).toHaveLength(1);
    // Não tem pontos de passagem: não há anel para escolher, nem onde pôr um.
    expect(controlePerto(peca, linha[Math.floor(linha.length / 2)]!, 50)).toBeNull();
    expect(() => acrescentarControle(peca, 'f1', linha[3]!)).toThrow('pré-definida não tem pontos de passagem');

    const movida = moverPontoDoMolde(peca, 1, ponto(200, 60));
    expect(curvasDaPeca(movida)).toHaveLength(1);
    expect(aCurva(movida).pontos).toEqual(ajustarCurvaAosExtremos(forma, ponto(200, 60), ATE.ponto));
    for (const p of aCurva(movida).pontos) expect(movida.contorno).toContainEqual(p);
  });

  it('a forma sem os dados dela não fica registrada', () => {
    const linha = [DE.ponto, ponto(220, 150), ATE.ponto];
    expect('curvas' in comCurvaRegistrada(molde(), 'forma', [DE.ponto, ATE.ponto], linha, 'f1')).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { ponto, type Ponto2D } from '../core/geometria';
import { criarMolde, type Molde, type PenceDaPeca, type PregaDaPeca } from './molde';
import { giroEDeslocamento, levarOQueEstaNaRegiao } from './regioes';

// Retângulo de 200 × 300 mm. A metade de cima (y de 150 a 300) anda 50 mm para cima; a de baixo fica.
const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
const REGIAO = [ponto(0, 150), ponto(200, 150), ponto(200, 300), ponto(0, 300)];
const QUE_ANDA = [ponto(200, 150), ponto(200, 300), ponto(0, 300), ponto(0, 150)];
const QUE_FICA = [ponto(0, 150), ponto(0, 0), ponto(200, 0), ponto(200, 150)];
const PARA_CIMA = giroEDeslocamento(ponto(0, 0), 0, ponto(0, 50));

function molde(parte: Partial<Molde> = {}): Molde {
  const base = criarMolde({ nome: 'Frente', referencia: 'REF', tamanho: 'M', contorno: RETANGULO, linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 120) } }, 'm1');
  return { ...base, ...parte };
}

const levada = (peca: Molde): Molde => levarOQueEstaNaRegiao(peca, REGIAO, QUE_ANDA, QUE_FICA, PARA_CIMA);
const acima = (linha: readonly Ponto2D[]): Ponto2D[] => linha.map((p) => ponto(p.x, p.y + 50));

describe('as linhas internas andam com a região em que está a maior parte delas', () => {
  it('a linha de borda a borda, com as pontas em cima do contorno, anda com a região em que está', () => {
    // Na metade que anda: de um lado ao outro, do alto a um lado, de um canto para dentro. As pontas estão na divisa da região.
    const queAndam = [
      [ponto(0, 200), ponto(200, 200)],
      [ponto(200, 250), ponto(0, 250)],
      [ponto(100, 300), ponto(0, 220)],
      [ponto(100, 300), ponto(200, 220)],
      [ponto(200, 300), ponto(100, 220)],
      [ponto(0, 300), ponto(100, 220)],
    ];
    // Na metade que fica, do mesmo jeito.
    const queFicam = [
      [ponto(0, 100), ponto(200, 100)],
      [ponto(100, 0), ponto(200, 80)],
      [ponto(0, 0), ponto(100, 80)],
    ];
    const depois = levada(molde({ linhasInternas: [...queAndam, ...queFicam] }));

    expect(depois.linhasInternas).toEqual([...queAndam.map(acima), ...queFicam]);
  });

  it('a linha solta dentro da região anda; a de fora fica', () => {
    const depois = levada(molde({ linhasInternas: [[ponto(50, 180), ponto(60, 190)], [ponto(50, 80), ponto(60, 90)]] }));

    expect(depois.linhasInternas).toEqual([[ponto(50, 230), ponto(60, 240)], [ponto(50, 80), ponto(60, 90)]]);
  });

  it('a linha que atravessa a divisa vai inteira com o lado em que está a maior parte dos trechos; no empate, fica', () => {
    // Três trechos: um embaixo e dois em cima — anda. Dois embaixo e um em cima — fica, mesmo começando ou terminando em cima.
    const maisEmCima = [ponto(100, 100), ponto(100, 140), ponto(100, 200), ponto(100, 260)];
    const maisEmbaixo = [ponto(100, 260), ponto(100, 140), ponto(100, 60), ponto(100, 10)];
    const empatada = [ponto(100, 100), ponto(100, 140), ponto(100, 200)];
    const depois = levada(molde({ linhasInternas: [maisEmCima, maisEmbaixo, empatada] }));

    expect(depois.linhasInternas).toEqual([acima(maisEmCima), maisEmbaixo, empatada]);
  });

  it('a pence marcada, com as duas pontas no contorno, anda com a região em que está — o registro e a linha dela juntos', () => {
    const emCima: PenceDaPeca = { id: 'p1', tipo: 'marcada', pontos: [ponto(120, 300), ponto(100, 220), ponto(80, 300)] };
    const doLado: PenceDaPeca = { id: 'p2', tipo: 'marcada', pontos: [ponto(0, 260), ponto(60, 240), ponto(0, 220)] };
    const embaixo: PenceDaPeca = { id: 'p3', tipo: 'marcada', pontos: [ponto(120, 0), ponto(100, 80), ponto(80, 0)] };
    const depois = levada(molde({ linhasInternas: [emCima.pontos, doLado.pontos, embaixo.pontos], pences: [emCima, doLado, embaixo] }));

    expect(depois.pences!.map((q) => q.pontos)).toEqual([acima(emCima.pontos), acima(doLado.pontos), embaixo.pontos]);
    expect(depois.linhasInternas).toEqual(depois.pences!.map((q) => q.pontos));
  });

  it('as linhas de uma prega registrada andam do mesmo jeito que as linhas internas que elas são', () => {
    // Uma prega em pé na metade de cima, de borda a borda da região.
    const linhas = [[ponto(100, 300), ponto(100, 150)], [ponto(120, 300), ponto(120, 150)]];
    const prega: PregaDaPeca = { id: 'g1', modo: 'simples-direita', parada: [ponto(100, 300), ponto(100, 150)], movida: [ponto(120, 300), ponto(120, 150)], linhas, pontasCriadas: [true, true] };
    const depois = levada(molde({ linhasInternas: linhas, pregas: [prega] }));

    expect(depois.linhasInternas).toEqual(linhas.map(acima));
    expect(depois.pregas![0]!.linhas).toEqual(depois.linhasInternas);
  });
});

import { describe, it, expect } from 'vitest';
import { arcosDoContorno } from '../core/arcos';
import { arcoPorTresPontos, circulo } from '../core/curvas';
import { area, distancia, ponto, type Ponto2D } from '../core/geometria';
import { ancoraDoRotulo, cotaDeRaio, transformarCota, valorDaCotaDeRaio } from '../domain/cota';
import { criarMolde, type Molde } from '../domain/molde';
import {
  arredondarCanto,
  cotaDeRaioEm,
  ehFerramentaDeCanto,
  ferramentaDoCanto,
  nomeDaFerramentaDeCanto,
  recusaDoCanto,
} from './ferramentasDeArco';
import { linhaNovaDoTrecho, previaDoTrecho, SEM_TRECHO } from './ferramentasDeTrecho';

const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
// Retângulo com o lado de cima em arco (centro (100, 195), raio 145): o canto (200, 300) é o ponto 3.
const COM_ARCO = [ponto(0, 0), ponto(200, 0), ...arcoPorTresPontos(ponto(200, 300), ponto(100, 340), ponto(0, 300))];
const DE_BAIXO = arcoPorTresPontos(ponto(0, 0), ponto(100, -40), ponto(200, 0));
const LENTE = [...DE_BAIXO, ...arcoPorTresPontos(ponto(200, 0), ponto(100, 40), ponto(0, 0)).slice(1, -1)];
const CANTO_DA_LENTE = DE_BAIXO.length - 1;

function molde(contorno: readonly Ponto2D[]): Molde {
  return criarMolde(
    { nome: 'Frente', referencia: 'REF', tamanho: 'M', contorno, linhaDeFio: { inicio: ponto(50, 10), fim: ponto(150, 10) } },
    'f',
  );
}

describe('ferramentas de canto', () => {
  it('reconhece as três', () => {
    for (const modo of ['arco-tangente', 'arco-tangente-arco-reta', 'arco-tangente-2-arcos']) expect(ehFerramentaDeCanto(modo)).toBe(true);
    expect(ehFerramentaDeCanto('arco-tangente-a-elemento')).toBe(false);
    expect(nomeDaFerramentaDeCanto('arco-tangente-arco-reta')).toBe('Arco tangente a arco e reta');
  });

  it('cada canto tem a sua ferramenta: duas retas, arco e reta, ou dois arcos', () => {
    expect(ferramentaDoCanto(RETANGULO, 1)).toBe('arco-tangente');
    expect(ferramentaDoCanto(COM_ARCO, 2)).toBe('arco-tangente-arco-reta');
    expect(ferramentaDoCanto(LENTE, CANTO_DA_LENTE)).toBe('arco-tangente-2-arcos');
  });

  it('a ferramenta certa não é recusada; a errada diz qual usar', () => {
    expect(recusaDoCanto('arco-tangente', RETANGULO, 1)).toBeNull();
    expect(recusaDoCanto('arco-tangente-arco-reta', COM_ARCO, 2)).toBeNull();
    expect(recusaDoCanto('arco-tangente-2-arcos', LENTE, CANTO_DA_LENTE)).toBeNull();
    expect(recusaDoCanto('arco-tangente', COM_ARCO, 2)).toBe('Esse canto fica entre um arco e uma reta: use “Arco tangente a arco e reta”.');
    expect(recusaDoCanto('arco-tangente-2-arcos', RETANGULO, 1)).toBe('Esse canto fica entre duas retas: use “Arco tangente a 2 retas”.');
    expect(recusaDoCanto('arco-tangente-arco-reta', LENTE, CANTO_DA_LENTE)).toBe('Esse canto fica entre dois arcos: use “Arco tangente a 2 arcos”.');
  });

  it('um ponto no meio de um arco não é um canto', () => {
    expect(recusaDoCanto('arco-tangente-arco-reta', COM_ARCO, 6)).toBe('Esse ponto está no meio de um arco: não é um canto.');
    const inteiro = circulo(ponto(0, 0), ponto(100, 0));
    expect(recusaDoCanto('arco-tangente-2-arcos', inteiro, 3)).toBe('Esse ponto está no meio de um arco: não é um canto.');
  });
});

describe('arredondarCanto', () => {
  it('entre duas retas, é o arredondar de sempre', () => {
    const arredondada = arredondarCanto(molde(RETANGULO), 1, 50);
    // O canto de 50 × 50 vira um quarto de círculo de raio 50.
    expect(area(arredondada.contorno)).toBeGreaterThan(60000 - 2500);
    expect(area(arredondada.contorno)).toBeLessThan(60000 - 2500 + (Math.PI * 2500) / 4 + 1);
    expect(arcosDoContorno(arredondada.contorno)[0]!.raio).toBeCloseTo(50, 6);
  });

  it('entre um arco e uma reta, entra o arco de concordância exato', () => {
    const peca = molde(COM_ARCO);
    const arredondada = arredondarCanto(peca, 2, 20);
    const raios = arcosDoContorno(arredondada.contorno).map((a) => Math.round(a.raio * 100) / 100);
    expect(raios.sort((a, b) => a - b)).toEqual([20, 145]);
    expect(area(arredondada.contorno)).toBeLessThan(area(peca.contorno));
    expect(arredondada.contorno.some((p) => distancia(p, ponto(200, 300)) < 1e-6)).toBe(false);
  });

  it('entre dois arcos também, e os piques das arestas que saíram vão com elas', () => {
    const peca = { ...molde(LENTE), piques: [{ id: 'longe', posicao: DE_BAIXO[1]!, indiceAresta: 1 }] };
    const arredondada = arredondarCanto(peca, CANTO_DA_LENTE, 10);
    expect(arcosDoContorno(arredondada.contorno).map((a) => Math.round(a.raio))).toContain(10);
    expect(arredondada.piques.map((p) => p.id)).toEqual(['longe']);
  });

  it('recusa o raio que não cabe com um arco de um dos lados', () => {
    expect(() => arredondarCanto(molde(COM_ARCO), 2, 500)).toThrow(/não cabe/);
  });
});

describe('cota de raio', () => {
  it('num arco do contorno: do centro a um ponto do círculo, na direção do clique', () => {
    // Um clique sobre o arco de cima, perto do meio dele.
    const noArco = COM_ARCO[8]!;
    const cota = cotaDeRaioEm(COM_ARCO, { indiceAresta: 8, ponto: noArco }, 'c1')!;
    expect(cota.tipo).toBe('raio');
    expect(distancia(cota.centro, ponto(100, 195))).toBeLessThan(1e-6);
    expect(valorDaCotaDeRaio(cota)).toBeCloseTo(145, 6);
    expect(distancia(cota.noArco, noArco)).toBeLessThan(1e-6);
  });

  it('num clique sobre a corda de um trecho do arco, o ponto vai para o círculo', () => {
    const meioDaCorda = ponto((COM_ARCO[8]!.x + COM_ARCO[9]!.x) / 2, (COM_ARCO[8]!.y + COM_ARCO[9]!.y) / 2);
    const cota = cotaDeRaioEm(COM_ARCO, { indiceAresta: 8, ponto: meioDaCorda }, 'c1')!;
    expect(valorDaCotaDeRaio(cota)).toBeCloseTo(145, 6);
  });

  it('numa reta, não há cota; no canto entre a reta e o arco, vale o arco', () => {
    expect(cotaDeRaioEm(COM_ARCO, { indiceAresta: 0, ponto: ponto(100, 0) }, 'c1')).toBeNull();
    expect(cotaDeRaioEm(RETANGULO, { indiceAresta: 1, ponto: ponto(200, 0) }, 'c1')).toBeNull();
    expect(valorDaCotaDeRaio(cotaDeRaioEm(COM_ARCO, { indiceAresta: 2, ponto: ponto(200, 300) }, 'c1')!)).toBeCloseTo(145, 6);
    // No fim do arco, (0, 300), a aresta que sai é reta: vale o arco que chega.
    const fim = COM_ARCO.length - 1;
    expect(valorDaCotaDeRaio(cotaDeRaioEm(COM_ARCO, { indiceAresta: fim, ponto: COM_ARCO[fim]! }, 'c1')!)).toBeCloseTo(145, 6);
  });

  it('o número fica no meio do raio, e a cota acompanha a peça', () => {
    const cota = cotaDeRaio('c1', ponto(100, 100), ponto(200, 100));
    expect(ancoraDoRotulo(cota)).toEqual(ponto(150, 100));
    const movida = transformarCota(
      cota,
      (p) => ponto(p.x + 10, p.y * 2),
      (v) => v,
    );
    expect(movida).toEqual({ id: 'c1', tipo: 'raio', centro: ponto(110, 200), noArco: ponto(210, 200) });
    expect(() => cotaDeRaio('c1', ponto(1, 1), ponto(1, 1))).toThrow(/diferentes/);
  });
});

describe('arco tangente à reta ou arco, como ferramenta de trecho', () => {
  const inicio = { indiceAresta: 1, ponto: ponto(200, 150) };
  const fim = { indiceAresta: 2, ponto: ponto(100, 300) };

  it('a linha nova sai do começo dando continuidade ao elemento vizinho e chega ao fim', () => {
    const linha = linhaNovaDoTrecho('arco-tangente-a-elemento', RETANGULO, inicio, fim.ponto, [], {}, fim)!;
    expect(linha[0]).toEqual(ponto(200, 150));
    expect(linha.at(-1)).toEqual(ponto(100, 300));
    expect(linha.length).toBeGreaterThan(4);
    // Continua a lateral, que sobe: o primeiro passo é quase todo em y.
    expect(linha[1]!.y - 150).toBeGreaterThan(Math.abs(linha[1]!.x - 200));
  });

  it('sem o fim no contorno, ainda não há linha', () => {
    expect(linhaNovaDoTrecho('arco-tangente-a-elemento', RETANGULO, inicio, ponto(150, 200), [], {}, null)).toBeNull();
  });

  it('a prévia mostra o arco e o trecho que sai; com os dois pontos na mesma reta, o "arco" é a própria reta', () => {
    const comInicio = { ...SEM_TRECHO, inicio };
    const previa = previaDoTrecho('arco-tangente-a-elemento', RETANGULO, comInicio, { noContorno: fim, livre: fim.ponto });
    expect(previa.novo!.length).toBeGreaterThan(4);
    expect(previa.substituido).toEqual([ponto(200, 150), ponto(200, 300), ponto(100, 300)]);
    // O outro ponto na mesma lateral: o trecho trocado é o pedaço de reta entre os dois, e o arco tangente a ela é ela mesma.
    const naMesmaReta = { indiceAresta: 1, ponto: ponto(200, 50) };
    const reta = previaDoTrecho('arco-tangente-a-elemento', RETANGULO, comInicio, { noContorno: naMesmaReta, livre: naMesmaReta.ponto });
    expect(reta.novo).toEqual([ponto(200, 150), ponto(200, 50)]);
  });
});

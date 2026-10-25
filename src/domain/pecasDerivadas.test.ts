import { describe, expect, it } from 'vitest';
import { area, distancia, ponto, pontoDentroDoContorno, pontoMaisProximoNoContorno, retanguloEnvolvente, type Ponto2D } from '../core/geometria';
import { criarMolde, type Molde } from './molde';
import { aoLadoSemSobrepor, dividirPeloTrecho, entretelaDoMolde, pecaDerivada } from './pecasDerivadas';

/** Uma frente de 600 × 250 mm em pé (o x do mundo é a vertical, para baixo): o alto em x = 0, a barra em x = 600. */
function frente(margemDeCosturaMm = 10): Molde {
  return criarMolde(
    {
      nome: 'Frente',
      referencia: 'BLU',
      tamanho: 'M',
      contorno: [ponto(0, 0), ponto(0, 250), ponto(600, 250), ponto(600, 0)],
      linhaDeFio: { inicio: ponto(50, 125), fim: ponto(550, 125) },
      margemDeCosturaMm,
    },
    'f',
  );
}

const em = (indiceAresta: number, p: Ponto2D) => ({ indiceAresta, ponto: p });

describe('o forro, a entretela e a vista (ADR 0124)', () => {
  it('a vista do alto: a faixa de 60 mm ao longo dele, até os lados; o forro é o resto', () => {
    const { comOTrecho, semOTrecho } = dividirPeloTrecho(frente(), em(0, ponto(0, 0)), em(0, ponto(0, 250)), 60);
    expect(area(comOTrecho.contorno)).toBeCloseTo(60 * 250, 6);
    expect(area(semOTrecho.contorno)).toBeCloseTo(540 * 250, 6);
    expect(retanguloEnvolvente(comOTrecho.contorno)).toMatchObject({ minX: 0, maxX: 60, minY: 0, maxY: 250 });
  });

  it('a vista com uma largura em cada ponta: o trapézio; o trecho no meio do lado vai até os lados', () => {
    const { comOTrecho } = dividirPeloTrecho(frente(), em(0, ponto(0, 0)), em(0, ponto(0, 250)), 60, 30);
    expect(area(comOTrecho.contorno)).toBeCloseTo(((60 + 30) / 2) * 250, 6);
    // Só um pedaço do alto indicado: a paralela segue até os lados (a vista cobre o alto inteiro).
    const parcial = dividirPeloTrecho(frente(), em(0, ponto(0, 40)), em(0, ponto(0, 200)), 50).comOTrecho;
    expect(area(parcial.contorno)).toBeCloseTo(50 * 250, 6);
  });

  it('a vista do decote curvo: segue a curva para dentro, a largura pedida em toda ela', () => {
    // O alto com um decote: de (0, 60) desce até (80, 125) e sobe a (0, 190).
    const decote = [ponto(0, 60), ponto(30, 75), ponto(60, 100), ponto(80, 125), ponto(60, 150), ponto(30, 175), ponto(0, 190)];
    const peca = criarMolde(
      { nome: 'Frente', referencia: '', tamanho: 'M', contorno: [ponto(0, 0), ...decote, ponto(0, 250), ponto(600, 250), ponto(600, 0)], linhaDeFio: { inicio: ponto(150, 125), fim: ponto(550, 125) } },
      'f',
    );
    // Do começo ao fim do decote (os vértices 1 e 7).
    const vista = dividirPeloTrecho(peca, em(1, decote[0]!), em(7, decote[6]!), 40).comOTrecho;
    // A vista contém o decote; no fundo do V a paralela fica a 40 mm de cada lado dele (em esquadria): o bico desce
    // 40 · √(20² + 25²) / 25 abaixo do fundo do decote.
    for (const p of decote) expect(vista.contorno.some((q) => distancia(p, q) < 1e-6)).toBe(true);
    expect(Math.max(...vista.contorno.map((p) => p.x))).toBeCloseTo(80 + (40 * Math.hypot(20, 25)) / 25, 6);
    // E fica toda dentro da peça (ou em cima do contorno dela).
    expect(vista.contorno.every((p) => pontoDentroDoContorno(p, peca.contorno) || distancia(p, pontoMaisProximoNoContorno(p, peca.contorno).ponto) < 1e-6)).toBe(true);
  });

  it('o forro encurtado na barra: a peça 20 mm mais curta, com a costura', () => {
    const { semOTrecho } = dividirPeloTrecho(frente(), em(2, ponto(600, 250)), em(2, ponto(600, 0)), 20);
    expect(retanguloEnvolvente(semOTrecho.contorno)).toMatchObject({ minX: 0, maxX: 580 });
    expect(semOTrecho.margemDeCosturaMm).toBe(10);
  });

  it('a entretela: a peça recuada 2 mm em volta, sem costura, no grupo "Entretela"', () => {
    const e = entretelaDoMolde(frente(), 2, 'e');
    expect(retanguloEnvolvente(e.contorno)).toMatchObject({ minX: 2, maxX: 598, minY: 2, maxY: 248 });
    expect(e).toMatchObject({ margemDeCosturaMm: 0, grupoDoEncaixe: 'Entretela', piques: [], linhasInternas: [] });
    expect(() => entretelaDoMolde(frente(), 200, 'e')).toThrow(/recuo é grande demais/);
  });

  it('a peça pronta: o nome, o grupo (o forro e a entretela em outro tecido) e posta ao lado da principal', () => {
    const principal = frente();
    const vista = pecaDerivada(principal, { tipo: 'vista', larguraMm: 60, recuoMm: 0 }, { a: em(0, ponto(0, 0)), b: em(0, ponto(0, 250)) }, 'v');
    expect(vista).toMatchObject({ id: 'v', nome: 'Vista de Frente' });
    expect(vista.grupoDoEncaixe).toBeUndefined();
    expect(retanguloEnvolvente(vista.contorno)).toMatchObject({ minX: 0, minY: 290 });
    const forro = pecaDerivada(principal, { tipo: 'forro', larguraMm: 20, recuoMm: 0 }, { a: em(2, ponto(600, 250)), b: em(2, ponto(600, 0)) }, 'fo');
    expect(forro).toMatchObject({ nome: 'Forro de Frente', grupoDoEncaixe: 'Forro' });
    expect(pecaDerivada(principal, { tipo: 'entretela', larguraMm: 0, recuoMm: 3 }, null, 'en')).toMatchObject({ nome: 'Entretela de Frente', grupoDoEncaixe: 'Entretela' });
  });

  it('a segunda peça tirada da mesma vai para depois da primeira, sem ficar em cima dela', () => {
    const principal = frente();
    const vista = pecaDerivada(principal, { tipo: 'vista', larguraMm: 60, recuoMm: 0 }, { a: em(0, ponto(0, 0)), b: em(0, ponto(0, 250)) }, 'v');
    const entretela = aoLadoSemSobrepor(pecaDerivada(principal, { tipo: 'entretela', larguraMm: 0, recuoMm: 2 }, null, 'e'), [principal, vista]);
    // A vista vai de y = 290 a 540; a entretela começa 40 mm depois dela.
    expect(retanguloEnvolvente(entretela.contorno).minY).toBeCloseTo(540 + 40, 6);
    // Sem nada no caminho, fica onde estava.
    expect(aoLadoSemSobrepor(vista, [principal])).toBe(vista);
  });

  it('o que não dá: a largura que passa da peça, o mesmo ponto duas vezes, a vista sem o trecho', () => {
    expect(() => dividirPeloTrecho(frente(), em(1, ponto(0, 250)), em(1, ponto(600, 250)), 300)).toThrow(/A largura passa da peça/);
    expect(() => dividirPeloTrecho(frente(), em(0, ponto(0, 100)), em(0, ponto(0, 100)), 30)).toThrow(/dois pontos diferentes/);
    expect(() => pecaDerivada(frente(), { tipo: 'vista', larguraMm: 60, recuoMm: 0 }, null, 'v')).toThrow(/Indique o trecho da vista/);
    expect(() => pecaDerivada(frente(), { tipo: 'vista', larguraMm: 0, recuoMm: 0 }, null, 'v')).toThrow(/largura da vista precisa ser maior/);
  });
});

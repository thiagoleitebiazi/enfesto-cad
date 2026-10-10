import { describe, it, expect } from 'vitest';
import { andarNoContorno, ponto } from './geometria';

// Retângulo de 200 × 300 mm (perímetro 1000): arestas 0 (y = 0), 1 (x = 200), 2 (y = 300) e 3 (x = 0).
const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];

describe('andarNoContorno', () => {
  it('anda para a frente na mesma aresta', () => {
    expect(andarNoContorno(RETANGULO, { indiceAresta: 0, ponto: ponto(50, 0) }, 30)).toEqual({ indiceAresta: 0, ponto: ponto(80, 0) });
  });

  it('anda para trás na mesma aresta', () => {
    expect(andarNoContorno(RETANGULO, { indiceAresta: 0, ponto: ponto(50, 0) }, -30)).toEqual({ indiceAresta: 0, ponto: ponto(20, 0) });
  });

  it('passa pelos vértices, para a frente e para trás', () => {
    // De (150, 0): 50 até o canto (200, 0) e mais 70 pela aresta 1.
    expect(andarNoContorno(RETANGULO, { indiceAresta: 0, ponto: ponto(150, 0) }, 120)).toEqual({ indiceAresta: 1, ponto: ponto(200, 70) });
    // De (50, 0): 50 até o canto (0, 0) e mais 70 pela aresta 3, de trás para a frente.
    expect(andarNoContorno(RETANGULO, { indiceAresta: 0, ponto: ponto(50, 0) }, -120)).toEqual({ indiceAresta: 3, ponto: ponto(0, 70) });
  });

  it('dá a volta pelo fim da numeração', () => {
    expect(andarNoContorno(RETANGULO, { indiceAresta: 3, ponto: ponto(0, 100) }, 150)).toEqual({ indiceAresta: 0, ponto: ponto(50, 0) });
  });

  it('quando cai num vértice, devolve o vértice (a aresta que começa nele)', () => {
    expect(andarNoContorno(RETANGULO, { indiceAresta: 0, ponto: ponto(150, 0) }, 50)).toEqual({ indiceAresta: 1, ponto: ponto(200, 0) });
    expect(andarNoContorno(RETANGULO, { indiceAresta: 0, ponto: ponto(50, 0) }, -50)).toEqual({ indiceAresta: 0, ponto: ponto(0, 0) });
    expect(andarNoContorno(RETANGULO, { indiceAresta: 1, ponto: ponto(200, 100) }, -100)).toEqual({ indiceAresta: 1, ponto: ponto(200, 0) });
  });

  it('parte de um vértice para os dois lados', () => {
    const canto = { indiceAresta: 1, ponto: ponto(200, 0) };
    expect(andarNoContorno(RETANGULO, canto, 40)).toEqual({ indiceAresta: 1, ponto: ponto(200, 40) });
    expect(andarNoContorno(RETANGULO, canto, -40)).toEqual({ indiceAresta: 0, ponto: ponto(160, 0) });
  });

  it('distância zero devolve a própria posição', () => {
    expect(andarNoContorno(RETANGULO, { indiceAresta: 2, ponto: ponto(120, 300) }, 0)).toEqual({ indiceAresta: 2, ponto: ponto(120, 300) });
  });

  it('recusa distância do tamanho do perímetro ou maior, e posição fora do contorno', () => {
    const p = { indiceAresta: 0, ponto: ponto(50, 0) };
    expect(() => andarNoContorno(RETANGULO, p, 1000)).toThrow('Distância maior que o perímetro do contorno.');
    expect(() => andarNoContorno(RETANGULO, p, -1500)).toThrow('Distância maior que o perímetro do contorno.');
    expect(() => andarNoContorno(RETANGULO, p, Number.NaN)).toThrow('Distância maior que o perímetro do contorno.');
    expect(() => andarNoContorno(RETANGULO, { indiceAresta: 7, ponto: ponto(0, 0) }, 10)).toThrow('Posição fora do contorno.');
  });
});

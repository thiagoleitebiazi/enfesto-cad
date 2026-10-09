import { describe, it, expect } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde } from '../domain/molde';
import { capturarComIma, pontosDeCapturaDasPecas } from './ima';

describe('capturarComIma', () => {
  const vertices = [ponto(0, 0), ponto(100, 0), ponto(100, 50)];

  it('prende no vértice dentro do raio, mesmo com a grade visível', () => {
    expect(capturarComIma(ponto(97, 3), vertices, 5, 10)).toEqual({ ponto: ponto(100, 0), tipo: 'vertice' });
  });

  it('com dois vértices dentro do raio, fica com o mais próximo', () => {
    expect(capturarComIma(ponto(100, 4), [ponto(100, 0), ponto(100, 5)], 10, null).ponto).toEqual(ponto(100, 5));
  });

  it('longe de qualquer vértice, vai para o ponto da grade mais próximo', () => {
    expect(capturarComIma(ponto(43, 17), vertices, 5, 10)).toEqual({ ponto: ponto(40, 20), tipo: 'grade' });
  });

  it('sem grade e sem vértice perto, devolve o próprio ponto', () => {
    const livre = ponto(43.2, 17.9);
    expect(capturarComIma(livre, vertices, 5, null)).toEqual({ ponto: livre, tipo: null });
  });

  it('nunca devolve -0 ao arredondar para a grade', () => {
    const capturado = capturarComIma(ponto(-1, -2), [], 1, 10);
    expect(Object.is(capturado.ponto.x, 0)).toBe(true);
    expect(Object.is(capturado.ponto.y, 0)).toBe(true);
  });
});

describe('pontosDeCapturaDasPecas', () => {
  it('lista os vértices do contorno, dos furos e das linhas internas', () => {
    const molde = criarMolde(
      {
        nome: 'Frente',
        referencia: '',
        tamanho: 'M',
        contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)],
        furos: [[ponto(20, 20), ponto(40, 20), ponto(40, 40)]],
        linhasInternas: [[ponto(10, 150), ponto(190, 150)]],
        linhaDeFio: { inicio: ponto(100, 50), fim: ponto(100, 250) },
      },
      'm1',
    );
    expect([...pontosDeCapturaDasPecas([molde])]).toEqual([
      ponto(0, 0),
      ponto(200, 0),
      ponto(200, 300),
      ponto(0, 300),
      ponto(20, 20),
      ponto(40, 20),
      ponto(40, 40),
      ponto(10, 150),
      ponto(190, 150),
    ]);
  });
});

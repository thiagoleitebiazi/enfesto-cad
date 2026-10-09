import { describe, it, expect } from 'vitest';
import { comprimentoDaLinha, ponto, type PosicaoNoContorno } from '../core/geometria';
import { normalizarCurva } from '../core/curvas';
import {
  caminhoDoTrecho,
  cliqueDeTrecho,
  comprimentoDoTrecho,
  linhaNovaDoTrecho,
  pontosDoTrecho,
  previaDoTrecho,
  SEM_TRECHO,
  trechoCompleto,
  type CliqueDeTrecho,
  type FerramentaDeTrecho,
  type TrechoEmEdicao,
} from './ferramentasDeTrecho';

// Arestas: 0 de (0,0) a (200,0); 1 até (200,300); 2 até (0,300); 3 fecha em (0,0).
const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];
const vertice = (i: number): PosicaoNoContorno => ({ indiceAresta: i, ponto: RETANGULO[i]! });
const noContorno = (i: number): CliqueDeTrecho => ({ noContorno: vertice(i), livre: RETANGULO[i]! });
const livre = (x: number, y: number): CliqueDeTrecho => ({ noContorno: null, livre: ponto(x, y) });

function clicar(ferramenta: FerramentaDeTrecho, cliques: readonly CliqueDeTrecho[]): TrechoEmEdicao {
  return cliques.reduce((estado, clique) => cliqueDeTrecho(ferramenta, estado, clique), SEM_TRECHO);
}

describe('cliqueDeTrecho', () => {
  it('o primeiro clique tem de ser no contorno', () => {
    expect(clicar('curva', [livre(50, 50)])).toBe(SEM_TRECHO);
    expect(clicar('curva', [noContorno(1)]).inicio).toEqual(vertice(1));
  });

  it('curva: extremo, pontos de passagem e, por fim, o outro extremo', () => {
    const estado = clicar('curva', [noContorno(1), livre(240, 100), livre(240, 200), noContorno(2)]);
    expect(estado).toEqual({ inicio: vertice(1), fim: vertice(2), livres: [ponto(240, 100), ponto(240, 200)] });
    expect(trechoCompleto('curva', estado)).toBe(true);
  });

  it('curva: um clique no contorno antes de qualquer ponto de passagem não termina', () => {
    const estado = clicar('curva', [noContorno(1), noContorno(2)]);
    expect(estado.fim).toBeNull();
    expect(trechoCompleto('curva', estado)).toBe(false);
  });

  it('arco por 3 pontos: extremo, o ponto do arco e o outro extremo; outro clique livre troca o ponto do arco', () => {
    const estado = clicar('arco-3-pontos', [noContorno(1), livre(230, 150), livre(260, 150), noContorno(2)]);
    expect(estado).toEqual({ inicio: vertice(1), fim: vertice(2), livres: [ponto(260, 150)] });
    expect(trechoCompleto('arco-3-pontos', estado)).toBe(true);
  });

  it('arco por 2 pontos: os dois extremos primeiro, depois o ponto do arco', () => {
    const semArco = clicar('arco-2-pontos', [noContorno(1), livre(230, 150), noContorno(2)]);
    expect(semArco).toEqual({ inicio: vertice(1), fim: vertice(2), livres: [] });
    expect(trechoCompleto('arco-2-pontos', semArco)).toBe(false);

    const completo = cliqueDeTrecho('arco-2-pontos', semArco, livre(260, 150));
    expect(completo.livres).toEqual([ponto(260, 150)]);
    expect(trechoCompleto('arco-2-pontos', completo)).toBe(true);
  });

  it.each(['editar-pontos-de-curva', 'cadastrar-curva', 'curva-predefinida'] as const)(
    '%s: só os dois extremos; cliques fora do contorno não contam',
    (ferramenta) => {
      const estado = clicar(ferramenta, [noContorno(1), livre(240, 150), noContorno(2)]);
      expect(estado).toEqual({ inicio: vertice(1), fim: vertice(2), livres: [] });
      expect(trechoCompleto(ferramenta, estado)).toBe(true);
    },
  );

  it('o segundo extremo não pode ser o mesmo ponto do primeiro', () => {
    expect(clicar('cadastrar-curva', [noContorno(1), noContorno(1)]).fim).toBeNull();
  });

  it('com o trecho completo, mais cliques não mudam nada', () => {
    const completo = clicar('cadastrar-curva', [noContorno(1), noContorno(2)]);
    expect(cliqueDeTrecho('cadastrar-curva', completo, noContorno(3))).toBe(completo);
  });
});

describe('caminhoDoTrecho', () => {
  it('é o caminho mais curto, na ordem do primeiro ponto para o segundo', () => {
    expect(caminhoDoTrecho(RETANGULO, vertice(1), vertice(2))).toEqual([ponto(200, 0), ponto(200, 300)]);
    expect(caminhoDoTrecho(RETANGULO, vertice(2), vertice(1))).toEqual([ponto(200, 300), ponto(200, 0)]);
    // Do ponto 1 ao ponto 4: pela aresta que fecha o contorno, não pela volta.
    expect(caminhoDoTrecho(RETANGULO, vertice(0), vertice(3))).toEqual([ponto(0, 0), ponto(0, 300)]);
  });

  it('conta os pontos e o comprimento do trecho', () => {
    expect(pontosDoTrecho(RETANGULO, vertice(0), vertice(2))).toBe(3);
    expect(comprimentoDoTrecho(RETANGULO, vertice(0), vertice(2))).toBe(500);
  });
});

describe('linhaNovaDoTrecho', () => {
  it('curva: passa pelos pontos de passagem, do início ao fim', () => {
    const linha = linhaNovaDoTrecho('curva', RETANGULO, vertice(1), ponto(200, 300), [ponto(250, 150)])!;
    expect(linha[0]).toEqual(ponto(200, 0));
    expect(linha.at(-1)).toEqual(ponto(200, 300));
    expect(linha.some((p) => p.x === 250 && p.y === 150)).toBe(true);
    expect(linhaNovaDoTrecho('curva', RETANGULO, vertice(1), ponto(200, 300), [])).toBeNull();
  });

  it('arcos: o arco de círculo pelos três pontos', () => {
    const linha = linhaNovaDoTrecho('arco-3-pontos', RETANGULO, vertice(1), ponto(200, 300), [ponto(350, 150)])!;
    // Meio círculo de raio 150 com centro em (200,150).
    for (const p of linha) expect(Math.hypot(p.x - 200, p.y - 150)).toBeCloseTo(150, 6);
    expect(comprimentoDaLinha(linha)).toBeCloseTo(Math.PI * 150, 0);
  });

  it('pré-definida: a forma escolhida esticada entre os dois extremos, ou espelhada', () => {
    const forma = normalizarCurva([ponto(0, 0), ponto(50, 20), ponto(100, 0)]);
    const normal = linhaNovaDoTrecho('curva-predefinida', RETANGULO, vertice(1), ponto(200, 300), [], { forma })!;
    const espelhada = linhaNovaDoTrecho('curva-predefinida', RETANGULO, vertice(1), ponto(200, 300), [], { forma, espelhar: true })!;
    expect(normal[0]).toEqual(ponto(200, 0));
    expect(normal.at(-1)).toEqual(ponto(200, 300));
    // A corda é 3 vezes maior que a da forma: a flecha de 20 vira 60, para um lado ou para o outro.
    expect(Math.abs(normal[1]!.x - 200)).toBeCloseTo(60, 9);
    expect(espelhada[1]!.x - 200).toBeCloseTo(-(normal[1]!.x - 200), 9);
    expect(linhaNovaDoTrecho('curva-predefinida', RETANGULO, vertice(1), ponto(200, 300), [])).toBeNull();
  });

  it('editar pontos: o mesmo trecho com a quantidade de pontos pedida', () => {
    const linha = linhaNovaDoTrecho('editar-pontos-de-curva', RETANGULO, vertice(0), ponto(200, 300), [], { quantidadeDePontos: 6 }, vertice(2))!;
    expect(linha).toHaveLength(6);
    expect(linha[0]).toEqual(ponto(0, 0));
    expect(linha.at(-1)).toEqual(ponto(200, 300));
    expect(linha[1]).toEqual(ponto(100, 0));
  });

  it('cadastrar: devolve o próprio caminho', () => {
    expect(linhaNovaDoTrecho('cadastrar-curva', RETANGULO, vertice(0), ponto(200, 300), [], {}, vertice(2))).toEqual([
      ponto(0, 0),
      ponto(200, 0),
      ponto(200, 300),
    ]);
  });
});

describe('previaDoTrecho', () => {
  it('sem nenhum clique, não há o que mostrar', () => {
    expect(previaDoTrecho('curva', RETANGULO, SEM_TRECHO, livre(50, 50))).toEqual({ novo: null, substituido: null, marcas: [] });
  });

  it('curva: com um ponto de passagem, mostra a curva até o mouse; sobre o contorno, também o trecho que sai', () => {
    const estado = clicar('curva', [noContorno(1), livre(250, 150)]);

    const noAr = previaDoTrecho('curva', RETANGULO, estado, livre(260, 280));
    expect(noAr.marcas).toEqual([ponto(200, 0)]);
    expect(noAr.substituido).toBeNull();
    expect(noAr.novo!.at(-1)).toEqual(ponto(260, 280));

    const sobreOContorno = previaDoTrecho('curva', RETANGULO, estado, noContorno(2));
    expect(sobreOContorno.substituido).toEqual([ponto(200, 0), ponto(200, 300)]);
    expect(sobreOContorno.novo!.at(-1)).toEqual(ponto(200, 300));
  });

  it('arco por 2 pontos: com os extremos postos, o mouse é o ponto do arco', () => {
    const estado = clicar('arco-2-pontos', [noContorno(1), noContorno(2)]);
    const previa = previaDoTrecho('arco-2-pontos', RETANGULO, estado, livre(350, 150));
    expect(previa.marcas).toEqual([ponto(200, 0), ponto(200, 300)]);
    expect(previa.substituido).toEqual([ponto(200, 0), ponto(200, 300)]);
    // Meio círculo de raio 150 com centro em (200,150), passando por onde o mouse está.
    for (const p of previa.novo!) expect(Math.hypot(p.x - 200, p.y - 150)).toBeCloseTo(150, 6);
    expect(Math.max(...previa.novo!.map((p) => p.x))).toBeGreaterThan(349.9);
  });

  it('pré-definida: com o mouse no contorno, mostra a curva escolhida entre os dois pontos', () => {
    const forma = normalizarCurva([ponto(0, 0), ponto(50, 20), ponto(100, 0)]);
    const estado = clicar('curva-predefinida', [noContorno(1)]);
    const previa = previaDoTrecho('curva-predefinida', RETANGULO, estado, noContorno(2), { forma });
    expect(previa.novo).toHaveLength(3);
    expect(previa.substituido).toEqual([ponto(200, 0), ponto(200, 300)]);
    expect(previaDoTrecho('curva-predefinida', RETANGULO, estado, livre(300, 300), { forma }).novo).not.toBeNull();
  });

  it('cadastrar e editar pontos: só indicam o trecho, sem linha nova', () => {
    const estado = clicar('cadastrar-curva', [noContorno(0)]);
    const previa = previaDoTrecho('cadastrar-curva', RETANGULO, estado, noContorno(2));
    expect(previa.novo).toBeNull();
    expect(previa.substituido).toEqual([ponto(0, 0), ponto(200, 0), ponto(200, 300)]);
  });
});

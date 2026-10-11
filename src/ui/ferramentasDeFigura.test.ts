import { describe, it, expect } from 'vitest';
import { circulo, espiral } from '../core/curvas';
import { distancia, ponto } from '../core/geometria';
import { comFiguraRegistrada, figuraDaEspiral, figuraDaPeca, figuraDoCirculo } from '../domain/figuras';
import { criarMolde, dimensionarMolde, type Molde } from '../domain/molde';
import { aplicarDialogoDaFigura, avisoDasFiguras, centrosDasFiguras, dialogoDaFigura, figuraSobOClique } from './ferramentasDeFigura';

const CENTRO = ponto(300, 200);

function tampa(id = 'c1', centro = CENTRO): Molde {
  const naBorda = ponto(centro.x + 50, centro.y);
  const peca = criarMolde(
    { nome: 'Tampa', referencia: 'REF', tamanho: 'M', contorno: circulo(centro, naBorda), linhaDeFio: { inicio: ponto(centro.x, centro.y - 20), fim: ponto(centro.x, centro.y + 20) } },
    id,
  );
  return comFiguraRegistrada(peca, figuraDoCirculo(centro, naBorda));
}

function babado(): Molde {
  const centro = ponto(900, 200);
  const peca = criarMolde(
    { nome: 'Babado', referencia: 'REF', tamanho: 'M', contorno: espiral(centro, 60, 1000), linhaDeFio: { inicio: ponto(970, 200), fim: ponto(1010, 200) } },
    'e1',
  );
  return comFiguraRegistrada(peca, figuraDaEspiral(centro, 60, 1000));
}

const quadrado = (): Molde =>
  criarMolde(
    { nome: 'Q', referencia: 'R', tamanho: 'M', contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 100), ponto(0, 100)], linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 80) } },
    'q',
  );

describe('achar a figura já feita', () => {
  const pecas = (): Molde[] => [quadrado(), tampa(), babado(), tampa('c2', ponto(320, 200))];

  it('os centros das figuras de cada tipo são onde se clica', () => {
    expect(centrosDasFiguras(pecas(), 'circulo')).toEqual([CENTRO, ponto(320, 200)]);
    expect(centrosDasFiguras(pecas(), 'espiral')).toEqual([ponto(900, 200)]);
    expect(centrosDasFiguras([quadrado()], 'circulo')).toEqual([]);
    // A peça que deixou de ser a figura (foi dimensionada) não conta.
    expect(centrosDasFiguras([dimensionarMolde(tampa(), 2, 1)], 'circulo')).toEqual([]);
  });

  it('o clique perto do centro acha a peça — a de centro mais próximo, e só do tipo da ferramenta', () => {
    expect(figuraSobOClique(pecas(), ponto(303, 201), 6, 'circulo')!.id).toBe('c1');
    // Entre dois centros ao alcance, vale o mais perto.
    expect(figuraSobOClique(pecas(), ponto(312, 200), 15, 'circulo')!.id).toBe('c2');
    expect(figuraSobOClique(pecas(), ponto(340, 240), 6, 'circulo')).toBeNull();
    expect(figuraSobOClique(pecas(), ponto(900, 200), 6, 'circulo')).toBeNull();
    expect(figuraSobOClique(pecas(), ponto(900, 200), 6, 'espiral')!.id).toBe('e1');
  });

  it('a instrução só fala das figuras já feitas quando há alguma do tipo', () => {
    expect(avisoDasFiguras([quadrado()], 'circulo')).toBe('');
    expect(avisoDasFiguras([babado()], 'circulo')).toBe('');
    expect(avisoDasFiguras(pecas(), 'circulo')).toBe(' Ou clique no centro de um círculo já feito (o anel) para mudar o raio dele.');
    expect(avisoDasFiguras(pecas(), 'espiral')).toBe(' Ou clique no centro de uma espiral já feita (o anel) para mudar a largura e o perímetro dela.');
  });
});

describe('o diálogo das medidas', () => {
  it('o do círculo abre com o raio de agora e refaz o círculo com o raio pedido', () => {
    const dialogo = dialogoDaFigura(tampa())!;
    expect(dialogo.titulo).toBe('Círculo: medidas');
    expect(dialogo.campos.map((c) => [c.id, c.inicial])).toEqual([['raio', '50']]);
    expect(dialogo.nota).toMatch(/no mesmo centro/);

    const peca = tampa();
    const feito = aplicarDialogoDaFigura([quadrado(), peca], peca, { raio: 80 });
    const nova = feito.pecas[1]!;
    for (const p of nova.contorno) expect(distancia(p, CENTRO)).toBeCloseTo(80, 9);
    expect(feito.pecas[0]).toEqual(quadrado());
    // π × 50² e π × 80², pelo polígono de lados retos que representa o círculo.
    expect(feito.recado).toMatch(/^Círculo “Tampa” refeito: o raio passou de 50,0 mm para 80,0 mm\. A peça passou de 78,\d cm² para 20\d,\d cm²\.$/);
  });

  it('o da espiral abre com a largura e o perímetro de agora e refaz a espiral', () => {
    const dialogo = dialogoDaFigura(babado())!;
    expect(dialogo.titulo).toBe('Espiral: medidas');
    expect(dialogo.campos.map((c) => [c.id, c.inicial])).toEqual([
      ['largura', '60'],
      ['perimetro', '1000'],
    ]);

    const peca = babado();
    const feito = aplicarDialogoDaFigura([peca], peca, { largura: 40, perimetro: 600 });
    expect(figuraDaPeca(feito.pecas[0]!)).toMatchObject({ tipo: 'espiral', larguraMm: 40, perimetroMm: 600 });
    expect(feito.recado).toMatch(/^Espiral “Babado” refeita: largura de 40,0 mm e perímetro de 600,0 mm \(eram 60,0 mm e 1000,0 mm\)\. A peça passou de /);
  });

  it('a peça que já não é a figura não tem diálogo, e as medidas que não servem são recusadas', () => {
    expect(dialogoDaFigura(quadrado())).toBeNull();
    expect(dialogoDaFigura(dimensionarMolde(tampa(), 2, 1))).toBeNull();
    // O círculo dimensionado por igual continua tendo a janela, com o raio novo.
    expect(dialogoDaFigura(dimensionarMolde(tampa(), 2, 2))!.campos.map((c) => [c.id, c.inicial])).toEqual([['raio', '100']]);
    expect(() => aplicarDialogoDaFigura([quadrado()], quadrado(), { raio: 50 })).toThrow(/já não pode ser mudada pelas medidas/);
    expect(() => aplicarDialogoDaFigura([tampa()], tampa(), { raio: 0 })).toThrow(/raio precisa ser maior que zero/);
    expect(() => aplicarDialogoDaFigura([babado()], babado(), { largura: 0, perimetro: 600 })).toThrow(/largura da espiral/);
  });
});

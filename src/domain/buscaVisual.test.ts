import { describe, expect, it } from 'vitest';
import type { ImagemDePixels } from './digitalizacao';
import { assinaturaDaImagem, maisParecidos, semelhanca } from './buscaVisual';

/** Uma imagem `largura` × `altura` pintada por `cor(x, y)` (RGB, opaca). */
function imagem(largura: number, altura: number, cor: (x: number, y: number) => readonly [number, number, number]): ImagemDePixels {
  const dados = new Uint8ClampedArray(largura * altura * 4);
  for (let y = 0; y < altura; y++)
    for (let x = 0; x < largura; x++) {
      const [r, g, b] = cor(x, y);
      dados.set([r, g, b, 255], (y * largura + x) * 4);
    }
  return { largura, altura, dados };
}

// Um vestido azul (um trapézio) no fundo branco, em dois tamanhos; uma camiseta vermelha (um T); um degradê cinza.
const vestido = (escala: number) =>
  imagem(90 * escala, 80 * escala, (x, y) => {
    const meia = 10 * escala + (y / (80 * escala)) * 30 * escala;
    return Math.abs(x - 45 * escala) < meia ? [30, 60, 200] : [255, 255, 255];
  });
const camiseta = imagem(90, 80, (x, y) => ((y < 25 && x > 5 && x < 85) || (x > 30 && x < 60) ? [200, 30, 30] : [255, 255, 255]));
const degrade = imagem(90, 80, (x) => [x * 2, x * 2, x * 2]);

describe('a busca por imagem (ADR 0145)', () => {
  it('a assinatura: 64 bits de forma e 64 faixas de cor que somam 1, sem o fundo branco', () => {
    const a = assinaturaDaImagem(vestido(1));
    expect(a.forma).toHaveLength(64);
    expect(a.forma.every((b) => b === 0 || b === 1)).toBe(true);
    expect(a.cores.reduce((s, c) => s + c, 0)).toBeCloseTo(1);
    // Todo o azul cai numa faixa só.
    expect(Math.max(...a.cores)).toBeCloseTo(1);
    // Só fundo: todas zero.
    expect(assinaturaDaImagem(imagem(10, 10, () => [255, 255, 255])).cores.every((c) => c === 0)).toBe(true);
  });

  it('a mesma peça em outro tamanho é quase igual; outra peça, de outra cor, fica longe', () => {
    const grande = assinaturaDaImagem(vestido(3));
    const pequeno = assinaturaDaImagem(vestido(1));
    expect(semelhanca(pequeno, pequeno)).toBe(1);
    expect(semelhanca(grande, pequeno)).toBeGreaterThan(0.9);
    expect(semelhanca(pequeno, assinaturaDaImagem(camiseta))).toBeLessThan(0.6);
  });

  it('os mais parecidos primeiro; cada candidato vale pela melhor imagem; os sem imagem ficam de fora', () => {
    const candidatos = [
      { id: 'cinza', assinaturas: [assinaturaDaImagem(degrade)] },
      { id: 'vazio', assinaturas: [] },
      { id: 'vestido', assinaturas: [assinaturaDaImagem(camiseta), assinaturaDaImagem(vestido(2))] },
      { id: 'camiseta', assinaturas: [assinaturaDaImagem(camiseta)] },
    ];
    const r = maisParecidos(assinaturaDaImagem(vestido(1)), candidatos);
    expect(r.map((x) => x.candidato.id)).toEqual(['vestido', 'camiseta', 'cinza']);
    expect(r[0]!.semelhanca).toBeGreaterThan(0.9);
  });
});

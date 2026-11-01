import { describe, expect, it } from 'vitest';
import { retanguloEnvolvente } from '../core/geometria';
import { corpoDoManequim, malhaDoCorpo, MEDIDAS_DO_PUBLICO, perimetroDaElipse, secaoNaAltura, type Ponto3D } from './manequim';
import { caminhoNaElipse, pontoNoTronco, preMoldeDoDesenho } from './desenhoNoCorpo';
import { cameraDeFrente, pontoDoCorpoNaTela, projecao } from '../ui/cena3d';

const corpo = corpoDoManequim(MEDIDAS_DO_PUBLICO.feminino);

/** O ponto do tronco na altura y, no ângulo dado (0: o meio da frente; positivo: o lado esquerdo do corpo, em +x). */
function noTronco(y: number, angulo: number): Ponto3D {
  const s = secaoNaAltura(corpo, y)!;
  return { x: s.a * Math.sin(angulo), y, z: s.b * Math.cos(angulo) };
}

describe('o desenho no corpo vira o pré-molde (ADR 0134)', () => {
  it('o caminho na elipse: meia volta é meio perímetro; o lado direito é negativo', () => {
    expect(caminhoNaElipse(150, 100, Math.PI)).toBeCloseTo(perimetroDaElipse(150, 100) / 2, 0);
    expect(caminhoNaElipse(150, 100, -0.7)).toBeCloseTo(-caminhoNaElipse(150, 100, 0.7), 9);
    expect(caminhoNaElipse(100, 100, Math.PI / 2)).toBeCloseTo(50 * Math.PI, 6);
  });

  it('o retângulo desenhado na frente, do busto à cintura: a largura é o caminho na elipse, a altura é a distância', () => {
    const { busto, cintura } = corpo.niveis;
    const contorno = [noTronco(busto, -0.6), noTronco(busto, 0.6), noTronco(cintura, 0.6), noTronco(cintura, -0.6)];
    const p = preMoldeDoDesenho(corpo, contorno, 0, 'Frente do corpo', 'p');
    const caixa = retanguloEnvolvente(p.contorno);
    expect(caixa.maxX - caixa.minX).toBeCloseTo(busto - cintura, 6);
    const s = secaoNaAltura(corpo, busto)!;
    expect(p.contorno[1]!.y - p.contorno[0]!.y).toBeCloseTo(2 * caminhoNaElipse(s.a, s.b, 0.6), 6);
    expect(p.nome).toBe('Frente do corpo');
    // Com 10% de folga, 10% mais largo.
    const comFolga = preMoldeDoDesenho(corpo, contorno, 10, '', 'q');
    expect(comFolga.contorno[1]!.y - comFolga.contorno[0]!.y).toBeCloseTo(1.1 * (p.contorno[1]!.y - p.contorno[0]!.y), 6);
    expect(comFolga.nome).toBe('Pré-molde do corpo');
  });

  it('só o tronco: o ponto do braço ou da cabeça é recusado; o desenho sem área também', () => {
    const { busto } = corpo.niveis;
    expect(pontoNoTronco(corpo, noTronco(busto, 0.3))).toBe(true);
    expect(pontoNoTronco(corpo, { x: 0, y: corpo.alturaMm - 50, z: 0 })).toBe(false);
    expect(pontoNoTronco(corpo, { ...noTronco(busto, 1.57), x: noTronco(busto, 1.57).x + 120 })).toBe(false);
    // O braço, mesmo perto da elipse: a pele dele, do lado de dentro.
    const { inicio, meio, raio } = corpo.bracos.esquerdo;
    expect(pontoNoTronco(corpo, { x: (inicio.x + meio.x) / 2 - raio * 0.8, y: (inicio.y + meio.y) / 2, z: (inicio.z + meio.z) / 2 })).toBe(false);
    expect(() => preMoldeDoDesenho(corpo, [noTronco(busto, 0), noTronco(busto, 0.2)], 0, '', 'x')).toThrow('pelo menos três pontos');
    expect(() => preMoldeDoDesenho(corpo, [noTronco(busto, 0), noTronco(busto, 0.2), { x: 0, y: corpo.alturaMm - 50, z: 0 }], 0, '', 'x')).toThrow('no tronco');
    expect(() => preMoldeDoDesenho(corpo, [noTronco(busto, 0), noTronco(busto, 0.2), noTronco(busto, 0.4)], 0, '', 'x')).toThrow('não fecha uma área');
  });

  it('o corpo de verdade passa longe da elipse: os pontos clicados no busto, no vale entre os seios e na cintura são do tronco', () => {
    const proj = projecao(cameraDeFrente(corpo.alturaMm), 800, 1000);
    for (const [x, y] of [[60, corpo.niveis.busto], [-60, corpo.niveis.busto], [0, corpo.niveis.busto], [40, corpo.niveis.cintura], [-40, corpo.niveis.cintura + 60]] as const) {
      const naTela = proj.projetar(x, y, 120)!;
      const achado = pontoDoCorpoNaTela(proj, malhaDoCorpo(corpo), naTela.sx, naTela.sy)!;
      expect(pontoNoTronco(corpo, achado)).toBe(true);
    }
  });

  it('o clique na tela acha o ponto do corpo debaixo dele, o mais perto da câmera (na frente)', () => {
    const proj = projecao(cameraDeFrente(corpo.alturaMm), 800, 1000);
    const alvo = noTronco(corpo.niveis.cintura, 0);
    const naTela = proj.projetar(alvo.x, alvo.y, alvo.z)!;
    const achado = pontoDoCorpoNaTela(proj, malhaDoCorpo(corpo), naTela.sx, naTela.sy)!;
    // A frente (z > 0), não as costas.
    expect(achado.z).toBeGreaterThan(0);
    // O ponto sai do corpo de verdade, um pouco à frente ou atrás da elipse que arruma as peças.
    expect(Math.hypot(achado.x - alvo.x, achado.y - alvo.y, achado.z - alvo.z)).toBeLessThan(40);
    expect(pontoDoCorpoNaTela(proj, malhaDoCorpo(corpo), 5, 5)).toBeNull();
  });
});

describe('as poses do manequim (ADR 0138)', () => {
  const graus = (b: { inicio: Ponto3D; meio: Ponto3D }): number => (Math.atan2(Math.abs(b.meio.x - b.inicio.x), b.inicio.y - b.meio.y) * 180) / Math.PI;
  it('o braço sai do corpo no ângulo de cada pose; o tronco não muda', () => {
    const m = MEDIDAS_DO_PUBLICO.feminino;
    expect(graus(corpoDoManequim(m).bracos.esquerdo)).toBeCloseTo(15, 6);
    expect(graus(corpoDoManequim(m, 'bracos-abaixados').bracos.direito)).toBeCloseTo(7, 6);
    expect(graus(corpoDoManequim(m, 'bracos-abertos').bracos.esquerdo)).toBeCloseTo(60, 6);
    expect(corpoDoManequim(m, 'bracos-abertos').tronco).toEqual(corpoDoManequim(m).tronco);
  });

  it('mãos na cintura: o antebraço volta, e a mão fica no lado do quadril, na altura da cintura', () => {
    const c = corpoDoManequim(MEDIDAS_DO_PUBLICO.feminino, 'maos-na-cintura');
    for (const b of [c.bracos.direito, c.bracos.esquerdo]) {
      expect(Math.abs(b.fim.x)).toBeLessThan(Math.abs(b.meio.x));
      expect(Math.abs(b.fim.y - c.niveis.cintura)).toBeLessThan(0.05 * c.alturaMm);
      const s = secaoNaAltura(c, c.niveis.cintura)!;
      expect(Math.abs(b.fim.x)).toBeGreaterThan(s.a);
    }
  });
});

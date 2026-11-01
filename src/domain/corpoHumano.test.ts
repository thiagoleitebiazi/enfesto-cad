import { describe, expect, it } from 'vitest';
import { voltaDoTronco } from './corpoHumano';
import { FACES_DO_CORPO, PONTOS_DO_CORPO } from './corpoHumano.dados';
import { corpoDoManequim, distanciaAoCorpo, malhaDoCorpo, MEDIDAS_DO_PUBLICO, publicoDasMedidas, type PublicoDoManequim } from './manequim';

const CORPOS: readonly PublicoDoManequim[] = ['feminino', 'masculino', 'infantil'];
const emY = (v: ArrayLike<number>): number[] => Array.from({ length: v.length / 3 }, (_, i) => v[3 * i + 1]!);

describe('o corpo humano do provador (ADR 0229)', () => {
  it('a malha aberta: um corpo inteiro de quadrados, com os olhos e sem o que não é corpo', () => {
    expect(PONTOS_DO_CORPO).toBe(13524);
    expect(FACES_DO_CORPO).toBe(13518);
    const m = malhaDoCorpo(corpoDoManequim(MEDIDAS_DO_PUBLICO.feminino, 'padrao', 'feminino'));
    expect(m.vertices.length / 3).toBe(PONTOS_DO_CORPO);
    expect(m.triangulos.length / 3).toBe(2 * FACES_DO_CORPO);
  });

  for (const publico of CORPOS) {
    it(`${publico}: as voltas e a altura batem com as medidas, com os pés no chão`, () => {
      const medidas = MEDIDAS_DO_PUBLICO[publico];
      const corpo = corpoDoManequim(medidas, 'padrao', publico);
      const m = malhaDoCorpo(corpo);
      expect(voltaDoTronco(m, corpo.niveis.busto) / 10).toBeCloseTo(medidas.bustoCm, -0.3);
      expect(voltaDoTronco(m, corpo.niveis.cintura) / 10).toBeCloseTo(medidas.cinturaCm, -0.3);
      expect(voltaDoTronco(m, corpo.niveis.quadril) / 10).toBeCloseTo(medidas.quadrilCm, -0.3);
      const ys = emY(m.vertices);
      expect(Math.max(...ys)).toBeCloseTo(corpo.alturaMm, -1);
      expect(Math.abs(Math.min(...ys))).toBeLessThan(12);
    });
  }

  it('medidas maiores dão um corpo maior nas voltas, com a mesma altura', () => {
    const m = MEDIDAS_DO_PUBLICO.feminino;
    const grande = corpoDoManequim({ ...m, bustoCm: 120, cinturaCm: 104, quadrilCm: 130 }, 'padrao', 'feminino');
    const malha = malhaDoCorpo(grande);
    expect(voltaDoTronco(malha, grande.niveis.busto) / 10).toBeCloseTo(120, -0.3);
    expect(voltaDoTronco(malha, grande.niveis.cintura) / 10).toBeCloseTo(104, -0.3);
    expect(voltaDoTronco(malha, grande.niveis.quadril) / 10).toBeCloseTo(130, -0.3);
    expect(Math.max(...emY(malha.vertices))).toBeCloseTo(1650, -1);
  });

  it('as formas são diferentes: o corpo feminino não é o masculino nas mesmas medidas', () => {
    const m = MEDIDAS_DO_PUBLICO.feminino;
    const a = malhaDoCorpo(corpoDoManequim(m, 'padrao', 'feminino')).vertices;
    const b = malhaDoCorpo(corpoDoManequim(m, 'padrao', 'masculino')).vertices;
    let d = 0;
    for (let i = 0; i < a.length; i++) d = Math.max(d, Math.abs(a[i]! - b[i]!));
    expect(d).toBeGreaterThan(10);
  });

  it('sem o público, a forma sai das medidas', () => {
    expect(publicoDasMedidas(MEDIDAS_DO_PUBLICO.feminino)).toBe('feminino');
    expect(publicoDasMedidas(MEDIDAS_DO_PUBLICO.masculino)).toBe('masculino');
    expect(publicoDasMedidas(MEDIDAS_DO_PUBLICO.infantil)).toBe('infantil');
  });

  it('o corpo é simétrico: o que há de um lado há do outro', () => {
    const v = malhaDoCorpo(corpoDoManequim(MEDIDAS_DO_PUBLICO.masculino, 'bracos-abertos', 'masculino')).vertices;
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < v.length; i += 3) {
      minX = Math.min(minX, v[i]!);
      maxX = Math.max(maxX, v[i]!);
    }
    expect(minX + maxX).toBeCloseTo(0, 0);
  });

  it('os braços vão para a pose: a mão fica depois do punho, no ponto pedido', () => {
    for (const pose of ['padrao', 'bracos-abertos', 'maos-na-cintura'] as const) {
      const corpo = corpoDoManequim(MEDIDAS_DO_PUBLICO.feminino, pose, 'feminino');
      const v = malhaDoCorpo(corpo).vertices;
      const { fim } = corpo.bracos.esquerdo;
      let perto = Infinity;
      for (let i = 0; i < v.length; i += 3) perto = Math.min(perto, Math.hypot(v[i]! - fim.x, v[i + 1]! - fim.y, v[i + 2]! - fim.z));
      // O punho é fino: a pele passa a menos de 4 cm do eixo dele.
      expect(perto).toBeLessThan(40);
    }
  });

  it('o peito é liso como o de um manequim: nenhum ponto salta dos vizinhos', () => {
    const corpo = corpoDoManequim(MEDIDAS_DO_PUBLICO.feminino, 'padrao', 'feminino');
    const { vertices: v, triangulos: t } = malhaDoCorpo(corpo);
    // A ponta do peito (o ponto da malha) contra a média dos vizinhos dela: sem o bico, fica quase no plano deles.
    const ponta = 8451;
    const vizinhos = new Set<number>();
    for (let k = 0; k < t.length; k += 3) {
      const tri = [t[k]!, t[k + 1]!, t[k + 2]!];
      if (tri.includes(ponta)) for (const i of tri) if (i !== ponta) vizinhos.add(i);
    }
    const media = (e: number): number => [...vizinhos].reduce((s, i) => s + v[3 * i + e]!, 0) / vizinhos.size;
    expect(vizinhos.size).toBeGreaterThan(3);
    expect(Math.hypot(v[3 * ponta]! - media(0), v[3 * ponta + 1]! - media(1), v[3 * ponta + 2]! - media(2))).toBeLessThan(1.5);
  });
});

describe('o campo de distâncias do corpo', () => {
  const corpo = corpoDoManequim(MEDIDAS_DO_PUBLICO.feminino, 'padrao', 'feminino');

  it('dentro é negativo, fora positivo, e a normal aponta para fora', () => {
    const y = corpo.niveis.cintura;
    const dentro = distanciaAoCorpo(corpo, 0, y, 0);
    expect(dentro.d).toBeLessThan(-40);
    const fora = distanciaAoCorpo(corpo, 0, y, 250);
    expect(fora.d).toBeGreaterThan(100);
    expect(fora.nz).toBeGreaterThan(0.9);
  });

  it('a distância lida na grade bate com a dos pontos da malha: a superfície fica no zero', () => {
    const { vertices: v } = malhaDoCorpo(corpo);
    let pior = 0;
    for (let i = 0; i < v.length; i += 3 * 40) pior = Math.max(pior, Math.abs(distanciaAoCorpo(corpo, v[i]!, v[i + 1]!, v[i + 2]!).d));
    // A grade é de 8 mm: nos dedos e nas orelhas, finos, ela erra um pouco mais.
    expect(pior).toBeLessThan(9);
  });

  it('entre as pernas e embaixo do braço é fora; dentro da coxa e do braço é dentro', () => {
    const { direita } = corpo.pernas;
    const { esquerdo } = corpo.bracos;
    expect(distanciaAoCorpo(corpo, 0, corpo.niveis.gancho - 150, 0).d).toBeGreaterThan(0);
    expect(distanciaAoCorpo(corpo, direita.meio.x, 0.4 * corpo.alturaMm, direita.meio.z).d).toBeLessThan(-20);
    expect(distanciaAoCorpo(corpo, esquerdo.meio.x, esquerdo.meio.y, esquerdo.meio.z).d).toBeLessThan(-10);
  });
});

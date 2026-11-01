import { describe, expect, it } from 'vitest';
import { cameraDeFrente, cameraMovida, corRgb, guinadasDoGiro, projecao, vistaDaProjecao } from './cena3d';

describe('a câmera do provador', () => {
  it('olha o corpo de frente: o que está no alvo cai no meio da imagem, e o que está mais alto, acima dele', () => {
    const camera = cameraDeFrente(1700);
    const proj = projecao(camera, 800, 600);
    const alvo = proj.projetar(camera.alvo.x, camera.alvo.y, camera.alvo.z)!;
    expect(alvo.sx).toBeCloseTo(400, 6);
    expect(alvo.sy).toBeCloseTo(300, 6);
    expect(proj.projetar(camera.alvo.x, camera.alvo.y + 100, camera.alvo.z)!.sy).toBeLessThan(alvo.sy);
  });

  it('de frente, o corpo aproveita a imagem: mais de 90% da altura dela, com a cabeça e os pés dentro', () => {
    const altura = 1700;
    const p = projecao(cameraDeFrente(altura), 800, 600);
    const topo = p.projetar(0, altura, 0)!;
    const pes = p.projetar(0, 0, 0)!;
    expect(pes.sy - topo.sy).toBeGreaterThan(0.9 * 600);
    expect(topo.sy).toBeGreaterThan(0);
    expect(pes.sy).toBeLessThan(600);
  });

  it('a vista para o estúdio leva a câmera e as direções, sem a função de projetar (ela vai para o Worker)', () => {
    const proj = projecao(cameraDeFrente(1700), 800, 600);
    const v = vistaDaProjecao(proj, 1700);
    expect(v.foco).toBe(proj.foco);
    expect(Math.hypot(v.frente.x, v.frente.y, v.frente.z)).toBeCloseTo(1, 9);
    expect(() => structuredClone(v)).not.toThrow();
  });

  it('a cor em hexadecimal; com outro texto, a de partida', () => {
    expect(corRgb('#102030')).toEqual([16, 32, 48]);
    expect(corRgb('xx')).toEqual([79, 124, 172]);
  });
});

describe('chegar perto (ADR 0231)', () => {
  it('a roda aproxima de verdade: mais perto, o mesmo trecho do corpo ocupa mais da imagem', () => {
    const camera = cameraDeFrente(1700);
    const altura = (distancia: number): number => {
      const p = projecao({ ...camera, distancia }, 800, 600);
      const [a, b] = [p.projetar(0, 800, 0)!, p.projetar(0, 900, 0)!];
      return Math.abs(a.sy - b.sy);
    };
    expect(altura(1000)).toBeGreaterThan(2.5 * altura(camera.distancia));
  });

  it('mover a vista: o que está no alvo acompanha o arrasto na imagem', () => {
    const camera = cameraDeFrente(1700);
    const proj = projecao(camera, 800, 600);
    const movida = cameraMovida(camera, proj, 40, -25);
    const antes = proj.projetar(camera.alvo.x, camera.alvo.y, camera.alvo.z)!;
    const depois = projecao(movida, 800, 600).projetar(camera.alvo.x, camera.alvo.y, camera.alvo.z)!;
    expect(depois.sx - antes.sx).toBeCloseTo(40, 3);
    expect(depois.sy - antes.sy).toBeCloseTo(-25, 3);
  });
});

describe('o giro em vídeo (ADR 0139)', () => {
  it('uma volta inteira, quadro a quadro, a partir da vista de agora', () => {
    expect(guinadasDoGiro(0.5, 4)).toEqual([0.5, 0.5 + Math.PI / 2, 0.5 + Math.PI, 0.5 + (3 * Math.PI) / 2]);
    expect(guinadasDoGiro(0, 0)).toEqual([0]);
  });
});

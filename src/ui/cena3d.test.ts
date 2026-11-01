import { describe, expect, it } from 'vitest';
import { cameraDeFrente, corRgb, guinadasDoGiro, projecao, vistaDaProjecao } from './cena3d';

describe('a câmera do provador', () => {
  it('olha o corpo de frente: o que está no alvo cai no meio da imagem, e o que está mais alto, acima dele', () => {
    const camera = cameraDeFrente(1700);
    const proj = projecao(camera, 800, 600, 1700);
    const alvo = proj.projetar(camera.alvo.x, camera.alvo.y, camera.alvo.z)!;
    expect(alvo.sx).toBeCloseTo(400, 6);
    expect(alvo.sy).toBeCloseTo(300, 6);
    expect(proj.projetar(camera.alvo.x, camera.alvo.y + 100, camera.alvo.z)!.sy).toBeLessThan(alvo.sy);
  });

  it('a vista para o estúdio leva a câmera e as direções, sem a função de projetar (ela vai para o Worker)', () => {
    const proj = projecao(cameraDeFrente(1700), 800, 600, 1700);
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

describe('o giro em vídeo (ADR 0139)', () => {
  it('uma volta inteira, quadro a quadro, a partir da vista de agora', () => {
    expect(guinadasDoGiro(0.5, 4)).toEqual([0.5, 0.5 + Math.PI / 2, 0.5 + Math.PI, 0.5 + (3 * Math.PI) / 2]);
    expect(guinadasDoGiro(0, 0)).toEqual([0]);
  });
});

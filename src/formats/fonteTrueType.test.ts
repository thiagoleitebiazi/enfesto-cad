import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ponto, retanguloEnvolvente } from '../core/geometria';
import { criarConfiguracaoDeEnfesto } from '../domain/enfesto';
import { criarMolde, type Molde } from '../domain/molde';
import { fonteDoArquivo, tracosDaFonte, type FonteLida } from './fonteTrueType';
import { gerarPdfDeEncaixe } from './pdf-exportacao';
import { gerarPlt } from './plt-exportacao';

const quadrado = (lado: number) => ({
  path: {
    commands: [
      { command: 'moveTo', args: [0, 0] },
      { command: 'lineTo', args: [lado, 0] },
      { command: 'lineTo', args: [lado, lado] },
      { command: 'closePath', args: [] },
    ],
  },
});

const fonte: FonteLida = {
  unitsPerEm: 1000,
  capHeight: 500,
  layout: (texto) => ({ glyphs: [...texto].map(() => quadrado(500)), positions: [...texto].map(() => ({ xAdvance: 600, xOffset: 0, yOffset: 0 })) }),
};

const peca: Molde = criarMolde({ nome: 'Frente', referencia: '', tamanho: 'M', quantidade: 1, contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 200), ponto(0, 200)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 180) }, restricaoDeRotacao: { permite180: true, permite90e270: false } }, 'a');

describe('a fonte TrueType (ADR 0211)', () => {
  it('o contorno da letra, na altura pedida, e a letra seguinte depois do avanço', () => {
    const t = tracosDaFonte(fonte, 'AB', 10);
    expect(t).toHaveLength(2);
    expect(t[0]).toEqual([ponto(0, 0), ponto(10, 0), ponto(10, 10), ponto(0, 0)]);
    expect(t[1]![0]).toEqual(ponto(12, 0));
  });

  it('as curvas viram linhas, passando pelos pontos certos', () => {
    const curva: FonteLida = {
      unitsPerEm: 1000,
      capHeight: 1000,
      layout: () => ({
        glyphs: [
          {
            path: {
              commands: [
                { command: 'moveTo', args: [0, 0] },
                { command: 'quadraticCurveTo', args: [500, 1000, 1000, 0] },
                { command: 'bezierCurveTo', args: [1000, 500, 500, 500, 500, 0] },
              ],
            },
          },
        ],
        positions: [{ xAdvance: 0, xOffset: 0, yOffset: 0 }],
      }),
    };
    const [t] = tracosDaFonte(curva, 'A', 1);
    expect(t).toHaveLength(13);
    expect(t![3]!.x).toBeCloseTo(0.5, 6);
    expect(t![3]!.y).toBeCloseTo(0.5, 6);
    expect(t![6]).toEqual(ponto(1, 0));
    expect(t![12]!.x).toBeCloseTo(0.5, 6);
  });

  it('no PLT, os textos saem em linhas, e o letreiro não é usado', () => {
    const plt = gerarPlt([peca], { tracosDaFonte: (texto, altura) => tracosDaFonte(fonte, texto, altura) });
    expect(plt).not.toContain('LB');
    expect(gerarPlt([peca])).toContain('LB');
  });

  it('o arquivo que não é fonte dá erro', () => {
    expect(() => fonteDoArquivo(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), 'x.ttf')).toThrow();
  });

  const ARIAL = 'C:/Windows/Fonts/arial.ttf';

  it.skipIf(!existsSync(ARIAL))('lê uma fonte de verdade: as letras no tamanho, os acentos e o PDF com ela', async () => {
    const bytes = new Uint8Array(readFileSync(ARIAL));
    const f = fonteDoArquivo(bytes, 'arial.ttf');
    expect(retanguloEnvolvente(f.tracos('H', 10).flat()).maxY).toBeCloseTo(10, 0);
    expect(f.tracos('O', 10).length).toBe(2);
    expect(retanguloEnvolvente(f.tracos('É', 10).flat()).maxY).toBeGreaterThan(11);
    expect(gerarPlt([peca], { tracosDaFonte: f.tracos })).not.toContain('LB');
    const e = criarConfiguracaoDeEnfesto({ tipo: 'impar', larguraUtilMm: 1000, comprimentoMm: 3000, quantidadeDeCamadas: 1, margemLateralMm: 0, margemDeExtremidadeMm: 0, distanciaMinimaEntrePecasMm: 0 });
    const opcoes = { formato: 'A4', orientacao: 'retrato', margemMm: 10 } as const;
    const sem = await gerarPdfDeEncaixe([peca], e, opcoes);
    const com = await gerarPdfDeEncaixe([peca], e, { ...opcoes, fonte: bytes });
    expect(com.size).toBeGreaterThan(sem.size + 1000);
  });
});

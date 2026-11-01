import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { criarConfiguracaoDeEnfesto } from '../domain/enfesto';
import { criarMolde, type Molde } from '../domain/molde';
import { fonteDoArquivo } from './fonteTrueType';
import { gerarPdfDeEncaixe } from './pdf-exportacao';

const peca: Molde = criarMolde({ nome: 'Frente', referencia: '', tamanho: 'M', quantidade: 1, contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 200), ponto(0, 200)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 180) }, restricaoDeRotacao: { permite180: true, permite90e270: false } }, 'a');

describe('a fonte do PDF (ADR 0211, 0225)', () => {
  it('o arquivo que não é fonte dá erro', () => {
    expect(() => fonteDoArquivo(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]), 'x.ttf')).toThrow();
  });

  const ARIAL = 'C:/Windows/Fonts/arial.ttf';

  it.skipIf(!existsSync(ARIAL))('lê uma fonte de verdade, e o PDF sai com ela', async () => {
    const bytes = new Uint8Array(readFileSync(ARIAL));
    expect(fonteDoArquivo(bytes, 'arial.ttf').nome).toBe('arial.ttf');
    const e = criarConfiguracaoDeEnfesto({ tipo: 'impar', larguraUtilMm: 1000, comprimentoMm: 3000, quantidadeDeCamadas: 1, margemLateralMm: 0, margemDeExtremidadeMm: 0, distanciaMinimaEntrePecasMm: 0 });
    const opcoes = { formato: 'A4', orientacao: 'retrato', margemMm: 10 } as const;
    const sem = await gerarPdfDeEncaixe([peca], e, opcoes);
    const com = await gerarPdfDeEncaixe([peca], e, { ...opcoes, fonte: bytes });
    expect(com.size).toBeGreaterThan(sem.size + 1000);
  });
});

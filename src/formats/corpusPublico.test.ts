import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { area, retanguloEnvolvente } from '../core/geometria';
import type { Molde } from '../domain/molde';
import { ehArquivoAstm, lerAstm, moldesDoAstm } from './astm-importacao';
import { gerarDxfAstm } from './dxf-astm';

/**
 * A validação com arquivos de verdade, feitos por outros programas (ADR 0215). Eles são públicos, mas não são nossos:
 * ficam fora do repositório, numa pasta dada por CORPUS_PUBLICO. Sem ela, este teste não roda.
 */
const PASTA = process.env['CORPUS_PUBLICO'] ?? '';

let n = 0;
const novoId = (): string => `c${n++}`;

const nomes = (sufixo: RegExp): string[] => (PASTA && existsSync(PASTA) ? readdirSync(PASTA).filter((f) => sufixo.test(f)) : []);
const ler = (arquivo: string): string => readFileSync(path.join(PASTA, arquivo), 'utf-8');

interface Medida {
  readonly chave: string;
  readonly largura: number;
  readonly comprimento: number;
}

/** Peça a peça, por nome e tamanho, do menor para o maior: serve para comparar dois arquivos da mesma modelagem. */
const medidas = (moldes: readonly Molde[]): Medida[] =>
  moldes
    .map((m) => {
      const c = retanguloEnvolvente(m.contorno);
      return { chave: `${m.nome}|${m.tamanho}`, largura: c.maxX - c.minX, comprimento: c.maxY - c.minY };
    })
    .sort((a, b) => a.chave.localeCompare(b.chave));

describe.skipIf(PASTA === '')('os arquivos ASTM e AAMA públicos (ADR 0215)', () => {
  const dxfs = nomes(/\.dxf$/i);

  it('todos são lidos, sem erro e com peças de verdade', () => {
    const relatorio: unknown[] = [];
    const naoReconhecidos: string[] = [];
    for (const arquivo of dxfs) {
      const texto = ler(arquivo);
      if (!ehArquivoAstm(texto)) {
        naoReconhecidos.push(arquivo);
        continue;
      }
      const leitura = lerAstm(texto);
      const { moldes, avisos, pedeRegras } = moldesDoAstm(leitura, novoId);
      for (const m of moldes) expect(area(m.contorno), `${arquivo}: ${m.nome}`).toBeGreaterThan(1);
      relatorio.push({ arquivo, estilo: leitura.estilo, base: leitura.tamanhoBase, mm: leitura.mmPorUnidade, blocos: leitura.pecas.length, moldes: moldes.length, tamanhos: [...new Set(moldes.flatMap((m) => m.graduacao?.tamanhos ?? [m.tamanho]))].length, piques: moldes.reduce((s, m) => s + m.piques.length, 0), pedeRegras, avisos: avisos.length });
    }
    writeFileSync(path.join(PASTA, '..', 'relatorio-astm.json'), JSON.stringify({ naoReconhecidos, relatorio }, null, 1));
    expect(relatorio.length).toBeGreaterThan(20);
  });

  it('o mesmo modelo em AAMA e em ASTM dá as mesmas peças', () => {
    const pares = dxfs.filter((f) => /_AAMA\.dxf$/i.test(f) && dxfs.includes(f.replace(/_AAMA/i, '_ASTM')));
    expect(pares.length).toBeGreaterThan(3);
    for (const aama of pares) {
      const [a, b] = [aama, aama.replace(/_AAMA/i, '_ASTM')].map((f) => medidas(moldesDoAstm(lerAstm(ler(f)), novoId).moldes));
      expect(b!.map((m) => m.chave), aama).toEqual(a!.map((m) => m.chave));
      a!.forEach((m, i) => {
        expect(b![i]!.largura, `${aama}: ${m.chave}`).toBeCloseTo(m.largura, 0);
        expect(b![i]!.comprimento, `${aama}: ${m.chave}`).toBeCloseTo(m.comprimento, 0);
      });
    }
  });

  it('o que entra, sai e volta igual', () => {
    for (const arquivo of dxfs.filter((f) => ehArquivoAstm(ler(f)))) {
      const { moldes } = moldesDoAstm(lerAstm(ler(arquivo)), novoId);
      if (moldes.length === 0) continue;
      const volta = moldesDoAstm(lerAstm(gerarDxfAstm(moldes, 'volta', novoId)), novoId).moldes;
      const [a, b] = [moldes, volta].map((l) => medidas(l).map((m) => [m.largura, m.comprimento]).flat());
      expect(b!.length, arquivo).toBeGreaterThan(0);
      expect(Math.max(...a!), arquivo).toBeCloseTo(Math.max(...b!), 0);
    }
  });
});

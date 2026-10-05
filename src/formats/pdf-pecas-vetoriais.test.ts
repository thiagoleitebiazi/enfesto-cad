// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { extrairPecasVetoriais } from './pdf-pecas-vetoriais';

// Fixture gerada com pdfkit (Node): uma moldura da folha, dois retângulos
// pequenos (4 vértices, descartados), um polígono de 16 vértices e outro de
// 12 vértices (contornos aceitos). Ver fixtures/ para a origem.
const DIRETORIO = path.dirname(fileURLToPath(import.meta.url));

function lerFixture(nome: string): string {
  return readFileSync(path.join(DIRETORIO, 'fixtures', nome)).toString('latin1');
}

describe('extrairPecasVetoriais', () => {
  it('aceita só os contornos fechados com vértices suficientes e descarta moldura e retângulos pequenos', async () => {
    const resultado = await extrairPecasVetoriais(lerFixture('pdf-pecas-vetoriais.pdf'));

    expect(resultado.pecas).toHaveLength(2);
    expect(resultado.descartadas).toBe(3);
    expect(resultado.pecas.map((p) => p.vertices).sort((a, b) => a - b)).toEqual([12, 16]);
  });

  it('mede o contorno na escala do papel e posiciona-o com origem no canto inferior esquerdo', async () => {
    const resultado = await extrairPecasVetoriais(lerFixture('pdf-pecas-vetoriais.pdf'));
    const circulo = resultado.pecas.find((p) => p.vertices === 16)!;

    // Raio de 100 pt = 200 pt de diâmetro = 70,56 mm.
    expect(circulo.larguraMm).toBeCloseTo(200 * (25.4 / 72), 1);
    expect(circulo.alturaMm).toBeCloseTo(200 * (25.4 / 72), 1);
    const minX = Math.min(...circulo.contorno.map((p) => p.x));
    const minY = Math.min(...circulo.contorno.map((p) => p.y));
    expect(minX).toBeCloseTo(0, 6);
    expect(minY).toBeCloseTo(0, 6);
  });

  it('não lança exceção com bytes que não são um PDF', async () => {
    const resultado = await extrairPecasVetoriais('isto não é um pdf');

    expect(resultado.pecas).toEqual([]);
  });
});

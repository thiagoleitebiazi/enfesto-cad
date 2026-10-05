// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PT_PARA_MM, contornoEmMundo, extrairContornosDoPdf, linhaDeFioSobreContorno } from './pdf-pecas-vetoriais';

// Fixture gerada com pdfkit (Node): moldura da folha (A4), dois retângulos
// de 4 vértices (descartados como caixas), um polígono de 16 vértices
// centrado em (300, 400) de raio 100 e um de 12 vértices centrado em
// (450, 200) de raio 60. O pdfkit usa topo-esquerda; no PDF o y vira
// altura - y, por isso as coordenadas esperadas abaixo estão em PDF.
const DIRETORIO = path.dirname(fileURLToPath(import.meta.url));
const ALTURA_A4_PT = 841.89;

function lerFixture(nome: string): string {
  return readFileSync(path.join(DIRETORIO, 'fixtures', nome)).toString('latin1');
}

describe('extrairContornosDoPdf', () => {
  it('aceita só os contornos fechados com vértices suficientes e conta cada descarte pelo motivo', async () => {
    const resultado = await extrairContornosDoPdf(lerFixture('pdf-pecas-vetoriais.pdf'));

    expect(resultado.candidatos).toHaveLength(2);
    expect(resultado.candidatos.map((c) => c.vertices).sort((a, b) => a - b)).toEqual([12, 16]);
    expect(resultado.descartados.borda).toBe(1);
    expect(resultado.descartados.poucosVertices).toBe(2);
    expect(resultado.descartados.areaPequena).toBe(0);
    expect(resultado.descartados.abertos).toBe(0);
  });

  it('mantém as coordenadas reais da página, em pontos, sem deslocar a origem', async () => {
    const resultado = await extrairContornosDoPdf(lerFixture('pdf-pecas-vetoriais.pdf'));
    const circulo = resultado.candidatos.find((c) => c.vertices === 16)!;
    const xs = circulo.contornoPt.map((p) => p.x);
    const ys = circulo.contornoPt.map((p) => p.y);

    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(300, 4);
    expect((Math.min(...ys) + Math.max(...ys)) / 2).toBeCloseTo(ALTURA_A4_PT - 400, 4);
    expect(circulo.larguraPt).toBeCloseTo(200, 4);
    expect(circulo.alturaPt).toBeCloseTo(200, 4);
  });

  it('informa a altura da página, usada para converter a orientação', async () => {
    const resultado = await extrairContornosDoPdf(lerFixture('pdf-pecas-vetoriais.pdf'));

    expect(resultado.alturaPaginaPt).toBeCloseTo(ALTURA_A4_PT, 2);
  });

  it('não lança exceção com bytes que não são um PDF', async () => {
    const resultado = await extrairContornosDoPdf('isto não é um pdf');

    expect(resultado.candidatos).toEqual([]);
    expect(resultado.alturaPaginaPt).toBeNull();
  });
});

describe('contornoEmMundo', () => {
  it('aplica a escala do usuário e inverte o eixo vertical como na página', () => {
    const candidato = {
      id: 'c',
      contornoPt: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 50 },
      ],
      vertices: 3,
      larguraPt: 100,
      alturaPt: 50,
    };

    const mundo = contornoEmMundo(candidato, 200, 2);
    const k = PT_PARA_MM * 2;

    expect(mundo[0]!.x).toBeCloseTo(200 * k, 9);
    expect(mundo[0]!.y).toBeCloseTo(0, 9);
    expect(mundo[1]!.y).toBeCloseTo(100 * k, 9);
    expect(mundo[2]!.x).toBeCloseTo((200 - 50) * k, 9);
  });
});

describe('linhaDeFioSobreContorno', () => {
  const quadrado = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 40 },
    { x: 0, y: 40 },
  ];

  it('vertical varia só o eixo x e fica no centro da caixa', () => {
    const fio = linhaDeFioSobreContorno(quadrado, 'vertical');

    expect(fio.inicio.y).toBeCloseTo(20, 9);
    expect(fio.fim.y).toBeCloseTo(20, 9);
    expect(fio.fim.x - fio.inicio.x).toBeCloseTo(80, 9);
  });

  it('horizontal varia só o eixo y', () => {
    const fio = linhaDeFioSobreContorno(quadrado, 'horizontal');

    expect(fio.inicio.x).toBeCloseTo(50, 9);
    expect(fio.fim.x).toBeCloseTo(50, 9);
    expect(fio.fim.y - fio.inicio.y).toBeCloseTo(32, 9);
  });
});

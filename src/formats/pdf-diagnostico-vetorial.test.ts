// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { diagnosticarVetorPdf, descreverDiagnosticoVetorial } from './pdf-diagnostico-vetorial';

// PDFs de exemplo gerados com o pdfkit (Node) e guardados em fixtures/:
// compressão padrão (FlateDecode), igual aos PDFs de fornecedores. Ficam
// como arquivos para não depender do build do pdfkit escolhido pelo
// ambiente de teste.
const DIRETORIO = path.dirname(fileURLToPath(import.meta.url));

function lerFixture(nome: string): string {
  return readFileSync(path.join(DIRETORIO, 'fixtures', nome)).toString('latin1');
}

describe('diagnosticarVetorPdf', () => {
  it('conta caminhos, segmentos retos e curvas de um desenho vetorial comprimido', async () => {
    const diagnostico = await diagnosticarVetorPdf(lerFixture('pdf-vetor-comprimido.pdf'));

    expect(diagnostico.paginas).toBe(1);
    expect(diagnostico.subcaminhos).toBeGreaterThanOrEqual(2);
    // 1 retângulo (re) + 2 linhas explícitas (l) do triângulo; o fechamento (h) não conta.
    expect(diagnostico.segmentosRetos).toBeGreaterThanOrEqual(3);
    expect(diagnostico.segmentosCurvos).toBeGreaterThanOrEqual(1);
    expect(diagnostico.blocosDeTexto).toBe(0);
    expect(diagnostico.larguraMm).toBeCloseTo(210, 0);
    expect(diagnostico.alturaMm).toBeCloseTo(297, 0);
  });

  it('reconhece um PDF só de texto como texto, sem contar desenho', async () => {
    const diagnostico = await diagnosticarVetorPdf(lerFixture('pdf-so-texto.pdf'));

    expect(diagnostico.blocosDeTexto).toBeGreaterThanOrEqual(1);
    expect(diagnostico.subcaminhos).toBe(0);
  });

  it('não lança exceção com bytes que não são um PDF', async () => {
    const diagnostico = await diagnosticarVetorPdf('isto não é um pdf');

    expect(diagnostico.paginas).toBe(0);
    expect(diagnostico.subcaminhos).toBe(0);
    expect(diagnostico.larguraMm).toBeNull();
  });
});

describe('descreverDiagnosticoVetorial', () => {
  it('informa caminhos, dimensões em pontos e que não há texto, sem afirmar escala', () => {
    const texto = descreverDiagnosticoVetorial({
      paginas: 1,
      subcaminhos: 239,
      segmentosRetos: 921,
      segmentosCurvos: 0,
      blocosDeTexto: 0,
      larguraMm: 2145,
      alturaMm: 750,
    });

    expect(texto).toContain('239 caminho(s)');
    expect(texto).toContain('921 segmento(s)');
    expect(texto).toContain('2145 × 750 mm');
    expect(texto).toContain('escala desconhecida');
    expect(texto).toContain('desenhados como vetor');
    expect(texto).toContain('DXF');
  });
});

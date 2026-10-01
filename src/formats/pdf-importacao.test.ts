import { describe, it, expect } from 'vitest';
import { ponto, area } from '../core/geometria';
import { criarMolde, adicionarPique, adicionarMarca, type Molde } from '../domain/molde';
import { gerarPdfDeMoldesIndividuais } from './pdf-exportacao';
import { importarPdf } from './pdf-importacao';

// Mesmo motivo do pdf-exportacao.test.ts: compress:false deixa o stream de
// conteúdo em texto puro, então testamos o ciclo completo real
// (domínio → PDF → domínio de novo), não só "não lança exceção".

async function paraTextoLatin1(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return Buffer.from(buffer).toString('latin1');
}

function pecaCompleta(nome: string, extras: Partial<Parameters<typeof criarMolde>[0]> = {}): Molde {
  let peca = criarMolde(
    {
      nome,
      referencia: `REF-${nome}`,
      tamanho: 'M',
      contorno: [ponto(0, 0), ponto(60, 0), ponto(60, 80), ponto(0, 80)],
      linhaDeFio: { inicio: ponto(30, 10), fim: ponto(30, 70) },
      margemDeCosturaMm: 10,
      furos: [[ponto(20, 30), ponto(30, 30), ponto(30, 40), ponto(20, 40)]],
      linhasInternas: [[ponto(5, 5), ponto(55, 5)]],
      quantidade: 3,
      ...extras,
    },
    nome,
  );
  peca = adicionarPique(peca, ponto(30, 0), 'piq1');
  peca = adicionarMarca(peca, ponto(45, 45), 'marc1');
  return peca;
}

describe('importarPdf — ciclo completo de ida e volta (exportar → importar)', () => {
  it('reconstrói contorno, área e proporções da peça', async () => {
    const original = pecaCompleta('Frente');
    const blob = await gerarPdfDeMoldesIndividuais([original], { formato: 'A4', orientacao: 'retrato', margemMm: 10 });
    const resultado = importarPdf(await paraTextoLatin1(blob));

    expect(resultado.pecas).toHaveLength(1);
    const importada = resultado.pecas[0]!;
    expect(importada.contorno).toHaveLength(4);
    expect(area(importada.contorno)).toBeCloseTo(area(original.contorno), 1);
  });

  it('reconstrói nome, referência, tamanho e quantidade', async () => {
    const original = pecaCompleta('Costas');
    const blob = await gerarPdfDeMoldesIndividuais([original], { formato: 'A4', orientacao: 'retrato', margemMm: 10 });
    const resultado = importarPdf(await paraTextoLatin1(blob));
    const importada = resultado.pecas[0]!;
    expect(importada.nome).toBe('Costas');
    expect(importada.referencia).toBe('REF-Costas');
    expect(importada.tamanho).toBe('M');
    expect(importada.quantidade).toBe(3);
  });

  it('referência vazia (placeholder "—") vira string vazia, não o caractere bruto', async () => {
    const original = pecaCompleta('SemRef', { referencia: '' });
    const blob = await gerarPdfDeMoldesIndividuais([original], { formato: 'A4', orientacao: 'retrato', margemMm: 10 });
    const resultado = importarPdf(await paraTextoLatin1(blob));
    expect(resultado.pecas[0]!.referencia).toBe('');
  });

  it('reconstrói a linha de fio (só a haste, não a ponta da seta) com posição correta', async () => {
    const original = pecaCompleta('Frente');
    const blob = await gerarPdfDeMoldesIndividuais([original], { formato: 'A4', orientacao: 'retrato', margemMm: 10 });
    const resultado = importarPdf(await paraTextoLatin1(blob));
    const fio = resultado.pecas[0]!.linhaDeFio;
    expect(fio).not.toBeNull();
    // Comprimento da haste deve bater com o original (60mm), não com o
    // triângulo da ponta (seria bem menor).
    const comprimento = Math.hypot(fio!.fim.x - fio!.inicio.x, fio!.fim.y - fio!.inicio.y);
    expect(comprimento).toBeCloseTo(60, 0);
  });

  it('reconstrói furos e linhas internas (contagem e forma aproximada)', async () => {
    const original = pecaCompleta('Frente');
    const blob = await gerarPdfDeMoldesIndividuais([original], { formato: 'A4', orientacao: 'retrato', margemMm: 10 });
    const resultado = importarPdf(await paraTextoLatin1(blob));
    const importada = resultado.pecas[0]!;
    expect(importada.furos).toHaveLength(1);
    expect(importada.furos[0]).toHaveLength(4);
    expect(importada.linhasInternas).toHaveLength(1);
    expect(importada.linhasInternas[0]).toHaveLength(2);
  });

  it('reconstrói piques (posição e índice de aresta) e marcas (posição do centro)', async () => {
    const original = pecaCompleta('Frente');
    const blob = await gerarPdfDeMoldesIndividuais([original], { formato: 'A4', orientacao: 'retrato', margemMm: 10 });
    const resultado = importarPdf(await paraTextoLatin1(blob));
    const importada = resultado.pecas[0]!;
    expect(importada.piques).toHaveLength(1);
    expect(importada.piques[0]!.posicao.x).toBeCloseTo(30, 0);
    expect(importada.piques[0]!.posicao.y).toBeCloseTo(0, 0);
    expect(importada.marcas).toHaveLength(1);
    expect(importada.marcas[0]!.x).toBeCloseTo(45, 0);
    expect(importada.marcas[0]!.y).toBeCloseTo(45, 0);
  });

  it('reconstrói a margem de costura por aproximação da diferença de envelope', async () => {
    const original = pecaCompleta('Frente', { margemDeCosturaMm: 10 });
    const blob = await gerarPdfDeMoldesIndividuais([original], { formato: 'A4', orientacao: 'retrato', margemMm: 10 });
    const resultado = importarPdf(await paraTextoLatin1(blob));
    expect(resultado.pecas[0]!.margemDeCosturaMm).toBeCloseTo(10, 0);
  });

  it('sem margem de costura configurada, reconstrói margem zero', async () => {
    const original = pecaCompleta('Frente', { margemDeCosturaMm: 0 });
    const blob = await gerarPdfDeMoldesIndividuais([original], { formato: 'A4', orientacao: 'retrato', margemMm: 10 });
    const resultado = importarPdf(await paraTextoLatin1(blob));
    expect(resultado.pecas[0]!.margemDeCosturaMm).toBe(0);
  });

  it('múltiplas peças no mesmo PDF são todas reconhecidas, sem misturar uma com a outra', async () => {
    const p1 = pecaCompleta('P1');
    const p2 = pecaCompleta('P2', {
      contorno: [ponto(0, 0), ponto(30, 0), ponto(30, 40), ponto(0, 40)],
      quantidade: 1,
    });
    const blob = await gerarPdfDeMoldesIndividuais([p1, p2], { formato: 'A4', orientacao: 'retrato', margemMm: 10 });
    const resultado = importarPdf(await paraTextoLatin1(blob));
    expect(resultado.pecas).toHaveLength(2);
    expect(resultado.pecas.map((p) => p.nome).sort()).toEqual(['P1', 'P2']);
    const importadaP2 = resultado.pecas.find((p) => p.nome === 'P2')!;
    expect(area(importadaP2.contorno)).toBeCloseTo(30 * 40, 0);
  });

  it('peça maior que uma folha (ladrilhada) não é reconstruída — avisa em vez de gerar geometria errada', async () => {
    const grande = pecaCompleta('Grande', {
      contorno: [ponto(0, 0), ponto(500, 0), ponto(500, 500), ponto(0, 500)],
      linhaDeFio: { inicio: ponto(250, 50), fim: ponto(250, 450) },
      furos: [],
      linhasInternas: [],
    });
    const blob = await gerarPdfDeMoldesIndividuais([grande], { formato: 'A4', orientacao: 'retrato', margemMm: 10 });
    const resultado = importarPdf(await paraTextoLatin1(blob));
    expect(resultado.pecas).toHaveLength(0);
    expect(resultado.avisos.some((a) => a.includes('ladrilhada'))).toBe(true);
  });

  it('PDF sem nenhuma peça reconhecível (texto arbitrário) não lança exceção e avisa', () => {
    const resultado = importarPdf('%PDF-1.3\nqualquer coisa\n%%EOF');
    expect(resultado.pecas).toHaveLength(0);
    expect(resultado.avisos.length).toBeGreaterThan(0);
  });
});

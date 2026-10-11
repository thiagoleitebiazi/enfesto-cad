import { describe, it, expect } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde, type Molde } from '../domain/molde';
import { adicionarTexto, definirCodigoDoPique, definirLinhaDeSimetria } from '../domain/anotacoes';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from '../domain/enfesto';
import { tornarElementos } from '../domain/linhasAuxiliares';
import {
  gerarPdfDeEncaixe,
  gerarPdfDeMoldesIndividuais,
  mmParaPontos,
  dimensoesDaPaginaMm,
  PONTOS_POR_MM,
} from './pdf-exportacao';

// O PDF é gerado com compress:false deliberadamente (ver comentário no
// módulo), então dá para inspecionar o stream de conteúdo bruto como texto
// e confirmar que os números realmente correspondem à conversão mm→pt —
// não é suficiente só "não lançar exceção".

function pecaRetangular(nome: string, largura: number, altura: number, extras: Partial<Parameters<typeof criarMolde>[0]> = {}): Molde {
  return criarMolde(
    {
      nome,
      referencia: `REF-${nome}`,
      tamanho: 'M',
      contorno: [ponto(0, 0), ponto(largura, 0), ponto(largura, altura), ponto(0, altura)],
      linhaDeFio: { inicio: ponto(largura / 2, 5), fim: ponto(largura / 2, altura - 5) },
      ...extras,
    },
    nome,
  );
}

function enfestoBase(sobrescrever: Partial<ConfiguracaoDeEnfesto> = {}): ConfiguracaoDeEnfesto {
  return criarConfiguracaoDeEnfesto({
    tipo: 'impar',
    larguraUtilMm: 150,
    comprimentoMm: 200,
    quantidadeDeCamadas: 1,
    margemLateralMm: 0,
    margemDeExtremidadeMm: 0,
    distanciaMinimaEntrePecasMm: 5,
    ...sobrescrever,
  } as ConfiguracaoDeEnfesto);
}

async function paraTexto(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  return Buffer.from(buffer).toString('latin1');
}

/**
 * PDFKit escreve texto como glifos hexadecimais dentro de operadores TJ
 * (ex.: `[<4672656e7465>]`), não como strings ASCII literais — e pode
 * fragmentar uma palavra em vários grupos hexadecimais intercalados com
 * números de kerning (ex.: `[<50> 40 <e167696e61...>]`). Para verificar que
 * um texto foi realmente escrito no PDF, concatenamos todos os grupos hex
 * (ignorando os números de kerning entre eles) e decodificamos.
 */
function decodificarTextoDoPdf(bytesPdfComoLatin1: string): string {
  const grupos = [...bytesPdfComoLatin1.matchAll(/<([0-9a-fA-F]+)>/g)].map((m) => m[1]!);
  const hex = grupos.join('');
  let resultado = '';
  for (let i = 0; i + 1 < hex.length; i += 2) {
    resultado += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  }
  return resultado;
}

describe('conversão de unidades', () => {
  it('mmParaPontos usa exatamente 72/25.4 pontos por mm', () => {
    expect(PONTOS_POR_MM).toBeCloseTo(2.834645669, 8);
    expect(mmParaPontos(100)).toBeCloseTo(283.4645669, 4);
    expect(mmParaPontos(25.4)).toBeCloseTo(72, 9);
  });

  it('dimensoesDaPaginaMm troca largura/altura na orientação paisagem', () => {
    const retrato = dimensoesDaPaginaMm({ formato: 'A4', orientacao: 'retrato', margemMm: 10 });
    const paisagem = dimensoesDaPaginaMm({ formato: 'A4', orientacao: 'paisagem', margemMm: 10 });
    expect(retrato).toEqual({ largura: 210, altura: 297 });
    expect(paisagem).toEqual({ largura: 297, altura: 210 });
  });
});

describe('gerarPdfDeMoldesIndividuais — estrutura real do arquivo', () => {
  it('produz um PDF de verdade (assinatura %PDF-) com conteúdo', async () => {
    const blob = await gerarPdfDeMoldesIndividuais([pecaRetangular('P1', 50, 50)], {
      formato: 'A4',
      orientacao: 'retrato',
      margemMm: 10,
    });
    expect(blob.size).toBeGreaterThan(500);
    const texto = await paraTexto(blob);
    expect(texto.startsWith('%PDF-')).toBe(true);
    expect(texto).toContain('%%EOF');
  });

  it('uma peça pequena gera exatamente 1 página', async () => {
    const blob = await gerarPdfDeMoldesIndividuais([pecaRetangular('P1', 50, 50)], {
      formato: 'A4',
      orientacao: 'retrato',
      margemMm: 10,
    });
    const texto = await paraTexto(blob);
    const paginas = texto.match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(paginas).toHaveLength(1);
  });

  it('uma peça maior que a folha gera múltiplas páginas (ladrilhado)', async () => {
    // A4 retrato útil ~= 190x277mm (margem 10mm); uma peça de 500x500mm
    // não cabe numa página só em nenhuma das dimensões.
    const blob = await gerarPdfDeMoldesIndividuais([pecaRetangular('Grande', 500, 500)], {
      formato: 'A4',
      orientacao: 'retrato',
      margemMm: 10,
    });
    const texto = await paraTexto(blob);
    const paginas = texto.match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(paginas.length).toBeGreaterThan(1);
  });

  it('duas peças pequenas cada uma numa página geram 2 páginas no total', async () => {
    const blob = await gerarPdfDeMoldesIndividuais(
      [pecaRetangular('P1', 40, 40), pecaRetangular('P2', 40, 40)],
      { formato: 'A4', orientacao: 'retrato', margemMm: 10 },
    );
    const texto = await paraTexto(blob);
    const paginas = texto.match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(paginas).toHaveLength(2);
  });

  it('o conteúdo do rótulo da peça (nome/referência/tamanho) aparece no texto do PDF', async () => {
    const blob = await gerarPdfDeMoldesIndividuais([pecaRetangular('Frente', 60, 60)], {
      formato: 'A4',
      orientacao: 'retrato',
      margemMm: 10,
    });
    const texto = await paraTexto(blob);
    const textoDecodificado = decodificarTextoDoPdf(texto);
    expect(textoDecodificado).toMatch(/Frente/);
    expect(textoDecodificado).toMatch(/REF-Frente/);
  });
});

describe('gerarPdfDeMoldesIndividuais — o que foi anotado na peça', () => {
  const OPCOES = { formato: 'A4', orientacao: 'retrato', margemMm: 10 } as const;

  it('os textos da peça saem escritos, com as letras na altura pedida em mm', async () => {
    const peca = adicionarTexto(pecaRetangular('Frente', 80, 80), ponto(40, 40), 'DOBRA', 12, 't1');

    const texto = await paraTexto(await gerarPdfDeMoldesIndividuais([peca], OPCOES));

    expect(decodificarTextoDoPdf(texto)).toMatch(/DOBRA/);
    // "/F1 34.016 Tf": o tamanho da letra é 12 mm em pontos.
    const tamanhos = [...texto.matchAll(/\/F\d+ ([\d.]+) Tf/g)].map((m) => Number.parseFloat(m[1]!));
    expect(tamanhos.some((t) => Math.abs(t - mmParaPontos(12)) < 0.01)).toBe(true);
  });

  it('sem textos, nenhuma letra sai nesse tamanho', async () => {
    const texto = await paraTexto(await gerarPdfDeMoldesIndividuais([pecaRetangular('Frente', 80, 80)], OPCOES));

    expect(decodificarTextoDoPdf(texto)).not.toMatch(/DOBRA/);
    const tamanhos = [...texto.matchAll(/\/F\d+ ([\d.]+) Tf/g)].map((m) => Number.parseFloat(m[1]!));
    expect(tamanhos.some((t) => Math.abs(t - mmParaPontos(12)) < 0.01)).toBe(false);
  });

  it('o código do pique sai escrito ao lado dele', async () => {
    const comPique: Molde = { ...pecaRetangular('Frente', 80, 80), piques: [{ id: 'q1', posicao: ponto(80, 40), indiceAresta: 1 }] };

    const semCodigo = decodificarTextoDoPdf(await paraTexto(await gerarPdfDeMoldesIndividuais([comPique], OPCOES)));
    const comCodigo = decodificarTextoDoPdf(
      await paraTexto(await gerarPdfDeMoldesIndividuais([definirCodigoDoPique(comPique, 'q1', 'K7')], OPCOES)),
    );

    expect(semCodigo).not.toMatch(/K7/);
    expect(comCodigo).toMatch(/K7/);
  });

  it('a linha de simetria sai em traço e ponto por cima da aresta', async () => {
    const semLinha = await paraTexto(await gerarPdfDeMoldesIndividuais([pecaRetangular('Frente', 80, 80)], OPCOES));
    const comLinha = await paraTexto(
      await gerarPdfDeMoldesIndividuais([definirLinhaDeSimetria(pecaRetangular('Frente', 80, 80), 3)], OPCOES),
    );

    // O padrão de traço de quatro medidas (traço, vão, ponto, vão) só existe na linha de simetria.
    const tracoEPonto = /\[[\d.]+ [\d.]+ [\d.]+ [\d.]+\] 0 d/;
    expect(semLinha).not.toMatch(tracoEPonto);
    expect(comLinha).toMatch(tracoEPonto);
  });

  it('a linha auxiliar sai tracejada com o molde; o elemento de construção fica fora do PDF', async () => {
    const semLinhas = pecaRetangular('Frente', 80, 80);
    const comDuas: Molde = { ...semLinhas, linhasInternas: [[ponto(10, 20), ponto(70, 20)], [ponto(10, 60), ponto(70, 60)]] };
    // O traço das linhas internas: 1,5 mm de risco e 1 mm de vão.
    const tracejadas = async (peca: Molde): Promise<number> => [...(await paraTexto(await gerarPdfDeMoldesIndividuais([peca], OPCOES))).matchAll(/\[4\.25\d* 2\.83\d*\] 0 d/g)].length;

    expect(await tracejadas(semLinhas)).toBe(0);
    expect(await tracejadas(comDuas)).toBe(2);
    expect(await tracejadas(tornarElementos(comDuas, [1]))).toBe(1);
    expect(await tracejadas(tornarElementos(comDuas, [0, 1]))).toBe(0);
  });
});

describe('gerarPdfDeEncaixe — estrutura e escala', () => {
  it('produz um PDF de verdade com conteúdo', async () => {
    const blob = await gerarPdfDeEncaixe([pecaRetangular('P1', 50, 50)], enfestoBase(), {
      formato: 'A4',
      orientacao: 'retrato',
      margemMm: 10,
    });
    expect(blob.size).toBeGreaterThan(500);
    const texto = await paraTexto(blob);
    expect(texto.startsWith('%PDF-')).toBe(true);
  });

  it('uma área de enfesto pequena (cabe numa folha) gera 1 página', async () => {
    const blob = await gerarPdfDeEncaixe(
      [pecaRetangular('P1', 50, 50)],
      enfestoBase({ larguraUtilMm: 100, comprimentoMm: 100 } as Partial<ConfiguracaoDeEnfesto>),
      { formato: 'A4', orientacao: 'retrato', margemMm: 10 },
    );
    const texto = await paraTexto(blob);
    const paginas = texto.match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(paginas).toHaveLength(1);
  });

  it('uma área de enfesto grande (não cabe numa folha) gera múltiplas páginas ladrilhadas', async () => {
    const blob = await gerarPdfDeEncaixe(
      [pecaRetangular('P1', 50, 50)],
      enfestoBase({ larguraUtilMm: 1500, comprimentoMm: 3000 } as Partial<ConfiguracaoDeEnfesto>),
      { formato: 'A4', orientacao: 'retrato', margemMm: 10 },
    );
    const texto = await paraTexto(blob);
    const paginas = texto.match(/\/Type\s*\/Page[^s]/g) ?? [];
    expect(paginas.length).toBeGreaterThan(1);
  });

  it('a régua de referência de 100mm aparece no conteúdo (linha de comprimento correspondente a 100mm em pontos)', async () => {
    const blob = await gerarPdfDeEncaixe([pecaRetangular('P1', 50, 50)], enfestoBase(), {
      formato: 'A4',
      orientacao: 'retrato',
      margemMm: 10,
    });
    const texto = await paraTexto(blob);
    const textoDecodificado = decodificarTextoDoPdf(texto);
    expect(textoDecodificado).toMatch(/conferir escala/);
  });

  it('a linha de referência mede exatamente 100mm convertidos em pontos no conteúdo vetorial (não só o rótulo)', async () => {
    const blob = await gerarPdfDeEncaixe([pecaRetangular('P1', 50, 50)], enfestoBase(), {
      formato: 'A4',
      orientacao: 'retrato',
      margemMm: 10,
    });
    const texto = await paraTexto(blob);
    // Procura toda linha horizontal desenhada via moveTo/lineTo reais
    // ("X1 Y m" seguido de "X2 Y l" com o MESMO Y) e confirma que pelo
    // menos uma delas — a régua de referência — mede exatamente 100mm em
    // pontos (as demais são as arestas dos contornos das peças).
    const encontrados = [...texto.matchAll(/([\d.]+) ([\d.]+) m\n([\d.]+) \2 l/g)];
    expect(encontrados.length).toBeGreaterThan(0);
    const comprimentos = encontrados.map((m) => Math.abs(Number.parseFloat(m[3]!) - Number.parseFloat(m[1]!)));
    const algumaMede100mm = comprimentos.some((c) => Math.abs(c - mmParaPontos(100)) < 0.001);
    expect(algumaMede100mm).toBe(true);
  });

  it('rejeita peças fora do conteúdo sem lançar exceção (não crasha com projeto vazio)', async () => {
    const blob = await gerarPdfDeEncaixe([], enfestoBase(), { formato: 'A4', orientacao: 'retrato', margemMm: 10 });
    expect(blob.size).toBeGreaterThan(0);
  });
});

import { describe, it, expect } from 'vitest';
import { ponto, area } from '../core/geometria';
import { elementosDaPeca, linhasDoMolde, tornarElementos } from '../domain/linhasAuxiliares';
import { criarMolde, adicionarPique, adicionarMarca, type FormatoDePique, type Molde } from '../domain/molde';
import { inserirPique, inserirPiqueInterno } from '../domain/piques';
import { gerarPdfDeMoldesIndividuais } from './pdf-exportacao';
import { importarPdf, moldeDaPecaImportada } from './pdf-importacao';

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

  it('o pique com formato e o pique interno voltam no lugar em que estavam', async () => {
    const base = criarMolde({ nome: 'Frente', referencia: 'R', tamanho: 'M', contorno: [ponto(0, 0), ponto(60, 0), ponto(60, 80), ponto(0, 80)], linhaDeFio: { inicio: ponto(30, 10), fim: ponto(30, 70) } }, 'f');
    // Um V largo na borda — o primeiro traço dele não começa no meio da boca — e uma caixa interna.
    const comV = inserirPique(base, { indiceAresta: 0, ponto: ponto(40, 0) }, { tipo: 'v', larguraMm: 10, alturaMm: 8, anguloGraus: 0 }, 'p1');
    const original = inserirPiqueInterno(comV, ponto(20, 50), { tipo: 'caixa', larguraMm: 6, alturaMm: 10, anguloGraus: 0 }, 'm1');
    const blob = await gerarPdfDeMoldesIndividuais([original], { formato: 'A4', orientacao: 'retrato', margemMm: 10 });
    const importada = importarPdf(await paraTextoLatin1(blob)).pecas[0]!;

    expect(importada.piques).toHaveLength(1);
    expect(importada.piques[0]!.posicao.x).toBeCloseTo(40, 1);
    expect(importada.piques[0]!.posicao.y).toBeCloseTo(0, 1);
    expect(importada.piques[0]!.indiceAresta).toBe(0);
    expect(importada.marcas).toHaveLength(1);
    expect(importada.marcas[0]!.x).toBeCloseTo(20, 1);
    expect(importada.marcas[0]!.y).toBeCloseTo(50, 1);
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

describe('importarPdf — o que o desenho não diz volta pelo registro da peça', () => {
  const OPCOES = { formato: 'A4', orientacao: 'retrato', margemMm: 10 } as const;
  // A peça não começa na origem: o registro guarda as posições da página, e a importada volta encostada no canto.
  const CANTO = ponto(100, 200);
  const base = (extras: Partial<Molde> = {}): Molde => ({
    ...criarMolde({ nome: 'Frente', referencia: 'R', tamanho: 'M', contorno: [ponto(100, 200), ponto(160, 200), ponto(160, 280), ponto(100, 280)], linhaDeFio: { inicio: ponto(130, 210), fim: ponto(130, 270) }, margemDeCosturaMm: 10 }, 'f'),
    ...extras,
  });
  const EM_L: FormatoDePique = { tipo: 'cadastrado:c1', larguraMm: 6, alturaMm: 10, anguloGraus: 15, nome: 'Pé', forma: [[ponto(0, 0), ponto(0, 1), ponto(0.5, 1)]], espelhado: true };
  const DO_V: FormatoDePique = { tipo: 'v', larguraMm: 10, alturaMm: 8, anguloGraus: -20 };
  const ids = (): (() => string) => {
    let n = 0;
    return () => 'n' + ++n;
  };
  const idaEVolta = async (peca: Molde) => {
    const texto = await paraTextoLatin1(await gerarPdfDeMoldesIndividuais([peca], OPCOES));
    const resultado = importarPdf(texto);
    return { texto, resultado, molde: resultado.pecas[0] ? moldeDaPecaImportada(resultado.pecas[0], ids()) : null };
  };
  /** O ponto da peça original como fica na importada: contado do canto dela. */
  const naImportada = (q: { x: number; y: number }) => ponto(q.x - CANTO.x, q.y - CANTO.y);
  const perto = (a: { x: number; y: number }, b: { x: number; y: number }, casas = 3): void => {
    expect(a.x).toBeCloseTo(b.x, casas);
    expect(a.y).toBeCloseTo(b.y, casas);
  };

  it('a peça sem nada disso sai sem registro, e volta como sempre voltou', async () => {
    const { texto, resultado, molde } = await idaEVolta(base({ piques: [{ id: 'p', posicao: ponto(130, 200), indiceAresta: 0 }], marcas: [{ id: 'm', posicao: ponto(120, 240) }], linhasInternas: [[ponto(105, 205), ponto(155, 205)]] }));

    expect(texto).not.toContain('enfesto-cad:peca');
    expect(resultado.avisos).toEqual([]);
    expect(molde!.piques.map((q) => q.formato)).toEqual([undefined]);
    expect(molde!.marcas.map((m) => m.formato)).toEqual([undefined]);
    expect('textos' in molde!).toBe(false);
    expect('elementos' in molde!).toBe(false);
  });

  it('o formato, o pique na costura e o código de cada pique do contorno voltam como eram', async () => {
    const original = base({
      piques: [
        { id: 'a', posicao: ponto(130, 200), indiceAresta: 0, formato: DO_V, naCostura: 'estendido', codigo: 'K7' },
        { id: 'b', posicao: ponto(160, 240), indiceAresta: 1, formato: EM_L },
        { id: 'c', posicao: ponto(110, 280), indiceAresta: 2 },
      ],
    });
    const { texto, resultado, molde } = await idaEVolta(original);

    expect(texto).toMatch(/\n% enfesto-cad:peca:1 [0-9a-f]+\n/);
    expect(resultado.avisos).toEqual([]);
    expect(molde!.piques).toHaveLength(3);
    for (const pique of original.piques) {
      const voltou = molde!.piques.find((q) => Math.hypot(q.posicao.x - naImportada(pique.posicao).x, q.posicao.y - naImportada(pique.posicao).y) < 0.01)!;
      expect(voltou.formato).toEqual(pique.formato);
      expect(voltou.naCostura).toBe(pique.naCostura);
      expect(voltou.codigo).toBe(pique.codigo);
      expect(voltou.indiceAresta).toBe(pique.indiceAresta);
    }
  });

  it('o pique interno volta com o formato e no ponto em que estava — não no meio do desenho dele; o ponto sem formato continua ponto', async () => {
    const original = base({
      marcas: [
        { id: 'm', posicao: ponto(120, 250), formato: { ...EM_L, anguloGraus: 40 } },
        { id: 'n', posicao: ponto(145, 245) },
      ],
    });
    const { resultado, molde } = await idaEVolta(original);

    expect(resultado.pecas[0]!.formatosDasMarcas).toEqual([{ ...EM_L, anguloGraus: 40 }, null]);
    expect(molde!.marcas.map((m) => m.formato)).toEqual([{ ...EM_L, anguloGraus: 40 }, undefined]);
    perto(molde!.marcas[0]!.posicao, naImportada(ponto(120, 250)));
    perto(molde!.marcas[1]!.posicao, naImportada(ponto(145, 245)));
  });

  it('os textos da peça voltam, com a altura, o ângulo e a âncora — e a página com texto continua sendo reconhecida', async () => {
    const original = base({
      textos: [
        { id: 't', posicao: ponto(130, 240), texto: 'BOLSO', alturaMm: 6, anguloGraus: 30, ancora: 'fim' },
        { id: 'u', posicao: ponto(120, 260), texto: 'Dobra (meio) A', alturaMm: 4 },
      ],
      piques: [{ id: 'a', posicao: ponto(130, 200), indiceAresta: 0, codigo: 'K7' }],
    });
    const { resultado, molde } = await idaEVolta(original);

    expect(resultado.pecas).toHaveLength(1);
    expect(molde!.nome).toBe('Frente');
    expect(molde!.referencia).toBe('R');
    expect(molde!.tamanho).toBe('M');
    expect(molde!.textos).toMatchObject([{ texto: 'BOLSO', alturaMm: 6, anguloGraus: 30, ancora: 'fim' }, { texto: 'Dobra (meio) A', alturaMm: 4 }]);
    // O texto sem ângulo volta sem ângulo: continua sempre na horizontal.
    expect(Object.keys(molde!.textos![1]!).sort()).toEqual(['alturaMm', 'id', 'posicao', 'texto']);
    perto(molde!.textos![0]!.posicao, naImportada(ponto(130, 240)));
    expect(new Set(molde!.textos!.map((t) => t.id)).size).toBe(2);
    expect(molde!.piques[0]!.codigo).toBe('K7');
  });

  it('a linha só de construção não é desenhada, e volta: está na peça importada, como elemento', async () => {
    const original = tornarElementos(base({ linhasInternas: [[ponto(105, 205), ponto(155, 205)], [ponto(110, 220), ponto(150, 220), ponto(150, 260)]] }), [1]);
    const { texto, molde } = await idaEVolta(original);

    // Na folha, só a linha que faz parte do molde (o traço de 1,5 mm por 1 mm).
    expect([...texto.matchAll(/\[4\.25\d* 2\.83\d*\] 0 d/g)]).toHaveLength(1);
    expect(molde!.linhasInternas).toHaveLength(2);
    expect(elementosDaPeca(molde!)).toEqual([1]);
    expect(linhasDoMolde(molde!)).toHaveLength(1);
    molde!.linhasInternas[1]!.forEach((q, i) => perto(q, naImportada(original.linhasInternas[1]![i]!)));
  });

  it('com o registro estragado, a peça volta só pelo desenho, e o aviso diz', async () => {
    const original = base({ piques: [{ id: 'a', posicao: ponto(130, 200), indiceAresta: 0, formato: DO_V }], textos: [{ id: 't', posicao: ponto(130, 240), texto: 'BOLSO', alturaMm: 6 }] });
    const texto = await paraTextoLatin1(await gerarPdfDeMoldesIndividuais([original], OPCOES));
    const estragado = texto.replace(/(\n% enfesto-cad:peca:1 [0-9a-f]+)\n/, (_, linha: string) => linha.slice(0, -3) + '\n');
    expect(estragado).not.toBe(texto);
    const resultado = importarPdf(estragado);

    expect(resultado.pecas).toHaveLength(1);
    expect(resultado.avisos).toEqual(['Peça "Frente": o registro das marcações deste PDF não pôde ser lido — a peça volta só pelo desenho: os piques como traços, sem os textos nem as linhas de construção.']);
    const molde = moldeDaPecaImportada(resultado.pecas[0]!, ids());
    expect(molde.piques.map((q) => q.formato)).toEqual([undefined]);
    expect('textos' in molde).toBe(false);
  });

  it('o registro que não bate com o desenho não é imposto: marcas em outro número ficam as do desenho, e pique fora do lugar fica sem formato', async () => {
    const comUma = base({ marcas: [{ id: 'm', posicao: ponto(120, 250), formato: DO_V }], piques: [{ id: 'a', posicao: ponto(130, 200), indiceAresta: 0, formato: DO_V }] });
    const comDuas = base({ marcas: [{ id: 'm', posicao: ponto(120, 250), formato: EM_L }, { id: 'n', posicao: ponto(145, 245), formato: EM_L }], piques: [{ id: 'a', posicao: ponto(140, 200), indiceAresta: 0, formato: EM_L }] });
    const textoDeUma = await paraTextoLatin1(await gerarPdfDeMoldesIndividuais([comUma], OPCOES));
    const textoDeDuas = await paraTextoLatin1(await gerarPdfDeMoldesIndividuais([comDuas], OPCOES));
    const registroDeDuas = textoDeDuas.match(/\n(% enfesto-cad:peca:1 [0-9a-f]+)\n/)![1]!;
    // O desenho de uma peça com o registro da outra.
    const trocado = textoDeUma.replace(/\n% enfesto-cad:peca:1 [0-9a-f]+\n/, () => '\n' + registroDeDuas + '\n');
    const molde = moldeDaPecaImportada(importarPdf(trocado).pecas[0]!, ids());

    expect(molde.marcas).toHaveLength(1);
    expect(molde.marcas[0]!.formato).toBeUndefined();
    expect(molde.piques).toHaveLength(1);
    expect(molde.piques[0]!.formato).toBeUndefined();
  });

  it('a peça sem tamanho e sem referência também é reconhecida, e volta sem um e sem outra', async () => {
    const { resultado, molde } = await idaEVolta(base({ tamanho: '', referencia: '', textos: [{ id: 't', posicao: ponto(130, 240), texto: 'A', alturaMm: 6 }] }));

    expect(resultado.pecas).toHaveLength(1);
    expect(molde!.nome).toBe('Frente');
    expect(molde!.tamanho).toBe('');
    expect(molde!.referencia).toBe('');
    expect(molde!.textos).toHaveLength(1);
  });

  it('a peça sem linha de fio não vira molde', () => {
    expect(() => moldeDaPecaImportada({ nome: 'X', referencia: '', tamanho: 'M', contorno: [ponto(0, 0), ponto(10, 0), ponto(10, 10)], furos: [], linhasInternas: [], linhaDeFio: null, piques: [], marcas: [], margemDeCosturaMm: 0, quantidade: 1 }, ids())).toThrow('A peça "X" não tem linha de fio.');
  });
});

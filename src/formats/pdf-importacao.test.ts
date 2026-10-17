import { describe, it, expect } from 'vitest';
import { ponto, area } from '../core/geometria';
import { elementosDaPeca, linhasDoMolde, tornarElementos } from '../domain/linhasAuxiliares';
import { criarMolde, adicionarPique, adicionarMarca, transladarMolde, type FormatoDePique, type Molde } from '../domain/molde';
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
    // A folha começa na linha de corte, 10 mm (a costura) antes do contorno: na página, tudo fica 10 mm adiante.
    expect(importada.piques).toHaveLength(1);
    expect(importada.piques[0]!.posicao.x).toBeCloseTo(30 + 10, 0);
    expect(importada.piques[0]!.posicao.y).toBeCloseTo(0 + 10, 0);
    expect(importada.marcas).toHaveLength(1);
    expect(importada.marcas[0]!.x).toBeCloseTo(45 + 10, 0);
    expect(importada.marcas[0]!.y).toBeCloseTo(45 + 10, 0);
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

  it('a peça maior que uma folha sai em várias páginas e volta inteira: a primeira página traz o desenho todo', async () => {
    const grande = pecaCompleta('Grande', {
      contorno: [ponto(0, 0), ponto(500, 0), ponto(500, 500), ponto(0, 500)],
      linhaDeFio: { inicio: ponto(250, 50), fim: ponto(250, 450) },
      furos: [],
      linhasInternas: [[ponto(50, 480), ponto(450, 480)]],
    });
    const pequena = pecaCompleta('Pequena');
    const texto = await paraTextoLatin1(await gerarPdfDeMoldesIndividuais([grande, pequena], { formato: 'A4', orientacao: 'retrato', margemMm: 10 }));
    const resultado = importarPdf(texto);

    // Seis páginas da grande (3 × 2) e uma da pequena; o registro vai só na primeira página de cada peça.
    expect(texto).toMatch(/\/Count 7\b/);
    expect([...texto.matchAll(/\n% enfesto-cad:peca:2 /g)]).toHaveLength(2);
    expect(resultado.avisos).toEqual([]);
    expect(resultado.pecas.map((p) => p.nome)).toEqual(['Grande', 'Pequena']);
    const importada = resultado.pecas[0]!;
    expect(importada.contorno).toHaveLength(4);
    expect(area(importada.contorno)).toBeCloseTo(500 * 500, 0);
    // A linha que só aparece em outra página (está no fim da peça) também volta.
    expect(importada.linhasInternas).toHaveLength(1);
    expect(importada.linhasInternas[0]![0]!.y).toBeCloseTo(480 + 10, 1); // + a costura: a folha começa na linha de corte
    expect(importada.quantidade).toBe(3);
  });

  it('PDF sem nenhuma peça reconhecível (texto arbitrário) não lança exceção e avisa', () => {
    const resultado = importarPdf('%PDF-1.3\nqualquer coisa\n%%EOF');
    expect(resultado.pecas).toHaveLength(0);
    expect(resultado.avisos.length).toBeGreaterThan(0);
  });
});

describe('importarPdf — a peça inteira volta pelo registro que vai na página dela', () => {
  const OPCOES = { formato: 'A4', orientacao: 'retrato', margemMm: 10 } as const;
  // A peça não começa na origem: o registro guarda as posições da página, e a importada volta encostada no canto.
  // O canto da página é o da linha de corte: o contorno começa em (100, 200), e a costura de 10 mm, 10 mm antes.
  const CANTO = ponto(90, 190);
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
  /** A peça original como fica na página: levada para o canto dela. */
  const naPagina = (peca: Molde): Molde => transladarMolde(peca, ponto(0 - CANTO.x, 0 - CANTO.y), peca.id);

  it('toda peça sai com o registro, e o que o desenho não diz volta: os formatos, o código, o pique interno no lugar, os textos e a graduação', async () => {
    const original = base({
      piques: [
        { id: 'a', posicao: ponto(130, 200), indiceAresta: 0, formato: DO_V, naCostura: 'estendido', codigo: 'K7', graduacao: { referencia: ponto(100, 200), perimetros: [-2, 0, 2] } },
        { id: 'b', posicao: ponto(160, 240), indiceAresta: 1, formato: EM_L },
        { id: 'c', posicao: ponto(110, 280), indiceAresta: 2 },
      ],
      marcas: [
        { id: 'm', posicao: ponto(120, 250), formato: { ...EM_L, anguloGraus: 40 }, alinhamento: { deslocamentos: [ponto(0, -3), ponto(0, 0), ponto(0, 3)] } },
        { id: 'n', posicao: ponto(145, 245) },
      ],
      textos: [
        { id: 't', posicao: ponto(130, 240), texto: 'BOLSO', alturaMm: 6, anguloGraus: 30, ancora: 'fim' },
        { id: 'u', posicao: ponto(120, 260), texto: 'Dobra (meio) A', alturaMm: 4 },
      ],
      graduacao: { tamanhos: ['P', 'M', 'G'], base: 1, pontos: [{ posicao: ponto(160, 280), deslocamentos: [ponto(-5, -5), ponto(0, 0), ponto(5, 5)] }] },
      cor: '#ffe0b2',
      linhaDeSimetria: { de: ponto(100, 200), ate: ponto(100, 280) },
      restricaoDeRotacao: { permite180: true, permite90e270: false, permiteEspelhamento: true },
      quantidade: 4,
    });
    const { texto, resultado, molde } = await idaEVolta(original);

    expect(texto).toMatch(/\n% enfesto-cad:peca:2 [A-Za-z0-9+/=]+\n/);
    expect(resultado.avisos).toEqual([]);
    // A do registro é a original, levada para a página; a que vira molde do projeto só troca os identificadores.
    expect(resultado.pecas[0]!.molde).toEqual(naPagina(original));
    const semIds = (peca: Molde) => JSON.parse(JSON.stringify(peca, (chave, valor: unknown) => (chave === 'id' ? undefined : valor))) as unknown;
    expect(semIds(molde!)).toEqual(semIds(naPagina(original)));
    expect(molde!.piques.map((q) => q.formato)).toEqual([DO_V, EM_L, undefined]);
    expect(molde!.marcas[0]!.posicao).toEqual(ponto(30, 60));
    expect(molde!.graduacao!.tamanhos).toEqual(['P', 'M', 'G']);
  });

  it('a peça que vira molde do projeto tem identificadores novos, e as listas que apontam para os piques acompanham', async () => {
    const original = base({
      piques: [{ id: 'a', posicao: ponto(130, 200), indiceAresta: 0 }, { id: 'b', posicao: ponto(160, 240), indiceAresta: 1 }],
      marcas: [{ id: 'm', posicao: ponto(120, 250) }],
      pences: [{ id: 'pe', tipo: 'marcada', pontos: [ponto(120, 200), ponto(130, 230), ponto(140, 200)], piques: ['a', 'b'], marcas: ['m'] }],
      pregas: [{ id: 'pr', modo: 'dupla', parada: [ponto(100, 220), ponto(160, 220)], movida: [ponto(100, 230), ponto(160, 230)], linhas: [], pontasCriadas: [true, false], piques: ['b'] }],
      cunhas: [{ id: 'cu', travessias: [{ parada: ponto(100, 250), movida: ponto(100, 255), criada: true }], posicao: 0, pivo: 1, linhas: [], piques: ['a'] }],
      textos: [{ id: 't', posicao: ponto(130, 240), texto: 'A', alturaMm: 6 }],
      cotas: [{ id: 'co', tipo: 'perimetro', posicao: ponto(130, 260) }],
      curvas: [{ id: 'cv', tipo: 'curva', controles: [ponto(100, 200), ponto(130, 205), ponto(160, 200)], pontos: [ponto(100, 200), ponto(160, 200)] }],
      dobraMantida: { de: ponto(100, 200), ate: ponto(100, 280), contorno: [ponto(100, 200), ponto(40, 200), ponto(40, 280), ponto(100, 280)], furos: [], linhasInternas: [], marcas: [{ id: 'gm', posicao: ponto(60, 240) }], piques: [{ id: 'gp', posicao: ponto(70, 200), indiceAresta: 0 }] },
    });
    const molde = (await idaEVolta(original)).molde!;
    const [a, b] = molde.piques.map((q) => q.id);
    const todos = [molde.id, a!, b!, molde.marcas[0]!.id, molde.pences![0]!.id, molde.pregas![0]!.id, molde.cunhas![0]!.id, molde.textos![0]!.id, molde.cotas![0]!.id, molde.curvas![0]!.id];

    expect(new Set(todos).size).toBe(10);
    // Os da metade guardada pela dobra também são novos.
    expect([molde.dobraMantida!.marcas[0]!.id, molde.dobraMantida!.piques[0]!.id].every((id) => /^n\d+$/.test(id) && !todos.includes(id))).toBe(true);
    expect(todos.every((id) => /^n\d+$/.test(id))).toBe(true);
    expect(molde.pences![0]!.piques).toEqual([a, b]);
    expect(molde.pences![0]!.marcas).toEqual([molde.marcas[0]!.id]);
    expect(molde.pregas![0]!.piques).toEqual([b]);
    expect(molde.cunhas![0]!.piques).toEqual([a]);
  });

  it('a linha só de construção não é desenhada, e volta: está na peça importada, como elemento', async () => {
    const original = tornarElementos(base({ linhasInternas: [[ponto(105, 205), ponto(155, 205)], [ponto(110, 220), ponto(150, 220), ponto(150, 260)]] }), [1]);
    const { texto, resultado, molde } = await idaEVolta(original);

    // Na folha, só a linha que faz parte do molde (o traço de 1,5 mm por 1 mm): é o que a peça tem pelo desenho.
    expect([...texto.matchAll(/\[4\.25\d* 2\.83\d*\] 0 d/g)]).toHaveLength(1);
    expect(resultado.pecas[0]!.linhasInternas).toHaveLength(1);
    expect(molde!.linhasInternas).toHaveLength(2);
    expect(elementosDaPeca(molde!)).toEqual([1]);
    expect(linhasDoMolde(molde!)).toHaveLength(1);
  });

  it('a página com texto ou pique com código continua sendo reconhecida; e a peça sem tamanho e sem referência também', async () => {
    const comTexto = await idaEVolta(base({ textos: [{ id: 'u', posicao: ponto(120, 260), texto: 'Dobra (meio) A', alturaMm: 4 }], piques: [{ id: 'a', posicao: ponto(130, 200), indiceAresta: 0, codigo: 'K7' }] }));
    expect(comTexto.resultado.pecas.map((p) => [p.nome, p.referencia, p.tamanho])).toEqual([['Frente', 'R', 'M']]);

    const semTamanho = await idaEVolta(base({ tamanho: '', referencia: '' }));
    expect(semTamanho.resultado.pecas.map((p) => [p.nome, p.referencia, p.tamanho])).toEqual([['Frente', '', '']]);
    expect(semTamanho.molde!.tamanho).toBe('');
  });

  it('com o registro estragado, a peça volta só pelo desenho, e o aviso diz', async () => {
    const original = base({ piques: [{ id: 'a', posicao: ponto(130, 200), indiceAresta: 0, formato: DO_V }], textos: [{ id: 't', posicao: ponto(130, 240), texto: 'BOLSO', alturaMm: 6 }], marcas: [{ id: 'm', posicao: ponto(120, 250) }] });
    const texto = await paraTextoLatin1(await gerarPdfDeMoldesIndividuais([original], OPCOES));
    const estragado = texto.replace(/(\n% enfesto-cad:peca:2 [A-Za-z0-9+/=]+)\n/, (_, linha: string) => linha.slice(0, -7) + '\n');
    expect(estragado).not.toBe(texto);
    const resultado = importarPdf(estragado);

    expect(resultado.pecas).toHaveLength(1);
    expect(resultado.pecas[0]!.molde).toBeUndefined();
    expect(resultado.avisos).toEqual(['Peça "Frente": o registro da peça neste PDF não pôde ser lido — ela volta só pelo desenho: os piques como traços, sem os textos, as linhas de construção, a graduação nem os outros registros.']);
    const molde = moldeDaPecaImportada(resultado.pecas[0]!, ids());
    expect(molde.piques.map((q) => [q.formato, q.indiceAresta])).toEqual([[undefined, 0]]);
    expect(molde.marcas).toHaveLength(1);
    expect(molde.margemDeCosturaMm).toBeCloseTo(10, 0);
    expect(molde.quantidade).toBe(1);
    expect('textos' in molde).toBe(false);
    expect(new Set([molde.id, molde.piques[0]!.id, molde.marcas[0]!.id]).size).toBe(3);
  });

  it('o registro de outra peça não é imposto ao desenho: sem o mesmo contorno, vale só o desenho, e o aviso diz', async () => {
    const estreita = base({ piques: [{ id: 'a', posicao: ponto(130, 200), indiceAresta: 0, formato: DO_V }] });
    // A outra tem o canto de cima meio milímetro adiante: não é o mesmo contorno.
    const outra: Molde = { ...base({ piques: [{ id: 'a', posicao: ponto(130, 200), indiceAresta: 0, formato: EM_L }] }), contorno: [ponto(100, 200), ponto(160, 200), ponto(160.5, 280), ponto(100, 280)] };
    const textoDaEstreita = await paraTextoLatin1(await gerarPdfDeMoldesIndividuais([estreita], OPCOES));
    const textoDaOutra = await paraTextoLatin1(await gerarPdfDeMoldesIndividuais([outra], OPCOES));
    const registroDaOutra = textoDaOutra.match(/\n(% enfesto-cad:peca:2 [A-Za-z0-9+/=]+)\n/)![1]!;
    const trocado = textoDaEstreita.replace(/\n% enfesto-cad:peca:2 [A-Za-z0-9+/=]+\n/, () => '\n' + registroDaOutra + '\n');
    const resultado = importarPdf(trocado);

    expect(resultado.pecas[0]!.molde).toBeUndefined();
    expect(resultado.avisos).toEqual(['Peça "Frente": o registro da peça neste PDF não confere com o desenho — ela volta só pelo desenho: os piques como traços, sem os textos, as linhas de construção, a graduação nem os outros registros.']);
    expect(moldeDaPecaImportada(resultado.pecas[0]!, ids()).piques[0]!.formato).toBeUndefined();
    // O registro de uma peça com outro número de pontos também não confere.
    const comCincoPontos: Molde = { ...base(), contorno: [ponto(100, 200), ponto(130, 200), ponto(160, 200), ponto(160, 280), ponto(100, 280)] };
    const registroDaDeCinco = (await paraTextoLatin1(await gerarPdfDeMoldesIndividuais([comCincoPontos], OPCOES))).match(/\n(% enfesto-cad:peca:2 [A-Za-z0-9+/=]+)\n/)![1]!;
    const comODeCinco = importarPdf(textoDaEstreita.replace(/\n% enfesto-cad:peca:2 [A-Za-z0-9+/=]+\n/, () => '\n' + registroDaDeCinco + '\n'));
    expect(comODeCinco.pecas[0]!.molde).toBeUndefined();
    expect(comODeCinco.avisos).toHaveLength(1);
    // Nem o registro com menos pontos que o desenho, mesmo que os que ele tem sejam os primeiros do desenho.
    const comUmPontoAMais: Molde = { ...base(), contorno: [ponto(100, 200), ponto(160, 200), ponto(160, 280), ponto(100, 280), ponto(100, 240)] };
    const registroDaEstreita = textoDaEstreita.match(/\n(% enfesto-cad:peca:2 [A-Za-z0-9+/=]+)\n/)![1]!;
    const desenhoComMaisPontos = (await paraTextoLatin1(await gerarPdfDeMoldesIndividuais([comUmPontoAMais], OPCOES))).replace(/\n% enfesto-cad:peca:2 [A-Za-z0-9+/=]+\n/, () => '\n' + registroDaEstreita + '\n');
    expect(importarPdf(desenhoComMaisPontos).pecas[0]!.molde).toBeUndefined();
    // O da própria peça confere, mesmo com os números do desenho arredondados na folha.
    expect(importarPdf(textoDaOutra).pecas[0]!.molde).toBeDefined();
  });

  it('sem o registro (um PDF de antes dele), a peça volta pelo desenho, sem aviso', async () => {
    const texto = await paraTextoLatin1(await gerarPdfDeMoldesIndividuais([base({ piques: [{ id: 'a', posicao: ponto(130, 200), indiceAresta: 0, formato: DO_V }] })], OPCOES));
    const semRegistro = texto.replace(/\n% enfesto-cad:peca:2 [A-Za-z0-9+/=]+\n/, () => '\n');
    const resultado = importarPdf(semRegistro);

    expect(resultado.avisos).toEqual([]);
    expect(resultado.pecas[0]!.molde).toBeUndefined();
    expect(resultado.pecas[0]!.piques).toHaveLength(1);
  });

  it('a peça sem linha de fio e sem registro não vira molde', () => {
    expect(() => moldeDaPecaImportada({ nome: 'X', referencia: '', tamanho: 'M', contorno: [ponto(0, 0), ponto(10, 0), ponto(10, 10)], furos: [], linhasInternas: [], linhaDeFio: null, piques: [], marcas: [], margemDeCosturaMm: 0, quantidade: 1 }, ids())).toThrow('A peça "X" não tem linha de fio.');
  });
});

import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde, rotacionarMolde, transladarMolde, type Molde } from './molde';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from './enfesto';
import { aplicar, colocacaoNaPeca, eixosDaPecaNoEncaixe, estampaDaPeca, IMPRESSAO_VAZIA, lerImpressaoDigital, trechosDoComprimento, type ImpressaoDigital } from './impressaoDigital';
import { gerarPdfParaImpressaoDigital } from '../formats/impressao-exportacao';

/** Uma peça em pé na tela: 300 mm de altura (o x do mundo, descendo) e 200 de largura (o y), o fio na vertical. */
function pecaEmPe(id = 'p'): Molde {
  return criarMolde({ nome: id, referencia: 'R', tamanho: 'M', contorno: [ponto(0, 0), ponto(0, 200), ponto(300, 200), ponto(300, 0)], linhaDeFio: { inicio: ponto(250, 100), fim: ponto(50, 100) } }, id);
}

const perto = (p: { x: number; y: number }, x: number, y: number): void => {
  expect(p.x).toBeCloseTo(x, 6);
  expect(p.y).toBeCloseTo(y, 6);
};

describe('a estampa no encaixe — onde a imagem vai', () => {
  it('na peça em pé, a localizada fica no meio, de pé: o alto da imagem no alto da peça', () => {
    const m = colocacaoNaPeca(pecaEmPe(), { imagemId: 'i', modo: 'localizada', larguraMm: 100, alturaMm: 0 }, 100, 50, 3);
    expect(m.ladrilhos).toEqual([{ x: 0, y: 0 }]);
    // O canto de cima à esquerda da imagem: 25 mm acima do meio (o x do mundo menor) e 50 à esquerda (o y menor).
    perto(aplicar(m.imagemParaMundo, { x: 0, y: 0 }), 125, 50);
    perto(aplicar(m.imagemParaMundo, { x: 100, y: 0 }), 125, 150);
    perto(aplicar(m.imagemParaMundo, { x: 0, y: 50 }), 175, 50);
  });

  it('a peça que o encaixe virou (180°) continua com a estampa de pé — virada junto com ela', () => {
    const virada = rotacionarMolde(pecaEmPe(), 180);
    expect(virada.anguloDeRotacaoGraus).toBe(180);
    const m = colocacaoNaPeca(virada, { imagemId: 'i', modo: 'localizada', larguraMm: 100, alturaMm: 20 }, 100, 50, 3);
    // O mesmo canto, girado 180° em volta do meio da peça (150, 100), e os 20 mm de subida também virados.
    perto(aplicar(m.imagemParaMundo, { x: 0, y: 0 }), 300 - 105, 200 - 50);
    expect(eixosDaPecaNoEncaixe(virada).cima.y).toBeCloseTo(-1, 6);
    // Girada 90°: o alto da peça aponta para a direita da tela.
    expect(eixosDaPecaNoEncaixe(rotacionarMolde(pecaEmPe(), 90)).cima.x).toBeCloseTo(-1, 6);
  });

  it('o alto pela forma: a saia virada no arquivo fica com a cintura (a ponta estreita) em cima; a calça, com a larga; e o giro pedido', () => {
    // A barra (560 mm) em cima na tela e a cintura (400) embaixo; o fio apontando para cima.
    const virada = (nome: string): Molde =>
      criarMolde({ nome, referencia: 'R', tamanho: 'M', contorno: [ponto(0, 0), ponto(0, 560), ponto(550, 480), ponto(550, 80)], linhaDeFio: { inicio: ponto(500, 280), fim: ponto(50, 280) } }, nome);
    expect(eixosDaPecaNoEncaixe(virada('Saia')).cima.y).toBeCloseTo(-1, 6);
    expect(eixosDaPecaNoEncaixe(virada('Calça frente')).cima.y).toBeCloseTo(1, 6);
    // Girada 90° a mais (no sentido horário): o alto aponta para a esquerda da tela.
    expect(eixosDaPecaNoEncaixe(virada('Saia'), 90).cima.x).toBeCloseTo(-1, 6);
    expect(lerImpressaoDigital({ giroPorPeca: { a: 90, b: 360, c: 'x', d: -90 } }).giroPorPeca).toEqual({ a: 90, d: 270 });
  });

  it('a manga (pelo nome), inclinada no arquivo e sem fio: a estampa de pé no eixo dela, do punho ao alto da cabeça', () => {
    // A cabeça em parábola (300 de corda, 82 de altura) em cima, o punho de 280 embaixo, girada 135° no arquivo.
    const cabeca = Array.from({ length: 25 }, (_, k) => { const x = 150 - (300 * k) / 24; return ponto(82 * (x / 150) ** 2, x + 400); });
    const manga = rotacionarMolde(criarMolde({ nome: 'Manga', referencia: 'R', tamanho: 'M', contorno: [...cabeca, ponto(200, 260), ponto(200, 540)], linhaDeFio: { inicio: ponto(0, 0), fim: ponto(0, 100) } }, 'm'), 135);
    const { cima } = eixosDaPecaNoEncaixe(manga);
    // Na tela (x = y do mundo, y para cima = −x): do meio do punho ao alto da cabeça (o ponto 12).
    const tela = (p: { x: number; y: number }) => ({ x: p.y, y: -p.x });
    const alto = tela(manga.contorno[12]!);
    const punho = tela({ x: (manga.contorno[25]!.x + manga.contorno[26]!.x) / 2, y: (manga.contorno[25]!.y + manga.contorno[26]!.y) / 2 });
    const L = Math.hypot(alto.x - punho.x, alto.y - punho.y);
    expect(cima.x).toBeCloseTo((alto.x - punho.x) / L, 6);
    expect(cima.y).toBeCloseTo((alto.y - punho.y) / L, 6);
  });

  it('a corrida cobre a peça inteira com a sangria, a partir do canto de cima à esquerda', () => {
    const m = colocacaoNaPeca(pecaEmPe(), { imagemId: 'i', modo: 'corrida', larguraMm: 50, alturaMm: 0 }, 100, 50, 3);
    // 50 × 25 mm por cópia, numa peça de 200 × 300 mm de face, com 3 mm de sangria: 5 colunas e 13 linhas.
    expect(m.ladrilhos).toHaveLength(65);
    perto(aplicar(m.imagemParaMundo, { x: 0, y: 0 }), -3, -3);
  });

  it('a estampa de cada peça (a de todas, a dela, ou nenhuma); os trechos de até 5 m; a leitura', () => {
    const e = { imagemId: 'i', modo: 'corrida' as const, larguraMm: 80, alturaMm: 0 };
    const config: ImpressaoDigital = { ...IMPRESSAO_VAZIA, padrao: e, porPeca: { b: null, c: { ...e, imagemId: 'j' } } };
    expect([estampaDaPeca(config, 'a'), estampaDaPeca(config, 'b'), estampaDaPeca(config, 'c')?.imagemId]).toEqual([e, null, 'j']);
    expect(trechosDoComprimento(12000)).toEqual([
      { de: 0, ate: 5000 },
      { de: 5000, ate: 10000 },
      { de: 10000, ate: 12000 },
    ]);
    expect(lerImpressaoDigital({ padrao: { imagemId: 'i', larguraMm: 1 }, porPeca: { b: null, x: 'lixo' }, sangriaMm: 99, linhaDeCorte: false })).toEqual({
      padrao: { imagemId: 'i', modo: 'corrida', larguraMm: 5, alturaMm: 0 },
      porPeca: { b: null },
      sangriaMm: 30,
      linhaDeCorte: false,
    });
    expect(lerImpressaoDigital(undefined)).toBe(IMPRESSAO_VAZIA);
  });
});

describe('a estampa no encaixe — o PDF para a impressão', () => {
  // Um PNG de 1 × 1 ponto vermelho.
  const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  const enfesto: ConfiguracaoDeEnfesto = criarConfiguracaoDeEnfesto({
    tipo: 'impar',
    larguraUtilMm: 1500,
    comprimentoMm: 8000,
    quantidadeDeCamadas: 1,
    margemLateralMm: 0,
    margemDeExtremidadeMm: 10,
    distanciaMinimaEntrePecasMm: 5,
  } as ConfiguracaoDeEnfesto);

  it('uma página na escala 1:1 (a largura do tecido × o comprimento usado), a imagem uma vez, um recorte por peça com estampa e a linha de corte', async () => {
    const pecas = [pecaEmPe('a'), transladarMolde(pecaEmPe('b'), ponto(400, 300), 'b'), transladarMolde(pecaEmPe('c'), ponto(0, 600), 'c')];
    const config: ImpressaoDigital = { padrao: { imagemId: 'img', modo: 'corrida', larguraMm: 100, alturaMm: 0 }, porPeca: { c: null }, sangriaMm: 3, linhaDeCorte: true };
    const blob = await gerarPdfParaImpressaoDigital(pecas, enfesto, new Map([['img', { dados: PNG, larguraPx: 1, alturaPx: 1 }]]), config, 'Teste');
    const texto = Buffer.from(await blob.arrayBuffer()).toString('latin1');
    const k = 72 / 25.4;
    // O comprimento usado: a ponta mais distante (800 mm) mais a margem de extremidade (10).
    const caixa = /\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/.exec(texto)!;
    expect(Number(caixa[1])).toBeCloseTo(1500 * k, 3);
    expect(Number(caixa[2])).toBeCloseTo(810 * k, 3);
    // A imagem entra uma vez para as duas peças: o PNG com transparência vira dois objetos (a imagem e a máscara dela);
    // sem o reaproveitamento seriam quatro.
    expect(texto.match(/\/Subtype \/Image/g)).toHaveLength(2);
    // Os recortes (W n): as peças a e b (a c está sem estampa).
    expect(texto.match(/W n/g)).toHaveLength(2);
    // A linha de corte das três.
    expect(texto.match(/0\.50196\d* 0\.50196\d* 0\.50196\d* SCN/g)).toHaveLength(3);
  });

  it('o encaixe comprido sai em páginas de até 5 m', async () => {
    const pecas = [pecaEmPe('a'), transladarMolde(pecaEmPe('b'), ponto(0, 6000), 'b')];
    const blob = await gerarPdfParaImpressaoDigital(pecas, enfesto, new Map(), IMPRESSAO_VAZIA, 'Teste');
    const texto = Buffer.from(await blob.arrayBuffer()).toString('latin1');
    expect(texto.match(/\/Type \/Page\b/g)).toHaveLength(2);
  });
});

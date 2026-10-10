import { describe, it, expect } from 'vitest';
import { distancia, ponto } from '../core/geometria';
import { criarMolde } from './molde';
import { criarProjeto, criarVariante, type EstadoDoProjeto } from './projeto';
import {
  adicionarImagem,
  calibrarImagem,
  descreverEscalaDaImagem,
  imagemProntaParaContornar,
  imagensDoProjeto,
  LADO_MAXIMO_DA_IMAGEM_PX,
  MAXIMO_DE_IMAGENS,
  MM_POR_PX_INICIAL,
  nomeDaImagem,
  novaImagem,
  origemParaImagemNova,
  removerImagem,
  retanguloDaImagem,
  substituirImagem,
  tamanhoReduzido,
  type ImagemDoModelo,
} from './imagens';

const DADOS = 'data:image/jpeg;base64,AAAA';
const ESTADO_VAZIO: EstadoDoProjeto = { pecas: [], tecido: null, enfesto: null };
const projeto = criarProjeto('Camisa', 'p1', 'ENF-001', '2026-10-10T10:00:00.000Z', ESTADO_VAZIO);
const AGORA = '2026-10-10T12:00:00.000Z';

/** Imagem de 1000 × 500 px, a 1 mm por px, com o canto em (100, 200). */
function imagem(id = 'i1', sobrescrever: Partial<ImagemDoModelo> = {}): ImagemDoModelo {
  return { ...novaImagem(id, 'molde.jpg', DADOS, 1000, 500, ponto(100, 200)), mmPorPx: 1, ...sobrescrever };
}

describe('tamanhoReduzido', () => {
  it('a imagem que cabe no lado máximo fica como está', () => {
    expect(tamanhoReduzido(1600, 1200)).toEqual({ larguraPx: 1600, alturaPx: 1200 });
    expect(tamanhoReduzido(LADO_MAXIMO_DA_IMAGEM_PX, 10)).toEqual({ larguraPx: 2000, alturaPx: 10 });
  });

  it('a maior é reduzida na proporção, pelo lado maior — deitada ou de pé', () => {
    expect(tamanhoReduzido(4000, 3000)).toEqual({ larguraPx: 2000, alturaPx: 1500 });
    expect(tamanhoReduzido(3000, 4000)).toEqual({ larguraPx: 1500, alturaPx: 2000 });
    expect(tamanhoReduzido(8000, 2, 2000)).toEqual({ larguraPx: 2000, alturaPx: 1 });
  });

  it('recusa imagem sem tamanho', () => {
    expect(() => tamanhoReduzido(0, 100)).toThrow('A imagem não tem tamanho.');
    expect(() => tamanhoReduzido(100, Number.NaN)).toThrow('A imagem não tem tamanho.');
  });
});

describe('novaImagem', () => {
  it('entra visível, na escala de tela e por calibrar, com o nome do arquivo sem a extensão', () => {
    const nova = novaImagem('i1', '  Frente da camisa.JPG ', DADOS, 800, 600, ponto(0, 0));

    expect(nova).toMatchObject({ nome: 'Frente da camisa', visivel: true, calibrada: false, opacidade: 0.75, mmPorPx: MM_POR_PX_INICIAL });
    expect(MM_POR_PX_INICIAL).toBeCloseTo(0.264583, 6);
  });

  it('o nome nunca fica vazio nem comprido demais', () => {
    expect(nomeDaImagem('.png')).toBe('Imagem');
    expect(nomeDaImagem('   ')).toBe('Imagem');
    expect(nomeDaImagem('a'.repeat(100) + '.png')).toHaveLength(60);
    expect(nomeDaImagem('foto.de.cima.jpeg')).toBe('foto.de.cima');
  });

  it('recusa o que não é imagem', () => {
    expect(() => novaImagem('i1', 'x.txt', 'data:text/plain;base64,AAAA', 10, 10, ponto(0, 0))).toThrow('O arquivo não é uma imagem.');
    expect(() => novaImagem('i1', 'x.png', DADOS, 0, 10, ponto(0, 0))).toThrow('A imagem não tem tamanho.');
  });
});

describe('retanguloDaImagem e origemParaImagemNova', () => {
  it('a largura da imagem corre no Y do mundo e a altura, no X — os eixos da tela', () => {
    expect(retanguloDaImagem(imagem())).toEqual({ minX: 100, minY: 200, maxX: 600, maxY: 1200 });
    expect(retanguloDaImagem(imagem('i1', { mmPorPx: 0.5 }))).toEqual({ minX: 100, minY: 200, maxX: 350, maxY: 700 });
  });

  it('sem peças, a imagem vai para o começo da mesa; com peças, para logo depois da última', () => {
    expect(origemParaImagemNova([])).toEqual(ponto(0, 0));

    const peca = (id: string, yInicial: number) =>
      criarMolde(
        {
          nome: id,
          referencia: 'R',
          tamanho: 'M',
          contorno: [ponto(0, yInicial), ponto(300, yInicial), ponto(300, yInicial + 400), ponto(0, yInicial + 400)],
          linhaDeFio: { inicio: ponto(50, yInicial + 50), fim: ponto(250, yInicial + 50) },
        },
        id,
      );
    expect(origemParaImagemNova([peca('a', 0), peca('b', 500)])).toEqual(ponto(0, 920));
  });
});

describe('calibrarImagem', () => {
  it('dois pontos a 200 mm na escala atual que na verdade estão a 100 mm: a imagem encolhe à metade, com o canto parado', () => {
    const a = ponto(300, 400);
    const b = ponto(300, 600);

    const calibrada = calibrarImagem(imagem(), a, b, 100);

    expect(calibrada.mmPorPx).toBeCloseTo(0.5, 12);
    expect(calibrada.calibrada).toBe(true);
    // O canto de cima à esquerda não sai do lugar: a imagem continua onde foi posta.
    expect(calibrada.origem).toEqual(ponto(100, 200));
    expect(retanguloDaImagem(calibrada)).toEqual({ minX: 100, minY: 200, maxX: 350, maxY: 700 });
    // Os mesmos dois px da imagem ficam agora a 100 mm um do outro.
    const ondeFicou = (p: { x: number; y: number }) =>
      ponto(calibrada.origem.x + (p.x - 100) * calibrada.mmPorPx, calibrada.origem.y + (p.y - 200) * calibrada.mmPorPx);
    expect(distancia(ondeFicou(a), ondeFicou(b))).toBeCloseTo(100, 9);
  });

  it('funciona na diagonal e para aumentar', () => {
    const calibrada = calibrarImagem(imagem(), ponto(100, 200), ponto(400, 600), 1000);

    expect(calibrada.mmPorPx).toBeCloseTo(2, 12);
    expect(calibrada.origem).toEqual(ponto(100, 200));
    expect(retanguloDaImagem(calibrada)).toEqual({ minX: 100, minY: 200, maxX: 1100, maxY: 2200 });
  });

  it('recusa pontos no mesmo lugar e distância que não é maior que zero', () => {
    expect(() => calibrarImagem(imagem(), ponto(10, 10), ponto(10, 10), 100)).toThrow('estão no mesmo lugar');
    expect(() => calibrarImagem(imagem(), ponto(0, 0), ponto(0, 50), 0)).toThrow('maior que zero');
    expect(() => calibrarImagem(imagem(), ponto(0, 0), ponto(0, 50), -5)).toThrow('maior que zero');
    expect(() => calibrarImagem(imagem(), ponto(0, 0), ponto(0, 50), Number.NaN)).toThrow('maior que zero');
  });

  it('a escala e o tamanho aparecem escritos', () => {
    expect(descreverEscalaDaImagem(imagem())).toBe('1000 × 500 mm · 1 px = 1,000 mm');
    expect(descreverEscalaDaImagem(novaImagem('i', 'a.png', DADOS, 2000, 1500, ponto(0, 0)))).toBe('529 × 397 mm · 1 px = 0,265 mm');
  });
});

describe('imagens no projeto', () => {
  it('adiciona, troca e remove; sem imagens, o projeto fica sem o campo', () => {
    const comUma = adicionarImagem(projeto, imagem('i1'), AGORA);
    expect(imagensDoProjeto(projeto)).toEqual([]);
    expect(imagensDoProjeto(comUma).map((i) => i.id)).toEqual(['i1']);
    expect(comUma.modificadoEmIso).toBe(AGORA);

    const comDuas = adicionarImagem(comUma, imagem('i2'), AGORA);
    const escondida = substituirImagem(comDuas, imagem('i2', { visivel: false, opacidade: 0.25 }), AGORA);
    expect(imagensDoProjeto(escondida).map((i) => [i.id, i.visivel, i.opacidade])).toEqual([
      ['i1', true, 0.75],
      ['i2', false, 0.25],
    ]);

    const semAPrimeira = removerImagem(escondida, 'i1', AGORA);
    expect(imagensDoProjeto(semAPrimeira).map((i) => i.id)).toEqual(['i2']);
    expect('imagens' in removerImagem(semAPrimeira, 'i2', AGORA)).toBe(false);
  });

  it('recusa passar do máximo, imagem que não é do projeto e opacidade fora das opções', () => {
    let cheio = projeto;
    for (let i = 0; i < MAXIMO_DE_IMAGENS; i++) cheio = adicionarImagem(cheio, imagem(`i${i}`), AGORA);

    expect(() => adicionarImagem(cheio, imagem('a-mais'), AGORA)).toThrow('até 4 imagens');
    expect(() => removerImagem(projeto, 'i9', AGORA)).toThrow('Imagem não encontrada');
    expect(() => substituirImagem(cheio, imagem('i9'), AGORA)).toThrow('Imagem não encontrada');
    expect(() => substituirImagem(cheio, imagem('i0', { opacidade: 0.3 }), AGORA)).toThrow('Opacidade fora das opções.');
  });

  it('as imagens ficam fora do histórico: registrar versões não as repete', () => {
    const comImagem = adicionarImagem(projeto, imagem('i1'), AGORA);

    expect(JSON.stringify(comImagem.historico)).not.toContain(DADOS);
    expect(JSON.stringify(comImagem.estadoAtual)).not.toContain(DADOS);
  });

  it('a variante do modelo leva as imagens', () => {
    const comImagem = adicionarImagem(projeto, imagem('i1'), AGORA);

    expect(imagensDoProjeto(criarVariante(comImagem, 'Camisa — variante 2', 'p2', 'ENF-002', AGORA, ESTADO_VAZIO)).map((i) => i.id)).toEqual(['i1']);
    expect('imagens' in criarVariante(projeto, 'Camisa — variante 2', 'p2', 'ENF-002', AGORA, ESTADO_VAZIO)).toBe(false);
  });

  it('para contornar, vale a primeira imagem à mostra e já na escala', () => {
    expect(imagemProntaParaContornar([])).toBeNull();
    expect(imagemProntaParaContornar([imagem('i1')])).toBeNull();
    expect(imagemProntaParaContornar([imagem('i1', { calibrada: true, visivel: false })])).toBeNull();
    expect(imagemProntaParaContornar([imagem('i1'), imagem('i2', { calibrada: true })])?.id).toBe('i2');
  });
});

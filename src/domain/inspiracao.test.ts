import { describe, expect, it } from 'vitest';
import {
  adicionarItemDeInspiracao,
  alternarCorDaPaleta,
  coresDaImagem,
  lerPainelDeInspiracao,
  MAXIMO_DE_ITENS_DE_INSPIRACAO,
  mudarItemDeInspiracao,
  nomeDaCor,
  PAINEL_VAZIO,
  pedidoParaIa,
  removerItemDeInspiracao,
  type ItemDeInspiracao,
} from './inspiracao';
import { chaveComFormatoValido, lerRespostaDaIa, modeloValido, montarPedidoHttp, problemasDoPedido } from './servicoDeIa';

/** Uma imagem com faixas de cor: 70% azul-marinho, 20% branco, 10% vermelho (e um pedaço transparente que não conta). */
function imagemDeFaixas(): { rgba: Uint8ClampedArray; w: number; h: number } {
  const w = 100;
  const h = 110;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = 4 * (y * w + x);
      const [r, g, b, a] = y >= 100 ? [0, 255, 0, 0] : y < 70 ? [20, 30, 90, 255] : y < 90 ? [250, 250, 250, 255] : [200, 20, 30, 255];
      rgba.set([r, g, b, a], i);
    }
  }
  return { rgba, w, h };
}

const item = (id: string, mudanca: Partial<ItemDeInspiracao> = {}): ItemDeInspiracao => ({
  id,
  categoria: 'tecido',
  nome: id,
  dados: 'data:image/png;base64,AAAA',
  larguraPx: 10,
  alturaPx: 10,
  nota: '',
  cores: [],
  criadoEmIso: '2026-10-24T00:00:00.000Z',
  ...mudanca,
});

describe('o painel de inspiração', () => {
  it('as cores principais de uma imagem, da que mais aparece para a que menos, sem os pixels transparentes', () => {
    const { rgba, w, h } = imagemDeFaixas();
    expect(coresDaImagem(rgba, w, h, 5)).toEqual(['#141e5a', '#fafafa', '#c8141e']);
  });

  it('o nome da cor, em português', () => {
    expect(['#141e5a', '#fafafa', '#c8141e', '#111111', '#808080', '#2e8b57', '#ffd700', '#ffc0cb', '#5c1a1a'].map(nomeDaCor)).toEqual([
      'azul-marinho',
      'branco',
      'vermelho',
      'preto',
      'cinza',
      'verde',
      'amarelo',
      'rosa-claro',
      'vinho',
    ]);
  });

  it('pôr, mudar e tirar imagens (até 16); a paleta (até 8, sem repetir)', () => {
    let p = adicionarItemDeInspiracao(PAINEL_VAZIO, item('a'));
    p = mudarItemDeInspiracao(p, 'a', { categoria: 'estampa', nota: 'listras finas' });
    expect(p.itens[0]).toMatchObject({ categoria: 'estampa', nota: 'listras finas' });
    expect(removerItemDeInspiracao(p, 'a').itens).toEqual([]);
    let cheio = PAINEL_VAZIO;
    for (let i = 0; i < MAXIMO_DE_ITENS_DE_INSPIRACAO; i++) cheio = adicionarItemDeInspiracao(cheio, item(`i${i}`));
    expect(() => adicionarItemDeInspiracao(cheio, item('x'))).toThrow(/já tem 16 imagens/);
    p = alternarCorDaPaleta(p, '#AABBCC');
    expect(p.paleta).toEqual(['#aabbcc']);
    expect(alternarCorDaPaleta(p, '#aabbcc').paleta).toEqual([]);
  });

  it('o pedido para a IA: o tipo, o conceito, as cores pelo nome, as notas e as referências', () => {
    const painel = { conceito: 'verão urbano, leve', paleta: ['#141e5a', '#fafafa'], itens: [item('a', { categoria: 'modelagem', nota: 'gola padre' })] };
    const pedido = pedidoParaIa('peca', painel, { nomeDoModelo: 'Camisa Linho', descricao: 'Camisa de manga curta', tecido: 'Linho', referencias: 2 });
    expect(pedido.split('\n')).toEqual([
      'Imagem de moda de uma peça de vestuário: Camisa Linho.',
      'Descrição: Camisa de manga curta',
      'Conceito: verão urbano, leve',
      'Tecido: Linho.',
      'Cores: azul-marinho, branco.',
      'Referências: modelagem: gola padre.',
      'Use as 2 imagem(ns) anexada(s) como referência visual.',
      'Sem texto, sem marca d’água, sem logotipos.',
    ]);
    const croqui = pedidoParaIa('croqui', painel, { nomeDoModelo: 'Camisa Linho', referencias: 0 });
    expect(croqui).toMatch(/^Desenho técnico de moda \(croqui plano\) da peça "Camisa Linho", vista de frente e de costas/);
    expect(croqui).not.toMatch(/Cores:/);
  });

  it('a leitura do painel guardado (a imagem que não é imagem fica de fora; o rascunho da IA é lido)', () => {
    const lido = lerPainelDeInspiracao({
      conceito: 'x',
      paleta: ['#AABBCC', 'azul', '#112233'],
      itens: [
        { id: 'a', dados: 'data:image/jpeg;base64,AA', categoria: 'cor', cores: ['#000000', 'x'], rascunhoDaIa: { servico: 'S', modelo: 'M', pedido: 'P', geradoEmIso: 'T' } },
        { id: 'b', dados: 'javascript:alert(1)' },
        { id: 'c', dados: 'data:image/png;base64,AA', categoria: 'inventada' },
      ],
    });
    expect(lido.paleta).toEqual(['#aabbcc', '#112233']);
    expect(lido.itens.map((i) => [i.id, i.categoria, i.cores.length, i.rascunhoDaIa?.modelo ?? null])).toEqual([
      ['a', 'cor', 1, 'M'],
      ['c', 'outro', 0, null],
    ]);
    expect(lerPainelDeInspiracao(42)).toBe(PAINEL_VAZIO);
  });
});

describe('o serviço de imagem (sem rede)', () => {
  it('a chave e o modelo com formato aceitável; os problemas do pedido', () => {
    expect(chaveComFormatoValido('sk-proj-abcdefghijklmnopqrstuvwxyz')).toBe(true);
    expect(chaveComFormatoValido('curta')).toBe(false);
    expect(chaveComFormatoValido('sk-com espaço-abcdefghijklmnopqrstuvwxyz')).toBe(false);
    expect(modeloValido('gpt-image-2.5-flare')).toBe(true);
    expect(modeloValido('../etc')).toBe(false);
    expect(problemasDoPedido({ pedido: 'x', quantidade: 5, formato: 'quadrado', referencias: [] })).toEqual(['Escreva o pedido (o que a imagem deve mostrar).', 'Peça de 1 a 4 imagens por vez.']);
  });

  it('sem referência: a geração, em JSON, com a chave só no cabeçalho', () => {
    const { url, init } = montarPedidoHttp(' sk-proj-abcdefghijklmnopqrstuvwxyz ', 'gpt-image-2.5-flare', { pedido: 'Uma saia', quantidade: 2, formato: 'retrato', referencias: [] });
    expect(url).toBe('https://api.openai.com/v1/images/generations');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ Authorization: 'Bearer sk-proj-abcdefghijklmnopqrstuvwxyz', 'Content-Type': 'application/json' });
    expect(JSON.parse(init.body as string)).toEqual({ model: 'gpt-image-2.5-flare', prompt: 'Uma saia', n: 2, size: '1024x1536' });
  });

  it('com referências: a edição, em partes, uma image[] por imagem', async () => {
    const { url, init } = montarPedidoHttp('sk-proj-abcdefghijklmnopqrstuvwxyz', 'gpt-image-2.5-sunburst', {
      pedido: 'Variações',
      quantidade: 1,
      formato: 'quadrado',
      referencias: [
        { nome: 'Desenho técnico.png', base64: btoa('PNG1'), tipo: 'image/png' },
        { nome: 'tecido', base64: btoa('JPG2'), tipo: 'image/jpeg' },
      ],
    });
    expect(url).toBe('https://api.openai.com/v1/images/edits');
    expect(init.headers).toEqual({ Authorization: 'Bearer sk-proj-abcdefghijklmnopqrstuvwxyz' });
    const f = init.body as FormData;
    expect([f.get('model'), f.get('prompt'), f.get('n'), f.get('size')]).toEqual(['gpt-image-2.5-sunburst', 'Variações', '1', '1024x1024']);
    const imagens = f.getAll('image[]') as File[];
    expect(imagens.map((i) => [i.name, i.type])).toEqual([
      ['Desenho-t-cnico.png', 'image/png'],
      ['tecido.jpg', 'image/jpeg'],
    ]);
    expect(await imagens[1]!.text()).toBe('JPG2');
  });

  it('a resposta: as imagens; e cada erro dito em português, com o que o serviço disse', () => {
    expect(lerRespostaDaIa(200, { data: [{ b64_json: 'AAA' }, { b64_json: 'BBB' }] })).toEqual({ ok: true, imagens: ['AAA', 'BBB'] });
    expect(lerRespostaDaIa(200, { data: [] })).toEqual({ ok: false, erro: 'O serviço respondeu sem imagem.' });
    expect(lerRespostaDaIa(401, { error: { message: 'Incorrect API key provided' } })).toEqual({
      ok: false,
      erro: 'O serviço recusou a chave: confira se ela está certa e ativa (Configurar). (o serviço disse: Incorrect API key provided)',
    });
    expect(lerRespostaDaIa(429, null)).toEqual({ ok: false, erro: 'O serviço pediu para esperar: o limite de pedidos ou os créditos da conta acabaram.' });
    expect(lerRespostaDaIa(503, 'x')).toMatchObject({ ok: false, erro: expect.stringMatching(/com problema agora/) });
    expect(lerRespostaDaIa(400, { error: { message: 'Your request was rejected by the safety system.' } })).toMatchObject({ erro: expect.stringMatching(/não aceitou o pedido \(o serviço disse: Your request was rejected/) });
  });
});

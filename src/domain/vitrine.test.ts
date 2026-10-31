import { describe, expect, it } from 'vitest';
import { htmlDaVitrine, tamanhoDaVitrine, type ProdutoDaVitrine } from './vitrine';

const camisa: ProdutoDaVitrine = {
  id: 'c1',
  nome: 'Camisa <linho>',
  referencia: 'R1',
  categoria: 'Camisas',
  cores: ['Azul'],
  tecido: 'Linho',
  croquiSvg: '<svg></svg>',
  tamanhos: ['P', 'M', 'G'],
  medidas: [{ nome: 'Busto', valoresCm: { P: 90, M: 96, G: 102 } }],
};
const calca: ProdutoDaVitrine = { ...camisa, id: 'c2', nome: 'Calça', categoria: 'Calças', croquiSvg: null, medidas: [] };

/** A página de verdade, com o script dela rodando. */
function abrir(html: string): Document {
  const doc = document.implementation.createHTMLDocument();
  doc.documentElement.innerHTML = html.replace(/^<!doctype html>\n<html[^>]*>/, '').replace('</html>\n', '');
  const script = doc.querySelector('script')!.textContent!;
  new Function('document', script)(doc);
  return doc;
}

describe('o tamanho na vitrine (ADR 0213)', () => {
  const m = camisa.medidas;

  it('o primeiro em que a medida cabe, com a folga', () => {
    expect(tamanhoDaVitrine(['P', 'M', 'G'], m, [88], 2)).toBe('P');
    expect(tamanhoDaVitrine(['P', 'M', 'G'], m, [89], 2)).toBe('M');
    expect(tamanhoDaVitrine(['P', 'M', 'G'], m, [101], 2)).toBeNull();
  });

  it('vale a medida mais exigente, e a em branco não conta', () => {
    const duas = [...m, { valoresCm: { P: 100, M: 110, G: 120 } }];
    expect(tamanhoDaVitrine(['P', 'M', 'G'], duas, [88, 112], 2)).toBe('G');
    expect(tamanhoDaVitrine(['P', 'M', 'G'], duas, [0, 104], 2)).toBe('M');
  });

  it('o tamanho sem a medida não é sugerido', () => {
    expect(tamanhoDaVitrine(['P', 'M'], [{ valoresCm: { M: 100 } }], [50], 2)).toBe('M');
  });
});

describe('a página da vitrine (ADR 0213)', () => {
  const html = htmlDaVitrine('Verão', [camisa, calca], [{ nome: 'Praia', produtoIds: ['c1', 'c2'] }]);

  it('escapa os nomes e traz os looks', () => {
    expect(html).toContain('Camisa &lt;linho&gt;');
    expect(html).toContain('Praia');
    expect(html).toContain('viewport');
  });

  it('um nome não fecha o script da página', () => {
    const r = htmlDaVitrine('V', [{ ...camisa, medidas: [{ nome: 'x', valoresCm: { '</script><b>': 1 } }] }], []);
    expect(r.match(/<\/script>/g)).toHaveLength(1);
  });

  it('o filtro esconde as outras categorias', () => {
    const doc = abrir(html);
    const calcas = doc.querySelector<HTMLButtonElement>('[data-filtro="Calças"]')!;
    calcas.click();
    expect(doc.querySelector<HTMLElement>('[data-produto="c1"]')!.hidden).toBe(true);
    expect(doc.querySelector<HTMLElement>('[data-produto="c2"]')!.hidden).toBe(false);
    expect(calcas.getAttribute('aria-pressed')).toBe('true');
    doc.querySelector<HTMLButtonElement>('[data-filtro=""]')!.click();
    expect(doc.querySelector<HTMLElement>('[data-produto="c1"]')!.hidden).toBe(false);
  });

  it('o "qual é o meu tamanho" responde na própria página', () => {
    const doc = abrir(html);
    const produto = doc.querySelector('[data-produto="c1"]')!;
    const ver = produto.querySelector<HTMLButtonElement>('[data-ver]')!;
    const resposta = produto.querySelector('.resposta')!;
    ver.click();
    expect(resposta.textContent).toBe('Escreva ao menos uma medida.');
    produto.querySelector<HTMLInputElement>('[data-medida="0"]')!.value = '90';
    ver.click();
    expect(resposta.textContent).toBe('Tamanho sugerido: M');
    produto.querySelector<HTMLInputElement>('[data-medida="0"]')!.value = '130';
    ver.click();
    expect(resposta.textContent).toBe('Nenhum tamanho veste estas medidas.');
  });

  it('o produto sem medidas não tem a pergunta', () => {
    expect(abrir(html).querySelector('[data-produto="c2"] details')).toBeNull();
  });
});

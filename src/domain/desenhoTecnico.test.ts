import { describe, expect, it } from 'vitest';
import {
  adicionarElemento,
  BASES,
  caminhoDoTraco,
  cantosDaEstampa,
  contornoPelaMetade,
  copiarParaAOutraVista,
  DESENHO_VAZIO,
  duplicarElemento,
  EIXO_DO_DESENHO,
  elementoNoPonto,
  elementosDaVista,
  espelharElemento,
  FORMAS,
  geometriaDaCota,
  lerDesenhoTecnico,
  letraDaMedida,
  medidasComCota,
  MANEQUINS,
  moverElemento,
  mudarElemento,
  novaCota,
  novoTraco,
  ordemDoElemento,
  pontoPegaElemento,
  pontosDoTraco,
  proximaMedidaSemCota,
  removerElemento,
  rotuloDaCota,
  tracosDaBase,
  tracosDaForma,
  type EstampaDoDesenho,
  type TextoDoDesenho,
} from './desenhoTecnico';
import { definirDesenhoDaFicha, enviarParaAprovacao, lerFichaTecnica, novaFichaTecnica } from './fichaTecnica';

let n = 0;
const novoId = (): string => `e${++n}`;
const pt = (x: number, y: number) => ({ x, y });

describe('o desenho técnico — o espelho e as vistas', () => {
  it('o marcado "espelhar" aparece também do outro lado do eixo, logo depois dele', () => {
    const bolso = novoTraco('b', 'frente', [pt(120, 200), pt(150, 200), pt(150, 240)], { espelhar: true });
    const pesponto = novoTraco('p', 'frente', [pt(10, 10), pt(20, 20)], { estilo: 'pesponto' });
    const costas = novoTraco('c', 'costas', [pt(1, 1), pt(2, 2)]);
    const d = adicionarElemento(DESENHO_VAZIO, [bolso, pesponto, costas]);
    const frente = elementosDaVista(d, 'frente');
    expect(frente.map((e) => e.id)).toEqual(['b', 'b~', 'p']);
    expect((frente[1] as typeof bolso).pontos).toEqual([pt(280, 200), pt(250, 200), pt(250, 240)]);
    expect(elementosDaVista(d, 'costas').map((e) => e.id)).toEqual(['c']);
  });

  it('a estampa espelhada vira e gira ao contrário; o texto não se espelha', () => {
    const estampa: EstampaDoDesenho = { id: 's', tipo: 'estampa', vista: 'frente', imagemId: 'i', centro: pt(150, 160), largura: 40, rotacaoGraus: 15, opacidade: 1, espelhar: true };
    expect(espelharElemento(estampa)).toMatchObject({ centro: pt(250, 160), rotacaoGraus: -15 });
    const texto: TextoDoDesenho = { id: 't', tipo: 'texto', vista: 'frente', posicao: pt(10, 10), texto: 'Pesponto 1 mm', tamanho: 10, cor: '#000' };
    expect(elementosDaVista(adicionarElemento(DESENHO_VAZIO, texto), 'frente')).toHaveLength(1);
  });

  it('o contorno pela metade: a metade e o espelho dela, fechado, sem repetir os pontos do eixo', () => {
    expect(contornoPelaMetade([pt(200, 0), pt(150, 0), pt(150, 100), pt(200, 100)])).toEqual([pt(200, 0), pt(150, 0), pt(150, 100), pt(200, 100), pt(250, 100), pt(250, 0)]);
  });
});

describe('o desenho técnico — os caminhos', () => {
  it('reto: M e L, fechado com Z; curvo: Bézier cúbicas que passam pelos pontos', () => {
    expect(caminhoDoTraco([pt(0, 0), pt(10, 0), pt(10, 10)], false, true)).toBe('M 0 0 L 10 0 L 10 10 Z');
    const curva = caminhoDoTraco([pt(0, 0), pt(10, 10), pt(20, 0)], true, false);
    expect(curva.startsWith('M 0 0 C ')).toBe(true);
    expect(curva.match(/C /g)).toHaveLength(2);
    expect(curva.endsWith(' 20 0')).toBe(true);
    expect(caminhoDoTraco([], false, false)).toBe('');
  });

  it('os pontos da curva passam pelos pontos dados', () => {
    const amostra = pontosDoTraco({ pontos: [pt(0, 0), pt(10, 10), pt(20, 0)], curvo: true, fechado: false });
    expect(amostra[0]).toEqual(pt(0, 0));
    expect(amostra[8]!.x).toBeCloseTo(10, 9);
    expect(amostra[8]!.y).toBeCloseTo(10, 9);
    expect(amostra.at(-1)!.x).toBeCloseTo(20, 9);
  });
});

describe('o desenho técnico — pegar com o clique', () => {
  const linha = novoTraco('l', 'frente', [pt(100, 100), pt(140, 100)], { espelhar: true });
  const quadrado = novoTraco('q', 'frente', [pt(0, 0), pt(40, 0), pt(40, 40), pt(0, 40)], { fechado: true, preenchimento: '#fff' });

  it('perto do traço pega; dentro do fechado preenchido pega; longe, não', () => {
    expect(pontoPegaElemento(linha, pt(120, 103), 4)).toBe(true);
    expect(pontoPegaElemento(linha, pt(120, 110), 4)).toBe(false);
    expect(pontoPegaElemento(quadrado, pt(20, 20), 2)).toBe(true);
    expect(pontoPegaElemento({ ...quadrado, preenchimento: null }, pt(20, 20), 2)).toBe(false);
  });

  it('o espelhado pega como o original; o de cima ganha', () => {
    const d = adicionarElemento(DESENHO_VAZIO, [quadrado, linha]);
    expect(elementoNoPonto(d, 'frente', pt(280, 101), 4)).toBe('l');
    expect(elementoNoPonto(d, 'frente', pt(20, 20), 4)).toBe('q');
    expect(elementoNoPonto(d, 'costas', pt(20, 20), 4)).toBeNull();
  });

  it('o texto pela caixa; a estampa pelos cantos girados (a altura pela proporção da imagem)', () => {
    const texto: TextoDoDesenho = { id: 't', tipo: 'texto', vista: 'frente', posicao: pt(50, 50), texto: 'ABC', tamanho: 10, cor: '#000' };
    expect(pontoPegaElemento(texto, pt(55, 45), 1)).toBe(true);
    const estampa: EstampaDoDesenho = { id: 's', tipo: 'estampa', vista: 'frente', imagemId: 'i', centro: pt(100, 100), largura: 40, rotacaoGraus: 90, opacidade: 1, espelhar: false };
    // Girada 90°, a estampa de 40 × 20 fica com 20 de largura e 40 de altura.
    expect(pontoPegaElemento(estampa, pt(100, 118), 0, 0.5)).toBe(true);
    expect(pontoPegaElemento(estampa, pt(118, 100), 0, 0.5)).toBe(false);
    expect(cantosDaEstampa(estampa, 0.5)[0]!.x).toBeCloseTo(110, 9);
  });
});

describe('o desenho técnico — as mudanças', () => {
  const t = novoTraco('t', 'frente', [pt(10, 10), pt(20, 20)]);
  it('mover, duplicar, mudar, remover, a ordem, copiar para a outra vista', () => {
    expect(moverElemento(t, 5, -5)).toMatchObject({ pontos: [pt(15, 5), pt(25, 15)] });
    expect(duplicarElemento(t, 'u')).toMatchObject({ id: 'u', pontos: [pt(22, 22), pt(32, 32)] });
    let d = adicionarElemento(DESENHO_VAZIO, [t, novoTraco('v', 'frente', [pt(0, 0), pt(1, 1)])]);
    d = mudarElemento(d, 't', (e) => ({ ...e, cor: '#c00' }) as typeof e);
    expect(d.elementos[0]).toMatchObject({ cor: '#c00' });
    expect(ordemDoElemento(d, 't', 1).elementos.map((e) => e.id)).toEqual(['v', 't']);
    expect(ordemDoElemento(d, 'v', -1).elementos.map((e) => e.id)).toEqual(['v', 't']);
    expect(removerElemento(d, 't').elementos.map((e) => e.id)).toEqual(['v']);
    expect(copiarParaAOutraVista(t, 'w')).toMatchObject({ id: 'w', vista: 'costas', pontos: t.pontos });
  });
});

describe('o desenho técnico — as formas, as bases e o manequim', () => {
  it('a forma entra com o meio no ponto dado, com os estilos dela', () => {
    const bolso = tracosDaForma('bolso-chapa', 'frente', pt(150, 220), novoId, true);
    expect(bolso.map((x) => x.estilo)).toEqual(['contorno', 'pesponto']);
    expect(bolso.every((x) => x.espelhar)).toBe(true);
    const xs = bolso.flatMap((x) => x.pontos.map((q) => q.x));
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(150, 6);
    expect(tracosDaForma('nao-existe', 'frente', pt(0, 0), novoId)).toEqual([]);
    expect(Object.keys(FORMAS).length).toBeGreaterThanOrEqual(12);
  });

  it('cada base: o contorno fechado da frente e das costas (simétrico pelo eixo) e os detalhes espelhados', () => {
    for (const chave of Object.keys(BASES)) {
      const tracos = tracosDaBase(chave, novoId);
      const [frente, costas] = tracos;
      expect(frente).toMatchObject({ vista: 'frente', fechado: true, espelhar: false });
      expect(costas).toMatchObject({ vista: 'costas', fechado: true });
      // Simétrico: cada ponto tem o par do outro lado do eixo.
      for (const q of frente!.pontos) expect(frente!.pontos.some((r) => Math.abs(r.x - (2 * EIXO_DO_DESENHO - q.x)) < 1e-9 && Math.abs(r.y - q.y) < 1e-9)).toBe(true);
      expect(tracos.slice(2).every((d) => d.espelhar)).toBe(true);
    }
  });

  it('os manequins ficam dentro da folha', () => {
    for (const m of Object.values(MANEQUINS)) {
      for (const q of [...m.corpo, ...m.cabeca]) {
        expect(q.x).toBeGreaterThanOrEqual(0);
        expect(q.x).toBeLessThanOrEqual(400);
        expect(q.y).toBeGreaterThanOrEqual(0);
        expect(q.y).toBeLessThanOrEqual(500);
      }
    }
  });
});

describe('o desenho técnico — na ficha', () => {
  it('guardado na ficha e lido de volta; a ficha em aprovação não muda o desenho', () => {
    const d = adicionarElemento(DESENHO_VAZIO, tracosDaBase('camiseta', novoId));
    const ficha = definirDesenhoDaFicha(novaFichaTecnica({ nome: 'X', codigo: 'E', pecas: [] }, 'x'), d, 'y');
    expect(lerFichaTecnica(JSON.parse(JSON.stringify(ficha)))!.desenho).toEqual(d);
    expect(() => definirDesenhoDaFicha(enviarParaAprovacao(ficha, 'Ana', '', 'z'), d, 'z')).toThrow(/para mudar o desenho, abra uma nova versão/);
  });

  it('a leitura deixa de fora o elemento quebrado', () => {
    const lido = lerDesenhoTecnico({ elementos: [{ id: 'a', tipo: 'traco', vista: 'frente', pontos: [pt(1, 1)], estilo: 'contorno' }, { id: 'b', tipo: 'traco', vista: 'lado', pontos: [] }, 'lixo'], manequim: 'nenhum' });
    expect(lido!.elementos.map((e) => e.id)).toEqual(['a']);
    expect(lido!.manequim).toBeNull();
    expect(lerDesenhoTecnico(null)).toBeNull();
  });
});

describe('as cotas do desenho (ADR 0117)', () => {
  const MEDIDAS = [{ id: 'busto' }, { id: 'comprimento' }, { id: 'manga' }];

  it('a letra pela ordem da tabela: A … Z, AA, AB', () => {
    expect([0, 1, 25, 26, 27, 51, 52].map(letraDaMedida)).toEqual(['A', 'B', 'Z', 'AA', 'AB', 'AZ', 'BA']);
  });

  it('o rótulo: a letra do ponto ligado; sem ele (ou se saiu da tabela), o texto ou "?"', () => {
    const cota = novaCota('c', 'frente', { x: 100, y: 100 }, { x: 300, y: 100 }, 'comprimento');
    expect(rotuloDaCota(cota, MEDIDAS)).toBe('B');
    expect(rotuloDaCota(cota, [{ id: 'busto' }])).toBe('?');
    expect(rotuloDaCota({ ...cota, medidaId: null, texto: ' Barra 3 cm ' }, MEDIDAS)).toBe('Barra 3 cm');
  });

  it('a cota nova liga ao primeiro ponto de medida que ainda não tem cota', () => {
    let d = DESENHO_VAZIO;
    expect(proximaMedidaSemCota(d, MEDIDAS)).toBe('busto');
    d = adicionarElemento(d, novaCota('c1', 'frente', { x: 0, y: 0 }, { x: 50, y: 0 }, 'busto'));
    d = adicionarElemento(d, novaCota('c2', 'costas', { x: 0, y: 0 }, { x: 50, y: 0 }, 'manga'));
    expect([...medidasComCota(d)]).toEqual(['busto', 'manga']);
    expect(proximaMedidaSemCota(d, MEDIDAS)).toBe('comprimento');
    d = adicionarElemento(d, novaCota('c3', 'frente', { x: 0, y: 0 }, { x: 50, y: 0 }, 'comprimento'));
    expect(proximaMedidaSemCota(d, MEDIDAS)).toBeNull();
  });

  it('o desenho: as setas com a ponta em cada ponta da cota, o rótulo no meio (círculo para a letra, caixa para o texto)', () => {
    const cota = novaCota('c', 'frente', { x: 100, y: 200 }, { x: 300, y: 200 }, 'busto');
    const g = geometriaDaCota(cota, 'A');
    expect(g.linha).toEqual([cota.de, cota.ate]);
    expect(g.setas[0]![0]).toEqual(cota.de);
    expect(g.setas[1]![0]).toEqual(cota.ate);
    // As bases das setas ficam para dentro da cota.
    expect(g.setas[0]![1].x).toBeGreaterThan(100);
    expect(g.setas[1]![1].x).toBeLessThan(300);
    expect(g.rotulo).toMatchObject({ centro: { x: 200, y: 200 }, texto: 'A', raio: 8 });
    const comTexto = geometriaDaCota(cota, 'Barra 3 cm');
    expect(comTexto.rotulo.raio).toBeNull();
    expect(comTexto.rotulo.largura).toBeGreaterThan(50);
  });

  it('pegar, mover, não se espelhar, e voltar do arquivo; a quebrada fica de fora', () => {
    const cota = novaCota('c', 'frente', { x: 100, y: 200 }, { x: 300, y: 200 }, 'busto');
    expect(pontoPegaElemento(cota, { x: 150, y: 203 }, 6)).toBe(true);
    expect(pontoPegaElemento(cota, { x: 150, y: 220 }, 6)).toBe(false);
    expect(moverElemento(cota, 10, -5)).toMatchObject({ de: { x: 110, y: 195 }, ate: { x: 310, y: 195 } });
    const d = adicionarElemento(DESENHO_VAZIO, cota);
    expect(elementosDaVista(d, 'frente')).toHaveLength(1);
    const lido = lerDesenhoTecnico(JSON.parse(JSON.stringify({ ...d, elementos: [...d.elementos, { id: 'x', tipo: 'cota', vista: 'frente', de: { x: 0 }, ate: { x: 1, y: 1 }, medidaId: null }] })));
    expect(lido?.elementos).toEqual([cota]);
  });
});

import { describe, expect, it } from 'vitest';
import { ponto, type Ponto2D } from '../core/geometria';
import { DESENHO_VAZIO, novaCota, type DesenhoTecnico, type ElementoDoDesenho, type EstiloDoTraco, type TracoDoDesenho, type VistaDoDesenho } from './desenhoTecnico';
import { areaDaUniao, avisoDoTamanhoDaRoupa, escalaDoDesenho, estimativaPeloDesenho, formasDoConsumo, tamanhoDoMeio } from './consumoPeloDesenho';
import { consumoDoItem, CONSUMO_PELO_DESENHO_PADRAO, novaFichaTecnica, validarItem, type FichaTecnica, type ItemDeMaterial, type PontoDeMedida } from './fichaTecnica';
import type { Material } from './materiais';

const retangulo = (x0: number, y0: number, x1: number, y1: number): Ponto2D[] => [ponto(x0, y0), ponto(x1, y0), ponto(x1, y1), ponto(x0, y1)];

function traco(id: string, vista: VistaDoDesenho, pontos: readonly Ponto2D[], opcoes: { espelhar?: boolean; fechado?: boolean; estilo?: EstiloDoTraco } = {}): TracoDoDesenho {
  return {
    id,
    tipo: 'traco',
    vista,
    pontos,
    curvo: false,
    fechado: opcoes.fechado ?? true,
    estilo: opcoes.estilo ?? 'contorno',
    cor: '#000000',
    espessura: 2,
    preenchimento: null,
    espelhar: opcoes.espelhar ?? false,
  };
}

const desenho = (...elementos: ElementoDoDesenho[]): DesenhoTecnico => ({ ...DESENHO_VAZIO, elementos });

const comprimento: PontoDeMedida = { id: 'comp', nome: 'Comprimento', comoMedir: '', toleranciaCm: 1, valoresCm: { P: 66, M: 70, G: 74 } };
const busto: PontoDeMedida = { id: 'busto', nome: 'Busto', comoMedir: '', toleranciaCm: 1, valoresCm: { M: 50 } };

/**
 * Uma blusa: de frente e de costas, a metade esquerda do corpo (x de 150 ao meio, 200; y de 100 a 300) espelhada — o
 * corpo inteiro tem 100 × 200 unidades. A cota do comprimento (200 unidades) é de 70 cm no M: 3,5 mm por unidade.
 */
const blusa = (): DesenhoTecnico =>
  desenho(
    traco('frente', 'frente', retangulo(150, 100, 200, 300), { espelhar: true }),
    traco('costas', 'costas', retangulo(150, 100, 200, 300), { espelhar: true }),
    traco('bolso-aberto', 'frente', retangulo(160, 150, 180, 170), { fechado: false }),
    traco('pesponto', 'frente', retangulo(155, 110, 195, 290), { estilo: 'pesponto' }),
    novaCota('c1', 'frente', ponto(120, 100), ponto(120, 300), 'comp'),
  );

describe('o consumo pelo desenho técnico (ADR 0127)', () => {
  it('a área da união: um quadrado, dois separados, dois que se cruzam (o que se cruza não conta duas vezes)', () => {
    expect(areaDaUniao([retangulo(0, 0, 10, 10)])).toBeCloseTo(100, 6);
    expect(areaDaUniao([retangulo(0, 0, 10, 10), retangulo(20, 0, 30, 10)])).toBeCloseTo(200, 6);
    expect(areaDaUniao([retangulo(0, 0, 10, 10), retangulo(5, 0, 15, 10)])).toBeCloseTo(150, 6);
    // Um triângulo (a borda inclinada): a conta por faixas acerta a área.
    expect(areaDaUniao([[ponto(0, 0), ponto(40, 0), ponto(0, 30)]])).toBeCloseTo(600, 1);
  });

  it('as formas: só os contornos fechados; a espelhada vale com o espelho, e a que passa do meio não repete o meio', () => {
    const formas = formasDoConsumo(blusa());
    expect(formas.map((f) => f.id)).toEqual(['frente', 'costas']);
    expect(formas[0]!.areaNaFolha).toBeCloseTo(100 * 200, 3);
    // De 180 a 220 espelhada no meio (200): o espelho cai em cima dela mesma.
    const noMeio = formasDoConsumo(desenho(traco('saia', 'frente', retangulo(180, 100, 220, 300), { espelhar: true })));
    expect(noMeio[0]!.areaNaFolha).toBeCloseTo(40 * 200, 3);
  });

  it('a escala: a cota ligada à medida, no tamanho; com duas cotas, a do meio e a diferença', () => {
    const escala = escalaDoDesenho(blusa(), [comprimento], 'M')!;
    expect(escala.mmPorUnidade).toBeCloseTo(3.5, 9);
    expect(escala.cotas).toEqual([{ medida: 'Comprimento', valorCm: 70, mmPorUnidade: 3.5 }]);
    expect(escala.diferencaPercentual).toBe(0);
    expect(escalaDoDesenho(blusa(), [comprimento], 'G')!.mmPorUnidade).toBeCloseTo(3.7, 9);
    // A cota do busto: 100 unidades para 50 cm (5 mm por unidade) — a do meio entre 3,5 e 5.
    const duas = escalaDoDesenho(desenho(...blusa().elementos, novaCota('c2', 'frente', ponto(150, 320), ponto(250, 320), 'busto')), [comprimento, busto], 'M')!;
    expect(duas.mmPorUnidade).toBeCloseTo(4.25, 9);
    expect(duas.diferencaPercentual).toBeCloseTo((0.75 / 4.25) * 100, 6);
    // Sem medida no tamanho, ou sem cota ligada: sem escala.
    expect(escalaDoDesenho(blusa(), [comprimento], 'GG')).toBeNull();
    expect(escalaDoDesenho(desenho(novaCota('c', 'frente', ponto(0, 0), ponto(0, 10), null)), [comprimento], 'M')).toBeNull();
  });

  it('a área da roupa: frente e costas na escala; o que falta é dito', () => {
    const e = estimativaPeloDesenho(blusa(), [comprimento], 'M');
    expect(e.ok).toBe(true);
    if (!e.ok) return;
    // 100 × 200 unidades × 3,5² mm² = 245 000 mm² por vista.
    expect(e.porVista.frente).toBeCloseTo(245000, 0);
    expect(e.areaMm2).toBeCloseTo(490000, 0);
    expect(e.formas).toBe(2);
    // O corpo inteiro: 100 × 200 unidades a 3,5 mm = 35 × 70 cm.
    expect(e.larguraMm).toBeCloseTo(350, 6);
    expect(e.alturaMm).toBeCloseTo(700, 6);
    expect(e.comoSaiu).toBe('frente 0,245 m² + costas 0,245 m², na escala da cota de Comprimento (70 cm no M)');
    expect(estimativaPeloDesenho(undefined, [comprimento], 'M')).toEqual({ ok: false, erro: 'Pelo desenho: a ficha ainda não tem o desenho técnico.' });
    expect((estimativaPeloDesenho(desenho(novaCota('c1', 'frente', ponto(0, 0), ponto(0, 200), 'comp')), [comprimento], 'M') as { erro: string }).erro).toContain('nenhum contorno fechado');
    expect((estimativaPeloDesenho(blusa(), [], 'M') as { erro: string }).erro).toContain('nenhuma cota do desenho está ligada');
  });

  it('o tamanho que nenhuma roupa tem é dito: a cota na medida errada', () => {
    const certa = estimativaPeloDesenho(blusa(), [comprimento], 'M');
    if (!certa.ok) throw new Error(certa.erro);
    expect(avisoDoTamanhoDaRoupa(certa)).toBeNull();
    // A volta do busto (100 cm) ligada à cota da frente toda: a escala dobra, e a roupa passa de 1,60 m.
    const errada = estimativaPeloDesenho(blusa(), [{ ...comprimento, valoresCm: { M: 180 } }], 'M');
    if (!errada.ok) throw new Error(errada.erro);
    expect(avisoDoTamanhoDaRoupa(errada)).toBe('Nesta escala a roupa tem 90 × 180 cm: grande demais. Confira a medida da cota — a volta inteira (o busto, a cintura) numa cota que atravessa só a frente dobra a escala.');
    const pequena = estimativaPeloDesenho(blusa(), [{ ...comprimento, valoresCm: { M: 10 } }], 'M');
    if (!pequena.ok) throw new Error(pequena.erro);
    expect(avisoDoTamanhoDaRoupa(pequena)).toBe('Nesta escala a roupa tem 5 × 10 cm: pequena demais. Confira a medida da cota.');
  });

  it('o tamanho do meio da ficha', () => {
    expect(tamanhoDoMeio(['P', 'M', 'G'])).toBe('M');
    expect(tamanhoDoMeio(['P', 'M', 'G', 'GG'])).toBe('M');
    expect(tamanhoDoMeio([])).toBeNull();
  });

  describe('na ficha: o consumo do item pelo desenho', () => {
    const ficha = (): FichaTecnica => ({ ...novaFichaTecnica({ nome: 'Blusa', codigo: 'B1', pecas: [] }, '2026-10-25T10:00:00.000Z'), tamanhos: ['P', 'M', 'G'], medidas: [comprimento], desenho: blusa() });
    const item = (unidade: ItemDeMaterial['unidade']): ItemDeMaterial => ({ id: 'i', materialId: null, descricao: 'Tecido', aplicacao: 'Corpo', unidade, consumo: CONSUMO_PELO_DESENHO_PADRAO });
    // 0,49 m² × 1,15 ÷ 0,80 = 0,704375 m² de tecido.
    const m2 = (0.49 * 1.15) / 0.8;

    it('em m²; em metros pela largura do tecido; em quilos pela gramatura', () => {
      const emM2 = consumoDoItem(item('m2'), undefined, null, ficha());
      expect(emM2.quantidade).toBeCloseTo(m2, 6);
      expect(emM2.explicacao).toBe('frente 0,245 m² + costas 0,245 m², na escala da cota de Comprimento (70 cm no M); + 15% de costura e folga, ÷ 80% de aproveitamento = 0,704 m² de tecido');
      expect(consumoDoItem(item('m'), undefined, null, ficha(), 1500).quantidade).toBeCloseTo(m2 / 1.5, 6);
      expect(consumoDoItem(item('cm'), undefined, null, ficha(), 1500).quantidade).toBeCloseTo((m2 / 1.5) * 100, 6);
      const tecido = { larguraMm: 1400, gramaturaGm2: 200 } as Material;
      expect(consumoDoItem(item('m'), tecido, null, ficha(), 1500).quantidade).toBeCloseTo(m2 / 1.4, 6);
      expect(consumoDoItem(item('kg'), tecido, null, ficha()).quantidade).toBeCloseTo((m2 * 200) / 1000, 6);
    });

    it('o tamanho escolhido dá a escala dele; o que falta é dito', () => {
      const noG = consumoDoItem({ ...item('m2'), consumo: { ...CONSUMO_PELO_DESENHO_PADRAO, tamanho: 'G' } as ItemDeMaterial['consumo'] }, undefined, null, ficha());
      expect(noG.quantidade).toBeCloseTo(m2 * (3.7 / 3.5) ** 2, 6);
      expect(consumoDoItem(item('m'), undefined, null, ficha()).erro).toBe('Pelo desenho em m ou cm: falta a largura do tecido (no material ou no enfesto).');
      expect(consumoDoItem(item('kg'), undefined, null, ficha()).erro).toContain('falta a gramatura');
      expect(consumoDoItem(item('un'), undefined, null, ficha()).erro).toContain('só em m, cm, m², kg ou g');
      expect(consumoDoItem(item('m2'), undefined, null, null).erro).toBe('Pelo desenho: falta a ficha técnica.');
      expect(consumoDoItem(item('m2'), undefined, null, { ...ficha(), tamanhos: [] }).erro).toContain('a ficha não tem tamanhos');
      const semAproveitamento = { ...item('m2'), consumo: { ...CONSUMO_PELO_DESENHO_PADRAO, aproveitamentoPercentual: 0 } as ItemDeMaterial['consumo'] };
      expect(consumoDoItem(semAproveitamento, undefined, null, ficha()).erro).toBe('Pelo desenho: o aproveitamento precisa ser de 1 a 100%.');
      expect(validarItem(semAproveitamento)).toEqual(['Tecido: o aproveitamento precisa ser de 1 a 100%.']);
    });
  });
});

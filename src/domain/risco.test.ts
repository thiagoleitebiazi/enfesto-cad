import { describe, expect, it } from 'vitest';
import { area, areaAssinada, contornosSeSobrepoem, distanciaEntreContornos, ponto, retanguloEnvolvente, type Contorno } from '../core/geometria';
import { criarMolde, type Molde, type RestricaoDeRotacao } from './molde';
import { modeloDoPlano } from './modeloDoPlano';
import { chaveDaGrade, escreverGrade, fazerRisco, pecasDaGrade, type PecaDoRisco, type RiscoGerado } from './risco';

function retangulo(id: string, nome: string, largura: number, comprimento: number, extras: Partial<Parameters<typeof criarMolde>[0]> = {}): Molde {
  return criarMolde(
    {
      nome,
      referencia: '',
      tamanho: '',
      contorno: [ponto(0, 0), ponto(largura, 0), ponto(largura, comprimento), ponto(0, comprimento)],
      linhaDeFio: { inicio: ponto(largura / 2, 10), fim: ponto(largura / 2, comprimento - 10) },
      ...extras,
    },
    id,
  );
}

const copia = (molde: Molde, extras: Partial<PecaDoRisco> = {}): PecaDoRisco => ({ pecaId: molde.id, nome: molde.nome, tamanho: 'M', molde, espelhada: false, ...extras });
const opcoes = { larguraMm: 1000, comprimentoMaximoMm: 5000, distanciaMm: 3, sentidoUnico: false };

function gerado(r: ReturnType<typeof fazerRisco>): RiscoGerado {
  if (!r.ok) throw new Error(r.motivo);
  return r;
}

/** Nenhuma peça em cima de outra, todas à distância pedida, dentro da largura e do comprimento. */
function conferirGeometria(r: RiscoGerado, distancia: number): void {
  for (const p of r.pecas) {
    const c = retanguloEnvolvente(p.contorno);
    expect(c.minX).toBeGreaterThanOrEqual(-1e-6);
    expect(c.maxX).toBeLessThanOrEqual(r.larguraDoRiscoMm + 1e-6);
    expect(c.minY).toBeGreaterThanOrEqual(-1e-6);
    expect(c.maxY).toBeLessThanOrEqual(r.comprimentoMm + 1e-6);
  }
  for (let i = 0; i < r.pecas.length; i++) {
    for (let j = i + 1; j < r.pecas.length; j++) {
      const a = r.pecas[i]!.contorno;
      const b = r.pecas[j]!.contorno;
      expect(contornosSeSobrepoem(a, b)).toBe(false);
      expect(distanciaEntreContornos(a, b)).toBeGreaterThanOrEqual(distancia - 0.02);
    }
  }
}

describe('fazerRisco — retângulos, com o resultado calculável', () => {
  it('quatro peças de 400 × 300 numa largura de 1 m: duas por fileira, 2 fileiras — 600 mm mais a distância', () => {
    const p = retangulo('a', 'Frente', 400, 300);
    const r = gerado(fazerRisco([copia(p), copia(p), copia(p), copia(p)], { M: 1 }, opcoes));
    // Duas fileiras de 300 mm com 3 mm (mais a folga de 0,01 mm do encosto) entre elas.
    expect(r.comprimentoMm).toBeCloseTo(603.01, 2);
    expect(r.larguraOcupadaMm).toBeCloseTo(803.01, 2);
    expect(r.areaDasPecasMm2).toBeCloseTo(4 * 400 * 300, 6);
    expect(r.eficienciaPercentual).toBeCloseTo(((4 * 400 * 300) / (603.01 * 1000)) * 100, 2);
    conferirGeometria(r, 3);
  });

  it('sem distância, as peças encostam (a uns centésimos de milímetro, para não se sobreporem no arredondamento)', () => {
    const p = retangulo('a', 'Frente', 400, 300);
    const r = gerado(fazerRisco([copia(p), copia(p), copia(p), copia(p)], { M: 1 }, { ...opcoes, distanciaMm: 0 }));
    expect(r.comprimentoMm).toBeGreaterThan(600);
    expect(r.comprimentoMm).toBeLessThan(600.05);
    conferirGeometria(r, 0);
  });

  it('a peça mais larga que o risco, sem poder girar, não sai — e o motivo diz qual', () => {
    const larga = retangulo('a', 'Saia', 1100, 300);
    const r = fazerRisco([copia(larga)], { M: 1 }, opcoes);
    expect(r).toEqual({
      ok: false,
      grade: { M: 1 },
      motivo: 'A peça “Saia” (M) não cabe na largura de 1,00 m em nenhuma das orientações que ela permite (a mais estreita ocupa 1,10 m).',
    });
  });

  it('com 90°/270° permitidos, a peça larga entra deitada; sem, nunca é girada', () => {
    const giro: RestricaoDeRotacao = { permite180: false, permite90e270: true };
    const r = gerado(fazerRisco([copia(retangulo('a', 'Saia', 1100, 300, { restricaoDeRotacao: giro }))], { M: 1 }, opcoes));
    expect([90, 270]).toContain(r.pecas[0]!.anguloGraus);
    const presas = Array.from({ length: 6 }, () => copia(retangulo('b', 'Frente', 300, 500)));
    expect(gerado(fazerRisco(presas, { M: 1 }, opcoes)).pecas.every((p) => p.anguloGraus === 0)).toBe(true);
  });

  it('tecido com sentido: a peça que podia virar 180° não vira', () => {
    const vira = retangulo('a', 'Frente', 300, 500, { restricaoDeRotacao: { permite180: true, permite90e270: false } });
    const pecas = Array.from({ length: 5 }, () => copia(vira));
    expect(gerado(fazerRisco(pecas, { M: 1 }, { ...opcoes, sentidoUnico: true })).pecas.every((p) => p.anguloGraus === 0)).toBe(true);
  });

  it('o risco que passa do comprimento máximo (a mesa) não sai, e o motivo diz o que fazer', () => {
    const p = retangulo('a', 'Frente', 600, 400);
    const r = fazerRisco(Array.from({ length: 4 }, () => copia(p)), { M: 4 }, { ...opcoes, comprimentoMaximoMm: 1000 });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.motivo).toContain('não cabem num risco de até 1,00 m (a mesa menos as margens)');
    expect(!r.ok && r.motivo).toContain('Use uma grade com menos roupas por risco, ou uma mesa mais comprida.');
  });
});

describe('fazerRisco — formas irregulares', () => {
  const L: Contorno = [ponto(0, 0), ponto(250, 0), ponto(250, 80), ponto(80, 80), ponto(80, 400), ponto(0, 400)];
  const triangulo: Contorno = [ponto(0, 0), ponto(300, 0), ponto(150, 260)];
  const comCostura = (id: string, nome: string, contorno: Contorno) => retangulo(id, nome, 1, 1, { contorno, margemDeCosturaMm: 10 });

  it('nenhuma sobreposição, a distância pedida entre as linhas de corte, tudo dentro da largura', () => {
    const pecas = [
      ...Array.from({ length: 5 }, () => copia(comCostura('l', 'Gola', L))),
      ...Array.from({ length: 6 }, () => copia(comCostura('t', 'Reforço', triangulo))),
      ...Array.from({ length: 3 }, () => copia(retangulo('r', 'Bolso', 180, 220))),
    ];
    const r = gerado(fazerRisco(pecas, { M: 1 }, { ...opcoes, distanciaMm: 5 }));
    expect(r.pecas).toHaveLength(14);
    conferirGeometria(r, 5);
    // A área é a das linhas de corte (com a costura, maior que a do contorno).
    expect(r.areaDasPecasMm2).toBeGreaterThan(5 * area(L) + 6 * area(triangulo) + 3 * 180 * 220);
  });

  it('da peça em par, metade das cópias sai espelhada (o sentido do contorno troca)', () => {
    // Sem costura: a linha de corte é o próprio contorno, e o sentido dele mostra o lado.
    const manga = { ...retangulo('m', 'Manga', 1, 1, { contorno: L }), emPar: true as const };
    const pecas = [copia(manga), copia(manga, { espelhada: true }), copia(manga), copia(manga, { espelhada: true })];
    const r = gerado(fazerRisco(pecas, { M: 2 }, opcoes));
    const sinal = Math.sign(areaAssinada(L));
    expect(r.pecas.map((p) => Math.sign(areaAssinada(p.contorno))).sort()).toEqual([-sinal, -sinal, sinal, sinal].sort());
    expect(r.pecas.filter((p) => p.espelhada)).toHaveLength(2);
  });

  it('as ordens tentadas param no limite de tempo (a primeira vai até o fim)', () => {
    let relogio = 0;
    const r = gerado(fazerRisco([copia(retangulo('a', 'Frente', 300, 300))], { M: 1 }, { ...opcoes, tempoLimiteMs: 10, agora: () => (relogio += 100) }));
    expect(r.ordensTentadas).toEqual(['maior área primeiro']);
    const todas = gerado(fazerRisco([copia(retangulo('a', 'Frente', 300, 300))], { M: 1 }, opcoes));
    expect(todas.ordensTentadas).toEqual(['maior área primeiro', 'mais compridas primeiro', 'mais largas primeiro']);
  });
});

describe('pecasDaGrade', () => {
  it('em cada tamanho, as roupas da grade vezes as peças por roupa; do par, uma em cada duas espelhada', () => {
    const frente = retangulo('f', 'Frente', 400, 600, { tamanho: 'P' });
    const frenteM = retangulo('fm', 'Frente', 420, 620, { tamanho: 'M' });
    const manga = { ...retangulo('m', 'Manga', 200, 300, { tamanho: 'M', quantidade: 2 }), emPar: true as const };
    const modelo = modeloDoPlano([frente, frenteM, manga]);
    const pecas = pecasDaGrade(modelo, { P: 1, M: 2 }, { f: 1, fm: 1, m: 2 });
    expect(pecas.map((p) => `${p.tamanho} ${p.nome}${p.espelhada ? ' (esq.)' : ''}`)).toEqual([
      'P Frente',
      'M Frente',
      'M Frente',
      'M Manga',
      'M Manga (esq.)',
      'M Manga',
      'M Manga (esq.)',
    ]);
  });

  it('escreve e identifica a grade', () => {
    expect(escreverGrade({ P: 1, M: 2, G: 0 })).toBe('1 P + 2 M');
    expect(chaveDaGrade({ M: 2, P: 1 }, ['P', 'M', 'G'])).toBe('P:1|M:2|G:0');
  });
});

import { describe, expect, it } from 'vitest';
import type { PontoDeMedida } from './fichaTecnica';
import { csvDoGuia, elasticidadeDoTecido, guiaDeMedidas, htmlDoGuia, lerElasticidadeDaRecomendacao, lerRegrasDeCaimento, recomendarTamanho, regraSugerida, regrasDaFicha } from './recomendacaoDeTamanho';

/** A tabela de uma camisa (a peça pronta): busto e quadril de P a GG, e o comprimento. */
const MEDIDAS: PontoDeMedida[] = [
  { id: 'busto', nome: 'Busto', comoMedir: '', toleranciaCm: 1, valoresCm: { P: 96, M: 100, G: 104, GG: 110 } },
  { id: 'quadril', nome: 'Quadril', comoMedir: '', toleranciaCm: 1, valoresCm: { P: 98, M: 102, G: 106, GG: 112 } },
  { id: 'comp', nome: 'Comprimento total', comoMedir: '', toleranciaCm: 1, valoresCm: { P: 70, M: 72, G: 74, GG: 76 } },
  { id: 'gola', nome: 'Abertura da gola', comoMedir: '', toleranciaCm: 0.5, valoresCm: { P: 18, M: 18.5, G: 19, GG: 19.5 } },
];
const FICHA = { medidas: MEDIDAS, tamanhos: ['P', 'M', 'G', 'GG'] };
const REGRAS = regrasDaFicha(FICHA);

describe('a recomendação de tamanho — as regras', () => {
  it('a regra sugerida pelo nome: a folga do busto, do quadril; o comprimento; o ponto sem nome conhecido fica fora', () => {
    expect(regraSugerida('Busto')).toEqual({ usar: true, tipo: 'circunferencia', folgaCm: 8, peso: 2 });
    expect(regraSugerida('Circunferência do QUADRIL')).toMatchObject({ tipo: 'circunferencia', folgaCm: 6 });
    expect(regraSugerida('Comprimento total')).toMatchObject({ tipo: 'comprimento', folgaCm: 0 });
    expect(regraSugerida('Abertura da gola')).toBeNull();
    expect(REGRAS.gola).toMatchObject({ usar: false });
    expect(regrasDaFicha(FICHA, { busto: { usar: true, tipo: 'circunferencia', folgaCm: 4, peso: 1 } }).busto!.folgaCm).toBe(4);
  });
});

describe('a recomendação de tamanho — o tamanho', () => {
  it('o corpo de 92/96 com 70 de comprimento: o M (busto 92 + 8 = 100, quadril 96 + 6 = 102), na medida', () => {
    const r = recomendarTamanho(FICHA, REGRAS, { busto: 92, quadril: 96, comp: 72 });
    expect(r.recomendado).toBe('M');
    expect(r.alternativa).toBeNull();
    expect(r.faltando).toEqual([]);
    expect(r.explicacao[0]).toMatch(/^O M é o que mais se aproxima do caimento pedido/);
    expect(r.explicacao).toContain('Busto: corpo 92,0 cm + folga 8,0 cm = 100,0 cm; o M tem 100,0 cm (± 1,0): na medida certa.');
    expect(r.explicacao).toContain('Comprimento total: o ideal é 72,0 cm; o M tem 72,0 cm (± 1,0): na medida certa.');
  });

  it('o mais justo que o ideal pesa o triplo: entre o M (justo) e o G (folgado), fica o G', () => {
    // Busto 94: ideal 102 — o M tem 100 (2 a menos), o G tem 104 (2 a mais).
    const r = recomendarTamanho(FICHA, REGRAS, { busto: 94, quadril: 98, comp: 73 });
    expect(r.recomendado).toBe('G');
    expect(r.alternativa).toBe('M');
  });

  it('entre dois tamanhos: o segundo, quando fica perto, é dito', () => {
    const r = recomendarTamanho(FICHA, REGRAS, { busto: 93.5, quadril: 97.5, comp: 72.5 });
    expect(r.recomendado).not.toBeNull();
    expect(r.alternativa).not.toBeNull();
    expect(r.explicacao[0]).toMatch(/também serve \(a pessoa está entre os dois\)/);
    // Meio centímetro acima do M (de um passo de 4 cm): só o M.
    const perto = recomendarTamanho(FICHA, REGRAS, { busto: 92.5, quadril: 96.5, comp: 72.5 });
    expect([perto.recomendado, perto.alternativa]).toEqual(['M', null]);
  });

  it('o tamanho que aperta (menor que o corpo, mesmo na tolerância) não é recomendado, e a explicação diz onde', () => {
    const r = recomendarTamanho(FICHA, REGRAS, { busto: 100, quadril: 100, comp: 74 });
    expect(r.tamanhos.find((t) => t.tamanho === 'P')!.veste).toBe(false);
    expect(r.recomendado).not.toBe('P');
    expect(r.explicacao.some((l) => l.startsWith('O P aperta em: Busto, Quadril'))).toBe(true);
  });

  it('nenhum veste: o maior, com o aviso do quanto aperta', () => {
    const r = recomendarTamanho(FICHA, REGRAS, { busto: 115, quadril: 100, comp: 76 });
    expect(r.recomendado).toBe('GG');
    expect(r.explicacao[0]).toMatch(/^Nenhum tamanho veste com a folga pedida: o GG .* aperta em Busto \(4,0 cm a menos que o corpo\)/);
  });

  it('o que falta: a medida do corpo de um ponto usado; nenhum ponto usado', () => {
    const r = recomendarTamanho(FICHA, REGRAS, { busto: 92 });
    expect(r.faltando).toEqual(['Falta a medida do corpo: Quadril.', 'Falta a medida do corpo: Comprimento total.']);
    expect(r.recomendado).toBe('M');
    const nenhum = recomendarTamanho(FICHA, {}, { busto: 92 });
    expect(nenhum.recomendado).toBeNull();
    expect(nenhum.faltando[0]).toMatch(/Escolha ao menos um ponto/);
  });
});

describe('a recomendação de tamanho — o guia de medidas para a loja', () => {
  it('as faixas do corpo: a peça menos a folga, os vizinhos dividindo o caminho', () => {
    const guia = guiaDeMedidas(FICHA, REGRAS);
    expect(guia.map((f) => f.nome)).toEqual(['Busto', 'Quadril', 'Comprimento total']);
    // Busto do corpo: P 88, M 92, G 96, GG 102.
    expect(guia[0]!.porTamanho).toEqual({
      P: { idealCm: 88, deCm: 86, ateCm: 90 },
      M: { idealCm: 92, deCm: 90, ateCm: 94 },
      G: { idealCm: 96, deCm: 94, ateCm: 99 },
      GG: { idealCm: 102, deCm: 99, ateCm: 105 },
    });
    const csv = csvDoGuia(guia, FICHA.tamanhos).trim().split('\r\n');
    expect(csv[0]).toBe('Medida do corpo (cm);P;M;G;GG');
    expect(csv[1]).toBe('Busto;86–90;90–94;94–99;99–105');
    const html = htmlDoGuia('Guia de medidas — Camisa <básica>', guia, FICHA.tamanhos);
    expect(html).toContain('<title>Guia de medidas — Camisa &lt;básica&gt;</title>');
    expect(html).toContain('<th>Busto</th><td>86–90</td>');
  });

  it('a leitura das regras guardadas', () => {
    expect(lerRegrasDeCaimento({ a: { usar: true, tipo: 'comprimento', folgaCm: 0, peso: 1 }, b: { usar: 'sim' }, c: null })).toEqual({ a: { usar: true, tipo: 'comprimento', folgaCm: 0, peso: 1 } });
    expect(lerRegrasDeCaimento(undefined)).toEqual({});
  });
});

describe('a recomendação de tamanho — o tecido que cede (ADR 0119)', () => {
  const CORPO_GRANDE = { busto: 113, quadril: 115, comp: 76 };

  it('no tecido plano, o corpo maior que o GG não veste em nenhum; na malha com elastano, o GG veste esticando', () => {
    const plano = recomendarTamanho(FICHA, REGRAS, CORPO_GRANDE);
    expect(plano.tamanhos.every((t) => !t.veste)).toBe(true);
    expect(plano.explicacao[0]).toMatch(/Nenhum tamanho veste/);
    const malha = recomendarTamanho(FICHA, REGRAS, CORPO_GRANDE, elasticidadeDoTecido('malha-com-elastano'));
    expect(malha.recomendado).toBe('GG');
    const gg = malha.tamanhos.find((t) => t.tamanho === 'GG')!;
    expect(gg.veste).toBe(true);
    const busto = gg.pontos.find((p) => p.pontoId === 'busto')!;
    // 110 cm de peça, cedendo 15%: 16,5 cm a mais; o comprimento não cede.
    expect(busto).toMatchObject({ cedeCm: 16.5, aperta: false, esticaParaVestir: true });
    expect(gg.pontos.find((p) => p.pontoId === 'comp')!.cedeCm).toBe(0);
    expect(malha.explicacao).toContain('O tecido cede até 15% na volta: o tamanho um pouco menor que o corpo ainda veste (justo, esticado no corpo).');
    expect(malha.explicacao.some((l) => l.startsWith('Busto: corpo 113,0 cm') && l.includes('cede até 16,5 cm') && l.endsWith('e veste esticando.'))).toBe(true);
  });

  it('a malha que cede pouco não salva o tamanho muito menor: aperta, e diz que mesmo cedendo', () => {
    const r = recomendarTamanho(FICHA, REGRAS, { busto: 120, quadril: 122, comp: 76 }, elasticidadeDoTecido('malha'));
    expect(r.tamanhos.every((t) => !t.veste)).toBe(true);
    expect(r.explicacao[0]).toMatch(/mesmo com o tecido cedendo/);
  });

  it('a leitura do projeto: sem ela, o plano; o personalizado fica entre 0 e 40%', () => {
    expect(lerElasticidadeDaRecomendacao(undefined)).toEqual({ tecido: 'plano', cedePercentual: 0 });
    expect(lerElasticidadeDaRecomendacao({ tecido: 'malha' })).toEqual({ tecido: 'malha', cedePercentual: 5 });
    expect(lerElasticidadeDaRecomendacao({ tecido: 'personalizado', cedePercentual: 60 })).toEqual({ tecido: 'personalizado', cedePercentual: 40 });
    expect(lerElasticidadeDaRecomendacao({ tecido: 'lã', cedePercentual: 10 })).toEqual({ tecido: 'plano', cedePercentual: 0 });
  });
});

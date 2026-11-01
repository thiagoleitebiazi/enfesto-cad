import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde } from '../domain/molde';
import { gerarPlt } from './plt-exportacao';
import { lerHpgl } from './plt-importacao';
import { calibracaoDasMedidas, calibracaoGuardada, LARGURA_DA_PAGINA_MM, paginaDeTesteDoPlotter, testeDaMesaDeCorte } from './testeDoEquipamento';

const AGORA = '2026-10-31T12:00:00.000Z';

describe('a página de teste do plotter (ADR 0217)', () => {
  const plt = paginaDeTesteDoPlotter(1000, AGORA);

  it('a moldura tem as medidas prometidas', () => {
    const { tracos } = lerHpgl(plt);
    const pontos = tracos.flatMap((t) => [...t.pontos]);
    const xs = pontos.map((p) => p.x / 40);
    const ys = pontos.map((p) => p.y / 40);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(1000, 3);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(LARGURA_DA_PAGINA_MM, 3);
  });

  it('o quadrado tem 100 mm, sem depender de nada da mesa', () => {
    expect(plt).toContain("PD800,800,4800,800,4800,4800,800,4800");
  });

  it('traz a régua de 100 em 100 e diz o que é', () => {
    expect(plt).toContain('LB900');
    expect(plt).toContain('LBTeste do plotter - 2026-10-31');
    expect(plt).toContain('LBMoldura 1000 x 140 mm');
  });

  it('usa as canetas do plotter de verdade, como um risco', () => {
    expect(paginaDeTesteDoPlotter(500, AGORA, { ferramentas: { corte: 4 } })).toContain('SP4');
  });
});

describe('o teste da mesa de corte (ADR 0217)', () => {
  it('é um quadrado de 100 mm com a faca', () => {
    const iso = testeDaMesaDeCorte();
    expect(iso).toContain('T1');
    expect(iso).toContain('M30');
    expect(iso).toContain('X120.00 Y120.00');
    expect(iso).toContain('G21');
  });
});

describe('a correção pelas medidas (ADR 0217)', () => {
  it('o que saiu maior é encolhido, em cada sentido', () => {
    const c = calibracaoDasMedidas({ comprimentoMm: 1005, larguraMm: 139.3 }, 1000, AGORA);
    expect(c.horizontal).toBeCloseTo(1000 / 1005, 8);
    expect(c.vertical).toBeCloseTo(140 / 139.3, 8);
    expect(c.quandoIso).toBe(AGORA);
  });

  it('recusa a medida absurda, e diz por quê', () => {
    expect(() => calibracaoDasMedidas({ comprimentoMm: 500, larguraMm: 140 }, 1000, AGORA)).toThrow('10%');
    expect(() => calibracaoDasMedidas({ comprimentoMm: 0, larguraMm: 140 }, 1000, AGORA)).toThrow('Escreva a medida do comprimento');
    expect(() => calibracaoDasMedidas({ comprimentoMm: 1000, larguraMm: Number.NaN }, 1000, AGORA)).toThrow('Escreva a medida da largura');
  });

  it('vale em todo o risco: peças, moldura, linhas e emendas', () => {
    const peca = criarMolde({ nome: 'a', referencia: '', tamanho: 'M', quantidade: 1, contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 200), ponto(0, 200)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 180) }, restricaoDeRotacao: { permite180: true, permite90e270: false } }, 'a');
    const medir = (texto: string): { x: number; y: number } => {
      const p = lerHpgl(texto).tracos.flatMap((t) => [...t.pontos]);
      return { x: Math.max(...p.map((q) => q.x)), y: Math.max(...p.map((q) => q.y)) };
    };
    const opcoes = { larguraDaMesaMm: 1000, comprimentoDaMesaMm: 2000, emendas: [1000] };
    const a = medir(gerarPlt([peca], opcoes));
    const b = medir(gerarPlt([peca], { ...opcoes, calibracao: { horizontal: 1.01, vertical: 0.98 } }));
    expect(b.x / a.x).toBeCloseTo(1.01, 4);
    expect(b.y / a.y).toBeCloseTo(0.98, 4);
  });

  it('a correção guardada volta; a estragada, não', () => {
    expect(calibracaoGuardada(JSON.stringify({ horizontal: 1.002, vertical: 0.999, quandoIso: AGORA }))).toMatchObject({ horizontal: 1.002 });
    expect(calibracaoGuardada(JSON.stringify({ horizontal: 3, vertical: 1 }))).toBeNull();
    expect(calibracaoGuardada('{quebrado')).toBeNull();
    expect(calibracaoGuardada(null)).toBeNull();
  });
});

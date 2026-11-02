import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { criarConfiguracaoDeEnfesto } from '../domain/enfesto';
import { criarMolde, type Molde } from '../domain/molde';
import { gerarIso } from './iso-exportacao';
import { tracosDoIso } from './iso-importacao';
import { gerarPdfDeEncaixe } from './pdf-exportacao';
import { pecasDosTracos } from './tracos-importacao';

const peca = (id: string): Molde => criarMolde({ nome: id, referencia: '', tamanho: 'M', quantidade: 1, contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 200), ponto(0, 200)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 180) }, restricaoDeRotacao: { permite180: true, permite90e270: false } }, id);

describe('a costura no PDF (ADR 0221)', () => {
  it('sai no traço escolhido', async () => {
    const e = criarConfiguracaoDeEnfesto({ tipo: 'impar', larguraUtilMm: 1000, comprimentoMm: 3000, quantidadeDeCamadas: 1, margemLateralMm: 0, margemDeExtremidadeMm: 0, distanciaMinimaEntrePecasMm: 0 });
    const comMargem = { ...peca('a'), margemDeCosturaMm: 10 };
    const opcoes = { formato: 'A4', orientacao: 'retrato', margemMm: 10 } as const;
    const texto = async (b: Blob): Promise<string> => Buffer.from(await b.arrayBuffer()).toString('latin1');
    const contar = (t: string): number => (t.match(/\] 0 d/g) ?? []).length;
    const cheia = contar(await texto(await gerarPdfDeEncaixe([comMargem], e, opcoes)));
    expect(contar(await texto(await gerarPdfDeEncaixe([comMargem], e, { ...opcoes, estiloDaCostura: 'tracejada' })))).toBeGreaterThan(cheia);
  });
});

describe('as emendas no PDF do encaixe (ADR 0210)', () => {
  it('saem na folha', async () => {
    const e = criarConfiguracaoDeEnfesto({ tipo: 'impar', larguraUtilMm: 1000, comprimentoMm: 3000, quantidadeDeCamadas: 1, margemLateralMm: 0, margemDeExtremidadeMm: 0, distanciaMinimaEntrePecasMm: 0 });
    const opcoes = { formato: 'A4', orientacao: 'retrato', margemMm: 10 } as const;
    const sem = await gerarPdfDeEncaixe([peca('a')], e, opcoes);
    const com = await gerarPdfDeEncaixe([peca('a')], { ...e, emendasMm: [100] }, opcoes);
    expect(com.size).toBeGreaterThan(sem.size);
  });
});

describe('as marcas do furador no ISO importado (ADR 0220)', () => {
  it('o furo pelo eixo Z e o de M43 voltam como furos da peça', () => {
    const iso = ['%', 'T1', 'G0 Z5', 'G0 X10 Y10', 'G1 Z0', 'G1 X110 Y10 F1000', 'G1 X110 Y110', 'G1 X10 Y110', 'G1 X10 Y10', 'G0 Z5', 'T4', 'G0 X30 Y30', 'G1 Z0', 'G0 Z5', 'G0 X70 Y70', 'M43', 'M44', 'M30', '%'].join('\n');
    const { pecas } = pecasDosTracos(tracosDoIso(iso));
    expect(pecas).toHaveLength(1);
    expect(pecas[0]!.furos).toHaveLength(2);
  });
});

describe('o ISO volta sem depender de como a mesa corta (ADR 0236)', () => {
  const quadrado = (id: string, y: number): Molde => criarMolde({ nome: id, referencia: '', tamanho: '', contorno: [ponto(0, y), ponto(0, y + 200), ponto(300, y + 200), ponto(300, y)], linhaDeFio: { inicio: ponto(50, y + 100), fim: ponto(250, y + 100) } }, id);
  const pecas = (iso: string) => pecasDosTracos(tracosDoIso(iso));

  it('a faca tangencial sobe em cada canto: os pedaços se emendam, e as peças voltam', () => {
    const { pecas: lidas, avisos } = pecas(gerarIso([quadrado('a', 0), quadrado('b', 400)], { facaTangencial: true }));
    expect(avisos).toEqual([]);
    expect(lidas).toHaveLength(2);
  });

  it('com a compensação da lâmina, as pontas não coincidem, e mesmo assim fecham', () => {
    const { pecas: lidas } = pecas(gerarIso([quadrado('a', 0)], { facaTangencial: true, compensacaoDaLaminaMm: 2 }));
    expect(lidas).toHaveLength(1);
    const xs = lidas[0]!.contorno.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(295);
  });

  it('o pique que sai de um canto não atrapalha a emenda: fica pique, fora do contorno', () => {
    const iso = ['G0 Z5', 'G0 X0 Y0', 'G1 Z0', 'G1 X0 Y-8', 'G0 Z5', 'G0 X0 Y0', 'G1 Z0', 'G1 X100 Y0', 'G0 Z5', 'G1 Z0', 'G1 X100 Y100', 'G0 Z5', 'G1 Z0', 'G1 X0 Y100', 'G0 Z5', 'G1 Z0', 'G1 X0 Y0', 'G0 Z5'].join('\n');
    const { pecas: lidas } = pecas(iso);
    expect(lidas).toHaveLength(1);
    expect(lidas[0]!.contorno).toHaveLength(4);
  });

  it('a mesa que não usa Z: G1 corta e G0 anda', () => {
    const iso = ['G21', 'G00 X10 Y10', 'G01 X110 Y10', 'G01 X110 Y110', 'G01 X10 Y110', 'G01 X10 Y10', 'G00 X0 Y0', 'M30'].join('\n');
    expect(pecas(iso).pecas).toHaveLength(1);
  });

  it('comentário com ponto e vírgula, número de linha e polegadas', () => {
    const iso = ['N1 G20 ; polegadas', 'N2 G0 X0 Y0', 'N3 G1 X4 Y0', 'N4 X4 Y4', 'N5 X0 Y4', 'N6 X0 Y0'].join('\n');
    const { pecas: lidas } = pecas(iso);
    expect(lidas).toHaveLength(1);
    const ys = lidas[0]!.contorno.map((p) => p.y);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(101.6, 3);
  });

  it('os arcos viram curva: um círculo de 50 mm de raio', () => {
    const iso = ['G0 X50 Y0', 'G2 X-50 Y0 I-50 J0', 'G2 X50 Y0 I50 J0', 'G0 X0 Y0'].join('\n');
    const { pecas: lidas } = pecas(iso);
    expect(lidas).toHaveLength(1);
    expect(lidas[0]!.contorno.length).toBeGreaterThan(40);
    const xs = lidas[0]!.contorno.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(100, 0);
  });

  it('o contorno com um vão: quando nada fecha, a linha que quase fecha é a peça', () => {
    const iso = ['G0 X0 Y0', 'G1 X300 Y0', 'G1 X300 Y300', 'G1 X0 Y300', 'G1 X0 Y30', 'G0 X0 Y0'].join('\n');
    expect(pecas(iso).pecas).toHaveLength(1);
  });

  it('o arquivo sem desenho nenhum diz isso, e não fala em linha fechada', () => {
    expect(pecas('%\nO arquivo de texto qualquer\n%\n').avisos[0]).toMatch(/não traz o desenho de nenhuma peça/);
  });
});

import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { criarConfiguracaoDeEnfesto } from '../domain/enfesto';
import { criarMolde, type Molde } from '../domain/molde';
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

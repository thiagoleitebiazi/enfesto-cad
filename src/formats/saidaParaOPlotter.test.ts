import { describe, expect, it } from 'vitest';
import { ponto, retanguloEnvolvente } from '../core/geometria';
import { criarConfiguracaoDeEnfesto } from '../domain/enfesto';
import { criarMolde, type Molde } from '../domain/molde';
import { ehDmpl, hpglDoDmpl } from './dmpl-importacao';
import { tracosDoTexto } from './fonteDeTracos';
import { gerarPdfDeEncaixe } from './pdf-exportacao';
import { gerarPlt, type ElementoDoPlotter } from './plt-exportacao';
import { pecasDoPlt } from './plt-importacao';

const peca = (id: string): Molde => criarMolde({ nome: id, referencia: '', tamanho: 'M', quantidade: 1, contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 200), ponto(0, 200)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 180) }, restricaoDeRotacao: { permite180: true, permite90e270: false } }, id);

/** Os comandos do risco, sem o começo e o fim. */
const comandos = (pecas: readonly Molde[], niveis?: Partial<Record<ElementoDoPlotter, number>>): string[] => gerarPlt(pecas, { ferramentas: { corte: 5, fio: 6, textos: 7 }, ...(niveis ? { niveis } : {}) }).split(';');

describe('os níveis de impressão (ADR 0210)', () => {
  it('sem níveis, sai peça por peça, como sempre', () => {
    const c = comandos([peca('a'), peca('b')]);
    expect(c.filter((x) => x.startsWith('SP')).slice(1, 7)).toEqual(['SP5', 'SP1', 'SP6', 'SP1', 'SP7', 'SP5']);
  });

  it('com níveis, cada um sai inteiro, em todas as peças, do menor para o maior', () => {
    const c = comandos([peca('a'), peca('b')], { corte: 3, fio: 2, textos: 1, costura: 1, furos: 1, internas: 1, piques: 1 });
    const canetas = c.filter((x) => /^SP[567]$/.test(x));
    expect([...new Set(canetas)]).toEqual(['SP7', 'SP6', 'SP5']);
    expect(canetas.lastIndexOf('SP7')).toBeLessThan(canetas.indexOf('SP6'));
  });

  it('o cabeçalho, as emendas e as linhas saem com os nomes: nada de tinta depois do corte', () => {
    const c = gerarPlt([peca('a')], { ferramentas: { corte: 5 }, niveis: { corte: 2 }, cabecalho: ['Risco de teste'], emendas: [50], linhas: [{ de: ponto(0, 10), ate: ponto(100, 10), nome: 'Referencia' }] }).split(';');
    const corte = c.indexOf('SP5');
    for (const texto of ['LBRisco de teste\x03', 'LBEMENDA\x03', 'LBReferencia\x03']) {
      expect(c.indexOf(texto), texto).toBeGreaterThanOrEqual(0);
      expect(c.indexOf(texto), texto).toBeLessThan(corte);
    }
  });

  it('o elemento sem nível é do nível 1', () => {
    const c = comandos([peca('a')], { corte: 2 });
    expect(c.indexOf('SP5')).toBeGreaterThan(c.indexOf('SP7'));
  });

  it('cada elemento sai uma vez só', () => {
    const conta = (s: string[]): number => s.filter((x) => x.startsWith('LB')).length;
    expect(conta(comandos([peca('a'), peca('b')], { corte: 2, textos: 3 }))).toBe(conta(comandos([peca('a'), peca('b')])));
  });
});

describe('o arquivo DMPL (ADR 0210)', () => {
  it('reconhece pelo começo', () => {
    expect(ehDmpl(' ;:H A EC1 U 0,0')).toBe(true);
    expect(ehDmpl('IN;SP1;')).toBe(false);
  });

  it('traduz para HPGL, na unidade do arquivo', () => {
    expect(hpglDoDmpl(';:H A EC1 P1 U 1000,0 D 2000,0 2000,1000 @ D 9,9')).toBe('IN;SP1;PU0,0;SP1;PU1016,0;PD2032,0;PD2032,1016;\n');
    expect(hpglDoDmpl(';:ECN U 100,0')).toContain('PU400,0');
  });

  it('lê como os arquivos de verdade, tudo colado, com o tipo de linha e a velocidade', () => {
    expect(hpglDoDmpl(';:HL0EC1UP1AU1000,2000DR500,0,0,-500U@')).toBe('IN;SP1;PU0,0;SP1;PU1016,2032;PD1524,2032;PD1524,1524;\n');
    expect(hpglDoDmpl(' ;:ECN A L0 V5 BP120 U100,0 D200,0 ')).toBe('IN;SP1;PU400,0;PD800,0;\n');
  });

  it('entende o relativo', () => {
    expect(hpglDoDmpl(';:A EC1 U 1000,1000 R D 500,0 0,500')).toContain('PD1524,1016;PD1524,1524');
  });

  it('a peça fechada vira peça, pelo importador do PLT', () => {
    const { pecas } = pecasDoPlt(hpglDoDmpl(';:H A EC1 U 0,0 D 4000,0 4000,8000 0,8000 0,0 U P0 @'));
    expect(pecas).toHaveLength(1);
    const c = retanguloEnvolvente(pecas[0]!.contorno);
    expect(Math.max(c.maxX - c.minX, c.maxY - c.minY)).toBeCloseTo(203.2, 1);
    expect(Math.min(c.maxX - c.minX, c.maxY - c.minY)).toBeCloseTo(101.6, 1);
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

describe('a descrição da peça (ADR 0219)', () => {
  it('sai no plotter, perto do nome; sem ela, nada muda', () => {
    expect(gerarPlt([{ ...peca('a'), descricao: 'Frente esquerda' }])).toContain('LBFrente esquerda\x03');
    expect(gerarPlt([peca('a')]).match(/LB/g)).toHaveLength(1);
  });
});

describe('o texto em traços, com acentos (ADR 0218)', () => {
  const pontosDe = (t: string) => tracosDoTexto(t, 6).flat();

  it('o acento fica em cima da letra e não empurra a seguinte', () => {
    const a = tracosDoTexto('AB', 6);
    const b = tracosDoTexto('ÃB', 6);
    expect(b).toHaveLength(a.length + 1);
    expect(retanguloEnvolvente(pontosDe('Ã')).maxY).toBeCloseTo(8, 6);
    expect(retanguloEnvolvente(pontosDe('ÃB')).maxX).toBeCloseTo(retanguloEnvolvente(pontosDe('AB')).maxX, 6);
  });

  it('a cedilha fica embaixo', () => {
    expect(retanguloEnvolvente(pontosDe('Ç')).minY).toBeCloseTo(-2, 6);
  });

  it('um sinal que não é do português é ignorado, sem andar', () => {
    expect(tracosDoTexto('A\u0308B', 6)).toEqual(tracosDoTexto('AB', 6));
  });
});

import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { criarConfiguracaoDeEnfesto } from '../domain/enfesto';
import { criarMolde, type Molde } from '../domain/molde';
import { comAjusteDoTecido } from '../domain/tecidosDoModelo';
import { csvDaEnfestadeira } from './fichaDaEnfestadeira';
import { hpglDoRecebido } from './plotRecebido';
import { pecasDoPlt } from './plt-importacao';

const QUADRADO = 'IN;SP1;PU400,400;PD4400,400,4400,4400,400,4400,400,400;';

describe('o que chega no receptor do plotter (ADR 0222)', () => {
  it('HPGL puro passa como veio', () => {
    expect(hpglDoRecebido(QUADRADO)).toBe(QUADRADO);
  });

  it('tira o embrulho do driver de impressora', () => {
    const embrulhado = `\x1b%-12345X@PJL JOB\n@PJL ENTER LANGUAGE=HPGL2\n\x1bE\x1b%-1B${QUADRADO}\x1b%0A\x1bE\x1b%-12345X`;
    const { pecas } = pecasDoPlt(hpglDoRecebido(embrulhado)!);
    expect(pecas).toHaveLength(1);
  });

  it('DMPL e ISO viram HPGL', () => {
    expect(hpglDoRecebido(';:H A EC1 U 0,0 D 1000,0 @')).toContain('PD1016,0');
    expect(hpglDoRecebido('%\nG90\nG0 X0 Y0\nG1 Z0\nG1 X10 Y0\nG0 Z5\nM30\n%')).toContain('PD400,0');
  });

  it('PostScript, PDF e lixo não têm linhas para ler', () => {
    expect(hpglDoRecebido('%!PS-Adobe-3.0\nshowpage')).toBeNull();
    expect(hpglDoRecebido('%PDF-1.7')).toBeNull();
    expect(hpglDoRecebido('texto qualquer')).toBeNull();
    expect(hpglDoRecebido('')).toBeNull();
  });
});

describe('a ficha da enfestadeira (ADR 0222)', () => {
  const peca = (id: string, tecidoDoMolde?: string): Molde => ({
    ...criarMolde({ nome: id, referencia: '', tamanho: 'M', quantidade: 1, contorno: [ponto(10, 10), ponto(110, 10), ponto(110, 510), ponto(10, 510)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(50, 20), fim: ponto(50, 180) }, restricaoDeRotacao: { permite180: true, permite90e270: false } }, id),
    ...(tecidoDoMolde ? { tecidoDoMolde } : {}),
  });
  const e = comAjusteDoTecido(criarConfiguracaoDeEnfesto({ tipo: 'impar', larguraUtilMm: 1500, comprimentoMm: 3000, quantidadeDeCamadas: 40, margemLateralMm: 0, margemDeExtremidadeMm: 0, distanciaMinimaEntrePecasMm: 0 }), 'Forro', { emendasMm: [200, 400] });

  it('uma linha por tecido, com o comprimento, as camadas e o total', () => {
    const linhas = csvDaEnfestadeira({ nome: 'Camisa; verão', codigo: 'C1' }, [peca('a'), peca('b', 'Forro')], e).trim().split('\r\n');
    expect(linhas).toHaveLength(3);
    expect(linhas[1]).toBe('"Camisa; verão";C1;Principal;Ímpar;1500,0;510,0;40;20,40;');
    expect(linhas[2]).toContain(';Forro;');
    expect(linhas[2]).toContain('200 400');
  });

  it('a peça fora da mesa não conta', () => {
    const fora = { ...peca('b'), contorno: peca('b').contorno.map((p) => ponto(p.x, p.y + 4000)) };
    expect(csvDaEnfestadeira({ nome: 'x', codigo: 'c' }, [peca('a'), fora], e)).toContain(';510,0;');
  });
});

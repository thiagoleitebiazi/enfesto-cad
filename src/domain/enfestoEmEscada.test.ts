import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { csvDaEnfestadeira } from '../formats/fichaDaEnfestadeira';
import { blocosEmEscada, camadasDosBlocos, consumoDaEscadaMm, degrausDaEscada } from './enfestoEmEscada';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from './enfesto';
import type { BlocoDoGrupo } from './gruposDoEncaixe';
import { criarMolde, type Molde } from './molde';
import { lerBlocos } from './ocupacaoNoEncaixe';
import { statusDoEncaixe } from './statusDoEncaixe';

const bloco = (grupo: string, inicioMm: number, fimMm: number): BlocoDoGrupo => ({ grupo, inicioMm, fimMm, pecas: 1 });

describe('os degraus da escada (ADR 0224)', () => {
  it('as camadas de todos vão na mesa inteira; as a mais, até o fim do bloco delas', () => {
    const d = degrausDaEscada([bloco('Bloco 1', 0, 1000), bloco('Bloco 2', 1000, 3000)], { 'Bloco 1': 40, 'Bloco 2': 20 }, 1);
    expect(d).toEqual([
      { comprimentoMm: 3000, camadas: 20 },
      { comprimentoMm: 1000, camadas: 20 },
    ]);
  });

  it('o consumo é o de cada bloco vezes as camadas dele', () => {
    const d = degrausDaEscada([bloco('Bloco 1', 0, 1000), bloco('Bloco 2', 1000, 3000)], { 'Bloco 1': 40, 'Bloco 2': 20 }, 1);
    expect(consumoDaEscadaMm(d)).toBe(1000 * 40 + 2000 * 20);
  });

  it('três blocos, três degraus', () => {
    const d = degrausDaEscada([bloco('Bloco 1', 0, 500), bloco('Bloco 2', 500, 900), bloco('Bloco 3', 900, 1200)], { 'Bloco 1': 30, 'Bloco 2': 20, 'Bloco 3': 10 }, 1);
    expect(d.map((x) => x.comprimentoMm)).toEqual([1200, 900, 500]);
    expect(d.map((x) => x.camadas)).toEqual([10, 10, 10]);
  });

  it('o bloco sem camadas próprias fica com as do enfesto', () => {
    expect(degrausDaEscada([bloco('Bloco 1', 0, 1000), bloco('Sem bloco', 1000, 2000)], { 'Bloco 1': 40 }, 10)).toEqual([
      { comprimentoMm: 2000, camadas: 10 },
      { comprimentoMm: 1000, camadas: 30 },
    ]);
  });
});

describe('os blocos escritos (ADR 0224)', () => {
  it('lê as camadas, sem confundir com um tamanho', () => {
    expect(camadasDosBlocos('P M x40; G GG x20')).toEqual([40, 20]);
    expect(camadasDosBlocos('P M; G')).toEqual([null, null]);
    expect(lerBlocos('P M x40; G GG x20')).toEqual([['P', 'M'], ['G', 'GG']]);
  });

  it('o bloco de mais camadas vai para o começo da mesa', () => {
    const r = blocosEmEscada([['G'], ['P', 'M']], [20, 40]);
    expect(r.blocos).toEqual([['P', 'M'], ['G']]);
    expect(r.camadasPorBloco).toEqual({ 'Bloco 1': 40, 'Bloco 2': 20 });
  });

  it('sem camadas escritas, não há escada', () => {
    const blocos = [['P'], ['M']];
    expect(blocosEmEscada(blocos, [null, null])).toEqual({ blocos, camadasPorBloco: null });
  });
});

describe('a escada no status e na ficha (ADR 0224)', () => {
  const peca = (id: string, y: number, grupoDoEncaixe: string): Molde => ({
    ...criarMolde({ nome: id, referencia: '', tamanho: 'M', quantidade: 1, contorno: [ponto(10, y), ponto(110, y), ponto(110, y + 1000), ponto(10, y + 1000)], margemDeCosturaMm: 0, linhaDeFio: { inicio: ponto(50, y + 20), fim: ponto(50, y + 180) }, restricaoDeRotacao: { permite180: true, permite90e270: false } }, id),
    grupoDoEncaixe,
  });
  const e: ConfiguracaoDeEnfesto = { ...criarConfiguracaoDeEnfesto({ tipo: 'impar', larguraUtilMm: 1500, comprimentoMm: 3000, quantidadeDeCamadas: 10, margemLateralMm: 0, margemDeExtremidadeMm: 0, distanciaMinimaEntrePecasMm: 0 }), camadasPorBloco: { 'Bloco 1': 40, 'Bloco 2': 20 } };
  const pecas = [peca('a', 0, 'Bloco 1'), peca('b', 1000, 'Bloco 2')];

  it('o status soma degrau por degrau', () => {
    const s = statusDoEncaixe(pecas, e);
    expect(s.escada?.degraus).toEqual([
      { comprimentoMm: 2000, camadas: 20 },
      { comprimentoMm: 1000, camadas: 20 },
    ]);
    expect(s.escada?.consumoTotalMm).toBe(60000);
  });

  it('sem camadas por bloco, não há escada', () => {
    const { camadasPorBloco: _sem, ...plano } = e;
    void _sem;
    expect(statusDoEncaixe(pecas, plano).escada).toBeUndefined();
  });

  it('a ficha da enfestadeira sai uma linha por degrau', () => {
    const linhas = csvDaEnfestadeira({ nome: 'x', codigo: 'c' }, pecas, e).trim().split('\r\n');
    expect(linhas).toHaveLength(3);
    expect(linhas[1]).toContain(';2000,0;20;40,00;');
    expect(linhas[2]).toContain(';1000,0;20;20,00;');
  });
});

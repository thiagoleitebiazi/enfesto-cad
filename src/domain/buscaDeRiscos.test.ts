import { describe, expect, it } from 'vitest';
import { ponto } from '../core/geometria';
import { criarMolde } from './molde';
import { executarBusca } from './buscaDeRiscos';
import type { PedidoDeRisco } from './planejamento';

const molde = criarMolde({ nome: 'Frente', referencia: '', tamanho: 'M', contorno: [ponto(0, 0), ponto(400, 0), ponto(400, 300), ponto(0, 300)], linhaDeFio: { inicio: ponto(200, 10), fim: ponto(200, 290) } }, 'f');
const pedido = (chave: string, copias: number): PedidoDeRisco => ({
  chave,
  grade: { M: copias },
  pecas: Array.from({ length: copias }, () => ({ pecaId: 'f', nome: 'Frente', tamanho: 'M', molde, espelhada: false })),
});
const OPCOES = { larguraMm: 1000, comprimentoMaximoMm: 2000, distanciaMm: 3, sentidoUnico: false, tempoTotalMs: 60_000 };

describe('executarBusca', () => {
  it('faz cada risco pedido; o que não cabe na mesa vem com o motivo', async () => {
    const progresso: number[] = [];
    const r = await executarBusca([pedido('M:2', 2), pedido('M:40', 40)], OPCOES, { aoProgredir: (f) => progresso.push(f) });
    expect(r.feitos.map((x) => [x.chave, x.risco.comprimentoMm])).toEqual([['M:2', 300]]);
    expect(r.naoSairam.map((x) => x.chave)).toEqual(['M:40']);
    expect(r.naoSairam[0]!.motivo).toContain('não cabem num risco de até 2,00 m');
    expect(progresso).toEqual([1, 2]);
    expect(r.cancelada).toBe(false);
  });

  it('acabado o tempo, os que faltam ficam ditos como não tentados', async () => {
    let relogio = 0;
    const r = await executarBusca([pedido('a', 1), pedido('b', 1), pedido('c', 1)], { ...OPCOES, tempoTotalMs: 150 }, { agora: () => (relogio += 100) });
    expect(r.feitos.map((x) => x.chave)).toEqual(['a']);
    expect(r.semTempo).toEqual(['b', 'c']);
  });

  it('cancelada, para no próximo risco', async () => {
    let parar = false;
    const r = await executarBusca([pedido('a', 1), pedido('b', 1)], OPCOES, {
      aoProgredir: () => {
        parar = true;
      },
      deveParar: () => parar,
    });
    expect(r.feitos.map((x) => x.chave)).toEqual(['a']);
    expect(r).toMatchObject({ semTempo: ['b'], cancelada: true });
  });
});

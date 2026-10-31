import { describe, expect, it } from 'vitest';
import { cancelarNaFila, comEstado, comTrabalho, esvaziarFila, FILA_DE_IMPRESSAO_VAZIA, moverNaFila, proximoDaFila, semConcluidos, type FilaDeImpressao } from './filaDeImpressao';

const trabalho = (id: string) => ({ id, nome: id, destino: 'COM1', texto: 'IN;' });
const fila = (...ids: string[]): FilaDeImpressao => ids.reduce((f, id) => comTrabalho(f, trabalho(id)), FILA_DE_IMPRESSAO_VAZIA);

describe('a fila de impressão (ADR 0210)', () => {
  it('sai na ordem, e nada sai com ela pausada', () => {
    expect(proximoDaFila(fila('a', 'b'))?.id).toBe('a');
    expect(proximoDaFila({ ...fila('a'), pausada: true })).toBeNull();
    expect(proximoDaFila(comEstado(fila('a', 'b'), 'a', 'enviado'))?.id).toBe('b');
  });

  it('sobe e desce só entre os que esperam', () => {
    expect(moverNaFila(fila('a', 'b'), 'b', -1).trabalhos.map((t) => t.id)).toEqual(['b', 'a']);
    const f = comEstado(fila('a', 'b'), 'a', 'enviando');
    expect(moverNaFila(f, 'b', -1)).toBe(f);
    expect(moverNaFila(f, 'b', 1)).toBe(f);
  });

  it('o que já está indo não se cancela', () => {
    expect(cancelarNaFila(fila('a'), 'a').trabalhos[0]!.estado).toBe('cancelado');
    const f = comEstado(fila('a'), 'a', 'enviando');
    expect(cancelarNaFila(f, 'a')).toBe(f);
  });

  it('limpar tira só o que acabou: o erro fica à vista', () => {
    const f = comEstado(comEstado(fila('a', 'b', 'c'), 'a', 'enviado'), 'b', 'erro', 'sem papel');
    expect(semConcluidos(f).trabalhos.map((t) => t.id)).toEqual(['b', 'c']);
  });

  it('voltar para a fila apaga o erro', () => {
    const f = comEstado(fila('a'), 'a', 'erro', 'sem papel');
    expect(comEstado(f, 'a', 'na-fila').trabalhos[0]!.erro).toBeUndefined();
  });
});

describe('o envio da fila (ADR 0210)', () => {
  const rodar = async (inicial: FilaDeImpressao, enviar: Parameters<typeof esvaziarFila>[2]): Promise<FilaDeImpressao> => {
    let f = inicial;
    await esvaziarFila(() => f, (nova) => (f = nova), enviar);
    return f;
  };

  it('manda todos, um de cada vez', async () => {
    const ordem: string[] = [];
    const f = await rodar(fila('a', 'b'), async (t) => {
      ordem.push(t.id);
      return { ok: true };
    });
    expect(ordem).toEqual(['a', 'b']);
    expect(f.trabalhos.every((t) => t.estado === 'enviado')).toBe(true);
  });

  it('o erro pausa a fila, e os seguintes esperam', async () => {
    const f = await rodar(fila('a', 'b'), async () => ({ ok: false, erro: 'sem papel' }));
    expect(f.pausada).toBe(true);
    expect(f.trabalhos.map((t) => t.estado)).toEqual(['erro', 'na-fila']);
    expect(f.trabalhos[0]!.erro).toBe('sem papel');
  });

  it('a exceção do envio vira erro do trabalho', async () => {
    const f = await rodar(fila('a'), async () => {
      throw new Error('caiu a rede');
    });
    expect(f.trabalhos[0]).toMatchObject({ estado: 'erro', erro: 'caiu a rede' });
  });

  it('o que entra durante o envio também sai', async () => {
    let f = fila('a');
    await esvaziarFila(
      () => f,
      (nova) => (f = nova),
      async (t) => {
        if (t.id === 'a') f = comTrabalho(f, trabalho('b'));
        return { ok: true };
      },
    );
    expect(f.trabalhos.map((t) => t.estado)).toEqual(['enviado', 'enviado']);
  });
});

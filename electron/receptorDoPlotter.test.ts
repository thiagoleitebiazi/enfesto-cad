// @vitest-environment node
import { connect, type AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { criarReceptorDoPlotter } from './receptorDoPlotter';

describe('o receptor do plotter (ADR 0222)', () => {
  it('o que outro programa plota chega inteiro, em uma peça só', async () => {
    const recebidos: string[] = [];
    const chegou = new Promise<void>((r) => {
      const servidor = criarReceptorDoPlotter((t) => {
        recebidos.push(t);
        servidor.close();
        r();
      });
      servidor.listen(0, '127.0.0.1', () => {
        const c = connect((servidor.address() as AddressInfo).port, '127.0.0.1');
        c.write('IN;SP1;');
        c.end('PU0,0;PD100,0;');
      });
    });
    await chegou;
    expect(recebidos).toEqual(['IN;SP1;PU0,0;PD100,0;']);
  });

  it('uma conexão que não manda nada não vira risco', async () => {
    const recebidos: string[] = [];
    const servidor = criarReceptorDoPlotter((t) => recebidos.push(t));
    await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
    await new Promise<void>((r) => {
      const c = connect((servidor.address() as AddressInfo).port, '127.0.0.1');
      c.on('close', () => r());
      c.end();
    });
    await new Promise<void>((r) => servidor.close(() => r()));
    expect(recebidos).toEqual([]);
  });
});

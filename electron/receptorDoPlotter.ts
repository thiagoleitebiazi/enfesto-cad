import { createServer, type Server } from 'node:net';

/**
 * O plotter de mentira do programa (ADR 0222): os sistemas de formato fechado não abrem aqui, mas todos sabem plotar.
 * Com o receptor ligado, este computador aparece na rede como um plotter (porta 9100), e o que é "plotado" nele chega
 * ao programa. Ele só liga a pedido, só guarda bytes e não responde nada.
 */

/** Um risco muito grande cabe com folga; acima disso, não é um risco. */
const LIMITE_DO_RISCO = 64 * 1024 * 1024;

export function criarReceptorDoPlotter(aoReceber: (texto: string) => void): Server {
  return createServer((conexao) => {
    const partes: Buffer[] = [];
    let total = 0;
    conexao.on('data', (dados) => {
      total += dados.length;
      if (total > LIMITE_DO_RISCO) conexao.destroy();
      else partes.push(dados as Buffer);
    });
    conexao.on('error', () => undefined);
    conexao.on('close', () => {
      if (total > 0 && total <= LIMITE_DO_RISCO) aoReceber(Buffer.concat(partes).toString('latin1'));
    });
  });
}

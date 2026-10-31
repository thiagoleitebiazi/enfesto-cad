// @vitest-environment node
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';
import { describe, expect, it } from 'vitest';
import { enviarAPorta, enviarPelaRede, lerPortaDeSaida } from './portaDeSaida';

describe('o destino escrito pelo usuário (ADR 0210)', () => {
  it('a rede local, com a porta 9100 se não disser', () => {
    expect(lerPortaDeSaida('192.168.0.50')).toEqual({ tipo: 'rede', host: '192.168.0.50', porta: 9100 });
    expect(lerPortaDeSaida('10.1.2.3:2501')).toEqual({ tipo: 'rede', host: '10.1.2.3', porta: 2501 });
    expect(lerPortaDeSaida('172.16.0.9')).toMatchObject({ host: '172.16.0.9' });
    expect(lerPortaDeSaida('PLOTTER')).toMatchObject({ host: 'PLOTTER' });
    expect(lerPortaDeSaida('plotter-1.local:9100')).toMatchObject({ host: 'plotter-1.local' });
  });

  it('o que está fora da rede local fica de fora', () => {
    expect(lerPortaDeSaida('8.8.8.8')).toBeNull();
    expect(lerPortaDeSaida('172.32.0.1')).toBeNull();
    expect(lerPortaDeSaida('127.0.0.1')).toBeNull();
    expect(lerPortaDeSaida('exemplo.com')).toBeNull();
    expect(lerPortaDeSaida('192.168.0.300')).toBeNull();
    expect(lerPortaDeSaida('192.168.0.5:70000')).toBeNull();
  });

  it('a impressora compartilhada e as portas do computador', () => {
    expect(lerPortaDeSaida('\\\\SERVIDOR\\PLOTTER')).toEqual({ tipo: 'caminho', caminho: '\\\\SERVIDOR\\PLOTTER' });
    expect(lerPortaDeSaida('lpt1')).toEqual({ tipo: 'caminho', caminho: '\\\\.\\LPT1' });
    expect(lerPortaDeSaida('COM3')).toEqual({ tipo: 'caminho', caminho: '\\\\.\\COM3' });
    expect(lerPortaDeSaida('COM3:9600')).toEqual({ tipo: 'caminho', caminho: '\\\\.\\COM3', baud: 9600 });
  });

  it('nunca um arquivo comum', () => {
    expect(lerPortaDeSaida('\\\\SERVIDOR\\pasta\\arquivo.txt')).toBeNull();
    expect(lerPortaDeSaida('C:\\Windows\\arquivo.txt')).toBeNull();
    expect(lerPortaDeSaida('..\\arquivo')).toBeNull();
    expect(lerPortaDeSaida('/etc/passwd')).toBeNull();
    expect(lerPortaDeSaida('')).toBeNull();
    expect(lerPortaDeSaida(5)).toBeNull();
  });
});

describe.runIf(process.platform === 'win32')('as portas do Windows (ADR 0215)', () => {
  it('um dispositivo do Windows recebe os bytes, aberto como já existente', async () => {
    // Uma porta de verdade pede um equipamento; o "pipe" é um dispositivo que se comporta igual: só abre se já existir.
    const caminho = `\\\\.\\pipe\\plotter-de-teste-${process.pid}`;
    const recebido: Buffer[] = [];
    const servidor = createServer((s) => s.on('data', (d) => recebido.push(d as Buffer)));
    await new Promise<void>((r) => servidor.listen(caminho, r));
    const fechou = new Promise<void>((r) => servidor.once('connection', (s) => s.once('close', () => r())));
    await enviarAPorta({ tipo: 'caminho', caminho }, 'IN;SP1;');
    await fechou;
    servidor.close();
    expect(Buffer.concat(recebido).toString()).toBe('IN;SP1;');
  });

  it('a porta que não existe é dita pelo nome', async () => {
    await expect(enviarAPorta(lerPortaDeSaida('COM99')!, 'IN;')).rejects.toThrow('A porta COM99 não existe neste computador.');
  });
});

describe('o envio pela rede (ADR 0210)', () => {
  it('o plotter recebe tudo', async () => {
    const recebido: Buffer[] = [];
    const servidor = createServer((s) => s.on('data', (d) => recebido.push(d as Buffer)));
    await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
    const fechou = new Promise<void>((r) => servidor.once('connection', (s) => s.once('close', () => r())));
    await enviarPelaRede('127.0.0.1', (servidor.address() as AddressInfo).port, Buffer.from('IN;SP1;PU0,0;'));
    await fechou;
    servidor.close();
    expect(Buffer.concat(recebido).toString()).toBe('IN;SP1;PU0,0;');
  });

  it('sem plotter do outro lado, diz que falhou', async () => {
    const servidor = createServer();
    await new Promise<void>((r) => servidor.listen(0, '127.0.0.1', r));
    const porta = (servidor.address() as AddressInfo).port;
    await new Promise<void>((r) => servidor.close(() => r()));
    await expect(enviarPelaRede('127.0.0.1', porta, Buffer.from('IN;'))).rejects.toThrow();
  });
});

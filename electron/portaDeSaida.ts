import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { connect } from 'node:net';

/**
 * A porta de saída (ADR 0210): o risco vai direto para o plotter, sem o programa dele. A interface só manda o texto do
 * destino; daqui ele sai como uma destas três coisas, e nada mais: um endereço da rede local, uma impressora
 * compartilhada (\\servidor\plotter) ou uma porta LPT/COM do computador. Nenhum arquivo comum é gravado por aqui.
 */

export type PortaDeSaida =
  | { readonly tipo: 'rede'; readonly host: string; readonly porta: number }
  | { readonly tipo: 'caminho'; readonly caminho: string; readonly baud?: number };

/** A porta que os plotters e as impressoras de rede ouvem. */
const PORTA_PADRAO_DA_REDE = 9100;

function hostDaRedeLocal(host: string): boolean {
  const ip = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!ip) return /^[a-z0-9-]+(\.local)?$/i.test(host);
  const [a, b, c, d] = ip.slice(1).map(Number) as [number, number, number, number];
  if (a > 255 || b > 255 || c > 255 || d > 255) return false;
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254);
}

/** O destino escrito pelo usuário; `null` se não for um destes. */
export function lerPortaDeSaida(destino: unknown): PortaDeSaida | null {
  if (typeof destino !== 'string') return null;
  const t = destino.trim();
  if (/^\\\\[^\\/:*?"<>|]+\\[^\\/:*?"<>|]+$/.test(t)) return { tipo: 'caminho', caminho: t };
  const lpt = /^LPT([1-9])$/i.exec(t);
  if (lpt) return { tipo: 'caminho', caminho: `\\\\.\\LPT${lpt[1]}` };
  const com = /^COM([1-9]\d?)(?::(\d{3,6}))?$/i.exec(t);
  if (com) return { tipo: 'caminho', caminho: `\\\\.\\COM${com[1]}`, ...(com[2] ? { baud: Number(com[2]) } : {}) };
  const rede = /^([^:\s\\/]+)(?::(\d{1,5}))?$/.exec(t);
  if (!rede || !hostDaRedeLocal(rede[1]!)) return null;
  const porta = rede[2] ? Number(rede[2]) : PORTA_PADRAO_DA_REDE;
  return porta >= 1 && porta <= 65535 ? { tipo: 'rede', host: rede[1]!, porta } : null;
}

/** Abre a conexão, manda tudo e fecha. */
export function enviarPelaRede(host: string, porta: number, dados: Buffer, tempoMs = 15000): Promise<void> {
  return new Promise((resolver, rejeitar) => {
    const conexao = connect({ host, port: porta });
    conexao.setTimeout(tempoMs, () => conexao.destroy(new Error('O plotter não respondeu.')));
    conexao.once('error', rejeitar);
    conexao.once('connect', () =>
      conexao.end(dados, () => {
        resolver();
        conexao.destroySoon();
      }),
    );
  });
}

/** A velocidade da porta COM, pelo comando do Windows. */
function configurarSerial(caminho: string, baud: number): Promise<void> {
  const nome = caminho.replace('\\\\.\\', '');
  return new Promise((resolver, rejeitar) => {
    execFile('mode.com', [`${nome}:`, `BAUD=${baud}`, 'PARITY=N', 'DATA=8', 'STOP=1'], { windowsHide: true }, (erro) => (erro ? rejeitar(new Error(`A porta ${nome} não aceitou a configuração.`)) : resolver()));
  });
}

export async function enviarAPorta(porta: PortaDeSaida, texto: string): Promise<void> {
  const dados = Buffer.from(texto, 'latin1');
  if (porta.tipo === 'rede') return enviarPelaRede(porta.host, porta.porta, dados);
  if (porta.baud !== undefined) await configurarSerial(porta.caminho, porta.baud);
  await writeFile(porta.caminho, dados);
}

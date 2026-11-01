import { readFile, unlink } from 'node:fs/promises';
import { gravarSemCorromper } from './gravacao';
import { lerRespostaDaIa, chaveComFormatoValido, MODELO_PADRAO, modeloValido, montarPedidoHttp, problemasDoPedido, SERVICO_DE_IMAGEM, type PedidoDeImagem, type ReferenciaParaIa, type RespostaDaIa } from '../src/domain/servicoDeIa';

/**
 * A chave do serviço de IA (ADR 0112), no processo principal: guardada cifrada pelo cofre do sistema (no Windows, o
 * DPAPI da conta; no Mac, o Keychain) em <userData>/servico-de-ia.json, e usada só aqui — a tela sabe se há chave,
 * nunca qual é. Sem cofre no computador, a chave não é guardada (nunca em texto aberto). O pedido sai só quando a
 * pessoa clica em Gerar.
 */

export interface CofreDoSistema {
  readonly disponivel: () => boolean;
  readonly cifrar: (texto: string) => Buffer;
  readonly decifrar: (cifrado: Buffer) => string;
}

interface ConfiguracaoNoDisco {
  readonly servico: string;
  readonly modelo: string;
  /** A chave cifrada pelo cofre, em base64. */
  readonly chaveCifrada: string;
  readonly guardadaEmIso: string;
}

export interface EstadoDaIa {
  readonly configurado: boolean;
  readonly servico: string;
  readonly modelo: string;
  /** O cofre do sistema funciona neste computador (sem ele, não há como guardar a chave). */
  readonly cofreDisponivel: boolean;
  readonly guardadaEmIso: string | null;
  /** O arquivo existe mas a chave não abre (outro usuário, outro computador): é preciso pôr de novo. */
  readonly chaveIlegivel: boolean;
}

async function lerConfiguracao(arquivo: string): Promise<ConfiguracaoNoDisco | null> {
  try {
    const bruto = JSON.parse(await readFile(arquivo, 'utf-8')) as Partial<ConfiguracaoNoDisco>;
    if (typeof bruto.chaveCifrada !== 'string' || typeof bruto.modelo !== 'string') return null;
    return { servico: typeof bruto.servico === 'string' ? bruto.servico : SERVICO_DE_IMAGEM, modelo: bruto.modelo, chaveCifrada: bruto.chaveCifrada, guardadaEmIso: typeof bruto.guardadaEmIso === 'string' ? bruto.guardadaEmIso : '' };
  } catch {
    return null;
  }
}

async function gravarConfiguracao(arquivo: string, c: ConfiguracaoNoDisco): Promise<void> {
  await gravarSemCorromper(arquivo, JSON.stringify(c, null, 2));
}

function abrirChave(cofre: CofreDoSistema, c: ConfiguracaoNoDisco): string | null {
  if (!cofre.disponivel()) return null;
  try {
    const chave = cofre.decifrar(Buffer.from(c.chaveCifrada, 'base64'));
    return chaveComFormatoValido(chave) ? chave : null;
  } catch {
    return null;
  }
}

export async function estadoDaIa(arquivo: string, cofre: CofreDoSistema): Promise<EstadoDaIa> {
  const c = await lerConfiguracao(arquivo);
  const cofreDisponivel = cofre.disponivel();
  if (!c) return { configurado: false, servico: SERVICO_DE_IMAGEM, modelo: MODELO_PADRAO, cofreDisponivel, guardadaEmIso: null, chaveIlegivel: false };
  const abre = abrirChave(cofre, c) !== null;
  return { configurado: abre, servico: c.servico, modelo: c.modelo, cofreDisponivel, guardadaEmIso: c.guardadaEmIso || null, chaveIlegivel: !abre };
}

/** Guarda a chave (cifrada) e o modelo. Devolve o motivo de não guardar, ou `null`. */
export async function guardarChave(arquivo: string, cofre: CofreDoSistema, chave: unknown, modelo: unknown, agoraIso: string): Promise<string | null> {
  if (typeof chave !== 'string' || !chaveComFormatoValido(chave)) return 'A chave não parece uma chave do serviço (sem espaços, ao menos 20 letras).';
  const m = typeof modelo === 'string' && modeloValido(modelo) ? modelo.trim() : null;
  if (!m) return 'Escolha um modelo de imagem.';
  if (!cofre.disponivel()) return 'Este computador não tem o cofre de senhas do sistema funcionando: a chave não foi guardada (ela não fica em texto aberto).';
  await gravarConfiguracao(arquivo, { servico: SERVICO_DE_IMAGEM, modelo: m, chaveCifrada: cofre.cifrar(chave.trim()).toString('base64'), guardadaEmIso: agoraIso });
  return null;
}

/** Troca só o modelo (a chave continua a mesma). */
export async function mudarModelo(arquivo: string, modelo: unknown): Promise<string | null> {
  const c = await lerConfiguracao(arquivo);
  if (!c) return 'Ainda não há chave guardada.';
  if (typeof modelo !== 'string' || !modeloValido(modelo)) return 'Escolha um modelo de imagem.';
  await gravarConfiguracao(arquivo, { ...c, modelo: modelo.trim() });
  return null;
}

/** Apaga a chave do computador. */
export async function esquecerChave(arquivo: string): Promise<void> {
  try {
    await unlink(arquivo);
  } catch {
    // Já não havia.
  }
}

const ehObjeto = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

/** O pedido vindo da tela, conferido (o que não serve: `null`). */
export function lerPedidoDeImagem(bruto: unknown): PedidoDeImagem | null {
  if (!ehObjeto(bruto) || typeof bruto.pedido !== 'string' || typeof bruto.quantidade !== 'number') return null;
  const formato = bruto.formato === 'retrato' || bruto.formato === 'paisagem' ? bruto.formato : 'quadrado';
  const referencias = Array.isArray(bruto.referencias)
    ? bruto.referencias.flatMap((r): ReferenciaParaIa[] =>
        ehObjeto(r) && typeof r.base64 === 'string' && /^[A-Za-z0-9+/=]+$/.test(r.base64) && (r.tipo === 'image/png' || r.tipo === 'image/jpeg' || r.tipo === 'image/webp')
          ? [{ nome: typeof r.nome === 'string' ? r.nome : 'referencia', base64: r.base64, tipo: r.tipo }]
          : [],
      )
    : [];
  return { pedido: bruto.pedido, quantidade: bruto.quantidade, formato, referencias };
}

export type Buscar = (url: string, init: RequestInit) => Promise<{ readonly status: number; readonly json: () => Promise<unknown> }>;

/** Manda o pedido ao serviço com a chave guardada; as imagens (base64) ou o erro em português. */
export async function gerarImagens(arquivo: string, cofre: CofreDoSistema, brutoDoPedido: unknown, buscar: Buscar, tempoLimiteMs: number): Promise<RespostaDaIa & { readonly modelo?: string }> {
  const pedido = lerPedidoDeImagem(brutoDoPedido);
  if (!pedido) return { ok: false, erro: 'O pedido veio incompleto.' };
  const problemas = problemasDoPedido(pedido);
  if (problemas.length > 0) return { ok: false, erro: problemas.join(' ') };
  const c = await lerConfiguracao(arquivo);
  if (!c) return { ok: false, erro: 'O serviço de IA não está configurado: ponha a sua chave em Configurar.' };
  const chave = abrirChave(cofre, c);
  if (!chave) return { ok: false, erro: 'A chave guardada não abre neste computador (ou nesta conta): ponha a chave de novo em Configurar.' };
  const { url, init } = montarPedidoHttp(chave, c.modelo, pedido);
  const parar = new AbortController();
  const relogio = setTimeout(() => parar.abort(), tempoLimiteMs);
  try {
    const resposta = await buscar(url, { ...init, signal: parar.signal });
    let corpo: unknown = null;
    try {
      corpo = await resposta.json();
    } catch {
      corpo = null;
    }
    const lida = lerRespostaDaIa(resposta.status, corpo);
    return lida.ok ? { ...lida, modelo: c.modelo } : lida;
  } catch (e) {
    if (parar.signal.aborted) return { ok: false, erro: `O serviço não respondeu em ${Math.round(tempoLimiteMs / 1000)} s: tente de novo (ou peça menos imagens).` };
    return { ok: false, erro: `Não foi possível falar com o serviço (sem internet, ou um bloqueio da rede): ${e instanceof Error ? e.message : String(e)}` };
  } finally {
    clearTimeout(relogio);
  }
}

/** Confere a chave pela lista de modelos, que não gasta crédito: antes de pagar por uma imagem, sabe-se se ela vale (ADR 0222). */
export async function conferirChave(arquivo: string, cofre: CofreDoSistema, buscar: Buscar, tempoLimiteMs = 15_000): Promise<{ readonly ok: boolean; readonly erro?: string }> {
  const c = await lerConfiguracao(arquivo);
  if (!c) return { ok: false, erro: 'O serviço de IA não está configurado: ponha a sua chave em Configurar.' };
  const chave = abrirChave(cofre, c);
  if (!chave) return { ok: false, erro: 'A chave guardada não abre neste computador (ou nesta conta): ponha a chave de novo.' };
  const parar = new AbortController();
  const relogio = setTimeout(() => parar.abort(), tempoLimiteMs);
  try {
    const { status } = await buscar('https://api.openai.com/v1/models', { method: 'GET', headers: { Authorization: `Bearer ${chave}` }, signal: parar.signal });
    if (status === 200) return { ok: true };
    if (status === 401 || status === 403) return { ok: false, erro: 'O serviço recusou a chave: confira se ela foi copiada inteira e se ainda vale.' };
    if (status === 429) return { ok: false, erro: 'O serviço disse que a conta chegou ao limite: confira o saldo.' };
    return { ok: false, erro: `O serviço respondeu com o código ${status}.` };
  } catch {
    return { ok: false, erro: 'O serviço não respondeu: confira a internet deste computador.' };
  } finally {
    clearTimeout(relogio);
  }
}

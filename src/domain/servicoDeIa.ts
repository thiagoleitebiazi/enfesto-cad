/**
 * O serviço de imagem da IA (ADR 0112): a parte sem rede e sem chave — o pedido HTTP montado e a resposta lida. Quem
 * manda é o processo principal do programa (a chave fica lá, cifrada pelo cofre do sistema, e nunca chega à tela).
 * Hoje há um serviço: o de imagens da OpenAI (a conta e a chave são de quem usa o programa; cada pedido é cobrado
 * nela). Sem chave, nada sai do computador.
 */

export const SERVICO_DE_IMAGEM = 'OpenAI (imagens)';
export const ENDERECO_DO_SERVICO = 'https://api.openai.com/v1/images';

/** Os modelos de imagem que o serviço aceitava quando isto foi escrito (out. 2026); outro nome pode ser digitado. */
export const MODELOS_DE_IMAGEM: readonly { readonly id: string; readonly nome: string }[] = [
  { id: 'gpt-image-2.5-flare', nome: 'gpt-image-2.5-flare (rápido, para o dia a dia)' },
  { id: 'gpt-image-2.5-sunburst', nome: 'gpt-image-2.5-sunburst (mais fiel às referências)' },
  { id: 'gpt-image-2', nome: 'gpt-image-2' },
  { id: 'gpt-image-1.5', nome: 'gpt-image-1.5' },
  { id: 'gpt-image-1-mini', nome: 'gpt-image-1-mini (mais barato)' },
];
export const MODELO_PADRAO = 'gpt-image-2.5-flare';

export type FormatoDaImagem = 'quadrado' | 'retrato' | 'paisagem';
export const TAMANHO_DO_FORMATO: Readonly<Record<FormatoDaImagem, string>> = { quadrado: '1024x1024', retrato: '1024x1536', paisagem: '1536x1024' };

export interface ReferenciaParaIa {
  readonly nome: string;
  /** A imagem em PNG (ou JPEG), em base64 sem o cabeçalho. */
  readonly base64: string;
  readonly tipo: 'image/png' | 'image/jpeg' | 'image/webp';
}

export interface PedidoDeImagem {
  readonly pedido: string;
  readonly quantidade: number;
  readonly formato: FormatoDaImagem;
  readonly referencias: readonly ReferenciaParaIa[];
}

/** A chave tem cara de chave (o serviço é quem confere de verdade): sem espaços, de 20 a 300 letras. */
export function chaveComFormatoValido(chave: string): boolean {
  const c = chave.trim();
  return c.length >= 20 && c.length <= 300 && !/\s/.test(c);
}

/** O nome do modelo é aceitável (letras, números, ponto, hífen, sublinhado). */
export function modeloValido(modelo: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{1,63}$/i.test(modelo.trim());
}

/** O que há de errado no pedido antes de mandar (vazio: nada). */
export function problemasDoPedido(p: PedidoDeImagem): string[] {
  const problemas: string[] = [];
  if (p.pedido.trim().length < 10) problemas.push('Escreva o pedido (o que a imagem deve mostrar).');
  if (p.pedido.length > 32000) problemas.push('O pedido passa de 32 000 letras.');
  if (!Number.isInteger(p.quantidade) || p.quantidade < 1 || p.quantidade > 4) problemas.push('Peça de 1 a 4 imagens por vez.');
  if (p.referencias.length > 16) problemas.push('Mande até 16 imagens de referência.');
  return problemas;
}

/** De base64 para os bytes. */
function bytesDoBase64(b64: string): Uint8Array {
  const binario = atob(b64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/**
 * O pedido HTTP: sem referência, a geração (JSON); com referências, a edição (formulário em partes, uma `image[]` por
 * imagem). A chave vai só no cabeçalho de autorização.
 */
export function montarPedidoHttp(chave: string, modelo: string, p: PedidoDeImagem): { readonly url: string; readonly init: RequestInit } {
  const cabecalho = { Authorization: `Bearer ${chave.trim()}` };
  if (p.referencias.length === 0) {
    return {
      url: `${ENDERECO_DO_SERVICO}/generations`,
      init: {
        method: 'POST',
        headers: { ...cabecalho, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelo, prompt: p.pedido, n: p.quantidade, size: TAMANHO_DO_FORMATO[p.formato] }),
      },
    };
  }
  const formulario = new FormData();
  formulario.append('model', modelo);
  formulario.append('prompt', p.pedido);
  formulario.append('n', String(p.quantidade));
  formulario.append('size', TAMANHO_DO_FORMATO[p.formato]);
  for (const r of p.referencias) {
    const extensao = r.tipo === 'image/jpeg' ? 'jpg' : r.tipo === 'image/webp' ? 'webp' : 'png';
    const nome = `${r.nome.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/\.(png|jpe?g|webp)$/i, '') || 'referencia'}.${extensao}`;
    formulario.append('image[]', new Blob([bytesDoBase64(r.base64) as BlobPart], { type: r.tipo }), nome);
  }
  return { url: `${ENDERECO_DO_SERVICO}/edits`, init: { method: 'POST', headers: cabecalho, body: formulario } };
}

export type RespostaDaIa = { readonly ok: true; readonly imagens: readonly string[] } | { readonly ok: false; readonly erro: string };

/** Lê a resposta do serviço: as imagens (base64), ou o erro dito em português. */
export function lerRespostaDaIa(status: number, corpo: unknown): RespostaDaIa {
  const mensagemDoServico = (): string => {
    if (typeof corpo === 'object' && corpo !== null) {
      const erro = (corpo as { error?: { message?: unknown } }).error;
      if (erro && typeof erro.message === 'string') return erro.message;
    }
    return '';
  };
  if (status >= 200 && status < 300) {
    const dados = typeof corpo === 'object' && corpo !== null ? (corpo as { data?: unknown }).data : undefined;
    const imagens = Array.isArray(dados) ? dados.map((d) => (typeof d === 'object' && d !== null ? (d as { b64_json?: unknown }).b64_json : undefined)).filter((b): b is string => typeof b === 'string' && b.length > 0) : [];
    return imagens.length > 0 ? { ok: true, imagens } : { ok: false, erro: 'O serviço respondeu sem imagem.' };
  }
  const detalhe = mensagemDoServico();
  const com = (texto: string): string => (detalhe ? `${texto} (o serviço disse: ${detalhe})` : texto);
  if (status === 401) return { ok: false, erro: com('O serviço recusou a chave: confira se ela está certa e ativa (Configurar).') };
  if (status === 403) return { ok: false, erro: com('A conta não tem acesso a este modelo (algumas contas precisam verificar a organização antes).') };
  if (status === 404) return { ok: false, erro: com('O serviço não achou o modelo: escolha outro em Configurar.') };
  if (status === 429) return { ok: false, erro: com('O serviço pediu para esperar: o limite de pedidos ou os créditos da conta acabaram.') };
  if (status === 400) return { ok: false, erro: com('O serviço não aceitou o pedido') };
  if (status >= 500) return { ok: false, erro: com('O serviço está com problema agora: tente de novo em alguns minutos.') };
  return { ok: false, erro: com(`O serviço respondeu com o código ${status}.`) };
}

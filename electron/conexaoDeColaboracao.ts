/**
 * A ligação do programa com o servidor de colaboração (ADR 0214). O endereço e a chave ficam no processo principal: a
 * interface só diz o método, o caminho (um dos que o servidor tem) e o corpo.
 */

/** O endereço sem a barra final; `null` se não for http ou https, ou trouxer senha. */
export function urlDoServidorValida(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  try {
    const url = new URL(v.trim());
    if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.username !== '' || url.password !== '') return null;
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

export function caminhoDoServidorValido(v: unknown): v is string {
  return typeof v === 'string' && /^\/projetos(\/[A-Za-z0-9_-]{1,120}(\/(versoes\/\d+|comentarios|aprovacao|presenca))?)?$/.test(v);
}

type Buscar = (url: string, init: { readonly method: string; readonly headers: Record<string, string>; readonly body?: string }) => Promise<{ readonly status: number; json(): Promise<unknown> }>;

export async function pedirAoServidor(buscar: Buscar, url: string, chave: string, metodo: unknown, caminho: unknown, corpo?: unknown): Promise<{ readonly status: number; readonly corpo: unknown }> {
  if (metodo !== 'GET' && metodo !== 'PUT' && metodo !== 'POST') throw new Error('Método não aceito.');
  if (!caminhoDoServidorValido(caminho)) throw new Error('Caminho não aceito.');
  const r = await buscar(`${url}${caminho}`, { method: metodo, headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' }, ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}) });
  return { status: r.status, corpo: await r.json().catch(() => null) };
}

import type { Molde } from './molde';
import type { EstadoDoProjeto } from './projeto';

/**
 * A colaboração (ADR 0214): o projeto num servidor que a empresa mesma liga. Duas pessoas podem mudar o mesmo projeto:
 * o que uma enviou se junta ao da outra peça por peça, comparando as duas com a versão de onde as duas partiram.
 */

export interface ProjetoCompartilhado {
  readonly id: string;
  readonly nome: string;
  readonly codigo: string;
  readonly estado: EstadoDoProjeto;
}

export interface FusaoDosEstados {
  readonly estado: EstadoDoProjeto;
  /** O que as duas pessoas mudaram de jeitos diferentes: ficou o que já estava no servidor. */
  readonly conflitos: readonly string[];
}

const igual = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

function fundirPecas(base: readonly Molde[], deles: readonly Molde[], nossas: readonly Molde[]): { readonly pecas: Molde[]; readonly conflitos: string[] } {
  const naBase = new Map(base.map((p) => [p.id, p]));
  const nasDeles = new Map(deles.map((p) => [p.id, p]));
  const nasNossas = new Map(nossas.map((p) => [p.id, p]));
  const conflitos: string[] = [];
  const pecas = deles.flatMap((d): Molde[] => {
    const b = naBase.get(d.id);
    const n = nasNossas.get(d.id);
    if (n === undefined) {
      // Saiu daqui: sai de vez, a não ser que a outra pessoa tenha mudado a peça.
      if (b === undefined) return [d];
      if (igual(b, d)) return [];
      conflitos.push(d.nome);
      return [d];
    }
    if (igual(n, d)) return [d];
    if (b !== undefined && igual(b, n)) return [d];
    if (b !== undefined && igual(b, d)) return [n];
    conflitos.push(d.nome);
    return [d];
  });
  for (const n of nossas) {
    if (nasDeles.has(n.id)) continue;
    const b = naBase.get(n.id);
    if (b === undefined) pecas.push(n);
    else if (!igual(b, n)) {
      conflitos.push(n.nome);
      pecas.push(n);
    }
  }
  return { pecas, conflitos };
}

function fundirCampo<T>(base: T, deles: T, nosso: T, nome: string, conflitos: string[]): T {
  if (igual(base, nosso) || igual(deles, nosso)) return deles;
  if (igual(base, deles)) return nosso;
  conflitos.push(nome);
  return deles;
}

export function fundirEstados(base: EstadoDoProjeto, deles: EstadoDoProjeto, nossos: EstadoDoProjeto): FusaoDosEstados {
  const { pecas, conflitos } = fundirPecas(base.pecas, deles.pecas, nossos.pecas);
  const tecido = fundirCampo(base.tecido, deles.tecido, nossos.tecido, 'o tecido', conflitos);
  const enfesto = fundirCampo(base.enfesto, deles.enfesto, nossos.enfesto, 'o enfesto', conflitos);
  return { estado: { pecas, tecido, enfesto }, conflitos };
}

export type PedidoAoServidor = (metodo: 'GET' | 'PUT' | 'POST', caminho: string, corpo?: unknown) => Promise<{ readonly status: number; readonly corpo: unknown }>;

const ESTADO_VAZIO: EstadoDoProjeto = { pecas: [], tecido: null, enfesto: null };

const erroDe = (corpo: unknown): string => (typeof corpo === 'object' && corpo !== null && 'erro' in corpo ? String(corpo.erro) : 'O servidor não aceitou o pedido.');

/** Quantas vezes tenta de novo se outra pessoa enviar enquanto as versões se juntam. */
const TENTATIVAS_DE_ENVIO = 3;

/** Envia o projeto. Se o servidor já está em outra versão, junta as duas e envia de novo. */
export async function enviarProjeto(pedir: PedidoAoServidor, projeto: ProjetoCompartilhado, versaoBase: number, autor: string): Promise<FusaoDosEstados & { readonly versao: number }> {
  let base = versaoBase;
  let atual = projeto;
  let conflitos: readonly string[] = [];
  for (let i = 0; i < TENTATIVAS_DE_ENVIO; i++) {
    const r = await pedir('PUT', `/projetos/${projeto.id}`, { base, autor, projeto: atual });
    if (r.status === 200) return { versao: (r.corpo as { versao: number }).versao, estado: atual.estado, conflitos };
    if (r.status !== 409) throw new Error(erroDe(r.corpo));
    const servidor = r.corpo as { versao: number; projeto: ProjetoCompartilhado };
    const antiga = base > 0 ? await pedir('GET', `/projetos/${projeto.id}/versoes/${base}`) : null;
    const estadoBase = antiga?.status === 200 ? (antiga.corpo as { projeto: ProjetoCompartilhado }).projeto.estado : ESTADO_VAZIO;
    const fusao = fundirEstados(estadoBase, servidor.projeto.estado, atual.estado);
    atual = { ...atual, estado: fusao.estado };
    conflitos = [...new Set([...conflitos, ...fusao.conflitos])];
    base = servidor.versao;
  }
  throw new Error('Outras pessoas estão enviando este projeto agora: tente de novo.');
}

/** O que há de novo no servidor, junto com o que mudou aqui. */
export async function atualizarDoServidor(pedir: PedidoAoServidor, local: ProjetoCompartilhado, versaoBase: number): Promise<FusaoDosEstados & { readonly versao: number }> {
  const r = await pedir('GET', `/projetos/${local.id}`);
  if (r.status !== 200) throw new Error(erroDe(r.corpo));
  const servidor = r.corpo as { versao: number; projeto: ProjetoCompartilhado };
  const antiga = versaoBase > 0 ? await pedir('GET', `/projetos/${local.id}/versoes/${versaoBase}`) : null;
  const estadoBase = antiga?.status === 200 ? (antiga.corpo as { projeto: ProjetoCompartilhado }).projeto.estado : ESTADO_VAZIO;
  return { ...fundirEstados(estadoBase, servidor.projeto.estado, local.estado), versao: servidor.versao };
}

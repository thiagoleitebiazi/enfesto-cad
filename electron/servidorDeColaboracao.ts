import { createHash, timingSafeEqual } from 'node:crypto';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import path from 'node:path';
import { criarFilaDeGravacao, gravarSemCorromper, idDeProjetoValido } from './gravacao';

/**
 * O servidor de colaboração (ADR 0214): só liga quando alguém pede, e cada pedido precisa da chave. Guarda, por
 * projeto, as últimas versões, os comentários e a aprovação; quem está em cada projeto fica só na memória. O servidor
 * não junta nada: se a versão enviada não parte da última, ele devolve a última, e o programa de quem enviou junta as
 * duas (ver colaboracao.ts).
 */

export interface Comentario {
  readonly id: number;
  readonly autor: string;
  readonly texto: string;
  readonly quandoIso: string;
  readonly pecaId?: string;
}

export interface Aprovacao {
  readonly situacao: 'aprovado' | 'reprovado';
  readonly autor: string;
  readonly nota: string;
  readonly quandoIso: string;
}

interface Registro {
  readonly nome: string;
  readonly codigo: string;
  readonly versao: number;
  readonly autor: string;
  readonly quandoIso: string;
  readonly comentarios: readonly Comentario[];
  readonly aprovacao: Aprovacao | null;
}

/** O projeto com muitas peças cabe com folga; acima disso, não é um projeto. */
const LIMITE_DO_PEDIDO = 64 * 1024 * 1024;
const VERSOES_GUARDADAS = 50;
/** Quem não dá sinal neste tempo saiu do projeto. */
const PRESENCA_MS = 60_000;
const LIMITE_DO_NOME = 80;
const LIMITE_DO_TEXTO = 2000;

class ErroDoPedido extends Error {
  readonly status: number;

  constructor(status: number, mensagem: string) {
    super(mensagem);
    this.status = status;
  }
}

const resumo = (texto: string): Buffer => createHash('sha256').update(texto).digest();

function lerCorpo(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolver, rejeitar) => {
    const partes: Buffer[] = [];
    let total = 0;
    req.on('data', (d: Buffer) => {
      total += d.length;
      if (total > LIMITE_DO_PEDIDO) {
        rejeitar(new ErroDoPedido(413, 'O pedido é grande demais.'));
        req.destroy();
      } else partes.push(d);
    });
    req.on('error', rejeitar);
    req.on('end', () => {
      try {
        const corpo: unknown = JSON.parse(Buffer.concat(partes).toString('utf-8'));
        if (typeof corpo !== 'object' || corpo === null) throw new Error('corpo');
        resolver(corpo as Record<string, unknown>);
      } catch {
        rejeitar(new ErroDoPedido(400, 'O pedido não é um JSON válido.'));
      }
    });
  });
}

function textoDe(v: unknown, rotulo: string, limite: number): string {
  if (typeof v !== 'string' || v.trim() === '' || v.length > limite) throw new ErroDoPedido(400, `Falta ${rotulo}, ou é grande demais.`);
  return v.trim();
}

export function criarServidorDeColaboracao(opcoes: { readonly pasta: string; readonly chave: string; readonly agora?: () => Date }): Server {
  const agora = opcoes.agora ?? (() => new Date());
  const emOrdem = criarFilaDeGravacao();
  const presencas = new Map<string, Map<string, number>>();
  const pastaDo = (id: string): string => path.join(opcoes.pasta, id);
  const arquivoDoRegistro = (id: string): string => path.join(pastaDo(id), 'registro.json');
  const arquivoDaVersao = (id: string, n: number): string => path.join(pastaDo(id), `v${n}.json`);

  const lerRegistro = async (id: string): Promise<Registro | null> => {
    try {
      return JSON.parse(await readFile(arquivoDoRegistro(id), 'utf-8')) as Registro;
    } catch {
      return null;
    }
  };
  const registroObrigatorio = async (id: string): Promise<Registro> => {
    const r = await lerRegistro(id);
    if (!r) throw new ErroDoPedido(404, 'Este projeto não está no servidor.');
    return r;
  };
  const lerVersao = async (id: string, n: number): Promise<unknown> => {
    try {
      return JSON.parse(await readFile(arquivoDaVersao(id, n), 'utf-8'));
    } catch {
      throw new ErroDoPedido(404, 'Esta versão não existe mais no servidor.');
    }
  };
  const gravarRegistro = (id: string, r: Registro): Promise<void> => gravarSemCorromper(arquivoDoRegistro(id), JSON.stringify(r));

  const presentes = (id: string): string[] => {
    const limite = agora().getTime() - PRESENCA_MS;
    return [...(presencas.get(id) ?? new Map<string, number>())].filter(([, quando]) => quando >= limite).map(([autor]) => autor);
  };

  const listar = async (): Promise<unknown> => {
    await mkdir(opcoes.pasta, { recursive: true });
    const nomes = await readdir(opcoes.pasta);
    const projetos = await Promise.all(
      nomes.filter(idDeProjetoValido).map(async (id) => {
        const r = await lerRegistro(id);
        return r ? { id, nome: r.nome, codigo: r.codigo, versao: r.versao, autor: r.autor, quandoIso: r.quandoIso, comentarios: r.comentarios.length, aprovacao: r.aprovacao, presentes: presentes(id) } : null;
      }),
    );
    return { projetos: projetos.filter((p) => p !== null) };
  };

  const gravarVersao = (id: string, corpo: Record<string, unknown>): Promise<{ status: number; corpo: unknown }> =>
    emOrdem(id, async () => {
      const autor = textoDe(corpo['autor'], 'o seu nome', LIMITE_DO_NOME);
      const projeto = corpo['projeto'] as { nome?: unknown; codigo?: unknown; estado?: unknown } | undefined;
      if (typeof projeto !== 'object' || projeto === null || typeof projeto.estado !== 'object' || projeto.estado === null) throw new ErroDoPedido(400, 'O pedido não traz um projeto.');
      const atual = await lerRegistro(id);
      if (atual && corpo['base'] !== atual.versao) return { status: 409, corpo: { versao: atual.versao, projeto: await lerVersao(id, atual.versao) } };
      const versao = (atual?.versao ?? 0) + 1;
      await mkdir(pastaDo(id), { recursive: true });
      await gravarSemCorromper(arquivoDaVersao(id, versao), JSON.stringify(projeto));
      await gravarRegistro(id, {
        nome: textoDe(projeto.nome, 'o nome do projeto', 200),
        codigo: typeof projeto.codigo === 'string' ? projeto.codigo.slice(0, 80) : '',
        versao,
        autor,
        quandoIso: agora().toISOString(),
        comentarios: atual?.comentarios ?? [],
        // O molde mudou: a aprovação era da versão anterior.
        aprovacao: null,
      });
      await rm(arquivoDaVersao(id, versao - VERSOES_GUARDADAS), { force: true });
      return { status: 200, corpo: { versao } };
    });

  const comentar = (id: string, corpo: Record<string, unknown>): Promise<unknown> =>
    emOrdem(id, async () => {
      const r = await registroObrigatorio(id);
      const comentario: Comentario = {
        id: r.comentarios.reduce((maior, c) => Math.max(maior, c.id), 0) + 1,
        autor: textoDe(corpo['autor'], 'o seu nome', LIMITE_DO_NOME),
        texto: textoDe(corpo['texto'], 'o comentário', LIMITE_DO_TEXTO),
        quandoIso: agora().toISOString(),
        ...(typeof corpo['pecaId'] === 'string' && corpo['pecaId'] !== '' ? { pecaId: corpo['pecaId'].slice(0, LIMITE_DO_NOME * 2) } : {}),
      };
      await gravarRegistro(id, { ...r, comentarios: [...r.comentarios, comentario] });
      return { comentario };
    });

  const aprovar = (id: string, corpo: Record<string, unknown>): Promise<unknown> =>
    emOrdem(id, async () => {
      const r = await registroObrigatorio(id);
      const situacao = corpo['situacao'];
      if (situacao !== 'aprovado' && situacao !== 'reprovado') throw new ErroDoPedido(400, 'A situação é aprovado ou reprovado.');
      const nota = typeof corpo['nota'] === 'string' ? corpo['nota'].slice(0, LIMITE_DO_TEXTO) : '';
      const aprovacao: Aprovacao = { situacao, autor: textoDe(corpo['autor'], 'o seu nome', LIMITE_DO_NOME), nota, quandoIso: agora().toISOString() };
      await gravarRegistro(id, { ...r, aprovacao });
      return { aprovacao };
    });

  const atender = async (req: IncomingMessage): Promise<{ status: number; corpo: unknown }> => {
    if (!timingSafeEqual(resumo(req.headers.authorization ?? ''), resumo(`Bearer ${opcoes.chave}`))) return { status: 401, corpo: { erro: 'Chave errada.' } };
    const rota = /^\/projetos(?:\/([^/]+)(?:\/(versoes|comentarios|aprovacao|presenca)(?:\/(\d+))?)?)?$/.exec(new URL(req.url ?? '/', 'http://servidor').pathname);
    if (!rota) return { status: 404, corpo: { erro: 'Este endereço não existe.' } };
    const [, id, parte, numero] = rota;
    const metodo = req.method;
    if (id === undefined) return metodo === 'GET' ? { status: 200, corpo: await listar() } : { status: 405, corpo: { erro: 'Método não aceito.' } };
    if (!idDeProjetoValido(id)) return { status: 400, corpo: { erro: 'Este projeto não tem um código válido.' } };
    if (parte === undefined && metodo === 'GET') {
      const r = await registroObrigatorio(id);
      return { status: 200, corpo: { versao: r.versao, projeto: await lerVersao(id, r.versao), comentarios: r.comentarios, aprovacao: r.aprovacao, presentes: presentes(id) } };
    }
    if (parte === undefined && metodo === 'PUT') return gravarVersao(id, await lerCorpo(req));
    if (parte === 'versoes' && numero !== undefined && metodo === 'GET') return { status: 200, corpo: { versao: Number(numero), projeto: await lerVersao(id, Number(numero)) } };
    if (parte === 'comentarios' && metodo === 'POST') return { status: 201, corpo: await comentar(id, await lerCorpo(req)) };
    if (parte === 'aprovacao' && metodo === 'POST') return { status: 200, corpo: await aprovar(id, await lerCorpo(req)) };
    if (parte === 'presenca' && metodo === 'POST') {
      const autor = textoDe((await lerCorpo(req))['autor'], 'o seu nome', LIMITE_DO_NOME);
      presencas.set(id, (presencas.get(id) ?? new Map<string, number>()).set(autor, agora().getTime()));
      return { status: 200, corpo: { presentes: presentes(id) } };
    }
    return { status: 405, corpo: { erro: 'Método não aceito.' } };
  };

  return createServer((req, res) => {
    const responder = (status: number, corpo: unknown): void => {
      res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(corpo));
    };
    atender(req).then(
      (r) => responder(r.status, r.corpo),
      (e: unknown) => responder(e instanceof ErroDoPedido ? e.status : 500, { erro: e instanceof ErroDoPedido ? e.message : 'O servidor falhou neste pedido.' }),
    );
  });
}

import type { PastaDeArquivos } from './pastaCompartilhada';
import { lerProjeto, type Projeto } from './projeto';

/**
 * A biblioteca na rede (ADR 0142): uma pasta que várias estações usam, sem servidor. Cada modelo fica lá como um
 * arquivo; quem vai mudar um "pega para editar" — uma trava com o nome da pessoa, criada só se ainda não existe (quem
 * chega primeiro fica com ela) — e "devolve" depois, gravando o modelo e tirando a trava. Os outros veem quem está
 * editando e podem trazer uma cópia para ver, mas não devolver por cima.
 */

export const PROJETOS_NA_REDE = 'projetos';
export const TRAVAS_NA_REDE = 'travas';
/** Uma trava mais velha que isto pode ser liberada por outra pessoa (quem pegou esqueceu de devolver). */
export const HORAS_PARA_A_TRAVA_VENCER = 12;

export interface TravaDeEdicao {
  readonly quem: string;
  readonly desdeIso: string;
  readonly nomeDoProjeto: string;
}

export interface ProjetoNaRede {
  readonly projeto: Projeto;
  readonly trava: TravaDeEdicao | null;
}

export const arquivoDoProjeto = (id: string): string => `${id}.json`;
export const arquivoDaTrava = (id: string): string => `${id}.trava.json`;

const mesmaPessoa = (a: string, b: string): boolean => a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR');

export function lerTrava(texto: string | null): TravaDeEdicao | null {
  if (texto === null) return null;
  try {
    const t: unknown = JSON.parse(texto);
    if (typeof t !== 'object' || t === null) return null;
    const { quem, desdeIso, nomeDoProjeto } = t as Record<string, unknown>;
    if (typeof quem !== 'string' || typeof desdeIso !== 'string') return null;
    return { quem, desdeIso, nomeDoProjeto: typeof nomeDoProjeto === 'string' ? nomeDoProjeto : '' };
  } catch {
    return null;
  }
}

export function travaVencida(trava: TravaDeEdicao, agoraIso: string, horas = HORAS_PARA_A_TRAVA_VENCER): boolean {
  const desde = Date.parse(trava.desdeIso);
  return !Number.isFinite(desde) || Date.parse(agoraIso) - desde >= horas * 3_600_000;
}

const quando = (iso: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
};

export const descricaoDaTrava = (trava: TravaDeEdicao): string => `Em edição por ${trava.quem} desde ${quando(trava.desdeIso)}`;

export type SituacaoNaRede = 'so-na-rede' | 'igual' | 'rede-mais-nova' | 'local-mais-nova';

export const ROTULO_DA_SITUACAO_NA_REDE: Readonly<Record<SituacaoNaRede, string>> = {
  'so-na-rede': 'Só na rede',
  igual: 'Igual à deste computador',
  'rede-mais-nova': 'A da rede é mais nova',
  'local-mais-nova': 'A deste computador é mais nova',
};

/** A cópia da rede comparada à deste computador, pela hora da última mudança. */
export function situacaoNaRede(local: Projeto | undefined, rede: Projeto): SituacaoNaRede {
  if (!local) return 'so-na-rede';
  if (local.modificadoEmIso === rede.modificadoEmIso) return 'igual';
  return local.modificadoEmIso < rede.modificadoEmIso ? 'rede-mais-nova' : 'local-mais-nova';
}

/** Os modelos da pasta, cada um com a sua trava; o que não é um modelo fica de fora, com o motivo. */
export async function lerBibliotecaNaRede(pasta: PastaDeArquivos): Promise<{ readonly projetos: ProjetoNaRede[]; readonly avisos: string[] } | null> {
  const arquivos = await pasta.listar(PROJETOS_NA_REDE);
  if (arquivos === null) return null;
  const travas = new Map<string, TravaDeEdicao>();
  for (const { nome } of (await pasta.listar(TRAVAS_NA_REDE)) ?? []) {
    if (!nome.endsWith('.trava.json')) continue;
    const trava = lerTrava(await pasta.ler(TRAVAS_NA_REDE, nome));
    if (trava) travas.set(nome.slice(0, -'.trava.json'.length), trava);
  }
  const projetos: ProjetoNaRede[] = [];
  const avisos: string[] = [];
  for (const { nome } of arquivos) {
    if (!nome.endsWith('.json')) continue;
    const texto = await pasta.ler(PROJETOS_NA_REDE, nome);
    if (texto === null) continue;
    let lido;
    try {
      lido = lerProjeto(JSON.parse(texto));
    } catch {
      avisos.push(`${nome}: não é um arquivo de projeto legível.`);
      continue;
    }
    if (!lido.ok) avisos.push(`${nome}: ${lido.erro}`);
    else projetos.push({ projeto: lido.projeto, trava: travas.get(lido.projeto.id) ?? null });
  }
  projetos.sort((a, b) => a.projeto.nome.localeCompare(b.projeto.nome, 'pt-BR'));
  return { projetos, avisos };
}

const semNome = 'Escreva o seu nome (ele aparece na trava, para os outros saberem quem está editando).';

/** Põe na rede um modelo que ainda não está lá. O que já está só muda pelo "pegar para editar" e "devolver". */
export async function publicarNaRede(pasta: PastaDeArquivos, projeto: Projeto): Promise<string | null> {
  if ((await pasta.ler(PROJETOS_NA_REDE, arquivoDoProjeto(projeto.id))) !== null) {
    return `“${projeto.nome}” já está na rede: para mudar a de lá, pegue para editar e devolva.`;
  }
  return (await pasta.gravar(PROJETOS_NA_REDE, arquivoDoProjeto(projeto.id), JSON.stringify(projeto))) ? null : 'Não deu para gravar na pasta da rede.';
}

/**
 * Trava o modelo para `quem` e devolve a cópia da rede. Se outra pessoa está com a trava, diz quem e desde quando; a
 * trava que já é de `quem` vale de novo (pegar duas vezes não atrapalha).
 */
export async function pegarParaEditar(
  pasta: PastaDeArquivos,
  id: string,
  quem: string,
  agoraIso: string,
): Promise<{ readonly erro: string } | { readonly projeto: Projeto }> {
  if (quem.trim() === '') return { erro: semNome };
  const texto = await pasta.ler(PROJETOS_NA_REDE, arquivoDoProjeto(id));
  let lido;
  try {
    lido = texto === null ? null : lerProjeto(JSON.parse(texto));
  } catch {
    lido = null;
  }
  if (!lido || !lido.ok) return { erro: 'O modelo não está mais na rede (ou o arquivo dele não é legível).' };
  const trava: TravaDeEdicao = { quem: quem.trim(), desdeIso: agoraIso, nomeDoProjeto: lido.projeto.nome };
  if (!(await pasta.criarSeNaoExiste(TRAVAS_NA_REDE, arquivoDaTrava(id), JSON.stringify(trava)))) {
    const deOutro = lerTrava(await pasta.ler(TRAVAS_NA_REDE, arquivoDaTrava(id)));
    if (!deOutro) return { erro: 'Não deu para travar o modelo na pasta da rede.' };
    if (!mesmaPessoa(deOutro.quem, quem)) return { erro: `${descricaoDaTrava(deOutro)}: só ela pode devolver o modelo. Traga uma cópia para ver.` };
  }
  return { projeto: lido.projeto };
}

/** Grava o modelo na rede e tira a trava — só de quem está com ela. */
export async function devolverARede(pasta: PastaDeArquivos, projeto: Projeto, quem: string): Promise<string | null> {
  if (quem.trim() === '') return semNome;
  const trava = lerTrava(await pasta.ler(TRAVAS_NA_REDE, arquivoDaTrava(projeto.id)));
  if (!trava) return `Pegue “${projeto.nome}” para editar antes de devolver (ninguém está com a trava).`;
  if (!mesmaPessoa(trava.quem, quem)) return `${descricaoDaTrava(trava)}: só ela pode devolver o modelo.`;
  if (!(await pasta.gravar(PROJETOS_NA_REDE, arquivoDoProjeto(projeto.id), JSON.stringify(projeto)))) return 'Não deu para gravar na pasta da rede: a trava continua com você.';
  await pasta.apagar(TRAVAS_NA_REDE, arquivoDaTrava(projeto.id));
  return null;
}

/**
 * Tira a trava sem devolver: a própria, ou a de outra pessoa só quando vencida (mais de
 * `HORAS_PARA_A_TRAVA_VENCER` horas) — quem pegou esqueceu de devolver.
 */
export async function liberarTrava(pasta: PastaDeArquivos, id: string, quem: string, agoraIso: string): Promise<string | null> {
  const trava = lerTrava(await pasta.ler(TRAVAS_NA_REDE, arquivoDaTrava(id)));
  if (!trava) return null;
  if (!mesmaPessoa(trava.quem, quem) && !travaVencida(trava, agoraIso)) {
    return `${descricaoDaTrava(trava)}: a trava de outra pessoa só pode ser liberada depois de ${HORAS_PARA_A_TRAVA_VENCER} horas.`;
  }
  return (await pasta.apagar(TRAVAS_NA_REDE, arquivoDaTrava(id))) ? null : 'Não deu para tirar a trava da pasta da rede.';
}

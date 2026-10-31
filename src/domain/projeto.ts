import type { Molde } from './molde';
import type { Tecido } from './tecido';
import type { ConfiguracaoDeEnfesto } from './enfesto';
import type { ImagemDoModelo } from './imagens';
import type { PlanoDeCorte } from './planoDeCorte';
import type { PlanoGuardado } from './planejamento';
import type { FichaTecnica } from './fichaTecnica';
import type { ElasticidadeDaRecomendacao, RegrasDeCaimento } from './recomendacaoDeTamanho';
import type { Montagem3D } from './montagem3d';
import type { PainelDeInspiracao } from './inspiracao';
import type { ImpressaoDigital } from './impressaoDigital';
import type { BaseAprovada, OrigemNaBase } from './basesAprovadas';

/**
 * Biblioteca permanente de trabalhos + histórico/versões (seções 9, 10 e 11
 * do escopo). Um Projeto é a unidade persistida: identificador único, nome,
 * código, datas, status, e todo o estado necessário para reabrir o trabalho
 * completo (moldes, tecido, enfesto). O histórico guarda um snapshot
 * completo a cada evento significativo — simples e correto, mesmo que não
 * seja o mais compacto possível (ver ADR 0006).
 */

export type StatusDoProjeto = 'em-edicao' | 'calculando' | 'concluido' | 'pronto-para-producao' | 'arquivado';

export const ROTULO_DO_STATUS: Record<StatusDoProjeto, string> = {
  'em-edicao': 'Em edição',
  calculando: 'Calculando',
  concluido: 'Concluído',
  'pronto-para-producao': 'Pronto para produção',
  arquivado: 'Arquivado',
};

export type TipoDeEvento =
  | 'criacao'
  | 'salvamento'
  | 'mudanca-de-configuracao'
  | 'mudanca-de-moldes'
  | 'execucao-de-nesting'
  | 'exportacao-de-pdf'
  | 'envio-para-producao'
  | 'restauracao-de-versao'
  | 'plano-de-corte'
  | 'revisao-do-molde';

export const ROTULO_DO_EVENTO: Record<TipoDeEvento, string> = {
  criacao: 'Criação do projeto',
  salvamento: 'Salvamento',
  'mudanca-de-configuracao': 'Mudança de tecido/enfesto',
  'mudanca-de-moldes': 'Mudança nos moldes',
  'execucao-de-nesting': 'Execução do nesting automático',
  // O nome do tipo ficou do começo; o relatório também sai em Excel, e a descrição diz qual arquivo foi.
  'exportacao-de-pdf': 'Exportação de arquivo',
  'envio-para-producao': 'Envio para produção',
  'restauracao-de-versao': 'Restauração de versão anterior',
  'plano-de-corte': 'Plano de corte',
  'revisao-do-molde': 'Revisão do molde',
};

/** Estado completo do trabalho num dado momento — o que entra/sai ao salvar ou restaurar uma versão. */
export interface EstadoDoProjeto {
  readonly pecas: readonly Molde[];
  readonly tecido: Tecido | null;
  readonly enfesto: ConfiguracaoDeEnfesto | null;
}

export interface EventoDeHistorico {
  readonly id: string;
  readonly tipo: TipoDeEvento;
  readonly dataHoraIso: string;
  readonly descricao?: string;
  readonly estado: EstadoDoProjeto;
}

export interface Projeto {
  readonly id: string;
  readonly nome: string;
  readonly codigo: string;
  readonly criadoEmIso: string;
  readonly modificadoEmIso: string;
  readonly status: StatusDoProjeto;
  readonly estadoAtual: EstadoDoProjeto;
  readonly historico: readonly EventoDeHistorico[];
  /** Id do projeto original de que este é uma variante. Ausente no original e em projetos sem variantes. */
  readonly varianteDe?: string;
  /** Quem fez o modelo (aba Modelo > Autor). Ausente enquanto não for informado. */
  readonly autor?: string;
  /** "Informações" do arquivo (ADR 0201): o cliente, a descrição e as palavras chave. */
  readonly informacoes?: InformacoesDoArquivo;
  /**
   * Fotos e desenhos do modelo (aba Modelo > Imagens). Ficam no projeto, e não
   * no estado de cada versão, para o histórico não repetir a imagem a cada evento.
   */
  readonly imagens?: readonly ImagemDoModelo[];
  /**
   * Os planos de corte confirmados (aba Encaixe > Planejamento de corte), na ordem em que foram feitos. Um plano
   * novo nunca substitui um antigo: o anterior da mesma ordem continua aqui, como histórico. Ausente nos projetos
   * de antes do planejamento, que abrem do mesmo jeito.
   */
  readonly planosDeCorte?: readonly PlanoGuardado[];
  /**
   * A versão do formato do arquivo. Ausente nos projetos gravados antes dela existir (a versão 1). Ver
   * `lerProjeto`, que traz os antigos para a versão atual sem perder nenhum campo.
   */
  readonly versaoDoFormato?: number;
  /** As revisões do molde registradas (aba Encaixe > Planejamento de corte > Molde), da primeira à última. */
  readonly revisoesDoMolde?: readonly RevisaoDoMolde[];
  /** A ficha técnica do modelo (aba Modelo > Ficha técnica, ADR 0105). Ausente: ainda não feita. */
  readonly fichaTecnica?: FichaTecnica;
  /** As regras de caimento da recomendação de tamanho (a folga de cada ponto de medida, ADR 0110). */
  readonly regrasDeCaimento?: RegrasDeCaimento;
  /** O tecido da peça na recomendação de tamanho: quanto a volta cede no corpo (ADR 0119). */
  readonly elasticidadeDaRecomendacao?: ElasticidadeDaRecomendacao;
  /** O provador 3D: o manequim, onde vai cada peça, as costuras, o tecido e as cores (ADR 0111). */
  readonly montagem3d?: Montagem3D;
  /** O painel de inspiração do modelo (as imagens, as notas, o conceito, a paleta; os rascunhos da IA), ADR 0112. */
  readonly inspiracao?: PainelDeInspiracao;
  /** A estampa no encaixe, para a impressão digital do tecido (ADR 0113). */
  readonly impressaoDigital?: ImpressaoDigital;
  /** Marcado como base aprovada: aparece para começar modelos novos (ADR 0126). */
  readonly base?: BaseAprovada;
  /** O modelo começou de uma base: de qual (ADR 0126). */
  readonly feitoDaBase?: OrigemNaBase;
}

/**
 * Uma revisão do molde: um retrato das peças, com número, data, quem registrou e o que mudou. As peças daquele
 * momento ficam no evento do histórico que a revisão aponta; a impressão digital diz se as peças de agora ainda são
 * as daquela revisão.
 */
export interface RevisaoDoMolde {
  readonly numero: number;
  readonly criadaEmIso: string;
  /** Digitado por quem registrou (o programa não tem login). */
  readonly responsavel: string;
  readonly descricao: string;
  readonly impressaoDigital: string;
  readonly eventoId: string;
}

/** A versão do formato que este programa grava. 2: com a versão no arquivo, as revisões do molde e os planos. */
export const VERSAO_DO_FORMATO_DO_PROJETO = 2;

export type ProjetoLido =
  | {
      readonly ok: true;
      readonly projeto: Projeto;
      /** A versão do arquivo como estava no disco (1 quando ele não dizia). */
      readonly versaoLida: number;
      /** O projeto foi trazido de uma versão mais antiga (o arquivo no disco continua como estava até ser gravado). */
      readonly migrado: boolean;
      /** O arquivo é de uma versão mais nova do programa: abre, mas pode ter campos que este programa não conhece. */
      readonly maisNovo: boolean;
    }
  | { readonly ok: false; readonly erro: string };

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Lê um projeto vindo do disco e o traz para a versão atual do formato. Nada é tirado: os campos que este
 * programa não conhece continuam no objeto. O que não é um projeto (sem id, sem estado, sem histórico) é recusado
 * com o motivo, e não entra na biblioteca.
 */
export function lerProjeto(bruto: unknown): ProjetoLido {
  if (!ehObjeto(bruto)) return { ok: false, erro: 'O arquivo não é um projeto (formato desconhecido).' };
  if (typeof bruto.arquivoIlegivel === 'string') return { ok: false, erro: `O arquivo "${bruto.arquivoIlegivel}" não pôde ser lido (está quebrado).` };
  const faltando = (['id', 'nome', 'codigo', 'criadoEmIso', 'modificadoEmIso', 'status'] as const).filter((c) => typeof bruto[c] !== 'string');
  if (faltando.length > 0) return { ok: false, erro: `O projeto não tem ${faltando.join(', ')}.` };
  const estado = bruto.estadoAtual;
  if (!ehObjeto(estado) || !Array.isArray(estado.pecas)) return { ok: false, erro: `O projeto "${String(bruto.nome)}" não tem o estado das peças.` };
  if (!Array.isArray(bruto.historico)) return { ok: false, erro: `O projeto "${String(bruto.nome)}" não tem o histórico.` };
  const versaoLida = typeof bruto.versaoDoFormato === 'number' && Number.isInteger(bruto.versaoDoFormato) && bruto.versaoDoFormato >= 1 ? bruto.versaoDoFormato : 1;
  // Da 1 para a 2 só entra a versão: os campos novos (as revisões, os planos) são opcionais.
  const projeto = { ...(bruto as unknown as Projeto), versaoDoFormato: Math.max(versaoLida, VERSAO_DO_FORMATO_DO_PROJETO) };
  return { ok: true, projeto, versaoLida, migrado: versaoLida < VERSAO_DO_FORMATO_DO_PROJETO, maisNovo: versaoLida > VERSAO_DO_FORMATO_DO_PROJETO };
}

/** A próxima revisão do molde: o número seguinte, presa a um evento novo do histórico com as peças de agora. */
export function registrarRevisaoDoMolde(
  projeto: Projeto,
  dados: { readonly responsavel: string; readonly descricao: string; readonly impressaoDigital: string },
  agoraIso: string,
): Projeto {
  const responsavel = dados.responsavel.trim();
  const descricao = dados.descricao.trim();
  if (responsavel === '') throw new Error('Informe quem está registrando a revisão.');
  if (descricao === '') throw new Error('Descreva a revisão (o que mudou, ou "primeira revisão").');
  const revisoes = projeto.revisoesDoMolde ?? [];
  const ultima = revisoes.at(-1);
  if (ultima && ultima.impressaoDigital === dados.impressaoDigital) {
    throw new Error(`As peças não mudaram desde a revisão ${ultima.numero}: não há o que registrar.`);
  }
  const numero = (ultima?.numero ?? 0) + 1;
  const comEvento = registrarEvento(projeto, 'revisao-do-molde', projeto.estadoAtual, agoraIso, `Revisão ${numero} do molde, por ${responsavel}: ${descricao}`);
  const eventoId = comEvento.historico.at(-1)!.id;
  return { ...comEvento, revisoesDoMolde: [...revisoes, { numero, criadaEmIso: agoraIso, responsavel, descricao, impressaoDigital: dados.impressaoDigital, eventoId }] };
}

/** A revisão registrada que tem exatamente as peças de agora (pela impressão digital), ou `null`. */
export function revisaoAtualDoMolde(projeto: Projeto, impressaoDigital: string): RevisaoDoMolde | null {
  return [...(projeto.revisoesDoMolde ?? [])].reverse().find((r) => r.impressaoDigital === impressaoDigital) ?? null;
}

/**
 * Guarda o plano no projeto, depois dos que já existem. Se a mesma ordem já tinha um plano, o novo diz qual ele
 * substitui — e o anterior fica guardado como estava.
 */
export function adicionarPlanoDeCorte(projeto: Projeto, plano: PlanoDeCorte, agoraIso: string): Projeto {
  const existentes = projeto.planosDeCorte ?? [];
  if (existentes.some((p) => p.id === plano.id)) throw new Error('Este plano já está guardado no projeto.');
  const daOrdem = (p: PlanoGuardado): string => p.entrada.ordem.codigo.trim().toLocaleLowerCase('pt-BR');
  const anterior = [...existentes].reverse().find((p) => daOrdem(p) === daOrdem(plano));
  const guardado: PlanoDeCorte = anterior ? { ...plano, substituiPlanoId: anterior.id } : plano;
  return { ...projeto, planosDeCorte: [...existentes, guardado], modificadoEmIso: agoraIso };
}

export const TAMANHO_MAXIMO_DO_AUTOR = 80;

/** O projeto com a estampa no encaixe. */
export function definirImpressaoDigital(projeto: Projeto, config: ImpressaoDigital, agoraIso: string): Projeto {
  return { ...projeto, impressaoDigital: config, modificadoEmIso: agoraIso };
}

/** O projeto com o painel de inspiração. */
export function definirInspiracao(projeto: Projeto, painel: PainelDeInspiracao, agoraIso: string): Projeto {
  return { ...projeto, inspiracao: painel, modificadoEmIso: agoraIso };
}

/** O projeto com a montagem do provador 3D. */
export function definirMontagem3d(projeto: Projeto, montagem: Montagem3D, agoraIso: string): Projeto {
  return { ...projeto, montagem3d: montagem, modificadoEmIso: agoraIso };
}

/** O projeto com as regras de caimento da recomendação de tamanho. */
export function definirRegrasDeCaimento(projeto: Projeto, regras: RegrasDeCaimento, agoraIso: string): Projeto {
  return { ...projeto, regrasDeCaimento: regras, modificadoEmIso: agoraIso };
}

/** O projeto com o tecido da recomendação de tamanho (ADR 0119). */
export function definirElasticidadeDaRecomendacao(projeto: Projeto, elasticidade: ElasticidadeDaRecomendacao, agoraIso: string): Projeto {
  return { ...projeto, elasticidadeDaRecomendacao: elasticidade, modificadoEmIso: agoraIso };
}

/** O projeto com a ficha técnica (nova ou mudada). */
export function definirFichaTecnica(projeto: Projeto, ficha: FichaTecnica, agoraIso: string): Projeto {
  return { ...projeto, fichaTecnica: ficha, modificadoEmIso: agoraIso };
}

/** "Autor": guarda no projeto o nome de quem fez o modelo; vazio, tira o autor. */
export interface InformacoesDoArquivo {
  readonly cliente?: string;
  readonly descricao?: string;
  readonly palavrasChave?: string;
}

/** Guarda as informações do arquivo; o que fica em branco sai. */
export function definirInformacoes(projeto: Projeto, informacoes: { readonly cliente: string; readonly descricao: string; readonly palavrasChave: string }, agoraIso: string): Projeto {
  const limpas = Object.fromEntries(Object.entries(informacoes).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v !== '')) as InformacoesDoArquivo;
  const copia: { -readonly [K in keyof Projeto]: Projeto[K] } = { ...projeto, modificadoEmIso: agoraIso };
  if (Object.keys(limpas).length > 0) copia.informacoes = limpas;
  else delete copia.informacoes;
  return copia;
}

export function definirAutor(projeto: Projeto, autor: string, agoraIso: string): Projeto {
  const limpo = autor.trim();
  if (limpo.length > TAMANHO_MAXIMO_DO_AUTOR) throw new Error(`O nome do autor pode ter até ${TAMANHO_MAXIMO_DO_AUTOR} caracteres.`);
  if (limpo !== '') return { ...projeto, autor: limpo, modificadoEmIso: agoraIso };
  const copia: { -readonly [K in keyof Projeto]: Projeto[K] } = { ...projeto, modificadoEmIso: agoraIso };
  delete copia.autor;
  return copia;
}

export function gerarCodigoDeProjeto(dataIso: string, sequencial: number): string {
  const data = new Date(dataIso);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `ENF-${ano}${mes}${dia}-${String(sequencial).padStart(3, '0')}`;
}

/**
 * O código do próximo projeto do dia: o sequencial seguinte ao maior já usado nesse dia. Antes, todo projeto
 * saía com o 001 — os projetos do mesmo dia tinham o mesmo código na biblioteca e no nome do relatório.
 */
export function proximoCodigoDeProjeto(dataIso: string, codigosUsados: Iterable<string>): string {
  const prefixo = gerarCodigoDeProjeto(dataIso, 0).slice(0, -3);
  let maior = 0;
  for (const codigo of codigosUsados) {
    if (!codigo.startsWith(prefixo)) continue;
    const sequencial = Number(codigo.slice(prefixo.length));
    if (Number.isInteger(sequencial) && sequencial > maior) maior = sequencial;
  }
  return gerarCodigoDeProjeto(dataIso, maior + 1);
}

export function criarProjeto(
  nome: string,
  id: string,
  codigo: string,
  agoraIso: string,
  estadoInicial: EstadoDoProjeto,
): Projeto {
  const eventoDeCriacao: EventoDeHistorico = {
    id: `${id}-hist-0`,
    tipo: 'criacao',
    dataHoraIso: agoraIso,
    estado: estadoInicial,
  };
  return {
    id,
    nome,
    codigo,
    criadoEmIso: agoraIso,
    modificadoEmIso: agoraIso,
    status: 'em-edicao',
    estadoAtual: estadoInicial,
    historico: [eventoDeCriacao],
    versaoDoFormato: VERSAO_DO_FORMATO_DO_PROJETO,
  };
}

/** Registra um evento (com snapshot do estado) e atualiza o estado atual + data de modificação. */
export function registrarEvento(
  projeto: Projeto,
  tipo: TipoDeEvento,
  novoEstado: EstadoDoProjeto,
  agoraIso: string,
  descricao?: string,
): Projeto {
  const evento: EventoDeHistorico = {
    id: `${projeto.id}-hist-${projeto.historico.length}`,
    tipo,
    dataHoraIso: agoraIso,
    estado: novoEstado,
    ...(descricao !== undefined ? { descricao } : {}),
  };
  return {
    ...projeto,
    estadoAtual: novoEstado,
    modificadoEmIso: agoraIso,
    historico: [...projeto.historico, evento],
  };
}

/** Restaura um estado de um evento passado — SEM apagar histórico; registra a própria restauração como novo evento. */
export function restaurarVersao(projeto: Projeto, idDoEvento: string, agoraIso: string): Projeto {
  const evento = projeto.historico.find((e) => e.id === idDoEvento);
  if (!evento) {
    throw new Error(`Evento de histórico "${idDoEvento}" não encontrado no projeto "${projeto.nome}".`);
  }
  return registrarEvento(
    projeto,
    'restauracao-de-versao',
    evento.estado,
    agoraIso,
    `Restaurado a partir de "${ROTULO_DO_EVENTO[evento.tipo]}" (${evento.dataHoraIso})`,
  );
}

export function alterarStatus(projeto: Projeto, novoStatus: StatusDoProjeto, agoraIso: string): Projeto {
  return { ...projeto, status: novoStatus, modificadoEmIso: agoraIso };
}

export function renomearProjeto(projeto: Projeto, novoNome: string, agoraIso: string): Projeto {
  return { ...projeto, nome: novoNome, modificadoEmIso: agoraIso };
}

/**
 * Filtra projetos por texto livre (nome, código, tecido, tamanho) e/ou
 * status — usado pela busca da biblioteca (seção 9).
 */
export function filtrarProjetos(
  projetos: readonly Projeto[],
  termoDeBusca: string,
  status: StatusDoProjeto | 'todos',
): Projeto[] {
  const termo = termoDeBusca.trim().toLowerCase();
  return projetos.filter((p) => {
    if (status !== 'todos' && p.status !== status) return false;
    if (termo === '') return true;
    const camposDeBusca = [p.informacoes?.cliente ?? '', p.informacoes?.descricao ?? '', p.informacoes?.palavrasChave ?? '', p.nome, p.codigo, p.estadoAtual.tecido?.nome ?? '', p.estadoAtual.tecido?.referencia ?? ''];
    return camposDeBusca.some((campo) => campo.toLowerCase().includes(termo));
  });
}

/** Ordena por data de modificação decrescente (mais recentes primeiro) — seção 9. */
export function ordenarPorMaisRecente(projetos: readonly Projeto[]): Projeto[] {
  return [...projetos].sort((a, b) => b.modificadoEmIso.localeCompare(a.modificadoEmIso));
}

/**
 * Variantes: cópias de um projeto para testar outra versão do mesmo trabalho
 * (outras quantidades, outro tecido, outro encaixe) sem perder a original.
 * Cada variante é um projeto inteiro da biblioteca, com histórico próprio,
 * ligado ao original por `varianteDe`. A variante de uma variante continua
 * ligada ao mesmo original: a família é uma lista, não uma árvore.
 */
export function criarVariante(
  origem: Projeto,
  nome: string,
  id: string,
  codigo: string,
  agoraIso: string,
  estado: EstadoDoProjeto,
): Projeto {
  return {
    ...criarProjeto(nome, id, codigo, agoraIso, estado),
    varianteDe: origem.varianteDe ?? origem.id,
    // A variante é do mesmo modelo: o autor e as imagens vão junto.
    ...(origem.autor ? { autor: origem.autor } : {}),
    ...(origem.imagens ? { imagens: origem.imagens } : {}),
  };
}

/** O projeto e as variantes da mesma família, da mais antiga à mais nova (o original vem primeiro). */
export function variantesDoProjeto(projetos: readonly Projeto[], projeto: Projeto): Projeto[] {
  const original = projeto.varianteDe ?? projeto.id;
  const familia = projetos.filter((p) => p.id !== projeto.id && (p.varianteDe ?? p.id) === original);
  return [...familia, projeto].sort((a, b) => a.criadoEmIso.localeCompare(b.criadoEmIso));
}

const SUFIXO_DE_VARIANTE = / — variante (\d+)$/;

/**
 * Nome sugerido para a próxima variante: o do original e o número seguinte
 * ao maior já usado na família ("Camisa — variante 3"). O original conta
 * como a primeira, então a primeira variante é a 2.
 */
export function nomeDaProximaVariante(projetos: readonly Projeto[], projeto: Projeto): string {
  const familia = variantesDoProjeto(projetos, projeto);
  const original = familia.find((p) => p.varianteDe === undefined) ?? projeto;
  const numerosUsados = familia.map((p) => Number(SUFIXO_DE_VARIANTE.exec(p.nome)?.[1] ?? 0));
  return `${original.nome.replace(SUFIXO_DE_VARIANTE, '')} — variante ${Math.max(familia.length, ...numerosUsados) + 1}`;
}

export interface BibliotecaLida {
  readonly projetos: Projeto[];
  /** Os avisos a mostrar na biblioteca: os arquivos que não são projetos, e os de versão mais nova. */
  readonly avisos: string[];
}

/** A lista que veio do disco, cada projeto lido e trazido para a versão atual (ver `lerProjeto`). */
export function lerBiblioteca(lista: readonly unknown[]): BibliotecaLida {
  const projetos: Projeto[] = [];
  const recusados: string[] = [];
  const maisNovos: string[] = [];
  for (const bruto of lista) {
    const lido = lerProjeto(bruto);
    if (!lido.ok) {
      recusados.push(lido.erro);
      continue;
    }
    projetos.push(lido.projeto);
    if (lido.maisNovo) maisNovos.push(lido.projeto.nome);
  }
  const avisos: string[] = [];
  if (recusados.length > 0) avisos.push(`${recusados.length} arquivo(s) da pasta de projetos não puderam ser lidos e ficaram de fora (nada foi apagado): ${recusados.join(' ')}`);
  if (maisNovos.length > 0) avisos.push(`Gravado(s) por uma versão mais nova do programa: ${maisNovos.join(', ')}. Abre, mas o que esta versão não conhece pode não aparecer.`);
  return { projetos, avisos };
}

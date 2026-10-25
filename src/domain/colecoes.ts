import { textoCsv } from '../core/csv';

/**
 * A gestão de coleção (ADR 0108): o PLM local — as coleções (estação, ano, lançamento, marcos), os modelos de cada
 * uma (o mix: categoria, cores, tecido, o projeto ligado), o fluxo por etapas (criação → modelagem → piloto →
 * aprovação → produção) com o responsável e o prazo, a aprovação da peça-piloto (aprovar, ou pedir alteração com
 * a revisão seguinte), os comentários, o histórico, as tarefas por pessoa e os avisos de prazo, o andamento e a
 * linha do tempo do lançamento.
 *
 * Mora num arquivo da pasta de dados (`colecoes.json`), para uma pessoa ou um computador: sem servidor, não há
 * colaboração ao mesmo tempo, e os avisos de prazo são dentro do programa (sem e-mail ou celular).
 */

export const VERSAO_DAS_COLECOES = 1;
export const MAXIMO_DE_COLECOES = 200;
export const MAXIMO_DE_MODELOS_POR_COLECAO = 500;

export type Estacao = 'primavera-verao' | 'alto-verao' | 'outono-inverno' | 'resort' | 'permanente';
export const ROTULO_DA_ESTACAO: Readonly<Record<Estacao, string>> = {
  'primavera-verao': 'Primavera-Verão',
  'alto-verao': 'Alto Verão',
  'outono-inverno': 'Outono-Inverno',
  resort: 'Resort',
  permanente: 'Permanente',
};

export type EtapaDoModelo = 'criacao' | 'modelagem' | 'piloto' | 'aprovacao' | 'producao' | 'cancelado';
/** As etapas do fluxo, na ordem (o cancelado fica fora dela). */
export const ETAPAS: readonly EtapaDoModelo[] = ['criacao', 'modelagem', 'piloto', 'aprovacao', 'producao'];
export const ROTULO_DA_ETAPA: Readonly<Record<EtapaDoModelo, string>> = {
  criacao: 'Criação',
  modelagem: 'Modelagem',
  piloto: 'Peça-piloto',
  aprovacao: 'Aprovação',
  producao: 'Produção',
  cancelado: 'Cancelado',
};

export interface Tarefa {
  readonly id: string;
  readonly descricao: string;
  readonly responsavel: string;
  /** "AAAA-MM-DD"; vazio: sem prazo. */
  readonly prazo: string;
  readonly feitaEmIso?: string;
}

export interface Comentario {
  readonly dataIso: string;
  readonly autor: string;
  readonly texto: string;
}

export interface MudancaDeEtapa {
  readonly dataIso: string;
  readonly de: EtapaDoModelo;
  readonly para: EtapaDoModelo;
  readonly responsavel: string;
  readonly comentario: string;
  /** A revisão da piloto quando a mudança foi feita (aprovar ou pedir alteração). */
  readonly revisaoDaPiloto?: number;
}

export interface ModeloDaColecao {
  readonly id: string;
  readonly nome: string;
  readonly referencia: string;
  readonly categoria: string;
  readonly cores: readonly string[];
  readonly tecido: string;
  /** O projeto da Biblioteca ligado (o molde, o encaixe, a ficha e o desenho); `null`: ainda sem projeto. */
  readonly projetoId: string | null;
  readonly etapa: EtapaDoModelo;
  readonly responsavel: string;
  /** O prazo da etapa de agora ("AAAA-MM-DD"; vazio: sem prazo). */
  readonly prazo: string;
  /** Quantas vezes a piloto voltou com alteração pedida (a revisão de agora é esta + 1). */
  readonly alteracoesDaPiloto: number;
  readonly tarefas: readonly Tarefa[];
  readonly comentarios: readonly Comentario[];
  readonly historico: readonly MudancaDeEtapa[];
}

export interface MarcoDaColecao {
  readonly id: string;
  readonly nome: string;
  readonly data: string;
}

export interface Colecao {
  readonly id: string;
  readonly nome: string;
  readonly estacao: Estacao;
  readonly ano: number;
  /** A data do lançamento ("AAAA-MM-DD"; vazio: ainda sem data). */
  readonly lancamento: string;
  readonly descricao: string;
  readonly responsavel: string;
  readonly marcos: readonly MarcoDaColecao[];
  readonly modelos: readonly ModeloDaColecao[];
  readonly arquivada: boolean;
  readonly criadaEmIso: string;
}

export interface ArquivoDeColecoes {
  readonly versaoDoFormato: number;
  readonly colecoes: readonly Colecao[];
}

export const COLECOES_VAZIAS: ArquivoDeColecoes = { versaoDoFormato: VERSAO_DAS_COLECOES, colecoes: [] };

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const dataValida = (d: string): boolean => d === '' || (DATA.test(d) && !Number.isNaN(Date.parse(`${d}T00:00:00Z`)));

/** "AAAA-MM-DD" de uma hora ISO (o dia de hoje para comparar prazos). */
export const diaDe = (iso: string): string => iso.slice(0, 10);

/** O dia escrito: "24/10/2026" (vazio: "sem prazo"). */
export function diaEscrito(dia: string): string {
  if (!dia) return 'sem prazo';
  const [a, m, d] = dia.split('-');
  return `${d}/${m}/${a}`;
}

/** Os dias entre dois "AAAA-MM-DD" (b − a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

// ---- Coleções

export function novaColecao(dados: Pick<Colecao, 'nome' | 'estacao' | 'ano'> & Partial<Pick<Colecao, 'lancamento' | 'descricao' | 'responsavel'>>, id: string, agoraIso: string): Colecao {
  return {
    id,
    nome: dados.nome,
    estacao: dados.estacao,
    ano: dados.ano,
    lancamento: dados.lancamento ?? '',
    descricao: dados.descricao ?? '',
    responsavel: dados.responsavel ?? '',
    marcos: [],
    modelos: [],
    arquivada: false,
    criadaEmIso: agoraIso,
  };
}

export function validarColecao(c: Colecao, outras: readonly Colecao[]): string[] {
  const erros: string[] = [];
  if (c.nome.trim() === '') erros.push('A coleção precisa de um nome.');
  if (outras.some((o) => o.id !== c.id && o.nome.trim().toLowerCase() === c.nome.trim().toLowerCase() && o.ano === c.ano)) erros.push(`Já há uma coleção “${c.nome.trim()}” em ${c.ano}.`);
  if (!Number.isInteger(c.ano) || c.ano < 2000 || c.ano > 2100) erros.push('O ano precisa ser de 2000 a 2100.');
  if (!(c.estacao in ROTULO_DA_ESTACAO)) erros.push('A estação não é conhecida.');
  if (!dataValida(c.lancamento)) erros.push('A data do lançamento não é uma data (AAAA-MM-DD).');
  for (const m of c.marcos) {
    if (m.nome.trim() === '') erros.push('Cada marco precisa de um nome.');
    if (!dataValida(m.data) || m.data === '') erros.push(`O marco “${m.nome}” precisa de uma data.`);
  }
  if (c.modelos.length > MAXIMO_DE_MODELOS_POR_COLECAO) erros.push(`A coleção passa de ${MAXIMO_DE_MODELOS_POR_COLECAO} modelos.`);
  return erros;
}

export function salvarColecao(arquivo: ArquivoDeColecoes, colecao: Colecao): ArquivoDeColecoes {
  const erros = validarColecao(colecao, arquivo.colecoes);
  if (erros.length > 0) throw new Error(erros.join(' '));
  const existe = arquivo.colecoes.some((c) => c.id === colecao.id);
  if (!existe && arquivo.colecoes.length >= MAXIMO_DE_COLECOES) throw new Error(`Já há ${MAXIMO_DE_COLECOES} coleções: arquive ou remova alguma.`);
  const limpa = { ...colecao, nome: colecao.nome.trim() };
  return { ...arquivo, colecoes: existe ? arquivo.colecoes.map((c) => (c.id === colecao.id ? limpa : c)) : [...arquivo.colecoes, limpa] };
}

export function removerColecao(arquivo: ArquivoDeColecoes, id: string): ArquivoDeColecoes {
  return { ...arquivo, colecoes: arquivo.colecoes.filter((c) => c.id !== id) };
}

/** As coleções na ordem: as abertas primeiro, pelo lançamento (as sem data no fim), depois as arquivadas. */
export function colecoesNaOrdem(colecoes: readonly Colecao[]): Colecao[] {
  return [...colecoes].sort(
    (a, b) => Number(a.arquivada) - Number(b.arquivada) || (a.lancamento || '9999').localeCompare(b.lancamento || '9999') || a.nome.localeCompare(b.nome, 'pt-BR'),
  );
}

// ---- Modelos

export function novoModelo(dados: Partial<Omit<ModeloDaColecao, 'id' | 'tarefas' | 'comentarios' | 'historico' | 'alteracoesDaPiloto'>> & { readonly nome: string }, id: string): ModeloDaColecao {
  return {
    id,
    nome: dados.nome,
    referencia: dados.referencia ?? '',
    categoria: dados.categoria ?? '',
    cores: dados.cores ?? [],
    tecido: dados.tecido ?? '',
    projetoId: dados.projetoId ?? null,
    etapa: dados.etapa ?? 'criacao',
    responsavel: dados.responsavel ?? '',
    prazo: dados.prazo ?? '',
    alteracoesDaPiloto: 0,
    tarefas: [],
    comentarios: [],
    historico: [],
  };
}

export function validarModelo(m: ModeloDaColecao, outros: readonly ModeloDaColecao[]): string[] {
  const erros: string[] = [];
  if (m.nome.trim() === '') erros.push('O modelo precisa de um nome.');
  const ref = m.referencia.trim().toLowerCase();
  if (ref !== '' && outros.some((o) => o.id !== m.id && o.referencia.trim().toLowerCase() === ref)) erros.push(`A referência ${m.referencia.trim()} já é de outro modelo da coleção.`);
  if (!dataValida(m.prazo)) erros.push('O prazo não é uma data (AAAA-MM-DD).');
  for (const t of m.tarefas) {
    if (t.descricao.trim() === '') erros.push('Cada tarefa precisa da descrição.');
    if (!dataValida(t.prazo)) erros.push(`O prazo da tarefa “${t.descricao}” não é uma data.`);
  }
  return erros;
}

/** O modelo novo ou mudado, dentro da coleção. */
export function salvarModelo(colecao: Colecao, modelo: ModeloDaColecao): Colecao {
  const erros = validarModelo(modelo, colecao.modelos);
  if (erros.length > 0) throw new Error(erros.join(' '));
  const existe = colecao.modelos.some((m) => m.id === modelo.id);
  if (!existe && colecao.modelos.length >= MAXIMO_DE_MODELOS_POR_COLECAO) throw new Error(`A coleção já tem ${MAXIMO_DE_MODELOS_POR_COLECAO} modelos.`);
  return { ...colecao, modelos: existe ? colecao.modelos.map((m) => (m.id === modelo.id ? modelo : m)) : [...colecao.modelos, modelo] };
}

export function removerModelo(colecao: Colecao, id: string): Colecao {
  return { ...colecao, modelos: colecao.modelos.filter((m) => m.id !== id) };
}

// ---- O fluxo por etapas e a piloto

const proxima = (e: EtapaDoModelo): EtapaDoModelo | null => {
  const i = ETAPAS.indexOf(e);
  return i >= 0 && i < ETAPAS.length - 1 ? ETAPAS[i + 1]! : null;
};
const anterior = (e: EtapaDoModelo): EtapaDoModelo | null => {
  const i = ETAPAS.indexOf(e);
  return i > 0 ? ETAPAS[i - 1]! : null;
};

export interface DadosDaMudanca {
  readonly responsavel: string;
  readonly comentario: string;
  /** O prazo da etapa nova ("AAAA-MM-DD"; vazio: sem prazo). */
  readonly prazo?: string;
  readonly agoraIso: string;
}

function mudarPara(m: ModeloDaColecao, para: EtapaDoModelo, d: DadosDaMudanca, revisao?: number): ModeloDaColecao {
  if (d.responsavel.trim() === '') throw new Error('Diga quem muda a etapa (o responsável).');
  if (d.prazo !== undefined && !dataValida(d.prazo)) throw new Error('O prazo não é uma data (AAAA-MM-DD).');
  const mudanca: MudancaDeEtapa = {
    dataIso: d.agoraIso,
    de: m.etapa,
    para,
    responsavel: d.responsavel.trim(),
    comentario: d.comentario.trim(),
    ...(revisao !== undefined ? { revisaoDaPiloto: revisao } : {}),
  };
  return { ...m, etapa: para, prazo: d.prazo ?? '', historico: [...m.historico, mudanca] };
}

/** A etapa seguinte do fluxo (da aprovação, só aprovando a piloto). */
export function avancarEtapa(m: ModeloDaColecao, d: DadosDaMudanca): ModeloDaColecao {
  if (m.etapa === 'aprovacao') throw new Error('Na aprovação, a piloto é aprovada (vai para a produção) ou volta com alteração pedida.');
  const para = proxima(m.etapa);
  if (!para) throw new Error(m.etapa === 'cancelado' ? 'O modelo está cancelado: reabra-o antes.' : 'O modelo já está na produção.');
  return mudarPara(m, para, d);
}

/** A etapa de antes (com o motivo no comentário). */
export function voltarEtapa(m: ModeloDaColecao, d: DadosDaMudanca): ModeloDaColecao {
  const para = anterior(m.etapa);
  if (!para) throw new Error(m.etapa === 'cancelado' ? 'O modelo está cancelado: reabra-o antes.' : 'O modelo já está na primeira etapa.');
  if (d.comentario.trim() === '') throw new Error('Diga por que a etapa volta (no comentário).');
  return mudarPara(m, para, d);
}

/** A peça-piloto aprovada: o modelo vai para a produção. */
export function aprovarPiloto(m: ModeloDaColecao, d: DadosDaMudanca): ModeloDaColecao {
  if (m.etapa !== 'aprovacao') throw new Error('A piloto é aprovada na etapa de aprovação.');
  return mudarPara(m, 'producao', d, m.alteracoesDaPiloto + 1);
}

/** A peça-piloto com alteração pedida: volta para a piloto, na revisão seguinte (o comentário diz o quê). */
export function pedirAlteracaoDaPiloto(m: ModeloDaColecao, d: DadosDaMudanca): ModeloDaColecao {
  if (m.etapa !== 'aprovacao') throw new Error('A alteração da piloto é pedida na etapa de aprovação.');
  if (d.comentario.trim() === '') throw new Error('Diga o que alterar na piloto (no comentário).');
  const mudado = mudarPara(m, 'piloto', d, m.alteracoesDaPiloto + 1);
  return { ...mudado, alteracoesDaPiloto: m.alteracoesDaPiloto + 1 };
}

export function cancelarModelo(m: ModeloDaColecao, d: DadosDaMudanca): ModeloDaColecao {
  if (m.etapa === 'cancelado') throw new Error('O modelo já está cancelado.');
  if (d.comentario.trim() === '') throw new Error('Diga por que o modelo sai da coleção (no comentário).');
  return mudarPara(m, 'cancelado', d);
}

/** A etapa em que o modelo cancelado estava (a da última vez que foi cancelado; sem histórico, a criação). */
export const etapaAntesDoCancelamento = (m: ModeloDaColecao): EtapaDoModelo => [...m.historico].reverse().find((h) => h.para === 'cancelado')?.de ?? 'criacao';

/** O cancelado volta para a etapa em que estava. */
export function reabrirModelo(m: ModeloDaColecao, d: DadosDaMudanca): ModeloDaColecao {
  if (m.etapa !== 'cancelado') throw new Error('Só o modelo cancelado é reaberto.');
  return mudarPara(m, etapaAntesDoCancelamento(m), d);
}

// ---- O quadro das etapas (ADR 0118): o cartão arrastado de uma coluna para outra

export type MudancaPeloQuadro = 'avancar' | 'voltar' | 'aprovar' | 'pedir-alteracao' | 'cancelar' | 'reabrir';

export const ROTULO_DA_MUDANCA_PELO_QUADRO: Readonly<Record<MudancaPeloQuadro, string>> = {
  avancar: 'Avançar',
  voltar: 'Voltar (diga o motivo)',
  aprovar: 'Aprovar a piloto',
  'pedir-alteracao': 'Pedir alteração da piloto',
  cancelar: 'Cancelar (diga o motivo)',
  reabrir: 'Reabrir',
};

/** As mudanças que pedem o comentário (o motivo de voltar ou cancelar, o que alterar na piloto). */
export const MUDANCA_PEDE_COMENTARIO: Readonly<Record<MudancaPeloQuadro, boolean>> = {
  avancar: false,
  voltar: true,
  aprovar: false,
  'pedir-alteracao': true,
  cancelar: true,
  reabrir: false,
};

/**
 * O que soltar o cartão do modelo na coluna `para` faz, pelas regras do fluxo: a etapa seguinte avança (da aprovação,
 * a produção é aprovar a piloto); a de antes volta (da aprovação, a piloto é pedir alteração); o cancelado cancela; do
 * cancelado, a etapa em que estava reabre. Pular etapa, ou a mesma coluna: `null` (nada).
 */
export function mudancaPeloQuadro(m: ModeloDaColecao, para: EtapaDoModelo): MudancaPeloQuadro | null {
  if (para === m.etapa) return null;
  if (m.etapa === 'cancelado') return para === etapaAntesDoCancelamento(m) ? 'reabrir' : null;
  if (para === 'cancelado') return 'cancelar';
  if (m.etapa === 'aprovacao') return para === 'producao' ? 'aprovar' : para === 'piloto' ? 'pedir-alteracao' : null;
  if (para === proxima(m.etapa)) return 'avancar';
  if (para === anterior(m.etapa)) return 'voltar';
  return null;
}

/** A mudança do quadro feita pelas mesmas regras dos botões (o histórico, o motivo, a revisão da piloto). */
export function aplicarMudancaPeloQuadro(m: ModeloDaColecao, mudanca: MudancaPeloQuadro, d: DadosDaMudanca): ModeloDaColecao {
  switch (mudanca) {
    case 'avancar':
      return avancarEtapa(m, d);
    case 'voltar':
      return voltarEtapa(m, d);
    case 'aprovar':
      return aprovarPiloto(m, d);
    case 'pedir-alteracao':
      return pedirAlteracaoDaPiloto(m, d);
    case 'cancelar':
      return cancelarModelo(m, d);
    case 'reabrir':
      return reabrirModelo(m, d);
  }
}

/** A revisão da piloto de agora (1, 2, 3…). */
export const revisaoDaPiloto = (m: Pick<ModeloDaColecao, 'alteracoesDaPiloto'>): number => m.alteracoesDaPiloto + 1;

// ---- Tarefas e comentários

export function adicionarTarefa(m: ModeloDaColecao, tarefa: Omit<Tarefa, 'feitaEmIso'>): ModeloDaColecao {
  if (tarefa.descricao.trim() === '') throw new Error('A tarefa precisa da descrição.');
  if (!dataValida(tarefa.prazo)) throw new Error('O prazo da tarefa não é uma data (AAAA-MM-DD).');
  return { ...m, tarefas: [...m.tarefas, { ...tarefa, descricao: tarefa.descricao.trim(), responsavel: tarefa.responsavel.trim() }] };
}

export function marcarTarefa(m: ModeloDaColecao, tarefaId: string, feita: boolean, agoraIso: string): ModeloDaColecao {
  return {
    ...m,
    tarefas: m.tarefas.map((t) => {
      if (t.id !== tarefaId) return t;
      if (feita) return { ...t, feitaEmIso: agoraIso };
      const { feitaEmIso: _f, ...aberta } = t;
      void _f;
      return aberta;
    }),
  };
}

export function removerTarefa(m: ModeloDaColecao, tarefaId: string): ModeloDaColecao {
  return { ...m, tarefas: m.tarefas.filter((t) => t.id !== tarefaId) };
}

export function adicionarComentario(m: ModeloDaColecao, autor: string, texto: string, agoraIso: string): ModeloDaColecao {
  if (texto.trim() === '') throw new Error('O comentário está vazio.');
  return { ...m, comentarios: [...m.comentarios, { dataIso: agoraIso, autor: autor.trim() || 'sem nome', texto: texto.trim() }] };
}

// ---- Os prazos, o andamento, o mix e a linha do tempo

export interface PendenciaDePrazo {
  readonly colecaoId: string;
  readonly colecao: string;
  readonly modeloId: string;
  readonly modelo: string;
  readonly tipo: 'etapa' | 'tarefa';
  /** A etapa (no prazo de etapa) ou a descrição da tarefa. */
  readonly oQue: string;
  readonly responsavel: string;
  readonly prazo: string;
  /** Dias até o prazo (negativo: atrasado). */
  readonly dias: number;
}

/** Os prazos abertos de todas as coleções abertas (o modelo em produção ou cancelado e a tarefa feita não contam). */
export function pendenciasDePrazo(colecoes: readonly Colecao[], hoje: string): PendenciaDePrazo[] {
  const lista: PendenciaDePrazo[] = [];
  for (const c of colecoes) {
    if (c.arquivada) continue;
    for (const m of c.modelos) {
      const ativo = m.etapa !== 'producao' && m.etapa !== 'cancelado';
      if (ativo && m.prazo) {
        lista.push({ colecaoId: c.id, colecao: c.nome, modeloId: m.id, modelo: m.nome, tipo: 'etapa', oQue: ROTULO_DA_ETAPA[m.etapa], responsavel: m.responsavel, prazo: m.prazo, dias: diasEntre(hoje, m.prazo) });
      }
      if (m.etapa === 'cancelado') continue;
      for (const t of m.tarefas) {
        if (t.feitaEmIso || !t.prazo) continue;
        lista.push({ colecaoId: c.id, colecao: c.nome, modeloId: m.id, modelo: m.nome, tipo: 'tarefa', oQue: t.descricao, responsavel: t.responsavel || m.responsavel, prazo: t.prazo, dias: diasEntre(hoje, t.prazo) });
      }
    }
  }
  return lista.sort((a, b) => a.prazo.localeCompare(b.prazo) || a.modelo.localeCompare(b.modelo, 'pt-BR'));
}

/** O aviso de prazos: quantos atrasados e quantos nos próximos 7 dias. */
export function avisoDePrazos(colecoes: readonly Colecao[], hoje: string): { readonly atrasados: number; readonly naSemana: number } {
  const p = pendenciasDePrazo(colecoes, hoje);
  return { atrasados: p.filter((x) => x.dias < 0).length, naSemana: p.filter((x) => x.dias >= 0 && x.dias <= 7).length };
}

/** As pessoas com tarefa ou prazo aberto, na ordem do nome. */
export function pessoasComPendencia(pendencias: readonly PendenciaDePrazo[]): string[] {
  return [...new Set(pendencias.map((p) => p.responsavel || '(sem responsável)'))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export interface AndamentoDaColecao {
  readonly total: number;
  /** Os modelos em cada etapa (sem os cancelados). */
  readonly porEtapa: Readonly<Record<EtapaDoModelo, number>>;
  readonly cancelados: number;
  /** % dos modelos (sem os cancelados) já na produção. */
  readonly prontosPercentual: number;
  readonly atrasados: number;
  /** Dias até o lançamento (negativo: já passou; `null`: sem data). */
  readonly diasParaOLancamento: number | null;
  readonly tarefasAbertas: number;
  readonly tarefasFeitas: number;
}

export function andamentoDaColecao(c: Colecao, hoje: string): AndamentoDaColecao {
  const porEtapa: Record<EtapaDoModelo, number> = { criacao: 0, modelagem: 0, piloto: 0, aprovacao: 0, producao: 0, cancelado: 0 };
  for (const m of c.modelos) porEtapa[m.etapa]++;
  const ativos = c.modelos.length - porEtapa.cancelado;
  const tarefas = c.modelos.filter((m) => m.etapa !== 'cancelado').flatMap((m) => m.tarefas);
  return {
    total: c.modelos.length,
    porEtapa,
    cancelados: porEtapa.cancelado,
    prontosPercentual: ativos > 0 ? (porEtapa.producao / ativos) * 100 : 0,
    atrasados: pendenciasDePrazo([{ ...c, arquivada: false }], hoje).filter((p) => p.dias < 0).length,
    diasParaOLancamento: c.lancamento ? diasEntre(hoje, c.lancamento) : null,
    tarefasAbertas: tarefas.filter((t) => !t.feitaEmIso).length,
    tarefasFeitas: tarefas.filter((t) => t.feitaEmIso).length,
  };
}

/** O mix: quantos modelos (sem os cancelados) por categoria, por cor e por tecido, do maior para o menor. */
export function resumoDoMix(c: Colecao): { readonly categorias: Array<readonly [string, number]>; readonly cores: Array<readonly [string, number]>; readonly tecidos: Array<readonly [string, number]> } {
  const contar = (valores: readonly string[]): Array<readonly [string, number]> => {
    const mapa = new Map<string, number>();
    for (const v of valores) mapa.set(v, (mapa.get(v) ?? 0) + 1);
    return [...mapa.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'pt-BR'));
  };
  const ativos = c.modelos.filter((m) => m.etapa !== 'cancelado');
  return {
    categorias: contar(ativos.map((m) => m.categoria.trim() || 'Sem categoria')),
    cores: contar(ativos.flatMap((m) => m.cores.map((x) => x.trim()).filter((x) => x !== ''))),
    tecidos: contar(ativos.map((m) => m.tecido.trim() || 'Sem tecido')),
  };
}

export interface PontoDaLinhaDoTempo {
  readonly data: string;
  readonly tipo: 'lancamento' | 'marco' | 'prazo';
  readonly rotulo: string;
  readonly atrasado: boolean;
}

/** A linha do tempo da coleção: os marcos, os prazos das etapas dos modelos e o lançamento, na ordem. */
export function linhaDoTempo(c: Colecao, hoje: string): PontoDaLinhaDoTempo[] {
  const pontos: PontoDaLinhaDoTempo[] = [
    ...c.marcos.map((m) => ({ data: m.data, tipo: 'marco' as const, rotulo: m.nome, atrasado: false })),
    ...c.modelos
      .filter((m) => m.prazo && m.etapa !== 'producao' && m.etapa !== 'cancelado')
      .map((m) => ({ data: m.prazo, tipo: 'prazo' as const, rotulo: `${m.nome}: ${ROTULO_DA_ETAPA[m.etapa]}`, atrasado: m.prazo < hoje })),
    ...(c.lancamento ? [{ data: c.lancamento, tipo: 'lancamento' as const, rotulo: 'Lançamento', atrasado: false }] : []),
  ];
  return pontos.sort((a, b) => a.data.localeCompare(b.data) || (a.tipo === 'lancamento' ? 1 : 0) - (b.tipo === 'lancamento' ? 1 : 0));
}

// ---- Os relatórios

export function csvDoMix(c: Colecao): string {
  const cabecalho = ['Modelo', 'Referência', 'Categoria', 'Cores', 'Tecido', 'Etapa', 'Revisão da piloto', 'Responsável', 'Prazo', 'Tarefas abertas', 'Projeto ligado'];
  const linhas = c.modelos.map((m) => [
    m.nome,
    m.referencia,
    m.categoria,
    m.cores.join(', '),
    m.tecido,
    ROTULO_DA_ETAPA[m.etapa],
    String(revisaoDaPiloto(m)),
    m.responsavel,
    m.prazo ? diaEscrito(m.prazo) : '',
    String(m.tarefas.filter((t) => !t.feitaEmIso).length),
    m.projetoId ? 'sim' : 'não',
  ]);
  return textoCsv([cabecalho, ...linhas]);
}

export function csvDasPendencias(pendencias: readonly PendenciaDePrazo[]): string {
  const cabecalho = ['Prazo', 'Situação', 'Responsável', 'Coleção', 'Modelo', 'O quê'];
  const linhas = pendencias.map((p) => [diaEscrito(p.prazo), p.dias < 0 ? `atrasado ${-p.dias} dia(s)` : p.dias === 0 ? 'hoje' : `em ${p.dias} dia(s)`, p.responsavel, p.colecao, p.modelo, p.tipo === 'etapa' ? `Etapa: ${p.oQue}` : p.oQue]);
  return textoCsv([cabecalho, ...linhas]);
}

// ---- A leitura do arquivo

const ehObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const texto = (v: unknown): string => (typeof v === 'string' ? v : '');
const lista = <T>(v: unknown, ok: (x: Record<string, unknown>) => boolean): T[] => (Array.isArray(v) ? (v.filter((x) => ehObjeto(x) && ok(x)) as T[]) : []);

function modeloLido(m: Record<string, unknown>): ModeloDaColecao | null {
  if (typeof m.id !== 'string' || typeof m.nome !== 'string' || !(String(m.etapa) in ROTULO_DA_ETAPA)) return null;
  return {
    id: m.id,
    nome: m.nome,
    referencia: texto(m.referencia),
    categoria: texto(m.categoria),
    cores: Array.isArray(m.cores) ? m.cores.filter((x): x is string => typeof x === 'string') : [],
    tecido: texto(m.tecido),
    projetoId: typeof m.projetoId === 'string' ? m.projetoId : null,
    etapa: m.etapa as EtapaDoModelo,
    responsavel: texto(m.responsavel),
    prazo: dataValida(texto(m.prazo)) ? texto(m.prazo) : '',
    alteracoesDaPiloto: typeof m.alteracoesDaPiloto === 'number' && m.alteracoesDaPiloto >= 0 ? Math.floor(m.alteracoesDaPiloto) : 0,
    tarefas: lista<Tarefa>(m.tarefas, (t) => typeof t.id === 'string' && typeof t.descricao === 'string').map((t) => ({ ...t, responsavel: texto(t.responsavel), prazo: dataValida(texto(t.prazo)) ? texto(t.prazo) : '' })),
    comentarios: lista<Comentario>(m.comentarios, (x) => typeof x.dataIso === 'string' && typeof x.texto === 'string'),
    historico: lista<MudancaDeEtapa>(m.historico, (h) => typeof h.dataIso === 'string' && String(h.de) in ROTULO_DA_ETAPA && String(h.para) in ROTULO_DA_ETAPA),
  };
}

/** Lê as coleções do disco (`null`: sem arquivo). A coleção quebrada fica de fora, com o motivo. */
export function lerColecoes(bruto: unknown): { readonly arquivo: ArquivoDeColecoes; readonly descartados: readonly string[]; readonly maisNovo: boolean } {
  if (bruto === null || bruto === undefined) return { arquivo: COLECOES_VAZIAS, descartados: [], maisNovo: false };
  if (!ehObjeto(bruto) || !Array.isArray(bruto.colecoes)) return { arquivo: COLECOES_VAZIAS, descartados: ['O arquivo das coleções não é um arquivo de coleções.'], maisNovo: false };
  const descartados: string[] = [];
  const colecoes: Colecao[] = [];
  bruto.colecoes.forEach((c, i) => {
    if (!ehObjeto(c) || typeof c.id !== 'string' || typeof c.nome !== 'string' || typeof c.ano !== 'number' || !(String(c.estacao) in ROTULO_DA_ESTACAO)) {
      descartados.push(`A coleção ${i + 1} ficou de fora: faltam o nome, o ano ou a estação.`);
      return;
    }
    const modelos = Array.isArray(c.modelos) ? c.modelos.map((m) => (ehObjeto(m) ? modeloLido(m) : null)) : [];
    const perdidos = modelos.filter((m) => m === null).length;
    if (perdidos > 0) descartados.push(`Na coleção “${c.nome}”, ${perdidos} modelo(s) ficaram de fora (sem o nome ou a etapa).`);
    colecoes.push({
      id: c.id,
      nome: c.nome,
      estacao: c.estacao as Estacao,
      ano: c.ano,
      lancamento: dataValida(texto(c.lancamento)) ? texto(c.lancamento) : '',
      descricao: texto(c.descricao),
      responsavel: texto(c.responsavel),
      marcos: lista<MarcoDaColecao>(c.marcos, (x) => typeof x.id === 'string' && typeof x.nome === 'string' && dataValida(texto(x.data))),
      modelos: modelos.filter((m): m is ModeloDaColecao => m !== null),
      arquivada: c.arquivada === true,
      criadaEmIso: texto(c.criadaEmIso),
    });
  });
  const maisNovo = typeof bruto.versaoDoFormato === 'number' && bruto.versaoDoFormato > VERSAO_DAS_COLECOES;
  return { arquivo: { versaoDoFormato: VERSAO_DAS_COLECOES, colecoes }, descartados, maisNovo };
}

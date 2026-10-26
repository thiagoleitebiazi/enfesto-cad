import type { OrdemDeProducao } from './cadastroDeProducao';

/**
 * Importação de ordens de produção. O formato documentado é um CSV (o que uma planilha salva): uma linha de
 * cabeçalho e uma linha por ordem.
 *
 *   codigo;produto;cor;prazo;observacoes;molde;revisao;P;M;G;GG
 *   OP-100;Camiseta básica;Azul;2026-11-30;;ENF-20261020-001;1;10;20;20;10
 *
 * - Separador: ponto e vírgula (o do Excel em português), vírgula ou tabulação — o do cabeçalho vale para tudo.
 * - Colunas conhecidas (sem diferença de maiúsculas e acentos): codigo (obrigatória), produto, cor, prazo
 *   (AAAA-MM-DD ou DD/MM/AAAA), observacoes, molde (o código do projeto), revisao (o número da revisão do molde).
 * - As outras colunas são tamanhos: a quantidade de cada um, inteira, de 0 para cima (vazio vale 0).
 * - Campos com o separador dentro vão entre aspas ("Camiseta; manga longa").
 * - Tudo ou nada: com um erro em qualquer linha, nenhuma ordem entra, e cada erro diz a linha.
 *
 * Um ERP entra pelo mesmo caminho: a fonte entrega as linhas (`LinhaDeOrdem`) e `ordensDasLinhas` confere tudo do
 * mesmo jeito. O programa não traz nenhuma conexão com ERP (ver `FonteDeOrdens`).
 */

export type LinhaDeOrdem = Readonly<Record<string, string>>;

export interface ContextoDaImportacao {
  /** Os tamanhos que o molde aberto tem. */
  readonly tamanhosDoMolde: readonly string[];
  readonly projetoId: string;
  readonly codigoDoMolde: string;
  /** Os números das revisões registradas do molde. */
  readonly revisoes: readonly number[];
  /** A revisão que tem as peças de agora (vale quando a linha não diz), ou `null`. */
  readonly revisaoAtual: number | null;
  readonly existentes: readonly OrdemDeProducao[];
  readonly agoraIso: string;
  readonly novoId: () => string;
}

export interface OrdensImportadas {
  readonly ordens: OrdemDeProducao[];
  readonly erros: string[];
}

const semAcento = (t: string): string =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
    .toLowerCase();

const CONHECIDAS: Readonly<Record<string, string>> = {
  codigo: 'codigo',
  'codigo da ordem': 'codigo',
  ordem: 'codigo',
  produto: 'produto',
  cor: 'cor',
  prazo: 'prazo',
  observacoes: 'observacoes',
  observacao: 'observacoes',
  obs: 'observacoes',
  molde: 'molde',
  revisao: 'revisao',
};

/** As células de uma linha de CSV, com aspas. */
function celulas(linha: string, separador: string): string[] {
  const saida: string[] = [];
  let atual = '';
  let entreAspas = false;
  for (let i = 0; i < linha.length; i++) {
    const c = linha[i]!;
    if (entreAspas) {
      if (c === '"' && linha[i + 1] === '"') {
        atual += '"';
        i++;
      } else if (c === '"') entreAspas = false;
      else atual += c;
    } else if (c === '"') entreAspas = true;
    else if (c === separador) {
      saida.push(atual);
      atual = '';
    } else atual += c;
  }
  saida.push(atual);
  return saida.map((x) => x.trim());
}

/** As linhas do CSV como registros (coluna → valor), com o número da linha no arquivo. */
export function lerCsv(texto: string): { readonly cabecalho: string[]; readonly linhas: Array<{ readonly numero: number; readonly valores: LinhaDeOrdem }>; readonly erros: string[] } {
  const brutas = texto.replace(/^\uFEFF/, '').split(/\r?\n/);
  const primeira = brutas.findIndex((l) => l.trim() !== '');
  if (primeira < 0) return { cabecalho: [], linhas: [], erros: ['O arquivo está vazio.'] };
  const topo = brutas[primeira]!;
  const contagem = (c: string): number => topo.split(c).length - 1;
  const separador = [';', '\t', ','].reduce((melhor, c) => (contagem(c) > contagem(melhor) ? c : melhor), ';');
  const cabecalho = celulas(topo, separador);
  const erros: string[] = [];
  if (cabecalho.length < 2) erros.push('O cabeçalho precisa de pelo menos a coluna "codigo" e um tamanho, separados por ponto e vírgula.');
  const repetidas = cabecalho.filter((c, i) => cabecalho.findIndex((d) => semAcento(d) === semAcento(c)) !== i);
  if (repetidas.length > 0) erros.push(`O cabeçalho tem coluna repetida: ${[...new Set(repetidas)].join(', ')}.`);
  if (cabecalho.some((c) => c === '')) erros.push('O cabeçalho tem uma coluna sem nome.');
  const linhas: Array<{ numero: number; valores: LinhaDeOrdem }> = [];
  for (let i = primeira + 1; i < brutas.length; i++) {
    const linha = brutas[i]!;
    if (linha.trim() === '') continue;
    const valores = celulas(linha, separador);
    if (valores.length > cabecalho.length) {
      erros.push(`Linha ${i + 1}: tem ${valores.length} colunas, e o cabeçalho, ${cabecalho.length}.`);
      continue;
    }
    linhas.push({ numero: i + 1, valores: Object.fromEntries(cabecalho.map((c, k) => [c, valores[k] ?? ''])) });
  }
  if (erros.length === 0 && linhas.length === 0) erros.push('O arquivo não tem nenhuma ordem (só o cabeçalho).');
  return { cabecalho, linhas, erros };
}

function prazoLido(texto: string): string | null {
  const t = texto.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (m) return `${m[3]}-${m[2]!.padStart(2, '0')}-${m[1]!.padStart(2, '0')}`;
  return null;
}

/** As ordens das linhas (de um CSV ou de uma fonte externa), com tudo conferido. Tudo ou nada. */
export function ordensDasLinhas(linhas: ReadonlyArray<{ readonly numero: number; readonly valores: LinhaDeOrdem }>, contexto: ContextoDaImportacao): OrdensImportadas {
  const erros: string[] = [];
  const ordens: OrdemDeProducao[] = [];
  const vistos = new Set<string>();
  for (const { numero, valores } of linhas) {
    const onde = `Linha ${numero}`;
    const campo: Record<string, string> = {};
    const tamanhos: Record<string, string> = {};
    for (const [coluna, valor] of Object.entries(valores)) {
      const conhecida = CONHECIDAS[semAcento(coluna)];
      if (conhecida) campo[conhecida] = valor.trim();
      else tamanhos[coluna.trim()] = valor.trim();
    }
    const codigo = campo.codigo ?? '';
    if (codigo === '') {
      erros.push(`${onde}: falta o código da ordem.`);
      continue;
    }
    const chave = codigo.toLocaleLowerCase('pt-BR');
    if (vistos.has(chave)) erros.push(`${onde}: a ordem ${codigo} aparece duas vezes no arquivo.`);
    vistos.add(chave);
    if (contexto.existentes.some((o) => o.codigo.trim().toLocaleLowerCase('pt-BR') === chave)) {
      erros.push(`${onde}: a ordem ${codigo} já está no cadastro (para mudar uma ordem que existe, use a tela).`);
    }
    if (campo.molde && campo.molde !== contexto.codigoDoMolde) {
      erros.push(`${onde}: a ordem ${codigo} é do molde ${campo.molde}, e o projeto aberto é o ${contexto.codigoDoMolde}: abra o projeto dela para importá-la.`);
    }
    let revisao: number | null = contexto.revisaoAtual;
    if (campo.revisao) {
      const r = Number(campo.revisao);
      if (!Number.isInteger(r) || !contexto.revisoes.includes(r)) erros.push(`${onde}: a revisão ${campo.revisao} não está registrada neste molde (há: ${contexto.revisoes.join(', ') || 'nenhuma'}).`);
      else revisao = r;
    }
    let prazo: string | undefined;
    if (campo.prazo) {
      const p = prazoLido(campo.prazo);
      if (!p) erros.push(`${onde}: o prazo "${campo.prazo}" não é uma data (use AAAA-MM-DD ou DD/MM/AAAA).`);
      else prazo = p;
    }
    const quantidades: Record<string, number> = {};
    for (const [tamanho, texto] of Object.entries(tamanhos)) {
      if (texto === '') continue;
      if (!/^\d+$/.test(texto)) {
        erros.push(`${onde}: a quantidade do tamanho ${tamanho} ("${texto}") não é um número inteiro.`);
        continue;
      }
      const n = Number(texto);
      if (n > 0 && !contexto.tamanhosDoMolde.includes(tamanho)) {
        erros.push(`${onde}: o tamanho ${tamanho} não existe no molde (tamanhos: ${contexto.tamanhosDoMolde.join(', ')}).`);
        continue;
      }
      if (contexto.tamanhosDoMolde.includes(tamanho)) quantidades[tamanho] = n;
    }
    if (!Object.values(quantidades).some((n) => n > 0)) erros.push(`${onde}: a ordem ${codigo} não tem quantidade em nenhum tamanho.`);
    ordens.push({
      id: contexto.novoId(),
      codigo,
      quantidadesPorTamanho: quantidades,
      projetoId: contexto.projetoId,
      codigoDoMolde: contexto.codigoDoMolde,
      ...(revisao !== null ? { revisaoDoMolde: revisao } : {}),
      ...(campo.produto ? { produto: campo.produto } : {}),
      ...(campo.cor ? { cor: campo.cor } : {}),
      ...(prazo ? { prazo } : {}),
      ...(campo.observacoes ? { observacoes: campo.observacoes } : {}),
      criadaEmIso: contexto.agoraIso,
      atualizadaEmIso: contexto.agoraIso,
    });
  }
  return erros.length > 0 ? { ordens: [], erros } : { ordens, erros };
}

/** O CSV inteiro: as ordens, ou os erros (nenhuma entra se houver um). */
export function importarOrdensCsv(texto: string, contexto: ContextoDaImportacao): OrdensImportadas {
  const lido = lerCsv(texto);
  if (lido.erros.length > 0) return { ordens: [], erros: lido.erros };
  if (!lido.cabecalho.some((c) => CONHECIDAS[semAcento(c)] === 'codigo')) return { ordens: [], erros: ['O cabeçalho não tem a coluna "codigo".'] };
  return ordensDasLinhas(lido.linhas, contexto);
}

/**
 * Uma fonte externa de ordens (um ERP). O programa não traz nenhuma: ligar um ERP pede, do dono do sistema, o
 * endereço do serviço, a forma de autenticação (e onde a credencial fica guardada — nunca no código), o mapeamento
 * dos campos (código, produto, cor, prazo, tamanhos) e a liberação de rede no processo principal. Com isso, a fonte
 * entrega as linhas e `ordensDasLinhas` confere tudo como no CSV.
 */
export interface FonteDeOrdens {
  readonly nome: string;
  buscarLinhas(): Promise<ReadonlyArray<{ readonly numero: number; readonly valores: LinhaDeOrdem }>>;
}

export const ERP_NAO_CONFIGURADO =
  'Nenhum ERP está ligado a este programa. Para ligar um, é preciso do responsável pelo ERP: o endereço do serviço, a forma de autenticação e onde a credencial fica guardada (nunca no código), o mapeamento dos campos (código, produto, cor, prazo, quantidades por tamanho) e a liberação de rede. Enquanto isso, as ordens entram por CSV: à mão, ou pela pasta de troca com o ERP (o ERP deixa os arquivos nela).';

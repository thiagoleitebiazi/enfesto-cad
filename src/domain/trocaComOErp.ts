import { textoCsv } from '../core/csv';
import { numeroComVirgula } from '../core/numeros';
import { estadoDoRolo, grupoDoRolo, movimentosAtivos, salvarOrdem, type CadastroDeProducao } from './cadastroDeProducao';
import { importarOrdensCsv, type ContextoDaImportacao } from './importacaoDeOrdens';
import type { AcessoAPasta, PastaDeArquivos } from './pastaCompartilhada';
import { ROTULO_DA_SITUACAO } from './execucaoDoCorte';
import { consumoPorMalha, csvDasExecucoes, csvDoConsumoPorMalha } from './salaDeCorte';

/**
 * A troca com o ERP por uma pasta (ADR 0141): sem servidor e sem credencial. O ERP (ou quem cuida dele) deixa as
 * ordens em CSV na subpasta "entrada"; o programa importa as do molde aberto — conferidas como na importação à mão,
 * tudo ou nada por arquivo — e move cada arquivo para "processados" (ou para "com-erro", com o relatório dos erros ao
 * lado). Na subpasta "saida", o programa deixa o que o ERP lê: as ordens com a situação do corte, o estoque de cada
 * rolo, os movimentos de estoque, os cortes executados e o consumo por malha — sempre com os mesmos nomes, trocados a
 * cada troca.
 */

export const ENTRADA_DO_ERP = 'entrada';
export const PROCESSADOS_DO_ERP = 'processados';
export const COM_ERRO_DO_ERP = 'com-erro';
export const SAIDA_PARA_O_ERP = 'saida';

const semAcento = (t: string): string =>
  t
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/**
 * Os arquivos de ordens da entrada que são deste molde: os .csv cujo nome começa pelo código do molde, seguido de um
 * separador ("MOL-01_ordens.csv", "mol-01 semana 43.csv"). Os de outros moldes ficam na pasta, para quando o molde
 * deles for aberto.
 */
export function arquivosDoMolde(nomes: readonly string[], codigoDoMolde: string): string[] {
  const codigo = semAcento(codigoDoMolde.trim());
  if (codigo === '') return [];
  return nomes.filter((nome) => {
    const n = semAcento(nome);
    return n.endsWith('.csv') && n.startsWith(codigo) && /^[\s._-]/.test(n.slice(codigo.length));
  });
}

/** O nome com a data e a hora na frente, para o arquivo movido não substituir outro de mesmo nome. */
export function nomeCarimbado(nome: string, agoraIso: string): string {
  return `${agoraIso.slice(0, 19).replace(/[:T]/g, '-')}_${nome}`;
}

/** O relatório que fica ao lado do arquivo recusado: por que nenhuma ordem dele entrou. */
export function relatorioDosErros(nome: string, erros: readonly string[], agoraIso: string): string {
  return [`Arquivo: ${nome}`, `Lido em: ${agoraIso}`, 'Nenhuma ordem deste arquivo entrou. Corrija as linhas e coloque o arquivo de novo na pasta "entrada".', '', ...erros].join('\r\n') + '\r\n';
}

const metros = (mm: number | null | undefined): string => (mm === null || mm === undefined ? '' : numeroComVirgula(mm / 1000, 3));

/** As ordens do cadastro, com a grade, as peças e a situação do corte (a execução mais recente da ordem). */
export function csvDasOrdens(cadastro: CadastroDeProducao): string {
  const cabecalho = ['Código', 'Produto', 'Cor', 'Molde', 'Revisão', 'Prazo', 'Grade', 'Peças', 'Situação do corte', 'Cortes concluídos', 'Camadas cortadas', 'Consumo real (m)'];
  const linhas = cadastro.ordens.map((o) => {
    const cortes = cadastro.execucoes.filter((e) => e.ordem === o.codigo);
    const ultima = [...cortes].sort((a, b) => a.liberadaEmIso.localeCompare(b.liberadaEmIso)).at(-1);
    const concluidas = cortes.filter((e) => e.situacao === 'concluida');
    const grade = Object.entries(o.quantidadesPorTamanho).filter(([, n]) => n > 0);
    return [
      o.codigo,
      o.produto ?? '',
      o.cor ?? '',
      o.codigoDoMolde ?? '',
      o.revisaoDoMolde === undefined ? '' : String(o.revisaoDoMolde),
      o.prazo ?? '',
      grade.map(([t, n]) => `${t}=${n}`).join(' '),
      String(grade.reduce((s, [, n]) => s + n, 0)),
      ultima ? ROTULO_DA_SITUACAO[ultima.situacao] : 'Sem corte',
      String(concluidas.length),
      String(concluidas.reduce((s, e) => s + (e.camadasRealizadas ?? 0), 0)),
      concluidas.length > 0 ? metros(concluidas.reduce((s, e) => s + (e.consumoRealMm ?? 0), 0)) : '',
    ];
  });
  return textoCsv([cabecalho, ...linhas]);
}

/** O estoque de cada rolo: o inicial, o consumido, o reservado, o saldo e o disponível (m). */
export function csvDosRolos(cadastro: CadastroDeProducao): string {
  const cabecalho = ['Rolo', 'Malha', 'Lote e tonalidade', 'Localização', 'Inicial (m)', 'Consumido (m)', 'Reservado (m)', 'Saldo físico (m)', 'Disponível (m)', 'Indisponível'];
  const linhas = cadastro.rolos.map((r) => {
    const e = estadoDoRolo(cadastro, r);
    return [
      r.identificacao,
      cadastro.malhas.find((m) => m.id === r.malhaId)?.descricao ?? '',
      grupoDoRolo(r),
      r.localizacao ?? '',
      metros(e.inicialMm),
      metros(e.consumidoMm),
      metros(e.reservadoMm),
      metros(e.saldoFisicoMm),
      metros(e.disponivelMm),
      r.indisponivel ? 'sim' : 'não',
    ];
  });
  return textoCsv([cabecalho, ...linhas]);
}

/** Todos os movimentos de estoque, do mais antigo ao mais novo, com o que ainda vale (os estornados, não). */
export function csvDosMovimentos(cadastro: CadastroDeProducao): string {
  const ativos = new Set(movimentosAtivos(cadastro.movimentos).map((m) => m.id));
  const cabecalho = ['Id', 'Data', 'Tipo', 'Rolo', 'Malha', 'Plano', 'Comprimento (m)', 'Peso (kg)', 'Responsável', 'Motivo', 'Estorna', 'Vale'];
  const linhas = [...cadastro.movimentos]
    .sort((a, b) => a.dataIso.localeCompare(b.dataIso))
    .map((m) => {
      const rolo = cadastro.rolos.find((r) => r.id === m.roloId);
      return [
        m.id,
        m.dataIso,
        m.tipo,
        rolo?.identificacao ?? m.roloId,
        cadastro.malhas.find((x) => x.id === rolo?.malhaId)?.descricao ?? '',
        m.planoId,
        metros(m.comprimentoMm),
        m.pesoG === undefined ? '' : numeroComVirgula(m.pesoG / 1000, 3),
        m.responsavel,
        m.motivo ?? '',
        m.estornaId ?? '',
        m.tipo === 'estorno' || ativos.has(m.id) ? 'sim' : 'não',
      ];
    });
  return textoCsv([cabecalho, ...linhas]);
}

export interface ArquivoParaOErp {
  readonly nome: string;
  readonly texto: string;
}

/** O que vai para a subpasta "saida" a cada troca. */
export function arquivosParaOErp(cadastro: CadastroDeProducao, nomeDoProjeto: (projetoId: string) => string): ArquivoParaOErp[] {
  return [
    { nome: 'ordens.csv', texto: csvDasOrdens(cadastro) },
    { nome: 'rolos.csv', texto: csvDosRolos(cadastro) },
    { nome: 'movimentos-de-estoque.csv', texto: csvDosMovimentos(cadastro) },
    { nome: 'cortes.csv', texto: csvDasExecucoes(cadastro, nomeDoProjeto) },
    { nome: 'consumo-por-malha.csv', texto: csvDoConsumoPorMalha(consumoPorMalha(cadastro)) },
  ];
}

/** O que a troca precisa da pasta (no programa, a pasta compartilhada do tipo "erp"; nos testes, uma de mentira). */
export type PastaDeTroca = Pick<PastaDeArquivos, 'listar' | 'ler' | 'gravar' | 'mover'>;

/** A pasta de troca na interface: além de trocar arquivos, saber onde está, escolher e deixar de usar. */
export type AcessoAPastaDeTroca = PastaDeTroca & Pick<AcessoAPasta, 'onde' | 'escolher' | 'esquecer'>;

/** Outro molde da biblioteca, cujas ordens também entram na troca (ADR 0154). */
export type OutroMolde = Pick<ContextoDaImportacao, 'tamanhosDoMolde' | 'projetoId' | 'codigoDoMolde' | 'revisoes' | 'revisaoAtual'>;

export interface ResultadoDaTroca {
  /** O cadastro com as ordens importadas (igual ao de antes, se nenhuma entrou). */
  readonly cadastro: CadastroDeProducao;
  readonly importados: ReadonlyArray<{ readonly nome: string; readonly ordens: readonly string[] }>;
  readonly recusados: ReadonlyArray<{ readonly nome: string; readonly erros: readonly string[] }>;
  /** Os arquivos gravados na saída. */
  readonly gravados: readonly string[];
  /** O que não deu para fazer na pasta (um arquivo levado por outra estação, a pasta fora do ar). */
  readonly falhas: readonly string[];
}

/**
 * A troca inteira: as ordens deste molde que estão na entrada, uma por arquivo (tudo ou nada), e depois a saída. O
 * arquivo aceito é movido para "processados" antes de as ordens entrarem — se outra estação o levou primeiro, ele fica
 * com ela e as ordens não entram duas vezes.
 */
export async function trocarComOErp(
  pasta: PastaDeTroca,
  cadastro: CadastroDeProducao,
  contexto: Omit<ContextoDaImportacao, 'existentes'>,
  nomeDoProjeto: (projetoId: string) => string,
  outros: readonly OutroMolde[] = [],
): Promise<ResultadoDaTroca> {
  const importados: Array<{ nome: string; ordens: string[] }> = [];
  const recusados: Array<{ nome: string; erros: string[] }> = [];
  const falhas: string[] = [];
  let c = cadastro;
  const lista = await pasta.listar(ENTRADA_DO_ERP);
  if (lista === null) return { cadastro, importados, recusados, gravados: [], falhas: ['A pasta de troca não está acessível.'] };
  // O molde aberto primeiro; dois projetos com o mesmo código: as ordens ficam com o primeiro.
  const contextos = [contexto, ...outros.map((o) => ({ ...contexto, ...o }))].filter((c1, i, todos) => todos.findIndex((c2) => c2.codigoDoMolde.trim().toLocaleLowerCase('pt-BR') === c1.codigoDoMolde.trim().toLocaleLowerCase('pt-BR')) === i);
  const paraImportar = contextos.flatMap((ctx) => arquivosDoMolde(lista.map((a) => a.nome), ctx.codigoDoMolde).map((nome) => ({ nome, ctx })));
  for (const { nome, ctx } of paraImportar) {
    const texto = await pasta.ler(ENTRADA_DO_ERP, nome);
    if (texto === null) {
      falhas.push(`${nome}: não deu para ler (outra estação pode tê-lo levado).`);
      continue;
    }
    const carimbado = nomeCarimbado(nome, contexto.agoraIso);
    const r = importarOrdensCsv(texto, { ...ctx, existentes: c.ordens });
    if (r.erros.length > 0) {
      if (!(await pasta.mover(ENTRADA_DO_ERP, nome, COM_ERRO_DO_ERP, carimbado))) falhas.push(`${nome}: recusado, mas não deu para movê-lo para "${COM_ERRO_DO_ERP}".`);
      else await pasta.gravar(COM_ERRO_DO_ERP, `${carimbado}.erros.txt`, relatorioDosErros(nome, r.erros, contexto.agoraIso));
      recusados.push({ nome, erros: r.erros });
      continue;
    }
    if (!(await pasta.mover(ENTRADA_DO_ERP, nome, PROCESSADOS_DO_ERP, carimbado))) {
      falhas.push(`${nome}: não deu para movê-lo para "${PROCESSADOS_DO_ERP}" (outra estação pode tê-lo levado); as ordens dele não entraram.`);
      continue;
    }
    c = r.ordens.reduce((acc, o) => salvarOrdem(acc, o), c);
    importados.push({ nome, ordens: r.ordens.map((o) => o.codigo) });
  }
  const gravados: string[] = [];
  for (const arquivo of arquivosParaOErp(c, nomeDoProjeto)) {
    if (await pasta.gravar(SAIDA_PARA_O_ERP, arquivo.nome, arquivo.texto)) gravados.push(arquivo.nome);
    else falhas.push(`${arquivo.nome}: não deu para gravar em "${SAIDA_PARA_O_ERP}".`);
  }
  return { cadastro: c, importados, recusados, gravados, falhas };
}

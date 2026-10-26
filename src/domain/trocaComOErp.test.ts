import { describe, expect, it } from 'vitest';
import { lerCsv } from '../core/csv';
import { CADASTRO_VAZIO, salvarMalha, salvarOrdem, salvarRolo, type MalhaDoCadastro, type RoloDeEstoque } from './cadastroDeProducao';
import { concluirOCorte, execucaoAtualDoPlano, iniciarOCorte, liberarParaOCorte, planoDaExecucao, type PlanoParaExecutar } from './execucaoDoCorte';
import { arquivosDoMolde, arquivosParaOErp, csvDasOrdens, csvDosMovimentos, csvDosRolos, nomeCarimbado, relatorioDosErros, trocarComOErp, type PastaDeTroca } from './trocaComOErp';

const MALHA: MalhaDoCadastro = { id: 'm1', descricao: 'Malha algodão', larguraUtilMm: 1700, rendimentoMmPorG: 4, tubular: false, sentidoUnico: false, padrao: 'liso', encolhimentoCompensadoNoMolde: false };
const ROLO: RoloDeEstoque = {
  id: 'r1',
  malhaId: 'm1',
  identificacao: 'R1',
  comprimentoMedidoMm: 200_000,
  lote: 'L1',
  tonalidade: 'A',
  defeitos: [],
  unidadeDoPeso: 'kg',
  unidadeDoComprimento: 'm',
  indisponivel: false,
};
let contador = 0;
const novoId = (): string => `id-${++contador}`;

function cadastroComUmCorte() {
  let c = salvarRolo(salvarMalha(CADASTRO_VAZIO, MALHA), ROLO);
  c = salvarOrdem(c, { id: 'o1', codigo: 'OP-1', produto: 'Camiseta', cor: 'Azul', codigoDoMolde: 'MOL-01', revisaoDoMolde: 2, quantidadesPorTamanho: { P: 10, M: 20, G: 0 }, prazo: '2026-11-10', criadaEmIso: 'x', atualizadaEmIso: 'x' });
  c = salvarOrdem(c, { id: 'o2', codigo: 'OP-2', quantidadesPorTamanho: { M: 5 }, criadaEmIso: 'x', atualizadaEmIso: 'x' });
  const plano: PlanoParaExecutar = { planoId: 'p1', projetoId: 'proj', ordem: 'OP-1', camadas: 10, consumoMm: 40_000, usos: [{ roloId: 'r1', comprimentoMm: 40_000 }], malha: 'Malha algodão' };
  c = liberarParaOCorte(c, plano, { responsavel: 'Ana', agoraIso: '2026-10-20T08:00:00.000Z', novoId });
  const id = execucaoAtualDoPlano(c, 'p1')!.id;
  c = iniciarOCorte(c, id, { operador: 'Bruno', agoraIso: '2026-10-20T09:00:00.000Z' });
  return concluirOCorte(c, id, planoDaExecucao(execucaoAtualDoPlano(c, 'p1')!), {
    responsavel: 'Bruno',
    agoraIso: '2026-10-20T10:00:00.000Z',
    camadasRealizadas: 10,
    consumoPorRolo: [{ roloId: 'r1', realMm: 41_500, sobraViraRetalho: false }],
    novoId,
  }).cadastro;
}

describe('a troca com o ERP por uma pasta (ADR 0141)', () => {
  it('da entrada, só os CSV deste molde: o código no começo do nome, seguido de um separador', () => {
    const nomes = ['MOL-01_ordens.csv', 'mol-01 semana 43.CSV', 'MOL-012_ordens.csv', 'MOL-01_ordens.txt', 'outro.csv', 'MOL-01.csv'];
    expect(arquivosDoMolde(nomes, 'MOL-01')).toEqual(['MOL-01_ordens.csv', 'mol-01 semana 43.CSV', 'MOL-01.csv']);
    expect(arquivosDoMolde(nomes, '  ')).toEqual([]);
  });

  it('o nome carimbado e o relatório dos erros', () => {
    expect(nomeCarimbado('MOL-01_a.csv', '2026-10-26T10:30:05.123Z')).toBe('2026-10-26-10-30-05_MOL-01_a.csv');
    const r = relatorioDosErros('MOL-01_a.csv', ['Linha 2: o tamanho XG não existe no molde.'], '2026-10-26T10:30:05.123Z');
    expect(r).toContain('Nenhuma ordem deste arquivo entrou');
    expect(r.trim().endsWith('Linha 2: o tamanho XG não existe no molde.')).toBe(true);
  });

  it('as ordens com a grade, as peças e a situação do corte', () => {
    const [cab, op1, op2] = lerCsv(csvDasOrdens(cadastroComUmCorte()));
    expect(cab).toEqual(['Código', 'Produto', 'Cor', 'Molde', 'Revisão', 'Prazo', 'Grade', 'Peças', 'Situação do corte', 'Cortes concluídos', 'Camadas cortadas', 'Consumo real (m)']);
    expect(op1).toEqual(['OP-1', 'Camiseta', 'Azul', 'MOL-01', '2', '2026-11-10', 'P=10 M=20', '30', 'Concluída', '1', '10', '41,500']);
    expect(op2).toEqual(['OP-2', '', '', '', '', '', 'M=5', '5', 'Sem corte', '0', '0', '']);
  });

  it('o estoque do rolo depois do corte, e o movimento de baixa', () => {
    const c = cadastroComUmCorte();
    const [, r1] = lerCsv(csvDosRolos(c));
    expect(r1).toEqual(['R1', 'Malha algodão', 'L1 · A', '', '200,000', '41,500', '0,000', '158,500', '158,500', 'não']);
    const movimentos = lerCsv(csvDosMovimentos(c)).slice(1);
    const baixa = movimentos.find((m) => m[2] === 'baixa');
    expect(baixa?.slice(3, 8)).toEqual(['R1', 'Malha algodão', 'p1', '41,500', '10,375']);
    expect(baixa?.[11]).toBe('sim');
  });

  it('os cinco arquivos da saída, sempre com os mesmos nomes', () => {
    expect(arquivosParaOErp(cadastroComUmCorte(), () => 'Projeto').map((a) => a.nome)).toEqual(['ordens.csv', 'rolos.csv', 'movimentos-de-estoque.csv', 'cortes.csv', 'consumo-por-malha.csv']);
  });
});

/** Uma pasta na memória: subpasta → nome → texto. `levar` simula outra estação levando o arquivo antes da hora. */
function pastaDeMentira(entrada: Record<string, string>, levar: readonly string[] = []) {
  const pastas = new Map<string, Map<string, string>>(['entrada', 'processados', 'com-erro', 'saida'].map((s) => [s, new Map()]));
  for (const [nome, texto] of Object.entries(entrada)) pastas.get('entrada')!.set(nome, texto);
  const pasta: PastaDeTroca = {
    listar: async (sub) => [...(pastas.get(sub)?.keys() ?? [])].map((nome) => ({ nome })),
    ler: async (sub, nome) => pastas.get(sub)?.get(nome) ?? null,
    gravar: async (sub, nome, texto) => {
      pastas.get(sub)!.set(nome, texto);
      return true;
    },
    mover: async (de, nome, para, novoNome) => {
      const texto = pastas.get(de)?.get(nome);
      if (texto === undefined || levar.includes(nome) || pastas.get(para)!.has(novoNome)) return false;
      pastas.get(de)!.delete(nome);
      pastas.get(para)!.set(novoNome, texto);
      return true;
    },
  };
  return { pasta, pastas };
}

const CONTEXTO = {
  tamanhosDoMolde: ['P', 'M', 'G'],
  projetoId: 'proj',
  codigoDoMolde: 'MOL-01',
  revisoes: [],
  revisaoAtual: null,
  agoraIso: '2026-10-26T10:30:05.000Z',
  novoId: () => `ordem-${++contador}`,
};

describe('a troca completa com a pasta', () => {
  it('importa o arquivo deste molde, recusa o com erro (com o relatório), deixa o de outro molde e grava a saída', async () => {
    const { pasta, pastas } = pastaDeMentira({
      'MOL-01_boa.csv': 'codigo;produto;P;M;G\nOP-10;Camiseta;5;5;0\nOP-11;Camiseta;0;3;3\n',
      'MOL-01_ruim.csv': 'codigo;P;XG\nOP-12;1;4\n',
      'MOL-02_outra.csv': 'codigo;P\nOP-20;1\n',
    });
    const r = await trocarComOErp(pasta, CADASTRO_VAZIO, CONTEXTO, () => 'Projeto');
    expect(r.importados).toEqual([{ nome: 'MOL-01_boa.csv', ordens: ['OP-10', 'OP-11'] }]);
    expect(r.cadastro.ordens.map((o) => o.codigo)).toEqual(['OP-10', 'OP-11']);
    expect(r.recusados.map((x) => x.nome)).toEqual(['MOL-01_ruim.csv']);
    expect(r.falhas).toEqual([]);
    expect([...pastas.get('entrada')!.keys()]).toEqual(['MOL-02_outra.csv']);
    expect([...pastas.get('processados')!.keys()]).toEqual(['2026-10-26-10-30-05_MOL-01_boa.csv']);
    expect([...pastas.get('com-erro')!.keys()]).toEqual(['2026-10-26-10-30-05_MOL-01_ruim.csv', '2026-10-26-10-30-05_MOL-01_ruim.csv.erros.txt']);
    expect(pastas.get('com-erro')!.get('2026-10-26-10-30-05_MOL-01_ruim.csv.erros.txt')).toContain('XG');
    expect(r.gravados).toEqual(['ordens.csv', 'rolos.csv', 'movimentos-de-estoque.csv', 'cortes.csv', 'consumo-por-malha.csv']);
    // A saída já tem as ordens que acabaram de entrar.
    expect(pastas.get('saida')!.get('ordens.csv')).toContain('OP-11');
  });

  it('o arquivo que outra estação levou antes não entra: as ordens não ficam duas vezes', async () => {
    const { pasta } = pastaDeMentira({ 'MOL-01_boa.csv': 'codigo;P\nOP-10;5\n' }, ['MOL-01_boa.csv']);
    const r = await trocarComOErp(pasta, CADASTRO_VAZIO, CONTEXTO, () => 'Projeto');
    expect(r.importados).toEqual([]);
    expect(r.cadastro).toBe(CADASTRO_VAZIO);
    expect(r.falhas[0]).toMatch(/outra estação/);
  });

  it('a pasta fora do ar: nada muda, e a falha é dita', async () => {
    const pasta: PastaDeTroca = { listar: async () => null, ler: async () => null, gravar: async () => false, mover: async () => false };
    const r = await trocarComOErp(pasta, CADASTRO_VAZIO, CONTEXTO, () => 'Projeto');
    expect(r).toEqual({ cadastro: CADASTRO_VAZIO, importados: [], recusados: [], gravados: [], falhas: ['A pasta de troca não está acessível.'] });
  });
});

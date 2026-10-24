import { describe, expect, it } from 'vitest';
import {
  adicionarComentario,
  adicionarTarefa,
  andamentoDaColecao,
  aprovarPiloto,
  avancarEtapa,
  avisoDePrazos,
  cancelarModelo,
  COLECOES_VAZIAS,
  colecoesNaOrdem,
  csvDasPendencias,
  csvDoMix,
  diaEscrito,
  diasEntre,
  lerColecoes,
  linhaDoTempo,
  marcarTarefa,
  novaColecao,
  novoModelo,
  pedirAlteracaoDaPiloto,
  pendenciasDePrazo,
  pessoasComPendencia,
  reabrirModelo,
  removerModelo,
  resumoDoMix,
  revisaoDaPiloto,
  salvarColecao,
  salvarModelo,
  voltarEtapa,
  type Colecao,
  type DadosDaMudanca,
} from './colecoes';

const AGORA = '2026-10-24T10:00:00.000Z';
const HOJE = '2026-10-24';
const d = (extras: Partial<DadosDaMudanca> = {}): DadosDaMudanca => ({ responsavel: 'Ana', comentario: '', agoraIso: AGORA, ...extras });

function colecao(): Colecao {
  let c = novaColecao({ nome: 'Verão 27', estacao: 'primavera-verao', ano: 2027, lancamento: '2027-01-15', responsavel: 'Ana' }, 'c1', AGORA);
  c = salvarModelo(c, novoModelo({ nome: 'Camiseta básica', referencia: 'CAM-01', categoria: 'Camiseta', cores: ['Branco', 'Preto'], tecido: 'Malha PV', responsavel: 'Bruno', prazo: '2026-10-20' }, 'm1'));
  c = salvarModelo(c, novoModelo({ nome: 'Bermuda', referencia: 'BER-01', categoria: 'Bermuda', cores: ['Preto'], tecido: 'Sarja', etapa: 'piloto', responsavel: 'Carla', prazo: '2026-10-30' }, 'm2'));
  c = salvarModelo(c, novoModelo({ nome: 'Regata', referencia: 'REG-01', categoria: 'Camiseta', cores: ['Branco'], tecido: 'Malha PV', etapa: 'producao' }, 'm3'));
  return c;
}

describe('as coleções', () => {
  it('a coleção nova; o nome repetido no mesmo ano é recusado; a ordem (abertas pelo lançamento, depois as arquivadas)', () => {
    let a = salvarColecao(COLECOES_VAZIAS, colecao());
    expect(() => salvarColecao(a, novaColecao({ nome: ' verão 27 ', estacao: 'alto-verao', ano: 2027 }, 'c2', AGORA))).toThrow(/Já há uma coleção “verão 27” em 2027/);
    a = salvarColecao(a, novaColecao({ nome: 'Inverno 27', estacao: 'outono-inverno', ano: 2027, lancamento: '2027-04-01' }, 'c3', AGORA));
    a = salvarColecao(a, { ...novaColecao({ nome: 'Antiga', estacao: 'resort', ano: 2025, lancamento: '2025-01-01' }, 'c4', AGORA), arquivada: true });
    a = salvarColecao(a, novaColecao({ nome: 'Sem data', estacao: 'permanente', ano: 2027 }, 'c5', AGORA));
    expect(colecoesNaOrdem(a.colecoes).map((c) => c.nome)).toEqual(['Verão 27', 'Inverno 27', 'Sem data', 'Antiga']);
    expect(() => salvarColecao(a, novaColecao({ nome: '', estacao: 'resort', ano: 1990, lancamento: '15/01/2027' }, 'c6', AGORA))).toThrow(/precisa de um nome.*de 2000 a 2100.*não é uma data/);
  });

  it('o modelo: a referência não se repete na coleção; remover', () => {
    const c = colecao();
    expect(() => salvarModelo(c, novoModelo({ nome: 'Outra', referencia: 'cam-01' }, 'm9'))).toThrow(/A referência cam-01 já é de outro modelo/);
    expect(removerModelo(c, 'm2').modelos.map((m) => m.id)).toEqual(['m1', 'm3']);
  });
});

describe('o fluxo por etapas e a peça-piloto', () => {
  it('avançar e voltar (voltar pede o motivo); o histórico com quem, quando e o prazo novo', () => {
    let m = novoModelo({ nome: 'Camiseta' }, 'm');
    m = avancarEtapa(m, d({ prazo: '2026-11-05' }));
    expect(m).toMatchObject({ etapa: 'modelagem', prazo: '2026-11-05' });
    expect(() => voltarEtapa(m, d())).toThrow(/por que a etapa volta/);
    m = voltarEtapa(m, d({ comentario: 'Mudar a gola' }));
    expect(m.etapa).toBe('criacao');
    expect(m.historico.map((h) => [h.de, h.para, h.responsavel, h.comentario])).toEqual([
      ['criacao', 'modelagem', 'Ana', ''],
      ['modelagem', 'criacao', 'Ana', 'Mudar a gola'],
    ]);
    expect(() => avancarEtapa(m, d({ responsavel: ' ' }))).toThrow(/quem muda a etapa/);
  });

  it('a aprovação: pedir alteração volta para a piloto na revisão seguinte; aprovar vai para a produção', () => {
    let m = novoModelo({ nome: 'Bermuda', etapa: 'piloto' }, 'm');
    m = avancarEtapa(m, d());
    expect(m.etapa).toBe('aprovacao');
    expect(() => avancarEtapa(m, d())).toThrow(/a piloto é aprovada/);
    expect(() => pedirAlteracaoDaPiloto(m, d())).toThrow(/o que alterar/);
    m = pedirAlteracaoDaPiloto(m, d({ comentario: 'Encurtar 2 cm', responsavel: 'Bruno' }));
    expect(m).toMatchObject({ etapa: 'piloto', alteracoesDaPiloto: 1 });
    expect(revisaoDaPiloto(m)).toBe(2);
    m = aprovarPiloto(avancarEtapa(m, d()), d({ responsavel: 'Bruno', comentario: 'Ok' }));
    expect(m.etapa).toBe('producao');
    expect(m.historico.filter((h) => h.revisaoDaPiloto !== undefined).map((h) => [h.para, h.revisaoDaPiloto])).toEqual([
      ['piloto', 1],
      ['producao', 2],
    ]);
    expect(() => avancarEtapa(m, d())).toThrow(/já está na produção/);
  });

  it('cancelar (com o motivo) e reabrir na etapa em que estava', () => {
    let m = novoModelo({ nome: 'Saia', etapa: 'modelagem' }, 'm');
    expect(() => cancelarModelo(m, d())).toThrow(/por que o modelo sai/);
    m = cancelarModelo(m, d({ comentario: 'Fora do orçamento' }));
    expect(m.etapa).toBe('cancelado');
    expect(() => avancarEtapa(m, d())).toThrow(/reabra-o/);
    expect(reabrirModelo(m, d()).etapa).toBe('modelagem');
  });
});

describe('tarefas, comentários e prazos', () => {
  it('tarefas: pôr, marcar e desmarcar; comentários', () => {
    let m = adicionarTarefa(novoModelo({ nome: 'X' }, 'm'), { id: 't1', descricao: ' Comprar o aviamento ', responsavel: 'Bruno', prazo: '2026-10-28' });
    expect(m.tarefas[0]).toMatchObject({ descricao: 'Comprar o aviamento' });
    m = marcarTarefa(m, 't1', true, AGORA);
    expect(m.tarefas[0]!.feitaEmIso).toBe(AGORA);
    expect('feitaEmIso' in marcarTarefa(m, 't1', false, AGORA).tarefas[0]!).toBe(false);
    expect(() => adicionarTarefa(m, { id: 't2', descricao: '', responsavel: '', prazo: '' })).toThrow(/descrição/);
    expect(adicionarComentario(m, 'Ana', 'Tecido aprovado', AGORA).comentarios).toEqual([{ dataIso: AGORA, autor: 'Ana', texto: 'Tecido aprovado' }]);
  });

  it('os prazos abertos: o atraso, os da semana; o modelo em produção e a tarefa feita não contam; por pessoa', () => {
    let c = colecao();
    c = salvarModelo(c, adicionarTarefa(c.modelos[1]!, { id: 't', descricao: 'Provar a piloto', responsavel: '', prazo: '2026-10-25' }));
    c = salvarModelo(c, adicionarTarefa(c.modelos[2]!, { id: 'u', descricao: 'Etiqueta', responsavel: 'Duda', prazo: '2026-10-01' }));
    const p = pendenciasDePrazo([c], HOJE);
    expect(p.map((x) => [x.modelo, x.tipo, x.oQue, x.responsavel, x.dias])).toEqual([
      ['Regata', 'tarefa', 'Etiqueta', 'Duda', -23],
      ['Camiseta básica', 'etapa', 'Criação', 'Bruno', -4],
      ['Bermuda', 'tarefa', 'Provar a piloto', 'Carla', 1],
      ['Bermuda', 'etapa', 'Peça-piloto', 'Carla', 6],
    ]);
    expect(avisoDePrazos([c], HOJE)).toEqual({ atrasados: 2, naSemana: 2 });
    expect(pessoasComPendencia(p)).toEqual(['Bruno', 'Carla', 'Duda']);
    expect(avisoDePrazos([{ ...c, arquivada: true }], HOJE)).toEqual({ atrasados: 0, naSemana: 0 });
  });

  it('o andamento, o mix e a linha do tempo', () => {
    const c = { ...colecao(), marcos: [{ id: 'k', nome: 'Aprovação do mix', data: '2026-11-10' }] };
    const a = andamentoDaColecao(c, HOJE);
    expect(a).toMatchObject({ total: 3, cancelados: 0, atrasados: 1, diasParaOLancamento: 83 });
    expect(a.porEtapa).toMatchObject({ criacao: 1, piloto: 1, producao: 1 });
    expect(a.prontosPercentual).toBeCloseTo(100 / 3, 6);
    expect(resumoDoMix(c)).toEqual({
      categorias: [
        ['Camiseta', 2],
        ['Bermuda', 1],
      ],
      cores: [
        ['Branco', 2],
        ['Preto', 2],
      ],
      tecidos: [
        ['Malha PV', 2],
        ['Sarja', 1],
      ],
    });
    expect(linhaDoTempo(c, HOJE).map((p) => [p.data, p.tipo, p.rotulo, p.atrasado])).toEqual([
      ['2026-10-20', 'prazo', 'Camiseta básica: Criação', true],
      ['2026-10-30', 'prazo', 'Bermuda: Peça-piloto', false],
      ['2026-11-10', 'marco', 'Aprovação do mix', false],
      ['2027-01-15', 'lancamento', 'Lançamento', false],
    ]);
  });

  it('os dias e as datas escritas', () => {
    expect(diasEntre('2026-10-24', '2026-11-03')).toBe(10);
    expect(diaEscrito('2026-10-24')).toBe('24/10/2026');
    expect(diaEscrito('')).toBe('sem prazo');
  });
});

describe('os relatórios e o arquivo', () => {
  it('o CSV do mix e o das pendências', () => {
    const linhas = csvDoMix(colecao()).trim().split('\r\n');
    expect(linhas[0]).toBe('Modelo;Referência;Categoria;Cores;Tecido;Etapa;Revisão da piloto;Responsável;Prazo;Tarefas abertas;Projeto ligado');
    expect(linhas[1]).toBe('Camiseta básica;CAM-01;Camiseta;Branco, Preto;Malha PV;Criação;1;Bruno;20/10/2026;0;não');
    const pend = csvDasPendencias(pendenciasDePrazo([colecao()], HOJE)).trim().split('\r\n');
    expect(pend[1]).toBe('20/10/2026;atrasado 4 dia(s);Bruno;Verão 27;Camiseta básica;Etapa: Criação');
  });

  it('ida e volta; a coleção e o modelo quebrados ficam de fora com o motivo; a versão mais nova', () => {
    const a = salvarColecao(COLECOES_VAZIAS, colecao());
    const bruto = JSON.parse(JSON.stringify(a)) as { colecoes: Array<Record<string, unknown>> };
    expect(lerColecoes(bruto).arquivo).toEqual(a);
    (bruto.colecoes[0]!.modelos as unknown[]).push({ id: 'x', nome: 'Sem etapa' });
    bruto.colecoes.push({ id: 'y' });
    const lida = lerColecoes(bruto);
    expect(lida.descartados).toEqual(['Na coleção “Verão 27”, 1 modelo(s) ficaram de fora (sem o nome ou a etapa).', 'A coleção 2 ficou de fora: faltam o nome, o ano ou a estação.']);
    expect(lida.arquivo.colecoes[0]!.modelos).toHaveLength(3);
    expect(lerColecoes(null).arquivo).toEqual(COLECOES_VAZIAS);
    expect(lerColecoes({ versaoDoFormato: 7, colecoes: [] }).maisNovo).toBe(true);
  });
});

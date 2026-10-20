import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ponto } from '../core/geometria';
import { criarMolde, type Molde } from '../domain/molde';
import { criarProjeto, registrarRevisaoDoMolde, type Projeto } from '../domain/projeto';
import { CADASTRO_VAZIO, salvarMalha, salvarRolo, type CadastroDeProducao } from '../domain/cadastroDeProducao';
import { CONFIGURACAO_PADRAO_DO_PLANEJAMENTO } from '../domain/planoDeEnfesto';
import { executarBusca } from '../domain/buscaDeRiscos';
import { confirmarPlano, type PlanoDeCorteV2 } from '../domain/planejamento';
import { calcularPlanoDeCorte, CONFIGURACAO_PADRAO_DO_PLANO, impressaoDigitalDoMolde, VERSAO_DO_CALCULO, type PlanoDeCorte } from '../domain/planoDeCorte';
import { PainelDePlanejamento, type BuscarRiscos, type PainelDePlanejamentoProps } from './PainelDePlanejamento';

afterEach(() => cleanup());

function peca(id: string, nome: string, tamanho: string, largura: number, comprimento: number, extras: Partial<Parameters<typeof criarMolde>[0]> = {}): Molde {
  return criarMolde(
    { nome, referencia: '', tamanho, contorno: [ponto(0, 0), ponto(largura, 0), ponto(largura, comprimento), ponto(0, comprimento)], linhaDeFio: { inicio: ponto(largura / 2, 10), fim: ponto(largura / 2, comprimento - 10) }, ...extras },
    id,
  );
}

// Uma frente por tamanho (P e M), e um bolso comum aos dois.
const PECAS: Molde[] = [peca('fp', 'Frente', 'P', 400, 600), peca('fm', 'Frente', 'M', 420, 620), peca('b', 'Bolso', '', 150, 150)];
const PROJETO: Projeto = criarProjeto('Camiseta', 'p1', 'ENF-1', '2026-10-20T09:00:00.000Z', { pecas: PECAS, tecido: null, enfesto: null });

const buscarAqui: BuscarRiscos = (pedidos, opcoes, aoProgredir) => ({ promessa: executarBusca(pedidos, opcoes, { aoProgredir }), cancelar: () => {} });

let contador = 0;
function abrir(extras: Partial<PainelDePlanejamentoProps> = {}) {
  const chamadas = {
    onConfirmar: vi.fn<(p: PlanoDeCorteV2, aplicar: boolean) => string | null>(() => null),
    onGuardarRascunho: vi.fn<(p: PlanoDeCorteV2) => string | null>(() => null),
    onRegistrarRevisao: vi.fn(() => null),
    onMudarCadastro: vi.fn(async (_c: CadastroDeProducao) => null),
    onAbrirPeca: vi.fn(),
    onRemoverRascunho: vi.fn(() => null),
  };
  render(
    <PainelDePlanejamento
      projeto={PROJETO}
      pecas={PECAS}
      tecidoDoProjeto={null}
      tipoDoEnfesto="impar"
      cadastro={CADASTRO_VAZIO}
      cadastroSomenteLeitura={false}
      avisosDoCadastro={[]}
      configuracaoGuardada={CONFIGURACAO_PADRAO_DO_PLANEJAMENTO}
      buscarRiscos={buscarAqui}
      agoraIso={() => '2026-10-20T12:00:00.000Z'}
      novoId={(prefixo) => `${prefixo}-${++contador}`}
      onGuardarConfiguracao={() => {}}
      onFechar={() => {}}
      {...chamadas}
      {...extras}
    />,
  );
  return chamadas;
}

const etapa = (nome: string) => fireEvent.click(screen.getByRole('button', { name: nome }));
const escrever = (rotulo: string | RegExp, valor: string, dentro: HTMLElement = document.body) => fireEvent.change(within(dentro).getByLabelText(rotulo), { target: { value: valor } });
const secao = (nome: string) => screen.getByRole('region', { name: nome });

function preencherOrdemEMalha() {
  etapa('2. Ordem');
  escrever('Código da ordem', 'OP-50');
  escrever('P', '2', secao('Ordem de produção'));
  escrever('M', '2', secao('Ordem de produção'));
  etapa('3. Malha e rolos');
  escrever('Descrição da malha', 'Malha teste');
  escrever('Largura útil (m)', '1,6');
  escrever('Rendimento (m/kg)', '4');
  escrever('Peso disponível (kg)', '10');
}

describe('PainelDePlanejamento — o molde', () => {
  it('mostra as peças por tamanho, a quantidade por roupa e a falta de revisão; registra a revisão', () => {
    const { onRegistrarRevisao } = abrir();
    const tabela = screen.getByRole('table', { name: 'Peças do modelo (o que vai para o encaixe)' });
    expect(within(tabela).getAllByRole('row')).toHaveLength(4);
    expect(tabela).toHaveTextContent('Bolso');
    expect(tabela).toHaveTextContent('P, M (comum)');
    expect(screen.getByText(/Nenhuma revisão do molde registrada ainda/)).toBeInTheDocument();
    escrever('Quem registra', 'Ana');
    escrever('O que mudou', 'Primeira revisão');
    fireEvent.click(screen.getByRole('button', { name: 'Registrar revisão' }));
    expect(onRegistrarRevisao).toHaveBeenCalledWith({ responsavel: 'Ana', descricao: 'Primeira revisão', impressaoDigital: impressaoDigitalDoMolde(PECAS) });
  });

  it('com a revisão registrada para estas peças, diz qual é; "Abrir a peça" leva à peça', () => {
    const revisado = registrarRevisaoDoMolde(PROJETO, { responsavel: 'Ana', descricao: 'Primeira', impressaoDigital: impressaoDigitalDoMolde(PECAS) }, '2026-10-20T10:00:00.000Z');
    const { onAbrirPeca } = abrir({ projeto: revisado });
    expect(screen.getByText(/Revisão 1 do molde/)).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: 'Abrir a peça' })[0]!);
    expect(onAbrirPeca).toHaveBeenCalledWith('fp');
  });

  it('a quantidade por roupa que não vale é dita (em par, tem de ser par)', () => {
    abrir({ pecas: [...PECAS, { ...peca('m', 'Manga', 'M', 200, 300, { quantidade: 2 }), emPar: true }] });
    escrever('Quantidade por roupa de Manga', '3');
    expect(screen.getByRole('alert')).toHaveTextContent('“Manga” é cortada em pares (direita e esquerda): a quantidade por roupa precisa ser par, e está 3.');
  });
});

describe('PainelDePlanejamento — de ponta a ponta', () => {
  it('sem os dados, o cálculo diz o que falta e não liga', () => {
    abrir();
    etapa('4. Risco e enfesto');
    expect(screen.getByRole('alert')).toHaveTextContent('Preencha "Código da ordem".');
    expect(screen.getByRole('button', { name: 'Calcular as alternativas' })).toBeDisabled();
  });

  it('gera os riscos, compara as alternativas, revisa e confirma — com as unidades internas e o responsável', async () => {
    const { onConfirmar } = abrir();
    preencherOrdemEMalha();
    etapa('4. Risco e enfesto');
    fireEvent.click(screen.getByRole('button', { name: 'Calcular as alternativas' }));
    const tabela = await screen.findByRole('table', { name: 'Alternativas (escolha uma)' });
    expect(within(tabela).getAllByRole('radio').length).toBeGreaterThanOrEqual(1);
    expect(tabela).toHaveTextContent('Menor consumo estimado');
    // O desenho do risco escolhido, em escala.
    expect(screen.getAllByRole('img', { name: /^Risco / }).length).toBeGreaterThanOrEqual(1);
    fireEvent.click(screen.getByRole('button', { name: 'Revisar e confirmar esta alternativa' }));
    escrever(/Responsável/, 'Bruno');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar o plano' }));
    expect(screen.getByRole('alertdialog', { name: 'Confirmar o plano' })).toHaveTextContent('Confirmar o plano da ordem OP-50');
    fireEvent.click(screen.getByRole('button', { name: 'Sim, confirmar' }));
    expect(onConfirmar).toHaveBeenCalledTimes(1);
    const [plano, aplicar] = onConfirmar.mock.calls[0]!;
    expect(aplicar).toBe(true);
    expect(plano).toMatchObject({ versaoDoCalculo: 2, responsavel: 'Bruno', estrategia: 'menor-consumo' });
    expect(plano.entrada.malha).toMatchObject({ larguraUtilMm: 1600, rendimentoMmPorG: 4 });
    expect(plano.entrada.pesoDisponivelG).toBe(10_000);
    expect(plano.entrada.ordem).toEqual({ codigo: 'OP-50', quantidadesPorTamanho: { P: 2, M: 2 } });
    expect(plano.resultado.producaoPorTamanho).toMatchObject({ P: 2, M: 2 });
    expect(plano.riscos.every((r) => r.pecas.length > 0)).toBe(true);
    expect(plano.busca?.composicoesAvaliadas).toBeGreaterThan(0);
  });

  it('salvar rascunho guarda o plano sem confirmar', async () => {
    const { onGuardarRascunho, onConfirmar } = abrir();
    preencherOrdemEMalha();
    etapa('4. Risco e enfesto');
    fireEvent.click(screen.getByRole('button', { name: 'Calcular as alternativas' }));
    await screen.findByRole('table', { name: 'Alternativas (escolha uma)' });
    etapa('6. Revisar e confirmar');
    escrever('Camadas por enfesto', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    expect(onConfirmar).not.toHaveBeenCalled();
    const plano = onGuardarRascunho.mock.calls[0]![0];
    expect(plano.situacao).toBe('rascunho');
    expect(plano.ajustes).toEqual({ camadasPorEnfesto: 1 });
    expect(plano.ajustesFeitos).toContainEqual({ campo: 'camadas por enfesto', sugerido: 100, escolhido: 1 });
    expect(screen.getByText(/Rascunho guardado no projeto/)).toBeInTheDocument();
  });

  it('o risco informado à mão: sem desenho, e o plano diz que depende do informado', () => {
    const { onConfirmar } = abrir();
    preencherOrdemEMalha();
    etapa('4. Risco e enfesto');
    fireEvent.click(screen.getByLabelText(/Informar um risco existente/));
    escrever('Comprimento do risco (m)', '1,3');
    escrever('Largura ocupada do risco (m)', '1,5');
    escrever('Roupas do P por folha', '1');
    escrever('Roupas do M por folha', '1');
    fireEvent.click(screen.getByRole('button', { name: 'Calcular o plano' }));
    expect(screen.getByText(/Risco informado à mão: não há o desenho das peças/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Revisar e confirmar' }));
    escrever(/Responsável/, 'Ana');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar o plano' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sim, confirmar' }));
    const plano = onConfirmar.mock.calls[0]![0];
    expect(plano.estrategia).toBe('risco-informado');
    expect(plano.resultado.riscos[0]).toMatchObject({ origem: 'informado', comprimentoMm: 1300, camadas: 2 });
  });
});

describe('PainelDePlanejamento — cadastro, rolos e lotes', () => {
  const MALHA = { id: 'm1', descricao: 'Algodão', larguraUtilMm: 1600, rendimentoMmPorG: 4, tubular: false, sentidoUnico: false, padrao: 'liso' as const, encolhimentoCompensadoNoMolde: false };
  const comRolos = salvarRolo(
    salvarRolo(salvarMalha(CADASTRO_VAZIO, MALHA), { id: 'r1', malhaId: 'm1', identificacao: 'R1', comprimentoMedidoMm: 50_000, lote: 'L1', tonalidade: 'A', defeitos: [], unidadeDoPeso: 'kg', unidadeDoComprimento: 'm', indisponivel: false }),
    { id: 'r2', malhaId: 'm1', identificacao: 'R2', comprimentoMedidoMm: 50_000, lote: 'L2', tonalidade: 'A', defeitos: [], unidadeDoPeso: 'kg', unidadeDoComprimento: 'm', indisponivel: false },
  );

  it('rolos de lotes diferentes: o plano não sai sem a decisão de misturar', async () => {
    abrir({ cadastro: comRolos });
    etapa('2. Ordem');
    escrever('Código da ordem', 'OP-1');
    escrever('P', '2', secao('Ordem de produção'));
    etapa('3. Malha e rolos');
    fireEvent.click(screen.getByLabelText(/Rolos do estoque/));
    fireEvent.click(screen.getByLabelText('Usar o rolo R1'));
    fireEvent.click(screen.getByLabelText('Usar o rolo R2'));
    etapa('4. Risco e enfesto');
    fireEvent.click(screen.getByRole('button', { name: 'Calcular as alternativas' }));
    expect(await screen.findByText(/Nenhuma composição calcula/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Os rolos escolhidos são de 2 lotes/tonalidades diferentes (L1 · A; L2 · A)');
    etapa('3. Malha e rolos');
    fireEvent.click(screen.getByLabelText(/Misturar lotes\/tonalidades neste plano/));
    etapa('5. Alternativas');
    expect(screen.getByRole('table', { name: 'Alternativas (escolha uma)' })).toBeInTheDocument();
  });

  it('a ordem é guardada no cadastro, com o molde e a revisão; a grade colada é lida', async () => {
    const { onMudarCadastro } = abrir();
    etapa('2. Ordem');
    escrever('Código da ordem', 'OP-9');
    escrever(/Colar da planilha/, 'P\tM\n10\t20');
    fireEvent.click(screen.getByRole('button', { name: 'Ler a grade colada' }));
    expect(screen.getByText('Grade lida: 10 P, 20 M.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Guardar a ordem no cadastro' }));
    await waitFor(() => expect(onMudarCadastro).toHaveBeenCalled());
    const cadastro = onMudarCadastro.mock.calls[0]![0];
    expect(cadastro.ordens[0]).toMatchObject({ codigo: 'OP-9', quantidadesPorTamanho: { P: 10, M: 20 }, projetoId: 'p1', codigoDoMolde: 'ENF-1' });
  });
});

describe('PainelDePlanejamento — planos deste projeto', () => {
  it('o plano confirmado aparece com os valores de então; "Duplicar como novo" abre um rascunho a partir dele', async () => {
    // Faz e confirma um plano pela própria tela, e abre de novo com ele no projeto.
    const { onConfirmar } = abrir();
    preencherOrdemEMalha();
    etapa('4. Risco e enfesto');
    fireEvent.click(screen.getByRole('button', { name: 'Calcular as alternativas' }));
    await screen.findByRole('table', { name: 'Alternativas (escolha uma)' });
    fireEvent.click(screen.getByRole('button', { name: 'Revisar e confirmar esta alternativa' }));
    escrever(/Responsável/, 'Bruno');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar o plano' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sim, confirmar' }));
    const plano = onConfirmar.mock.calls[0]![0];
    cleanup();
    const projeto = confirmarPlano(PROJETO, plano, '2026-10-20T12:30:00.000Z');
    const { onGuardarRascunho } = abrir({ projeto });
    etapa('Planos deste projeto');
    fireEvent.click(screen.getByRole('button', { name: /^Confirmado — ordem OP-50/ }));
    expect(screen.getByText(/os valores são os de então, sem recalcular/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Duplicar como novo' }));
    expect(screen.getByText(/Plano novo a partir do de/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
    const copia = onGuardarRascunho.mock.calls[0]![0];
    expect(copia).toMatchObject({ situacao: 'rascunho', copiaDePlanoId: plano.id });
    expect(copia.id).not.toBe(plano.id);
  });
});

describe('PainelDePlanejamento — planos da primeira versão do cálculo', () => {
  it('continuam no projeto e aparecem como foram guardados', () => {
    const entrada = {
      molde: { projetoId: 'p1', codigo: 'ENF-1', nome: 'Camiseta', revisao: 3, impressaoDigital: 'antiga' },
      ordem: { codigo: 'OP-1', quantidadesPorTamanho: { M: 10 } },
      malha: { descricao: 'Malha antiga', larguraUtilMm: 1600, rendimentoMmPorG: 3, pesoDisponivelG: 100_000, tubular: false, sentidoUnico: false },
      rendimentoPrincipal: 'informado' as const,
      risco: { origem: 'informado' as const, comprimentoMm: 1000, larguraMm: 1500, gradePorTamanho: { M: 1 } },
      tipoDeEnfesto: 'impar' as const,
    };
    const calculo = calcularPlanoDeCorte(entrada);
    if (!calculo.ok) throw new Error('v1');
    const v1: PlanoDeCorte = {
      id: 'v1',
      criadoEmIso: '2026-10-19T10:00:00.000Z',
      responsavel: 'Ana',
      versaoDoCalculo: VERSAO_DO_CALCULO,
      entrada,
      configuracao: CONFIGURACAO_PADRAO_DO_PLANO,
      ajustes: [],
      resultado: calculo.resultado,
      alertas: calculo.alertas,
      premissas: calculo.premissas,
    };
    abrir({ projeto: { ...PROJETO, planosDeCorte: [v1] } });
    etapa('Planos deste projeto');
    fireEvent.click(screen.getByRole('button', { name: /Confirmado \(1ª versão do cálculo\) — ordem OP-1/ }));
    expect(screen.getByText(/Malha: Malha antiga/)).toBeInTheDocument();
    expect(screen.getByText('O molde mudou depois deste plano: os valores dele não valem para as peças de agora.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Duplicar como novo' })).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ponto } from '../core/geometria';
import { criarMolde, type Molde } from '../domain/molde';
import { criarProjeto, registrarRevisaoDoMolde, type Projeto } from '../domain/projeto';
import { CADASTRO_VAZIO, reservarPlano, salvarMalha, salvarRolo, type CadastroDeProducao, type RoloDeEstoque } from '../domain/cadastroDeProducao';
import { CONFIGURACAO_PADRAO_DO_PLANEJAMENTO } from '../domain/planoDeEnfesto';
import { executarBusca } from '../domain/buscaDeRiscos';
import { confirmarPlano, type PlanoDeCorteV2 } from '../domain/planejamento';
import { calcularPlanoDeCorte, CONFIGURACAO_PADRAO_DO_PLANO, escreverM, impressaoDigitalDoMolde, VERSAO_DO_CALCULO, type PlanoDeCorte } from '../domain/planoDeCorte';
import { criarTecido } from '../domain/tecido';
import { PainelDePlanejamento, type BuscarRiscos, type PainelDePlanejamentoProps } from './PainelDePlanejamento';
import type { AcessoAPastaDeTroca } from '../domain/trocaComOErp';

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

describe('PainelDePlanejamento — importar ordens (CSV)', () => {
  const csv = (texto: string, nome = 'ordens.csv') => new File([texto], nome, { type: 'text/csv' });
  const importar = (arquivo: File) => fireEvent.change(screen.getByLabelText('Arquivo CSV das ordens'), { target: { files: [arquivo] } });

  it('o arquivo certo: as ordens entram no cadastro ligadas a este molde, e a primeira vem para o formulário', async () => {
    const { onMudarCadastro } = abrir();
    etapa('2. Ordem');
    importar(csv('codigo;produto;cor;prazo;P;M\nOP-1;Camiseta;Azul;30/11/2026;10;20\nOP-2;Camiseta;Preta;;5;\n'));
    await waitFor(() => expect(onMudarCadastro).toHaveBeenCalledTimes(1));
    const cadastro = onMudarCadastro.mock.calls[0]![0];
    expect(cadastro.ordens.map((o) => o.codigo)).toEqual(['OP-1', 'OP-2']);
    expect(cadastro.ordens[0]).toMatchObject({ produto: 'Camiseta', cor: 'Azul', prazo: '2026-11-30', quantidadesPorTamanho: { P: 10, M: 20 }, projetoId: 'p1', codigoDoMolde: 'ENF-1' });
    // O tamanho vazio vale 0 (não entra na ordem).
    expect(cadastro.ordens[1]!.quantidadesPorTamanho).toEqual({ P: 5 });
    expect(await screen.findByText('2 ordem(ns) importada(s) de ordens.csv: OP-1, OP-2.')).toBeInTheDocument();
    expect(screen.getByLabelText('Código da ordem')).toHaveValue('OP-1');
  });

  it('com um erro numa linha, nenhuma ordem entra, e o erro diz a linha', async () => {
    const { onMudarCadastro } = abrir();
    etapa('2. Ordem');
    importar(csv('codigo;P;M\nOP-1;10;0\nOP-2;abc;0\n', 'errado.csv'));
    expect(await screen.findByText(/O arquivo errado.csv não foi importado \(nenhuma ordem entrou\)/)).toBeInTheDocument();
    expect(screen.getByText('Linha 3: a quantidade do tamanho P ("abc") não é um número inteiro.')).toBeInTheDocument();
    expect(onMudarCadastro).not.toHaveBeenCalled();
  });

  it('o formato está na tela, e diz que nenhum ERP está ligado', () => {
    abrir();
    etapa('2. Ordem');
    expect(screen.getByText(/codigo;produto;cor;prazo;P;M/)).toBeInTheDocument();
    expect(screen.getByText(/Nenhum ERP está ligado/)).toBeInTheDocument();
  });
});

describe('PainelDePlanejamento — as etiquetas dos feixes (ADR 0159)', () => {
  it('a ordem do formulário vira etiquetas, pelo tamanho do feixe; sem ordem completa, diz o que falta', async () => {
    const onSalvarTexto = vi.fn(async (nome: string) => `C:\\saida\\${nome}`);
    abrir({ onSalvarTexto });
    etapa('2. Ordem');
    fireEvent.click(screen.getByRole('button', { name: /Salvar a lista \(CSV\)/ }));
    expect(await screen.findByText(/Complete a ordem antes das etiquetas/)).toBeInTheDocument();
    escrever('Código da ordem', 'OP-50');
    escrever('P', '30', secao('Ordem de produção'));
    escrever('Roupas por feixe', '10');
    fireEvent.click(screen.getByRole('button', { name: /Salvar as etiquetas \(HTML/ }));
    expect(await screen.findByText(/3 etiqueta\(s\) de feixe salvas em/)).toBeInTheDocument();
    expect(onSalvarTexto.mock.calls[0]![0]).toBe('etiquetas-OP-50.html');
  });
});

describe('PainelDePlanejamento — a troca com o ERP por uma pasta (ADR 0141)', () => {
  /** Uma pasta na memória, com o arquivo do ERP na entrada. */
  function pastaNaMemoria(): AcessoAPastaDeTroca & { readonly pastas: Map<string, Map<string, string>> } {
    const pastas = new Map<string, Map<string, string>>(['entrada', 'processados', 'com-erro', 'saida'].map((s) => [s, new Map()]));
    pastas.get('entrada')!.set('ENF-1_ordens.csv', 'codigo;P;M\nOP-70;4;6\n');
    let onde: string | null = null;
    return {
      pastas,
      onde: async () => onde,
      escolher: async () => (onde = 'C:\\troca'),
      esquecer: async () => {
        onde = null;
        return true;
      },
      listar: async (sub) => [...pastas.get(sub)!.keys()].map((nome) => ({ nome })),
      ler: async (sub, nome) => pastas.get(sub)!.get(nome) ?? null,
      gravar: async (sub, nome, texto) => {
        pastas.get(sub)!.set(nome, texto);
        return true;
      },
      mover: async (de, nome, para, novoNome) => {
        const texto = pastas.get(de)!.get(nome);
        if (texto === undefined) return false;
        pastas.get(de)!.delete(nome);
        pastas.get(para)!.set(novoNome, texto);
        return true;
      },
    };
  }

  it('sem a pasta (fora do programa), a troca não aparece', () => {
    abrir();
    etapa('2. Ordem');
    expect(screen.queryByText('Troca com o ERP (pasta)')).toBeNull();
  });

  it('escolhe a pasta, troca: a ordem do molde entra, o arquivo vai para processados e a saída é gravada', async () => {
    const pasta = pastaNaMemoria();
    const { onMudarCadastro } = abrir({ pastaDoErp: pasta });
    etapa('2. Ordem');
    expect(screen.getByText('Nenhuma pasta escolhida.', { exact: false })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trocar com o ERP agora' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Escolher a pasta…' }));
    expect(await screen.findByText('C:\\troca')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Trocar com o ERP agora' }));
    await waitFor(() => expect(onMudarCadastro).toHaveBeenCalledTimes(1));
    expect(onMudarCadastro.mock.calls[0]![0].ordens[0]).toMatchObject({ codigo: 'OP-70', quantidadesPorTamanho: { P: 4, M: 6 }, codigoDoMolde: 'ENF-1' });
    expect(await screen.findByText(/1 ordem\(ns\) importada\(s\) do ERP \(ENF-1_ordens.csv\): OP-70\. Saída para o ERP gravada: ordens.csv/)).toBeInTheDocument();
    expect([...pasta.pastas.get('processados')!.keys()]).toEqual(['2026-10-20-12-00-00_ENF-1_ordens.csv']);
    expect(pasta.pastas.get('saida')!.get('ordens.csv')).toContain('OP-70');
    fireEvent.click(screen.getByRole('button', { name: 'Deixar de usar a pasta' }));
    expect(await screen.findByText(/deixou de ser usada/)).toBeInTheDocument();
  });

  it('as ordens de outro molde da biblioteca (ADR 0154) entram no projeto dele', async () => {
    const pasta = pastaNaMemoria();
    pasta.pastas.get('entrada')!.clear();
    pasta.pastas.get('entrada')!.set('ENF-2_ordens.csv', 'codigo;P;M\nOP-80;1;1\n');
    const outro = criarProjeto('Outra', 'p2', 'ENF-2', '2026-10-20T09:00:00.000Z', { pecas: PECAS, tecido: null, enfesto: null });
    const { onMudarCadastro } = abrir({ pastaDoErp: pasta, projetosDaBiblioteca: [PROJETO, outro] });
    etapa('2. Ordem');
    fireEvent.click(screen.getByRole('button', { name: 'Escolher a pasta…' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Trocar com o ERP agora' }));
    await waitFor(() => expect(onMudarCadastro).toHaveBeenCalledTimes(1));
    expect(onMudarCadastro.mock.calls[0]![0].ordens[0]).toMatchObject({ codigo: 'OP-80', projetoId: 'p2', codigoDoMolde: 'ENF-2' });
  });

  it('a troca sozinha (ADR 0151): ligada, o arquivo que chega entra sem clicar', async () => {
    const pasta = pastaNaMemoria();
    const { onMudarCadastro } = abrir({ pastaDoErp: pasta, intervaloDaTrocaMs: 20 });
    etapa('2. Ordem');
    fireEvent.click(screen.getByRole('button', { name: 'Escolher a pasta…' }));
    fireEvent.click(await screen.findByLabelText(/Trocar sozinho/));
    await waitFor(() => expect(onMudarCadastro).toHaveBeenCalledTimes(1));
    expect(pasta.pastas.get('processados')!.size).toBe(1);
    fireEvent.click(screen.getByLabelText(/Trocar sozinho/));
  });

  it('o arquivo com erro: nenhuma ordem entra, o erro aparece e o arquivo vai para com-erro', async () => {
    const pasta = pastaNaMemoria();
    pasta.pastas.get('entrada')!.set('ENF-1_ordens.csv', 'codigo;P;XG\nOP-71;1;1\n');
    const { onMudarCadastro } = abrir({ pastaDoErp: pasta });
    etapa('2. Ordem');
    fireEvent.click(screen.getByRole('button', { name: 'Escolher a pasta…' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Trocar com o ERP agora' }));
    expect(await screen.findByText('Arquivos recusados (nenhuma ordem deles entrou):')).toBeInTheDocument();
    expect(screen.getByText(/ENF-1_ordens.csv: .*XG/)).toBeInTheDocument();
    expect(onMudarCadastro).not.toHaveBeenCalled();
    expect([...pasta.pastas.get('com-erro')!.keys()]).toHaveLength(2);
  });
});

describe('PainelDePlanejamento — defeitos, estoque, emendas', () => {
  const MALHA = { id: 'm1', descricao: 'Algodão', larguraUtilMm: 1600, rendimentoMmPorG: 4, tubular: false, sentidoUnico: false, padrao: 'liso' as const, encolhimentoCompensadoNoMolde: false };
  const rolo = (id: string, extras: Partial<RoloDeEstoque> = {}): RoloDeEstoque => ({
    id,
    malhaId: 'm1',
    identificacao: id.toUpperCase(),
    comprimentoMedidoMm: 50_000,
    lote: 'L1',
    tonalidade: 'A',
    defeitos: [],
    unidadeDoPeso: 'kg',
    unidadeDoComprimento: 'm',
    indisponivel: false,
    ...extras,
  });
  const comRolo = (r: RoloDeEstoque) => salvarRolo(salvarMalha(CADASTRO_VAZIO, MALHA), r);
  function ordemERolos(...rolos: string[]) {
    etapa('2. Ordem');
    escrever('Código da ordem', 'OP-7');
    escrever('P', '2', secao('Ordem de produção'));
    etapa('3. Malha e rolos');
    fireEvent.click(screen.getByLabelText(/Rolos do estoque/));
    for (const r of rolos) fireEvent.click(screen.getByLabelText(`Usar o rolo ${r}`));
  }
  async function calcularEConfirmar(chamadas: ReturnType<typeof abrir>) {
    etapa('4. Risco e enfesto');
    fireEvent.click(screen.getByRole('button', { name: 'Calcular as alternativas' }));
    await screen.findByRole('table', { name: 'Alternativas (escolha uma)' });
    fireEvent.click(screen.getByRole('button', { name: 'Revisar e confirmar esta alternativa' }));
    escrever(/Responsável/, 'Bruno');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar o plano' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sim, confirmar' }));
    return chamadas.onConfirmar.mock.calls[0]![0];
  }

  it('o rolo com defeito sem posição: o plano não sai sem a decisão, e a decisão vai no plano', async () => {
    const chamadas = abrir({ cadastro: comRolo(rolo('r1', { defeitos: [{ descricao: 'mancha', perdaMm: 500 }] })) });
    ordemERolos('R1');
    expect(screen.getByText(/mancha: 0,50 m \(sem posição\)/)).toBeInTheDocument();
    etapa('4. Risco e enfesto');
    fireEvent.click(screen.getByRole('button', { name: 'Calcular as alternativas' }));
    expect(await screen.findByText(/Nenhuma composição calcula/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Os rolos R1 têm defeito sem a posição: o plano não tem como evitá-lo');
    etapa('3. Malha e rolos');
    fireEvent.click(screen.getByLabelText(/Usar os rolos com defeito sem posição \(R1\)/));
    const plano = await calcularEConfirmar(chamadas);
    expect(plano.entrada.aceitarDefeitosSemPosicao).toBe(true);
    expect(plano.alertas.map((a) => a.texto).join(' ')).toContain('Defeitos sem posição (rolos R1)');
  });

  it('o defeito com posição aparece com o tipo e a posição, e o plano não pede decisão', async () => {
    const chamadas = abrir({ cadastro: comRolo(rolo('r1', { defeitos: [{ descricao: 'furo', perdaMm: 300, posicaoMm: 12_000, larguraAfetadaMm: 40, tipo: 'furo' }] })) });
    ordemERolos('R1');
    expect(screen.getByText('Furo: 0,30 m a 12,00 m do começo, 4,0 cm de largura')).toBeInTheDocument();
    expect(screen.queryByLabelText(/Usar os rolos com defeito sem posição/)).toBeNull();
    const plano = await calcularEConfirmar(chamadas);
    expect(plano.entrada.aceitarDefeitosSemPosicao).toBeUndefined();
    expect(plano.entrada.rolos![0]!.defeitos[0]).toMatchObject({ posicaoMm: 12_000 });
  });

  it('o que outro plano reservou do rolo aparece na tabela e entra no cálculo (o plano começa depois dele)', async () => {
    const reservado = reservarPlano(comRolo(rolo('r1')), [{ roloId: 'r1', comprimentoMm: 20_000 }], {
      planoId: 'outro',
      projetoId: 'p9',
      responsavel: 'Ana',
      agoraIso: '2026-10-20T08:00:00.000Z',
      novoId: () => 'mov-x',
    }).cadastro;
    const chamadas = abrir({ cadastro: reservado });
    ordemERolos('R1');
    expect(screen.getByText('30,00 m / 20,00 m / 0,00 m')).toBeInTheDocument();
    const plano = await calcularEConfirmar(chamadas);
    expect(plano.entrada.usoAnteriorDosRolosMm).toEqual({ r1: 20_000 });
    expect(plano.resultado.rolos![0]).toMatchObject({ jaUsadoMm: 20_000 });
  });

  it('as emendas: só com a configuração ligada, e a sobreposição em cm na tela vai em mm para o plano', async () => {
    const chamadas = abrir({ cadastro: comRolo(rolo('r1')) });
    ordemERolos('R1');
    etapa('4. Risco e enfesto');
    fireEvent.click(screen.getByLabelText(/permite emendar uma camada/));
    escrever('Sobreposição da emenda (cm)', '15');
    const plano = await calcularEConfirmar(chamadas);
    expect(plano.configuracao).toMatchObject({ permitirEmendas: true, sobreposicaoDaEmendaMm: 150 });
  });

  it('o plano confirmado com rolos: o estoque dele se reserva pela tela, com quem faz informado', async () => {
    const cadastro = comRolo(rolo('r1'));
    const plano = await calcularEConfirmar((() => {
      const c = abrir({ cadastro });
      ordemERolos('R1');
      return c;
    })());
    cleanup();
    const { onMudarCadastro } = abrir({ projeto: confirmarPlano(PROJETO, plano, '2026-10-20T12:30:00.000Z'), cadastro });
    etapa('Planos deste projeto');
    fireEvent.click(screen.getByRole('button', { name: /^Confirmado — ordem OP-7/ }));
    expect(screen.getByRole('table', { name: 'Estoque dos rolos do plano' })).toHaveTextContent(escreverM(plano.resultado.rolos![0]!.usadoMm));
    fireEvent.change(screen.getByLabelText(/Quem faz o movimento/), { target: { value: 'Carla' } });
    fireEvent.click(screen.getByRole('button', { name: 'Reservar os rolos do plano' }));
    await waitFor(() => expect(onMudarCadastro).toHaveBeenCalledTimes(1));
    expect(onMudarCadastro.mock.calls[0]![0].movimentos).toEqual([
      expect.objectContaining({ tipo: 'reserva', roloId: 'r1', planoId: plano.id, projetoId: 'p1', comprimentoMm: plano.resultado.rolos![0]!.usadoMm, responsavel: 'Carla' }),
    ]);
    expect(await screen.findByText('Reservado: R1.')).toBeInTheDocument();
  });
});

describe('PainelDePlanejamento — encolhimento e casamento', () => {
  it('o encolhimento: a prévia mostra antes e depois; só compensa com a confirmação; o risco sai aumentado e o plano diz', async () => {
    const { onConfirmar } = abrir();
    preencherOrdemEMalha();
    escrever('Encolhimento no comprimento (%)', '5');
    etapa('4. Risco e enfesto');
    expect(screen.getByText(/Encolhimento da malha: 5,0% no comprimento e 0,0% na largura, NÃO/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ver a prévia da compensação no risco' }));
    const previa = screen.getByRole('table', { name: /Prévia: as peças antes e depois/ });
    expect(within(previa).getAllByRole('row').length).toBeGreaterThan(1);
    fireEvent.click(screen.getByRole('button', { name: 'Não compensar' }));
    expect(screen.queryByRole('table', { name: /Prévia/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ver a prévia da compensação no risco' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar a compensação ao risco' }));
    expect(screen.getByText(/Compensação aplicada ao risco: comprimento × 1,0526, largura × 1,0000/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Calcular as alternativas' }));
    await screen.findByRole('table', { name: 'Alternativas (escolha uma)' });
    fireEvent.click(screen.getByRole('button', { name: 'Revisar e confirmar esta alternativa' }));
    escrever(/Responsável/, 'Bruno');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar o plano' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sim, confirmar' }));
    const plano = onConfirmar.mock.calls[0]![0];
    expect(plano.entrada.compensarEncolhimento).toBe(true);
    expect(plano.riscos.every((r) => r.compensado !== undefined && Math.abs(r.compensado.comprimento - 1 / 0.95) < 1e-9 && r.compensado.largura === 1)).toBe(true);
    expect(plano.alertas.map((a) => a.texto).join(' ')).toContain('Encolhimento compensado no risco, por decisão de quem planeja');
  });

  it('com o encolhimento já compensado no molde, não oferece compensar de novo', () => {
    abrir();
    preencherOrdemEMalha();
    escrever('Encolhimento no comprimento (%)', '5');
    fireEvent.click(screen.getByLabelText(/O encolhimento já está compensado no molde/));
    etapa('4. Risco e enfesto');
    expect(screen.getByText(/compensar no risco também o aplicaria duas vezes/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver a prévia da compensação no risco' })).toBeNull();
  });

  it('com encolhimento na malha e a compensação não aplicada, o plano não compensa nada, e avisa', async () => {
    const { onConfirmar } = abrir();
    preencherOrdemEMalha();
    escrever('Encolhimento no comprimento (%)', '5');
    etapa('4. Risco e enfesto');
    fireEvent.click(screen.getByRole('button', { name: 'Calcular as alternativas' }));
    await screen.findByRole('table', { name: 'Alternativas (escolha uma)' });
    fireEvent.click(screen.getByRole('button', { name: 'Revisar e confirmar esta alternativa' }));
    escrever(/Responsável/, 'Bruno');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar o plano' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sim, confirmar' }));
    const plano = onConfirmar.mock.calls[0]![0];
    expect(plano.entrada.compensarEncolhimento).toBeUndefined();
    expect(plano.riscos.every((r) => r.compensado === undefined)).toBe(true);
    expect(plano.alertas.map((a) => a.texto).join(' ')).toContain('NÃO compensado no molde, e o plano não o aplica');
  });

  it('com encolhimento na largura, os riscos são buscados na largura da malha dividida pelo fator (para caberem depois de aumentados)', async () => {
    const larguras: number[] = [];
    const buscar: BuscarRiscos = (pedidos, opcoes, aoProgredir) => {
      larguras.push(opcoes.larguraMm);
      return buscarAqui(pedidos, opcoes, aoProgredir);
    };
    const { onConfirmar } = abrir({ buscarRiscos: buscar });
    preencherOrdemEMalha();
    escrever('Encolhimento na largura (%)', '4');
    etapa('4. Risco e enfesto');
    fireEvent.click(screen.getByRole('button', { name: 'Ver a prévia da compensação no risco' }));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar a compensação ao risco' }));
    fireEvent.click(screen.getByRole('button', { name: 'Calcular as alternativas' }));
    await screen.findByRole('table', { name: 'Alternativas (escolha uma)' });
    expect(larguras).toHaveLength(1);
    expect(larguras[0]).toBeCloseTo(1600 * 0.96, 6);
    fireEvent.click(screen.getByRole('button', { name: 'Revisar e confirmar esta alternativa' }));
    escrever(/Responsável/, 'Bruno');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar o plano' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sim, confirmar' }));
    const plano = onConfirmar.mock.calls[0]![0];
    for (const r of plano.riscos) {
      expect(r.larguraDoRiscoMm).toBe(1600);
      expect(Math.max(...r.pecas.flatMap((p) => p.contorno.map((q) => q.x)))).toBeLessThanOrEqual(1600 + 0.01);
    }
  });

  it('listras: sem a repetição, o casamento não é automático; com ela, diz as peças sem a marca; com as marcas, o risco casa', async () => {
    const marca = { id: 'mc', posicao: ponto(20, 20), rotulo: 'casamento' };
    const marcadas = PECAS.map((p) => ({ ...p, marcas: [marca] }));
    abrir();
    preencherOrdemEMalha();
    fireEvent.change(screen.getByLabelText('Padrão'), { target: { value: 'listrado' } });
    etapa('4. Risco e enfesto');
    expect(screen.getByText(/Falta a repetição do desenho no cadastro da malha/)).toBeInTheDocument();
    etapa('3. Malha e rolos');
    escrever('Repetição do desenho no comprimento (cm)', '10');
    etapa('4. Risco e enfesto');
    const nota = screen.getByText(/O risco vai casar o desenho/);
    expect(nota).toHaveTextContent('na repetição de 10 cm no comprimento');
    expect(nota).toHaveTextContent(/Faltam a marca "casamento" em: .*Frente/);
    expect(nota).toHaveTextContent(/Faltam a marca "casamento" em: .*Bolso/);
    cleanup();
    const { onConfirmar } = abrir({ pecas: marcadas, projeto: criarProjeto('Camiseta', 'p1', 'ENF-1', '2026-10-20T09:00:00.000Z', { pecas: marcadas, tecido: null, enfesto: null }) });
    preencherOrdemEMalha();
    fireEvent.change(screen.getByLabelText('Padrão'), { target: { value: 'listrado' } });
    escrever('Repetição do desenho no comprimento (cm)', '10');
    etapa('4. Risco e enfesto');
    expect(screen.getByText(/O risco vai casar o desenho/)).not.toHaveTextContent('Faltam a marca');
    fireEvent.click(screen.getByRole('button', { name: 'Calcular as alternativas' }));
    await screen.findByRole('table', { name: 'Alternativas (escolha uma)' });
    fireEvent.click(screen.getByRole('button', { name: 'Revisar e confirmar esta alternativa' }));
    escrever(/Responsável/, 'Bruno');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar o plano' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sim, confirmar' }));
    const plano = onConfirmar.mock.calls[0]![0];
    expect(plano.entrada.aceitarPadraoSemCasamento).toBeFalsy();
    expect(plano.riscos.every((r) => r.casamento?.conferido === true && r.casamento.rapportComprimentoMm === 100)).toBe(true);
  });

  it('as limitações conhecidas estão na janela', () => {
    abrir();
    expect(screen.getByText('Limitações conhecidas')).toBeInTheDocument();
    expect(screen.getByText(/Login: o programa não tem/)).toBeInTheDocument();
    expect(screen.getByText(/Custo: uma estimativa só do tecido/)).toBeInTheDocument();
  });
});

describe('PainelDePlanejamento — o custo do tecido', () => {
  /** Faz o plano pela tela (a primeira alternativa) e o confirma; devolve o plano e o texto do custo na revisão. */
  async function confirmarUmPlano(extras: Partial<PainelDePlanejamentoProps> = {}) {
    const { onConfirmar } = abrir(extras);
    preencherOrdemEMalha();
    etapa('4. Risco e enfesto');
    fireEvent.click(screen.getByRole('button', { name: 'Calcular as alternativas' }));
    await screen.findByRole('table', { name: 'Alternativas (escolha uma)' });
    const naAlternativa = screen.getByRole('region', { name: 'Custo do tecido' }).textContent;
    fireEvent.click(screen.getByRole('button', { name: 'Revisar e confirmar esta alternativa' }));
    const naRevisao = screen.getByRole('region', { name: 'Custo do tecido' }).textContent;
    escrever(/Responsável/, 'Bruno');
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar o plano' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sim, confirmar' }));
    const plano = onConfirmar.mock.calls[0]![0];
    cleanup();
    return { plano, naAlternativa, naRevisao };
  }

  it('na malha, o tipo de tecido é escolhido (não informado, ramado ou tubular) e o custo vem com a unidade; o "Malha tubular" saiu', () => {
    abrir();
    etapa('3. Malha e rolos');
    expect(screen.queryByRole('checkbox', { name: 'Malha tubular' })).toBeNull();
    const tipo = screen.getByLabelText('Tipo de tecido') as HTMLSelectElement;
    expect([...tipo.options].map((o) => o.textContent)).toEqual(['Não informado', 'Ramado (aberto)', 'Tubular']);
    expect(tipo.value).toBe('');
    const unidade = screen.getByLabelText('Unidade do custo') as HTMLSelectElement;
    expect([...unidade.options].map((o) => o.textContent)).toEqual(['(escolha)', 'por metro linear (R$/m)', 'por quilo (R$/kg)']);
    escrever('Descrição da malha', 'Malha');
    escrever('Largura útil (m)', '1,6');
    escrever('Custo da malha (R$, opcional)', '-3');
    etapa('4. Risco e enfesto');
    expect(screen.getByRole('alert')).toHaveTextContent('O custo do tecido não pode ser negativo.');
  });

  it('sem custo, o plano sai como antes; com o custo do tecido do projeto, sai o mesmo plano — e a estimativa vai guardada com ele', async () => {
    const sem = await confirmarUmPlano();
    expect(sem.plano.entrada.malha).not.toHaveProperty('custo');
    expect(sem.naRevisao).toContain('Custo informado: Não informado.');
    expect(sem.naRevisao).not.toContain('R$ 0,00');
    expect(sem.plano.custoDoTecido).toMatchObject({ custoInformado: null, custoTotal: null, custoMedioPorUnidade: null });
    expect(sem.plano.custoDoTecido!.faltas[0]).toContain('O custo do tecido não foi informado');

    // O tecido do projeto, ramado, a R$ 32,50 o metro: o planejamento já o traz na malha.
    const tecido = criarTecido({ nome: 'Malha teste', referencia: 'M1', larguraTotalMm: 1600, larguraUtilMm: 1600, tipoDeTecido: 'ramado', custo: { valor: 32.5, unidade: 'metro-linear', moeda: 'BRL' } }, 't1');
    const com = await confirmarUmPlano({ tecidoDoProjeto: tecido });
    expect(com.plano.entrada.malha).toMatchObject({ tubular: false, tipoDeTecido: 'ramado', custo: { valor: 32.5, unidade: 'metro-linear', moeda: 'BRL' } });
    // O custo não mexe no plano: o consumo, as camadas e a produção são os mesmos.
    expect(com.plano.resultado).toEqual(sem.plano.resultado);
    expect(com.naAlternativa).toContain('Custo informado: R$ 32,50 por metro linear (R$/m).');
    expect(com.naRevisao).toContain('Tipo de tecido: Ramado (aberto).');

    const e = com.plano.custoDoTecido!;
    expect(e.faltas).toEqual([]);
    // As roupas: no P, a frente de 400 × 600 mm e o bolso de 150 × 150; no M, a frente de 420 × 620 e o bolso.
    expect(e.porTamanho.map((t) => [t.tamanho, t.areaPorUnidadeMm2])).toEqual([
      ['P', 262_500],
      ['M', 282_900],
    ]);
    expect(e.custoTotal).toBeCloseTo((com.plano.resultado.consumoMm / 1000) * 32.5, 9);
    expect(e.custoPorM2).toBeCloseTo(32.5 / 1.6, 9);
    expect(e.unidadesProduzidas).toBe(4);
    expect(e.custoMedioPorUnidade).toBeCloseTo(e.custoTotal! / 4, 9);
  });

  it('o plano confirmado mostra a estimativa de então; o plano de antes dela diz que não a tem (e não é recalculado)', async () => {
    const tecido = criarTecido({ nome: 'Malha teste', referencia: 'M1', larguraTotalMm: 1600, larguraUtilMm: 1600, custo: { valor: 40, unidade: 'metro-linear', moeda: 'BRL' } }, 't1');
    const { plano } = await confirmarUmPlano({ tecidoDoProjeto: tecido });
    // Um plano como os guardados antes da estimativa: sem ela.
    const antigo: { -readonly [K in keyof PlanoDeCorteV2]: PlanoDeCorteV2[K] } = { ...plano };
    delete antigo.custoDoTecido;
    const projeto = confirmarPlano(confirmarPlano(PROJETO, plano, '2026-10-20T12:30:00.000Z'), { ...antigo, id: 'antigo', entrada: { ...antigo.entrada, ordem: { ...antigo.entrada.ordem, codigo: 'OP-49' } } }, '2026-10-20T12:31:00.000Z');
    abrir({ projeto, tecidoDoProjeto: tecido });
    etapa('Planos deste projeto');
    fireEvent.click(screen.getByRole('button', { name: /^Confirmado — ordem OP-50/ }));
    expect(screen.getByRole('region', { name: 'Custo do tecido' })).toHaveTextContent('Custo informado: R$ 40,00 por metro linear (R$/m).');
    fireEvent.click(screen.getByRole('button', { name: /^Confirmado — ordem OP-50/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Confirmado — ordem OP-49/ }));
    expect(screen.getByRole('region', { name: 'Custo do tecido' })).toHaveTextContent('Este plano é de antes da estimativa de custo do tecido');
  });
});

describe('PainelDePlanejamento — os campos e as etapas na tela', () => {
  it('o obrigatório é marcado; o erro do campo aparece junto dele depois de visitado, e some quando corrigido', () => {
    abrir();
    etapa('2. Ordem');
    const codigo = screen.getByLabelText('Código da ordem');
    expect(codigo).toHaveAttribute('aria-required', 'true');
    expect(screen.getByLabelText('Produto')).not.toHaveAttribute('aria-required');
    // Antes de passar pelo campo, nada de vermelho nele (a lista "falta" da etapa já diz o que falta).
    expect(codigo).not.toHaveAttribute('aria-invalid');
    fireEvent.blur(codigo);
    expect(codigo).toHaveAttribute('aria-invalid', 'true');
    expect(codigo).toHaveAccessibleDescription('Preencha "Código da ordem".');
    escrever('Código da ordem', 'OP-9');
    expect(codigo).not.toHaveAttribute('aria-invalid');
    expect(codigo).not.toHaveAccessibleDescription();
  });

  it('as etapas mostram o estado (dados completos ou falta dado) na dica, sem mudar o nome do botão', () => {
    abrir();
    expect(screen.getByRole('button', { name: '1. Molde' })).toHaveAttribute('title', 'Etapa com os dados completos');
    expect(screen.getByRole('button', { name: '2. Ordem' })).toHaveAttribute('title', 'Falta dado nesta etapa (a lista está nela)');
    preencherOrdemEMalha();
    expect(screen.getByRole('button', { name: '2. Ordem' })).toHaveAttribute('title', 'Etapa com os dados completos');
    expect(screen.getByRole('button', { name: '3. Malha e rolos' })).toHaveAttribute('title', 'Etapa com os dados completos');
    expect(screen.getByRole('button', { name: '6. Revisar e confirmar' })).not.toHaveAttribute('title');
  });

  it('o risco informado sem a largura: a mensagem cita o campo certo, "Largura ocupada do risco (m)"', () => {
    abrir();
    preencherOrdemEMalha();
    etapa('4. Risco e enfesto');
    fireEvent.click(screen.getByLabelText(/Informar um risco existente/));
    escrever('Comprimento do risco (m)', '1,3');
    expect(screen.getByRole('alert')).toHaveTextContent('Preencha "Largura ocupada do risco (m)".');
  });

  it('uma ação principal por etapa: o Seguir nas primeiras, o Calcular na etapa 4', () => {
    abrir();
    expect(screen.getByRole('button', { name: 'Seguir' })).toHaveClass('botao-primario');
    preencherOrdemEMalha();
    etapa('4. Risco e enfesto');
    expect(screen.getByRole('button', { name: 'Calcular as alternativas' })).toHaveClass('botao-primario');
    expect(screen.getByRole('button', { name: 'Seguir' })).not.toHaveClass('botao-primario');
  });
});

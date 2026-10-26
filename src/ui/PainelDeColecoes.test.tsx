import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { COLECOES_VAZIAS, novaColecao, novoModelo, salvarColecao, salvarModelo, type ArquivoDeColecoes } from '../domain/colecoes';
import { criarProjeto, definirFichaTecnica } from '../domain/projeto';
import { definirDesenhoDaFicha, novaFichaTecnica } from '../domain/fichaTecnica';
import { adicionarElemento, DESENHO_VAZIO, tracosDaBase } from '../domain/desenhoTecnico';
import { PainelDeColecoes, type ParteDaColecao } from './PainelDeColecoes';

afterEach(() => cleanup());

const AGORA = '2026-10-24T10:00:00.000Z';
const HOJE = '2026-10-24';

function comUmaColecao(): ArquivoDeColecoes {
  let c = novaColecao({ nome: 'Verão 27', estacao: 'primavera-verao', ano: 2027, lancamento: '2027-01-15', responsavel: 'Ana' }, 'c1', AGORA);
  c = salvarModelo(c, novoModelo({ nome: 'Camiseta básica', referencia: 'CAM-01', categoria: 'Camiseta', cores: ['Branco'], tecido: 'Malha PV', responsavel: 'Bruno', prazo: '2026-10-20' }, 'm1'));
  c = salvarModelo(c, novoModelo({ nome: 'Bermuda', referencia: 'BER-01', categoria: 'Bermuda', cores: ['Preto'], etapa: 'aprovacao', responsavel: 'Carla', prazo: '2026-10-30' }, 'm2'));
  return salvarColecao(COLECOES_VAZIAS, c);
}

let n = 0;
function abrir(inicial: ArquivoDeColecoes, opcoes: { readonly parte?: ParteDaColecao; readonly comProjeto?: boolean } = {}) {
  const onAbrirProjeto = vi.fn();
  const onSalvarTexto = vi.fn(async () => 'C:/x/arquivo.csv');
  let projeto = criarProjeto('Camiseta (projeto)', 'p1', 'ENF-1', AGORA, { pecas: [], tecido: null, enfesto: null });
  projeto = definirFichaTecnica(projeto, definirDesenhoDaFicha(novaFichaTecnica({ nome: 'X', codigo: 'ENF-1', pecas: [] }, AGORA), adicionarElemento(DESENHO_VAZIO, tracosDaBase('camiseta', () => `d${++n}`)), AGORA), AGORA);
  function Tela(): React.JSX.Element {
    const [arquivo, setArquivo] = useState(inicial);
    return (
      <PainelDeColecoes
        arquivo={arquivo}
        avisos={[]}
        somenteLeitura={false}
        projetos={opcoes.comProjeto ? [projeto] : []}
        projetoAbertoId="p-aberto"
        hoje={HOJE}
        responsavelSugerido="Ana"
        {...(opcoes.parte ? { parteInicial: opcoes.parte } : {})}
        agoraIso={() => AGORA}
        novoId={() => `n${++n}`}
        onMudar={async (novo) => {
          setArquivo(novo);
          return null;
        }}
        onAbrirProjeto={onAbrirProjeto}
        onSalvarTexto={onSalvarTexto}
        onFechar={() => {}}
      />
    );
  }
  render(<Tela />);
  return { onAbrirProjeto, onSalvarTexto };
}

describe('PainelDeColecoes', () => {
  it('sem coleção: o que é; a coleção nova pelo formulário, com um marco', async () => {
    abrir(COLECOES_VAZIAS);
    expect(screen.getByText(/Nenhuma coleção ainda/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Nova coleção' }));
    fireEvent.change(screen.getByLabelText('Nome da coleção *'), { target: { value: 'Inverno 27' } });
    fireEvent.change(screen.getByLabelText('Estação'), { target: { value: 'outono-inverno' } });
    fireEvent.change(screen.getByLabelText('Lançamento'), { target: { value: '2027-04-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar marco' }));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar a coleção' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Coleção “Inverno 27” guardada.'));
    expect(within(screen.getByRole('complementary', { name: 'Coleções' })).getByText('Inverno 27')).toBeInTheDocument();
    expect(screen.getByText(/A coleção ainda não tem modelos/)).toBeInTheDocument();
  });

  it('o mix: os cartões com a etapa, o atraso, as cores; o resumo; o filtro; o CSV', async () => {
    const { onSalvarTexto } = abrir(comUmaColecao());
    const camiseta = screen.getByRole('button', { name: 'Modelo Camiseta básica' });
    expect(camiseta).toHaveTextContent('Criação');
    expect(camiseta).toHaveTextContent('20/10/2026 (atrasado)');
    expect(screen.getByText('Bermuda (1) · Camiseta (1)')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Etapa'), { target: { value: 'aprovacao' } });
    expect(screen.queryByRole('button', { name: 'Modelo Camiseta básica' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar o mix (CSV)' }));
    await waitFor(() => expect(onSalvarTexto).toHaveBeenCalled());
    expect((onSalvarTexto.mock.calls[0] as unknown as [string, string])[1]).toMatch(/^Modelo;Referência;Categoria/);
  });

  it('o modelo novo: os dados guardados (as cores com "#rrggbb" mostram a cor)', async () => {
    abrir(comUmaColecao());
    fireEvent.click(screen.getByRole('button', { name: 'Novo modelo' }));
    await waitFor(() => expect(screen.getByRole('region', { name: 'Modelo Modelo 3' })).toBeInTheDocument());
    fireEvent.change(screen.getByLabelText('Nome *'), { target: { value: 'Vestido midi' } });
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: 'Vestido' } });
    fireEvent.change(screen.getByLabelText(/^Cores/), { target: { value: '#c2185b, Off-white' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar o modelo' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Modelo guardado.'));
    fireEvent.click(screen.getByRole('button', { name: '← Voltar ao mix' }));
    const cartao = screen.getByRole('button', { name: 'Modelo Vestido midi' });
    expect(cartao).toHaveTextContent('#c2185bOff-white');
    expect(cartao.querySelector('.cor-do-modelo i')).not.toBeNull();
  });

  it('a peça-piloto: pedir alteração exige o comentário e volta na revisão 2; aprovar vai para a produção; o histórico', async () => {
    abrir(comUmaColecao());
    fireEvent.click(screen.getByRole('button', { name: 'Modelo Bermuda' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pedir alteração' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Diga o que alterar na piloto'));
    fireEvent.change(screen.getByLabelText(/^Comentário \(o motivo/), { target: { value: 'Encurtar 2 cm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pedir alteração' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Alteração pedida: a piloto volta, na revisão 2.'));
    expect(screen.getByText('Peça-piloto · peça-piloto rev. 2')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Avançar etapa' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aprovar a piloto' })).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar a piloto' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Peça-piloto (rev. 2) aprovada: o modelo foi para a produção.'));
    const historico = within(screen.getByRole('table', { name: 'Histórico das etapas' })).getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(historico).toEqual([
      expect.stringContaining('Aprovação → Produção (piloto rev. 2)Ana'),
      expect.stringContaining('Peça-piloto → AprovaçãoAna'),
      expect.stringContaining('Aprovação → Peça-piloto (piloto rev. 1)AnaEncurtar 2 cm'),
    ]);
  });

  it('o quadro das etapas: "Avançar →" leva o cartão para a coluna seguinte', async () => {
    abrir(comUmaColecao(), { parte: 'etapas' });
    expect(within(screen.getByLabelText('Etapa Criação')).getByText('Camiseta básica')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Avançar Camiseta básica' }));
    await waitFor(() => expect(within(screen.getByLabelText('Etapa Modelagem')).getByText('Camiseta básica')).toBeInTheDocument());
  });

  it('as tarefas: a nova (atrasada) aparece nos prazos; feita, sai deles', async () => {
    abrir(comUmaColecao());
    fireEvent.click(screen.getByRole('button', { name: 'Modelo Bermuda' }));
    fireEvent.change(screen.getByLabelText('Nova tarefa'), { target: { value: 'Comprar o zíper' } });
    fireEvent.change(screen.getByLabelText('Prazo da tarefa'), { target: { value: '2026-10-22' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pôr a tarefa' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Tarefa posta.'));
    fireEvent.click(screen.getByRole('button', { name: '← Voltar ao mix' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Tarefas e prazos' }));
    const linhas = () => within(screen.getByRole('table', { name: 'Prazos abertos' })).getAllByRole('row').slice(1).map((r) => r.textContent);
    expect(linhas()).toEqual([
      expect.stringContaining('20/10/2026atrasado 4 dia(s)BrunoCamiseta básicaEtapa: Criação'),
      expect.stringContaining('22/10/2026atrasado 2 dia(s)CarlaBermudaComprar o zíper'),
      expect.stringContaining('30/10/2026em 6 dia(s)CarlaBermudaEtapa: Aprovação'),
    ]);
    fireEvent.change(screen.getByLabelText('Pessoa'), { target: { value: 'Carla' } });
    expect(linhas()).toHaveLength(2);
    fireEvent.click(screen.getByLabelText('Feita: Comprar o zíper'));
    await waitFor(() => expect(linhas()).toHaveLength(1));
  });

  it('o andamento: os números, as barras e a linha do tempo com hoje', () => {
    abrir(comUmaColecao(), { parte: 'andamento' });
    const valor = (rotulo: string) => screen.getByText(rotulo, { selector: 'dt' }).nextElementSibling!.textContent;
    expect(valor('Modelos')).toBe('2');
    expect(valor('Prazos atrasados')).toBe('1');
    expect(valor('Lançamento')).toBe('em 83 dia(s)');
    expect(screen.getByRole('img', { name: 'Linha do tempo da coleção' })).toHaveTextContent('hoje');
    expect(document.querySelector('.lista-da-linha-do-tempo')).toHaveTextContent('15/01/2027 — Lançamento');
  });

  it('o projeto ligado mostra o croqui da ficha (no detalhe e no cartão) e se abre', async () => {
    const { onAbrirProjeto } = abrir(comUmaColecao(), { comProjeto: true });
    fireEvent.click(screen.getByRole('button', { name: 'Modelo Camiseta básica' }));
    fireEvent.change(screen.getByLabelText('Projeto ligado'), { target: { value: 'p1' } });
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Projeto ligado ao modelo.'));
    expect(screen.getByRole('img', { name: 'Croqui de Camiseta (projeto)' })).toBeInTheDocument();
    expect(screen.getByText(/Ficha técnica: Rascunho, versão 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Abrir o projeto' }));
    expect(onAbrirProjeto).toHaveBeenCalledWith('p1');
    fireEvent.click(screen.getByRole('button', { name: '← Voltar ao mix' }));
    expect(within(screen.getByRole('button', { name: 'Modelo Camiseta básica' })).getByRole('img', { name: 'Croqui de Camiseta (projeto)' })).toBeInTheDocument();
  });

  it('arquivar tira a coleção da lista (a não ser com "Mostrar as arquivadas")', async () => {
    abrir(comUmaColecao());
    fireEvent.click(screen.getByRole('button', { name: 'Arquivar' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Coleção arquivada.'));
    expect(within(screen.getByRole('complementary', { name: 'Coleções' })).queryByText('Verão 27')).toBeNull();
    fireEvent.click(screen.getByLabelText('Mostrar as arquivadas'));
    expect(within(screen.getByRole('complementary', { name: 'Coleções' })).getByText('Verão 27')).toBeInTheDocument();
  });
});

describe('PainelDeColecoes — arrastar o cartão entre as etapas (ADR 0118)', () => {
  const coluna = (nome: string) => screen.getByLabelText(`Etapa ${nome}`);
  /** Aperta no nome do cartão, passa pela coluna e solta nela. */
  const arrastar = (cartao: string, para: string, soltar = true): void => {
    fireEvent.pointerDown(screen.getByRole('button', { name: cartao }), { clientX: 10, clientY: 10, button: 0, pointerId: 1 });
    fireEvent.pointerMove(coluna(para), { clientX: 180, clientY: 30, pointerId: 1 });
    if (soltar) fireEvent.pointerUp(coluna(para), { clientX: 180, clientY: 30, pointerId: 1 });
  };

  it('para a coluna seguinte: avança; enquanto arrasta, a coluna que vale fica verde e diz o que faz, a outra apagada', async () => {
    abrir(comUmaColecao(), { parte: 'etapas' });
    arrastar('Camiseta básica', 'Modelagem', false);
    expect(coluna('Modelagem')).toHaveClass('destino-sob-o-cartao');
    expect(within(coluna('Modelagem')).getByText('Avançar')).toBeInTheDocument();
    expect(coluna('Cancelado')).toHaveClass('destino-valido');
    expect(coluna('Peça-piloto')).toHaveClass('destino-invalido');
    fireEvent.pointerUp(coluna('Modelagem'), { clientX: 180, clientY: 30, pointerId: 1 });
    await waitFor(() => expect(within(coluna('Modelagem')).getByText('Camiseta básica')).toBeInTheDocument());
    expect(screen.getByRole('alert')).toHaveTextContent('“Camiseta básica” foi para modelagem.');
    // O clique do fim do arrasto não abre o modelo.
    fireEvent.click(screen.getByRole('button', { name: 'Camiseta básica' }));
    expect(screen.queryByRole('button', { name: '← Voltar ao mix' })).toBeNull();
    // Um clique de verdade abre.
    fireEvent.click(screen.getByRole('button', { name: 'Camiseta básica' }));
    expect(screen.getByRole('button', { name: '← Voltar ao mix' })).toBeInTheDocument();
  });

  it('pular etapa não vale: o cartão fica onde estava', () => {
    abrir(comUmaColecao(), { parte: 'etapas' });
    arrastar('Camiseta básica', 'Peça-piloto');
    expect(within(coluna('Criação')).getByText('Camiseta básica')).toBeInTheDocument();
    expect(screen.queryByRole('form', { name: 'Mudança de etapa' })).toBeNull();
  });

  it('da aprovação para a piloto: pede o que alterar; confirmado, volta na revisão seguinte', async () => {
    abrir(comUmaColecao(), { parte: 'etapas' });
    arrastar('Bermuda', 'Peça-piloto');
    const pedido = screen.getByRole('form', { name: 'Mudança de etapa' });
    expect(pedido).toHaveTextContent('“Bermuda”: Aprovação → Peça-piloto');
    expect(within(pedido).getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    fireEvent.change(within(pedido).getByLabelText('O que alterar na piloto'), { target: { value: 'Barra mais curta' } });
    fireEvent.click(within(pedido).getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(within(coluna('Peça-piloto')).getByText('Bermuda')).toBeInTheDocument());
    expect(screen.queryByRole('form', { name: 'Mudança de etapa' })).toBeNull();
  });

  it('da aprovação para a produção: pede a confirmação (aprovar a piloto); desistir não muda nada', async () => {
    abrir(comUmaColecao(), { parte: 'etapas' });
    arrastar('Bermuda', 'Produção');
    fireEvent.click(screen.getByRole('button', { name: 'Desistir' }));
    expect(within(coluna('Aprovação')).getByText('Bermuda')).toBeInTheDocument();
    arrastar('Bermuda', 'Produção');
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar a piloto' }));
    await waitFor(() => expect(within(coluna('Produção')).getByText('Bermuda')).toBeInTheDocument());
  });
});

describe('PainelDeColecoes — sem saber quem muda as etapas (ADR 0118)', () => {
  it('o "Avançar →" (e o arrasto) pergunta quem decide, em vez de falhar', async () => {
    abrir(comUmaColecao(), { parte: 'etapas' });
    fireEvent.change(screen.getByLabelText('Quem muda as etapas'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Avançar Camiseta básica' }));
    const pedido = screen.getByRole('form', { name: 'Mudança de etapa' });
    expect(within(pedido).getByRole('button', { name: 'Confirmar' })).toBeDisabled();
    fireEvent.change(within(pedido).getByLabelText('Quem decide'), { target: { value: 'Bruno' } });
    fireEvent.click(within(pedido).getByRole('button', { name: 'Confirmar' }));
    await waitFor(() => expect(within(screen.getByLabelText('Etapa Modelagem')).getByText('Camiseta básica')).toBeInTheDocument());
    // O nome fica para as próximas mudanças.
    expect(screen.getByLabelText('Quem muda as etapas')).toHaveValue('Bruno');
  });
});

describe('PainelDeColecoes — os looks (ADR 0145)', () => {
  it('um look de dois modelos: os croquis lado a lado, as cores em comum, a prancha em HTML; e tirar', async () => {
    let arquivo = comUmaColecao();
    const c = arquivo.colecoes[0]!;
    arquivo = salvarColecao(arquivo, salvarModelo(c, { ...c.modelos.find((m) => m.id === 'm1')!, projetoId: 'p1', cores: ['Branco', 'Preto'] }));
    const { onSalvarTexto } = abrir(arquivo, { parte: 'looks', comProjeto: true });
    expect(screen.getByRole('tab', { name: 'Looks (0)' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.change(screen.getByLabelText('Nome do look'), { target: { value: 'Básico' } });
    const grupo = screen.getByRole('group', { name: 'Modelos do look' });
    fireEvent.click(within(grupo).getByLabelText('Camiseta básica'));
    expect(screen.getByRole('button', { name: 'Guardar o look (1 modelo(s))' })).toBeDisabled();
    fireEvent.click(within(grupo).getByLabelText('Bermuda'));
    fireEvent.click(screen.getByRole('button', { name: 'Guardar o look (2 modelo(s))' }));
    const look = await screen.findByRole('article', { name: 'Look Básico' });
    expect(screen.getByRole('tab', { name: 'Looks (1)' })).toBeInTheDocument();
    expect(within(look).getByText('cores em comum: Preto')).toBeInTheDocument();
    expect(look.querySelector('[data-modelo="m1"] svg')).not.toBeNull();
    expect(within(look).getByText('sem projeto')).toBeInTheDocument();
    fireEvent.click(within(look).getByRole('button', { name: 'Salvar a prancha (HTML)' }));
    await waitFor(() => expect(onSalvarTexto).toHaveBeenCalled());
    const [nome, html] = onSalvarTexto.mock.calls.at(-1) as unknown as [string, string];
    expect(nome).toBe('look-Basico.html');
    expect(html).toContain('<h1>Básico</h1>');
    expect(html).toContain('cores em comum: Preto');
    expect(html.match(/<figure>/g)).toHaveLength(2);
    expect(html).toContain('<svg');
    fireEvent.click(within(look).getByRole('button', { name: 'Tirar o look' }));
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Look Básico' })).toBeNull());
  });
});

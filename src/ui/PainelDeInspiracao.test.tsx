import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { PAINEL_VAZIO, type PainelDeInspiracao as Painel } from '../domain/inspiracao';
import type { PedidoDeImagem } from '../domain/servicoDeIa';
import { PainelDeInspiracao, type AcessoAoServicoDeIa, type EstadoDoServicoDeIa, type ParteDaInspiracao } from './PainelDeInspiracao';

afterEach(() => cleanup());

const AGORA = '2026-10-24T21:00:00.000Z';
const imagemLida = (nome: string, cores: string[]) => ({ nome, dados: `data:image/jpeg;base64,${btoa(nome)}`, larguraPx: 64, alturaPx: 48, cores });

/** Um serviço de mentira: guarda a chave na memória (nunca a mostra) e devolve duas imagens. */
function servicoFalso(configurado = false) {
  let estado: EstadoDoServicoDeIa = { configurado, servico: 'OpenAI (imagens)', modelo: 'gpt-image-2.5-flare', cofreDisponivel: true, guardadaEmIso: configurado ? AGORA : null, chaveIlegivel: false };
  const gerar = vi.fn(async (_p: PedidoDeImagem) => ({ ok: true as const, imagens: ['QUFB', 'QkJC'], modelo: estado.modelo }));
  const servico: AcessoAoServicoDeIa = {
    estado: async () => estado,
    guardarChave: vi.fn(async (chave: string, modelo: string) => {
      if (chave.length < 20) return 'A chave não parece uma chave do serviço (sem espaços, ao menos 20 letras).';
      estado = { ...estado, configurado: true, modelo, guardadaEmIso: AGORA };
      return null;
    }),
    mudarModelo: vi.fn(async () => null),
    esquecerChave: vi.fn(async () => {
      estado = { ...estado, configurado: false };
      return true;
    }),
    gerar,
  };
  return { servico, gerar };
}

function abrir(opcoes: { readonly painel?: Painel; readonly parte?: ParteDaInspiracao; readonly servico?: AcessoAoServicoDeIa | null; readonly comDesenho?: boolean } = {}) {
  const onGuardar = vi.fn();
  const onSalvarArquivo = vi.fn(async (nome: string) => `C:\\saida\\${nome}`);
  let n = 0;
  render(
    <PainelDeInspiracao
      painel={opcoes.painel ?? PAINEL_VAZIO}
      parteInicial={opcoes.parte ?? 'painel'}
      contexto={{ nomeDoModelo: 'Saia evasê', descricao: 'Saia midi', tecido: 'Linho' }}
      desenhoComoPng={opcoes.comDesenho ? async () => btoa('PNG-DO-DESENHO') : null}
      lerImagem={async (f) => imagemLida(f.name.replace(/\.[^.]+$/, ''), f.name.startsWith('azul') ? ['#141e5a', '#fafafa'] : ['#c8141e'])}
      reduzirImagem={async (_d, nome) => imagemLida(nome, ['#808080'])}
      servico={opcoes.servico === undefined ? servicoFalso().servico : opcoes.servico}
      onGuardar={onGuardar}
      onSalvarArquivo={onSalvarArquivo}
      novoId={() => `i${++n}`}
      agoraIso={() => AGORA}
      onFechar={() => {}}
    />,
  );
  return { onGuardar, onSalvarArquivo, ultimo: (): Painel => onGuardar.mock.calls.at(-1)![0] as Painel };
}

const trazer = (...nomes: string[]) =>
  fireEvent.change(screen.getByLabelText('Arquivos de imagem da inspiração'), { target: { files: nomes.map((n) => new File(['x'], n, { type: 'image/png' })) } });

describe('PainelDeInspiracao — o painel', () => {
  it('traz imagens, muda a categoria e a nota, monta a paleta pelas cores das imagens, e guarda no projeto', async () => {
    const { onGuardar, ultimo } = abrir();
    expect(screen.getByText(/O painel está vazio/)).toBeInTheDocument();
    trazer('azul-listrado.png', 'botao-vermelho.png');
    await waitFor(() => expect(screen.getAllByRole('img')).toHaveLength(2));
    fireEvent.change(screen.getByLabelText('Categoria de azul-listrado'), { target: { value: 'estampa' } });
    fireEvent.change(screen.getByLabelText('Nota de azul-listrado'), { target: { value: 'listras finas' } });
    fireEvent.change(screen.getByLabelText('Conceito do modelo (o público, a ocasião, o clima)'), { target: { value: 'verão urbano' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pôr azul-marinho (#141e5a) na paleta' }));
    expect(within(screen.getByRole('list', { name: 'Paleta do modelo' })).getAllByRole('listitem')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Estampa (1)' }));
    expect(screen.getAllByRole('img')).toHaveLength(1);
    await waitFor(() => expect(onGuardar).toHaveBeenCalled(), { timeout: 2000 });
    expect(ultimo()).toMatchObject({ conceito: 'verão urbano', paleta: ['#141e5a'] });
    expect(ultimo().itens.map((i) => [i.nome, i.categoria, i.nota])).toEqual([
      ['azul-listrado', 'estampa', 'listras finas'],
      ['botao-vermelho', 'outro', ''],
    ]);
  });

  it('o painel cheio (16) não aceita mais, e diz', async () => {
    const cheio: Painel = { ...PAINEL_VAZIO, itens: Array.from({ length: 15 }, (_, k) => ({ id: `x${k}`, categoria: 'cor' as const, nome: `x${k}`, dados: 'data:image/png;base64,AA', larguraPx: 1, alturaPx: 1, nota: '', cores: [], criadoEmIso: AGORA })) };
    abrir({ painel: cheio });
    trazer('a.png', 'b.png');
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Cabem mais 1 imagem(ns) no painel: as outras ficaram de fora.'));
    expect(screen.getByRole('tab', { name: 'Painel de inspiração (16)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Trazer imagens…' })).toBeDisabled();
  });
});

describe('PainelDeInspiracao — criar com IA', () => {
  it('fora do programa instalado: diz que só funciona nele', () => {
    abrir({ parte: 'ia', servico: null });
    expect(screen.getByText(/só funciona no programa instalado/)).toBeInTheDocument();
  });

  it('sem chave: não configurada, sem gerar; a chave guardada fica escondida e a IA passa a configurada', async () => {
    const { servico } = servicoFalso(false);
    abrir({ parte: 'ia', servico });
    await waitFor(() => expect(screen.getByText('IA não configurada')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /^Gerar/ })).toBeDisabled();
    const campo = screen.getByLabelText('Chave do serviço');
    expect(campo).toHaveAttribute('type', 'password');
    fireEvent.change(campo, { target: { value: 'curta' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar a chave' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(/não parece uma chave/));
    fireEvent.change(campo, { target: { value: 'sk-proj-uma-chave-de-teste-123456' } });
    fireEvent.change(screen.getByLabelText('Modelo de imagem'), { target: { value: 'gpt-image-2.5-sunburst' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar a chave' }));
    await waitFor(() => expect(screen.getByText('IA configurada: OpenAI (imagens)')).toBeInTheDocument());
    expect(servico.guardarChave).toHaveBeenLastCalledWith('sk-proj-uma-chave-de-teste-123456', 'gpt-image-2.5-sunburst');
    expect(screen.queryByDisplayValue('sk-proj-uma-chave-de-teste-123456')).toBeNull();
    expect(screen.getByRole('button', { name: /^Gerar 2/ })).toBeEnabled();
  });

  it('gera o croqui com uma referência; o resultado é rascunho, vai ao painel e sai em PNG', async () => {
    const { servico, gerar } = servicoFalso(true);
    const painel: Painel = { conceito: 'verão', paleta: ['#141e5a'], itens: [{ id: 'r1', categoria: 'modelagem', nome: 'gola', dados: 'data:image/jpeg;base64,R09MQQ==', larguraPx: 1, alturaPx: 1, nota: 'gola padre', cores: [], criadoEmIso: AGORA }] };
    const { onGuardar, ultimo, onSalvarArquivo } = abrir({ parte: 'ia', servico, painel });
    await waitFor(() => expect(screen.getByText('IA configurada: OpenAI (imagens)')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('radio', { name: /Croqui frente e costas/ }));
    fireEvent.click(screen.getByLabelText('Referência: gola'));
    const pedido = screen.getByLabelText('O pedido (pode mudar antes de mandar)') as HTMLTextAreaElement;
    expect(pedido.value).toMatch(/^Desenho técnico de moda \(croqui plano\) da peça "Saia evasê"/);
    expect(pedido.value).toContain('Use as 1 imagem(ns) anexada(s) como referência visual.');
    fireEvent.change(screen.getByLabelText('Quantas'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar 1 imagem(ns)' }));
    await waitFor(() => expect(screen.getAllByText('Rascunho da IA')).toHaveLength(2));
    const enviado = gerar.mock.calls[0]![0];
    expect(enviado).toMatchObject({ quantidade: 1, formato: 'retrato', referencias: [{ nome: 'gola', base64: 'R09MQQ==', tipo: 'image/jpeg' }] });
    fireEvent.click(screen.getAllByRole('button', { name: 'Pôr no painel' })[0]!);
    await waitFor(() => expect(screen.getByRole('button', { name: 'No painel (rascunho)' })).toBeDisabled());
    fireEvent.click(screen.getAllByRole('button', { name: 'Salvar PNG' })[1]!);
    await waitFor(() => expect(onSalvarArquivo).toHaveBeenCalledWith('rascunho-da-ia-2.png', expect.any(ArrayBuffer)));
    await waitFor(() => expect(onGuardar).toHaveBeenCalled(), { timeout: 2000 });
    expect(ultimo().itens[1]).toMatchObject({ rascunhoDaIa: { modelo: 'gpt-image-2.5-flare', pedido: enviado.pedido, geradoEmIso: AGORA } });
  });

  it('as variações precisam de referência (o desenho técnico); o erro do serviço aparece', async () => {
    const { servico, gerar } = servicoFalso(true);
    gerar.mockResolvedValueOnce({ ok: false, erro: 'O serviço recusou a chave: confira se ela está certa e ativa (Configurar).' } as never);
    abrir({ parte: 'ia', servico, comDesenho: true });
    await waitFor(() => expect(screen.getByText('IA configurada: OpenAI (imagens)')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('radio', { name: /Variações de um desenho/ }));
    expect(screen.getByRole('button', { name: /^Gerar/ })).toBeDisabled();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Desenho técnico' }));
    fireEvent.click(screen.getByRole('button', { name: /^Gerar/ }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('O serviço recusou a chave'));
    expect(gerar.mock.calls[0]![0].referencias).toEqual([{ nome: 'desenho-tecnico.png', base64: btoa('PNG-DO-DESENHO'), tipo: 'image/png' }]);
  });
});

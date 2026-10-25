import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { BIBLIOTECA_VAZIA, salvarMaterial, salvarPadroesDeCusto, type BibliotecaDeMateriais } from '../domain/materiais';
import { novaFichaTecnica, type FichaTecnica } from '../domain/fichaTecnica';
import { adicionarElemento, DESENHO_VAZIO, novaCota, tracosDaBase } from '../domain/desenhoTecnico';
import { PainelDaFichaTecnica, type ParteDaFicha } from './PainelDaFichaTecnica';
import { criarMolde, type Molde } from '../domain/molde';
import { ponto } from '../core/geometria';
import { definirRegra, iniciarGraduacao, regraPorPasso } from '../domain/graduacao';

afterEach(() => cleanup());

const AGORA = '2026-10-24T18:00:00.000Z';

function biblioteca(): BibliotecaDeMateriais {
  let b = salvarMaterial(BIBLIOTECA_VAZIA, { id: 'botao', codigo: 'B12', descricao: 'Botão 12 mm', categoria: 'aviamento', unidade: 'un', precoPorUnidade: 0.3, atualizadoEmIso: AGORA }, AGORA);
  b = salvarMaterial(b, { id: 'malha', codigo: 'T1', descricao: 'Malha PV', categoria: 'tecido', unidade: 'm', precoPorUnidade: 20, larguraMm: 1600, atualizadoEmIso: AGORA }, AGORA);
  return salvarPadroesDeCusto(b, { custoDoMinuto: 0.5, indiretosPercentual: 0, impostosPercentual: 0, comissaoPercentual: 0, margemPercentual: 50 });
}

function abrir(opcoes: { readonly ficha?: FichaTecnica; readonly parte?: ParteDaFicha; readonly encaixe?: boolean; readonly pecas?: readonly Molde[] } = {}) {
  const onGuardar = vi.fn();
  const onExportarPdf = vi.fn();
  let n = 0;
  render(
    <PainelDaFichaTecnica
      ficha={opcoes.ficha ?? { ...novaFichaTecnica({ nome: 'Camiseta', codigo: 'ENF-1', pecas: [] }, AGORA), tamanhos: ['P', 'M'] }}
      parteInicial={opcoes.parte ?? 'descricao'}
      pecas={opcoes.pecas ?? []}
      encaixe={opcoes.encaixe ? { comprimentoMm: 1500, roupasContadas: 2, larguraDoTecidoMm: 1600 } : null}
      biblioteca={biblioteca()}
      responsavelSugerido="Ana"
      onGuardar={onGuardar}
      onExportarPdf={onExportarPdf}
      onAbrirMateriais={() => {}}
      agoraIso={() => AGORA}
      novoId={() => `n${++n}`}
      onFechar={() => {}}
    />,
  );
  return { onGuardar, onExportarPdf, ultima: (): FichaTecnica => onGuardar.mock.calls.at(-1)![0] as FichaTecnica };
}

const aba = (nome: RegExp | string) => fireEvent.click(screen.getByRole('tab', { name: nome }));

describe('PainelDaFichaTecnica', () => {
  it('a descrição muda e é guardada sozinha no projeto', async () => {
    const { onGuardar, ultima } = abrir();
    fireEvent.change(screen.getByLabelText('Coleção'), { target: { value: 'Verão 27' } });
    fireEvent.change(screen.getByLabelText('Referência'), { target: { value: 'CAM-01' } });
    await waitFor(() => expect(onGuardar).toHaveBeenCalled(), { timeout: 2000 });
    expect(ultima()).toMatchObject({ colecao: 'Verão 27', referencia: 'CAM-01' });
    expect(screen.getByText('CAM-01 — Camiseta')).toBeInTheDocument();
  });

  it('as medidas: um ponto com vírgula decimal; colar da planilha (os tamanhos novos entram)', async () => {
    const { onGuardar, ultima } = abrir({ parte: 'medidas' });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar ponto de medida' }));
    fireEvent.change(screen.getByLabelText('Nome do ponto Novo ponto'), { target: { value: 'Busto' } });
    fireEvent.change(screen.getByLabelText('Busto no M'), { target: { value: '52,' } });
    expect(screen.getByLabelText('Busto no M')).toHaveValue('52,');
    fireEvent.change(screen.getByLabelText('Busto no M'), { target: { value: '52,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Colar da planilha…' }));
    fireEvent.change(screen.getByLabelText(/Cole a tabela/), { target: { value: 'Ponto\tM\tG\tTol.\nCintura\t40\t44\t1\n' } });
    fireEvent.click(screen.getByRole('button', { name: 'Colar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('1 ponto(s) de medida colado(s).');
    await waitFor(() => expect(onGuardar).toHaveBeenCalled(), { timeout: 2000 });
    expect(ultima().tamanhos).toEqual(['P', 'M', 'G']);
    expect(ultima().medidas.map((p) => [p.nome, p.valoresCm, p.toleranciaCm])).toEqual([
      ['Busto', { M: 52.5 }, 0.5],
      ['Cintura', { M: 40, G: 44 }, 1],
    ]);
  });

  it('os materiais: da biblioteca (o preço vem dela) e pelo encaixe da mesa; o valor por peça', async () => {
    abrir({ parte: 'materiais', encaixe: true });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar material' }));
    // O primeiro da biblioteca é o tecido (pela ordem): entra pelo encaixe — 1,5 m ÷ 2 roupas = 0,750 m × R$ 20.
    const tabela = screen.getByRole('table', { name: 'Materiais e aviamentos (por peça pronta)' });
    expect(within(tabela).getAllByRole('row')[1]).toHaveTextContent('0,750 m');
    expect(within(tabela).getAllByRole('row')[1]).toHaveTextContent('R$ 15,00');
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar material' }));
    fireEvent.change(screen.getAllByRole('combobox', { name: /^Material de/ })[1]!, { target: { value: 'botao' } });
    fireEvent.change(screen.getByLabelText('Consumo de Botão 12 mm'), { target: { value: 'informado' } });
    fireEvent.change(screen.getByLabelText('Quantidade de Botão 12 mm'), { target: { value: '6' } });
    expect(within(tabela).getAllByRole('row')[2]).toHaveTextContent('R$ 0,30/unR$ 1,80');
    expect(within(tabela).getByText('R$ 16,80')).toBeInTheDocument();
  });

  it('o item digitado, fora da biblioteca, com o preço dele', () => {
    abrir({ parte: 'materiais' });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar material' }));
    fireEvent.change(screen.getAllByRole('combobox', { name: /^Material de/ })[0]!, { target: { value: '__digitado__' } });
    fireEvent.change(screen.getByLabelText('Descrição do item digitado'), { target: { value: 'Linha de pesponto' } });
    fireEvent.change(screen.getByLabelText('Unidade de Linha de pesponto'), { target: { value: 'm' } });
    fireEvent.change(screen.getByLabelText('Consumo de Linha de pesponto'), { target: { value: 'informado' } });
    fireEvent.change(screen.getByLabelText('Quantidade de Linha de pesponto'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Preço de Linha de pesponto'), { target: { value: '0,01' } });
    expect(screen.getByRole('table', { name: 'Materiais e aviamentos (por peça pronta)' })).toHaveTextContent('R$ 1,20');
  });

  it('as operações: o tempo total e a mão de obra', () => {
    abrir({ parte: 'operacoes' });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar operação' }));
    fireEvent.change(screen.getByLabelText('Operação 1'), { target: { value: 'Fechar ombros' } });
    fireEvent.change(screen.getByLabelText('Tempo da operação 1'), { target: { value: '1,5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar operação' }));
    fireEvent.change(screen.getByLabelText('Tempo da operação 2'), { target: { value: '2,5' } });
    const tabela = screen.getByRole('table', { name: 'Sequência operacional' });
    expect(tabela).toHaveTextContent('4,00 min');
    expect(tabela).toHaveTextContent('mão de obra: R$ 2,00');
  });

  it('o pré-custo: parcial com o que falta; o total, o preço; os padrões próprios; o simulador', () => {
    abrir({ parte: 'precusto' });
    expect(screen.getByRole('status')).toHaveTextContent('Custo parcial — falta:');
    expect(screen.getByRole('status')).toHaveTextContent('A ficha não tem materiais');
    aba(/^Materiais/);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar material' }));
    fireEvent.change(screen.getAllByRole('combobox', { name: /^Material de/ })[0]!, { target: { value: 'botao' } });
    fireEvent.change(screen.getByLabelText('Consumo de Botão 12 mm'), { target: { value: 'informado' } });
    fireEvent.change(screen.getByLabelText('Quantidade de Botão 12 mm'), { target: { value: '10' } });
    aba(/^Operações/);
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar operação' }));
    fireEvent.change(screen.getByLabelText('Tempo da operação 1'), { target: { value: '6' } });
    aba('Pré-custo');
    expect(screen.queryByText('Custo parcial — falta:')).toBeNull();
    // 10 × 0,30 + 6 × 0,50 = 6,00; margem de 50% → R$ 12,00.
    const valor = (rotulo: string) => screen.getByText(rotulo, { selector: 'dt' }).nextElementSibling!.textContent;
    expect(valor('Custo total')).toBe('R$ 6,00');
    expect(valor('Preço sugerido (markup 2,00)')).toBe('R$ 12,00');
    fireEvent.click(screen.getByLabelText('Próprios desta ficha'));
    fireEvent.change(screen.getByLabelText('Margem (% do preço)'), { target: { value: '40' } });
    expect(valor('Preço sugerido (markup 1,67)')).toBe('R$ 10,00');
    fireEvent.change(screen.getByLabelText('Valor da meta (R$)'), { target: { value: '5' } });
    expect(screen.getByLabelText('Resultado da meta')).toHaveTextContent('Acima da meta em R$ 1,00 (custo-alvo R$ 5,00)');
    expect(screen.getByLabelText('Resultado da meta')).toHaveTextContent('Reduzir o tempo de costura em 2,00 min (de 6,00 para 4,00 min).');
  });

  it('a aprovação: enviar, aprovar (com o custo); aprovada, a ficha não muda até a nova versão', async () => {
    const { onGuardar, ultima } = abrir({ parte: 'aprovacao' });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar para aprovação' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Versão 1 enviada para aprovação.');
    fireEvent.change(screen.getByLabelText('Responsável'), { target: { value: 'Bruno' } });
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('O pré-custo estava parcial: a aprovação ficou sem o custo.');
    expect(screen.getByText('Aprovada · versão 1')).toBeInTheDocument();
    const historico = screen.getByRole('table', { name: 'Histórico da aprovação' });
    expect(within(historico).getAllByRole('row').map((r) => r.textContent)).toEqual([expect.stringContaining('Data'), expect.stringContaining('AprovadaBruno'), expect.stringContaining('Enviada para aprovaçãoAna')]);
    aba('Descrição');
    expect(screen.getByText(/A ficha está aprovada \(versão 1\): para mudar, abra uma nova versão/)).toBeInTheDocument();
    expect(screen.getByLabelText('Coleção')).toBeDisabled();
    aba('Aprovação');
    fireEvent.click(screen.getByRole('button', { name: 'Abrir nova versão' }));
    expect(screen.getByText('Rascunho · versão 2')).toBeInTheDocument();
    await waitFor(() => expect(onGuardar).toHaveBeenCalled(), { timeout: 2000 });
    expect(ultima()).toMatchObject({ versao: 2, situacao: 'rascunho' });
  });

  it('pedir alteração sem dizer o quê é recusado', () => {
    abrir({ parte: 'aprovacao' });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar para aprovação' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pedir alteração' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Diga o que precisa ser alterado (no comentário).');
  });

  it('exportar o PDF manda a ficha e o pré-custo de agora', () => {
    const { onExportarPdf } = abrir();
    fireEvent.click(screen.getByRole('button', { name: 'Exportar PDF' }));
    expect(onExportarPdf).toHaveBeenCalledTimes(1);
    expect(onExportarPdf.mock.calls[0]![1]).toMatchObject({ completo: false });
    // Sem peça graduada, nenhum custo por tamanho.
    expect(onExportarPdf.mock.calls[0]![2]).toEqual([]);
  });
});

describe('PainelDaFichaTecnica — o desenho técnico na ficha (ADR 0107)', () => {
  it('sem croqui: o convite para fazer; com croqui: as vistas na Descrição, e o botão abre o editor com a ficha de agora', () => {
    const onAbrirDesenho = vi.fn();
    let n = 0;
    const base = { ...novaFichaTecnica({ nome: 'Camiseta', codigo: 'ENF-1', pecas: [] }, AGORA), desenho: adicionarElemento(DESENHO_VAZIO, tracosDaBase('regata', () => `d${++n}`)) };
    render(
      <PainelDaFichaTecnica
        ficha={base}
        pecas={[]}
        encaixe={null}
        biblioteca={biblioteca()}
        responsavelSugerido=""
        onGuardar={() => {}}
        onExportarPdf={() => {}}
        onAbrirMateriais={() => {}}
        imagens={[]}
        onAbrirDesenho={onAbrirDesenho}
        agoraIso={() => AGORA}
        novoId={() => 'x'}
        onFechar={() => {}}
      />,
    );
    expect(screen.getByRole('img', { name: 'Desenho técnico — Frente' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Desenho técnico — Costas' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Coleção'), { target: { value: 'Inverno' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir o desenho técnico' }));
    expect(onAbrirDesenho.mock.calls[0]![0]).toMatchObject({ colecao: 'Inverno' });
  });
});

describe('PainelDaFichaTecnica — o custo por tamanho (ADR 0115)', () => {
  it('com a peça graduada, o pré-custo mostra cada tamanho: a área, o tecido a mais ou a menos, o custo e o preço', () => {
    const contorno = [ponto(0, 0), ponto(0, 200), ponto(300, 200), ponto(300, 0)];
    let g = iniciarGraduacao(contorno, ['P', 'M'], 0);
    for (const i of [1, 2]) g = definirRegra(g, contorno, i, regraPorPasso(g, ponto(0, 20)));
    const peca = { ...criarMolde({ nome: 'Frente', referencia: '', tamanho: 'P', contorno, linhaDeFio: { inicio: ponto(50, 100), fim: ponto(250, 100) } }, 'f'), graduacao: g };
    const ficha: FichaTecnica = {
      ...novaFichaTecnica({ nome: 'Camiseta', codigo: 'ENF-1', pecas: [] }, AGORA),
      tamanhos: ['P', 'M'],
      materiais: [{ id: 'i1', materialId: 'malha', descricao: 'Malha PV', aplicacao: 'Corpo', unidade: 'm', consumo: { tipo: 'informado', quantidade: 1 } }],
    };
    const { onExportarPdf } = abrir({ ficha, parte: 'precusto', pecas: [peca] });
    const tabela = screen.getByRole('table', { name: /Por tamanho/ });
    const linhasDaTabela = within(tabela).getAllByRole('row').slice(1).map((l) => l.textContent);
    // P: 300 × 200 = 0,060 m²; M: 300 × 220 = 0,066 m² — a média 0,063: P −4,8%, M +4,8%.
    expect(linhasDaTabela[0]).toMatch(/^P0,060 m²0,952 m \(−4,8%\)R\$ 19,05/);
    expect(linhasDaTabela[1]).toMatch(/^M0,066 m²1,048 m \(\+4,8%\)R\$ 20,95/);
    // O PDF leva a mesma tabela.
    fireEvent.click(screen.getByRole('button', { name: 'Exportar PDF' }));
    expect((onExportarPdf.mock.calls[0]![2] as ReadonlyArray<{ tamanho: string }>).map((t) => t.tamanho)).toEqual(['P', 'M']);
  });
});

describe('PainelDaFichaTecnica — a letra das cotas na tabela de medidas (ADR 0117)', () => {
  it('com cota no desenho, a coluna Cota mostra a letra de cada ponto, a com cota em destaque', () => {
    const base = novaFichaTecnica({ nome: 'Camiseta', codigo: 'ENF-1', pecas: [] }, AGORA);
    const ficha: FichaTecnica = {
      ...base,
      tamanhos: ['P'],
      medidas: [
        { id: 'm1', nome: 'Busto', comoMedir: '', toleranciaCm: 1, valoresCm: { P: 48 } },
        { id: 'm2', nome: 'Comprimento', comoMedir: '', toleranciaCm: 1, valoresCm: { P: 66 } },
      ],
      desenho: adicionarElemento(DESENHO_VAZIO, novaCota('c', 'frente', { x: 100, y: 100 }, { x: 300, y: 100 }, 'm2')),
    };
    abrir({ ficha, parte: 'medidas' });
    expect(screen.getByRole('columnheader', { name: 'Cota' })).toBeInTheDocument();
    const letras = [...document.querySelectorAll('.letra-da-cota, .letra-sem-cota')].map((c) => `${c.textContent}:${c.className}`);
    expect(letras).toEqual(['A:letra-sem-cota', 'B:letra-da-cota']);
  });
});

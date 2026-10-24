import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { CADASTRO_VAZIO, estadoDoRolo, salvarMalha, salvarRolo, type CadastroDeProducao, type RoloDeEstoque } from '../domain/cadastroDeProducao';
import { concluirOCorte, execucaoAtualDoPlano, iniciarOCorte, liberarParaOCorte, planoDaExecucao } from '../domain/execucaoDoCorte';
import { PainelDaSalaDeCorte } from './PainelDaSalaDeCorte';

afterEach(() => cleanup());

const MALHA = { id: 'm1', descricao: 'Malha algodão', larguraUtilMm: 1700, rendimentoMmPorG: 4, tubular: false, sentidoUnico: false, padrao: 'liso' as const, encolhimentoCompensadoNoMolde: false };
const rolo = (id: string, metros: number): RoloDeEstoque => ({
  id,
  malhaId: 'm1',
  identificacao: id.toUpperCase(),
  comprimentoMedidoMm: metros * 1000,
  lote: 'L1',
  tonalidade: 'A',
  defeitos: [],
  unidadeDoPeso: 'kg',
  unidadeDoComprimento: 'm',
  indisponivel: false,
});
let n = 0;
const novoId = (): string => `id-${++n}`;
const BASE = salvarRolo(salvarRolo(salvarMalha(CADASTRO_VAZIO, MALHA), rolo('r1', 100)), rolo('r2', 100));
const plano = (planoId: string, roloId: string) => ({ planoId, projetoId: 'proj', ordem: `OP-${planoId}`, camadas: 10, consumoMm: 40_000, usos: [{ roloId, comprimentoMm: 40_000 }], malha: 'Malha algodão' });

/** Uma ordem liberada (OP-a, no R1) e uma já concluída (OP-b, no R2, com 41 m e a sobra como retalho). */
function inicial(): CadastroDeProducao {
  let c = liberarParaOCorte(BASE, plano('a', 'r1'), { responsavel: 'Ana', agoraIso: '2026-10-24T08:00:00.000Z', novoId });
  c = liberarParaOCorte(c, plano('b', 'r2'), { responsavel: 'Ana', agoraIso: '2026-10-23T08:00:00.000Z', novoId });
  const b = execucaoAtualDoPlano(c, 'b')!.id;
  c = iniciarOCorte(c, b, { operador: 'Carla', agoraIso: '2026-10-23T09:00:00.000Z' });
  return concluirOCorte(c, b, planoDaExecucao(execucaoAtualDoPlano(c, 'b')!), {
    responsavel: 'Carla',
    agoraIso: '2026-10-23T10:30:00.000Z',
    camadasRealizadas: 10,
    consumoPorRolo: [{ roloId: 'r2', realMm: 41_000, sobraViraRetalho: true }],
    novoId,
  }).cadastro;
}

function Montado(props: { readonly aoGravar?: (c: CadastroDeProducao) => void; readonly onSalvarTexto?: (nome: string, conteudo: string) => Promise<string | null> }) {
  const [cadastro, setCadastro] = useState(inicial);
  return (
    <PainelDaSalaDeCorte
      cadastro={cadastro}
      somenteLeitura={false}
      nomeDoProjeto={(id) => (id === 'proj' ? 'Camiseta (ENF-1)' : '?')}
      agoraIso={() => '2026-10-24T12:00:00.000Z'}
      novoId={(prefixo) => `${prefixo}-${++n}`}
      onMudarCadastro={async (novo) => {
        setCadastro(novo);
        props.aoGravar?.(novo);
        return null;
      }}
      onSalvarTexto={props.onSalvarTexto ?? (async () => null)}
      onFechar={() => {}}
    />
  );
}

const parte = (nome: RegExp) => fireEvent.click(screen.getByRole('tab', { name: nome }));
const botao = (nome: string) => fireEvent.click(screen.getByRole('button', { name: nome }));

describe('PainelDaSalaDeCorte', () => {
  it('as ordens abertas, com o projeto e a malha; começar e concluir pelo painel, sem abrir o projeto — a baixa é a do real', async () => {
    let ultimo: CadastroDeProducao | null = null;
    render(<Montado aoGravar={(c) => (ultimo = c)} />);
    const tabela = within(screen.getByRole('table', { name: 'Ordens de corte' }));
    const linhas = tabela.getAllByRole('row').slice(1);
    expect(linhas).toHaveLength(1);
    expect(linhas[0]).toHaveTextContent(/^OP-aCamiseta \(ENF-1\)Malha algodãoLiberada para o corte/);

    botao('Começar…');
    fireEvent.change(screen.getByLabelText(/Quem faz/), { target: { value: 'Bruno' } });
    botao('Começar o corte');
    expect(await screen.findByText('Corte começado.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Consumo real do rolo R1 (m)'), { target: { value: '40,8' } });
    botao('Concluir o corte');
    expect(await screen.findByText('Corte concluído. Baixa do consumo real: R1.')).toBeInTheDocument();
    expect(execucaoAtualDoPlano(ultimo!, 'a')).toMatchObject({ situacao: 'concluida', operador: 'Bruno', consumoRealMm: 40_800 });
    expect(estadoDoRolo(ultimo!, ultimo!.rolos.find((r) => r.id === 'r1')!).consumidoMm).toBe(40_800);
    // Concluída, ela sai das abertas.
    expect(screen.getByText('Nenhuma ordem nesta situação.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Mostrar'), { target: { value: 'concluida' } });
    expect(within(screen.getByRole('table', { name: 'Ordens de corte' })).getAllByRole('row')).toHaveLength(3);
  });

  it('os indicadores do período e as sugestões', () => {
    render(<Montado />);
    parte(/Indicadores e sugestões/);
    const valor = (rotulo: string) => screen.getByText(rotulo, { selector: 'dt' }).nextElementSibling!.textContent;
    expect(valor('Cortes concluídos')).toBe('1');
    expect(valor('Abertas agora')).toBe('1 liberada(s), 0 em corte');
    expect(valor('Malha cortada (real / planejada)')).toBe('41,00 m / 40,00 m');
    expect(valor('Desvio do consumo')).toBe('+2,5%');
    expect(valor('Tempo de corte (total / médio)')).toBe('1 h 30 min / 1 h 30 min');
    expect(within(screen.getByRole('table', { name: 'Por operador' })).getByRole('row', { name: /^Carla/ })).toHaveTextContent('Carla141,00 m+2,5%1 h 30 min');
    expect(screen.getByText('Com menos de 3 cortes concluídos no período, ainda não há média para sugerir correção do consumo.')).toBeInTheDocument();
  });

  it('os retalhos: o que sobrou do R2 aparece; "usado ou descartado" o tira do estoque', async () => {
    let ultimo: CadastroDeProducao | null = null;
    render(<Montado aoGravar={(c) => (ultimo = c)} />);
    parte(/Retalhos \(1\)/);
    const linha = within(screen.getByRole('table', { name: 'Retalhos no estoque' })).getByRole('row', { name: /^R2/ });
    expect(linha).toHaveTextContent('R2Malha algodãoL1 / A59,00 m');
    botao('Usado ou descartado');
    expect(await screen.findByText('Retalho R2 tirado do estoque (usado ou descartado).')).toBeInTheDocument();
    expect(ultimo!.rolos.find((r) => r.id === 'r2')!.indisponivel).toBe(true);
    expect(screen.getByText(/Nenhum retalho no estoque/)).toBeInTheDocument();
  });

  it('os relatórios: o consumo por malha na tela, e os dois CSV para a janela de salvar', async () => {
    const onSalvarTexto = vi.fn(async (nome: string) => `C:/relatorios/${nome}`);
    render(<Montado onSalvarTexto={onSalvarTexto} />);
    parte(/Relatórios/);
    expect(within(screen.getByRole('table', { name: 'Consumo por malha (para compras)' })).getByRole('row', { name: /^Malha algodão/ })).toHaveTextContent('Malha algodão140,00 m41,00 m10,25 kg');
    botao('Exportar o consumo por malha (CSV)');
    expect(await screen.findByText('Salvo em C:/relatorios/consumo-por-malha.csv.')).toBeInTheDocument();
    botao('Exportar o histórico de todas as ordens (CSV, para auditoria)');
    expect(await screen.findByText('Salvo em C:/relatorios/historico-da-sala-de-corte.csv.')).toBeInTheDocument();
    const [nome, conteudo] = onSalvarTexto.mock.calls[1] as unknown as [string, string];
    expect(nome).toBe('historico-da-sala-de-corte.csv');
    expect(conteudo.split('\r\n')).toHaveLength(4); // cabeçalho, as duas ordens e a linha vazia do fim
  });
});

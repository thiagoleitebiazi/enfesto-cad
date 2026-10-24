import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { CADASTRO_VAZIO, estadoDoRolo, salvarMalha, salvarRolo, type CadastroDeProducao, type RoloDeEstoque } from '../domain/cadastroDeProducao';
import type { PlanoDeCorteV2 } from '../domain/planejamento';
import { ExecucaoDoPlano } from './ExecucaoDoPlano';

afterEach(() => cleanup());

const MALHA = { id: 'm1', descricao: 'Algodão', larguraUtilMm: 1600, rendimentoMmPorG: 4, tubular: false, sentidoUnico: false, padrao: 'liso' as const, encolhimentoCompensadoNoMolde: false };
const rolo = (id: string, comprimentoMm: number): RoloDeEstoque => ({
  id,
  malhaId: 'm1',
  identificacao: id.toUpperCase(),
  comprimentoMedidoMm: comprimentoMm,
  lote: 'L1',
  tonalidade: 'A',
  defeitos: [],
  unidadeDoPeso: 'kg',
  unidadeDoComprimento: 'm',
  indisponivel: false,
});
const INICIAL = salvarRolo(salvarRolo(salvarMalha(CADASTRO_VAZIO, MALHA), rolo('r1', 50_000)), rolo('r2', 30_000));

// Só o que a execução lê do plano: o id, a situação, o projeto, a ordem, as camadas, o consumo e os rolos.
const plano = (situacao: 'confirmado' | 'rascunho' = 'confirmado', rolos: ReadonlyArray<readonly [string, number]> | null = [['r1', 12_000], ['r2', 8_000]]): PlanoDeCorteV2 =>
  ({
    id: 'pl1',
    situacao,
    entrada: { molde: { projetoId: 'p1' }, ordem: { codigo: 'OP-17' } },
    resultado: {
      camadas: 20,
      consumoMm: rolos ? rolos.reduce((s, [, mm]) => s + mm, 0) : 20_000,
      rolos: rolos ? rolos.map(([id, usadoMm]) => ({ id, identificacao: id.toUpperCase(), usadoMm })) : null,
    },
  }) as unknown as PlanoDeCorteV2;

let contador = 0;
function Montado(props: { readonly plano: PlanoDeCorteV2; readonly aoGravar?: (c: CadastroDeProducao) => void }) {
  const [cadastro, setCadastro] = useState(INICIAL);
  const [mensagem, setMensagem] = useState('');
  return (
    <>
      <ExecucaoDoPlano
        plano={props.plano}
        cadastro={cadastro}
        responsavelSugerido=""
        agoraIso={() => '2026-10-24T10:00:00.000Z'}
        novoId={(prefixo) => `${prefixo}-${++contador}`}
        onMudar={async (mudar, sucesso) => {
          try {
            const novo = mudar();
            setCadastro(novo);
            props.aoGravar?.(novo);
            setMensagem(sucesso);
            return true;
          } catch (e) {
            setMensagem(e instanceof Error ? e.message : String(e));
            return false;
          }
        }}
      />
      <p role="status">{mensagem}</p>
    </>
  );
}

const botao = (nome: string) => fireEvent.click(screen.getByRole('button', { name: nome }));
const situacao = () => screen.getByText(/^Situação:/).textContent;
const quemFaz = (nome: string) => fireEvent.change(screen.getByLabelText(/Quem faz/), { target: { value: nome } });

describe('ExecucaoDoPlano', () => {
  it('o rascunho não vai para o corte', () => {
    render(<Montado plano={plano('rascunho')} />);
    expect(screen.getByText('A execução do corte começa depois que o plano é confirmado.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Liberar para o corte' })).toBeNull();
  });

  it('liberar → começar → concluir com o consumo real: a baixa é a do real, a sobra vira retalho e aparece o planejado × executado', async () => {
    let ultimo: CadastroDeProducao | null = null;
    render(<Montado plano={plano()} aoGravar={(c) => (ultimo = c)} />);
    expect(situacao()).toBe('Situação: Não liberada.');
    botao('Liberar para o corte');
    expect(await screen.findByRole('status')).toHaveTextContent('Informe quem está liberando o plano para o corte.');
    expect(ultimo).toBeNull();

    quemFaz('Ana');
    botao('Liberar para o corte');
    expect(await screen.findByText('Plano liberado para o corte.')).toBeInTheDocument();
    expect(situacao()).toMatch(/^Situação: Liberada para o corte — liberada em .+ por Ana\.$/);

    botao('Começar o corte');
    expect(await screen.findByText('Corte começado.')).toBeInTheDocument();
    expect(situacao()).toMatch(/corte começado em .+ por Ana\.$/);

    // O plano: 20 camadas, 12 m do R1 e 8 m do R2. O real: 19 camadas, 12,5 m e 8 m; a sobra do R1 vira retalho.
    fireEvent.change(screen.getByLabelText(/Camadas enfestadas/), { target: { value: '19' } });
    expect(screen.getByLabelText('Consumo real do rolo R1 (m)')).toHaveValue('12');
    fireEvent.change(screen.getByLabelText('Consumo real do rolo R1 (m)'), { target: { value: '12,5' } });
    fireEvent.click(screen.getByLabelText('A sobra do rolo R1 vira retalho'));
    botao('Concluir o corte');
    expect(await screen.findByText('Corte concluído. Baixa do consumo real: R1, R2. Sobra guardada como retalho: R1.')).toBeInTheDocument();
    expect(situacao()).toMatch(/^Situação: Concluída — .+; concluído em .+ por Ana\.$/);

    const comparativo = within(screen.getByRole('table', { name: 'Planejado × executado' }));
    expect(comparativo.getByRole('row', { name: /^Camadas/ })).toHaveTextContent('Camadas2019−1');
    expect(comparativo.getByRole('row', { name: /^Consumo de malha/ })).toHaveTextContent('Consumo de malha20,00 m20,50 m+0,50 m (+2,5%)');
    expect(within(screen.getByRole('table', { name: 'Por rolo' })).getByRole('row', { name: /^R1/ })).toHaveTextContent('R112,00 m12,50 m37,50 mretalho');

    const r1 = ultimo!.rolos.find((r) => r.id === 'r1')!;
    expect(r1.retalho).toBe(true);
    expect(estadoDoRolo(ultimo!, r1).consumidoMm).toBe(12_500);
    expect(ultimo!.execucoes[0]).toMatchObject({ situacao: 'concluida', camadasRealizadas: 19, consumoRealMm: 20_500, operador: 'Ana' });
    // Concluído, não há mais botões de mudar.
    expect(screen.queryByRole('button', { name: 'Concluir o corte' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Liberar para o corte' })).toBeNull();
  });

  it('o consumo que não é número não conclui (nada muda); cancelar pede o motivo e deixa liberar de novo', async () => {
    let gravacoes = 0;
    render(<Montado plano={plano()} aoGravar={() => gravacoes++} />);
    quemFaz('Ana');
    botao('Liberar para o corte');
    await screen.findByText('Plano liberado para o corte.');
    botao('Começar o corte');
    await screen.findByText('Corte começado.');
    fireEvent.change(screen.getByLabelText('Consumo real do rolo R2 (m)'), { target: { value: 'oito' } });
    botao('Concluir o corte');
    expect(await screen.findByText('O consumo real do rolo R2 precisa ser um número de 0 para cima.')).toBeInTheDocument();
    expect(situacao()).toMatch(/^Situação: Em corte/);
    expect(gravacoes).toBe(2);

    botao('Cancelar o corte');
    botao('Cancelar mesmo');
    expect(await screen.findByText('Diga o motivo do cancelamento.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Motivo do cancelamento'), { target: { value: 'troca de malha' } });
    botao('Cancelar mesmo');
    expect(await screen.findByText('Execução cancelada (fica no registro, com o motivo).')).toBeInTheDocument();
    expect(situacao()).toBe('Situação: Não liberada.');
    expect(screen.getByText(/^Uma liberação cancelada: .+ por Ana — troca de malha\.$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Liberar para o corte' })).toBeInTheDocument();
  });

  it('o plano por peso, sem rolos: o consumo real é um total, sem baixa por rolo', async () => {
    let ultimo: CadastroDeProducao | null = null;
    render(<Montado plano={plano('confirmado', null)} aoGravar={(c) => (ultimo = c)} />);
    quemFaz('Ana');
    botao('Liberar para o corte');
    await screen.findByText('Plano liberado para o corte.');
    botao('Começar o corte');
    await screen.findByText('Corte começado.');
    fireEvent.change(screen.getByLabelText(/Consumo real de malha \(m\)/), { target: { value: '19,8' } });
    botao('Concluir o corte');
    expect(await screen.findByText('Corte concluído. O plano usa um peso de malha, sem rolos: não há baixa por rolo no estoque.')).toBeInTheDocument();
    expect(ultimo!.movimentos).toEqual([]);
    expect(ultimo!.execucoes[0]!.consumoRealMm).toBeCloseTo(19_800, 6);
  });
});

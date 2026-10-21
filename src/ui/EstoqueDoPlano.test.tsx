import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { CADASTRO_VAZIO, salvarMalha, salvarRolo, type CadastroDeProducao, type RoloDeEstoque } from '../domain/cadastroDeProducao';
import type { PlanoDeCorteV2 } from '../domain/planejamento';
import { EstoqueDoPlano } from './EstoqueDoPlano';

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

// Só o que o estoque lê do plano: o id, a situação, o projeto e o que ele usa de cada rolo.
const plano = (situacao: 'confirmado' | 'rascunho' = 'confirmado', usos: ReadonlyArray<readonly [string, number]> = [['r1', 12_000], ['r2', 8_000]]): PlanoDeCorteV2 =>
  ({
    id: 'pl1',
    situacao,
    entrada: { molde: { projetoId: 'p1' } },
    resultado: { rolos: usos.map(([id, usadoMm]) => ({ id, identificacao: id.toUpperCase(), usadoMm })) },
  }) as unknown as PlanoDeCorteV2;

let contador = 0;
function Montado(props: { readonly plano: PlanoDeCorteV2; readonly inicial?: CadastroDeProducao; readonly aoGravar?: (c: CadastroDeProducao) => void }) {
  const [cadastro, setCadastro] = useState(props.inicial ?? INICIAL);
  const [mensagem, setMensagem] = useState('');
  return (
    <>
      <EstoqueDoPlano
        plano={props.plano}
        cadastro={cadastro}
        responsavelSugerido=""
        agoraIso={() => '2026-10-21T10:00:00.000Z'}
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

const linhaDoRolo = (identificacao: string) => within(screen.getByRole('table', { name: 'Estoque dos rolos do plano' })).getByRole('row', { name: new RegExp(`^${identificacao} `) });
const linhasDoHistorico = () => within(screen.getByRole('table', { name: /Movimentos de estoque do plano/ })).getAllByRole('row').slice(1);
const botao = (nome: string) => fireEvent.click(screen.getByRole('button', { name: nome }));

describe('EstoqueDoPlano', () => {
  it('mostra o que o plano usa e, separados, o saldo físico, o reservado, o consumido e o disponível; nada se move sem o clique', () => {
    let gravou = false;
    render(<Montado plano={plano()} aoGravar={() => (gravou = true)} />);
    expect(linhaDoRolo('R1')).toHaveTextContent('R112,00 m50,00 m0,00 m0,00 m50,00 m');
    expect(screen.getByText('Nenhum movimento de estoque deste plano ainda.')).toBeInTheDocument();
    expect(gravou).toBe(false);
  });

  it('reservar pede quem faz (informado); reservar de novo não reserva duas vezes', async () => {
    let ultimo: CadastroDeProducao | null = null;
    render(<Montado plano={plano()} aoGravar={(c) => (ultimo = c)} />);
    botao('Reservar os rolos do plano');
    expect(await screen.findByRole('status')).toHaveTextContent('Informe quem está fazendo o movimento de estoque.');
    expect(ultimo).toBeNull();
    fireEvent.change(screen.getByLabelText(/Quem faz o movimento/), { target: { value: 'Ana' } });
    botao('Reservar os rolos do plano');
    expect(await screen.findByText('Reservado: R1, R2.')).toBeInTheDocument();
    expect(linhaDoRolo('R1')).toHaveTextContent('R112,00 m50,00 m12,00 m0,00 m38,00 m');
    expect(linhasDoHistorico()).toHaveLength(2);
    expect(linhasDoHistorico()[0]).toHaveTextContent('ReservaR112,00 m (3,00 kg)Anavale');
    botao('Reservar os rolos do plano');
    expect(await screen.findByText('Reservado: nenhum rolo novo (já estava feito em R1, R2: não repetido).')).toBeInTheDocument();
    expect(linhasDoHistorico()).toHaveLength(2);
    expect(ultimo!.movimentos).toHaveLength(2);
  });

  it('a baixa troca a reserva: o consumido sobe e o saldo físico desce; repetir não baixa duas vezes', async () => {
    render(<Montado plano={plano()} />);
    fireEvent.change(screen.getByLabelText(/Quem faz o movimento/), { target: { value: 'Ana' } });
    botao('Reservar os rolos do plano');
    await screen.findByText('Reservado: R1, R2.');
    botao('Dar baixa (o corte foi feito)');
    expect(await screen.findByText('Baixa dada: R1, R2.')).toBeInTheDocument();
    expect(linhaDoRolo('R1')).toHaveTextContent('R112,00 m38,00 m0,00 m12,00 m38,00 m');
    expect(linhasDoHistorico()[0]).toHaveTextContent('trocado pela baixa');
    botao('Dar baixa (o corte foi feito)');
    expect(await screen.findByText('Baixa dada: nenhum rolo novo (já estava feito em R1, R2: não repetido).')).toBeInTheDocument();
    expect(linhasDoHistorico()).toHaveLength(4);
    // Depois da baixa, reservar de novo também não reserva.
    botao('Reservar os rolos do plano');
    expect(await screen.findByText('Reservado: nenhum rolo novo (já estava feito em R1, R2: não repetido).')).toBeInTheDocument();
  });

  it('o estorno pede o motivo, fica no histórico (nada é apagado) e devolve o rolo', async () => {
    let ultimo: CadastroDeProducao | null = null;
    render(<Montado plano={plano('confirmado', [['r1', 12_000]])} aoGravar={(c) => (ultimo = c)} />);
    fireEvent.change(screen.getByLabelText(/Quem faz o movimento/), { target: { value: 'Ana' } });
    botao('Reservar os rolos do plano');
    await screen.findByText('Reservado: R1.');
    botao('Estornar');
    botao('Estornar mesmo');
    expect(await screen.findByText('Diga o motivo do estorno.')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Motivo do estorno'), { target: { value: 'ordem cancelada' } });
    botao('Estornar mesmo');
    expect(await screen.findByText('Reserva estornada (o movimento fica no histórico).')).toBeInTheDocument();
    expect(linhaDoRolo('R1')).toHaveTextContent('R112,00 m50,00 m0,00 m0,00 m50,00 m');
    const historico = linhasDoHistorico();
    expect(historico).toHaveLength(2);
    expect(historico[0]).toHaveTextContent('estornado');
    expect(historico[1]).toHaveTextContent('Estorno — ordem canceladaR112,00 m (3,00 kg)Anadesfaz outro');
    expect(ultimo!.movimentos.map((m) => m.tipo)).toEqual(['reserva', 'estorno']);
    // O estornado não tem mais o botão; reservar de novo vale (a reserva anterior foi desfeita).
    expect(screen.queryByRole('button', { name: 'Estornar' })).toBeNull();
    botao('Reservar os rolos do plano');
    expect(await screen.findByText('Reservado: R1.')).toBeInTheDocument();
  });

  it('não reserva mais do que o rolo tem disponível (tudo ou nada: o outro rolo também não)', async () => {
    let gravou = false;
    render(<Montado plano={plano('confirmado', [['r1', 12_000], ['r2', 31_000]])} aoGravar={() => (gravou = true)} />);
    fireEvent.change(screen.getByLabelText(/Quem faz o movimento/), { target: { value: 'Ana' } });
    botao('Reservar os rolos do plano');
    expect(await screen.findByText('O rolo R2 tem 30,00 m disponíveis, menos que os 31,00 m do plano.')).toBeInTheDocument();
    expect(gravou).toBe(false);
    expect(screen.getByText('Nenhum movimento de estoque deste plano ainda.')).toBeInTheDocument();
  });

  it('o rascunho não movimenta o estoque', () => {
    render(<Montado plano={plano('rascunho')} />);
    expect(screen.getByText('O estoque só se movimenta depois que o plano é confirmado.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reservar os rolos do plano' })).toBeNull();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { ponto } from '../core/geometria';
import { criarMolde } from '../domain/molde';
import { criarConfiguracaoDeEnfesto, type ConfiguracaoDeEnfesto } from '../domain/enfesto';
import type { ResultadoDeNesting } from '../domain/nesting';
import { adicionarTrabalho, concluirTrabalho, FILA_VAZIA, iniciarTrabalho, type DadosDoTrabalho, type FilaDeEncaixes } from '../domain/filaDeEncaixes';
import { PainelDaFilaDeEncaixes } from './PainelDaFilaDeEncaixes';
import type { ProgressoNaFila } from './useFilaDeEncaixes';

const ENFESTO = criarConfiguracaoDeEnfesto({
  tipo: 'impar',
  larguraUtilMm: 1500,
  comprimentoMm: 3000,
  quantidadeDeCamadas: 1,
  margemLateralMm: 4,
  margemDeExtremidadeMm: 4,
  distanciaMinimaEntrePecasMm: 3,
} as ConfiguracaoDeEnfesto);
const PECA = criarMolde({ nome: 'Manga', referencia: '', tamanho: 'P', quantidade: 2, contorno: [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)], linhaDeFio: { inicio: ponto(100, 20), fim: ponto(100, 280) } }, 'manga');

const dados = (projetoId: string, projetoNome: string): DadosDoTrabalho => ({
  projetoId,
  projetoNome,
  projetoCodigo: `COD-${projetoId}`,
  impressaoDasPecas: 'x',
  prioridade: 'normal',
  pecas: [PECA],
  enfesto: ENFESTO,
  opcoes: { metodo: 'grade' },
});

const resultado = (aproveitamento: number, deFora = 0): ResultadoDeNesting => ({
  pecasColocadas: [{ idOriginal: 'manga', indiceCopia: 0, molde: PECA }, { idOriginal: 'manga', indiceCopia: 1, molde: PECA }],
  pecasNaoColocadas: Array.from({ length: deFora }, (_, i) => ({ idOriginal: 'manga', indiceCopia: i + 2, nome: 'Manga' })),
  comprimentoUtilizadoMm: 1250,
  areaOcupadaMm2: 120_000,
  aproveitamentoPercentual: aproveitamento,
  tempoDeProcessamentoMs: 1500,
  interrompido: false,
  paradaPorTempoLimite: false,
  paradaPorMetaDeAproveitamento: false,
});

/** A fila de exemplo: a1 e a2 concluídos (projeto A, o aberto), b calculando (projeto B), c aguardando, d aguardando. */
function filaDeExemplo(): FilaDeEncaixes {
  let f = FILA_VAZIA;
  f = adicionarTrabalho(f, dados('A', 'Camiseta'), 'a1', '2026-10-24T08:00:00.000Z');
  f = adicionarTrabalho(f, dados('A', 'Camiseta'), 'a2', '2026-10-24T08:01:00.000Z');
  f = adicionarTrabalho(f, dados('B', 'Calça'), 'b', '2026-10-24T08:02:00.000Z');
  f = adicionarTrabalho(f, dados('C', 'Saia'), 'c', '2026-10-24T08:03:00.000Z');
  f = adicionarTrabalho(f, dados('D', 'Blusa'), 'd', '2026-10-24T08:04:00.000Z');
  f = concluirTrabalho(iniciarTrabalho(f, 'a1', 'x'), 'a1', resultado(78.4), '2026-10-24T09:00:00.000Z');
  f = concluirTrabalho(iniciarTrabalho(f, 'a2', 'x'), 'a2', resultado(81.2, 1), '2026-10-24T09:10:00.000Z');
  return iniciarTrabalho(f, 'b', 'x');
}

function Tela(props: { readonly inicial: FilaDeEncaixes; readonly progresso?: ProgressoNaFila | null; readonly onAplicar?: (id: string) => void; readonly onAbrirProjeto?: (id: string) => void; readonly onExportarCsv?: () => void }): React.JSX.Element {
  const [fila, setFila] = useState(props.inicial);
  return (
    <PainelDaFilaDeEncaixes
      fila={fila}
      progresso={props.progresso ?? null}
      avisos={[]}
      somenteLeitura={false}
      projetoAbertoId="A"
      projetoExiste={(id) => id !== 'C'}
      onMudar={(mudanca) => setFila(mudanca(fila))}
      onAplicar={props.onAplicar ?? (() => {})}
      onAbrirProjeto={props.onAbrirProjeto ?? (() => {})}
      onExportarCsv={props.onExportarCsv ?? (() => {})}
      agoraIso={() => '2026-10-24T10:00:00.000Z'}
      onFechar={() => {}}
    />
  );
}

const linhas = (): HTMLElement[] => within(screen.getByRole('table', { name: 'Encaixes na fila' })).getAllByRole('row').slice(1);
const linhaDe = (projeto: string, situacao?: string): HTMLElement =>
  linhas().find((l) => l.textContent?.includes(projeto) && (situacao === undefined || l.textContent.includes(situacao)))!;

describe('PainelDaFilaDeEncaixes', () => {
  afterEach(() => cleanup());

  it('vazia: diz como pôr um encaixe na fila', () => {
    render(<Tela inicial={FILA_VAZIA} />);
    expect(screen.getByText(/A fila está vazia/)).toBeInTheDocument();
    expect(screen.getByText('Fila livre')).toBeInTheDocument();
  });

  it('a ordem: o que calcula (com o progresso), os da vez numerados, depois os terminados', () => {
    render(<Tela inicial={filaDeExemplo()} progresso={{ id: 'b', colocadas: 1, total: 2 }} />);
    expect(linhas().map((l) => l.textContent!.match(/Camiseta|Calça|Saia|Blusa/)![0])).toEqual(['Calça', 'Saia', 'Blusa', 'Camiseta', 'Camiseta']);
    expect(within(linhaDe('Calça')).getByText('Calculando')).toBeInTheDocument();
    expect(within(linhaDe('Calça')).getByText('1 / 2 peças')).toBeInTheDocument();
    expect(within(linhaDe('Saia')).getAllByRole('cell')[0]).toHaveTextContent('1');
    expect(within(linhaDe('Blusa')).getAllByRole('cell')[0]).toHaveTextContent('2');
    expect(screen.getByRole('status')).toHaveTextContent('Fila rodando1 calculando · 2 aguardando · 2 concluído(s)');
  });

  it('a prioridade e o subir/descer mudam a vez', () => {
    render(<Tela inicial={filaDeExemplo()} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Prioridade de Blusa' }), { target: { value: 'alta' } });
    expect(within(linhaDe('Blusa')).getAllByRole('cell')[0]).toHaveTextContent('1');
    fireEvent.change(screen.getByRole('combobox', { name: 'Prioridade de Blusa' }), { target: { value: 'normal' } });
    fireEvent.click(screen.getByRole('button', { name: 'Subir Blusa na fila' }));
    expect(within(linhaDe('Blusa')).getAllByRole('cell')[0]).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: 'Subir Blusa na fila' })).toBeDisabled();
  });

  it('pausar e retomar um encaixe; pausar a fila inteira', () => {
    render(<Tela inicial={filaDeExemplo()} />);
    fireEvent.click(within(linhaDe('Saia')).getByRole('button', { name: 'Pausar' }));
    expect(within(linhaDe('Saia')).getByText('Pausado')).toBeInTheDocument();
    fireEvent.click(within(linhaDe('Saia')).getByRole('button', { name: 'Retomar' }));
    expect(within(linhaDe('Saia')).getByText('Aguardando')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Pausar a fila' }));
    expect(screen.getByText('Fila pausada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retomar a fila' })).toBeInTheDocument();
  });

  it('cancelar o que calcula; o cancelado pode voltar para a fila', () => {
    render(<Tela inicial={filaDeExemplo()} />);
    fireEvent.click(within(linhaDe('Calça')).getByRole('button', { name: 'Cancelar' }));
    expect(within(linhaDe('Calça')).getByText('Cancelado')).toBeInTheDocument();
    fireEvent.click(within(linhaDe('Calça')).getByRole('button', { name: 'Pôr de novo na fila' }));
    expect(within(linhaDe('Calça')).getByText('Aguardando')).toBeInTheDocument();
  });

  it('os concluídos do projeto aberto: o resultado, a estrela no melhor (todas as peças postas) e o Aplicar', () => {
    const onAplicar = vi.fn();
    render(<Tela inicial={filaDeExemplo()} onAplicar={onAplicar} />);
    const camisetas = linhas().filter((l) => l.textContent!.includes('Camiseta'));
    const melhor = camisetas.find((l) => l.textContent!.includes('78,4%'))!;
    const outra = camisetas.find((l) => l.textContent!.includes('81,2%'))!;
    expect(melhor).toHaveClass('trabalho-melhor');
    expect(melhor).toHaveTextContent('★ 78,4% · 1,25 m');
    expect(outra).toHaveTextContent('2 de 3 peças postas · 1 de fora');
    fireEvent.click(within(melhor).getByRole('button', { name: 'Aplicar no projeto' }));
    expect(onAplicar).toHaveBeenCalledWith('a1');
  });

  it('o concluído de outro projeto: "Abrir o projeto" (se está na Biblioteca) e "Aplicar no aberto…"', () => {
    const onAbrirProjeto = vi.fn();
    const f = concluirTrabalho(filaDeExemplo(), 'b', resultado(70), 'x');
    const comSaia = concluirTrabalho(iniciarTrabalho(f, 'c', 'x'), 'c', resultado(60), 'x');
    render(<Tela inicial={comSaia} onAbrirProjeto={onAbrirProjeto} />);
    fireEvent.click(within(linhaDe('Calça')).getByRole('button', { name: 'Abrir o projeto' }));
    expect(onAbrirProjeto).toHaveBeenCalledWith('B');
    expect(within(linhaDe('Calça')).getByRole('button', { name: 'Aplicar no aberto…' })).toBeInTheDocument();
    // A Saia (projeto C) não está na Biblioteca: sem o "Abrir o projeto".
    expect(within(linhaDe('Saia')).queryByRole('button', { name: 'Abrir o projeto' })).toBeNull();
  });

  it('limpar os terminados e o relatório de eficiência', () => {
    const onExportarCsv = vi.fn();
    render(<Tela inicial={filaDeExemplo()} onExportarCsv={onExportarCsv} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Relatório de eficiência' }));
    const relatorio = screen.getByRole('region', { name: 'Relatório de eficiência' });
    expect(within(relatorio).getByText('Encaixes concluídos').nextSibling).toHaveTextContent('2');
    expect(within(relatorio).getByText('Aproveitamento médio').nextSibling).toHaveTextContent('79,8%');
    expect(within(relatorio).getByText('Melhor aproveitamento').nextSibling).toHaveTextContent('81,2%');
    expect(within(relatorio).getByText('Comprimento somado').nextSibling).toHaveTextContent('2,50 m');
    fireEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }));
    expect(onExportarCsv).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Limpar os terminados' }));
    expect(screen.getByRole('alert')).toHaveTextContent('2 encaixe(s) terminado(s) tirado(s) da fila.');
    expect(within(relatorio).getByText('Encaixes concluídos').nextSibling).toHaveTextContent('0');
  });

  it('a recusa de uma mudança aparece na janela', () => {
    render(
      <PainelDaFilaDeEncaixes
        fila={filaDeExemplo()}
        progresso={null}
        avisos={['O encaixe 3 da fila ficou de fora: sem as peças.']}
        somenteLeitura
        projetoAbertoId="A"
        projetoExiste={() => true}
        onMudar={() => {
          throw new Error('A fila de encaixes ainda está sendo lida.');
        }}
        onAplicar={() => {}}
        onAbrirProjeto={() => {}}
        onExportarCsv={() => {}}
        agoraIso={() => 'x'}
        onFechar={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Pausar a fila' }));
    expect(screen.getByRole('alert')).toHaveTextContent('A fila de encaixes ainda está sendo lida.');
    expect(screen.getByText('O encaixe 3 da fila ficou de fora: sem as peças.')).toBeInTheDocument();
    expect(screen.getByText(/versão mais nova/)).toBeInTheDocument();
  });
});

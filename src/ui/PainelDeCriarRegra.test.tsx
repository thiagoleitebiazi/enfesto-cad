import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { ponto } from '../core/geometria';
import { PainelDeCriarRegra } from './PainelDeCriarRegra';
import { regraDaTabela, type TabelaDaRegra } from './tabelaDaRegra';

const ZERO = ponto(0, 0);
// O ponto anda, no mundo, (3, 6) no G e (−3, −6) no P: na tela, DX 6 e DY 3.
const DO_PONTO = [ponto(-3, -6), ZERO, ponto(3, 6)];

function renderizar(criar: (nome: string, codigo: string, tabela: TabelaDaRegra) => string | null = () => null) {
  const onCriar = vi.fn(criar);
  const onFechar = vi.fn();
  render(<PainelDeCriarRegra nomeDaPeca="Frente" numeroDoPonto={3} tamanhos={['P', 'M', 'G']} base={1} deslocamentos={DO_PONTO} onCriar={onCriar} onFechar={onFechar} />);
  return { onCriar, onFechar };
}

const campo = (nome: string): HTMLInputElement => screen.getByLabelText<HTMLInputElement>(nome);
const botao = (nome: string): HTMLElement => screen.getByRole('button', { name: nome });
const digitar = (nome: string, texto: string): boolean => fireEvent.change(campo(nome), { target: { value: texto } });
/** O que a tabela mostra: o nome, o DX e o DY de cada linha. */
const linhas = (): string[][] =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((linha) => Array.from(linha.querySelectorAll<HTMLInputElement>('input[type=text]')).map((i) => i.value));
const escolhida = (): string => screen.getAllByRole<HTMLInputElement>('radio').find((r) => r.checked)!.getAttribute('aria-label')!;
/** A regra que a janela mandou guardar. */
const regraCriada = (onCriar: ReturnType<typeof renderizar>['onCriar']) => {
  const [nome, codigo, tabela] = onCriar.mock.calls[0]!;
  return regraDaTabela('r1', nome, codigo, tabela);
};

describe('PainelDeCriarRegra', () => {
  afterEach(() => cleanup());

  it('abre com uma linha por tamanho — o nome, o DX e o DY —, a do base fixa em zero', () => {
    renderizar();

    expect(screen.getByRole('dialog', { name: 'Criar regra' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Linha', 'Tamanho', 'DX (mm, + para a direita)', 'DY (mm, + para baixo)']);
    expect(linhas()).toEqual([
      ['P', '-6', '-3'],
      ['M', '0', '0'],
      ['G', '6', '3'],
    ]);
    expect(campo('DX do tamanho M')).toBeDisabled();
    expect(campo('DY do tamanho M')).toBeDisabled();
    expect(screen.getByText('(base)')).toBeInTheDocument();
    // Os botões agem na linha escolhida: de início, a primeira que não é a do base.
    expect(escolhida()).toBe('Escolher a linha do tamanho P');
    expect(campo('Nome da regra')).toHaveFocus();
  });

  it('guarda a regra do ponto com o nome e o código, e fecha', () => {
    const { onCriar, onFechar } = renderizar();
    digitar('Nome da regra', 'Ombro');
    digitar('Código (opcional): um rótulo curto para achar a regra', 'A1');
    fireEvent.click(botao('Criar regra'));

    expect(regraCriada(onCriar)).toEqual({ id: 'r1', nome: 'Ombro', codigo: 'A1', tamanhos: ['P', 'M', 'G'], base: 'M', deslocamentos: DO_PONTO });
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('os números e os nomes dos tamanhos se digitam na tabela', () => {
    const { onCriar } = renderizar();
    digitar('Nome da regra', 'Ombro');
    digitar('DX do tamanho G', '7,5');
    digitar('Nome do tamanho da linha 3', 'GG');
    // O rótulo dos campos acompanha o nome novo.
    digitar('DY do tamanho GG', '4');
    fireEvent.click(botao('Criar regra'));

    const regra = regraCriada(onCriar);
    expect(regra.tamanhos).toEqual(['P', 'M', 'GG']);
    expect(regra.deslocamentos[2]).toEqual(ponto(4, 7.5));
  });

  it('“Criar tamanho abaixo” põe uma linha depois da escolhida, sem nome, na proporção dos vizinhos — e ela passa a ser a escolhida', () => {
    const { onCriar } = renderizar();
    fireEvent.click(screen.getByLabelText('Escolher a linha do tamanho G'));
    fireEvent.click(botao('Criar tamanho abaixo'));

    expect(linhas()).toEqual([
      ['P', '-6', '-3'],
      ['M', '0', '0'],
      ['G', '6', '3'],
      ['', '12', '6'],
    ]);
    expect(escolhida()).toBe('Escolher a linha da linha 4');
    expect(screen.getByRole('status')).toHaveTextContent('Tamanho criado abaixo, com os números na proporção dos vizinhos: dê o nome dele e confira.');
    // A tabela vai como está para quem guarda: sem o nome do tamanho novo, ela não serve.
    digitar('Nome da regra', 'Ombro');
    fireEvent.click(botao('Criar regra'));
    expect(() => regraDaTabela('r1', ...onCriar.mock.calls[0]!)).toThrow('Dê um nome ao tamanho da linha 4.');

    digitar('Nome do tamanho da linha 4', 'GG');
    digitar('DX do tamanho GG', '13');
    fireEvent.click(botao('Criar regra'));
    expect(regraDaTabela('r1', ...onCriar.mock.calls[1]!).deslocamentos[3]).toEqual(ponto(6, 13));
  });

  it('“Criar tamanho acima” põe a linha antes da escolhida', () => {
    renderizar();
    fireEvent.click(botao('Criar tamanho acima'));

    expect(linhas()).toEqual([
      ['', '-12', '-6'],
      ['P', '-6', '-3'],
      ['M', '0', '0'],
      ['G', '6', '3'],
    ]);
    expect(escolhida()).toBe('Escolher a linha da linha 1');
    // O base continua sendo o M, agora na terceira linha.
    expect(campo('DX do tamanho M')).toBeDisabled();
  });

  it('“Excluir tamanho” tira a linha escolhida; o base não sai', () => {
    renderizar();
    fireEvent.click(botao('Excluir tamanho'));

    expect(linhas()).toEqual([
      ['M', '0', '0'],
      ['G', '6', '3'],
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('Tamanho P excluído da regra.');
    expect(escolhida()).toBe('Escolher a linha do tamanho M');
    fireEvent.click(botao('Excluir tamanho'));
    expect(screen.getByRole('alert')).toHaveTextContent('O tamanho base não pode ser excluído: defina outro como base antes.');
    expect(linhas()).toHaveLength(2);
  });

  it('excluída a última linha, a escolhida passa a ser a que ficou por último', () => {
    renderizar();
    fireEvent.click(screen.getByLabelText('Escolher a linha do tamanho G'));
    fireEvent.click(botao('Excluir tamanho'));

    expect(linhas()).toEqual([
      ['P', '-6', '-3'],
      ['M', '0', '0'],
    ]);
    expect(escolhida()).toBe('Escolher a linha do tamanho M');
  });

  it('“Definir como base” passa a contar os números do tamanho escolhido', () => {
    const { onCriar } = renderizar();
    fireEvent.click(botao('Definir como base'));

    expect(linhas()).toEqual([
      ['P', '0', '0'],
      ['M', '6', '3'],
      ['G', '12', '6'],
    ]);
    expect(campo('DX do tamanho P')).toBeDisabled();
    expect(campo('DX do tamanho M')).not.toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('O base da regra agora é o tamanho P: os números passaram a ser contados dele.');
    digitar('Nome da regra', 'Ombro');
    fireEvent.click(botao('Criar regra'));
    expect(regraCriada(onCriar).base).toBe('P');
  });

  it('“Incremental” troca os números mostrados, sem mudar a regra', () => {
    const { onCriar } = renderizar();
    fireEvent.click(screen.getByLabelText('Escolher a linha do tamanho G'));
    fireEvent.click(botao('Criar tamanho abaixo'));
    fireEvent.click(screen.getByLabelText(/^Incremental/));

    expect(linhas().map((l) => l[1])).toEqual(['-6', '0', '6', '6']);
    digitar('Nome da regra', 'Ombro');
    digitar('Nome do tamanho da linha 4', 'GG');
    digitar('DX do tamanho GG', '8');
    fireEvent.click(botao('Criar regra'));
    // 6 até o G, e mais 8 até o GG.
    expect(regraCriada(onCriar).deslocamentos.map((d) => d.y)).toEqual([-6, 0, 6, 14]);
  });

  it('“Mesmo passo em todos” leva o passo da linha escolhida para os outros tamanhos', () => {
    renderizar();
    digitar('DX do tamanho P', '-10');
    digitar('DY do tamanho P', '0');
    fireEvent.click(botao('Mesmo passo em todos'));

    expect(linhas()).toEqual([
      ['P', '-10', '0'],
      ['M', '0', '0'],
      ['G', '10', '0'],
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('Todos os tamanhos andam agora o mesmo por tamanho, pelo passo do tamanho P. Confira.');
  });

  it('o foco num campo da linha a escolhe', () => {
    renderizar();
    fireEvent.focus(campo('DX do tamanho G'));

    expect(escolhida()).toBe('Escolher a linha do tamanho G');
  });

  it('com um campo que não é número, o botão não muda a tabela e a mensagem diz qual; digitar de novo limpa a mensagem', () => {
    renderizar();
    digitar('DX do tamanho G', 'seis');
    fireEvent.click(botao('Criar tamanho abaixo'));

    expect(screen.getByRole('alert')).toHaveTextContent('O DX do tamanho G precisa ser um número em mm.');
    expect(linhas()).toHaveLength(3);
    digitar('DX do tamanho G', '6');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a mensagem de quem guarda aparece na janela, que continua aberta', () => {
    const { onFechar } = renderizar(() => 'Dê um nome à regra.');
    fireEvent.click(botao('Criar regra'));

    expect(screen.getByRole('alert')).toHaveTextContent('Dê um nome à regra.');
    expect(onFechar).not.toHaveBeenCalled();
    fireEvent.click(botao('Cancelar'));
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('a nota diz o que é leitura nossa', () => {
    renderizar();
    expect(screen.getByText(/é a nossa leitura do “mesmo DX e DY para todos” da referência/)).toBeInTheDocument();
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { ponto } from '../core/geometria';
import { criarMolde, type Molde } from '../domain/molde';
import { MONTAGEM_VAZIA, type Montagem3D } from '../domain/montagem3d';
import { MEDIDAS_DO_PUBLICO } from '../domain/manequim';
import { novaFichaTecnica, type FichaTecnica } from '../domain/fichaTecnica';
import { PainelDoProvador3D } from './PainelDoProvador3D';

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Uma peça de saia em pé na tela (a cintura de 400 mm em cima, a barra de 560 embaixo). */
function saia(id: string, nome: string): Molde {
  return criarMolde({ nome, referencia: 'S', tamanho: 'M', contorno: [ponto(0, 80), ponto(0, 480), ponto(550, 560), ponto(550, 0)], linhaDeFio: { inicio: ponto(50, 280), fim: ponto(500, 280) } }, id);
}

const FICHA: FichaTecnica = {
  ...novaFichaTecnica({ nome: 'Saia', codigo: 'S-1', pecas: [] }, '2026-10-24T18:00:00.000Z'),
  tamanhos: ['P', 'M'],
  medidas: [{ id: 'q', nome: 'Quadril', comoMedir: '', toleranciaCm: 1, valoresCm: { P: 98, M: 104 } }],
};

function abrir(opcoes: { readonly pecas?: readonly Molde[]; readonly montagem?: Montagem3D } = {}) {
  const onGuardar = vi.fn();
  const onSalvarArquivo = vi.fn(async (nome: string) => `C:\\saida\\${nome}`);
  let n = 0;
  render(
    <PainelDoProvador3D
      pecas={opcoes.pecas ?? [saia('f', 'Frente da saia'), saia('c', 'Costas da saia'), saia('b', 'Bolso')]}
      montagemGuardada={opcoes.montagem ?? MONTAGEM_VAZIA}
      ficha={FICHA}
      regrasDeCaimento={{ q: { usar: true, tipo: 'circunferencia', folgaCm: 6, peso: 2 } }}
      imagens={[]}
      nomeDoModelo="Saia"
      onGuardar={onGuardar}
      onSalvarArquivo={onSalvarArquivo}
      novoId={() => `k${++n}`}
      onFechar={() => {}}
    />,
  );
  return { onGuardar, onSalvarArquivo, ultima: (): Montagem3D => onGuardar.mock.calls.at(-1)![0] as Montagem3D };
}

const aba = (nome: RegExp | string) => fireEvent.click(screen.getByRole('tab', { name: nome }));

describe('PainelDoProvador3D', () => {
  it('as peças vão ao corpo pelo nome (a frente, as costas; o bolso fica fora), e a escolha é guardada no projeto', async () => {
    const { onGuardar, ultima } = abrir();
    expect(screen.getByLabelText('Onde vai Frente da saia')).toHaveValue('frente');
    expect(screen.getByLabelText('Onde vai Costas da saia')).toHaveValue('costas');
    expect(screen.getByLabelText('Onde vai Bolso')).toHaveValue('fora');
    expect(screen.getByLabelText('Topo de Frente da saia')).toHaveValue('cintura');
    expect(screen.getByRole('status')).toHaveTextContent('2 peça(s) em volta do corpo, 0 costura(s). Clique em Simular.');
    fireEvent.change(screen.getByLabelText('Onde vai Bolso'), { target: { value: 'lado-direito' } });
    // O bolso (largo embaixo) posto num lado fica com a ponta estreita em cima; girar 15°, virar, e voltar pela forma.
    expect(screen.getByLabelText('Giro de Bolso (graus)')).toHaveValue(0);
    fireEvent.click(screen.getByRole('button', { name: 'Girar Bolso 15° para a esquerda' }));
    fireEvent.click(screen.getByRole('button', { name: 'Girar Bolso 15° para a esquerda' }));
    expect(screen.getByLabelText('Giro de Bolso (graus)')).toHaveValue(30);
    fireEvent.click(screen.getByRole('button', { name: 'Girar Bolso 15° para a direita' }));
    fireEvent.click(screen.getByRole('button', { name: 'Virar Bolso' }));
    expect(screen.getByLabelText('Giro de Bolso (graus)')).toHaveValue(195);
    fireEvent.change(screen.getByLabelText('Giro de Bolso (graus)'), { target: { value: '-90' } });
    expect(screen.getByLabelText('Giro de Bolso (graus)')).toHaveValue(270);
    fireEvent.click(screen.getByRole('button', { name: 'Endireitar Bolso pela forma' }));
    expect(screen.getByLabelText('Giro de Bolso (graus)')).toHaveValue(0);
    fireEvent.click(screen.getByRole('button', { name: 'Virar Bolso' }));
    expect(screen.getByRole('img', { name: 'Bolso no corpo, com o alto em cima' })).toBeInTheDocument();
    await waitFor(() => expect(onGuardar).toHaveBeenCalled(), { timeout: 2000 });
    expect(ultima().pecas['b#0']).toMatchObject({ posicao: 'lado-direito', girarGraus: 180 });
  });

  it('as costuras: as sugeridas, uma feita à mão pelos pontos, inverter e tirar', async () => {
    const { ultima, onGuardar } = abrir();
    aba(/^Costuras/);
    fireEvent.click(screen.getByRole('button', { name: 'Sugerir costuras' }));
    expect(screen.getByRole('alert')).toHaveTextContent('2 costura(s) sugerida(s)');
    expect(screen.getByRole('tab', { name: 'Costuras (2)' })).toBeInTheDocument();
    // À mão: a barra da frente (2→3) com a das costas (2→3) — clicando nos pontos do contorno do lado A.
    fireEvent.change(screen.getByLabelText('Peça do lado A'), { target: { value: 'f#0' } });
    fireEvent.change(screen.getByLabelText('Peça do lado B'), { target: { value: 'c#0' } });
    const contornoA = screen.getByRole('img', { name: 'Contorno do lado A' });
    const pontosA = contornoA.querySelectorAll('.ponto-para-costura');
    fireEvent.click(pontosA[2]!);
    fireEvent.click(pontosA[3]!);
    expect(screen.getByLabelText('Lado A: do ponto')).toHaveValue(2);
    expect(screen.getByLabelText('Lado A: até o ponto')).toHaveValue(3);
    fireEvent.change(screen.getByLabelText('Lado B: do ponto'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Lado B: até o ponto'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Costurar' }));
    const itens = screen.getAllByRole('listitem');
    expect(itens).toHaveLength(3);
    expect(itens[2]).toHaveTextContent('Frente da saia 2→3 (560 mm) com Costas da saia 2→3 (560 mm)');
    const antes = itens[2]!.textContent!.includes('sentido contrário');
    fireEvent.click(within(itens[2]!).getByRole('button', { name: 'Inverter' }));
    expect(screen.getAllByRole('listitem')[2]!.textContent!.includes('sentido contrário')).toBe(!antes);
    fireEvent.click(within(screen.getAllByRole('listitem')[0]!).getByRole('button', { name: 'Tirar' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    await waitFor(() => expect(onGuardar).toHaveBeenCalled(), { timeout: 2000 });
    expect(ultima().costuras).toHaveLength(2);
    expect(ultima().costuras[1]).toMatchObject({ a: { chave: 'f#0', de: 2, ate: 3 }, b: { chave: 'c#0', de: 2, ate: 3 } });
  });

  it('a costura de uma peça que mudou avisa', () => {
    abrir({
      montagem: {
        ...MONTAGEM_VAZIA,
        costuras: [{ id: 'x', a: { chave: 'f#0', de: 1, ate: 2, assinatura: '4:9' }, b: { chave: 'sumiu#0', de: 3, ate: 0, assinatura: '4:1' }, invertida: true }],
      },
    });
    aba(/^Costuras/);
    expect(screen.getByText(/O lado A \(Frente da saia\): o molde mudou depois desta costura/)).toBeInTheDocument();
    expect(screen.getByText('O lado B: a peça não está mais no projeto.')).toBeInTheDocument();
  });

  it('o manequim: o público, uma medida, o tamanho da ficha', async () => {
    const { ultima, onGuardar } = abrir();
    aba('Manequim');
    fireEvent.change(screen.getByLabelText('Público'), { target: { value: 'masculino' } });
    expect(screen.getByLabelText('Manequim: Altura')).toHaveValue('176,0');
    fireEvent.change(screen.getByLabelText('Manequim: Cintura'), { target: { value: '90' } });
    fireEvent.change(screen.getByLabelText('No tamanho da ficha'), { target: { value: 'M' } });
    expect(screen.getByLabelText('Manequim: Quadril')).toHaveValue('98,0');
    expect(screen.getByText(/Do tamanho M da ficha .*Quadril \(Quadril\)/)).toBeInTheDocument();
    await waitFor(() => expect(onGuardar).toHaveBeenCalled(), { timeout: 2000 });
    expect(ultima().manequim).toMatchObject({ publico: 'masculino', tamanhoDaFicha: 'M', medidas: { ...MEDIDAS_DO_PUBLICO.masculino, quadrilCm: 98 } });
  });

  it('o tecido: o pronto e o personalizado', async () => {
    const { ultima, onGuardar } = abrir();
    aba('Tecido');
    fireEvent.change(screen.getByLabelText('Tecido pronto'), { target: { value: 'jeans' } });
    expect(screen.getByLabelText('Gramatura')).toHaveValue('380');
    fireEvent.change(screen.getByLabelText('Rigidez'), { target: { value: '40' } });
    expect(screen.getByLabelText('Tecido pronto')).toHaveValue('personalizado');
    await waitFor(() => expect(onGuardar).toHaveBeenCalled(), { timeout: 2000 });
    expect(ultima().tecido).toEqual({ preset: 'personalizado', pesoGm2: 380, elasticidade: 5, elasticidadeNaTrama: 12, elasticidadeNoVies: 70, rigidez: 40, atrito: 55 });
    // O viés (ADR 0120): a régua própria, com o valor do tecido.
    expect(screen.getByLabelText('No viés (45°)')).toHaveValue('70');
    fireEvent.change(screen.getByLabelText('No viés (45°)'), { target: { value: '85' } });
    await waitFor(() => expect(ultima().tecido.elasticidadeNoVies).toBe(85), { timeout: 2000 });
    expect(screen.getByLabelText('Elasticidade no fio')).toHaveValue('5');
  });

  it('sem peça no corpo, não simula; com a saia costurada, simula até assentar e diz onde a roupa ficou', async () => {
    abrir({ pecas: [saia('b', 'Bolso')] });
    expect(screen.getByRole('button', { name: 'Simular' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Nenhuma peça no corpo');
    cleanup();
    abrir({ pecas: [saia('f', 'Frente da saia'), saia('c', 'Costas da saia')] });
    aba(/^Costuras/);
    fireEvent.click(screen.getByRole('button', { name: 'Sugerir costuras' }));
    fireEvent.click(screen.getByRole('button', { name: 'Simular' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(/^Assentou em/), { timeout: 20000 });
    expect(screen.getByRole('status')).toHaveTextContent(/a maior abertura é de [0-5] mm/);
    expect(screen.getByRole('status')).toHaveTextContent(/A roupa vai de \d+ a (9\d|10[0-5]) cm do chão/);
    expect(screen.queryByText(/escorregou do corpo/)).toBeNull();
  }, 30000);
});

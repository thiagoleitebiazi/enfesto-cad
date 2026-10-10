import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { ponto, type Ponto2D } from '../core/geometria';
import { PainelDeTabelaDeGraduacao } from './PainelDeTabelaDeGraduacao';
import { PainelDeRegras } from './PainelDeRegras';
import type { ConjuntoDeRegras, RegraCadastrada } from './regrasDeGraduacao';

const ZERO = ponto(0, 0);
// O ponto anda, no mundo, (10, 20) no G e (−10, −20) no P: na tela, DX 20 e DY 10.
const REGRA = [ponto(-10, -20), ZERO, ponto(10, 20)];

function renderizar(opcoes: { copiada?: readonly Ponto2D[] | null; graduado?: boolean; aplicar?: () => string | null } = {}) {
  const onAplicar = vi.fn<(deslocamentos: readonly Ponto2D[]) => string | null>(opcoes.aplicar ?? (() => null));
  const onCopiar = vi.fn();
  const onFechar = vi.fn();
  render(
    <PainelDeTabelaDeGraduacao
      nomeDaPeca="Frente"
      numeroDoPonto={3}
      graduado={opcoes.graduado ?? true}
      tamanhos={['P', 'M', 'G']}
      base={1}
      deslocamentos={REGRA}
      copiada={opcoes.copiada ?? null}
      onCopiar={onCopiar}
      onAplicar={onAplicar}
      onFechar={onFechar}
    />,
  );
  return { onAplicar, onCopiar, onFechar };
}

const campo = (nome: string): HTMLInputElement => screen.getByLabelText<HTMLInputElement>(nome);
const aplicar = (): boolean => fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

describe('PainelDeTabelaDeGraduacao', () => {
  afterEach(() => cleanup());

  it('mostra uma linha por tamanho, com o DX e o DY de cada um como a tela os vê', () => {
    renderizar();

    expect(screen.getByRole('dialog', { name: 'Graduação do ponto 3' })).toBeInTheDocument();
    expect(screen.getByText('3 — graduado')).toBeInTheDocument();
    expect(campo('DX do tamanho P').value).toBe('-20');
    expect(campo('DY do tamanho P').value).toBe('-10');
    expect(campo('DX do tamanho G').value).toBe('20');
    expect(campo('DY do tamanho G').value).toBe('10');
  });

  it('a linha do base é fixa em zero', () => {
    renderizar();

    expect(screen.getByRole('rowheader', { name: 'M (base)' })).toBeInTheDocument();
    expect(campo('DX do tamanho M')).toBeDisabled();
    expect(campo('DX do tamanho M').value).toBe('0');
  });

  it('aplica a regra digitada, convertida para o mundo, e fecha', () => {
    const { onAplicar, onFechar } = renderizar();

    fireEvent.change(campo('DX do tamanho G'), { target: { value: '30,5' } });
    fireEvent.change(campo('DY do tamanho G'), { target: { value: '0' } });
    aplicar();

    expect(onAplicar).toHaveBeenCalledWith([ponto(-10, -20), ZERO, ponto(0, 30.5)]);
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('com Incremental, mostra e aceita a diferença para o tamanho vizinho', () => {
    render(
      <PainelDeTabelaDeGraduacao
        nomeDaPeca="Frente"
        numeroDoPonto={1}
        graduado
        tamanhos={['M', 'G', 'GG']}
        base={0}
        deslocamentos={[ZERO, ponto(0, 10), ponto(0, 25)]}
        copiada={null}
        onCopiar={() => {}}
        onAplicar={() => null}
        onFechar={() => {}}
      />,
    );
    expect(campo('DX do tamanho GG').value).toBe('25');

    fireEvent.click(screen.getByLabelText(/Incremental/));
    expect(campo('DX do tamanho G').value).toBe('10');
    expect(campo('DX do tamanho GG').value).toBe('15');

    // Mudando o incremento do GG para 20, o absoluto dele passa a 30.
    fireEvent.change(campo('DX do tamanho GG'), { target: { value: '20' } });
    fireEvent.click(screen.getByLabelText(/Incremental/));
    expect(campo('DX do tamanho GG').value).toBe('30');
  });

  it('aplicando em Incremental, a regra vai em absoluto', () => {
    const { onAplicar } = renderizar();

    fireEvent.click(screen.getByLabelText(/Incremental/));
    aplicar();

    expect(onAplicar).toHaveBeenCalledWith(REGRA);
  });

  it('não aplica com um campo que não é número, e diz qual', () => {
    const { onAplicar, onFechar } = renderizar();

    fireEvent.change(campo('DY do tamanho P'), { target: { value: 'dez' } });
    aplicar();

    expect(screen.getByRole('alert')).toHaveTextContent('O DY do tamanho P precisa ser um número em mm.');
    expect(onAplicar).not.toHaveBeenCalled();
    expect(onFechar).not.toHaveBeenCalled();
  });

  it('mostra o erro devolvido por quem aplica e continua aberto', () => {
    const { onFechar } = renderizar({ aplicar: () => 'Ponto fora do contorno da peça.' });

    aplicar();

    expect(screen.getByRole('alert')).toHaveTextContent('Ponto fora do contorno da peça.');
    expect(onFechar).not.toHaveBeenCalled();
  });

  it('Copiar entrega a regra que está na tabela, sem fechar', () => {
    const { onCopiar, onFechar } = renderizar();

    fireEvent.change(campo('DX do tamanho G'), { target: { value: '40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Copiar' }));

    expect(onCopiar).toHaveBeenCalledWith([ponto(-10, -20), ZERO, ponto(10, 40)]);
    expect(screen.getByRole('status')).toHaveTextContent('Regra copiada');
    expect(onFechar).not.toHaveBeenCalled();
  });

  it('Colar fica desligado sem regra copiada que sirva', () => {
    renderizar();

    expect(screen.getByRole('button', { name: 'Colar' })).toBeDisabled();
  });

  it('Colar preenche a tabela com a regra copiada, para conferir antes de aplicar', () => {
    const { onAplicar } = renderizar({ copiada: [ponto(-1, -2), ZERO, ponto(1, 2)] });

    fireEvent.click(screen.getByRole('button', { name: 'Colar' }));
    expect(campo('DX do tamanho G').value).toBe('2');
    expect(campo('DY do tamanho P').value).toBe('-1');
    expect(onAplicar).not.toHaveBeenCalled();

    aplicar();
    expect(onAplicar).toHaveBeenCalledWith([ponto(-1, -2), ZERO, ponto(1, 2)]);
  });

  it('no ponto proporcional, explica que os números são os da proporção', () => {
    renderizar({ graduado: false });

    expect(screen.getByText('3 — proporcional aos vizinhos')).toBeInTheDocument();
    expect(screen.getByText(/Aplicando, ele passa a ser um ponto graduado/)).toBeInTheDocument();
  });

  it('Cancelar fecha sem aplicar', () => {
    const { onAplicar, onFechar } = renderizar();

    fireEvent.click(screen.getByText('Cancelar'));

    expect(onAplicar).not.toHaveBeenCalled();
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('“Distância e ângulo” mostra e aceita a regra em distância e ângulo', () => {
    const { onAplicar } = renderizar();
    fireEvent.click(screen.getByLabelText(/Distância e ângulo/));

    // No G o ponto anda DX 20 e DY 10 (para baixo): distância √500 e ângulo de −26,57°, isto é, 333,43°.
    expect(campo('Distância do tamanho G').value).toBe('22,361');
    expect(campo('Ângulo do tamanho G').value).toBe('333,435');
    expect(screen.queryByLabelText('DX do tamanho G')).toBeNull();

    fireEvent.change(campo('Distância do tamanho G'), { target: { value: '10' } });
    fireEvent.change(campo('Ângulo do tamanho G'), { target: { value: '90' } });
    aplicar();
    // 10 mm a 90° é para cima: DY −10 na tela, que é x −10 no mundo.
    const regra = onAplicar.mock.calls[0]![0];
    expect(regra[2]!.x).toBeCloseTo(-10, 6);
    expect(regra[2]!.y).toBeCloseTo(0, 6);
  });

  it('de volta para DX e DY, os números são os mesmos de antes', () => {
    renderizar();
    fireEvent.click(screen.getByLabelText(/Distância e ângulo/));
    fireEvent.click(screen.getByLabelText(/Distância e ângulo/));

    expect(Number(campo('DX do tamanho G').value.replace(',', '.'))).toBeCloseTo(20, 2);
    expect(Number(campo('DY do tamanho G').value.replace(',', '.'))).toBeCloseTo(10, 2);
  });

  it('o ângulo que não é número é recusado com a unidade certa', () => {
    renderizar();
    fireEvent.click(screen.getByLabelText(/Distância e ângulo/));
    fireEvent.change(campo('Ângulo do tamanho P'), { target: { value: 'x' } });
    aplicar();

    expect(screen.getByRole('alert')).toHaveTextContent('O ângulo do tamanho P precisa ser um número em graus.');
  });

  it('uma seta preenche a coluna com o valor por tamanho, os maiores para o lado dela', () => {
    const { onAplicar } = renderizar();
    fireEvent.change(campo('Valor da seta (mm por tamanho)'), { target: { value: '7' } });
    fireEvent.click(screen.getByRole('button', { name: 'Seta para a direita' }));

    expect(campo('DX do tamanho P').value).toBe('-7');
    expect(campo('DX do tamanho G').value).toBe('7');
    // A outra coluna fica como estava.
    expect(campo('DY do tamanho G').value).toBe('10');
    expect(screen.getByRole('status')).toHaveTextContent('DX preenchido: 7 mm por tamanho, com os tamanhos maiores para a direita.');

    fireEvent.click(screen.getByRole('button', { name: 'Seta para cima' }));
    expect(campo('DY do tamanho G').value).toBe('-7');
    aplicar();
    expect(onAplicar).toHaveBeenCalledWith([ponto(7, -7), ZERO, ponto(-7, 7)]);
  });

  it('sem valor, a seta pede o valor; o zero zera a graduação do ponto', () => {
    const { onAplicar } = renderizar();
    fireEvent.click(screen.getByRole('button', { name: 'Seta para baixo' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Digite o valor da seta');

    fireEvent.click(screen.getByRole('button', { name: 'Zerar a graduação do ponto' }));
    expect(campo('DX do tamanho G').value).toBe('0');
    expect(campo('DY do tamanho P').value).toBe('0');
    aplicar();
    expect(onAplicar).toHaveBeenCalledWith([ZERO, ZERO, ZERO]);
  });
});

describe('PainelDeRegras', () => {
  afterEach(() => cleanup());

  const OMBRO: RegraCadastrada = { id: 'r1', nome: 'Ombro', tamanhos: ['P', 'M', 'G'], base: 'M', deslocamentos: [ponto(-3, -6), ZERO, ponto(3, 6)] };
  const CAVA: RegraCadastrada = { id: 'r2', nome: 'Cava', tamanhos: ['P', 'M', 'G'], base: 'M', deslocamentos: [ponto(0, -4), ZERO, ponto(0, 4)] };

  function renderizarRegras(regras: readonly RegraCadastrada[], idInicial: string | null = null) {
    const onEscolher = vi.fn();
    const onExcluir = vi.fn();
    const onFechar = vi.fn();
    render(<PainelDeRegras regras={regras} idInicial={idInicial} onEscolher={onEscolher} onExcluir={onExcluir} onFechar={onFechar} />);
    return { onEscolher, onExcluir, onFechar };
  }

  it('sem regras, diz como criar uma e não deixa confirmar', () => {
    renderizarRegras([]);

    expect(screen.getByText(/Nenhuma regra cadastrada ainda/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar esta regra' })).toBeDisabled();
  });

  it('lista as regras com os tamanhos e o que o ponto anda no maior', () => {
    renderizarRegras([OMBRO, CAVA]);

    expect(screen.getByText('Ombro')).toBeInTheDocument();
    expect(screen.getByText('P, M, G (base M) — no G: DX 6,0 mm, DY 3,0 mm')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(2);
  });

  it('confirma com a regra escolhida — a primeira, ou a usada da última vez', () => {
    const primeira = renderizarRegras([OMBRO, CAVA]);
    fireEvent.click(screen.getByRole('button', { name: 'Usar esta regra' }));
    expect(primeira.onEscolher).toHaveBeenCalledWith(OMBRO);
    expect(primeira.onFechar).toHaveBeenCalledTimes(1);
    cleanup();

    const lembrada = renderizarRegras([OMBRO, CAVA], 'r2');
    fireEvent.click(screen.getByRole('button', { name: 'Usar esta regra' }));
    expect(lembrada.onEscolher).toHaveBeenCalledWith(CAVA);
  });

  it('escolhe outra regra pela lista', () => {
    const { onEscolher } = renderizarRegras([OMBRO, CAVA]);

    fireEvent.click(screen.getAllByRole('radio')[1]!);
    fireEvent.click(screen.getByRole('button', { name: 'Usar esta regra' }));

    expect(onEscolher).toHaveBeenCalledWith(CAVA);
  });

  it('Excluir tira a regra do cadastro, sem fechar', () => {
    const { onExcluir, onFechar } = renderizarRegras([OMBRO, CAVA]);

    fireEvent.click(screen.getByRole('button', { name: 'Excluir a regra Ombro' }));

    expect(onExcluir).toHaveBeenCalledWith('r1');
    expect(onFechar).not.toHaveBeenCalled();
  });
});

describe('PainelDeRegras: código e conjuntos de regras', () => {
  afterEach(() => cleanup());

  const OMBRO: RegraCadastrada = { id: 'r1', nome: 'Ombro', codigo: 'A12', tamanhos: ['P', 'M', 'G'], base: 'M', deslocamentos: [ponto(-3, -6), ZERO, ponto(3, 6)] };
  const CAVA: RegraCadastrada = { id: 'r2', nome: 'Cava', tamanhos: ['P', 'M', 'G'], base: 'M', deslocamentos: [ponto(0, -4), ZERO, ponto(0, 4)] };
  const BLUSA: ConjuntoDeRegras = { id: 'c1', nome: 'Blusa', regras: ['r2', 'r1'] };

  function renderizarComConjuntos(conjuntos: readonly ConjuntoDeRegras[], criar: (nome: string, regras: readonly string[]) => string | null = () => null) {
    const onEscolher = vi.fn();
    const onEscolherConjunto = vi.fn();
    const onCriarConjunto = vi.fn(criar);
    const onExcluirConjunto = vi.fn();
    const onFechar = vi.fn();
    render(
      <PainelDeRegras
        regras={[OMBRO, CAVA]}
        idInicial={null}
        onEscolher={onEscolher}
        onExcluir={vi.fn()}
        onFechar={onFechar}
        conjuntos={conjuntos}
        onEscolherConjunto={onEscolherConjunto}
        onCriarConjunto={onCriarConjunto}
        onExcluirConjunto={onExcluirConjunto}
      />,
    );
    return { onEscolher, onEscolherConjunto, onCriarConjunto, onExcluirConjunto, onFechar };
  }

  it('a regra com código mostra o código na lista', () => {
    renderizarComConjuntos([]);
    expect(screen.getByText('código A12 — P, M, G (base M) — no G: DX 6,0 mm, DY 3,0 mm')).toBeInTheDocument();
  });

  it('em “Conjunto de regras”, lista os conjuntos com as regras na ordem e usa o escolhido', () => {
    const { onEscolherConjunto, onEscolher, onFechar } = renderizarComConjuntos([BLUSA]);
    fireEvent.click(screen.getByLabelText('Conjunto de regras'));

    expect(screen.getByText('Blusa')).toBeInTheDocument();
    expect(screen.getByText('1. Cava · 2. Ombro')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Usar este conjunto' }));
    expect(onEscolherConjunto).toHaveBeenCalledWith(BLUSA);
    expect(onEscolher).not.toHaveBeenCalled();
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('monta um conjunto novo com as regras na ordem em que foram marcadas', () => {
    const { onCriarConjunto } = renderizarComConjuntos([]);
    fireEvent.click(screen.getByLabelText('Conjunto de regras'));
    expect(screen.getByText(/Nenhum conjunto cadastrado ainda/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar este conjunto' })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Nome do conjunto'), { target: { value: 'Calça' } });
    fireEvent.click(screen.getByLabelText('Cava'));
    fireEvent.click(screen.getByLabelText('Ombro'));
    expect(screen.getByLabelText('1. Cava')).toBeChecked();
    expect(screen.getByLabelText('2. Ombro')).toBeChecked();
    fireEvent.click(screen.getByRole('button', { name: 'Criar conjunto' }));

    expect(onCriarConjunto).toHaveBeenCalledWith('Calça', ['r2', 'r1']);
  });

  it('o conjunto que acabou de ser criado já fica escolhido, pronto para usar', () => {
    // O painel abre sem conjuntos; quem cuida do cadastro devolve a lista com o novo.
    const propriedades = { regras: [OMBRO, CAVA], idInicial: null, onEscolher: vi.fn(), onExcluir: vi.fn(), onFechar: vi.fn(), onCriarConjunto: () => null, onExcluirConjunto: vi.fn() };
    const onEscolherConjunto = vi.fn();
    const { rerender } = render(<PainelDeRegras {...propriedades} conjuntos={[]} onEscolherConjunto={onEscolherConjunto} />);
    fireEvent.click(screen.getByLabelText('Conjunto de regras'));
    expect(screen.getByRole('button', { name: 'Usar este conjunto' })).toBeDisabled();

    rerender(<PainelDeRegras {...propriedades} conjuntos={[BLUSA]} onEscolherConjunto={onEscolherConjunto} />);
    expect(screen.getByRole('button', { name: 'Usar este conjunto' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Usar este conjunto' }));
    expect(onEscolherConjunto).toHaveBeenCalledWith(BLUSA);
  });

  it('o erro de criar aparece no painel; excluir um conjunto avisa quem cuida do cadastro', () => {
    const { onExcluirConjunto } = renderizarComConjuntos([BLUSA], () => 'Dê um nome ao conjunto.');
    fireEvent.click(screen.getByLabelText('Conjunto de regras'));
    fireEvent.click(screen.getByRole('button', { name: 'Criar conjunto' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Dê um nome ao conjunto.');

    fireEvent.click(screen.getByRole('button', { name: 'Excluir o conjunto Blusa' }));
    expect(onExcluirConjunto).toHaveBeenCalledWith('c1');
  });
});

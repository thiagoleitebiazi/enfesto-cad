import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { ponto } from '../core/geometria';
import { criarMolde, type Molde } from '../domain/molde';
import { definirTamanhosDoMolde } from '../domain/tamanhosGraduados';
import { definirLinhaDeSimetria } from '../domain/anotacoes';
import { PainelDeNesting, type OpcoesAvancadasDeNesting } from './PainelDeNesting';

const RETANGULO = [ponto(0, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)];

function molde(nome: string, id: string, tamanho = ''): Molde {
  return criarMolde({ nome, referencia: 'REF', tamanho, contorno: RETANGULO, linhaDeFio: { inicio: ponto(50, 50), fim: ponto(50, 250) } }, id);
}

function renderizar(pecas: readonly Molde[]) {
  const onCalcular = vi.fn<(opcoes: OpcoesAvancadasDeNesting) => void>();
  render(
    <PainelDeNesting
      pecas={pecas}
      executando={false}
      progresso={null}
      resultado={null}
      onCalcular={onCalcular}
      onCancelar={() => {}}
      onAplicar={() => {}}
      onFechar={() => {}}
    />,
  );
  return { onCalcular };
}

const linhaDa = (nome: string): HTMLElement => screen.getByRole('cell', { name: nome }).closest('tr')!;
const calcular = (): boolean => fireEvent.click(screen.getByRole('button', { name: 'Calcular encaixe' }));

describe('PainelDeNesting: tamanhos das peças graduadas', () => {
  afterEach(() => cleanup());

  it('sem peças graduadas, não oferece a opção e mostra o tamanho de cada peça', () => {
    const { onCalcular } = renderizar([molde('Frente', 'f', 'M'), molde('Bolso', 'b')]);

    expect(screen.queryByLabelText(/Encaixar todos os tamanhos/)).not.toBeInTheDocument();
    expect(within(linhaDa('Frente')).getByText('M')).toBeInTheDocument();
    expect(within(linhaDa('Bolso')).getByText('—')).toBeInTheDocument();

    calcular();
    expect(onCalcular).toHaveBeenCalledWith({});
  });

  it('com peça graduada, vem marcado para encaixar todos os tamanhos, e a tabela mostra quais', () => {
    const graduada = definirTamanhosDoMolde(molde('Frente', 'f', 'M'), ['P', 'M', 'G'], 'M');
    const { onCalcular } = renderizar([graduada, molde('Bolso', 'b', 'U')]);

    expect(screen.getByLabelText(/Encaixar todos os tamanhos/)).toBeChecked();
    expect(within(linhaDa('Frente')).getByText('P, M, G')).toBeInTheDocument();
    expect(screen.getByText(/Cada tamanho entra como uma peça própria/)).toBeInTheDocument();

    calcular();
    expect(onCalcular).toHaveBeenCalledWith({ todosOsTamanhos: true });
  });

  it('desmarcando, só o tamanho base entra', () => {
    const graduada = definirTamanhosDoMolde(molde('Frente', 'f', 'M'), ['P', 'M', 'G'], 'M');
    const { onCalcular } = renderizar([graduada]);

    fireEvent.click(screen.getByLabelText(/Encaixar todos os tamanhos/));

    expect(within(linhaDa('Frente')).getByText('M')).toBeInTheDocument();
    expect(screen.getByText(/Só o tamanho base de cada peça graduada entra no encaixe/)).toBeInTheDocument();
    calcular();
    expect(onCalcular).toHaveBeenCalledWith({ todosOsTamanhos: false });
  });
});

describe('PainelDeNesting: peças com linha de simetria', () => {
  afterEach(() => cleanup());

  it('sem peça com linha de simetria, a opção não aparece', () => {
    renderizar([molde('Frente', 'f', 'M')]);

    expect(screen.queryByLabelText(/Abrir as peças com linha de simetria/)).not.toBeInTheDocument();
  });

  it('com peça dobrada, vem marcado para abrir, e diz o que acontece ao aplicar', () => {
    const { onCalcular } = renderizar([definirLinhaDeSimetria(molde('Frente', 'f', 'M'), 3), molde('Bolso', 'b')]);

    expect(screen.getByLabelText(/Abrir as peças com linha de simetria/)).toBeChecked();
    expect(screen.getByText(/entra no encaixe aberta, inteira/)).toBeInTheDocument();

    calcular();
    expect(onCalcular).toHaveBeenCalledWith({ abrirSimetrias: true });
  });

  it('desmarcando, a peça entra como está desenhada', () => {
    const { onCalcular } = renderizar([definirLinhaDeSimetria(molde('Frente', 'f', 'M'), 3)]);

    fireEvent.click(screen.getByLabelText(/Abrir as peças com linha de simetria/));

    expect(screen.getByText(/entra como está desenhada: meia peça/)).toBeInTheDocument();
    calcular();
    expect(onCalcular).toHaveBeenCalledWith({ abrirSimetrias: false });
  });

  it('a marca que deixou de valer (a aresta mudou) não oferece a opção', () => {
    const marcada = definirLinhaDeSimetria(molde('Frente', 'f', 'M'), 3);
    renderizar([{ ...marcada, contorno: [ponto(-20, 0), ponto(200, 0), ponto(200, 300), ponto(0, 300)] }]);

    expect(screen.queryByLabelText(/Abrir as peças com linha de simetria/)).not.toBeInTheDocument();
  });
});

describe('PainelDeNesting: o tecido de sentido único', () => {
  afterEach(() => cleanup());

  it('a tabela mostra as rotações que o encaixe vai usar, e a nota diz por quê', () => {
    const livre = { ...molde('Frente', 'f'), restricaoDeRotacao: { permite180: true, permite90e270: true } };
    render(
      <PainelDeNesting
        pecas={[livre]}
        sentidoDoTecido={{ nome: 'Veludo', sentido: 'tem pelo' }}
        executando={false}
        progresso={null}
        resultado={null}
        onCalcular={() => {}}
        onCancelar={() => {}}
        onAplicar={() => {}}
        onFechar={() => {}}
      />,
    );
    expect(within(linhaDa('Frente')).getByText('0°, 90°')).toBeInTheDocument();
    expect(screen.getByText(/O tecido “Veludo” tem pelo: o encaixe não vira peças 180° nem 270°/)).toBeInTheDocument();
  });

  it('sem sentido único, as rotações da peça, todas', () => {
    renderizar([{ ...molde('Frente', 'f'), restricaoDeRotacao: { permite180: true, permite90e270: true } }]);
    expect(within(linhaDa('Frente')).getByText('0°, 90°, 180°, 270°')).toBeInTheDocument();
    expect(screen.queryByText(/não vira peças/)).toBeNull();
  });
});

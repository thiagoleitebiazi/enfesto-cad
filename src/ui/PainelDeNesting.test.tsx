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
      distanciaEntreMoldesMm={3}
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
    expect(within(linhaDa('Bolso')).getAllByRole('cell')[1]).toHaveTextContent('—');

    calcular();
    expect(onCalcular).toHaveBeenCalledWith({ distanciaEntreMoldesMm: 3 });
  });

  it('com peça graduada, vem marcado para encaixar todos os tamanhos, e a tabela mostra quais', () => {
    const graduada = definirTamanhosDoMolde(molde('Frente', 'f', 'M'), ['P', 'M', 'G'], 'M');
    const { onCalcular } = renderizar([graduada, molde('Bolso', 'b', 'U')]);

    expect(screen.getByLabelText(/Encaixar todos os tamanhos/)).toBeChecked();
    expect(within(linhaDa('Frente')).getByText('P, M, G')).toBeInTheDocument();
    expect(screen.getByText(/Cada tamanho entra como uma peça própria/)).toBeInTheDocument();

    calcular();
    expect(onCalcular).toHaveBeenCalledWith({ todosOsTamanhos: true, distanciaEntreMoldesMm: 3 });
  });

  it('desmarcando, só o tamanho base entra', () => {
    const graduada = definirTamanhosDoMolde(molde('Frente', 'f', 'M'), ['P', 'M', 'G'], 'M');
    const { onCalcular } = renderizar([graduada]);

    fireEvent.click(screen.getByLabelText(/Encaixar todos os tamanhos/));

    expect(within(linhaDa('Frente')).getByText('M')).toBeInTheDocument();
    expect(screen.getByText(/Só o tamanho base de cada peça graduada entra no encaixe/)).toBeInTheDocument();
    calcular();
    expect(onCalcular).toHaveBeenCalledWith({ todosOsTamanhos: false, distanciaEntreMoldesMm: 3 });
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
    expect(onCalcular).toHaveBeenCalledWith({ abrirSimetrias: true, distanciaEntreMoldesMm: 3 });
  });

  it('desmarcando, a peça entra como está desenhada', () => {
    const { onCalcular } = renderizar([definirLinhaDeSimetria(molde('Frente', 'f', 'M'), 3)]);

    fireEvent.click(screen.getByLabelText(/Abrir as peças com linha de simetria/));

    expect(screen.getByText(/entra como está desenhada: meia peça/)).toBeInTheDocument();
    calcular();
    expect(onCalcular).toHaveBeenCalledWith({ abrirSimetrias: false, distanciaEntreMoldesMm: 3 });
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
        distanciaEntreMoldesMm={3}
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

describe('PainelDeNesting: a distância entre os moldes', () => {
  afterEach(() => cleanup());

  it('começa com a do enfesto e vai, lida com vírgula, para o cálculo', () => {
    const { onCalcular } = renderizar([molde('Frente', 'f')]);
    const campo = screen.getByLabelText('Distância entre os moldes (mm)');
    expect(campo).toHaveValue('3');
    fireEvent.change(campo, { target: { value: '2,5' } });
    calcular();
    expect(onCalcular).toHaveBeenCalledWith({ distanciaEntreMoldesMm: 2.5 });
  });

  it('o que não é número, ou é negativo, é recusado: o botão fica desligado', () => {
    const { onCalcular } = renderizar([molde('Frente', 'f')]);
    const campo = screen.getByLabelText('Distância entre os moldes (mm)');
    for (const valor of ['', 'abc', '-1']) {
      fireEvent.change(campo, { target: { value: valor } });
      expect(screen.getByRole('alert')).toHaveTextContent('A distância entre os moldes precisa ser um número de 0 mm para cima.');
      expect(screen.getByRole('button', { name: 'Calcular encaixe' })).toBeDisabled();
    }
    calcular();
    expect(onCalcular).not.toHaveBeenCalled();
  });
});

describe('PainelDeNesting — o método do encaixe', () => {
  it('o de sempre (a busca em grade) não muda nada; o dos pontos de canto vai junto, e a janela explica cada um', () => {
    const { onCalcular } = renderizar([molde('Frente', 'f', 'M')]);
    expect(screen.getByText(/até 20 000 posições por peça/)).toBeInTheDocument();
    calcular();
    expect(onCalcular).toHaveBeenLastCalledWith({ distanciaEntreMoldesMm: 3 });
    fireEvent.change(screen.getByLabelText('Método do encaixe'), { target: { value: 'pontos-de-canto' } });
    expect(screen.getByText(/A meta de aproveitamento não vale neste método/)).toBeInTheDocument();
    calcular();
    expect(onCalcular).toHaveBeenLastCalledWith({ distanciaEntreMoldesMm: 3, metodo: 'pontos-de-canto' });
  });
});

describe('PainelDeNesting — o resultado, com os números em português', () => {
  it('o comprimento usado e o aproveitamento com vírgula decimal', () => {
    render(
      <PainelDeNesting
        pecas={[molde('Frente', 'f')]}
        distanciaEntreMoldesMm={3}
        executando={false}
        progresso={null}
        resultado={{
          pecasColocadas: [],
          pecasNaoColocadas: [],
          comprimentoUtilizadoMm: 1234.56,
          areaOcupadaMm2: 0,
          aproveitamentoPercentual: 74.35,
          tempoDeProcessamentoMs: 12,
          interrompido: false,
          paradaPorTempoLimite: false,
          paradaPorMetaDeAproveitamento: false,
        }}
        onCalcular={() => {}}
        onCancelar={() => {}}
        onAplicar={() => {}}
        onFechar={() => {}}
      />,
    );
    const valor = (rotulo: string) => screen.getByText(rotulo, { selector: 'dt' }).nextElementSibling!.textContent;
    expect(valor('Comprimento utilizado')).toBe('1234,6 mm');
    expect(valor('Aproveitamento')).toBe('74,3%');
  });
});

describe('PainelDeNesting: pôr na fila (ADR 0102)', () => {
  afterEach(() => cleanup());

  it('"Pôr na fila" manda as mesmas opções do calcular; sem a fila ligada, o botão não aparece', () => {
    const onCalcular = vi.fn();
    const onPorNaFila = vi.fn<(opcoes: OpcoesAvancadasDeNesting) => void>();
    const props = {
      pecas: [molde('Frente', 'f', 'M')],
      distanciaEntreMoldesMm: 3,
      executando: false,
      progresso: null,
      resultado: null,
      onCalcular,
      onCancelar: () => {},
      onAplicar: () => {},
      onFechar: () => {},
    };
    render(<PainelDeNesting {...props} />);
    expect(screen.queryByRole('button', { name: 'Pôr na fila' })).toBeNull();

    cleanup();
    render(<PainelDeNesting {...props} onPorNaFila={onPorNaFila} />);
    fireEvent.change(screen.getByLabelText('Método do encaixe'), { target: { value: 'pontos-de-canto' } });
    fireEvent.change(screen.getByLabelText('Limite de tempo (minutos)'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Pôr na fila' }));
    expect(onPorNaFila).toHaveBeenCalledWith({ limiteDeTempoMinutos: 2, distanciaEntreMoldesMm: 3, metodo: 'pontos-de-canto' });
    expect(onCalcular).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Distância entre os moldes (mm)'), { target: { value: '-1' } });
    expect(screen.getByRole('button', { name: 'Pôr na fila' })).toBeDisabled();
  });
});

describe('PainelDeNesting: os grupos do encaixe (ADR 0103)', () => {
  afterEach(() => cleanup());

  const comGrupo = (m: Molde, grupo: string): Molde => ({ ...m, grupoDoEncaixe: grupo });
  const base = {
    distanciaEntreMoldesMm: 3,
    executando: false,
    progresso: null,
    resultado: null,
    onCalcular: () => {},
    onCancelar: () => {},
    onAplicar: () => {},
    onFechar: () => {},
  };

  it('a coluna Grupo muda o grupo da peça; a nota diz a ordem dos grupos (as sem grupo por último)', () => {
    const onAlterarGrupo = vi.fn();
    render(<PainelDeNesting {...base} pecas={[molde('Frente', 'f', 'M'), comGrupo(molde('Gola', 'g', 'M'), 'Entretela')]} onAlterarGrupo={onAlterarGrupo} />);
    expect(screen.getByLabelText('Grupo de Gola')).toHaveValue('Entretela');
    fireEvent.change(screen.getByLabelText('Grupo de Frente'), { target: { value: 'Forro' } });
    expect(onAlterarGrupo).toHaveBeenCalledWith('f', 'Forro');
    expect(screen.getByText(/nesta ordem: Entretela → as sem grupo/)).toBeInTheDocument();
  });

  it('sem grupos, a nota explica o que é o grupo; sem quem mude, a coluna só mostra', () => {
    render(<PainelDeNesting {...base} pecas={[molde('Frente', 'f', 'M')]} />);
    expect(screen.getByText(/as peças com o mesmo grupo \(por exemplo, “Entretela”\) saem juntas/)).toBeInTheDocument();
    expect(screen.queryByLabelText('Grupo de Frente')).toBeNull();
    expect(within(linhaDa('Frente')).getAllByRole('cell').at(-1)).toHaveTextContent('—');
  });

  it('o resultado diz o trecho de cada grupo', () => {
    render(
      <PainelDeNesting
        {...base}
        pecas={[molde('Frente', 'f', 'M')]}
        resultado={{
          pecasColocadas: [],
          pecasNaoColocadas: [],
          comprimentoUtilizadoMm: 1500,
          areaOcupadaMm2: 0,
          aproveitamentoPercentual: 70,
          tempoDeProcessamentoMs: 12,
          interrompido: false,
          paradaPorTempoLimite: false,
          paradaPorMetaDeAproveitamento: false,
          blocosDosGrupos: [
            { grupo: 'Entretela', inicioMm: 4, fimMm: 612.5, pecas: 4 },
            { grupo: '', inicioMm: 617.5, fimMm: 1500, pecas: 2 },
          ],
        }}
      />,
    );
    const trechos = screen.getByText('Trechos dos grupos', { selector: 'dt' }).nextElementSibling!;
    expect(within(trechos as HTMLElement).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Entretela: de 4,0 a 612,5 mm (4 peça(s))',
      'Sem grupo: de 617,5 a 1500,0 mm (2 peça(s))',
    ]);
  });
});

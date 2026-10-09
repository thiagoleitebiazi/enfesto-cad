import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { DialogoDeCampos, type CampoDoDialogo, type ValoresDoDialogo } from './DialogoDeCampos';

const CAMPOS: readonly CampoDoDialogo[] = [
  { tipo: 'medida', id: 'largura', rotulo: 'Largura (mm)', inicial: '30' },
  { tipo: 'inteiro', id: 'dobras', rotulo: 'Número de dobras', inicial: '1' },
  { tipo: 'texto', id: 'nome', rotulo: 'Nome', inicial: 'Barra' },
  { tipo: 'caixa', id: 'piques', rotulo: 'Marcar com piques', inicial: true },
  {
    tipo: 'escolha',
    id: 'lado',
    rotulo: 'Lado',
    opcoes: [
      { valor: 'direita', rotulo: 'Para a direita' },
      { valor: 'esquerda', rotulo: 'Para a esquerda' },
    ],
    inicial: 'direita',
  },
];

function renderizar(onAplicar: (valores: ValoresDoDialogo) => string | null = () => null) {
  const aplicar = vi.fn(onAplicar);
  const fechar = vi.fn();
  render(
    <DialogoDeCampos
      titulo="Bainha"
      resumo={[['Peça', 'Frente']]}
      campos={CAMPOS}
      nota="A bainha dobra para dentro."
      rotuloDoBotao="Criar bainha"
      onAplicar={aplicar}
      onFechar={fechar}
    />,
  );
  return { aplicar, fechar };
}

const aplicar = (): boolean => fireEvent.click(screen.getByRole('button', { name: 'Criar bainha' }));

describe('DialogoDeCampos', () => {
  afterEach(() => cleanup());

  it('mostra o título, o resumo, os campos com os valores iniciais e a nota', () => {
    renderizar();

    expect(screen.getByRole('dialog', { name: 'Bainha' })).toBeInTheDocument();
    expect(screen.getByText('Frente')).toBeInTheDocument();
    expect(screen.getByLabelText('Largura (mm)')).toHaveValue('30');
    expect(screen.getByLabelText('Número de dobras')).toHaveValue('1');
    expect(screen.getByLabelText('Marcar com piques')).toBeChecked();
    expect(screen.getByLabelText('Para a direita')).toBeChecked();
    expect(screen.getByText('A bainha dobra para dentro.')).toBeInTheDocument();
  });

  it('entrega números nas medidas e contagens (com vírgula decimal), texto, caixa e escolha, e fecha', () => {
    const { aplicar: onAplicar, fechar } = renderizar();
    fireEvent.change(screen.getByLabelText('Largura (mm)'), { target: { value: '12,5' } });
    fireEvent.change(screen.getByLabelText('Número de dobras'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: '  Barra dupla ' } });
    fireEvent.click(screen.getByLabelText('Marcar com piques'));
    fireEvent.click(screen.getByLabelText('Para a esquerda'));

    aplicar();

    expect(onAplicar).toHaveBeenCalledExactlyOnceWith({
      largura: 12.5,
      dobras: 2,
      nome: 'Barra dupla',
      piques: false,
      lado: 'esquerda',
    });
    expect(fechar).toHaveBeenCalledTimes(1);
  });

  it('não aplica com medida vazia ou que não é número, e diz qual campo', () => {
    const { aplicar: onAplicar } = renderizar();

    fireEvent.change(screen.getByLabelText('Largura (mm)'), { target: { value: '' } });
    aplicar();
    expect(screen.getByRole('alert')).toHaveTextContent('"Largura (mm)" precisa ser um número.');

    fireEvent.change(screen.getByLabelText('Largura (mm)'), { target: { value: 'trinta' } });
    aplicar();
    expect(screen.getByRole('alert')).toHaveTextContent('"Largura (mm)" precisa ser um número.');
    expect(onAplicar).not.toHaveBeenCalled();
  });

  it('contagem precisa ser um número inteiro, e o texto não pode ficar vazio', () => {
    const { aplicar: onAplicar } = renderizar();

    fireEvent.change(screen.getByLabelText('Número de dobras'), { target: { value: '1,5' } });
    aplicar();
    expect(screen.getByRole('alert')).toHaveTextContent('"Número de dobras" precisa ser um número inteiro.');

    fireEvent.change(screen.getByLabelText('Número de dobras'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: '   ' } });
    aplicar();
    expect(screen.getByRole('alert')).toHaveTextContent('Preencha "Nome".');
    expect(onAplicar).not.toHaveBeenCalled();
  });

  it('mostra o erro devolvido por quem aplica e continua aberto; mexer num campo limpa o erro', () => {
    const { fechar } = renderizar(() => 'A largura precisa ser maior que zero.');

    aplicar();
    expect(screen.getByRole('alert')).toHaveTextContent('maior que zero');
    expect(fechar).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText('Largura (mm)'), { target: { value: '40' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('Cancelar fecha sem aplicar', () => {
    const { aplicar: onAplicar, fechar } = renderizar();

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onAplicar).not.toHaveBeenCalled();
    expect(fechar).toHaveBeenCalledTimes(1);
  });
});

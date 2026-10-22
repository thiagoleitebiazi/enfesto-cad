import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ponto } from '../core/geometria';
import { criarMolde } from '../domain/molde';
import { PainelDePecas, PainelDePropriedades } from './PainelLateral';

afterEach(() => cleanup());

describe('PainelDePecas — a lista de peças', () => {
  it('vazia: diz que não há peça e como começar (importar um molde ou desenhar)', () => {
    render(<PainelDePecas pecas={[]} selecionadoId={null} onSelecionar={() => {}} />);
    expect(screen.getByText('Nenhuma peça no projeto.')).toBeInTheDocument();
    expect(screen.getByText(/Para começar, importe um molde \(aba Encaixe › Importar DXF ou Importar PDF\)/)).toBeInTheDocument();
  });

  it('com peças: a lista, sem a dica de começar', () => {
    const peca = criarMolde({ nome: 'Frente', referencia: '', tamanho: 'M', contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 50), ponto(0, 50)], linhaDeFio: { inicio: ponto(10, 25), fim: ponto(90, 25) } }, 'f');
    render(<PainelDePecas pecas={[peca]} selecionadoId={null} onSelecionar={() => {}} />);
    expect(screen.getByRole('list')).toHaveTextContent('Frente');
    expect(screen.queryByText(/Para começar/)).toBeNull();
  });
});

describe('PainelDePropriedades — os números em português', () => {
  it('ângulo, largura, altura e área com vírgula decimal (antes: 12.5°, 100.3 mm, 50.6 cm²)', () => {
    const peca = criarMolde(
      { nome: 'Frente', referencia: '', tamanho: 'M', contorno: [ponto(0, 0), ponto(100.26, 0), ponto(100.26, 50.44), ponto(0, 50.44)], linhaDeFio: { inicio: ponto(10, 25), fim: ponto(90, 25) } },
      'f',
    );
    render(<PainelDePropriedades peca={{ ...peca, anguloDeRotacaoGraus: 12.5 }} onAlterar={() => {}} onGirar={() => {}} />);
    const valor = (rotulo: string) => screen.getByText(rotulo, { selector: 'dt' }).nextElementSibling!.textContent;
    expect(valor('Ângulo atual')).toBe('12,5°');
    expect(valor('Largura')).toBe('100,3 mm');
    expect(valor('Altura')).toBe('50,4 mm');
    expect(valor('Área')).toBe('50,6 cm²');
    expect(screen.getByText('Ângulo atual').closest('dl')!.textContent).not.toMatch(/\d\.\d/);
  });
});

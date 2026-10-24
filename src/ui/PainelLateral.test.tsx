import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ponto } from '../core/geometria';
import { criarMolde } from '../domain/molde';
import { PainelDePecas, PainelDePropriedades } from './PainelLateral';

afterEach(() => cleanup());

describe('PainelDePecas — a lista de peças', () => {
  it('vazia: diz que não há peça e como começar (importar um molde ou desenhar)', () => {
    render(<PainelDePecas pecas={[]} selecionadoId={null} onSelecionar={() => {}} />);
    expect(screen.getByText('Nenhuma peça no projeto.')).toBeInTheDocument();
    expect(screen.getByText(/Para começar, importe um molde \(aba Início › Importar DXF ou Importar PDF\)/)).toBeInTheDocument();
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

describe('o grupo do encaixe da peça (ADR 0103)', () => {
  const peca = criarMolde({ nome: 'Gola', referencia: '', tamanho: 'M', contorno: [ponto(0, 0), ponto(100, 0), ponto(100, 50), ponto(0, 50)], linhaDeFio: { inicio: ponto(10, 25), fim: ponto(90, 25) } }, 'g');

  it('nas Propriedades: o campo com os grupos já usados sugeridos; mudar manda o texto como digitado', () => {
    const mudancas: unknown[] = [];
    render(<PainelDePropriedades peca={{ ...peca, grupoDoEncaixe: 'Entretela' }} gruposDoEncaixe={['Entretela', 'Forro']} onAlterar={(p) => mudancas.push(p)} onGirar={() => {}} />);
    const campo = screen.getByLabelText('Grupo no encaixe');
    expect(campo).toHaveValue('Entretela');
    expect(Array.from(document.querySelectorAll('#grupos-do-encaixe option')).map((o) => o.getAttribute('value'))).toEqual(['Entretela', 'Forro']);
    fireEvent.change(campo, { target: { value: 'Forro de bolso' } });
    expect(mudancas).toEqual([{ grupoDoEncaixe: 'Forro de bolso' }]);
  });

  it('na lista de peças: o selo do grupo, fora do nome', () => {
    render(<PainelDePecas pecas={[{ ...peca, grupoDoEncaixe: ' Entretela ' }, { ...peca, id: 'h', nome: 'Frente' }]} selecionadoId={null} onSelecionar={() => {}} />);
    const selos = Array.from(document.querySelectorAll('.grupo-da-peca')).map((s) => s.textContent);
    expect(selos).toEqual(['Entretela']);
    expect(document.querySelector('.texto-do-item-de-peca')!.textContent).toBe('Gola (—, M)');
  });
});

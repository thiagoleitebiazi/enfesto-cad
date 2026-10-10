import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { ponto } from '../core/geometria';
import { MAXIMO_DE_IMAGENS, novaImagem, type ImagemDoModelo } from '../domain/imagens';
import { PainelDeImagens } from './PainelDeImagens';

const DADOS = 'data:image/jpeg;base64,AAAA';

function imagem(id: string, nome: string, sobrescrever: Partial<ImagemDoModelo> = {}): ImagemDoModelo {
  return { ...novaImagem(id, nome, DADOS, 1000, 500, ponto(0, 0)), mmPorPx: 1, ...sobrescrever };
}

function renderizar(imagens: readonly ImagemDoModelo[], extras: { digitalizando?: boolean; erro?: string | null } = {}) {
  const acoes = {
    onAdicionar: vi.fn(),
    onMostrar: vi.fn(),
    onOpacidade: vi.fn(),
    onCalibrar: vi.fn(),
    onRemover: vi.fn(),
    onContornar: vi.fn(),
    onFechar: vi.fn(),
  };
  render(<PainelDeImagens imagens={imagens} digitalizando={extras.digitalizando ?? false} erro={extras.erro ?? null} {...acoes} />);
  return acoes;
}

const linhaDa = (nome: string): HTMLElement => screen.getByText(nome).closest('li')!;

describe('PainelDeImagens', () => {
  afterEach(() => cleanup());

  it('sem imagens, diz que não há nenhuma e oferece adicionar', () => {
    const acoes = renderizar([]);

    expect(screen.getByRole('dialog', { name: 'Imagens do modelo' })).toBeInTheDocument();
    expect(screen.getByText('Nenhuma imagem neste projeto ainda.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar imagem…' }));
    expect(acoes.onAdicionar).toHaveBeenCalledTimes(1);
    // "Contornar" e os passos são só do Digitalizar.
    expect(screen.queryByRole('button', { name: 'Contornar o molde' })).not.toBeInTheDocument();
    expect(screen.queryByText(/Fotografe o molde de papel/)).not.toBeInTheDocument();
  });

  it('cada imagem mostra o tamanho no desenho, a escala e se já foi calibrada', () => {
    renderizar([imagem('i1', 'frente.jpg'), imagem('i2', 'costas.jpg', { calibrada: true, mmPorPx: 0.5 })]);

    expect(within(linhaDa('frente')).getByText('1000 × 500 mm · 1 px = 1,000 mm')).toBeInTheDocument();
    expect(within(linhaDa('frente')).getByText('Escala por calibrar')).toBeInTheDocument();
    expect(within(linhaDa('costas')).getByText('500 × 250 mm · 1 px = 0,500 mm')).toBeInTheDocument();
    expect(within(linhaDa('costas')).getByText('Escala calibrada')).toBeInTheDocument();
    expect(within(linhaDa('costas')).getByRole('img', { name: 'Miniatura de costas' })).toHaveAttribute('src', DADOS);
  });

  it('mostrar, opacidade, calibrar e remover avisam de qual imagem se trata', () => {
    const acoes = renderizar([imagem('i1', 'frente.jpg'), imagem('i2', 'costas.jpg', { visivel: false })]);

    expect(within(linhaDa('frente')).getByLabelText('Mostrar no desenho')).toBeChecked();
    expect(within(linhaDa('costas')).getByLabelText('Mostrar no desenho')).not.toBeChecked();
    fireEvent.click(within(linhaDa('costas')).getByLabelText('Mostrar no desenho'));
    expect(acoes.onMostrar).toHaveBeenCalledWith('i2', true);

    expect(within(linhaDa('frente')).getByLabelText('Opacidade de frente')).toHaveValue('0.75');
    fireEvent.change(within(linhaDa('frente')).getByLabelText('Opacidade de frente'), { target: { value: '0.25' } });
    expect(acoes.onOpacidade).toHaveBeenCalledWith('i1', 0.25);

    fireEvent.click(screen.getByRole('button', { name: 'Calibrar a escala de costas' }));
    expect(acoes.onCalibrar).toHaveBeenCalledWith('i2');
    fireEvent.click(screen.getByRole('button', { name: 'Remover frente' }));
    expect(acoes.onRemover).toHaveBeenCalledWith('i1');
  });

  it('com o máximo de imagens, adicionar fica desligado e diz por quê', () => {
    renderizar(Array.from({ length: MAXIMO_DE_IMAGENS }, (_, i) => imagem(`i${i}`, `foto ${i}.png`)));

    const adicionar = screen.getByRole('button', { name: 'Adicionar imagem…' });
    expect(adicionar).toBeDisabled();
    expect(adicionar.title).toContain('já tem 4 imagens');
  });

  it('o erro de uma imagem recusada aparece no painel', () => {
    renderizar([], { erro: 'O arquivo não é uma imagem. Use PNG, JPG, WEBP, BMP ou GIF.' });

    expect(screen.getByRole('alert')).toHaveTextContent('O arquivo não é uma imagem.');
  });

  it('pelo Digitalizar: mostra os passos, e contornar só liga com uma imagem à mostra e calibrada', () => {
    const acoes = renderizar([imagem('i1', 'frente.jpg')], { digitalizando: true });

    expect(screen.getByRole('dialog', { name: 'Digitalizar molde de papel' })).toBeInTheDocument();
    expect(screen.getByText(/Fotografe o molde de papel/)).toBeInTheDocument();
    const contornar = screen.getByRole('button', { name: 'Contornar o molde' });
    expect(contornar).toBeDisabled();
    expect(contornar.title).toBe('Deixe uma imagem à mostra e calibre a escala dela primeiro');
    cleanup();

    renderizar([imagem('i1', 'frente.jpg', { calibrada: true, visivel: false })], { digitalizando: true });
    expect(screen.getByRole('button', { name: 'Contornar o molde' })).toBeDisabled();
    cleanup();

    const comPronta = renderizar([imagem('i1', 'frente.jpg', { calibrada: true })], { digitalizando: true });
    fireEvent.click(screen.getByRole('button', { name: 'Contornar o molde' }));
    expect(comPronta.onContornar).toHaveBeenCalledTimes(1);
    expect(acoes.onContornar).not.toHaveBeenCalled();
  });
});

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ponto } from '../core/geometria';
import type { RiscoDoPlanejamento } from '../domain/planoDeEnfesto';
import { DesenhoDoRisco } from './DesenhoDoRisco';

afterEach(() => cleanup());

const peca = (nome: string, y0: number) => ({
  pecaId: nome,
  nome,
  tamanho: 'M',
  contorno: [ponto(0, y0), ponto(200, y0), ponto(200, y0 + 300), ponto(0, y0 + 300)],
  fio: { inicio: ponto(100, y0 + 20), fim: ponto(100, y0 + 280) },
  anguloGraus: 0,
  espelhada: false,
});

const risco = (casamento?: RiscoDoPlanejamento['casamento']): RiscoDoPlanejamento =>
  ({
    chave: 'M:2',
    grade: { M: 2 },
    origem: 'gerado',
    comprimentoMm: 1000,
    larguraMm: 400,
    larguraDoRiscoMm: 500,
    areaDasPecasMm2: 120000,
    eficienciaPercentual: 24,
    pecas: [
      { ...peca('Frente', 0), pontoDeCasamento: ponto(50, 130), pontosDeCasamento: { manga: ponto(150, 293) } },
      { ...peca('Manga', 400), pontosDeCasamento: { manga: ponto(20, 493) } },
    ],
    ...(casamento ? { casamento } : {}),
  }) as unknown as RiscoDoPlanejamento;

describe('o desenho do risco com o casamento (ADR 0129)', () => {
  it('as linhas do desenho do tecido na fase, o ponto principal e os pontos do grupo com o nome', () => {
    const { container } = render(<DesenhoDoRisco risco={risco({ rapportComprimentoMm: 100, faseComprimentoMm: 30, faseLarguraMm: 0, conferido: true })} tamanhos={['M']} />);
    // As listras a cada 100 mm do comprimento, a partir de 30: 30, 130, …, 930.
    const linhas = [...container.querySelectorAll('.linhas-do-desenho-do-tecido line')].map((l) => Number(l.getAttribute('x1')));
    expect(linhas).toEqual([30, 130, 230, 330, 430, 530, 630, 730, 830, 930]);
    expect(container.querySelectorAll('circle.ponto-de-casamento')).toHaveLength(1);
    expect(container.querySelectorAll('.ponto-de-casamento-do-grupo')).toHaveLength(2);
    expect(screen.getAllByText('manga')).toHaveLength(2);
  });

  it('sem o casamento, sem as linhas do desenho do tecido', () => {
    const { container } = render(<DesenhoDoRisco risco={risco()} tamanhos={['M']} />);
    expect(container.querySelector('.linhas-do-desenho-do-tecido')).toBeNull();
  });
});

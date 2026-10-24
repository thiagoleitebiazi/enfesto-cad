import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { BarraDeStatus } from './BarraDeStatus';
import { ponto } from '../core/geometria';
import type { UnidadeDeRegua } from './transformacaoDeTela';
import { motivoDoErroDeSalvar, type EstadoDoSalvamento } from './salvamento';

function renderizar(unidade: UnidadeDeRegua, pecasSelecionadas = 0, aproveitamentoPercentual: number | null = null): void {
  render(
    <BarraDeStatus
      cursorMundo={ponto(123.4, 600)}
      pontoReferencia={ponto(100, 600)}
      transform={{ escalaPxPorMm: 0.18, offsetXPx: 0, offsetYPx: 0 }}
      totalDePecas={0}
      pecasSelecionadas={pecasSelecionadas}
      problemas={[]}
      onAlternarValidacao={() => {}}
      unidade={unidade}
      aproveitamentoPercentual={aproveitamentoPercentual}
    />,
  );
}

describe('BarraDeStatus', () => {
  afterEach(() => cleanup());

  it('em cm (como as réguas), posição e DX/DY/distância com duas casas, com vírgula decimal', () => {
    renderizar('cm');
    expect(screen.getByText(/X: 12,34 cm\s+Y: 60,00 cm/)).toBeInTheDocument();
    expect(screen.getByText(/DX: 2,34 cm\s+DY: 0,00 cm\s+Dist: 2,34 cm\s+Âng: 0,0°/)).toBeInTheDocument();
  });

  it('em mm, uma casa decimal, com vírgula', () => {
    renderizar('mm');
    expect(screen.getByText(/X: 123,4 mm\s+Y: 600,0 mm/)).toBeInTheDocument();
    expect(screen.getByText(/DX: 23,4 mm/)).toBeInTheDocument();
  });

  it('o aproveitamento da mesa com vírgula; nenhum número da barra com ponto decimal', () => {
    renderizar('mm', 0, 19.54);
    expect(screen.getByText(/Aproveitamento da mesa:\s+19,5%/)).toBeInTheDocument();
    expect(document.querySelector('.barra-de-status')!.textContent).not.toMatch(/\d\.\d/);
  });

  it.each([
    [0, 'Seleção: nenhuma'],
    [1, 'Seleção: 1 peça'],
    [3, 'Seleção: 3 peças'],
  ])('com %i peça(s) selecionada(s), diz "%s"', (quantidade, esperado) => {
    renderizar('cm', quantidade);
    expect(screen.getByText(esperado)).toBeInTheDocument();
  });
});

describe('BarraDeStatus — o salvamento', () => {
  afterEach(() => cleanup());

  function comSalvamento(salvamento: EstadoDoSalvamento | null): void {
    render(
      <BarraDeStatus
        cursorMundo={null}
        transform={{ escalaPxPorMm: 0.18, offsetXPx: 0, offsetYPx: 0 }}
        totalDePecas={0}
        pecasSelecionadas={0}
        problemas={[]}
        onAlternarValidacao={() => {}}
        unidade="cm"
        salvamento={salvamento}
      />,
    );
  }

  it('sem salvamento ainda, não diz nada', () => {
    comSalvamento(null);
    expect(screen.queryByText(/salvo/i)).toBeNull();
  });

  it('o que deu certo mostra a hora', () => {
    comSalvamento({ ok: true, hora: '14:32' });
    expect(screen.getByText('Salvo às 14:32')).toBeInTheDocument();
  });

  it('o que falhou aparece, com o motivo ao passar o mouse', () => {
    comSalvamento({ ok: false, erro: 'ENOSPC: sem espaço.', dispensado: true });
    const aviso = screen.getByText('Não foi salvo');
    expect(aviso).toHaveAttribute('title', 'ENOSPC: sem espaço.');
  });
});

describe('motivoDoErroDeSalvar', () => {
  it('tira o prefixo técnico do Electron e termina com ponto', () => {
    expect(
      motivoDoErroDeSalvar(new Error("Error invoking remote method 'salvar-projeto': Error: ENOSPC: no space left on device, open 'x.json'")),
    ).toBe("ENOSPC: no space left on device, open 'x.json'.");
    expect(motivoDoErroDeSalvar('falhou.')).toBe('falhou.');
  });

  it('a fila de encaixes: aparece só com algo calculando, aguardando ou pronto, e abre a fila ao clicar', () => {
    let abriu = 0;
    const base = {
      cursorMundo: null,
      transform: { escalaPxPorMm: 1, offsetXPx: 0, offsetYPx: 0 },
      totalDePecas: 0,
      pecasSelecionadas: 0,
      problemas: [],
      onAlternarValidacao: () => {},
      unidade: 'mm' as const,
      onAbrirFila: () => abriu++,
    };
    const { rerender } = render(<BarraDeStatus {...base} fila={{ calculando: 0, aguardando: 0, prontos: 0 }} />);
    expect(screen.queryByText(/^Fila:/)).toBeNull();
    rerender(<BarraDeStatus {...base} fila={{ calculando: 1, aguardando: 2, prontos: 1 }} />);
    const indicador = screen.getByRole('button', { name: /^Fila:/ });
    expect(indicador).toHaveTextContent('Fila: 1 calculando · 2 aguardando · 1 pronto(s) para aplicar');
    expect(indicador).toHaveClass('fila-calculando');
    indicador.click();
    expect(abriu).toBe(1);
    rerender(<BarraDeStatus {...base} fila={{ calculando: 0, aguardando: 0, prontos: 2 }} />);
    expect(screen.getByRole('button', { name: /^Fila:/ })).toHaveClass('fila-pronta');
  });
});

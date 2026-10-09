import { afterEach, describe, it, expect } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { BarraDeStatus } from './BarraDeStatus';
import { ponto } from '../core/geometria';
import type { UnidadeDeRegua } from './transformacaoDeTela';

function renderizar(unidade: UnidadeDeRegua): void {
  render(
    <BarraDeStatus
      cursorMundo={ponto(123.4, 600)}
      pontoReferencia={ponto(100, 600)}
      transform={{ escalaPxPorMm: 0.18, offsetXPx: 0, offsetYPx: 0 }}
      totalDePecas={0}
      temSelecao={false}
      problemas={[]}
      onAlternarValidacao={() => {}}
      unidade={unidade}
    />,
  );
}

describe('BarraDeStatus', () => {
  afterEach(() => cleanup());

  it('em cm (como as réguas), posição e DX/DY/distância com duas casas', () => {
    renderizar('cm');
    expect(screen.getByText(/X: 12\.34 cm\s+Y: 60\.00 cm/)).toBeInTheDocument();
    expect(screen.getByText(/DX: 2\.34 cm\s+DY: 0\.00 cm\s+Dist: 2\.34 cm/)).toBeInTheDocument();
  });

  it('em mm, uma casa decimal', () => {
    renderizar('mm');
    expect(screen.getByText(/X: 123\.4 mm\s+Y: 600\.0 mm/)).toBeInTheDocument();
    expect(screen.getByText(/DX: 23\.4 mm/)).toBeInTheDocument();
  });
});

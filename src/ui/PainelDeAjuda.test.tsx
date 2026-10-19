import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PainelDeAjuda } from './PainelDeAjuda';

afterEach(() => cleanup());

describe('PainelDeAjuda — os atalhos no Mac', () => {
  it('no Mac, diz que o ⌘ faz o que o Ctrl faz, onde fica o Histórico e como usar o trackpad', () => {
    render(<PainelDeAjuda conteudo="atalhos" noMac onFechar={() => {}} />);
    expect(screen.getByText('No Mac')).toBeInTheDocument();
    expect(screen.getByText('Oculta o programa, como em todo Mac: o Histórico fica em Control+H')).toBeInTheDocument();
    expect(screen.getByText('Trackpad')).toBeInTheDocument();
    // A roda do mouse, no Mac, move a vista: a linha "Roda = zoom" sai.
    expect(screen.queryByText('Zoom no ponto do cursor', { selector: 'td' })).toBeInTheDocument();
    expect(screen.queryByText('Roda')).toBeNull();
  });

  it('no Windows, a lista de sempre', () => {
    render(<PainelDeAjuda conteudo="atalhos" noMac={false} onFechar={() => {}} />);
    expect(screen.queryByText('No Mac')).toBeNull();
    expect(screen.queryByText('Trackpad')).toBeNull();
    expect(screen.getByText('Roda')).toBeInTheDocument();
  });
});

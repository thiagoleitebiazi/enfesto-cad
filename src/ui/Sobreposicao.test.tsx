import { useState } from 'react';
import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent } from '@testing-library/react';
import { Sobreposicao } from './Sobreposicao';

// Como o Nesting: o botão "Calcular" some e dá lugar ao progresso.
function DialogoQueTrocaDeConteudo(props: { readonly onFechar: () => void }): React.JSX.Element {
  const [calculando, setCalculando] = useState(false);
  return (
    <Sobreposicao titulo="Diálogo" onFechar={props.onFechar}>
      {calculando ? (
        <>
          <p>Calculando...</p>
          <button>Parar</button>
        </>
      ) : (
        <button onClick={() => setCalculando(true)}>Calcular</button>
      )}
    </Sobreposicao>
  );
}

/** Clica em "Calcular" com o foco nele; o botão some e o foco cai no corpo da página. */
function clicarEmCalcular(): void {
  const calcular = screen.getByRole('button', { name: 'Calcular' });
  calcular.focus();
  fireEvent.click(calcular);
  expect(document.activeElement).toBe(document.body);
}

/** Tira o foco de onde estiver, como faz o controle que some. */
function tirarOFoco(): void {
  (document.activeElement as HTMLElement | null)?.blur();
  expect(document.activeElement).toBe(document.body);
}

// A janela do programa (`.app-shell`): focável, com os atalhos de teclado.
function renderizarNaJanela(aberto: boolean, aoTeclarNaJanela = vi.fn(), onFechar = vi.fn()) {
  const arvore = (mostrar: boolean) => (
    <div data-testid="janela" tabIndex={-1} onKeyDown={aoTeclarNaJanela}>
      <button>Botão da janela</button>
      {mostrar && (
        <Sobreposicao titulo="Diálogo" onFechar={onFechar}>
          <select aria-label="Opção">
            <option>a</option>
          </select>
          <button>Confirmar</button>
        </Sobreposicao>
      )}
    </div>
  );
  const resultado = render(arvore(aberto));
  return { ...resultado, aoTeclarNaJanela, onFechar, mostrar: (m: boolean) => resultado.rerender(arvore(m)) };
}

describe('Sobreposicao', () => {
  afterEach(() => cleanup());

  it('as teclas dentro do diálogo não chegam aos atalhos da janela', () => {
    const { aoTeclarNaJanela } = renderizarNaJanela(true);
    fireEvent.keyDown(screen.getByLabelText('Opção'), { key: 'Delete' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Confirmar' }), { key: 'z', ctrlKey: true });
    expect(aoTeclarNaJanela).not.toHaveBeenCalled();
  });

  it('Esc fecha o diálogo, mesmo com o foco num controle dele', () => {
    const { onFechar, aoTeclarNaJanela } = renderizarNaJanela(true);
    fireEvent.keyDown(screen.getByLabelText('Opção'), { key: 'Escape' });
    expect(onFechar).toHaveBeenCalledTimes(1);
    expect(aoTeclarNaJanela).not.toHaveBeenCalled();
  });

  it('ao abrir, o foco entra no diálogo; ao fechar, volta para onde estava', () => {
    const { mostrar } = renderizarNaJanela(false);
    const botaoDaJanela = screen.getByRole('button', { name: 'Botão da janela' });
    botaoDaJanela.focus();

    mostrar(true);
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);

    mostrar(false);
    expect(document.activeElement).toBe(botaoDaJanela);
  });

  it('ao fechar, se o foco não tinha para onde voltar, vai para a janela (os atalhos voltam a valer)', () => {
    const { mostrar } = renderizarNaJanela(false);
    (document.activeElement as HTMLElement | null)?.blur();

    mostrar(true);
    mostrar(false);
    expect(document.activeElement).toBe(screen.getByTestId('janela'));
  });

  it('Tab circula só entre os controles do diálogo', () => {
    renderizarNaJanela(true);
    const fechar = screen.getByRole('button', { name: 'Fechar' });
    const confirmar = screen.getByRole('button', { name: 'Confirmar' });

    confirmar.focus();
    fireEvent.keyDown(confirmar, { key: 'Tab' });
    expect(document.activeElement).toBe(fechar);

    fireEvent.keyDown(fechar, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(confirmar);
  });

  it('se o controle com o foco some, Esc ainda fecha o diálogo (e, fechado, deixa de responder)', () => {
    const onFechar = vi.fn();
    const { unmount } = render(<DialogoQueTrocaDeConteudo onFechar={onFechar} />);
    clicarEmCalcular();

    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onFechar).toHaveBeenCalledTimes(1);

    unmount();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onFechar).toHaveBeenCalledTimes(1);
  });

  it('se o controle com o foco some, a próxima tecla devolve o foco ao diálogo', () => {
    render(<DialogoQueTrocaDeConteudo onFechar={vi.fn()} />);
    clicarEmCalcular();
    fireEvent.keyDown(document.body, { key: 'Delete' });
    expect(document.activeElement).toBe(screen.getByRole('dialog'));

    tirarOFoco();
    fireEvent.keyDown(document.body, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Fechar' }));

    tirarOFoco();
    fireEvent.keyDown(document.body, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Parar' }));
  });
});

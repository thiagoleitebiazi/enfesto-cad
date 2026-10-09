import { useEffect, useId, useRef, useState } from 'react';

/**
 * Um item de menu: ação simples, opção liga/desliga (marca ✓), opção de um
 * grupo exclusivo (marca •) ou separador.
 */
export type ItemDeMenu =
  | {
      readonly tipo: 'acao';
      readonly rotulo: string;
      readonly atalho?: string;
      readonly desabilitado?: boolean;
      readonly titulo?: string;
      readonly onEscolher: () => void;
    }
  | {
      readonly tipo: 'alternar' | 'opcao';
      readonly rotulo: string;
      readonly marcado: boolean;
      readonly atalho?: string;
      readonly titulo?: string;
      readonly onEscolher: () => void;
    }
  | { readonly tipo: 'separador' };

interface MenuSuspensoProps {
  readonly rotulo: string;
  readonly itens: readonly ItemDeMenu[];
}

const PAPEL_DO_ITEM = { acao: 'menuitem', alternar: 'menuitemcheckbox', opcao: 'menuitemradio' } as const;

/**
 * Botão de menu (Visão, Opções, Ajuda) à direita das abas da barra. Abre uma
 * lista de itens; fecha ao escolher, com Esc ou com um clique fora. Enquanto
 * a lista está aberta, as teclas ficam nela (setas, Home/End, Esc) e não
 * chegam aos atalhos do programa — Delete com o menu aberto não pode apagar
 * a peça selecionada.
 */
export function MenuSuspenso(props: MenuSuspensoProps): React.JSX.Element {
  const [aberto, setAberto] = useState(false);
  const raizRef = useRef<HTMLDivElement | null>(null);
  const botaoRef = useRef<HTMLButtonElement | null>(null);
  const listaRef = useRef<HTMLDivElement | null>(null);
  const idDaLista = useId();

  // Ao abrir, o foco vai para o primeiro item disponível.
  useEffect(() => {
    if (aberto) listaRef.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
  }, [aberto]);

  // Clique fora fecha, sem devolver o foco ao botão (o clique já levou o foco para onde o usuário quis).
  useEffect(() => {
    if (!aberto) return;
    function aoPressionarFora(e: MouseEvent): void {
      if (e.target instanceof Node && raizRef.current?.contains(e.target)) return;
      setAberto(false);
    }
    document.addEventListener('mousedown', aoPressionarFora);
    return () => document.removeEventListener('mousedown', aoPressionarFora);
  }, [aberto]);

  function itensFocaveis(): HTMLButtonElement[] {
    return [...(listaRef.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
  }

  function fechar(devolverFoco: boolean): void {
    setAberto(false);
    if (devolverFoco) botaoRef.current?.focus();
  }

  function escolher(onEscolher: () => void): void {
    fechar(true);
    onEscolher();
  }

  function aoTeclarNoBotao(e: React.KeyboardEvent<HTMLButtonElement>): void {
    if (e.key === 'ArrowDown' && !aberto) {
      e.preventDefault();
      e.stopPropagation();
      setAberto(true);
    } else if (e.key === 'Escape' && aberto) {
      e.preventDefault();
      e.stopPropagation();
      fechar(true);
    }
  }

  function aoTeclarNaLista(e: React.KeyboardEvent<HTMLDivElement>): void {
    e.stopPropagation();
    const itens = itensFocaveis();
    const atual = itens.findIndex((item) => item === document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (itens.length === 0) return;
      const passo = e.key === 'ArrowDown' ? 1 : -1;
      itens[(atual + passo + itens.length) % itens.length]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      itens[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      itens.at(-1)?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      fechar(true);
    } else if (e.key === 'Tab') {
      fechar(false);
    }
  }

  return (
    <div className="menu-suspenso" ref={raizRef}>
      <button
        ref={botaoRef}
        type="button"
        className={`botao-de-menu${aberto ? ' botao-de-menu-aberto' : ''}`}
        aria-haspopup="menu"
        aria-expanded={aberto}
        aria-controls={aberto ? idDaLista : undefined}
        onClick={() => (aberto ? fechar(false) : setAberto(true))}
        onKeyDown={aoTeclarNoBotao}
      >
        {props.rotulo}
      </button>
      {aberto && (
        <div ref={listaRef} id={idDaLista} role="menu" aria-label={props.rotulo} className="lista-de-menu" onKeyDown={aoTeclarNaLista}>
          {props.itens.map((item, indice) => {
            if (item.tipo === 'separador') {
              return <div key={indice} role="separator" className="separador-de-menu" />;
            }
            const marcado = item.tipo === 'acao' ? null : item.marcado;
            return (
              <button
                key={indice}
                type="button"
                role={PAPEL_DO_ITEM[item.tipo]}
                aria-checked={marcado ?? undefined}
                className="item-de-menu"
                tabIndex={-1}
                disabled={item.tipo === 'acao' && item.desabilitado === true}
                title={item.titulo}
                onClick={() => escolher(item.onEscolher)}
              >
                <span className="marca-do-item-de-menu" aria-hidden="true">
                  {marcado ? (item.tipo === 'opcao' ? '•' : '✓') : ''}
                </span>
                <span className="rotulo-do-item-de-menu">{item.rotulo}</span>
                {item.atalho && <span className="atalho-do-item-de-menu">{item.atalho}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';

interface SobreposicaoProps {
  readonly titulo: string;
  readonly onFechar: () => void;
  readonly children: React.ReactNode;
}

const SELETOR_DE_FOCAVEIS = [
  'button:not(:disabled)',
  'input:not(:disabled)',
  'select:not(:disabled)',
  'textarea:not(:disabled)',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Diálogo modal por cima do programa. Enquanto ele está aberto, o teclado
 * fica nele: as teclas não chegam aos atalhos do programa (Delete com o foco
 * num botão do diálogo não pode apagar a peça selecionada por trás), Esc
 * fecha o diálogo e Tab circula só entre os controles dele. Ao abrir, o foco
 * entra no diálogo; ao fechar, volta para onde estava — ou, se aquilo sumiu,
 * para a janela do programa, para os atalhos continuarem valendo.
 */
export function Sobreposicao(props: SobreposicaoProps): React.JSX.Element {
  const { onFechar } = props;
  const fundoRef = useRef<HTMLDivElement | null>(null);
  const painelRef = useRef<HTMLDivElement | null>(null);
  // Lido no primeiro render, antes que um `autoFocus` de dentro do diálogo leve o foco para ele.
  const [focoAnterior] = useState(() =>
    document.activeElement instanceof HTMLElement && document.activeElement !== document.body
      ? document.activeElement
      : null,
  );

  useEffect(() => {
    const painel = painelRef.current;
    const recipiente = fundoRef.current?.parentElement?.closest<HTMLElement>('[tabindex]') ?? null;
    if (painel && !painel.contains(document.activeElement)) painel.focus();
    return () => {
      focoAnterior?.focus();
      if (document.activeElement !== focoAnterior) recipiente?.focus();
    };
  }, [focoAnterior]);

  // Quando o controle com o foco some do diálogo ("Calcular encaixe" dá lugar
  // à barra de progresso, "Excluir" leva a linha junto), o foco cai no corpo
  // da página, fora do diálogo, e as teclas não chegariam nele. A próxima
  // tecla o traz de volta: Esc fecha, Tab vai para o primeiro (Shift+Tab, o
  // último) controle do diálogo, e as outras só devolvem o foco ao painel.
  useEffect(() => {
    function aoTeclarSemFoco(e: KeyboardEvent): void {
      const ativo = document.activeElement;
      const painel = painelRef.current;
      if ((ativo && ativo !== document.body) || !painel) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        onFechar();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const focaveis = painel.querySelectorAll<HTMLElement>(SELETOR_DE_FOCAVEIS);
        (focaveis[e.shiftKey ? focaveis.length - 1 : 0] ?? painel).focus();
        return;
      }
      painel.focus();
    }
    document.addEventListener('keydown', aoTeclarSemFoco);
    return () => document.removeEventListener('keydown', aoTeclarSemFoco);
  }, [onFechar]);

  function aoTeclar(e: React.KeyboardEvent<HTMLDivElement>): void {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      onFechar();
      return;
    }
    if (e.key !== 'Tab') return;
    const focaveis = [...e.currentTarget.querySelectorAll<HTMLElement>(SELETOR_DE_FOCAVEIS)];
    const primeiro = focaveis[0];
    const ultimo = focaveis.at(-1);
    if (!primeiro || !ultimo) {
      e.preventDefault();
      return;
    }
    const ativo = document.activeElement;
    if (e.shiftKey && (ativo === primeiro || ativo === e.currentTarget)) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && ativo === ultimo) {
      e.preventDefault();
      primeiro.focus();
    }
  }

  return (
    <div ref={fundoRef} className="sobreposicao-fundo" role="presentation" onClick={onFechar}>
      <div
        ref={painelRef}
        className="sobreposicao-painel"
        role="dialog"
        aria-modal="true"
        aria-label={props.titulo}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={aoTeclar}
      >
        <div className="sobreposicao-cabecalho">
          <h2>{props.titulo}</h2>
          <button className="sobreposicao-fechar" onClick={onFechar} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="sobreposicao-corpo">{props.children}</div>
      </div>
    </div>
  );
}

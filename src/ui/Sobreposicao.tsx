interface SobreposicaoProps {
  readonly titulo: string;
  readonly onFechar: () => void;
  readonly children: React.ReactNode;
}

export function Sobreposicao(props: SobreposicaoProps): React.JSX.Element {
  return (
    <div className="sobreposicao-fundo" role="presentation" onClick={props.onFechar}>
      <div
        className="sobreposicao-painel"
        role="dialog"
        aria-modal="true"
        aria-label={props.titulo}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sobreposicao-cabecalho">
          <h2>{props.titulo}</h2>
          <button className="sobreposicao-fechar" onClick={props.onFechar} aria-label="Fechar">
            ×
          </button>
        </div>
        <div className="sobreposicao-corpo">{props.children}</div>
      </div>
    </div>
  );
}

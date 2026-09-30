/**
 * Conjunto de ícones de linha simples e neutros (desenhados para este
 * projeto, sem relação com nenhuma marca) usados na barra de ferramentas
 * em abas — só para dar um acabamento profissional (ícone + rótulo, como
 * qualquer ribbon de programa de desenho), sem copiar o ícone específico
 * de nenhum software de referência.
 */
export type NomeDoIcone =
  | 'novo'
  | 'abrir'
  | 'salvar'
  | 'salvar-como'
  | 'biblioteca'
  | 'historico'
  | 'desfazer'
  | 'refazer'
  | 'copiar'
  | 'colar'
  | 'recortar'
  | 'duplicar'
  | 'excluir'
  | 'selecionar-tudo'
  | 'selecionar'
  | 'novo-molde'
  | 'curva'
  | 'furo'
  | 'pique'
  | 'marca'
  | 'mover-ponto'
  | 'inserir-ponto'
  | 'excluir-ponto'
  | 'elemento-paralelo'
  | 'dimensionar'
  | 'espelhar'
  | 'girar'
  | 'alinhar'
  | 'chanfrar'
  | 'arredondar'
  | 'converter-costura'
  | 'importar'
  | 'exportar'
  | 'relatorio'
  | 'tecido'
  | 'enfesto'
  | 'sugerir-posicao'
  | 'nesting'
  | 'zoom-in'
  | 'zoom-out'
  | 'ajustar';

const CAMINHOS: Record<NomeDoIcone, React.ReactNode> = {
  novo: (
    <>
      <path d="M5 2h7l4 4v12H5z" />
      <path d="M12 2v4h4" />
      <line x1="7.5" y1="12" x2="12.5" y2="12" />
      <line x1="10" y1="9.5" x2="10" y2="14.5" />
    </>
  ),
  abrir: (
    <path d="M2 5.5a1 1 0 0 1 1-1h4l1.5 2H17a1 1 0 0 1 1 1v.5H3.6a1 1 0 0 0-1 .8l-1.4 6.7V5.5Z M2.6 15l1.4-6.7a1 1 0 0 1 1-.8H18l-1.6 7.5a1 1 0 0 1-1 .8H3.6a1 1 0 0 1-1-1.2Z" />
  ),
  salvar: (
    <>
      <path d="M3 3h11l3 3v11H3z" />
      <path d="M6 3v5h8V3" />
      <rect x="6" y="11" width="8" height="5" />
    </>
  ),
  'salvar-como': (
    <>
      <path d="M3 3h9l3 3v4.5" />
      <path d="M6 3v5h6V3" />
      <rect x="4.5" y="11" width="6" height="5" />
      <line x1="15" y1="12" x2="15" y2="17" />
      <line x1="12.5" y1="14.5" x2="17.5" y2="14.5" />
    </>
  ),
  biblioteca: (
    <>
      <rect x="3" y="3" width="14" height="3.2" rx="0.6" />
      <rect x="3" y="8.4" width="14" height="3.2" rx="0.6" />
      <rect x="3" y="13.8" width="14" height="3.2" rx="0.6" />
    </>
  ),
  historico: (
    <>
      <circle cx="10" cy="10.5" r="6.5" />
      <path d="M10 6.5v4l3 2" />
      <path d="M4.2 6 3 3.3 6 4.2" />
    </>
  ),
  desfazer: <path d="M7 5 3 9l4 4M3 9h8.5a5 5 0 1 1 0 10H9" />,
  refazer: <path d="M13 5l4 4-4 4M17 9H8.5a5 5 0 1 0 0 10H11" />,
  copiar: (
    <>
      <rect x="7" y="7" width="10" height="11" rx="1" />
      <path d="M13 7V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3" />
    </>
  ),
  colar: (
    <>
      <rect x="4" y="4" width="12" height="14" rx="1" />
      <rect x="7" y="2" width="6" height="3" rx="0.6" />
      <line x1="7" y1="10" x2="13" y2="10" />
      <line x1="7" y1="13" x2="13" y2="13" />
    </>
  ),
  recortar: (
    <>
      <circle cx="5.5" cy="5.5" r="2" />
      <circle cx="5.5" cy="14.5" r="2" />
      <line x1="7" y1="6.6" x2="17" y2="16" />
      <line x1="7" y1="13.4" x2="17" y2="4" />
    </>
  ),
  duplicar: (
    <>
      <rect x="3" y="3" width="9" height="9" rx="1" />
      <path d="M8 12v2.5a1.5 1.5 0 0 0 1.5 1.5H16a1.5 1.5 0 0 0 1.5-1.5V9.5A1.5 1.5 0 0 0 16 8h-2.5" />
    </>
  ),
  excluir: (
    <>
      <path d="M4 6h12" />
      <path d="M7.5 6V4.5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1V6" />
      <path d="M5.5 6 6.3 16a1 1 0 0 0 1 1h5.4a1 1 0 0 0 1-1L14.5 6" />
    </>
  ),
  'selecionar-tudo': (
    <rect x="3" y="3" width="14" height="14" rx="1" strokeDasharray="3 2.2" />
  ),
  selecionar: <path d="M4 3.5 15.5 11l-4.6 1.1L13 16.5l-2 1-2.1-4.4L5.5 15.5 4 3.5Z" />,
  'novo-molde': (
    <>
      <path d="M4 15 6 5l6-1.5L16 8l-2 8-5 1z" />
      <circle cx="6" cy="5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="3.5" r="0.8" fill="currentColor" stroke="none" />
    </>
  ),
  curva: <path d="M3 15c2-8 5-11 7-11s2 5 4 5 2-3 3-6" />,
  furo: (
    <>
      <circle cx="10" cy="10" r="7" />
      <circle cx="10" cy="10" r="2.6" />
    </>
  ),
  pique: (
    <>
      <path d="M3 14c4-8 10-8 14 0" />
      <line x1="10" y1="7.2" x2="10" y2="3" />
    </>
  ),
  marca: (
    <>
      <path d="M10 2v13" />
      <path d="M10 2.6h6l-2 2.7 2 2.7h-6" />
    </>
  ),
  'mover-ponto': (
    <>
      <circle cx="10" cy="10" r="1.6" fill="currentColor" stroke="none" />
      <path d="M10 2v3.2M10 18v-3.2M2 10h3.2M18 10h-3.2" />
      <path d="M8.3 3.7 10 2l1.7 1.7M8.3 16.3 10 18l1.7-1.7M3.7 8.3 2 10l1.7 1.7M16.3 8.3 18 10l-1.7 1.7" />
    </>
  ),
  'inserir-ponto': (
    <>
      <line x1="3" y1="10" x2="17" y2="10" />
      <circle cx="6" cy="10" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="14" cy="10" r="1.4" fill="currentColor" stroke="none" />
      <line x1="10" y1="6.5" x2="10" y2="13.5" />
      <line x1="6.5" y1="10" x2="13.5" y2="10" strokeOpacity="0" />
    </>
  ),
  'excluir-ponto': (
    <>
      <line x1="3" y1="10" x2="17" y2="10" />
      <circle cx="6" cy="10" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="14" cy="10" r="1.4" fill="currentColor" stroke="none" />
      <line x1="7.5" y1="10" x2="12.5" y2="10" stroke="white" strokeWidth="2.4" />
      <line x1="8" y1="15" x2="12" y2="15" />
    </>
  ),
  'elemento-paralelo': (
    <>
      <path d="M3 6c2-2.5 5-2.5 8-1.5" />
      <path d="M3 12c3.5-2.8 8-2.8 14-1" />
    </>
  ),
  dimensionar: (
    <>
      <rect x="3" y="3" width="8" height="8" />
      <path d="M13 13 18 18M14.5 18H18v-3.5" />
    </>
  ),
  espelhar: (
    <>
      <line x1="10" y1="2" x2="10" y2="18" strokeDasharray="2.4 2" />
      <path d="M8 5H4v10h4" />
      <path d="M12 5h4v10h-4" />
    </>
  ),
  girar: <path d="M16 6.5A6.5 6.5 0 1 0 17 10.2M17 3v4h-4" />,
  alinhar: (
    <>
      <line x1="3" y1="3" x2="3" y2="17" />
      <line x1="6" y1="6" x2="15" y2="6" />
      <line x1="6" y1="10" x2="17" y2="10" />
      <line x1="6" y1="14" x2="12" y2="14" />
    </>
  ),
  chanfrar: <path d="M4 4h8l4 4v8H4z" />,
  arredondar: <path d="M4 16V8a4 4 0 0 1 4-4h8" />,
  'converter-costura': (
    <>
      <rect x="4" y="4" width="12" height="12" />
      <rect x="6.5" y="6.5" width="7" height="7" strokeDasharray="2 1.6" />
    </>
  ),
  importar: (
    <>
      <path d="M10 3v9" />
      <path d="M6.5 9 10 12.5 13.5 9" />
      <path d="M4 14.5v1.8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1.8" />
    </>
  ),
  exportar: (
    <>
      <path d="M10 13V4" />
      <path d="M6.5 7 10 3.5 13.5 7" />
      <path d="M4 14.5v1.8a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-1.8" />
    </>
  ),
  relatorio: (
    <>
      <path d="M5 2h7l4 4v12H5z" />
      <path d="M12 2v4h4" />
      <line x1="7.5" y1="11" x2="7.5" y2="14.5" />
      <line x1="10" y1="9" x2="10" y2="14.5" />
      <line x1="12.5" y1="12.3" x2="12.5" y2="14.5" />
    </>
  ),
  tecido: (
    <>
      <path d="M3 6c1.3-1.3 2.7-1.3 4 0s2.7 1.3 4 0 2.7-1.3 4-0" />
      <path d="M3 10.5c1.3-1.3 2.7-1.3 4 0s2.7 1.3 4 0 2.7-1.3 4 0" />
      <path d="M3 15c1.3-1.3 2.7-1.3 4 0s2.7 1.3 4 0 2.7-1.3 4 0" />
    </>
  ),
  enfesto: (
    <>
      <rect x="3" y="4" width="14" height="2.6" rx="0.5" />
      <rect x="3" y="8.7" width="14" height="2.6" rx="0.5" />
      <rect x="3" y="13.4" width="14" height="2.6" rx="0.5" />
    </>
  ),
  'sugerir-posicao': (
    <>
      <path d="M10 2.5v3M10 14.5v3M2.5 10h3M14.5 10h3" />
      <path d="M5.5 5.5l2 2M12.5 12.5l2 2M5.5 14.5l2-2M12.5 7.5l2-2" strokeOpacity="0.55" />
      <circle cx="10" cy="10" r="2.3" fill="currentColor" stroke="none" />
    </>
  ),
  nesting: (
    <>
      <rect x="3" y="3" width="5.5" height="5.5" rx="0.6" />
      <rect x="11.5" y="3" width="5.5" height="5.5" rx="0.6" />
      <rect x="3" y="11.5" width="5.5" height="5.5" rx="0.6" />
      <rect x="11.5" y="11.5" width="5.5" height="5.5" rx="0.6" />
    </>
  ),
  'zoom-in': (
    <>
      <circle cx="8.6" cy="8.6" r="5.6" />
      <line x1="12.7" y1="12.7" x2="17.5" y2="17.5" />
      <line x1="8.6" y1="6" x2="8.6" y2="11.2" />
      <line x1="6" y1="8.6" x2="11.2" y2="8.6" />
    </>
  ),
  'zoom-out': (
    <>
      <circle cx="8.6" cy="8.6" r="5.6" />
      <line x1="12.7" y1="12.7" x2="17.5" y2="17.5" />
      <line x1="6" y1="8.6" x2="11.2" y2="8.6" />
    </>
  ),
  ajustar: (
    <>
      <path d="M3 7V4a1 1 0 0 1 1-1h3" />
      <path d="M17 7V4a1 1 0 0 0-1-1h-3" />
      <path d="M3 13v3a1 1 0 0 0 1 1h3" />
      <path d="M17 13v3a1 1 0 0 1-1 1h-3" />
    </>
  ),
};

interface IconeProps {
  readonly nome: NomeDoIcone;
}

export function Icone(props: IconeProps): React.JSX.Element {
  return (
    <svg
      className="icone-de-ferramenta"
      width="18"
      height="18"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {CAMINHOS[props.nome]}
    </svg>
  );
}

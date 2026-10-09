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
  | 'ajustar'
  | 'mao'
  | 'zoom-janela'
  | 'vista-anterior'
  | 'vista-proxima'
  | 'grade'
  | 'ima'
  | 'cerca'
  | 'mover-cerca'
  | 'modificar'
  | 'manipular-pontos'
  | 'manipulacao-rapida'
  | 'redefinir-perimetro'
  | 'dividir'
  | 'transformar-elementos'
  | 'trocar-elemento'
  | 'cor'
  | 'inverter-selecao'
  | 'inverter-moldes'
  | 'selecionar-moldes'
  | 'ponto-de-restauracao'
  | 'restaurar'
  | 'reta'
  | 'retangulo'
  | 'por-angulo'
  | 'estender-reta'
  | 'estender-ate-elemento'
  | 'estender-duas-retas'
  | 'dividir-curva'
  | 'curva-predefinida'
  | 'espiral'
  | 'cadastrar-curva'
  | 'editar-pontos-de-curva'
  | 'ponto-por-coordenada'
  | 'ponto-por-intersecao'
  | 'ponto-no-centro'
  | 'ponto-no-perimetro'
  | 'ponto-por-distancia'
  | 'arco-por-raio'
  | 'inserir-texto'
  | 'editar-texto'
  | 'extrair-molde'
  | 'digitalizar'
  | 'sentido-do-fio'
  | 'linha-de-simetria'
  | 'bainha'
  | 'dobrar'
  | 'desdobrar'
  | 'costura'
  | 'remover-costura'
  | 'converter-contorno'
  | 'pregas'
  | 'pence-no-contorno'
  | 'pence-interna'
  | 'fechar-pence'
  | 'transferir-pence'
  | 'multiplas-pences'
  | 'cortar-molde'
  | 'unir-moldes'
  | 'remover-regiao'
  | 'tabela-de-graduacao'
  | 'graduar-automatico'
  | 'graduar-mouse'
  | 'graduar-tangente'
  | 'regras'
  | 'criar-regra'
  | 'remover-graduacao'
  | 'separar-graduacao'
  | 'unir-graduacao'
  | 'agrupar-graduacao'
  | 'deduzir-graduacao'
  | 'copiar-graduacao'
  | 'ajustar-graduacao'
  | 'graduar-curva'
  | 'conferir'
  | 'cota-perimetro'
  | 'perimetro'
  | 'comparar-perimetros'
  | 'cota-distancia'
  | 'distancia'
  | 'comparar-distancia'
  | 'cota-horizontal-vertical'
  | 'angulo'
  | 'raio'
  | 'propriedades'
  | 'informacoes'
  | 'autor'
  | 'informacoes-dos-moldes'
  | 'variantes'
  | 'relacionamento-piques'
  | 'imagens'
  | 'localizar-modelos';

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
  mao: (
    <path d="M7 12.6V4.6a1.2 1.2 0 0 1 2.4 0v4.9M9.4 9.5V3.4a1.2 1.2 0 0 1 2.4 0v6.1M11.8 9.5V4.4a1.2 1.2 0 0 1 2.4 0V10M14.2 10V6.8a1.2 1.2 0 0 1 2.4 0v5c0 3.4-2.4 6.2-5.8 6.2h-.6c-2.2 0-3.6-1-4.8-2.8l-2.2-3.6a1.25 1.25 0 0 1 2.1-1.4L7 12.6" />
  ),
  'zoom-janela': (
    <>
      <rect x="2.5" y="2.5" width="10" height="7.5" strokeDasharray="2 1.6" />
      <circle cx="13.2" cy="13.2" r="3" />
      <line x1="15.4" y1="15.4" x2="18" y2="18" />
    </>
  ),
  'vista-anterior': (
    <>
      <rect x="2.5" y="4" width="15" height="12" rx="1.2" />
      <path d="M13.5 10h-7M9.3 7.2 6.5 10l2.8 2.8" />
    </>
  ),
  'vista-proxima': (
    <>
      <rect x="2.5" y="4" width="15" height="12" rx="1.2" />
      <path d="M6.5 10h7M10.7 7.2 13.5 10l-2.8 2.8" />
    </>
  ),
  grade: (
    <>
      {[4, 10, 16].flatMap((x) =>
        [4, 10, 16].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.1" fill="currentColor" stroke="none" />),
      )}
    </>
  ),
  ima: (
    <>
      <path d="M4 3v7a6 6 0 0 0 12 0V3h-3.6v7a2.4 2.4 0 0 1-4.8 0V3z" />
      <line x1="4" y1="6.2" x2="7.6" y2="6.2" />
      <line x1="12.4" y1="6.2" x2="16" y2="6.2" />
    </>
  ),
  cerca: (
    <>
      <rect x="3.5" y="4.5" width="13" height="11" strokeDasharray="2.2 1.8" />
      <rect x="2" y="3" width="3" height="3" fill="currentColor" stroke="none" />
      <rect x="15" y="14" width="3" height="3" fill="currentColor" stroke="none" />
    </>
  ),
  'mover-cerca': (
    <>
      <rect x="2.5" y="2.5" width="10" height="8" strokeDasharray="2.2 1.8" />
      <path d="M8.5 8.5 17 17M17 12.5V17h-4.5" />
    </>
  ),
  modificar: (
    <>
      <path d="M13.5 3.5l3 3L7 16H4v-3z" />
      <line x1="11.5" y1="5.5" x2="14.5" y2="8.5" />
    </>
  ),
  'manipular-pontos': (
    <>
      <path d="M3 15 8 6l5 7 4-8" />
      <rect x="6.6" y="4.6" width="2.8" height="2.8" fill="currentColor" stroke="none" />
      <rect x="11.6" y="11.6" width="2.8" height="2.8" fill="currentColor" stroke="none" />
    </>
  ),
  'manipulacao-rapida': <path d="M11 2 5 11h4.5L8 18l7-9.5h-4.5L12 2z" />,
  'redefinir-perimetro': (
    <>
      <rect x="3" y="3" width="14" height="9" rx="1.5" />
      <path d="M3 16h14M5 14.2 3 16l2 1.8M15 14.2l2 1.8-2 1.8" />
    </>
  ),
  dividir: (
    <>
      <path d="M2.5 13 8 7.5" />
      <path d="M12 12.5 17.5 7" />
      <path d="M10 3.5v13" strokeDasharray="1.8 1.6" />
    </>
  ),
  'transformar-elementos': (
    <>
      <path d="M4.5 15.5 9 6.5" />
      <path d="M11 6.5l4.5 9" />
      <path d="M6 17.5h8" />
    </>
  ),
  'trocar-elemento': (
    <>
      <path d="M4 7h11M12 4l3 3-3 3" />
      <path d="M16 13H5M8 10l-3 3 3 3" />
    </>
  ),
  cor: <rect x="4" y="4" width="12" height="12" rx="1.5" fill="currentColor" />,
  'inverter-selecao': (
    <>
      <rect x="2.5" y="2.5" width="8.5" height="8.5" strokeDasharray="2.2 1.8" />
      <rect x="9" y="9" width="8.5" height="8.5" fill="currentColor" fillOpacity="0.22" />
    </>
  ),
  'inverter-moldes': (
    <>
      <path d="M3.5 2.5h6l1 8h-8z" strokeDasharray="2.2 1.8" />
      <path d="M10.5 9.5h6l1 8h-8z" fill="currentColor" fillOpacity="0.22" />
    </>
  ),
  'selecionar-moldes': (
    <>
      <path d="M12.5 7V3h-10v10H6" strokeDasharray="2.2 1.8" />
      <path d="M8.5 8.5 17 12l-3.6 1.3L12 17z" />
    </>
  ),
  'ponto-de-restauracao': (
    <>
      <path d="M5 2.5h10v15l-5-3.6-5 3.6z" />
      <path d="M10 6v5M7.5 8.5h5" />
    </>
  ),
  restaurar: (
    <>
      <path d="M4.3 7.5A6.3 6.3 0 1 1 3.8 11" />
      <path d="M3.5 3.5v4h4" />
      <path d="M8 7.5h4V13l-2-1.5L8 13z" />
    </>
  ),
  reta: (
    <>
      <line x1="4" y1="16" x2="16" y2="4" />
      <circle cx="4" cy="16" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="4" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  retangulo: (
    <>
      <rect x="3" y="5" width="14" height="10" />
      <circle cx="3" cy="5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="17" cy="15" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  'por-angulo': (
    <>
      <path d="M3 16h14" />
      <path d="M3 16 14 4.5" />
      <path d="M9.5 16a6.5 6.5 0 0 0-2.3-5" />
      <circle cx="14" cy="4.5" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  'estender-reta': (
    <>
      <line x1="3" y1="15.5" x2="9.5" y2="9.5" />
      <line x1="9.5" y1="9.5" x2="15.5" y2="4" strokeDasharray="2.2 1.8" />
      <path d="M12.5 3.5H16V7" />
    </>
  ),
  'estender-ate-elemento': (
    <>
      <line x1="16" y1="2.5" x2="16" y2="17.5" />
      <line x1="3" y1="13.5" x2="9" y2="11.3" />
      <line x1="9" y1="11.3" x2="16" y2="8.7" strokeDasharray="2.2 1.8" />
    </>
  ),
  'estender-duas-retas': (
    <>
      <path d="M3 16.5 7 11" />
      <path d="M17 16.5 13 11" />
      <path d="M7 11 10 6.8 13 11" strokeDasharray="2.2 1.8" />
    </>
  ),
  'dividir-curva': (
    <>
      <path d="M3 15.5c3-9 8-11.5 14-10.5" />
      <line x1="6.2" y1="6" x2="9.8" y2="10.6" />
    </>
  ),
  'curva-predefinida': <path d="M4 16.5c0-7.5 3-12.5 8-12.5 3 0 4.6 2 4.6 4.2S15 12 12.8 12c-1.5 0-2.4-.9-2.4-2.1" />,
  espiral: <path d="M10 10.6a1.2 1.2 0 1 0-1.2-1.2c0 1.8 1.5 3.2 3.3 3.2a4.3 4.3 0 0 0 4.3-4.3 5.9 5.9 0 0 0-5.9-5.8A7.2 7.2 0 0 0 3.3 9.7" />,
  'cadastrar-curva': (
    <>
      <path d="M3 15.5c2-7.5 5-10.5 9-10.5" />
      <path d="M14.5 11v6M11.5 14h6" />
    </>
  ),
  'editar-pontos-de-curva': (
    <>
      <path d="M3.5 15c3-9 7.5-10.8 13-10" />
      <rect x="2.1" y="13.6" width="2.8" height="2.8" fill="currentColor" stroke="none" />
      <rect x="15.1" y="3.6" width="2.8" height="2.8" fill="currentColor" stroke="none" />
      <rect x="6.8" y="6.2" width="2.8" height="2.8" fill="currentColor" stroke="none" />
    </>
  ),
  'ponto-por-coordenada': (
    <>
      <path d="M4 3v13h13" />
      <path d="M12 8v8M12 8H4" strokeDasharray="1.8 1.6" />
      <circle cx="12" cy="8" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  'ponto-por-intersecao': (
    <>
      <path d="M4 4l12 12M16 4 4 16" />
      <circle cx="10" cy="10" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  'ponto-no-centro': (
    <>
      <circle cx="10" cy="10" r="6.8" strokeDasharray="2.6 2" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  'ponto-no-perimetro': (
    <>
      <path d="M3 14.5 8 6.5l5 7 4-8.5" />
      <circle cx="5.5" cy="10.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15" cy="9.2" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  'ponto-por-distancia': (
    <>
      <line x1="3" y1="14" x2="17" y2="14" />
      <circle cx="13" cy="14" r="1.5" fill="currentColor" stroke="none" />
      <path d="M3 8.5h10M5 6.8 3 8.5l2 1.7M11 6.8l2 1.7-2 1.7" />
    </>
  ),
  'arco-por-raio': (
    <>
      <path d="M4 15.5A11.5 11.5 0 0 1 15.5 4" />
      <path d="M15.5 15.5 7.4 7.4" strokeDasharray="2.2 1.8" />
      <circle cx="15.5" cy="15.5" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  'inserir-texto': <path d="M5 16.5 10 3.5l5 13M6.9 11.5h6.2" />,
  'editar-texto': (
    <>
      <path d="M2.5 16.5 7 5l4.5 11.5M4.2 12h5.6" />
      <path d="M13 17v-2.3l3.6-3.6 2.3 2.3L15.3 17z" />
    </>
  ),
  'extrair-molde': (
    <>
      <path d="M3 3h8v9H3z" strokeDasharray="2.2 1.8" />
      <path d="M9 8h8v9H9z" fill="currentColor" fillOpacity="0.18" />
    </>
  ),
  digitalizar: (
    <>
      <rect x="2.5" y="4" width="15" height="12" rx="1.2" />
      <circle cx="11.5" cy="10" r="2.2" />
      <path d="M11.5 6.2v1.6M11.5 12.2v1.6M7.7 10h1.6M13.7 10h1.6" />
    </>
  ),
  'sentido-do-fio': (
    <>
      <path d="M4.5 2.5h11v15h-11z" />
      <path d="M10 5.5v9M8.3 7.2 10 5.5l1.7 1.7M8.3 12.8l1.7 1.7 1.7-1.7" />
    </>
  ),
  'linha-de-simetria': (
    <>
      <line x1="10" y1="2" x2="10" y2="18" strokeDasharray="3.2 1.5 0.8 1.5" />
      <path d="M10 4H5.5L3.5 9l2 7H10" />
      <path d="M10 4h4.5l2 5-2 7H10" strokeOpacity="0.4" />
    </>
  ),
  bainha: (
    <>
      <path d="M4 3v14h12V3" />
      <line x1="4" y1="13" x2="16" y2="13" strokeDasharray="2.2 1.8" />
    </>
  ),
  dobrar: (
    <>
      <path d="M3 6h7v11H3z" />
      <path d="M10 6h7v11h-7" strokeDasharray="2.2 1.8" />
      <path d="M14.5 4.2c-2.5-1.6-5-1.6-7.5 0M7 2v2.4h2.4" />
    </>
  ),
  desdobrar: (
    <>
      <path d="M3 6h7v11H3z" />
      <path d="M10 6h7v11h-7" />
      <path d="M5.5 4.2c2.5-1.6 5-1.6 7.5 0M13 2v2.4h-2.4" />
    </>
  ),
  costura: (
    <>
      <path d="M6.5 6.5h7v7h-7z" />
      <path d="M3 3h14v14H3z" strokeDasharray="2.2 1.8" />
    </>
  ),
  'remover-costura': (
    <>
      <path d="M6.5 6.5h7v7h-7z" />
      <path d="M3 3h14v14H3z" strokeDasharray="2.2 1.8" strokeOpacity="0.5" />
      <path d="M3.5 16.5 16.5 3.5" />
    </>
  ),
  'converter-contorno': (
    <>
      <path d="M3 3h14v14H3z" />
      <path d="M6.5 6.5h7v7h-7z" strokeDasharray="2.2 1.8" strokeOpacity="0.6" />
      <path d="M8.5 8.5 13 13M13 10.2V13h-2.8" />
    </>
  ),
  pregas: <path d="M2.5 5.5 5 14.5l2.5-9 2.5 9 2.5-9 2.5 9 2.5-9" />,
  'pence-no-contorno': (
    <>
      <path d="M3 5h5l2 9.5L12 5h5" />
      <path d="M3 5v11.5h14V5" strokeOpacity="0.45" />
    </>
  ),
  'pence-interna': (
    <>
      <rect x="3" y="3" width="14" height="14" />
      <path d="M10 5.5 12 10l-2 4.5L8 10z" />
    </>
  ),
  'fechar-pence': (
    <>
      <path d="M6.5 4 10 16l3.5-12" />
      <path d="M2.5 8.5h3.2M4.4 7.2l1.3 1.3-1.3 1.3M17.5 8.5h-3.2M15.6 7.2l-1.3 1.3 1.3 1.3" />
    </>
  ),
  'transferir-pence': (
    <>
      <path d="M2.5 4 5 12.5 7.5 4" />
      <path d="M12.5 16 15 7.5l2.5 8.5" strokeDasharray="2.2 1.8" />
      <path d="M7.5 14.5c1.6 1.8 3.2 1.8 4.6.2M12.3 12.2v2.6H9.7" />
    </>
  ),
  'multiplas-pences': <path d="M2.5 5l2 10 2-10M8 5l2 10 2-10M13.5 5l2 10 2-10" />,
  'cortar-molde': (
    <>
      <path d="M3 5h14v11H3z" />
      <path d="M6.5 2 13.5 19" strokeDasharray="2.4 1.8" />
    </>
  ),
  'unir-moldes': (
    <>
      <rect x="2" y="5.5" width="6" height="9.5" />
      <rect x="12" y="5.5" width="6" height="9.5" />
      <path d="M8.6 10.2h2.8M10.2 9l1.2 1.2-1.2 1.2" />
    </>
  ),
  'remover-regiao': (
    <>
      <path d="M3 3h14v14H3z" />
      <path d="M8 8h6.5v6.5H8z" strokeDasharray="2.2 1.8" />
      <path d="M9.8 9.8l3 3M12.8 9.8l-3 3" />
    </>
  ),
  'tabela-de-graduacao': (
    <>
      <rect x="3" y="4" width="14" height="12" rx="0.8" />
      <path d="M3 8h14M3 12h14M8 4v12M12.5 4v12" />
    </>
  ),
  'graduar-automatico': (
    <>
      <path d="M3 16.5V8l4.5-4.5H12" />
      <path d="M6.5 16.5V10L10 6.5h4.5" />
      <path d="M10 16.5V12l2.5-2.5H17" />
    </>
  ),
  'graduar-mouse': (
    <>
      <path d="M3 15.5V7l4-4" />
      <path d="M6.5 15.5V9l3-3" />
      <path d="M10 9.5l7.5 3-3.2 1.2L13 17z" />
    </>
  ),
  'graduar-tangente': (
    <>
      <path d="M3 16c2-7.5 6-10.5 11-10.5" />
      <line x1="3.5" y1="7.6" x2="17" y2="4" />
      <circle cx="10.3" cy="5.8" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  regras: (
    <>
      <path d="M7.5 5H17M7.5 10H17M7.5 15H17" />
      <circle cx="4" cy="5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="4" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="4" cy="15" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  'criar-regra': (
    <>
      <path d="M3 5h9M3 10h6M3 15h6" />
      <path d="M14 10v7M10.5 13.5h7" />
    </>
  ),
  'remover-graduacao': (
    <>
      <path d="M3 15.5V7l4-4" />
      <path d="M6.5 15.5V9l3-3" />
      <path d="M12 11.5l5 5M17 11.5l-5 5" />
    </>
  ),
  'separar-graduacao': (
    <>
      <path d="M3 4h4.5v12H3z" />
      <path d="M12.5 4H17v12h-4.5z" />
      <path d="M8.4 10h3.2M9.4 9l-1 1 1 1M10.6 9l1 1-1 1" />
    </>
  ),
  'unir-graduacao': (
    <>
      <path d="M3 16.5V6.5L6.5 3h7L17 6.5v10z" />
      <path d="M6.5 16.5V9l1.8-2h3.4l1.8 2v7.5" />
    </>
  ),
  'agrupar-graduacao': (
    <>
      <rect x="2.5" y="2.5" width="15" height="15" strokeDasharray="2.2 1.8" />
      <rect x="5" y="5" width="4.5" height="6" />
      <rect x="10.5" y="9" width="4.5" height="6" />
    </>
  ),
  'deduzir-graduacao': (
    <>
      <path d="M3 15.5V7l4-4" />
      <path d="M6.5 15.5V9l3-3" strokeDasharray="2.2 1.8" />
      <path d="M10 15.5V11l2-2" />
    </>
  ),
  'copiar-graduacao': (
    <>
      <path d="M2.5 13V6l3-3M5 13V8l2-2" />
      <path d="M12.5 17.5v-7l3-3M15 17.5v-5l2-2" />
      <path d="M7.8 11.5H11M9.8 10.2l1.2 1.3-1.2 1.3" />
    </>
  ),
  'ajustar-graduacao': (
    <>
      <path d="M3.5 5.5h13M3.5 10h13M3.5 14.5h13" />
      <circle cx="8" cy="5.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="13" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="7" cy="14.5" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  'graduar-curva': (
    <>
      <path d="M3 14.5c2-7 5-10 9-10" />
      <path d="M5.5 16c2-6.2 5-8.8 9-8.8" />
      <path d="M8 17.5c2-5.4 4.6-7.6 8.5-7.6" />
    </>
  ),
  conferir: (
    <>
      <path d="M3 3.5h6v9H3z" />
      <path d="M11 5.5h6v9h-6z" />
      <path d="M4.5 16l1.8 1.8 3.2-3.6" />
    </>
  ),
  'cota-perimetro': (
    <>
      <path d="M4 4h8.5v7.5H4z" />
      <path d="M4 15.5h8.5M5.5 14.2 4 15.5l1.5 1.3M11 14.2l1.5 1.3-1.5 1.3" />
      <path d="M16 4v7.5M14.7 5.5 16 4l1.3 1.5M14.7 10l1.3 1.5 1.3-1.5" />
    </>
  ),
  perimetro: (
    <>
      <path d="M5 4h8l4 6-4 6.5H5L2.5 10z" />
      <path d="M7.5 2.2v3.6M10.5 2.2v3.6" />
    </>
  ),
  'comparar-perimetros': (
    <>
      <path d="M2.5 3.5h6V10h-6z" />
      <path d="M11.5 3.5h6V10h-6z" />
      <path d="M6 14h8M6 17h8" />
    </>
  ),
  'cota-distancia': (
    <>
      <path d="M3 3.5v9M17 3.5v9" />
      <path d="M3 8.5h14M5 6.8 3 8.5l2 1.7M15 6.8l2 1.7-2 1.7" />
      <path d="M7 16.5h6" />
    </>
  ),
  distancia: (
    <>
      <path d="M4.5 15.5 15.5 4.5" strokeDasharray="2.6 2" />
      <circle cx="4.5" cy="15.5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="4.5" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  'comparar-distancia': (
    <>
      <path d="M3 5h14M3 3.5v3M17 3.5v3" />
      <path d="M3 10h9M3 8.5v3M12 8.5v3" />
      <path d="M6 14.5h8M6 17.2h8" />
    </>
  ),
  'cota-horizontal-vertical': (
    <>
      <path d="M6.5 16H17M8 14.6 6.5 16 8 17.4M15.5 14.6 17 16l-1.5 1.4" />
      <path d="M3.5 3v10.5M2.1 4.5 3.5 3l1.4 1.5M2.1 12l1.4 1.5 1.4-1.5" />
    </>
  ),
  angulo: (
    <>
      <path d="M3 16.5h14" />
      <path d="M3 16.5 12.5 4" />
      <path d="M10 16.5a7 7 0 0 0-2.7-5.5" />
    </>
  ),
  raio: (
    <>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 10l4.9-4.9" />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  propriedades: (
    <>
      <path d="M5 2.5h7l3.5 3.5v11.5H5z" />
      <path d="M12 2.5V6h3.5" />
      <path d="M7.5 9.5h5M7.5 12h5M7.5 14.5h3" />
    </>
  ),
  informacoes: (
    <>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 9v5.2" />
      <circle cx="10" cy="6.2" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  autor: (
    <>
      <circle cx="10" cy="7" r="3.3" />
      <path d="M3.5 17.5c.6-3.8 3.2-5.8 6.5-5.8s5.9 2 6.5 5.8" />
    </>
  ),
  'informacoes-dos-moldes': (
    <>
      <path d="M3 4h6.5L11 8l-1.5 8.5H3z" />
      <path d="M13.5 6h4M13.5 10h4M13.5 14h4" />
    </>
  ),
  variantes: (
    <>
      <rect x="9.5" y="2.5" width="8" height="10" />
      <path d="M9.5 5.2H6v10.3h8v-3" />
      <path d="M6 8H2.5v9.5h8v-2" />
    </>
  ),
  'relacionamento-piques': (
    <>
      <path d="M3.5 3v14M16.5 3v14" />
      <path d="M3.5 7H6M16.5 7H14M3.5 13H6M16.5 13H14" />
      <path d="M7 7h6M7 13h6" strokeDasharray="1.8 1.6" />
    </>
  ),
  imagens: (
    <>
      <rect x="2.5" y="4" width="15" height="12" rx="1.2" />
      <path d="M2.5 13.5 7 9.5l3.5 3 2.5-2 4.5 3.5" />
      <circle cx="13.5" cy="7.5" r="1.2" />
    </>
  ),
  'localizar-modelos': (
    <>
      <circle cx="8.5" cy="8.5" r="5.5" />
      <path d="M12.6 12.6 17.5 17.5" />
      <path d="M6.5 6.8h4v3.4h-4z" />
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

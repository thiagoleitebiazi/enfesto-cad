import { afterEach, describe, it, expect, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import { BarraDeFerramentas } from './BarraDeFerramentas';

type Props = React.ComponentProps<typeof BarraDeFerramentas>;

/** Um projeto com peças e uma delas selecionada, sem nada mais ligado. */
function propsBase(): Props {
  return {
    modo: 'selecionar',
    podeDesfazer: false,
    podeRefazer: false,
    temSelecao: true,
    temSelecaoUnica: true,
    onNovoProjeto: vi.fn(),
    onDesfazer: vi.fn(),
    onRefazer: vi.fn(),
    onDuplicar: vi.fn(),
    onExcluir: vi.fn(),
    onSelecionarTudo: vi.fn(),
    podeSelecionarTudo: true,
    onCopiar: vi.fn(),
    onRecortar: vi.fn(),
    onColar: vi.fn(),
    podeColar: true,
    onZoomIn: vi.fn(),
    onZoomOut: vi.fn(),
    onAjustarTela: vi.fn(),
    onVistaAnterior: vi.fn(),
    onProximaVista: vi.fn(),
    podeVistaAnterior: false,
    podeProximaVista: false,
    mostrarGrade: false,
    onAlternarGrade: vi.fn(),
    imaAtivo: false,
    onAlternarIma: vi.fn(),
    unidadeDaRegua: 'cm',
    onDefinirUnidadeDaRegua: vi.fn(),
    onAbrirAtalhos: vi.fn(),
    onAbrirSobre: vi.fn(),
    mostrarListaDePecas: true,
    onAlternarListaDePecas: vi.fn(),
    mostrarBarraDeVisualizacao: true,
    onAlternarBarraDeVisualizacao: vi.fn(),
    mostrarValidacao: false,
    onAlternarValidacao: vi.fn(),
    onAbrirPropriedadesDaPeca: vi.fn(),
    temCerca: false,
    onAlternarDefinirCerca: vi.fn(),
    onMoverCerca: vi.fn(),
    onEntrarModoSelecionar: vi.fn(),
    onEntrarModoNovoMolde: vi.fn(),
    onEntrarModoNovoFuro: vi.fn(),
    onEntrarModoPique: vi.fn(),
    onEntrarModoMarca: vi.fn(),
    onImportarDxf: vi.fn(),
    onImportarPdf: vi.fn(),
    onAbrirTecido: vi.fn(),
    onAbrirEnfesto: vi.fn(),
    onSugerirPosicao: vi.fn(),
    podeSugerirPosicao: true,
    onNestingAutomatico: vi.fn(),
    podeExecutarNesting: true,
    onEntrarModoMoverPonto: vi.fn(),
    onEntrarModoModificar: vi.fn(),
    onEntrarModoRedefinirPerimetro: vi.fn(),
    onEntrarModoInserirPonto: vi.fn(),
    onEntrarModoExcluirPonto: vi.fn(),
    onEntrarModoArredondarOuChanfrar: vi.fn(),
    onAbrirDimensionar: vi.fn(),
    onEspelharManual: vi.fn(),
    onGirarLivre: vi.fn(),
    onElementoParalelo: vi.fn(),
    onConverterEmCostura: vi.fn(),
    onAlinhar: vi.fn(),
    podeAlinhar: false,
    onAbrirExportacaoPdf: vi.fn(),
    podeExportarPdf: true,
    onSalvar: vi.fn(),
    onSalvarComo: vi.fn(),
    onAbrirBiblioteca: vi.fn(),
    onAbrirHistorico: vi.fn(),
    onAbrirRelatorio: vi.fn(),
    onInverterSelecao: vi.fn(),
    onCriarPontoDeRestauracao: vi.fn(),
    onRestaurar: vi.fn(),
    temPontoDeRestauracao: true,
    onEntrarModoRetangulo: vi.fn(),
    onEntrarModoSentidoDoFio: vi.fn(),
    onAbrirCostura: vi.fn(),
    onRemoverCostura: vi.fn(),
    podeRemoverCostura: true,
    onEntrarModoMedirDistancia: vi.fn(),
    onEntrarModoMedirPerimetro: vi.fn(),
    onEntrarModoCompararPerimetros: vi.fn(),
    onAbrirInformacoesDosMoldes: vi.fn(),
    onEntrarModoCompararDistancias: vi.fn(),
    onEntrarModoCotaDistancia: vi.fn(),
    onEntrarModoCotaHorizontalVertical: vi.fn(),
    onEntrarModoCotaAngulo: vi.fn(),
    onEntrarModoCotaPerimetro: vi.fn(),
    onConverterEmContorno: vi.fn(),
    onAbrirVariantes: vi.fn(),
    onEntrarModoCurva: vi.fn(),
    onEntrarModoArco2Pontos: vi.fn(),
    onEntrarModoArco3Pontos: vi.fn(),
    onEntrarModoArcoTangente: vi.fn(),
    onEntrarModoEditarPontosDeCurva: vi.fn(),
    onEntrarModoCadastrarCurva: vi.fn(),
    onAbrirCurvaPredefinida: vi.fn(),
    onAbrirEspiral: vi.fn(),
    onEntrarModoCirculo: vi.fn(),
    onUsarFerramentaDeMolde: vi.fn(),
    temOutraPeca: true,
    onUsarFerramentaDeAnotacao: vi.fn(),
    onAbrirImagens: vi.fn(),
    onAbrirProgramas: vi.fn(),
    podeAbrirProgramas: true,
    onUsarFerramentaDeElemento: vi.fn(),
    onUsarFerramentaDeArco: vi.fn(),
    onEntrarModoCotaRaio: vi.fn(),
    onUsarFerramentaDeGraduacao: vi.fn(),
    temGraduacao: false,
    temOutrasMarcadas: false,
  };
}

function renderizar(aba: string, sobrescrever: Partial<Props> = {}): Props {
  const props = { ...propsBase(), ...sobrescrever };
  render(<BarraDeFerramentas {...props} />);
  fireEvent.click(screen.getByRole('tab', { name: aba }));
  return props;
}

const painel = (): HTMLElement => screen.getByRole('tabpanel');
const botao = (nome: string): HTMLButtonElement => within(painel()).getByRole<HTMLButtonElement>('button', { name: nome });

/** Os grupos da aba aberta, cada um com os nomes dos seus botões, na ordem da tela. */
function gruposDaAba(): Record<string, string[]> {
  return Object.fromEntries(
    within(painel())
      .getAllByRole('group')
      .map((grupo) => [
        grupo.getAttribute('aria-label') ?? '',
        within(grupo)
          .getAllByRole('button')
          .map((b) => b.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
      ]),
  );
}

const botoesDesligados = (): HTMLButtonElement[] =>
  within(painel())
    .getAllByRole<HTMLButtonElement>('button')
    .filter((b) => b.disabled);

describe('BarraDeFerramentas: abas', () => {
  afterEach(() => cleanup());

  it('mostra as abas na ordem de um CAD de moldes, com a de Encaixe no fim, e abre em Início', () => {
    render(<BarraDeFerramentas {...propsBase()} />);

    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual([
      'Arquivo',
      'Início',
      'Construção',
      'Produção',
      'Marcações',
      'Graduação',
      'Manipulação',
      'Conferência',
      'Modelo',
      'Encaixe',
    ]);
    expect(screen.getByRole('tab', { name: 'Início' })).toHaveAttribute('aria-selected', 'true');
  });

  it('Início: Desenho, Editar, Selecionar, Restauração e Programas', () => {
    renderizar('Início');

    expect(gruposDaAba()).toEqual({
      Desenho: ['Cor'],
      Editar: ['Colar', 'Recortar', 'Copiar', 'Excluir'],
      Selecionar: ['Selecionar', 'Inverter seleção', 'Selecionar tudo', 'Inverter moldes', 'Selecionar moldes'],
      Restauração: ['Ponto de restauração', 'Restaurar'],
      Programas: ['Programas'],
    });
  });

  it('Construção: Retas, Curvas, Pontos, Arcos e Texto', () => {
    renderizar('Construção');

    expect(gruposDaAba()).toEqual({
      Retas: ['Reta', 'Retângulo', 'Por ângulo', 'Estender reta', 'Estender até elemento', 'Estender duas retas'],
      Curvas: ['Curva', 'Dividir curva', 'Pré-definida', 'Espiral e curvas', 'Cadastrar curva', 'Editar pontos de curva'],
      Pontos: ['Por coordenada', 'Por interseção', 'No centro do arco', 'No perímetro', 'Por distância'],
      Arcos: [
        'Por raio',
        'Arco por 2 pontos',
        'Arco por 3 pontos',
        'Arco tangente à reta ou arco',
        'Arco tangente a 2 retas',
        'Arco tangente a arco e reta',
        'Arco tangente a 2 arcos',
      ],
      Texto: ['Inserir texto', 'Editar texto'],
    });
  });

  it('Produção: Definir moldes, Complementar moldes, Costura, Pregas e Pences, Cortar e Unir', () => {
    renderizar('Produção');

    expect(gruposDaAba()).toEqual({
      'Definir moldes': ['Extrair molde', 'Criar molde', 'Digitalizar', 'Sentido do fio'],
      'Complementar moldes': ['Linha de simetria', 'Bainha', 'Dobrar', 'Desdobrar'],
      Costura: ['Costura', 'Remover costura', 'Converter em contorno', 'Converter em costura'],
      'Pregas e Pences': ['Pregas', 'Pence no contorno', 'Pence interna', 'Fechar pence', 'Transferir pence', 'Múltiplas pences'],
      'Cortar e Unir': ['Cortar', 'Unir', 'Remover região'],
    });
  });

  it('Graduação: Graduar e Manipular graduação', () => {
    renderizar('Graduação');

    expect(gruposDaAba()).toEqual({
      Graduar: ['Tabela', 'Automático', 'Mouse', 'Tangente', 'Regras', 'Criar regra'],
      'Manipular graduação': [
        'Remover graduação',
        'Separar',
        'Unir',
        'Agrupar',
        'Deduzir',
        'Copiar graduação',
        'Ajustar',
        'Graduar curva',
      ],
    });
  });

  it('Conferência: Perímetro e Distância', () => {
    renderizar('Conferência');

    expect(gruposDaAba()).toEqual({
      Perímetro: ['Conferir', 'Cota perímetro', 'Perímetro', 'Comparar perímetros'],
      Distância: ['Cota distância', 'Distância', 'Comparar distância', 'Horizontal / Vertical', 'Ângulo', 'Raio'],
    });
  });

  it('Modelo: Informações e Operações', () => {
    renderizar('Modelo');

    expect(gruposDaAba()).toEqual({
      Informações: ['Propriedades', 'Informações', 'Tecidos', 'Autor', 'Informações dos moldes'],
      Operações: ['Variantes', 'Relacionamento piques', 'Imagens', 'Localizar modelos'],
    });
  });

  it('Marcações ganhou o Furo, que saiu da Construção', () => {
    const props = renderizar('Marcações');

    expect(gruposDaAba()).toEqual({ Marcações: ['Pique', 'Marca', 'Furo'] });
    fireEvent.click(botao('Furo'));
    expect(props.onEntrarModoNovoFuro).toHaveBeenCalledTimes(1);
  });
});

describe('BarraDeFerramentas: ferramentas desligadas', () => {
  afterEach(() => cleanup());

  const ABAS = ['Início', 'Construção', 'Produção', 'Marcações', 'Graduação', 'Manipulação', 'Conferência', 'Modelo', 'Encaixe'];
  const nomeDo = (b: HTMLButtonElement): string => b.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  // Marcações e Manipulação ainda escrevem a dica do jeito antigo (só o motivo), e ficam de fora desta regra.
  it.each(ABAS.filter((a) => a !== 'Marcações' && a !== 'Manipulação'))('%s: sem peça nenhuma, todo botão desligado diz na dica o nome da ferramenta e o motivo', (aba) => {
    renderizar(aba, { temSelecao: false, temSelecaoUnica: false, podeSelecionarTudo: false });

    for (const b of botoesDesligados()) {
      const nome = nomeDo(b);
      expect(b.title.startsWith(`${nome} — `), `dica de "${nome}": ${b.title}`).toBe(true);
      expect(b.title.length).toBeGreaterThan(nome.length + 15);
    }
  });

  it('sem peça nenhuma, há ferramentas desligadas nas abas de desenho — a regra da dica não passa em branco', () => {
    for (const aba of ['Início', 'Construção', 'Produção', 'Conferência', 'Modelo']) {
      renderizar(aba, { temSelecao: false, temSelecaoUnica: false, podeSelecionarTudo: false });
      expect(botoesDesligados().length, aba).toBeGreaterThan(0);
      cleanup();
    }
  });

  it('com peça selecionada e tudo à mão, nenhuma ferramenta fica desligada: não há mais ferramenta que o programa não tenha', () => {
    const desligadas: Record<string, string[]> = {};
    for (const aba of ABAS.filter((a) => a !== 'Graduação')) {
      renderizar(aba, { podeAlinhar: true, podeVistaAnterior: true, podeProximaVista: true, temCerca: true });
      const nomes = botoesDesligados().map(nomeDo);
      if (nomes.length > 0) desligadas[aba] = nomes;
      cleanup();
    }

    expect(desligadas).toEqual({});
  });

  it('Digitalizar e Imagens abrem as imagens do modelo, cada um do seu jeito, mesmo sem peça nenhuma', () => {
    const onAbrirImagens = vi.fn();
    const semPecas = { onAbrirImagens, temSelecao: false, temSelecaoUnica: false, podeSelecionarTudo: false };

    renderizar('Produção', semPecas);
    fireEvent.click(botao('Digitalizar'));
    cleanup();
    renderizar('Modelo', semPecas);
    fireEvent.click(botao('Imagens'));

    expect(onAbrirImagens.mock.calls).toEqual([['digitalizar'], ['imagens']]);
  });

  it('Programas abre os atalhos; no navegador, fica desligado e diz que é só no programa instalado', () => {
    const props = renderizar('Início', { temSelecao: false, temSelecaoUnica: false, podeSelecionarTudo: false });
    fireEvent.click(botao('Programas'));
    expect(props.onAbrirProgramas).toHaveBeenCalledTimes(1);
    cleanup();

    renderizar('Início', { podeAbrirProgramas: false });
    expect(botao('Programas')).toBeDisabled();
    expect(botao('Programas').title).toBe('Programas — disponível só no programa instalado, não no navegador');
  });

  it('Digitalizar fica pressionado enquanto se calibra a escala da imagem', () => {
    renderizar('Produção', { modo: 'calibrar-imagem' });

    expect(botao('Digitalizar')).toHaveAttribute('aria-pressed', 'true');
    expect(within(painel()).getAllByRole('button', { pressed: true })).toHaveLength(1);
  });

  it('Graduação: a aba explica, sem precisar do mouse, que a peça desenhada é o tamanho base', () => {
    renderizar('Graduação');

    expect(screen.getByText(/A peça desenhada é o tamanho base/)).toBeInTheDocument();
  });

  it('a nota da Graduação não aparece nas outras abas', () => {
    renderizar('Produção');

    expect(screen.queryByText(/A peça desenhada é o tamanho base/)).not.toBeInTheDocument();
  });
});

describe('BarraDeFerramentas: Graduação', () => {
  afterEach(() => cleanup());

  const QUE_PEDEM_TAMANHOS = [
    'Automático',
    'Mouse',
    'Tangente',
    'Regras',
    'Criar regra',
    'Remover graduação',
    'Separar',
    'Agrupar',
    'Deduzir',
    'Copiar graduação',
    'Ajustar',
    'Graduar curva',
  ];

  it('na peça sem tamanhos, só a Tabela está ligada: é por ela que a graduação começa', () => {
    renderizar('Graduação');

    expect(botao('Tabela')).toBeEnabled();
    for (const nome of QUE_PEDEM_TAMANHOS) {
      expect(botao(nome)).toBeDisabled();
      expect(botao(nome).title).toBe(`${nome} — defina os tamanhos primeiro, em “Tabela”`);
    }
    expect(botao('Unir').title).toBe('Unir — marque na lista as peças dos outros tamanhos');
  });

  it('na peça graduada, todas ficam ligadas; Unir pede as peças dos outros tamanhos marcadas na lista', () => {
    renderizar('Graduação', { temGraduacao: true });
    expect(botoesDesligados().map((b) => b.textContent?.trim())).toEqual(['Unir']);
    cleanup();

    renderizar('Graduação', { temOutrasMarcadas: true });
    expect(botao('Unir')).toBeEnabled();
  });

  it('sem peça selecionada, todas ficam desligadas e dizem o que falta', () => {
    renderizar('Graduação', { temSelecao: false, temSelecaoUnica: false, temGraduacao: false });

    expect(botoesDesligados()).toHaveLength(14);
    for (const nome of ['Tabela', 'Unir', ...QUE_PEDEM_TAMANHOS]) {
      expect(botao(nome).title).toBe(`${nome} — selecione uma peça primeiro`);
    }
  });

  it('cada botão chama a ferramenta dele', () => {
    const props = renderizar('Graduação', { temGraduacao: true, temOutrasMarcadas: true });

    const nomes = [
      'Tabela',
      'Automático',
      'Mouse',
      'Tangente',
      'Regras',
      'Criar regra',
      'Remover graduação',
      'Separar',
      'Unir',
      'Agrupar',
      'Deduzir',
      'Copiar graduação',
      'Ajustar',
      'Graduar curva',
    ];
    for (const nome of nomes) fireEvent.click(botao(nome));

    expect(vi.mocked(props.onUsarFerramentaDeGraduacao).mock.calls.map(([ferramenta]) => ferramenta)).toEqual([
      'graduar-tabela',
      'graduar-automatico',
      'graduar-mouse',
      'graduar-tangente',
      'graduar-regras',
      'criar-regra',
      'remover-graduacao',
      'separar-tamanhos',
      'unir-tamanhos',
      'agrupar-graduacao',
      'deduzir-graduacao',
      'copiar-graduacao',
      'ajustar-graduacao',
      'graduar-curva',
    ]);
  });

  it.each([
    ['Tabela', 'graduar-tabela'],
    ['Automático', 'graduar-automatico'],
    ['Mouse', 'graduar-mouse'],
    ['Tangente', 'graduar-tangente'],
    ['Regras', 'graduar-regras'],
    ['Criar regra', 'criar-regra'],
    ['Remover graduação', 'remover-graduacao'],
    ['Agrupar', 'agrupar-graduacao'],
    ['Deduzir', 'deduzir-graduacao'],
    ['Copiar graduação', 'copiar-graduacao'],
    ['Ajustar', 'ajustar-graduacao'],
    ['Graduar curva', 'graduar-curva'],
  ] as const)('%s aparece pressionado enquanto é a ferramenta ligada', (nome, modo) => {
    renderizar('Graduação', { modo, temGraduacao: true });

    expect(botao(nome)).toHaveAttribute('aria-pressed', 'true');
    expect(within(painel()).getAllByRole('button', { pressed: true })).toHaveLength(1);
  });

  it('Unir age na hora, sem estado de pressionado; Separar fica pressionada enquanto espera o clique da posição', () => {
    renderizar('Graduação', { temGraduacao: true, temOutrasMarcadas: true });

    expect(botao('Separar')).toHaveAttribute('aria-pressed', 'false');
    expect(botao('Unir')).not.toHaveAttribute('aria-pressed');
    expect(botao('Separar').title).toContain('onde for indicado com o mouse');
  });

  it('com o Separar à espera do clique, o botão dele fica pressionado', () => {
    renderizar('Graduação', { temGraduacao: true, modo: 'separar-tamanhos' });

    expect(botao('Separar')).toHaveAttribute('aria-pressed', 'true');
  });

  it('as ferramentas que o manual da referência não descreve dizem isso na dica', () => {
    renderizar('Graduação', { temGraduacao: true });

    expect(botao('Deduzir').title).toContain('leitura natural');
    expect(botao('Graduar curva').title).toContain('ponto de curva graduado');
  });
});

describe('BarraDeFerramentas: ferramentas ligadas', () => {
  afterEach(() => cleanup());

  it('Início: cada botão chama a sua ação', () => {
    const props = renderizar('Início');

    fireEvent.click(botao('Colar'));
    fireEvent.click(botao('Recortar'));
    fireEvent.click(botao('Copiar'));
    fireEvent.click(botao('Excluir'));
    fireEvent.click(botao('Selecionar'));
    fireEvent.click(botao('Inverter seleção'));
    fireEvent.click(botao('Inverter moldes'));
    fireEvent.click(botao('Ponto de restauração'));
    fireEvent.click(botao('Restaurar'));

    for (const acao of [
      props.onColar,
      props.onRecortar,
      props.onCopiar,
      props.onExcluir,
      props.onEntrarModoSelecionar,
      props.onCriarPontoDeRestauracao,
      props.onRestaurar,
    ]) {
      expect(acao).toHaveBeenCalledTimes(1);
    }
    // "Inverter moldes" faz o mesmo que "Inverter seleção": aqui todo objeto é um molde.
    expect(props.onInverterSelecao).toHaveBeenCalledTimes(2);
  });

  it('Início: "Selecionar tudo" e "Selecionar moldes" selecionam todas as peças (aqui todo objeto é um molde)', () => {
    const props = renderizar('Início');

    fireEvent.click(botao('Selecionar tudo'));
    fireEvent.click(botao('Selecionar moldes'));

    expect(props.onSelecionarTudo).toHaveBeenCalledTimes(2);
  });

  it('Construção: Reta desenha um molde novo e Retângulo liga a ferramenta de retângulo', () => {
    const props = renderizar('Construção');

    fireEvent.click(botao('Reta'));
    fireEvent.click(botao('Retângulo'));

    expect(props.onEntrarModoNovoMolde).toHaveBeenCalledTimes(1);
    expect(props.onEntrarModoRetangulo).toHaveBeenCalledTimes(1);
  });

  it('Construção: as seis ferramentas de curva e as quatro de arco que funcionam', () => {
    const props = renderizar('Construção');

    for (const nome of [
      'Curva',
      'Dividir curva',
      'Pré-definida',
      'Espiral e curvas',
      'Cadastrar curva',
      'Editar pontos de curva',
      'Por raio',
      'Arco por 2 pontos',
      'Arco por 3 pontos',
      'Arco tangente a 2 retas',
    ]) {
      fireEvent.click(botao(nome));
    }

    for (const acao of [
      props.onEntrarModoCurva,
      props.onEntrarModoInserirPonto,
      props.onAbrirCurvaPredefinida,
      props.onAbrirEspiral,
      props.onEntrarModoCadastrarCurva,
      props.onEntrarModoEditarPontosDeCurva,
      props.onEntrarModoCirculo,
      props.onEntrarModoArco2Pontos,
      props.onEntrarModoArco3Pontos,
      props.onEntrarModoArcoTangente,
    ]) {
      expect(acao).toHaveBeenCalledTimes(1);
    }
  });

  it('Construção: sem peça selecionada, só as ferramentas que criam molde novo ficam ligadas', () => {
    renderizar('Construção', { temSelecao: false, temSelecaoUnica: false });

    for (const nome of ['Curva', 'Dividir curva', 'Pré-definida', 'Cadastrar curva', 'Editar pontos de curva', 'Arco por 2 pontos', 'Arco por 3 pontos', 'Arco tangente a 2 retas']) {
      expect(botao(nome).title).toBe(`${nome} — selecione uma peça primeiro`);
    }
    for (const nome of ['Reta', 'Retângulo', 'Espiral e curvas', 'Por raio']) expect(botao(nome)).toBeEnabled();
  });

  it('Construção: as ferramentas de arco sem rótulo são botões só com ícone, com o nome na dica', () => {
    renderizar('Construção');

    for (const nome of ['Arco por 2 pontos', 'Arco por 3 pontos', 'Arco tangente a 2 retas', 'Arco tangente a 2 arcos']) {
      expect(botao(nome)).toHaveClass('botao-so-icone');
      expect(botao(nome).title.startsWith(nome)).toBe(true);
    }
    expect(botao('Por raio')).not.toHaveClass('botao-so-icone');
  });

  it('Manipulação: "Definir curva" liga a mesma ferramenta de Construção > Curva', () => {
    const props = renderizar('Manipulação');

    fireEvent.click(botao('Definir curva'));

    expect(props.onEntrarModoCurva).toHaveBeenCalledTimes(1);
  });

  it('Produção: Criar molde, Sentido do fio e as três ações de costura', () => {
    const props = renderizar('Produção');

    fireEvent.click(botao('Criar molde'));
    fireEvent.click(botao('Sentido do fio'));
    fireEvent.click(botao('Costura'));
    fireEvent.click(botao('Converter em costura'));
    fireEvent.click(botao('Remover costura'));
    fireEvent.click(botao('Converter em contorno'));

    expect(props.onEntrarModoNovoMolde).toHaveBeenCalledTimes(1);
    expect(props.onEntrarModoSentidoDoFio).toHaveBeenCalledTimes(1);
    expect(props.onAbrirCostura).toHaveBeenCalledTimes(2);
    expect(props.onRemoverCostura).toHaveBeenCalledTimes(1);
    expect(props.onConverterEmContorno).toHaveBeenCalledTimes(1);
  });

  it('Construção: os três arcos que dependem de reconhecer arcos no contorno chamam a ferramenta de cada um', () => {
    const props = renderizar('Construção');

    for (const nome of ['Arco tangente à reta ou arco', 'Arco tangente a arco e reta', 'Arco tangente a 2 arcos']) fireEvent.click(botao(nome));

    expect(vi.mocked(props.onUsarFerramentaDeArco).mock.calls.map(([ferramenta]) => ferramenta)).toEqual([
      'arco-tangente-a-elemento',
      'arco-tangente-arco-reta',
      'arco-tangente-2-arcos',
    ]);
  });

  it.each([
    ['Arco tangente à reta ou arco', 'arco-tangente-a-elemento'],
    ['Arco tangente a arco e reta', 'arco-tangente-arco-reta'],
    ['Arco tangente a 2 arcos', 'arco-tangente-2-arcos'],
  ] as const)('Construção: %s aparece pressionado enquanto é a ferramenta ligada', (nome, modo) => {
    renderizar('Construção', { modo });

    expect(botao(nome)).toHaveAttribute('aria-pressed', 'true');
  });

  it('Conferência: Raio liga a cota de raio', () => {
    const props = renderizar('Conferência');

    fireEvent.click(botao('Raio'));

    expect(props.onEntrarModoCotaRaio).toHaveBeenCalledTimes(1);
    cleanup();
    renderizar('Conferência', { modo: 'cota-raio' });
    expect(botao('Raio')).toHaveAttribute('aria-pressed', 'true');
  });

  it('Produção: Bainha, Dobrar, Desdobrar, Cortar, Unir e Remover região chamam a ferramenta de cada um', () => {
    const props = renderizar('Produção');

    for (const nome of ['Bainha', 'Dobrar', 'Desdobrar', 'Cortar', 'Unir', 'Remover região']) fireEvent.click(botao(nome));

    expect(vi.mocked(props.onUsarFerramentaDeMolde).mock.calls.map(([ferramenta]) => ferramenta)).toEqual([
      'bainha',
      'dobrar',
      'desdobrar',
      'cortar',
      'unir',
      'remover-regiao',
    ]);
  });

  it.each([
    ['Bainha', 'bainha'],
    ['Dobrar', 'dobrar'],
    ['Desdobrar', 'desdobrar'],
    ['Cortar', 'cortar'],
    ['Unir', 'unir'],
    ['Remover região', 'remover-regiao'],
  ] as const)('Produção: %s aparece pressionado enquanto é a ferramenta ligada', (nome, modo) => {
    renderizar('Produção', { modo });

    expect(botao(nome)).toHaveAttribute('aria-pressed', 'true');
    expect(within(painel()).getAllByRole('button', { pressed: true })).toHaveLength(1);
  });

  it('Produção: Pregas e as cinco ferramentas de pence chamam a ferramenta de cada uma', () => {
    const props = renderizar('Produção');

    for (const nome of ['Pregas', 'Pence no contorno', 'Pence interna', 'Fechar pence', 'Transferir pence', 'Múltiplas pences']) {
      fireEvent.click(botao(nome));
    }

    expect(vi.mocked(props.onUsarFerramentaDeMolde).mock.calls.map(([ferramenta]) => ferramenta)).toEqual([
      'pregas',
      'pence-no-contorno',
      'pence-interna',
      'fechar-pence',
      'transferir-pence',
      'multiplas-pences',
    ]);
  });

  it.each([
    ['Pregas', 'pregas'],
    ['Pence no contorno', 'pence-no-contorno'],
    ['Pence interna', 'pence-interna'],
    ['Fechar pence', 'fechar-pence'],
    ['Transferir pence', 'transferir-pence'],
    ['Múltiplas pences', 'multiplas-pences'],
  ] as const)('Produção: %s aparece pressionado enquanto é a ferramenta ligada', (nome, modo) => {
    renderizar('Produção', { modo });

    expect(botao(nome)).toHaveAttribute('aria-pressed', 'true');
    expect(within(painel()).getAllByRole('button', { pressed: true })).toHaveLength(1);
  });

  it('Cor, textos, linha de simetria, código de pique, autor e Conferir chamam a ferramenta de cada um', () => {
    const onUsarFerramentaDeAnotacao = vi.fn();
    const clicarEm = (aba: string, nome: string): void => {
      renderizar(aba, { onUsarFerramentaDeAnotacao });
      fireEvent.click(botao(nome));
      cleanup();
    };

    clicarEm('Início', 'Cor');
    clicarEm('Construção', 'Inserir texto');
    clicarEm('Construção', 'Editar texto');
    clicarEm('Produção', 'Linha de simetria');
    clicarEm('Modelo', 'Relacionamento piques');
    clicarEm('Modelo', 'Autor');
    clicarEm('Conferência', 'Conferir');

    expect(onUsarFerramentaDeAnotacao.mock.calls.map(([ferramenta]) => ferramenta)).toEqual([
      'cor',
      'inserir-texto',
      'editar-texto',
      'linha-de-simetria',
      'relacionar-piques',
      'autor',
      'conferir',
    ]);
  });

  it('as ferramentas de anotação que ficam ligadas no desenho aparecem pressionadas no modo delas', () => {
    const casos: Array<[string, string, Props['modo']]> = [
      ['Construção', 'Inserir texto', 'inserir-texto'],
      ['Construção', 'Editar texto', 'editar-texto'],
      ['Produção', 'Linha de simetria', 'linha-de-simetria'],
      ['Modelo', 'Relacionamento piques', 'relacionar-piques'],
      ['Conferência', 'Conferir', 'conferir'],
    ];
    for (const [aba, nome, modo] of casos) {
      renderizar(aba, { modo });
      expect(botao(nome), nome).toHaveAttribute('aria-pressed', 'true');
      expect(within(painel()).getAllByRole('button', { pressed: true }), nome).toHaveLength(1);
      cleanup();
    }
  });

  it('sem peça selecionada: Cor, textos, linha de simetria e código de pique pedem a peça; Autor continua ligado', () => {
    const semSelecao = { temSelecao: false, temSelecaoUnica: false };

    renderizar('Início', semSelecao);
    expect(botao('Cor')).toBeDisabled();
    expect(botao('Cor').title).toMatch(/^Cor — /);
    cleanup();

    renderizar('Construção', semSelecao);
    expect(botao('Inserir texto')).toBeDisabled();
    expect(botao('Editar texto')).toBeDisabled();
    cleanup();

    renderizar('Produção', semSelecao);
    expect(botao('Linha de simetria')).toBeDisabled();
    cleanup();

    renderizar('Modelo', semSelecao);
    expect(botao('Relacionamento piques')).toBeDisabled();
    expect(botao('Autor')).toBeEnabled();
    cleanup();

    // Com várias peças marcadas, a cor vale para todas; o resto é de uma peça só.
    renderizar('Início', { temSelecao: true, temSelecaoUnica: false });
    expect(botao('Cor')).toBeEnabled();
    cleanup();

    renderizar('Conferência', { podeSelecionarTudo: false });
    expect(botao('Conferir')).toBeDisabled();
  });

  it('Construção e Produção: as ferramentas de retas e pontos chamam a ferramenta de cada uma', () => {
    const props = renderizar('Construção');
    const nomes = [
      'Por ângulo',
      'Estender reta',
      'Estender até elemento',
      'Estender duas retas',
      'Por coordenada',
      'Por interseção',
      'No centro do arco',
      'No perímetro',
      'Por distância',
    ];
    for (const nome of nomes) fireEvent.click(botao(nome));
    expect(vi.mocked(props.onUsarFerramentaDeElemento).mock.calls.map(([ferramenta]) => ferramenta)).toEqual([
      'reta-por-angulo',
      'estender-reta',
      'estender-ate-elemento',
      'estender-duas-retas',
      'ponto-por-coordenada',
      'ponto-por-intersecao',
      'ponto-no-centro-do-arco',
      'ponto-no-perimetro',
      'ponto-por-distancia',
    ]);
    cleanup();

    const naProducao = renderizar('Produção');
    fireEvent.click(botao('Extrair molde'));
    expect(naProducao.onUsarFerramentaDeElemento).toHaveBeenCalledWith('extrair-molde');
  });

  it('Manipulação: as cinco ferramentas de elementos chamam a ferramenta de cada uma e mostram quando estão ligadas', () => {
    const props = renderizar('Manipulação');
    const pares = [
      ['Manipular pontos', 'mover-ponto-de-construcao'],
      ['Manipulação rápida', 'manipulacao-rapida'],
      ['Dividir elementos', 'dividir-linha'],
      ['Transformar em elementos', 'transformar-em-elementos'],
      ['Copiar ou trocar elemento', 'copiar-elemento'],
    ] as const;
    for (const [nome] of pares) fireEvent.click(botao(nome));
    expect(vi.mocked(props.onUsarFerramentaDeElemento).mock.calls.map(([ferramenta]) => ferramenta)).toEqual(pares.map(([, modo]) => modo));
    cleanup();

    for (const [nome, modo] of pares) {
      renderizar('Manipulação', { modo });
      expect(botao(nome)).toHaveAttribute('aria-pressed', 'true');
      cleanup();
    }
  });

  it('as ferramentas de retas e pontos pedem uma peça selecionada', () => {
    const semSelecao = { temSelecao: false, temSelecaoUnica: false };
    renderizar('Construção', semSelecao);
    for (const nome of ['Por ângulo', 'Estender reta', 'Por coordenada', 'No centro do arco']) {
      expect(botao(nome)).toBeDisabled();
      expect(botao(nome).title).toBe(`${nome} — selecione uma peça primeiro`);
    }
    cleanup();
    renderizar('Manipulação', semSelecao);
    for (const nome of ['Manipular pontos', 'Manipulação rápida', 'Dividir elementos', 'Transformar em elementos', 'Copiar ou trocar elemento']) {
      expect(botao(nome)).toBeDisabled();
      expect(botao(nome).title).toBe(`${nome} — selecione uma peça primeiro`);
    }
  });

  it('Produção: Dobrar e Desdobrar dizem na dica os modos e a dobra mantida, como no manual da referência', () => {
    renderizar('Produção');

    expect(botao('Dobrar').title).toContain('na horizontal, na vertical, numa linha interna ou por dois pontos do contorno');
    expect(botao('Dobrar').title).toContain('Manter dobra do molde');
    expect(botao('Desdobrar').title).toContain('como era');
  });

  it('Conferência: as medidas, as comparações e as quatro cotas', () => {
    const props = renderizar('Conferência');

    for (const nome of [
      'Distância',
      'Perímetro',
      'Comparar perímetros',
      'Comparar distância',
      'Cota perímetro',
      'Cota distância',
      'Horizontal / Vertical',
      'Ângulo',
    ]) {
      fireEvent.click(botao(nome));
    }

    for (const acao of [
      props.onEntrarModoMedirDistancia,
      props.onEntrarModoMedirPerimetro,
      props.onEntrarModoCompararPerimetros,
      props.onEntrarModoCompararDistancias,
      props.onEntrarModoCotaPerimetro,
      props.onEntrarModoCotaDistancia,
      props.onEntrarModoCotaHorizontalVertical,
      props.onEntrarModoCotaAngulo,
    ]) {
      expect(acao).toHaveBeenCalledTimes(1);
    }
  });

  it('Conferência: cada cota aparece pressionada enquanto é a ferramenta ligada', () => {
    for (const [modo, nome] of [
      ['cota-perimetro', 'Cota perímetro'],
      ['cota-distancia', 'Cota distância'],
      ['cota-horizontal-vertical', 'Horizontal / Vertical'],
      ['cota-angulo', 'Ângulo'],
      ['comparar-distancias', 'Comparar distância'],
    ] as const) {
      renderizar('Conferência', { modo });
      expect(botao(nome)).toHaveAttribute('aria-pressed', 'true');
      expect(botao('Distância')).toHaveAttribute('aria-pressed', 'false');
      cleanup();
    }
  });

  it('Modelo: Propriedades, Informações, Tecidos, Informações dos moldes e Localizar modelos', () => {
    const props = renderizar('Modelo');

    fireEvent.click(botao('Propriedades'));
    fireEvent.click(botao('Informações'));
    fireEvent.click(botao('Tecidos'));
    fireEvent.click(botao('Informações dos moldes'));
    fireEvent.click(botao('Localizar modelos'));
    fireEvent.click(botao('Variantes'));

    expect(props.onAbrirVariantes).toHaveBeenCalledTimes(1);
    expect(props.onAbrirPropriedadesDaPeca).toHaveBeenCalledTimes(1);
    expect(props.onAbrirRelatorio).toHaveBeenCalledTimes(1);
    expect(props.onAbrirTecido).toHaveBeenCalledTimes(1);
    expect(props.onAbrirInformacoesDosMoldes).toHaveBeenCalledTimes(1);
    expect(props.onAbrirBiblioteca).toHaveBeenCalledTimes(1);
  });

  it('a ferramenta ligada aparece pressionada na aba dela', () => {
    renderizar('Construção', { modo: 'retangulo' });
    expect(botao('Retângulo')).toHaveAttribute('aria-pressed', 'true');
    expect(botao('Reta')).toHaveAttribute('aria-pressed', 'false');
    cleanup();

    renderizar('Produção', { modo: 'novo-molde' });
    expect(botao('Criar molde')).toHaveAttribute('aria-pressed', 'true');
    expect(botao('Sentido do fio')).toHaveAttribute('aria-pressed', 'false');
    cleanup();

    renderizar('Conferência', { modo: 'medir-distancia' });
    expect(botao('Distância')).toHaveAttribute('aria-pressed', 'true');
    expect(botao('Perímetro')).toHaveAttribute('aria-pressed', 'false');
    cleanup();

    renderizar('Início', { modo: 'medir-distancia' });
    expect(botao('Selecionar')).toHaveAttribute('aria-pressed', 'false');
  });

  it('um botão de ação (que não é ferramenta de modo) não tem estado de pressionado', () => {
    renderizar('Início');

    expect(botao('Colar')).not.toHaveAttribute('aria-pressed');
    expect(botao('Restaurar')).not.toHaveAttribute('aria-pressed');
  });
});

describe('BarraDeFerramentas: o que falta para usar', () => {
  afterEach(() => cleanup());

  it('sem peça selecionada, as ferramentas que agem numa peça ficam desligadas e dizem o que falta', () => {
    const semSelecao = { temSelecao: false, temSelecaoUnica: false, temPontoDeRestauracao: false, podeRemoverCostura: false };

    renderizar('Início', semSelecao);
    for (const nome of ['Recortar', 'Copiar', 'Excluir', 'Ponto de restauração', 'Restaurar']) {
      expect(botao(nome)).toBeDisabled();
      expect(botao(nome).title).toBe(`${nome} — selecione uma peça primeiro`);
    }
    cleanup();

    renderizar('Produção', semSelecao);
    for (const nome of [
      'Sentido do fio',
      'Costura',
      'Remover costura',
      'Converter em costura',
      'Bainha',
      'Dobrar',
      'Desdobrar',
      'Cortar',
      'Unir',
      'Remover região',
      'Pregas',
      'Pence no contorno',
      'Pence interna',
      'Fechar pence',
      'Transferir pence',
      'Múltiplas pences',
    ]) {
      expect(botao(nome)).toBeDisabled();
      expect(botao(nome).title).toBe(`${nome} — selecione uma peça primeiro`);
    }
    expect(botao('Criar molde')).toBeEnabled();
    cleanup();

    renderizar('Modelo', semSelecao);
    expect(botao('Propriedades').title).toBe('Propriedades — selecione uma peça primeiro');
    expect(botao('Informações dos moldes')).toBeEnabled();
  });

  it('com um lote marcado (sem peça única), a costura e o Excluir valem; o que edita uma peça só, não', () => {
    renderizar('Produção', { temSelecao: true, temSelecaoUnica: false });
    expect(botao('Costura')).toBeEnabled();
    expect(botao('Remover costura')).toBeEnabled();
    expect(botao('Sentido do fio')).toBeDisabled();
    cleanup();

    renderizar('Início', { temSelecao: true, temSelecaoUnica: false });
    expect(botao('Excluir')).toBeEnabled();
    expect(botao('Copiar')).toBeDisabled();
  });

  it('Unir pede outra peça além da selecionada; as outras ferramentas de corte, não', () => {
    renderizar('Produção', { temOutraPeca: false });

    expect(botao('Unir')).toBeDisabled();
    expect(botao('Unir').title).toBe('Unir — é preciso ter outra peça para unir a esta');
    expect(botao('Cortar')).toBeEnabled();
    expect(botao('Remover região')).toBeEnabled();
  });

  it('Restaurar pede antes um ponto de restauração para a peça', () => {
    const props = renderizar('Início', { temPontoDeRestauracao: false });

    expect(botao('Restaurar')).toBeDisabled();
    expect(botao('Restaurar').title).toBe('Restaurar — crie antes um ponto de restauração para esta peça');
    expect(botao('Ponto de restauração')).toBeEnabled();
    fireEvent.click(botao('Restaurar'));
    expect(props.onRestaurar).not.toHaveBeenCalled();
  });

  it('Remover costura e Converter em contorno ficam desligados quando a seleção não tem costura', () => {
    renderizar('Produção', { podeRemoverCostura: false });

    expect(botao('Remover costura')).toBeDisabled();
    expect(botao('Remover costura').title).toBe('Remover costura — a seleção não tem costura para remover');
    expect(botao('Converter em contorno')).toBeDisabled();
    expect(botao('Converter em contorno').title).toBe('Converter em contorno — a seleção não tem costura para converter');
    expect(botao('Costura')).toBeEnabled();
  });

  it('Colar pede antes uma peça copiada ou recortada', () => {
    renderizar('Início', { podeColar: false });

    expect(botao('Colar').title).toBe('Colar — copie ou recorte uma peça primeiro');
  });

  it('sem peças no projeto, não há o que selecionar nem perímetro para medir; a Distância continua valendo', () => {
    const semPecas = { podeSelecionarTudo: false, temSelecao: false, temSelecaoUnica: false };

    renderizar('Início', semPecas);
    for (const nome of ['Inverter seleção', 'Selecionar tudo', 'Inverter moldes', 'Selecionar moldes']) {
      expect(botao(nome).title).toBe(`${nome} — não há peças no projeto`);
    }
    cleanup();

    renderizar('Conferência', semPecas);
    // As cotas ficam presas a uma peça: sem peças, não há onde pôr.
    for (const nome of ['Perímetro', 'Comparar perímetros', 'Cota perímetro', 'Cota distância', 'Horizontal / Vertical', 'Ângulo']) {
      expect(botao(nome).title).toBe(`${nome} — não há peças no projeto`);
    }
    expect(botao('Distância')).toBeEnabled();
    expect(botao('Comparar distância')).toBeEnabled();
  });
});
